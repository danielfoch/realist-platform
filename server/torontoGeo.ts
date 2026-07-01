/**
 * Toronto geodata resolution & screening for the Multiplex Underwriter.
 *
 * Follows the landClaimScreener pattern: GeoJSON polygons in plain tables,
 * bbox prefilter, then exact point-in-polygon in JS — no PostGIS dependency.
 *
 * Tables (self-migrating; populated by scripts/import-toronto-geodata.ts):
 *   toronto_zoning_polygons     — Zoning By-law 569-2013 GIS layer
 *   toronto_street_trees        — Urban Forestry street tree inventory
 *   toronto_heritage_properties — Heritage Register address points
 *   geocode_cache               — address -> lat/lng (Nominatim results)
 *   geo_screen_cache            — TRCA live-query results (30-day TTL)
 *
 * TRCA Regulated Area is queried LIVE against the authority's ArcGIS REST
 * service (no import): point-intersects query, cached, degrades gracefully.
 * Every screener returns evidence + certainty; failures downgrade confidence
 * instead of blocking the underwrite.
 */

import { sql } from "drizzle-orm";
import { db } from "./db";
import {
  bboxOfGeometry,
  haversineMeters,
  metersToDegreesLat,
  pointInGeometry,
  type AreaGeometry,
} from "@shared/geoGeometry";

// ─── Config ──────────────────────────────────────────────────────────────────

/** TRCA Regulated Area feature service (verified via TRCA open data DCAT, 2026-07). */
const TRCA_FEATURE_SERVER =
  process.env.TRCA_REGULATED_AREA_URL ||
  "https://services1.arcgis.com/d0ZCwU7eGKVeNiEE/arcgis/rest/services/TRCA_Regulation_Limit2/FeatureServer/0";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const GEO_CACHE_TTL_DAYS = 30;
/** City tree within this range of the point = direct conflict risk. */
const TREE_TIGHT_RADIUS_M = 8;
/** Contextual canopy scan radius. */
const TREE_CONTEXT_RADIUS_M = 20;

// ─── Tables ──────────────────────────────────────────────────────────────────

