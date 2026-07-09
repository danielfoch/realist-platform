/**
 * Import Toronto zoning OVERLAYS + WARDS for the multiplex engine.
 *
 *   npx tsx scripts/import-toronto-zoning-overlays.ts height
 *   npx tsx scripts/import-toronto-zoning-overlays.ts coverage
 *   npx tsx scripts/import-toronto-zoning-overlays.ts wards
 *   npx tsx scripts/import-toronto-zoning-overlays.ts all
 *
 * Sources (City of Toronto Open Data / CKAN datastore — WGS84):
 *   height   — pkg zoning-by-law, "Zoning Height Overlay"  (HT_LABEL m, HT_STORIES)
 *   coverage — pkg zoning-by-law, "Zoning Lot Coverage Overlay" (PRCNT_CVER %)
 *   wards    — pkg city-wards, GeoJSON 4326 (AREA_NAME / AREA_SHORT_CODE)
 *
 * Re-runnable: each mode truncates its table. Records self-migrate.
 * Licence: Open Government Licence – Toronto (attribution recorded in data_layers).
 */

import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { ensureTorontoZoningTables } from "../server/torontoZoning";
import { recordDataLayer, ensureEnrichmentTables } from "../server/enrichment";
import { bboxOfGeometry, type AreaGeometry } from "../shared/geoGeometry";
import { eachDatastoreBatch, parseCkanGeometry, resolveResourceId, type CkanRecord } from "./ckanDatastore";

const ATTRIBUTION = "Contains information licensed under the Open Government Licence – Toronto.";
const ZONING_PKG = "zoning-by-law";
const WARDS_PKG = "city-wards";

// Datastore resource ids (verified 2026-07-07); env overrides allow refresh if
// the portal re-issues ids.
const HEIGHT_RESOURCE = process.env.TORONTO_HEIGHT_RESOURCE_ID || "f0a88d06-2430-4025-b15d-362cabd00f31";
const COVERAGE_RESOURCE = process.env.TORONTO_COVERAGE_RESOURCE_ID || "58ad8814-ca4e-43d6-848d-d5fd8d873574";

