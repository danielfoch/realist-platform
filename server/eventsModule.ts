import type { Express, Request, Response, NextFunction } from "express";
import "express-session";
import crypto from "crypto";
import Stripe from "stripe";
import { and, asc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { getUncachableStripeClient } from "./stripeClient";
import { sendNotificationEmail, sendWelcomeAccountEmail } from "./resend";
import { sendCrmWebhook, buildCrmWebhookPayload } from "./crmWebhook";
import {
  realistEvents,
  realistEventSpeakers,
  realistEventSponsors,
  realistEventTicketTypes,
  realistEventOrders,
  realistEventAttendees,
  realistEventRsvps,
  passwordResetTokens,
  users,
} from "@shared/schema";
import { normalizeEmail, SETUP_LINK_TTL_MS } from "@shared/authTokens";
import { paymentOutcome, sessionMatchesEvent, summarizeRoster } from "@shared/eventCheckout";

const EVENT_ADMIN_EMAILS = new Set(
  (process.env.REALIST_EVENT_ADMIN_EMAILS ||
    "jonathan@realist.ca,danielfoch@gmail.com,na4hill@gmail.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);
const DEFAULT_EVENT_ADMIN_EMAIL = "jonathan@realist.ca";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

const agendaSectionSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
  time: z.string().optional().default(""),
});

const speakerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  title: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
});

const sponsorSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  logoUrl: z.string().optional().nullable(),
  websiteUrl: z.string().optional().nullable(),
  tier: z.string().default("partner"),
  sortOrder: z.coerce.number().int().default(0),
});

const ticketTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  priceCents: z.coerce.number().int().min(0),
  currency: z.string().length(3).default("cad").transform((v) => v.toLowerCase()),
  quantityTotal: z.coerce.number().int().min(0).optional().nullable(),
  salesStartAt: z.string().optional().nullable(),
  salesEndAt: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const eventPayloadSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  shortDescription: z.string().optional().nullable(),
  longDescription: z.string().optional().nullable(),
  headerImageUrl: z.string().optional().nullable(),
  eventType: z.enum(["IN_PERSON", "WEBINAR", "HYBRID"]).default("IN_PERSON"),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  startsAt: z.string().min(1),
  endsAt: z.string().optional().nullable(),
  timezone: z.string().default("America/Toronto"),
  venueName: z.string().optional().nullable(),
  venueAddress: z.string().optional().nullable(),
  onlineUrl: z.string().optional().nullable(),
  agendaSections: z.array(agendaSectionSchema).default([]),
  capacity: z.coerce.number().int().min(0).optional().nullable(),
  refundPolicy: z.string().optional().nullable(),
  seoTitle: z.string().optional().nullable(),
  seoDescription: z.string().optional().nullable(),
  kind: z.enum(["flagship", "meetup"]).default("flagship"),
  city: z.string().optional().nullable(),
  isRecurring: z.boolean().default(false),
  recurrenceNote: z.string().optional().nullable(),
  speakers: z.array(speakerSchema).default([]),
  sponsors: z.array(sponsorSchema).default([]),
  ticketTypes: z.array(ticketTypeSchema).default([]),
}).superRefine((data, ctx) => {
  if (data.kind === "flagship" && data.ticketTypes.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Paid events need at least one ticket type" });
  }
});

const checkoutSchema = z.object({
  ticketTypeId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(10).default(1),
});

function nullableDate(value?: string | null) {
  return value ? new Date(value) : null;
}

export function baseUrlFromRequest(req: Request) {
  const configured = process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const host = req.get("host") || process.env.REPLIT_DEV_DOMAIN || "realist.ca";
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export async function getSessionUser(req: Request) {
  const userId = req.session?.userId;
  if (!userId) return null;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user || null;
}

export async function requireEventAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "Authentication required" });
    if (!EVENT_ADMIN_EMAILS.has(user.email.toLowerCase())) {
      return res.status(403).json({ error: "Event admin access required" });
    }
    next();
  } catch (error) {
    console.error("[events] admin auth check failed:", error);
    return res.status(401).json({ error: "Authentication required" });
  }
}

