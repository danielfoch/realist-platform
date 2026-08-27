/**
 * DDF yield crawler — snapshots every active DDF listing per province into
 * ddf_listing_snapshots (one row per listing_key × snapshot_month), underwrites
 * each with the shared rent ladder + investment-metrics engine, then rolls the
 * snapshots up into city_yield_history and area_yield_history. Scheduling
 * lives with the callers (scripts/sync-ddf.ts on GitHub Actions cron).
 */

import { eq, getTableColumns, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  ddfListingSnapshots,
  cityYieldHistory,
  areaYieldHistory,
  type InsertDdfListingSnapshot,
  type InsertCityYieldHistory,
  type InsertAreaYieldHistory,
} from "@/lib/db/schema";
import { searchDdfListings, isDdfConfigured, type DdfListing } from "./client";
import { isVacantLandLikeProperty } from "./propertyEligibility";
import { getRentEstimate } from "@/lib/rents/estimator";
import { getCmhcRent } from "@/lib/rents/cmhcRents";
import { calculateListingYield } from "@/lib/underwriting/investmentMetrics";

const PROVINCE_TO_ABBREV: Record<string, string> = {
  "Ontario": "ON",
  "British Columbia": "BC",
  "Quebec": "QC",
  "Alberta": "AB",
  "Manitoba": "MB",
  "Saskatchewan": "SK",
  "Nova Scotia": "NS",
  "New Brunswick": "NB",
  "Prince Edward Island": "PE",
  "Newfoundland and Labrador": "NL",
};

const CRAWL_PROVINCES = Object.keys(PROVINCE_TO_ABBREV);

/**
 * Rent ladder for a snapshot, best data wins:
 *   1. the listing's own TotalActualRent
 *   2. the comp-based estimator (rent_listings comps / rent_pulse aggregates),
 *      queried at city level and memoized per province×city×beds×units so a
 *      full-country crawl costs hundreds of queries, not one per listing
 *   3. the CMHC baseline
 *   4. hard defaults
 */
type RentLadderResult = { rent: number; source: string };
type RentMemo = Map<string, Promise<RentLadderResult>>;

async function estimateSnapshotRent(
  listing: DdfListing,
  city: string,
  province: string,
  memo: RentMemo,
): Promise<RentLadderResult> {
  if (listing.TotalActualRent && listing.TotalActualRent > 0) {
    return { rent: listing.TotalActualRent, source: "ddf_actual" };
  }

  const beds = listing.BedroomsTotal || 1;
  const units = listing.NumberOfUnitsTotal || 1;
  const key = `${province}|${city.toLowerCase()}|${beds}|${units}`;

  let pending = memo.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const estimate = await getRentEstimate({ bedrooms: beds, city, province, units });
        if (estimate) return { rent: estimate.monthlyRent, source: estimate.method };
      } catch (error) {
        console.warn(`[ddf-crawler] rent estimate failed for ${city}, ${province} (${beds}bd):`, error);
      }
      const cmhc = getCmhcRent(beds, city, province);
      if (cmhc.source !== "default") {
        return { rent: cmhc.rent * units, source: cmhc.source };
      }
      const defaultRent = beds >= 3 ? 1800 : beds >= 2 ? 1500 : 1200;
      return { rent: defaultRent * units, source: "default" };
    })();
    memo.set(key, pending);
  }
  return pending;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function normalizePostalArea(postalCode: string | null | undefined): string | null {
  if (!postalCode) return null;
  const normalized = postalCode.replace(/\s+/g, "").toUpperCase();
  return normalized.length >= 3 ? normalized.slice(0, 3) : null;
}

