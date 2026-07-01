/**
 * Toronto geodata importer for the Multiplex Underwriter screeners.
 *
 * Ingests GeoJSON into the self-migrating tables in server/torontoGeo.ts:
 *   npx tsx scripts/import-toronto-geodata.ts zoning   <zoning.geojson>
 *   npx tsx scripts/import-toronto-geodata.ts trees    <street-trees.geojson>
 *   npx tsx scripts/import-toronto-geodata.ts heritage <heritage.geojson>
 *
 * Sources (City of Toronto Open Data / CKAN — SHP or GeoJSON):
 *   zoning:   https://open.toronto.ca/dataset/zoning-by-law/
 *             (layer: Zoning Area; attribute ZN_ZONE or GEN_ZONE = zone code)
 *   trees:    https://open.toronto.ca/dataset/street-tree-data/
 *             (point layer; COMMON_NAME, BOTANICAL_NAME, DBH_TRUNK)
 *   heritage: https://open.toronto.ca/dataset/heritage-register/
 *             (address points; SHP zip heritage_register_address_points_wgs84.zip)
 *
 * SHP -> GeoJSON without native deps:
 *   npx mapshaper <downloaded.zip> -o format=geojson precision=0.000001 out.geojson
 *
 * Re-runnable: each mode truncates its table first. Batched inserts.
 */

import fs from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { ensureTorontoGeoTables, normalizeAddressKey } from "../server/torontoGeo";
import { bboxOfGeometry, type AreaGeometry } from "../shared/geoGeometry";

type Feature = {
  type: "Feature";
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown> | null;
};

function loadFeatures(path: string): Feature[] {
  const raw = JSON.parse(fs.readFileSync(path, "utf8"));
  if (raw.type === "FeatureCollection") return raw.features as Feature[];
  throw new Error("Expected a GeoJSON FeatureCollection");
}

function str(props: Record<string, unknown> | null, keys: string[]): string | null {
  for (const k of keys) {
    const v = props?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

function num(props: Record<string, unknown> | null, keys: string[]): number | null {
  for (const k of keys) {
    const v = props?.[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

async function importZoning(path: string): Promise<void> {
  const features = loadFeatures(path);
  await db.execute(sql`TRUNCATE toronto_zoning_polygons`);
  let imported = 0;
  let skipped = 0;

  for (const f of features) {
    const g = f.geometry;
    if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) {
      skipped++;
      continue;
    }
    const zoneCode = str(f.properties, ["ZN_ZONE", "GEN_ZONE1", "GEN_ZONE", "ZONE_LABEL", "zone_code"]);
    if (!zoneCode) {
      skipped++;
      continue;
    }
    const zoneCategory = str(f.properties, ["GEN_ZONE", "ZN_STRING", "CATEGORY", "zone_category"]);
    const geom = g as AreaGeometry;
    const bbox = bboxOfGeometry(geom);
    await db.execute(sql`
      INSERT INTO toronto_zoning_polygons (zone_code, zone_category, geojson, min_lng, min_lat, max_lng, max_lat)
      VALUES (${zoneCode}, ${zoneCategory}, ${JSON.stringify(geom)}::jsonb, ${bbox.minLng}, ${bbox.minLat}, ${bbox.maxLng}, ${bbox.maxLat})
    `);
    imported++;
    if (imported % 1000 === 0) console.log(`[zoning] ${imported} polygons...`);
  }
  console.log(`[zoning] done: ${imported} imported, ${skipped} skipped`);
}

async function importTrees(path: string): Promise<void> {
  const features = loadFeatures(path);
  await db.execute(sql`TRUNCATE toronto_street_trees`);
  let imported = 0;
  let skipped = 0;

  for (const f of features) {
    const g = f.geometry;
    let lng: number | null = null;
    let lat: number | null = null;
    if (g?.type === "Point" && Array.isArray(g.coordinates)) {
      lng = Number((g.coordinates as number[])[0]);
      lat = Number((g.coordinates as number[])[1]);
    } else {
      lng = num(f.properties, ["LONGITUDE", "lng", "X"]);
      lat = num(f.properties, ["LATITUDE", "lat", "Y"]);
    }
    if (lng == null || lat == null || !Number.isFinite(lng) || !Number.isFinite(lat)) {
      skipped++;
      continue;
    }
    await db.execute(sql`
      INSERT INTO toronto_street_trees (common_name, botanical_name, dbh_cm, lat, lng)
      VALUES (
        ${str(f.properties, ["COMMON_NAME", "common_name"])},
        ${str(f.properties, ["BOTANICAL_NAME", "botanical_name"])},
        ${num(f.properties, ["DBH_TRUNK", "dbh_trunk", "DBH"])},
        ${lat}, ${lng}
      )
    `);
    imported++;
    if (imported % 5000 === 0) console.log(`[trees] ${imported} trees...`);
  }
  console.log(`[trees] done: ${imported} imported, ${skipped} skipped`);
}

async function importHeritage(path: string): Promise<void> {
  const features = loadFeatures(path);
  await db.execute(sql`TRUNCATE toronto_heritage_properties`);
  let imported = 0;
  let skipped = 0;

  for (const f of features) {
    const fullAddress = str(f.properties, ["ADDRESS", "FULL_ADDRESS", "ADDRESS_FULL", "PROPERTY_ADDRESS", "address"]);
    if (!fullAddress) {
      skipped++;
      continue;
    }
    let lng: number | null = null;
    let lat: number | null = null;
    if (f.geometry?.type === "Point" && Array.isArray(f.geometry.coordinates)) {
      lng = Number((f.geometry.coordinates as number[])[0]);
      lat = Number((f.geometry.coordinates as number[])[1]);
    }
    await db.execute(sql`
      INSERT INTO toronto_heritage_properties (address_key, full_address, status, lat, lng)
      VALUES (
        ${normalizeAddressKey(fullAddress)},
        ${fullAddress},
        ${str(f.properties, ["STATUS", "HERITAGE_STATUS", "DESIGNATION", "status"])},
        ${lat}, ${lng}
      )
    `);
    imported++;
    if (imported % 1000 === 0) console.log(`[heritage] ${imported} properties...`);
  }
  console.log(`[heritage] done: ${imported} imported, ${skipped} skipped`);
}

async function main(): Promise<void> {
  const [mode, path] = process.argv.slice(2);
  if (!mode || !path || !["zoning", "trees", "heritage"].includes(mode)) {
    console.error("Usage: npx tsx scripts/import-toronto-geodata.ts <zoning|trees|heritage> <file.geojson>");
    process.exit(1);
  }
  if (!fs.existsSync(path)) {
    console.error(`File not found: ${path}`);
    process.exit(1);
  }
  await ensureTorontoGeoTables();
  if (mode === "zoning") await importZoning(path);
  else if (mode === "trees") await importTrees(path);
  else await importHeritage(path);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
