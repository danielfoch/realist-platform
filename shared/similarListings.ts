/**
 * Similar-listings comparability: the pure filter + ranking behind the
 * "Similar listings" strip on the analyzer results page.
 *
 * History: PR #66 deleted a fabricated "similar deals" card that invented
 * comparables with made-up scores. This module is the honest replacement —
 * it only ever narrows real candidate rows (latest DDF snapshots, queried in
 * server/similarListings.ts); it never synthesizes a listing. No genuine
 * match → empty array → the client renders nothing.
 *
 * Matching conventions follow shared/watchlistAlerts.ts: trim+lowercase
 * normalization, loose bidirectional containment for property types, and
 * honest-matching semantics (an unknown value never satisfies a criterion).
 */

/** A real listing row, shaped by the server from the latest DDF snapshot. */
export interface SimilarListingCandidate {
  /** MLS number — links to the live listing page at /listings/:mlsNumber. */
  mlsNumber: string;
  /** Street address from the snapshot raw_json (null when the feed lacks it). */
  address: string | null;
  city: string | null;
  province: string | null;
  /** DDF PropertySubType, falling back to StructureType (watchlists convention). */
  propertyType: string | null;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  /** Primary photo from snapshot raw_json.photoUrl (refreshed snapshots only). */
  photoUrl: string | null;
}

/** The analysis context the comps are ranked against. */
export interface SimilarListingsTarget {
  city: string;
  /** Optional analyzer property type; free-form, matched loosely. */
  propertyType?: string | null;
  price: number;
  /** Subject identifier — MLS number or street address; excluded from results. */
  exclude?: string | null;
}

/** Comparables must sit within ±25% of the target price (inclusive). */
export const SIMILAR_PRICE_BAND = 0.25;

/** Default strip size. */
export const SIMILAR_LISTINGS_LIMIT = 3;

/** Cache-key bucket width: analyses within the same step share candidates. */
export const SIMILAR_PRICE_BUCKET_SIZE = 50_000;

export function normalizeComparable(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Loose bidirectional containment ("condo" matches "Condo Apartment"). */
function looseMatch(a: string, b: string): boolean {
  return a.includes(b) || b.includes(a);
}

export function isWithinPriceBand(
  price: number | null | undefined,
  targetPrice: number,
): boolean {
  if (price == null || !Number.isFinite(price) || price <= 0) return false;
  return (
    price >= targetPrice * (1 - SIMILAR_PRICE_BAND) &&
    price <= targetPrice * (1 + SIMILAR_PRICE_BAND)
  );
}

/**
 * Is this candidate the analysis subject itself? The analyzer identifies the
 * subject by whatever it has — an MLS number or a typed street address — so
 * match exactly on MLS and loosely on address ("123 Main St" should exclude
 * the snapshot row addressed "123 Main St E").
 */
export function isSubjectListing(
  candidate: Pick<SimilarListingCandidate, "mlsNumber" | "address">,
  exclude: string | null | undefined,
): boolean {
  const needle = normalizeComparable(exclude);
  if (!needle) return false;
  if (normalizeComparable(candidate.mlsNumber) === needle) return true;
  const address = normalizeComparable(candidate.address);
  return address.length > 0 && looseMatch(address, needle);
}

/**
 * Filter candidates down to genuine comparables and rank them: same city
 * (case-insensitive), same property type when the target specifies one
 * (candidates with an UNKNOWN type do not match a typed target), price within
 * ±25% of the target, subject excluded — ordered by |price − target|
 * ascending (MLS number breaks ties deterministically).
 */
export function rankSimilarListings(
  candidates: SimilarListingCandidate[],
  target: SimilarListingsTarget,
  limit: number = SIMILAR_LISTINGS_LIMIT,
): SimilarListingCandidate[] {
  const city = normalizeComparable(target.city);
  const type = normalizeComparable(target.propertyType);
  if (!city || !Number.isFinite(target.price) || target.price <= 0) return [];

  return candidates
    .filter((candidate) => {
      if (!candidate.mlsNumber) return false;
      if (normalizeComparable(candidate.city) !== city) return false;
      if (type) {
        const candidateType = normalizeComparable(candidate.propertyType);
        if (!candidateType || !looseMatch(candidateType, type)) return false;
      }
      if (!isWithinPriceBand(candidate.price, target.price)) return false;
      if (isSubjectListing(candidate, target.exclude)) return false;
      return true;
    })
    .sort((a, b) => {
      const byDistance =
        Math.abs((a.price as number) - target.price) -
        Math.abs((b.price as number) - target.price);
      if (byDistance !== 0) return byDistance;
      return a.mlsNumber.localeCompare(b.mlsNumber);
    })
    .slice(0, Math.max(0, limit));
}

/**
 * Cache-key price bucket. The server widens its SQL band around the bucket
 * centre so every actual ±25% band that maps to a bucket is covered by the
 * bucket's candidate set.
 */
export function similarPriceBucket(price: number): number {
  return Math.max(1, Math.round(price / SIMILAR_PRICE_BUCKET_SIZE));
}
