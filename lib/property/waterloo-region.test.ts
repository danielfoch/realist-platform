import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { waterlooCoverage, waterlooLayers, waterlooLocation, waterlooMarket, waterlooMetadata } from "./waterloo-region";
import { WATERLOO_CITY_GRANT, WATERLOO_FEEDS, WATERLOO_GRANTS, type WaterlooFeed } from "./waterloo-region-sources";
import { preShowingBrief } from "./brief";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
import type { Layer, Location, Row } from "./model";
const json=vi.hoisted(()=>vi.fn());
const html=vi.hoisted(()=>vi.fn());
const nar=vi.hoisted(()=>vi.fn());
vi.mock("./national",()=>({nationalAddress:nar}));
vi.mock("./http",async()=>({...await vi.importActual<typeof import("./http")>("./http"),fetchJson:json,fetchText:html}));
const terms:Record<string,string>=JSON.parse(readFileSync(new URL("./fixtures/waterloo-region-item-terms.json",import.meta.url),"utf8"));
const grant=JSON.parse(readFileSync(new URL("./fixtures/waterloo-open-data-grant.json",import.meta.url),"utf8"));
const grantHtml=Object.fromEntries(["cambridge","region"].map(c=>[c,readFileSync(new URL(`./fixtures/${c}-open-data-licence.html`,import.meta.url),"utf8")]));
const feed=(market:string,key:string)=>WATERLOO_FEEDS.find(f=>f.market===market&&f.key===key)!;
const point={x:-80.4924,y:43.4517};
const location:Location={address:"200 King St W",city:"Kitchener",province:"ON",latitude:point.y,longitude:point.x,accuracy:"source_civic_address_point",provider:"waterloo-region:region:addresses"};
const record=(f:WaterlooFeed,a:Row={},g:Row=point)=>({attributes:{...Object.fromEntries(Object.keys(f.fields).map(k=>[k,null])),[f.oid]:1,...a},geometry:g});
const key=(f:WaterlooFeed)=>f.market+":"+f.key;
function provider(records:Record<string,unknown[]>={},changes:Record<string,Row|undefined>={}){return async(u:URL)=>{
  const b=WATERLOO_CITY_GRANT,p=u.pathname;
  for(const [path,k]of [[`/content/items/${b.site}`,"siteItem"],[`/content/items/${b.site}/data`,"siteData"],[`/content/items/${b.page}`,"licenceItem"],[`/content/items/${b.page}/data`,"licenceData"],[`/community/groups/${b.group}`,"groupItem"]])if(p.endsWith(path))return {...grant[k],...changes[k]};
  if(p.endsWith('/search')){const id=u.searchParams.get('q')!.match(/id:(\w+)/)![1],f=WATERLOO_FEEDS.find(f=>f.item===id)!;return {total:1,results:[{id,owner:f.owner,orgId:f.org,access:'public'}],...changes.membership};}
  const f=p.includes('/sharing/')?WATERLOO_FEEDS.find(f=>p.endsWith(f.item)):WATERLOO_FEEDS.find(f=>u.href.split('?')[0]===f.url||u.href.split('?')[0]===f.url+'/query');if(!f)throw Error('Unexpected provider');
  if(p.includes('/sharing/'))return {id:f.item,access:'public',owner:f.owner,orgId:f.org,title:f.expectedItemTitle,url:f.rootUrl,licenseInfo:terms[f.item],...changes.item};
  if(!p.endsWith('/query'))return {name:f.expectedLayerName,geometryType:f.geometry,copyrightText:f.expectedCopyright,fields:Object.entries(f.fieldTypes).map(([name,type])=>({name,type})),...changes.metadata};
  if(u.searchParams.get('returnCountOnly')==='true')return {count:10,...changes.count};
  let defaults:unknown[]=[];
  if(f.key==='municipality')defaults=[record(f,f.market==='Kitchener'?{MUNICIPALITY:'KITCHENER'}:f.market==='Cambridge'?{LTIER:'CITY OF CAMBRIDGE'}:{})];
  if(f.key==='regionalBoundary')defaults=[record(f,{ShortName:'Region of Waterloo',LongName:'Regional Municipality of Waterloo'})];
  return {features:records[key(f)]??defaults,...changes[key(f)]};
};}
function nested(r:Record<string,Layer>,group:string,k:string){return ((r[group].data as Row).datasets as Record<string,Layer<Row>>)[k];}
beforeEach(()=>{json.mockReset();html.mockReset().mockImplementation(async(u:URL)=>grantHtml[u.hostname==='www.cambridge.ca'?'cambridge':'region']);nar.mockReset().mockResolvedValue(null);});
describe('Kitchener, Waterloo, Cambridge and regional property research',()=>{
  it('binds blank Waterloo terms to the exact City-owned catalogue, site, complete licence and individual item membership before records',async()=>{
    const f=feed('Waterloo','permits');json.mockImplementation(provider());await expect(waterlooMetadata(f)).resolves.toEqual({sourceUpdatedAt:null});
    for(const change of [{membership:{total:0,results:[]}},{membership:{total:2}},{groupItem:{owner:'copy'}},{siteItem:{orgId:'other'}},{siteData:{catalog:{groups:[]}}},{licenceItem:{owner:'other'}},{licenceData:{values:{}}},{item:{licenseInfo:'Non-commercial only'}},{item:{url:f.url}},{metadata:{copyrightText:'Teranet'}}]){json.mockClear().mockImplementation(provider({},change));await expect(waterlooMetadata(f)).rejects.toThrow();expect(json.mock.calls.some(([u])=>u.pathname.endsWith('/query'))).toBe(false);}
  });
  it('pins complete Kitchener terms and current Cambridge/Region grant text rather than guessing from public access or a changed accordion id',async()=>{
    for(const market of ['Kitchener','Cambridge','Region of Waterloo']){json.mockImplementation(provider());await expect(waterlooMetadata(feed(market,market==='Region of Waterloo'?'regionalBoundary':'municipality'))).resolves.toEqual({sourceUpdatedAt:null});}
    html.mockImplementation(async(u:URL)=>grantHtml[u.hostname==='www.cambridge.ca'?'cambridge':'region'].replace(/collapse_[\w-]+/,'collapse_rotated'));await expect(waterlooMetadata(feed('Cambridge','permits')??feed('Cambridge','municipality'))).resolves.toEqual({sourceUpdatedAt:null});
    html.mockResolvedValue(grantHtml.cambridge+'<p>New commercial restriction</p>');json.mockImplementation(provider({}, {item:{licenseInfo:'Public use only'}}));await expect(waterlooMetadata(feed('Cambridge','municipality'))).rejects.toThrow();
    json.mockImplementation(provider());html.mockResolvedValue(grantHtml.cambridge.replace('commercial','non-commercial'));await expect(waterlooMetadata(feed('Cambridge','municipality'))).rejects.toThrow();
    json.mockImplementation(provider({}, {item:{owner:'copy'}}));await expect(waterlooMetadata(feed('Kitchener','permits'))).rejects.toThrow();
  });
  it('validates exact full civic identities with suffixes, street types and directions for each source schema',async()=>{
    const cases=[['Kitchener',record(feed('Region of Waterloo','addresses'),{AddressNumber:'200',FullStreetName:'King St W',FullAddress:'200 King St W',Municipality:'Kitchener'})],['Waterloo',record(feed('Waterloo','addresses'),{CIVIC_ADDR:'200 KING ST W',STREET_NM:'KING ST W'})],['Cambridge',record(feed('Cambridge','addresses'),{HOUSE_NUMBER:200,STREET_NAME:'KING ST W',ADDRESS_LABEL:'200 KING ST W',STATUS:'ACTIVE'})]]as const;
    for(const [city,r]of cases){json.mockImplementation(provider({[(city==='Kitchener'?'Region of Waterloo':city)+':addresses']:[r]}));expect((await waterlooLocation({address:`200 King Street West, ${city}, ON`}))?.data?.city).toBe(city);for(const addr of ['200A King St W','200 King St E','200 King Rd W'])expect(await waterlooLocation({address:`${addr}, ${city}, ON`})).toBeNull();}
    expect(waterlooMarket('Waterloo','BC')).toBeNull();expect(waterlooMarket('Galt','ON')).toBeNull();expect((await waterlooLocation({address:'200 King St W, Waterloo, ON',city:'Kitchener'}))?.status).toBe('ambiguous');
  });
  it('keeps shared civic points unresolved when geometry disagrees, is unusable or the candidate query is incomplete',async()=>{
    const f=feed('Region of Waterloo','addresses'),a={AddressNumber:'200',FullStreetName:'King St W',FullAddress:'200 King St W',Municipality:'Kitchener'};
    json.mockImplementation(provider({[key(f)]:[record(f,a),record(f,{...a,OBJECTID:2,UnitNumber:'2'})]}));expect((await waterlooLocation({address:'200 King St W, Kitchener, ON'}))?.data?.municipalAddress?.publishedAddressRecordCount).toBe(2);
    for(const g of [{},{x:-80.6,y:43.5}]){json.mockImplementation(provider({[key(f)]:[record(f,a),record(f,{...a,OBJECTID:2},g)]}));expect((await waterlooLocation({address:'200 King St W, Kitchener, ON'}))?.status).toBe('ambiguous');}
    json.mockImplementation(provider({[key(f)]:[record(f,{...a,Municipality:'Cambridge'})]}));expect(await waterlooLocation({address:'200 King St W, Kitchener, ON'})).toBeNull();
    json.mockImplementation(provider({[key(f)]:[record(f,a)]},{[key(f)]:{exceededTransferLimit:true}}));expect(await waterlooLocation({address:'200 King St W, Kitchener, ON'})).toBeNull();
  });
  it('retains national building metadata only with exact civic, City and point agreement',async()=>{
    const f=feed('Region of Waterloo','addresses');json.mockImplementation(provider({[key(f)]:[record(f,{AddressNumber:'200',FullStreetName:'King St W',FullAddress:'200 King St W',Municipality:'Kitchener'})]}));const data={...location,accuracy:'source_building_point',addressRegister:{buildingId:'B',publishedAddressRecords:1,postalCodes:[],buildingUsageCodes:[],csduid:null}};
    nar.mockResolvedValue({status:'available',data});expect((await waterlooLocation({address:'200 King St W, Kitchener, ON'}))?.data?.addressRegister?.buildingId).toBe('B');
    for(const change of [{city:'Waterloo'},{address:'201 King St W'},{longitude:-80.7},{accuracy:'street_interpolated'}]){nar.mockResolvedValue({status:'available',data:{...data,...change}});expect((await waterlooLocation({address:'200 King St W, Kitchener, ON'}))?.data?.addressRegister).toBeUndefined();}
  });
  it('requires both a unique matching City and Region boundary before property queries',async()=>{
    const f=feed('Kitchener','municipality'),r=feed('Region of Waterloo','regionalBoundary');
    for(const records of [{[key(f)]:[]},{[key(f)]:[record(f,{MUNICIPALITY:'WATERLOO'})]},{[key(f)]:[record(f,{MUNICIPALITY:'KITCHENER'}),record(f,{MUNICIPALITY:'KITCHENER',OBJECTID:2})]},{[key(r)]:[record(r,{LongName:'Other Region'})]}]){json.mockClear().mockImplementation(provider(records));const result=await waterlooLayers('200 King St W','Kitchener','ON',location);expect(result.permits.status).toBe('skipped');expect(json.mock.calls.filter(([u])=>u.pathname.endsWith('/query'))).toHaveLength(2);}
    json.mockClear();expect((await waterlooLayers('200 King St W','Kitchener','ON',{...location,accuracy:'street_interpolated'})).permits.status).toBe('skipped');expect(json).not.toHaveBeenCalled();
  });
  it('returns exact permit/application/heritage observations with raw statuses, type-correct dates and no personal or roll fields',async()=>{
    const f=feed('Kitchener','permits'),p=feed('Kitchener','planningApplications'),h=feed('Kitchener','heritageProperties');json.mockImplementation(provider({[key(f)]:[record(f,{FOLDERNAME:'200 KING ST W',PERMIT_STATUS:'Cancelled',ISSUE_DATE:1704067200000,OWNERS:'PRIVATE'})],[key(p)]:[record(p,{ADDRESS:'200  KING ST W',STATUS:'Approved',DRAFT_APPROVAL_DATE:'TBD',APPLICANT:'PRIVATE'})],[key(h)]:[record(h,{HERITAGE_ADDRESS:'200 KING ST W',YEAR_BUILT:1900,YEAR_BUILT_QUALIFIER:'c'})]}));
    const result=await waterlooLayers('200 King St W','Kitchener','ON',location);expect(result.permits.data).toMatchObject({fullHistorySearched:false,currentOccupancyApprovalVerified:false,records:[expect.objectContaining({publishedStatus:'Cancelled',publishedIssueDate:'2024-01-01T00:00:00.000Z'})]});expect(result.planningApplications.data).toMatchObject({currentDecisionVerified:false,nearbySearchPerformed:false,records:[expect.objectContaining({publishedDraftApprovalDate:'TBD'})]});expect(nested(result,'heritage','heritageProperties').data?.records).toEqual([expect.objectContaining({publishedYearBuilt:1900,publishedYearBuiltQualifier:'c'})]);expect(JSON.stringify(result)).not.toContain('PRIVATE');
    expect(json.mock.calls.some(([u])=>u.pathname===new URL(p.url+'/query').pathname&&u.searchParams.get('where')?.includes('200  KING ST W'))).toBe(true);
    expect(json.mock.calls.filter(([u])=>u.pathname.endsWith('/query')).every(([u])=>!/[*,]|OWNERS|APPLICANT|ROLL/.test(u.searchParams.get('outFields')?.replaceAll(',','')??''))).toBe(true);
  });
  it('preserves distant heritage civic candidates as ambiguous instead of assigning a designation',async()=>{
    const f=feed('Kitchener','heritageProperties');json.mockImplementation(provider({[key(f)]:[record(f,{HERITAGE_ADDRESS:'200 KING ST W'},{x:-80.6,y:43.5})]}));const r=await waterlooLayers('200 King St W','Kitchener','ON',location);expect(r.heritage.status).toBe('ambiguous');expect(nested(r,'heritage','heritageProperties').status).toBe('ambiguous');expect(r.heritage.data).toMatchObject({enabledQueryCoverageComplete:false,absenceEstablished:false});
  });
  it('separates Cambridge amendment and site-plan source statuses and omits the malformed current-designation date field',async()=>{
    const a=feed('Cambridge','planAmendments'),b=feed('Cambridge','sitePlans');json.mockImplementation(provider({[key(a)]:[record(a,{STATUSDESC:'Appeal',PROP_ZONING:'PROPOSED',CURRENT_OP_DESINATION:1704067200000})],[key(b)]:[record(b,{STATUSDESC:'Under Review',CURRENT_OP_DESINATION:'Source designation text'})]}));const result=await waterlooLayers('11 Richards Ave','Cambridge','ON',{...location,city:'Cambridge'});
    expect(nested(result,'planningApplications','planAmendments').data?.records).toEqual([expect.objectContaining({publishedStatus:'Appeal',publishedPropZoning:'PROPOSED'})]);expect(JSON.stringify(nested(result,'planningApplications','planAmendments').data)).not.toContain('2024-01-01');expect(result.planningApplications.data).toMatchObject({municipalApprovalEstablished:false,fullHistorySearched:false,nearbySearchPerformed:false});expect(result.officialPlan.data).toMatchObject({currentPlanScreenPerformed:false,inForcePolicyEstablished:false});
  });
  it('keeps pressure, future models, natural-heritage and improvement references separate from capacity, safety or eligibility',async()=>{
    const f=feed('Waterloo','waterPressureZone'),e=feed('Region of Waterloo','sensitivePolicyAreas');json.mockImplementation(provider({[key(f)]:[record(f,{ZONE:'W4',FUTUREZONE:'W5',HGL:350})],[key(e)]:[record(e,{Status:'Historic'})]}));const result=await waterlooLayers('35 King St N','Waterloo','ON',{...location,city:'Waterloo'});expect(result.waterPressureZone.data).toMatchObject({actualConnectionEstablished:false,availableCapacityEstablished:false,servicingEligibilityEstablished:false,waterSafetyEstablished:false,records:[expect.objectContaining({publishedZone:'W4',publishedFuturezone:'W5'})]});expect(result.regionalEnvironment.data).toMatchObject({currentPolicyEstablished:false,conservationAuthorityRegulatoryScreenPerformed:false});
  });
  it('keeps failed, malformed and truncated sources visible; no-match does not establish absence',async()=>{
    const f=feed('Kitchener','permits');json.mockImplementation(provider({[key(f)]:Array.from({length:51},(_,i)=>record(f,{OBJECTID:i+1,FOLDERNAME:'200 KING ST W'}))}));let r=await waterlooLayers('200 King St W','Kitchener','ON',location);expect(r.permits.truncated).toBe(true);expect((r.permits.data as Row).records).toHaveLength(50);expect(r.permits.data).toMatchObject({queryCoverageComplete:false,absenceEstablished:false});
    json.mockImplementation(provider({}, {[key(f)]:{exceededTransferLimit:true}}));r=await waterlooLayers('200 King St W','Kitchener','ON',location);expect(r.permits.status).toBe('unavailable');expect(r.planningApplications.status).toBe('no_match');
    json.mockImplementation(provider({[key(f)]:[record(f,{CONSTRUCTION_VALUE:'bad',FOLDERNAME:'200 KING ST W'})]}));r=await waterlooLayers('200 King St W','Kitchener','ON',location);expect(r.permits.status).toBe('unavailable');
  });
  it('skips coordinate-only exact-address histories and never queries a withheld item',async()=>{
    json.mockImplementation(provider());const r=await waterlooLayers(null,'Kitchener','ON',{...location,accuracy:'caller_supplied'});expect(r.permits.status).toBe('skipped');expect(r.planningApplications.status).toBe('skipped');expect(nested(r,'heritage','heritageProperties').status).toBe('skipped');expect(r.zoning.status).toBe('unavailable');
    const coverage=await waterlooCoverage();const urls=json.mock.calls.map(([u])=>u.href);expect(coverage.withheld.every(f=>f.records===null&&!urls.some(u=>u.includes(f.item)))).toBe(true);expect(coverage.datasets).toHaveLength(26);expect(coverage.datasets.every(d=>d.status==='verified')).toBe(true);expect(coverage.complete).toBe(false);expect(html.mock.calls.filter(([u])=>u.href===WATERLOO_GRANTS.cambridge.url)).toHaveLength(1);
  });
  it('writes source-specific report summaries, document requests and incomplete roadmap entries',async()=>{
    const f=feed('Kitchener','planningApplications');json.mockImplementation(provider({[key(f)]:[record(f,{ADDRESS:'200 KING ST W'})]}));const r=await waterlooLayers('200 King St W','Kitchener','ON',location),brief=preShowingBrief(r,[]);expect(brief.findings.find(f=>f.layer==='planningApplications')?.summary).toContain('exact civic');expect(brief.findings.find(f=>f.layer==='planningApplications')?.summary).not.toContain('quarterly');expect(brief.documentsToRequest.some(d=>d.evidenceLayers.includes('waterPressureZone'))).toBe(true);
    for(const city of ['Kitchener','Waterloo','Cambridge']){const m=ontarioMarketRoadmap().municipalities.find(m=>m.city===city)!;expect(m.configuredLayers).toContain('regionalEnvironment');expect(m.complete).toBe(false);}
  });
});
