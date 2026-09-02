import cron from "node-cron";
import { searchDdfListings, isDdfConfigured } from "./creaDdf";
import { storage } from "./storage";
import { db, pool } from "./db";
import {
  ddfListingSnapshots,
  type InsertDdfListingSnapshot,
  type InsertCityYieldHistory,
  type InsertAreaYieldHistory,
  type InsertDdfListingPriceHistory,
  type DdfCrawlRunTrigger,
  type DdfCrawlProvinceStat,
  type DdfCoverageEntry,
} from "@shared/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { CMHC_PROVINCIAL_RENTS, CMHC_CITY_RENTS, type CmhcRentData as CmhcRentEntry } from "@shared/cmhcRents";
import {
  queueDdfListingChangeNotifications,
  queueDdfListingRemovedNotifications,
  queueSavedSearchMatchNotificationsForDdf,
} from "./notifications";
import { isVacantLandLikeProperty } from "@shared/propertyEligibility";
import { lookupSoldPriceForListing, markListingsAbsent, markListingsSeenFromActiveFeed } from "./salePriceOracle";

// DDF StateOrProvince values are the full English names, territories included
// ("Yukon", "Northwest Territories", "Nunavut" — not "Yukon Territory").
export const PROVINCE_TO_ABBREV: Record<string, string> = {
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
  "Yukon": "YT",
  "Northwest Territories": "NT",
  "Nunavut": "NU",
};

// All 13 provinces and territories. The territories carry a few hundred
// listings between them, but "all active Canadian listings" has to mean all
// of Canada or the coverage ratio is lying by omission.
export const CRAWL_PROVINCES = [
  "Ontario",
  "British Columbia",
  "Quebec",
  "Alberta",
  "Manitoba",
  "Saskatchewan",
  "Nova Scotia",
  "New Brunswick",
  "Prince Edward Island",
  "Newfoundland and Labrador",
  "Yukon",
  "Northwest Territories",
  "Nunavut",
];

/** YYYY-MM in server-local time — the snapshot grain every DDF reader keys on. */
export function currentSnapshotMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

interface CmhcRentData {
  [city: string]: { oneBed: number; twoBed: number; threeBed?: number };
}

async function getCmhcRents(): Promise<CmhcRentData> {
  return CMHC_CITY_RENTS as unknown as CmhcRentData;
}

function estimateMonthlyRent(
  listing: any,
  cmhcRents: CmhcRentData,
  city: string,
  province: string,
): { rent: number; source: string } {
  if (listing.TotalActualRent && listing.TotalActualRent > 0) {
    return { rent: listing.TotalActualRent, source: "ddf_actual" };
  }

  const beds = listing.BedroomsTotal || 1;
  const units = listing.NumberOfUnitsTotal || 1;

  const cmhc = cmhcRents[city];
  if (cmhc) {
    let perUnit: number;
    if (beds >= 3) {
      perUnit = cmhc.threeBed || cmhc.twoBed * 1.15;
    } else if (beds >= 2) {
      perUnit = cmhc.twoBed;
    } else {
      perUnit = cmhc.oneBed;
    }
    return { rent: perUnit * units, source: "cmhc_city" };
  }

  const provRents = CMHC_PROVINCIAL_RENTS[province] || CMHC_PROVINCIAL_RENTS[PROVINCE_TO_ABBREV[province] || ""];
  if (provRents) {
    let perUnit: number;
    if (beds >= 3) {
      perUnit = provRents.threeBed;
    } else if (beds >= 2) {
      perUnit = provRents.twoBed;
    } else {
      perUnit = provRents.oneBed;
    }
    return { rent: perUnit * units, source: "cmhc_province" };
  }

  const defaultRent = beds >= 3 ? 1800 : beds >= 2 ? 1500 : 1200;
  return { rent: defaultRent * units, source: "default" };
}

