import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  // db.select().from().where() resolves the next queued result, or [] when
  // the queue is empty. The full crawl issues three selects for a province
  // with listings (existing-for-province, existing-by-key, current-by-key)
  // and one for a province with none.
  const selectQueue: any[][] = [];
  const select = vi.fn(() => ({
    from: () => ({
      where: async () => selectQueue.shift() ?? [],
    }),
  }));
  const execute = vi.fn(async () => ({ rows: [] }));
  const lockClient = {
    query: vi.fn(async (text: string) =>
      text.includes("pg_try_advisory_lock") ? { rows: [{ locked: true }] } : { rows: [] }),
    release: vi.fn(),
  };
  const pool = { connect: vi.fn(async () => lockClient) };
  const storage = {
    insertDdfListingSnapshotsBatch: vi.fn(async (rows: any[]) => rows.length),
    insertDdfPriceHistoryBatch: vi.fn(async (rows: any[]) => rows.length),
    startDdfCrawlRun: vi.fn(async (data: any) => ({ id: "run-1", status: "running", ...data })),
    updateDdfCrawlRun: vi.fn(async () => undefined),
    getLatestDdfCrawlRun: vi.fn(async () => undefined),
    listDdfCrawlRuns: vi.fn(async () => []),
    upsertCityYieldHistory: vi.fn(async (data: any) => data),
    upsertAreaYieldHistory: vi.fn(async (data: any) => data),
  };
  return { selectQueue, select, execute, lockClient, pool, storage };
});

vi.mock("./creaDdf", () => ({
  searchDdfListings: vi.fn(),
  isDdfConfigured: vi.fn(() => true),
}));
vi.mock("./storage", () => ({ storage: mocks.storage }));
vi.mock("./db", () => ({ db: { select: mocks.select, execute: mocks.execute }, pool: mocks.pool }));
vi.mock("./notifications", () => ({
  queueDdfListingChangeNotifications: vi.fn(async () => undefined),
  queueDdfListingRemovedNotifications: vi.fn(async () => undefined),
  queueSavedSearchMatchNotificationsForDdf: vi.fn(async () => undefined),
}));
vi.mock("./salePriceOracle", () => ({
  lookupSoldPriceForListing: vi.fn(async () => undefined),
  markListingsAbsent: vi.fn(async () => ({ lockedEstimateCount: 0 })),
  markListingsSeenFromActiveFeed: vi.fn(async () => undefined),
}));

import { searchDdfListings, isDdfConfigured } from "./creaDdf";
import {
  CRAWL_PROVINCES,
  PROVINCE_TO_ABBREV,
  buildPriceHistoryRows,
  crawlDdfForProvince,
  runDdfYieldCrawl,
  shouldRunStartupCatchUp,
} from "./ddfYieldCrawler";

const searchMock = vi.mocked(searchDdfListings);

function ddfListing(key: string, listPrice?: number, status: string = "Active") {
  return {
    ListingKey: key,
    ListingId: `MLS-${key}`,
    ListPrice: listPrice,
    City: "Toronto",
    StateOrProvince: "Ontario",
    StandardStatus: status,
  };
}

function pageResult(listings: any[], rawPageSize: number, nextLink: string | null = null, count = rawPageSize) {
  return {
    listings,
    count,
    numPages: 1,
    page: 1,
    rawPageSize,
    nextLink,
  };
}

/** A stored ddf_listing_snapshots row, as the crawl's db.select() returns it. */
function storedSnapshot(key: string, listPrice: number, status: string = "Active", month = "2026-07") {
  return {
    listingKey: key,
    mlsNumber: `MLS-${key}`,
    city: "Toronto",
    province: "ON",
    listPrice,
    rawJson: { standardStatus: status },
    snapshotMonth: month,
  };
}

function silenceConsole() {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
}

describe("CRAWL_PROVINCES", () => {
  it("covers all thirteen provinces and territories with DDF's full-name spelling", () => {
    expect(CRAWL_PROVINCES).toHaveLength(13);
    expect(CRAWL_PROVINCES).toEqual(expect.arrayContaining(["Yukon", "Northwest Territories", "Nunavut"]));
    expect(PROVINCE_TO_ABBREV["Yukon"]).toBe("YT");
    expect(PROVINCE_TO_ABBREV["Northwest Territories"]).toBe("NT");
    expect(PROVINCE_TO_ABBREV["Nunavut"]).toBe("NU");
    for (const province of CRAWL_PROVINCES) {
      expect(PROVINCE_TO_ABBREV[province], `${province} has no abbreviation`).toMatch(/^[A-Z]{2}$/);
    }
  });
});