export async function isEventAdminRequest(req: Request) {
  try {
    const user = await getSessionUser(req);
    return user?.email ? EVENT_ADMIN_EMAILS.has(user.email.toLowerCase()) : false;
  } catch (error) {
    console.error("[events] public admin check failed:", error);
    return false;
  }
}

export async function ensureRealistEventTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "realist_events" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "slug" text NOT NULL UNIQUE,
      "title" text NOT NULL,
      "short_description" text,
      "long_description" text,
      "header_image_url" text,
      "event_type" text NOT NULL DEFAULT 'IN_PERSON',
      "status" text NOT NULL DEFAULT 'DRAFT',
      "starts_at" timestamp NOT NULL,
      "ends_at" timestamp,
      "timezone" text NOT NULL DEFAULT 'America/Toronto',
      "venue_name" text,
      "venue_address" text,
      "online_url" text,
      "agenda_sections" jsonb DEFAULT '[]'::jsonb,
      "capacity" integer,
      "refund_policy" text,
      "seo_title" text,
      "seo_description" text,
      "created_by_email" text NOT NULL,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "realist_event_speakers" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "event_id" varchar NOT NULL REFERENCES "realist_events"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "title" text,
      "company" text,
      "bio" text,
      "image_url" text,
      "sort_order" integer NOT NULL DEFAULT 0
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "realist_event_ticket_types" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "event_id" varchar NOT NULL REFERENCES "realist_events"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "description" text,
      "price_cents" integer NOT NULL,
      "currency" varchar(3) NOT NULL DEFAULT 'cad',
      "quantity_total" integer,
      "quantity_sold" integer NOT NULL DEFAULT 0,
      "sales_start_at" timestamp,
      "sales_end_at" timestamp,
      "is_active" boolean NOT NULL DEFAULT true
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "realist_event_orders" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "event_id" varchar NOT NULL REFERENCES "realist_events"("id"),
      "ticket_type_id" varchar NOT NULL REFERENCES "realist_event_ticket_types"("id"),
      "user_id" varchar REFERENCES "users"("id"),
      "email" text NOT NULL,
      "name" text,
      "quantity" integer NOT NULL DEFAULT 1,
      "amount_paid_cents" integer NOT NULL,
      "currency" varchar(3) NOT NULL DEFAULT 'cad',
      "stripe_checkout_session_id" text NOT NULL UNIQUE,
      "stripe_payment_intent_id" text,
      "stripe_customer_id" text,
      "status" text NOT NULL DEFAULT 'PAID',
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "realist_event_attendees" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "event_id" varchar NOT NULL REFERENCES "realist_events"("id"),
      "ticket_type_id" varchar NOT NULL REFERENCES "realist_event_ticket_types"("id"),
      "order_id" varchar NOT NULL REFERENCES "realist_event_orders"("id") ON DELETE CASCADE,
      "user_id" varchar REFERENCES "users"("id"),
      "email" text NOT NULL,
      "name" text,
      "checked_in_at" timestamp,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);
  // Growth-engine columns (idempotent on existing deployments).
  await db.execute(sql`
    ALTER TABLE "realist_events"
      ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'flagship',
      ADD COLUMN IF NOT EXISTS "city" text,
      ADD COLUMN IF NOT EXISTS "is_recurring" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "recurrence_note" text,
      ADD COLUMN IF NOT EXISTS "host_user_id" varchar,
      ADD COLUMN IF NOT EXISTS "reminder_sent_at" timestamp,
      ADD COLUMN IF NOT EXISTS "recurrence_rule" text,
      ADD COLUMN IF NOT EXISTS "recurrence_until" timestamp,
      ADD COLUMN IF NOT EXISTS "parent_event_id" varchar
  `);
  // Community layer: discussion threads on event pages.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "realist_event_comments" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "event_id" varchar NOT NULL REFERENCES "realist_events"("id") ON DELETE CASCADE,
      "user_id" varchar NOT NULL REFERENCES "users"("id"),
      "parent_comment_id" varchar,
      "body" text NOT NULL,
      "status" text NOT NULL DEFAULT 'visible',
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "event_comments_event_idx" ON "realist_event_comments" ("event_id", "status")
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "realist_event_rsvps" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "event_id" varchar NOT NULL REFERENCES "realist_events"("id") ON DELETE CASCADE,
      "user_id" varchar REFERENCES "users"("id"),
      "email" text NOT NULL,
      "name" text,
      "status" text NOT NULL DEFAULT 'GOING',
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "uq_event_rsvp_email" ON "realist_event_rsvps" ("event_id", "email")
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "realist_event_announcements" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "event_id" varchar NOT NULL REFERENCES "realist_events"("id") ON DELETE CASCADE,
      "audience" text NOT NULL DEFAULT 'all_optin',
      "sent_count" integer NOT NULL DEFAULT 0,
      "triggered_by_email" text,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "realist_event_sponsors" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "event_id" varchar NOT NULL REFERENCES "realist_events"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "logo_url" text,
      "website_url" text,
      "tier" text NOT NULL DEFAULT 'partner',
      "sort_order" integer NOT NULL DEFAULT 0
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "realist_sponsors" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "name" text NOT NULL,
      "logo_url" text,
      "website_url" text,
      "blurb" text,
      "tier" text NOT NULL DEFAULT 'partner',
      "is_active" boolean NOT NULL DEFAULT true,
      "sort_order" integer NOT NULL DEFAULT 0,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "realist_sponsorship_packages" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "slug" text NOT NULL UNIQUE,
      "access_key" text NOT NULL,
      "name" text NOT NULL,
      "description" text,
      "event_scope" text,
      "price_cents" integer NOT NULL,
      "currency" varchar(3) NOT NULL DEFAULT 'cad',
      "perks" jsonb DEFAULT '[]'::jsonb,
      "contract_url" text,
      "sales_deck_url" text,
      "quantity_total" integer,
      "quantity_sold" integer NOT NULL DEFAULT 0,
      "is_active" boolean NOT NULL DEFAULT true,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "realist_sponsorship_orders" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "package_id" varchar NOT NULL REFERENCES "realist_sponsorship_packages"("id"),
      "company" text NOT NULL,
      "contact_name" text,
      "email" text NOT NULL,
      "amount_paid_cents" integer NOT NULL,
      "currency" varchar(3) NOT NULL DEFAULT 'cad',
      "stripe_checkout_session_id" text NOT NULL UNIQUE,
      "stripe_payment_intent_id" text,
      "status" text NOT NULL DEFAULT 'PAID',
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);
}

