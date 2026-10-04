import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { thunderBayCoverage, thunderBayLayers, thunderBayMarket, thunderBayMetadata, thunderBayResearch } from "./thunderbay";
import { THUNDERBAY_FEEDS, THUNDERBAY_GRANT, THUNDERBAY_HERITAGE, THUNDERBAY_WITHHELD, type ThunderBayFeed } from "./thunderbay-sources";
import { NIAGARA_FEEDS } from "./niagara-sources";
import { preShowingBrief } from "./brief";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
import { PROPERTY_SKILL } from "./skill";
import type { Location, Row } from "./model";
const { json, html, bytes, provincialMetadata } = vi.hoisted(() => ({ json:vi.fn(),html:vi.fn(),bytes:vi.fn(),provincialMetadata:vi.fn() }));
vi.mock("./http",async()=>({...await vi.importActual<typeof import("./http")>("./http"),fetchJson:json,fetchText:html,fetchBytes:bytes}));
vi.mock("./niagara",()=>({niagaraMetadata:provincialMetadata}));
const fixture:Record<string,Row>=JSON.parse(readFileSync(new URL("./fixtures/thunderbay-grant.json",import.meta.url),"utf8"));
const offer=readFileSync(new URL("./fixtures/thunderbay-official-offer.html",import.meta.url),"utf8");
const licence=readFileSync(new URL("./fixtures/thunderbay-licence.pdf",import.meta.url));
const csv=readFileSync(new URL("./fixtures/thunderbay-heritage-2022.csv",import.meta.url));
const feed=(key:string)=>THUNDERBAY_FEEDS.find(f=>f.key===key)!;
const provincial=NIAGARA_FEEDS.find(f=>f.key==="ontarioMunicipality")!;
const location:Location={address:"216 Brodie Street South",city:"Thunder Bay",province:"ON",latitude:48.381,longitude:-89.245,accuracy:"source_building_point",provider:"statcan-nar-202606"};
const record=(f:ThunderBayFeed,values:Row={})=>({attributes:Object.fromEntries(Object.keys(f.fields).map(k=>[k,k===f.oid?values[k]??1:values[k]??null]))});
const civic=(values:Row={})=>record(feed("municipalAddresses"),{OBJECTID:505387,REFNAME:"ADDRESS-REGULAR",ADDRESS:"216",STREET:"BRODIE",ROWTYPE:"ST",SPLITLOC:"S",COMPLETE:"216 BRODIE ST S",ROOT:"BRODIE ST S",CITY:"THUNDER BAY",PROVINCE:"ON",ADDRESS_NUMBER:216,ADDRESS_QUALIFIER:"",...values});
function provider(data:Record<string,Row[]>={},changes:Record<string,Row|undefined>={}){
  return async(u:URL)=>{
    if(u.pathname.endsWith("/query")){
      if(u.href.startsWith(provincial.url+"/query"))return{features:data.municipality??[{attributes:{OBJECTID:1,MUNICIPAL_NAME:"THUNDER BAY"}}],...changes.municipality};
      const f=THUNDERBAY_FEEDS.find(f=>u.href.startsWith(f.url+"/query"));if(!f)throw Error("Unexpected query");
      if(u.searchParams.get("returnCountOnly")==="true")return{count:1,...changes.count};
      return{features:data[f.key]??(f.key==="municipalAddresses"?[civic()]:[]),...changes[f.key]};
    }
    if(u.pathname.endsWith("/search")){
      const id=u.searchParams.get("q")?.match(/^id:([a-f0-9]{32}) AND group:/)?.[1];if(!id||!u.searchParams.get("q")?.endsWith(THUNDERBAY_GRANT.group))throw Error("Unexpected curation");
      return{...fixture["curation:"+id],...changes.curated};
    }
    const value=fixture[u.origin+u.pathname];if(!value)throw Error("Unexpected metadata");
    const b=THUNDERBAY_GRANT,kind=u.pathname.endsWith(b.site+"/data")?"siteData":u.pathname.endsWith(b.site)?"site":u.pathname.includes("/groups/")?"group":u.pathname.includes("/sharing/")?"item":u.pathname.endsWith("/FeatureServer")?"root":"metadata";
    return{...value,...changes[kind]};
  };
}
beforeEach(()=>{json.mockReset().mockImplementation(provider());html.mockReset().mockResolvedValue(offer);bytes.mockReset().mockImplementation(async(u:URL)=>u.href===THUNDERBAY_GRANT.licenceUrl?licence:u.href===THUNDERBAY_HERITAGE.url?csv:Promise.reject(Error("Unexpected bytes")));provincialMetadata.mockReset().mockResolvedValue({sourceUpdatedAt:null});vi.spyOn(console,"warn").mockImplementation(()=>{});});
afterEach(()=>vi.restoreAllMocks());
const screen=()=>thunderBayLayers("216 Brodie St S","Thunder Bay","ON",location);
describe("Thunder Bay licensed property references",()=>{
  it("binds the full City offer/licence, exact curator and publisher without inventing omitted orgId",async()=>{
    for(const f of THUNDERBAY_FEEDS)await expect(thunderBayMetadata(f)).resolves.toHaveProperty("sourceUpdatedAt");
    for(const change of [{item:{owner:"copy"}},{item:{orgId:"invented"}},{item:{licenseInfo:"public"}},{item:{description:"new origin"}},{item:{url:feed("buildingFootprintReference").rootUrl}},{root:{serviceItemId:"other"}},{root:{layers:[]}},{root:{copyrightText:"Third party"}},{metadata:{fields:[]}},{metadata:{objectIdField:"other"}},{metadata:{geometryType:"esriGeometryPolygon"}},{curated:{total:0,results:[]}},{curated:{total:2}},{site:{owner:"copy"}},{site:{orgId:"invented"}},{siteData:{catalog:{groups:[]}}},{group:{isOpenData:false}}]){
      json.mockClear().mockImplementation(provider({},change));await expect(thunderBayMetadata(feed("municipalAddresses"))).rejects.toThrow();expect(json.mock.calls.some(([u])=>u.pathname.endsWith("/query"))).toBe(false);
    }
  });
  it("stops both record and count queries when full licence bytes or linked offer change",async()=>{
    bytes.mockResolvedValue(new TextEncoder().encode("incomplete grant"));expect((await screen()).officialPlanReference.status).toBe("unavailable");expect(json.mock.calls.some(([u])=>u.href.startsWith(feed("officialPlanReference").url+"/query"))).toBe(false);
    json.mockClear();await thunderBayCoverage();expect(json.mock.calls.some(([u])=>u.pathname.endsWith("/query"))).toBe(false);
    bytes.mockImplementation(async(u:URL)=>u.href===THUNDERBAY_GRANT.licenceUrl?licence:csv);html.mockResolvedValue(offer.replaceAll("including for commercial purposes","except commercial purposes"));await expect(thunderBayMetadata(feed("municipalAddresses"))).rejects.toThrow();
    html.mockResolvedValue(offer.replaceAll("usn_cmp_anchoredaccordion","changed"));await expect(thunderBayMetadata(feed("municipalAddresses"))).rejects.toThrow();
  });
  it("ignores only per-response accordion IDs while preserving every originating grant link",async()=>{
    html.mockResolvedValue(offer.replace(/(#collapse_)[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}_/g,"$1aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee_"));await expect(thunderBayMetadata(feed("municipalAddresses"))).resolves.toHaveProperty("sourceUpdatedAt");
    html.mockResolvedValue(offer.replaceAll("/media/inmjquon/city-of-thunder-bay-open-data-licence.pdf","/other-terms.pdf"));await expect(thunderBayMetadata(feed("municipalAddresses"))).rejects.toThrow();
  });
  it("returns exact civic components as attributes and never reuses CAD centroid geometry",async()=>{
    const r=await thunderBayResearch({address:"216 Brodie St S, Thunder Bay, ON"});expect(r?.location).toBeNull();expect(r?.civic.status).toBe("available");expect(r?.civic.data).toMatchObject({sourceGeometryReused:false,preciseBuildingIdentityEstablished:false,activeAddressStatusVerified:false});
    const u=json.mock.calls.map(([u])=>u as URL).find(u=>u.href.startsWith(feed("municipalAddresses").url+"/query"))!;expect(u.searchParams.get("returnGeometry")).toBe("false");expect(u.searchParams.get("where")).toContain("UPPER(STREET) IN ('BRODIE')");expect(u.searchParams.get("outFields")).not.toContain("PIN");
  });
  it("strictly distinguishes number suffix, direction, City and province",async()=>{
    for(const values of [{COMPLETE:"216A BRODIE ST S",ADDRESS:"216A",ADDRESS_QUALIFIER:"A"},{COMPLETE:"216 BRODIE ST N",ROOT:"BRODIE ST N",SPLITLOC:"N"},{CITY:"FWFN"},{PROVINCE:"MB"},{STREET:"OTHER"},{ADDRESS:"217"}]){
      json.mockImplementation(provider({municipalAddresses:[civic(values)]}));expect((await thunderBayResearch({address:"216 Brodie St S, Thunder Bay, ON"}))?.civic.status).toBe("no_match");
    }
    json.mockClear();expect((await thunderBayResearch({address:"216 Brodie St S, Toronto, ON",city:"Thunder Bay"}))?.location?.status).toBe("ambiguous");expect(json).not.toHaveBeenCalled();
    expect((await thunderBayResearch({address:"216 Brodie St S, Thunder Bay, BC",province:"ON"}))?.location?.status).toBe("ambiguous");expect(json).not.toHaveBeenCalled();
  });
  it("uses published apostrophe-bearing names and SQ/SQUARE codes without losing exact direction/suffix",async()=>{
    json.mockImplementation(provider({municipalAddresses:[civic({OBJECTID:439,ADDRESS:"439",ADDRESS_NUMBER:439,STREET:"ST. PATRICK'S",ROWTYPE:"SQ",SPLITLOC:"",COMPLETE:"439 ST. PATRICK'S SQ",ROOT:"ST. PATRICK'S SQ"})]}));
    const r=await thunderBayResearch({address:"439 St Patrick’s Square, Thunder Bay, ON"});expect(r?.civic.status).toBe("available");const u=json.mock.calls.map(([u])=>u as URL).find(u=>u.href.startsWith(feed("municipalAddresses").url+"/query"))!;expect(u.searchParams.get("where")).toContain("ST. PATRICK''S");
    expect((await thunderBayLayers("439 St Patrick’s Sq","Thunder Bay","ON",null)).historicalHeritageRegister.status).toBe("available");
    expect((await thunderBayResearch({address:"439 St Patrick’s Sq N, Thunder Bay, ON"}))?.civic.status).toBe("no_match");
  });
  it("blocks spatial and historical matching for duplicate, non-regular or truncated civic evidence",async()=>{
    for(const data of [[civic(),civic({OBJECTID:2})],[civic({REFNAME:"ADDRESS-ONLY"})],[civic({REFNAME:"ADDRESS-STREET-LANE"})]]){
      json.mockClear().mockImplementation(provider({municipalAddresses:data}));const r=await thunderBayResearch({address:"216 Brodie St S, Thunder Bay, ON"});expect(r?.location?.status).toBe("ambiguous");const l=await thunderBayLayers("216 Brodie St S","Thunder Bay","ON",location,"Thunder Bay",r);expect(l.officialPlanReference.status).toBe("skipped");expect(l.historicalHeritageRegister.status).toBe("skipped");expect(json.mock.calls.filter(([u])=>u.pathname.endsWith("/query")).every(([u])=>u.href.startsWith(feed("municipalAddresses").url))).toBe(true);
    }
    json.mockImplementation(provider({municipalAddresses:[]},{municipalAddresses:{exceededTransferLimit:true}}));expect((await thunderBayResearch({address:"216 Brodie St S, Thunder Bay, ON"}))?.civic.status).toBe("unavailable");
    json.mockImplementation(provider({},{municipalAddresses:{exceededTransferLimit:true}}));expect((await thunderBayResearch({address:"216 Brodie St S, Thunder Bay, ON"}))?.location?.status).toBe("ambiguous");
  });
  it("requires one complete original provincial Thunder Bay polygon and an independent suitable point",async()=>{
    for(const municipality of [[],[{attributes:{OBJECTID:1,MUNICIPAL_NAME:"NEEBING"}}],[{attributes:{OBJECTID:1,MUNICIPAL_NAME:"THUNDER BAY"}},{attributes:{OBJECTID:2,MUNICIPAL_NAME:"THUNDER BAY"}}],[{attributes:{OBJECTID:"1",MUNICIPAL_NAME:"THUNDER BAY"}}]]){
      json.mockClear().mockImplementation(provider({municipality}));expect((await screen()).officialPlanReference.status).toBe("skipped");expect(json.mock.calls.filter(([u])=>u.pathname.endsWith("/query")).every(([u])=>u.href.startsWith(provincial.url))).toBe(true);
    }
    json.mockImplementation(provider({},{municipality:{exceededTransferLimit:true}}));expect((await screen()).parcelReference.status).toBe("skipped");
    for(const l of [{...location,accuracy:"blockface_representative"},{...location,provider:"thunderbay:municipalAddresses"},{...location,latitude:0},{...location,city:"Neebing"}]){json.mockClear();expect((await thunderBayLayers(null,"Thunder Bay","ON",l)).municipality.status).toBe("skipped");expect(json).not.toHaveBeenCalled();}
  });
  it("preserves historical plan/district/boundary context without permission or absence claims",async()=>{
    json.mockImplementation(provider({officialPlanReference:[record(feed("officialPlanReference"),{LANDUSE:"Residential",Schedule:"A"})],heritageDistrict:[record(feed("heritageDistrict"),{Name:"Waverley Park"})],historicalMunicipalBoundary:[record(feed("historicalMunicipalBoundary"),{TOWNSHIP:"City"})]}));
    const r=await screen();expect(r.officialPlanReference.data).toMatchObject({publishedInstrumentYear:2019,currentOfficialMapLineageVerified:false,legalPermissionsEstablished:false});expect(r.heritageDistrict.data).toMatchObject({publishedBylaw:"65-1988",currentHeritageRegisterVerified:false});expect(r.historicalMunicipalBoundary.data).toMatchObject({usedAsContainmentGate:false});expect(r.parcelReference.data).toMatchObject({absenceEstablished:false,parcelIdentityVerified:false});
    expect(preShowingBrief(r,[]).findings.find(x=>x.layer==="officialPlanReference")?.summary).toContain("2019");
  });
  it("exposes OID-only parcel/footprint references and preserves real data edit dates separately",async()=>{
    json.mockImplementation(provider({parcelReference:[record(feed("parcelReference"),{PCL_PIN:"PRIVATE",ACRES:12})],buildingFootprintReference:[record(feed("buildingFootprintReference"),{NUMBER_OF_UNITS:12,Elevation:10,Owner:"PRIVATE"})]}));const r=await screen();expect((r.parcelReference.data as Row).records).toEqual([{recordId:1}]);expect((r.buildingFootprintReference.data as Row).records).toEqual([{recordId:1}]);expect(JSON.stringify(r)).not.toContain("PRIVATE");
    const queries=json.mock.calls.map(([u])=>u as URL).filter(u=>u.searchParams.has("geometry"));expect(queries.every(u=>u.searchParams.get("returnGeometry")==="false")).toBe(true);
    json.mockImplementation(provider({},{metadata:{editingInfo:{lastEditDate:1790000000000}}}));expect((await thunderBayMetadata(feed("buildingFootprintReference"))).sourceUpdatedAt).toBeNull();
  });
  it("keeps exact 2022 heritage observations and raw categories distinct from the current register",async()=>{
    const r=await screen();expect(r.historicalHeritageRegister.status).toBe("available");expect(r.historicalHeritageRegister.sourceUpdatedAt).toBe("2022-08-22");expect(r.historicalHeritageRegister.data).toMatchObject({publishedVintage:"2022-08-22",currentHeritageRegisterVerified:false,constructionYearEstablished:false,ownershipReturned:false,records:[{publishedRegisterStatus:"Designated",publishedApproximateConstructionLabel:"1912",publishedBylawOrReport:"76"}]});
    expect(preShowingBrief(r,[]).findings.find(x=>x.layer==="historicalHeritageRegister")?.summary).toContain("June 2026");
    expect((await thunderBayLayers("216 Brodie St N","Thunder Bay","ON",null)).historicalHeritageRegister.status).toBe("no_match");expect((await thunderBayLayers("216A Brodie St S","Thunder Bay","ON",null)).historicalHeritageRegister.status).toBe("no_match");expect((await thunderBayLayers(null,"Thunder Bay","ON",{...location,provider:"caller",accuracy:"caller_supplied"})).historicalHeritageRegister.status).toBe("skipped");
  });
  it("fails closed when historical export bytes or the exact CSV item change",async()=>{
    bytes.mockImplementation(async(u:URL)=>u.href===THUNDERBAY_GRANT.licenceUrl?licence:Buffer.concat([csv,Buffer.from("\nchanged")]));expect((await screen()).historicalHeritageRegister.status).toBe("unavailable");
    bytes.mockImplementation(async(u:URL)=>u.href===THUNDERBAY_GRANT.licenceUrl?licence:csv);json.mockImplementation(provider({},{item:{type:"Feature Service"}}));expect((await screen()).historicalHeritageRegister.status).toBe("unavailable");
  });
  it("preserves truncation, no-match and independent source outages with strict typed records",async()=>{
    const f=feed("heritageDistrict");json.mockImplementation(provider({heritageDistrict:Array.from({length:51},(_,i)=>record(f,{OBJECTID:i+1,Name:"Waverley Park"}))}));let r=await screen();expect(r.heritageDistrict.truncated).toBe(true);expect((r.heritageDistrict.data as Row).records).toHaveLength(50);expect(r.heritageDistrict.data).toMatchObject({queryCoverageComplete:false,absenceEstablished:false});
    for(const records of [[record(f,{Name:7})],[record(f),record(f)]]){json.mockImplementation(provider({heritageDistrict:records}));expect((await screen()).heritageDistrict.status).toBe("unavailable");}
    json.mockImplementation(provider({},{heritageDistrict:{exceededTransferLimit:true},officialPlanReference:{error:{code:500}}}));r=await screen();expect(r.heritageDistrict.status).toBe("unavailable");expect(r.officialPlanReference.status).toBe("unavailable");expect(r.parcelReference.status).toBe("no_match");
  });
  it("counts eight references once, keeps twelve core gaps unqueried and preserves one-click artifact flow",async()=>{
    const c=await thunderBayCoverage();expect(c.datasets).toHaveLength(8);expect(c.datasets.every(d=>d.status==="verified")).toBe(true);expect(c.datasets.find(d=>d.layer==="historicalHeritageRegister")?.records).toBe(136);expect(c.municipalityReference.countIncludedHere).toBe(false);expect(c.complete).toBe(false);expect(c.withheld).toHaveLength(12);
    const r=await screen();for(const g of THUNDERBAY_WITHHELD)expect(r[g.layer].data).toMatchObject({recordsQueried:false});expect(json.mock.calls.filter(([u])=>u.pathname.endsWith("/query")).every(([u])=>u.href.startsWith(provincial.url)||THUNDERBAY_FEEDS.some(f=>u.href.startsWith(f.url+"/query")))).toBe(true);
    expect(preShowingBrief(r,[]).documentsToRequest.some(d=>d.document.includes("Thunder Bay"))).toBe(true);const m=ontarioMarketRoadmap().municipalities.find(m=>m.city==="Thunder Bay")!;expect(m.complete).toBe(false);expect(m.configuredLayers).toContain("historicalHeritageRegister");expect(m.withheldLayers).toHaveLength(12);expect(thunderBayMarket("City of Thunder Bay","ON")).toBe(true);expect(thunderBayMarket("Thunder Bay","MB")).toBe(false);
    expect(readFileSync(new URL("../../docs/homies-property-enrichment/SKILL.md",import.meta.url),"utf8")).toBe(PROPERTY_SKILL);expect(PROPERTY_SKILL).toContain("Thunder Bay");expect(PROPERTY_SKILL).toContain("Starter prompt: **Create a property forensics report for me.**");
    json.mockImplementation(provider({},{count:{count:-1}}));expect((await thunderBayCoverage()).datasets.filter(d=>d.layer!=="historicalHeritageRegister").every(d=>d.status==="unavailable"&&d.records===null)).toBe(true);
  });
});
