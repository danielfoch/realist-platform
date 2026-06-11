/**
 * Events growth engine — the meetup.com replacement + sponsor machine.
 *
 * - Free-event RSVPs that double as account signups (the funnel: meetup
 *   member → realist.ca account → deal analysis → AI training data).
 * - Member-created meetups (any logged-in user can host; official recurring
 *   meetups are admin-created with isRecurring).
 * - Announcement blasts to opted-in users (the meetup.com email behaviour).
 * - 48h reminder sweep for attendees + RSVPs (cron, x-api-key gated).
 * - Sponsors: public visibility + private, unlisted sponsorship packages
 *   purchasable on-site through Stripe.
 */

import type { Express, Request, Response } from "express";
import "express-session";
import crypto from "crypto";
import Stripe from "stripe";
import { and, asc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { getUncachableStripeClient } from "./stripeClient";
import { sendNotificationEmail, sendWelcomeAccountEmail } from "./resend";
import { logUserActivity } from "./userActivity";
import {
  baseUrlFromRequest,
  getSessionUser,
  isEventAdminRequest,
  requireEventAdmin,
} from "./eventsModule";
import {
  passwordResetTokens,
  realistEventAnnouncements,
  realistEventAttendees,
  realistEventRsvps,
  realistEvents,
  realistEventTicketTypes,
  realistSponsors,
  realistSponsorshipOrders,
  realistSponsorshipPackages,
  users,
} from "@shared/schema";

const ANNOUNCE_BATCH_CAP = 5000;
const SPONSOR_ADMIN_NOTIFY = () =>
  (process.env.REALIST_EVENT_ADMIN_EMAILS ||
    "jonathan@realist.ca,danielfoch@gmail.com,na4hill@gmail.com")
    .split(",").map((email) => email.trim()).filter(Boolean);

function cronKeyOk(req: Request): boolean {
  const key = req.headers["x-api-key"] || req.query.api_key;
  const configured = process.env.EVENTS_CRON_API_KEY || process.env.DEAL_DESK_API_KEY;
  return Boolean(configured && key === configured);
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Guest RSVP = silent account creation, same pattern as paid checkout:
 * the RSVP IS the signup.
 */
async function ensureUserByEmail(email: string, name: string | null, leadSource: string) {
  const normalized = email.toLowerCase();
  const [existing] = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  if (existing) return existing;

  const [firstName, ...lastParts] = (name || "").split(" ").filter(Boolean);
  const [user] = await db.insert(users).values({
    email: normalized,
    firstName: firstName || null,
    lastName: lastParts.join(" ") || null,
    role: "investor",
    emailVerified: true,
  }).returning();

  const baseUrl = process.env.PUBLIC_BASE_URL || "https://realist.ca";
  const rawToken = crypto.randomBytes(32).toString("hex");
  // /api/auth/set-password looks tokens up by sha256 hash — store the hash,
  // put the raw token in the link (same pattern as forgot-password in auth.ts)
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    token: tokenHash,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  await sendWelcomeAccountEmail({
    toEmail: normalized,
    firstName: firstName || "there",
    setupLink: `${baseUrl.replace(/\/$/, "")}/set-password?token=${rawToken}`,
    leadSource,
  }).catch((error) => console.error("[events-growth] welcome email failed:", error.message));
  return user;
}

function eventDateLine(event: typeof realistEvents.$inferSelect): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: event.timezone || "America/Toronto",
  }).format(event.startsAt);
}

