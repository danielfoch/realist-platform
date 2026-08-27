import { sql } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import type { MatchedTerm } from "@/lib/distress/scoring";

/**
 * Generic key/value cache with explicit freshness. The distress scan writes its
 * full qualified result set here (`distress-v6:qualified`); readers treat rows
 * under 24h old as fresh and anything older as stale-but-servable while a
 * background rescan runs.
 */
export const dataCache = pgTable("data_cache", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type DataCacheRow = typeof dataCache.$inferSelect;

/**
 * Long-term per-listing distress history, upserted on every scan. Unlike the
 * cache (which only ever holds the latest snapshot), this table accumulates:
 * when a listing first showed distress language, how its price moved while
 * flagged, and when it disappeared — the raw material for a motivated-sellers
 * database that outlives any single listing's time on market.
 */
export const distressListings = pgTable(
  "distress_listings",
  {
    listingKey: text("listing_key").primaryKey(),
    mlsNumber: text("mls_number"),
    address: text("address"),
    city: text("city"),
    province: text("province"),
    postalCode: text("postal_code"),
    listPrice: doublePrecision("list_price"),
    propertySubType: text("property_sub_type"),
    /** Primary category: foreclosure_pos | motivated | vtb (strongest signal wins). */
    category: text("category").notNull(),
    rawScore: integer("raw_score").notNull(),
    normalizedScore: integer("normalized_score").notNull(),
    confidence: text("confidence").notNull(),
    matchedTerms: jsonb("matched_terms").$type<MatchedTerm[]>(),
    publicRemarksExcerpt: text("public_remarks_excerpt"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    lastListPrice: doublePrecision("last_list_price"),
    /** Appended whenever the list price changes between scans. */
    priceHistory: jsonb("price_history").$type<Array<{ date: string; price: number }>>(),
    /** active | gone — flipped to gone once unseen for 48h. */
    status: text("status").default("active").notNull(),
    timesSeen: integer("times_seen").default(1).notNull(),
  },
  (table) => [
    index("distress_listings_status_idx").on(table.status),
    index("distress_listings_last_seen_idx").on(table.lastSeenAt),
  ],
);

export type DistressListing = typeof distressListings.$inferSelect;
export type InsertDistressListing = typeof distressListings.$inferInsert;

export const distressSnapshots = pgTable("distress_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  month: varchar("month", { length: 7 }).notNull(),
  province: text("province").notNull(),
  city: text("city"),
  totalListings: integer("total_listings").default(0).notNull(),
  foreclosurePosCount: integer("foreclosure_pos_count").default(0).notNull(),
  motivatedCount: integer("motivated_count").default(0).notNull(),
  vtbCount: integer("vtb_count").default(0).notNull(),
  avgDistressScore: real("avg_distress_score"),
  maxDistressScore: real("max_distress_score"),
  avgListPrice: real("avg_list_price"),
  medianListPrice: real("median_list_price"),
  highConfidenceCount: integer("high_confidence_count").default(0).notNull(),
  mediumConfidenceCount: integer("medium_confidence_count").default(0).notNull(),
  lowConfidenceCount: integer("low_confidence_count").default(0).notNull(),
  avgDaysOnMarket: real("avg_days_on_market"),
  propertyTypesJson: jsonb("property_types_json"),
  topCitiesJson: jsonb("top_cities_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("distress_snapshots_month_prov_city_idx").on(table.month, table.province, table.city),
]);

export type DistressSnapshot = typeof distressSnapshots.$inferSelect;
export type InsertDistressSnapshot = typeof distressSnapshots.$inferInsert;

/**
 * Published monthly distress reports, one row per month, rendered to HTML at
 * generation time and served at /deals/report/[month]. Slug is the idempotency
 * key — a month is only ever published once.
 */
export const distressReports = pgTable("distress_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  month: varchar("month", { length: 7 }).notNull(),
  title: text("title").notNull(),
  html: text("html").notNull(),
  summaryStats: jsonb("summary_stats"),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
});

export type DistressReport = typeof distressReports.$inferSelect;
export type InsertDistressReport = typeof distressReports.$inferInsert;
