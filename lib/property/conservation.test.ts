import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { conservationLayer } from "./conservation";
import type { Location, Layer } from "./model";

const mockFetch = vi.fn();
const point: Location = { address: null, city: null, province: "ON", latitude: 44.327, longitude: -79.433, accuracy: "caller_supplied", provider: "caller" };
beforeEach(() => vi.stubGlobal("fetch", mockFetch));
afterEach(() => { vi.unstubAllGlobals(); mockFetch.mockReset(); });
const response = (url: URL, attributes: unknown[] = []) => new Response(JSON.stringify({ fields: url.searchParams.get("outFields")!.split(",").map(name => ({ name })), features: attributes.map(a => ({ attributes: a })) }), { headers: { "content-type": "application/json" } });

describe("Lake Simcoe point screening", () => {
  it("skips approximate or absent positions and does not query another province", async () => {
    expect((await conservationLayer({ ...point, accuracy: "street_interpolated" })).status).toBe("skipped");
    expect((await conservationLayer({ ...point, latitude: null })).status).toBe("skipped");
    expect((await conservationLayer({ ...point, province: "BC" })).status).toBe("not_supported");
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it("checks actual mapped watershed coverage before constraint feeds", async () => {
    mockFetch.mockImplementation(async (url: URL) => response(url));
    const result = await conservationLayer(point);
    expect(result.status).toBe("not_supported");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.note).toContain("does not determine conservation jurisdiction");
  });
  it("keeps successful matches when one source fails and exposes that failure", async () => {
    mockFetch.mockImplementation(async (url: URL) => {
      expect(url.hostname).toBe("gis.lsrca.on.ca");
      expect(url.searchParams.get("geometry")).toBe("-79.433,44.327");
      expect(url.searchParams.get("inSR")).toBe("4326");
      if (url.pathname.endsWith("/20/query")) return response(url, [{ OBJECTID: 34, WATERSHEDNAME: "Lake Simcoe Watershed - LSPP" }]);
      if (url.pathname.endsWith("/36/query")) return response(url, [{ OBJECTID: 1, RAREAID: 4, SUBWATERSHED: "TEST", APPROVALDATE: 0, OWNER: "PRIVATE" }]);
      if (url.pathname.endsWith("/76/query")) return new Response("unavailable", { status: 503 });
      return response(url);
    });
    const result = await conservationLayer(point);
    expect(result.status).toBe("available"); expect(result.truncated).toBe(true);
    const data = result.data as { geometryScope: string; datasets: Record<string, Layer> };
    expect(data.geometryScope).toBe("caller_supplied_point");
    expect(data.datasets.regulationLimit.data).toMatchObject({ records: [{ approvedDate: "1970-01-01T00:00:00.000Z" }] });
    expect(data.datasets.floodplain.status).toBe("unavailable");
    expect(data.datasets.shorelineErosion.status).toBe("no_match");
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
    expect(result.note).toContain("not proof");
  });
  it("does not transform empty intersections into a flood-safe property conclusion", async () => {
    mockFetch.mockImplementation(async (url: URL) => response(url, url.pathname.endsWith("/20/query") ? [{ OBJECTID: 1, WATERSHEDNAME: "Lake Simcoe" }] : []));
    const result = await conservationLayer({ ...point, accuracy: "source_building_point" });
    expect(result.status).toBe("no_match");
    expect(result.data).toMatchObject({ geometryScope: "building_point" });
    expect(result.note).toContain("no intersection is not proof");
    expect(mockFetch).toHaveBeenCalledTimes(7);
  });
  it("makes schema errors, service errors and overflow unavailable instead of no-match", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ error: { code: 500 }, features: [] })));
    expect((await conservationLayer(point)).status).toBe("unavailable");
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ features: [], fields: [{ name: "OTHER" }] })));
    expect((await conservationLayer(point)).status).toBe("unavailable");
    mockFetch.mockImplementation(async (url: URL) => new Response(JSON.stringify({ fields: url.searchParams.get("outFields")!.split(",").map(name => ({ name })), features: [], exceededTransferLimit: true })));
    expect((await conservationLayer(point)).status).toBe("unavailable");
  });
});