function eventEmailHtml(event: typeof realistEvents.$inferSelect, heading: string, intro: string, baseUrl: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
      <h1>${heading}</h1>
      <p>${intro}</p>
      <h2 style="margin-bottom:4px;">${event.title}</h2>
      <p style="margin-top:0;"><strong>When:</strong> ${eventDateLine(event)}</p>
      ${event.venueName ? `<p><strong>Where:</strong> ${event.venueName}${event.venueAddress ? `, ${event.venueAddress}` : ""}</p>` : ""}
      ${event.city ? `<p><strong>City:</strong> ${event.city}</p>` : ""}
      ${event.shortDescription ? `<p>${event.shortDescription}</p>` : ""}
      <p><a href="${baseUrl}/events/${event.slug}" style="display:inline-block;background:#16a34a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">View event & RSVP</a></p>
      <p style="color:#6b7280;font-size:13px;">Realist.ca — Canada's real estate investor community. You receive event emails because you opted in; manage preferences in your account.</p>
    </div>
  `;
}

const rsvpSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().max(200).optional(),
});

const memberMeetupSchema = z.object({
  title: z.string().min(4).max(200),
  city: z.string().min(2).max(80),
  startsAt: z.string().min(1),
  venueName: z.string().max(200).optional().nullable(),
  venueAddress: z.string().max(300).optional().nullable(),
  shortDescription: z.string().max(2000).optional().nullable(),
  capacity: z.coerce.number().int().min(0).optional().nullable(),
});

const sponsorSchema = z.object({
  name: z.string().min(1).max(200),
  logoUrl: z.string().optional().nullable(),
  websiteUrl: z.string().optional().nullable(),
  blurb: z.string().max(500).optional().nullable(),
  tier: z.enum(["title", "gold", "silver", "partner"]).default("partner"),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

const packageSchema = z.object({
  slug: z.string().min(3).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1).max(200),
  description: z.string().max(8000).optional().nullable(),
  eventScope: z.string().max(200).optional().nullable(),
  priceCents: z.coerce.number().int().min(100),
  currency: z.string().length(3).default("cad").transform((v) => v.toLowerCase()),
  perks: z.array(z.string()).default([]),
  contractUrl: z.string().optional().nullable(),
  salesDeckUrl: z.string().optional().nullable(),
  quantityTotal: z.coerce.number().int().min(0).optional().nullable(),
  isActive: z.boolean().default(true),
});

const sponsorCheckoutSchema = z.object({
  key: z.string().min(8),
  company: z.string().min(1).max(200),
  contactName: z.string().max(200).optional().nullable(),
  email: z.string().email(),
});

export function registerEventsGrowthRoutes(app: Express): void {
  // ——— RSVP (free events / meetups) ————————————————————————————

  app.post("/api/realist-events/:slug/rsvp", async (req: Request, res: Response) => {
    try {
      const payload = rsvpSchema.parse(req.body || {});
      const [event] = await db.select().from(realistEvents)
        .where(and(eq(realistEvents.slug, req.params.slug), eq(realistEvents.status, "PUBLISHED")))
        .limit(1);
      if (!event) return res.status(404).json({ error: "Event not found" });

      const sessionUser = await getSessionUser(req);
      const email = (sessionUser?.email || payload.email || "").toLowerCase();
      if (!email) return res.status(400).json({ error: "Email is required to RSVP" });
      const name = sessionUser
        ? [sessionUser.firstName, sessionUser.lastName].filter(Boolean).join(" ") || null
        : payload.name || null;

      const user = sessionUser ?? await ensureUserByEmail(email, name, `Realist Meetup RSVP: ${event.slug}`);

      if (event.capacity !== null) {
        const [count] = await db.select({ going: sql<number>`COUNT(*)` })
          .from(realistEventRsvps)
          .where(and(eq(realistEventRsvps.eventId, event.id), eq(realistEventRsvps.status, "GOING")));
        if (Number(count?.going || 0) >= event.capacity) {
          return res.status(400).json({ error: "This event is full" });
        }
      }

      await db.insert(realistEventRsvps)
        .values({ eventId: event.id, userId: user?.id || null, email, name, status: "GOING" })
        .onConflictDoUpdate({
          target: [realistEventRsvps.eventId, realistEventRsvps.email],
          set: { status: "GOING", userId: user?.id || null, name },
        });

      await logUserActivity(req, {
        userId: user?.id || null,
        eventName: "event.rsvp",
        sourcePage: `/events/${event.slug}`,
        metadata: { eventId: event.id, eventSlug: event.slug, kind: event.kind },
      });

      const baseUrl = baseUrlFromRequest(req);
      await sendNotificationEmail({
        to: email,
        subject: `You're in: ${event.title}`,
        html: eventEmailHtml(event, "You're on the list", `Hi ${name?.split(" ")[0] || "there"}, your RSVP is confirmed.`, baseUrl),
      }).catch((error) => console.error("[events-growth] rsvp email failed:", error.message));

      res.json({ success: true, accountCreated: !sessionUser });
    } catch (error: any) {
      res.status(400).json({ error: error.errors?.[0]?.message || error.message || "Failed to RSVP" });
    }
  });

  app.post("/api/realist-events/:slug/rsvp/cancel", async (req: Request, res: Response) => {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return res.status(401).json({ error: "Log in to manage your RSVP" });
    const [event] = await db.select().from(realistEvents).where(eq(realistEvents.slug, req.params.slug)).limit(1);
    if (!event) return res.status(404).json({ error: "Event not found" });
    await db.update(realistEventRsvps)
      .set({ status: "CANCELLED" })
      .where(and(eq(realistEventRsvps.eventId, event.id), eq(realistEventRsvps.email, sessionUser.email.toLowerCase())));
    res.json({ success: true });
  });

  // ——— Member-created meetups ————————————————————————————————

  app.post("/api/member-meetups", async (req: Request, res: Response) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: "Create a free account to host a meetup" });
      const payload = memberMeetupSchema.parse(req.body);

      const startsAt = new Date(payload.startsAt);
      if (Number.isNaN(startsAt.getTime()) || startsAt < new Date()) {
        return res.status(400).json({ error: "Pick a start date in the future" });
      }

      const dateToken = startsAt.toISOString().slice(0, 10).replace(/-/g, "");
      let slug = `${slugify(payload.title)}-${slugify(payload.city)}-${dateToken}`;
      const [collision] = await db.select({ id: realistEvents.id }).from(realistEvents).where(eq(realistEvents.slug, slug)).limit(1);
      if (collision) slug = `${slug}-${crypto.randomBytes(2).toString("hex")}`;

      const [event] = await db.insert(realistEvents).values({
        slug,
        title: payload.title,
        shortDescription: payload.shortDescription || null,
        eventType: "IN_PERSON",
        status: "PUBLISHED",
        startsAt,
        timezone: "America/Toronto",
        venueName: payload.venueName || null,
        venueAddress: payload.venueAddress || null,
        capacity: payload.capacity ?? null,
        kind: "meetup",
        city: payload.city,
        isRecurring: false,
        hostUserId: user.id,
        createdByEmail: user.email,
      }).returning();

      await logUserActivity(req, {
        userId: user.id,
        eventName: "event.meetup_created",
        sourcePage: "/community/events",
        metadata: { eventId: event.id, city: payload.city },
      });

      res.status(201).json(event);
    } catch (error: any) {
      res.status(400).json({ error: error.errors?.[0]?.message || error.message || "Failed to create meetup" });
    }
  });

  // ——— Announcement blast (the meetup.com email) ————————————————

  app.post("/api/admin/events/:id/announce", requireEventAdmin, async (req: Request, res: Response) => {
    try {
      const admin = await getSessionUser(req);
      const [event] = await db.select().from(realistEvents).where(eq(realistEvents.id, req.params.id)).limit(1);
      if (!event) return res.status(404).json({ error: "Event not found" });
      if (event.status !== "PUBLISHED") return res.status(400).json({ error: "Publish the event before announcing it" });

      const [already] = await db.select().from(realistEventAnnouncements)
        .where(eq(realistEventAnnouncements.eventId, event.id)).limit(1);
      if (already && req.body?.force !== true) {
        return res.status(400).json({ error: "Already announced. Pass force=true to send again." });
      }

      const recipients = await db.select({ email: users.email, firstName: users.firstName })
        .from(users)
        .where(eq(users.emailDigestOptIn, true))
        .limit(ANNOUNCE_BATCH_CAP);

      const [record] = await db.insert(realistEventAnnouncements).values({
        eventId: event.id,
        audience: "all_optin",
        sentCount: 0,
        triggeredByEmail: admin?.email || null,
      }).returning();

      res.json({ success: true, queued: recipients.length });

      // Send after responding — a blast should never hold the request open.
      const baseUrl = baseUrlFromRequest(req);
      let sent = 0;
      for (const recipient of recipients) {
        try {
          await sendNotificationEmail({
            to: recipient.email,
            subject: `New Realist event: ${event.title}`,
            html: eventEmailHtml(
              event,
              event.kind === "meetup" ? "New meetup in your network" : "New Realist event",
              `Hi ${recipient.firstName || "there"}, a new ${event.kind === "meetup" ? "investor meetup" : "event"} just went live.`,
              baseUrl,
            ),
          });
          sent += 1;
          if (sent % 25 === 0) {
            await db.update(realistEventAnnouncements).set({ sentCount: sent }).where(eq(realistEventAnnouncements.id, record.id));
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        } catch (error: any) {
          console.error(`[events-growth] announce send failed for ${recipient.email}:`, error.message);
        }
      }
      await db.update(realistEventAnnouncements).set({ sentCount: sent }).where(eq(realistEventAnnouncements.id, record.id));
      console.log(`[events-growth] announced ${event.slug} to ${sent}/${recipients.length} recipients`);
    } catch (error: any) {
      if (!res.headersSent) res.status(500).json({ error: error.message || "Failed to announce" });
    }
  });

  // ——— Reminder sweep (cron: every hour) ————————————————————————

  app.post("/api/realist-events/sweep/reminders", async (req: Request, res: Response) => {
    if (!cronKeyOk(req) && !(await isEventAdminRequest(req))) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const dueEvents = await db.select().from(realistEvents).where(and(
      eq(realistEvents.status, "PUBLISHED"),
      gte(realistEvents.startsAt, now),
      lte(realistEvents.startsAt, windowEnd),
      isNull(realistEvents.reminderSentAt),
    ));

    let totalSent = 0;
    for (const event of dueEvents) {
      // Claim before sending so concurrent sweeps never double-remind.
      const [claimed] = await db.update(realistEvents)
        .set({ reminderSentAt: now })
        .where(and(eq(realistEvents.id, event.id), isNull(realistEvents.reminderSentAt)))
        .returning({ id: realistEvents.id });
      if (!claimed) continue;

      const [attendees, rsvps] = await Promise.all([
        db.select({ email: realistEventAttendees.email, name: realistEventAttendees.name })
          .from(realistEventAttendees).where(eq(realistEventAttendees.eventId, event.id)),
        db.select({ email: realistEventRsvps.email, name: realistEventRsvps.name })
          .from(realistEventRsvps)
          .where(and(eq(realistEventRsvps.eventId, event.id), eq(realistEventRsvps.status, "GOING"))),
      ]);
      const seen = new Set<string>();
      const recipients = [...attendees, ...rsvps].filter((person) => {
        const key = person.email.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const baseUrl = process.env.PUBLIC_BASE_URL || "https://realist.ca";
      for (const person of recipients) {
        try {
          await sendNotificationEmail({
            to: person.email,
            subject: `Reminder: ${event.title} is coming up`,
            html: eventEmailHtml(event, "See you soon", `Hi ${person.name?.split(" ")[0] || "there"}, quick reminder about your upcoming event.`, baseUrl),
          });
          totalSent += 1;
        } catch (error: any) {
          console.error(`[events-growth] reminder failed for ${person.email}:`, error.message);
        }
      }
    }
    res.json({ success: true, events: dueEvents.length, remindersSent: totalSent });
  });

  // ——— Sponsors: public + admin ————————————————————————————————

  app.get("/api/sponsors", async (_req: Request, res: Response) => {
    const sponsors = await db.select().from(realistSponsors)
      .where(eq(realistSponsors.isActive, true))
      .orderBy(asc(realistSponsors.sortOrder), asc(realistSponsors.name));
    res.json(sponsors);
  });

  app.get("/api/admin/sponsors", requireEventAdmin, async (_req: Request, res: Response) => {
    const sponsors = await db.select().from(realistSponsors).orderBy(asc(realistSponsors.sortOrder));
    res.json(sponsors);
  });

  app.post("/api/admin/sponsors", requireEventAdmin, async (req: Request, res: Response) => {
    try {
      const payload = sponsorSchema.parse(req.body);
      const [sponsor] = await db.insert(realistSponsors).values(payload).returning();
      res.status(201).json(sponsor);
    } catch (error: any) {
      res.status(400).json({ error: error.errors?.[0]?.message || error.message || "Invalid sponsor" });
    }
  });

  app.patch("/api/admin/sponsors/:id", requireEventAdmin, async (req: Request, res: Response) => {
    try {
      const payload = sponsorSchema.partial().parse(req.body);
      const [sponsor] = await db.update(realistSponsors).set(payload)
        .where(eq(realistSponsors.id, req.params.id)).returning();
      if (!sponsor) return res.status(404).json({ error: "Sponsor not found" });
      res.json(sponsor);
    } catch (error: any) {
      res.status(400).json({ error: error.errors?.[0]?.message || error.message || "Invalid sponsor" });
    }
  });

  // ——— Sponsorship packages: admin CRUD + private page + checkout ———

  app.get("/api/admin/sponsor-packages", requireEventAdmin, async (_req: Request, res: Response) => {
    const packages = await db.select().from(realistSponsorshipPackages).orderBy(asc(realistSponsorshipPackages.createdAt));
    res.json(packages);
  });

  app.post("/api/admin/sponsor-packages", requireEventAdmin, async (req: Request, res: Response) => {
    try {
      const payload = packageSchema.parse(req.body);
      const accessKey = crypto.randomBytes(12).toString("hex");
      const [pkg] = await db.insert(realistSponsorshipPackages).values({ ...payload, accessKey }).returning();
      res.status(201).json(pkg);
    } catch (error: any) {
      res.status(400).json({ error: error.errors?.[0]?.message || error.message || "Invalid package" });
    }
  });

  app.patch("/api/admin/sponsor-packages/:id", requireEventAdmin, async (req: Request, res: Response) => {
    try {
      const payload = packageSchema.partial().parse(req.body);
      const [pkg] = await db.update(realistSponsorshipPackages).set(payload)
        .where(eq(realistSponsorshipPackages.id, req.params.id)).returning();
      if (!pkg) return res.status(404).json({ error: "Package not found" });
      res.json(pkg);
    } catch (error: any) {
      res.status(400).json({ error: error.errors?.[0]?.message || error.message || "Invalid package" });
    }
  });

  // Private package page: requires slug + access key (unlisted, not authed —
  // sponsors are external and should not need an account to view or buy).
  app.get("/api/sponsor-packages/:slug", async (req: Request, res: Response) => {
    const key = typeof req.query.key === "string" ? req.query.key : "";
    const [pkg] = await db.select().from(realistSponsorshipPackages)
      .where(and(eq(realistSponsorshipPackages.slug, req.params.slug), eq(realistSponsorshipPackages.isActive, true)))
      .limit(1);
    if (!pkg || pkg.accessKey !== key) return res.status(404).json({ error: "Package not found" });
    const soldOut = pkg.quantityTotal !== null && pkg.quantitySold >= pkg.quantityTotal;
    const { accessKey: _omit, ...safe } = pkg;
    res.json({ ...safe, soldOut });
  });

  app.post("/api/sponsor-packages/:slug/checkout", async (req: Request, res: Response) => {
    try {
      const payload = sponsorCheckoutSchema.parse(req.body);
      const [pkg] = await db.select().from(realistSponsorshipPackages)
        .where(and(eq(realistSponsorshipPackages.slug, req.params.slug), eq(realistSponsorshipPackages.isActive, true)))
        .limit(1);
      if (!pkg || pkg.accessKey !== payload.key) return res.status(404).json({ error: "Package not found" });
      if (pkg.quantityTotal !== null && pkg.quantitySold >= pkg.quantityTotal) {
        return res.status(400).json({ error: "This package is sold out" });
      }

      const baseUrl = baseUrlFromRequest(req);
      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        customer_email: payload.email,
        line_items: [{
          price_data: {
            currency: pkg.currency,
            product_data: {
              name: `Realist Sponsorship — ${pkg.name}`,
              description: pkg.eventScope || undefined,
            },
            unit_amount: pkg.priceCents,
          },
          quantity: 1,
        }],
        success_url: `${baseUrl}/sponsor/${pkg.slug}?key=${pkg.accessKey}&purchased=1`,
        cancel_url: `${baseUrl}/sponsor/${pkg.slug}?key=${pkg.accessKey}`,
        metadata: {
          source: "realist_sponsorship",
          packageId: pkg.id,
          company: payload.company.slice(0, 200),
          contactName: (payload.contactName || "").slice(0, 200),
        },
      });
      res.json({ url: session.url });
    } catch (error: any) {
      res.status(400).json({ error: error.errors?.[0]?.message || error.message || "Failed to start checkout" });
    }
  });
}

