/**
 * Import Toronto parcel fabric + centreline for derived lot metrics.
 *
 *   # Live from the CKAN datastore (no download needed — both are datastore-active):
 *   npx tsx scripts/import-toronto-parcels.ts parcels
 *   npx tsx scripts/import-toronto-parcels.ts centreline
 *   # Or from a local file the operator downloaded (.geojson FeatureCollection or .ndjson):
 *   npx tsx scripts/import-toronto-parcels.ts parcels    <property-boundaries.geojson>
 *   npx tsx scripts/import-toronto-parcels.ts centreline <toronto-centreline.geojson>
 *
 * Sources (City of Toronto Open Data, WGS84):
 *   parcels    — pkg property-boundaries (compiled polygons; PARCELID, STATEDAREA)
 *   centreline — pkg toronto-centreline-tcl (FEATURE_CODE_DESC classifies laneways
 *                vs roads for lane-access / corner-lot derivation)
 *
 * Parcels is ~500k polygons; the datastore path streams pages in constant memory.
 * Re-runnable: each mode truncates its table. Licence: OGL – Toronto.
 */

import fs from "node:fs";
import readline from "node:readline";
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { ensureParcelTables } from "../server/parcels";
import { recordDataLayer, ensureEnrichmentTables } from "../server/enrichment";
import { bboxOfGeometry, type AreaGeometry } from "../shared/geoGeometry";
import { eachDatastoreBatch, parseCkanGeometry, resolveResourceId, type CkanRecord } from "./ckanDatastore";

const ATTRIBUTION = "Contains information licensed under the Open Government Licence – Toronto.";

