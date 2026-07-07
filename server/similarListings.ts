/**
 * Similar listings API — real comparables for the analyzer results page.
 *
 * GET /api/listings/similar?city=&type=&price=&exclude=
 *   → { success: true, data: SimilarListingResult[] }
 *     (top 3 active comparables; [] with HTTP 200 when there are no genuine comps)
 *
 * Candidates come from ddf_listing_snapshots: latest snapshot per listing,
 * where "active" = re-seen by the daily crawl within the last 7 days — the
 * same freshness rule as the listing SEO sitemap (server/listingSeo.ts,
 * PR #42). Comparability filtering + ranking are pure logic in
 * @shared/similarListings; this module only fetches candidates and caches
 * them. It never invents a listing (PR #66 removed the fabricated
 * predecessor of this surface).
 *
 * Seam: US comps could come from us_listings (watchlists.ts already reads it
 * into the same candidate shape), but there is no US listing detail page to
 * link to — /listings/:mlsNumber renders DDF data only — so this endpoint is
 * CA-only until a US listing surface exists.
 */

import type { Express } from "express";
import { pool } from "./db";
import { listingCanonicalPath } from "./listingSeo";
import {
  normalizeComparable,
  rankSimilarListings,
  similarPriceBucket,
  SIMILAR_PRICE_BUCKET_SIZE,
  type SimilarListingCandidate,
} from "@shared/similarListings";

export type SimilarListingResult = SimilarListingCandidate & {
  /** Site path to the live listing page (client route /listings/:mlsNumber). */
  path: string;
};

// ── Candidate cache ──────────────────────────────────────────────────────────
// Mirrors the CacheEntry pattern in socialStats.ts / dashboardGlance.ts: a
// module-level Map with a TTL, kept bounded by sweeping expired entries.
// Keyed by (city, type, price-bucket) so repeated analyses of nearby prices
// share one DB round trip; exclusion + final ranking stay per-request because
// the exclude param (the analysis subject) varies between callers.
type CacheEntry = { candidates: SimilarListingCandidate[]; expiresAt: number };

const CANDIDATE_TTL_MS = 10 * 60 * 1000;
const CANDIDATE_CACHE_MAX = 500;
const candidateCache = new Map<string, CacheEntry>();

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function loadCandidates(
  city: string,
  price: number,
): Promise<SimilarListingCandidate[]> {
  const bucket = similarPriceBucket(price);
  // Key = city|bucket only: the SQL doesn't filter type (the ranker does,
  // per request), so a type in the key would just duplicate identical
  // candidate sets and multiply the attacker-mintable key space. City is
  // normalized the SAME way as the SQL parameter below — a raw key over a
  // normalized query would let one whitespace-variant request poison the
  // legit key with [] for the whole TTL.
  const normalizedCity = normalizeComparable(city);
  const cacheKey = `${normalizedCity}|${bucket}`;
  const cached = candidateCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.candidates;

  // SQL narrows by city + freshness + a price band widened around the bucket
  // centre — one bucket step of margin beyond ±25% guarantees the band is a
  // superset of every actual ±25% band that maps to this bucket. The exact
  // comparability filter (including the loose property-type match) runs in
  // shared/similarListings against the actual target price.
  const centre = bucket * SIMILAR_PRICE_BUCKET_SIZE;
  const bandLow = Math.max(1, centre * 0.75 - SIMILAR_PRICE_BUCKET_SIZE);
  const bandHigh = centre * 1.25 + SIMILAR_PRICE_BUCKET_SIZE;

  const result = await pool.query(
    `
      SELECT * FROM (
        SELECT DISTINCT ON (s.mls_number)
          s.mls_number AS "mlsNumber",
          NULLIF(TRIM(split_part(s.raw_json->>'streetAddress', ',', 1)), '') AS "address",
          s.city,
          s.province,
          COALESCE(s.property_sub_type, s.structure_type) AS "propertyType",
          s.list_price AS "price",
          s.bedrooms_total AS "bedrooms",
          s.bathrooms_total AS "bathrooms",
          s.raw_json->>'photoUrl' AS "photoUrl"
        FROM ddf_listing_snapshots s
        WHERE s.mls_number IS NOT NULL
          AND s.captured_at >= NOW() - INTERVAL '7 days'
          AND COALESCE(NULLIF(s.raw_json->>'standardStatus', ''), 'Active') ILIKE 'active%'
          AND LOWER(s.city) = $1
          AND s.list_price BETWEEN $2 AND $3
        ORDER BY s.mls_number, s.snapshot_month DESC, s.captured_at DESC
      ) latest
      ORDER BY latest."price"
      LIMIT 200
    `,
    [normalizedCity, bandLow, bandHigh],
  );

  const candidates: SimilarListingCandidate[] = (result.rows as Array<Record<string, unknown>>).map((row) => ({
    mlsNumber: String(row.mlsNumber),
    address: (row.address as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    province: (row.province as string | null) ?? null,
    propertyType: (row.propertyType as string | null) ?? null,
    price: toNumber(row.price),
    bedrooms: toNumber(row.bedrooms),
    bathrooms: toNumber(row.bathrooms),
    photoUrl: (row.photoUrl as string | null) ?? null,
  }));

  candidateCache.set(cacheKey, {
    candidates,
    expiresAt: Date.now() + CANDIDATE_TTL_MS,
  });

  // Keep the cache bounded: sweep expired entries first, then — because a
  // burst of fresh distinct keys (attacker-mintable city strings) leaves
  // nothing expired to sweep — evict oldest-inserted (Map iteration order)
  // down to the cap. Without the second phase the cap is a floor, not a bound.
  if (candidateCache.size > CANDIDATE_CACHE_MAX) {
    const now = Date.now();
    for (const [key, entry] of candidateCache) {
      if (entry.expiresAt <= now) candidateCache.delete(key);
    }
    for (const key of candidateCache.keys()) {
      if (candidateCache.size <= CANDIDATE_CACHE_MAX) break;
      candidateCache.delete(key);
    }
  }

  return candidates;
}

export function registerSimilarListingsRoutes(app: Express): void {
  app.get("/api/listings/similar", async (req, res) => {
    try {
      const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
      const type = typeof req.query.type === "string" ? req.query.type.trim() : "";
      const exclude = typeof req.query.exclude === "string" ? req.query.exclude.trim() : "";
      const price = typeof req.query.price === "string" ? Number(req.query.price) : Number.NaN;

      if (!city || !Number.isFinite(price) || price <= 0) {
        res.status(400).json({ success: false, error: "city and a positive price are required" });
        return;
      }

      const candidates = await loadCandidates(city, price);
      const comps = rankSimilarListings(candidates, {
        city,
        propertyType: type || null,
        price,
        exclude: exclude || null,
      });

      const data: SimilarListingResult[] = comps.map((listing) => ({
        ...listing,
        path: listingCanonicalPath({ mlsNumber: listing.mlsNumber }),
      }));

      res.set("Cache-Control", "public, max-age=300");
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("[similar-listings] error:", err?.message || err);
      res.status(500).json({ success: false, error: "Failed to load similar listings" });
    }
  });
}
