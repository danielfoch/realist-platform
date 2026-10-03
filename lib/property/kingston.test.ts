import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { kingstonCoverage, kingstonLayers, kingstonLocation, kingstonMarket, kingstonMetadata } from "./kingston";
import { KINGSTON_FEEDS, type KingstonFeed } from "./kingston-sources";
import { preShowingBrief } from "./brief";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
import type { Location, Row } from "./model";
const fetch=vi.hoisted(()=>vi.fn());
const bytes=vi.hoisted(()=>vi.fn());
const nar=vi.hoisted(()=>vi.fn());
vi.mock("./national",()=>({nationalAddress:nar}));
vi.mock("./http",async()=>({...await vi.importActual<typeof import("./http")>("./http"),fetchJson:fetch,fetchBytes:bytes}));
const grant=readFileSync(new URL("./fixtures/kingston-open-data-licence.pdf",import.meta.url));
const terms:Record<string,string>=JSON.parse(readFileSync(new URL("./fixtures/kingston-item-terms.json",import.meta.url),"utf8"));
const feed=(key:string)=>KINGSTON_FEEDS.find(f=>f.key===key)!;
const point={x:-76.4809,y:44.2303};
const location:Location={address:"216 Ontario St",city:"Kingston",province:"ON",latitude:point.y,longitude:point.x,accuracy:"source_civic_address_point",provider:"kingston:addresses"};
function record(f:KingstonFeed,a:Row={},g:Row=point){return {attributes:{...Object.fromEntries(Object.keys(f.fields).map(k=>[k,null])),[f.oid]:1,...a},geometry:g};}
const civic=(a:Row={},g?:Row)=>record(feed("addresses"),{ADDRESS_NUMBER:216,STREET:"ONTARIO ST",FULL_ADDRESS:"216 ONTARIO ST",MUNICIPALITY:"KINGSTON",ADDRESS_ID:37621,...a},g);
function provider(records:Record<string,unknown[]>={},changes:Record<string,Row|undefined>={}){return async(u:URL)=>{
  const f=u.pathname.includes("/sharing/")?KINGSTON_FEEDS.find(f=>u.pathname.endsWith(f.item)):KINGSTON_FEEDS.find(f=>u.href.split("?")[0]===f.url||u.href.split("?")[0]===f.url+"/query");if(!f)throw Error("Unexpected provider");
  if(u.pathname.includes("/sharing/"))return {access:"public",owner:f.owner,orgId:f.org,title:f.expectedItemTitle,url:f.rootUrl,licenseInfo:terms[f.item],...changes.item};
  if(!u.pathname.endsWith("/query"))return {name:f.expectedLayerName,geometryType:f.geometry,copyrightText:f.expectedCopyright,fields:Object.entries(f.fieldTypes).map(([name,type])=>({name,type})),...changes.metadata};
  if(u.searchParams.get("returnCountOnly")==="true")return {count:10,...changes.count};
  return {features:records[f.key]??(f.key==="municipality"?[record(f,{MUNICIPALITY_NAME:"City of Kingston"})]:[]),...changes[f.key]};
};}
function nested(r:Record<string,{data:unknown}>,group:string,key:string){return ((r[group].data as Row).datasets as Record<string,{status:string;data:Row;truncated?:boolean}>)[key];}
beforeEach(()=>{fetch.mockReset();bytes.mockReset().mockResolvedValue(grant);nar.mockReset().mockResolvedValue(null);});
describe("Kingston municipal property research",()=>{
  it("pins the inspected grant bytes, exact referral and full terms, source endpoint and typed child before records",async()=>{
    const f=feed("exceptions");fetch.mockImplementation(provider());await expect(kingstonMetadata(f)).resolves.toEqual({sourceUpdatedAt:null});
    bytes.mockResolvedValue(Buffer.from("Changed grant"));await expect(kingstonMetadata(f)).rejects.toThrow();bytes.mockResolvedValue(grant);
    for(const change of [{item:{owner:"copy"}},{item:{orgId:"other"}},{item:{access:"private"}},{item:{url:f.url+"/0"}},{item:{licenseInfo:terms[f.item]+"Non-commercial only"}},{item:{licenseInfo:terms[f.item].replace("CityofKingston_OpenDataLicense.pdf","other.pdf")}},{metadata:{name:"Other"}},{metadata:{copyrightText:"Teranet"}},{metadata:{fields:Object.entries(f.fieldTypes).map(([name,type])=>({name,type:name==="EXCEPTION_TEXT"?"esriFieldTypeInteger":type}))}}]){fetch.mockClear().mockImplementation(provider({},change));await expect(kingstonMetadata(f)).rejects.toThrow();expect(fetch.mock.calls.some(([u])=>u.pathname.endsWith("/query"))).toBe(false);}
  });
  it("requires matching suffix, direction, street type and municipal civic identity",async()=>{
    fetch.mockImplementation(provider({addresses:[civic()]}));expect((await kingstonLocation({address:"216 Ontario Street, Kingston, ON"}))?.data?.municipalAddress?.recordIds).toEqual(["1"]);
    for(const address of ["216A Ontario St","216 Ontario St W","216 Ontario Rd"])expect(await kingstonLocation({address:address+", Kingston, ON"})).toBeNull();
    for(const a of [{MUNICIPALITY:"GANANOQUE"},{FULL_ADDRESS:"216 OTHER ST"},{ADDRESS_NUMBER:217}]){fetch.mockImplementation(provider({addresses:[civic(a)]}));expect(await kingstonLocation({address:"216 Ontario St, Kingston, ON"})).toBeNull();}
    expect((await kingstonLocation({address:"216 Ontario St, Gananoque, ON",city:"Kingston"}))?.status).toBe("ambiguous");expect(kingstonMarket("Kingston","BC")).toBe(false);expect(await kingstonLocation({address:"Unit 2, 216 Ontario St, Kingston, ON"})).toBeNull();
  });
  it("groups shared-unit civic points only when they agree and keeps unusable, distant and incomplete candidates unresolved",async()=>{
    fetch.mockImplementation(provider({addresses:[civic(),civic({OBJECTID:2,UNIT:"2",FULL_ADDRESS:"216 ONTARIO ST UNIT 2"})]}));const l=await kingstonLocation({address:"216 Ontario St, Kingston, ON"});expect(l?.data?.municipalAddress?.publishedAddressRecordCount).toBe(2);
    for(const values of [[civic({}, {})],[civic(),civic({OBJECTID:2},{x:-76.5,y:44.24})]]){fetch.mockImplementation(provider({addresses:values}));expect((await kingstonLocation({address:"216 Ontario St, Kingston, ON"}))?.status).toBe("ambiguous");}
    for(const change of [{exceededTransferLimit:true},{features:null},{features:[{attributes:{OBJECTID:1}}]},{features:Array.from({length:501},()=>civic())}]){fetch.mockImplementation(provider({addresses:[civic()]},{addresses:change}));expect(await kingstonLocation({address:"216 Ontario St, Kingston, ON"})).toBeNull();}
  });
  it("retains national building metadata only with exact identity, City and point agreement",async()=>{
    fetch.mockImplementation(provider({addresses:[civic()]}));const data={...location,accuracy:"source_building_point",addressRegister:{buildingId:"building",publishedAddressRecords:1,postalCodes:[],buildingUsageCodes:[],csduid:null}};
    nar.mockResolvedValue({status:"available",data});expect((await kingstonLocation({address:"216 Ontario St, Kingston, ON"}))?.data?.addressRegister?.buildingId).toBe("building");
    for(const change of [{city:"Gananoque"},{address:"217 Ontario St"},{longitude:-76.6},{accuracy:"street_interpolated"}]){nar.mockResolvedValue({status:"available",data:{...data,...change}});expect((await kingstonLocation({address:"216 Ontario St, Kingston, ON"}))?.data?.addressRegister).toBeUndefined();}
  });
  it("requires precision and one matching City boundary before property queries",async()=>{
    for(const records of [[],[record(feed("municipality"),{MUNICIPALITY_NAME:"Gananoque"})],[record(feed("municipality"),{MUNICIPALITY_NAME:"City of Kingston"}),record(feed("municipality"),{OBJECTID:2,MUNICIPALITY_NAME:"City of Kingston"})]]){fetch.mockClear().mockImplementation(provider({municipality:records}));const r=await kingstonLayers("216 Ontario St","Kingston","ON",location);expect(r.permits.status).toBe("skipped");expect(fetch.mock.calls.filter(([u])=>u.pathname.endsWith("/query"))).toHaveLength(1);}
    fetch.mockClear();const r=await kingstonLayers("216 Ontario St","Kingston","ON",{...location,accuracy:"street_interpolated"});expect(r.zoning.status).toBe("skipped");expect(fetch).not.toHaveBeenCalled();expect(await kingstonLayers(null,"Kingston","BC",location)).toEqual({});
  });
  it("preserves exact-address permit and active application observations without leaking names or inferring decisions",async()=>{
    fetch.mockImplementation(provider({permits:[record(feed("permits"),{ADDRESS:"216 ONTARIO ST",STATUS:"Cancelled",TOTALVALUATION:"$12,345 estimate",FEE:"n/a",DATE_OCC_PERMIT:1704067200000,INSPECTOR:"PRIVATE"}),record(feed("permits"),{OBJECTID:2,ADDRESS:"217 ONTARIO ST"})],planningApplications:[record(feed("planningApplications"),{ADDR_FULL:"216 ONTARIO ST,  KINGSTON, ON K7L 2Z3",RECORD_STATUS:"Under Review",PUBLIC_MEETING_DATE:"TBD",APPLICANT:"PRIVATE"}),record(feed("planningApplications"),{OBJECTID:2,ADDR_FULL:"216 ONTARIO ST, GANANOQUE, ON K7G 1A1"}),record(feed("planningApplications"),{OBJECTID:3,ADDR_FULL:"216 ONTARIO ST, KINGSTON, NY 12345"})]}));
    const r=await kingstonLayers("216 Ontario St","Kingston","ON",location);expect(r.permits.data).toMatchObject({fullHistorySearched:false,finalInspectionsVerified:false,currentOccupancyApprovalVerified:false,records:[expect.objectContaining({publishedStatus:"Cancelled",publishedValuationText:"$12,345 estimate",publishedFeeText:"n/a",publishedOccupancyPermitDate:"2024-01-01T00:00:00.000Z"})]});expect(r.planningApplications.data).toMatchObject({nearbySearchPerformed:false,records:[expect.objectContaining({publishedMeetingDateText:"TBD",publishedStatus:"Under Review"})]});expect(JSON.stringify(r)).not.toContain("PRIVATE");expect(r.permits.sourceUpdatedAt).toBeNull();
    const query=fetch.mock.calls.find(([u])=>u.pathname===new URL(feed("permits").url+"/query").pathname)![0] as URL;expect(query.searchParams.get("where")).toContain("UPPER(ADDRESS)");expect(query.searchParams.get("outFields")).not.toContain("INSPECTOR");
  });
  it("keeps nested source statuses, holds, exception text and heritage flags separate with incomplete legal coverage",async()=>{
    fetch.mockImplementation(provider({parentZone:[record(feed("parentZone"),{ZONE_CODE:"N/A"})],holding:[record(feed("holding"),{HOLDINGNUMBER:"H169",HOLDINGTEXT:"Source hold text"})],designated:[record(feed("designated"),{PART_IV:1,PART_V:0,DE_DESIGNATED:1,DATE_OF_CONSTRUCTION:"circa 1850",OWNER:"PRIVATE"})],opa50AppealMapping:[record(feed("opa50AppealMapping"),{STATUS:"Appeal"})]}));
    const r=await kingstonLayers("216 Ontario St","Kingston","ON",location);expect(r.zoning.data).toMatchObject({fullCurrentZoningScreenPerformed:false,formerBylawApplicabilityVerified:false,currentAppealsVerified:false,coverageComplete:false});expect(nested(r,"zoning","parentZone").data.records).toEqual([expect.objectContaining({publishedZoneCode:"N/A"})]);expect(nested(r,"zoning","holding").data.records).toEqual([expect.objectContaining({publishedHoldingNumber:"H169",publishedHoldingText:"Source hold text"})]);expect(nested(r,"heritage","designated").data.records).toEqual([expect.objectContaining({publishedPartIVFlag:1,publishedPartVFlag:0,publishedDeDesignatedFlag:1,publishedConstructionDateText:"circa 1850"})]);expect(r.officialPlan.data).toMatchObject({currentPlanScreenPerformed:false,inForcePolicyEstablished:false,draftPlanIsCurrentPolicy:false});expect(JSON.stringify(r)).not.toContain("PRIVATE");
  });
  it("skips coordinate-only address histories and keeps point hazards separate from safety, regulation and measured noise",async()=>{
    fetch.mockImplementation(provider({floodplainOverlay:[record(feed("floodplainOverlay"),{ELEVATION:76})],airportNoiseOverlay:[record(feed("airportNoiseOverlay"))]}));const r=await kingstonLayers(null,"Kingston","ON",{...location,accuracy:"caller_supplied"});for(const k of ["permits","planningApplications","heritageApplications"])expect(r[k].status).toBe("skipped");expect(r.floodplainOverlay.data).toMatchObject({floodSafetyEstablished:false,conservationAuthorityRegulatoryScreenPerformed:false,records:[expect.objectContaining({publishedElevationUnknownUnits:76})]});expect(r.airportNoiseOverlay.data).toMatchObject({measuredNoiseEstablished:false});
  });
  it("preserves blanks/nulls and nested partial availability while rejecting malformed, failed and incomplete empty sources",async()=>{
    fetch.mockImplementation(provider({parentZone:[record(feed("parentZone"),{ZONE_CODE:" ",ZONE_DESC:null})],holding:[record(feed("holding"),{HOLDINGNUMBER:1})]}));let r=await kingstonLayers("216 Ontario St","Kingston","ON",location);expect(r.zoning.status).toBe("available");expect(nested(r,"zoning","holding").status).toBe("unavailable");expect(nested(r,"zoning","parentZone").data.records).toEqual([expect.objectContaining({publishedZoneCode:" ",publishedZoneDescription:null})]);
    fetch.mockImplementation(provider({}, {permits:{exceededTransferLimit:true}}));r=await kingstonLayers("216 Ontario St","Kingston","ON",location);expect(r.permits.status).toBe("unavailable");expect(r.planningApplications.status).toBe("no_match");expect(r.planningApplications.data).toMatchObject({absenceEstablished:false,coverageComplete:false});
    bytes.mockRejectedValue(Error("timeout"));r=await kingstonLayers("216 Ontario St","Kingston","ON",location);expect(r.municipality.status).toBe("unavailable");expect(r.permits.status).toBe("skipped");
  });
  it("bounds record results and shares one grant fetch without concealing truncation",async()=>{
    fetch.mockImplementation(provider({permits:Array.from({length:51},(_,i)=>record(feed("permits"),{OBJECTID:i+1,ADDRESS:"216 ONTARIO ST"})),exceptions:Array.from({length:51},(_,i)=>record(feed("exceptions"),{OBJECTID:i+1}))}));const r=await kingstonLayers("216 Ontario St","Kingston","ON",location);expect(r.permits.truncated).toBe(true);expect((r.permits.data as Row).records).toHaveLength(50);expect(r.zoning.truncated).toBe(true);expect(r.zoning.data).toMatchObject({enabledQueryCoverageComplete:false});expect(bytes).toHaveBeenCalledTimes(1);
  });
  it("counts only 24 inspected source children and excludes all withheld sources",async()=>{
    fetch.mockImplementation(provider());const c=await kingstonCoverage();expect(c.datasets.filter(d=>d.status==="verified")).toHaveLength(24);expect(c.withheld).toHaveLength(9);expect(c.complete).toBe(false);expect(bytes).toHaveBeenCalledTimes(1);const urls=fetch.mock.calls.map(([u])=>u.href);expect(c.withheld.every(f=>f.records===null&&!urls.some(u=>u.includes(f.item)))).toBe(true);
    const m=ontarioMarketRoadmap().municipalities.find(m=>m.city==="Kingston")!;expect(m.configuredLayers).toContain("zoning");expect(m.withheldLayers.some(f=>f.layer==="additionalUnitOverlays")).toBe(true);expect(m.complete).toBe(false);
    fetch.mockImplementation(provider({}, {count:{count:-1}}));expect((await kingstonCoverage()).datasets.every(d=>d.records===null&&d.status==="unavailable")).toBe(true);
  });
  it("writes source-specific report summaries and document requests instead of nearby/quarterly claims",async()=>{
    fetch.mockImplementation(provider({permits:[record(feed("permits"),{ADDRESS:"216 ONTARIO ST"})],planningApplications:[record(feed("planningApplications"),{ADDR_FULL:"216 ONTARIO ST"})],holding:[record(feed("holding"))],landUse:[record(feed("landUse"))]}));const r=await kingstonLayers("216 Ontario St","Kingston","ON",location),brief=preShowingBrief(r,[]);expect(brief.findings.find(f=>f.layer==="planningApplications")?.summary).toContain("exact civic");expect(brief.findings.find(f=>f.layer==="planningApplications")?.summary).not.toContain("quarterly");expect(brief.documentsToRequest.some(d=>d.evidenceLayers.includes("officialPlan"))).toBe(true);
  });
});
