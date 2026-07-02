/**
 * Rent estimator backtest harness — leave-one-out temporal replay.
 *
 * For each held-out observation, the estimator predicts its rent using only
 * observations scraped strictly BEFORE it (same city), then the prediction
 * is scored against the observation's actual rent. This is the promotion
 * gate for every future estimator version: a candidate ships only if it
 * beats the incumbent here.
 *
 * Pure module — callers load observations and pass them in, so the same
 * harness runs against prod data (server/rentBacktestRunner.ts), fixtures
 * in tests, and future point-in-time snapshots.
 *
 * Point-in-time caveat: scrapedAt is refreshed while a listing stays
 * active, so "earlier-scraped" reflects last-seen time, not first-seen.
 * That makes comps slightly *fresher* than a true as-of replay — biasing
 * measured error slightly optimistic, equally for all versions compared.
 */

import {
  estimateRent,
  normalizeBedroomBand,
  MIN_SANE_RENT,
  MAX_SANE_RENT,
  type RentComp,
  type CmhcBaseline,
  type RentEstimateMethod,
} from "./rentEstimator";

export interface BacktestObservation extends RentComp {
  externalId?: string | null;
  province?: string | null;
}

export interface BacktestOptions {
  /** Cap held-out samples per city (evenly spaced, deterministic). */
  maxSamplesPerCity?: number;
  /** Resolves the static CMHC fallback for a subject — also scored standalone as the comparator baseline. */
  cmhcBaselineResolver?: (
    city: string | null,
    province: string | null,
    bedrooms: string | number,
  ) => CmhcBaseline | null;
  /** Return per-sample detail rows (tests, debugging, error analysis). */
  includeDetails?: boolean;
}

export interface BacktestSampleDetail {
  city: string;
  actual: number;
  predicted: number;
  ape: number;
  method: RentEstimateMethod;
  compCount: number;
  scrapedAt: string;
}

export interface ErrorStats {
  samples: number;
  /** Mean absolute percentage error, percent. */
  mape: number;
  /** Median absolute percentage error, percent. */
  medianApe: number;
  meanAbsError: number;
  /** Share of actuals inside [rangeLow, rangeHigh], percent. */
  intervalCoverage: number;
}

export interface CityBacktestStats extends ErrorStats {
  city: string;
  province: string | null;
}

export interface BacktestReport {
  samples: number;
  skipped: number;
  overall: ErrorStats;
  byMethod: Partial<Record<RentEstimateMethod, ErrorStats>>;
  byCity: CityBacktestStats[];
  /** CMHC static baseline scored on the same held-out samples it covers. */
  baseline: Omit<ErrorStats, "intervalCoverage" | "meanAbsError"> | null;
  /** Present only when options.includeDetails is set. */
  details?: BacktestSampleDetail[];
}

interface Sample {
  ape: number;
  absError: number;
  intervalHit: boolean;
  method: RentEstimateMethod;
  city: string;
  province: string | null;
}

const DEFAULT_MAX_SAMPLES_PER_CITY = 200;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function summarize(samples: Array<Pick<Sample, "ape" | "absError" | "intervalHit">>): ErrorStats {
  const apes = samples.map((s) => s.ape).sort((a, b) => a - b);
  const mid = Math.floor(apes.length / 2);
  const medianApe = apes.length % 2 !== 0 ? apes[mid] : (apes[mid - 1] + apes[mid]) / 2;
  return {
    samples: samples.length,
    mape: round1((apes.reduce((sum, a) => sum + a, 0) / apes.length) * 100),
    medianApe: round1(medianApe * 100),
    meanAbsError: Math.round(samples.reduce((sum, s) => sum + s.absError, 0) / samples.length),
    intervalCoverage: round1((samples.filter((s) => s.intervalHit).length / samples.length) * 100),
  };
}