function calculateYield(
  listPrice: number,
  monthlyRent: number,
  taxAnnual: number = 0,
  associationFee: number = 0,
): { grossYield: number; netYield: number; estimatedExpenses: number; estimatedNoi: number } {
  if (!listPrice || listPrice <= 0) {
    return { grossYield: 0, netYield: 0, estimatedExpenses: 0, estimatedNoi: 0 };
  }

  const annualRent = monthlyRent * 12;
  const grossYield = (annualRent / listPrice) * 100;

  const annualAssocFee = associationFee * 12;
  const insurance = listPrice * 0.003;
  const maintenance = annualRent * 0.05;
  const vacancy = annualRent * 0.05;
  const management = annualRent * 0.08;
  const estimatedExpenses = taxAnnual + annualAssocFee + insurance + maintenance + vacancy + management;

  const estimatedNoi = annualRent - estimatedExpenses;
  const netYield = (estimatedNoi / listPrice) * 100;

  return {
    grossYield: Math.round(grossYield * 100) / 100,
    netYield: Math.round(netYield * 100) / 100,
    estimatedExpenses: Math.round(estimatedExpenses),
    estimatedNoi: Math.round(estimatedNoi),
  };
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

/**
 * Safety ceiling on pages per province, not a budget. Ontario alone is
 * ~60-70k active listings (600-700 pages of 100); the old cap of 500 silently
 * dropped the tail every night and nothing downstream could tell. 5,000 pages
 * is 500k listings — several times the whole country — so hitting it means
 * the API is looping, and we say so loudly rather than spin forever.
 */
export const DDF_PROVINCE_MAX_PAGES = 5000;

export interface ProvinceCrawlOptions {
  /** Test hook: page size for the OData $top. Production is 100. */
  pageSize?: number;
  /** Test hook: page ceiling. Production is DDF_PROVINCE_MAX_PAGES. */
  maxPages?: number;
}

export interface ProvinceCrawlResult {
  snapshots: InsertDdfListingSnapshot[];
  /** Pages actually fetched (including ones that failed every retry). */
  pages: number;
  /** True when the ceiling stopped us while pages were still full. */
  truncated: boolean;
  /** @odata.count from the first successful page; null if none succeeded. */
  apiCount: number | null;
}

export async function crawlDdfForProvince(
  ddfProvince: string,
  month: string,
  cmhcRents: CmhcRentData,
  standardStatus: string = "Active",
  options: ProvinceCrawlOptions = {},
): Promise<ProvinceCrawlResult> {
  const snapshots: InsertDdfListingSnapshot[] = [];
  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? DDF_PROVINCE_MAX_PAGES;
  let apiCount: number | null = null;
  let exhausted = false;
  let page = 0;

  let nextLink: string | null = null;
  for (; page < maxPages; page++) {
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
      nextLink = null;
      continue;
    }

    try {
      if (apiCount == null && typeof result.count === "number") apiCount = result.count;
      // Terminate on the raw page size, not the post-filter kept count:
      // client-side exclusions (parking, vacant land, ...) shrink listings.
      if (result.rawPageSize === 0) { exhausted = true; break; }

      for (const listing of result.listings) {
        const listPrice = listing.ListPrice;
        if (!listPrice || listPrice <= 0) continue;
        if (isVacantLandLikeProperty(listing)) continue;

        const city = listing.City || "Unknown";
        const { rent, source } = estimateMonthlyRent(listing, cmhcRents, city, ddfProvince);
        const { grossYield, netYield, estimatedExpenses, estimatedNoi } = calculateYield(
          listPrice,
          rent,
          listing.TaxAnnualAmount || 0,
          listing.AssociationFee || 0,
        );

        const dom = listing.OriginalEntryTimestamp
          ? Math.floor((Date.now() - new Date(listing.OriginalEntryTimestamp).getTime()) / 86400000)
          : null;

        snapshots.push({
          listingKey: listing.ListingKey,
          mlsNumber: listing.ListingId || null,
          city,
          province: PROVINCE_TO_ABBREV[ddfProvince] || ddfProvince,
          postalCode: listing.PostalCode || null,
          listPrice,
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
          rawJson: {
            publicRemarks: listing.PublicRemarks?.substring(0, 500),
            streetAddress: listing.UnparsedAddress,
            standardStatus: listing.StandardStatus || listing.MlsStatus || null,
            listOfficeBoard: listing.ListOfficeBoard || listing.OriginatingSystemName || null,
            photosCount: listing.PhotosCount,
            photoUrl:
              listing.Media?.find((m) => m.PreferredPhotoYN && m.MediaURL)?.MediaURL ||
              listing.Media?.[0]?.MediaURL ||
              null,
            modificationTimestamp: listing.ModificationTimestamp,
          },
          snapshotMonth: month,
        });
      }

      console.log(`[ddf-crawler] ${ddfProvince} page ${page + 1}: ${result.listings.length} kept / ${result.rawPageSize} fetched (total so far: ${snapshots.length}, API count: ${result.count})`);

      nextLink = result.nextLink;
      if (result.rawPageSize < pageSize) { exhausted = true; break; }

      await new Promise(r => setTimeout(r, 800));
    } catch (error) {
      console.error(`[ddf-crawler] Error crawling ${ddfProvince} page ${page}:`, error);
      nextLink = null;
    }
  }

  const truncated = !exhausted && page >= maxPages;
  if (truncated) {
    console.warn(
      `[ddf-crawler][truncated] ${ddfProvince}: hit the ${maxPages}-page ceiling with pages still full ` +
        `(${snapshots.length} kept, API count ${apiCount ?? "unknown"}) — coverage for ${month} is incomplete`,
    );
  }

  // A break leaves `page` at the index of the last page fetched; running off
  // the ceiling leaves it equal to maxPages.
  return { snapshots, pages: exhausted ? page + 1 : page, truncated, apiCount };
}

