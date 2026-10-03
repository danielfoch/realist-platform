import {beforeEach,describe,expect,it,vi} from "vitest";
import {yorkCoverage,yorkLayers,yorkLocation,yorkMetadata,yorkMunicipality} from "./york";
import {YORK_FEEDS,YORK_LICENCE_EPOCH,YORK_LICENCE_ITEM,YORK_WITHHELD,type YorkFeed} from "./york-sources";
import {preShowingBrief} from "./brief";
import {ontarioMarketRoadmap} from "./ontario-market-roadmap";
import type {Location,Row} from "./model";
const fetch=vi.hoisted(()=>vi.fn());
const nar=vi.hoisted(()=>vi.fn());
vi.mock("./national",()=>({nationalAddress:nar}));
vi.mock("./http",async()=>({...await vi.importActual<typeof import("./http")>("./http"),fetchJson:fetch}));
const feed=(key:string)=>YORK_FEEDS.find(f=>f.key===key)!;
const location:Location={address:"199 Church Street",city:"King",province:"ON",latitude:43.993692,longitude:-79.690367,accuracy:"source_civic_address_point",provider:"york:addresses",municipalAddress:{recordIds:["1"],community:"Schomberg",permitAddressKeys:[],source:feed("addresses").source,sourceUpdatedAt:null,publishedRecords:[{municipalParcelId:412683}]}};
function record(f:YorkFeed,a:Row={},g:Row={x:location.longitude,y:location.latitude}) {return {attributes:{...Object.fromEntries(Object.keys(f.fields).map(k=>[k,null])),[f.oid]:1,...a},geometry:g};}
function civic(a:Row={},g?:Row){return record(feed("addresses"),{ADDRESS_NUMBER:199,FULL_STREET_NAME:"Church Street",MUNICIPALITY:"King",MAIL_COMMUNITY_NAME:"Schomberg",ADDRS_PNT_TYPE:"Single",LIFESTATUS:"Active",PARID:412683,...a},g);}
const boundary=(a:Row={})=>record(feed("municipality"),{NAME:"King",...a});
function provider(records:Record<string,unknown[]>={},changes:Record<string,Row|undefined>={}) {
  return async(u:URL)=>{
    if(u.pathname.endsWith(YORK_LICENCE_ITEM))return {...YORK_LICENCE_EPOCH,...changes.licence};
    const f=u.pathname.includes('/sharing/')?YORK_FEEDS.find(f=>u.pathname.endsWith(f.item)):YORK_FEEDS.find(f=>u.href.split('?')[0]===f.url||u.href.split('?')[0]===f.url+'/query');
    if(!f)throw new Error("Unexpected provider");
    if(u.pathname.includes('/sharing/'))return {access:"public",owner:f.owner,orgId:f.org,url:f.url,title:f.expectedItemTitle,licenseInfo:f.key==="employmentInventory2025"?`<div><span>${f.licenceAnchors[0].replace(/"/g,"&quot;")}</span></div>`:f.licenceAnchors[0],...changes.item};
    if(!u.pathname.endsWith('/query'))return {name:f.expectedLayerName,geometryType:f.geometry,copyrightText:f.expectedCopyright,fields:Object.entries(f.fieldTypes).map(([name,type])=>({name,type})),...changes.metadata};
    if(u.searchParams.get('returnCountOnly')==='true')return {count:10,...changes.count};
    return {features:records[f.key]??[],...changes[f.key]};
  };
}
beforeEach(()=>{fetch.mockReset();nar.mockReset().mockResolvedValue(null);});
describe("York regional property evidence",()=>{
  it("requires the exact grant epoch, item endpoint, public publisher and typed named schema before records",async()=>{
    const f=feed("parcel");fetch.mockImplementation(provider());await expect(yorkMetadata(f)).resolves.toEqual({sourceUpdatedAt:null});
    for(const change of [{licence:{modified:1}},{licence:{size:1}},{licence:{owner:"other"}},{licence:{access:"private"}},{item:{owner:"copy"}},{item:{orgId:"other"}},{item:{url:f.url.replace(/\/0$/,"")}},{item:{licenseInfo:"General access; available to the public"}},{item:{licenseInfo:f.licenceAnchors[0]+" Non-commercial only."}},{metadata:{copyrightText:"First Base Solutions Inc."}},{metadata:{name:"Other Parcel"}},{metadata:{fields:Object.entries(f.fieldTypes).map(([name,type])=>({name,type:name==="MODDATE"?"esriFieldTypeString":type}))}}]){
      fetch.mockClear().mockImplementation(provider({},change));await expect(yorkMetadata(f)).rejects.toThrow();expect(fetch.mock.calls.some(([u])=>u.pathname.endsWith('/query'))).toBe(false);
    }
  });
  it("accepts only the inspected York HTML referral and preserves strict global municipal licence handling",async()=>{
    fetch.mockImplementation(provider());await expect(yorkMetadata(feed("employmentInventory2025"))).resolves.toEqual({sourceUpdatedAt:null});
    fetch.mockImplementation(provider({}, {item:{licenseInfo:"<p>Please refer to some licence on this website.</p>"}}));await expect(yorkMetadata(feed("employmentInventory2025"))).rejects.toThrow();
  });
  it("matches civic suffixes, street types, directions and allowed active property types exactly",async()=>{
    fetch.mockImplementation(provider({addresses:[civic({ADD_NUM_SUFFIX:"A"}),civic({OBJECTID:2,ADD_NUM_SUFFIX:"A",SUITE_NUMBER:"2",ADDRS_PNT_TYPE:"Multiple"}),civic({OBJECTID:3,ADD_NUM_SUFFIX:"A",ADDRS_PNT_TYPE:"Transit stop"})]}));
    expect(await yorkLocation({address:"199 Church St, King, ON"})).toBeNull();
    const r=await yorkLocation({address:"199A Church St, King, ON"});expect(r?.data?.address).toBe("199A Church Street");expect(r?.data?.municipalAddress?.recordIds).toEqual(["1","2"]);
    expect(await yorkLocation({address:"199A Church Rd, King, ON"})).toBeNull();
    expect(await yorkLocation({address:"199A Church St W, King, ON"})).toBeNull();
    const query=fetch.mock.calls.find(([u])=>u.pathname.endsWith('/query'))![0];expect(query.searchParams.get('where')).toContain("LIFESTATUS = 'Active'");expect(query.searchParams.get('where')).toContain("UPPER(FULL_STREET_NAME)");
  });
  it("excludes wrong municipalities, lifecycle/type records and conflicting postal communities",async()=>{
    for(const a of [{MUNICIPALITY:"Vaughan"},{LIFESTATUS:"Retired"},{ADDRS_PNT_TYPE:"Park"},{ADDRS_PNT_TYPE:null},{ADDRS_PNT_TYPE:"ARU"}]){fetch.mockImplementation(provider({addresses:[civic(a)]}));expect(await yorkLocation({address:"199 Church St, King, ON"})).toBeNull();}
    fetch.mockImplementation(provider({addresses:[civic(),civic({OBJECTID:2,MAIL_COMMUNITY_NAME:"King City"})]}));expect((await yorkLocation({address:"199 Church St, King, ON"}))?.status).toBe("ambiguous");
  });
  it("uses verified community aliases and rejects city conflicts, foreign province and neighbouring counties",async()=>{
    fetch.mockImplementation(provider({addresses:[civic()]}));expect((await yorkLocation({address:"199 Church St, Schomberg, ON"}))?.data?.city).toBe("King");expect((await yorkLocation({address:"199 Church St, Schomberg, ON",city:"King"}))?.status).toBe("available");
    expect(await yorkLocation({address:"199 Church St, King City, ON"})).toBeNull();expect((await yorkLocation({address:"199 Church St, King, ON",city:"Markham"}))?.status).toBe("ambiguous");
    expect(await yorkLocation({address:"199 Church St, King City, ON",city:"King"})).toBeNull();
    for(const city of ["Caledon","Bradford West Gwillimbury","Innisfil","Chippewas of Georgina Island First Nation","Thornhill"])expect(yorkMunicipality(city,"ON")).toBeNull();expect(yorkMunicipality("King","BC")).toBeNull();
  });
  it("does not select among distant/unusable civic points or accept incomplete candidates",async()=>{
    for(const records of [[civic(),civic({OBJECTID:2},{x:-79.7,y:44})],[civic({}, {})]]){fetch.mockImplementation(provider({addresses:records}));expect((await yorkLocation({address:"199 Church St, King, ON"}))?.status).toBe("ambiguous");}
    for(const response of [{exceededTransferLimit:true},{features:null},{features:[{attributes:{OBJECTID:1}}]},{features:Array.from({length:501},()=>civic())}]){fetch.mockImplementation(provider({addresses:[civic()]},{addresses:response}));expect(await yorkLocation({address:"199 Church St, King, ON"})).toBeNull();}
  });
  it("keeps national building provenance only with exact identity and 20-metre agreement",async()=>{
    fetch.mockImplementation(provider({addresses:[civic()]}));const data={...location,accuracy:"source_building_point",addressRegister:{buildingId:"building",publishedAddressRecords:1,postalCodes:[],buildingUsageCodes:[],csduid:null}};
    nar.mockResolvedValue({status:"available",data});expect((await yorkLocation({address:"199 Church St, King, ON"}))?.data?.addressRegister?.buildingId).toBe("building");
    for(const change of [{city:"Vaughan"},{address:"199 Church Rd"},{longitude:-79.71},{accuracy:"street_interpolated"}]){nar.mockResolvedValue({status:"available",data:{...data,...change}});expect((await yorkLocation({address:"199 Church St, King, ON"}))?.data?.addressRegister).toBeUndefined();}
  });
  it("gates all property queries on unique municipality confirmation and precise points",async()=>{
    for(const records of [[boundary({NAME:"Vaughan"})],[boundary(),boundary({OBJECTID:2})]]){fetch.mockClear().mockImplementation(provider({municipality:records}));const r=await yorkLayers("King","ON",location);expect(r.municipality.status).toBe("ambiguous");expect(r.regionalPlanningApplications.status).toBe("skipped");expect(fetch.mock.calls.filter(([u])=>u.pathname.endsWith('/query'))).toHaveLength(1);}
    fetch.mockClear().mockImplementation(provider());const r=await yorkLayers("King","ON",{...location,accuracy:"street_interpolated"});expect(r.municipality.status).toBe("skipped");expect(fetch).not.toHaveBeenCalled();
  });
  it("preserves disagreeing planning statuses, real dates, untyped units and separate municipal gaps",async()=>{
    const f=feed("regionalPlanningApplications");fetch.mockImplementation(provider({municipality:[boundary()],[f.key]:[record(f,{REG_FILE_NUM:"CONS.18.K.0077",MUN_NAME:"King",APPL_STATUS:"No Regional Interests",Application_Status__c:"In Progress",APPL_STAGE:"Review",DATE_RECVD:1523246400000,Date_Received__c:null,Submission_Date__c:1788840000000,UNITS:"Yes",OWNERSHIP:"PRIVATE",RegionalLead:"PRIVATE"})]}));
    const r=await yorkLayers("King","ON",location);expect(r[f.key].data).toMatchObject({scope:"regional_commenting_and_review_application_area",municipalApprovalEstablished:false,fullPlanningHistorySearched:false,nearbySearchPerformed:false,records:[expect.objectContaining({queryRowId:1,regionalFileNumber:"CONS.18.K.0077",legacyPublishedStatus:"No Regional Interests",publishedStatus:"In Progress",legacyReceivedDate:"2018-04-09T04:00:00.000Z",publishedReceivedDate:null,publishedUnitsText:"Yes"})]});expect(JSON.stringify(r[f.key])).not.toContain("PRIVATE");
    for(const key of ["permits","zoning","heritage","planningApplications","development","officialPlan"])expect(r[key].status).toBe("not_supported");expect(r.officialPlan.data).toMatchObject({municipalResponsibilityDate:"2024-07-01",currentPlanScreenPerformed:false});
    expect(preShowingBrief(r,[]).findings.find(x=>x.layer===f.key)?.summary).toContain("regional commenting");
  });
  it("leaves multiple parcels and civic parcel conflicts ambiguous with unsurveyed area units",async()=>{
    const f=feed("parcel"),a={MUNNAME:"King",LIFESTATUS:"Active",SOURCE:"York Region",PAR_GIS_ID:412683,Shape__Area:100};
    fetch.mockImplementation(provider({municipality:[boundary()],parcel:[record(f,a)]}));const r=await yorkLayers("King","ON",location);expect(r.parcel.data).toMatchObject({fullParcelFabricSearched:false,civicParcelReferenceAgreement:true,records:[expect.objectContaining({publishedGeometryAreaInternalUnitsSquared:100})]});
    for(const records of [[record(f,{...a,PAR_GIS_ID:123})],[record(f,a),record(f,{...a,OBJECTID:2})]]){fetch.mockImplementation(provider({municipality:[boundary()],parcel:records}));expect((await yorkLayers("King","ON",location)).parcel.status).toBe("ambiguous");}
  });
  it("rejects records outside the licensed/scoped query and strips non-whitelisted fields",async()=>{
    for(const a of [{SOURCE:"Teranet",MUNNAME:"King",LIFESTATUS:"Active"},{SOURCE:"York Region",MUNNAME:"Markham",LIFESTATUS:"Active"}]){fetch.mockImplementation(provider({municipality:[boundary()],parcel:[record(feed("parcel"),a)]}));expect((await yorkLayers("King","ON",location)).parcel.status).toBe("unavailable");}
    fetch.mockImplementation(provider({municipality:[boundary()],regionalPlanningApplications:[record(feed("regionalPlanningApplications"),{MUN_NAME:"Markham"})]}));expect((await yorkLayers("King","ON",location)).regionalPlanningApplications.status).toBe("unavailable");
    expect(YORK_FEEDS.flatMap(f=>Object.keys(f.fields)).some(k=>/OWNERSHIP|CRE_BY|MOD_BY|SFORCEID|RollNumber|RegionalLead/i.test(k)||k==="name")).toBe(false);
  });
  it("preserves dated employment classifications and wellhead codes without permission or water-safety claims",async()=>{
    fetch.mockImplementation(provider({municipality:[boundary()],employmentInventory2025:[record(feed("employmentInventory2025"),{MUNNAME:"Township of King",DEV_STATUS:"Vacant",GROSS_HA:2})],wellheadProtection:[record(feed("wellheadProtection"),{WELLHEAD_PROTECTION_AREA:"WHPA-D",ZONE:25})]}));
    const r=await yorkLayers("King","ON",location);expect(r.employmentInventory2025.data).toMatchObject({inventoryYear:2025,currentZoningScreenPerformed:false});expect(r.wellheadProtection.data).toMatchObject({waterSafetyEstablished:false,currentActivitySpecificRulesVerified:false,records:[expect.objectContaining({publishedZoneCode:25})]});expect(preShowingBrief(r,[]).documentsToRequest.some(x=>x.document.includes("water-supply"))).toBe(true);
  });
  it("retains truncation and empty/no-match limitations, and makes metadata failures visible",async()=>{
    fetch.mockImplementation(provider({municipality:[boundary()],regionalPlanningApplications:Array.from({length:51},(_,i)=>record(feed("regionalPlanningApplications"),{ESRI_OID:i+1,MUN_NAME:"King"}))}));const r=await yorkLayers("King","ON",location);expect(r.regionalPlanningApplications.truncated).toBe(true);expect(r.regionalPlanningApplications.data).toMatchObject({coverageComplete:false});expect((r.regionalPlanningApplications.data as Row).records).toHaveLength(50);expect(r.wellheadProtection.status).toBe("no_match");expect(r.wellheadProtection.data).toMatchObject({absenceEstablished:false});
    fetch.mockImplementation(provider({municipality:[boundary()]},{licence:{modified:1}}));expect((await yorkLayers("King","ON",location)).municipality.status).toBe("unavailable");
  });
  it("reports scoped counts, excludes withheld feeds and keeps metropolitan and municipal markets incomplete",async()=>{
    fetch.mockImplementation(provider());const r=await yorkCoverage();expect(r.datasets).toHaveLength(6);expect(r.datasets.every(f=>f.status==="verified")).toBe(true);expect(r.withheld).toHaveLength(5);expect(r.withheld.every(f=>f.records===null)).toBe(true);expect(fetch.mock.calls.some(([u])=>YORK_WITHHELD.some(f=>u.pathname.includes(f.item)))).toBe(false);
    expect(fetch.mock.calls.find(([u])=>u.pathname===new URL(feed("parcel").url).pathname+'/query')![0].searchParams.get('where')).toContain("SOURCE = 'York Region'");
    const roadmap=ontarioMarketRoadmap();expect(roadmap.metropolitanMarkets).toHaveLength(16);expect(roadmap.municipalities.map(m=>m.city)).toEqual(expect.arrayContaining(["Halton Hills","Wainfleet","West Lincoln"]));expect(roadmap.municipalities.every(m=>!m.complete)).toBe(true);expect(roadmap.municipalities.find(m=>m.city==="Vaughan")?.configuredLayers).toContain("regionalPlanningApplications");expect(roadmap.municipalities.find(m=>m.city==="Caledon")?.configuredLayers).not.toContain("regionalPlanningApplications");
    fetch.mockImplementation(provider({}, {count:{count:-1}}));expect((await yorkCoverage()).datasets.every(f=>f.status==="unavailable"&&f.records===null)).toBe(true);
  });
});
