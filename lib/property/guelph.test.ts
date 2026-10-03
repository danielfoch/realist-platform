import { readFileSync } from "node:fs";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { guelphCoverage, guelphLayers, guelphMarket, guelphMetadata, guelphResearch } from "./guelph";
import { GUELPH_FEEDS, GUELPH_GRANT, GUELPH_WITHHELD, type GuelphFeed } from "./guelph-sources";
import { preShowingBrief } from "./brief";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
import type { Location, Row } from "./model";
const json=vi.hoisted(()=>vi.fn());
const geocode=vi.hoisted(()=>vi.fn());
const session=vi.hoisted(()=>vi.fn());
vi.mock("./http",async()=>({...await vi.importActual<typeof import("./http")>("./http"),fetchJson:json}));
vi.mock("./guelph-session",()=>({withGuelphSession:session}));
vi.mock("./geocode",async()=>({...await vi.importActual<typeof import("./geocode")>("./geocode"),geocode}));
const grant=JSON.parse(readFileSync(new URL("./fixtures/guelph-grant.json",import.meta.url),"utf8"));
const feed=(k:string)=>GUELPH_FEEDS.find(f=>f.key===k)!;
const point={x:-80.25,y:43.55},location:Location={address:"12 King St W",city:"Guelph",province:"ON",latitude:point.y,longitude:point.x,accuracy:"source_civic_address_point",provider:"guelph:addresses"};
const record=(f:GuelphFeed,a:Row={},g:Row=point)=>({attributes:{...Object.fromEntries(Object.keys(f.fields).map(k=>[k,null])),[f.oid]:1,...a},geometry:g});
function provider(records:Record<string,unknown[]>={},changes:Record<string,Row|undefined>={}){return async(u:URL)=>{
  const b=GUELPH_GRANT,p=u.pathname;
  for(const [path,k]of [[`/content/items/${b.site}`,"siteItem"],[`/content/items/${b.site}/data`,"siteData"],[`/content/items/${b.page}`,"licenceItem"],[`/content/items/${b.page}/data`,"licenceData"],[`/content/items/${b.terms}`,"termsItem"],[`/content/items/${b.terms}/data`,"termsData"],[`/community/groups/${b.group}`,"groupItem"]])if(p.endsWith(path))return {...grant[k],...changes[k]};
  if(p.endsWith('/search')){const f=feed('planningApplications');return {total:1,results:[{id:f.item,owner:f.owner,orgId:f.org,access:'public'}],...changes.membership};}
  const f=p.includes('/sharing/')?GUELPH_FEEDS.find(f=>p.endsWith(f.item)):GUELPH_FEEDS.find(f=>u.href.split('?')[0]===f.url||u.href.split('?')[0]===f.url+'/query');if(!f)throw Error('Unexpected provider');
  if(p.includes('/sharing/'))return {...grant.items[f.item],...changes.item};
  if(!p.endsWith('/query'))return {name:f.expectedLayerName,geometryType:f.geometry,objectIdField:f.oid,copyrightText:f.expectedCopyright,fields:Object.entries(f.fieldTypes).map(([name,type])=>({name,type})),...changes.metadata};
  if(u.searchParams.get('returnCountOnly')==='true')return {count:10,...changes.count};
  return {features:records[f.key]??(f.key==='municipality'?[record(f,{BOUNDARY:'City of Guelph'})]:[]),...changes[f.key]};
};}
beforeEach(()=>{let clock=Date.now();vi.spyOn(Date,'now').mockImplementation(()=>clock+=1000);json.mockReset();geocode.mockReset().mockResolvedValue({status:'available',data:{...location,provider:'geolocator'}});session.mockReset().mockImplementation(async(run)=>run(async()=>{}));});
afterEach(()=>vi.restoreAllMocks());
describe('Guelph licensed property evidence',()=>{
  it('pins the full City grant, traffic terms, named typed endpoint and referral before records',async()=>{
    json.mockImplementation(provider());await expect(guelphMetadata(feed('zoning'))).resolves.toEqual({sourceUpdatedAt:null});
    for(const change of [{licenceItem:{owner:'copy'}},{termsItem:{title:'Other'}},{siteData:{catalog:{groups:[]}}},{licenceData:{values:{}}},{termsData:{values:{}}},{item:{licenseInfo:'Non-commercial use only'}},{metadata:{copyrightText:'Teranet'}},{metadata:{objectIdField:'Other'}},{metadata:{fields:[]}}]){json.mockClear().mockImplementation(provider({},change));await expect(guelphMetadata(feed('zoning'))).rejects.toThrow();expect(json.mock.calls.some(([u])=>u.pathname.endsWith('/query'))).toBe(false);}
  });
  it('requires exact individual City-curated membership for blank planning terms; public organisation membership alone is insufficient',async()=>{
    json.mockImplementation(provider());await expect(guelphMetadata(feed('planningApplications'))).resolves.toEqual({sourceUpdatedAt:null});
    for(const change of [{membership:{total:0,results:[]}},{membership:{total:2}},{groupItem:{owner:'other'}},{groupItem:{access:'private'}},{item:{owner:'copy'}}]){json.mockClear().mockImplementation(provider({},change));await expect(guelphMetadata(feed('planningApplications'))).rejects.toThrow();expect(json.mock.calls.some(([u])=>u.pathname.endsWith('/query'))).toBe(false);}
  });
  it('strictly matches civic suffix, street type, direction, full components and municipality',async()=>{
    const f=feed('addresses'),a={STATUS:'Active',STREETNO:'12',FULLNAME:'KING ST W',STREETNAME:'KING ST W',ADDRESS:'12 KING ST W',PLACE:'Guelph'};json.mockImplementation(provider({addresses:[record(f,a)]}));
    expect((await guelphResearch({address:'12 King Street West, Guelph, ON'})).location.data?.provider).toBe('guelph:addresses');
    for(const address of ['12A King St W','12 King St E','12 King Rd W'])expect((await guelphResearch({address:`${address}, Guelph, ON`})).location.data?.provider).not.toBe('guelph:addresses');
    expect(guelphMarket('Guelph','BC')).toBe(false);expect((await guelphResearch({address:'12 King St W, Cambridge, ON',city:'Guelph'})).location.status).toBe('ambiguous');
    json.mockImplementation(provider({addresses:[record(f,{...a,PLACE:'Cambridge'})]}));expect((await guelphResearch({address:'12 King St W, Guelph, ON'})).location.data?.provider).not.toBe('guelph:addresses');
  });
  it('keeps unusable, distant or incomplete shared civic candidates unresolved',async()=>{
    const f=feed('addresses'),a={STATUS:'Active',STREETNO:'12',FULLNAME:'KING ST W',STREETNAME:'KING ST W',ADDRESS:'12 KING ST W'};
    for(const g of [{},{x:-80.3,y:43.6}]){json.mockImplementation(provider({addresses:[record(f,a),record(f,{...a,OBJECTID:2,UNIT_NO:'2'},g)]}));const r=await guelphResearch({address:'12 King St W, Guelph, ON'});expect(r.location.status).toBe('ambiguous');expect(r.layers.zoning.status).toBe('skipped');}
    json.mockImplementation(provider({addresses:[record(f,a)]},{addresses:{exceededTransferLimit:true}}));expect((await guelphResearch({address:'12 King St W, Guelph, ON'})).location.data?.provider).not.toBe('guelph:addresses');
  });
  it('requires a unique City boundary before property queries and skips interpolated points',async()=>{
    const f=feed('municipality');for(const records of [[],[record(f,{BOUNDARY:'Cambridge'})],[record(f,{BOUNDARY:'Guelph'}),record(f,{BOUNDARY:'Guelph',OBJECTID:2})]]){json.mockClear().mockImplementation(provider({municipality:records}));expect((await guelphLayers('12 King St W','Guelph','ON',location)).zoning.status).toBe('skipped');expect(json.mock.calls.filter(([u])=>u.pathname.endsWith('/query'))).toHaveLength(1);}
    json.mockClear();expect((await guelphLayers('12 King St W','Guelph','ON',{...location,accuracy:'street_interpolated'})).zoning.status).toBe('skipped');expect(json).not.toHaveBeenCalled();
  });
  it('preserves historical termite year/activity separately from current Regent/Grove management and property condition',async()=>{
    const f=feed('formerTermiteManagement');json.mockImplementation(provider({formerTermiteManagement:[record(f,{ACTIVITY:'Red',YEAR:'2017',MAN_AREA:'Woolwich'})]}));const r=await guelphLayers('12 King St W','Guelph','ON',location);expect(r.formerTermiteManagement.data).toMatchObject({records:[expect.objectContaining({publishedActivity:'Red',publishedYear:'2017'})],currentRegentGroveAreaScreenPerformed:false,currentInfestationEstablished:false,eradicationEstablished:false,termiteAbsenceEstablished:false});expect(r.currentTermiteManagement.status).toBe('unavailable');expect(preShowingBrief(r,[]).documentsToRequest.some(x=>x.evidenceLayers.includes('currentTermiteManagement'))).toBe(true);
  });
  it('keeps source planning status, application date and zoning/holding labels separate from legal permissions',async()=>{
    const f=feed('planningApplications'),z=feed('zoning');json.mockImplementation(provider({planningApplications:[record(f,{ADDRESS:'12 KING ST W',STATUSDESC:'Approved',INDATE:1704067200000,OWNER:'PRIVATE'})],zoning:[record(z,{ZONING_CODE:'RL.1',HOLDING:'H12',SITE_SPECIFIC:'123'})]}));const r=await guelphLayers('12 King St W','Guelph','ON',location);expect(r.planningApplications.data).toMatchObject({nearbySearchPerformed:false,currentDecisionVerified:false,records:[expect.objectContaining({publishedStatus:'Approved',publishedApplicationDate:'2024-01-01T00:00:00.000Z'})]});expect(r.zoning.data).toMatchObject({currentAppealsVerified:false,communityPlanningPermitApplicabilityVerified:false,legalPermissionsEstablished:false});expect(JSON.stringify(r)).not.toContain('PRIVATE');expect(preShowingBrief(r,[]).findings.find(x=>x.layer==='planningApplications')?.summary).not.toContain('quarterly');
  });
  it('excludes personal, ownership, PIN, roll and creator fields from upstream queries and output',async()=>{
    const p=feed('parcelReference');json.mockImplementation(provider({parcelReference:[record(p,{PIN:123,OWNERSHIP:'PRIVATE',ROLL_NO:'PRIVATE'})]}));const r=await guelphLayers('12 King St W','Guelph','ON',location);expect(JSON.stringify(r)).not.toContain('PRIVATE');expect(json.mock.calls.filter(([u])=>u.pathname.endsWith('/query')).every(([u])=>!/(\*|PIN|OWNER|ROLL|created_user|last_edited_user)/i.test(u.searchParams.get('outFields')??''))).toBe(true);expect(r.parcelReference.data).toMatchObject({titleSearchPerformed:false,surveyVerified:false});
  });
  it('keeps bounded truncation, malformed/failed sources and no-match scope visible',async()=>{
    const f=feed('planningApplications');json.mockImplementation(provider({planningApplications:Array.from({length:51},(_,i)=>record(f,{OBJECTID_1:i+1,ADDRESS:'12 KING ST W'}))}));let r=await guelphLayers('12 King St W','Guelph','ON',location);expect(r.planningApplications.truncated).toBe(true);expect((r.planningApplications.data as Row).records).toHaveLength(50);expect(r.planningApplications.data).toMatchObject({queryCoverageComplete:false,absenceEstablished:false});
    json.mockImplementation(provider({}, {planningApplications:{exceededTransferLimit:true}}));r=await guelphLayers('12 King St W','Guelph','ON',location);expect(r.planningApplications.status).toBe('unavailable');expect(r.formerTermiteManagement.status).toBe('no_match');expect(r.formerTermiteManagement.data).toMatchObject({termiteAbsenceEstablished:false});
    json.mockImplementation(provider({planningApplications:[record(f,{ADDRESS:42})]}));expect((await guelphLayers('12 King St W','Guelph','ON',location)).planningApplications.status).toBe('unavailable');
  });
  it('skips coordinate-only history and never queries/counts withheld items',async()=>{
    json.mockImplementation(provider());const r=await guelphLayers(null,'Guelph','ON',{...location,accuracy:'caller_supplied'});expect(r.planningApplications.status).toBe('skipped');const c=await guelphCoverage();expect(c.datasets).toHaveLength(11);expect(c.datasets.every(x=>x.status==='verified')).toBe(true);expect(c.withheld.every(x=>x.records===null)).toBe(true);expect(GUELPH_WITHHELD.every(f=>!('item'in f)||!json.mock.calls.some(([u])=>u.href.includes(f.item)))).toBe(true);expect(c.complete).toBe(false);
  });
  it('shares one grant context and serialized session for civic lookup and property evidence',async()=>{
    const f=feed('addresses');json.mockImplementation(provider({addresses:[record(f,{STATUS:'Active',STREETNO:'12',FULLNAME:'KING ST W',STREETNAME:'KING ST W',ADDRESS:'12 KING ST W'})]}));await guelphResearch({address:'12 King St W, Guelph, ON'});expect(session).toHaveBeenCalledTimes(1);expect(json.mock.calls.filter(([u])=>u.pathname.endsWith(GUELPH_GRANT.page+'/data'))).toHaveLength(1);
  });
  it('returns unavailable evidence without a source call when the distributed source session is busy or fails',async()=>{
    session.mockRejectedValue(Error('busy'));const r=await guelphLayers('12 King St W','Guelph','ON',location);expect(r.zoning.status).toBe('unavailable');expect(json).not.toHaveBeenCalled();const c=await guelphCoverage();expect(c.datasets.every(d=>d.records===null)).toBe(true);expect(json).not.toHaveBeenCalled();
    const m=ontarioMarketRoadmap().municipalities.find(m=>m.city==='Guelph')!;expect(m.configuredLayers).toContain('formerTermiteManagement');expect(m.withheldLayers.some(f=>f.layer==='heritage')).toBe(true);expect(m.complete).toBe(false);
  });
});