function num(rec: CkanRecord, keys: string[]): number | null {
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

function str(rec: CkanRecord, keys: string[]): string | null {
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

/** "Davenport (09)" / "Ward 9" / "09" → 9. */
function wardNumberFrom(rec: CkanRecord): number | null {
  const direct = num(rec, ["AREA_SHORT_CODE", "AREA_LONG_CODE", "WARD", "WARD_ID", "SCODE_NAME"]);
  if (direct != null && direct > 0 && direct <= 25) return direct;
  const name = str(rec, ["AREA_NAME", "AREA_NA7", "NAME", "WARD_NAME"]) || "";
  const m = name.match(/\((\d{1,2})\)|\bward\s+(\d{1,2})\b/i);
  if (m) return parseInt(m[1] || m[2], 10);
  return null;
}

async function importHeight(): Promise<void> {
  await db.execute(sql`TRUNCATE toronto_zoning_height`);
  let imported = 0, skipped = 0;
  const total = await eachDatastoreBatch(HEIGHT_RESOURCE, async (records) => {
    for (const rec of records) {
      const geom = parseCkanGeometry(rec.geometry) as AreaGeometry | null;
      if (!geom || (geom.type !== "Polygon" && geom.type !== "MultiPolygon")) { skipped++; continue; }
      const heightM = num(rec, ["HT_LABEL", "HT_METRES", "MAX_HEIGHT"]);
      const storeys = num(rec, ["HT_STORIES", "HT_STOREYS"]);
      const label = str(rec, ["HT_STRING", "HT_LABEL"]);
      const bbox = bboxOfGeometry(geom);
      await db.execute(sql`
        INSERT INTO toronto_zoning_height (max_height_m, max_storeys, label, geojson, min_lng, min_lat, max_lng, max_lat)
        VALUES (${heightM}, ${storeys}, ${label}, ${JSON.stringify(geom)}::jsonb, ${bbox.minLng}, ${bbox.minLat}, ${bbox.maxLng}, ${bbox.maxLat})
      `);
      imported++;
    }
    if (imported % 5000 < records.length) console.log(`[height] ${imported} polygons...`);
  });
  console.log(`[height] done: ${imported} imported, ${skipped} skipped (of ${total})`);
  await recordDataLayer({
    key: "toronto_zoning_height", name: "Toronto Zoning Height Overlay",
    sourceUrl: "https://open.toronto.ca/dataset/zoning-by-law/", licence: "Open Government Licence – Toronto",
    attribution: ATTRIBUTION, geography: "City of Toronto (parcel-level overlay)", refreshCadence: "as-available",
    rowCount: imported, notes: "Max building height (m) from HT_LABEL for multiplex envelope screening.",
  });
}

async function importCoverage(): Promise<void> {
  await db.execute(sql`TRUNCATE toronto_zoning_coverage`);
  let imported = 0, skipped = 0;
  const total = await eachDatastoreBatch(COVERAGE_RESOURCE, async (records) => {
    for (const rec of records) {
      const geom = parseCkanGeometry(rec.geometry) as AreaGeometry | null;
      if (!geom || (geom.type !== "Polygon" && geom.type !== "MultiPolygon")) { skipped++; continue; }
      const pct = num(rec, ["PRCNT_CVER", "COVERAGE", "MAX_COVERAGE"]);
      const bbox = bboxOfGeometry(geom);
      await db.execute(sql`
        INSERT INTO toronto_zoning_coverage (max_coverage_pct, geojson, min_lng, min_lat, max_lng, max_lat)
        VALUES (${pct}, ${JSON.stringify(geom)}::jsonb, ${bbox.minLng}, ${bbox.minLat}, ${bbox.maxLng}, ${bbox.maxLat})
      `);
      imported++;
    }
    if (imported % 5000 < records.length) console.log(`[coverage] ${imported} polygons...`);
  });
  console.log(`[coverage] done: ${imported} imported, ${skipped} skipped (of ${total})`);
  await recordDataLayer({
    key: "toronto_zoning_coverage", name: "Toronto Zoning Lot Coverage Overlay",
    sourceUrl: "https://open.toronto.ca/dataset/zoning-by-law/", licence: "Open Government Licence – Toronto",
    attribution: ATTRIBUTION, geography: "City of Toronto (parcel-level overlay)", refreshCadence: "as-available",
    rowCount: imported, notes: "Max lot coverage (%) from PRCNT_CVER — replaces the heuristic coverage ratio.",
  });
}

async function importWards(): Promise<void> {
  // Use the datastore-active resource (named plain "City Wards Data"); the
  // "- 4326.geojson" variants are file resources and 404 on datastore_search.
  const resourceId = await resolveResourceId(WARDS_PKG, "City Wards Data")
    || await resolveResourceId(WARDS_PKG);
  if (!resourceId) throw new Error("No datastore resource found for city-wards");
  await db.execute(sql`TRUNCATE toronto_wards`);
  let imported = 0, skipped = 0;
  const total = await eachDatastoreBatch(resourceId, async (records) => {
    for (const rec of records) {
      const geom = parseCkanGeometry(rec.geometry) as AreaGeometry | null;
      const wardNumber = wardNumberFrom(rec);
      if (!geom || wardNumber == null || (geom.type !== "Polygon" && geom.type !== "MultiPolygon")) { skipped++; continue; }
      const wardName = str(rec, ["AREA_NAME", "AREA_NA7", "NAME", "WARD_NAME"]);
      const bbox = bboxOfGeometry(geom);
      await db.execute(sql`
        INSERT INTO toronto_wards (ward_number, ward_name, geojson, min_lng, min_lat, max_lng, max_lat)
        VALUES (${wardNumber}, ${wardName}, ${JSON.stringify(geom)}::jsonb, ${bbox.minLng}, ${bbox.minLat}, ${bbox.maxLng}, ${bbox.maxLat})
      `);
      imported++;
    }
  });
  console.log(`[wards] done: ${imported} imported, ${skipped} skipped (of ${total})`);
  await recordDataLayer({
    key: "toronto_wards", name: "Toronto City Wards (25-ward model)",
    sourceUrl: "https://open.toronto.ca/dataset/city-wards/", licence: "Open Government Licence – Toronto",
    attribution: ATTRIBUTION, geography: "City of Toronto (25 wards)", refreshCadence: "static",
    rowCount: imported, notes: "Exact ward → sixplex as-of-right status (By-law 654-2025).",
  });
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (!mode || !["height", "coverage", "wards", "all"].includes(mode)) {
    console.error("Usage: npx tsx scripts/import-toronto-zoning-overlays.ts <height|coverage|wards|all>");
    process.exit(1);
  }
  await ensureEnrichmentTables();
  await ensureTorontoZoningTables();
  if (mode === "height" || mode === "all") await importHeight();
  if (mode === "coverage" || mode === "all") await importCoverage();
  if (mode === "wards" || mode === "all") await importWards();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
