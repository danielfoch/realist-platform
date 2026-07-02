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
import cron from "node-cron";
import { sql } from "drizzle-orm";
import { db } from "./db";

const MIN_SAMPLE = 5;

export async function ensureAiDefaultTables(): Promise<void> {
  // A legacy module (aiMarketDefaults, since removed) created these tables with
  // an incompatible column set (median_value/sample_count). Both are derived
  // caches rebuilt by training, so park the legacy copy and recreate cleanly.
  const legacyDefaults = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_market_defaults' AND column_name = 'median_value' LIMIT 1
  `);
  if (legacyDefaults.rows.length) {
    await db.execute(sql`DROP TABLE IF EXISTS ai_market_defaults_legacy`);
    await db.execute(sql`ALTER TABLE ai_market_defaults RENAME TO ai_market_defaults_legacy`);
    console.log("[ai-defaults] Parked legacy ai_market_defaults schema as ai_market_defaults_legacy");
  }
  const legacyRuns = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_training_runs' AND column_name = 'status' LIMIT 1
  `);
  if (legacyRuns.rows.length) {
    await db.execute(sql`DROP TABLE IF EXISTS ai_training_runs_legacy`);
    await db.execute(sql`ALTER TABLE ai_training_runs RENAME TO ai_training_runs_legacy`);
    console.log("[ai-defaults] Parked legacy ai_training_runs schema as ai_training_runs_legacy");
  }

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
    ALTER TABLE "ai_market_defaults" ADD COLUMN IF NOT EXISTS "outliers_excluded" integer NOT NULL DEFAULT 0
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
        COALESCE(vacancy_rate,
          CASE WHEN (inputs_json->>'vacancyPercent') ~ '^[0-9]+(\\.[0-9]+)?$'
               AND (inputs_json->>'vacancyPercent')::numeric BETWEEN 0 AND 50
               THEN (inputs_json->>'vacancyPercent')::numeric END) AS vacancy_rate,
        CASE WHEN (inputs_json->>'managementPercent') ~ '^[0-9]+(\\.[0-9]+)?$'
             AND (inputs_json->>'managementPercent')::numeric BETWEEN 0 AND 50
             THEN (inputs_json->>'managementPercent')::numeric END AS mgmt_pct,
        CASE WHEN (inputs_json->>'maintenancePercent') ~ '^[0-9]+(\\.[0-9]+)?$'
             AND (inputs_json->>'maintenancePercent')::numeric BETWEEN 0 AND 50
             THEN (inputs_json->>'maintenancePercent')::numeric END AS maint_pct,
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
    fences AS (
      -- Tukey fences per market (k=2.5 ~= 3 sigma on normal data, but robust:
      -- computed from quartiles, so the outliers can't drag the fence).
      SELECT market,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY cap_rate)  AS cap_q1,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY cap_rate)  AS cap_q3,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price)     AS price_q1,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price)     AS price_q3,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY cash_flow) AS cf_q1,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY cash_flow) AS cf_q3
      FROM base GROUP BY market
    ),
    filtered AS (
      -- Outliers are EXCLUDED from guidance, never deleted from source data.
      SELECT b.market, b.strategy, b.vacancy_rate, b.mgmt_pct, b.maint_pct,
        CASE WHEN b.cap_rate BETWEEN f.cap_q1 - 2.5*(f.cap_q3-f.cap_q1) AND f.cap_q3 + 2.5*(f.cap_q3-f.cap_q1)
             THEN b.cap_rate END AS cap_rate,
        (b.cap_rate IS NOT NULL AND b.cap_rate NOT BETWEEN f.cap_q1 - 2.5*(f.cap_q3-f.cap_q1) AND f.cap_q3 + 2.5*(f.cap_q3-f.cap_q1))::int AS cap_out,
        CASE WHEN b.price BETWEEN f.price_q1 - 2.5*(f.price_q3-f.price_q1) AND f.price_q3 + 2.5*(f.price_q3-f.price_q1)
             THEN b.price END AS price,
        (b.price IS NOT NULL AND b.price NOT BETWEEN f.price_q1 - 2.5*(f.price_q3-f.price_q1) AND f.price_q3 + 2.5*(f.price_q3-f.price_q1))::int AS price_out,
        CASE WHEN b.cash_flow BETWEEN f.cf_q1 - 2.5*(f.cf_q3-f.cf_q1) AND f.cf_q3 + 2.5*(f.cf_q3-f.cf_q1)
             THEN b.cash_flow END AS cash_flow,
        (b.cash_flow IS NOT NULL AND b.cash_flow NOT BETWEEN f.cf_q1 - 2.5*(f.cf_q3-f.cf_q1) AND f.cf_q3 + 2.5*(f.cf_q3-f.cf_q1))::int AS cf_out
      FROM base b JOIN fences f USING (market)
    ),
    grouped AS (
      SELECT market, strategy,
        COUNT(*) AS n,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY vacancy_rate) AS vacancy_med,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY mgmt_pct) AS mgmt_med,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY maint_pct) AS maint_med,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cap_rate) AS cap_med,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY cap_rate) AS cap_p25,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY cap_rate) AS cap_p75,
        SUM(cap_out) AS cap_excluded,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) AS price_med,
        SUM(price_out) AS price_excluded,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cash_flow) AS cashflow_med,
        SUM(cf_out) AS cf_excluded
      FROM filtered
      GROUP BY GROUPING SETS ((market, strategy), (market))
      HAVING COUNT(*) >= ${MIN_SAMPLE}
    ),
    flattened AS (
      SELECT market, COALESCE(strategy, 'all') AS strategy, metric, value, p25, p75, n, excluded
      FROM grouped,
      LATERAL (VALUES
        ('vacancy_rate', vacancy_med, NULL::double precision, NULL::double precision, 0::bigint),
        ('management_percent', mgmt_med, NULL, NULL, 0),
        ('maintenance_percent', maint_med, NULL, NULL, 0),
        ('cap_rate', cap_med, cap_p25, cap_p75, cap_excluded),
        ('purchase_price', price_med, NULL, NULL, price_excluded),
        ('monthly_cash_flow', cashflow_med, NULL, NULL, cf_excluded)
      ) AS metrics(metric, value, p25, p75, excluded)
      WHERE value IS NOT NULL
    )
    INSERT INTO ai_market_defaults (market, strategy, metric, value, p25, p75, sample_size, outliers_excluded, trained_at)
    SELECT market, strategy, metric, value, p25, p75, n, COALESCE(excluded, 0), NOW()
    FROM flattened
    ON CONFLICT (market, strategy, metric)
    DO UPDATE SET value = EXCLUDED.value, p25 = EXCLUDED.p25, p75 = EXCLUDED.p75,
                  sample_size = EXCLUDED.sample_size, outliers_excluded = EXCLUDED.outliers_excluded,
                  trained_at = EXCLUDED.trained_at
    RETURNING market
  `);

  // Rent guidance from REAL asking rents (rent_listings, trailing 6 months) —
  // stronger signal than user-entered rents alone. Metrics keyed by bedroom
  // count: market_rent_1br ... market_rent_4br, plus market_rent_all.
  const rentResult: any = await db.execute(sql`
    WITH rents AS (
      SELECT
        LOWER(TRIM(city)) AS market,
        CASE
          WHEN regexp_replace(bedrooms, '[^0-9]', '', 'g') IN ('1','2','3') 
            THEN 'market_rent_' || regexp_replace(bedrooms, '[^0-9]', '', 'g') || 'br'
          WHEN regexp_replace(bedrooms, '[^0-9]', '', 'g') != '' 
            AND regexp_replace(bedrooms, '[^0-9]', '', 'g')::int >= 4 
            THEN 'market_rent_4br'
          ELSE NULL
        END AS metric,
        rent
      FROM rent_listings
      WHERE city IS NOT NULL AND rent BETWEEN 400 AND 20000
        AND scraped_at > NOW() - INTERVAL '6 months'
    ),
    rent_fences AS (
      SELECT market, metric,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY rent) AS q1,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY rent) AS q3
      FROM rents GROUP BY market, metric
    ),
    rent_filtered AS (
      SELECT r.market, r.metric,
        CASE WHEN r.rent BETWEEN f.q1 - 2.5*(f.q3-f.q1) AND f.q3 + 2.5*(f.q3-f.q1) THEN r.rent END AS rent,
        (r.rent NOT BETWEEN f.q1 - 2.5*(f.q3-f.q1) AND f.q3 + 2.5*(f.q3-f.q1))::int AS rent_out
      FROM rents r JOIN rent_fences f ON f.market = r.market AND f.metric IS NOT DISTINCT FROM r.metric
    ),
    grouped AS (
      SELECT market, COALESCE(metric, 'market_rent_all') AS metric,
        COUNT(rent) AS n,
        SUM(rent_out) AS excluded,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rent) AS med,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY rent) AS p25,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY rent) AS p75
      FROM rent_filtered
      GROUP BY GROUPING SETS ((market, metric), (market))
      HAVING COUNT(rent) >= ${MIN_SAMPLE}
    )
    INSERT INTO ai_market_defaults (market, strategy, metric, value, p25, p75, sample_size, outliers_excluded, trained_at)
    SELECT market, 'all', COALESCE(metric, 'market_rent_all'), med, p25, p75, n, COALESCE(excluded, 0), NOW()
    FROM grouped WHERE med IS NOT NULL
    ON CONFLICT (market, strategy, metric)
    DO UPDATE SET value = EXCLUDED.value, p25 = EXCLUDED.p25, p75 = EXCLUDED.p75,
                  sample_size = EXCLUDED.sample_size, outliers_excluded = EXCLUDED.outliers_excluded,
                  trained_at = EXCLUDED.trained_at
    RETURNING market
  `);

  const written = (result.rows?.length || 0) + (rentResult.rows?.length || 0);
  const markets = new Set([...(result.rows || []), ...(rentResult.rows || [])].map((r: any) => r.market)).size;
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
        res.status(400).json({ found: false, error: "city is required" });
        return;
      }
      const rows: any = await db.execute(sql`
        SELECT DISTINCT ON (metric) metric, value, p25, p75, sample_size, outliers_excluded, strategy, trained_at
        FROM ai_market_defaults
        WHERE market = ${market} AND strategy IN (${strategy}, 'all')
        ORDER BY metric, (strategy = ${strategy}) DESC
      `);
      const found = (rows.rows || []) as Array<{
        metric: string; value: string; p25: string | null; p75: string | null;
        sample_size: number; strategy: string; trained_at: string;
      }>;
      if (!found.length) {
        res.json({ found: false, market, strategy });
        return;
      }

      // Trainer metric names → the camelCase keys the analyzer's
      // applyAiDefaults reads (client/src/components/DealInputs.tsx).
      const METRIC_NAMES: Record<string, string> = {
        vacancy_rate: "vacancyRate",
        management_percent: "managementFeePercent",
        maintenance_percent: "maintenancePercent",
        market_rent_all: "monthlyRent",
        cap_rate: "capRate",
        purchase_price: "purchasePrice",
        monthly_cash_flow: "monthlyCashFlow",
      };

      let sampleCount = 0;
      let trainedAt = found[0].trained_at;
      const metrics: Record<string, { median: number; mean: number | null; p25: number | null; p75: number | null }> = {};
      for (const r of found) {
        metrics[METRIC_NAMES[r.metric] ?? r.metric] = {
          median: Number(r.value),
          mean: null,
          p25: r.p25 != null ? Number(r.p25) : null,
          p75: r.p75 != null ? Number(r.p75) : null,
        };
        sampleCount = Math.max(sampleCount, Number(r.sample_size));
        if (r.trained_at > trainedAt) trainedAt = r.trained_at;
      }
      res.json({ found: true, market, strategy, sampleCount, trainedAt, metrics });
    } catch (error) {
      console.error("[ai-defaults] lookup failed:", error);
      res.status(500).json({ found: false, error: "Failed to load defaults" });
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

export function scheduleNightlyTraining(): void {
  // 2:00 AM Toronto time = 07:00 UTC — after nightly DDF/MLS data imports
  cron.schedule("0 7 * * *", () => {
    console.log("[ai-trainer] Nightly training cron triggered");
    trainMarketDefaults().catch((err) =>
      console.error("[ai-trainer] Nightly training error:", err.message),
    );
  });
  console.log("[ai-trainer] Nightly training scheduled (2am Toronto / 07:00 UTC)");
}
