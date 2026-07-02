/**
 * Québec assessment-roll importer (MAMH open data, CC-BY 4.0 Québec).
 *
 * Populates assessment_units (server/enrichment.ts) from the per-municipality
 * RL XML files — 1,134 municipalities, ~2.8M units province-wide:
 *
 *   npx tsx scripts/import-quebec-roll.ts municipality 66023          # download + import Montréal
 *   npx tsx scripts/import-quebec-roll.ts municipality 66023,65005    # several at once
 *   npx tsx scripts/import-quebec-roll.ts file <path.xml> <code> <name>  # pre-downloaded file
 *   npx tsx scripts/import-quebec-roll.ts list [filter]               # codes/names from the index
 *
 * Files stream (Montréal is ~800MB XML) — constant memory. Re-runnable:
 * upserts by (source, municipality_code, matricule).
 *
 * Index: https://donneesouvertes.affmunqc.net/role/indexRole2026.csv
 */

import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { ensureEnrichmentTables, recordDataLayer } from "../server/enrichment";
import { parseCsv } from "../shared/usListingsCsv";
import {
  extractUnits,
  looseAddressKey,
  parseRollUnit,
  QUEBEC_ROLL_ATTRIBUTION,
  type QuebecRollUnit,
} from "../shared/quebecRoll";

const INDEX_URL = "https://donneesouvertes.affmunqc.net/role/indexRole2026.csv";
const ROLL_YEAR = 2026;
const SOURCE = "qc-mamh";
const BATCH_SIZE = 500;

interface Municipality {
  code: string;
  name: string;
  url: string;
}

async function fetchIndex(): Promise<Municipality[]> {
  const resp = await fetch(INDEX_URL, { signal: AbortSignal.timeout(60000) });
  if (!resp.ok) throw new Error(`index HTTP ${resp.status}`);
  const rows = parseCsv(await resp.text()).filter((r) => r.length >= 3);
  return rows
    .slice(1)
    .map(([code, name, url]) => ({ code: code.trim().padStart(5, "0"), name: name.trim(), url: url.trim() }))
    .filter((m) => m.code && m.url);
}

async function flushBatch(muni: Municipality, batch: QuebecRollUnit[]): Promise<void> {
  if (!batch.length) return;
  const values = batch.map((u) =>
    sql`(${SOURCE}, ${muni.code}, ${muni.name}, ${ROLL_YEAR}, ${u.matricule}, ${u.address},
        ${looseAddressKey(u.civicNumber, u.streetName)}, ${u.lotNumber}, ${u.cubf},
        ${u.frontageM}, ${u.lotAreaM2}, ${u.storeys}, ${u.yearBuilt}, ${u.yearBuiltEstimated},
        ${u.floorAreaM2}, ${u.dwellings}, ${u.marketRefDate}, ${u.landValue}, ${u.buildingValue},
        ${u.totalValue}, ${u.previousRollValue}, now())`,
  );
  await db.execute(sql`
    INSERT INTO assessment_units
      (source, municipality_code, municipality_name, roll_year, matricule, address,
       loose_address_key, lot_number, cubf, frontage_m, lot_area_m2, storeys, year_built,
       year_built_estimated, floor_area_m2, dwellings, market_ref_date, land_value,
       building_value, total_value, previous_roll_value, imported_at)
    VALUES ${sql.join(values, sql`, `)}
    ON CONFLICT (source, municipality_code, matricule) DO UPDATE SET
      municipality_name = EXCLUDED.municipality_name,
      roll_year = EXCLUDED.roll_year,
      address = EXCLUDED.address,
      loose_address_key = EXCLUDED.loose_address_key,
      lot_number = EXCLUDED.lot_number,
      cubf = EXCLUDED.cubf,
      frontage_m = EXCLUDED.frontage_m,
      lot_area_m2 = EXCLUDED.lot_area_m2,
      storeys = EXCLUDED.storeys,
      year_built = EXCLUDED.year_built,
      year_built_estimated = EXCLUDED.year_built_estimated,
      floor_area_m2 = EXCLUDED.floor_area_m2,
      dwellings = EXCLUDED.dwellings,
      market_ref_date = EXCLUDED.market_ref_date,
      land_value = EXCLUDED.land_value,
      building_value = EXCLUDED.building_value,
      total_value = EXCLUDED.total_value,
      previous_roll_value = EXCLUDED.previous_roll_value,
      imported_at = now()
  `);
}

