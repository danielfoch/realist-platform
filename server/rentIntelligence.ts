/**
 * Realist Intelligence — rent estimation service + prediction ledger.
 *
 * Wraps the pure estimator in shared/rentEstimator.ts with data access:
 * fetches comp candidates from rent_listings, city aggregates from
 * rent_pulse, and the CMHC static baseline, then logs every estimate to
 * model_predictions so the nightly resolution sweep can score it against
 * later-scraped observations. Accuracy is queryable per model version —
 * this is the eval loop the rent model retrains against.
 *
 * Auth follows the deal-desk pattern: admin session, or x-api-key matching
 * REALIST_INTEL_API_KEY (falls back to DEAL_DESK_API_KEY so no new secret
 * is required for cron callers).
 */

import type { Express, Request, Response, NextFunction } from "express";
import "express-session";
import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import {
  users,
  rentListings,
  rentPulse,
  modelVersions,
  modelPredictions,
} from "@shared/schema";
import {
  estimateRent,
  normalizeBedroomBand,
  haversineKm,
  RENT_ESTIMATOR_MODEL_KEY,
  RENT_ESTIMATOR_VERSION,
  MAX_COMP_AGE_DAYS,
  type RentEstimate,
  type RentComp,
  type CmhcBaseline,
} from "@shared/rentEstimator";
import { CMHC_CITY_RENTS, CMHC_PROVINCIAL_RENTS } from "@shared/cmhcRents";

/** Bounding box half-width for the comp query, ~10 km in degrees latitude. */
const COMP_QUERY_BOX_DEG = 0.09;
/** A prediction resolves when this many later observations match it. */
const MIN_RESOLUTION_OBS = 3;
/** Observations must be within this distance of the subject to resolve it. */
const RESOLUTION_RADIUS_KM = 0.75;
/** Stop trying to resolve predictions older than this. */
const RESOLUTION_MAX_AGE_DAYS = 120;
const SWEEP_BATCH_SIZE = 200;

/**
 * Model key for the market-defaults prior system (user-assumption medians).
 * The module that logged these predictions (aiMarketDefaults) was removed in
 * favour of aiDefaults.ts; the key stays so the resolution sweep can still
 * score any legacy model_predictions rows written under it.
 */
export const MARKET_DEFAULTS_MODEL_KEY = "market_defaults";
export const MARKET_DEFAULTS_VERSION = "v1.0.0";

function intelApiKey(): string | undefined {
  return process.env.REALIST_INTEL_API_KEY || process.env.DEAL_DESK_API_KEY;
}

export async function requireIntelAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const apiKey = req.headers["x-api-key"] || req.query.api_key;
    const configuredKey = intelApiKey();
    if (configuredKey && apiKey === configuredKey) {
      next();
      return;
    }
    if (!req.session?.userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }
    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, req.session.userId)).limit(1);
    if (!user || user.role !== "admin") {
      res.status(403).json({ success: false, error: "Admin access required" });
      return;
    }
    next();
  } catch (error) {
    console.error("[intelligence] admin auth check failed:", error);
    res.status(500).json({ success: false, error: "Failed to verify admin status" });
  }
}

export function resolveCmhcBaseline(
  city: string | null | undefined,
  province: string | null | undefined,
  bedrooms: number | string,
): CmhcBaseline | null {
  const band = normalizeBedroomBand(bedrooms);
  if (!band) return null;
  const pick = (entry: { bachelor: number; oneBed: number; twoBed: number; threeBed: number }): number => {
    if (band === "0") return entry.bachelor;
    if (band === "1") return entry.oneBed;
    if (band === "2") return entry.twoBed;
    return entry.threeBed;
  };
  const cityEntry = city ? CMHC_CITY_RENTS[city] : undefined;
  if (cityEntry) return { rent: pick(cityEntry), source: "cmhc_city" };
  const provEntry = province ? CMHC_PROVINCIAL_RENTS[province] : undefined;
  if (provEntry) return { rent: pick(provEntry), source: "cmhc_province" };
  return null;
}

export interface RentEstimateParams {
  bedrooms: number | string;
  city?: string | null;
  province?: string | null;
  lat?: number | null;
  lng?: number | null;
  units?: number;
  subjectType?: "listing" | "analysis" | "adhoc";
  subjectId?: string | null;
  userId?: string | null;
  /** Skip the prediction-ledger write (e.g. backtests resolving their own). */
  persist?: boolean;
}

