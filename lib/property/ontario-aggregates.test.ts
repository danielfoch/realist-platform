import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixtures from "./fixtures/ontario-aggregates-source.json";
import { aggregateQueryRecords, ontarioAggregateCoverage, ontarioAggregateLayers } from "./ontario-aggregates";
import { validAggregateCatalogue, validAggregateItem, validAggregateMetadata, verifyAggregateFeed, verifyAggregateGrant } from "./ontario-aggregates-rights";
import { AGGREGATE_FEEDS, AGGREGATE_LICENCE, aggregateFields } from "./ontario-aggregates-sources";
import { preShowingBrief } from "./brief";
import type { Location, Row } from "./model";

vi.mock("./ontario-aggregates-rights", async original => ({ ...await original<object>(), verifyAggregateGrant: vi.fn(), verifyAggregateFeed: vi.fn() }));
const point: Location = { address: null, city: "Timmins", province: "ON", latitude: 48.4755, longitude: -81.3305, accuracy: "caller_supplied", provider: "caller" };
const active = AGGREGATE_FEEDS[0], inactive = AGGREGATE_FEEDS[1], partial = AGGREGATE_FEEDS[2];
const feature = (id = 1, status = "ACTIVE", alps = 5919) => ({ attributes: { OBJECTID: id, OGF_ID: 67240578, ALPS_ID: alps, LOCATION_ACCURACY: "Within 10 metres", CURRENT_STATUS: status, OPERATION_TYPE: "Pit", AUTH_TYPE_DESCR: "CLASS A LICENCE > 20000 TONNES", UNLIMITED_TONNAGE_IND: "Yes", MAX_TONNAGE: null, LICENCED_AREA: 46, LOCATION_NAME: "Warner/Alguire Pit", EFFECTIVE_DATETIME: 1145291851000, SYSTEM_DATETIME: 1145980245000, WATER_STATUS: "Above Water", PARTIAL_SURRENDER_IND: "Yes", CLIENT_NAME: "PRIVATE INDIVIDUAL", SOURCE_DETAIL: "UNNECESSARY FREE TEXT" }, geometry: { rings: [[[-74.9, 45.1]]] } });
const query = (f = active, features = [feature()]): Row => ({ fields: Object.entries(aggregateFields(f)).map(([name, type]) => ({ name, type })), features });
beforeEach(() => {
  vi.mocked(verifyAggregateGrant).mockResolvedValue({ catalogue: fixtures.catalogue.result, root: fixtures.root });
  vi.mocked(verifyAggregateFeed).mockResolvedValue({ catalogueMetadataModifiedAt: "2025-10-07", catalogueRefreshFrequency: "continual", catalogueResourcePublicationDate: "2013-07-02", catalogueResourceRangeStart: "1990-01-01", catalogueResourceRangeEnd: "2006-12-05", itemMetadataModifiedEpochMilliseconds: 1787227933000, liveServiceObservationDate: null, dateFieldTimezoneVerified: false });
});
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });

describe("original licensed Ontario aggregate lineage", () => {
  it("requires the active package, Ontario publisher and all three exact catalogue resources", () => {
    expect(validAggregateCatalogue(fixtures.catalogue)).toBe(true);
    for (const changed of [{ owner_org: "other" }, { private: true }, { state: "deleted" }, { license_id: "queens-printers-on" }, { license_url: "https://example.org" }, { resources: [] }]) expect(validAggregateCatalogue({ ...fixtures.catalogue, result: { ...fixtures.catalogue.result, ...changed } })).toBe(false);
    const copy = structuredClone(fixtures.catalogue); copy.result.resources[0].url = "https://example.org/copied-service"; expect(validAggregateCatalogue(copy)).toBe(false);
  });
  it("requires original item publisher, exact typed MapServer child and complete specific grant", () => {
    const item = fixtures.items["17"];
    expect(validAggregateItem(item, active)).toBe(true);
    for (const changed of [{ owner: "copy" }, { orgId: "other" }, { access: "private" }, { type: "Web Map" }, { url: item.url.replace("MapServer/17", "FeatureServer/0") }, { licenseInfo: "" }, { licenseInfo: `<a href="${AGGREGATE_LICENCE}">Open Government Licence – Ontario</a> Viewing only` }]) expect(validAggregateItem({ ...item, ...changed }, active)).toBe(false);
    expect(validAggregateItem(item, inactive)).toBe(false);
  });
  it("rejects changed or incomplete full grant text before reading any typed service or records", async () => {
    const actual = await vi.importActual<typeof import("./ontario-aggregates-rights")>("./ontario-aggregates-rights");
    const fetch = vi.fn(async (u: URL) => u.pathname.startsWith("/api/3/action/") ? new Response(JSON.stringify(fixtures.catalogue)) : new Response('<div id="main-content"><div class="body-field">Viewing only</div></div>'));
    vi.stubGlobal("fetch", fetch);
    await expect(actual.verifyAggregateGrant()).rejects.toThrow("Complete Ontario grant changed");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.every(([u]) => !u.pathname.includes("MapServer"))).toBe(true);
  });
  it("requires the exact licensed polygon child, selected types and distance/ordering capabilities", () => {
    for (const f of AGGREGATE_FEEDS) expect(validAggregateMetadata(fixtures.root, fixtures.metadata[String(f.child) as "17"], f)).toBe(true);
    const m = fixtures.metadata["17"];
    for (const changed of [{ id: 16 }, { geometryType: "esriGeometryPoint" }, { fields: [] }, { copyrightText: "" }, { advancedQueryCapabilities: { supportsQueryWithDistance: false, supportsOrderBy: true } }, { advancedQueryCapabilities: { supportsQueryWithDistance: true, supportsOrderBy: false } }]) expect(validAggregateMetadata(fixtures.root, { ...m, ...changed }, active)).toBe(false);
  });
});

