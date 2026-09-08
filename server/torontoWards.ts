/**
 * Toronto ward boundaries — loaded by the server, not by an operator.
 *
 * The multiplex underwriter's "6+1 vs 4+1" verdict is only VERIFIED when the
 * point resolves to a ward polygon (By-law 654-2025 permits sixplexes by
 * ward). The polygons used to arrive via `npx tsx scripts/import-toronto-wards.ts`
 * run by hand against the production database, which never happened: the
 * health endpoint reported 0 wards in production and every verdict was
 * inferred from the postal-code prefix instead. The dataset is 25 features and
 * about 1 MB, so the server can fetch it itself at boot when the table is
 * empty. The bigger layers (zoning polygons, street trees, heritage) stay on
 * the manual importer — they are hundreds of megabytes.
 */

import { sql } from "drizzle-orm";
import { db } from "./db";
import { ensureEnrichmentTables, recordDataLayer } from "./enrichment";
import { bboxOfGeometry, type AreaGeometry } from "@shared/geoGeometry";

export const TORONTO_WARDS_GEOJSON_URL =
  process.env.TORONTO_WARDS_URL ||
  "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/5e7a8234-f805-43ac-820f-03d7c360b588/resource/737b29e0-8329-4260-b6af-21555ab24f28/download/city-wards-data-4326.geojson";

const CITY = "Toronto";
const ATTRIBUTION = "Contains information licensed under the Open Government Licence – Toronto.";
/** The 25-ward model; anything short of this means a partial or stale import. */
export const EXPECTED_WARD_COUNT = 25;

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

export async function countTorontoWards(): Promise<number> {
  const rows = await db.execute(sql`SELECT count(*)::int AS n FROM municipal_wards WHERE city = ${CITY}`);
  return Number((rows.rows[0] as { n?: number } | undefined)?.n ?? 0);
}

export interface WardImportResult {
  imported: number;
  skipped: number;
  sourceUrl: string;
}

/** Fetch the CKAN GeoJSON and upsert every ward. Re-runnable. */
export async function importTorontoWards(opts: { fetchImpl?: typeof fetch } = {}): Promise<WardImportResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  await ensureEnrichmentTables();
  const resp = await fetchImpl(TORONTO_WARDS_GEOJSON_URL, {
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
  return { imported, skipped, sourceUrl: TORONTO_WARDS_GEOJSON_URL };
}

let ensureInFlight: Promise<void> | null = null;

/**
 * Boot-time self-heal: import the wards when the table is empty or short.
 * Never throws — a failed download leaves the FSA fallback in place, exactly
 * as before, and the health endpoint keeps reporting 0 wards until it works.
 */
export function ensureTorontoWardsLoaded(): Promise<void> {
  if (ensureInFlight) return ensureInFlight;
  ensureInFlight = (async () => {
    try {
      await ensureEnrichmentTables();
      const n = await countTorontoWards();
      if (n >= EXPECTED_WARD_COUNT) return;
      console.log(`[toronto-wards] ${n}/${EXPECTED_WARD_COUNT} wards loaded — importing from open.toronto.ca`);
      const r = await importTorontoWards();
      console.log(`[toronto-wards] imported ${r.imported} wards (${r.skipped} skipped)`);
    } catch (err) {
      console.error("[toronto-wards] boot import failed (verdicts fall back to postal-area inference):", (err as Error).message);
    } finally {
      ensureInFlight = null;
    }
  })();
  return ensureInFlight;
}