async function getEventBundleById(id: string) {
  const [event] = await db.select().from(realistEvents).where(eq(realistEvents.id, id)).limit(1);
  if (!event) return null;
  const [speakers, sponsors, ticketTypes] = await Promise.all([
    db.select().from(realistEventSpeakers).where(eq(realistEventSpeakers.eventId, id)).orderBy(asc(realistEventSpeakers.sortOrder)),
    db.select().from(realistEventSponsors).where(eq(realistEventSponsors.eventId, id)).orderBy(asc(realistEventSponsors.sortOrder)),
    db.select().from(realistEventTicketTypes).where(eq(realistEventTicketTypes.eventId, id)).orderBy(asc(realistEventTicketTypes.priceCents)),
  ]);
  return { ...event, speakers, sponsors, ticketTypes };
}

async function getPublishedEventBundleBySlug(slug: string, includeOnlineUrl: boolean) {
  const [event] = await db.select().from(realistEvents).where(and(eq(realistEvents.slug, slug), eq(realistEvents.status, "PUBLISHED"))).limit(1);
  if (!event) return null;
  const [speakers, sponsors, ticketTypes] = await Promise.all([
    db.select().from(realistEventSpeakers).where(eq(realistEventSpeakers.eventId, event.id)).orderBy(asc(realistEventSpeakers.sortOrder)),
    db.select().from(realistEventSponsors).where(eq(realistEventSponsors.eventId, event.id)).orderBy(asc(realistEventSponsors.sortOrder)),
    db.select().from(realistEventTicketTypes).where(eq(realistEventTicketTypes.eventId, event.id)).orderBy(asc(realistEventTicketTypes.priceCents)),
  ]);
  return { ...event, onlineUrl: includeOnlineUrl ? event.onlineUrl : null, speakers, sponsors, ticketTypes };
}