function scrapedAtMs(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/** Evenly spaced deterministic sample of indices [0, n). */
function sampleIndices(n: number, max: number): number[] {
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const step = n / max;
  const indices: number[] = [];
  for (let i = 0; i < max; i++) indices.push(Math.floor(i * step));
  return indices;
}

/**
 * Run the leave-one-out backtest. Observations may span many cities; comps
 * for each held-out observation are drawn from its own city only (mirroring
 * the production comp query, which is city/geo-bounded).
 */
export function runRentBacktest(
  observations: BacktestObservation[],
  options: BacktestOptions = {},
): BacktestReport {
  const maxPerCity = options.maxSamplesPerCity ?? DEFAULT_MAX_SAMPLES_PER_CITY;

  const byCity = new Map<string, BacktestObservation[]>();
  for (const obs of observations) {
    const city = obs.city?.trim().toLowerCase();
    if (!city) continue;
    if (!byCity.has(city)) byCity.set(city, []);
    byCity.get(city)!.push(obs);
  }

  const samples: Sample[] = [];
  const baselineSamples: Array<Pick<Sample, "ape" | "absError" | "intervalHit">> = [];
  const details: BacktestSampleDetail[] = [];
  let skipped = 0;

  for (const group of byCity.values()) {
    group.sort((a, b) => scrapedAtMs(a.scrapedAt) - scrapedAtMs(b.scrapedAt));

    const candidates = group.filter(
      (o) =>
        normalizeBedroomBand(o.bedrooms) !== null &&
        o.rent >= MIN_SANE_RENT &&
        o.rent <= MAX_SANE_RENT,
    );

    for (const idx of sampleIndices(candidates.length, maxPerCity)) {
      const heldOut = candidates[idx];
      const cutoff = scrapedAtMs(heldOut.scrapedAt);
      const comps = group.filter(
        (o) =>
          o !== heldOut &&
          scrapedAtMs(o.scrapedAt) < cutoff &&
          (!heldOut.externalId || o.externalId !== heldOut.externalId),
      );

      const cmhcBaseline =
        options.cmhcBaselineResolver?.(heldOut.city ?? null, heldOut.province ?? null, heldOut.bedrooms as string | number) ?? null;

      const estimate = estimateRent(
        {
          bedrooms: heldOut.bedrooms as string | number,
          city: heldOut.city,
          province: heldOut.province,
          lat: heldOut.lat,
          lng: heldOut.lng,
        },
        { comps, cmhcBaseline, now: new Date(cutoff) },
      );

      if (!estimate) {
        skipped++;
        continue;
      }

      const absError = Math.abs(estimate.monthlyRent - heldOut.rent);
      samples.push({
        ape: absError / heldOut.rent,
        absError,
        intervalHit: heldOut.rent >= estimate.rangeLow && heldOut.rent <= estimate.rangeHigh,
        method: estimate.method,
        city: heldOut.city!.trim(),
        province: heldOut.province ?? null,
      });
      if (options.includeDetails) {
        details.push({
          city: heldOut.city!.trim(),
          actual: heldOut.rent,
          predicted: estimate.monthlyRent,
          ape: round1((absError / heldOut.rent) * 100),
          method: estimate.method,
          compCount: estimate.compCount,
          scrapedAt: new Date(cutoff).toISOString(),
        });
      }

      if (cmhcBaseline && cmhcBaseline.rent > 0) {
        const baseAbs = Math.abs(cmhcBaseline.rent - heldOut.rent);
        baselineSamples.push({ ape: baseAbs / heldOut.rent, absError: baseAbs, intervalHit: false });
      }
    }
  }

  if (samples.length === 0) {
    return { samples: 0, skipped, overall: { samples: 0, mape: 0, medianApe: 0, meanAbsError: 0, intervalCoverage: 0 }, byMethod: {}, byCity: [], baseline: null };
  }

  const byMethod: BacktestReport["byMethod"] = {};
  for (const method of new Set(samples.map((s) => s.method))) {
    byMethod[method] = summarize(samples.filter((s) => s.method === method));
  }

  const cityKeys = new Map<string, Sample[]>();
  for (const s of samples) {
    const key = s.city.toLowerCase();
    if (!cityKeys.has(key)) cityKeys.set(key, []);
    cityKeys.get(key)!.push(s);
  }
  const byCityStats: CityBacktestStats[] = Array.from(cityKeys.values())
    .map((group) => ({
      city: group[0].city,
      province: group[0].province,
      ...summarize(group),
    }))
    .sort((a, b) => b.samples - a.samples);

  const baseline =
    baselineSamples.length > 0
      ? (({ samples: n, mape, medianApe }) => ({ samples: n, mape, medianApe }))(summarize(baselineSamples))
      : null;

  return {
    samples: samples.length,
    skipped,
    overall: summarize(samples),
    byMethod,
    byCity: byCityStats,
    baseline,
    ...(options.includeDetails ? { details } : {}),
  };
}
