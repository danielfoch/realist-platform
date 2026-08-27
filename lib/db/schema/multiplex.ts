import { sql } from "drizzle-orm";
import {
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Multiplex underwriter ───────────────────────────────────────────────────
// The geo layers the underwriter screens against (toronto_zoning_polygons,
// toronto_street_trees, toronto_heritage_properties, municipal_wards,
// geocode_cache, geo_screen_cache) are raw-SQL managed by
// ensureTorontoGeoTables in lib/multiplex/geo/torontoGeo.ts and populated by
// scripts/import-toronto-*.ts — they are deliberately NOT declared here.

/**
 * Admin-editable assumption defaults feeding the pure engines in
 * lib/multiplex/*.ts. Every row keeps source + last-verified so each figure
 * carries provenance the UI can badge.
 */
export const multiplexAssumptions = pgTable("multiplex_assumptions", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  label: text("label").notNull(),
  unit: text("unit"),
  source: text("source").notNull(),
  lastVerified: text("last_verified"),
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Every completed underwrite, persisted with a share token. This is the
 * platform's most valuable dataset — what investors are actually testing on
 * real addresses — so the row keeps the full inputs/site/result JSON for
 * later rollups. user_id stays a plain varchar (no accounts table in this
 * schema yet); the row's analytical value does not depend on who ran it.
 */
export const multiplexUnderwritings = pgTable("multiplex_underwritings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  sessionId: varchar("session_id"),
  address: text("address").notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  postalFsa: varchar("postal_fsa", { length: 3 }),
  inputsJson: jsonb("inputs_json").notNull(),
  siteJson: jsonb("site_json").notNull(),
  resultJson: jsonb("result_json"),
  shareToken: varchar("share_token").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("multiplex_underwritings_user_idx").on(table.userId, table.createdAt),
  // Serves FSA rollups, which group by (postal_fsa, month).
  index("idx_multiplex_uw_fsa_created").on(table.postalFsa, table.createdAt),
  index("idx_multiplex_uw_session").on(table.sessionId),
]);

export type MultiplexUnderwriting = typeof multiplexUnderwritings.$inferSelect;
export type MultiplexAssumption = typeof multiplexAssumptions.$inferSelect;
