import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adaptDdfUrl, forgetDdfSchemaRejections, learnFromDdfError, searchDdfListings } from "./client";

describe("searchDdfListings", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("retries without $select when CREA rejects the field projection", async () => {
    vi.stubEnv("CREA_DDF_USERNAME", "test-client");
    vi.stubEnv("CREA_DDF_PASSWORD", "test-secret");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "token",
        token_type: "Bearer",
        expires_in: 3600,
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response("Unknown selected property", { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        "@odata.count": 1,
        value: [{ ListingKey: "123", ListingId: "C123", ListPrice: 900000 }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { searchDdfListings } = await import("./client");
    const result = await searchDdfListings({ top: 1 });

    expect(result.listings).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const firstSearchUrl = String(fetchMock.mock.calls[1][0]);
    const fallbackSearchUrl = String(fetchMock.mock.calls[2][0]);
    expect(firstSearchUrl).toContain("%24select=");
    expect(fallbackSearchUrl).not.toContain("%24select=");
    expect(fallbackSearchUrl).toContain("%24filter=");
  });

  it("reports rawPageSize from the raw page even when client-side filters drop listings", async () => {
    vi.stubEnv("CREA_DDF_USERNAME", "test-client");
    vi.stubEnv("CREA_DDF_PASSWORD", "test-secret");
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "token",
        token_type: "Bearer",
        expires_in: 3600,
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        "@odata.count": 2,
        value: [
          { ListingKey: "1", ListPrice: 500000, PropertySubType: "Parking" },
          { ListingKey: "2", ListPrice: 600000, PropertySubType: "Single Family" },
        ],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { searchDdfListings } = await import("./client");
    const result = await searchDdfListings({ excludeParking: true, top: 100 });

    expect(result.listings).toHaveLength(1);
    expect(result.rawPageSize).toBe(2);
  });

  it("returns the server-provided @odata.nextLink and fetches it verbatim when passed back", async () => {
    vi.stubEnv("CREA_DDF_USERNAME", "test-client");
    vi.stubEnv("CREA_DDF_PASSWORD", "test-secret");
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const nextLinkUrl = "https://ddfapi.realtor.ca/odata/v1/Property?%24skiptoken=abc123";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "token",
        token_type: "Bearer",
        expires_in: 3600,
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        "@odata.count": 3,
        "@odata.nextLink": nextLinkUrl,
        value: [{ ListingKey: "1", ListPrice: 500000 }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        "@odata.count": 3,
        value: [{ ListingKey: "2", ListPrice: 600000 }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { searchDdfListings } = await import("./client");
    const firstPage = await searchDdfListings({ top: 1 });
    expect(firstPage.nextLink).toBe(nextLinkUrl);

    const secondPage = await searchDdfListings({ nextLink: firstPage.nextLink! });
    expect(secondPage.listings).toHaveLength(1);
    expect(secondPage.nextLink).toBeNull();
    expect(String(fetchMock.mock.calls[2][0])).toBe(nextLinkUrl);
  });

  it("filters on Active status by default and honors a standardStatus override", async () => {
    vi.stubEnv("CREA_DDF_USERNAME", "test-client");
    vi.stubEnv("CREA_DDF_PASSWORD", "test-secret");
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const searchResponse = () => new Response(JSON.stringify({
      "@odata.count": 0,
      value: [],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "token",
        token_type: "Bearer",
        expires_in: 3600,
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockImplementation(searchResponse);
    vi.stubGlobal("fetch", fetchMock);

    const { searchDdfListings } = await import("./client");
    await searchDdfListings({ top: 1 });
    await searchDdfListings({ top: 1, standardStatus: "Pending" });

    const defaultUrl = String(fetchMock.mock.calls[1][0]);
    const pendingUrl = String(fetchMock.mock.calls[2][0]);
    expect(defaultUrl).toContain("Active");
    expect(pendingUrl).toContain("Pending");
    expect(pendingUrl).not.toContain("Active");
  });

  it("orders by ModificationTimestamp with a ListingKey tie-breaker", async () => {
    vi.stubEnv("CREA_DDF_USERNAME", "test-client");
    vi.stubEnv("CREA_DDF_PASSWORD", "test-secret");
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "token",
        token_type: "Bearer",
        expires_in: 3600,
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        "@odata.count": 0,
        value: [],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { searchDdfListings } = await import("./client");
    await searchDdfListings({ top: 1 });

    const searchUrl = String(fetchMock.mock.calls[1][0]);
    expect(decodeURIComponent(searchUrl.replace(/\+/g, " "))).toContain("$orderby=ModificationTimestamp desc,ListingKey");
  });

  it("waits out a 429 and retries the page once, honoring Retry-After", async () => {
    vi.stubEnv("CREA_DDF_USERNAME", "test-client");
    vi.stubEnv("CREA_DDF_PASSWORD", "test-secret");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "token",
        token_type: "Bearer",
        expires_in: 3600,
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": "0" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        "@odata.count": 1,
        value: [{ ListingKey: "123", ListPrice: 700000 }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { searchDdfListings } = await import("./client");
    const result = await searchDdfListings({ top: 1 });

    expect(result.listings).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // The retried request is the same URL, not the $select fallback.
    expect(String(fetchMock.mock.calls[2][0])).toBe(String(fetchMock.mock.calls[1][0]));
  });
});

describe("getDdfToken", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("mints a single token for concurrent cold callers", async () => {
    vi.stubEnv("CREA_DDF_USERNAME", "test-client");
    vi.stubEnv("CREA_DDF_PASSWORD", "test-secret");
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      access_token: "token",
      token_type: "Bearer",
      expires_in: 3600,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { getDdfToken } = await import("./client");
    const [a, b, c] = await Promise.all([getDdfToken(), getDdfToken(), getDdfToken()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toBe("token");
    expect(b).toBe("token");
    expect(c).toBe("token");
  });
});

describe("adapting to CREA's schema", () => {
  const SELECT_GONE = JSON.stringify({ error: { details: "Could not find a property named 'LotFrontage' on type 'DDF.Core.Entities.Property'.", message: "You have entered an invalid $select parameter value.", code: "400" } });
  const FILTER_GONE = JSON.stringify({ error: { details: "The property 'StandardStatus' cannot be used in the $filter query option.", message: "You have entered an invalid query.", code: "400" } });
  const url = (filter: string, select = "ListingKey,LotFrontage,ListPrice") =>
    `https://ddfapi.realtor.ca/odata/v1/Property?${new URLSearchParams({ $filter: filter, $select: select, $orderby: "ModificationTimestamp desc,ListingKey" })}`;

  beforeEach(() => forgetDdfSchemaRejections());

  it("leaves a query alone until CREA objects to something", () => {
    const original = url("StandardStatus eq 'Active' and City eq 'Toronto'");
    expect(adaptDdfUrl(original)).toBe(original);
  });

  it("drops exactly the field CREA says no longer exists", () => {
    expect(learnFromDdfError(SELECT_GONE)).toBe(true);
    expect(learnFromDdfError(SELECT_GONE)).toBe(false); // nothing new the second time: stop retrying
    const adapted = new URL(adaptDdfUrl(url("City eq 'Toronto'")));
    expect(adapted.searchParams.get("$select")).toBe("ListingKey,ListPrice");
    expect(adapted.searchParams.get("$filter")).toBe("City eq 'Toronto'");
  });

  it("drops exactly the filter clause CREA refuses — not the rest, and not a value that happens to contain the name", () => {
    learnFromDdfError(FILTER_GONE);
    const adapted = new URL(adaptDdfUrl(url("StandardStatus eq 'Active' and City eq 'StandardStatus and Main' and (contains(PublicRemarks,'power of sale') or contains(PublicRemarks,'estate')) and ListPrice ge 500000")));
    expect(adapted.searchParams.get("$filter")).toBe("City eq 'StandardStatus and Main' and (contains(PublicRemarks,'power of sale') or contains(PublicRemarks,'estate')) and ListPrice ge 500000");
    expect(new URL(adaptDdfUrl(url("StandardStatus eq 'Active'"))).searchParams.has("$filter")).toBe(false);
  });

  it("keeps listing search alive through both rejections at once — what happened in Sept 2026", async () => {
    const calls: string[] = [];
    vi.stubEnv("CREA_DDF_USERNAME", "u");
    vi.stubEnv("CREA_DDF_PASSWORD", "p");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const target = String(input);
        if (target.includes("/connect/token")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
        calls.push(target);
        const query = new URL(target).searchParams;
        if (query.get("$select")?.includes("LotFrontage")) return new Response(SELECT_GONE, { status: 400 });
        if (query.get("$filter")?.includes("StandardStatus")) return new Response(FILTER_GONE, { status: 400 });
        return new Response(JSON.stringify({ "@odata.count": 2, value: [{ ListingKey: "1", StandardStatus: "Active", ListPrice: 1 }, { ListingKey: "2", StandardStatus: "Pending", ListPrice: 2 }] }), { status: 200 });
      }),
    );
    const result = await searchDdfListings({ city: "Toronto", top: 2 });
    expect(calls).toHaveLength(3); // rejected, rejected, accepted
    expect(result.listings.map((listing) => listing.ListingKey)).toEqual(["1"]); // status filtered here, since CREA won't
    calls.length = 0;
    await searchDdfListings({ city: "Hamilton", top: 2 });
    expect(calls).toHaveLength(1); // remembered: the next search is right first time
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});

describe("the shape of what CREA sends", () => {
  it("turns list-valued and numeric fields into the text everything downstream expects", async () => {
    const { coerceDdfListing } = await import("./client");
    const listing = coerceDdfListing({ ListingKey: 123, StructureType: ["House", "Duplex"], PropertySubType: "Single Family", City: null, PublicRemarks: { odd: true }, ListPrice: 899000 } as Record<string, unknown>);
    expect(listing).toEqual({ ListingKey: "123", StructureType: "House, Duplex", PropertySubType: "Single Family", City: null, PublicRemarks: "", ListPrice: 899000 });
  });

  it("classifies vacant land without assuming a field is text", async () => {
    const { isVacantLandLikeProperty } = await import("./propertyEligibility");
    expect(isVacantLandLikeProperty({ StructureType: ["Vacant Land"] as unknown as string })).toBe(true);
    expect(isVacantLandLikeProperty({ StructureType: ["House"] as unknown as string, PropertySubType: "Single Family" })).toBe(false);
  });
});
