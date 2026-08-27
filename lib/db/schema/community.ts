import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// ─── Community & offer funnel ────────────────────────────────────────────────

/** Allowed values for community_leads.source — shared with the join API. */
export const COMMUNITY_LEAD_SOURCES = ["meetup_rsvp", "work_with_us", "event"] as const;
export type CommunityLeadSource = (typeof COMMUNITY_LEAD_SOURCES)[number];

/**
 * Every inbound hand-raise from the community surfaces: event-invite signups
 * on /community, offer-funnel leads from /work-with-us, and event RSVPs. One
 * table on purpose — the referral business works these as a single queue, and
 * `source` is the routing key.
 */
export const communityLeads = pgTable(
  "community_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name"),
    /** 'meetup_rsvp' | 'work_with_us' | 'event' — see COMMUNITY_LEAD_SOURCES. */
    source: text("source").$type<CommunityLeadSource>().notNull(),
    city: text("city"),
    message: text("message"),
    /** Free-form "what are you buying" from the work-with-us form. */
    propertyInterest: text("property_interest"),
    consentMarketing: boolean("consent_marketing").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // The lead queue is worked newest-first per source.
    index("community_leads_source_created_idx").on(table.source, table.createdAt),
  ],
);

/**
 * Snapshot of Meetup events keyed by iCal UID. The page reads the live
 * in-memory cache in lib/community/meetup.ts; this table lets crons keep a
 * durable copy (event history survives Meetup dropping past events from the
 * feed) without another Meetup round-trip.
 */
export const meetupEventCache = pgTable("meetup_event_cache", {
  uid: text("uid").primaryKey(),
  payload: jsonb("payload").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CommunityLead = typeof communityLeads.$inferSelect;
export type NewCommunityLead = typeof communityLeads.$inferInsert;
export type MeetupEventCacheRow = typeof meetupEventCache.$inferSelect;