describe("crawlDdfForProvince", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    silenceConsole();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    searchMock.mockReset();
  });

  it("keeps paging while raw pages are full even when client-side filters shrink the kept count", async () => {
    // Page 1: 100 raw rows, but 40 have no ListPrice and are dropped — kept
    // count (60) is below pageSize, which used to terminate the crawl early.
    const pageOne = Array.from({ length: 100 }, (_, i) =>
      ddfListing(`p1-${i}`, i < 60 ? 500000 + i : undefined));
    const pageTwo = Array.from({ length: 40 }, (_, i) => ddfListing(`p2-${i}`, 700000 + i));

    searchMock
      .mockResolvedValueOnce(pageResult(pageOne, 100) as any)
      .mockResolvedValueOnce(pageResult(pageTwo, 40) as any);

    const promise = crawlDdfForProvince("Ontario", "2026-07", {});
    await vi.runAllTimersAsync();
    const { snapshots, pages, truncated } = await promise;

    expect(searchMock).toHaveBeenCalledTimes(2);
    expect(searchMock.mock.calls[1][0]).toMatchObject({ skip: 100 });
    expect(snapshots).toHaveLength(100);
    expect(pages).toBe(2);
    expect(truncated).toBe(false);
  });

  it("follows @odata.nextLink when present and falls back to manual $skip when absent", async () => {
    const nextLinkUrl = "https://ddfapi.realtor.ca/odata/v1/Property?%24skiptoken=xyz";
    const pageOne = Array.from({ length: 100 }, (_, i) => ddfListing(`n1-${i}`, 400000 + i));
    const pageTwo = Array.from({ length: 10 }, (_, i) => ddfListing(`n2-${i}`, 800000 + i));

    searchMock
      .mockResolvedValueOnce(pageResult(pageOne, 100, nextLinkUrl) as any)
      .mockResolvedValueOnce(pageResult(pageTwo, 10) as any);

    const promise = crawlDdfForProvince("Ontario", "2026-07", {});
    await vi.runAllTimersAsync();
    const { snapshots } = await promise;

    expect(searchMock).toHaveBeenCalledTimes(2);
    const secondCallParams = searchMock.mock.calls[1][0] as any;
    expect(secondCallParams.nextLink).toBe(nextLinkUrl);
    expect(secondCallParams.skip).toBeUndefined();
    expect(snapshots).toHaveLength(110);
  });

  it("retries a failed page with backoff before succeeding", async () => {
    const pageOne = Array.from({ length: 100 }, (_, i) => ddfListing(`r1-${i}`, 300000 + i));

    searchMock
      .mockRejectedValueOnce(new Error("HTTP 503"))
      .mockRejectedValueOnce(new Error("HTTP 503"))
      .mockResolvedValueOnce(pageResult(pageOne, 100) as any)
      .mockResolvedValueOnce(pageResult([], 0) as any);

    const promise = crawlDdfForProvince("Ontario", "2026-07", {});
    await vi.runAllTimersAsync();
    const { snapshots } = await promise;

    expect(searchMock).toHaveBeenCalledTimes(4);
    expect(snapshots).toHaveLength(100);
  });

  it("skips a page that fails every retry and continues with the next page", async () => {
    const pageTwo = Array.from({ length: 25 }, (_, i) => ddfListing(`s2-${i}`, 900000 + i));

    searchMock
      .mockRejectedValueOnce(new Error("HTTP 500"))
      .mockRejectedValueOnce(new Error("HTTP 500"))
      .mockRejectedValueOnce(new Error("HTTP 500"))
      .mockResolvedValueOnce(pageResult(pageTwo, 25) as any);

    const promise = crawlDdfForProvince("Ontario", "2026-07", {});
    await vi.runAllTimersAsync();
    const { snapshots } = await promise;

    // 3 failed attempts on page 0, then page 1 fetched via manual $skip.
    expect(searchMock).toHaveBeenCalledTimes(4);
    expect(searchMock.mock.calls[3][0]).toMatchObject({ skip: 100 });
    expect(snapshots).toHaveLength(25);
  });

  it("keeps following nextLink past the old 500-page cap until the feed is exhausted", async () => {
    // 600 full pages of one listing each, then an empty page. The old hard
    // cap of 500 pages would have dropped the last 100 silently.
    const totalPages = 600;
    let served = 0;
    searchMock.mockImplementation(async () => {
      if (served >= totalPages) return pageResult([], 0, null, totalPages) as any;
      const i = served++;
      return pageResult([ddfListing(`big-${i}`, 100000 + i)], 1, `https://ddf/next?page=${i + 1}`, totalPages) as any;
    });

    const promise = crawlDdfForProvince("Ontario", "2026-07", {}, "Active", { pageSize: 1 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(searchMock).toHaveBeenCalledTimes(totalPages + 1);
    expect(result.snapshots).toHaveLength(totalPages);
    expect(result.pages).toBe(totalPages + 1);
    expect(result.truncated).toBe(false);
    expect(result.apiCount).toBe(totalPages);
  });

  it("flags truncated=true and warns loudly when the page ceiling stops a still-full feed", async () => {
    let served = 0;
    searchMock.mockImplementation(async () => {
      const i = served++;
      return pageResult([ddfListing(`inf-${i}`, 200000 + i)], 1, `https://ddf/next?page=${i + 1}`, 999999) as any;
    });

    const promise = crawlDdfForProvince("Ontario", "2026-07", {}, "Active", { pageSize: 1, maxPages: 7 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(searchMock).toHaveBeenCalledTimes(7);
    expect(result.snapshots).toHaveLength(7);
    expect(result.pages).toBe(7);
    expect(result.truncated).toBe(true);
    expect(vi.mocked(console.warn)).toHaveBeenCalledWith(expect.stringContaining("[ddf-crawler][truncated]"));
  });
});

describe("buildPriceHistoryRows", () => {
  it("emits a row only for listings that are new this month or changed price/status", () => {
    const previous = new Map<string, any>([
      ["same", storedSnapshot("same", 500000)],
      ["cut", storedSnapshot("cut", 600000)],
      ["status", storedSnapshot("status", 700000, "Active")],
    ]);
    const current = [
      storedSnapshot("same", 500000),
      storedSnapshot("cut", 550000),
      storedSnapshot("status", 700000, "Pending"),
      storedSnapshot("brand-new", 800000),
    ];

    const rows = buildPriceHistoryRows(current, previous);

    expect(rows.map((r) => r.listingKey).sort()).toEqual(["brand-new", "cut", "status"]);
    expect(rows.find((r) => r.listingKey === "cut")).toMatchObject({
      listPrice: 550000,
      standardStatus: "Active",
      snapshotMonth: "2026-07",
      province: "ON",
      city: "Toronto",
      mlsNumber: "MLS-cut",
    });
    expect(rows.find((r) => r.listingKey === "status")).toMatchObject({ listPrice: 700000, standardStatus: "Pending" });
  });

  it("emits nothing when every listing is unchanged", () => {
    const previous = new Map<string, any>([["a", storedSnapshot("a", 1)], ["b", storedSnapshot("b", 2)]]);
    expect(buildPriceHistoryRows([storedSnapshot("a", 1), storedSnapshot("b", 2)], previous)).toEqual([]);
  });
});

describe("runDdfYieldCrawl", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    silenceConsole();
    vi.mocked(isDdfConfigured).mockReturnValue(true);
    mocks.selectQueue.length = 0;
    for (const fn of Object.values(mocks.storage)) fn.mockClear();
    mocks.lockClient.query.mockClear();
    mocks.lockClient.release.mockClear();
    mocks.pool.connect.mockClear();
    mocks.execute.mockClear();
    mocks.lockClient.query.mockImplementation(async (text: string) =>
      text.includes("pg_try_advisory_lock") ? { rows: [{ locked: true }] } : { rows: [] });
    // Every province is empty unless a test queues pages for it.
    searchMock.mockResolvedValue(pageResult([], 0) as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    searchMock.mockReset();
  });

  it("starts a ledger row, checkpoints per province, writes price history on change, and finalizes", async () => {
    // Ontario returns three listings: one unchanged, one price cut, one new.
    const ontarioPage = [
      ddfListing("same", 500000),
      ddfListing("cut", 550000),
      ddfListing("brand-new", 800000),
    ];
    searchMock.mockImplementation(async (params: any) =>
      (params.stateOrProvince === "Ontario" && !params.skip && !params.nextLink
        ? pageResult(ontarioPage, 3, null, 3)
        : pageResult([], 0)) as any);

    const previous = [storedSnapshot("same", 500000), storedSnapshot("cut", 600000)];
    const afterUpsert = [storedSnapshot("same", 500000), storedSnapshot("cut", 550000), storedSnapshot("brand-new", 800000)];
    mocks.selectQueue.push(previous, previous, afterUpsert);

    const promise = runDdfYieldCrawl("2026-07", { trigger: "cron" });
    await vi.runAllTimersAsync();
    const summary = await promise;

    expect(summary).toMatchObject({
      month: "2026-07",
      status: "completed",
      runId: "run-1",
      totalListings: 3,
      provincesCompleted: CRAWL_PROVINCES.length,
      truncated: false,
    });

    // Tables are ensured before anything touches the ledger.
    expect(mocks.execute).toHaveBeenCalled();

    expect(mocks.storage.startDdfCrawlRun).toHaveBeenCalledWith({
      trigger: "cron",
      snapshotMonth: "2026-07",
      provincesTotal: CRAWL_PROVINCES.length,
    });

    // Price history: only the cut and the new listing, never the unchanged one.
    expect(mocks.storage.insertDdfPriceHistoryBatch).toHaveBeenCalledTimes(1);
    const historyRows = mocks.storage.insertDdfPriceHistoryBatch.mock.calls[0][0] as any[];
    expect(historyRows.map((r) => r.listingKey).sort()).toEqual(["brand-new", "cut"]);

    // One checkpoint per province plus the final write.
    const updates = mocks.storage.updateDdfCrawlRun.mock.calls;
    expect(updates.length).toBe(CRAWL_PROVINCES.length + 1);
    expect(updates.every(([id]) => id === "run-1")).toBe(true);
    const finalPatch = updates[updates.length - 1][1] as any;
    expect(finalPatch).toMatchObject({ status: "completed", totalListings: 3, provincesCompleted: CRAWL_PROVINCES.length, truncated: false });
    expect(finalPatch.finishedAt).toBeInstanceOf(Date);
    expect(finalPatch.perProvince).toHaveLength(CRAWL_PROVINCES.length);
    expect(finalPatch.perProvince[0]).toMatchObject({ province: "ON", stored: 3, apiCount: 3, ratio: 1, pages: 1 });

    // Advisory lock taken on a dedicated client and released on the same one.
    expect(mocks.pool.connect).toHaveBeenCalledTimes(1);
    expect(mocks.lockClient.query.mock.calls[0][0]).toContain("pg_try_advisory_lock");
    expect(mocks.lockClient.query.mock.calls.at(-1)?.[0]).toContain("pg_advisory_unlock");
    expect(mocks.lockClient.release).toHaveBeenCalledTimes(1);
  });

  it("records a skipped run and does not crawl when another instance holds the advisory lock", async () => {
    mocks.lockClient.query.mockImplementation(async () => ({ rows: [{ locked: false }] }));

    const promise = runDdfYieldCrawl("2026-07", { trigger: "startup" });
    await vi.runAllTimersAsync();
    const summary = await promise;

    expect(summary.status).toBe("skipped");
    expect(searchMock).not.toHaveBeenCalled();
    expect(mocks.storage.startDdfCrawlRun).toHaveBeenCalledWith(expect.objectContaining({ trigger: "startup" }));
    expect(mocks.storage.updateDdfCrawlRun).toHaveBeenCalledWith("run-1", expect.objectContaining({ status: "skipped" }));
    // Lost the lock: the client goes straight back to the pool, no unlock.
    expect(mocks.lockClient.release).toHaveBeenCalledTimes(1);
    expect(mocks.lockClient.query.mock.calls.some(([text]) => String(text).includes("pg_advisory_unlock"))).toBe(false);
  });

  it("marks the run truncated when a province hits the page ceiling", async () => {
    // Ontario serves full pages forever; a 5-page ceiling stands in for the
    // production 5,000 so the test stays instant.
    let served = 0;
    searchMock.mockImplementation(async (params: any) => {
      if (params.stateOrProvince !== "Ontario") return pageResult([], 0) as any;
      const i = served++;
      return pageResult([ddfListing(`t-${i}`, 100000 + i)], 1, `https://ddf/next?page=${i + 1}`, 10_000_000) as any;
    });

    const promise = runDdfYieldCrawl("2026-07", { trigger: "manual", pageOptions: { pageSize: 1, maxPages: 5 } });
    await vi.runAllTimersAsync();
    const summary = await promise;

    expect(summary.truncated).toBe(true);
    expect(summary.status).toBe("completed");
    expect(summary.totalListings).toBe(5);
    const finalPatch = mocks.storage.updateDdfCrawlRun.mock.calls.at(-1)?.[1] as any;
    expect(finalPatch.truncated).toBe(true);
    expect(finalPatch.perProvince[0]).toMatchObject({ province: "ON", truncated: true, pages: 5, stored: 5 });
  });
});

describe("shouldRunStartupCatchUp", () => {
  const now = new Date("2026-09-02T12:00:00Z");

  it("catches up when no crawl has ever completed", () => {
    expect(shouldRunStartupCatchUp(null, now)).toBe(true);
    expect(shouldRunStartupCatchUp(undefined, now)).toBe(true);
  });

  it("catches up only when the last completed crawl is older than 26 hours", () => {
    expect(shouldRunStartupCatchUp(new Date("2026-09-01T12:00:00Z"), now)).toBe(false);
    expect(shouldRunStartupCatchUp(new Date("2026-09-01T09:59:00Z"), now)).toBe(true);
  });
});