describe("nearby aggregate context and source failure", () => {
  it("preserves raw reported facts, old epoch timestamps and null limits without impact inferences", () => {
    const r = aggregateQueryRecords(query(), active);
    expect(r.records[0]).toMatchObject({ authorizationId: "5919", provincialFeatureId: "67240578", reportedCurrentStatus: "ACTIVE", reportedUnlimitedTonnageIndicator: "Yes", reportedMaximumTonnageMetricTonnes: null, reportedLicensedAreaHectares: 46, reportedRecordEffectiveTimestamp: 1145291851000, reportedWaterStatus: "Above Water" });
    expect(JSON.stringify(r)).not.toMatch(/PRIVATE INDIVIDUAL|UNNECESSARY FREE TEXT|CLIENT_NAME|SOURCE_DETAIL|geometry|rings|distanceTo|production/);
  });
  it("keeps a historical partial surrender independent of an ACTIVE parent status", () => {
    const r = aggregateQueryRecords(query(partial), partial);
    expect(r.records[0]).toMatchObject({ reportedCurrentStatus: "ACTIVE", reportedPartialSurrenderIndicator: "Yes", authorizationId: "5919" });
    expect(aggregateQueryRecords(query(active, [feature(1), feature(2)]), active).records).toHaveLength(2); // Shared authorization is not a distinct-site identity.
  });
  it("rejects duplicate row identities, missing provincial/business identity, missing fields and malformed values", () => {
    const f = feature();
    for (const r of [query(active, [f, f]), { ...query(), fields: [] }, query(active, [{ ...f, attributes: { ...f.attributes, ALPS_ID: null } } as never]), query(active, [{ ...f, attributes: { ...f.attributes, MAX_TONNAGE: "100" } } as never]), query(active, [{ ...f, attributes: { ...f.attributes, EFFECTIVE_DATETIME: Number.NaN } } as never]), { ...query(), exceededTransferLimit: "false" }]) expect(() => aggregateQueryRecords(r, active)).toThrow();
    const missing = structuredClone(f); delete (missing.attributes as Row).LOCATION_ACCURACY; expect(() => aggregateQueryRecords(query(active, [missing]), active)).toThrow();
  });
  it("uses bounded fixed-source polygon queries and preserves all three independent statuses", async () => {
    const fetch = vi.fn(async (u: URL) => {
      const f = AGGREGATE_FEEDS.find(f => u.pathname.endsWith(`/${f.child}/query`))!;
      expect(u.searchParams.get("geometry")).toBe("-81.3305,48.4755");
      expect(u.searchParams.get("distance")).toBe("2000"); expect(u.searchParams.get("units")).toBe("esriSRUnit_Meter");
      expect(u.searchParams.get("returnGeometry")).toBe("false"); expect(u.searchParams.get("resultRecordCount")).toBe("51");
      expect(u.searchParams.get("outFields")).not.toMatch(/CLIENT_NAME|SOURCE_DETAIL|\*/);
      return new Response(JSON.stringify(query(f, [feature(f.child, f.child === 16 ? "SURRENDERED" : "ACTIVE")])));
    }); vi.stubGlobal("fetch", fetch);
    const layers = await ontarioAggregateLayers(point);
    expect(verifyAggregateGrant).toHaveBeenCalledOnce(); expect(fetch).toHaveBeenCalledTimes(3);
    for (const f of AGGREGATE_FEEDS) expect(layers[f.key]).toMatchObject({ status: "available", sourceUpdatedAt: null, source: f.source, data: { queryRadiusMeters: 2000, subjectParcelMatchVerified: false, currentExtractionVerified: false, impactsAssessed: false, vintage: { liveServiceObservationDate: null, dateFieldTimezoneVerified: false } } });
    const brief = preShowingBrief(layers, []);
    expect(brief.findings).toHaveLength(3); expect(brief.findings.every(f => f.summary.includes("2-kilometre"))).toBe(true);
    expect(brief.documentsToRequest.some(d => d.document.includes("pit/quarry authorization"))).toBe(true);
  });
  it("caps records at 50 and marks incomplete results as gaps without claiming nearest ranking", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: URL) => { const f = AGGREGATE_FEEDS.find(f => u.pathname.endsWith(`/${f.child}/query`))!; return new Response(JSON.stringify(query(f, Array.from({ length: 51 }, (_, i) => feature(i + 1))))); }));
    const layers = await ontarioAggregateLayers(point);
    expect(layers[active.key]).toMatchObject({ status: "available", truncated: true, data: { coverageComplete: false, sourceQueryRecordCount: 51 } });
    expect((layers[active.key].data as Row).records).toHaveLength(50);
    expect(preShowingBrief(layers, []).coverageGaps).toMatchObject(AGGREGATE_FEEDS.map(f => ({ layer: f.key, status: "incomplete" })));
    expect(() => aggregateQueryRecords({ ...query(active, []), exceededTransferLimit: true }, active)).toThrow("cannot establish no match");
  });
  it("keeps complete no-match distinct from malformed or failed sibling evidence", async () => {
    vi.mocked(verifyAggregateFeed).mockImplementation(async f => { if (f.child === 16) throw new Error("schema changed"); return {} as never; });
    vi.stubGlobal("fetch", vi.fn(async (u: URL) => { const f = AGGREGATE_FEEDS.find(f => u.pathname.endsWith(`/${f.child}/query`))!; return new Response(JSON.stringify(query(f, []))); }));
    const layers = await ontarioAggregateLayers(point);
    expect(layers[active.key]).toMatchObject({ status: "no_match", data: { coverageComplete: true } }); expect(layers[inactive.key].status).toBe("unavailable"); expect(layers[partial.key].status).toBe("no_match");
  });
  it("makes no provider requests for unresolved, ambiguous, interpolated, invalid or non-Ontario points", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    for (const p of [null, { ...point, latitude: null }, { ...point, accuracy: "ambiguous" }, { ...point, accuracy: "street_interpolated" }, { ...point, latitude: 60 }, { ...point, longitude: Number.NaN }]) expect(Object.values(await ontarioAggregateLayers(p)).every(l => l.status === "skipped")).toBe(true);
    expect(Object.values(await ontarioAggregateLayers({ ...point, province: "BC" })).every(l => l.status === "not_supported")).toBe(true);
    expect(verifyAggregateGrant).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it("stops all record/count requests when the original shared grant fails", async () => {
    vi.mocked(verifyAggregateGrant).mockRejectedValue(new Error("grant changed")); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(Object.values(await ontarioAggregateLayers(point)).every(l => l.status === "unavailable")).toBe(true);
    expect((await ontarioAggregateCoverage()).datasets.every(d => d.status === "unavailable" && d.records === null)).toBe(true); expect(fetch).not.toHaveBeenCalled();
  });
  it("counts only the three original English children, retaining overlap and unknown observation date", async () => {
    const fetch = vi.fn(async (u: URL) => { expect(u.searchParams.get("returnCountOnly")).toBe("true"); const count = u.pathname.endsWith("/17/query") ? 5591 : u.pathname.endsWith("/16/query") ? 2794 : 78; return new Response(JSON.stringify({ count })); }); vi.stubGlobal("fetch", fetch);
    const c = await ontarioAggregateCoverage(); expect(c.datasets.map(d => d.records)).toEqual([5591, 2794, 78]); expect(new Set(c.datasets.map(d => d.source.id)).size).toBe(3); expect(c.datasets.every(d => d.sourceUpdatedAt === null)).toBe(true); expect(c.note).toContain("not unique authorizations"); expect(fetch).toHaveBeenCalledTimes(3);
  });
});