function aggregateYieldMetrics(snapshots: InsertDdfListingSnapshot[]) {
  const rentableSnapshots = snapshots.filter((s) => !isVacantLandLikeProperty(s));
  const grossYields = rentableSnapshots.map(s => s.grossYield).filter((v): v is number => v != null && v > 0 && v < 20);
  const netYields = rentableSnapshots.map(s => s.netYield).filter((v): v is number => v != null && v > -10 && v < 15);
  const prices = rentableSnapshots.map(s => s.listPrice).filter((v): v is number => v != null && v > 0);
  const rents = rentableSnapshots.map(s => s.estimatedMonthlyRent).filter((v): v is number => v != null && v > 0);
  const doms = rentableSnapshots.map(s => s.daysOnMarket).filter((v): v is number => v != null);
  const beds = rentableSnapshots.map(s => s.bedroomsTotal).filter((v): v is number => v != null);
  const sqftPrices: number[] = [];

  for (const s of rentableSnapshots) {
    if (s.listPrice && s.livingArea && s.livingArea > 0) {
      sqftPrices.push(s.listPrice / s.livingArea);
    }
  }

  return {
    listingCount: rentableSnapshots.length,
    avgGrossYield: avg(grossYields) != null ? Math.round(avg(grossYields)! * 100) / 100 : null,
    medianGrossYield: median(grossYields) != null ? Math.round(median(grossYields)! * 100) / 100 : null,
    avgNetYield: avg(netYields) != null ? Math.round(avg(netYields)! * 100) / 100 : null,
    avgListPrice: avg(prices) != null ? Math.round(avg(prices)!) : null,
    medianListPrice: median(prices) != null ? Math.round(median(prices)!) : null,
    avgRentPerUnit: avg(rents) != null ? Math.round(avg(rents)!) : null,
    avgDaysOnMarket: avg(doms) != null ? Math.round(avg(doms)! * 10) / 10 : null,
    avgPricePerSqft: avg(sqftPrices) != null ? Math.round(avg(sqftPrices)! * 100) / 100 : null,
    inventoryCount: rentableSnapshots.length,
    avgBedsPerListing: avg(beds) != null ? Math.round(avg(beds)! * 10) / 10 : null,
    yieldTrend: null,
  };
}

const PAGE_FETCH_MAX_ATTEMPTS = 3;
const PAGE_FETCH_BASE_DELAY_MS = 1000;
const PAGE_DELAY_MS = 800;
const PROVINCE_DELAY_MS = 2000;

type DdfSearchResult = Awaited<ReturnType<typeof searchDdfListings>>;

/** Fetch one results page with exponential backoff; null means every attempt failed. */
async function fetchDdfPageWithRetry(
  params: Parameters<typeof searchDdfListings>[0],
  label: string,
): Promise<DdfSearchResult | null> {
  for (let attempt = 1; attempt <= PAGE_FETCH_MAX_ATTEMPTS; attempt++) {
    try {
      return await searchDdfListings(params);
    } catch (error) {
      console.warn(`[ddf-crawler] ${label}: fetch failed (attempt ${attempt}/${PAGE_FETCH_MAX_ATTEMPTS}):`, error);
      if (attempt < PAGE_FETCH_MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, PAGE_FETCH_BASE_DELAY_MS * 2 ** (attempt - 1)));
      }
    }
  }
  console.error(`[ddf-crawler] ${label}: giving up after ${PAGE_FETCH_MAX_ATTEMPTS} attempts, skipping page`);
  return null;
}

