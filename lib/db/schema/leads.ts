import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

// ─── Leads: one queue, one outbox ────────────────────────────────────────────

/**
 * Every way a person raises a hand. One list on purpose: the kind decides the
 * CRM tags, who on the team is emailed, and whether a partner handoff applies.
 * Add a kind here before adding a form anywhere.
 */
export const LEAD_KINDS = [
  "signup", // created an account
  "event_invites", // asked for meetup invitations
  "meetup_rsvp", // saved a spot at a specific meetup
  "offer", // wants to buy a property with the cash-back offer
  "showing", // wants one in-person showing of a property they reviewed at their desk
  "financing", // mortgage / CMHC MLI Select conversation
  "power_team", // wants an introduction to a professional
  "underwriting_help", // wants a human to pressure-test their numbers
  "pro_application", // a professional who wants to work with Realist investors
  "first_underwrite", // behavioural: a member's first logged analysis (CRM only, no email)
  "active_underwriter", // behavioural: crossed an analysis threshold (no form)
] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];

export type LeadIntent = "acquisition" | "financing" | "general";
export type LeadRouting = "in_house" | "partner_referral" | "manual_review";

/** The property a lead is about, frozen at the moment they asked. */
export interface LeadProperty {
  address?: string | null;
  mlsNumber?: string | null;
  price?: number | null;
  url?: string | null;
}

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").$type<LeadKind>().notNull(),
    intent: text("intent").$type<LeadIntent>().notNull(),
    /** Who works it: Valery in-house near Toronto, a referral partner elsewhere. */
    routing: text("routing").$type<LeadRouting>().notNull(),
    email: text("email").notNull(),
    name: text("name"),
    /** E.164 when it could be normalised, otherwise as typed. */
    phone: text("phone"),
    city: text("city"),
    province: text("province"),
    message: text("message"),
    property: jsonb("property").$type<LeadProperty>(),
    /** Kind-specific detail: roles wanted, event, the numbers they were looking at. */
    context: jsonb("context").$type<Record<string, unknown>>(),
    userId: varchar("user_id"),
    consentMarketing: boolean("consent_marketing").default(false).notNull(),
    /** Agreed to share contact details with the named brokerage partner. */
    consentPartner: boolean("consent_partner").default(false).notNull(),
    consentVersion: text("consent_version"),
    pagePath: text("page_path"),
    utm: jsonb("utm").$type<Record<string, string>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("leads_kind_created_idx").on(table.kind, table.createdAt),
    index("leads_email_idx").on(table.email, table.createdAt),
  ],
);

export const LEAD_DESTINATIONS = ["ghl", "team_email", "keypr"] as const;
export type LeadDestination = (typeof LEAD_DESTINATIONS)[number];
export type LeadDeliveryStatus = "pending" | "sent" | "failed" | "skipped";

/**
 * The outbox. A lead is committed first; each place it must reach gets a row
 * here and is retried until it lands. A destination that isn't configured yet
 * simply waits — leads captured before the CRM key exists are delivered the
 * moment it does.
 */
export const leadDeliveries = pgTable(
  "lead_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    destination: text("destination").$type<LeadDestination>().notNull(),
    status: text("status").$type<LeadDeliveryStatus>().default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at").defaultNow().notNull(),
    /** Steps already done, so a retry never repeats one (e.g. a second CRM note). */
    progress: jsonb("progress").$type<Record<string, unknown>>(),
    /** The other side's id: CRM contact id, partner lead reference. */
    externalId: text("external_id"),
    lastError: text("last_error"),
    deliveredAt: timestamp("delivered_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("lead_deliveries_lead_destination_idx").on(table.leadId, table.destination),
    index("lead_deliveries_due_idx").on(table.status, table.nextAttemptAt),
  ],
);

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadDelivery = typeof leadDeliveries.$inferSelect;
