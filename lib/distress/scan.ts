import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dataCache, distressListings } from "@/lib/db/schema";
import type { InsertDistressListing } from "@/lib/db/schema";
import {
  SEARCH_TERMS_BY_CATEGORY,
  isQualifiedDistressResult,
  scoreDistress,
  type DistressResult,
} from "./scoring";

/** A DDF listing (normalizeDdfListing shape) scored for distress signals. */
export interface ScoredDistressListing {
  listingKey: string;
  mlsNumber?: string;
  listPrice?: number;
  address?: {
    streetNumber?: string;
    streetName?: string;
    streetSuffix?: string;
    streetDirectionPrefix?: string;
    streetDirection?: string;
    unitNumber?: string;
    city?: string;
    state?: string;
    zip?: string;
    [key: string]: unknown;
  };
  map?: { latitude?: number; longitude?: number };
  type?: string;
  daysOnMarket?: number;
  distress: DistressResult;
  rawRemarks: string;
  [key: string]: unknown;
}

export interface DistressScanData {
  listings: ScoredDistressListing[];
  totalDdfScanned: number;
  failedTermCount: number;
}

export const DISTRESS_CACHE_KEY = "distress-v6:qualified";
export const DISTRESS_CACHE_FRESH_MS = 24 * 60 * 60 * 1000;

let distressScanInProgress = false;
let lastDistressScanError: { message: string; at: string } | null = null;

export function getLastDistressScanError(): { message: string; at: string } | null {
  return lastDistressScanError;
}

export async function runDistressScan(): Promise<DistressScanData> {
  const { searchDdfByRemarks, normalizeDdfListing } = await import("@/lib/ddf/client");

  const allCategoryKeys = Object.keys(SEARCH_TERMS_BY_CATEGORY);
  const searchTerms: string[] = [];
  for (const cat of allCategoryKeys) {
    searchTerms.push(...(SEARCH_TERMS_BY_CATEGORY[cat] || []));
  }
  const uniqueTerms = [...new Set(searchTerms)];

  const allListings = new Map<string, any>();
  let totalDdfScanned = 0;
  const failedTerms: string[] = [];

  const CONCURRENCY = 2;
  const TERM_TIMEOUT = 60000;
  for (let c = 0; c < uniqueTerms.length; c += CONCURRENCY) {
    const termChunk = uniqueTerms.slice(c, c + CONCURRENCY);
    const results = await Promise.allSettled(
      termChunk.map(term => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TERM_TIMEOUT);
        return searchDdfByRemarks({
          searchTerms: [term],
          top: 200,
          signal: controller.signal,
        }).finally(() => clearTimeout(timer));
      })
    );
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled") {
        totalDdfScanned += r.value.count;
        for (const raw of r.value.listings) {
          const key = raw.ListingKey || raw.ListingId || "";
          if (key && !allListings.has(key)) {
            allListings.set(key, raw);
          }
        }
        console.log(`[distress-scan] "${termChunk[i]}": ${r.value.count} matches, ${r.value.listings.length} fetched`);
      } else {
        failedTerms.push(termChunk[i]);
        console.error(`[distress-scan] "${termChunk[i]}" error:`, (r.reason as any)?.message || r.reason);
      }
    }
  }
  console.log(`[distress-scan] Total: ${allListings.size} unique listings from ${uniqueTerms.length} searches`);

  // An empty result with search errors means the feed is broken, not that no
  // distress listings exist — keep whatever cache we have instead of
  // overwriting it with nothing.
  if (failedTerms.length > 0 && allListings.size === 0) {
    throw new Error(
      `${failedTerms.length}/${uniqueTerms.length} DDF term searches failed and none returned listings; not caching an empty result set`
    );
  }
  if (failedTerms.length > 0) {
    console.error(`[distress-scan] ${failedTerms.length}/${uniqueTerms.length} term searches failed; caching partial results`);
  }

  const allScored: ScoredDistressListing[] = Array.from(allListings.entries()).map(([listingKey, raw]) => {
    const normalized = normalizeDdfListing(raw);
    const remarks = raw.PublicRemarks || "";
    const listingProvince = raw.StateOrProvince || "";
    const distress = scoreDistress(remarks, listingProvince);
    return { ...normalized, listingKey, distress, rawRemarks: remarks };
  }).filter((listing: ScoredDistressListing) => isQualifiedDistressResult(listing.distress));

  allScored.sort((a, b) => b.distress.distressScore - a.distress.distressScore);

  const cacheData: DistressScanData = {
    listings: allScored,
    totalDdfScanned,
    failedTermCount: failedTerms.length,
  };

  await writeDistressCache(cacheData);

  try {
    await persistDistressListings(allScored);
  } catch (err: any) {
    // The cache is already written and servable — a persistence hiccup should
    // not fail the scan, only cost this cycle's history update.
    console.error("[distress-scan] Failed to persist listing history:", err.message);
  }

  return cacheData;
}