export async function crawlDdfForCity(
  city: string,
  province: string,
  month: string,
  cmhcRents: CmhcRentData,
  standardStatus: string = "Active",
): Promise<InsertDdfListingSnapshot[]> {
  const snapshots: InsertDdfListingSnapshot[] = [];
  const pageSize = 100;
  const maxPages = 200;

  let nextLink: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const result = await fetchDdfPageWithRetry(
      {
        city,
        stateOrProvince: province,
        standardStatus,
        excludeBusinessSales: true,
        excludeParking: true,
        excludeVacantLand: true,
        top: pageSize,
        ...(nextLink ? { nextLink } : { skip: page * pageSize }),
      },
      `${city}, ${province} page ${page + 1}`,
    );
    if (!result) {
      nextLink = null;
      continue;
    }

    try {
      if (result.rawPageSize === 0) break;

      for (const listing of result.listings) {
        const listPrice = listing.ListPrice;
        if (!listPrice || listPrice <= 0) continue;
        if (isVacantLandLikeProperty(listing)) continue;

        const { rent, source } = estimateMonthlyRent(listing, cmhcRents, city, province);
        const { grossYield, netYield, estimatedExpenses, estimatedNoi } = calculateYield(
          listPrice,
          rent,
          listing.TaxAnnualAmount || 0,
          listing.AssociationFee || 0,
        );

        const dom = listing.OriginalEntryTimestamp
          ? Math.floor((Date.now() - new Date(listing.OriginalEntryTimestamp).getTime()) / 86400000)
          : null;

        snapshots.push({
          listingKey: listing.ListingKey,
          mlsNumber: listing.ListingId || null,
          city: listing.City || city,
          province: PROVINCE_TO_ABBREV[province] || province,
          postalCode: listing.PostalCode || null,
          listPrice,
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
          rawJson: {
            publicRemarks: listing.PublicRemarks?.substring(0, 500),
            streetAddress: listing.UnparsedAddress,
            standardStatus: listing.StandardStatus || listing.MlsStatus || null,
            listOfficeBoard: listing.ListOfficeBoard || listing.OriginatingSystemName || null,
            photosCount: listing.PhotosCount,
            photoUrl:
              listing.Media?.find((m) => m.PreferredPhotoYN && m.MediaURL)?.MediaURL ||
              listing.Media?.[0]?.MediaURL ||
              null,
            modificationTimestamp: listing.ModificationTimestamp,
          },
          snapshotMonth: month,
        });
      }

      nextLink = result.nextLink;
      if (result.rawPageSize < pageSize) break;
      await new Promise(r => setTimeout(r, 500));
    } catch (error) {
      console.error(`[ddf-crawler] Error crawling ${city}, ${province} page ${page}:`, error);
      nextLink = null;
    }
  }

  return snapshots;
}

export async function aggregateCityYield(
  city: string,
  province: string,
  month: string,
  snapshots: InsertDdfListingSnapshot[],
): Promise<InsertCityYieldHistory> {
  const citySnapshots = snapshots.filter(
    s => s.city?.toLowerCase() === city.toLowerCase() && s.province === province
  );
  return {
    city,
    province,
    month,
    ...aggregateYieldMetrics(citySnapshots),
  };
}

export async function aggregateAreaYield(
  areaType: "city" | "postal_fsa",
  areaKey: string,
  areaName: string,
  province: string,
  month: string,
  snapshots: InsertDdfListingSnapshot[],
): Promise<InsertAreaYieldHistory> {
  return {
    areaType,
    areaKey,
    areaName,
    city: areaType === "city" ? areaName : null,
    province,
    month,
    ...aggregateYieldMetrics(snapshots),
  };
}

