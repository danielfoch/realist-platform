import { boolean, index, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

// ─── The analysis log: what investors actually underwrite ────────────────────

/**
 * One row per person per deal — their latest numbers, not every keystroke.
 * This table is three things at once:
 *   - the member's own history ("your analyses"),
 *   - the leaderboard (eligible analyses, weighted by quality),
 *   - the learning set: `defaults` is what we offered, `inputs` is what they
 *     kept or changed, `edited` names the difference. The gap between the two,
 *     by market, is what teaches the next person's starting values.
 */
export const dealAnalyses = pgTable(
  "deal_analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** "user:<id>" or "sid:<anonymous session>" — the owner, signed in or not. */
    actorKey: text("actor_key").notNull(),
    userId: varchar("user_id"),
    sessionId: varchar("session_id"),
    /** "mls:<number>" for a listing, "addr:<normalised address>" for anything else. */
    dealKey: text("deal_key").notNull(),
    /** 'multiplex' = a Toronto multiplex underwrite, logged here so it counts; its report lives at reportToken. */
    source: text("source").$type<"listing" | "manual" | "multiplex">().notNull(),
    /** For source 'multiplex': the share token of the full report (/multiplex/r/<token>). */
    reportToken: varchar("report_token"),
    /** Set when the owner chooses to share this analysis: the public, read-only page at /a/<token>. */
    shareToken: varchar("share_token"),
    mlsNumber: varchar("mls_number"),
    address: text("address"),
    city: text("city"),
    province: varchar("province", { length: 2 }),
    /** First three characters of the postal code: fine-grained, never identifying. */
    fsa: varchar("fsa", { length: 3 }),
    propertyType: text("property_type"),
    /** Where the rent we OFFERED came from ("Actual rent", "Rent comps", "CMHC average"…). */
    rentSource: text("rent_source"),
    /** Our RAW rent estimate, before any learned adjustment — what a rent correction is measured against. */
    rentEstimate: real("rent_estimate"),
    /** Fields whose offered value was a learned one. Keeping such a value confirms it; see learn.ts. */
    learnedApplied: jsonb("learned_applied").$type<string[]>(),
    units: integer("units"),
    price: real("price").notNull(),
    inputs: jsonb("inputs").$type<Record<string, number>>().notNull(),
    defaults: jsonb("defaults").$type<Record<string, number>>().notNull(),
    edited: jsonb("edited").$type<string[]>().notNull(),
    // Headline results, denormalised so consensus and leaderboard queries never parse JSON.
    monthlyRent: real("monthly_rent"),
    capRate: real("cap_rate"),
    cashOnCash: real("cash_on_cash"),
    dscr: real("dscr"),
    monthlyCashFlow: real("monthly_cash_flow"),
    irr: real("irr"),
    /** Offer price the person solved for, when they used the solver. */
    offerPrice: real("offer_price"),
    quality: real("quality").notNull(),
    eligible: boolean("eligible").notNull(),
    /** The person's own call on the deal. */
    verdict: text("verdict").$type<"pursue" | "watch" | "pass">(),
    /** Counted in community medians on the listing. Never shows who, only the numbers. */
    isPublic: boolean("is_public").default(true).notNull(),
    engineVersion: text("engine_version").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("deal_analyses_actor_deal_idx").on(table.actorKey, table.dealKey),
    index("deal_analyses_deal_idx").on(table.dealKey),
    index("deal_analyses_user_idx").on(table.userId, table.updatedAt),
    index("deal_analyses_board_idx").on(table.eligible, table.createdAt),
    index("deal_analyses_market_idx").on(table.province, table.city),
    // A unique INDEX, not a column constraint: adding a constraint to a table with rows makes
    // drizzle-kit push ask whether to truncate it, which is no question for a live database.
    uniqueIndex("deal_analyses_share_token_idx").on(table.shareToken),
  ],
);

/**
 * What the community's analyses have taught, per market and field. Rebuilt by
 * /api/cron/learn from eligible, worked analyses; read when an underwriter
 * opens. A value only exists here when enough different people stand behind it.
 */
export const learnedAssumptions = pgTable(
  "learned_assumptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: text("scope").$type<"city" | "province" | "national">().notNull(),
    /** "ON|hamilton" · "ON" · "CA" */
    scopeKey: text("scope_key").notNull(),
    field: text("field").notNull(),
    median: real("median").notNull(),
    p25: real("p25").notNull(),
    p75: real("p75").notNull(),
    sampleSize: integer("sample_size").notNull(),
    /** Distinct people behind the number — the privacy floor and the anti-gaming check. */
    contributors: integer("contributors").notNull(),
    computedAt: timestamp("computed_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("learned_assumptions_scope_field_idx").on(table.scope, table.scopeKey, table.field)],
);

export type DealAnalysis = typeof dealAnalyses.$inferSelect;
export type LearnedAssumption = typeof learnedAssumptions.$inferSelect;
