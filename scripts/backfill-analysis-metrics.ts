/**
 * ANALYSES CONVERGENCE (Task 4) backfill — populate the typed metric columns
 * (cap_rate_num, cash_flow_monthly_num, dscr_num, purchase_price_num,
 * monthly_rent_num) on the `analyses` table from each row's existing
 * inputs_json / results_json blob.
 *
 * Strictly additive: only writes the 5 typed columns; never touches the jsonb
 * blobs or any other column. Values come from shared/analysisMetrics.ts
 * `extractTypedMetrics` — the SAME function the write path (storage.createAnalysis)
 * uses — so backfilled rows and new writes can never diverge.
 *
 * Idempotent: by default only rows where ALL five typed columns are NULL are
 * scanned, and a row is only UPDATEd when extraction yields at least one
 * non-null value. So a genuinely metric-less row (garbage blob) writes nothing
 * and a re-run is a cheap re-scan; a backfilled row is excluded next time
 * (its columns are no longer all-NULL). Pass --force to recompute EVERY row
 * (use only if extractTypedMetrics's logic changed).
 *
 * Batched with keyset pagination by id, so it is safe on a large table and
 * restartable at any point.
 *
 * PREREQUISITE: `npm run db:push` must have added the 5 columns.
 *
 * Run (dry-run FIRST — reports counts, writes nothing):
 *   npx tsx scripts/backfill-analysis-metrics.ts --dry-run
 *   npx tsx scripts/backfill-analysis-metrics.ts
 *   npx tsx scripts/backfill-analysis-metrics.ts --force        # recompute all
 */

import { and, asc, gt, isNull, sql } from "drizzle-orm";
import { db, pool } from "../server/db";
import { analyses } from "../shared/schema";
import { extractTypedMetrics } from "../shared/analysisMetrics";

const BATCH_SIZE = 500;

interface Report {
  scanned: number;
  updated: number;
  noMetrics: number; // extracted all-null (nothing to write)
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  console.log(
    `Analyses metrics backfill ${dryRun ? "(DRY RUN — no writes)" : "(LIVE)"}${force ? " [--force: recompute ALL rows]" : ""}.`,
  );

  const report: Report = { scanned: 0, updated: 0, noMetrics: 0 };

  // Rows already carrying at least one typed value (for the summary only).
  const [{ count: alreadyDone }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(analyses)
    .where(sql`cap_rate_num IS NOT NULL OR cash_flow_monthly_num IS NOT NULL
      OR dscr_num IS NOT NULL OR purchase_price_num IS NOT NULL OR monthly_rent_num IS NOT NULL`);

  const notYetBackfilled = sql`cap_rate_num IS NULL AND cash_flow_monthly_num IS NULL
    AND dscr_num IS NULL AND purchase_price_num IS NULL AND monthly_rent_num IS NULL`;

  let lastId = "";
  for (;;) {
    const batch = await db
      .select({
        id: analyses.id,
        resultsJson: analyses.resultsJson,
        inputsJson: analyses.inputsJson,
        strategyType: analyses.strategyType,
      })
      .from(analyses)
      .where(force ? gt(analyses.id, lastId) : and(gt(analyses.id, lastId), notYetBackfilled))
      .orderBy(asc(analyses.id))
      .limit(BATCH_SIZE);
    if (batch.length === 0) break;
    lastId = batch[batch.length - 1].id;
    report.scanned += batch.length;

    const ids: string[] = [];
    const caps: (number | null)[] = [];
    const cfs: (number | null)[] = [];
    const dscrs: (number | null)[] = [];
    const prices: (number | null)[] = [];
    const rents: (number | null)[] = [];

    for (const row of batch) {
      const m = extractTypedMetrics(row);
      const hasAny =
        m.capRateNum != null || m.cashFlowMonthlyNum != null || m.dscrNum != null ||
        m.purchasePriceNum != null || m.monthlyRentNum != null;
      // In --force mode we write even all-null rows (to overwrite stale values);
      // in default mode a metric-less row is left untouched and just re-scanned.
      if (!hasAny && !force) {
        report.noMetrics += 1;
        continue;
      }
      if (!hasAny) report.noMetrics += 1;
      ids.push(row.id);
      caps.push(m.capRateNum);
      cfs.push(m.cashFlowMonthlyNum);
      dscrs.push(m.dscrNum);
      prices.push(m.purchasePriceNum);
      rents.push(m.monthlyRentNum);
    }

    if (!dryRun && ids.length > 0) {
      // One bulk UPDATE per batch via unnest — NULLs in the JS arrays become
      // SQL NULLs. Far faster than N per-row round-trips on a big table.
      await pool.query(
        `UPDATE analyses AS a SET
           cap_rate_num = v.cap,
           cash_flow_monthly_num = v.cf,
           dscr_num = v.dscr,
           purchase_price_num = v.price,
           monthly_rent_num = v.rent
         FROM unnest($1::text[], $2::real[], $3::real[], $4::real[], $5::real[], $6::real[])
           AS v(id, cap, cf, dscr, price, rent)
         WHERE a.id = v.id`,
        [ids, caps, cfs, dscrs, prices, rents],
      );
    }
    report.updated += ids.length;
    console.log(`  scanned ${report.scanned} (last id ${lastId})`);
  }

  console.log("\n— Report —");
  console.log(`  rows with a typed value before run: ${Number(alreadyDone)}`);
  console.log(`  scanned this run:                   ${report.scanned}`);
  console.log(`  ${dryRun ? "would update" : "updated"}:                       ${report.updated}`);
  console.log(`  metric-less (all-null extraction):  ${report.noMetrics}`);
  if (dryRun) console.log("\nDry run complete. Re-run without --dry-run to write.");

  await pool.end();
}

main().catch((err) => {
  console.error("backfill-analysis-metrics failed:", err);
  process.exit(1);
});