// ---------------------------------------------------------------------------
// Run ledger + cross-instance lock
// ---------------------------------------------------------------------------

/**
 * Same DDL as migrations/0017_ddf_crawl_runs.sql. Replit deploys can land
 * before the migration is applied (this project applies SQL by hand, not via
 * drizzle-kit push), and a crawl that can't write its ledger should still
 * crawl — so the crawler creates what it needs, idempotently, on every start.
 */
export async function ensureDdfCrawlTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ddf_listing_price_history (
      id              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_key     varchar NOT NULL,
      mls_number      varchar,
      province        text,
      city            text,
      list_price      real,
      standard_status text,
      observed_at     timestamp NOT NULL DEFAULT now(),
      snapshot_month  varchar(7) NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ddf_price_history_listing_observed_idx
    ON ddf_listing_price_history (listing_key, observed_at DESC)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ddf_crawl_runs (
      id                  varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      started_at          timestamp NOT NULL DEFAULT now(),
      finished_at         timestamp,
      status              text NOT NULL DEFAULT 'running',
      trigger             text NOT NULL DEFAULT 'manual',
      snapshot_month      varchar(7) NOT NULL,
      provinces_completed integer NOT NULL DEFAULT 0,
      provinces_total     integer NOT NULL DEFAULT 0,
      total_listings      integer NOT NULL DEFAULT 0,
      truncated           boolean NOT NULL DEFAULT false,
      per_province        jsonb,
      coverage            jsonb,
      error               text
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ddf_crawl_runs_started_at_idx
    ON ddf_crawl_runs (started_at DESC)
  `);
}

/**
 * Arbitrary but fixed: Postgres advisory locks are keyed by a bigint and
 * this one is ours. Session-scoped, so it must be taken and released on the
 * SAME pooled connection — `db.execute` may pick any client, which is why the
 * lock helper checks out a dedicated one for the life of the run.
 */
export const DDF_CRAWL_ADVISORY_LOCK_KEY = 88120030001n;

interface CrawlLock {
  release: () => Promise<void>;
}

async function tryAcquireCrawlLock(): Promise<CrawlLock | null> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1::bigint) AS locked",
      [DDF_CRAWL_ADVISORY_LOCK_KEY.toString()],
    );
    if (!result.rows[0]?.locked) {
      client.release();
      return null;
    }
  } catch (error) {
    client.release();
    throw error;
  }
  return {
    release: async () => {
      try {
        await client.query("SELECT pg_advisory_unlock($1::bigint)", [DDF_CRAWL_ADVISORY_LOCK_KEY.toString()]);
      } catch (error) {
        console.warn("[ddf-crawler] advisory unlock failed (connection drop releases it anyway):", error);
      } finally {
        client.release();
      }
    },
  };
}

/** Ledger writes must never take the crawl down with them. */
async function ledger<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[ddf-crawler][ledger] ${label} failed:`, error);
    return undefined;
  }
}

async function recordSkippedRun(month: string, trigger: DdfCrawlRunTrigger, reason: string): Promise<void> {
  await ledger("record skipped run", async () => {
    const run = await storage.startDdfCrawlRun({ trigger, snapshotMonth: month, provincesTotal: CRAWL_PROVINCES.length });
    await storage.updateDdfCrawlRun(run.id, { status: "skipped", finishedAt: new Date(), error: reason });
  });
}

function snapshotStatus(snapshot: { rawJson: unknown }): string {
  return String((snapshot.rawJson as Record<string, unknown> | undefined)?.standardStatus || "");
}

/**
 * Price/status trail rows for one province's crawl. Append-only and only on
 * change: the monthly snapshot row is upserted every night, so without this
 * a $50k cut on the 12th is invisible by the 13th.
 */
