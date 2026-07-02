/**
 * StatCan 2021 Census dissemination-area importer for the enrichment spine.
 *
 * Populates the self-migrating tables in server/enrichment.ts and records each
 * layer in the data_layers registry:
 *
 *   npx tsx scripts/import-census-da.ts boundaries <da-boundaries.geojson|.ndjson>
 *   npx tsx scripts/import-census-da.ts profiles   <98-401-X2021006_English_CSV_data_*.csv>
 *
 * Sources:
 *   boundaries: 2021 Dissemination Area Boundary File (lda_000b21a_e.zip, SHP)
 *               https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/index2021-eng.cfm
 *               SHP → GeoJSON (per-province files stay comfortably in memory):
 *                 npx mapshaper lda_000b21a_e.zip -simplify 12% keep-shapes \
 *                   -filter 'PRUID === "35"' -o precision=0.000001 format=geojson da_on.geojson
 *               Or the whole country as newline-delimited features (constant memory):
 *                 ogr2ogr -f GeoJSONSeq da_canada.ndjson lda_000b21a_e.shp -t_srs EPSG:4326
 *   profiles:   2021 Census Profile, DA level (98-401-X2021006), comprehensive CSV
 *               https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/details/download-telecharger.cfm
 *               (regional splits: Atlantic/Quebec/Ontario/Prairies/BC/Territories — the
 *               importer streams line-by-line, so even the 2.2GB national file is fine)
 *
 * Re-runnable: upserts by DAUID; a re-import refreshes rows in place.
 */

import fs from "node:fs";
import readline from "node:readline";
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { ensureEnrichmentTables, recordDataLayer } from "../server/enrichment";
import { bboxOfGeometry, type AreaGeometry } from "../shared/geoGeometry";
import { parseCsv } from "../shared/usListingsCsv";
import {
  applyCharacteristic,
  emptyDaProfile,
  indexCensusColumns,
  isWantedCharacteristic,
  parseCensusValue,
  ATTRIBUTION,
  CENSUS_YEAR,
  type DaProfile,
} from "../shared/censusProfile";

const BATCH_SIZE = 200;

type Feature = {
  type: "Feature";
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown> | null;
};

// ─── Boundaries ──────────────────────────────────────────────────────────────

/** Strip the RS (0x1E) record separator GeoJSONSeq writers prepend. */
const stripRs = (line: string): string => line.replace(/^\x1e/, "").trim();

async function* readFeatures(path: string): AsyncGenerator<Feature> {
  // ndjson / GeoJSONSeq: one feature per line (constant memory, any file size).
  const rl = readline.createInterface({ input: fs.createReadStream(path, "utf8"), crlfDelay: Infinity });
  let firstLine: string | null = null;
  for await (const line of rl) {
    firstLine = stripRs(line);
    break;
  }
  rl.close();

  let ndjson = false;
  if (firstLine) {
    try {
      const parsed = JSON.parse(firstLine);
      ndjson = parsed?.type === "Feature";
    } catch {
      ndjson = false;
    }
  }

  if (ndjson) {
    const stream = readline.createInterface({ input: fs.createReadStream(path, "utf8"), crlfDelay: Infinity });
    for await (const raw of stream) {
      const line = stripRs(raw);
      if (!line) continue;
      const feature = JSON.parse(line) as Feature;
      if (feature?.type === "Feature") yield feature;
    }
    return;
  }

  // FeatureCollection: parsed whole. Fine for per-province files; for the national
  // file use GeoJSONSeq/ndjson (see header) or raise --max-old-space-size.
  const raw = JSON.parse(fs.readFileSync(path, "utf8"));
  if (raw?.type !== "FeatureCollection") throw new Error("Expected a FeatureCollection or ndjson Features");
  for (const feature of raw.features as Feature[]) yield feature;
}

