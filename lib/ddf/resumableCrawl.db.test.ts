import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { areaYieldHistory, crawlState, ddfListingSnapshots } from "@/lib/db/schema";
import { useTestDb } from "@/lib/test/db";
import { CRAWL_PROVINCES } from "./crawler";
import { forgetDdfOffices, forgetDdfSchemaRejections } from "./client";
import { runCrawlSlice } from "./resumableCrawl";

let ctx: Awaited<ReturnType<typeof useTestDb>>;
beforeAll(async () => {
  ctx = await useTestDb();
}, 60_000);
afterAll(async () => ctx.close());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** A tiny CREA: two pages of for-sale listings in the first province, nothing anywhere else, no rentals. */
function fakeCrea() {
  const calls: string[] = [];
  vi.stubEnv("CREA_DDF_USERNAME", "u");
  vi.stubEnv("CREA_DDF_PASSWORD", "p");
  const listing = (n: number) => ({ ListingKey: `K${n}`, ListingId: `X${n}`, ListPrice: 500_000 + n * 1000, City: "Testville", PostalCode: "T2P1P8", BedroomsTotal: 3, PropertySubType: "Single Family", ListOfficeKey: "77" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const target = String(input);
      if (target.includes("/connect/token")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
      if (target.includes("/Office")) return new Response(JSON.stringify({ value: [{ OfficeKey: "77", OfficeName: "Test Realty, Brokerage" }] }), { status: 200 });
      const query = new URL(target).searchParams;
      calls.push(`${query.get("$filter")} skip=${query.get("$skip") ?? 0}`);
      const filter = query.get("$filter") ?? "";
      const firstProvince = filter.includes(`StateOrProvince eq '${CRAWL_PROVINCES[0]}'`);
      if (filter.includes("LeaseAmount ne null") || !firstProvince) return new Response(JSON.stringify({ "@odata.count": 0, value: [] }), { status: 200 });
      const skip = Number(query.get("$skip") ?? 0);
      const value = skip === 0 ? Array.from({ length: 100 }, (_, i) => listing(i)) : skip === 100 ? Array.from({ length: 7 }, (_, i) => listing(100 + i)) : [];
      return new Response(JSON.stringify({ "@odata.count": 107, value }), { status: 200 });
    }),
  );
  return calls;
}

describe("the data sync, in slices", () => {
  it("picks up where the last run stopped, finishes, and then rests", async () => {
    forgetDdfSchemaRejections();
    forgetDdfOffices();
    fakeCrea();

    // A budget of zero still does nothing harmful: it takes the cursor and puts it down.
    const first = await runCrawlSlice({ budgetMs: 0 });
    expect(first).toMatchObject({ outcome: "worked", stage: "rents", pages: 0 });

    // Enough budget to finish everything the tiny feed has.
    let last = await runCrawlSlice({ budgetMs: 60_000 });
    for (let i = 0; i < 5 && last.outcome !== "finished"; i += 1) last = await runCrawlSlice({ budgetMs: 60_000 });
    expect(last.outcome).toBe("finished");
    expect(last.listingsStored).toBe(107);

    const stored = await ctx.db.select().from(ddfListingSnapshots);
    expect(stored).toHaveLength(107);
    expect(stored[0]).toMatchObject({ city: "Testville", postalCode: "T2P 1P8" });
    expect((stored[0].rawJson as { listOfficeName?: string }).listOfficeName).toBe("Test Realty, Brokerage");
    // The province's aggregates were rebuilt from the database when it completed.
    const areas = await ctx.db.select().from(areaYieldHistory).where(eq(areaYieldHistory.areaType, "city"));
    expect(areas.map((row) => row.areaName)).toEqual(["Testville"]);

    // Finished today: the next call rests instead of crawling again.
    expect((await runCrawlSlice({ budgetMs: 60_000 })).outcome).toBe("resting");
    // Tomorrow it starts over.
    const tomorrow = new Date(Date.now() + 21 * 60 * 60 * 1000);
    expect((await runCrawlSlice({ budgetMs: 0, now: tomorrow })).stage).toBe("rents");
  }, 120_000);

  it("never lets two runs advance the same cursor", async () => {
    fakeCrea();
    await ctx.db.update(crawlState).set({ leaseUntil: new Date(Date.now() + 60_000) });
    expect((await runCrawlSlice({ budgetMs: 1000 })).outcome).toBe("busy");
    await ctx.db.update(crawlState).set({ leaseUntil: null });
  });

  it("does nothing without feed credentials", async () => {
    vi.stubEnv("CREA_DDF_USERNAME", "");
    vi.stubEnv("CREA_DDF_PASSWORD", "");
    expect((await runCrawlSlice()).outcome).toBe("not_configured");
  });
});
