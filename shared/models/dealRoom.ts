import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";

/**
 * Live Deal Room — the weekly one-to-many deal-review call (Mondays 11:30am
 * ET on Google Meet) plus the recorded-call ledger that feeds the AI
 * training corpus.
 *
 * - deal_room_sessions: one row per weekly session. Recording/replay assets
 *   are attached by the Drive ingest job (server/dealRoomIngest.ts) after the
 *   call ends; replays are hosted free on realist.ca (no Skool signup).
 * - deal_room_registrations: who asked to attend. Registration is the lead
 *   capture — email is the gate, phone/SMS is optional. Idempotent per
 *   (session, email).
 * - call_sessions: EVERY recorded call on the platform (deal room, 1:1
 *   discovery, deal review, mortgage). One ledger so transcripts + outcomes
 *   accumulate in one place for retrieval and, later, model training.
 */

export const DEAL_ROOM_SESSION_STATUSES = [
  "scheduled",
  "completed",
  "canceled",
] as const;
export type DealRoomSessionStatus = (typeof DEAL_ROOM_SESSION_STATUSES)[number];

export const dealRoomSessions = pgTable(
  "deal_room_sessions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    title: text("title").default("Live Deal Room").notNull(),
    scheduledAt: timestamp("scheduled_at").notNull(),
    durationMinutes: integer("duration_minutes").default(60).notNull(),
    meetUrl: text("meet_url"),
    status: varchar("status", { length: 20 }).default("scheduled").notNull(),
    // Replay assets — set by the Drive ingest job.
    driveRecordingFileId: text("drive_recording_file_id"),
    recordingUrl: text("recording_url"), // Drive webViewLink
    replayEmbedUrl: text("replay_embed_url"), // Drive /preview URL for embedding
    driveTranscriptFileId: text("drive_transcript_file_id"),
    transcriptText: text("transcript_text"),
    aiSummary: text("ai_summary"),
    aiChapters: jsonb("ai_chapters").default([]).notNull(), // [{label: string}]
    replayEmailedAt: timestamp("replay_emailed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_deal_room_sessions_status").on(table.status, table.scheduledAt)],
);

export const dealRoomRegistrations = pgTable(
  "deal_room_registrations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    sessionId: varchar("session_id")
      .references(() => dealRoomSessions.id, { onDelete: "cascade" })
      .notNull(),
    userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
    // Soft link to crm_contacts.id (no FK — contact creation is best-effort).
    crmContactId: varchar("crm_contact_id"),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    smsConsent: boolean("sms_consent").default(false).notNull(),
    // Registration form displays the recording/AI-use disclosure; this stamps
    // when the registrant accepted it.
    recordingConsentAt: timestamp("recording_consent_at"),
    source: varchar("source", { length: 50 }), // deal-room | lead-modal | replay | analyzer | ...
    registeredAt: timestamp("registered_at").defaultNow().notNull(),
    remindedAt: timestamp("reminded_at"),
    attended: boolean("attended").default(false).notNull(),
    replayEmailedAt: timestamp("replay_emailed_at"),
    watchedReplayAt: timestamp("watched_replay_at"),
  },
  (table) => [
    uniqueIndex("uq_deal_room_registrations_session_email").on(table.sessionId, table.email),
    index("idx_deal_room_registrations_session").on(table.sessionId),
    index("idx_deal_room_registrations_email").on(table.email),
  ],
);

export const CALL_SESSION_TYPES = [
  "deal_room",
  "discovery",
  "deal_review",
  "mortgage",
] as const;
export type CallSessionType = (typeof CALL_SESSION_TYPES)[number];

export const CALL_SESSION_OUTCOMES = [
  "booked_next",
  "agreement",
  "follow_up",
  "lost",
  "no_show",
] as const;
export type CallSessionOutcome = (typeof CALL_SESSION_OUTCOMES)[number];

export const callSessions = pgTable(
  "call_sessions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    type: varchar("type", { length: 20 }).notNull(),
    // Soft links — each call may relate to any of these, none enforced so the
    // ledger never blocks an ingest.
    crmContactId: varchar("crm_contact_id"),
    bookedCallLeadId: varchar("booked_call_lead_id"),
    dealRoomSessionId: varchar("deal_room_session_id"),
    scheduledAt: timestamp("scheduled_at"),
    heldAt: timestamp("held_at"),
    platform: varchar("platform", { length: 20 }).default("google_meet").notNull(),
    driveRecordingFileId: text("drive_recording_file_id"),
    recordingUrl: text("recording_url"),
    transcriptUrl: text("transcript_url"),
    transcriptText: text("transcript_text"),
    durationSecs: integer("duration_secs"),
    outcome: varchar("outcome", { length: 20 }),
    rep: text("rep"), // who ran the call
    aiSummary: text("ai_summary"),
    // Structured extraction (objections, commitments, deal params, next steps)
    extractedJson: jsonb("extracted_json").default({}).notNull(),
    consentConfirmedAt: timestamp("consent_confirmed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_call_sessions_type").on(table.type, table.createdAt),
    index("idx_call_sessions_contact").on(table.crmContactId),
  ],
);

export const insertDealRoomSessionSchema = createInsertSchema(dealRoomSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDealRoomSession = z.infer<typeof insertDealRoomSessionSchema>;
export type DealRoomSession = typeof dealRoomSessions.$inferSelect;
export type DealRoomRegistration = typeof dealRoomRegistrations.$inferSelect;
export type CallSession = typeof callSessions.$inferSelect;

/** Public registration request — email is the gate, everything else optional. */
export const dealRoomRegisterRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(30).optional(),
  smsConsent: z.boolean().optional().default(false),
  source: z.string().trim().max(50).optional(),
});
export type DealRoomRegisterRequest = z.infer<typeof dealRoomRegisterRequestSchema>;

/** Replay unlock — lightweight email capture, no account required. */
export const dealRoomReplayUnlockSchema = z.object({
  email: z.string().trim().email().max(320),
  name: z.string().trim().max(200).optional(),
});
export type DealRoomReplayUnlock = z.infer<typeof dealRoomReplayUnlockSchema>;