async function buildSnapshot(
  listing: DdfListing,
  ddfProvince: string,
  month: string,
  rentMemo: RentMemo,
): Promise<InsertDdfListingSnapshot> {
  const city = listing.City || "Unknown";
  const { rent, source } = await estimateSnapshotRent(listing, city, ddfProvince, rentMemo);
  const { grossYield, netYield, estimatedExpenses, estimatedNoi } = calculateListingYield(
    listing.ListPrice!,
    rent,
    listing.TaxAnnualAmount || 0,
    listing.AssociationFee || 0,
  );

  const dom = listing.OriginalEntryTimestamp
    ? Math.floor((Date.now() - new Date(listing.OriginalEntryTimestamp).getTime()) / 86400000)
    : null;

  return {
    listingKey: listing.ListingKey,
    mlsNumber: listing.ListingId || null,
    city,
    province: PROVINCE_TO_ABBREV[ddfProvince] || ddfProvince,
    postalCode: listing.PostalCode || null,
    listPrice: listing.ListPrice!,
    bedroomsTotal: listing.BedroomsTotal || null,
    bathroomsTotal: listing.BathroomsTotalInteger || null,
    numberOfUnits: listing.NumberOfUnitsTotal || null,
    livingArea: listing.LivingArea || null,
    yearBuilt: listing.YearBuilt || null,
    propertySubType: listing.PropertySubType || null,
    structureType: listing.StructureType || null,
    latitude: listing.Latitude || null,
    longitude: listing.Longitude || null,
    totalActualRent: listing.TotalActualRent || null,
    taxAnnualAmount: listing.TaxAnnualAmount || null,
    associationFee: listing.AssociationFee || null,
    estimatedMonthlyRent: rent,
    grossYield,
    estimatedExpenses,
    estimatedNoi,
    netYield,
    daysOnMarket: dom,
    rentSource: source,
    standardStatus: listing.StandardStatus || listing.MlsStatus || null,
    streetAddress: listing.UnparsedAddress || null,
    publicRemarks: listing.PublicRemarks || null,
    photoUrl:
      listing.Media?.find((m) => m.PreferredPhotoYN && m.MediaURL)?.MediaURL ||
      listing.Media?.[0]?.MediaURL ||
      null,
    rawJson: {
      listOfficeBoard: listing.ListOfficeBoard || listing.OriginatingSystemName || null,
      photosCount: listing.PhotosCount,
      modificationTimestamp: listing.ModificationTimestamp,
    },
    snapshotMonth: month,
  };
}

export async function crawlDdfForProvince(
  ddfProvince: string,
  month: string,
  rentMemo: RentMemo = new Map(),
  standardStatus: string = "Active",
): Promise<{ snapshots: InsertDdfListingSnapshot[]; skippedPages: number }> {
  const snapshots: InsertDdfListingSnapshot[] = [];
  const pageSize = 100;
  const maxPages = 500;
  let skippedPages = 0;

  let nextLink: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const result = await fetchDdfPageWithRetry(
      {
        stateOrProvince: ddfProvince,
        standardStatus,
        excludeBusinessSales: true,
        excludeParking: true,
        excludeVacantLand: true,
        top: pageSize,
        // Follow @odata.nextLink when the API provides one; manual $skip otherwise.
        ...(nextLink ? { nextLink } : { skip: page * pageSize }),
      },
      `${ddfProvince} page ${page + 1}`,
    );
    if (!result) {
      // Page failed every retry: skip it and fall back to manual $skip paging.
      skippedPages++;
      nextLink = null;
      continue;
    }

    try {
      // Terminate on the raw page size, not the post-filter kept count:
      // client-side exclusions (parking, vacant land, ...) shrink listings.
      if (result.rawPageSize === 0) break;

      for (const listing of result.listings) {
        if (!listing.ListPrice || listing.ListPrice <= 0) continue;
        if (isVacantLandLikeProperty(listing)) continue;
        snapshots.push(await buildSnapshot(listing, ddfProvince, month, rentMemo));
      }

      console.log(`[ddf-crawler] ${ddfProvince} page ${page + 1}: ${result.listings.length} kept / ${result.rawPageSize} fetched (total so far: ${snapshots.length}, API count: ${result.count})`);

      nextLink = result.nextLink;
      if (result.rawPageSize < pageSize) break;

      await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
    } catch (error) {
      console.error(`[ddf-crawler] Error crawling ${ddfProvince} page ${page}:`, error);
      nextLink = null;
    }
  }

  return { snapshots, skippedPages };
}

const SNAPSHOT_BATCH_SIZE = 100;

/** Every non-key snapshot column resolves to the incoming row on conflict. */
const snapshotConflictSet = Object.fromEntries(
  Object.entries(getTableColumns(ddfListingSnapshots))
    .filter(([key]) => key !== "id" && key !== "listingKey" && key !== "snapshotMonth")
    .map(([key, column]) => [key, sql.raw(`excluded."${column.name}"`)]),
);

