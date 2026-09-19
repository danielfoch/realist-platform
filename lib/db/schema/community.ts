import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// ─── Community ───────────────────────────────────────────────────────────────
// (Hand-raises from community surfaces are leads: see ./leads.ts.)

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

export type MeetupEventCacheRow = typeof meetupEventCache.$inferSelect;