export function triggerBackgroundScan(): void {
  if (distressScanInProgress) return;
  distressScanInProgress = true;
  console.log("[distress-scan] Starting background scan...");
  runDistressScan()
    .then(data => {
      lastDistressScanError = null;
      console.log(`[distress-scan] Background scan complete: ${data.listings.length} listings cached`);
    })
    .catch(err => {
      lastDistressScanError = { message: err.message, at: new Date().toISOString() };
      console.error("[distress-scan] Background scan failed:", err.message);
    })
    .finally(() => { distressScanInProgress = false; });
}

export function isDistressScanInProgress(): boolean {
  return distressScanInProgress;
}

export async function writeDistressCache(data: DistressScanData): Promise<void> {
  const db = getDb();
  await db.insert(dataCache).values({
    key: DISTRESS_CACHE_KEY,
    value: data,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: dataCache.key,
    set: { value: data, updatedAt: new Date() },
  });
}

/**
 * Reads the cached scan result. `fresh` is false once the row is older than
 * 24h — callers should serve the stale data anyway and kick off
 * triggerBackgroundScan() rather than block the request on a rescan.
 */
export async function readDistressCache(): Promise<
  { data: DistressScanData; updatedAt: Date; fresh: boolean } | null
> {
  const db = getDb();
  const [row] = await db.select().from(dataCache).where(eq(dataCache.key, DISTRESS_CACHE_KEY));
  if (!row) return null;
  return {
    data: row.value as DistressScanData,
    updatedAt: row.updatedAt,
    fresh: Date.now() - row.updatedAt.getTime() < DISTRESS_CACHE_FRESH_MS,
  };
}

export interface DistressFilterOptions {
  minScore?: number;
  categories?: string[];
  excludeKeywords?: string[];
}

export function filterDistressListings(
  listings: ScoredDistressListing[],
  options: DistressFilterOptions = {}
): ScoredDistressListing[] {
  const minScore = options.minScore ?? 1;
  const categories = options.categories ?? [];
  const excludeKeywords = options.excludeKeywords ?? [];

  let filtered = listings.filter(l =>
    (l.distress?.distressScore || 0) >= minScore && isQualifiedDistressResult(l.distress)
  );
  if (categories.length > 0) {
    filtered = filtered.filter(l =>
      categories.some(cat => (l.distress?.categoriesTriggered as any)?.[cat])
    );
  }
  if (excludeKeywords.length > 0) {
    const lowerExclude = excludeKeywords.map(k => k.toLowerCase().trim());
    filtered = filtered.filter(l => {
      const remark = (l.rawRemarks || "").toLowerCase();
      return !lowerExclude.some(kw => remark.includes(kw));
    });
  }
  return filtered;
}

/**
 * The single category a listing files under in the long-term database. A
 * listing can trigger several; the rarest, most actionable signal wins:
 * lender-forced sales, then seller financing, then general motivation.
 */
export function primaryDistressCategory(
  distress: Pick<DistressResult, "categoriesTriggered">
): "foreclosure_pos" | "motivated" | "vtb" {
  if (distress.categoriesTriggered.foreclosure_pos) return "foreclosure_pos";
  if (distress.categoriesTriggered.vtb) return "vtb";
  return "motivated";
}

