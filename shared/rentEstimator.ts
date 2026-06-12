/**
 * Rent Estimator v0 — deterministic comp-based rent estimation with
 * confidence intervals.
 *
 * Pure module: callers (server/rentIntelligence.ts) fetch candidate comps
 * and aggregates from the DB and pass them in, so the estimation logic is
 * fully unit-testable and the same code can later run inside a backtest
 * harness against point-in-time snapshots.
 *
 * Estimation ladder, best data wins:
 *   1. comps_radius   — ≥MIN_COMPS geo-located scraped rent observations in
 *                       the same bedroom band within a 2/5/10 km radius,
 *                       distance- and recency-weighted percentile estimate
 *   2. city_comps     — same, but matched by city when geo is unavailable
 *   3. city_aggregate — rent_pulse median for the city + bedroom band
 *   4. cmhc_baseline  — CMHC published averages (caller-resolved)
 */

export const RENT_ESTIMATOR_MODEL_KEY = "rent_estimator";
export const RENT_ESTIMATOR_VERSION = "v0.1.0";

/** Comp observations older than this are ignored entirely. */
export const MAX_COMP_AGE_DAYS = 180;
/** Minimum same-band comps required to use a comps-based method. */
export const MIN_COMPS = 5;
/** Radius tiers tried smallest-first when the subject has coordinates. */
export const RADIUS_TIERS_KM = [2, 5, 10] as const;
/** Recency half-life: a 90-day-old comp counts half as much as today's. */
const RECENCY_HALF_LIFE_DAYS = 90;
/** Sanity bounds — observations outside these are scraper garbage. */
export const MIN_SANE_RENT = 400;
export const MAX_SANE_RENT = 20000;

export type BedroomBand = "0" | "1" | "2" | "3" | "4+";

export type RentEstimateMethod =
  | "comps_radius"
  | "city_comps"
  | "city_aggregate"
  | "cmhc_baseline";

export type RentEstimateConfidence = "high" | "medium" | "low";

export interface RentSubject {
  bedrooms: number | string;
  city?: string | null;
  province?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** Total rentable units; the returned estimate is units × per-unit rent. */
  units?: number;
}

export interface RentComp {
  rent: number;
  bedrooms: string | number | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  scrapedAt: Date | string;
}

export interface CityRentAggregate {
  bedrooms: string;
  medianRent: number;
  sampleSize: number;
  scrapedAt: Date | string;
}

export interface CmhcBaseline {
  /** Per-unit monthly rent for the subject's bedroom band. */
  rent: number;
  /** e.g. "cmhc_city" | "cmhc_province" */
  source: string;
}

export interface RentEstimateData {
  comps?: RentComp[];
  cityAggregates?: CityRentAggregate[];
  cmhcBaseline?: CmhcBaseline | null;
  /** Injectable clock for tests and backtests. */
  now?: Date;
}

export interface RentEstimate {
  monthlyRent: number;
  rangeLow: number;
  rangeHigh: number;
  method: RentEstimateMethod;
  confidence: RentEstimateConfidence;
  compCount: number;
  radiusKm: number | null;
  bedroomBand: BedroomBand;
  units: number;
  modelKey: string;
  modelVersion: string;
}

/**
 * Collapse a raw bedroom value ("2", "2.5", 3, "Bachelor", "4+") into the
 * band used to match comps. Returns null when unparseable.
 */
export function normalizeBedroomBand(value: number | string | null | undefined): BedroomBand | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "") return null;
    if (trimmed === "bachelor" || trimmed === "studio") return "0";
    const match = trimmed.match(/^(\d+)/);
    if (!match) return null;
    value = parseInt(match[1], 10);
  }
  if (!Number.isFinite(value) || value < 0) return null;
  if (value >= 4) return "4+";
  return String(Math.floor(value)) as BedroomBand;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface WeightedComp {
  rent: number;
  weight: number;
  distanceKm: number | null;
}

function ageDays(scrapedAt: Date | string, now: Date): number {
  const t = scrapedAt instanceof Date ? scrapedAt.getTime() : new Date(scrapedAt).getTime();
  return (now.getTime() - t) / (24 * 60 * 60 * 1000);
}

function recencyWeight(days: number): number {
  return Math.pow(0.5, Math.max(0, days) / RECENCY_HALF_LIFE_DAYS);
}

/** Weighted percentile over comps sorted by rent (linear cumulative-weight). */
function weightedPercentile(comps: WeightedComp[], p: number): number {
  const sorted = [...comps].sort((a, b) => a.rent - b.rent);
  const totalWeight = sorted.reduce((sum, c) => sum + c.weight, 0);
  const target = totalWeight * p;
  let cumulative = 0;
  for (const comp of sorted) {
    cumulative += comp.weight;
    if (cumulative >= target) return comp.rent;
  }
  return sorted[sorted.length - 1].rent;
}

