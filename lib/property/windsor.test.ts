import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { windsorCoverage, windsorLayers, windsorLocation, windsorMarket, windsorMetadata } from "./windsor";
import { WINDSOR_FEEDS, WINDSOR_GRANT, WINDSOR_WITHHELD, type WindsorFeed } from "./windsor-sources";
import type { Location, Row } from "./model";
import { preShowingBrief } from "./brief";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
const { json, bytes } = vi.hoisted(() => ({ json: vi.fn(), bytes: vi.fn() }));
vi.mock("./http", async () => ({ ...await vi.importActual<typeof import("./http")>("./http"), fetchJson: json, fetchBytes: bytes }));
const fixture: Record<string, Row> = JSON.parse(readFileSync(new URL("./fixtures/windsor-grant.json", import.meta.url), "utf8"));
const licence = readFileSync(new URL("./fixtures/windsor-licence.pdf", import.meta.url));
const feed = (k: string) => WINDSOR_FEEDS.find(f => f.key === k)!;
const location: Location = { address: "12 King St W", city: "Windsor", province: "ON", latitude: 42.3, longitude: -83.02, accuracy: "source_building_point", provider: "national-address-register" };
const record = (f: WindsorFeed, a: Row = {}) => ({ attributes: { ...Object.fromEntries(Object.keys(f.fields).map(k => [k, null])), [f.oid]: 1, ...a }, geometry: { x: -79, y: 44 } });
function provider(records: Record<string, unknown[]> = {}, changes: Record<string, Row | undefined> = {}) {
  return async (u: URL) => {
    if (u.pathname.endsWith("/query")) {
      const f = WINDSOR_FEEDS.find(f => u.href.split("?")[0] === f.url + "/query"); if (!f) throw Error("Unexpected query");
      return u.searchParams.get("returnCountOnly") === "true" ? { count: 10, ...changes.count } : { features: records[f.key] ?? (f.key === "municipality" ? [record(f, { Name: "Windsor" })] : f.key === "addresses" ? [record(f, { Address: "12 KING ST W", street_address: "12", street_name: "KING", street_suffix: "ST", street_direction: "W", unit_number: "" })] : []), ...changes[f.key] };
    }
    if (u.pathname.endsWith("/search")) {
      const id = u.searchParams.get("q")?.match(/^id:([a-f0-9]{32}) AND group:/)?.[1];
      if (!id || !u.searchParams.get("q")?.endsWith(WINDSOR_GRANT.group)) throw Error("Unexpected curation query");
      return { ...fixture["curation:" + id], ...changes.curated };
    }
    const original = fixture[u.origin + u.pathname]; if (!original) throw Error("Unexpected metadata");
    const kind = u.pathname.endsWith(WINDSOR_GRANT.page + "/data") ? "pageData" : u.pathname.endsWith(WINDSOR_GRANT.site + "/data") ? "siteData" :
      u.pathname.endsWith(WINDSOR_GRANT.page) ? "page" : u.pathname.endsWith(WINDSOR_GRANT.site) ? "site" : u.pathname.includes("/groups/") ? "group" :
        u.pathname.includes("/sharing/") ? "item" : u.pathname.endsWith("/MapServer") ? "root" : "metadata";
    return { ...original, ...changes[kind] };
  };
}
beforeEach(() => { json.mockReset().mockImplementation(provider()); bytes.mockReset().mockResolvedValue(licence); });
afterEach(() => vi.restoreAllMocks());
describe("Windsor licensed City references", () => {
  it("binds exact City curation, publisher, grant, independent named root/child and schema before any query", async () => {
    for (const f of WINDSOR_FEEDS) expect(await windsorMetadata(f)).toEqual({ sourceUpdatedAt: null });
    for (const change of [{ item: { owner: "copy" } }, { item: { orgId: "invented" } }, { item: { access: "private" } }, { item: { url: feed("zoningExceptions").rootUrl } }, { item: { licenseInfo: "public access" } }, { item: { description: "Replacement lineage" } },
      { root: { serviceItemId: feed("zoningExceptions").item } }, { root: { layers: [] } }, { root: { description: "Supplier" } }, { metadata: { serviceItemId: "other" } }, { metadata: { id: 0 } }, { metadata: { geometryType: "esriGeometryPoint" } }, { metadata: { copyrightText: "Third party" } }, { metadata: { fields: [] } },
      { metadata: { objectIdField: "other" } }, { curated: { total: 0, results: [] } }, { site: { url: "https://copy.invalid" } }, { siteData: { values: {} } }, { page: { owner: "copy" } }, { pageData: { values: {} } }, { group: { owner: "copy" } }]) {
      json.mockClear().mockImplementation(provider({}, change)); await expect(windsorMetadata(feed("zoningExceptions"))).rejects.toThrow(); expect(json.mock.calls.some(([u]) => u.pathname.endsWith("/query"))).toBe(false);
    }
  });
  it("requires full PDF bytes and linked site/page/catalogue scopes, not the licence title", async () => {
    bytes.mockResolvedValue(Buffer.from("Open Government Licence – City of Windsor")); await expect(windsorMetadata(feed("addresses"))).rejects.toThrow(); expect(json.mock.calls.some(([u]) => u.pathname.endsWith("/query"))).toBe(false);
    bytes.mockResolvedValue(licence);
    const base = "https://www.arcgis.com/sharing/rest/content/items/", sd = fixture[base + WINDSOR_GRANT.site + "/data"];
    for (const change of [{ siteData: { values: { ...sd.values as Row, defaultHostname: "copy.invalid" } } }, { siteData: { values: { ...sd.values as Row, pages: [] } } }, { siteData: { catalogV2: { scopes: { item: { filters: [] } } } } }]) {
      json.mockImplementation(provider({}, change)); await expect(windsorMetadata(feed("heritage"))).rejects.toThrow();
    }
  });
  it("does not treat ambiguous City address-point geometry as precise identity and rejects conflicting requests", async () => {
    expect(await windsorLocation({ address: "12 King St W, Windsor, ON" })).toBeNull();
    expect((await windsorLocation({ address: "12 King St W, LaSalle, ON", city: "Windsor" }))?.status).toBe("ambiguous");
    expect((await windsorLocation({ address: "12 King St W, Windsor, BC", province: "ON" }))?.status).toBe("ambiguous");
    for (const l of [{ ...location, accuracy: "unknown" }, { ...location, provider: "windsor:addresses", accuracy: "source_civic_address_point" }, { ...location, city: "LaSalle" }, { ...location, latitude: 43 }]) {
      json.mockClear(); expect((await windsorLayers(location.address, "Windsor", "ON", l)).zoningExceptions.status).toBe("skipped"); expect(json).not.toHaveBeenCalled();
    }
    expect(windsorMarket("City of Windsor", "Ontario")).toBe(true); expect(windsorMarket("Windsor", "NS")).toBe(false);
  });
  it("returns strict civic/heritage attributes for approximate street positions without spatial screening", async () => {
    json.mockImplementation(provider({ heritage: [record(feed("heritage"), { ADDRESS: "12 KING ST W", BUILDING_N: "Example" })] }));
    const r = await windsorLayers(location.address, "Windsor", "ON", { ...location, accuracy: "street_interpolated", provider: "nrcan-geolocator" });
    expect(r.municipality.status).toBe("skipped"); expect(r.municipalAddresses.status).toBe("available"); expect(r.heritage.status).toBe("available"); expect(r.heritage.data).toMatchObject({ spatialScreenPerformed: false, screenedPoint: null, sourcePointGeometryReused: false }); expect(r.zoningExceptions.status).toBe("skipped");
    expect(json.mock.calls.filter(([u]) => u.pathname.endsWith("/query")).every(([u]) => !u.searchParams.has("geometry"))).toBe(true);
    json.mockImplementation(provider({ addresses: [] })); expect((await windsorLayers(location.address, "Windsor", "ON", { ...location, accuracy: "street_interpolated" })).heritage.status).toBe("skipped");
  });
  it("requires one matching licensed City polygon before other property queries", async () => {
    for (const records of [[], [record(feed("municipality"), { Name: "LaSalle" })], [record(feed("municipality"), { Name: "Windsor" }), record(feed("municipality"), { OBJECTID: 2, Name: "Windsor" })]]) {
      json.mockClear().mockImplementation(provider({ municipality: records })); const r = await windsorLayers(location.address, "Windsor", "ON", location);
      expect(r.zoningExceptions.status).toBe("skipped"); expect(json.mock.calls.filter(([u]) => u.pathname.endsWith("/query")).every(([u]) => u.pathname.endsWith("/Boundaries/MapServer/0/query"))).toBe(true);
    }
    json.mockClear().mockImplementation(provider({}, { municipality: { exceededTransferLimit: true } })); expect((await windsorLayers(location.address, "Windsor", "ON", location)).heritage.status).toBe("skipped");
    json.mockClear().mockImplementation(provider({}, { item: { licenseInfo: "" } })); expect((await windsorLayers(location.address, "Windsor", "ON", location)).municipality.status).toBe("unavailable"); expect(json.mock.calls.some(([u]) => u.pathname.endsWith("/query"))).toBe(false);
  });
  it("requires civic full address and components including number, type, direction and blank unit", async () => {
    const f = feed("addresses"), a = { Address: "12 KING ST W", street_address: "12", street_name: "KING", street_suffix: "ST", street_direction: "W", unit_number: "" };
    json.mockImplementation(provider({ addresses: [record(f, a)] })); expect((await windsorLayers("12 King Street West", "Windsor", "ON", location)).municipalAddresses.status).toBe("available");
    for (const change of [{ street_address: "13" }, { street_suffix: "RD" }, { street_direction: "E" }, { unit_number: "2" }, { Address: "12-14 KING ST W" }]) {
      json.mockImplementation(provider({ addresses: [record(f, { ...a, ...change })] })); expect((await windsorLayers(location.address, "Windsor", "ON", location)).municipalAddresses.status).toBe("no_match");
    }
    json.mockImplementation(provider({ addresses: [record(f, { ...a, Address: "12A KING ST W", street_address: "12A" })] })); expect((await windsorLayers("12A King St W", "Windsor", "ON", location)).municipalAddresses.status).toBe("available");
  });
  it("retains Section20, heritage-area type and record edit dates without asserting base zoning or feed currency", async () => {
    json.mockImplementation(provider({ zoningExceptions: [record(feed("zoningExceptions"), { ZONE_TYPE: "S20", ZONE_NUM: "S.20(1)236", last_edited_date: 1751582458000 })], heritageAreas: [record(feed("heritageAreas"), { TYPE: "Heritage Area", NAME: "Walkerville" })], planningDistrict: [record(feed("planningDistrict"), { NAME: "Walkerville" })], archaeologicalReference: [record(feed("archaeologicalReference"), { CLASSIFICATION: "Archaeologically Sensitive Area" })] }));
    const r = await windsorLayers(location.address, "Windsor", "ON", location);
    expect(r.zoningExceptions.data).toMatchObject({ baseZoningScreenPerformed: false, annexZoningScreenPerformed: false, legalPermissionsEstablished: false, records: [expect.objectContaining({ publishedSection20Number: "S.20(1)236", publishedRecordEditDate: "2025-07-03T22:40:58.000Z" })] }); expect(r.zoningExceptions.sourceUpdatedAt).toBeNull();
    expect(r.heritageAreas.data).toMatchObject({ currentRegisterVerified: false, heritageConservationDistrictEstablished: false }); expect(r.planningDistrict.data).toMatchObject({ officialPlanLandUseDesignationEstablished: false }); expect(r.archaeologicalReference.data).toMatchObject({ archaeologicalSiteInventoryQueried: false, archaeologicalClearanceEstablished: false });
    const brief = preShowingBrief(r, []); expect(brief.findings.find(x => x.layer === "zoningExceptions")?.summary).toContain("Section20"); expect(brief.documentsToRequest.some(x => x.document.includes("Windsor"))).toBe(true);
  });
  it("reads exact heritage addresses without approximate point geometry, owners, legal identifiers or wildcard fields", async () => {
    json.mockImplementation(provider({ heritage: [record(feed("heritage"), { ADDRESS: "12 KING ST W", BUILDING_N: "Example", HERITAGE_D: "Heritage Register: Listed", OWNER: "PRIVATE", PROP_RSN: 123 })] }));
    const r = await windsorLayers(location.address, "Windsor", "ON", location); expect(r.heritage.data).toMatchObject({ sourcePointGeometryReused: false, currentRegisterVerified: false, records: [expect.objectContaining({ publishedHeritageDesignation: "Heritage Register: Listed" })] }); expect(JSON.stringify(r)).not.toContain("PRIVATE");
    const calls = json.mock.calls.filter(([u]) => u.pathname.endsWith("/query")); expect(calls.every(([u]) => u.searchParams.get("returnGeometry") === "false")).toBe(true); expect(calls.every(([u]) => !/(\*|OWNER|PROP_RSN|ROLL|LEGAL|COUNCILLOR|created_user|last_edited_user|Frontage|Depth|Bld_Ht)/i.test(u.searchParams.get("outFields") ?? ""))).toBe(true);
  });
  it("bounds results, keeps independent failures visible and never establishes absence or clearance", async () => {
    const f = feed("heritage"); json.mockImplementation(provider({ heritage: Array.from({ length: 51 }, (_, i) => record(f, { OBJECTID: i + 1, ADDRESS: "12 KING ST W" })) }, { zoningExceptions: { error: { code: 500 } } }));
    let r = await windsorLayers(location.address, "Windsor", "ON", location); expect(r.heritage.truncated).toBe(true); expect((r.heritage.data as Row).records).toHaveLength(50); expect(r.heritage.data).toMatchObject({ queryCoverageComplete: false, absenceEstablished: false }); expect(r.zoningExceptions.status).toBe("unavailable");
    json.mockImplementation(provider({ heritage: [record(f, { ADDRESS: 12 })] })); expect((await windsorLayers(location.address, "Windsor", "ON", location)).heritage.status).toBe("unavailable");
    json.mockImplementation(provider({}, { heritage: { exceededTransferLimit: true } })); expect((await windsorLayers(location.address, "Windsor", "ON", location)).heritage.status).toBe("unavailable");
    json.mockImplementation(provider()); r = await windsorLayers(location.address, "Windsor", "ON", location); expect(r.zoningExceptions.status).toBe("no_match"); expect(r.zoningExceptions.data).toMatchObject({ absenceEstablished: false }); expect(r.permits.status).toBe("unavailable"); expect(r.conservation.status).toBe("unavailable");
  });
  it("skips address histories for coordinate-only calls and excludes withheld record reads and counts", async () => {
    const r = await windsorLayers(null, "Windsor", "ON", { ...location, accuracy: "caller_supplied", provider: "caller" }); expect(r.heritage.status).toBe("skipped"); expect(r.municipalAddresses.status).toBe("skipped");
    const c = await windsorCoverage(); expect(c.datasets).toHaveLength(9); expect(c.datasets.every(x => x.status === "verified")).toBe(true); expect(c.withheld).toHaveLength(10); expect(c.withheld.every(x => x.records === null)).toBe(true); expect(c.complete).toBe(false);
    for (const f of WINDSOR_WITHHELD) expect(json.mock.calls.some(([u]) => u.href.startsWith(f.url + "/query"))).toBe(false);
    json.mockImplementation(provider({}, { count: { count: -1 } })); expect((await windsorCoverage()).datasets.every(x => x.status === "unavailable" && x.records === null)).toBe(true);
    const m = ontarioMarketRoadmap().municipalities.find(m => m.city === "Windsor")!; expect(m.configuredLayers).toContain("zoningExceptions"); expect(m.withheldLayers.some(x => x.layer === "permits")).toBe(true); expect(m.complete).toBe(false);
  });
});