function formatAddress(address: ScoredDistressListing["address"]): string | null {
  if (!address) return null;
  const street = [
    address.streetNumber,
    address.streetDirectionPrefix,
    address.streetName,
    address.streetSuffix,
    address.streetDirection,
  ].filter(Boolean).join(" ").trim();
  if (!street) return null;
  return address.unitNumber ? `${address.unitNumber} - ${street}` : street;
}

export function buildDistressListingRow(
  listing: ScoredDistressListing,
  today: string
): InsertDistressListing | null {
  const listingKey = listing.listingKey || listing.mlsNumber;
  if (!listingKey) return null;

  const listPrice = typeof listing.listPrice === "number" && listing.listPrice > 0
    ? listing.listPrice
    : null;

  return {
    listingKey,
    mlsNumber: listing.mlsNumber || null,
    address: formatAddress(listing.address),
    city: listing.address?.city || null,
    province: listing.address?.state || null,
    postalCode: listing.address?.zip || null,
    listPrice,
    propertySubType: listing.type || null,
    category: primaryDistressCategory(listing.distress),
    rawScore: listing.distress.rawScore,
    normalizedScore: listing.distress.distressScore,
    confidence: listing.distress.confidence,
    matchedTerms: listing.distress.matchedTerms,
    publicRemarksExcerpt: listing.rawRemarks ? listing.rawRemarks.slice(0, 500) : null,
    lat: listing.map?.latitude ?? null,
    lng: listing.map?.longitude ?? null,
    lastListPrice: listPrice,
    priceHistory: listPrice != null ? [{ date: today, price: listPrice }] : [],
  };
}

/**
 * Upserts every scanned listing into the long-term distress_listings table:
 * new keys insert with a seeded price history, known keys refresh their score
 * and stamp last_seen_at, appending a price point whenever the list price
 * moved since the previous scan. Listings absent from this scan keep their
 * row; once unseen for 48h they flip to status "gone", preserving the full
 * lifecycle for the motivated-sellers database.
 */
export async function persistDistressListings(results: ScoredDistressListing[]): Promise<void> {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const rows = results
    .map(listing => buildDistressListingRow(listing, today))
    .filter((row): row is InsertDistressListing => row !== null);

  const CHUNK = 50;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await db.insert(distressListings).values(chunk).onConflictDoUpdate({
      target: distressListings.listingKey,
      set: {
        mlsNumber: sql`excluded.mls_number`,
        address: sql`excluded.address`,
        city: sql`excluded.city`,
        province: sql`excluded.province`,
        postalCode: sql`excluded.postal_code`,
        propertySubType: sql`excluded.property_sub_type`,
        category: sql`excluded.category`,
        rawScore: sql`excluded.raw_score`,
        normalizedScore: sql`excluded.normalized_score`,
        confidence: sql`excluded.confidence`,
        matchedTerms: sql`excluded.matched_terms`,
        publicRemarksExcerpt: sql`excluded.public_remarks_excerpt`,
        lat: sql`excluded.lat`,
        lng: sql`excluded.lng`,
        lastSeenAt: sql`now()`,
        timesSeen: sql`${distressListings.timesSeen} + 1`,
        status: "active",
        // Append a price point only when the price actually moved; column
        // references read the stored row, `excluded` reads this scan's values.
        priceHistory: sql`CASE
          WHEN excluded.last_list_price IS NOT NULL
           AND ${distressListings.lastListPrice} IS DISTINCT FROM excluded.last_list_price
          THEN coalesce(${distressListings.priceHistory}, '[]'::jsonb)
               || jsonb_build_array(jsonb_build_object('date', ${today}::text, 'price', excluded.last_list_price))
          ELSE coalesce(${distressListings.priceHistory}, '[]'::jsonb)
        END`,
        listPrice: sql`excluded.list_price`,
        lastListPrice: sql`excluded.last_list_price`,
      },
    });
  }

  // Every row this scan touched now has last_seen_at = now(), so anything
  // still older than 48h has been missing from recent scans — the listing is
  // gone (sold, expired, or relisted without the distress language).
  await db.update(distressListings)
    .set({ status: "gone" })
    .where(and(
      eq(distressListings.status, "active"),
      sql`${distressListings.lastSeenAt} < now() - interval '48 hours'`,
    ));
}
