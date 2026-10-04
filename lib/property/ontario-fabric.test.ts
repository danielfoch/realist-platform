import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixtures from "./fixtures/ontario-fabric-source.json";
import { fabricQueryRecords, ontarioFabricCoverage, ontarioFabricLayers } from "./ontario-fabric";
import { FABRIC_FEEDS, FABRIC_LICENCE } from "./ontario-fabric-sources";
import { validFabricCatalogue, validFabricItem, validFabricMetadata, verifyFabricFeed, verifyFabricGrant } from "./ontario-fabric-rights";
import { preShowingBrief } from "./brief";
import type { Location, Row } from "./model";

vi.mock("./ontario-fabric-rights", async original => ({ ...await original<object>(), verifyFabricGrant: vi.fn(), verifyFabricFeed: vi.fn() }));
const point: Location = { address: null, city: "Kawartha Lakes", province: "ON", latitude: 44.385, longitude: -78.756, accuracy: "caller_supplied", provider: "caller" };
const lot = FABRIC_FEEDS[0], township = FABRIC_FEEDS[1];
const native = (f = lot) => fixtures.feeds[f.slug as keyof typeof fixtures.feeds];
beforeEach(() => {
  vi.mocked(verifyFabricGrant).mockResolvedValue({ root: fixtures.root });
  vi.mocked(verifyFabricFeed).mockResolvedValue({ catalogueMetadataModifiedAt: "2025-10-07", catalogueRefreshFrequency: "annually", catalogueResourcePublicationDate: "2015-04-30", catalogueResourceRangeStart: "2008-06-06", catalogueResourceRangeEnd: null, itemMetadataModifiedEpochMilliseconds: 1787227933000, liveServiceObservationDate: null, dateFieldTimezoneVerified: false });
});
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });

