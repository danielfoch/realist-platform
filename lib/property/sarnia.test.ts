import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sarniaCoverage, sarniaLayers, sarniaLocation, sarniaMarket, sarniaMetadata } from "./sarnia";
import { SARNIA_FEEDS, SARNIA_GRANT, SARNIA_WITHHELD, type SarniaFeed } from "./sarnia-sources";
import { NIAGARA_FEEDS } from "./niagara-sources";
import { preShowingBrief } from "./brief";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
import { PROPERTY_SKILL } from "./skill";
import { PROPERTY_OPENAPI } from "./openapi";
import type { Location, Row } from "./model";
const { json, html, provincialMetadata } = vi.hoisted(() => ({ json:vi.fn(),html:vi.fn(),provincialMetadata:vi.fn() }));
vi.mock("./http",async()=>({...await vi.importActual<typeof import("./http")>("./http"),fetchJson:json,fetchText:html}));
vi.mock("./niagara",()=>({niagaraMetadata:provincialMetadata}));
const fixture:Record<string,Row>=JSON.parse(readFileSync(new URL("./fixtures/sarnia-grant.json",import.meta.url),"utf8"));
const offer=readFileSync(new URL("./fixtures/sarnia-offer.html",import.meta.url),"utf8");
const feed=(k:string)=>SARNIA_FEEDS.find(f=>f.key===k)!;
const provincial=NIAGARA_FEEDS.find(f=>f.key==="ontarioMunicipality")!;
const location:Location={address:"255 Christina St N",city:"Sarnia",province:"ON",latitude:42.975,longitude:-82.403,accuracy:"source_building_point",provider:"statcan-nar-202606"};
const record=(f:SarniaFeed,v:Row={})=>({attributes:Object.fromEntries(Object.keys(f.fields).map(k=>[k,k===f.oid?v[k]??1:v[k]??null]))});
const civic=(v:Row={})=>record(feed("municipalAddresses"),{ADDRESS:"255 CHRISTINA ST N",STNUM:"255",STNAME:"CHRISTINA",STTYPE:"STREET",STTYPE_A:"ST",STDIR:"NORTH",STDIR_A:"N",CITY:"Sarnia",...v});
function provider(data:Record<string,Row[]>={},changes:Record<string,Row|undefined>={}){
 return async(u:URL)=>{
  if(u.pathname.endsWith("/query")){
   if(u.href.startsWith(provincial.url+"/query"))return{features:data.municipality??[{attributes:{OBJECTID:1,MUNICIPAL_NAME:"SARNIA"}}],...changes.municipality};
   const f=SARNIA_FEEDS.find(f=>u.href.startsWith(f.url+"/query"));if(!f)throw Error("Unexpected query");
   if(u.searchParams.get("returnCountOnly")==="true")return{count:1,...changes.count};
   return{features:data[f.key]??(f.key==="municipalAddresses"?[civic()]:[]),...changes[f.key]};
  }
  if(u.pathname.endsWith("/search")){
   const id=u.searchParams.get("q")?.match(/^id:([a-f0-9]{32}) AND group:/)?.[1];if(!id||!u.searchParams.get("q")?.endsWith(SARNIA_GRANT.group))throw Error("Unexpected curation");
   return{...fixture["curation:"+id],...changes.curated};
  }
  const value=fixture[u.origin+u.pathname];if(!value)throw Error("Unexpected metadata");
  const b=SARNIA_GRANT,kind=u.pathname.endsWith(b.page+"/data")?"pageData":u.pathname.endsWith(b.site+"/data")?"siteData":u.pathname.endsWith(b.page)?"page":u.pathname.endsWith(b.site)?"site":u.pathname.includes("/groups/")?"group":u.pathname.includes("/sharing/")?"item":u.pathname.endsWith("/FeatureServer")?"root":"metadata";
  return{...value,...changes[kind]};
 };
}
beforeEach(()=>{json.mockReset().mockImplementation(provider());html.mockReset().mockResolvedValue(offer);provincialMetadata.mockReset().mockResolvedValue({sourceUpdatedAt:null});vi.spyOn(console,"warn").mockImplementation(()=>{});});
afterEach(()=>vi.restoreAllMocks());
const screen=(address=location.address,l:Location|null=location)=>sarniaLayers(address,"Sarnia","ON",l);
describe("Sarnia licensed municipal reference research",()=>{
 it("binds the complete official offer/grant, exact catalogue/publisher and typed endpoint",async()=>{
  for(const f of SARNIA_FEEDS)expect((await sarniaMetadata(f)).sourceUpdatedAt).toMatch(/^2026-/);
  for(const change of [{item:{owner:"copy"}},{item:{orgId:"invented"}},{item:{licenseInfo:"public"}},{item:{description:"third party"}},{item:{url:feed("parkReference").rootUrl}},{root:{serviceItemId:"other"}},{root:{layers:[]}},{root:{copyrightText:"Third party"}},{metadata:{fields:[]}},{metadata:{objectIdField:"other"}},{metadata:{geometryType:"esriGeometryPoint"}},{curated:{total:0,results:[]}},{curated:{total:2}},{site:{owner:"copy"}},{site:{orgId:"invented"}},{siteData:{catalog:{groups:[]}}},{group:{isOpenData:true}},{page:{owner:"copy"}},{pageData:{values:{}}}]){
   json.mockClear().mockImplementation(provider({},change));await expect(sarniaMetadata(feed("catalogueZoningReference"))).rejects.toThrow();expect(json.mock.calls.some(([u])=>u.pathname.endsWith("/query"))).toBe(false);
  }
 });
 it("stops City record and count reads when full grant clauses or explicit offer change",async()=>{
  const url='https://www.arcgis.com/sharing/rest/content/items/'+SARNIA_GRANT.page+'/data';
  const changed=JSON.parse(JSON.stringify(fixture[url]).replace('including for commercial purposes','except commercial purposes'));
  json.mockImplementation(provider({}, {pageData:changed}));await expect(sarniaMetadata(feed("municipalAddresses"))).rejects.toThrow();
  json.mockClear();expect((await sarniaCoverage()).datasets.every(x=>x.status==="unavailable")).toBe(true);expect(json.mock.calls.some(([u])=>u.pathname.endsWith("/query"))).toBe(false);
  json.mockImplementation(provider());html.mockResolvedValue(offer.replaceAll('https://city-of-sarnia.hub.arcgis.com/','https://copy.invalid/'));await expect(sarniaMetadata(feed("municipalAddresses"))).rejects.toThrow();
 });
 it("rejects municipality/province conflicts and unsupported Point Edward alias",async()=>{
  expect(sarniaMarket("Point Edward","ON")).toBe(false);expect(await sarniaLocation({address:"255 Christina St N, Sarnia, ON"})).toBeNull();
  expect((await sarniaLocation({address:"255 Christina St N, Point Edward, ON",city:"Sarnia"}))?.status).toBe("ambiguous");
  expect((await sarniaLocation({address:"255 Christina St N, Sarnia, BC",province:"ON"}))?.status).toBe("ambiguous");
  for(const l of [{...location,city:"Point Edward"},{...location,province:"BC"},{...location,latitude:44},{...location,provider:"sarnia:municipalAddresses"},{...location,accuracy:"unknown"}]){json.mockClear();expect((await screen(location.address,l)).catalogueZoningReference.status).toBe("skipped");expect(json).not.toHaveBeenCalled();}
 });
 it("requires full civic number/suffix/street/type/direction/City agreement",async()=>{
  expect((await screen()).municipalAddresses.status).toBe("available");
  for(const v of [{STNUM:"256"},{STNUM:"255A"},{STNAME:"CHRISTINA EAST"},{STTYPE_A:"RD"},{STTYPE:"ROAD"},{STDIR_A:"S"},{STDIR:"SOUTH"},{CITY:"Point Edward"},{ADDRESS:"255-257 CHRISTINA ST N"},{ADDRESS:"255 CHRISTINA ST N, Sarnia"}]){json.mockImplementation(provider({municipalAddresses:[civic(v)]}));expect((await screen()).municipalAddresses.status).toBe("no_match");}
  json.mockImplementation(provider({municipalAddresses:[civic({ADDRESS:"255A CHRISTINA ST N",STNUM:"255A"})]}));expect((await screen("255A Christina Street North")).municipalAddresses.status).toBe("available");
 });
 it("halts City polygon queries for duplicate or incomplete civic evidence",async()=>{
  for(const [data,changes] of [[{municipalAddresses:[civic(),civic({OBJECTID_1:2})]},{}],[{}, {municipalAddresses:{exceededTransferLimit:true}}]] as [Record<string,Row[]>,Record<string,Row>][]){json.mockClear().mockImplementation(provider(data,changes));const r=await screen();expect(r.municipalAddresses.status).toBe("ambiguous");expect(r.catalogueZoningReference.status).toBe("skipped");expect(json.mock.calls.some(([u])=>u.href.startsWith(feed("catalogueZoningReference").url+"/query"))).toBe(false);}
 });
 it("never reuses generic City civic geometry or screens approximate independent points",async()=>{
  const r=await screen(location.address,{...location,accuracy:"street_interpolated"});expect(r.municipalAddresses.data).toMatchObject({spatialScreenPerformed:false,screenedPoint:null,sourcePointGeometryReused:false,preciseBuildingIdentityEstablished:false});expect(r.parkReference.status).toBe("skipped");expect(json.mock.calls.filter(([u])=>u.pathname.endsWith("/query")).every(([u])=>!u.searchParams.has("geometry"))).toBe(true);
 });
 it("requires one complete named original provincial polygon before City queries",async()=>{
  for(const municipality of [[],[{attributes:{OBJECTID:1,MUNICIPAL_NAME:"POINT EDWARD"}}],[{attributes:{OBJECTID:1,MUNICIPAL_NAME:"SARNIA"}},{attributes:{OBJECTID:2,MUNICIPAL_NAME:"SARNIA"}}]]){json.mockClear().mockImplementation(provider({municipality}));expect((await screen()).parkReference.status).toBe("skipped");expect(json.mock.calls.filter(([u])=>u.pathname.endsWith("/query")).every(([u])=>u.href.startsWith(provincial.url))).toBe(true);}
  json.mockImplementation(provider({}, {municipality:{exceededTransferLimit:true}}));expect((await screen()).catalogueZoningReference.status).toBe("skipped");
  provincialMetadata.mockRejectedValue(Error("Original source grant changed"));expect((await screen()).municipality.status).toBe("unavailable");
 });
 it("keeps nearby parks separate from subject-point zoning and charge references",async()=>{
  json.mockImplementation(provider({parkReference:[record(feed("parkReference"),{Park_Name:"Test Park"})],catalogueZoningReference:[record(feed("catalogueZoningReference"),{ZC_KEY:"R1",EFFECTDATE:1704067200000,BYLAW_NO:"85 of 2002"})],developmentChargeAreas:[record(feed("developmentChargeAreas"),{DEV_CHARGE_TYPE:"Urban"})],buildingFootprintReference:[record(feed("buildingFootprintReference"),{LandUse:"PRIVATE",Shape__Area:400})]}));
  const r=await screen();expect(r.parkReference.data).toMatchObject({scope:"nearby_reference_only",searchRadiusMeters:1000,subjectPropertyRecords:false,walkingAccessVerified:false,nearestFeatureRankingPerformed:false});
  expect(r.catalogueZoningReference.data).toMatchObject({scope:"subject_point",governingBylawVerified:false,currentApplicabilityVerified:false,legalPermissionsEstablished:false,records:[{publishedEffectDate:"2024-01-01T00:00:00.000Z"}]});
  expect(r.developmentChargeAreas.data).toMatchObject({currentFeesVerified:false,exemptionEstablished:false,eligibilityEstablished:false});expect(r.buildingFootprintReference.data).toMatchObject({records:[{recordId:1}],measuredBuildingAreaReturned:false});expect(JSON.stringify(r)).not.toContain("PRIVATE");
  const q=json.mock.calls.map(([u])=>u as URL).filter(u=>u.pathname.endsWith("/query"));expect(q.find(u=>u.href.startsWith(feed("parkReference").url))?.searchParams.get("distance")).toBe("1000");expect(q.find(u=>u.href.startsWith(feed("catalogueZoningReference").url))?.searchParams.has("distance")).toBe(false);expect(q.every(u=>u.searchParams.get("returnGeometry")==="false"&&!/\*|Owner|Shape__|created|edited/i.test(u.searchParams.get("outFields")??""))).toBe(true);
  const b=preShowingBrief(r,[]);expect(b.findings.find(x=>x.layer==="parkReference")?.summary).toContain("1,000");expect(b.documentsToRequest.filter(x=>x.document.includes("Sarnia"))).toHaveLength(3);
 });
 it("preserves truncation, typed failures, missing dates and no-match uncertainty",async()=>{
  const f=feed("catalogueZoningReference");json.mockImplementation(provider({catalogueZoningReference:Array.from({length:51},(_,i)=>record(f,{OBJECTID:i+1,ZC_KEY:"R1"}))}));let r=await screen();expect(r.catalogueZoningReference.truncated).toBe(true);expect((r.catalogueZoningReference.data as Row).records).toHaveLength(50);expect(r.catalogueZoningReference.data).toMatchObject({absenceEstablished:false,queryCoverageComplete:false});
  json.mockClear().mockImplementation(provider({municipalAddresses:[civic({STNUM:255})]}));expect((await screen()).catalogueZoningReference.status).toBe("skipped");expect(json.mock.calls.some(([u])=>u.href.startsWith(f.url+"/query"))).toBe(false);
  json.mockImplementation(provider({catalogueZoningReference:[record(f,{ZC_KEY:7})]}));expect((await screen()).catalogueZoningReference.status).toBe("unavailable");
  json.mockImplementation(provider({}, {catalogueZoningReference:{exceededTransferLimit:true}}));expect((await screen()).catalogueZoningReference.status).toBe("unavailable");
  json.mockImplementation(provider({}, {metadata:{editingInfo:{lastEditDate:1790000000000}}}));expect((await sarniaMetadata(f)).sourceUpdatedAt).toBeNull();
  json.mockImplementation(provider());r=await screen();expect(r.catalogueZoningReference.status).toBe("no_match");expect(r.catalogueZoningReference.data).toMatchObject({absenceEstablished:false});
 });
 it("counts five selected City feeds once, excludes withheld queries and keeps market incomplete",async()=>{
  const c=await sarniaCoverage();expect(c.datasets).toHaveLength(5);expect(c.datasets.every(x=>x.status==="verified")).toBe(true);expect(c.withheld).toHaveLength(13);expect(c.complete).toBe(false);expect(c.municipalityReference.countIncludedHere).toBe(false);
  expect(json.mock.calls.filter(([u])=>u.pathname.endsWith("/query")).every(([u])=>SARNIA_FEEDS.some(f=>u.href.startsWith(f.url+"/query")))).toBe(true);
  for(const count of [-1,"1",1.5,null]){json.mockImplementation(provider({}, {count:{count}}));expect((await sarniaCoverage()).datasets.every(x=>x.status==="unavailable"&&x.records===null)).toBe(true);}
  json.mockImplementation(provider());const r=await screen(null,{...location,accuracy:"caller_supplied",provider:"caller"});expect(r.municipalAddresses.status).toBe("skipped");for(const g of SARNIA_WITHHELD)expect(r[g.layer].data).toMatchObject({recordsQueried:false,screenPerformed:false});
  const m=ontarioMarketRoadmap().municipalities.find(x=>x.city==="Sarnia")!;expect(m.configuredLayers).toContain("parkReference");expect(m.withheldLayers.some(x=>x.layer==="permits")).toBe(true);expect(m.complete).toBe(false);
 });
 it("keeps hosted skill, native report contract and API layers aligned",()=>{
  expect(PROPERTY_SKILL).toBe(readFileSync(new URL("../../docs/homies-property-enrichment/SKILL.md",import.meta.url),"utf8"));expect(PROPERTY_SKILL).toContain("Sarnia adds five");expect(PROPERTY_SKILL).toContain("native Homies");expect(PROPERTY_OPENAPI.components.schemas.PropertyResult.properties.layers.properties).toHaveProperty("sarniaConservationRegulation");
 });
});