async function saveEvent(payload: z.infer<typeof eventPayloadSchema>, createdByEmail: string, id?: string) {
  const eventValues = {
    slug: payload.slug,
    title: payload.title,
    shortDescription: payload.shortDescription || null,
    longDescription: payload.longDescription || null,
    headerImageUrl: payload.headerImageUrl || null,
    eventType: payload.eventType,
    status: payload.status,
    startsAt: new Date(payload.startsAt),
    endsAt: nullableDate(payload.endsAt),
    timezone: payload.timezone || "America/Toronto",
    venueName: payload.venueName || null,
    venueAddress: payload.venueAddress || null,
    onlineUrl: payload.onlineUrl || null,
    agendaSections: payload.agendaSections,
    capacity: payload.capacity ?? null,
    refundPolicy: payload.refundPolicy || null,
    seoTitle: payload.seoTitle || null,
    seoDescription: payload.seoDescription || null,
    kind: payload.kind,
    city: payload.city || null,
    isRecurring: payload.isRecurring,
    recurrenceNote: payload.recurrenceNote || null,
    createdByEmail,
    updatedAt: new Date(),
  };

  const [event] = id
    ? await db.update(realistEvents).set(eventValues).where(eq(realistEvents.id, id)).returning()
    : await db.insert(realistEvents).values(eventValues).returning();

  await db.delete(realistEventSpeakers).where(eq(realistEventSpeakers.eventId, event.id));
  if (payload.speakers.length) {
    await db.insert(realistEventSpeakers).values(payload.speakers.map((speaker) => ({
      eventId: event.id,
      name: speaker.name,
      title: speaker.title || null,
      company: speaker.company || null,
      bio: speaker.bio || null,
      imageUrl: speaker.imageUrl || null,
      sortOrder: speaker.sortOrder,
    })));
  }

  await db.delete(realistEventSponsors).where(eq(realistEventSponsors.eventId, event.id));
  if (payload.sponsors?.length) {
    await db.insert(realistEventSponsors).values(payload.sponsors.map((sponsor) => ({
      eventId: event.id,
      name: sponsor.name,
      logoUrl: sponsor.logoUrl || null,
      websiteUrl: sponsor.websiteUrl || null,
      tier: sponsor.tier || "partner",
      sortOrder: sponsor.sortOrder ?? 0,
    })));
  }

  const existingTickets = id
    ? await db.select().from(realistEventTicketTypes).where(eq(realistEventTicketTypes.eventId, event.id))
    : [];
  const existingSoldById = new Map(existingTickets.map((ticket) => [ticket.id, ticket.quantitySold]));
  await db.delete(realistEventTicketTypes).where(eq(realistEventTicketTypes.eventId, event.id));
  if (payload.ticketTypes.length) await db.insert(realistEventTicketTypes).values(payload.ticketTypes.map((ticket) => ({
    eventId: event.id,
    name: ticket.name,
    description: ticket.description || null,
    priceCents: ticket.priceCents,
    currency: ticket.currency || "cad",
    quantityTotal: ticket.quantityTotal ?? null,
    quantitySold: ticket.id ? existingSoldById.get(ticket.id) || 0 : 0,
    salesStartAt: nullableDate(ticket.salesStartAt),
    salesEndAt: nullableDate(ticket.salesEndAt),
    isActive: ticket.isActive,
  })));

  return getEventBundleById(event.id);
}

