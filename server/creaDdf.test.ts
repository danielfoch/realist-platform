import { afterEach, describe, expect, it, vi } from "vitest";

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

    const { searchDdfListings } = await import("./creaDdf");
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

    const { searchDdfListings } = await import("./creaDdf");
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

    const { searchDdfListings } = await import("./creaDdf");
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

    const { searchDdfListings } = await import("./creaDdf");
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

    const { searchDdfListings } = await import("./creaDdf");
    await searchDdfListings({ top: 1 });

    const searchUrl = String(fetchMock.mock.calls[1][0]);
    expect(decodeURIComponent(searchUrl.replace(/\+/g, " "))).toContain("$orderby=ModificationTimestamp desc,ListingKey");
  });
});
