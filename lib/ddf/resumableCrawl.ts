import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { crawlState, ddfListingSnapshots, type CrawlState } from "@/lib/db/schema";
import { isDdfConfigured, searchDdfListings } from "@/lib/ddf/client";
import {
  CRAWL_PROVINCES,
  PROVINCE_TO_ABBREV,
  aggregateYieldMetrics,
  buildSnapshot,
  fetchDdfPageWithRetry,
  insertSnapshotsBatch,
  normalizePostalArea,
  upsertAreaYieldHistory,
  upsertCityYieldHistory,
  type YieldMetricInput,
} from "@/lib/ddf/crawler";
import { isVacantLandLikeProperty } from "@/lib/ddf/propertyEligibility";
import { DEFAULT_PROVINCES, rebuildRentPulse, upsertObservations } from "@/lib/rents/ingestion";
import { ddfLeaseToRentObservation, type RentObservationRow } from "@/lib/rents/observations";
import type { RentMemo } from "@/lib/underwriting/underwriteListing";

/**
 * The nightly data sync, in slices.
 *
 * A national crawl is ~2,000 pages and takes hours; a serverless function gets
 * minutes. So the crawl keeps a cursor in `crawl_state` and each cron run picks
 * it up, works until its time budget is nearly spent, and puts it down again:
 * lease listings into the rent database first (so yields are computed on fresh
 * rents), then for-sale listings province by province, each province's city and
 * postal-area aggregates rebuilt from the database the moment it completes.
 * After the last province it rests until the next day.
 *
 * It runs where the feed credentials already live — no second scheduler, no
 * second copy of the secrets. `scripts/sync-ddf.ts` remains for a manual run.
 */

const JOB = "ddf";
const PAGE_SIZE = 100;
/** Leave room to finish the page in hand and write the cursor before the platform's limit. */
const DEFAULT_BUDGET_MS = 235_000;
const LEASE_MS = 330_000;
const REST_MS = 20 * 60 * 60 * 1000;
const PAGE_DELAY_MS = 300;
const MIN_LISTINGS_FOR_YIELD = 5;
/** A safety stop per province, far above any real one (Ontario ≈ 900 pages). */
const MAX_PAGES_PER_PROVINCE = 3000;

export interface CrawlRunSummary {
  outcome: "not_configured" | "busy" | "resting" | "worked" | "finished";
  stage: string;
  province: string | null;
  pages: number;
  rentsSeen: number;
  listingsStored: number;
}

const monthOf = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

/** Take the cursor, or learn that someone else is holding it. One statement, so two runs can't both win. */
async function acquire(now: Date): Promise<CrawlState | null> {
  const db = getDb();
  await db.insert(crawlState).values({ job: JOB, stage: "rents", month: monthOf(now), startedAt: now }).onConflictDoNothing();
  const [held] = await db
    .update(crawlState)
    .set({ leaseUntil: new Date(now.getTime() + LEASE_MS), updatedAt: now })
    .where(and(eq(crawlState.job, JOB), or(isNull(crawlState.leaseUntil), lt(crawlState.leaseUntil, now))))
    .returning();
  return held ?? null;
}

async function save(patch: Partial<CrawlState>): Promise<void> {
  await getDb().update(crawlState).set({ ...patch, updatedAt: new Date() }).where(eq(crawlState.job, JOB));
}

