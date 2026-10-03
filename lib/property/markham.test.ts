import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { markhamCoverage, markhamLayers, markhamLocation, markhamMetadata, markhamMarket } from "./markham";
import { MARKHAM_FEEDS, MARKHAM_TERMS_EPOCH, MARKHAM_TERMS_ITEM, type MarkhamFeed } from "./markham-sources";
import { preShowingBrief } from "./brief";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
import { layer, type Location, type Row } from "./model";
const fetch=vi.hoisted(()=>vi.fn());
const nar=vi.hoisted(()=>vi.fn());
vi.mock("./national",()=>({nationalAddress:nar}));
vi.mock("./http",async()=>({...await vi.importActual<typeof import("./http")>("./http"),fetchJson:fetch}));
const inspectedGrant=readFileSync(new URL("./fixtures/markham-open-data-licence.html",import.meta.url),"utf8");
const feed=(key:string)=>MARKHAM_FEEDS.find(f=>f.key===key)!;
const point={x:-79.31120041575522,y:43.86454064850619};
const location:Location={address:"7 Station Lane",city:"Markham",province:"ON",latitude:point.y,longitude:point.x,accuracy:"source_civic_address_point",provider:"markham:addresses"};
const boundary=layer("available",{records:[{municipality:"Markham"}]},null);
function record(f:MarkhamFeed,a:Row={},g:Row=point) {return {attributes:{...Object.fromEntries(Object.keys(f.fields).map(k=>[k,null])),OBJECTID:1,...a},geometry:g};}
const civic=(a:Row={},g?:Row)=>record(feed("addresses"),{ADDRESS:"7",STREET:"STATION",TYPE:"LANE",FULL_ADDRESS:"7 STATION LANE",FULL_STREET_NAME:"STATION LANE",MUNICIPALITY:"MARKHAM",ADDRPTID:1020355,...a},g);
function provider(records:Record<string,unknown[]>={},changes:Record<string,Row|undefined>={}) {
  return async(u:URL)=>{
    if(u.pathname.endsWith(MARKHAM_TERMS_ITEM))return {...MARKHAM_TERMS_EPOCH,...changes.licence};
    if(u.pathname.endsWith(MARKHAM_TERMS_ITEM+"/data"))return {values:{layout:{sections:[{rows:[{cards:[{component:{settings:{markdown:inspectedGrant}}}]}]}]}},...changes.grant};
    const f=u.pathname.includes("/sharing/")?MARKHAM_FEEDS.find(f=>u.pathname.endsWith(f.item)):MARKHAM_FEEDS.find(f=>u.href.split("?")[0]===f.url||u.href.split("?")[0]===f.url+"/query");if(!f)throw new Error("Unexpected provider");
    if(u.pathname.includes("/sharing/"))return {access:"public",owner:f.owner,orgId:f.org,url:f.rootUrl,title:f.expectedItemTitle,licenseInfo:`This work is licensed under&nbsp;<a href="${f.licenceAnchors[0]}">The City of Markham's Terms of Use</a>`,...changes.item};
    if(!u.pathname.endsWith("/query"))return {name:f.expectedLayerName,geometryType:f.geometry,copyrightText:"",fields:Object.entries(f.fieldTypes).map(([name,type])=>({name,type})),...changes.metadata};
    if(u.searchParams.get("returnCountOnly")==="true")return {count:10,...changes.count};
    return {features:records[f.key]??[],...changes[f.key]};
  };
}
beforeEach(()=>{fetch.mockReset();nar.mockReset().mockResolvedValue(null);});
describe("Markham municipal property research",()=>{
  it("pins the inspected terms grant, explicit dataset referral, public publisher, full root and named typed child before records",async()=>{
    const f=feed("secondaryPlans");fetch.mockImplementation(provider());await expect(markhamMetadata(f)).resolves.toEqual({sourceUpdatedAt:null});
    for(const change of [{licence:{modified:1}},{licence:{owner:"other"}},{licence:{access:"private"}},{grant:{values:{}}},{item:{owner:"copy"}},{item:{orgId:"other"}},{item:{licenseInfo:"public access"}},{item:{url:f.url}},{item:{licenseInfo:`This work is licensed under <a href="https://other.example/terms">The City of Markham's Terms of Use</a>`}},{metadata:{name:"Other plan"}},{metadata:{copyrightText:"Teranet"}},{metadata:{fields:Object.entries(f.fieldTypes).map(([name,type])=>({name,type:name==="STATUS"?"esriFieldTypeInteger":type}))}}]){
      fetch.mockClear().mockImplementation(provider({},change));await expect(markhamMetadata(f)).rejects.toThrow();expect(fetch.mock.calls.some(([u])=>u.pathname.endsWith("/query"))).toBe(false);
    }
  });
  it("matches suffixes, directions and types using both published civic fields without attaching unrelated records",async()=>{
    fetch.mockImplementation(provider({addresses:[civic()]}));expect((await markhamLocation({address:"7 Station Lane, Markham, ON"}))?.data?.municipalAddress?.recordIds).toEqual(["1"]);
    for(const address of ["7A Station Lane","7 Station Lane W","7 Station Road"]){expect(await markhamLocation({address:address+", Markham, ON"})).toBeNull();}
    fetch.mockImplementation(provider({addresses:[civic({FULL_STREET_NAME:"OTHER LANE"})]}));expect(await markhamLocation({address:"7 Station Lane, Markham, ON"})).toBeNull();
    fetch.mockImplementation(provider({addresses:[civic({ADDRESS:"8",FULL_ADDRESS:"8 CACHET PKY",FULL_STREET_NAME:"CACHET PKY"})]}));expect((await markhamLocation({address:"8 Cachet Parkway, Markham, ON"}))?.status).toBe("available");expect(await markhamLocation({address:"8 Cachet Parkway W, Markham, ON"})).toBeNull();
  });
  it("keeps Unionville community identity and city conflicts explicit without assigning Thornhill to one municipality",async()=>{
    fetch.mockImplementation(provider({addresses:[civic({MUNICIPALITY:"UNIONVILLE"})]}));expect((await markhamLocation({address:"7 Station Lane, Unionville, ON"}))?.data?.city).toBe("Markham");
    fetch.mockImplementation(provider({addresses:[civic()]}));expect(await markhamLocation({address:"7 Station Lane, Unionville, ON"})).toBeNull();expect(await markhamLocation({address:"7 Station Lane, Unionville, ON",city:"Markham"})).toBeNull();
    expect((await markhamLocation({address:"7 Station Lane, Vaughan, ON",city:"Markham"}))?.status).toBe("ambiguous");expect((await markhamLocation({address:"7 Station Lane, Thornhill, ON",city:"Markham"}))?.status).toBe("ambiguous");
    expect(markhamMarket("Thornhill","ON")).toBe(false);expect(markhamMarket("Markham","BC")).toBe(false);expect(await markhamLocation({address:"Unit 2, 7 Station Lane, Markham, ON"})).toBeNull();
  });
  it("rejects unusable, distant, mixed-community and truncated civic candidates",async()=>{
    for(const values of [[civic({}, {})],[civic(),civic({OBJECTID:2},{x:-79.4,y:43.87})],[civic(),civic({OBJECTID:2,MUNICIPALITY:"UNIONVILLE"})]]){fetch.mockImplementation(provider({addresses:values}));expect((await markhamLocation({address:"7 Station Lane, Markham, ON"}))?.status).toBe("ambiguous");}
    for(const change of [{exceededTransferLimit:true},{features:null},{features:[{attributes:{OBJECTID:1}}]},{features:Array.from({length:501},()=>civic())}]){fetch.mockImplementation(provider({addresses:[civic()]},{addresses:change}));expect(await markhamLocation({address:"7 Station Lane, Markham, ON"})).toBeNull();}
  });
  it("retains national building provenance only with exact identity, municipality, precision and point agreement",async()=>{
    fetch.mockImplementation(provider({addresses:[civic()]}));const data={...location,accuracy:"source_building_point",addressRegister:{buildingId:"building",publishedAddressRecords:1,postalCodes:[],buildingUsageCodes:[],csduid:null}};
    nar.mockResolvedValue({status:"available",data});expect((await markhamLocation({address:"7 Station Lane, Markham, ON"}))?.data?.addressRegister?.buildingId).toBe("building");
    for(const change of [{city:"Vaughan"},{address:"7 Station Rd"},{longitude:-79.4},{accuracy:"street_interpolated"}]){nar.mockResolvedValue({status:"available",data:{...data,...change}});expect((await markhamLocation({address:"7 Station Lane, Markham, ON"}))?.data?.addressRegister).toBeUndefined();}
  });
  it("requires a precise point and unique Markham boundary before all municipal polygon queries",async()=>{
    for(const b of [undefined,layer("unavailable",null,null),layer("available",{records:[{municipality:"Vaughan"}]},null),layer("available",{records:[{municipality:"Markham"},{municipality:"Markham"}]},null)]){fetch.mockClear().mockImplementation(provider());const r=await markhamLayers("Markham","ON",location,b);expect(r.secondaryPlans.status).toBe("skipped");expect(fetch).not.toHaveBeenCalled();}
    fetch.mockClear();expect((await markhamLayers("Markham","ON",{...location,accuracy:"street_interpolated"},boundary)).heritageDistrict.status).toBe("skipped");expect(fetch).not.toHaveBeenCalled();expect(await markhamLayers("Vaughan","ON",location,boundary)).toEqual({});
  });
  it("preserves statutory and non-statutory classifications, raw charge status, areas and unknown source dates without inferring fees or policy",async()=>{
    fetch.mockImplementation(provider({heritageDistrict:[record(feed("heritageDistrict"),{NAME:"Unionville",DIST_ID:1})],secondaryPlans:[record(feed("secondaryPlans"),{SEC_PLAN_N:"PD1-12",SEC_PLAN_1:"Unionville Core",STATUS:"Statutory",ACRES:44.13,HECTARES:17.86}),record(feed("secondaryPlans"),{OBJECTID:2,STATUS:"Non-Statutory"})],developmentChargeAreas:[record(feed("developmentChargeAreas"),{NAME:"Cathedral",ASDC_ID:"46",STATUS:" Areas with Proposed Charge",ACRES:795.53,HECTARES:321.94,OWNER:"PRIVATE"})]}));
    const r=await markhamLayers("Markham","ON",location,boundary);
    expect(r.secondaryPlans.data).toMatchObject({inForcePolicyEstablished:false,currentPlanScreenPerformed:false,currentAppealsVerified:false,coverageComplete:false,queryCoverageComplete:true,records:[expect.objectContaining({publishedStatus:"Statutory",publishedPolygonHectares:17.86}),expect.objectContaining({publishedStatus:"Non-Statutory"})]});
    expect(r.developmentChargeAreas.data).toMatchObject({feesCalculated:false,paymentOrExemptionEstablished:false,currentRatesVerified:false,currentServicingEstablished:false,records:[expect.objectContaining({publishedAreaCode:"46",publishedStatus:" Areas with Proposed Charge"})]});expect(JSON.stringify(r)).not.toContain("PRIVATE");expect(r.secondaryPlans.sourceUpdatedAt).toBeNull();expect(r.heritageDistrict.data).toMatchObject({fullHeritageScreenPerformed:false,individualRegisterSearched:false});
    expect(r.heritage.status).toBe("unavailable");expect(r.zoning.status).toBe("unavailable");for(const k of ["permits","officialPlan","planningApplications","development"])expect(r[k].status).toBe("not_supported");
    const brief=preShowingBrief(r,[]);expect(brief.findings.find(x=>x.layer==="developmentChargeAreas")?.summary).toContain("fees");expect(brief.documentsToRequest.some(d=>d.evidenceLayers.includes("secondaryPlans"))).toBe(true);
  });
  it("retains null and blank attributes, fails on malformed typed records, and marks empty queries without claiming absence",async()=>{
    fetch.mockImplementation(provider({secondaryPlans:[record(feed("secondaryPlans"),{STATUS:null,SEC_PLAN_1:" "})]}));let r=await markhamLayers("Markham","ON",location,boundary);expect((r.secondaryPlans.data as {records:Row[]}).records[0]).toMatchObject({publishedStatus:null,publishedPlanName:" "});
    fetch.mockImplementation(provider({secondaryPlans:[record(feed("secondaryPlans"),{HECTARES:"bad"})]}));r=await markhamLayers("Markham","ON",location,boundary);expect(r.secondaryPlans.status).toBe("unavailable");
    fetch.mockImplementation(provider());r=await markhamLayers("Markham","ON",location,boundary);expect(r.secondaryPlans.status).toBe("no_match");expect(r.secondaryPlans.data).toMatchObject({absenceEstablished:false,coverageComplete:false,queryCoverageComplete:true});
  });
  it("marks bounded partial results and fails closed on incomplete empty queries and upstream errors",async()=>{
    fetch.mockImplementation(provider({secondaryPlans:Array.from({length:51},(_,i)=>record(feed("secondaryPlans"),{OBJECTID:i+1}))}));let r=await markhamLayers("Markham","ON",location,boundary);expect(r.secondaryPlans.truncated).toBe(true);expect(r.secondaryPlans.data).toMatchObject({queryCoverageComplete:false});expect((r.secondaryPlans.data as {records:Row[]}).records).toHaveLength(50);
    fetch.mockImplementation(provider({}, {secondaryPlans:{exceededTransferLimit:true}}));r=await markhamLayers("Markham","ON",location,boundary);expect(r.secondaryPlans.status).toBe("unavailable");
    fetch.mockRejectedValue(new Error("timeout"));r=await markhamLayers("Markham","ON",location,boundary);expect(r.heritageDistrict.status).toBe("unavailable");
  });
  it("counts only four pinned feeds, queries no withheld source and keeps the market incomplete",async()=>{
    fetch.mockImplementation(provider());const c=await markhamCoverage();expect(c.datasets.filter(d=>d.status==="verified")).toHaveLength(4);expect(c.withheld).toHaveLength(3);expect(c.complete).toBe(false);expect(c.withheld.every(d=>d.records===null)).toBe(true);
    const urls=fetch.mock.calls.map(([u])=>u.href);expect(c.withheld.every(f=>!urls.some(u=>u.includes(f.item)))).toBe(true);
    const m=ontarioMarketRoadmap().municipalities.find(m=>m.city==="Markham")!;expect(m.configuredLayers).toContain("secondaryPlans");expect(m.withheldLayers.some(f=>f.layer==="zoning")).toBe(true);expect(m.complete).toBe(false);
    fetch.mockImplementation(provider({}, {count:{count:-1}}));expect((await markhamCoverage()).datasets.every(d=>d.status==="unavailable"&&d.records===null)).toBe(true);
  });
});