function prop(props: Record<string, unknown> | null, keys: string[]): string | null {
  for (const k of keys) {
    const v = props?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

async function importBoundaries(path: string): Promise<void> {
  let imported = 0;
  let skipped = 0;

  for await (const f of readFeatures(path)) {
    const g = f.geometry;
    if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) {
      skipped++;
      continue;
    }
    const dauid = prop(f.properties, ["DAUID", "dauid"]);
    if (!dauid) {
      skipped++;
      continue;
    }
    const landArea = prop(f.properties, ["LANDAREA", "landarea"]);
    const provinceCode = prop(f.properties, ["PRUID", "pruid"]) ?? dauid.slice(0, 2);
    const geom = g as AreaGeometry;
    const bbox = bboxOfGeometry(geom);

    await db.execute(sql`
      INSERT INTO census_da_boundaries (dauid, province_code, land_area_km2, geojson, min_lng, min_lat, max_lng, max_lat)
      VALUES (${dauid}, ${provinceCode}, ${landArea ? Number(landArea) : null}, ${JSON.stringify(geom)}::jsonb,
              ${bbox.minLng}, ${bbox.minLat}, ${bbox.maxLng}, ${bbox.maxLat})
      ON CONFLICT (dauid) DO UPDATE SET
        province_code = EXCLUDED.province_code,
        land_area_km2 = EXCLUDED.land_area_km2,
        geojson = EXCLUDED.geojson,
        min_lng = EXCLUDED.min_lng, min_lat = EXCLUDED.min_lat,
        max_lng = EXCLUDED.max_lng, max_lat = EXCLUDED.max_lat,
        imported_at = now()
    `);
    imported++;
    if (imported % 2000 === 0) console.log(`[census-da] boundaries: ${imported} imported...`);
  }

  await recordDataLayer({
    key: "census_da_boundaries",
    name: "StatCan 2021 dissemination area boundaries",
    sourceUrl: "https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/index2021-eng.cfm",
    licence: "Statistics Canada Open Licence",
    attribution: ATTRIBUTION,
    geography: "Canada (dissemination areas)",
    refreshCadence: "per census (next: 2026 boundaries, ~2027)",
    rowCount: imported,
  });
  console.log(`[census-da] boundaries done: ${imported} imported, ${skipped} skipped`);
}

// ─── Profiles ────────────────────────────────────────────────────────────────

async function flushProfiles(batch: DaProfile[]): Promise<void> {
  if (!batch.length) return;
  const values = batch.map(
    (p) => sql`(${p.dauid}, ${p.censusYear}, ${JSON.stringify(p)}::jsonb, now())`,
  );
  await db.execute(sql`
    INSERT INTO census_da_profiles (dauid, census_year, profile, imported_at)
    VALUES ${sql.join(values, sql`, `)}
    ON CONFLICT (dauid) DO UPDATE SET
      census_year = EXCLUDED.census_year,
      profile = EXCLUDED.profile,
      imported_at = now()
  `);
}

async function importProfiles(path: string): Promise<void> {
  const rl = readline.createInterface({ input: fs.createReadStream(path, "utf8"), crlfDelay: Infinity });

  let cols: ReturnType<typeof indexCensusColumns> | null = null;
  let current: DaProfile | null = null;
  let batch: DaProfile[] = [];
  let imported = 0;
  let dataLines = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    const cells = parseCsv(line)[0];
    if (!cells || cells.length < 2) continue;

    if (!cols) {
      cols = indexCensusColumns(cells);
      continue;
    }
    dataLines++;
    if (cells[cols.geoLevel]?.trim() !== "Dissemination area") continue;
    const dauid = cells[cols.altGeoCode]?.trim();
    if (!dauid) continue;

    if (!current || current.dauid !== dauid) {
      if (current) {
        batch.push(current);
        if (batch.length >= BATCH_SIZE) {
          await flushProfiles(batch);
          imported += batch.length;
          batch = [];
          if (imported % 2000 === 0) console.log(`[census-da] profiles: ${imported} DAs imported...`);
        }
      }
      current = emptyDaProfile(dauid);
    }

    const id = Number(cells[cols.characteristicId]);
    if (!Number.isFinite(id) || !isWantedCharacteristic(id)) continue;
    applyCharacteristic(current, id, parseCensusValue(cells[cols.countTotal]));
  }

  if (current) batch.push(current);
  await flushProfiles(batch);
  imported += batch.length;

  await recordDataLayer({
    key: "census_da_profiles",
    name: `StatCan ${CENSUS_YEAR} Census Profile (dissemination areas)`,
    sourceUrl: "https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/details/download-telecharger.cfm",
    licence: "Statistics Canada Open Licence",
    attribution: ATTRIBUTION,
    geography: "Canada (dissemination areas)",
    refreshCadence: "per census (2026 profile expected 2027-2028)",
    rowCount: imported,
    notes: `Imported from ${path.split("/").pop()}`,
  });
  console.log(`[census-da] profiles done: ${imported} DAs imported (${dataLines} data lines scanned)`);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const [mode, path] = process.argv.slice(2);
  if (!mode || !path || !["boundaries", "profiles"].includes(mode)) {
    console.error("Usage: npx tsx scripts/import-census-da.ts <boundaries|profiles> <file>");
    process.exit(1);
  }
  if (!fs.existsSync(path)) {
    console.error(`File not found: ${path}`);
    process.exit(1);
  }

  await ensureEnrichmentTables();
  if (mode === "boundaries") await importBoundaries(path);
  else await importProfiles(path);
  process.exit(0);
}

main().catch((err) => {
  console.error("[census-da] import failed:", err);
  process.exit(1);
});