/** City and postal-area aggregates for one province, from what the crawl just stored. */
export async function aggregateProvinceFromDb(ddfProvince: string, month: string): Promise<number> {
  const province = PROVINCE_TO_ABBREV[ddfProvince] || ddfProvince;
  const rows = await getDb()
    .select({
      city: ddfListingSnapshots.city,
      postalCode: ddfListingSnapshots.postalCode,
      grossYield: ddfListingSnapshots.grossYield,
      netYield: ddfListingSnapshots.netYield,
      listPrice: ddfListingSnapshots.listPrice,
      estimatedMonthlyRent: ddfListingSnapshots.estimatedMonthlyRent,
      daysOnMarket: ddfListingSnapshots.daysOnMarket,
      bedroomsTotal: ddfListingSnapshots.bedroomsTotal,
      livingArea: ddfListingSnapshots.livingArea,
      propertySubType: ddfListingSnapshots.propertySubType,
      structureType: ddfListingSnapshots.structureType,
    })
    .from(ddfListingSnapshots)
    .where(and(eq(ddfListingSnapshots.province, province), eq(ddfListingSnapshots.snapshotMonth, month)));

  const group = (key: (row: (typeof rows)[number]) => string | null) => {
    const groups = new Map<string, Array<(typeof rows)[number]>>();
    for (const row of rows) {
      const name = key(row);
      if (!name) continue;
      const bucket = groups.get(name);
      if (bucket) bucket.push(row);
      else groups.set(name, [row]);
    }
    return groups;
  };

  let written = 0;
  for (const [city, members] of group((row) => row.city || "Unknown")) {
    if (members.length < MIN_LISTINGS_FOR_YIELD) continue;
    const metrics = aggregateYieldMetrics(members as YieldMetricInput[]);
    await upsertCityYieldHistory({ city, province, month, ...metrics });
    await upsertAreaYieldHistory({ areaType: "city", areaKey: city.toLowerCase(), areaName: city, city, province, month, ...metrics });
    written += 1;
  }
  for (const [area, members] of group((row) => normalizePostalArea(row.postalCode))) {
    if (members.length < MIN_LISTINGS_FOR_YIELD) continue;
    await upsertAreaYieldHistory({
      areaType: "postal_fsa",
      areaKey: area,
      areaName: `${area} · ${members[0]?.city || area}`,
      city: null,
      province,
      month,
      ...aggregateYieldMetrics(members as YieldMetricInput[]),
    });
    written += 1;
  }
  return written;
}

/** One page of lease listings into the rent database. Returns how many the API sent (0 = province done). */
async function rentPage(province: string, page: number): Promise<{ fetched: number; mapped: number }> {
  const result = await searchDdfListings({ stateOrProvince: province, forLease: true, top: PAGE_SIZE, skip: page * PAGE_SIZE, orderBy: "ListingKey" });
  const seen = new Set<string>();
  const rows: RentObservationRow[] = [];
  for (const listing of result.listings) {
    const row = ddfLeaseToRentObservation(listing);
    if (row && !seen.has(row.externalId)) {
      seen.add(row.externalId);
      rows.push(row);
    }
  }
  if (rows.length) await upsertObservations(rows, false);
  return { fetched: result.rawPageSize, mapped: rows.length };
}

/**
 * Work the crawl forward for one time budget. Safe to call as often as you like:
 * a second caller finds the cursor held and leaves; a finished crawl rests a day.
 */
