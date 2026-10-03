import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sudburyCoverage, sudburyLayers, sudburyMarket, sudburyMetadata, sudburyResearch } from "./sudbury";
import { SUDBURY_FEEDS, SUDBURY_GRANT, SUDBURY_WITHHELD, SUDBURY_ZONING_MAP, type SudburyFeed } from "./sudbury-sources";
import { NIAGARA_FEEDS } from "./niagara-sources";
import { preShowingBrief } from "./brief";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
import { PROPERTY_SKILL } from "./skill";
import type { Location, Row } from "./model";
const { json, html, provincialMetadata } = vi.hoisted(() => ({ json: vi.fn(), html: vi.fn(), provincialMetadata: vi.fn() }));
vi.mock("./http", async () => ({ ...await vi.importActual<typeof import("./http")>("./http"), fetchJson: json, fetchText: html }));
vi.mock("./niagara", () => ({ niagaraMetadata: provincialMetadata }));
const fixture: Record<string, Row> = JSON.parse(readFileSync(new URL("./fixtures/sudbury-grant.json", import.meta.url), "utf8"));
const pages = Object.fromEntries([[SUDBURY_GRANT.licenceUrl,"licence"],[SUDBURY_GRANT.policyUrl,"policy"],[SUDBURY_GRANT.officialOffer,"official-offer"],[SUDBURY_ZONING_MAP.officialOffer,"zoning-offer"]].map(([u,n]) => [u, readFileSync(new URL(`./fixtures/sudbury-${n}.html`, import.meta.url), "utf8")]));
const feed = (key: string) => SUDBURY_FEEDS.find(f => f.key === key)!;
const provincial = NIAGARA_FEEDS.find(f => f.key === "ontarioMunicipality")!;
const location: Location = { address: "47 Maki Avenue", city: "Sudbury", province: "ON", latitude: 46.455158382627694, longitude: -80.99908722149631, accuracy: "source_building_point", provider: "statcan-nar-202606" };
const record = (f: SudburyFeed, values: Row = {}) => ({ attributes: Object.fromEntries(Object.keys(f.fields).map(k => [k, k === f.oid ? values[k] ?? 1 : values[k] ?? null])) });
const civic = (values: Row = {}) => ({ ...record(feed("municipalAddresses"), { OBJECTID: 9260, FULLADDRESSTEXT: "47 Maki Avenue", ADDRESSNUMBER: "47", FULLSTREETNAME: "Maki Avenue", ADDRESSID: "22263", STYPE: "Primary", ADDRESSLIFECYCLESTATUS: "Active", COMMUNITY: "Sudbury", LASTUPDATE: 1366622676000, ...values }), geometry: { x: location.longitude, y: location.latitude } });
function provider(data: Record<string, Row[]> = {}, changes: Record<string, Row | undefined> = {}) {
  return async (u: URL) => {
    if (u.pathname.endsWith("/query")) {
      if (u.href.startsWith(provincial.url + "/query")) return { features: data.municipality ?? [{ attributes: { OBJECTID: 45, MUNICIPAL_NAME: "GREATER SUDBURY" } }], ...changes.municipality };
      const f = SUDBURY_FEEDS.find(f => u.href.startsWith(f.url + "/query")); if (!f) throw Error("Unexpected query");
      if (u.searchParams.get("returnCountOnly") === "true") return { count: 1, ...changes.count };
      return { features: data[f.key] ?? (f.key === "municipalAddresses" ? [civic()] : []), ...changes[f.key] };
    }
    if (u.pathname.endsWith("/search")) {
      const id = u.searchParams.get("q")?.match(/^id:([a-f0-9]{32}) AND group:/)?.[1]; if (!id || !u.searchParams.get("q")?.endsWith(SUDBURY_GRANT.group)) throw Error("Unexpected curation");
      return { ...fixture["curation:" + id], ...changes.curated };
    }
    const value = fixture[u.origin + u.pathname]; if (!value) throw Error("Unexpected metadata");
    const b = SUDBURY_GRANT, z = SUDBURY_ZONING_MAP;
    const kind = u.pathname.endsWith(z.app + "/data") ? "appData" : u.pathname.endsWith(z.app) ? "app" : u.pathname.endsWith(z.map + "/data") ? "mapData" : u.pathname.endsWith(z.map) ? "map" : u.pathname.endsWith(b.site + "/data") ? "siteData" : u.pathname.endsWith(b.site) ? "site" : u.pathname.includes("/groups/") ? "group" : u.pathname.includes("/sharing/") ? "item" : u.pathname.endsWith("/FeatureServer") ? "root" : "metadata";
    return { ...value, ...changes[kind] };
  };
}
beforeEach(() => { json.mockReset().mockImplementation(provider()); html.mockReset().mockImplementation(async (u: URL) => { if (!pages[u.href]) throw Error("Unexpected City page"); return pages[u.href]; }); provincialMetadata.mockReset().mockResolvedValue({ sourceUpdatedAt: null }); vi.spyOn(console, "warn").mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());
const screen = () => sudburyLayers("47 Maki Avenue", "Sudbury", "ON", location);
describe("Greater Sudbury property evidence", () => {
  it("binds the full City grant, exact curation, publisher and typed source before record/count queries", async () => {
    for (const f of SUDBURY_FEEDS) await expect(sudburyMetadata(f)).resolves.toHaveProperty("sourceUpdatedAt");
    for (const change of [{ item: { owner: "copy" } }, { item: { orgId: null } }, { item: { licenseInfo: "public" } }, { item: { url: feed("zoning").rootUrl } }, { item: { description: "new source" } }, { root: { serviceItemId: "other" } }, { root: { copyrightText: "Third party" } }, { root: { layers: [] } }, { metadata: { fields: [] } }, { metadata: { objectIdField: "other" } }, { metadata: { geometryType: "esriGeometryPolygon" } }, { curated: { total: 0, results: [] } }, { curated: { total: 2 } }, { site: { owner: "copy" } }, { site: { licenseInfo: "public" } }, { site: { orgId: null } }, { siteData: { catalog: { groups: [] } } }, { group: { isOpenData: false } }]) {
      json.mockClear().mockImplementation(provider({}, change)); await expect(sudburyMetadata(feed("municipalAddresses"))).rejects.toThrow(); expect(json.mock.calls.some(([u]) => u.pathname.endsWith("/query"))).toBe(false);
    }
    json.mockImplementation(provider());
    for (const u of [SUDBURY_GRANT.licenceUrl,SUDBURY_GRANT.policyUrl,SUDBURY_GRANT.officialOffer]) {
      html.mockImplementation(async (url: URL) => url.href === u ? pages[u].replaceAll('mura-region-local','changed-region') : pages[url.href]); await expect(sudburyMetadata(feed("permits"))).rejects.toThrow();
    }
  });
  it("verifies the current official app/map lineage separately from reuse rights before zoning queries", async () => {
    for (const change of [{ app: { owner: "copy" } }, { app: { orgId: null } }, { app: { url: "https://other.invalid" } }, { appData: { map: { itemId: "other" } } }, { map: { access: "private" } }, { mapData: { operationalLayers: [] } }]) {
      json.mockClear().mockImplementation(provider({},change)); await expect(sudburyMetadata(feed("zoning"))).rejects.toThrow(); expect(json.mock.calls.some(([u]) => u.pathname.endsWith("/query"))).toBe(false);
    }
    json.mockImplementation(provider()); html.mockImplementation(async (u: URL) => u.href === SUDBURY_ZONING_MAP.officialOffer ? pages[u.href].replaceAll(SUDBURY_ZONING_MAP.app,"other") : pages[u.href]); expect((await screen()).zoning.status).toBe("unavailable"); expect((await screen()).buildingFootprintReference.status).toBe("no_match");
  });
  it("uses one complete active primary civic point and preserves administrative record dates", async () => {
    const r = await sudburyResearch({address:"47 Maki Ave, Sudbury, ON"}); expect(r?.location?.data).toMatchObject({ accuracy:"source_civic_address_point", provider:"sudbury:municipalAddresses", city:"Greater Sudbury", latitude:location.latitude, municipalAddress:{community:"Sudbury"} }); expect(r?.civic.data).toMatchObject({ records:[{publishedRecordUpdateDate:1366622676000}], primaryPointIdentityEstablished:true, unitIdentityVerified:false });
    json.mockImplementation(provider({municipalAddresses:[civic(),civic({OBJECTID:2,ADDRESSLIFECYCLESTATUS:"Retired"})]})); expect((await sudburyResearch({address:"47 Maki Ave, Greater Sudbury, ON"}))?.location?.status).toBe("available");
  });
  it("stops spatial screening for duplicate, secondary, unit, retired, assigned or truncated civic evidence", async () => {
    for (const records of [[civic(),civic({OBJECTID:2,ADDRESSID:"other"})],[civic({STYPE:"Secondary"})],[civic({UNIT_OR_AMENITY:"Unit"})],[civic({ASSIGNEDADDRESSID:"parent"})],[civic({ADDRESSLIFECYCLESTATUS:"Retired"})]]) {
      json.mockClear().mockImplementation(provider({municipalAddresses:records})); const r=await sudburyResearch({address:"47 Maki Ave, Sudbury, ON"}); expect(r?.location?.status).toBe("ambiguous"); const l=await sudburyLayers("47 Maki Ave","Sudbury","ON",r?.location?.data??null,"Sudbury",r); expect(l.zoning.status).toBe("skipped"); expect(json.mock.calls.filter(([u])=>u.pathname.endsWith("/query")).every(([u])=>u.href.startsWith(feed("municipalAddresses").url))).toBe(true);
    }
    json.mockImplementation(provider({}, {municipalAddresses:{exceededTransferLimit:true}})); expect((await sudburyResearch({address:"47 Maki Ave, Sudbury, ON"}))?.location?.status).toBe("ambiguous");
  });
  it("strictly distinguishes number suffix, direction and community and allows independent fallback only without conflicting evidence", async () => {
    for (const values of [{FULLADDRESSTEXT:"47A Maki Avenue",ADDRESSNUMBERSUFFIX:"A"},{FULLADDRESSTEXT:"47 Maki Avenue East",FULLSTREETNAME:"Maki Avenue East"},{FULLADDRESSTEXT:"47 Other Avenue"},{COMMUNITY:"Lively"}]) {
      json.mockImplementation(provider({municipalAddresses:[civic(values)]})); const address=values.COMMUNITY?"47 Maki Ave, Garson, ON":"47 Maki Ave, Sudbury, ON";const r=await sudburyResearch({address}); expect(r?.civic.status).toBe("no_match");expect(r?.location).toBeNull();
    }
    json.mockClear(); expect((await sudburyResearch({address:"47 Maki Ave, Lively, ON",city:"Garson"}))?.location?.status).toBe("ambiguous"); expect(json).not.toHaveBeenCalled();
    expect((await sudburyResearch({address:"47 Maki Ave, Sudbury, BC",province:"ON"}))?.location?.status).toBe("ambiguous"); expect(json).not.toHaveBeenCalled();
  });
  it("rejects a conflicting caller point and invalid civic geometry without reusing a guessed point", async () => {
    const r=await sudburyResearch({address:"47 Maki Ave, Sudbury, ON",lat:46.49,lng:-81}); expect(r?.location?.status).toBe("ambiguous"); expect(r?.civic.data).toMatchObject({sourceGeometryReused:false,primaryPointIdentityEstablished:false});
    json.mockImplementation(provider({municipalAddresses:[{...civic(),geometry:{x:0,y:0}}]})); expect((await sudburyResearch({address:"47 Maki Ave, Sudbury, ON"}))?.civic.status).toBe("unavailable");
  });
  it("uses municipal names only as candidates and requires one complete original provincial polygon", async () => {
    for(const city of ["Sudbury","Greater Sudbury","Lively","Garson"]) expect(sudburyMarket(city,"ON")).toBe(true); expect(sudburyMarket("Sudbury","NS")).toBe(false);
    for (const municipality of [[],[{attributes:{OBJECTID:1,MUNICIPAL_NAME:"THUNDER BAY"}}],[{attributes:{OBJECTID:1,MUNICIPAL_NAME:"GREATER SUDBURY"}},{attributes:{OBJECTID:2,MUNICIPAL_NAME:"GREATER SUDBURY"}}],[{attributes:{OBJECTID:"1",MUNICIPAL_NAME:"GREATER SUDBURY"}}]]) {
      json.mockClear().mockImplementation(provider({municipality})); expect((await screen()).permits.status).toBe("skipped"); expect(json.mock.calls.filter(([u])=>u.pathname.endsWith("/query")).every(([u])=>u.href.startsWith(provincial.url))).toBe(true);
    }
    json.mockImplementation(provider({}, {municipality:{exceededTransferLimit:true}})); expect((await screen()).zoning.status).toBe("skipped");
    for (const l of [{...location,accuracy:"blockface_representative"},{...location,provider:"sudbury:zoning"},{...location,latitude:0}]) { json.mockClear(); expect((await sudburyLayers("47 Maki Ave","Sudbury","ON",l)).municipality.status).toBe("skipped"); expect(json).not.toHaveBeenCalled(); }
  });
  it("preserves raw permit statuses/dates and project measures without free-form description or present-building claims", async () => {
    const f=feed("permits");json.mockImplementation(provider({permits:[record(f,{OBJECTID:1,Address:"47 Maki Avenue, Sudbury, ON",RecordStatus:"Complete",SubmittedDate:"2000-01-04",IssuedDate:"NULL",BuildingMeasureUnit:"Imperial",Ground:119,EstimatedValue:2618,ProjectDescription:"PRIVATE"}),record(f,{OBJECTID:2,Address:"47 Maki Avenue, Sudbury, ON",RecordStatus:"Completed",SubmittedDate:"2026-02-30"}),record(f,{OBJECTID:3,Address:"47 Maki Avenue, Sudbury, ON",RecordStatus:"constructor"}),record(f,{OBJECTID:4,Address:"47A Maki Avenue, Sudbury, ON"})]}));
    const r=await screen(), records=(r.permits.data as Row).records as Row[]; expect(records).toHaveLength(3); expect(records[0]).toMatchObject({submittedCalendarDate:"2000-01-04",issuedCalendarDate:null,statusMeaning:null,statusInterpretationVerified:false}); expect(records[1]).toMatchObject({submittedCalendarDate:null,statusInterpretationVerified:true}); expect(records[2].statusInterpretationVerified).toBe(false);
    expect(r.permits.data).toMatchObject({completePermitHistoryVerified:false,occupancyEstablished:false,estimatedValueCurrencyVerified:false,groundGrossAreaUnitsVerified:false,projectMeasuresAreCurrentBuildingFacts:false}); expect(JSON.stringify(r)).not.toContain("PRIVATE"); expect(preShowingBrief(r,[]).findings.find(x=>x.layer==="permits")?.summary).toContain("project");
    const u=json.mock.calls.map(([u])=>u as URL).find(u=>u.href.startsWith(f.url+"/query"))!; expect(u.searchParams.get("returnGeometry")).toBe("false"); expect(u.searchParams.get("outFields")).not.toContain("ProjectDescription");
  });
  it("does not infer former community crosswalks or query permits for coordinates alone", async () => {
    const f=feed("permits"); json.mockImplementation(provider({permits:[record(f,{Address:"47 Maki Avenue, Walden, ON"})]})); expect((await screen()).permits.status).toBe("no_match");
    json.mockClear();const r=await sudburyLayers(null,"Sudbury","ON",{...location,accuracy:"caller_supplied",provider:"caller"}); expect(r.permits.status).toBe("skipped"); expect(json.mock.calls.some(([u])=>u.href.startsWith(f.url+"/query"))).toBe(false);
  });
  it("retains no-match, typed source outages, duplicates, truncation and conservative GIS flags", async () => {
    const f=feed("zoning"); json.mockImplementation(provider({zoning:Array.from({length:51},(_,i)=>record(f,{OBJECTID:i+1,ZONING:"R1"}))}));let r=await screen();expect(r.zoning.truncated).toBe(true);expect((r.zoning.data as Row).records).toHaveLength(50);expect(r.zoning.data).toMatchObject({queryCoverageComplete:false,absenceEstablished:false,currentOfficialMapLineageVerified:true,legalPermissionsEstablished:false,parcelWideScreenPerformed:false});
    for(const records of [[record(f,{ZONING:7})],[record(f),record(f)]]) {json.mockImplementation(provider({zoning:records}));expect((await screen()).zoning.status).toBe("unavailable");}
    json.mockImplementation(provider({}, {zoning:{exceededTransferLimit:true},temporaryZoning:{error:{code:500}}}));r=await screen();expect(r.zoning.status).toBe("unavailable");expect(r.temporaryZoning.status).toBe("unavailable");expect(r.parcelReference.status).toBe("no_match");expect(r.parcelReference.data).toMatchObject({absenceEstablished:false,parcelIdentityVerified:false});
    json.mockImplementation(provider({}, {metadata:{editingInfo:{lastEditDate:1790000000000}}}));expect((await sudburyMetadata(feed("buildingFootprintReference"))).sourceUpdatedAt).toBeNull();
  });
  it("counts eight licensed feeds once, exposes twelve gaps and preserves native artifact instructions", async () => {
    const c=await sudburyCoverage();expect(c.datasets).toHaveLength(8);expect(c.datasets.every(d=>d.status==="verified")).toBe(true);expect(c.municipalityReference.countIncludedHere).toBe(false);expect(c.complete).toBe(false);expect(c.withheld).toHaveLength(12);
    const r=await screen();for(const g of SUDBURY_WITHHELD)expect(r[g.layer].data).toMatchObject({recordsQueried:false}); expect(json.mock.calls.filter(([u])=>u.pathname.endsWith("/query")).every(([u])=>u.href.startsWith(provincial.url)||SUDBURY_FEEDS.some(f=>u.href.startsWith(f.url+"/query")))).toBe(true);
    expect(preShowingBrief(r,[]).documentsToRequest.some(d=>d.document.includes("Sudbury"))).toBe(true);const m=ontarioMarketRoadmap().municipalities.find(m=>m.city==="Greater Sudbury")!;expect(m.complete).toBe(false);expect(m.configuredLayers).toContain("temporaryZoning");expect(m.withheldLayers).toHaveLength(12);
    expect(readFileSync(new URL("../../docs/homies-property-enrichment/SKILL.md",import.meta.url),"utf8")).toBe(PROPERTY_SKILL);expect(PROPERTY_SKILL).toContain("Sudbury");expect(PROPERTY_SKILL).toContain("artifact");
    json.mockImplementation(provider({}, {count:{count:-1}}));expect((await sudburyCoverage()).datasets.every(d=>d.status==="unavailable"&&d.records===null)).toBe(true);
  });
});