async function insertSnapshotsBatch(rows: InsertDdfListingSnapshot[]): Promise<number> {
  const db = getDb();
  let written = 0;
  for (let i = 0; i < rows.length; i += SNAPSHOT_BATCH_SIZE) {
    const batch = rows.slice(i, i + SNAPSHOT_BATCH_SIZE);
    await db.insert(ddfListingSnapshots).values(batch).onConflictDoUpdate({
      target: [ddfListingSnapshots.listingKey, ddfListingSnapshots.snapshotMonth],
      set: snapshotConflictSet,
    });
    written += batch.length;
  }
  return written;
}

function groupSnapshots(
  snapshots: InsertDdfListingSnapshot[],
  keyFn: (s: InsertDdfListingSnapshot) => string | null,
): Map<string, InsertDdfListingSnapshot[]> {
  const groups = new Map<string, InsertDdfListingSnapshot[]>();
  for (const snapshot of snapshots) {
    const key = keyFn(snapshot);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(snapshot);
  }
  return groups;
}

async function upsertCityYieldHistory(row: InsertCityYieldHistory): Promise<void> {
  await getDb().insert(cityYieldHistory).values(row).onConflictDoUpdate({
    target: [cityYieldHistory.city, cityYieldHistory.province, cityYieldHistory.month],
    set: { ...row, computedAt: sql`now()` },
  });
}

async function upsertAreaYieldHistory(row: InsertAreaYieldHistory): Promise<void> {
  await getDb().insert(areaYieldHistory).values(row).onConflictDoUpdate({
    target: [areaYieldHistory.areaType, areaYieldHistory.areaKey, areaYieldHistory.province, areaYieldHistory.month],
    set: { ...row, computedAt: sql`now()` },
  });
}

let crawlInProgress = false;

export interface DdfCrawlSummary {
  month: string;
  totalListings: number;
  citiesCrawled: number;
  provincesCompleted: number;
  /** Pages that failed every retry — silent data holes surface here. */
  skippedPages: number;
}

export async function runDdfYieldCrawl(targetMonth?: string): Promise<DdfCrawlSummary> {
  if (!isDdfConfigured()) {
    console.log("[ddf-crawler] DDF credentials not configured, skipping crawl");
    return { month: "", totalListings: 0, citiesCrawled: 0, provincesCompleted: 0, skippedPages: 0 };
  }

  if (crawlInProgress) {
    console.log("[ddf-crawler] Crawl already in progress, skipping");
    return { month: "", totalListings: 0, citiesCrawled: 0, provincesCompleted: 0, skippedPages: 0 };
  }

  crawlInProgress = true;
  const now = new Date();
  const month = targetMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  console.log(`[ddf-crawler] Starting FULL yield crawl for ${month} across ${CRAWL_PROVINCES.length} provinces`);

  try {
    let totalListings = 0;
    let skippedPages = 0;
    const allCities = new Set<string>();
    let provincesCompleted = 0;
    const rentMemo: RentMemo = new Map();

    for (const ddfProvince of CRAWL_PROVINCES) {
      const shortProvince = PROVINCE_TO_ABBREV[ddfProvince] || ddfProvince;
      try {
        console.log(`[ddf-crawler] === Crawling province: ${ddfProvince} ===`);
        const { snapshots, skippedPages: provinceSkipped } = await crawlDdfForProvince(ddfProvince, month, rentMemo);
        skippedPages += provinceSkipped;

        if (snapshots.length > 0) {
          const inserted = await insertSnapshotsBatch(snapshots);
          totalListings += inserted;
          console.log(`[ddf-crawler] ${ddfProvince}: ${inserted} listings stored`);

          const citiesInProvince = groupSnapshots(snapshots, (s) => s.city || "Unknown");
          const minListingsForYield = 5;
          for (const [cityName, citySnapshots] of Array.from(citiesInProvince.entries())) {
            if (citySnapshots.length < minListingsForYield) continue;
            const metrics = aggregateYieldMetrics(citySnapshots);
            await upsertCityYieldHistory({ city: cityName, province: shortProvince, month, ...metrics });
            await upsertAreaYieldHistory({
              areaType: "city",
              areaKey: cityName.toLowerCase(),
              areaName: cityName,
              city: cityName,
              province: shortProvince,
              month,
              ...metrics,
            });
            allCities.add(cityName);
          }

          const postalAreas = groupSnapshots(snapshots, (s) => normalizePostalArea(s.postalCode));
          for (const [postalArea, postalSnapshots] of Array.from(postalAreas.entries())) {
            if (postalSnapshots.length < minListingsForYield) continue;
            const sampleCity = postalSnapshots[0]?.city || postalArea;
            await upsertAreaYieldHistory({
              areaType: "postal_fsa",
              areaKey: postalArea,
              areaName: `${postalArea} · ${sampleCity}`,
              city: null,
              province: shortProvince,
              month,
              ...aggregateYieldMetrics(postalSnapshots),
            });
          }
          console.log(`[ddf-crawler] ${ddfProvince}: yield data for ${citiesInProvince.size} cities (${Array.from(citiesInProvince.entries()).filter(([_, s]) => s.length >= minListingsForYield).length} with 5+ listings)`);
        } else {
          console.log(`[ddf-crawler] ${ddfProvince}: no listings found`);
        }

        provincesCompleted++;
        await new Promise(r => setTimeout(r, PROVINCE_DELAY_MS));
      } catch (error) {
        console.error(`[ddf-crawler] Failed to crawl province ${ddfProvince}:`, error);
      }
    }

    console.log(`[ddf-crawler] FULL crawl complete: ${totalListings} listings across ${allCities.size} cities in ${provincesCompleted} provinces (skipped pages: ${skippedPages})`);
    return { month, totalListings, citiesCrawled: allCities.size, provincesCompleted, skippedPages };
  } finally {
    crawlInProgress = false;
  }
}