export function registerRealistEventRoutes(app: Express) {
  ensureRealistEventTables().catch((error) => {
    console.error("[events] failed to ensure tables:", error.message);
  });

  app.get("/api/admin/events", requireEventAdmin, async (_req, res) => {
    const events = await db.select().from(realistEvents).orderBy(asc(realistEvents.startsAt));
    res.json(events);
  });

  app.get("/api/admin/events/:id", requireEventAdmin, async (req, res) => {
    const event = await getEventBundleById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  });

  app.post("/api/admin/events", requireEventAdmin, async (req, res) => {
    try {
      const admin = await getSessionUser(req);
      const payload = eventPayloadSchema.parse(req.body);
      const event = await saveEvent(payload, admin?.email || DEFAULT_EVENT_ADMIN_EMAIL);
      res.status(201).json(event);
    } catch (error: any) {
      res.status(400).json({ error: error.errors?.[0]?.message || error.message || "Invalid event" });
    }
  });

  app.patch("/api/admin/events/:id", requireEventAdmin, async (req, res) => {
    try {
      const existing = await getEventBundleById(req.params.id);
      if (!existing) return res.status(404).json({ error: "Event not found" });
      const payload = eventPayloadSchema.parse(req.body);
      const event = await saveEvent(payload, existing.createdByEmail, req.params.id);
      res.json(event);
    } catch (error: any) {
      res.status(400).json({ error: error.errors?.[0]?.message || error.message || "Invalid event" });
    }
  });

  app.get("/api/realist-events", async (req, res) => {
    try {
      const kind = typeof req.query.kind === "string" ? req.query.kind : null;
      const city = typeof req.query.city === "string" ? req.query.city : null;
      const conditions = [eq(realistEvents.status, "PUBLISHED")];
      if (kind === "flagship" || kind === "meetup") conditions.push(eq(realistEvents.kind, kind));
      if (city) conditions.push(eq(realistEvents.city, city));
      const events = await db.select().from(realistEvents)
        .where(and(...conditions))
        .orderBy(asc(realistEvents.startsAt))
        .limit(200);
      const ids = events.map((event) => event.id);
      const prices = ids.length ? await db.select({
        eventId: realistEventTicketTypes.eventId,
        minPriceCents: sql<number>`MIN(${realistEventTicketTypes.priceCents})`,
      }).from(realistEventTicketTypes)
        .where(and(inArray(realistEventTicketTypes.eventId, ids), eq(realistEventTicketTypes.isActive, true)))
        .groupBy(realistEventTicketTypes.eventId) : [];
      const rsvps = ids.length ? await db.select({
        eventId: realistEventRsvps.eventId,
        going: sql<number>`COUNT(*)`,
      }).from(realistEventRsvps)
        .where(and(inArray(realistEventRsvps.eventId, ids), eq(realistEventRsvps.status, "GOING")))
        .groupBy(realistEventRsvps.eventId) : [];
      const priceByEvent = new Map(prices.map((row) => [row.eventId, Number(row.minPriceCents)]));
      const rsvpByEvent = new Map(rsvps.map((row) => [row.eventId, Number(row.going)]));
      res.json(events.map((event) => ({
        ...event,
        onlineUrl: null,
        minPriceCents: priceByEvent.get(event.id) ?? null,
        rsvpCount: rsvpByEvent.get(event.id) ?? 0,
      })));
    } catch (error: any) {
      console.error("[events] public list failed:", error);
      res.status(500).json({ error: "Failed to load events" });
    }
  });

  app.get("/api/events/:slug", async (req, res) => {
    const user = await getSessionUser(req);
    const isAdmin = await isEventAdminRequest(req);
    const [event] = await db.select().from(realistEvents).where(eq(realistEvents.slug, req.params.slug)).limit(1);
    if (!event || (event.status !== "PUBLISHED" && !isAdmin)) {
      return res.status(404).json({ error: "Event not found" });
    }
    const paid = user
      ? await db.select({ id: realistEventOrders.id }).from(realistEventOrders).where(
        and(eq(realistEventOrders.eventId, event.id), eq(realistEventOrders.userId, user.id), eq(realistEventOrders.status, "PAID")),
      ).limit(1)
      : [];
    const bundle = event.status === "PUBLISHED"
      ? await getPublishedEventBundleBySlug(req.params.slug, isAdmin || paid.length > 0)
      : await getEventBundleById(event.id);
    res.json(bundle);
  });

  app.post("/api/events/:slug/checkout", async (req, res) => {
    try {
      const payload = checkoutSchema.parse(req.body);
      const [event] = await db.select().from(realistEvents).where(and(eq(realistEvents.slug, req.params.slug), eq(realistEvents.status, "PUBLISHED"))).limit(1);
      if (!event) return res.status(404).json({ error: "Event not found" });

      const [ticket] = await db.select().from(realistEventTicketTypes).where(
        and(eq(realistEventTicketTypes.id, payload.ticketTypeId), eq(realistEventTicketTypes.eventId, event.id), eq(realistEventTicketTypes.isActive, true)),
      ).limit(1);
      if (!ticket) return res.status(400).json({ error: "Ticket type is not available" });

      const now = new Date();
      if (ticket.salesStartAt && ticket.salesStartAt > now) return res.status(400).json({ error: "Ticket sales have not started" });
      if (ticket.salesEndAt && ticket.salesEndAt < now) return res.status(400).json({ error: "Ticket sales have ended" });
      if (ticket.quantityTotal !== null && ticket.quantitySold + payload.quantity > ticket.quantityTotal) {
        return res.status(400).json({ error: "Not enough tickets remain" });
      }
      if (event.capacity !== null) {
        const [sold] = await db.select({ sold: sql<number>`COALESCE(SUM(${realistEventTicketTypes.quantitySold}), 0)` })
          .from(realistEventTicketTypes)
          .where(eq(realistEventTicketTypes.eventId, event.id));
        if ((Number(sold?.sold || 0) + payload.quantity) > event.capacity) {
          return res.status(400).json({ error: "Event is sold out" });
        }
      }

      const user = await getSessionUser(req);
      const baseUrl = baseUrlFromRequest(req);
      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        customer: undefined,
        customer_email: user?.email || undefined,
        customer_creation: "always",
        client_reference_id: `${event.id}:${ticket.id}`,
        line_items: [{
          price_data: {
            currency: ticket.currency,
            product_data: {
              name: `${event.title} - ${ticket.name}`,
              description: ticket.description || event.shortDescription || undefined,
            },
            unit_amount: ticket.priceCents,
          },
          quantity: payload.quantity,
        }],
        success_url: `${baseUrl}/events/${event.slug}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/events/${event.slug}`,
        metadata: {
          eventId: event.id,
          ticketTypeId: ticket.id,
          quantity: String(payload.quantity),
          source: "realist_events",
        },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      res.status(400).json({ error: error.errors?.[0]?.message || error.message || "Failed to create checkout" });
    }
  });

  // Success-page verification. Stripe webhooks can lag (or, on a misconfigured
  // deploy, never arrive) — so the buyer's success page confirms payment
  // directly with Stripe and triggers fulfilment as an idempotent fallback.
  app.get("/api/events/:slug/verify-payment", async (req, res) => {
    try {
      const sessionId = typeof req.query.session_id === "string" ? req.query.session_id : "";
      if (!sessionId) return res.status(400).json({ error: "session_id is required" });

      const [event] = await db.select().from(realistEvents)
        .where(and(eq(realistEvents.slug, req.params.slug), eq(realistEvents.status, "PUBLISHED"))).limit(1);
      if (!event) return res.status(404).json({ error: "Event not found" });

      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (!sessionMatchesEvent(session, event.id)) {
        return res.status(400).json({ error: "This payment does not belong to this event" });
      }

      const outcome = paymentOutcome(session);
      if (outcome === "paid") {
        // Idempotent: no-ops if the webhook already fulfilled this session.
        await fulfillRealistEventCheckout(session).catch((error) =>
          console.error("[events] verify-payment fulfilment fallback failed:", error.message),
        );
      }
      const [order] = await db.select({ id: realistEventOrders.id })
        .from(realistEventOrders)
        .where(eq(realistEventOrders.stripeCheckoutSessionId, session.id)).limit(1);

      res.json({ outcome, fulfilled: !!order, eventTitle: event.title });
    } catch (error: any) {
      console.error("[events] verify-payment failed:", error.message);
      res.status(500).json({ error: "Could not verify payment" });
    }
  });

  // Admin order roster + door-ops summary.
  app.get("/api/admin/events/:id/orders", requireEventAdmin, async (req, res) => {
    const [event] = await db.select().from(realistEvents).where(eq(realistEvents.id, req.params.id)).limit(1);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const [orders, attendees, ticketTypes] = await Promise.all([
      db.select().from(realistEventOrders).where(eq(realistEventOrders.eventId, event.id)).orderBy(asc(realistEventOrders.createdAt)),
      db.select().from(realistEventAttendees).where(eq(realistEventAttendees.eventId, event.id)).orderBy(asc(realistEventAttendees.name)),
      db.select().from(realistEventTicketTypes).where(eq(realistEventTicketTypes.eventId, event.id)),
    ]);
    const ticketNameById = new Map(ticketTypes.map((t) => [t.id, t.name]));
    res.json({
      event: { id: event.id, title: event.title, slug: event.slug, startsAt: event.startsAt },
      summary: summarizeRoster(orders, attendees),
      ticketTypes: ticketTypes.map((t) => ({ id: t.id, name: t.name })),
      attendees: attendees.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        ticketType: ticketNameById.get(a.ticketTypeId) || "—",
        checkedInAt: a.checkedInAt,
      })),
    });
  });

  // Door check-in: mark an attendee arrived (or undo). checked_in_at existed on
  // the attendees table since launch but nothing ever wrote it.
  app.post("/api/admin/events/:id/attendees/:attendeeId/check-in", requireEventAdmin, async (req, res) => {
    const checkedIn = req.body?.checkedIn !== false; // default true; pass {checkedIn:false} to undo
    const [updated] = await db.update(realistEventAttendees)
      .set({ checkedInAt: checkedIn ? new Date() : null })
      .where(and(
        eq(realistEventAttendees.id, req.params.attendeeId),
        eq(realistEventAttendees.eventId, req.params.id),
      ))
      .returning();
    if (!updated) return res.status(404).json({ error: "Attendee not found for this event" });
    res.json({ id: updated.id, checkedInAt: updated.checkedInAt });
  });
}

