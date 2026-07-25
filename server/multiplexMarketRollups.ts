/**
 * FSA-level rollups of what investors are actually underwriting.
 *
 * This is the compounding asset the platform was already sitting on and not
 * using: every multiplex underwrite records a real address, a real price the
 * investor is testing, and the model's verdict — but nothing aggregated it, so
 * the data had no second life beyond the one report that produced it.
 *
 * Rebuilt from source rather than accumulated incrementally. A corrected
 * underwrite, a changed assumption set, or a backfilled user link all show up on
 * the next rebuild instead of being permanently baked into a running total.
 *
 * Medians, not means, throughout — one investor testing a $12M assembly should
 * not move an FSA's typical price.
 */

import { sql } from "drizzle-orm";
import { db } from "./db";
import { multiplexMarketRollups } from "@shared/schema";

/** Rows with fewer than this many underwrites are not published. */
export const MIN_UNDERWRITES_PER_BUCKET = 3;

export interface RollupRebuildResult {
  bucketsConsidered: number;
  bucketsWritten: number;
  bucketsSuppressed: number;
  monthsCovered: number;
}

/**
 * Rebuild (FSA × month) buckets over a trailing window.
 *
 * Buckets below MIN_UNDERWRITES_PER_BUCKET are counted and skipped, not written.
 * An FSA with one underwrite is one person's opinion, and publishing it invites
 * reading a "market median" off a single data point — worse than showing nothing.
 * It also leaks: with one row per bucket, a median price plus an address-level
 * FSA is close to naming the deal someone screened.
 */
export async function rebuildMultiplexMarketRollups(
  opts: { monthsBack?: number } = {},
): Promise<RollupRebuildResult> {
  const monthsBack = opts.monthsBack ?? 13;

  // percentile_cont over jsonb extractions. Every path used here is written by
  // executeMultiplexUnderwriter on the success path, so a NULL means "older row
  // from before that field existed" and is skipped by the aggregate rather than
  // counted as a zero.
  const rows = await db.execute(sql`
    WITH source AS (
      SELECT
        postal_fsa,
        date_trunc('month', created_at) AS period_month,
        user_id,
        NULLIF((inputs_json->>'purchasePrice')::numeric, 0) AS purchase_price,
        (result_json->>'maxUnitsAsOfRight')::numeric          AS max_units,
        (result_json->'sixplex'->>'eligible')::boolean         AS sixplex_eligible,
        result_json->'recommendedTakeout'->>'takeout'          AS takeout,
        (
          SELECT MAX((cfg->'rentalHold'->>'yieldOnCost')::numeric)
          FROM jsonb_array_elements(result_json->'configs') AS cfg
          WHERE jsonb_typeof(result_json->'configs') = 'array'
        ) AS best_yield_on_cost
      FROM multiplex_underwritings
      WHERE postal_fsa IS NOT NULL
        AND result_json IS NOT NULL
        AND created_at >= date_trunc('month', now()) - (${monthsBack}::int * interval '1 month')
    )
    SELECT
      postal_fsa,
      period_month,
      COUNT(*)::int                                    AS underwrite_count,
      COUNT(DISTINCT user_id)::int                     AS distinct_user_count,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY purchase_price)      AS median_purchase_price,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY max_units)           AS median_max_units,
      AVG(CASE WHEN sixplex_eligible THEN 1.0 ELSE 0.0 END)            AS sixplex_eligible_rate,
      AVG(CASE WHEN takeout = 'hold' THEN 1.0 WHEN takeout IS NULL THEN NULL ELSE 0.0 END) AS hold_preference_rate,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY best_yield_on_cost)  AS median_yield_on_cost
    FROM source
    GROUP BY postal_fsa, period_month
    ORDER BY period_month DESC, underwrite_count DESC
  `);

  const buckets = rows.rows as Array<Record<string, unknown>>;
  const publishable = buckets.filter(
    b => Number(b.underwrite_count || 0) >= MIN_UNDERWRITES_PER_BUCKET,
  );

  const num = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  for (const b of publishable) {
    await db
      .insert(multiplexMarketRollups)
      .values({
        postalFsa: String(b.postal_fsa),
        periodMonth: new Date(b.period_month as string),
        underwriteCount: Number(b.underwrite_count || 0),
        distinctUserCount: Number(b.distinct_user_count || 0),
        medianPurchasePrice: num(b.median_purchase_price),
        medianMaxUnits: num(b.median_max_units),
        sixplexEligibleRate: num(b.sixplex_eligible_rate),
        holdPreferenceRate: num(b.hold_preference_rate),
        medianYieldOnCost: num(b.median_yield_on_cost),
        rebuiltAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [multiplexMarketRollups.postalFsa, multiplexMarketRollups.periodMonth],
        set: {
          underwriteCount: Number(b.underwrite_count || 0),
          distinctUserCount: Number(b.distinct_user_count || 0),
          medianPurchasePrice: num(b.median_purchase_price),
          medianMaxUnits: num(b.median_max_units),
          sixplexEligibleRate: num(b.sixplex_eligible_rate),
          holdPreferenceRate: num(b.hold_preference_rate),
          medianYieldOnCost: num(b.median_yield_on_cost),
          rebuiltAt: new Date(),
        },
      });
  }

  const months = new Set(publishable.map(b => String(b.period_month)));

  return {
    bucketsConsidered: buckets.length,
    bucketsWritten: publishable.length,
    bucketsSuppressed: buckets.length - publishable.length,
    monthsCovered: months.size,
  };
}

/** Published buckets for one FSA, most recent month first. */
export async function getFsaRollups(postalFsa: string, limit = 13) {
  return db
    .select()
    .from(multiplexMarketRollups)
    .where(sql`${multiplexMarketRollups.postalFsa} = ${postalFsa.toUpperCase()}`)
    .orderBy(sql`${multiplexMarketRollups.periodMonth} DESC`)
    .limit(limit);
}

/** Most-underwritten FSAs for a month — the live demand map. */
export async function getTopFsasForMonth(periodMonth: Date, limit = 25) {
  return db
    .select()
    .from(multiplexMarketRollups)
    .where(sql`${multiplexMarketRollups.periodMonth} = ${periodMonth}`)
    .orderBy(sql`${multiplexMarketRollups.underwriteCount} DESC`)
    .limit(limit);
}

/** Nightly at 04:15 Toronto / 09:15 UTC — after the inference rebuild. */
export function scheduleMultiplexRollupRebuild(): void {
  // Imported lazily so this module stays dependency-light for tests.
  import("node-cron").then(({ default: cron }) => {
    cron.schedule("15 9 * * *", () => {
      rebuildMultiplexMarketRollups()
        .then(r =>
          console.log(
            `[multiplex-rollups] rebuilt ${r.bucketsWritten} bucket(s) across ${r.monthsCovered} month(s), ` +
              `${r.bucketsSuppressed} suppressed below the ${MIN_UNDERWRITES_PER_BUCKET}-underwrite floor`,
          ),
        )
        .catch(err => console.error("[multiplex-rollups] rebuild error:", err));
    });
    console.log("[multiplex-rollups] Nightly rebuild scheduled (4:15am Toronto / 09:15 UTC)");
  }).catch(err => console.error("[multiplex-rollups] schedule error:", err));
}