/**
 * Alert when stored snapshots lag the API's reported active-listing count.
 * The stored ratio is structurally below 1: @odata.count includes parking,
 * vacant land, and business sales (excluded client-side after fetch) and
 * price-less listings are dropped — so only a deep shortfall trips the alert.
 */
const COVERAGE_ALERT_RATIO = 0.5;

export async function checkDdfCoverage(targetMonth?: string): Promise<void> {
  if (!isDdfConfigured()) {
    console.log("[ddf-crawler][coverage] DDF credentials not configured, skipping coverage check");
    return;
  }

  const now = new Date();
  const month = targetMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const storedRows = await getDb()
    .select({ province: ddfListingSnapshots.province, stored: sql<number>`count(*)::int` })
    .from(ddfListingSnapshots)
    .where(eq(ddfListingSnapshots.snapshotMonth, month))
    .groupBy(ddfListingSnapshots.province);
  const storedByProvince = new Map(storedRows.map((row) => [row.province, row.stored]));

  for (const ddfProvince of CRAWL_PROVINCES) {
    const shortProvince = PROVINCE_TO_ABBREV[ddfProvince] || ddfProvince;
    try {
      const result = await searchDdfListings({
        stateOrProvince: ddfProvince,
        excludeBusinessSales: true,
        excludeParking: true,
        excludeVacantLand: true,
        top: 1,
      });
      const apiCount = result.count;
      const stored = storedByProvince.get(shortProvince) || 0;
      const ratio = apiCount > 0 ? stored / apiCount : 1;
      console.log(`[ddf-crawler][coverage] ${ddfProvince}: stored=${stored} apiCount=${apiCount} ratio=${ratio.toFixed(2)} (month ${month})`);
      if (apiCount > 0 && ratio < COVERAGE_ALERT_RATIO) {
        console.warn(`[ddf-crawler][coverage-alert] ${ddfProvince}: only ${stored}/${apiCount} (${(ratio * 100).toFixed(1)}%) of active listings snapshotted for ${month}`);
      }
    } catch (error) {
      console.error(`[ddf-crawler][coverage] ${ddfProvince}: coverage check failed:`, error);
    }
    await new Promise(r => setTimeout(r, 500));
  }
}
