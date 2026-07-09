/**
 * Ontario conservation-authority regulated-area screening.
 *
 * Ontario has NO province-wide regulated-area layer, but each authority
 * publishes its O.Reg 41/24 regulation limit as an ArcGIS feature service.
 * This is a registry of those endpoints + a generalized point-intersect screen
 * (the pattern torontoGeo already uses for TRCA), so the feasibility engine gets
 * a flood/erosion/wetland kill-flag across the GTA, not just inside TRCA.
 *
 * Each authority is bounded by an approximate lat/lng extent so a point only
 * queries the authority whose watershed it could be in. Failures degrade to
 * "unavailable" (confidence downgrade), never block the underwrite. Results are
 * cached in geo_screen_cache (owned by torontoGeo) with a 30-day TTL.
 */

import { sql } from "drizzle-orm";
import { db } from "./db";

export interface ConservationAuthority {
  code: string;
  name: string;
  /** ArcGIS FeatureServer layer URL (…/FeatureServer/<id>) for the regulation limit. */
  featureServer: string;
  /** Approximate extent [minLng, minLat, maxLng, maxLat] — skip authorities a point can't be in. */
  extent: [number, number, number, number];
  verified: boolean;
}

/**
 * Registry — LIVE-VERIFIED endpoints only. A regulated-area screen is a
 * kill-flag: a dead or wrong endpoint reads as "not regulated" (false clear),
 * which is strictly worse than "out of coverage". Every entry here must have
 * passed a positive point-intersect test against a known-regulated location.
 *
 * Verified 2026-07-07: TRCA (count:1 on a Toronto ravine point).
 *
 * Candidates checked and REJECTED 2026-07-07 — re-verify before adding:
 *   CVC  "CVC_Regulation_Lines" (services5…C0BEdgagVaXzcw0W): only 26 features,
 *        count:0 in the Credit River floodplain — not the regulation limit.
 *   CLOCA "CLOCA_Regulated_Area_publicview" (services6…rtNHzl5XDmZaetYm):
 *        polygon layer with the right name but count:0 even ±150 m of Oshawa
 *        Creek — appears restricted or partial.
 *   LSRCA "Watershed_Development_Application_Regulation_Limits_WFL1": a one-off
 *        Newmarket study map, not the watershed regulation limit.
 *   Conservation Halton: no public regulated-area feature service found.
 */
export const CONSERVATION_AUTHORITIES: ConservationAuthority[] = [
  {
    code: "TRCA", name: "Toronto and Region Conservation Authority",
    featureServer: process.env.TRCA_REGULATED_AREA_URL
      || "https://services1.arcgis.com/d0ZCwU7eGKVeNiEE/arcgis/rest/services/TRCA_Regulation_Limit2/FeatureServer/0",
    extent: [-79.85, 43.55, -79.0, 44.05], verified: true,
  },
];

export interface ConservationScreen {
  status: "screened" | "unavailable" | "out_of_coverage";
  regulated: boolean;
  authority: string | null;
  detail: string | null;
  fromCache: boolean;
}

const CACHE_TTL_DAYS = 30;

function inExtent(lat: number, lng: number, e: [number, number, number, number]): boolean {
  return lng >= e[0] && lng <= e[2] && lat >= e[1] && lat <= e[3];
}

/** Which registered authorities could cover this point (by extent). Pure. */
export function authoritiesForPoint(lat: number, lng: number): ConservationAuthority[] {
  return CONSERVATION_AUTHORITIES.filter((a) => inExtent(lat, lng, a.extent));
}

async function queryAuthority(auth: ConservationAuthority, lat: number, lng: number): Promise<boolean> {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`, geometryType: "esriGeometryPoint", inSR: "4326",
    spatialRel: "esriSpatialRelIntersects", returnCountOnly: "true", f: "json",
  });
  const resp = await fetch(`${auth.featureServer}/query?${params}`, { signal: AbortSignal.timeout(10000) });
  if (!resp.ok) throw new Error(`${auth.code} query HTTP ${resp.status}`);
  const data = (await resp.json()) as { count?: number; features?: unknown[]; error?: { message?: string } };
  if (data.error) throw new Error(data.error.message || `${auth.code} query error`);
  return (data.count ?? data.features?.length ?? 0) > 0;
}

/**
 * Screen a point against whichever authority's watershed it falls in. Only the
 * matching authority (by extent) is queried; out-of-coverage points return
 * cleanly. Cached per rounded coordinate.
 */
export async function screenConservation(lat: number, lng: number): Promise<ConservationScreen> {
  const cacheKey = `ca:${lat.toFixed(5)}:${lng.toFixed(5)}`;
  try {
    const cached = await db.execute(sql`
      SELECT result FROM geo_screen_cache
      WHERE cache_key = ${cacheKey} AND cached_at > now() - interval '${sql.raw(String(CACHE_TTL_DAYS))} days'
    `);
    if (cached.rows.length) {
      const r = (cached.rows[0] as { result: Omit<ConservationScreen, "fromCache"> }).result;
      return { ...r, fromCache: true };
    }
  } catch {
    // geo_screen_cache not created yet (torontoGeo tables not ensured) — screen live.
  }

  const candidates = CONSERVATION_AUTHORITIES.filter((a) => inExtent(lat, lng, a.extent));
  if (!candidates.length) {
    const result: Omit<ConservationScreen, "fromCache"> = {
      status: "out_of_coverage", regulated: false, authority: null,
      detail: "No conservation authority in Realist's registry covers this location — check the local authority directly.",
    };
    return { ...result, fromCache: false };
  }

  // Extents can overlap at watershed edges, so a clean answer requires EVERY
  // candidate authority to answer "not regulated" — returning on the first
  // false would skip the authority that actually regulates the point.
  const failures: string[] = [];
  let hit: ConservationAuthority | null = null;
  for (const auth of candidates) {
    try {
      if (await queryAuthority(auth, lat, lng)) { hit = auth; break; }
    } catch (err: any) {
      console.error(`[conservation] ${auth.code} screen failed:`, err.message);
      failures.push(auth.code);
    }
  }

  if (!hit && failures.length) {
    // At least one authority could not be checked and none confirmed — not a clean screen.
    return {
      status: "unavailable", regulated: false, authority: failures[0],
      detail: `Conservation authority service (${failures.join(", ")}) could not be reached — regulation status not verified.`,
      fromCache: false,
    };
  }

  const result: Omit<ConservationScreen, "fromCache"> = hit
    ? {
        status: "screened", regulated: true, authority: hit.code,
        detail: `Point intersects the ${hit.name} regulated area (flood/erosion/wetland hazard + buffer under O.Reg 41/24). A permit from ${hit.code} is required before a building permit.`,
      }
    : { status: "screened", regulated: false, authority: candidates.map((c) => c.code).join(","), detail: null };
  try {
    await db.execute(sql`
      INSERT INTO geo_screen_cache (cache_key, result) VALUES (${cacheKey}, ${JSON.stringify(result)}::jsonb)
      ON CONFLICT (cache_key) DO UPDATE SET result = EXCLUDED.result, cached_at = now()
    `);
  } catch { /* cache table absent — return uncached */ }
  return { ...result, fromCache: false };
}
