import { readFileSync } from "node:fs";
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { wellandCoverage,wellandLayers,wellandLocation,wellandMarket,wellandMetadata } from "./welland";
import { WELLAND_FEEDS,WELLAND_GRANT,WELLAND_WITHHELD,type WellandFeed } from "./welland-sources";
import { layer,type Location,type Row } from "./model";
import { preShowingBrief } from "./brief";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
const json=vi.hoisted(()=>vi.fn());
vi.mock("./http",async()=>({...await vi.importActual<typeof import("./http")>("./http"),fetchJson:json}));
const fixture:Record<string,Row>=JSON.parse(readFileSync(new URL("./fixtures/welland-grant.json",import.meta.url),"utf8"));
const feed=(k:string)=>WELLAND_FEEDS.find(f=>f.key===k)!;
const point={x:-79.248,y:42.99},location:Location={address:"12 King St W",city:"Welland",province:"ON",latitude:point.y,longitude:point.x,accuracy:"source_civic_address_point",provider:"welland:addresses"};
const boundary=()=>layer("available",{records:[{publishedName:"Welland"}]},{...feed('addresses').source,id:"niagara:ontario:municipality"});
const record=(f:WellandFeed,a:Row={},g:Row=point)=>({attributes:{...Object.fromEntries(Object.keys(f.fields).map(k=>[k,null])),[f.oid]:1,...a},geometry:g});
function provider(records:Record<string,unknown[]>={},changes:Record<string,Row|undefined>={}) {return async(u:URL)=>{
  if(u.pathname.endsWith('/query')){const f=WELLAND_FEEDS.find(f=>u.href.split('?')[0]===f.url+'/query');if(!f)throw Error('Unexpected query');return u.searchParams.get('returnCountOnly')==='true'?{count:10,...changes.count}:{features:records[f.key]??[],...changes[f.key]};}
  const url=u.origin+u.pathname,original=fixture[url];if(!original)throw Error('Unexpected metadata');
  const kind=u.pathname.endsWith(WELLAND_GRANT.page+'/data')?'grant':u.pathname.endsWith(WELLAND_GRANT.site+'/data')?'siteData':u.pathname.endsWith(WELLAND_GRANT.page)?'page':u.pathname.endsWith(WELLAND_GRANT.site)?'site':u.pathname.includes('/sharing/')?'item':u.pathname.endsWith('/MapServer')?'root':'metadata';
  return {...original,...changes[kind]};
};}
beforeEach(()=>{json.mockReset().mockImplementation(provider());});
afterEach(()=>vi.restoreAllMocks());
describe('Welland licensed City property references',()=>{
 it('binds every exact AGOL referral, independent enterprise service and complete City licence before queries',async()=>{
  for(const f of WELLAND_FEEDS)expect(await wellandMetadata(f)).toEqual({sourceUpdatedAt:null});
  for(const change of [{item:{owner:'copy'}},{item:{orgId:'copy'}},{item:{access:'private'}},{item:{url:feed('zoning').rootUrl+'/1'}},{item:{licenseInfo:'Public access only'}},{root:{serviceItemId:feed('zoning').item}},{root:{layers:[]}},{root:{description:'Third-party replacement'}},{metadata:{serviceItemId:'other'}},{metadata:{id:0}},{metadata:{fields:[]}},{metadata:{copyrightText:'Supplier'}},{metadata:{objectIdField:'other'}},{site:{url:'https://copy.invalid'}},{siteData:{values:{}}},{page:{owner:'copy'}},{grant:{values:{}}}]){
   json.mockClear().mockImplementation(provider({},change));await expect(wellandMetadata(feed('zoning'))).rejects.toThrow();expect(json.mock.calls.some(([u])=>u.pathname.endsWith('/query'))).toBe(false);
  }
 });
 it('requires the site alias/page links and full grant rather than title or public access',async()=>{
  const base='https://www.arcgis.com/sharing/rest/content/items/',sd=fixture[base+WELLAND_GRANT.site+'/data'],pd=fixture[base+WELLAND_GRANT.page+'/data'];
  for(const change of [{siteData:{values:{...sd.values as Row,defaultHostname:'copy.invalid'}}},{siteData:{values:{...sd.values as Row,pages:[]}}},{grant:{values:{...pd.values as Row,sites:[]}}},{grant:{values:{...pd.values as Row,layout:{sections:[]}}}}]){json.mockClear().mockImplementation(provider({},change));await expect(wellandMetadata(feed('addresses'))).rejects.toThrow();expect(json.mock.calls.some(([u])=>u.pathname.endsWith('/query'))).toBe(false);}
 });
 it('requires full civic address, numeric/label/suffix components and preserves ambiguous points',async()=>{
  const f=feed('addresses'),a={Address:'12 KING ST W',Civic_No:12,Suffix:'',StName:'KING ST W',CivicNoLbl:'12'};
  json.mockImplementation(provider({addresses:[record(f,a)]}));expect((await wellandLocation({address:'12 King Street West, Welland, ON'}))?.status).toBe('available');
  for(const change of [{StName:'KING RD W'},{StName:'KING ST E'},{CivicNoLbl:'13'},{Suffix:'A'},{Address:'12-14 KING ST W'}]){json.mockImplementation(provider({addresses:[record(f,{...a,...change})]}));expect(await wellandLocation({address:'12 King St W, Welland, ON'})).toBeNull();}
  json.mockImplementation(provider({addresses:[record(f,{...a,Address:'12A KING ST W',Suffix:'A',CivicNoLbl:'12A'})]}));expect((await wellandLocation({address:'12A King St W, Welland, ON'}))?.status).toBe('available');
  json.mockImplementation(provider({addresses:[record(f,a),record(f,{...a,OBJECTID:2},{x:-79.28,y:43.0})]}));expect((await wellandLocation({address:'12 King St W, Welland, ON'}))?.status).toBe('ambiguous');
  expect((await wellandLocation({address:'12 King St W, Thorold, ON',city:'Welland'}))?.status).toBe('ambiguous');
  json.mockImplementation(provider({addresses:[record(f,a)]},{addresses:{exceededTransferLimit:true}}));expect(await wellandLocation({address:'12 King St W, Welland, ON'})).toBeNull();
  expect(wellandMarket('City of Welland','Ontario')).toBe(true);expect(wellandMarket('Welland','BC')).toBe(false);
 });
 it('requires a precise point and unique matching original Ontario polygon before any City property read',async()=>{
  for(const b of [undefined,layer('no_match',{records:[]}),{...boundary(),truncated:true},layer('available',{records:[{publishedName:'Thorold'}]},boundary().source),layer('available',{records:[{publishedName:'Welland'},{publishedName:'Welland'}]},boundary().source),{...boundary(),source:feed('zoning').source}]){json.mockClear();expect((await wellandLayers(location.address,'Welland','ON',location,b)).zoning.status).toBe('skipped');expect(json).not.toHaveBeenCalled();}
  for(const l of [{...location,accuracy:'street_interpolated'},{...location,city:'Thorold'},{...location,latitude:44}]){json.mockClear();expect((await wellandLayers(location.address,'Welland','ON',l,boundary())).zoning.status).toBe('skipped');expect(json).not.toHaveBeenCalled();}
 });
 it('retains current/old zoning, proposed/adopted plan and raw site-plan status without inferring approval',async()=>{
  json.mockImplementation(provider({zoning:[record(feed('zoning'),{Zoning:'RL1',ZoneDesc:'Low density'})],legacyZoning:[record(feed('legacyZoning'),{Zoning:'R1'})],areaSpecificPolicy:[record(feed('areaSpecificPolicy'),{ProposedOP:'Proposed residential'})],scheduleB:[record(feed('scheduleB'),{Adopted_OP:'Residential'})],sitePlans:[record(feed('sitePlans'),{CivicAddr:'12 KING ST W',DateRecd:1429833600000,Status:'Closed',IntendUse:'Proposed apartments',Parcel_No:123,OWNER:'PRIVATE'})]}));
  const r=await wellandLayers(location.address,'Welland','ON',location,boundary());expect(r.zoning.data).toMatchObject({currentApplicabilityVerified:false,applicationTransitionVerified:false,legalPermissionsEstablished:false});expect(r.legacyZoning.data).toMatchObject({historicalReference:true,currentApplicabilityVerified:false});expect(r.sitePlans.data).toMatchObject({cadastralGeometryReused:false,nearbySearchPerformed:false,fullHistorySearched:false,currentDecisionVerified:false,records:[expect.objectContaining({publishedStatus:'Closed',publishedReceivedDate:'2015-04-24T00:00:00.000Z'})]});expect(r.officialPlan.data).toMatchObject({inForcePolicyEstablished:false});expect(JSON.stringify(r)).not.toMatch(/PRIVATE|Parcel_No/);
  const brief=preShowingBrief(r,[]);expect(brief.findings.find(x=>x.layer==='legacyZoning')?.summary).toContain('Old Zoning');expect(brief.findings.find(x=>x.layer==='sitePlans')?.summary).not.toContain('quarterly');expect(brief.documentsToRequest.some(x=>x.document.includes('Welland'))).toBe(true);
 });
 it('keeps heritage/CIP/BIA/environment references separate from parcel identity, funding, levies and clearance',async()=>{
  json.mockImplementation(provider({heritage:[record(feed('heritage'),{Address:'12 KING ST W',Year_Desig:1995,Year_built:1888,Bylaw_No:'95-123',Parcel_No:123})],communityImprovement:[record(feed('communityImprovement'))],businessImprovement:[record(feed('businessImprovement'))],environmentalProtectionArea:[record(feed('environmentalProtectionArea'))]}));const r=await wellandLayers(location.address,'Welland','ON',location,boundary());expect(r.heritage.data).toMatchObject({parcelIdentityVerified:false,cadastralGeometryReused:false,currentRegisterVerified:false});expect(r.communityImprovement.data).toMatchObject({contaminationEstablished:false,programEligibilityEstablished:false,grantApproved:false});expect(r.businessImprovement.data).toMatchObject({currentLeviesEstablished:false});expect(r.naturalEnvironmentReference.data).toMatchObject({environmentalClearanceEstablished:false});expect(r.permits.status).toBe('unavailable');
  const calls=json.mock.calls.filter(([u])=>u.pathname.endsWith('/query'));expect(calls.every(([u])=>u.searchParams.get('returnGeometry')==='false')).toBe(true);expect(calls.every(([u])=>!/(\*|Parcel_No|OWNER|PIN|ROLL|Council|contact|editor)/i.test(u.searchParams.get('outFields')??''))).toBe(true);
 });
 it('bounds records, retains unknown source dates and failed nested feeds, and never establishes absence',async()=>{
  const f=feed('sitePlans');json.mockImplementation(provider({sitePlans:Array.from({length:51},(_,i)=>record(f,{OBJECTID:i+1,CivicAddr:'12 KING ST W'}))},{appealDeferralAreas:{error:{code:500}}}));let r=await wellandLayers(location.address,'Welland','ON',location,boundary());expect(r.sitePlans.truncated).toBe(true);expect((r.sitePlans.data as Row).records).toHaveLength(50);expect(r.sitePlans.data).toMatchObject({queryCoverageComplete:false,absenceEstablished:false});expect(r.sitePlans.sourceUpdatedAt).toBeNull();expect(r.officialPlan.status).toBe('unavailable');
  json.mockImplementation(provider({sitePlans:[record(f,{CivicAddr:42})]}));expect((await wellandLayers(location.address,'Welland','ON',location,boundary())).sitePlans.status).toBe('unavailable');
  json.mockImplementation(provider({}, {sitePlans:{exceededTransferLimit:true}}));expect((await wellandLayers(location.address,'Welland','ON',location,boundary())).sitePlans.status).toBe('unavailable');
  json.mockImplementation(provider());r=await wellandLayers(location.address,'Welland','ON',location,boundary());expect(r.zoning.status).toBe('no_match');expect(r.zoning.data).toMatchObject({absenceEstablished:false});
 });
 it('skips exact-address files on coordinate-only requests and excludes withheld feeds/count duplication',async()=>{
  const r=await wellandLayers(null,'Welland','ON',{...location,accuracy:'caller_supplied'},boundary());expect(r.sitePlans.status).toBe('skipped');expect(r.heritage.status).toBe('skipped');const c=await wellandCoverage();expect(c.datasets).toHaveLength(13);expect(c.datasets.every(x=>x.status==='verified')).toBe(true);expect(c.withheld.every(x=>x.records===null)).toBe(true);expect(c.datasets.some(x=>x.layer==='municipality')).toBe(false);expect(WELLAND_WITHHELD.every(f=>!json.mock.calls.some(([u])=>u.href.startsWith(f.url)))).toBe(true);expect(c.complete).toBe(false);
  const m=ontarioMarketRoadmap().municipalities.find(m=>m.city==='Welland')!;expect(m.configuredLayers).toContain('sitePlans');expect(m.withheldLayers.some(x=>x.layer==='permits')).toBe(true);expect(m.complete).toBe(false);
 });
});
