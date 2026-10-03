import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { simcoeCoverage, simcoeLayers, simcoeLocation, simcoeMarket, simcoeMetadata } from "./simcoe";
import { SIMCOE_FEEDS, SIMCOE_GRANT, SIMCOE_WITHHELD, type SimcoeFeed } from "./simcoe-sources";
import { NIAGARA_FEEDS } from "./niagara-sources";
import { preShowingBrief } from "./brief";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
import { PROPERTY_SKILL } from "./skill";
import { PROPERTY_OPENAPI } from "./openapi";
import type { Location, PropertyRequest, Row } from "./model";
const { json, bytes, html, provincialMetadata } = vi.hoisted(() => ({ json: vi.fn(), bytes: vi.fn(), html: vi.fn(), provincialMetadata: vi.fn() }));
vi.mock("./http", async () => ({ ...await vi.importActual<typeof import("./http")>("./http"), fetchJson: json, fetchBytes: bytes, fetchText: html }));
vi.mock("./niagara", () => ({ niagaraMetadata: provincialMetadata }));
const fixture = (name: string) => readFileSync(new URL("./fixtures/simcoe/" + name, import.meta.url));
const meta = new Map(SIMCOE_FEEDS.flatMap(f => [[f.layerUrl, JSON.parse(fixture(f.name + "-current-layer.json").toString())], [f.typeUrl, JSON.parse(fixture(f.name + "-current-type.json").toString())]]));
const location: Location = { address: "50 Cindy Lee Crescent", city: "Orillia", province: "ON", latitude: 44.61, longitude: -79.421, accuracy: "source_building_point", provider: "independent-source" };
const provincial = NIAGARA_FEEDS.find(f => f.key === "ontarioMunicipality")!;
const feed = (key: string) => SIMCOE_FEEDS.find(f => f.key === key)!;
const feature = (f: SimcoeFeed, values: Row = {}, id = "1") => ({ type: "Feature", id: f.name + ".fid-" + id, geometry: null, properties: Object.fromEntries(Object.keys(f.fields).map(k => [k, Object.hasOwn(values, k) ? values[k] : k === "objectid" ? Number(id) : null])) });
const civic = (values: Row = {}, id = "1") => feature(SIMCOE_FEEDS[0], { objectid: Number(id), stnum: 50, full_address: "50 CINDY LEE CRESCENT", fullname: "CINDY LEE CRESCENT", unit: null, muni: "ORILLIA", ...values }, id);
const collection = (features: Row[] = [], changes: Row = {}) => ({ type: "FeatureCollection", features, totalFeatures: features.length, numberMatched: features.length, numberReturned: features.length, crs: null, ...changes });
const queries = () => json.mock.calls.map(([u]) => u as URL).filter(u => u.searchParams.get("request") === "GetFeature" || u.pathname.endsWith("/query"));
function provider(data: Record<string, Row[]> = {}, changes: Record<string, Row | undefined> = {}) {
  return async (u: URL) => {
    if (u.href.startsWith(provincial.url + "/query")) return { features: data.municipality ?? [{ attributes: { OBJECTID: 1, MUNICIPAL_NAME: "ORILLIA" } }], ...changes.municipality };
    if (u.searchParams.get("request") === "GetFeature") {
      const f = SIMCOE_FEEDS.find(f => u.searchParams.get("typeNames") === "simcoe:" + f.name); if (!f) throw Error("Unexpected query");
      return collection(data[f.key] ?? (f.key === "simcoeMunicipalAddresses" ? [civic()] : []), changes[f.key]);
    }
    const raw = meta.get(u.href); if (!raw) throw Error("Unexpected metadata");
    const isLayer = u.pathname.includes("/rest/layers/"), key = isLayer ? "layer" : "featureType";
    return { ...raw, [key]: { ...raw[key], ...changes[key] } };
  };
}
const hitXml = (n = "1", changes = "") => `<?xml version="1.0"?><wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" numberMatched="${n}" numberReturned="0" ${changes}/>`;
const binary = async (u: URL) => u.href === SIMCOE_GRANT.termsUrl ? fixture("current-terms.html") : u.href === SIMCOE_GRANT.licenceUrl ? fixture("current-license.html") : fixture(u.searchParams.get("typeNames")?.replace("simcoe:", "") + "-describe.xml");
const screen = (input: PropertyRequest = { address: "50 Cindy Lee Crescent, Orillia, ON" }, l: Location | null = location) => simcoeLayers(input, l);
beforeEach(() => { json.mockReset().mockImplementation(provider()); bytes.mockReset().mockImplementation(binary); html.mockReset().mockResolvedValue(hitXml()); provincialMetadata.mockReset().mockResolvedValue({ sourceUpdatedAt: null }); vi.spyOn(console, "warn").mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());
describe("Simcoe original downloadable civic and reference sources", () => {
  it("binds the complete current grant, exact DOWNLOAD definition and WFS schema", async () => {
    for (const f of SIMCOE_FEEDS) expect(await simcoeMetadata(f)).toMatchObject({ sourceUpdatedAt: null, observationVintageResolved: false });
    for (const changes of [{ layer: { resource: { "@class": "featureType", href: "https://copy.invalid/" } } }, { layer: { attribution: { title: "third party" } } }, { featureType: { keywords: { string: ["features"] } } }, { featureType: { abstract: "public third party" } }, { featureType: { nativeCRS: { $: "EPSG:4326" } } }, { featureType: { store: { name: "copy" } } }, { featureType: { namespace: { name: "copy" } } }, { featureType: { attributes: { attribute: [] } } }, { featureType: { enabled: false } }, { featureType: { srs: "EPSG:4326" } }]) {
      json.mockClear().mockImplementation(provider({}, changes)); await expect(simcoeMetadata(SIMCOE_FEEDS[0])).rejects.toThrow(); expect(queries()).toHaveLength(0);
    }
  });
  it("withholds all count and record queries when any grant text/link or schema changes", async () => {
    for (const target of [SIMCOE_GRANT.termsUrl, SIMCOE_GRANT.licenceUrl]) {
      bytes.mockImplementation(async u => u.href === target ? Buffer.from((await binary(u)).toString("latin1") + "<p>New reuse restriction.</p>", "latin1") : binary(u));
      json.mockClear(); expect((await simcoeCoverage()).datasets.every(x => x.status === "unavailable")).toBe(true); expect(queries()).toHaveLength(0); expect(html).not.toHaveBeenCalled();
    }
    bytes.mockImplementation(async u => u.href.includes("DescribeFeatureType") ? Buffer.from("different schema") : binary(u)); await expect(simcoeMetadata(SIMCOE_FEEDS[0])).rejects.toThrow();
    bytes.mockImplementation(async u => u.href === SIMCOE_GRANT.termsUrl ? Buffer.from((await binary(u)).toString("latin1").replace("openlicense.html", "different.html"), "latin1") : binary(u)); await expect(simcoeMetadata(SIMCOE_FEEDS[0])).rejects.toThrow();
  });
  it("ignores only non-licence security script content while preserving every grant clause", async () => {
    bytes.mockImplementation(async u => u.href === SIMCOE_GRANT.termsUrl ? Buffer.from((await binary(u)).toString("latin1").replace(/cb=\d+/, "cb=9999"), "latin1") : binary(u)); await expect(simcoeMetadata(SIMCOE_FEEDS[0])).resolves.toHaveProperty("sourceUpdatedAt", null);
  });
  it("returns unique complete civic attributes without County geometry or geocoding", async () => {
    const r = await screen(undefined, { ...location, accuracy: "street_interpolated" }); expect(r.simcoeMunicipalAddresses.status).toBe("available");
    expect(r.simcoeMunicipalAddresses.data).toMatchObject({ uniqueCivicMatch: true, sourcePointGeometryReused: false, spatialScreenPerformed: false, screenedPoint: null, preciseBuildingIdentityEstablished: false });
    expect(r.simcoeBuildingFootprintReference.status).toBe("skipped"); expect(queries()).toHaveLength(1);
    const u = queries()[0]; expect(u.searchParams.get("propertyName")).toBe("objectid,stnum,full_address,fullname,unit,muni"); expect(u.searchParams.get("cql_filter")).toContain("strToLowerCase(muni)='orillia'"); expect(u.searchParams.has("filter")).toBe(false);
    expect(await simcoeLocation({ address: "50 Cindy Lee Crescent, Orillia, ON" })).toBeNull();
  });
  it("preserves duplicate City Hall observations as ambiguity and stops spatial queries", async () => {
    const values = { full_address: "50 ANDREW STREET SOUTH", fullname: "ANDREW STREET SOUTH" };
    json.mockImplementation(provider({ simcoeMunicipalAddresses: [civic(values, "1"), civic(values, "2"), civic(values, "3")] }));
    const r = await screen({ address: "50 Andrew St S, Orillia, ON" }); expect(r.simcoeMunicipalAddresses.status).toBe("ambiguous"); expect((r.simcoeMunicipalAddresses.data as Row).records).toHaveLength(3); expect(r.simcoeBuildingFootprintReference.status).toBe("skipped"); expect(queries()).toHaveLength(1);
  });
  it("requires agreement in complete civic number, street, municipality and no-unit fields", async () => {
    for (const change of [{ stnum: 51 }, { fullname: "CINDY LEE STREET" }, { full_address: "50 CINDY LEE CRESCENT EAST" }, { full_address: "50 CINDY LEE CRESCENT, ORILLIA" }, { muni: "BARRIE" }, { unit: "1" }]) {
      json.mockClear().mockImplementation(provider({ simcoeMunicipalAddresses: [civic(change)] })); const r = await screen(); expect(r.simcoeMunicipalAddresses.status).toBe("ambiguous"); expect(queries()).toHaveLength(1);
    }
  });
  it("uses an independent original provincial gate and explicit CRS84, with no returned geometry", async () => {
    const f = feed("simcoeMunicipalBoundaryReference"); json.mockImplementation(provider({ [f.key]: [feature(f, { Name: "ORILLIA", Type: "City" })] }));
    const r = await screen(); expect(r.simcoeMunicipalContainment.status).toBe("available"); expect(r[f.key].data).toMatchObject({ officialBoundaryEstablished: false, usedForMunicipalityGate: false, sourceGeometryReturned: false, parcelWideScreenPerformed: false });
    const spatial = queries().filter(u => u.searchParams.has("filter")); expect(spatial).toHaveLength(4);
    for (const u of spatial) { expect(u.searchParams.get("filter")).toContain('srsName="urn:ogc:def:crs:OGC:1.3:CRS84"'); expect(u.searchParams.get("filter")).toContain('<gml:pos>-79.421 44.61</gml:pos>'); expect(u.searchParams.get("propertyName")).not.toMatch(/geom|Assessment|Owner/i); expect(u.searchParams.get("count")).toBe("51"); }
  });
  it("stops County spatial screens for wrong, duplicated, incomplete or unavailable Ontario boundaries", async () => {
    for (const data of [[], [{ attributes: { OBJECTID: 1, MUNICIPAL_NAME: "SEVERN" } }], [{ attributes: { OBJECTID: 1, MUNICIPAL_NAME: "ORILLIA" } }, { attributes: { OBJECTID: 2, MUNICIPAL_NAME: "ORILLIA" } }]]) {
      json.mockClear().mockImplementation(provider({ municipality: data })); expect((await screen()).simcoeBuildingFootprintReference.status).toBe("skipped"); expect(queries().some(u => u.searchParams.has("filter"))).toBe(false);
    }
    json.mockImplementation(provider({}, { municipality: { exceededTransferLimit: true } })); expect((await screen()).simcoeWardReference.status).toBe("skipped");
    provincialMetadata.mockRejectedValue(Error("rights unavailable")); expect((await screen()).simcoeWardReference.status).toBe("skipped");
  });
  it("keeps unspecified vintage, generic shapes, unofficial borders and NO COLLECTION unverified", async () => {
    const f = feed("simcoeWasteCollectionReference"); json.mockImplementation(provider({ [f.key]: [feature(f, { "Collection Day": "NO COLLECTION", _collectionday: "NO COLLECTION" })] }));
    const r = await screen(); expect(r[f.key].data).toMatchObject({ records: [{ publishedCollectionDay: "NO COLLECTION" }], actualCollectionServiceVerified: false, separatedCityServiceVerified: false, sourceUpdatedAt: null, observationVintageResolved: false });
    expect(r[f.key].sourceUpdatedAt).toBeNull(); expect((r[f.key].data as Row).sourceMetadataModifiedAt).toBe("2021-01-04 19:54:40.950 UTC");
    expect(r.simcoeWardReference.data).toMatchObject({ electionYearEstablished: false, currentWardVerified: false, absenceEstablished: false });
    expect(preShowingBrief(r, []).findings.find(x => x.layer === f.key)?.summary).toContain("NO COLLECTION");
  });
  it("rejects forged County points and city/province conflicts without provider queries", async () => {
    expect(simcoeMarket("Township of Springwater", "ON")).toBe("Springwater"); expect(simcoeMarket("Orillia", "BC")).toBeNull(); expect(simcoeMarket("Minesing", "ON")).toBeNull();
    expect((await simcoeLocation({ address: "50 Street, Severn, ON", city: "Orillia" }))?.status).toBe("ambiguous");
    for (const [input, l] of [[{ address: "50 Street, Orillia, BC", province: "ON" }, location], [{ address: "50 Street, Severn, ON", city: "Orillia" }, location], [{ address: "50 Cindy Lee Crescent, Orillia, ON" }, { ...location, provider: "simcoe:municipalAddresses" }]] as [PropertyRequest, Location][]) {
      json.mockClear(); expect((await screen(input, l)).simcoeWardReference.status).toBe("skipped"); expect(json).not.toHaveBeenCalled();
    }
  });
  it("permits coordinate-only independent screens without searching civic attributes", async () => {
    const r = await screen({ lat: 44.61, lng: -79.421, city: "Orillia", province: "ON" }, { ...location, accuracy: "caller_supplied", provider: "caller" }); expect(r.simcoeMunicipalAddresses.status).toBe("skipped"); expect(r.simcoeMunicipalContainment.status).toBe("available"); expect(queries().some(u => u.searchParams.has("cql_filter"))).toBe(false);
  });
  it("rejects malformed counts, entities, incomplete empty collections and unexpected/private fields", async () => {
    for (const xml of [hitXml("unknown"), hitXml("-1"), hitXml("1.5"), hitXml("9007199254740992"), hitXml().replace('numberReturned="0"','numberReturned="1"'), '<!DOCTYPE x [<!ENTITY count "1">]>' + hitXml(), '<ows:ExceptionReport/>', hitXml().replace('/>', '><wfs:member/></wfs:FeatureCollection>')]) {
      html.mockResolvedValue(xml); expect((await simcoeCoverage()).datasets.every(x => x.records === null)).toBe(true);
    }
    json.mockImplementation(provider({}, { simcoeMunicipalAddresses: collection([], { numberMatched: "unknown", totalFeatures: "unknown" }) })); expect((await screen()).simcoeMunicipalAddresses.status).toBe("unavailable");
    for (const bad of [{ ...civic(), geometry: { type: "Point", coordinates: [-79.42,44.61] } }, { ...civic(), properties: { ...(civic().properties as Row), OWNER: "PRIVATE" } }, civic({ stnum: "50" })]) {
      json.mockImplementation(provider({ simcoeMunicipalAddresses: [bad] })); const r = await screen(); expect(r.simcoeMunicipalAddresses.status).toBe("unavailable"); expect(JSON.stringify(r)).not.toContain("PRIVATE");
    }
  });
  it("preserves truncation, unknown completeness and empty-result uncertainty", async () => {
    json.mockImplementation(provider({ simcoeMunicipalAddresses: Array.from({ length: 51 }, (_, i) => civic({}, String(i + 1))) })); let r = await screen(); expect(r.simcoeMunicipalAddresses.status).toBe("ambiguous"); expect(r.simcoeMunicipalAddresses.truncated).toBe(true); expect(r.simcoeWardReference.status).toBe("skipped");
    json.mockImplementation(provider({}, { simcoeMunicipalAddresses: { numberMatched: "unknown", totalFeatures: "unknown" } })); r = await screen(); expect(r.simcoeMunicipalAddresses.data).toMatchObject({ queryCoverageComplete: false, absenceEstablished: false });
    json.mockImplementation(provider({ simcoeMunicipalAddresses: [] })); r = await screen(); expect(r.simcoeMunicipalAddresses.status).toBe("no_match"); expect(r.simcoeMunicipalAddresses.data).toMatchObject({ absenceEstablished: false });
  });
  it("counts five County sources once, withholds non-download feeds and leaves every market incomplete", async () => {
    const r = await simcoeCoverage(); expect(r.datasets).toHaveLength(5); expect(r.datasets.every(x => x.status === "verified")).toBe(true); expect(r.cities).toHaveLength(18); expect(r.complete).toBe(false); expect(r.municipalityReference.countIncludedHere).toBe(false); expect(new Set(r.datasets.map(x => x.source.id)).size).toBe(5);
    expect(r.withheld).toHaveLength(SIMCOE_WITHHELD.length); expect(r.withheld.every(x => x.records === null && !x.recordsQueried && !x.countsQueried && !x.geometryQueried)).toBe(true);
    const m = ontarioMarketRoadmap().municipalities.find(m => m.city === "Orillia")!; expect(m.configuredLayers).toContain("simcoeMunicipalAddresses"); expect(m.complete).toBe(false);
  });
  it("aligns native report requests, one-click skill and public schema", async () => {
    const r = await screen(); expect(preShowingBrief(r, []).documentsToRequest.filter(x => x.document.startsWith("Simcoe"))).toHaveLength(3);
    expect(PROPERTY_SKILL).toBe(readFileSync(new URL("../../docs/homies-property-enrichment/SKILL.md", import.meta.url), "utf8")); expect(PROPERTY_SKILL).toContain("Simcoe County adds five"); expect(PROPERTY_SKILL).toContain("fs_write"); expect(PROPERTY_SKILL).toContain("share_artifact");
    expect(PROPERTY_OPENAPI.components.schemas.PropertyResult.properties.layers.properties).toHaveProperty("simcoeLocalPropertyFiles");
  });
});
