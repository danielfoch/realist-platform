/**
 * Toronto ward-boundary importer for the enrichment spine.
 *
 * Loads the City of Toronto 25-ward model (open.toronto.ca, CKAN) into the
 * municipal_wards table so getPropertyAssessment/enrichment (and, later, the
 * multiplex underwriter's sixplex-by-ward logic under By-law 654-2025) can
 * resolve a point to a VERIFIED ward instead of the FSA-inferred heuristic.
 *
 *   npx tsx scripts/import-toronto-wards.ts
 *
 * The resource is already GeoJSON in EPSG:4326 (25 MultiPolygon features, ~1MB)
 * so it loads whole — no streaming needed. Re-runnable: upserts by (city, ward_code).
 * Fields verified against the live resource (2026-07): AREA_SHORT_CODE = ward
 * number ("07"), AREA_NAME = ward name.
 */

import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { ensureEnrichmentTables, recordDataLayer } from "../server/enrichment";
import { bboxOfGeometry, type AreaGeometry } from "../shared/geoGeometry";

const WARDS_GEOJSON_URL =
  process.env.TORONTO_WARDS_URL ||
  "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/5e7a8234-f805-43ac-820f-03d7c360b588/resource/737b29e0-8329-4260-b6af-21555ab24f28/download/city-wards-data-4326.geojson";

const CITY = "Toronto";
const ATTRIBUTION = "Contains information licensed under the Open Government Licence – Toronto.";

type Feature = {
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown> | null;
};

function prop(props: Record<string, unknown> | null, keys: string[]): string | null {
  for (const k of keys) {
    const v = props?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

async function main(): Promise<void> {
  await ensureEnrichmentTables();
  console.log(`Downloading Toronto wards — ${WARDS_GEOJSON_URL}`);
  const resp = await fetch(WARDS_GEOJSON_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (realist.ca open-data importer; hello@realist.ca)" },
    signal: AbortSignal.timeout(60000),
  });
  if (!resp.ok) throw new Error(`Toronto wards: HTTP ${resp.status}`);
  const fc = (await resp.json()) as { type: string; features: Feature[] };
  if (fc.type !== "FeatureCollection") throw new Error("Expected a GeoJSON FeatureCollection");

  let imported = 0;
  let skipped = 0;
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) {
      skipped++;
      continue;
    }
    const wardCode = prop(f.properties, ["AREA_SHORT_CODE", "AREA_LONG_CODE"]);
    if (!wardCode) {
      skipped++;
      continue;
    }
    const wardName = prop(f.properties, ["AREA_NAME", "AREA_DESC"]);
    const geom = g as AreaGeometry;
    const bbox = bboxOfGeometry(geom);
    await db.execute(sql`
      INSERT INTO municipal_wards (city, ward_code, ward_name, geojson, min_lng, min_lat, max_lng, max_lat)
      VALUES (${CITY}, ${wardCode}, ${wardName}, ${JSON.stringify(geom)}::jsonb,
              ${bbox.minLng}, ${bbox.minLat}, ${bbox.maxLng}, ${bbox.maxLat})
      ON CONFLICT (city, ward_code) DO UPDATE SET
        ward_name = EXCLUDED.ward_name,
        geojson = EXCLUDED.geojson,
        min_lng = EXCLUDED.min_lng, min_lat = EXCLUDED.min_lat,
        max_lng = EXCLUDED.max_lng, max_lat = EXCLUDED.max_lat,
        imported_at = now()
    `);
    imported++;
  }

  await recordDataLayer({
    key: "toronto_wards",
    name: "Toronto ward boundaries (25-ward model)",
    sourceUrl: "https://open.toronto.ca/dataset/city-wards/",
    licence: "Open Government Licence – Toronto",
    attribution: ATTRIBUTION,
    geography: "Toronto (25 wards)",
    refreshCadence: "on ward-model change (semi-annual dataset refresh)",
    rowCount: imported,
  });
  console.log(`Toronto wards done: ${imported} imported, ${skipped} skipped`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[toronto-wards] import failed:", err);
  process.exit(1);
});
