import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cornwallCoverage, cornwallLayers, cornwallLocation, cornwallMarket, cornwallMetadata, cornwallResearch } from "./cornwall";
import { CORNWALL_FEEDS, CORNWALL_GRANT, CORNWALL_WITHHELD, type CornwallFeed } from "./cornwall-sources";
import { NIAGARA_FEEDS } from "./niagara-sources";
import { preShowingBrief } from "./brief";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
import { PROPERTY_SKILL } from "./skill";
import { PROPERTY_OPENAPI } from "./openapi";
import type { Location, Row } from "./model";
const { json, html, bytes, provincialMetadata } = vi.hoisted(() => ({ json: vi.fn(), html: vi.fn(), bytes: vi.fn(), provincialMetadata: vi.fn() }));
vi.mock("./http", async () => ({ ...await vi.importActual<typeof import("./http")>("./http"), fetchJson: json, fetchText: html, fetchBytes: bytes }));
vi.mock("./niagara", () => ({ niagaraMetadata: provincialMetadata }));
const fixture: Record<string, Row> = JSON.parse(readFileSync(new URL("./fixtures/cornwall-grant.json", import.meta.url), "utf8"));
const offer = readFileSync(new URL("./fixtures/cornwall-offer.html", import.meta.url), "utf8"), licence = readFileSync(new URL("./fixtures/cornwall-licence.pdf", import.meta.url));
const feed = (key: string) => CORNWALL_FEEDS.find(f => f.key === key)!;
const provincial = NIAGARA_FEEDS.find(f => f.key === "ontarioMunicipality")!;
const location: Location = { address: "360 Pitt St", city: "Cornwall", province: "ON", latitude: 45.0209, longitude: -74.7305, accuracy: "source_building_point", provider: "statcan-nar-202606" };
const record = (f: CornwallFeed, values: Row = {}) => ({ attributes: Object.fromEntries(Object.keys(f.fields).map(k => [k, k === f.oid ? values[k] ?? 1 : values[k] ?? null])) });
const civic = (values: Row = {}) => ({ ...record(feed("municipalAddresses"), { ADDRESS: "360 PITT ST", ST_NUMBER: 360, STREET: "PITT", STREET_LNG: "PITT ST", SUFFIX: "ST", CITY: "CORNWALL", PROVINCE: "ON", COUNTRY: "CA", ADD_TYPE: "PRIMARY", ...values }), geometry: { x: location.longitude, y: location.latitude } });
function provider(data: Record<string, Row[]> = {}, changes: Record<string, Row | undefined> = {}) {
  return async (u: URL) => {
    if (u.pathname.endsWith("/query")) {
      if (u.href.startsWith(provincial.url + "/query")) return { features: data.municipality ?? [{ attributes: { OBJECTID: 1, MUNICIPAL_NAME: "CORNWALL" } }], ...changes.municipality };
      const f = CORNWALL_FEEDS.find(f => u.href.startsWith(f.url + "/query")); if (!f) throw Error("Unexpected query");
      if (u.searchParams.get("returnCountOnly") === "true") return { count: 1, ...changes.count };
      return { features: data[f.key] ?? (f.key === "municipalAddresses" ? [civic()] : []), geometryType: f.geometry, spatialReference: { wkid: 4326, latestWkid: 4326 }, ...changes[f.key] };
    }
    if (u.pathname.endsWith("/search")) {
      const id = u.searchParams.get("q")?.match(/^id:([a-f0-9]{32}) AND group:/)?.[1]; if (!id || !u.searchParams.get("q")?.endsWith(CORNWALL_GRANT.group)) throw Error("Unexpected curation");
      return { ...fixture["curation:" + id], ...changes.curated };
    }
    const value = fixture[u.origin + u.pathname]; if (!value) throw Error("Unexpected metadata");
    const kind = u.pathname.endsWith(CORNWALL_GRANT.site + "/data") ? "siteData" : u.pathname.endsWith(CORNWALL_GRANT.site) ? "site" : u.pathname.includes("/groups/") ? "group" : u.pathname.includes("/sharing/") ? "item" : u.pathname.endsWith("/FeatureServer") ? "root" : "metadata";
    return { ...value, ...changes[kind] };
  };
}
beforeEach(() => { json.mockReset().mockImplementation(provider()); html.mockReset().mockResolvedValue(offer); bytes.mockReset().mockResolvedValue(licence); provincialMetadata.mockReset().mockResolvedValue({ sourceUpdatedAt: null }); vi.spyOn(console, "warn").mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());
const screen = (address = location.address, l: Location | null = location) => cornwallLayers(address, "Cornwall", "ON", l);
const queries = () => json.mock.calls.map(([u]) => u as URL).filter(u => u.pathname.endsWith("/query"));
describe("Cornwall licensed civic and mapped references", () => {
  it("binds full current City offer/PDF, exact curated publisher, lineage and typed domains", async () => {
    for (const f of CORNWALL_FEEDS) await expect(cornwallMetadata(f)).resolves.toHaveProperty("sourceUpdatedAt");
    expect((await cornwallMetadata(feed("designatedHeritageReference"))).sourceUpdatedAt).toBe("2022-03-08T21:23:44.281Z");
    for (const change of [{ item: { owner: "copy" } }, { item: { orgId: null } }, { item: { licenseInfo: "public" } }, { item: { description: "third party" } }, { item: { url: "https://copy.invalid/" } }, { root: { serviceItemId: "other" } }, { root: { layers: [] } }, { root: { copyrightText: "Third party" } }, { metadata: { fields: [] } }, { metadata: { objectIdField: "other" } }, { metadata: { geometryType: "esriGeometryPoint" } }, { curated: { total: 0, results: [] } }, { curated: { nextStart: 2 } }, { site: { type: "Hub Site Application" } }, { site: { orgId: null } }, { siteData: { catalog: { groups: [] } } }, { group: { isOpenData: false } }]) {
      json.mockClear().mockImplementation(provider({}, change)); await expect(cornwallMetadata(feed("catalogueZoningReference"))).rejects.toThrow(); expect(queries()).toHaveLength(0);
    }
  });
  it("stops records and counts if full PDF bytes or exact official offer change", async () => {
    const altered = Buffer.from(licence); altered[300] ^= 1; bytes.mockResolvedValue(altered);
    expect((await cornwallCoverage()).datasets.every(x => x.status === "unavailable")).toBe(true); expect(queries()).toHaveLength(0);
    bytes.mockResolvedValue(licence); html.mockResolvedValue(offer.replaceAll(CORNWALL_GRANT.licenceUrl, "https://copy.invalid/licence")); await expect(cornwallMetadata(feed("municipalAddresses"))).rejects.toThrow();
  });
  it("uses one complete primary City over-building point only after original polygon containment", async () => {
    const research = await cornwallResearch({ address: "360 Pitt Street, Cornwall, ON" }); expect(research?.location?.data).toMatchObject({ accuracy: "source_building_point", provider: "cornwall:municipalAddresses", latitude: location.latitude });
    expect(research?.civic.data).toMatchObject({ sourcePointGeometryReused: true, preciseBuildingIdentityEstablished: false, unitIdentityVerified: false, uniqueCivicMatch: true });
    const result = await cornwallLayers("360 Pitt St", "Cornwall", "ON", research!.location!.data, undefined, research);
    expect(result.officialPlanReference.data).toMatchObject({ spatialScreenPerformed: true, currentWrittenPoliciesVerified: false, legalPermissionsEstablished: false });
    expect(queries().filter(u => u.href.startsWith(feed("municipalAddresses").url))).toHaveLength(1); expect(queries().filter(u => u.href.startsWith(provincial.url))).toHaveLength(1);
    expect(queries().filter(u => !u.href.startsWith(feed("municipalAddresses").url)).every(u => u.searchParams.get("returnGeometry") === "false")).toBe(true);
  });
  it("rejects source point coordinate/type/CRS failures instead of promoting them", async () => {
    for (const changes of [{ municipalAddresses: { spatialReference: { wkid: 2959 } } }, { municipalAddresses: { geometryType: "esriGeometryPolygon" } }, { municipalAddresses: { features: [{ ...civic(), geometry: { x: -75, y: 46 } }] } }]) {
      json.mockClear().mockImplementation(provider({}, changes)); const r = await cornwallResearch({ address: "360 Pitt St, Cornwall, ON" }); expect(r?.location).toBeNull(); expect(r?.civic.status).toBe("unavailable"); expect(queries().some(u => u.href.startsWith(provincial.url))).toBe(false);
    }
  });
  it("requires exact number, street, long street, suffix, direction, City, country and primary label", async () => {
    for (const values of [{ ST_NUMBER: 361 }, { STREET: "PITT EAST" }, { STREET_LNG: "PITT RD" }, { SUFFIX: "RD" }, { DIRECTION: "W" }, { CITY: "South Stormont" }, { PROVINCE: "BC" }, { COUNTRY: "US" }, { ADD_TYPE: "SECONDARY" }, { UNIT: "2" }, { FLOOR: "1" }, { BUILDING: "B" }, { ADDRESS: "360 PITT ST, Cornwall" }]) {
      json.mockClear().mockImplementation(provider({ municipalAddresses: [civic(values)] })); const r = await cornwallResearch({ address: "360 Pitt St, Cornwall, ON" }); expect(r?.location?.status).toBe("ambiguous"); expect(queries().some(u => u.href.startsWith(provincial.url))).toBe(false);
    }
    json.mockImplementation(provider()); expect((await cornwallResearch({ address: "360A Pitt St, Cornwall, ON" }))?.location?.status).toBe("ambiguous");
  });
  it("halts City reference queries for duplicated, incomplete or malformed civic evidence", async () => {
    for (const [data, changes] of [[{ municipalAddresses: [civic(), civic({ OBJECTID: 2 })] }, {}], [{}, { municipalAddresses: { exceededTransferLimit: true } }], [{ municipalAddresses: [civic({ ST_NUMBER: "360" })] }, {}]] as [Record<string, Row[]>, Record<string, Row>][]) {
      json.mockClear().mockImplementation(provider(data, changes)); const r = await screen(); expect(r.catalogueZoningReference.status).toBe("skipped"); expect(queries().some(u => u.href.startsWith(feed("catalogueZoningReference").url))).toBe(false);
    }
  });
  it("requires one complete polygon naming Cornwall, never the City boundary polyline", async () => {
    for (const municipality of [[], [{ attributes: { OBJECTID: 1, MUNICIPAL_NAME: "SOUTH STORMONT" } }], [{ attributes: { OBJECTID: 1, MUNICIPAL_NAME: "CORNWALL" } }, { attributes: { OBJECTID: 2, MUNICIPAL_NAME: "CORNWALL" } }]]) {
      json.mockClear().mockImplementation(provider({ municipality })); expect((await screen()).officialPlanReference.status).toBe("skipped"); expect(queries().every(u => u.href.startsWith(provincial.url))).toBe(true);
    }
    json.mockImplementation(provider({}, { municipality: { exceededTransferLimit: true } })); expect((await cornwallResearch({ address: "360 Pitt St, Cornwall, ON" }))?.location?.status).toBe("ambiguous");
  });
  it("rejects municipality/province conflicts, units and forged City-provider evidence", async () => {
    expect(cornwallMarket("Cornwall", "PEI")).toBe(false); expect(cornwallMarket("South Stormont", "ON")).toBe(false);
    expect((await cornwallLocation({ address: "360 Pitt St, Cornwall, BC", province: "ON" }))?.status).toBe("ambiguous");
    for (const input of [{ address: "360 Pitt St, South Stormont, ON", city: "Cornwall" }, { address: "Unit 2, Cornwall, ON" }]) expect((await cornwallResearch(input))?.location?.status).toBe("ambiguous");
    json.mockClear(); expect((await screen(location.address, { ...location, provider: "cornwall:municipalAddresses" })).officialPlanReference.status).toBe("skipped"); expect(json).not.toHaveBeenCalled();
  });
  it("returns civic attributes only for an independent interpolated point", async () => {
    const r = await screen(location.address, { ...location, accuracy: "street_interpolated" }); expect(r.municipalAddresses.data).toMatchObject({ sourcePointGeometryReused: false, spatialScreenPerformed: false, screenedPoint: null }); expect(r.officialPlanReference.status).toBe("skipped"); expect(queries().every(u => u.searchParams.get("returnGeometry") === "false" && !u.searchParams.has("geometry"))).toBe(true);
  });
  it("matches heritage by complete civic address, without a buffer or inherited current status", async () => {
    json.mockImplementation(provider({ designatedHeritageReference: [record(feed("designatedHeritageReference"), { ADDRESS: "360 PITT ST", NAME: "Published site" })] }));
    const r = await screen(); expect(r.designatedHeritageReference.status).toBe("available"); expect(r.designatedHeritageReference.data).toMatchObject({ scope: "building_or_site_address", spatialScreenPerformed: false, currentHeritageStatusVerified: false, fullCurrentRegisterScreenPerformed: false, designationInstrumentVerified: false });
    const u = queries().find(u => u.href.startsWith(feed("designatedHeritageReference").url))!; expect(u.searchParams.has("geometry")).toBe(false); expect(u.searchParams.get("where")).toContain("UPPER(ADDRESS)");
    json.mockImplementation(provider({ designatedHeritageReference: [record(feed("designatedHeritageReference"), { ADDRESS: "360-362 PITT ST" })] })); expect((await screen()).designatedHeritageReference.status).toBe("no_match");
  });
  it("preserves conflicting footprint vintages and returns identifiers rather than physical facts", async () => {
    json.mockImplementation(provider({ buildingFootprintReference: [{ attributes: { FID: 0, STORIES: 3, USAGE: "PRIVATE", Shape__Area: 400, OWNER: "PRIVATE" } }] }));
    const r = await screen(); expect(r.buildingFootprintReference.data).toMatchObject({ records: [{ recordId: 0 }], publishedItemTopographicYear: 2022, publishedServiceTopographicYear: 2017, observationVintageResolved: false, measuredBuildingAreaReturned: false, constructionYearEstablished: false }); expect(JSON.stringify(r)).not.toContain("PRIVATE");
    expect(queries().every(u => !/\*|Owner|Shape__|STORIES|USAGE/i.test(u.searchParams.get("outFields") ?? ""))).toBe(true);
  });
  it("preserves typed failures, truncation and missing source data dates", async () => {
    json.mockImplementation(provider({ catalogueZoningReference: Array.from({ length: 51 }, (_, i) => record(feed("catalogueZoningReference"), { FID: i, Zoning: "RES" })) })); let r = await screen(); expect(r.catalogueZoningReference.truncated).toBe(true); expect(r.catalogueZoningReference.data).toMatchObject({ queryCoverageComplete: false, absenceEstablished: false });
    json.mockImplementation(provider({ catalogueZoningReference: [record(feed("catalogueZoningReference"), { Zoning: 7 })] })); expect((await screen()).catalogueZoningReference.status).toBe("unavailable");
    json.mockImplementation(provider({}, { metadata: { editingInfo: { lastEditDate: 1790000000000 } } })); expect((await cornwallMetadata(feed("catalogueZoningReference"))).sourceUpdatedAt).toBeNull();
    json.mockImplementation(provider()); r = await screen(); expect(r.designatedHeritageReference.data).toMatchObject({ absenceEstablished: false });
  });
  it("counts five selected sources once and keeps unqueried gaps and the market incomplete", async () => {
    const c = await cornwallCoverage(); expect(c.datasets).toHaveLength(5); expect(c.datasets.every(x => x.status === "verified")).toBe(true); expect(c.complete).toBe(false); expect(c.municipalityReference.countIncludedHere).toBe(false);
    for (const count of [-1, "1", 1.5, null]) { json.mockImplementation(provider({}, { count: { count } })); expect((await cornwallCoverage()).datasets.every(x => x.records === null && x.status === "unavailable")).toBe(true); }
    json.mockImplementation(provider()); const r = await screen(null, { ...location, accuracy: "caller_supplied", provider: "caller" }); expect(r.municipalAddresses.status).toBe("skipped"); expect(r.designatedHeritageReference.status).toBe("skipped");
    for (const g of CORNWALL_WITHHELD) { expect(r[g.layer].source).toBeNull(); expect(r[g.layer].retrievedAt).toBeNull(); expect(r[g.layer].data).toMatchObject({ screenPerformed: false, recordsQueried: false, countsQueried: false, geometryQueried: false }); }
    const m = ontarioMarketRoadmap().municipalities.find(x => x.city === "Cornwall")!; expect(m.configuredLayers).toContain("designatedHeritageReference"); expect(m.complete).toBe(false);
  });
  it("keeps report requests, hosted one-click skill, native artifact contract and schema aligned", async () => {
    const r = await screen(); expect(preShowingBrief(r, []).documentsToRequest.filter(x => x.document.includes("Cornwall"))).toHaveLength(3);
    expect(PROPERTY_SKILL).toBe(readFileSync(new URL("../../docs/homies-property-enrichment/SKILL.md", import.meta.url), "utf8")); expect(PROPERTY_SKILL).toContain("Cornwall adds five"); expect(PROPERTY_SKILL).toContain("native Homies"); expect(PROPERTY_OPENAPI.components.schemas.PropertyResult.properties.layers.properties).toHaveProperty("contaminatedSedimentReference");
  });
});