export async function fulfillSponsorshipCheckout(session: Stripe.Checkout.Session): Promise<void> {
  if (session.metadata?.source !== "realist_sponsorship") return;
  if (session.payment_status !== "paid") return;

  const packageId = session.metadata.packageId;
  if (!packageId) throw new Error("Sponsorship checkout missing packageId");

  const [existing] = await db.select().from(realistSponsorshipOrders)
    .where(eq(realistSponsorshipOrders.stripeCheckoutSessionId, session.id)).limit(1);
  if (existing) return;

  const [pkg] = await db.select().from(realistSponsorshipPackages)
    .where(eq(realistSponsorshipPackages.id, packageId)).limit(1);
  if (!pkg) throw new Error("Sponsorship checkout references unknown package");

  const email = (session.customer_details?.email || session.customer_email || "").toLowerCase();
  const company = session.metadata.company || session.customer_details?.name || "Unknown company";

  await db.transaction(async (tx) => {
    await tx.insert(realistSponsorshipOrders).values({
      packageId: pkg.id,
      company,
      contactName: session.metadata?.contactName || null,
      email,
      amountPaidCents: session.amount_total || pkg.priceCents,
      currency: (session.currency || pkg.currency).toLowerCase(),
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
      status: "PAID",
    });
    await tx.update(realistSponsorshipPackages)
      .set({ quantitySold: sql`${realistSponsorshipPackages.quantitySold} + 1` })
      .where(eq(realistSponsorshipPackages.id, pkg.id));
  });

  const amount = ((session.amount_total || pkg.priceCents) / 100).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
  for (const adminEmail of SPONSOR_ADMIN_NOTIFY()) {
    await sendNotificationEmail({
      to: adminEmail,
      subject: `💰 Sponsorship sold: ${company} — ${pkg.name} (${amount})`,
      html: `<p><strong>${company}</strong> bought <strong>${pkg.name}</strong> (${pkg.eventScope || "no scope"}) for ${amount}.</p><p>Contact: ${session.metadata?.contactName || "—"} · ${email}</p><p>Next: add their logo at /admin/sponsors and send onboarding.</p>`,
    }).catch((error) => console.error("[events-growth] sponsor admin notify failed:", error.message));
  }
  if (email) {
    await sendNotificationEmail({
      to: email,
      subject: `Sponsorship confirmed: ${pkg.name}`,
      html: `<p>Thanks — your sponsorship (<strong>${pkg.name}</strong>${pkg.eventScope ? `, ${pkg.eventScope}` : ""}) is confirmed.</p>${pkg.contractUrl ? `<p>Your agreement: <a href="${pkg.contractUrl}">${pkg.contractUrl}</a></p>` : ""}<p>Our team will reach out within one business day to collect logo assets and activation details.</p><p>— The Realist team</p>`,
    }).catch((error) => console.error("[events-growth] sponsor receipt failed:", error.message));
  }
}