async function createOrUpdateEventUser(session: Stripe.Checkout.Session) {
  // normalizeEmail (lowercase + trim) so Stripe-entered emails can't fork
  // identities against the other silent-creation paths.
  const email = normalizeEmail(session.customer_details?.email || session.customer_email);
  if (!email) return null;
  const name = session.customer_details?.name || "";
  const [firstName, ...lastParts] = name.split(" ").filter(Boolean);
  const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    if (stripeCustomerId && !existing.stripeCustomerId) {
      const [updated] = await db.update(users)
        .set({ stripeCustomerId, updatedAt: new Date() })
        .where(eq(users.id, existing.id))
        .returning();
      return updated || existing;
    }
    return existing;
  }

  const [user] = await db.insert(users).values({
    email,
    firstName: firstName || null,
    lastName: lastParts.join(" ") || null,
    role: "investor",
    emailVerified: true,
    stripeCustomerId,
  }).returning();

  const baseUrl = process.env.PUBLIC_BASE_URL || "https://realist.ca";
  const rawToken = crypto.randomBytes(32).toString("hex");
  // /api/auth/set-password looks tokens up by sha256 hash — store the hash,
  // put the raw token in the link (same pattern as forgot-password in auth.ts)
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + SETUP_LINK_TTL_MS);
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    token: tokenHash,
    expiresAt,
  });
  await sendWelcomeAccountEmail({
    toEmail: email,
    firstName: firstName || "there",
    setupLink: `${baseUrl.replace(/\/$/, "")}/set-password?token=${rawToken}`,
    leadSource: "Realist Event Checkout",
  }).catch((error) => console.error("[events] welcome email failed:", error.message));

  return user;
}

