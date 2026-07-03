/**
 * Nova Scotia assessed-value enrichment (PVSC bt58-qu28 → assessment_units).
 *
 *   npx tsx scripts/enrich-ns-values.ts
 *
 * The NS base roll (scripts/import-assessment-rolls.ts ns-pvsc) loads dwelling
 * characteristics (a859-xvcs) but NOT assessed value — value lives in the
 * multi-year PVSC dataset bt58-qu28 (~3.2M rows), joined on the `aan` account
 * number. This job:
 *   1. finds the latest tax_year,
 *   2. streams that year's (aan, assessed_value) into a TEMP table,
 *   3. sets assessment_units.total_value in one UPDATE ... FROM.
 *
 * Run AFTER the ns-pvsc base import. Re-runnable (idempotent UPDATE). Paginates
 * the Socrata API with a stable $order to avoid skips/dupes.
 */

import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { ensureEnrichmentTables } from "../server/enrichment";

const BASE = "https://www.thedatazone.ca/resource/bt58-qu28.json";
const UA = { "User-Agent": "Mozilla/5.0 (realist.ca open-data importer; hello@realist.ca)" };
const PAGE = 50000;
const NS_SOURCE = "ns-pvsc";

async function getJson(url: string): Promise<any[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(url, { headers: UA, signal: AbortSignal.timeout(120000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return (await resp.json()) as any[];
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  return [];
}

async function main(): Promise<void> {
  await ensureEnrichmentTables();

  const maxRows = await getJson(`${BASE}?$select=max(tax_year)%20as%20maxyr`);
  const taxYear = Number(maxRows[0]?.maxyr);
  if (!Number.isFinite(taxYear)) throw new Error("could not determine latest NS tax_year");
  console.log(`Latest NS tax_year: ${taxYear}`);

  // Staging table for the aan→value pairs (session-local; dropped at the end).
  await db.execute(sql`CREATE TEMP TABLE ns_value_updates (aan text PRIMARY KEY, value bigint) ON COMMIT PRESERVE ROWS`);

  let offset = 0;
  let staged = 0;
  for (;;) {
    const where = encodeURIComponent(`tax_year=${taxYear}`);
    const rows = await getJson(
      `${BASE}?$select=aan,assessed_value&$where=${where}&$order=aan&$limit=${PAGE}&$offset=${offset}`,
    );
    if (!rows.length) break;

    const pairs = rows
      .map((r) => ({ aan: String(r.aan ?? "").trim(), value: Math.round(Number(r.assessed_value)) }))
      .filter((p) => p.aan && Number.isFinite(p.value) && p.value >= 0);
    // Dedupe within page (an aan can recur); last wins.
    const unique = [...new Map(pairs.map((p) => [p.aan, p])).values()];
    for (let i = 0; i < unique.length; i += 1000) {
      const chunk = unique.slice(i, i + 1000);
      await db.execute(sql`
        INSERT INTO ns_value_updates (aan, value)
        VALUES ${sql.join(chunk.map((p) => sql`(${p.aan}, ${p.value})`), sql`, `)}
        ON CONFLICT (aan) DO UPDATE SET value = EXCLUDED.value
      `);
    }
    staged += unique.length;
    offset += PAGE;
    if (offset % (PAGE * 2) === 0) console.log(`  staged ${staged} values...`);
    if (rows.length < PAGE) break;
  }
  console.log(`Staged ${staged} assessed values for tax_year ${taxYear}`);

  const res = await db.execute(sql`
    UPDATE assessment_units u
    SET total_value = v.value, imported_at = now()
    FROM ns_value_updates v
    WHERE u.source = ${NS_SOURCE} AND u.matricule = v.aan
      AND u.total_value IS DISTINCT FROM v.value
  `);
  await db.execute(sql`DROP TABLE IF EXISTS ns_value_updates`);

  const matched = await db.execute(sql`
    SELECT COUNT(*)::int AS n, COUNT(total_value)::int AS with_value
    FROM assessment_units WHERE source = ${NS_SOURCE}
  `);
  const m = matched.rows[0] as { n: number; with_value: number };
  console.log(`NS value enrichment done: ${m.with_value}/${m.n} NS units now have an assessed value (tax_year ${taxYear}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[ns-values] enrichment failed:", err);
  process.exit(1);
});
