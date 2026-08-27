import { sql } from "drizzle-orm";
import {
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

/**
 * DDF listing snapshots — one row per (listing_key, snapshot_month), fed by
 * the DDF yield crawler. The latest snapshot for a listing is the current
 * truth for every listing surface (map search, listing pages, SEO).
 *
 * standard_status, street_address, public_remarks and photo_url are real
 * columns (they used to ride along in raw_json): the SEO layer and listing
 * pages read them on every request and status filtering needs an index.
 * raw_json keeps the remaining feed extras (photosCount, listOfficeBoard,
 * modificationTimestamp).
 */
export const ddfListingSnapshots = pgTable("ddf_listing_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listingKey: varchar("listing_key").notNull(),
  mlsNumber: varchar("mls_number"),
  city: text("city"),
  province: text("province"),
  postalCode: varchar("postal_code"),
  listPrice: real("list_price"),
  bedroomsTotal: integer("bedrooms_total"),
  bathroomsTotal: integer("bathrooms_total"),
  numberOfUnits: integer("number_of_units"),
  livingArea: real("living_area"),
  yearBuilt: integer("year_built"),
  propertySubType: text("property_sub_type"),
  structureType: text("structure_type"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  totalActualRent: real("total_actual_rent"),
  taxAnnualAmount: real("tax_annual_amount"),
  associationFee: real("association_fee"),
  estimatedMonthlyRent: real("estimated_monthly_rent"),
  grossYield: real("gross_yield"),
  estimatedExpenses: real("estimated_expenses"),
  estimatedNoi: real("estimated_noi"),
  netYield: real("net_yield"),
  daysOnMarket: integer("days_on_market"),
  rentSource: text("rent_source"),
  standardStatus: text("standard_status"),
  streetAddress: text("street_address"),
  publicRemarks: text("public_remarks"),
  photoUrl: text("photo_url"),
  rawJson: jsonb("raw_json"),
  snapshotMonth: varchar("snapshot_month", { length: 7 }).notNull(),
  capturedAt: timestamp("captured_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("ddf_snapshots_listing_month_idx").on(table.listingKey, table.snapshotMonth),
  index("ddf_snapshots_city_month_idx").on(table.city, table.snapshotMonth),
  index("ddf_snapshots_standard_status_idx").on(table.standardStatus),
  // Serves anonymous LOWER(city) equality lookups — the plain
  // (city, snapshot_month) btree above cannot serve the lowered predicate,
  // and an unindexed anonymous endpoint is a seq-scan-per-request DoS lever
  // on the largest table in the database.
  index("idx_ddf_snapshots_city_lower").on(sql`lower(${table.city})`),
]);

export type DdfListingSnapshot = typeof ddfListingSnapshots.$inferSelect;
export type InsertDdfListingSnapshot = Omit<typeof ddfListingSnapshots.$inferInsert, "id" | "capturedAt">;

export const cityYieldHistory = pgTable("city_yield_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  city: text("city").notNull(),
  province: text("province").notNull(),
  month: varchar("month", { length: 7 }).notNull(),
  listingCount: integer("listing_count").default(0).notNull(),
  avgGrossYield: real("avg_gross_yield"),
  medianGrossYield: real("median_gross_yield"),
  avgNetYield: real("avg_net_yield"),
  avgListPrice: real("avg_list_price"),
  medianListPrice: real("median_list_price"),
  avgRentPerUnit: real("avg_rent_per_unit"),
  avgDaysOnMarket: real("avg_days_on_market"),
  avgPricePerSqft: real("avg_price_per_sqft"),
  inventoryCount: integer("inventory_count").default(0),
  avgBedsPerListing: real("avg_beds_per_listing"),
  yieldTrend: real("yield_trend"),
  computedAt: timestamp("computed_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("city_yield_history_city_month_idx").on(table.city, table.province, table.month),
]);

export type CityYieldHistory = typeof cityYieldHistory.$inferSelect;
export type InsertCityYieldHistory = Omit<typeof cityYieldHistory.$inferInsert, "id" | "computedAt">;

export const areaYieldHistory = pgTable("area_yield_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  areaType: text("area_type").notNull(),
  areaKey: text("area_key").notNull(),
  areaName: text("area_name").notNull(),
  city: text("city"),
  province: text("province").notNull(),
  month: varchar("month", { length: 7 }).notNull(),
  listingCount: integer("listing_count").default(0).notNull(),
  avgGrossYield: real("avg_gross_yield"),
  medianGrossYield: real("median_gross_yield"),
  avgNetYield: real("avg_net_yield"),
  avgListPrice: real("avg_list_price"),
  medianListPrice: real("median_list_price"),
  avgRentPerUnit: real("avg_rent_per_unit"),
  avgDaysOnMarket: real("avg_days_on_market"),
  avgPricePerSqft: real("avg_price_per_sqft"),
  inventoryCount: integer("inventory_count").default(0),
  avgBedsPerListing: real("avg_beds_per_listing"),
  yieldTrend: real("yield_trend"),
  computedAt: timestamp("computed_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("area_yield_history_area_month_idx").on(table.areaType, table.areaKey, table.province, table.month),
  index("area_yield_history_lookup_idx").on(table.areaType, table.province, table.month),
]);

export type AreaYieldHistory = typeof areaYieldHistory.$inferSelect;
export type InsertAreaYieldHistory = Omit<typeof areaYieldHistory.$inferInsert, "id" | "computedAt">;

// ============================================
// Rent Pulse — aggregated median rents per city
// ============================================
export const rentPulse = pgTable("rent_pulse", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  city: text("city").notNull(),
  province: text("province").notNull(),
  bedrooms: text("bedrooms").notNull(),
  medianRent: integer("median_rent").notNull(),
  averageRent: integer("average_rent"),
  sampleSize: integer("sample_size").notNull(),
  minRent: integer("min_rent"),
  maxRent: integer("max_rent"),
  scrapedAt: timestamp("scraped_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type RentPulse = typeof rentPulse.$inferSelect;
export type InsertRentPulse = Omit<typeof rentPulse.$inferInsert, "id" | "createdAt">;

// ============================================
// Rent Listings — individual scraped listings
// ============================================
export const rentListings = pgTable("rent_listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  externalId: text("external_id"),
  city: text("city").notNull(),
  province: text("province").notNull(),
  address: text("address"),
  bedrooms: text("bedrooms").notNull(),
  bathrooms: text("bathrooms"),
  rent: integer("rent").notNull(),
  squareFootage: integer("square_footage"),
  lat: real("lat"),
  lng: real("lng"),
  sourceUrl: text("source_url"),
  sourcePlatform: text("source_platform"),
  listingDate: timestamp("listing_date"),
  scrapedAt: timestamp("scraped_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type RentListing = typeof rentListings.$inferSelect;
export type InsertRentListing = Omit<typeof rentListings.$inferInsert, "id" | "createdAt">;