async function importStream(muni: Municipality, stream: NodeJS.ReadableStream): Promise<number> {
  let buffer = "";
  let batch: QuebecRollUnit[] = [];
  let imported = 0;
  let skippedNoMatricule = 0;
  // Streaming decode: Buffer.toString() would corrupt accented street names
  // whose UTF-8 bytes split across chunk boundaries.
  const decoder = new TextDecoder("utf-8");

  const flush = async () => {
    await flushBatch(muni, batch);
    imported += batch.length;
    batch = [];
  };

  for await (const chunk of stream) {
    buffer += typeof chunk === "string" ? chunk : decoder.decode(chunk as Uint8Array, { stream: true });
    const { units, rest } = extractUnits(buffer);
    buffer = rest;
    for (const unitXml of units) {
      const unit = parseRollUnit(unitXml);
      // The matricule is the upsert key — a unit without one can't be tracked.
      if (!unit.matricule) {
        skippedNoMatricule++;
        continue;
      }
      batch.push(unit);
      if (batch.length >= BATCH_SIZE) {
        await flush();
        if (imported % 25_000 === 0) console.log(`  [${muni.name}] ${imported} units...`);
      }
    }
  }
  await flush();
  if (skippedNoMatricule) console.log(`  [${muni.name}] ${skippedNoMatricule} units without matricule skipped`);
  console.log(`  [${muni.name}] done: ${imported} units`);
  return imported;
}

async function importMunicipality(muni: Municipality): Promise<number> {
  console.log(`Downloading ${muni.name} (${muni.code}) — ${muni.url}`);
  const resp = await fetch(muni.url, { signal: AbortSignal.timeout(30 * 60 * 1000) });
  if (!resp.ok || !resp.body) throw new Error(`${muni.name}: HTTP ${resp.status}`);
  return importStream(muni, Readable.fromWeb(resp.body as import("node:stream/web").ReadableStream));
}

async function updateRegistry(): Promise<void> {
  const counts = await db.execute(sql`
    SELECT COUNT(*)::int AS units, COUNT(DISTINCT municipality_code)::int AS munis
    FROM assessment_units WHERE source = ${SOURCE}
  `);
  const { units, munis } = counts.rows[0] as { units: number; munis: number };
  await recordDataLayer({
    key: "qc_assessment_roll",
    name: `Québec assessment roll ${ROLL_YEAR} (MAMH)`,
    sourceUrl: INDEX_URL,
    licence: "CC-BY 4.0 Québec",
    attribution: QUEBEC_ROLL_ATTRIBUTION,
    geography: `Québec — ${munis}/1134 municipalities`,
    refreshCadence: "annual (new roll file each January; quarterly index updates)",
    rowCount: units,
  });
  console.log(`Registry updated: ${units} units across ${munis} municipalities`);
}

async function main(): Promise<void> {
  const [mode, ...args] = process.argv.slice(2);

  if (mode === "list") {
    const index = await fetchIndex();
    const filter = (args[0] || "").toLowerCase();
    for (const m of index) {
      if (!filter || m.name.toLowerCase().includes(filter)) console.log(`${m.code}  ${m.name}`);
    }
    return;
  }

  await ensureEnrichmentTables();

  if (mode === "municipality") {
    const codes = (args[0] || "").split(",").map((c) => c.trim().padStart(5, "0")).filter(Boolean);
    if (!codes.length) throw new Error("Usage: municipality <code>[,<code>...] — find codes with `list`");
    const index = await fetchIndex();
    const byCode = new Map(index.map((m) => [m.code, m]));
    for (const code of codes) {
      const muni = byCode.get(code);
      if (!muni) throw new Error(`code ${code} not in the ${ROLL_YEAR} index`);
      await importMunicipality(muni);
    }
    await updateRegistry();
    return;
  }

  if (mode === "file") {
    const [file, code, name] = args;
    if (!file || !code || !fs.existsSync(file)) {
      throw new Error("Usage: file <path.xml> <municipality-code> [name]");
    }
    await importStream(
      { code: code.padStart(5, "0"), name: name || path.basename(file, ".xml"), url: file },
      fs.createReadStream(file, "utf8"),
    );
    await updateRegistry();
    return;
  }

  console.error("Usage: npx tsx scripts/import-quebec-roll.ts <municipality|file|list> ...");
  process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[quebec-roll] import failed:", err);
    process.exit(1);
  });
