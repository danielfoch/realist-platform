/**
 * Municipal assessment-roll importer (Socrata CSV exports) for the enrichment
 * spine. Companion to scripts/import-quebec-roll.ts — same assessment_units
 * table, but for the single-table CSV cities (Winnipeg, Calgary, Edmonton):
 *
 *   npx tsx scripts/import-assessment-rolls.ts winnipeg,calgary,edmonton
 *   npx tsx scripts/import-assessment-rolls.ts all
 *   npx tsx scripts/import-assessment-rolls.ts list
 *
 * Adapters live in shared/assessmentRolls.ts (columns verified against the live
 * Socrata resources 2026-07). The full-file CSV export is streamed via the
 * incremental RFC-4180 parser (shared/streamingCsv.ts) — the exports are
 * 100–600MB. Re-runnable: upserts by (source, municipality_code, matricule),
 * so a re-run refreshes rows in place. Schedule ~annually (rolls update once a
 * cycle; Winnipeg/Calgary refresh continuously within a roll year).
 */

import { Readable } from "node:stream";
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { ensureEnrichmentTables, recordDataLayer } from "../server/enrichment";
import { createCsvStreamParser } from "../shared/streamingCsv";
import {
  ASSESSMENT_ROLL_ADAPTERS,
  type AssessmentRollAdapter,
  type AssessmentRollRecord,
} from "../shared/assessmentRolls";

const BATCH_SIZE = 500;

async function flushBatch(adapter: AssessmentRollAdapter, batch: AssessmentRollRecord[]): Promise<void> {
  if (!batch.length) return;
  // Dedupe within the batch so the multi-row upsert can't collide with itself.
  const unique = [...new Map(batch.map((r) => [r.matricule, r])).values()];
  const values = unique.map(
    (r) => sql`(${adapter.key}, ${adapter.key}, ${adapter.name}, ${r.rollYear}, ${r.matricule}, ${r.address},
        ${r.looseAddressKey}, ${r.cubf}, ${r.frontageM}, ${r.lotAreaM2}, ${r.storeys}, ${r.yearBuilt},
        ${r.yearBuiltEstimated}, ${r.floorAreaM2}, ${r.dwellings}, ${r.marketRefDate}, ${r.landValue},
        ${r.buildingValue}, ${r.totalValue}, ${r.previousRollValue}, now())`,
  );
  await db.execute(sql`
    INSERT INTO assessment_units
      (source, municipality_code, municipality_name, roll_year, matricule, address, loose_address_key,
       cubf, frontage_m, lot_area_m2, storeys, year_built, year_built_estimated, floor_area_m2, dwellings,
       market_ref_date, land_value, building_value, total_value, previous_roll_value, imported_at)
    VALUES ${sql.join(values, sql`, `)}
    ON CONFLICT (source, municipality_code, matricule) DO UPDATE SET
      municipality_name = EXCLUDED.municipality_name,
      roll_year = EXCLUDED.roll_year,
      address = EXCLUDED.address,
      loose_address_key = EXCLUDED.loose_address_key,
      cubf = EXCLUDED.cubf,
      lot_area_m2 = EXCLUDED.lot_area_m2,
      year_built = EXCLUDED.year_built,
      floor_area_m2 = EXCLUDED.floor_area_m2,
      market_ref_date = EXCLUDED.market_ref_date,
      total_value = EXCLUDED.total_value,
      imported_at = now()
  `);
}

