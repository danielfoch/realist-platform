import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./creaDdf", () => ({
  searchDdfListings: vi.fn(),
  isDdfConfigured: vi.fn(() => true),
}));
vi.mock("./storage", () => ({ storage: {} }));
vi.mock("./db", () => ({ db: {} }));
vi.mock("./notifications", () => ({
  queueDdfListingChangeNotifications: vi.fn(),
  queueDdfListingRemovedNotifications: vi.fn(),
  queueSavedSearchMatchNotificationsForDdf: vi.fn(),
}));
vi.mock("./salePriceOracle", () => ({
  lookupSoldPriceForListing: vi.fn(),
  markListingsAbsent: vi.fn(),
  markListingsSeenFromActiveFeed: vi.fn(),
}));

import { searchDdfListings } from "./creaDdf";
import { crawlDdfForProvince } from "./ddfYieldCrawler";

const searchMock = vi.mocked(searchDdfListings);

function ddfListing(key: string, listPrice?: number) {
  return {
    ListingKey: key,
    ListingId: `MLS-${key}`,
    ListPrice: listPrice,
    City: "Toronto",
    StateOrProvince: "Ontario",
    StandardStatus: "Active",
  };
}

function pageResult(listings: any[], rawPageSize: number, nextLink: string | null = null) {
  return {
    listings,
    count: rawPageSize,
    numPages: 1,
    page: 1,
    rawPageSize,
    nextLink,
  };
}

describe("crawlDdfForProvince", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
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
    const snapshots = await promise;

    expect(searchMock).toHaveBeenCalledTimes(2);
    expect(searchMock.mock.calls[1][0]).toMatchObject({ skip: 100 });
    expect(snapshots).toHaveLength(100);
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
    const snapshots = await promise;

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
    const snapshots = await promise;

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
    const snapshots = await promise;

    // 3 failed attempts on page 0, then page 1 fetched via manual $skip.
    expect(searchMock).toHaveBeenCalledTimes(4);
    expect(searchMock.mock.calls[3][0]).toMatchObject({ skip: 100 });
    expect(snapshots).toHaveLength(25);
  });
});