/**
 * Produce a rent estimate for a subject and (by default) log it to the
 * prediction ledger. Returns null when bedrooms are unparseable or no data
 * source covers the subject's market.
 */
export async function getRentEstimate(params: RentEstimateParams): Promise<RentEstimate | null> {
  const { bedrooms, city, province, lat, lng, units } = params;
  const since = new Date(Date.now() - MAX_COMP_AGE_DAYS * 24 * 60 * 60 * 1000);
  const hasGeo = lat != null && lng != null;

  const locationFilters = [];
  if (hasGeo) {
    const lngBox = COMP_QUERY_BOX_DEG / Math.max(0.2, Math.cos((lat! * Math.PI) / 180));
    locationFilters.push(
      and(
        gte(rentListings.lat, lat! - COMP_QUERY_BOX_DEG),
        sql`${rentListings.lat} <= ${lat! + COMP_QUERY_BOX_DEG}`,
        gte(rentListings.lng, lng! - lngBox),
        sql`${rentListings.lng} <= ${lng! + lngBox}`,
      ),
    );
  }
  if (city) {
    locationFilters.push(sql`LOWER(${rentListings.city}) = ${city.toLowerCase()}`);
  }
  if (locationFilters.length === 0 && !city) {
    // Nothing to match comps against; fall straight through to CMHC.
    const estimate = estimateRent(
      { bedrooms, city, province, lat, lng, units },
      { cmhcBaseline: resolveCmhcBaseline(city, province, bedrooms) },
    );
    if (estimate && params.persist !== false) await recordPrediction(params, estimate);
    return estimate;
  }

  const compRows = await db
    .select({
      rent: rentListings.rent,
      bedrooms: rentListings.bedrooms,
      city: rentListings.city,
      lat: rentListings.lat,
      lng: rentListings.lng,
      scrapedAt: rentListings.scrapedAt,
    })
    .from(rentListings)
    .where(and(
      gte(rentListings.scrapedAt, since),
      locationFilters.length === 1 ? locationFilters[0] : sql`(${sql.join(locationFilters.map(f => sql`(${f})`), sql` OR `)})`,
    ))
    .limit(2000);

  const aggregateRows = city
    ? await db
        .select({
          bedrooms: rentPulse.bedrooms,
          medianRent: rentPulse.medianRent,
          sampleSize: rentPulse.sampleSize,
          scrapedAt: rentPulse.scrapedAt,
        })
        .from(rentPulse)
        .where(and(
          sql`LOWER(${rentPulse.city}) = ${city.toLowerCase()}`,
          ...(province ? [sql`LOWER(${rentPulse.province}) = ${province.toLowerCase()}`] : []),
        ))
        .orderBy(sql`${rentPulse.scrapedAt} DESC`)
        .limit(50)
    : [];

  const estimate = estimateRent(
    { bedrooms, city, province, lat, lng, units },
    {
      comps: compRows as RentComp[],
      cityAggregates: aggregateRows,
      cmhcBaseline: resolveCmhcBaseline(city, province, bedrooms),
    },
  );

  if (estimate && params.persist !== false) {
    await recordPrediction(params, estimate);
  }
  return estimate;
}

async function recordPrediction(params: RentEstimateParams, estimate: RentEstimate): Promise<void> {
  try {
    await db.insert(modelPredictions).values({
      modelKey: estimate.modelKey,
      modelVersion: estimate.modelVersion,
      subjectType: params.subjectType ?? "adhoc",
      subjectId: params.subjectId ?? null,
      userId: params.userId ?? null,
      inputs: {
        bedrooms: params.bedrooms,
        city: params.city ?? null,
        province: params.province ?? null,
        lat: params.lat ?? null,
        lng: params.lng ?? null,
        units: estimate.units,
        method: estimate.method,
        radiusKm: estimate.radiusKm,
        compCount: estimate.compCount,
      },
      predictedValue: estimate.monthlyRent,
      intervalLow: estimate.rangeLow,
      intervalHigh: estimate.rangeHigh,
      confidence: estimate.confidence,
      method: estimate.method,
      compCount: estimate.compCount,
      city: params.city ?? null,
      province: params.province ?? null,
      bedrooms: estimate.bedroomBand,
      lat: params.lat ?? null,
      lng: params.lng ?? null,
    });
  } catch (error) {
    // Ledger writes must never break the estimate path.
    console.error("[intelligence] failed to record prediction:", error);
  }
}