async function importCity(adapter: AssessmentRollAdapter): Promise<number> {
  console.log(`Downloading ${adapter.name} assessment roll — ${adapter.downloadUrl}`);
  const resp = await fetch(adapter.downloadUrl, {
    headers: adapter.headers ?? { "User-Agent": "Mozilla/5.0 (realist.ca open-data importer; hello@realist.ca)" },
    signal: AbortSignal.timeout(45 * 60 * 1000),
  });
  if (!resp.ok || !resp.body) throw new Error(`${adapter.name}: HTTP ${resp.status}`);

  const parser = createCsvStreamParser();
  const decoder = new TextDecoder("utf-8");
  let header: string[] | null = null;
  let batch: AssessmentRollRecord[] = [];
  let imported = 0;
  let skipped = 0;

  const handleRows = async (rows: string[][]): Promise<void> => {
    for (const cells of rows) {
      if (!header) {
        header = cells.map((c) => c.replace(/^\uFEFF/, "").trim().toLowerCase());
        continue;
      }
      if (cells.length < 2) continue;
      const row: Record<string, string> = {};
      header.forEach((name, i) => {
        row[name] = cells[i] ?? "";
      });
      const rec = adapter.mapRow(row);
      if (!rec) {
        skipped++;
        continue;
      }
      batch.push(rec);
      if (batch.length >= BATCH_SIZE) {
        await flushBatch(adapter, batch);
        imported += batch.length;
        batch = [];
        if (imported % 50_000 === 0) console.log(`  [${adapter.name}] ${imported} units...`);
      }
    }
  };

  for await (const chunk of Readable.fromWeb(resp.body as import("node:stream/web").ReadableStream)) {
    await handleRows(parser.push(decoder.decode(chunk as Uint8Array, { stream: true })));
  }
  await handleRows(parser.push(decoder.decode()));
  await handleRows(parser.end());
  await flushBatch(adapter, batch);
  imported += batch.length;

  console.log(`  [${adapter.name}] done: ${imported} units, ${skipped} rows skipped`);
  return imported;
}

async function updateRegistry(): Promise<void> {
  const counts = await db.execute(sql`
    SELECT source, COUNT(*)::int AS n, MAX(roll_year) AS roll_year
    FROM assessment_units
    WHERE source = ANY(${ASSESSMENT_ROLL_ADAPTERS.map((a) => a.key)})
    GROUP BY source ORDER BY source
  `);
  const parts = (counts.rows as Array<{ source: string; n: number; roll_year: number | null }>).map(
    (r) => `${r.source}: ${r.n}${r.roll_year ? ` (roll ${r.roll_year})` : ""}`,
  );
  const total = (counts.rows as Array<{ n: number }>).reduce((s, r) => s + r.n, 0);
  await recordDataLayer({
    key: "municipal_assessment_rolls",
    name: "Municipal assessment rolls (Winnipeg, Calgary, Edmonton)",
    sourceUrl: "see shared/assessmentRolls.ts adapters",
    licence: ASSESSMENT_ROLL_ADAPTERS.map((a) => `${a.name}: ${a.licence}`).join("; "),
    attribution: ASSESSMENT_ROLL_ADAPTERS.map((a) => a.attribution).join(" "),
    geography: ASSESSMENT_ROLL_ADAPTERS.map((a) => a.name).join(", "),
    refreshCadence: "annual (rolls reissue per assessment cycle; re-run to refresh)",
    rowCount: total,
    notes: parts.join("; "),
  });
  console.log(`Registry updated: ${parts.join("; ")}`);
}

async function main(): Promise<void> {
  const arg = (process.argv[2] || "").trim();

  if (arg === "list" || !arg) {
    console.log("Available cities:");
    for (const a of ASSESSMENT_ROLL_ADAPTERS) console.log(`  ${a.key}  (${a.name}, ${a.province}) — ${a.licence}`);
    if (!arg) {
      console.error("\nUsage: npx tsx scripts/import-assessment-rolls.ts <city[,city...]|all>");
      process.exit(1);
    }
    return;
  }

  const keys =
    arg === "all"
      ? ASSESSMENT_ROLL_ADAPTERS.map((a) => a.key)
      : arg.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);

  await ensureEnrichmentTables();
  for (const key of keys) {
    const adapter = ASSESSMENT_ROLL_ADAPTERS.find((a) => a.key === key);
    if (!adapter) throw new Error(`unknown city '${key}' — run with 'list'`);
    await importCity(adapter);
  }
  await updateRegistry();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[assessment-rolls] import failed:", err);
    process.exit(1);
  });
