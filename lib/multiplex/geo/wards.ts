/**
 * Ward resolution for the multiplex underwriter's sixplex-by-ward logic.
 *
 * By-law 654-2025 makes six units as-of-right in nine named wards (plus
 * councillor opt-ins), so resolving a point to its ACTUAL ward turns the
 * FSA-prefix heuristic into a verified determination. Boundaries live in the
 * municipal_wards table (raw-SQL managed by ensureTorontoGeoTables, populated
 * by scripts/import-toronto-wards.ts) — bbox prefilter + point-in-polygon,
 * same pattern as the other geo layers.
 */

import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pointInGeometry, type AreaGeometry } from "@/lib/geo/geometry";

export interface WardResolution {
  city: string;
  code: string;
  name: string | null;
}

/** Resolve a point to its municipal ward (bbox prefilter + point-in-polygon). */
export async function resolveWard(lat: number, lng: number, city = "Toronto"): Promise<WardResolution | null> {
  const db = getDb();
  const candidates = await db.execute(sql`
    SELECT ward_code, ward_name, geojson
    FROM municipal_wards
    WHERE city = ${city}
      AND min_lat <= ${lat} AND max_lat >= ${lat} AND min_lng <= ${lng} AND max_lng >= ${lng}
    LIMIT 25
  `);
  for (const row of candidates.rows as Array<{ ward_code: string; ward_name: string | null; geojson: AreaGeometry }>) {
    if (pointInGeometry(lng, lat, row.geojson)) return { city, code: row.ward_code, name: row.ward_name };
  }
  return null;
}