describe("original Ontario lot/township lineage", () => {
  it("requires both exact active Ontario packages and separate English resources", () => {
    for (const f of FABRIC_FEEDS) {
      const n = native(f);
      expect(validFabricCatalogue(n.package, f)).toBe(true);
      for (const changed of [{ private: true }, { state: "deleted" }, { owner_org: "copy" }, { license_id: "copyright" }, { license_url: "https://example.org" }, { resources: [] }]) expect(validFabricCatalogue({ ...n.package, result: { ...n.package.result, ...changed } }, f)).toBe(false);
      expect(validFabricCatalogue(n.package, f === lot ? township : lot)).toBe(false);
    }
  });
  it("requires the original item/publisher/grant and typed polygon child with exact selected fields", () => {
    for (const f of FABRIC_FEEDS) {
      const n = native(f);
      expect(validFabricItem(n.item, f)).toBe(true);
      expect(validFabricMetadata(fixtures.root, n.child, f)).toBe(true);
      for (const changed of [{ owner: "copy" }, { orgId: "copy" }, { type: "Web Map" }, { access: "private" }, { url: n.item.url.replace("MapServer", "FeatureServer") }, { licenseInfo: "" }, { licenseInfo: `<a href="${FABRIC_LICENCE}">Open Government Licence – Ontario</a> Viewing only` }]) expect(validFabricItem({ ...n.item, ...changed }, f)).toBe(false);
      for (const changed of [{ id: 99 }, { name: "copy" }, { fields: [] }, { geometryType: "esriGeometryPoint" }, { copyrightText: "" }, { advancedQueryCapabilities: { supportsOrderBy: false } }]) expect(validFabricMetadata(fixtures.root, { ...n.child, ...changed }, f)).toBe(false);
    }
  });
  it("checks the complete native grant before any service metadata and follows the original resource offer", async () => {
    const actual = await vi.importActual<typeof import("./ontario-fabric-rights")>("./ontario-fabric-rights");
    let offered = native().offer;
    const fetch = vi.fn(async (u: URL) => {
      if (u.hostname === "www.ontario.ca") return new Response(fixtures.grantBodyHtml);
      if (u.hostname === "data.ontario.ca") return new Response(JSON.stringify(native().package));
      if (u.hostname === "geohub.lio.gov.on.ca") return new Response(offered);
      if (u.hostname === "www.arcgis.com") return new Response(JSON.stringify(native().item));
      return new Response(JSON.stringify(u.pathname.endsWith("/2") ? native().child : fixtures.root));
    });
    vi.stubGlobal("fetch", fetch);
    const shared = await actual.verifyFabricGrant();
    expect(fetch.mock.calls[0][0].hostname).toBe("www.ontario.ca");
    expect(await actual.verifyFabricFeed(lot, shared)).toMatchObject({ liveServiceObservationDate: null, dateFieldTimezoneVerified: false });
    offered = offered.replace(`${lot.item}_2`, `${township.item}_1`);
    await expect(actual.verifyFabricFeed(lot, shared)).rejects.toThrow("resource offer changed");
  });
  it("rejects a changed full grant before service/record requests", async () => {
    const actual = await vi.importActual<typeof import("./ontario-fabric-rights")>("./ontario-fabric-rights");
    const fetch = vi.fn(async () => new Response('<div id="main-content"><div class="body-field">Viewing only</div></div>'));
    vi.stubGlobal("fetch", fetch);
    await expect(actual.verifyFabricGrant()).rejects.toThrow("Complete Ontario fabric grant changed");
    expect(fetch).toHaveBeenCalledOnce();
  });
});
describe("bounded original fabric references", () => {
  it("preserves native original lot/township, accuracy, null labels and separate raw dates", () => {
    const result = fabricQueryRecords(native().rural, lot);
    expect(result.records[0]).toMatchObject({ recordId: "290594", provincialFeatureId: "201246756", reportedOriginalLot: "LOT 26", reportedConcession: "CON 5", reportedGeographicTownship: "OPS", reportedLocationAccuracy: "Within 100 metres", reportedRoadAllowanceStatus: null, reportedVerificationStatus: "Verified", reportedVerificationTimestamp: 1083758400000 });
    expect(fabricQueryRecords(native(township).rural, township).records[0]).toMatchObject({ reportedGeographicTownship: "OPS", reportedTownshipSurveySystem: "DOUBLE FT.", reportedAnnulmentStatus: null });
    expect(JSON.stringify(result)).not.toMatch(/geometry|rings|SHAPE|AREA|PIN|LOCATION_DESCR|GENERAL_COMMENTS/);
  });
  it("rejects malformed arrays, duplicate row IDs, missing fields, incorrect field types and nonnumeric dates", () => {
    const base: Row = structuredClone(native().rural);
    const row = (base.features as Row[])[0];
    for (const changed of [{ features: null }, { features: [null] }, { fields: {} }, { features: [row, row] }, { exceededTransferLimit: "false" }, { fields: [] }]) expect(() => fabricQueryRecords({ ...base, ...changed }, lot)).toThrow();
    for (const changed of [{ OBJECTID: null }, { OGF_ID: null }, { EFFECTIVE_DATETIME: "2026-10-03" }, { LOCATION_ACCURACY: 1 }]) expect(() => fabricQueryRecords({ ...base, features: [{ attributes: { ...(row.attributes as Row), ...changed } }] }, lot)).toThrow();
    const missing = { ...(row.attributes as Row) }; delete missing.LOT_IDENT;
    expect(() => fabricQueryRecords({ ...base, features: [{ attributes: missing }] }, lot)).toThrow();
  });
  it("queries only original point intersections with selected fields, no nearby geometry, and produces survey requests", async () => {
    const fetch = vi.fn(async (u: URL) => {
      const f = FABRIC_FEEDS.find(f => u.pathname.endsWith(`/${f.child}/query`))!;
      expect(u.searchParams.get("geometry")).toBe("-78.756,44.385");
      expect(u.searchParams.get("spatialRel")).toBe("esriSpatialRelIntersects");
      expect(u.searchParams.get("returnGeometry")).toBe("false");
      expect(u.searchParams.get("resultRecordCount")).toBe("51");
      expect(u.searchParams.has("distance")).toBe(false);
      expect(u.searchParams.get("outFields")).toBe(Object.keys(f.fields).join(","));
      return new Response(JSON.stringify(native(f).rural));
    }); vi.stubGlobal("fetch", fetch);
    const layers = await ontarioFabricLayers(point);
    for (const f of FABRIC_FEEDS) expect(layers[f.key]).toMatchObject({ status: "available", sourceUpdatedAt: null, data: { coverageComplete: false, queryCoverageComplete: true, absenceEstablished: false, parcelIdentityVerified: false, surveyedBoundaryVerified: false, legalDescriptionVerified: false, currentMunicipalityEstablished: false, parcelWideScreenPerformed: false, sourceGeometryReused: false, legalAccessEstablished: false } });
    expect(verifyFabricGrant).toHaveBeenCalledOnce(); expect(fetch).toHaveBeenCalledTimes(2);
    const brief = preShowingBrief(layers, []);
    expect(brief.findings.every(f => f.summary.includes("original Crown"))).toBe(true);
    expect(brief.documentsToRequest.some(d => d.document.includes("original Crown"))).toBe(true);
    expect(brief.coverageGaps.every(g => g.status === "incomplete")).toBe(true);
  });
  it("keeps multiple or capped candidates ambiguous without selecting a legal description", async () => {
    const base = native().rural, row = base.features[0];
    vi.stubGlobal("fetch", vi.fn(async (u: URL) => {
      const f = FABRIC_FEEDS.find(f => u.pathname.endsWith(`/${f.child}/query`))!;
      return new Response(JSON.stringify({ ...native(f).rural, features: Array.from({ length: f === lot ? 51 : 2 }, (_, i) => ({ attributes: { ...row.attributes, ...native(f).rural.features[0].attributes, OBJECTID: i + 1 } })) }));
    }));
    const layers = await ontarioFabricLayers(point);
    expect(layers[lot.key]).toMatchObject({ status: "ambiguous", truncated: true, data: { queryCoverageComplete: false, sourceQueryRecordCount: 51 } });
    expect((layers[lot.key].data as Row).records).toHaveLength(50);
    expect(layers[township.key]).toMatchObject({ status: "ambiguous", truncated: false });
    expect(() => fabricQueryRecords({ ...base, features: [], exceededTransferLimit: true }, lot)).toThrow("cannot establish no match");
  });
  it("preserves complete source no-match separately from failed sibling evidence and property-wide absence", async () => {
    vi.mocked(verifyFabricFeed).mockImplementation(async f => { if (f === township) throw Error("changed schema"); return {} as never; });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(native().remote))));
    const layers = await ontarioFabricLayers(point);
    expect(layers[lot.key]).toMatchObject({ status: "no_match", data: { queryCoverageComplete: true, coverageComplete: false, absenceEstablished: false } });
    expect(layers[township.key].status).toBe("unavailable");
  });
  it("makes no requests for unresolved, interpolated, invalid, out-of-area or non-Ontario points", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    for (const p of [null, { ...point, latitude: null }, { ...point, accuracy: "ambiguous" }, { ...point, accuracy: "street_interpolated" }, { ...point, latitude: 60 }, { ...point, longitude: Number.NaN }]) expect(Object.values(await ontarioFabricLayers(p)).every(l => l.status === "skipped")).toBe(true);
    expect(Object.values(await ontarioFabricLayers({ ...point, province: "BC" })).every(l => l.status === "not_supported")).toBe(true);
    expect(fetch).not.toHaveBeenCalled(); expect(verifyFabricGrant).not.toHaveBeenCalled();
  });
  it("stops both queries and counts on shared grant failure", async () => {
    vi.mocked(verifyFabricGrant).mockRejectedValue(Error("grant changed"));
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(Object.values(await ontarioFabricLayers(point)).every(l => l.status === "unavailable")).toBe(true);
    expect((await ontarioFabricCoverage()).datasets.every(d => d.status === "unavailable" && d.records === null)).toBe(true);
    expect(fetch).not.toHaveBeenCalled(); expect(verifyFabricFeed).not.toHaveBeenCalled();
  });
  it("counts only the two original English sources and retains overlap and unknown source observation dates", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: URL) => { expect(u.searchParams.get("returnCountOnly")).toBe("true"); return new Response(JSON.stringify({ count: u.pathname.endsWith("/2/query") ? 292826 : 2528 })); }));
    const c = await ontarioFabricCoverage();
    expect(c.datasets.map(d => d.records)).toEqual([292826, 2528]);
    expect(c.datasets.every(d => d.sourceUpdatedAt === null && d.status === "verified")).toBe(true);
    expect(c.note).toContain("not distinct properties"); expect(c.note).toContain("French duplicate");
  });
  it("does not accept malformed count totals or let one failed count replace its sibling's verified count", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: URL) => new Response(JSON.stringify({ count: u.pathname.endsWith("/2/query") ? "292826" : 2528 }))));
    const c = await ontarioFabricCoverage();
    expect(c.datasets[0]).toMatchObject({ status: "unavailable", records: null });
    expect(c.datasets[1]).toMatchObject({ status: "verified", records: 2528 });
  });
});
