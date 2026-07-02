/**
 * AI market defaults: nightly aggregation of user underwriting inputs
 * into learned market priors (median cap rates, vacancy, rents, expenses)
 * by city + strategy.
 *
 * Two self-migrating tables:
 *   ai_market_defaults  — one row per (market, strategy, metric), upserted nightly
 *   ai_training_runs    — audit log of every training run
 *
 * Routes:
 *   GET  /api/ai/defaults?city=Toronto&strategy=rental  → learned priors for market
 *   POST /api/ai/train                                   → admin-only manual trigger
 *   GET  /api/ai/training-stats                         → public social proof stats
 */

import cron from "node-cron";
import { db } from "./db";
import { and, eq, sql } from "drizzle-orm";
import type { Express } from "express";
import { modelVersions, modelPredictions } from "@shared/schema";
import {
  requireIntelAdmin,
  MARKET_DEFAULTS_MODEL_KEY,
  MARKET_DEFAULTS_VERSION,
} from "./rentIntelligence";

// ---------------------------------------------------------------------------
// Self-migrating tables
// ---------------------------------------------------------------------------

async function ensureTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_market_defaults (
      id           varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      market       text NOT NULL,
      strategy     text NOT NULL,
      metric       text NOT NULL,
      median_value numeric NOT NULL,
      mean_value   numeric,
      p25          numeric,
      p75          numeric,
      sample_count integer NOT NULL,
      trained_at   timestamp NOT NULL DEFAULT now(),
      lookback_months integer NOT NULL DEFAULT 18,
      CONSTRAINT ai_market_defaults_market_strategy_metric_uq
        UNIQUE (market, strategy, metric)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_training_runs (
      id                  varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      started_at          timestamp NOT NULL DEFAULT now(),
      completed_at        timestamp,
      analyses_processed  integer,
      markets_updated     integer,
      status              text NOT NULL DEFAULT 'running'
    )
  `);
}

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

/**
 * Aggregates finalAssumptions + calculatedMetrics from property_analyses
 * over the last 18 months into ai_market_defaults.
 *
 * Uses PERCENTILE_CONT(0.5) (median) so outliers from bad inputs don't skew
 * the learned priors used as defaults.
 */
export async function trainMarketDefaults(): Promise<{ analysesProcessed: number; marketsUpdated: number }> {
  const runResult = await db.execute(sql`
    INSERT INTO ai_training_runs (status) VALUES ('running') RETURNING id
  `);
  const runId = (runResult.rows[0] as { id: string }).id;

  try {
    // One query does all metric + assumption aggregation via CROSS JOIN LATERAL
    // across a hard-coded list of metric names. Postgres does the heavy lifting.
    await db.execute(sql`
      INSERT INTO ai_market_defaults
        (market, strategy, metric, median_value, mean_value, p25, p75, sample_count, trained_at, lookback_months)
      SELECT
        LOWER(TRIM(city))           AS market,
        LOWER(TRIM(strategy_type))  AS strategy,
        m.metric_name               AS metric,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY m.val) AS median_value,
        AVG(m.val)                  AS mean_value,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY m.val) AS p25,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY m.val) AS p75,
        COUNT(*)::integer           AS sample_count,
        now()                       AS trained_at,
        18                          AS lookback_months
      FROM property_analyses
      CROSS JOIN LATERAL (
        VALUES
          -- calculatedMetrics fields
          ('capRate',           (calculated_metrics->>'capRate')::numeric),
          ('cashOnCash',        (calculated_metrics->>'cashOnCash')::numeric),
          ('dscr',              (calculated_metrics->>'dscr')::numeric),
          ('monthlyCashFlow',   (calculated_metrics->>'monthlyCashFlow')::numeric),
          -- finalAssumptions fields (user inputs)
          ('vacancyPercent',    (final_assumptions->>'vacancyPercent')::numeric),
          ('vacancyRate',       (final_assumptions->>'vacancyRate')::numeric),
          ('monthlyRent',       (final_assumptions->>'monthlyRent')::numeric),
          ('grossMonthlyRent',  (final_assumptions->>'grossMonthlyRent')::numeric),
          ('managementFeePercent', (final_assumptions->>'managementFeePercent')::numeric),
          ('maintenancePercent',   (final_assumptions->>'maintenancePercent')::numeric),
          ('propertyTaxMonthly',   (final_assumptions->>'propertyTaxMonthly')::numeric),
          ('insuranceMonthly',     (final_assumptions->>'insuranceMonthly')::numeric)
      ) AS m(metric_name, val)
      WHERE is_deleted = false
        AND city IS NOT NULL AND city != ''
        AND strategy_type IS NOT NULL AND strategy_type != ''
        AND created_at >= now() - interval '18 months'
        AND m.val IS NOT NULL
        AND m.val BETWEEN -100 AND 100000
      GROUP BY 1, 2, 3
      HAVING COUNT(*) >= 3
      ON CONFLICT (market, strategy, metric) DO UPDATE SET
        median_value    = EXCLUDED.median_value,
        mean_value      = EXCLUDED.mean_value,
        p25             = EXCLUDED.p25,
        p75             = EXCLUDED.p75,
        sample_count    = EXCLUDED.sample_count,
        trained_at      = now()
    `);

    const countResult = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM ai_market_defaults
    `);
    const marketsUpdated = Number((countResult.rows[0] as { cnt: string }).cnt ?? 0);

    const analysesResult = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM property_analyses
      WHERE is_deleted = false AND (calculated_metrics IS NOT NULL OR final_assumptions IS NOT NULL)
        AND created_at >= now() - interval '18 months'
    `);
    const analysesProcessed = Number((analysesResult.rows[0] as { cnt: string }).cnt ?? 0);

    await db.execute(sql`
      UPDATE ai_training_runs
      SET completed_at = now(), status = 'completed',
          analyses_processed = ${analysesProcessed}, markets_updated = ${marketsUpdated}
      WHERE id = ${runId}
    `);

    await recordTrainingInLedger(analysesProcessed, marketsUpdated);

    console.log(`[ai-train] Completed: ${analysesProcessed} analyses, ${marketsUpdated} defaults upserted`);
    return { analysesProcessed, marketsUpdated };
  } catch (err: any) {
    await db.execute(sql`
      UPDATE ai_training_runs SET status = 'failed', completed_at = now() WHERE id = ${runId}
    `);
    console.error("[ai-train] Training failed:", err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Intelligence-ledger integration
//
// market_defaults is a model like any other: registered in model_versions,
// its rent priors logged to model_predictions so the nightly resolution
// sweep can score user assumptions against scraped market reality (the
// "assumption gap" per city).
// ---------------------------------------------------------------------------

export async function ensureMarketDefaultsRegistered(): Promise<void> {
  try {
    await db.insert(modelVersions).values({
      modelKey: MARKET_DEFAULTS_MODEL_KEY,
      version: MARKET_DEFAULTS_VERSION,
      description: "User-assumption priors: nightly PERCENTILE_CONT medians of property_analyses finalAssumptions/calculatedMetrics per city + strategy (18-month lookback, min sample 3).",
      params: { lookbackMonths: 18, minSample: 3, aggregation: "median" },
    }).onConflictDoNothing();
  } catch (err: any) {
    console.error("[ai-train] Failed to register model version:", err.message);
  }
}

async function recordTrainingInLedger(analysesProcessed: number, marketsUpdated: number): Promise<void> {
  try {
    await db.update(modelVersions)
      .set({ metrics: { analysesProcessed, marketsUpdated, trainedAt: new Date().toISOString() } })
      .where(and(
        eq(modelVersions.modelKey, MARKET_DEFAULTS_MODEL_KEY),
        eq(modelVersions.version, MARKET_DEFAULTS_VERSION),
      ));

    // Log the monthly-rent prior per market as a prediction. bedrooms stays
    // NULL (city-level, mixed sizes); the sweep resolves it against the
    // mixed-bedroom city median of scraped observations.
    const priors = await db.execute(sql`
      SELECT market, strategy, median_value, p25, p75, sample_count
      FROM ai_market_defaults
      WHERE metric = 'monthlyRent'
    `);
    const rows = (priors.rows as Array<{
      market: string;
      strategy: string;
      median_value: string;
      p25: string | null;
      p75: string | null;
      sample_count: string;
    }>).map((r) => ({
      modelKey: MARKET_DEFAULTS_MODEL_KEY,
      modelVersion: MARKET_DEFAULTS_VERSION,
      subjectType: "market",
      subjectId: `${r.market}:${r.strategy}`,
      inputs: { market: r.market, strategy: r.strategy, metric: "monthlyRent", sampleCount: Number(r.sample_count) },
      predictedValue: Number(r.median_value),
      intervalLow: r.p25 != null ? Number(r.p25) : null,
      intervalHigh: r.p75 != null ? Number(r.p75) : null,
      confidence: Number(r.sample_count) >= 30 ? "medium" : "low",
      method: "user_prior_median",
      compCount: Number(r.sample_count),
      city: r.market,
      province: null,
      bedrooms: null,
    })).filter((r) => Number.isFinite(r.predictedValue) && r.predictedValue > 0);

    if (rows.length > 0) {
      await db.insert(modelPredictions).values(rows);
    }
  } catch (err: any) {
    // Ledger bookkeeping must never fail a training run.
    console.error("[ai-train] Ledger recording failed:", err.message);
  }
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export interface MarketDefaults {
  market: string;
  strategy: string;
  sampleCount: number;
  trainedAt: string;
  metrics: Record<string, { median: number; mean: number | null; p25: number | null; p75: number | null }>;
}

export async function getMarketDefaults(city: string, strategy: string): Promise<MarketDefaults | null> {
  const market = city.trim().toLowerCase();
  const strat = strategy.trim().toLowerCase();

  const result = await db.execute(sql`
    SELECT metric, median_value, mean_value, p25, p75, sample_count, trained_at
    FROM ai_market_defaults
    WHERE market = ${market} AND strategy = ${strat}
    ORDER BY metric
  `);

  const rows = result.rows as Array<{
    metric: string;
    median_value: string;
    mean_value: string | null;
    p25: string | null;
    p75: string | null;
    sample_count: string;
    trained_at: string;
  }>;

  if (!rows.length) return null;

  const maxSamples = Math.max(...rows.map(r => Number(r.sample_count)));
  const latestTrainedAt = rows.reduce((max, r) =>
    r.trained_at > max ? r.trained_at : max, rows[0].trained_at);

  const metrics: MarketDefaults["metrics"] = {};
  for (const row of rows) {
    metrics[row.metric] = {
      median: Number(row.median_value),
      mean: row.mean_value != null ? Number(row.mean_value) : null,
      p25: row.p25 != null ? Number(row.p25) : null,
      p75: row.p75 != null ? Number(row.p75) : null,
    };
  }

  return { market, strategy: strat, sampleCount: maxSamples, trainedAt: latestTrainedAt, metrics };
}

export async function getTrainingStats(): Promise<{ totalAnalyses: number; marketsWithDefaults: number; lastRunAt: string | null }> {
  const marketsResult = await db.execute(sql`
    SELECT COUNT(DISTINCT (market || ':' || strategy))::integer AS markets FROM ai_market_defaults
  `);
  const lastRunResult = await db.execute(sql`
    SELECT completed_at FROM ai_training_runs WHERE status = 'completed'
    ORDER BY completed_at DESC LIMIT 1
  `);
  const analysesResult = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM property_analyses WHERE is_deleted = false AND calculated_metrics IS NOT NULL
  `);

  return {
    totalAnalyses: Number((analysesResult.rows[0] as { cnt: string } | undefined)?.cnt ?? 0),
    marketsWithDefaults: Number((marketsResult.rows[0] as { markets: string } | undefined)?.markets ?? 0),
    lastRunAt: (lastRunResult.rows[0] as { completed_at: string | null } | undefined)?.completed_at ?? null,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerAiDefaultsRoutes(app: Express): void {
  ensureTables()
    .then(() => ensureMarketDefaultsRegistered())
    .catch((err) =>
      console.error("[ai-market-defaults] Failed to ensure tables:", err.message)
    );

  // Public — used by the deal analyzer to pre-fill inputs
  app.get("/api/ai/defaults", async (req, res) => {
    try {
      const city = String(req.query.city || "").trim();
      const strategy = String(req.query.strategy || "rental").trim();
      if (!city) return res.status(400).json({ error: "city is required" });

      const defaults = await getMarketDefaults(city, strategy);
      if (!defaults) return res.json({ found: false, city, strategy });
      res.json({ found: true, ...defaults });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin-only: trigger a training run manually. Sessions never store a
  // role (auth.ts only writes userId), so the old req.session.role check
  // rejected everyone — requireIntelAdmin looks the role up from the users
  // table and also accepts the intelligence x-api-key for cron callers.
  app.post("/api/ai/train", requireIntelAdmin, async (_req, res) => {
    try {
      const result = await trainMarketDefaults();
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public training stats for "trained on N analyses" social proof
  app.get("/api/ai/training-stats", async (_req, res) => {
    try {
      const stats = await getTrainingStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

export function scheduleNightlyTraining(): void {
  // 2:00 AM Toronto time = 07:00 UTC — after nightly DDF/MLS data imports
  cron.schedule("0 7 * * *", () => {
    console.log("[ai-train] Nightly training cron triggered");
    trainMarketDefaults().catch((err) =>
      console.error("[ai-train] Nightly training error:", err.message)
    );
  });
  console.log("[ai-train] Nightly training scheduled (2am Toronto / 07:00 UTC)");
}
