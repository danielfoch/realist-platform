import { beforeEach, describe, expect, it, vi } from "vitest";
import { haltonAddressEvidence, haltonCoverage, haltonLayers, haltonLocation, haltonMarket } from "./halton";
import { HALTON_FEEDS } from "./halton-sources";
import { validMunicipalItem, type MunicipalFeed } from "./ontario-municipal-sources";
import { preShowingBrief } from "./brief";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
import type { Location, Row } from "./model";
const fetch=vi.hoisted(()=>vi.fn());
const nar=vi.hoisted(()=>vi.fn());
vi.mock("./national",()=>({nationalAddress:nar}));
vi.mock("./http",async()=>({...await vi.importActual<typeof import("./http")>("./http"),fetchJson:fetch}));
const mil:Location={address:"99 Mill Street",city:"Milton",province:"ON",latitude:43.5115148,longitude:-79.8868182,accuracy:"source_civic_address_point",provider:"test"};
const feed=(market:string,key:string)=>HALTON_FEEDS.find(f=>f.market===market&&f.key===key)!;
const item=(f:MunicipalFeed)=>({access:"public",owner:f.owner,orgId:f.org,url:f.url.replace(/\/\d+$/,""),licenseInfo:`<a href='${f.licenceAnchors[0]}'>Licence</a>`});
function record(f:MunicipalFeed,a:Row={},g={x:mil.longitude,y:mil.latitude}){return {attributes:{...Object.fromEntries(Object.keys(f.fields).map(k=>[k,null])),[f.oid]:1,...a},geometry:g};}
const civic=(a:Row={},g?:{x:number;y:number})=>record(feed("Milton","addresses"),{ADDRESS_NUM:99,GEOSTNAME:"MILL",STREET_TYPE:"STREET",...a},g);
function provider(records:Record<string,unknown[]>={},changed:Record<string,Row>={}) {
  return async(u:URL)=>{
    const f=u.pathname.includes('/sharing/')?HALTON_FEEDS.find(f=>u.pathname.endsWith(f.item)):HALTON_FEEDS.find(f=>u.href.split('?')[0]===f.url||u.href.split('?')[0]===f.url+'/query');
    if(!f)throw new Error("Unexpected source");
    if(u.pathname.includes('/sharing/'))return {...item(f),...changed.item};
    if(!u.pathname.endsWith('/query'))return {name:f.expectedLayerName,geometryType:f.geometry,fields:Object.keys(f.fields).map(name=>({name,type:name===f.oid?"esriFieldTypeOID":"esriFieldTypeString"})),...changed.metadata};
    if(u.searchParams.get('returnCountOnly')==='true')return {count:10,...changed.count};
    return {features:records[f.source.id]??[],...changed[f.source.id]};
  };
}
beforeEach(()=>{fetch.mockReset();nar.mockReset().mockResolvedValue(null);});
describe("Halton municipal evidence",()=>{
  it("pins exact publishers, endpoints, licences and named child schemas",async()=>{
    const f=feed("Milton","urbanZoning");expect(validMunicipalItem(item(f),f)).toBe(true);
    for(const change of [{owner:"copy"},{orgId:"wrong"},{access:"private"},{url:f.url.replace("UrbanZoning","Other")},{licenseInfo:""},{licenseInfo:"Internal use only"}])expect(validMunicipalItem({...item(f),...change},f)).toBe(false);
    fetch.mockImplementation(provider({}, {metadata:{name:"Different zoning"}}));expect((await haltonLayers(mil.address,"Milton","ON",mil)).zoning.status).toBe("unavailable");expect(fetch.mock.calls.some(([u])=>u.pathname.endsWith('/query'))).toBe(false);
  });
  it("matches civic types and directions and preserves ADU/unit flags without asserting legality",async()=>{
    fetch.mockImplementation(provider({"milton:addresses":[civic({ST_DIR_SUFFIX:"E",ADU:"Y",ADU_UNIT_NO:"2"}),civic({OBJECTID:2,ST_DIR_SUFFIX:"E",UNIT_NUMBER:"2"})]}));
    const r=await haltonLocation({address:"99 Mill St E, Milton, ON"});expect(r?.status).toBe("available");expect(r?.data?.municipalAddress).toMatchObject({recordIds:["1","2"],publishedRecords:[expect.objectContaining({publishedAdditionalUnitFlag:"Y",publishedAdditionalUnitNumber:"2"}),expect.objectContaining({unit:"2"})]});
    expect(await haltonLocation({address:"99 Mill Rd E, Milton, ON"})).toBeNull();expect(await haltonLocation({address:"99 Mill St W, Milton, ON"})).toBeNull();expect(await haltonLocation({address:"99A Mill St E, Milton, ON"})).toBeNull();
  });
  it("requires active Burlington civic rows with the correct city and province",async()=>{
    const f=feed("Burlington","addresses"),a={HOUSENUM:"426",STREET:"BRANT",STRTYPE:"ST.",PROPSTATUSDESC:"Active",CITY:"Burlington",PROVINCE:"Ontario"},g={x:-79.7986,y:43.3258};
    fetch.mockImplementation(provider({"burlington:addresses":[record(f,a,g)]}));expect((await haltonLocation({address:"426 Brant St, Burlington, ON"}))?.data?.city).toBe("Burlington");
    for(const change of [{PROPSTATUSDESC:"Inactive"},{CITY:"Hamilton"},{PROVINCE:"BC"}]){fetch.mockImplementation(provider({"burlington:addresses":[record(f,{...a,...change},g)]}));expect(await haltonLocation({address:"426 Brant St, Burlington, ON"})).toBeNull();}
  });
  it("preserves Oakville suffix and published prefixes, allowing unknown city fields but rejecting conflicts",async()=>{
    const f=feed("Oakville","addresses"),a={STREET_NUM:"1225",SUFFIX:"A",STREET_NAME:"TRAFALGAR",STREET_TYPE:"RD"},g={x:-79.6882,y:43.467};
    fetch.mockImplementation(provider({"oakville:addresses":[record(f,a,g)]}));expect((await haltonLocation({address:"1225A Trafalgar Road, Oakville, ON"}))?.status).toBe("available");expect(await haltonLocation({address:"1225 Trafalgar Road, Oakville, ON"})).toBeNull();
    fetch.mockImplementation(provider({"oakville:addresses":[record(f,{...a,CITY:"Milton"},g)]}));expect(await haltonLocation({address:"1225A Trafalgar Rd, Oakville, ON"})).toBeNull();
  });
  it("leaves unusable/shared distant civic points ambiguous and bounds the source candidate set",async()=>{
    fetch.mockImplementation(provider({"milton:addresses":[civic(),civic({OBJECTID:2},{x:-79.89,y:43.51})]}));expect((await haltonLocation({address:"99 Mill St, Milton, ON"}))?.status).toBe("ambiguous");
    for(const response of [{exceededTransferLimit:true},{features:null},{features:[{attributes:{OBJECTID:1}}]},{features:Array.from({length:501},()=>civic())}]){fetch.mockImplementation(provider({"milton:addresses":[civic()]},{"milton:addresses":response}));expect(await haltonLocation({address:"99 Mill St, Milton, ON"})).toBeNull();}
    expect(nar).not.toHaveBeenCalled();
  });
  it("retains national building provenance only with exact city, address and point agreement",async()=>{
    fetch.mockImplementation(provider({"milton:addresses":[civic()]}));const data={...mil,accuracy:"source_building_point",addressRegister:{buildingId:"building",publishedAddressRecords:1,postalCodes:[],buildingUsageCodes:[],csduid:null}};
    nar.mockResolvedValue({status:"available",data});expect((await haltonLocation({address:"99 Mill St, Milton, ON"}))?.data?.addressRegister?.buildingId).toBe("building");
    for(const change of [{city:"Oakville"},{address:"99 Mill Road"},{longitude:-79.9},{accuracy:"street_interpolated"}]){nar.mockResolvedValue({status:"available",data:{...data,...change}});expect((await haltonLocation({address:"99 Mill St, Milton, ON"}))?.data?.addressRegister).toBeUndefined();}
  });
  it("distinguishes Milton listed/designated heritage and keeps unparsed designation-date text",async()=>{
    const f=feed("Milton","heritage");fetch.mockImplementation(provider({[f.source.id]:[record(f,{ADDRESS_NUM:99,STREET_NAME:"MILL STREET",DESIGNATION:"LISTED",BY_LAW:null,DESIGNATION_DATE:"circa 1997"}),record(f,{OBJECTID:2,ADDRESS_NUM:99,STREET_NAME:"MILL ROAD",DESIGNATION:"DESIGNATED"})]}));
    const r=await haltonAddressEvidence(f,mil.address,mil);expect(r.status).toBe("available");expect(r.data).toMatchObject({coverageComplete:false,records:[expect.objectContaining({publishedStatus:"LISTED",bylaw:null,publishedDesignationDateText:"circa 1997",sourcePointSeparationM:0})]});
    fetch.mockImplementation(provider({[f.source.id]:[record(f,{ADDRESS_NUM:99,STREET_NAME:"MILL STREET"},{x:-79.89,y:43.51})]}));expect((await haltonAddressEvidence(f,mil.address,mil)).status).toBe("ambiguous");
  });
  it("retains repeated permit files, raw statuses, real dates and unknown area units",async()=>{
    const f=feed("Oakville","permits"),address="3140 Harasym Trail",a={CUSTOMFOLDERNUMBER:"2022 132737 000 00 RN",FOLDERNAME:address,Status:"Closed",ISSUEDATE:1673568000000,Construction_Value:607600,GFA:283};
    fetch.mockImplementation(provider({[f.source.id]:[record(f,{...a,Status:"Cancelled",ISSUEDATE:null}),record(f,{...a,OBJECTID_1:2}),record(f,{...a,OBJECTID_1:3,FOLDERNAME:"3140 Harasym Rd"})]}));
    const r=await haltonAddressEvidence(f,address,null);expect(r.data).toMatchObject({coverageComplete:false,catalogueAdvertisedScope:"last ten years",grossFloorAreaUnits:null,distinctPermitCount:null,finalInspectionsVerified:false,records:[expect.objectContaining({publishedStatus:"Cancelled",issuedDate:null}),expect.objectContaining({publishedStatus:"Closed",issuedDate:"2023-01-13T00:00:00.000Z",publishedGrossFloorAreaUnknownUnits:283})]});
    expect(fetch.mock.calls.find(([u])=>u.pathname.endsWith('/query'))![0].searchParams.get('where')).toBe("UPPER(FOLDERNAME) LIKE '3140 %'");
  });
  it("leaves empty searches and truncation incomplete without fabricated absence",async()=>{
    const f=feed("Burlington","permits");fetch.mockImplementation(provider());expect((await haltonAddressEvidence(f,"1268 Abbey Court",null)).data).toMatchObject({absenceEstablished:false,coverageComplete:false,records:[]});
    fetch.mockImplementation(provider({[f.source.id]:Array.from({length:51},(_,i)=>record(f,{OBJECTID:i+1,ADDRESS:"1268 ABBEY CRT.   ",ISSUEDATE:null}))}));const r=await haltonAddressEvidence(f,"1268 Abbey Court",null);expect(r.truncated).toBe(true);expect(r.data).toMatchObject({queryCoverageComplete:false,publishedAddressMatchCount:51});expect((r.data as Row).records).toHaveLength(50);
    fetch.mockImplementation(provider({}, {[f.source.id]:{exceededTransferLimit:true}}));expect((await haltonAddressEvidence(f,"1268 Abbey Court",null)).status).toBe("unavailable");
  });
  it("shows incomplete Burlington current zoning and sends zero queries to withheld layers",async()=>{
    const f=feed("Burlington","zoning2020Mapping"),l={...mil,city:"Burlington",longitude:-79.7986,latitude:43.3258};fetch.mockImplementation(provider({[f.source.id]:[record(f,{FULL_ZONING:"R3-344"})]}));
    const r=await haltonLayers("426 Brant Street","Burlington","ON",l);expect(r.zoning.status).toBe("available");expect(r.zoning.data).toMatchObject({coverageComplete:false,fullCurrentZoningScreenPerformed:false,currentResidentialZoningMappingVerified:false,newResidentialBylawEffectiveDate:"2026-03-02",datasets:{residentialZoning2026:{status:"unavailable",data:null}}});
    expect(fetch.mock.calls.some(([u])=>HALTON_FEEDS.filter(f=>f.disabledReason).some(f=>u.href.startsWith(f.url)))).toBe(false);
    const b=preShowingBrief(r,[]);expect(b.findings.find(f=>f.layer==="zoning")?.summary).toContain("Current residential zoning");expect(b.coverageGaps).toContainEqual(expect.objectContaining({layer:"zoning",status:"incomplete"}));
  });
  it("describes Milton planning as subject-point polygons and current plan gaps separately",async()=>{
    const f=feed("Milton","planningApplications");fetch.mockImplementation(provider({[f.source.id]:[record(f,{PLANNINGNU:"24T-05014/M",STATUS:"Assumed",DRAFT_PLAN_APPROVAL_DATE:null})]}));
    const r=await haltonLayers(mil.address,"Milton","ON",mil);expect(r.planningApplications.data).toMatchObject({coverageComplete:false,fullPlanningHistorySearched:false,currentApprovalConditionsVerified:false,appealOutcomesVerified:false});expect(r.officialPlan.data).toMatchObject({formerRegionalPlanBecameMunicipalDate:"2024-07-01",currentPublishedMunicipalConsolidation:"February 2026",currentPlanScreenPerformed:false});expect(r.permits.status).toBe("not_supported");
    const b=preShowingBrief(r,[]);expect(b.findings.find(f=>f.layer==="planningApplications")?.summary).toContain("subject-point records");expect(b.documentsToRequest.some(d=>d.document.includes("former Halton"))).toBe(true);
  });
  it("skips GIS for interpolation or another municipality and makes source failures visible",async()=>{
    fetch.mockImplementation(provider());const r=await haltonLayers(mil.address,"Milton","ON",{...mil,accuracy:"street_interpolated"});expect((r.zoning.data as Row).datasets).toMatchObject({urbanZoning:{status:"skipped"},ruralZoning:{status:"skipped"}});
    fetch.mockClear();const conflict=await haltonLayers("99 Mill Street","Oakville","ON",{...mil,city:"Oakville"},"Milton");expect(conflict.heritage.status).toBe("skipped");expect(fetch).not.toHaveBeenCalled();
    fetch.mockRejectedValue(new Error("offline"));expect((await haltonAddressEvidence(feed("Milton","heritage"),mil.address,mil)).status).toBe("unavailable");
  });
  it("checks live source counts while excluding withheld feeds and leaving market completion false",async()=>{
    fetch.mockImplementation(provider());const r=await haltonCoverage();expect(r.datasets.filter(d=>d.status==="verified")).toHaveLength(19);expect(r.datasets.filter(d=>d.status==="withheld")).toHaveLength(4);
    fetch.mockImplementation(provider({}, {count:{count:-1}}));expect((await haltonCoverage()).datasets.some(d=>d.status==="verified")).toBe(false);
    const road=ontarioMarketRoadmap();for(const city of ["Burlington","Milton","Oakville"]){const m=road.municipalities.find(m=>m.city===city)!;expect(m.stage).toBe("partial_municipal_coverage");expect(m.complete).toBe(false);}expect(road.municipalities.find(m=>m.city==="Halton Hills")?.stage).toBe("partial_municipal_coverage");
  });
  it("gates unknown municipalities, units, caller coordinates and province conflicts",async()=>{
    expect(haltonMarket("Town of Milton","Ontario")).toBe("Milton");for(const city of ["Halton Hills","Campbellville","constructor","Burlington VT"])expect(haltonMarket(city,"ON")).toBeNull();
    for(const request of [{address:"99 Mill St, Milton, BC"},{address:"Unit 2, 99 Mill St",city:"Milton",province:"ON"},{address:"99 Mill St, Milton, ON",lat:43.51,lng:-79.88}])expect(await haltonLocation(request)).toBeNull();
    expect(await haltonLayers(mil.address,"Toronto","ON",mil)).toEqual({});expect(fetch).not.toHaveBeenCalled();
  });
});
