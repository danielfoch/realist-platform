/**
 * Re-source Toronto heritage properties into the existing
 * toronto_heritage_properties table (see server/torontoGeo.ts).
 *
 * WHY: the CKAN "heritage-register" open dataset was RETIRED (Oct 2025), so the
 * copy imported by scripts/import-toronto-geodata.ts is stale. The current
 * source of truth is the City's Heritage Property Search app, backed by an
 * ArcGIS feature service on Toronto's map server.
 *
 *   # From the current ArcGIS FeatureServer/MapServer layer (operator supplies URL):
 *   npx tsx scripts/import-toronto-heritage.ts arcgis "https://map.toronto.ca/arcgis/rest/services/.../MapServer/0"
 *   # From a local snapshot (GeoJSON export from Heritage Property Search):
 *   npx tsx scripts/import-toronto-heritage.ts file heritage.geojson
 *
 * We deliberately do NOT hardcode a single endpoint: the map-server layer id can
 * change, so the operator passes the current one. Status field captures the
 * designation (Listed / Designated Part IV / Part V / HCD). Licence: OGL – Toronto.
 */

import fs from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { ensureTorontoGeoTables, normalizeAddressKey } from "../server/torontoGeo";
import { ensureEnrichmentTables, recordDataLayer } from "../server/enrichment";

const ATTRIBUTION = "Contains information licensed under the Open Government Licence – Toronto.";

function str(props: Record<string, unknown> | null, keys: string[]): string | null {
  for (const k of keys) {
    const v = props?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

const ADDRESS_KEYS = ["ADDRESS", "ADDRESS_FULL", "PROPERTY_ADDRESS", "STREET_ADDRESS", "address"];
const STATUS_KEYS = ["STATUS", "HERITAGE_STATUS", "DESIGNATION", "HERITAGE_PROPERTY_STATUS", "LISTING_STATUS", "status"];

async function insertRow(props: Record<string, unknown> | null, coords: [number, number] | null): Promise<boolean> {
  const full = str(props, ADDRESS_KEYS);
  if (!full) return false;
  await db.execute(sql`
    INSERT INTO toronto_heritage_properties (address_key, full_address, status, lat, lng)
    VALUES (${normalizeAddressKey(full)}, ${full}, ${str(props, STATUS_KEYS)}, ${coords?.[1] ?? null}, ${coords?.[0] ?? null})
  `);
  return true;
}

type HeritageFeature = { geometry?: any; properties?: Record<string, unknown> };

/** Insert all features (already fetched) in one transaction after TRUNCATE. */
async function loadFeatures(features: HeritageFeature[]): Promise<number> {
  // Buffer-then-swap: TRUNCATE + inserts run in a single transaction so a
  // failure rolls back and preserves the previously-good table, and TRUNCATE
  // only happens once we already hold all the data.
  let imported = 0;
  await db.execute(sql`BEGIN`);
  try {
    await db.execute(sql`TRUNCATE toronto_heritage_properties`);
    for (const f of features) {
      const coords = f.geometry?.type === "Point" && Array.isArray(f.geometry.coordinates)
        ? (f.geometry.coordinates as [number, number]) : null;
      if (await insertRow(f.properties ?? (f as any), coords)) imported++;
    }
    await db.execute(sql`COMMIT`);
  } catch (err) {
    await db.execute(sql`ROLLBACK`);
    throw err;
  }
  return imported;
}

/** Page an ArcGIS FeatureServer/MapServer layer into memory, THEN load. */
async function importArcgis(baseUrl: string): Promise<number> {
  const all: HeritageFeature[] = [];
  let offset = 0;
  const pageSize = 1000;
  for (;;) {
    const params = new URLSearchParams({
      where: "1=1", outFields: "*", f: "geojson",
      resultOffset: String(offset), resultRecordCount: String(pageSize), outSR: "4326",
    });
    const resp = await fetch(`${baseUrl}/query?${params}`, { signal: AbortSignal.timeout(60000) });
    if (!resp.ok) throw new Error(`ArcGIS query HTTP ${resp.status} @ offset ${offset}`);
    const data = (await resp.json()) as { error?: unknown; features?: HeritageFeature[] };
    if ((data as any).error) throw new Error(`ArcGIS error @ offset ${offset}: ${JSON.stringify((data as any).error)}`);
    const features = data.features ?? [];
    if (!features.length) break;
    all.push(...features);
    offset += features.length;
    if (features.length < pageSize) break;
    console.log(`[heritage] fetched ${all.length}...`);
  }
  if (!all.length) throw new Error("ArcGIS returned zero heritage features — refusing to wipe the table.");
  return loadFeatures(all);
}

async function importFile(path: string): Promise<number> {
  const raw = JSON.parse(fs.readFileSync(path, "utf8"));
  const features: HeritageFeature[] | null =
    raw?.type === "FeatureCollection" ? raw.features : Array.isArray(raw) ? raw : null;
  if (!Array.isArray(features)) {
    throw new Error(`Unsupported heritage export shape in ${path}: expected a GeoJSON FeatureCollection or a JSON array of features (got ${raw?.type ?? typeof raw}). Convert CSV/Esri-JSON to GeoJSON first.`);
  }
  return loadFeatures(features);
}

async function main(): Promise<void> {
  const [mode, arg] = process.argv.slice(2);
  if (!mode || !arg || !["arcgis", "file"].includes(mode)) {
    console.error('Usage: npx tsx scripts/import-toronto-heritage.ts <arcgis <url> | file <path>>');
    process.exit(1);
  }
  await ensureEnrichmentTables();
  await ensureTorontoGeoTables();
  const imported = mode === "arcgis" ? await importArcgis(arg) : await importFile(arg);
  console.log(`[heritage] done: ${imported} properties`);
  await recordDataLayer({
    key: "toronto_heritage_properties", name: "Toronto Heritage Register (re-sourced)",
    sourceUrl: "https://www.toronto.ca/city-government/planning-development/heritage-preservation/heritage-property-search/",
    licence: "Open Government Licence – Toronto", attribution: ATTRIBUTION,
    geography: "City of Toronto (heritage-listed/designated properties)", refreshCadence: "as-available",
    rowCount: imported, notes: "Re-sourced from Heritage Property Search — the CKAN open dataset was retired Oct 2025.",
  });
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