async function sendEventConfirmationEmail(params: {
  email: string;
  name?: string | null;
  event: typeof realistEvents.$inferSelect;
  ticket: typeof realistEventTicketTypes.$inferSelect;
  quantity: number;
}) {
  const startsAt = new Intl.DateTimeFormat("en-CA", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: params.event.timezone,
  }).format(params.event.startsAt);
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
      <h1>Your Realist event ticket is confirmed</h1>
      <p>Hi ${params.name || "there"},</p>
      <p>You are registered for <strong>${params.event.title}</strong>.</p>
      <p><strong>When:</strong> ${startsAt} (${params.event.timezone})</p>
      <p><strong>Ticket:</strong> ${params.ticket.name} x ${params.quantity}</p>
      ${params.event.venueName ? `<p><strong>Location:</strong> ${params.event.venueName}${params.event.venueAddress ? `<br>${params.event.venueAddress}` : ""}</p>` : ""}
      <p>Online meeting details, when applicable, are available from your paid event access.</p>
      <p style="color:#6b7280;font-size:13px;">Realist.ca</p>
    </div>
  `;
  await sendNotificationEmail({
    to: params.email,
    subject: `Confirmed: ${params.event.title}`,
    html,
  });
}

export async function fulfillRealistEventCheckout(session: Stripe.Checkout.Session) {
  if (session.metadata?.source !== "realist_events") return;
  if (session.payment_status !== "paid") {
    console.log(`[events] checkout.session.completed ignored because payment_status=${session.payment_status}`);
    return;
  }

  const eventId = session.metadata.eventId;
  const ticketTypeId = session.metadata.ticketTypeId;
  const quantity = Number(session.metadata.quantity || "1");
  if (!eventId || !ticketTypeId || !Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Realist event checkout session missing metadata");
  }

  const [existingOrder] = await db.select().from(realistEventOrders).where(eq(realistEventOrders.stripeCheckoutSessionId, session.id)).limit(1);
  if (existingOrder) {
    console.log(`[events] checkout already fulfilled: ${session.id}`);
    return;
  }

  const [event] = await db.select().from(realistEvents).where(eq(realistEvents.id, eventId)).limit(1);
  const [ticket] = await db.select().from(realistEventTicketTypes).where(eq(realistEventTicketTypes.id, ticketTypeId)).limit(1);
  if (!event || !ticket || ticket.eventId !== event.id) throw new Error("Realist event checkout references invalid event or ticket");

  const email = (session.customer_details?.email || session.customer_email || "").toLowerCase();
  if (!email) throw new Error("Realist event checkout has no customer email");
  const name = session.customer_details?.name || null;
  const user = await createOrUpdateEventUser(session);

  await db.transaction(async (tx) => {
    const [order] = await tx.insert(realistEventOrders).values({
      eventId: event.id,
      ticketTypeId: ticket.id,
      userId: user?.id || null,
      email,
      name,
      quantity,
      amountPaidCents: session.amount_total || ticket.priceCents * quantity,
      currency: (session.currency || ticket.currency || "cad").toLowerCase(),
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
      status: "PAID",
    }).returning();

    if (event.capacity !== null) {
      const [sold] = await tx.select({ sold: sql<number>`COALESCE(SUM(${realistEventTicketTypes.quantitySold}), 0)` })
        .from(realistEventTicketTypes)
        .where(eq(realistEventTicketTypes.eventId, event.id));
      if ((Number(sold?.sold || 0) + quantity) > event.capacity) {
        throw new Error("Realist event capacity is no longer available");
      }
    }

    const [updatedTicket] = await tx.update(realistEventTicketTypes)
      .set({ quantitySold: sql`${realistEventTicketTypes.quantitySold} + ${quantity}` })
      .where(and(
        eq(realistEventTicketTypes.id, ticket.id),
        ticket.quantityTotal === null
          ? gt(realistEventTicketTypes.quantitySold, -1)
          : lte(sql`${realistEventTicketTypes.quantitySold} + ${quantity}`, ticket.quantityTotal),
      ))
      .returning();
    if (!updatedTicket) throw new Error("Realist event ticket inventory is no longer available");

    await tx.insert(realistEventAttendees).values(Array.from({ length: quantity }, () => ({
      eventId: event.id,
      ticketTypeId: ticket.id,
      orderId: order.id,
      userId: user?.id || null,
      email,
      name,
    })));
  });

  const crmPayload = buildCrmWebhookPayload({
    eventType: "user.joined_waitlist",
    actor: user ? { id: user.id, email, role: user.role || "investor" } : { email },
    recipient: { id: user?.id, email, name: name || undefined },
    email: {
      templateKey: "realist_event_attendee",
      tags: ["realist_event_attendee", `event:${event.slug}`, "weekly_deal_analysis"],
    },
    metadata: {
      eventId: event.id,
      eventSlug: event.slug,
      eventTitle: event.title,
      ticketTypeId: ticket.id,
      quantity,
      stripeCheckoutSessionId: session.id,
    },
  });
  await sendCrmWebhook(crmPayload).catch((error) => console.error("[events] CRM webhook failed:", error.message));
  await sendEventConfirmationEmail({ email, name, event, ticket, quantity }).catch((error) => console.error("[events] confirmation email failed:", error.message));
}
