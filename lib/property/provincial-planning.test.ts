import { afterEach, describe, expect, it, vi } from "vitest";
import { ONTARIO_PLANNING_FEEDS, provincialPlanningLayer, validPlanningMetadata } from "./provincial-planning";
import { preShowingBrief } from "./brief";
import type { Location } from "./model";
const location: Location = { address: "test", city: "Hamilton", province: "ON", latitude: 43.3, longitude: -79.96, accuracy: "source_civic_address_point", provider: "municipal" };
const respond = (v: unknown) => new Response(JSON.stringify(v));
const metadata = (f: typeof ONTARIO_PLANNING_FEEDS[number]) => ({ id: f.id, name: f.name, geometryType: "esriGeometryPolygon", copyrightText: "https://www.ontario.ca/page/open-government-licence-ontario", fields: f.fields.map(name => ({ name })) });
afterEach(() => vi.unstubAllGlobals());
describe("Ontario provincial planning screens", () => {
  it("requires a bound official layer, schema and explicit open licence", () => {
    const f = ONTARIO_PLANNING_FEEDS[1], m = metadata(f);
    expect(validPlanningMetadata(m, f)).toBe(true);
    for (const changed of [{ name: "development control" }, { copyrightText: "Viewing only" }, { geometryType: "esriGeometryPoint" }, { fields: [] }, { id: 0 }]) expect(validPlanningMetadata({ ...m, ...changed }, f)).toBe(false);
  });
  it("retains coarse accuracy, separate plan meanings, unknown vintage and partial failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: URL) => {
      const f = ONTARIO_PLANNING_FEEDS.find(f => url.pathname.includes(`/MapServer/${f.id}`))!;
      if (f.id === 15) return new Response("down", { status: 503 });
      if (!url.pathname.endsWith("/query")) return respond(metadata(f));
      return respond({ fields: metadata(f).fields, features: [{ attributes: { ...Object.fromEntries(f.fields.map(k => [k, null])), OBJECTID: f.id, LOCATION_ACCURACY: "Within 10,000 metres", EFFECTIVE_DATETIME: Date.UTC(2017, 5, 2), OWNER: "PRIVATE" } }] });
    }));
    const result = await provincialPlanningLayer(location);
    expect(result.status).toBe("available"); expect(result.sourceUpdatedAt).toBeNull();
    expect(result.data).toMatchObject({ coverageComplete: false, developmentControlScreenPerformed: false, officialPlanLandUseScreenPerformed: false, datasets: { greenbeltDesignation: { status: "unavailable" }, niagaraEscarpmentPlanBoundary: { data: { records: [{ publishedFields: { LOCATION_ACCURACY: "Within 10,000 metres", EFFECTIVE_DATETIME: "2017-06-02T00:00:00.000Z" } }] } } } });
    expect(JSON.stringify(result.data)).not.toContain("PRIVATE");
    expect(result.note).toContain("cannot verify an individual lot");
    const brief = preShowingBrief({ provincialPlanning: result }, []);
    expect(brief.coverageGaps).toMatchObject([{ layer: "provincialPlanning", status: "incomplete" }]);
    expect(brief.documentsToRequest.some(d => d.document.includes("legal-map"))).toBe(true);
  });
  it("rejects incomplete and schema-less query responses instead of claiming no restrictions", async () => {
    for (const bad of [{ features: [], exceededTransferLimit: true }, { features: [] }]) {
      vi.stubGlobal("fetch", vi.fn(async (url: URL) => {
        const f = ONTARIO_PLANNING_FEEDS.find(f => url.pathname.includes(`/MapServer/${f.id}`))!;
        return respond(url.pathname.endsWith("/query") ? bad : metadata(f));
      }));
      expect((await provincialPlanningLayer(location)).status).toBe("unavailable");
    }
  });
  it("does not query approximate or non-Ontario points", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect((await provincialPlanningLayer({ ...location, accuracy: "street_interpolated" })).status).toBe("skipped");
    expect((await provincialPlanningLayer({ ...location, province: "BC" })).status).toBe("not_supported");
    expect(fetch).not.toHaveBeenCalled();
  });
});
