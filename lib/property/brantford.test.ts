import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { brantfordCoverage, brantfordLayers, brantfordLocation, brantfordMarket, brantfordMetadata } from "./brantford";
import { BRANTFORD_FEEDS, BRANTFORD_GRANT, BRANTFORD_WITHHELD, type BrantfordFeed } from "./brantford-sources";
import type { Location, Row } from "./model";
import { preShowingBrief } from "./brief";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
const { json, html } = vi.hoisted(() => ({ json: vi.fn(), html: vi.fn() }));
vi.mock("./http", async () => ({ ...await vi.importActual<typeof import("./http")>("./http"), fetchJson: json, fetchText: html }));
const fixture: Record<string, Row> = JSON.parse(readFileSync(new URL("./fixtures/brantford-grant.json", import.meta.url), "utf8"));
const offer = readFileSync(new URL("./fixtures/brantford-offer.html", import.meta.url), "utf8");
const feed = (k: string) => BRANTFORD_FEEDS.find(f => f.key === k)!;
const location: Location = { address: "12 King St", city: "Brantford", province: "ON", latitude: 43.14, longitude: -80.26, accuracy: "source_building_point", provider: "national-address-register" };
const record = (f: BrantfordFeed, values: Row = {}) => ({ attributes: Object.fromEntries(Object.keys(f.fields).map(k => [k, k === f.oid ? 1 : values[k] ?? null])) });
const civic = { FULLADDRESS: "12 KING ST", STREETNUM: "12", STNUMSUFF: "", STREETNAME: "KING", STREETTYPE: "ST", POSTALCODE: "N3T 1A1" };
function provider(data: Record<string, Row[]> = {}, changes: Record<string, Row | undefined> = {}) {
  return async (u: URL) => {
    if (u.pathname.endsWith("/query")) {
      const f = BRANTFORD_FEEDS.find(f => u.href.startsWith(f.url + "/query")); if (!f) throw Error("Unexpected query");
      if (u.searchParams.get("returnCountOnly") === "true") return { count: 1, ...changes.count };
      return { features: data[f.key] ?? (f.key === "municipality" ? [record(f, { NAME: "Brantford" })] : f.key === "municipalAddresses" ? [record(f, civic)] : []), ...changes[f.key] };
    }
    if (u.pathname.endsWith("/search")) {
      const id = u.searchParams.get("q")?.match(/^id:([a-f0-9]{32}) AND group:/)?.[1]; if (!id || !u.searchParams.get("q")?.endsWith(BRANTFORD_GRANT.group)) throw Error("Unexpected curation");
      return { ...fixture["curation:" + id], ...changes.curated };
    }
    const value = fixture[u.origin + u.pathname]; if (!value) throw Error("Unexpected metadata");
    const kind = u.pathname.endsWith(BRANTFORD_GRANT.page + "/data") ? "pageData" : u.pathname.endsWith(BRANTFORD_GRANT.site + "/data") ? "siteData" : u.pathname.endsWith(BRANTFORD_GRANT.page) ? "page" : u.pathname.endsWith(BRANTFORD_GRANT.site) ? "site" : u.pathname.includes("/groups/") ? "group" : u.pathname.includes("/sharing/") ? "item" : u.pathname.endsWith("/FeatureServer") ? "root" : "metadata";
    return { ...value, ...changes[kind] };
  };
}
beforeEach(() => { json.mockReset().mockImplementation(provider()); html.mockReset().mockResolvedValue(offer); vi.spyOn(console, "warn").mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());
describe("Brantford City catalogue references", () => {
  it("requires full linked grant, exact official offer, curation, publisher, lineage and typed child before queries", async () => {
    for (const f of BRANTFORD_FEEDS) expect((await brantfordMetadata(f)).sourceUpdatedAt).toBeTruthy();
    for (const change of [{ item: { owner: "copy" } }, { item: { orgId: "invented" } }, { item: { licenseInfo: "public" } }, { item: { url: feed("ward").rootUrl } }, { root: { serviceItemId: "other" } }, { root: { copyrightText: "Third party" } }, { root: { layers: [] } }, { metadata: { fields: [] } }, { metadata: { objectIdField: "other" } }, { metadata: { geometryType: "esriGeometryPoint" } }, { curated: { total: 0, results: [] } }, { site: { owner: "copy" } }, { site: { orgId: "invented" } }, { siteData: { values: {} } }, { group: { isOpenData: false } }, { page: { owner: "copy" } }, { pageData: { values: {} } }]) {
      json.mockClear().mockImplementation(provider({}, change)); await expect(brantfordMetadata(feed("catalogueZoningReference"))).rejects.toThrow(); expect(json.mock.calls.some(([u]) => u.pathname.endsWith("/query"))).toBe(false);
    }
    json.mockImplementation(provider()); html.mockResolvedValue("City of Brantford Open Data"); await expect(brantfordMetadata(feed("municipalAddresses"))).rejects.toThrow();
    html.mockResolvedValue(offer); const i = fixture['https://www.arcgis.com/sharing/rest/content/items/' + feed('ward').item];
    json.mockImplementation(provider({}, { item: { licenseInfo: String(i.licenseInfo).replace('data-brantford.opendata.arcgis.com','copy.invalid') } })); await expect(brantfordMetadata(feed('ward'))).rejects.toThrow();
  });
  it("retains actual 2023 data currency independently of 2026 item/schema edits", async () => {
    const r = await brantfordLayers(location.address, "Brantford", "ON", location);
    expect(r.catalogueZoningReference.sourceUpdatedAt?.startsWith("2023-")).toBe(true); expect(r.buildingFootprintReference.sourceUpdatedAt?.startsWith("2023-")).toBe(true);
    expect(r.ward.sourceUpdatedAt?.startsWith("2024-")).toBe(true); expect(r.municipalAddresses.sourceUpdatedAt?.startsWith("2026-")).toBe(true);
    json.mockImplementation(provider({}, { metadata: { editingInfo: { lastEditDate: 1790000000000 } } })); expect((await brantfordMetadata(feed("ward"))).sourceUpdatedAt).toBeNull();
  });
  it("preserves independent precision and rejects City/province conflicts and City source geometry", async () => {
    expect(await brantfordLocation({ address: "12 King St, Brantford, ON" })).toBeNull(); expect(brantfordMarket("Brant", "ON")).toBe(false);
    expect((await brantfordLocation({ address: "12 King St, Brant, ON", city: "Brantford" }))?.status).toBe("ambiguous");
    expect((await brantfordLocation({ address: "12 King St, Brantford, BC", province: "ON" }))?.status).toBe("ambiguous");
    for (const l of [{ ...location, provider: "brantford:municipalAddresses", accuracy: "source_civic_address_point" }, { ...location, accuracy: "unknown" }, { ...location, city: "Brant" }, { ...location, latitude: 44 }]) {
      json.mockClear(); const r = await brantfordLayers(location.address, "Brantford", "ON", l); expect(r.catalogueZoningReference.status).toBe("skipped"); expect(json).not.toHaveBeenCalled();
    }
  });
  it("matches strict civic components, number suffix and unique rows without point reuse", async () => {
    for (const change of [{ STREETNUM: "13" }, { STNUMSUFF: "A" }, { STREETTYPE: "RD" }, { STREETNAME: "KING WEST" }, { FULLADDRESS: "12-14 KING ST" }, { FULLADDRESS: "12 KING ST, Brant" }]) {
      json.mockImplementation(provider({ municipalAddresses: [record(feed("municipalAddresses"), { ...civic, ...change })] })); expect((await brantfordLayers(location.address, "Brantford", "ON", location)).municipalAddresses.status).toBe("no_match");
    }
    json.mockClear().mockImplementation(provider({ municipalAddresses: [record(feed("municipalAddresses"), { ...civic, FULLADDRESS: "12 KING AV", STREETTYPE: "AV" })] }));
    expect((await brantfordLayers("12 King Avenue", "Brantford", "ON", location)).municipalAddresses.status).toBe("available");
    expect(json.mock.calls.find(([u]) => u.href.startsWith(feed("municipalAddresses").url + "/query"))?.[0].searchParams.get("where")).toContain("'12 KING AV'");
    json.mockImplementation(provider({ municipalAddresses: [record(feed("municipalAddresses"), { ...civic, FULLADDRESS: "12A KING ST", STNUMSUFF: "A" })] })); expect((await brantfordLayers("12A King Street", "Brantford", "ON", location)).municipalAddresses.status).toBe("available");
    json.mockImplementation(provider({ municipalAddresses: [record(feed("municipalAddresses"), civic), record(feed("municipalAddresses"), { ...civic, OBJECTID: 2 })] })); expect((await brantfordLayers(location.address, "Brantford", "ON", location)).municipalAddresses.status).toBe("ambiguous");
    json.mockClear().mockImplementation(provider()); const r = await brantfordLayers(location.address, "Brantford", "ON", { ...location, accuracy: "street_interpolated" });
    expect(r.municipalAddresses.data).toMatchObject({ screenedPoint: null, spatialScreenPerformed: false, sourcePointGeometryReused: false }); expect(r.catalogueZoningReference.status).toBe("skipped"); expect(json.mock.calls.filter(([u]) => u.pathname.endsWith("/query")).every(([u]) => !u.searchParams.has("geometry"))).toBe(true);
  });
  it("requires one complete named boundary before reference queries", async () => {
    for (const municipality of [[], [record(feed("municipality"), { NAME: "County of Brant" })], [record(feed("municipality"), { NAME: "Brantford" }), record(feed("municipality"), { OBJECTID: 2, NAME: "Brantford" })]]) {
      json.mockClear().mockImplementation(provider({ municipality })); const r = await brantfordLayers(location.address, "Brantford", "ON", location); expect(r.ward.status).toBe("skipped"); expect(json.mock.calls.filter(([u]) => u.pathname.endsWith("/query")).every(([u]) => u.href.startsWith(feed("municipality").url))).toBe(true);
    }
    json.mockImplementation(provider({}, { municipality: { exceededTransferLimit: true } })); expect((await brantfordLayers(location.address, "Brantford", "ON", location)).catalogueZoningReference.status).toBe("skipped");
  });
  it("never turns reference overlaps into current zoning, building measurements, floodplain or permission", async () => {
    json.mockImplementation(provider({ catalogueZoningReference: [record(feed("catalogueZoningReference"), { ZONECLASS: "R1A", ZONEDESC: "Residential" })], buildingFootprintReference: [record(feed("buildingFootprintReference"), { Shape__Area: 500, OWNER: "PRIVATE" })], waterBodyReference: [record(feed("waterBodyReference"), { TYPE: "River" })] }));
    const r = await brantfordLayers(location.address, "Brantford", "ON", location);
    expect(r.catalogueZoningReference.data).toMatchObject({ governingBylawVerified: false, currentZoningScreenPerformed: false, interimControlAreaScreenPerformed: false, legalPermissionsEstablished: false });
    expect(r.buildingFootprintReference.data).toMatchObject({ records: [{ recordId: 1 }], buildingIdentityEstablished: false, measuredBuildingAreaReturned: false });
    expect(r.waterBodyReference.data).toMatchObject({ currentFloodplainScreenPerformed: false, currentConservationRegulationScreenPerformed: false });
    const brief = preShowingBrief(r, []); expect(brief.findings.find(x => x.layer === "catalogueZoningReference")?.summary).toContain("2023"); expect(brief.documentsToRequest.some(x => x.document.includes("Brantford"))).toBe(true);
    expect(JSON.stringify(r)).not.toContain("PRIVATE"); expect(json.mock.calls.filter(([u]) => u.pathname.endsWith("/query")).every(([u]) => u.searchParams.get("returnGeometry") === "false" && !/\*|OWNER|Shape__|Creator|Editor/i.test(u.searchParams.get("outFields") ?? ""))).toBe(true);
  });
  it("keeps bounded truncation, typed failures and incomplete empties visible without absence inference", async () => {
    const f = feed("catalogueZoningReference"); json.mockImplementation(provider({ catalogueZoningReference: Array.from({ length: 51 }, (_, i) => record(f, { OBJECTID: i + 1, ZONECLASS: "R1A" })) }, { waterBodyReference: { error: { code: 500 } } }));
    let r = await brantfordLayers(location.address, "Brantford", "ON", location); expect(r.catalogueZoningReference.truncated).toBe(true); expect((r.catalogueZoningReference.data as Row).records).toHaveLength(50); expect(r.catalogueZoningReference.data).toMatchObject({ absenceEstablished: false, queryCoverageComplete: false }); expect(r.waterBodyReference.status).toBe("unavailable");
    json.mockImplementation(provider({ catalogueZoningReference: [record(f, { ZONECLASS: 7 })] })); expect((await brantfordLayers(location.address, "Brantford", "ON", location)).catalogueZoningReference.status).toBe("unavailable");
    json.mockImplementation(provider({}, { catalogueZoningReference: { exceededTransferLimit: true } })); expect((await brantfordLayers(location.address, "Brantford", "ON", location)).catalogueZoningReference.status).toBe("unavailable");
    json.mockImplementation(provider()); r = await brantfordLayers(location.address, "Brantford", "ON", location); expect(r.catalogueZoningReference.status).toBe("no_match"); expect(r.catalogueZoningReference.data).toMatchObject({ absenceEstablished: false });
  });
  it("excludes withheld source queries and counts, skips coordinate-only civic reads, and keeps the market incomplete", async () => {
    const r = await brantfordLayers(null, "Brantford", "ON", { ...location, accuracy: "caller_supplied", provider: "caller" }); expect(r.municipalAddresses.status).toBe("skipped");
    const c = await brantfordCoverage(); expect(c.datasets).toHaveLength(6); expect(c.datasets.every(x => x.status === "verified")).toBe(true); expect(c.withheld).toHaveLength(8); expect(c.complete).toBe(false);
    for (const g of BRANTFORD_WITHHELD) expect((r[g.layer].data as Row).recordsQueried).toBe(false);
    expect(json.mock.calls.filter(([u]) => u.pathname.endsWith("/query")).every(([u]) => BRANTFORD_FEEDS.some(f => u.href.startsWith(f.url + "/query")))).toBe(true);
    json.mockImplementation(provider({}, { count: { count: -1 } })); expect((await brantfordCoverage()).datasets.every(x => x.status === "unavailable" && x.records === null)).toBe(true);
    const m = ontarioMarketRoadmap().municipalities.find(m => m.city === "Brantford")!; expect(m.configuredLayers).toContain("catalogueZoningReference"); expect(m.withheldLayers.some(x => x.layer === "permits")).toBe(true); expect(m.complete).toBe(false);
  });
});
