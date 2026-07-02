/**
 * Watchlist + saved-search alert logic (pure, shared).
 *
 * Used by server/watchlists.ts (the hourly alert sweep) and unit-tested in
 * shared/watchlistAlerts.test.ts. Keep this file free of DB / IO imports.
 *
 * Data-freshness reality this logic is designed around (be honest with users):
 *  - US listings (us_listings) are re-upserted by the ingest endpoint and have
 *    real append-only price history (us_listing_price_history), so US price
 *    changes are detected within one ingest cycle.
 *  - Canadian (CREA DDF) listings only land in ddf_listing_snapshots when the
 *    yield crawler runs (roughly monthly). Live map results come per-request
 *    and are not persisted per-listing. CA price-change detection therefore
 *    runs on crawler cadence, not daily — alerts fire when a NEW snapshot
 *    disagrees with the price the user watched, which is real but slow.
 */

export type WatchAlertFrequency = "daily" | "weekly";

/** Criteria captured when a user saves a search from the Cap Rates map. */
export interface SavedSearchCriteria {
  /** Free-text map query ("6 plex edmonton"), carried into the CTA deep link. */
  query?: string;
  city?: string;
  /** CA province or US state (name or two-letter code, matched loosely). */
  province?: string;
  propertyType?: string;
  /** Minimum cap rate in percent. Listings with UNKNOWN cap rate do not match. */
  minCap?: number;
  minPrice?: number;
  maxPrice?: number;
  country?: "CA" | "US";
}

/** Normalized listing summary the matcher runs against (CA snapshot or US row). */
export interface CandidateListing {
  /** Stable listing key: DDF listingKey / MLS number, or us_listings sourceId. */
  key: string;
  country: "CA" | "US";
  address?: string | null;
  city?: string | null;
  province?: string | null;
  propertyType?: string | null;
  price?: number | null;
  /** Cap rate (CA: netYield, falling back to grossYield). null = unknown. */
  capRate?: number | null;
}

export interface PriceChange {
  previousPrice: number;
  currentPrice: number;
  changeAmount: number;
  /** Percent of the previous price, positive for increases. */
  changePercent: number;
  direction: "drop" | "increase";
}

/**
 * Noise floor, matching the thresholds server/notifications.ts already uses:
 * suppress only when the move is below BOTH the absolute and percent floors.
 */
export const PRICE_CHANGE_MIN_ABS = 5000;
export const PRICE_CHANGE_MIN_PERCENT = 1.5;

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Detect a material list-price change between the price a user last saw and
 * the current price. Returns null for missing prices, no change, or changes
 * below the noise floor.
 */
export function detectPriceChange(
  previousPrice: number | null | undefined,
  currentPrice: number | null | undefined,
): PriceChange | null {
  if (!isPositiveFinite(previousPrice) || !isPositiveFinite(currentPrice)) return null;
  if (previousPrice === currentPrice) return null;

  const changeAmount = currentPrice - previousPrice;
  const absAmount = Math.abs(changeAmount);
  const changePercent = Number(((changeAmount / previousPrice) * 100).toFixed(2));
  if (absAmount < PRICE_CHANGE_MIN_ABS && Math.abs(changePercent) < PRICE_CHANGE_MIN_PERCENT) {
    return null;
  }

  return {
    previousPrice,
    currentPrice,
    changeAmount,
    changePercent,
    direction: changeAmount < 0 ? "drop" : "increase",
  };
}

function norm(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

/** Loose bidirectional containment ("duplex" matches "Duplex/Triplex" and vice versa). */
function looseMatch(a: string, b: string): boolean {
  return a.includes(b) || b.includes(a);
}

/**
 * Does a listing match a saved search's criteria?
 *
 * Honest-matching rules: when a criterion is set but the listing's value is
 * UNKNOWN, the listing does NOT match. We only alert on facts we hold — a
 * listing with no price never matches a maxPrice search, and a listing with
 * no computed cap rate never matches a minCap search.
 */
export function matchesSearchCriteria(
  criteria: SavedSearchCriteria,
  listing: CandidateListing,
): boolean {
  if (criteria.country && listing.country !== criteria.country) return false;

  const city = norm(criteria.city);
  if (city && !looseMatch(norm(listing.city), city)) return false;

  const province = norm(criteria.province);
  if (province && !looseMatch(norm(listing.province), province)) return false;

  const propertyType = norm(criteria.propertyType);
  if (propertyType) {
    const listingType = norm(listing.propertyType);
    if (!listingType || !looseMatch(listingType, propertyType)) return false;
  }

  if (criteria.maxPrice != null) {
    if (!isPositiveFinite(listing.price) || listing.price > criteria.maxPrice) return false;
  }
  if (criteria.minPrice != null) {
    if (!isPositiveFinite(listing.price) || listing.price < criteria.minPrice) return false;
  }
  if (criteria.minCap != null) {
    if (listing.capRate == null || !Number.isFinite(listing.capRate) || listing.capRate < criteria.minCap) {
      return false;
    }
  }

  return true;
}

/**
 * Frequency gates run slightly under the nominal period so an hourly sweep
 * doesn't drift the send time later every day/week.
 */
export const DAILY_DUE_MS = 23 * 60 * 60 * 1000;
export const WEEKLY_DUE_MS = (7 * 24 - 1) * 60 * 60 * 1000;

/** Is a saved search due for another matching run? Never-run searches are due. */
export function isSearchDue(
  frequency: WatchAlertFrequency,
  lastRunAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastRunAt) return true;
  const elapsed = now.getTime() - lastRunAt.getTime();
  return elapsed >= (frequency === "weekly" ? WEEKLY_DUE_MS : DAILY_DUE_MS);
}

/**
 * Deep link back to the Cap Rates map for a saved search. The map only reads
 * `q` (free text) and metric filters like `minCapRate` from the URL, so the
 * link encodes what the map can actually re-apply.
 */
export function buildCapRatesSearchUrl(criteria: SavedSearchCriteria): string {
  const q = (criteria.query || [criteria.propertyType, criteria.city, criteria.province]
    .filter(Boolean)
    .join(" ")).trim();
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (criteria.minCap != null && Number.isFinite(criteria.minCap)) {
    params.set("minCapRate", String(criteria.minCap));
  }
  const suffix = params.toString();
  return `/tools/cap-rates${suffix ? `?${suffix}` : ""}`;
}

/** Human label for a saved search when the user didn't supply a name. */
export function describeSearchCriteria(criteria: SavedSearchCriteria): string {
  const parts = [
    criteria.propertyType,
    criteria.city,
    criteria.province,
    criteria.minCap != null ? `${criteria.minCap}%+ cap` : null,
    criteria.maxPrice != null ? `under $${Math.round(criteria.maxPrice).toLocaleString()}` : null,
  ].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return criteria.query?.trim() || "Saved search";
}
