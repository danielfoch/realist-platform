import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/ontario-lidar-source.json";
import fabric from "./fixtures/ontario-fabric-source.json";
import { lidarQueryRecords, ontarioLidarCoverage, ontarioLidarLayer } from "./ontario-lidar";
import { validLidarCatalogue, validLidarItem, validLidarMap, validLidarMetadata, verifyLidarSource } from "./ontario-lidar-rights";
import { LIDAR_ITEM, LIDAR_LICENCE, LIDAR_MAP, LIDAR_OFFER, LIDAR_ROOT, LIDAR_SOURCE } from "./ontario-lidar-sources";
import { preShowingBrief } from "./brief";
import type { Location, Row } from "./model";

vi.mock("./ontario-lidar-rights", async original => ({ ...await original<object>(), verifyLidarSource: vi.fn() }));
const point: Location = { address: null, city: "Woodstock", province: "ON", latitude: 43.13, longitude: -80.748, accuracy: "caller_supplied", provider: "caller" };
const vintage = { catalogueMetadataModifiedAt: "2025-10-27", catalogueRefreshFrequency: "as_required", catalogueResourceRangeStart: "2014-01-01", catalogueResourceRangeEnd: "2019-01-01", itemMetadataModifiedEpochMilliseconds: 1780949553890, publishedDataLastEditEpochMilliseconds: 1780949553890, acquisitionDateVerified: false, liveRasterObservationDate: null } as const;
beforeEach(() => { vi.mocked(verifyLidarSource).mockResolvedValue(vintage); });
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });
describe("original Ontario lidar package source", () => {
  it("requires exact active English catalogue binding and independent explicit original map/index grants", () => {
    expect(validLidarCatalogue(fixture.catalogue)).toBe(true);
    for (const changed of [{ state: "deleted" }, { private: true }, { license_id: "copyright" }, { resources: [] }, { owner_org: "copy" }]) expect(validLidarCatalogue({ ...fixture.catalogue, result: { ...fixture.catalogue.result, ...changed } })).toBe(false);
    for (const [item, isMap] of [[fixture.mapItem, true], [fixture.item, false]] as const) {
      expect(validLidarItem(item, isMap)).toBe(true);
      for (const changed of [{ owner: "copy" }, { orgId: "copy" }, { access: "private" }, { licenseInfo: "" }, { licenseInfo: `<a href="${LIDAR_LICENCE}">Open Government Licence – Ontario</a> Reference only` }]) expect(validLidarItem({ ...item, ...changed }, isMap)).toBe(false);
    }
    expect(validLidarMap(fixture.mapData)).toBe(true);
    expect(validLidarMap({ operationalLayers: [{ ...fixture.mapData.operationalLayers[0], url: "https://example.org/copy" }] })).toBe(false);
    expect(validLidarMetadata(fixture.root, fixture.child)).toBe(true);
    expect(validLidarMetadata({ ...fixture.root, serviceItemId: "copy" }, fixture.child)).toBe(false);
    expect(validLidarMetadata(fixture.root, { ...fixture.child, fields: fixture.child.fields.map(a => a.name === "Resolution" ? { ...a, alias: "feet" } : a) })).toBe(false);
    expect(validLidarMetadata(fixture.root, { ...fixture.child, geometryType: "esriGeometryPolyline" })).toBe(false);
  });
  it("checks the complete grant and offered thumbnail before allowing the verified source", async () => {
    const actual = await vi.importActual<typeof import("./ontario-lidar-rights")>("./ontario-lidar-rights");
    const licence = fabric.grantBodyHtml;
    let changed = false;
    vi.stubGlobal("fetch", vi.fn(async (u: URL) => {
      if (u.href === LIDAR_LICENCE) return new Response(changed ? licence.replace("<h2>", "<p>Additional restriction</p><h2>") : licence);
      if (u.href === LIDAR_OFFER) return new Response(`<meta name="twitter:image" content="https://www.arcgis.com/sharing/rest/content/items/${LIDAR_MAP}/info/thumbnail/thumbnail.png">`);
      const data = u.hostname === "data.ontario.ca" ? fixture.catalogue : u.pathname.endsWith(`/${LIDAR_MAP}/data`) ? fixture.mapData : u.pathname.endsWith(`/${LIDAR_MAP}`) ? fixture.mapItem : u.pathname.endsWith(`/${LIDAR_ITEM}`) ? fixture.item : u.href.startsWith(LIDAR_ROOT + "/0") ? fixture.child : fixture.root;
      return new Response(JSON.stringify(data));
    }));
    expect(await actual.verifyLidarSource()).toMatchObject({ acquisitionDateVerified: false, liveRasterObservationDate: null, catalogueResourceRangeEnd: "2019-01-01" });
    changed = true; await expect(actual.verifyLidarSource()).rejects.toThrow("grant or source binding");
  });
});
describe("bounded package references, without terrain pixels", () => {
  it("preserves overlapping older/newer source packages, resolution and metadata dates without asserting elevation", async () => {
    const fetch = vi.fn(async (u: URL) => {
      expect(u.origin + u.pathname).toBe(LIDAR_SOURCE.url + "/query"); expect(u.searchParams.get("returnGeometry")).toBe("false"); expect(u.searchParams.get("outFields")).toBe("OBJECTID,Package,Resolution,Project"); expect(u.searchParams.get("resultRecordCount")).toBe("51");
      return new Response(JSON.stringify(fixture.woodstock));
    }); vi.stubGlobal("fetch", fetch);
    const l = await ontarioLidarLayer(point); expect(l.status).toBe("available"); expect(l.sourceUpdatedAt).toBeNull();
    expect(l.data).toMatchObject({ coverageComplete: false, queryCoverageComplete: true, actualRasterCoverageVerified: false, rasterSamplePerformed: false, elevationM: null, absenceEstablished: false, vintage, records: [{ reportedProject: "OMAFRA Lidar 2016-18", reportedRasterResolutionM: 0.5, elevationM: null }, { reportedProject: "DEDSFM Upper Thames-Grand River 2025", reportedRasterResolutionM: 0.5, elevationM: null }] });
    expect(fetch).toHaveBeenCalledTimes(1);
    const brief = preShowingBrief({ ontarioLidarCoverageReference: l }, []); expect(brief.findings[0].summary).toContain("numeric elevation"); expect(brief.documentsToRequest.some(d => d.reason.includes("vertical datum"))).toBe(true);
  });
  it("accepts native complete empty responses with omitted fields without establishing absence", async () => {
    expect(lidarQueryRecords(fixture.empty)).toMatchObject({ records: [], queryCoverageComplete: true });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(fixture.empty))));
    expect(await ontarioLidarLayer(point)).toMatchObject({ status: "no_match", data: { absenceEstablished: false, actualRasterCoverageVerified: false } });
    expect(() => lidarQueryRecords({ ...fixture.empty, exceededTransferLimit: true })).toThrow();
    expect(() => lidarQueryRecords({ features: [] })).toThrow();
  });
  it("rejects wrong schemas, duplicate identities, geometry substitutions, invented zero/negative/string resolution", () => {
    const first = fixture.woodstock.features[0];
    for (const changes of [{ Resolution: "0.5" }, { Resolution: 0 }, { Resolution: -1 }, { OBJECTID: "20" }, { Project: 2025 }]) expect(() => lidarQueryRecords({ ...fixture.woodstock, features: [{ attributes: { ...first.attributes, ...changes } }] })).toThrow();
    expect(() => lidarQueryRecords({ ...fixture.woodstock, features: [first, first] })).toThrow();
    expect(() => lidarQueryRecords({ ...fixture.woodstock, fields: [] })).toThrow();
    expect(() => lidarQueryRecords({ ...fixture.woodstock, fields: fixture.woodstock.fields.map(f => f.name === "Resolution" ? { ...f, alias: "degrees" } : f) })).toThrow();
    expect(lidarQueryRecords({ ...fixture.woodstock, features: [{ attributes: { ...first.attributes, Package: null, Project: null, Resolution: null }, geometry: { x: 1, y: 1 } }] }).records[0]).toMatchObject({ reportedPackage: null, reportedProject: null, reportedRasterResolutionM: null, elevationM: null });
  });
  it("caps incomplete results and retains ambiguity", async () => {
    const response: Row = { ...fixture.woodstock, features: Array.from({ length: 51 }, (_, i) => ({ attributes: { ...fixture.woodstock.features[0].attributes, OBJECTID: i + 1 } })) };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(response))));
    expect(await ontarioLidarLayer(point)).toMatchObject({ status: "ambiguous", truncated: true, data: { queryCoverageComplete: false, sourceQueryRecordCount: 51 } }); expect(lidarQueryRecords(response).records).toHaveLength(50);
  });
  it("does not query on missing/imprecise/non-Ontario points or grant failure", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    for (const p of [null, { ...point, accuracy: "source_street_point" }, { ...point, province: "NB" }, { ...point, latitude: NaN }]) expect(["skipped", "not_supported"]).toContain((await ontarioLidarLayer(p as Location | null)).status);
    expect(verifyLidarSource).not.toHaveBeenCalled();
    vi.mocked(verifyLidarSource).mockRejectedValue(Error("grant changed"));
    expect((await ontarioLidarLayer(point)).status).toBe("unavailable"); expect((await ontarioLidarCoverage()).datasets[0]).toMatchObject({ status: "unavailable", records: null }); expect(fetch).not.toHaveBeenCalled();
  });
  it("counts only original index polygons and rejects malformed totals", async () => {
    let count: unknown = 420; vi.stubGlobal("fetch", vi.fn(async (u: URL) => { expect(u.searchParams.get("returnCountOnly")).toBe("true"); return new Response(JSON.stringify({ count })); }));
    expect((await ontarioLidarCoverage()).datasets[0]).toMatchObject({ status: "verified", records: 420, sourceUpdatedAt: null });
    count = "420"; expect((await ontarioLidarCoverage()).datasets[0]).toMatchObject({ status: "unavailable", records: null });
  });
});
