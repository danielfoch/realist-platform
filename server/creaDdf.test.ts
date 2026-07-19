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
});
