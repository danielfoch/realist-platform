import { beforeEach, describe, expect, it, vi } from "vitest";
import { ONTARIO_MUNICIPAL, validMunicipalItem, type MunicipalFeed } from "./ontario-municipal-sources";
import { municipalPointLayer, ontarioMunicipalLayers, ontarioMunicipalLocation, ontarioMunicipalCoverage, ontarioMarket } from "./ontario-municipal";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
import type { Location, Row } from "./model";
const fetch = vi.hoisted(()=>vi.fn());
vi.mock("./http",async()=>({ ...await vi.importActual<typeof import("./http")>("./http"),fetchJson:fetch }));
const feed=(market:string,key:string)=>ONTARIO_MUNICIPAL.find(f=>f.market===market&&f.key===key)!;
function item(f:MunicipalFeed):Row { return { access:"public",owner:f.owner,orgId:f.org,url:f.market==="Mississauga"?f.url.replace(/\/\d+$/,""):f.url,licenseInfo:`<a href='${f.licenceAnchors[0]}'>Terms of Use</a>` }; }
function record(f:MunicipalFeed,a:Row={},point={x:-81.2393,y:42.99315}) {return {attributes:{ ...Object.fromEntries(Object.keys(f.fields).map(k=>[k,null])),[f.oid]:1,...a },geometry:point};}
function provider(f:MunicipalFeed,records:unknown[],options:{ item?:Row; truncated?:boolean; fields?:Row[] }={}) {
  return async(u:URL)=>{
    if(u.pathname.includes('/sharing/'))return options.item ?? item(f);
    if(!u.pathname.endsWith('/query'))return {geometryType:f.geometry,fields:options.fields ?? Object.keys(f.fields).map(name=>({name,type:name===f.oid?"esriFieldTypeOID":"esriFieldTypeString"})),editingInfo:{dataLastEditDate:1700000000000}};
    if(u.searchParams.get('returnCountOnly')==='true')return {count:100};
    return { features:records,exceededTransferLimit:options.truncated ?? false };
  };
}
const london:Location={address:"481 Ridout St N",city:"London",province:"ON",latitude:42.99315,longitude:-81.2393,accuracy:"source_civic_address_point",provider:"test"};
beforeEach(()=>{fetch.mockReset();});
describe("Ontario municipal evidence",()=>{
  it("requires the exact public publisher, endpoint and reuse licence",()=>{
    const f=feed("Mississauga","permits");expect(validMunicipalItem(item(f),f)).toBe(true);
    for(const change of [{owner:"thirdparty"},{orgId:"other"},{access:"private"},{url:"https://example.com/data"},{licenseInfo:""},{licenseInfo:item(f).licenseInfo+" GIS data may not be copied without written consent"}])expect(validMunicipalItem({...item(f),...change},f)).toBe(false);
    const h=feed("Mississauga","heritage");expect(validMunicipalItem({...item(h),licenseInfo:`<a href='${h.licenceAnchors[1]}?X-Amz-Signature=expired'>Terms</a>`},h)).toBe(true);
  });
  it("matches Mississauga FULLNAME as a full civic address, keeping unit scope at building level",async()=>{
    const f=feed("Mississauga","addresses");fetch.mockImplementation(provider(f,[record(f,{STNO:"280",FULLNAME:"280 LAKESHORE RD E",UNIT_NO:null},{x:-79.5762,y:43.5608}),record(f,{STNO:"280",FULLNAME:"280 LAKESHORE RD E",UNIT_NO:"2"},{x:-79.5762,y:43.5608})]));
    const r=await ontarioMunicipalLocation({address:"280 Lakeshore Road East, Mississauga, ON"});expect(r?.status).toBe("available");expect(r?.data?.address).toBe("280 LAKESHORE RD E");expect(r?.data?.municipalAddress?.recordIds).toHaveLength(2);
    expect(fetch.mock.calls.at(-1)![0].searchParams.get('where')).toContain("280 LAKESHORE RD E");
  });
  it("rejects the wrong street direction and unit-specific requests",async()=>{
    const f=feed("London","addresses");fetch.mockImplementation(provider(f,[record(f,{FullNumber:"481",FullStreetName:"Ridout St S",Status:"IA"})]));
    expect(await ontarioMunicipalLocation({address:"481 Ridout St N, London, ON"})).toBeNull();
    fetch.mockClear();expect(await ontarioMunicipalLocation({address:"Unit 2, 481 Ridout St N",city:"London",province:"ON"})).toBeNull();expect(fetch).not.toHaveBeenCalled();
  });
  it("excludes proposed London addresses and preserves point ambiguity",async()=>{
    const f=feed("London","addresses");fetch.mockImplementation(provider(f,[record(f,{FullNumber:"481",FullStreetName:"Ridout St N",Status:"PA"})]));expect(await ontarioMunicipalLocation({address:"481 Ridout St N, London, ON"})).toBeNull();
    fetch.mockImplementation(provider(f,[record(f,{FullNumber:"481",FullStreetName:"Ridout St N",Status:"IA"}),record(f,{OBJECTID:2,FullNumber:"481",FullStreetName:"Ridout St N",Status:"IU",UnitNumber:"2"},{x:-81.25,y:42.99315})]));expect((await ontarioMunicipalLocation({address:"481 Ridout St N, London, ON"}))?.status).toBe("ambiguous");
  });
  it("does not select a point from incomplete address candidates",async()=>{
    const f=feed("London","addresses");fetch.mockImplementation(provider(f,[record(f,{FullNumber:"481",FullStreetName:"Ridout St N",Status:"IA"})],{truncated:true}));expect(await ontarioMunicipalLocation({address:"481 Ridout St N, London, ON"})).toBeNull();
  });
  it("accepts official Ottawa former communities and rejects a conflicting requested community",async()=>{
    const f=feed("Ottawa","addresses");fetch.mockImplementation(provider(f,[record(f,{ADDRNUM:150,FULL_ROADNAME_EN:"Donald St",MUNICIPALITY:"Old Ottawa",CP_MUNICIPALITY:"OTTAWA",ADDRTYPE:"Main"},{x:-75.6624,y:45.4271})]));
    expect((await ontarioMunicipalLocation({address:"150 Donald St, Ottawa, ON"}))?.status).toBe("available");expect(await ontarioMunicipalLocation({address:"150 Donald St, Kanata, ON"})).toBeNull();
  });
  it("preserves published London year-built text and designation part",async()=>{
    const f=feed("London","heritage");fetch.mockImplementation(provider(f,[record(f,{Status:"Listed Heritage Property",YearBuilt:"c. 1880-1890",DesignationPart:"V"})]));const r=await municipalPointLayer(f,london);expect(r.status).toBe("available");expect((r.data as Row).records).toEqual([expect.objectContaining({publishedYearBuiltText:"c. 1880-1890",designationPart:"V"})]);expect(r.note).toContain("approximate or a range");
  });
  it("fails closed on revoked licence and schema changes before querying records",async()=>{
    const f=feed("London","heritage");fetch.mockImplementation(provider(f,[],{item:{...item(f),licenseInfo:""}}));expect((await municipalPointLayer(f,london)).status).toBe("unavailable");expect(fetch.mock.calls.some(c=>(c[0] as URL).pathname.endsWith('/query'))).toBe(false);
    fetch.mockReset();fetch.mockImplementation(provider(f,[],{fields:[{name:"OBJECTID",type:"esriFieldTypeOID"}]}));expect((await municipalPointLayer(f,london)).status).toBe("unavailable");
  });
  it("keeps historical Mississauga plan status separate from current policy",async()=>{
    const f=feed("Mississauga","historicalOfficialPlan2010");fetch.mockImplementation(provider(f,[record(f,{MOP_CODE:"RLD",MOP_DESCRIPTION:"Residential Low Density"})]));const r=await municipalPointLayer(f,{...london,city:"Mississauga",latitude:43.56,longitude:-79.58});expect(r.data).toMatchObject({historical:true,currentPlanScreenPerformed:false,planRepealedDate:"2026-03-24"});expect(r.note).toContain("repealed");
  });
  it("does zero upstream calls for explicitly withheld feeds or imprecise points",async()=>{
    const f=feed("Mississauga","zoning");expect((await municipalPointLayer(f,london)).status).toBe("unavailable");expect(fetch).not.toHaveBeenCalled();
    expect((await municipalPointLayer(feed("London","heritage"),{...london,accuracy:"street_interpolated"})).status).toBe("skipped");expect(fetch).not.toHaveBeenCalled();
  });
  it("retains bounded results and flags incomplete coverage",async()=>{
    const f=feed("London","heritage");fetch.mockImplementation(provider(f,Array.from({length:51},(_,i)=>record(f,{OBJECTID:i+1})),{truncated:true}));const r=await municipalPointLayer(f,london);expect(r.truncated).toBe(true);expect(r.data).toMatchObject({coverageComplete:false});expect((r.data as Row).records).toHaveLength(50);
  });
  it("distinguishes an empty screen from an outage",async()=>{
    const f=feed("London","heritage");fetch.mockImplementation(provider(f,[]));const r=await municipalPointLayer(f,london);expect(r.status).toBe("no_match");expect(r.data).toMatchObject({absenceEstablished:false});fetch.mockRejectedValue(new Error("offline"));expect((await municipalPointLayer(f,london)).status).toBe("unavailable");
  });
  it("keeps permit dates, CAD construction estimates and unit identifiers",async()=>{
    const f=feed("Mississauga","permits");fetch.mockImplementation(async(u:URL)=>{if(u.pathname.startsWith(new URL(f.url).pathname)||u.pathname.includes(f.item))return provider(f,[record(f,{ADDRESS:"1416 LIVEOAK DR",BP_NO:"BP 9ALT 17-8956",EST_CON_VALUE:38000,UNIT_NO:"2",ISSUE_DATE:1514851200000})])(u);throw new Error("other feeds unavailable");});
    const r=(await ontarioMunicipalLayers("1416 Liveoak Dr","Mississauga","ON",null)).permits;expect(r.status).toBe("available");expect(r.data).toMatchObject({currency:"CAD",scope:"building_level",records:[expect.objectContaining({issuedDate:"2018-01-02T00:00:00.000Z",estimatedConstructionValueCAD:38000,unit:"2"})]});
  });
  it("preserves generalized-land-use and detailed-zoning gaps",async()=>{
    fetch.mockRejectedValue(new Error("offline"));const r=await ontarioMunicipalLayers(london.address,"London","ON",london);expect(r.zoning.status).toBe("not_supported");expect(r.permits.status).toBe("not_supported");expect(ontarioMarket("London","BC")).toBeNull();expect(await ontarioMunicipalLayers(null,"Calgary","AB",null)).toEqual({});
  });
  it("never counts withheld or failed feeds as verified coverage",async()=>{
    fetch.mockRejectedValue(new Error("offline"));const c=await ontarioMunicipalCoverage();expect(c.filter(x=>x.layer==="zoning")[0]).toMatchObject({status:"withheld",records:null});expect(c.filter(x=>x.status==="verified")).toHaveLength(0);
  });
  it("keeps all 16 Ontario metropolitan anchors and regional priorities open",()=>{
    const r=ontarioMarketRoadmap();expect(r.metropolitanMarkets).toHaveLength(16);expect(r.majorMarketsComplete).toBe(false);expect(r.municipalities.some(x=>x.city==="Thunder Bay")).toBe(true);expect(r.municipalities.some(x=>x.city==="Mississauga" && x.stage==="partial_municipal_coverage")).toBe(true);expect(r.municipalities.some(x=>x.complete)).toBe(false);
  });
});
