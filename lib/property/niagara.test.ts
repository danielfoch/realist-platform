import { readFileSync } from "node:fs";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { niagaraCoverage, niagaraLayers, niagaraLocation, niagaraMetadata, niagaraMunicipality } from "./niagara";
import { NIAGARA_FEEDS, NIAGARA_GRANTS, NIAGARA_MUNICIPALITIES, NIAGARA_WITHHELD, type NiagaraFeed } from "./niagara-sources";
import { preShowingBrief } from "./brief";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
import type { Location, Row } from "./model";
const json=vi.hoisted(()=>vi.fn());
const html=vi.hoisted(()=>vi.fn());
vi.mock("./http",async()=>({...await vi.importActual<typeof import("./http")>("./http"),fetchJson:json,fetchText:html}));
const fixture:Record<string,Row|string>=JSON.parse(readFileSync(new URL("./fixtures/niagara-grant.json",import.meta.url),"utf8"));
const feed=(k:string)=>NIAGARA_FEEDS.find(f=>f.key===k)!;
const point={x:-79.08,y:43.1},location:Location={address:"12 King St W",city:"Niagara Falls",province:"ON",latitude:point.y,longitude:point.x,accuracy:"source_civic_address_point",provider:"niagara:addresses"};
const record=(f:NiagaraFeed,a:Row={},g:Row=point)=>({attributes:{...Object.fromEntries(Object.keys(f.fields).map(k=>[k,null])),[f.oid]:1,...a},geometry:g});
function provider(records:Record<string,unknown[]>={},changes:Record<string,Row|undefined>={}){return async(u:URL)=>{
  if(u.pathname.endsWith('/query')){const f=NIAGARA_FEEDS.find(f=>u.href.split('?')[0]===f.url+'/query');if(!f)throw Error('Unexpected query');
    if(u.searchParams.get('returnCountOnly')==='true')return {count:10,...changes.count};
    return {features:records[f.key]??(f.key==='ontarioMunicipality'?[record(f,{MUNICIPAL_NAME:'Niagara Falls'})]:[]),...changes[f.key]};}
  const original=Object.entries(fixture).find(([key])=>{const v=new URL(key);return v.origin===u.origin&&v.pathname===u.pathname&&v.searchParams.get('id')===u.searchParams.get('id');})?.[1];
  if(!original||typeof original==='string')throw Error('Unexpected metadata');
  const kind=u.pathname.endsWith(NIAGARA_GRANTS.falls.page+'/data')?'fallsGrant':u.pathname.endsWith(NIAGARA_GRANTS.falls.site+'/data')?'siteData':u.pathname.includes('/package_show')?(u.hostname==='data.ontario.ca'?'ontarioCatalogue':'regionalCatalogue'):u.pathname.includes('/sharing/')?'item':/\/(FeatureServer|MapServer)$/.test(u.pathname)?'root':'metadata';
  return {...original,...changes[kind]};
};}
beforeEach(()=>{json.mockReset().mockImplementation(provider());html.mockReset().mockImplementation(async(u:URL)=>{const v=fixture[u.href];if(typeof v!=='string')throw Error('Unexpected grant');return v;});});
afterEach(()=>vi.restoreAllMocks());
describe('Niagara licensed property evidence',()=>{
  it('requires exact publishers, endpoints, complete grants and typed children before queries',async()=>{
    for(const f of [feed('zoning79200'),feed('ontarioMunicipality')])await expect(niagaraMetadata(f)).resolves.toHaveProperty('sourceUpdatedAt');
    for(const change of [{item:{owner:'copy'}},{item:{access:'private'}},{item:{url:'https://other.invalid/FeatureServer'}},{item:{licenseInfo:'Public access only'}},{root:{serviceItemId:'other'}},{metadata:{fields:[]}},{metadata:{copyrightText:'Third party'}},{fallsGrant:{values:{}}},{siteData:{values:{pages:[]}}}]){json.mockClear().mockImplementation(provider({},change));await expect(niagaraMetadata(feed('zoning79200'))).rejects.toThrow();expect(json.mock.calls.some(([u])=>u.pathname.endsWith('/query'))).toBe(false);}
  });
  it('requires Ontario publisher, exact typed child, catalogue resource and complete grant',async()=>{
    const f=feed('ontarioMunicipality');
    for(const change of [{item:{owner:'copy'}},{item:{url:f.rootUrl}},{item:{licenseInfo:'Public access'}},{root:{mapName:'other'}},{root:{layers:[]}},{metadata:{id:13}},{metadata:{fields:[]}},{metadata:{copyrightText:'Third party'}},{ontarioCatalogue:{result:{}}}]){
      json.mockClear().mockImplementation(provider({},change));await expect(niagaraMetadata(f)).rejects.toThrow();expect(json.mock.calls.some(([u])=>u.pathname.endsWith('/query'))).toBe(false);
    }
    json.mockImplementation(provider());html.mockResolvedValue('Unavailable');await expect(niagaraMetadata(f)).rejects.toThrow();
  });
  it('disables every regional metadata, property and count read while hosted grant access is denied',async()=>{
    for(const f of NIAGARA_FEEDS.filter(f=>f.publisher==='region'))await expect(niagaraMetadata(f)).rejects.toThrow('records and counts are disabled');
    expect(await niagaraLocation({address:'12 King St W, Thorold, ON'})).toBeNull();expect(json).not.toHaveBeenCalled();expect(html).not.toHaveBeenCalled();
    const r=await niagaraLayers('12 King St W','Niagara Falls','ON',location);
    expect(r.settlementReference.status).toBe('unavailable');expect(r.wastewaterCatchment.data).toMatchObject({screenPerformed:false,recordsQueried:false});
    const calls=json.mock.calls.map(([u])=>u.href);expect(calls.some(u=>u.includes('WxiLK82TWf8W3O3f')||u.includes('niagaraopendata.ca'))).toBe(false);
    expect(niagaraMunicipality('Town of Niagara-on-the-Lake','Ontario')).toBe('Niagara-on-the-Lake');expect(niagaraMunicipality('St Catharines','ON')).toBe('St. Catharines');expect(niagaraMunicipality('Niagara Falls','BC')).toBeNull();
  });
  it('requires both Falls civic address and components and keeps conflicts/shared points unresolved',async()=>{
    const f=feed('municipalAddresses'),a={ADDRESS:'12 KING ST W',Street_No:'12',StreetName:'KING ST W'};json.mockImplementation(provider({municipalAddresses:[record(f,a)]}));expect((await niagaraLocation({address:'12 King Street West, Niagara Falls, ON'}))?.status).toBe('available');
    for(const [published,address]of [['ONTARIO AV','Ontario Avenue'],['MCDOUGALL CR','McDougall Crescent'],['NIAGARA RIVER PY','Niagara River Parkway']]){json.mockClear().mockImplementation(provider({municipalAddresses:[record(f,{ADDRESS:`12 ${published}`,Street_No:'12',StreetName:published})]}));expect((await niagaraLocation({address:`12 ${address}, Niagara Falls, ON`}))?.status).toBe('available');expect(json.mock.calls.find(([u])=>u.pathname.endsWith('/query'))?.[0].searchParams.get('where')).toContain(`12 ${published}`);}
    json.mockImplementation(provider({municipalAddresses:[record(f,{...a,StreetName:'KING RD W'})]}));expect(await niagaraLocation({address:'12 King St W, Niagara Falls, ON'})).toBeNull();
    json.mockImplementation(provider({municipalAddresses:[record(f,a),record(f,{...a,OBJECTID:2},{x:-79.1,y:43.11})]}));expect((await niagaraLocation({address:'12 King St W, Niagara Falls, ON'}))?.status).toBe('ambiguous');
    expect((await niagaraLocation({address:'12 King St W, Thorold, ON',city:'Niagara Falls'}))?.status).toBe('ambiguous');
    json.mockImplementation(provider({municipalAddresses:[record(f,a)]},{municipalAddresses:{exceededTransferLimit:true}}));expect(await niagaraLocation({address:'12 King St W, Niagara Falls, ON'})).toBeNull();
  });
  it('requires one matching municipal boundary and skips approximate/outside points before property calls',async()=>{
    const f=feed('ontarioMunicipality');for(const candidates of [[],[record(f,{MUNICIPAL_NAME:'Welland'})],[record(f,{MUNICIPAL_NAME:'Niagara Falls'}),record(f,{MUNICIPAL_NAME:'Niagara Falls',OBJECTID:2})]]){json.mockClear().mockImplementation(provider({ontarioMunicipality:candidates}));const r=await niagaraLayers('12 King St W','Niagara Falls','ON',location);expect(r.zoning.status).toBe('skipped');expect(json.mock.calls.filter(([u])=>u.pathname.endsWith('/query'))).toHaveLength(1);}
    for(const l of [{...location,accuracy:'street_interpolated'},{...location,latitude:44}]){json.mockClear();expect((await niagaraLayers('12 King St W','Niagara Falls','ON',l)).zoning.status).toBe('skipped');expect(json).not.toHaveBeenCalled();}
  });
  it('keeps completed permits, subject-point proposals and historical zoning separate from current approval',async()=>{
    const p=feed('permits'),a=feed('planningApplications'),z=feed('zoningB0395Willoughby');json.mockImplementation(provider({permits:[record(p,{Address:'12 KING ST W',Status:'Final',PermitDate:1429833600000,Year:2015,OWNER:'PRIVATE'})],planningApplications:[record(a,{Address:'12 KING ST W',ApplDesc:'Proposed warehouse',FileNumber:'AM-2025-018'})],zoningB0395Willoughby:[record(z,{BYLAW:'395(1966)'})]}));
    const r=await niagaraLayers('12 King St W','Niagara Falls','ON',location);expect(r.permits.data).toMatchObject({finalInspectionsVerified:false,currentOccupancyApprovalVerified:false,records:[expect.objectContaining({publishedStatus:'Final',publishedPermitDate:'2015-04-24T00:00:00.000Z'})]});expect(r.planningApplications.data).toMatchObject({nearbySearchPerformed:false,activeFileStatusEstablished:false,currentDecisionVerified:false});const legacy=(r.legacyZoning.data as Row).datasets as Record<string,{data:Row}>;expect(legacy.zoningB0395Willoughby.data).toMatchObject({historicalReference:true,currentApplicabilityVerified:false,legalPermissionsEstablished:false});expect(JSON.stringify(r)).not.toContain('PRIVATE');
    const brief=preShowingBrief(r,[]);expect(brief.findings.find(x=>x.layer==='planningApplications')?.summary).not.toContain('quarterly');expect(brief.findings.find(x=>x.layer==='legacyZoning')?.summary).toContain('Historical');
  });
  it('keeps City brownfield references separate from contamination, eligibility and grant approval',async()=>{
    json.mockImplementation(provider({brownfieldCIP:[record(feed('brownfieldCIP'))]}));const r=await niagaraLayers('12 King St W','Niagara Falls','ON',location);
    const cip=(r.communityImprovement.data as Row).datasets as Record<string,{data:Row}>;expect(cip.brownfieldCIP.data).toMatchObject({contaminationEstablished:false,remediationVerified:false,programEligibilityEstablished:false,grantApproved:false});expect(r.conservation.status).toBe('unavailable');expect(preShowingBrief(r,[]).documentsToRequest.some(x=>x.document.includes('brownfield'))).toBe(true);
  });
  it('retains municipal heritage evidence and unavailable regional scope in the same group',async()=>{
    json.mockImplementation(provider({municipalHeritageProperties:[record(feed('municipalHeritageProperties'),{STATUS:'LISTED'})]}));const r=await niagaraLayers('12 King St W','Niagara Falls','ON',location);
    expect(r.heritage.status).toBe('available');expect(r.heritage.data).toMatchObject({coverageComplete:false,enabledQueryCoverageComplete:false,datasets:{regionalHeritageProperties:{status:'unavailable'},municipalHeritageProperties:{status:'available'}}});
  });
  it('retains partial nested status, bounded truncation, source-date unknowns and no-match limits',async()=>{
    const f=feed('permits');json.mockImplementation(provider({permits:Array.from({length:51},(_,i)=>record(f,{OBJECTID:i+1,Address:'12 KING ST W'}))},{metadata:{editingInfo:{}}}));let r=await niagaraLayers('12 King St W','Niagara Falls','ON',location);expect(r.permits.truncated).toBe(true);expect((r.permits.data as Row).records).toHaveLength(50);expect(r.permits.data).toMatchObject({queryCoverageComplete:false,absenceEstablished:false});expect(r.permits.sourceUpdatedAt).toBeNull();expect(r.zoning.status).toBe('no_match');
    json.mockImplementation(provider({permits:[record(f,{Address:42})]}));r=await niagaraLayers('12 King St W','Niagara Falls','ON',location);expect(r.permits.status).toBe('unavailable');
    json.mockImplementation(provider({}, {permits:{exceededTransferLimit:true}}));expect((await niagaraLayers('12 King St W','Niagara Falls','ON',location)).permits.status).toBe('unavailable');
  });
  it('skips address histories for coordinate-only requests and never counts withheld sources',async()=>{
    const r=await niagaraLayers(null,'Niagara Falls','ON',{...location,accuracy:'caller_supplied'});expect(r.permits.status).toBe('skipped');expect(((r.heritage.data as Row).datasets as Record<string,{status:string}>).regionalHeritageProperties.status).toBe('unavailable');const c=await niagaraCoverage();expect(c.datasets).toHaveLength(23);expect(c.datasets.filter(x=>x.status==='verified')).toHaveLength(12);expect(c.datasets.filter(x=>x.status==='unavailable')).toHaveLength(11);expect(c.withheld).toHaveLength(10);expect(c.withheld.every(x=>x.records===null)).toBe(true);expect(NIAGARA_WITHHELD.every(f=>!json.mock.calls.some(([u])=>u.href.startsWith(f.url)))).toBe(true);expect(c.complete).toBe(false);
    const calls=json.mock.calls.filter(([u])=>u.pathname.endsWith('/query'));expect(calls.every(([u])=>!/(\*|PIN|OWNER|ROLL|contact|last_edited)/i.test(u.searchParams.get('outFields')??''))).toBe(true);
  });
  it('keeps all twelve municipalities partial and unresolved local sources explicit',async()=>{
    json.mockImplementation(provider({ontarioMunicipality:[record(feed('ontarioMunicipality'),{MUNICIPAL_NAME:'St. Catharines'})]}));const r=await niagaraLayers('12 King St W','St. Catharines','ON',{...location,city:'St. Catharines'});expect(r.permits.status).toBe('unavailable');expect(r.zoning.status).toBe('unavailable');expect(r.planningApplications.status).toBe('not_supported');
    for(const city of NIAGARA_MUNICIPALITIES){const m=ontarioMarketRoadmap().municipalities.find(m=>m.city===city)!;expect(m.configuredLayers).toContain('municipality');expect(m.configuredLayers).not.toContain('settlementReference');expect(m.withheldLayers.some(x=>x.layer==='settlementReference')).toBe(true);expect(m.complete).toBe(false);}expect(ontarioMarketRoadmap().majorMarketsComplete).toBe(false);
  });
});
