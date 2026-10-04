import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { quinteWestCoverage, quinteWestLayers, quinteWestLocation, quinteWestMarket, quinteWestMetadata } from "./quintewest";
import { QUINTEWEST_FEEDS, QUINTEWEST_GRANT, QUINTEWEST_WITHHELD, type QuinteWestFeed } from "./quintewest-sources";
import { NIAGARA_FEEDS } from "./niagara-sources";
import { bellevilleCoverage, bellevilleLayers } from "./belleville-audit";
import { preShowingBrief } from "./brief";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
import type { Location, Row } from "./model";
const { json, bytes, provincialMetadata } = vi.hoisted(() => ({ json: vi.fn(), bytes: vi.fn(), provincialMetadata: vi.fn() }));
vi.mock("./http", async () => ({ ...await vi.importActual<typeof import("./http")>("./http"), fetchJson: json, fetchBytes: bytes }));
vi.mock("./niagara", () => ({ niagaraMetadata: provincialMetadata }));
const fixture: Record<string, Row> = JSON.parse(readFileSync(new URL("./fixtures/quintewest-grant.json", import.meta.url), "utf8"));
const pdf = readFileSync(new URL("./fixtures/quintewest-licence.pdf", import.meta.url));
const feed = (key: string) => QUINTEWEST_FEEDS.find(f => f.key === key)!;
const provincial = NIAGARA_FEEDS.find(f => f.key === "ontarioMunicipality")!;
const location: Location = { address: "15 Dundas St E", city: "Trenton", province: "ON", latitude: 44.103858, longitude: -77.572549, accuracy: "source_building_point", provider: "statcan-nar-202606" };
const record = (f: QuinteWestFeed, values: Row = {}) => ({ attributes: Object.fromEntries(Object.keys(f.fields).map(k => [k, k === f.oid ? values[k] ?? 1 : values[k] ?? null])) });
function provider(data: Record<string, Row[]> = {}, changes: Record<string, Row | undefined> = {}) {
  return async (u: URL) => {
    if (u.pathname.endsWith("/query")) {
      if (u.href.startsWith(provincial.url + "/query")) return { features: data.municipality ?? [{ attributes: { OBJECTID: 45, MUNICIPAL_NAME: "QUINTE WEST" } }], ...changes.municipality };
      const f = QUINTEWEST_FEEDS.find(f => u.href.startsWith(f.url + "/query")); if (!f) throw Error("Unexpected query");
      if (u.searchParams.get("returnCountOnly") === "true") return { count: 1, ...changes.count };
      return { features: data[f.key] ?? [], ...changes[f.key] };
    }
    if (u.pathname.endsWith("/search")) {
      const id = u.searchParams.get("q")?.match(/^id:([a-f0-9]{32}) AND group:/)?.[1]; if (!id || !u.searchParams.get("q")?.endsWith(QUINTEWEST_GRANT.group)) throw Error("Unexpected curation");
      return { ...fixture["curation:" + id], ...changes.curated };
    }
    const value = fixture[u.origin + u.pathname]; if (!value) throw Error("Unexpected metadata");
    const b = QUINTEWEST_GRANT;
    const kind = u.pathname.endsWith(b.site + "/data") ? "siteData" : u.pathname.endsWith(b.site) ? "site" : u.pathname.endsWith(b.licenceItem) ? "licence" : u.pathname.includes("/groups/") ? "group" : u.pathname.includes("/sharing/") ? "item" : u.pathname.endsWith("/FeatureServer") ? "root" : "metadata";
    return { ...value, ...changes[kind] };
  };
}
beforeEach(() => { json.mockReset().mockImplementation(provider()); bytes.mockReset().mockResolvedValue(pdf); provincialMetadata.mockReset().mockResolvedValue({ sourceUpdatedAt: null }); vi.spyOn(console, "warn").mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());
describe("Quinte West licensed location references", () => {
  it("requires exact full PDF grant, City offer, legacy curation, publisher and typed lineage before query", async () => {
    for (const f of QUINTEWEST_FEEDS) expect((await quinteWestMetadata(f)).sourceUpdatedAt).toBeTruthy();
    for (const change of [{ item: { owner: "copy" } }, { item: { orgId: null } }, { item: { licenseInfo: "public" } }, { item: { url: feed("parkReference").rootUrl } }, { root: { serviceItemId: "other" } }, { root: { copyrightText: "Third party" } }, { root: { layers: [] } }, { metadata: { fields: [] } }, { metadata: { objectIdField: "other" } }, { metadata: { geometryType: "esriGeometryPoint" } }, { curated: { total: 0, results: [] } }, { site: { owner: "copy" } }, { site: { type: "Hub Site Application" } }, { site: { orgId: null } }, { site: { licenseInfo: "public" } }, { siteData: { values: { groups: [] }, catalogV2: { scopes: { item: { filters: [] } } } } }, { group: { isOpenData: false } }, { licence: { owner: "copy" } }, { licence: { access: "private" } }]) {
      json.mockClear().mockImplementation(provider({}, change)); await expect(quinteWestMetadata(feed("buildingFootprintReference"))).rejects.toThrow(); expect(json.mock.calls.some(([u]) => u.pathname.endsWith("/query"))).toBe(false);
    }
    json.mockImplementation(provider()); bytes.mockResolvedValue(Buffer.concat([pdf, Buffer.from("changed")])); await expect(quinteWestMetadata(feed("parkReference"))).rejects.toThrow();
    bytes.mockResolvedValue(pdf); const data = structuredClone(fixture["https://www.arcgis.com/sharing/rest/content/items/" + QUINTEWEST_GRANT.site + "/data"]);
    const rewritten = JSON.parse(JSON.stringify(data).replaceAll(QUINTEWEST_GRANT.licenceUrl, "https://copy.invalid/grant"));
    json.mockImplementation(provider({}, { siteData: rewritten })); await expect(quinteWestMetadata(feed("stormwaterReference"))).rejects.toThrow();
  });
  it("uses community aliases only as candidates and rejects province/address conflicts, approximate or recycled points", async () => {
    for (const city of ["Quinte West", "Trenton", "Frankford", "Batawa"]) expect(quinteWestMarket(city, "ON")).toBe(true);
    expect(quinteWestMarket("Belleville", "ON")).toBe(false); expect(quinteWestMarket("Trenton", "NS")).toBe(false);
    expect(await quinteWestLocation({ address: "15 Dundas St E, Trenton, ON", city: "Quinte West" })).toBeNull();
    expect((await quinteWestLocation({ address: "15 Dundas St E, Belleville, ON", city: "Quinte West" }))?.status).toBe("ambiguous");
    expect((await quinteWestLocation({ address: "15 Dundas St E, Trenton, BC", province: "ON" }))?.status).toBe("ambiguous");
    for (const l of [{ ...location, accuracy: "street_interpolated" }, { ...location, accuracy: "blockface_representative" }, { ...location, provider: "quintewest:footprint" }, { ...location, city: "Belleville" }, { ...location, latitude: 45 }, { ...location, longitude: NaN }]) {
      json.mockClear(); const r = await quinteWestLayers("Quinte West", "ON", l); expect(r.municipality.status).toBe("skipped"); expect(r.parkReference.status).toBe("skipped"); expect(json).not.toHaveBeenCalled();
    }
  });
  it("requires one complete typed provincial polygon naming Quinte West and never substitutes the City polyline", async () => {
    for (const municipality of [[], [{ attributes: { OBJECTID: 1, MUNICIPAL_NAME: "BELLEVILLE" } }], [{ attributes: { OBJECTID: 1, MUNICIPAL_NAME: "QUINTE WEST" } }, { attributes: { OBJECTID: 2, MUNICIPAL_NAME: "QUINTE WEST" } }], [{ attributes: { OBJECTID: "1", MUNICIPAL_NAME: "QUINTE WEST" } }]]) {
      json.mockClear().mockImplementation(provider({ municipality })); const r = await quinteWestLayers("Trenton", "ON", location); expect(r.buildingFootprintReference.status).toBe("skipped"); expect(json.mock.calls.filter(([u]) => u.pathname.endsWith("/query")).every(([u]) => u.href.startsWith(provincial.url))).toBe(true);
    }
    json.mockImplementation(provider({}, { municipality: { exceededTransferLimit: true } })); expect((await quinteWestLayers("Trenton", "ON", location)).nearbySchools.status).toBe("skipped");
    json.mockClear().mockImplementation(provider()); provincialMetadata.mockRejectedValue(Error("grant changed")); expect((await quinteWestLayers("Trenton", "ON", location)).municipality.status).toBe("unavailable"); expect(json).not.toHaveBeenCalled();
    expect(provincialMetadata).toHaveBeenCalledWith(provincial, expect.any(Map));
  });
  it("returns only footprint IDs and bounded nearby references without property/measurement/risk or school-ranking claims", async () => {
    json.mockImplementation(provider({ buildingFootprintReference: [record(feed("buildingFootprintReference"), { Address: "other", Building_ht: 80, Floors: "20", Shape__Area: 500 })], parkReference: [record(feed("parkReference"), { park_name: "Published park", Ownership: "PRIVATE" })], stormwaterReference: [record(feed("stormwaterReference"), { class: "Pond", notes1: "PRIVATE" })], nearbySchools: [record(feed("nearbySchools"), { school_nam: "Published school", website: "PRIVATE" })] }));
    const r = await quinteWestLayers("Trenton", "ON", location);
    expect(r.buildingFootprintReference.data).toMatchObject({ records: [{ recordId: 1 }], originalObservationDate: null, currentFootprintVerified: false, measuredBuildingAreaReturned: false });
    expect(r.stormwaterReference.data).toMatchObject({ scope: "nearby_reference_only", searchRadiusMeters: 1000, subjectPropertyRecords: false, floodplainScreenPerformed: false, drainagePerformanceEstablished: false });
    expect(r.nearbySchools.data).toMatchObject({ catchmentEstablished: false, enrolmentEstablished: false, performanceRankingPerformed: false });
    expect(JSON.stringify(r)).not.toContain("PRIVATE"); expect(bytes).toHaveBeenCalledTimes(1);
    const queries = json.mock.calls.map(([u]) => u as URL).filter(u => u.pathname.endsWith("/query"));
    expect(queries.every(u => u.searchParams.get("returnGeometry") === "false" && !/\*|Address|Building_ht|Floors|Shape__|Ownership|notes1|website/i.test(u.searchParams.get("outFields") ?? ""))).toBe(true);
    for (const f of QUINTEWEST_FEEDS) expect(queries.find(u => u.href.startsWith(f.url + "/query"))?.searchParams.get("distance")).toBe(f.radiusMeters ? "1000" : null);
    const brief = preShowingBrief(r, []); expect(brief.findings.find(x => x.layer === "stormwaterReference")?.summary).toContain("no subject drainage"); expect(brief.documentsToRequest.some(x => x.document.includes("Quinte West"))).toBe(true);
  });
  it("preserves dates, no-match, typed outages, duplicates and bounded truncation without establishing absence", async () => {
    expect((await quinteWestMetadata(feed("parkReference"))).sourceUpdatedAt?.startsWith("2025-")).toBe(true);
    json.mockImplementation(provider({}, { metadata: { editingInfo: { lastEditDate: 1790000000000 } } })); expect((await quinteWestMetadata(feed("parkReference"))).sourceUpdatedAt).toBeNull();
    const f = feed("nearbySchools"); json.mockImplementation(provider({ nearbySchools: Array.from({ length: 51 }, (_, i) => record(f, { objectid: i + 1, school_nam: "Published school" })) }));
    let r = await quinteWestLayers("Trenton", "ON", location); expect(r.nearbySchools.truncated).toBe(true); expect((r.nearbySchools.data as Row).records).toHaveLength(50); expect(r.nearbySchools.data).toMatchObject({ queryCoverageComplete: false, absenceEstablished: false });
    for (const records of [[record(f, { school_nam: 7 })], [record(f), record(f)]]) { json.mockImplementation(provider({ nearbySchools: records })); expect((await quinteWestLayers("Trenton", "ON", location)).nearbySchools.status).toBe("unavailable"); }
    json.mockImplementation(provider({}, { parkReference: { exceededTransferLimit: true }, stormwaterReference: { error: { code: 500 } } })); r = await quinteWestLayers("Trenton", "ON", location); expect(r.parkReference.status).toBe("unavailable"); expect(r.stormwaterReference.status).toBe("unavailable"); expect(r.buildingFootprintReference.status).toBe("no_match"); expect(r.buildingFootprintReference.data).toMatchObject({ absenceEstablished: false });
  });
  it("does not query/count withheld terrain, general GIS or duplicate the province-wide dataset", async () => {
    const r = await quinteWestLayers("Trenton", "ON", location); const c = await quinteWestCoverage();
    expect(c.datasets).toHaveLength(4); expect(c.datasets.every(x => x.status === "verified")).toBe(true); expect(c.municipalityReference.countIncludedHere).toBe(false); expect(c.withheld).toHaveLength(11); expect(c.complete).toBe(false);
    for (const g of QUINTEWEST_WITHHELD) expect((r[g.layer].data as Row).recordsQueried).toBe(false);
    expect(json.mock.calls.filter(([u]) => u.pathname.endsWith("/query")).every(([u]) => u.href.startsWith(provincial.url + "/query") || QUINTEWEST_FEEDS.some(f => u.href.startsWith(f.url + "/query")))).toBe(true);
    json.mockImplementation(provider({}, { count: { count: -1 } })); expect((await quinteWestCoverage()).datasets.every(x => x.records === null && x.status === "unavailable")).toBe(true);
    const m = ontarioMarketRoadmap().municipalities.find(x => x.city === "Quinte West")!; expect(m.complete).toBe(false); expect(m.configuredLayers).toContain("stormwaterReference"); expect(m.withheldLayers.some(x => x.layer === "zoning")).toBe(true);
  });
  it("keeps Belleville's originating commercial reuse gap visible without any record reads", () => {
    const r = bellevilleLayers("Belleville", "ON"), c = bellevilleCoverage(); expect(c.datasets).toEqual([]); expect(c.audit.recordsQueried).toBe(false); expect(c.withheld).toHaveLength(9); expect(c.complete).toBe(false); expect(bellevilleLayers("Belleville", "BC")).toEqual({});
    for (const v of Object.values(r)) { expect(v.status).toBe("unavailable"); expect(v.data).toMatchObject({ recordsQueried: false }); }
    expect(json).not.toHaveBeenCalled(); expect(preShowingBrief(r, []).documentsToRequest.some(x => x.document.includes("Belleville"))).toBe(true);
    expect(ontarioMarketRoadmap().municipalities.find(x => x.city === "Belleville")?.stage).toBe("audited_reuse_gap");
  });
});