export function buildPriceHistoryRows(
  currentSnapshots: Array<{
    listingKey: string;
    mlsNumber: string | null;
    province: string | null;
    city: string | null;
    listPrice: number | null;
    rawJson: unknown;
    snapshotMonth: string;
  }>,
  previousByKey: Map<string, { listPrice: number | null; rawJson: unknown }>,
): InsertDdfListingPriceHistory[] {
  const rows: InsertDdfListingPriceHistory[] = [];
  for (const snapshot of currentSnapshots) {
    const previous = previousByKey.get(snapshot.listingKey);
    const currentStatus = snapshotStatus(snapshot);
    if (previous && previous.listPrice === snapshot.listPrice && snapshotStatus(previous) === currentStatus) continue;
    rows.push({
      listingKey: snapshot.listingKey,
      mlsNumber: snapshot.mlsNumber,
      province: snapshot.province,
      city: snapshot.city,
      listPrice: snapshot.listPrice,
      standardStatus: currentStatus || null,
      snapshotMonth: snapshot.snapshotMonth,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Full crawl
// ---------------------------------------------------------------------------

// Fast path only. The real guard is the advisory lock below: autoscale runs
// several copies of this process and each one has its own copy of this flag.
let crawlInProgress = false;

export interface DdfCrawlRunOptions {
  trigger?: DdfCrawlRunTrigger;
  /** Test hook: shrink page size / ceiling so the truncation path is cheap to exercise. */
  pageOptions?: ProvinceCrawlOptions;
}

export interface DdfCrawlRunSummary {
  month: string;
  totalListings: number;
  citiesCrawled: number;
  provincesCompleted: number;
  runId: string | null;
  status: "completed" | "failed" | "skipped";
  truncated: boolean;
}

export async function runDdfYieldCrawl(targetMonth?: string, opts: DdfCrawlRunOptions = {}): Promise<DdfCrawlRunSummary> {
  const trigger = opts.trigger ?? "manual";
  const month = targetMonth || currentSnapshotMonth();
  const skipped = (reason: string): DdfCrawlRunSummary => ({
    month, totalListings: 0, citiesCrawled: 0, provincesCompleted: 0, runId: null, status: "skipped", truncated: false,
  });

  if (!isDdfConfigured()) {
    console.log("[ddf-crawler] DDF credentials not configured, skipping crawl");
    return skipped("not configured");
  }

  if (crawlInProgress) {
    console.log("[ddf-crawler] Crawl already in progress in this process, skipping");
    await recordSkippedRun(month, trigger, "crawl already in progress (this process)");
    return skipped("in progress");
  }

  crawlInProgress = true;
  let lock: CrawlLock | null = null;
  let lockDegraded = false;
  let runId: string | null = null;
  try {
    await ledger("ensure tables", ensureDdfCrawlTables);

    try {
      lock = await tryAcquireCrawlLock();
    } catch (error) {
      // No lock means no way to know another instance isn't mid-crawl. Two
      // concurrent upserts of the same month are wasteful but not corrupting,
      // so proceed and say so rather than skip the night's refresh.
      lockDegraded = true;
      console.error("[ddf-crawler] advisory lock unavailable, proceeding unlocked:", error);
    }
    if (lock === null && !lockDegraded) {
      console.log("[ddf-crawler] Another instance holds the crawl lock, skipping");
      await recordSkippedRun(month, trigger, "advisory lock held by another instance");
      return skipped("locked");
    }

    console.log(`[ddf-crawler] Starting FULL yield crawl for ${month} across ${CRAWL_PROVINCES.length} provinces (trigger: ${trigger})`);
    const run = await ledger("start run", () =>
      storage.startDdfCrawlRun({ trigger, snapshotMonth: month, provincesTotal: CRAWL_PROVINCES.length }));
    runId = run?.id ?? null;

    const cmhcRents = await getCmhcRents();
    let totalListings = 0;
    const allCities = new Set<string>();
    let provincesCompleted = 0;
    let anyTruncated = false;
    const perProvince: DdfCrawlProvinceStat[] = [];

    const checkpoint = async () => {
      if (!runId) return;
      const id = runId;
      await ledger("checkpoint", () => storage.updateDdfCrawlRun(id, {
        provincesCompleted,
        totalListings,
        truncated: anyTruncated,
        perProvince,
      }));
    };

    for (const ddfProvince of CRAWL_PROVINCES) {
      const shortProvince = PROVINCE_TO_ABBREV[ddfProvince] || ddfProvince;
      const stat: DdfCrawlProvinceStat = { province: shortProvince, stored: 0, apiCount: null, ratio: null, pages: 0 };
      try {
        console.log(`[ddf-crawler] === Crawling province: ${ddfProvince} ===`);
        const provinceExistingSnapshots = await db.select().from(ddfListingSnapshots).where(and(
          eq(ddfListingSnapshots.snapshotMonth, month),
          eq(ddfListingSnapshots.province, shortProvince),
        ));
        const { snapshots, pages, truncated, apiCount } = await crawlDdfForProvince(ddfProvince, month, cmhcRents, "Active", opts.pageOptions);
        stat.pages = pages;
        stat.apiCount = apiCount;
        if (truncated) {
          stat.truncated = true;
          anyTruncated = true;
        }

        if (snapshots.length > 0) {
          const listingKeys = Array.from(new Set(snapshots.map((snapshot) => snapshot.listingKey)));
          const listingKeySet = new Set(listingKeys);
          const existingSnapshots = listingKeys.length
            ? await db.select().from(ddfListingSnapshots).where(and(
              eq(ddfListingSnapshots.snapshotMonth, month),
              inArray(ddfListingSnapshots.listingKey, listingKeys),
            ))
            : [];
          const existingByKey = new Map(existingSnapshots.map((snapshot) => [snapshot.listingKey, snapshot]));
          const newSnapshotKeys = new Set(snapshots.filter((snapshot) => !existingByKey.has(snapshot.listingKey)).map((snapshot) => snapshot.listingKey));

          const batchSize = 500;
          let inserted = 0;
          for (let i = 0; i < snapshots.length; i += batchSize) {
            const batch = snapshots.slice(i, i + batchSize);
            inserted += await storage.insertDdfListingSnapshotsBatch(batch);
          }
          totalListings += inserted;
          stat.stored = inserted;
          stat.ratio = apiCount && apiCount > 0 ? Math.round((inserted / apiCount) * 1000) / 1000 : null;
          console.log(`[ddf-crawler] ${ddfProvince}: ${inserted} listings stored`);

          const currentSnapshots = listingKeys.length
            ? await db.select().from(ddfListingSnapshots).where(and(
              eq(ddfListingSnapshots.snapshotMonth, month),
              inArray(ddfListingSnapshots.listingKey, listingKeys),
            ))
            : [];
          const newSnapshots = currentSnapshots.filter((snapshot) => newSnapshotKeys.has(snapshot.listingKey));
          const changedSnapshots = currentSnapshots.flatMap((snapshot) => {
            const previous = existingByKey.get(snapshot.listingKey);
            if (!previous) return [];
            if (previous.listPrice === snapshot.listPrice && snapshotStatus(previous) === snapshotStatus(snapshot)) return [];
            return [{ previous, current: snapshot }];
          });
          const missingSnapshots = provinceExistingSnapshots.filter((snapshot) => !listingKeySet.has(snapshot.listingKey));
          const soldLikeSnapshots = currentSnapshots.filter((snapshot) => {
            const status = snapshotStatus(snapshot).toLowerCase();
            return status.includes("sold") || status.includes("closed");
          });

          const priceHistoryRows = buildPriceHistoryRows(currentSnapshots, existingByKey);
          if (priceHistoryRows.length > 0) {
            await ledger("price history", () => storage.insertDdfPriceHistoryBatch(priceHistoryRows));
            console.log(`[ddf-crawler] ${ddfProvince}: ${priceHistoryRows.length} price/status history rows (${newSnapshots.length} new, ${changedSnapshots.length} changed)`);
          }

          await markListingsSeenFromActiveFeed(currentSnapshots.map((snapshot) => ({
            listingKey: snapshot.listingKey,
            mlsNumber: snapshot.mlsNumber,
            board: String((snapshot.rawJson as Record<string, unknown> | undefined)?.listOfficeBoard || ""),
            province: snapshot.province,
          })));

          const absenceResult = await markListingsAbsent(
            null,
            missingSnapshots.map((snapshot) => snapshot.listingKey),
            "missing_from_feed",
          );
          if (soldLikeSnapshots.length > 0) {
            await markListingsAbsent(
              null,
              soldLikeSnapshots.map((snapshot) => snapshot.listingKey),
              "sold_status",
              { force: true },
            );
          }
          if (absenceResult.lockedEstimateCount > 0) {
            await Promise.allSettled(
              missingSnapshots
                .slice(0, Math.min(missingSnapshots.length, 25))
                .map((snapshot) => lookupSoldPriceForListing(null, snapshot.listingKey)),
            );
          }

          await Promise.all([
            queueSavedSearchMatchNotificationsForDdf(newSnapshots).catch((error) => {
              console.error(`[ddf-crawler] ${ddfProvince} saved-search notifications error:`, error);
            }),
            queueDdfListingChangeNotifications(changedSnapshots).catch((error) => {
              console.error(`[ddf-crawler] ${ddfProvince} listing-change notifications error:`, error);
            }),
            queueDdfListingRemovedNotifications(missingSnapshots).catch((error) => {
              console.error(`[ddf-crawler] ${ddfProvince} listing-removal notifications error:`, error);
            }),
          ]);

          const citiesInProvince = new Map<string, InsertDdfListingSnapshot[]>();
          for (const s of snapshots) {
            const cityName = s.city || "Unknown";
            if (!citiesInProvince.has(cityName)) {
              citiesInProvince.set(cityName, []);
            }
            citiesInProvince.get(cityName)!.push(s);
          }

          const minListingsForYield = 5;
          for (const [cityName, citySnapshots] of Array.from(citiesInProvince.entries())) {
            if (citySnapshots.length >= minListingsForYield) {
              const yieldData = await aggregateCityYield(cityName, shortProvince, month, citySnapshots);
              await storage.upsertCityYieldHistory(yieldData);
              await storage.upsertAreaYieldHistory(
                await aggregateAreaYield("city", cityName.toLowerCase(), cityName, shortProvince, month, citySnapshots)
              );
              allCities.add(cityName);
            }
          }

          const postalAreas = new Map<string, InsertDdfListingSnapshot[]>();
          for (const snapshot of snapshots) {
            const postalArea = normalizePostalArea(snapshot.postalCode);
            if (!postalArea) continue;
            if (!postalAreas.has(postalArea)) postalAreas.set(postalArea, []);
            postalAreas.get(postalArea)!.push(snapshot);
          }

          for (const [postalArea, postalSnapshots] of Array.from(postalAreas.entries())) {
            if (postalSnapshots.length < minListingsForYield) continue;
            const sampleCity = postalSnapshots[0]?.city || postalArea;
            await storage.upsertAreaYieldHistory(
              await aggregateAreaYield(
                "postal_fsa",
                postalArea,
                `${postalArea} · ${sampleCity}`,
                shortProvince,
                month,
                postalSnapshots,
              )
            );
          }
          console.log(`[ddf-crawler] ${ddfProvince}: yield data for ${citiesInProvince.size} cities (${Array.from(citiesInProvince.entries()).filter(([_, s]) => s.length >= minListingsForYield).length} with 5+ listings)`);
        } else {
          console.log(`[ddf-crawler] ${ddfProvince}: no listings found`);
        }

        provincesCompleted++;
      } catch (error) {
        stat.error = error instanceof Error ? error.message : String(error);
        console.error(`[ddf-crawler] Failed to crawl province ${ddfProvince}:`, error);
      }
      perProvince.push(stat);
      await checkpoint();
      await new Promise(r => setTimeout(r, 2000));
    }

    const status = provincesCompleted > 0 ? "completed" : "failed";
    console.log(`[ddf-crawler] FULL crawl ${status}: ${totalListings} listings across ${allCities.size} cities in ${provincesCompleted}/${CRAWL_PROVINCES.length} provinces${anyTruncated ? " [TRUNCATED]" : ""}`);
    if (runId) {
      const id = runId;
      await ledger("finalize run", () => storage.updateDdfCrawlRun(id, {
        status,
        finishedAt: new Date(),
        provincesCompleted,
        totalListings,
        truncated: anyTruncated,
        perProvince,
        error: status === "failed" ? "no province completed" : null,
      }));
    }
    return { month, totalListings, citiesCrawled: allCities.size, provincesCompleted, runId, status, truncated: anyTruncated };
  } catch (error) {
    console.error("[ddf-crawler] FULL crawl failed:", error);
    if (runId) {
      const id = runId;
      await ledger("finalize failed run", () => storage.updateDdfCrawlRun(id, {
        status: "failed",
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : String(error),
      }));
    }
    throw error;
  } finally {
    crawlInProgress = false;
    if (lock) await lock.release();
  }
}

// ---------------------------------------------------------------------------
// Scheduling + coverage
// ---------------------------------------------------------------------------

/**
 * Alert when stored snapshots lag the API's reported active-listing count.
 * The stored ratio is structurally below 1: @odata.count includes parking,
 * vacant land, and business sales (excluded client-side after fetch) and
 * price-less listings are dropped — so only a deep shortfall trips the alert.
 */
const COVERAGE_ALERT_RATIO = 0.5;

/** A crawl older than this is stale: one missed nightly window plus slack. */
export const DDF_STALE_AFTER_HOURS = 26;
const STARTUP_CATCH_UP_DELAY_MS = 2 * 60 * 1000;

/**
 * A deploy that lands after 02:20 has missed tonight's window and would wait
 * up to 24h; catch up if nothing completed in the last DDF_STALE_AFTER_HOURS.
 */
export function shouldRunStartupCatchUp(lastCompletedAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!lastCompletedAt) return true;
  return now.getTime() - lastCompletedAt.getTime() > DDF_STALE_AFTER_HOURS * 60 * 60 * 1000;
}

async function runScheduledCrawl(trigger: DdfCrawlRunTrigger): Promise<void> {
  try {
    const r = await runDdfYieldCrawl(undefined, { trigger });
    console.log(
      `[ddf-crawler] ${trigger} crawl ${r.status}: ${r.totalListings} listings across ${r.citiesCrawled} cities, ` +
        `${r.provincesCompleted}/${CRAWL_PROVINCES.length} provinces (month ${r.month})${r.truncated ? " [TRUNCATED]" : ""}`,
    );
    if (r.status !== "skipped") await checkDdfCoverage(r.month);
  } catch (err) {
    console.error(`[ddf-crawler] ${trigger} crawl error:`, err);
  }
}

/**
 * Nightly crawl + coverage check + startup catch-up.
 *
 * 02:20 America/Toronto — before the 07:00 AI trainer and the 09:15 multiplex
 * rollups, both of which read this data. The zone is explicit: the previous
 * "20 6 * * *" assumed a UTC host, which is 02:20 Toronto in summer and 01:20
 * in winter, and any host not on UTC moved it somewhere else entirely.
 * Coverage runs straight after so the ratio in the ledger always describes
 * the crawl that just finished.
 *
 * Cross-instance safety is the advisory lock in runDdfYieldCrawl, so every
 * autoscale instance may schedule this; the losers record a 'skipped' run.
 */
export function scheduleDdfYieldCrawl(): void {
  cron.schedule("20 2 * * *", () => { void runScheduledCrawl("cron"); }, { timezone: "America/Toronto" });
  console.log("[ddf-crawler] Nightly crawl + coverage check scheduled (02:20 America/Toronto)");

  if (!isDdfConfigured()) return;
  void (async () => {
    try {
      await ensureDdfCrawlTables();
      const latest = await storage.getLatestDdfCrawlRun({ status: "completed" });
      if (!shouldRunStartupCatchUp(latest?.finishedAt ?? null)) return;
      console.log(
        `[ddf-crawler] last completed crawl ${latest?.finishedAt ? latest.finishedAt.toISOString() : "never"} ` +
          `— startup catch-up in ${STARTUP_CATCH_UP_DELAY_MS / 60000} min`,
      );
      setTimeout(() => { void runScheduledCrawl("startup"); }, STARTUP_CATCH_UP_DELAY_MS);
    } catch (error) {
      console.error("[ddf-crawler] startup catch-up check failed:", error);
    }
  })();
}

/**
 * Compare stored snapshots against the API's active count per province.
 * Persists the result onto the most recent run (the crawl this describes)
 * so the health endpoint can show it, and still logs for the instance logs.
 */
export async function checkDdfCoverage(targetMonth?: string): Promise<DdfCoverageEntry[]> {
  if (!isDdfConfigured()) {
    console.log("[ddf-crawler][coverage] DDF credentials not configured, skipping coverage check");
    return [];
  }

  const month = targetMonth || currentSnapshotMonth();

  const storedRows = await db
    .select({ province: ddfListingSnapshots.province, stored: sql<number>`count(*)::int` })
    .from(ddfListingSnapshots)
    .where(eq(ddfListingSnapshots.snapshotMonth, month))
    .groupBy(ddfListingSnapshots.province);
  const storedByProvince = new Map(storedRows.map((row) => [row.province, row.stored]));

  const entries: DdfCoverageEntry[] = [];
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
      const alert = apiCount > 0 && ratio < COVERAGE_ALERT_RATIO;
      entries.push({ province: shortProvince, stored, apiCount, ratio: Math.round(ratio * 1000) / 1000, alert });
      console.log(`[ddf-crawler][coverage] ${ddfProvince}: stored=${stored} apiCount=${apiCount} ratio=${ratio.toFixed(2)} (month ${month})`);
      if (alert) {
        console.warn(`[ddf-crawler][coverage-alert] ${ddfProvince}: only ${stored}/${apiCount} (${(ratio * 100).toFixed(1)}%) of active listings snapshotted for ${month}`);
      }
    } catch (error) {
      console.error(`[ddf-crawler][coverage] ${ddfProvince}: coverage check failed:`, error);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  await ledger("persist coverage", async () => {
    const latest = await storage.getLatestDdfCrawlRun();
    if (latest) await storage.updateDdfCrawlRun(latest.id, { coverage: entries });
  });
  return entries;
}
