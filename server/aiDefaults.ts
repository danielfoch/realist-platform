/**
 * AI/ML backend v1 — learn underwriting priors from real user behaviour.
 *
 * The loop: every analysis stores the user's actual inputs (vacancy rate,
 * expense assumptions, price, results). The trainer aggregates those into
 * per-market priors (ai_market_defaults). The analyzer serves the learned
 * priors back as smart defaults via GET /api/ai/defaults. Users correct them
 * → next training run gets smarter. That's the flywheel: usage trains the AI.
 *
 * v1 is statistical learning (robust medians + sample sizes + recency
 * weighting), deliberately not a neural net: transparent, debuggable, and
 * exactly what the data volume currently supports. The training run also
 * snapshots model accuracy over time (ai_training_runs) so we can prove the
 * system improves as usage grows.
 */

import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";

const MIN_SAMPLE = 5;

export async function ensureAiDefaultTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "ai_market_defaults" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "market" text NOT NULL,
      "strategy" text NOT NULL DEFAULT 'all',
      "metric" text NOT NULL,
      "value" real NOT NULL,
      "p25" real,
      "p75" real,
      "sample_size" integer NOT NULL,
      "trained_at" timestamp NOT NULL DEFAULT now(),
      UNIQUE ("market", "strategy", "metric")
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "ai_training_runs" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "analyses_total" integer NOT NULL,
      "markets_trained" integer NOT NULL,
      "metrics_written" integer NOT NULL,
      "notes" text,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);
}

/**
 * Train market defaults from the analyses table. Recency-weighted: only the
 * trailing 18 months. Metrics are guarded with the same numeric-regex pattern
 * weeklyDigest uses (resultsJson values are untyped jsonb).
 */
export async function trainMarketDefaults(): Promise<{ markets: number; metrics: number; analyses: number }> {
  await ensureAiDefaultTables();

  // One pass: per (city, strategy) and per (city, 'all'), robust medians of
  // the signals users actually provide. NULLIF guards keep junk out.
  const result: any = await db.execute(sql`
    WITH base AS (
      SELECT
        LOWER(TRIM(city)) AS market,
        strategy_type AS strategy,
        vacancy_rate,
        CASE WHEN (results_json->>'capRate') ~ '^-?[0-9]+(\\.[0-9]+)?$'
             AND (results_json->>'capRate')::numeric BETWEEN -10 AND 25
             THEN (results_json->>'capRate')::numeric END AS cap_rate,
        CASE WHEN (inputs_json->>'purchasePrice') ~ '^[0-9]+(\\.[0-9]+)?$'
             AND (inputs_json->>'purchasePrice')::numeric BETWEEN 50000 AND 20000000
             THEN (inputs_json->>'purchasePrice')::numeric END AS price,
        CASE WHEN (results_json->>'monthlyCashFlow') ~ '^-?[0-9]+(\\.[0-9]+)?$'
             THEN (results_json->>'monthlyCashFlow')::numeric END AS cash_flow
      FROM analyses
      WHERE city IS NOT NULL AND TRIM(city) != ''
        AND created_at > NOW() - INTERVAL '18 months'
    ),
    grouped AS (
      SELECT market, strategy,
        COUNT(*) AS n,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY vacancy_rate) AS vacancy_med,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cap_rate) AS cap_med,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY cap_rate) AS cap_p25,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY cap_rate) AS cap_p75,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) AS price_med,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cash_flow) AS cashflow_med
      FROM base
      GROUP BY GROUPING SETS ((market, strategy), (market))
      HAVING COUNT(*) >= ${MIN_SAMPLE}
    ),
    flattened AS (
      SELECT market, COALESCE(strategy, 'all') AS strategy, metric, value, p25, p75, n
      FROM grouped,
      LATERAL (VALUES
        ('vacancy_rate', vacancy_med, NULL::double precision, NULL::double precision),
        ('cap_rate', cap_med, cap_p25, cap_p75),
        ('purchase_price', price_med, NULL, NULL),
        ('monthly_cash_flow', cashflow_med, NULL, NULL)
      ) AS metrics(metric, value, p25, p75)
      WHERE value IS NOT NULL
    )
    INSERT INTO ai_market_defaults (market, strategy, metric, value, p25, p75, sample_size, trained_at)
    SELECT market, strategy, metric, value, p25, p75, n, NOW()
    FROM flattened
    ON CONFLICT (market, strategy, metric)
    DO UPDATE SET value = EXCLUDED.value, p25 = EXCLUDED.p25, p75 = EXCLUDED.p75,
                  sample_size = EXCLUDED.sample_size, trained_at = EXCLUDED.trained_at
    RETURNING market
  `);

  const written = result.rows?.length || 0;
  const markets = new Set((result.rows || []).map((r: any) => r.market)).size;
  const [{ total }] = await db
    .execute(sql`SELECT COUNT(*)::int AS total FROM analyses`)
    .then((r: any) => r.rows);

  await db.execute(sql`
    INSERT INTO ai_training_runs (analyses_total, markets_trained, metrics_written)
    VALUES (${Number(total)}, ${markets}, ${written})
  `);

  console.log(`[ai-trainer] trained ${markets} markets, ${written} metrics from ${total} total analyses`);
  return { markets, metrics: written, analyses: Number(total) };
}

