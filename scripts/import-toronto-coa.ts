/**
 * Toronto Committee of Adjustment importer for the enrichment spine.
 *
 *   npx tsx scripts/import-toronto-coa.ts          # closed-since-2017 + active
 *   npx tsx scripts/import-toronto-coa.ts closed    # just the closed archive
 *   npx tsx scripts/import-toronto-coa.ts active
 *
 * Streams the CKAN datastore dump CSV for each resource and upserts into
 * coa_applications by (source, reference_file). Address-only dataset — listings
 * match by loose address key. This is the data/ETL layer that feeds the listing
 * "variance history" card and the ground-truth substrate for the multiplex
 * variance-risk calibration. Re-runnable; schedule ~weekly (active updates
 * frequently; closed grows as applications finalize).
 */

import { Readable } from "node:stream";
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { ensureEnrichmentTables, recordDataLayer } from "../server/enrichment";
import { createCsvStreamParser } from "../shared/streamingCsv";
import { mapCoaRow, COA_APPLICATIONS_ATTRIBUTION, type CoaApplication } from "../shared/coaApplications";

const SOURCE = "toronto";
const BATCH_SIZE = 500;
const DUMP_BASE = "https://ckan0.cf.opendata.inter.prod-toronto.ca/datastore/dump";

const RESOURCES: Record<string, { id: string; label: string }> = {
  closed: { id: "9c97254e-5460-4799-896f-c7823413c81c", label: "Closed applications since 2017" },
  active: { id: "51fd09cd-99d6-430a-9d42-c24a937b0cb0", label: "Active applications" },
};

async function flushBatch(batch: CoaApplication[]): Promise<void> {
  if (!batch.length) return;
  // Dedupe within the batch so the multi-row upsert can't collide with itself.
  const unique = [...new Map(batch.map((r) => [r.referenceFile, r])).values()];
  const values = unique.map(
    (r) => sql`(${SOURCE}, ${r.referenceFile}, ${r.sysId}, ${r.applicationType}, ${r.subType}, ${r.workType},
        ${r.status}, ${r.decision}, ${r.ombDecision}, ${r.address}, ${r.looseAddressKey}, ${r.wardNumber},
        ${r.wardName}, ${r.zoningReview}, ${r.zoningDesignation}, ${r.description}, ${r.inDate},
        ${r.hearingDate}, ${r.finalDate}, ${r.numberOfLotsCreated}, ${r.applicationUrl}, now())`,
  );
  await db.execute(sql`
    INSERT INTO coa_applications
      (source, reference_file, sys_id, application_type, sub_type, work_type, status, decision, omb_decision,
       address, loose_address_key, ward_number, ward_name, zoning_review, zoning_designation, description,
       in_date, hearing_date, final_date, number_of_lots_created, application_url, imported_at)
    VALUES ${sql.join(values, sql`, `)}
    ON CONFLICT (source, reference_file) DO UPDATE SET
      sys_id = EXCLUDED.sys_id,
      application_type = EXCLUDED.application_type,
      sub_type = EXCLUDED.sub_type,
      work_type = EXCLUDED.work_type,
      status = EXCLUDED.status,
      decision = EXCLUDED.decision,
      omb_decision = EXCLUDED.omb_decision,
      address = EXCLUDED.address,
      loose_address_key = EXCLUDED.loose_address_key,
      ward_number = EXCLUDED.ward_number,
      ward_name = EXCLUDED.ward_name,
      zoning_review = EXCLUDED.zoning_review,
      zoning_designation = EXCLUDED.zoning_designation,
      description = EXCLUDED.description,
      in_date = EXCLUDED.in_date,
      hearing_date = EXCLUDED.hearing_date,
      final_date = EXCLUDED.final_date,
      number_of_lots_created = EXCLUDED.number_of_lots_created,
      application_url = EXCLUDED.application_url,
      imported_at = now()
  `);
}

async function importResource(key: string): Promise<number> {
  const resource = RESOURCES[key];
  const url = `${DUMP_BASE}/${resource.id}`;
  console.log(`Downloading Toronto CoA — ${resource.label} (${url})`);
  const resp = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (realist.ca open-data importer; hello@realist.ca)" },
    signal: AbortSignal.timeout(20 * 60 * 1000),
  });
  if (!resp.ok || !resp.body) throw new Error(`Toronto CoA ${key}: HTTP ${resp.status}`);

  const parser = createCsvStreamParser();
  const decoder = new TextDecoder("utf-8");
  let header: string[] | null = null;
  let batch: CoaApplication[] = [];
  let imported = 0;
  let skipped = 0;

  const handleRows = async (rows: string[][]): Promise<void> => {
    for (const cells of rows) {
      if (!header) {
        // Datastore dump headers are the field IDs (already underscore_case);
        // lower-case so "REFERENCE_FILE#" / "C_OF_A_DESCISION" read consistently.
        header = cells.map((c) => c.replace(/^\uFEFF/, "").trim().toLowerCase());
        continue;
      }
      if (cells.length < 2) continue;
      const row: Record<string, string> = {};
      header.forEach((name, i) => {
        row[name] = cells[i] ?? "";
      });
      const rec = mapCoaRow(row);
      if (!rec) {
        skipped++;
        continue;
      }
      batch.push(rec);
      if (batch.length >= BATCH_SIZE) {
        await flushBatch(batch);
        imported += batch.length;
        batch = [];
        if (imported % 10_000 === 0) console.log(`  [${key}] ${imported} applications...`);
      }
    }
  };

  for await (const chunk of Readable.fromWeb(resp.body as import("node:stream/web").ReadableStream)) {
    await handleRows(parser.push(decoder.decode(chunk as Uint8Array, { stream: true })));
  }
  await handleRows(parser.push(decoder.decode()));
  await handleRows(parser.end());
  await flushBatch(batch);
  imported += batch.length;

  console.log(`  [${key}] done: ${imported} imported, ${skipped} skipped (no file number)`);
  return imported;
}

async function main(): Promise<void> {
  const arg = (process.argv[2] || "").trim().toLowerCase();
  const keys = arg && RESOURCES[arg] ? [arg] : Object.keys(RESOURCES);
  if (arg && !RESOURCES[arg]) throw new Error(`unknown resource '${arg}' — use: ${Object.keys(RESOURCES).join(", ")}`);

  await ensureEnrichmentTables();
  let total = 0;
  for (const key of keys) total += await importResource(key);

  const count = await db.execute(sql`SELECT COUNT(*)::int AS n FROM coa_applications WHERE source = ${SOURCE}`);
  const n = (count.rows[0] as { n: number }).n;
  await recordDataLayer({
    key: "toronto_coa_applications",
    name: "Toronto Committee of Adjustment applications",
    sourceUrl: "https://open.toronto.ca/dataset/committee-of-adjustment-applications/",
    licence: "Open Government Licence – Toronto",
    attribution: COA_APPLICATIONS_ATTRIBUTION,
    geography: "Toronto",
    refreshCadence: "weekly (active updates frequently; closed grows as applications finalize)",
    rowCount: n,
    notes: `imported ${total} this run (${keys.join(", ")}); ${n} total on file`,
  });
  console.log(`Toronto CoA done: ${n} applications on file.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[toronto-coa] import failed:", err);
  process.exit(1);
});