function compsConfidence(count: number, spread: number): RentEstimateConfidence {
  if (count >= 15 && spread <= 0.25) return "high";
  if (count < 8 || spread > 0.45) return "low";
  return "medium";
}

function buildResult(
  perUnitRent: number,
  perUnitLow: number,
  perUnitHigh: number,
  method: RentEstimateMethod,
  confidence: RentEstimateConfidence,
  compCount: number,
  radiusKm: number | null,
  band: BedroomBand,
  units: number,
): RentEstimate {
  return {
    monthlyRent: Math.round(perUnitRent * units),
    rangeLow: Math.round(perUnitLow * units),
    rangeHigh: Math.round(perUnitHigh * units),
    method,
    confidence,
    compCount,
    radiusKm,
    bedroomBand: band,
    units,
    modelKey: RENT_ESTIMATOR_MODEL_KEY,
    modelVersion: RENT_ESTIMATOR_VERSION,
  };
}

/**
 * Estimate monthly rent for a subject property from scraped comps, falling
 * back to city aggregates and the CMHC baseline. Returns null only when the
 * bedroom band is unparseable or no data source at all is available.
 */
export function estimateRent(subject: RentSubject, data: RentEstimateData): RentEstimate | null {
  const band = normalizeBedroomBand(subject.bedrooms);
  if (!band) return null;
  const units = subject.units && subject.units > 0 ? Math.floor(subject.units) : 1;
  const now = data.now ?? new Date();
  const subjectCity = subject.city?.trim().toLowerCase() || null;
  const hasGeo = subject.lat != null && subject.lng != null;

  const usable: Array<WeightedComp & { city: string | null }> = [];
  for (const comp of data.comps ?? []) {
    if (normalizeBedroomBand(comp.bedrooms) !== band) continue;
    if (!(comp.rent >= MIN_SANE_RENT && comp.rent <= MAX_SANE_RENT)) continue;
    const days = ageDays(comp.scrapedAt, now);
    if (days > MAX_COMP_AGE_DAYS || days < 0) continue;
    const distanceKm =
      hasGeo && comp.lat != null && comp.lng != null
        ? haversineKm(subject.lat!, subject.lng!, comp.lat, comp.lng)
        : null;
    usable.push({
      rent: comp.rent,
      distanceKm,
      weight: recencyWeight(days) * (distanceKm != null ? 1 / (1 + distanceKm) : 1),
      city: comp.city?.trim().toLowerCase() || null,
    });
  }

  // 1. Geo radius tiers, smallest radius with enough comps wins
  if (hasGeo) {
    for (const radius of RADIUS_TIERS_KM) {
      const within = usable.filter((c) => c.distanceKm != null && c.distanceKm <= radius);
      if (within.length >= MIN_COMPS) {
        const p50 = weightedPercentile(within, 0.5);
        const p25 = weightedPercentile(within, 0.25);
        const p75 = weightedPercentile(within, 0.75);
        const spread = p50 > 0 ? (p75 - p25) / p50 : 1;
        return buildResult(
          p50, p25, p75,
          "comps_radius",
          compsConfidence(within.length, spread),
          within.length, radius, band, units,
        );
      }
    }
  }

  // 2. City-matched comps (no usable geo cluster)
  if (subjectCity) {
    const inCity = usable.filter((c) => c.city === subjectCity);
    if (inCity.length >= MIN_COMPS) {
      const p50 = weightedPercentile(inCity, 0.5);
      const p25 = weightedPercentile(inCity, 0.25);
      const p75 = weightedPercentile(inCity, 0.75);
      const spread = p50 > 0 ? (p75 - p25) / p50 : 1;
      return buildResult(
        p50, p25, p75,
        "city_comps",
        compsConfidence(inCity.length, spread),
        inCity.length, null, band, units,
      );
    }
  }

  // 3. City aggregate (rent_pulse): latest aggregate for the band
  const aggregates = (data.cityAggregates ?? [])
    .filter((a) => normalizeBedroomBand(a.bedrooms) === band && a.medianRent > 0)
    .sort((a, b) => ageDays(a.scrapedAt, now) - ageDays(b.scrapedAt, now));
  if (aggregates.length > 0) {
    const agg = aggregates[0];
    const aggAge = ageDays(agg.scrapedAt, now);
    const confidence: RentEstimateConfidence =
      agg.sampleSize >= 30 && aggAge <= 120 ? "medium" : "low";
    return buildResult(
      agg.medianRent,
      agg.medianRent * 0.85,
      agg.medianRent * 1.15,
      "city_aggregate",
      confidence,
      agg.sampleSize, null, band, units,
    );
  }

  // 4. CMHC baseline
  if (data.cmhcBaseline && data.cmhcBaseline.rent > 0) {
    return buildResult(
      data.cmhcBaseline.rent,
      data.cmhcBaseline.rent * 0.8,
      data.cmhcBaseline.rent * 1.2,
      "cmhc_baseline",
      "low",
      0, null, band, units,
    );
  }

  return null;
}
