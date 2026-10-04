import { beforeEach, describe, expect, it, vi } from "vitest";
import { durhamCoverage, durhamLayers, durhamLocation, durhamMunicipality } from "./durham";
import { DURHAM_ADDRESS, DURHAM_BOUNDARY, DURHAM_FEEDS, DURHAM_PLANNING } from "./durham-sources";
import { validMunicipalItem, type MunicipalFeed } from "./ontario-municipal-sources";
import { municipalPointLayer } from "./ontario-municipal";
import { preShowingBrief } from "./brief";
import type { Location, Row } from "./model";
const fetch=vi.hoisted(()=>vi.fn());
const nar=vi.hoisted(()=>vi.fn());
vi.mock("./national",()=>({nationalAddress:nar}));
vi.mock("./http",async()=>({...await vi.importActual<typeof import("./http")>("./http"),fetchJson:fetch}));
const whitby:Location={address:"575 Rossland Road East",city:"Whitby",province:"ON",latitude:43.8974,longitude:-78.9434,accuracy:"source_civic_address_point",provider:"test"};
function item(f:MunicipalFeed):Row {return {access:"public",owner:f.owner,orgId:f.org,url:f.url.replace(/\/\d+$/,""),licenseInfo:`<a href='${f.licenceAnchors[0]}'>Licence</a>`};}
function record(f:MunicipalFeed,attributes:Row={},geometry={x:whitby.longitude,y:whitby.latitude}) {return {attributes:{...Object.fromEntries(Object.keys(f.fields).map(k=>[k,null])),[f.oid]:1,...attributes},geometry};}
const civic=(changes:Row={},g?:{x:number;y:number})=>record(DURHAM_ADDRESS,{CIVIC_NUM:"575",ROAD_NAME:"Rossland",ROAD_TYPE:"Road",ROAD_DIR:"East",TOWN:"Whitby",MUNICIPALITY:"Whitby",UNIT:"N",...changes},g);
function provider(records:Record<string,unknown[]>={},changed:Record<string,Row>={}) {
  return async(u:URL)=>{
    const f=u.pathname.includes('/sharing/')?DURHAM_FEEDS.find(f=>u.pathname.endsWith(f.item)):DURHAM_FEEDS.find(f=>u.href.split('?')[0]===f.url || u.href.split('?')[0]===f.url+'/query');
    if(!f)throw new Error("Unexpected source");
    if(u.pathname.includes('/sharing/'))return changed.item??item(f);
    if(!u.pathname.endsWith('/query'))return {...{name:f.expectedLayerName,geometryType:f.geometry,fields:Object.keys(f.fields).map(name=>({name,type:name===f.oid?"esriFieldTypeOID":"esriFieldTypeString"}))},...changed.metadata};
    if(u.searchParams.get('returnCountOnly')==='true')return {count:10};
    return {features:records[f.key]??[],...changed[f.key]};
  };
}
beforeEach(()=>{fetch.mockReset();nar.mockReset().mockResolvedValue(null);});
describe("Durham regional evidence",()=>{
  it("binds the exact publisher, licensed root service and named child schema",async()=>{
    const f=DURHAM_PLANNING[0];expect(validMunicipalItem(item(f),f)).toBe(true);
    for(const changes of [{owner:"copy"},{orgId:"other"},{url:f.url.replace("Map1","Map2")},{licenseInfo:""},{access:"private"}])expect(validMunicipalItem({...item(f),...changes},f)).toBe(false);
    fetch.mockImplementation(provider({}, {metadata:{name:"Map 1 - Different Layer"}}));expect((await municipalPointLayer(f,whitby)).status).toBe("unavailable");expect(fetch.mock.calls.some(([u])=>u.pathname.endsWith('/query'))).toBe(false);
  });
  it("matches full civic suffix and direction within the requested municipality",async()=>{
    fetch.mockImplementation(provider({addresses:[civic({CIVIC_SFX:"A"}),civic({OBJECTID:2,CIVIC_SFX:"A",UNIT:"Y",UNIT_NUM:"2"})]}));
    expect(await durhamLocation({address:"575 Rossland Rd E, Whitby, ON"})).toBeNull();
    const r=await durhamLocation({address:"575A Rossland Rd E, Whitby, ON"});expect(r?.status).toBe("available");expect(r?.data?.address).toBe("575A Rossland Road East");expect(r?.data?.municipalAddress?.recordIds).toEqual(["1","2"]);
    expect(await durhamLocation({address:"575A Rossland Rd W, Whitby, ON"})).toBeNull();
    expect(await durhamLocation({address:"575A Rossland Rd E, Ajax, ON"})).toBeNull();
    expect(fetch.mock.calls.some(([u])=>u.searchParams.get('where')?.includes("MUNICIPALITY = 'Whitby'"))).toBe(true);
  });
  it("does not accept surrounding municipalities or select among differing communities and points",async()=>{
    fetch.mockImplementation(provider({addresses:[civic({MUNICIPALITY:"Toronto"})]}));expect(await durhamLocation({address:"575 Rossland Rd E, Whitby, ON"})).toBeNull();
    fetch.mockImplementation(provider({addresses:[civic(),civic({OBJECTID:2,TOWN:"Brooklin"})]}));expect((await durhamLocation({address:"575 Rossland Rd E, Whitby, ON"}))?.status).toBe("ambiguous");
    fetch.mockImplementation(provider({addresses:[civic(),civic({OBJECTID:2},{x:-78.95,y:43.9})]}));expect((await durhamLocation({address:"575 Rossland Rd E, Whitby, ON"}))?.status).toBe("ambiguous");
  });
  it("requires the published requested community and keeps unit flags and postal codes as civic evidence",async()=>{
    fetch.mockImplementation(provider({addresses:[civic({TOWN:"Brooklin",POSTAL_CODE:"L1M 1A1",UNIT:"Y",UNIT_NUM:"2",EDIT_DATE:1700000000000})]}));
    const r=await durhamLocation({address:"575 Rossland Rd E, Brooklin, ON"});expect(r?.data?.city).toBe("Whitby");expect(r?.data?.municipalAddress?.publishedRecords).toEqual([expect.objectContaining({publishedCommunity:"Brooklin",municipality:"Whitby",publishedUnitFlag:"Y",unit:"2",postalCode:"L1M 1A1",recordModifiedDate:"2023-11-14T22:13:20.000Z"})]);
    fetch.mockImplementation(provider({addresses:[civic()]}));expect(await durhamLocation({address:"575 Rossland Rd E, Brooklin, ON"})).toBeNull();
    expect(durhamMunicipality("Newcastle","ON")).toBe("Clarington");expect(durhamMunicipality("Port Perry","ON")).toBe("Scugog");
  });
  it("rejects incomplete or malformed civic queries before geolocation",async()=>{
    for(const response of [{exceededTransferLimit:true},{features:null},{features:[{attributes:{OBJECTID:2}}]},{features:Array.from({length:501},()=>civic())}]){
      fetch.mockImplementation(provider({addresses:[civic()]},{addresses:response}));expect(await durhamLocation({address:"575 Rossland Rd E, Whitby, ON"})).toBeNull();
    }
    expect(nar).not.toHaveBeenCalled();
  });
  it("requires national building identity, municipality and distance agreement",async()=>{
    fetch.mockImplementation(provider({addresses:[civic()]}));const data={...whitby,accuracy:"source_building_point",addressRegister:{buildingId:"building",publishedAddressRecords:1,postalCodes:[],buildingUsageCodes:[],csduid:null}};
    nar.mockResolvedValue({status:"available",data});expect((await durhamLocation({address:"575 Rossland Rd E, Whitby, ON"}))?.data?.addressRegister?.buildingId).toBe("building");
    for(const changed of [{city:"Ajax"},{longitude:-78.98},{address:"575 Rossland Rd W"},{accuracy:"street_interpolated"}]){
      nar.mockResolvedValue({status:"available",data:{...data,...changed}});expect((await durhamLocation({address:"575 Rossland Rd E, Whitby, ON"}))?.data?.addressRegister).toBeUndefined();
    }
  });
  it("preserves withheld layers with zero record queries and complete visible municipal gaps",async()=>{
    fetch.mockImplementation(provider({municipality:[record(DURHAM_BOUNDARY,{NAME:"Whitby"})],communityArea2024:[record(DURHAM_PLANNING[4],{ROP_Designation:"Community Area"})]}));
    const r=await durhamLayers("Whitby","ON",whitby);expect(r.municipality.status).toBe("available");expect(r.durhamPlanning.status).toBe("available");
    const d=r.durhamPlanning.data as Row;expect(d).toMatchObject({coverageComplete:false,enabledQueryCoverageComplete:true,currentMunicipalAmendmentsVerified:false,fullCurrentOfficialPlanScreenPerformed:false,describedConsolidationDate:"2024-09-03",absenceEstablished:false});
    expect((d.datasets as Record<string,unknown>).naturalHeritageSystem2024).toMatchObject({status:"unavailable",data:null});
    expect(fetch.mock.calls.some(([u])=>DURHAM_PLANNING.filter(f=>f.disabledReason).some(f=>u.href.startsWith(f.url+"/query")))).toBe(false);
    for(const key of ['permits','zoning','heritage','officialPlan','development'])expect(r[key].status).toBe("not_supported");
    const b=preShowingBrief(r,[]);expect(b.coverageGaps).toContainEqual(expect.objectContaining({layer:"durhamPlanning",status:"incomplete"}));expect(b.documentsToRequest.some(d=>d.document.includes('source-protection'))).toBe(true);
  });
  it("stops all plan queries on non-unique or conflicting municipal boundaries",async()=>{
    for(const records of [[record(DURHAM_BOUNDARY,{NAME:"Ajax"})],[record(DURHAM_BOUNDARY,{NAME:"Whitby"}),record(DURHAM_BOUNDARY,{OBJECTID:2,NAME:"Ajax"})]]){
      fetch.mockReset().mockImplementation(provider({municipality:records}));const r=await durhamLayers("Whitby","ON",whitby);expect(r.municipality.status).toBe("ambiguous");expect(r.durhamPlanning.status).toBe("ambiguous");expect(fetch.mock.calls.filter(([u])=>u.pathname.includes('OfficialPlan'))).toHaveLength(0);
    }
  });
  it("distinguishes complete enabled no-match, partial failures and unresolved points",async()=>{
    fetch.mockImplementation(provider({municipality:[record(DURHAM_BOUNDARY,{NAME:"Whitby"})]}));const r=await durhamLayers("Whitby","ON",whitby);expect(r.durhamPlanning.status).toBe("no_match");expect(r.durhamPlanning.data).toMatchObject({absenceEstablished:false,coverageComplete:false,enabledQueryCoverageComplete:true});
    fetch.mockRejectedValue(new Error('offline'));expect((await durhamLayers("Whitby","ON",whitby)).durhamPlanning.status).toBe("unavailable");
    fetch.mockClear();expect((await durhamLayers("Whitby","ON",null)).durhamPlanning.status).toBe("skipped");expect(fetch).not.toHaveBeenCalled();
  });
  it("retains truncated nested results and leaves enabled query coverage incomplete",async()=>{
    const f=DURHAM_PLANNING[8];fetch.mockImplementation(provider({municipality:[record(DURHAM_BOUNDARY,{NAME:"Whitby"})],[f.key]:Array.from({length:51},(_,i)=>record(f,{OBJECTID:i+1,SGRA:"1"}))}));
    const r=await durhamLayers("Whitby","ON",whitby);expect(r.durhamPlanning.data).toMatchObject({enabledQueryCoverageComplete:false,datasets:{[f.key]:{truncated:true,data:{coverageComplete:false,records:expect.arrayContaining([expect.objectContaining({publishedRechargeCode:"1"})])}}}});
  });
  it("does not override the existing Oshawa municipal and CSV adapters",async()=>{
    fetch.mockRejectedValue(new Error('offline'));const r=await durhamLayers("Oshawa","ON",null);expect(Object.keys(r).sort()).toEqual(["durhamPlanning","municipality"]);
  });
  it("counts only eight municipal address values and excludes withheld feeds",async()=>{
    fetch.mockImplementation(provider());const r=await durhamCoverage();expect(r.datasets.filter(d=>d.status==="verified")).toHaveLength(18);expect(r.datasets.filter(d=>d.status==="withheld")).toHaveLength(3);
    expect(fetch.mock.calls.find(([u])=>u.href.startsWith(DURHAM_ADDRESS.url+'/query'))![0].searchParams.get('where')).toBe("MUNICIPALITY IN ('Ajax','Brock','Clarington','Oshawa','Pickering','Scugog','Uxbridge','Whitby')");
    fetch.mockRejectedValue(new Error('offline'));expect((await durhamCoverage()).datasets.some(d=>d.status==="verified")).toBe(false);
  });
  it("gates unknown municipalities, province conflicts, unit requests and supplied coordinates",async()=>{
    expect(durhamMunicipality("Township of Scugog","Ontario")).toBe("Scugog");expect(durhamMunicipality("Durham","ON")).toBeNull();expect(durhamMunicipality("Whitby","BC")).toBeNull();
    for(const request of [{address:"575 Rossland Rd E, Whitby, BC"},{address:"575 Rossland Rd E, Whitby, ON",lat:43.9,lng:-78.94},{address:"Unit 2, 575 Rossland Rd E",city:"Whitby",province:"ON"}])expect(await durhamLocation(request)).toBeNull();
    expect(await durhamLayers("Toronto","ON",whitby)).toEqual({});expect(fetch).not.toHaveBeenCalled();
  });
});