export async function ensureTorontoGeoTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS toronto_zoning_polygons (
      id          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      zone_code   text NOT NULL,
      zone_category text,
      geojson     jsonb NOT NULL,
      min_lng     double precision NOT NULL,
      min_lat     double precision NOT NULL,
      max_lng     double precision NOT NULL,
      max_lat     double precision NOT NULL,
      imported_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS toronto_zoning_bbox_idx
    ON toronto_zoning_polygons (min_lat, max_lat, min_lng, max_lng)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS toronto_street_trees (
      id          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      common_name text,
      botanical_name text,
      dbh_cm      real,
      lat         double precision NOT NULL,
      lng         double precision NOT NULL,
      imported_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS toronto_street_trees_latlng_idx
    ON toronto_street_trees (lat, lng)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS toronto_heritage_properties (
      id           varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      address_key  text NOT NULL,
      full_address text,
      status       text,
      lat          double precision,
      lng          double precision,
      imported_at  timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS toronto_heritage_address_idx
    ON toronto_heritage_properties (address_key)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS geocode_cache (
      address_key text PRIMARY KEY,
      lat         double precision,
      lng         double precision,
      display_name text,
      provider    text NOT NULL,
      resolved_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS geo_screen_cache (
      cache_key   text PRIMARY KEY,
      result      jsonb NOT NULL,
      cached_at   timestamp NOT NULL DEFAULT now()
    )
  `);
}

// ─── Address normalization & geocoding ───────────────────────────────────────

/** "123  Logan Ave., Toronto" -> "123 logan ave toronto" (heritage/geocode key). */
export function normalizeAddressKey(address: string): string {
  return address
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\b(unit|suite|apt)\s*\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string | null;
  provider: string;
  fromCache: boolean;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const key = normalizeAddressKey(`${address} toronto ontario`);

  const cached = await db.execute(sql`
    SELECT lat, lng, display_name, provider FROM geocode_cache WHERE address_key = ${key}
  `);
  if (cached.rows.length) {
    const r = cached.rows[0] as { lat: number | null; lng: number | null; display_name: string | null; provider: string };
    if (r.lat == null || r.lng == null) return null; // cached miss
    return { lat: r.lat, lng: r.lng, displayName: r.display_name, provider: r.provider, fromCache: true };
  }

  try {
    const params = new URLSearchParams({
      q: `${address}, Toronto, Ontario, Canada`,
      format: "json",
      limit: "1",
      countrycodes: "ca",
    });
    const resp = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { "User-Agent": "realist.ca multiplex underwriter (contact: hello@realist.ca)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const results = (await resp.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    const hit = results[0];

    await db.execute(sql`
      INSERT INTO geocode_cache (address_key, lat, lng, display_name, provider)
      VALUES (${key}, ${hit ? Number(hit.lat) : null}, ${hit ? Number(hit.lon) : null}, ${hit?.display_name ?? null}, 'nominatim')
      ON CONFLICT (address_key) DO NOTHING
    `);

    if (!hit) return null;
    return { lat: Number(hit.lat), lng: Number(hit.lon), displayName: hit.display_name, provider: "nominatim", fromCache: false };
  } catch (err: any) {
    console.error("[toronto-geo] geocode failed:", err.message);
    return null;
  }
}

// ─── Zoning resolution ───────────────────────────────────────────────────────

export interface ZoningResolution {
  zoneCode: string;
  zoneCategory: string | null;
  certainty: "verified";
}

export async function resolveZoning(lat: number, lng: number): Promise<ZoningResolution | null> {
  const candidates = await db.execute(sql`
    SELECT zone_code, zone_category, geojson
    FROM toronto_zoning_polygons
    WHERE min_lat <= ${lat} AND max_lat >= ${lat} AND min_lng <= ${lng} AND max_lng >= ${lng}
    LIMIT 25
  `);
  for (const row of candidates.rows as Array<{ zone_code: string; zone_category: string | null; geojson: AreaGeometry }>) {
    if (pointInGeometry(lng, lat, row.geojson)) {
      return { zoneCode: row.zone_code, zoneCategory: row.zone_category, certainty: "verified" };
    }
  }
  return null;
}

export async function zoningDataLoaded(): Promise<boolean> {
  const r = await db.execute(sql`SELECT 1 FROM toronto_zoning_polygons LIMIT 1`);
  return r.rows.length > 0;
}

// ─── Street tree screening ───────────────────────────────────────────────────

export interface TreeScreenResult {
  status: "screened" | "no_data";
  cityTreeConflict: boolean;
  treesWithinTightRadius: number;
  treesWithinContextRadius: number;
  nearest: { distanceM: number; commonName: string | null; dbhCm: number | null } | null;
  privateTreeCaution: string;
}

const PRIVATE_TREE_CAUTION =
  "Toronto's private tree by-law protects trees ≥30cm diameter anywhere on the lot — an arborist report is required with most multiplex applications. On-lot trees are not in the City inventory; verify on site.";

export async function screenStreetTrees(lat: number, lng: number): Promise<TreeScreenResult> {
  const hasData = await db.execute(sql`SELECT 1 FROM toronto_street_trees LIMIT 1`);
  if (!hasData.rows.length) {
    return {
      status: "no_data",
      cityTreeConflict: false,
      treesWithinTightRadius: 0,
      treesWithinContextRadius: 0,
      nearest: null,
      privateTreeCaution: PRIVATE_TREE_CAUTION,
    };
  }

  const pad = metersToDegreesLat(TREE_CONTEXT_RADIUS_M) * 1.5;
  const rows = await db.execute(sql`
    SELECT common_name, dbh_cm, lat, lng FROM toronto_street_trees
    WHERE lat BETWEEN ${lat - pad} AND ${lat + pad}
      AND lng BETWEEN ${lng - pad} AND ${lng + pad}
    LIMIT 100
  `);

  let tight = 0;
  let context = 0;
  let nearest: TreeScreenResult["nearest"] = null;
  for (const t of rows.rows as Array<{ common_name: string | null; dbh_cm: number | null; lat: number; lng: number }>) {
    const d = haversineMeters(lat, lng, t.lat, t.lng);
    if (d <= TREE_TIGHT_RADIUS_M) tight++;
    if (d <= TREE_CONTEXT_RADIUS_M) context++;
    if (d <= TREE_CONTEXT_RADIUS_M && (!nearest || d < nearest.distanceM)) {
      nearest = { distanceM: Math.round(d * 10) / 10, commonName: t.common_name, dbhCm: t.dbh_cm };
    }
  }

  return {
    status: "screened",
    cityTreeConflict: tight > 0,
    treesWithinTightRadius: tight,
    treesWithinContextRadius: context,
    nearest,
    privateTreeCaution: PRIVATE_TREE_CAUTION,
  };
}

// ─── Heritage screening ──────────────────────────────────────────────────────

export interface HeritageScreenResult {
  status: "screened" | "no_data";
  listed: boolean;
  match: { fullAddress: string | null; status: string | null } | null;
}

export async function screenHeritage(address: string): Promise<HeritageScreenResult> {
  const hasData = await db.execute(sql`SELECT 1 FROM toronto_heritage_properties LIMIT 1`);
  if (!hasData.rows.length) return { status: "no_data", listed: false, match: null };

  const key = normalizeAddressKey(address);
  const rows = await db.execute(sql`
    SELECT full_address, status FROM toronto_heritage_properties
    WHERE address_key = ${key}
    LIMIT 1
  `);
  const hit = rows.rows[0] as { full_address: string | null; status: string | null } | undefined;
  return {
    status: "screened",
    listed: !!hit,
    match: hit ? { fullAddress: hit.full_address, status: hit.status } : null,
  };
}

// ─── TRCA live screening ─────────────────────────────────────────────────────

export interface TrcaScreenResult {
  status: "screened" | "unavailable";
  regulated: boolean;
  detail: string | null;
  fromCache: boolean;
}

export async function screenTrca(lat: number, lng: number): Promise<TrcaScreenResult> {
  const cacheKey = `trca:${lat.toFixed(5)}:${lng.toFixed(5)}`;
  const cached = await db.execute(sql`
    SELECT result FROM geo_screen_cache
    WHERE cache_key = ${cacheKey}
      AND cached_at > now() - interval '${sql.raw(String(GEO_CACHE_TTL_DAYS))} days'
  `);
  if (cached.rows.length) {
    const r = (cached.rows[0] as { result: Omit<TrcaScreenResult, "fromCache"> }).result;
    return { ...r, fromCache: true };
  }

  try {
    const params = new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      returnGeometry: "false",
      outFields: "*",
      f: "json",
    });
    const resp = await fetch(`${TRCA_FEATURE_SERVER}/query?${params}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) throw new Error(`TRCA query HTTP ${resp.status}`);
    const data = (await resp.json()) as { features?: Array<{ attributes?: Record<string, unknown> }>; error?: { message?: string } };
    if (data.error) throw new Error(data.error.message || "TRCA query error");

    const regulated = (data.features?.length ?? 0) > 0;
    const result: Omit<TrcaScreenResult, "fromCache"> = {
      status: "screened",
      regulated,
      detail: regulated
        ? "Point intersects the TRCA Regulated Area (conceptual limit — includes flood/erosion hazards, wetlands and buffers). A TRCA permit is required before a building permit."
        : null,
    };
    await db.execute(sql`
      INSERT INTO geo_screen_cache (cache_key, result)
      VALUES (${cacheKey}, ${JSON.stringify(result)}::jsonb)
      ON CONFLICT (cache_key) DO UPDATE SET result = EXCLUDED.result, cached_at = now()
    `);
    return { ...result, fromCache: false };
  } catch (err: any) {
    console.error("[toronto-geo] TRCA screen failed:", err.message);
    return { status: "unavailable", regulated: false, detail: "TRCA service could not be reached — regulation status not verified.", fromCache: false };
  }
}

// ─── Site resolution (orchestrates the above) ────────────────────────────────

export interface ResolvedSite {
  address: string;
  lat: number | null;
  lng: number | null;
  geocodeProvider: string | null;
  zoning: ZoningResolution | null;
  zoningDataAvailable: boolean;
  trees: TreeScreenResult;
  heritage: HeritageScreenResult;
  trca: TrcaScreenResult;
  notes: string[];
}

export async function resolveSite(address: string): Promise<ResolvedSite> {
  const notes: string[] = [];
  const geo = await geocodeAddress(address);
  if (!geo) notes.push("Address could not be geocoded — location-based screens skipped.");

  const [zoning, zoningAvailable, trees, heritage, trca] = await Promise.all([
    geo ? resolveZoning(geo.lat, geo.lng) : Promise.resolve(null),
    zoningDataLoaded(),
    geo
      ? screenStreetTrees(geo.lat, geo.lng)
      : Promise.resolve<TreeScreenResult>({ status: "no_data", cityTreeConflict: false, treesWithinTightRadius: 0, treesWithinContextRadius: 0, nearest: null, privateTreeCaution: PRIVATE_TREE_CAUTION }),
    screenHeritage(address),
    geo ? screenTrca(geo.lat, geo.lng) : Promise.resolve<TrcaScreenResult>({ status: "unavailable", regulated: false, detail: null, fromCache: false }),
  ]);

  if (geo && zoningAvailable && !zoning) notes.push("Point did not land in any imported zoning polygon — zone must be confirmed manually.");
  if (!zoningAvailable) notes.push("Zoning layer not imported yet — run scripts/import-toronto-geodata.ts.");
  if (trees.status === "no_data") notes.push("Street tree inventory not imported yet — city-tree screen skipped.");
  if (heritage.status === "no_data") notes.push("Heritage register not imported yet — heritage screen skipped.");

  return {
    address,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    geocodeProvider: geo?.provider ?? null,
    zoning,
    zoningDataAvailable: zoningAvailable,
    trees,
    heritage,
    trca,
    notes,
  };
}

// bbox helper re-export for the import script
export { bboxOfGeometry };