/** Register the active estimator version in the model registry (idempotent). */
export async function ensureModelVersionRegistered(): Promise<void> {
  try {
    await db.insert(modelVersions).values({
      modelKey: RENT_ESTIMATOR_MODEL_KEY,
      version: RENT_ESTIMATOR_VERSION,
      description: "Deterministic comp-based rent estimator: distance/recency-weighted percentiles over scraped rent_listings, rent_pulse + CMHC fallbacks.",
      params: {
        minComps: 5,
        radiusTiersKm: [2, 5, 10],
        recencyHalfLifeDays: 90,
        maxCompAgeDays: MAX_COMP_AGE_DAYS,
      },
    }).onConflictDoNothing();
  } catch (error) {
    console.error("[intelligence] failed to register model version:", error);
  }
}

/**
 * Nightly resolution sweep: match unresolved rent predictions to rent
 * observations scraped after the prediction was made (same bedroom band,
 * within RESOLUTION_RADIUS_KM when geo-located, else same city). The median
 * of matching observations becomes the prediction's actual value.
 *
 * market_defaults predictions (city-level user-assumption priors, bedrooms
 * NULL) resolve against the mixed-bedroom city median — measuring the gap
 * between what users assume rents are and what the market actually asks.
 */
export async function runPredictionResolutionSweep(): Promise<{ examined: number; resolved: number }> {
  const oldest = new Date(Date.now() - RESOLUTION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  const unresolved = await db
    .select()
    .from(modelPredictions)
    .where(and(
      inArray(modelPredictions.modelKey, [RENT_ESTIMATOR_MODEL_KEY, MARKET_DEFAULTS_MODEL_KEY]),
      isNull(modelPredictions.resolvedAt),
      gte(modelPredictions.createdAt, oldest),
    ))
    .limit(SWEEP_BATCH_SIZE);

  let resolved = 0;
  for (const prediction of unresolved) {
    // Null band = market-level prediction; matches observations of any size.
    const band = prediction.bedrooms;
    const hasGeo = prediction.lat != null && prediction.lng != null;
    if (!hasGeo && !prediction.city) continue;

    const locationFilter = hasGeo
      ? and(
          gte(rentListings.lat, prediction.lat! - COMP_QUERY_BOX_DEG),
          sql`${rentListings.lat} <= ${prediction.lat! + COMP_QUERY_BOX_DEG}`,
        )
      : sql`LOWER(${rentListings.city}) = ${prediction.city!.toLowerCase()}`;

    const candidates = await db
      .select({
        rent: rentListings.rent,
        bedrooms: rentListings.bedrooms,
        lat: rentListings.lat,
        lng: rentListings.lng,
      })
      .from(rentListings)
      .where(and(gte(rentListings.scrapedAt, prediction.createdAt), locationFilter))
      .limit(1000);

    const matches = candidates.filter((c) => {
      if (band && normalizeBedroomBand(c.bedrooms) !== band) return false;
      if (c.rent < 400 || c.rent > 20000) return false;
      if (hasGeo) {
        if (c.lat == null || c.lng == null) return false;
        return haversineKm(prediction.lat!, prediction.lng!, c.lat, c.lng) <= RESOLUTION_RADIUS_KM;
      }
      return true;
    });

    if (matches.length < MIN_RESOLUTION_OBS) continue;

    const rents = matches.map((m) => m.rent).sort((a, b) => a - b);
    const mid = Math.floor(rents.length / 2);
    const perUnitActual = rents.length % 2 !== 0 ? rents[mid] : (rents[mid - 1] + rents[mid]) / 2;
    // Predictions store total rent (units × per-unit); observations are per-unit.
    const units = (prediction.inputs as Record<string, unknown> | null)?.units;
    const actual = perUnitActual * (typeof units === "number" && units > 0 ? units : 1);
    const absError = Math.abs(prediction.predictedValue - actual);

    await db.update(modelPredictions)
      .set({
        resolvedAt: new Date(),
        actualValue: actual,
        actualSource: `rent_listings_median_of_${matches.length}`,
        absError,
        pctError: actual > 0 ? (absError / actual) * 100 : null,
      })
      .where(eq(modelPredictions.id, prediction.id));
    resolved++;
  }

  return { examined: unresolved.length, resolved };
}

const rentEstimateQuerySchema = z.object({
  bedrooms: z.string().min(1),
  city: z.string().optional(),
  province: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  units: z.coerce.number().int().min(1).max(100).optional(),
  listingKey: z.string().optional(),
  analysisId: z.string().optional(),
});

export function registerRentIntelligenceRoutes(app: Express): void {
  app.get("/api/intelligence/rent-estimate", async (req, res) => {
    try {
      const parsed = rentEstimateQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: "Invalid query", details: parsed.error.errors });
      }
      const q = parsed.data;
      if (!q.city && (q.lat == null || q.lng == null)) {
        return res.status(400).json({ success: false, error: "Provide a city or lat/lng" });
      }
      const estimate = await getRentEstimate({
        bedrooms: q.bedrooms,
        city: q.city ?? null,
        province: q.province ?? null,
        lat: q.lat ?? null,
        lng: q.lng ?? null,
        units: q.units,
        subjectType: q.listingKey ? "listing" : q.analysisId ? "analysis" : "adhoc",
        subjectId: q.listingKey ?? q.analysisId ?? null,
        userId: req.session?.userId ?? null,
      });
      if (!estimate) {
        return res.json({ success: true, estimate: null, reason: "no_data_for_market" });
      }
      res.json({ success: true, estimate });
    } catch (error) {
      console.error("[intelligence] rent estimate failed:", error);
      res.status(500).json({ success: false, error: "Failed to estimate rent" });
    }
  });

  app.post("/api/intelligence/sweep", requireIntelAdmin, async (_req, res) => {
    try {
      const result = await runPredictionResolutionSweep();
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("[intelligence] resolution sweep failed:", error);
      res.status(500).json({ success: false, error: "Sweep failed" });
    }
  });

  app.get("/api/intelligence/accuracy", requireIntelAdmin, async (_req, res) => {
    try {
      const [rows, registry] = await Promise.all([
        db.execute(sql`
          SELECT
            model_key,
            model_version,
            method,
            COUNT(*)::int AS predictions,
            COUNT(resolved_at)::int AS resolved,
            ROUND(AVG(abs_error) FILTER (WHERE resolved_at IS NOT NULL)::numeric, 0) AS avg_abs_error,
            ROUND(AVG(pct_error) FILTER (WHERE resolved_at IS NOT NULL)::numeric, 1) AS mape,
            ROUND((COUNT(*) FILTER (
              WHERE resolved_at IS NOT NULL
                AND actual_value BETWEEN interval_low AND interval_high
            )::numeric / NULLIF(COUNT(resolved_at), 0)) * 100, 1) AS interval_coverage_pct
          FROM model_predictions
          GROUP BY model_key, model_version, method
          ORDER BY model_key, model_version DESC, predictions DESC
        `),
        db.select().from(modelVersions).orderBy(sql`${modelVersions.createdAt} DESC`),
      ]);
      res.json({ success: true, registry, accuracy: rows.rows });
    } catch (error) {
      console.error("[intelligence] accuracy report failed:", error);
      res.status(500).json({ success: false, error: "Failed to compute accuracy" });
    }
  });
}

/** Daily resolution sweep, registered alongside the other interval jobs. */
export function scheduleRentIntelligenceJobs(log: (msg: string, tag?: string) => void): void {
  void ensureModelVersionRegistered();
  const sweep = async () => {
    try {
      const { examined, resolved } = await runPredictionResolutionSweep();
      if (examined > 0) {
        log(`Prediction sweep: examined=${examined}, resolved=${resolved}`, "intelligence");
      }
    } catch (err: any) {
      log(`Prediction sweep error: ${err.message}`, "intelligence");
    }
  };
  // First run shortly after boot, then daily.
  setTimeout(sweep, 5 * 60 * 1000);
  setInterval(sweep, 24 * 60 * 60 * 1000);
}
