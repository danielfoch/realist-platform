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

// ─── Accounts ────────────────────────────────────────────────────────────────

/**
 * One row per person. Ids are varchar so accounts migrated from the legacy
 * app keep their original ids (scripts/migrate-users.ts) — anything that
 * referenced a user there still lines up here.
 *
 * `email` is always stored lowercased; uniqueness is on that stored value.
 * `password_hash` is bcrypt and nullable: Google-only and magic-link-only
 * accounts never set one.
 */
export const users = pgTable(
  "users",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    googleId: text("google_id"),
    name: text("name"),
    phone: text("phone"),
    city: text("city"),
    province: text("province"),
    /** What they invest in / are looking for — free text from the profile page. */
    investorFocus: text("investor_focus"),
    role: text("role").$type<"user" | "admin">().default("user").notNull(),
    /** The member's own power-team checklist: role key → "have" | "need". */
    powerTeam: jsonb("power_team").$type<Record<string, "have" | "need">>(),
    /** When the weekly digest last went to this member — the cron's guard against double sends. */
    lastDigestAt: timestamp("last_digest_at"),
    /** MLS® numbers already suggested in a Monday note (most recent last), so the note never repeats itself. */
    digestListings: jsonb("digest_listings").$type<string[]>(),
    /** Appear as "First L." on the leaderboard and have a public track-record page. */
    showOnLeaderboard: boolean("show_on_leaderboard").default(true).notNull(),
    emailVerifiedAt: timestamp("email_verified_at"),
    /** CASL: express marketing consent, with when and where it was given. */
    consentMarketing: boolean("consent_marketing").default(false).notNull(),
    consentAt: timestamp("consent_at"),
    consentSource: text("consent_source"),
    /** Everything else the legacy row carried, kept verbatim for reference. */
    legacy: jsonb("legacy").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    lastLoginAt: timestamp("last_login_at"),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_google_id_unique").on(table.googleId),
  ],
);

/**
 * Persistent logins. The cookie holds a random token; only its SHA-256 lives
 * here, so a database leak cannot be replayed as a session.
 */
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    userAgent: text("user_agent"),
    /** How this session was opened. A fresh emailed-link session may set a
     * password without knowing the old one — that is the "forgot password" path. */
    via: text("via").$type<"password" | "google" | "magic_link">().default("password").notNull(),
  },
  (table) => [index("sessions_user_idx").on(table.userId), index("sessions_expires_idx").on(table.expiresAt)],
);

/** Single-use emailed tokens: magic-link sign-in and password reset. */
export const loginTokens = pgTable(
  "login_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    email: text("email").notNull(),
    purpose: text("purpose").$type<"magic_link" | "reset_password">().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("login_tokens_email_idx").on(table.email)],
);

/** Failed-attempt counters (per email and per IP) behind the login throttle. */
export const authThrottle = pgTable("auth_throttle", {
  key: text("key").primaryKey(),
  count: integer("count").default(0).notNull(),
  windowStartedAt: timestamp("window_started_at").defaultNow().notNull(),
});

// ─── Saved deals ─────────────────────────────────────────────────────────────

/**
 * Anything a member bookmarks: an MLS® listing or a multiplex underwrite.
 * `snapshot` freezes the headline numbers at save time so the list still
 * reads well after a listing leaves the feed.
 */
export const savedDeals = pgTable(
  "saved_deals",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"listing" | "multiplex" | "analysis">().notNull(),
    /** Listing key or MLS® number, a multiplex underwrite's share token, or —
     * for analyses carried over from the legacy deal analyzer — that row's id. */
    refKey: text("ref_key").notNull(),
    title: text("title").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>(),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("saved_deals_user_kind_ref_unique").on(table.userId, table.kind, table.refKey),
    index("saved_deals_user_created_idx").on(table.userId, table.createdAt),
  ],
);

// ─── Consent + legacy carry-over ─────────────────────────────────────────────

/**
 * CASL proof of consent: an append-only ledger, never updated in place. The
 * current state for a person is their latest row per channel. Rows migrated
 * from the legacy app keep their original timestamps and `source` strings —
 * that pair IS the evidence of when and how consent was obtained.
 */
export const emailConsent = pgTable(
  "email_consent",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: varchar("channel", { length: 10 }).default("email").notNull(),
    status: varchar("status", { length: 10 }).$type<"granted" | "revoked">().notNull(),
    source: varchar("source", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_email_consent_user").on(table.userId, table.channel, table.createdAt)],
);

/**
 * Everything a member owned in the legacy app that this app does not model
 * yet (analyzer runs, saved searches, portfolio, notification settings…),
 * kept row-for-row as JSON so nothing is lost when the old database is shut
 * down and any of it can be promoted to a real table later.
 */
export const legacyUserRecords = pgTable(
  "legacy_user_records",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    sourceCreatedAt: timestamp("source_created_at"),
    migratedAt: timestamp("migrated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("legacy_user_records_source_unique").on(table.sourceTable, table.sourceId),
    index("legacy_user_records_user_idx").on(table.userId, table.sourceTable),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type SavedDeal = typeof savedDeals.$inferSelect;