/** Bounding box over every coordinate of a LineString/MultiLineString. */
function lineBbox(g: { type: string; coordinates: any }): { minLng: number; minLat: number; maxLng: number; maxLat: number } {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  const parts: number[][][] = g.type === "LineString" ? [g.coordinates] : g.coordinates;
  for (const part of parts) {
    for (const [lng, lat] of part) {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return { minLng, minLat, maxLng, maxLat };
}

type Feature = { type: "Feature"; geometry: any; properties: Record<string, unknown> | null };

function str(props: Record<string, unknown> | null, keys: string[]): string | null {
  for (const k of keys) {
    const v = props?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

/** Toronto Centreline FEATURE_CODE_DESC → our coarse class. */
function classifyCentreline(props: Record<string, unknown> | null): "laneway" | "road" | "other" {
  const desc = (str(props, ["FEATURE_CODE_DESC", "feature_code_desc", "FCODE_DESC"]) || "").toLowerCase();
  if (!desc) return "other";
  if (desc.includes("lane")) return "laneway";
  // Exclude non-road linears that happen to carry "major"/"minor" (Major Shoreline,
  // Major Railway, Hydro Line, River, Trail, Walkway).
  if (/rail|shoreline|hydro|river|trail|walk|ferry|geostat/.test(desc)) return "other";
  if (/arterial|collector|expressway|\blocal\b|\broad\b|\bstreet\b|\bramp\b|access/.test(desc)) return "road";
  return "other";
}

/** Stream features from a .geojson FeatureCollection or .ndjson file. */
async function eachFeature(path: string, onFeature: (f: Feature) => Promise<void>): Promise<void> {
  if (path.endsWith(".ndjson") || path.endsWith(".jsonl")) {
    const rl = readline.createInterface({ input: fs.createReadStream(path), crlfDelay: Infinity });
    for await (const line of rl) {
      const trimmed = line.trim().replace(/,$/, "");
      if (!trimmed || trimmed === "{" || trimmed.startsWith('{"type": "FeatureCollection"')) continue;
      try {
        const f = JSON.parse(trimmed) as Feature;
        if (f?.type === "Feature") await onFeature(f);
      } catch { /* skip malformed line */ }
    }
    return;
  }
  const raw = JSON.parse(fs.readFileSync(path, "utf8"));
  if (raw.type !== "FeatureCollection") throw new Error("Expected a GeoJSON FeatureCollection or .ndjson");
  for (const f of raw.features as Feature[]) await onFeature(f);
}

async function insertParcel(props: Record<string, unknown> | null, g: any): Promise<boolean> {
  if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) return false;
  const geoId = str(props, ["PARCELID", "GEO_ID", "geo_id", "OBJECTID", "PARCEL_ID"]);
  const address = str(props, ["ADDRESS", "ADDRESS_FULL", "MAILING_ADDRESS"]);
  const bbox = bboxOfGeometry(g as AreaGeometry);
  await db.execute(sql`
    INSERT INTO toronto_parcels (geo_id, address, geojson, min_lng, min_lat, max_lng, max_lat)
    VALUES (${geoId}, ${address}, ${JSON.stringify(g)}::jsonb, ${bbox.minLng}, ${bbox.minLat}, ${bbox.maxLng}, ${bbox.maxLat})
  `);
  return true;
}

async function importParcels(path: string | null): Promise<void> {
  await db.execute(sql`TRUNCATE toronto_parcels`);
  let imported = 0, skipped = 0;
  if (path) {
    await eachFeature(path, async (f) => {
      if (await insertParcel(f.properties, f.geometry)) imported++; else skipped++;
      if (imported % 25000 === 0 && imported) console.log(`[parcels] ${imported}...`);
    });
  } else {
    const resourceId = await resolveResourceId("property-boundaries");
    if (!resourceId) throw new Error("property-boundaries has no datastore resource; pass a downloaded .geojson path instead.");
    await eachDatastoreBatch(resourceId, async (records: CkanRecord[]) => {
      for (const rec of records) {
        const geom = parseCkanGeometry(rec.geometry);
        if (await insertParcel(rec, geom)) imported++; else skipped++;
      }
      if (imported % 25000 < records.length) console.log(`[parcels] ${imported}...`);
    });
  }
  console.log(`[parcels] done: ${imported} imported, ${skipped} skipped`);
  await recordDataLayer({
    key: "toronto_parcels", name: "Toronto Property Boundaries (parcel fabric)",
    sourceUrl: "https://open.toronto.ca/dataset/property-boundaries/", licence: "Open Government Licence – Toronto",
    attribution: ATTRIBUTION, geography: "City of Toronto (compiled parcels)", refreshCadence: "daily",
    rowCount: imported, notes: "Derived lot area/frontage/depth for multiplex screening — compiled, not survey.",
  });
}

async function insertCentreline(props: Record<string, unknown> | null, g: any): Promise<boolean> {
  if (!g || (g.type !== "LineString" && g.type !== "MultiLineString")) return false;
  const klass = classifyCentreline(props);
  if (klass === "other") return false; // only keep laneways + roads
  const name = str(props, ["LINEAR_NAME_FULL", "LINEAR_NAME", "NAME"]);
  const bbox = lineBbox(g);
  await db.execute(sql`
    INSERT INTO toronto_centreline (klass, name, geojson, min_lng, min_lat, max_lng, max_lat)
    VALUES (${klass}, ${name}, ${JSON.stringify(g)}::jsonb, ${bbox.minLng}, ${bbox.minLat}, ${bbox.maxLng}, ${bbox.maxLat})
  `);
  return true;
}

async function importCentreline(path: string | null): Promise<void> {
  await db.execute(sql`TRUNCATE toronto_centreline`);
  let imported = 0, skipped = 0;
  if (path) {
    await eachFeature(path, async (f) => {
      if (await insertCentreline(f.properties, f.geometry)) imported++; else skipped++;
      if (imported % 25000 === 0 && imported) console.log(`[centreline] ${imported}...`);
    });
  } else {
    const resourceId = await resolveResourceId("toronto-centreline-tcl");
    if (!resourceId) throw new Error("toronto-centreline-tcl has no datastore resource; pass a downloaded .geojson path instead.");
    await eachDatastoreBatch(resourceId, async (records: CkanRecord[]) => {
      for (const rec of records) {
        const geom = parseCkanGeometry(rec.geometry);
        if (await insertCentreline(rec, geom)) imported++; else skipped++;
      }
    });
  }
  console.log(`[centreline] done: ${imported} imported, ${skipped} skipped`);
  await recordDataLayer({
    key: "toronto_centreline", name: "Toronto Centreline (laneways + roads)",
    sourceUrl: "https://open.toronto.ca/dataset/toronto-centreline-tcl/", licence: "Open Government Licence – Toronto",
    attribution: ATTRIBUTION, geography: "City of Toronto (street/laneway centrelines)", refreshCadence: "as-available",
    rowCount: imported, notes: "Lane-access + corner-lot derivation for parcels.",
  });
}

async function main(): Promise<void> {
  const [mode, path] = process.argv.slice(2);
  if (!mode || !["parcels", "centreline"].includes(mode)) {
    console.error("Usage: npx tsx scripts/import-toronto-parcels.ts <parcels|centreline> [file.geojson|.ndjson]");
    console.error("  (omit the file to pull live from the CKAN datastore)");
    process.exit(1);
  }
  if (path && !fs.existsSync(path)) { console.error(`File not found: ${path}`); process.exit(1); }
  await ensureEnrichmentTables();
  await ensureParcelTables();
  if (mode === "parcels") await importParcels(path ?? null);
  else await importCentreline(path ?? null);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