export async function runCrawlSlice(options: { budgetMs?: number; now?: Date } = {}): Promise<CrawlRunSummary> {
  const started = Date.now();
  const budget = options.budgetMs ?? DEFAULT_BUDGET_MS;
  const now = options.now ?? new Date();
  const idle = (outcome: CrawlRunSummary["outcome"], state?: CrawlState | null): CrawlRunSummary => ({
    outcome,
    stage: state?.stage ?? "unknown",
    province: null,
    pages: 0,
    rentsSeen: state?.rentsSeen ?? 0,
    listingsStored: state?.listingsStored ?? 0,
  });
  if (!isDdfConfigured()) return idle("not_configured");

  let state = await acquire(now);
  if (!state) return idle("busy");

  try {
    if (state.stage === "done") {
      if (state.finishedAt && now.getTime() - state.finishedAt.getTime() < REST_MS) return idle("resting", state);
      const fresh = { stage: "rents", month: monthOf(now), provinceIndex: 0, page: 0, nextLink: null, rentsSeen: 0, listingsStored: 0, skippedPages: 0, startedAt: now, finishedAt: null };
      await save(fresh);
      state = { ...state, ...fresh };
    }

    const month = state.month ?? monthOf(now);
    const rentMemo: RentMemo = new Map();
    let pages = 0;
    let { stage, provinceIndex, page, nextLink, rentsSeen, listingsStored, skippedPages } = state;
    const timeLeft = () => Date.now() - started < budget;

    while (timeLeft() && stage === "rents") {
      const province = DEFAULT_PROVINCES[provinceIndex];
      if (!province) {
        await rebuildRentPulse();
        stage = "listings";
        provinceIndex = 0;
        page = 0;
        nextLink = null;
        await save({ stage, provinceIndex, page, nextLink });
        break;
      }
      let fetched = 0;
      try {
        const result = await rentPage(province, page);
        fetched = result.fetched;
        rentsSeen += result.mapped;
      } catch (error) {
        console.error(`[crawl] rents ${province} page ${page + 1}:`, (error as Error).message);
        skippedPages += 1;
        fetched = PAGE_SIZE; // a failed page is skipped, not mistaken for the end of the province
      }
      pages += 1;
      if (fetched < PAGE_SIZE || page + 1 >= MAX_PAGES_PER_PROVINCE) {
        provinceIndex += 1;
        page = 0;
      } else page += 1;
      await save({ provinceIndex, page, rentsSeen, skippedPages });
      await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS));
    }

    while (timeLeft() && stage === "listings") {
      const province = CRAWL_PROVINCES[provinceIndex];
      if (!province) {
        stage = "done";
        await save({ stage, finishedAt: new Date(), nextLink: null });
        console.log(`[crawl] finished ${month}: ${listingsStored} listings stored, ${rentsSeen} rents seen, ${skippedPages} pages skipped`);
        break;
      }
      const result = await fetchDdfPageWithRetry(
        {
          stateOrProvince: province,
          excludeBusinessSales: true,
          excludeParking: true,
          excludeVacantLand: true,
          top: PAGE_SIZE,
          orderBy: "ListingKey",
          ...(nextLink ? { nextLink } : { skip: page * PAGE_SIZE }),
        },
        `${province} page ${page + 1}`,
      );
      pages += 1;
      let provinceDone = false;
      if (!result) {
        skippedPages += 1;
        nextLink = null;
        page += 1;
      } else {
        const snapshots = [];
        for (const listing of result.listings) {
          if (!listing.ListPrice || listing.ListPrice <= 0 || isVacantLandLikeProperty(listing)) continue;
          snapshots.push(await buildSnapshot(listing, province, month, rentMemo));
        }
        if (snapshots.length) listingsStored += await insertSnapshotsBatch(snapshots);
        nextLink = result.nextLink;
        page += 1;
        provinceDone = result.rawPageSize < PAGE_SIZE;
      }
      if (provinceDone || page >= MAX_PAGES_PER_PROVINCE) {
        await aggregateProvinceFromDb(province, month);
        provinceIndex += 1;
        page = 0;
        nextLink = null;
      }
      await save({ provinceIndex, page, nextLink, listingsStored, skippedPages });
      await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS));
    }

    return {
      outcome: stage === "done" ? "finished" : "worked",
      stage,
      province: (stage === "rents" ? DEFAULT_PROVINCES : CRAWL_PROVINCES)[provinceIndex] ?? null,
      pages,
      rentsSeen,
      listingsStored,
    };
  } finally {
    await getDb().update(crawlState).set({ leaseUntil: null }).where(eq(crawlState.job, JOB)).catch(() => {});
  }
}

/** Where the crawl stands — for the people running the site. */
export async function getCrawlProgress(): Promise<Pick<CrawlState, "stage" | "month" | "provinceIndex" | "page" | "rentsSeen" | "listingsStored" | "skippedPages" | "startedAt" | "finishedAt" | "updatedAt"> | null> {
  const [row] = await getDb().select().from(crawlState).where(eq(crawlState.job, JOB)).limit(1);
  return row ?? null;
}

/** Listings the crawl has seen in the last week — what yield browse, buy boxes and the Monday note draw on. */
export async function freshSnapshotCount(): Promise<number> {
  const result = await getDb().execute(sql`SELECT count(*)::int AS n FROM ddf_listing_snapshots WHERE captured_at >= now() - interval '7 days'`);
  const rows = (Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])) as Array<{ n: number }>;
  return Number(rows[0]?.n ?? 0);
}