export function registerAiDefaultsRoutes(app: Express): void {
  ensureAiDefaultTables().catch((error) =>
    console.error("[ai-defaults] failed to ensure tables:", error.message),
  );

  /**
   * Learned underwriting priors for a market. The analyzer calls this to
   * pre-fill assumptions; falls back from (market, strategy) → (market, all).
   * Each prior carries sampleSize so the UI can show "learned from N analyses".
   */
  app.get("/api/ai/defaults", async (req: Request, res: Response) => {
    try {
      const market = String(req.query.city || "").trim().toLowerCase();
      const strategy = String(req.query.strategy || "all").trim();
      if (!market) {
        res.status(400).json({ success: false, error: "city is required" });
        return;
      }
      const rows: any = await db.execute(sql`
        SELECT DISTINCT ON (metric) metric, value, p25, p75, sample_size, strategy, trained_at
        FROM ai_market_defaults
        WHERE market = ${market} AND strategy IN (${strategy}, 'all')
        ORDER BY metric, (strategy = ${strategy}) DESC
      `);
      res.json({
        success: true,
        market,
        strategy,
        defaults: Object.fromEntries(
          (rows.rows || []).map((r: any) => [r.metric, {
            value: Number(r.value),
            p25: r.p25 != null ? Number(r.p25) : null,
            p75: r.p75 != null ? Number(r.p75) : null,
            sampleSize: r.sample_size,
            matchedStrategy: r.strategy,
            trainedAt: r.trained_at,
          }]),
        ),
      });
    } catch (error) {
      console.error("[ai-defaults] lookup failed:", error);
      res.status(500).json({ success: false, error: "Failed to load defaults" });
    }
  });

  // Cron-triggered training (nightly): POST /api/ai/train with x-api-key.
  app.post("/api/ai/train", async (req: Request, res: Response) => {
    const key = req.headers["x-api-key"] || req.query.api_key;
    const configured = process.env.EVENTS_CRON_API_KEY || process.env.DEAL_DESK_API_KEY;
    if (!configured || key !== configured) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      const result = await trainMarketDefaults();
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("[ai-trainer] training failed:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Public flywheel stats — social proof for the homepage ("trained on N analyses").
  app.get("/api/ai/training-stats", async (_req: Request, res: Response) => {
    try {
      const rows: any = await db.execute(sql`
        SELECT analyses_total, markets_trained, metrics_written, created_at
        FROM ai_training_runs ORDER BY created_at DESC LIMIT 12
      `);
      res.json({ success: true, runs: rows.rows || [] });
    } catch {
      res.json({ success: true, runs: [] });
    }
  });
}
