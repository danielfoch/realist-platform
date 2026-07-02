/**
 * Rent backtest runner — feeds production rent_listings history through the
 * pure harness in shared/rentBacktest.ts and records the results in the
 * model registry.
 *
 * This is the promotion gate: estimator v(N+1) ships only if its backtest
 * beats the incumbent's numbers stored in model_versions.metrics. The CMHC
 * static baseline is scored alongside as the floor every version must clear.
 *
 * POST /api/intelligence/backtest        run + record (admin/x-api-key)
 *   ?days=180        observation window
 *   ?max_per_city=200 held-out sample cap per city
 *   ?record=false    dry run without writing to the registry
 */

import type { Express } from "express";
import { and, eq, gte } from "drizzle-orm";
import { db } from "./db";
import { rentListings, modelVersions } from "@shared/schema";
import { runRentBacktest, type BacktestReport } from "@shared/rentBacktest";
import { RENT_ESTIMATOR_MODEL_KEY, RENT_ESTIMATOR_VERSION } from "@shared/rentEstimator";
import { requireIntelAdmin, resolveCmhcBaseline } from "./rentIntelligence";

const DEFAULT_WINDOW_DAYS = 180;
const MAX_OBSERVATIONS = 100_000;
/** Cities stored in the registry metrics — full report is returned live. */
const STORED_CITY_LIMIT = 25;

export async function runAndRecordBacktest(options: {
  days?: number;
  maxSamplesPerCity?: number;
  record?: boolean;
} = {}): Promise<BacktestReport & { observations: number; recorded: boolean }> {
  const days = options.days ?? DEFAULT_WINDOW_DAYS;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const observations = await db
    .select({
      externalId: rentListings.externalId,
      rent: rentListings.rent,
      bedrooms: rentListings.bedrooms,
      city: rentListings.city,
      province: rentListings.province,
      lat: rentListings.lat,
      lng: rentListings.lng,
      scrapedAt: rentListings.scrapedAt,
    })
    .from(rentListings)
    .where(gte(rentListings.scrapedAt, since))
    .limit(MAX_OBSERVATIONS);

  const report = runRentBacktest(observations, {
    maxSamplesPerCity: options.maxSamplesPerCity,
    cmhcBaselineResolver: resolveCmhcBaseline,
  });

  let recorded = false;
  if (options.record !== false && report.samples > 0) {
    const stored = {
      backtest: {
        at: new Date().toISOString(),
        windowDays: days,
        observations: observations.length,
        samples: report.samples,
        skipped: report.skipped,
        overall: report.overall,
        byMethod: report.byMethod,
        baseline: report.baseline,
        byCity: report.byCity.slice(0, STORED_CITY_LIMIT),
      },
    };
    const updated = await db.update(modelVersions)
      .set({ metrics: stored })
      .where(and(
        eq(modelVersions.modelKey, RENT_ESTIMATOR_MODEL_KEY),
        eq(modelVersions.version, RENT_ESTIMATOR_VERSION),
      ))
      .returning({ id: modelVersions.id });
    recorded = updated.length > 0;
  }

  return { ...report, observations: observations.length, recorded };
}

export function registerRentBacktestRoutes(app: Express): void {
  app.post("/api/intelligence/backtest", requireIntelAdmin, async (req, res) => {
    try {
      const days = req.query.days ? Number(req.query.days) : undefined;
      const maxPerCity = req.query.max_per_city ? Number(req.query.max_per_city) : undefined;
      const record = req.query.record !== "false";
      if ((days !== undefined && !(days > 0 && days <= 730)) ||
          (maxPerCity !== undefined && !(maxPerCity > 0 && maxPerCity <= 5000))) {
        return res.status(400).json({ success: false, error: "Invalid days or max_per_city" });
      }
      const result = await runAndRecordBacktest({ days, maxSamplesPerCity: maxPerCity, record });
      res.json({ success: true, modelKey: RENT_ESTIMATOR_MODEL_KEY, modelVersion: RENT_ESTIMATOR_VERSION, ...result });
    } catch (error) {
      console.error("[intelligence] backtest failed:", error);
      res.status(500).json({ success: false, error: "Backtest failed" });
    }
  });
}
