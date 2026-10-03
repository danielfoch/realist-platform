import { createHash } from "node:crypto";
import { load } from "cheerio/slim";
import { fetchJson, fetchText, literal, rows } from "./http";
import { civicStreetKey, cityKey, hasUnit, layer, number, streetNumber, text, type Layer, type Location, type PropertyRequest, type Row } from "./model";
import { provinceKey } from "./geocode";
import { arcgisDate, streetVariants } from "./hamilton";
import { haversineMeters } from "@/lib/geo/geometry";
import { NIAGARA_FEEDS, NIAGARA_GRANTS, NIAGARA_MUNICIPALITIES, NIAGARA_WITHHELD, type NiagaraFeed } from "./niagara-sources";

type Context = Map<string, Promise<Row>>;
const sha = (s:string) => createHash("sha256").update(s).digest("hex");
const normalized = (s:string) => load(s).text().replace(/\s+/g," ").trim();
const feed = (key:string) => NIAGARA_FEEDS.find(f=>f.key===key)!;
const municipalKey = (city:string) => cityKey(city).replace(/^(town|township) of\s+/,"").replace(/[.-]/g," ").replace(/\s+/g," ").trim();
function niagaraStreetKey(address:string):string {
  const civic=address.split(",")[0].replace(/\b(cr|py|pkwy)(?=\s*(?:[nesw]{1,2}|north|south|east|west)?\s*$)/gi,s=>s.toLowerCase()==="cr"?"crescent":"parkway");
  return civicStreetKey(civic);
}
function niagaraStreetVariants(address:string):string[] {
  let values=streetVariants(niagaraStreetKey(address));
  for(const [from,to] of [["AVE","AV"],["CRES","CR"],["PARKWAY","PY"],["PARKWAY","PKWY"]])values=[...new Set([...values,...values.map(s=>s.replace(new RegExp(`\\b${from}\\b`,"g"),to))])].slice(0,128);
  return values;
}
export function niagaraMunicipality(city:string|null,province:string|null):string|null {
  if(provinceKey(province??"")!=="ontario")return null;
  return NIAGARA_MUNICIPALITIES.find(c=>municipalKey(c)===municipalKey(city??""))??null;
}
async function get(url:string,params:Record<string,string>={}):Promise<Row> {
  const u=new URL(url);Object.entries({...(!u.pathname.startsWith("/api/3/action/")?{f:"json"}:{}),...params}).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetchJson(new URL(u.href.replace(/\+/g,"%20")))as Row;
  if(!r||typeof r!=="object"||Array.isArray(r)||r.error)throw new Error("Niagara source unavailable");return r;
}
function read(c:Context,url:string,run=()=>get(url)):Promise<Row> {
  const pending=c.get(url)??run().catch(error=>{
    if(error instanceof Error&&error.message.startsWith("Niagara "))throw error;
    const publicUrl=new URL(url);throw new Error(`Niagara public-source read failed at ${publicUrl.hostname}${publicUrl.pathname}: ${error instanceof Error&&/^Source unavailable \(HTTP \d{3}\)$/.test(error.message)?error.message:error instanceof Error?error.name:"unknown"}`);
  });c.set(url,pending);return pending;
}
function sourceFailure(f:NiagaraFeed,error:unknown) {
  // Only local validation codes and public-source HTTP status codes enter logs.
  const message=error instanceof Error?error.message:"unknown";
  const reason=message.startsWith("Niagara ")||message.startsWith("Exact licensed")||message.startsWith("Original Ontario")||message.startsWith("Publisher,")||/^HTTP \d{3}$/.test(message)?message:"bounded_fetch_or_invalid_response";
  console.warn("Niagara property source unavailable",{feed:f.key,reason});
}
function markdown(d:Row):string {
  const sections=rows(((d.values as Row|undefined)?.layout as Row|undefined)?.sections??[]);
  return sections.flatMap(s=>rows(s.rows).flatMap(r=>rows(r.cards).map(x=>((x.component as Row|undefined)?.settings as Row|undefined)?.markdown??""))).map(v=>{
    if(typeof v!=="string")throw new Error("Grant text missing");return v;
  }).join(" ");
}
async function htmlGrant(c:Context,b:{url:string;selector:string;hash:string}) {
  const result=await read(c,b.url,async()=>{
    const $=load(await fetchText(new URL(b.url))),sections=$(b.selector);
    const observed=sha(sections.text().replace(/\s+/g," ").trim());
    if(sections.length!==1||observed!==b.hash)throw new Error(`Niagara complete grant changed at ${new URL(b.url).hostname}: sections=${sections.length}, hash=${observed}`);
    return {hash:b.hash};
  });
  if(result.hash!==b.hash)throw new Error("Grant unavailable");
}
async function fallsGrant(c:Context) {
  const b=NIAGARA_GRANTS.falls,base="https://www.arcgis.com/sharing/rest/content/items/";
  const [site,siteData,page,pageData]=await Promise.all([read(c,base+b.site),read(c,base+b.site+"/data"),read(c,base+b.page),read(c,base+b.page+"/data")]);
  const pages=rows((siteData.values as Row|undefined)?.pages??[]);
  if(![site,page].every(i=>i.owner===b.owner&&i.orgId===b.org&&i.access==="public")||site.id!==b.site||site.title!==b.siteTitle||page.id!==b.page||page.title!==b.pageTitle||!pages.some(p=>p.id===b.page&&p.slug==="terms-of-use")||sha(normalized(markdown(pageData)))!==b.hash)throw new Error("City full licence or site binding changed");
}
async function regionalGrant(f:NiagaraFeed,c:Context) {
  const b=f.catalogue,url=`https://niagaraopendata.ca/dataset/${b.name}`;
  // The official catalogue publishes the same individual licence and resource
  // bindings in JSON-LD. Its action API denies hosted requests; do not call it.
  await read(c,url,async()=>{
    const $=load(await fetchText(new URL(url))),scripts=$('script[type="application/ld+json"]');
    if(scripts.length!==1)throw new Error("Exact licensed regional catalogue binding changed");
    const graph=rows((JSON.parse(scripts.text()) as Row)["@graph"]),matches=graph.filter(d=>d["@type"]==="schema:Dataset");
    const d=matches[0],publisher=graph.filter(n=>n["@id"]===(d?.["schema:publisher"] as Row|undefined)?.["@id"]),distribution=rows(d?.["schema:distribution"]??[]).map(n=>n["@id"]);
    const resource=graph.filter(n=>distribution.includes(n["@id"])&&n["@type"]==="schema:DataDownload"&&n["schema:url"]===f.url),licence=$('section.license a[rel="dc:rights"]');
    if(matches.length!==1||d["@id"]!==`https://niagaraopendata.ca/dataset/${b.id}`||d["schema:url"]!==url||d["schema:name"]!==b.title||d["schema:license"]!==b.licenceUrl||publisher.length!==1||publisher[0]["@type"]!=="schema:Organization"||publisher[0]["schema:name"]!=="Niagara Region"||!$(`a[href="/organization/${b.organizationName}"]`).length||licence.length!==1||licence.attr("href")!==b.licenceUrl||licence.text().replace(/\s+/g," ").trim()!=="Open Government License 2.0 (Niagara Region)"||resource.length!==1||!$('li.resource-item a').toArray().some(a=>$(a).attr("href")===f.url)||$('#dataset-name').attr('dataset-name')!==b.title)throw new Error("Exact licensed regional catalogue binding changed");
    if(b.descriptionHash && (typeof d["schema:description"]!=="string" || sha(String(d["schema:description"]).replace(/\s+/g," ").trim())!==b.descriptionHash))throw new Error("Niagara inspected draft-inventory description changed");
    return {verified:true};
  });
  await htmlGrant(c,NIAGARA_GRANTS.region);
  if(f.key==="municipality") {
    // The Region explicitly credits Ontario for the original municipal boundaries.
    const b=NIAGARA_GRANTS.ontario,response=await read(c,b.catalogue),d=response.result as Row|undefined;
    if(response.success!==true||!d||d.id!==b.catalogueId||d.name!=="municipal-boundaries"||d.state!=="active"||d.license_id!=="OGL-ON-1.0"||d.license_url!==b.url||!rows(d.resources).some(r=>r.url==="https://geohub.lio.gov.on.ca/datasets/municipal-boundary-lower-and-single-tier"))throw new Error("Original Ontario boundary grant changed");
    await htmlGrant(c,b);
  }
}
export async function niagaraMetadata(f:NiagaraFeed,c:Context=new Map()) {
  const [item,m,root]=await Promise.all([read(c,`https://www.arcgis.com/sharing/rest/content/items/${f.item}`),read(c,f.url),read(c,f.rootUrl)]);
  const terms=typeof item.licenseInfo==="string"?item.licenseInfo:"";
  if(item.id!==f.item||item.owner!==f.owner||item.orgId!==f.org||item.access!=="public"||item.title!==f.expectedItemTitle||item.url!==f.rootUrl||root.serviceItemId!==f.item||sha(normalized(terms))!==f.termsHash||m.name!==f.expectedLayerName||m.geometryType!==f.geometry||(m.copyrightText??"")!==f.expectedCopyright||m.objectIdField!==f.oid||!Object.entries(f.fieldTypes).every(([name,type])=>rows(m.fields).some(x=>x.name===name&&x.type===type)))throw new Error("Publisher, endpoint, terms or typed child changed");
  if(f.publisher==="falls") {
    const anchors=load(terms)("a");
    if(anchors.length!==1||anchors.attr("href")!=="https://open.niagarafalls.ca/pages/terms-of-use")throw new Error("Exact City grant referral changed");
    await fallsGrant(c);
  }else await regionalGrant(f,c);
  return {sourceUpdatedAt:arcgisDate((m.editingInfo as Row|undefined)?.dataLastEditDate)};
}
function point(g:Row|null):g is Row&{x:number;y:number} {
  return typeof g?.x==="number"&&typeof g.y==="number"&&g.y>42.7&&g.y<43.4&&g.x> -79.95&&g.x< -78.8;
}
function precise(l:Location|null):l is Location&{latitude:number;longitude:number} {
  return Boolean(l&&point({x:l.longitude,y:l.latitude})&&["source_building_point","source_civic_address_point","caller_supplied"].includes(l.accuracy));
}
function features(r:Row,f:NiagaraFeed) {
  return rows(r.features).map(x=>{
    const a=x.attributes as Row;
    if(!a||typeof a!=="object"||Array.isArray(a)||!Object.entries(f.fieldTypes).every(([k,t])=>{
      if(!(k in a))return false;const v=a[k];if(k===f.oid)return typeof v==="number"&&Number.isInteger(v)&&v>0;
      return v===null||(t==="esriFieldTypeString"?typeof v==="string":typeof v==="number"&&Number.isFinite(v));
    }))throw new Error("Invalid typed source record");
    return {a:Object.fromEntries(Object.keys(f.fields).map(k=>[k,a[k]])),g:x.geometry&&typeof x.geometry==="object"&&!Array.isArray(x.geometry)?x.geometry as Row:null};
  });
}
function mapped(a:Row,f:NiagaraFeed):Row {return Object.fromEntries(Object.entries(f.fields).map(([k,v])=>[v,f.dates.includes(k)?arcgisDate(a[k]):a[k]]));}
function civic(a:Row,f:NiagaraFeed):string {
  return f.publisher==="falls"?text(a.ADDRESS)??"":`${text(a.Full_StreetNo)??""} ${text(a.StreetName)??""} ${text(a.StreetType)??""} ${text(a.StreetDir)??""}`.replace(/\s+/g," ").trim();
}
export async function niagaraLocation(input:PropertyRequest):Promise<Layer<Location>|null> {
  const city=input.city??input.address?.split(",")[1]?.trim()??null,province=input.province??input.address?.split(",")[2]?.trim()??"ON",market=niagaraMunicipality(city,province);
  if(!market||!input.address||input.lat!==undefined||hasUnit(input.address))return null;
  const f=feed(market==="Niagara Falls"?"municipalAddresses":"addresses"),embedded=input.address.split(",")[1]?.trim();
  if(input.city&&embedded&&niagaraMunicipality(embedded,province)!==market)return layer("ambiguous",null,f.source,"The explicit municipality conflicts with the civic community. Correct identity before screening.");
  const address=input.address.split(",")[0].trim(),n=streetNumber(address);if(!n)return null;
  try {
    const m=await niagaraMetadata(f),municipalVariants=[...new Set([market,market.replace(/\./g,""),market.replace(/-/g," ")].map(s=>s.toUpperCase()))];
    const where=f.publisher==="falls"?`UPPER(Street_No) = ${literal(n.toUpperCase())} AND UPPER(ADDRESS) IN (${niagaraStreetVariants(address).map(literal).join(",")})`:`UPPER(Full_StreetNo) = ${literal(n.toUpperCase())} AND UPPER(Municipality) IN (${municipalVariants.map(literal).join(",")})`;
    const r=await get(f.url+"/query",{where,outFields:Object.keys(f.fields).join(","),returnGeometry:"true",outSR:"4326",resultRecordCount:"501",orderByFields:f.oid});
    const all=features(r,f);if(r.exceededTransferLimit||all.length>=501)throw new Error("Incomplete civic candidates");
    const exact=all.filter(({a})=>niagaraStreetKey(civic(a,f))===niagaraStreetKey(address)&&(f.publisher==="falls"?niagaraStreetKey(`${text(a.Street_No)??""} ${text(a.StreetName)??""}`)===niagaraStreetKey(address):niagaraMunicipality(text(a.Municipality),"ON")===market&&a.LifeCycleStatus==="Active"&&(!text(a.Qualifier)||String(a.Qualifier).toUpperCase()===n.slice(-1).toUpperCase())));
    if(!exact.length)return null;const primary=exact.find(({a})=>!text(a.Unit))??exact[0];
    if(!point(primary.g)||exact.some(({g})=>!point(g)||haversineMeters(primary.g!.y as number,primary.g!.x as number,g.y,g.x)>20))return layer("ambiguous",null,f.source,"Matching civic points are unusable or disagree by more than 20 metres. No arbitrary point is selected.",m.sourceUpdatedAt);
    const result=layer("available",{address:civic(primary.a,f),city:market,province:"ON",latitude:primary.g.y,longitude:primary.g.x,accuracy:"source_civic_address_point",provider:f.source.id,municipalAddress:{recordIds:exact.map(({a})=>String(a[f.oid])),community:market,permitAddressKeys:[civicStreetKey(address)],source:f.source,sourceUpdatedAt:m.sourceUpdatedAt,publishedRecords:exact.slice(0,50).map(({a})=>mapped(a,f)),publishedAddressRecordCount:exact.length,publishedRecordsTruncated:exact.length>50}},f.source,f.note+" Civic suffix, street type and direction must agree. A unique licensed regional polygon must confirm the municipality before property queries.",m.sourceUpdatedAt);result.truncated=exact.length>50;return result;
  }catch(error){sourceFailure(f,error);return null;}
}
async function query(f:NiagaraFeed,l:Location|null,address:string|null,market:string,c:Context):Promise<Layer> {
  if(!precise(l))return layer("skipped",null,f.source,"A precise civic, building or caller point is required; interpolated points are not screened.");
  if(f.matchField&&(!address||!streetNumber(address)))return layer("skipped",null,f.source,"An exact civic building address is required; coordinate-only requests do not search address histories.");
  try {
    const m=await niagaraMetadata(f,c),byAddress=Boolean(f.matchField);
    const r=await get(f.url+"/query",{where:byAddress?`UPPER(${f.matchField}) IN (${niagaraStreetVariants(address!).map(literal).join(",")})`:"1=1",...(!byAddress?{geometry:`${l.longitude},${l.latitude}`,geometryType:"esriGeometryPoint",inSR:"4326",spatialRel:"esriSpatialRelIntersects"}:{}),outFields:Object.keys(f.fields).join(","),returnGeometry:f.key==="regionalHeritageProperties"?"true":"false",outSR:"4326",resultRecordCount:"51",orderByFields:f.key==="permits"?`PermitDate DESC,${f.oid} DESC`:f.oid});
    const all=features(r,f);if(!all.length&&r.exceededTransferLimit)throw new Error("Incomplete empty query");
    const exact=byAddress?all.filter(({a})=>typeof a[f.matchField!]==="string"&&!String(a[f.matchField!]).includes(",")&&niagaraStreetKey(String(a[f.matchField!]))===niagaraStreetKey(address!)&&(f.key!=="regionalHeritageProperties"||niagaraMunicipality(text(a.MUNICIPALITY),"ON")===market)):all;
    const truncated=Boolean(r.exceededTransferLimit||all.length>50);
    const separation=f.key==="regionalHeritageProperties"?exact.map(({g})=>point(g)?haversineMeters(l.latitude,l.longitude,g.y,g.x):null):null;
    if(separation?.some(n=>n===null||n>100)){const result=layer("ambiguous",{candidateRecords:exact.slice(0,50).map(({a})=>mapped(a,f)),sourcePointSeparationsM:separation.slice(0,50),coverageComplete:false,absenceEstablished:false},f.source,"Exact-address regional heritage points disagree with the property point or have unusable geometry. Confirm current parcel identity before assigning heritage status.",m.sourceUpdatedAt);result.truncated=truncated;return result;}
    const result=layer(exact.length?"available":"no_match",{records:exact.slice(0,50).map(({a})=>mapped(a,f)),matchMethod:byAddress?"exact_normalized_civic_address":"published_polygon_intersects_point",scope:byAddress?"building_or_site_address":"subject_point",screenedPoint:{latitude:l.latitude,longitude:l.longitude,accuracy:l.accuracy},...(separation?{sourcePointSeparationsM:separation}:{}),coverageComplete:false,queryCoverageComplete:!truncated,absenceEstablished:false,parcelWideScreenPerformed:false,
      ...(f.key==="permits"?{fullHistorySearched:false,finalInspectionsVerified:false,currentOccupancyApprovalVerified:false,unitLegalityEstablished:false}:{}),
      ...(f.key==="planningApplications"?{nearbySearchPerformed:false,fullHistorySearched:false,activeFileStatusEstablished:false,currentDecisionVerified:false,municipalApprovalEstablished:false}:{}),
      ...(["zoning","legacyZoning"].includes(f.group)?{fullCurrentZoningScreenPerformed:false,currentAmendmentsVerified:false,currentAppealsVerified:false,legalPermissionsEstablished:false}:{}),
      ...(f.group==="legacyZoning"?{historicalReference:true,currentApplicabilityVerified:false}:{}),
      ...(f.group==="heritage"?{fullHeritageScreenPerformed:false,currentRegisterVerified:false,currentDesignationBylawVerified:false}:{}),
      ...(f.group==="officialPlan"||f.group==="settlementReference"?{currentPlanScreenPerformed:false,currentAmendmentsVerified:false,inForcePolicyEstablished:false}:{}),
      ...(f.group==="naturalEnvironmentReference"||f.group==="watersheds"?{currentPolicyEstablished:false,conservationAuthorityRegulatoryScreenPerformed:false,floodRiskEstablished:false,environmentalClearanceEstablished:false}:{}),
      ...(f.key==="draftWetlandReference"?{providerDraftLabel:"DRAFT",currentInventoryStatusVerified:false}:{}),
      ...(f.key==="wastewaterCatchment"?{actualConnectionEstablished:false,availableCapacityEstablished:false,servicingEligibilityEstablished:false}:{}),
      ...(f.key==="brownfieldCIP"?{contaminationEstablished:false,remediationVerified:false,programEligibilityEstablished:false,fundingAvailabilityEstablished:false,grantApproved:false}:{})},f.source,f.note+" Source update time remains unknown if editingInfo is unpublished. No-match does not establish absence.",m.sourceUpdatedAt);result.truncated=truncated;return result;
  }catch(error){sourceFailure(f,error);return layer("unavailable",null,f.source,"The complete inspected grant, exact publisher/catalogue/endpoint, typed schema or bounded source query could not be verified. No factual result is returned.");}
}
function grouped(name:string,pending:NiagaraFeed[],entries:Record<string,Layer>):Layer {
  const feeds=pending.filter(f=>f.group===name),datasets=Object.fromEntries(feeds.map(f=>[f.key,entries[f.key]])),values=Object.values(datasets);
  const status=values.some(v=>v.status==="available")?"available":values.some(v=>v.status==="ambiguous")?"ambiguous":values.some(v=>v.status==="unavailable")?"unavailable":values.every(v=>v.status==="skipped")?"skipped":"no_match";
  const result=layer(status,{datasets,coverageComplete:false,enabledQueryCoverageComplete:values.every(v=>["available","no_match"].includes(v.status)&&!v.truncated),absenceEstablished:false,parcelWideScreenPerformed:false,currentAmendmentsVerified:false,currentAppealsVerified:false,legalPermissionsEstablished:false,currentPlanScreenPerformed:false,inForcePolicyEstablished:false,fullHeritageScreenPerformed:false,currentRegisterVerified:false,currentPolicyEstablished:false,conservationAuthorityRegulatoryScreenPerformed:false,environmentalClearanceEstablished:false},{...feeds[0].source,id:`niagara:${name}`,name:`Niagara ${name} source references`},"Partial source evidence at the subject point or exact civic address. Read each nested status, scope, date and truncation. Legal instruments, current permissions, full registers and parcel-wide conditions remain unverified.");result.truncated=values.some(v=>v.truncated);return result;
}
export async function niagaraLayers(address:string|null,city:string|null,province:string|null,l:Location|null,requestedCity?:string):Promise<Record<string,Layer>> {
  const market=niagaraMunicipality(requestedCity??city,province);if(!market)return {};
  const c:Context=new Map(),f=feed("municipality");let boundary=await query(f,l,null,market,c);
  const records=rows((boundary.data as Row|null)?.records??[]),agrees=boundary.status==="available"&&!boundary.truncated&&records.length===1&&niagaraMunicipality(text(records[0].publishedName),"ON")===market;
  if(boundary.status==="available"&&!agrees)boundary=layer("ambiguous",{...boundary.data as Row,expectedMunicipality:market},f.source,"The regional municipality polygon is non-unique or conflicts with the request. No property queries are performed.",boundary.sourceUpdatedAt);
  const pending=NIAGARA_FEEDS.filter(f=>!["addresses","municipalAddresses","municipality"].includes(f.key)&&(f.publisher==="region"||market==="Niagara Falls")),pairs:(readonly[string,Layer])[]=[];
  for(let i=0;i<pending.length;i+=4)pairs.push(...await Promise.all(pending.slice(i,i+4).map(async f=>[f.key,agrees?await query(f,l,address,market,c):layer("skipped",null,f.source,"A precise point and unique matching Niagara municipality polygon were not confirmed; no property query was performed.")]as const)));
  const entries=Object.fromEntries(pairs),direct=Object.fromEntries(pending.filter(f=>f.key===f.group).map(f=>[f.key,entries[f.key]])),groups=Object.fromEntries([...new Set(pending.filter(f=>f.key!==f.group).map(f=>f.group))].map(name=>[name,grouped(name,pending,entries)]));
  const withheld=NIAGARA_WITHHELD.filter(f=>[market,"Niagara Region"].includes(f.market)),gaps:Record<string,Layer>=Object.fromEntries([...new Set(withheld.map(f=>f.layer))].filter(k=>!groups[k]&&!direct[k]&&k!=="municipalBoundary").map(k=>[k,layer("unavailable",{coverageComplete:false,screenPerformed:false,withheld:withheld.filter(f=>f.layer===k)},null,"Unverified or excluded source. No property records or counts are queried from this feed.")]));
  for(const k of ["permits","zoning","planningApplications","officialPlan","variance"])if(!groups[k]&&!direct[k]&&!gaps[k])gaps[k]=layer("not_supported",{coverageComplete:false,screenPerformed:false},null,"Current municipal core records are not connected in this Niagara batch. Regional references do not complete municipal history, decisions, inspections or legal permissions.");
  return {municipality:boundary,...direct,...groups,...gaps,development:layer("not_supported",{nearbySearchPerformed:false,fullPlanningHistorySearched:false},null,"Nearby proposals and complete decisions/appeals/history remain unsearched. Niagara Falls subject-point application polygons are separate evidence.")};
}
export async function niagaraCoverage() {
  const c:Context=new Map(),datasets=[];
  const inspect=async(f:NiagaraFeed)=>{try{const m=await niagaraMetadata(f,c),r=await get(f.url+"/query",{where:"1=1",returnCountOnly:"true"}),count=number(r.count);if(count===null||!Number.isInteger(count)||count<0)throw new Error("Invalid count");return{market:f.market,layer:f.key,group:f.group,status:"verified",records:count,source:f.source,sourceUpdatedAt:m.sourceUpdatedAt,note:f.note};}catch(error){sourceFailure(f,error);return{market:f.market,layer:f.key,group:f.group,status:"unavailable",records:null,source:f.source,note:"Complete grant, exact source/catalogue binding, typed schema or live count could not be verified."};}};
  for(let i=0;i<NIAGARA_FEEDS.length;i+=4)datasets.push(...await Promise.all(NIAGARA_FEEDS.slice(i,i+4).map(inspect)));
  return {cities:[...NIAGARA_MUNICIPALITIES],auditDate:"2026-10-03",delivery:"cached_live_queries",cacheSeconds:3600,datasets,withheld:NIAGARA_WITHHELD.map(f=>({...f,status:"withheld",records:null})),complete:false,guidance:{catalogue:"https://niagaraopendata.ca/dataset/",niagaraPlan:"https://www.niagararegion.ca/official-plan/default.aspx",niagaraAmendments:"https://www.niagararegion.ca/official-plan/amendments.aspx",fallsCatalogue:"https://open.niagarafalls.ca/",fallsZoning:"https://niagarafalls.ca/building-planning-and-business/planning-and-development/zoning/",npca:"https://npca.ca/services/permits"},note:"Selected Niagara regional civic, heritage, settlement, draft wetland/woodland, watershed and rough sanitary-catchment references; Niagara Falls adds completed permits, subject-point planning, heritage, 79-200 zoning and three historical former-township zoning datasets, plan/special-policy and brownfield CIP references. Since March 31, 2025 the Niagara Official Plan belongs to the twelve local municipalities; current local instruments/amendments remain unverified. St. Catharines full City grant is unresolved. Other municipalities' core sources require continued audit. Rows overlap and are not unique properties, data points or database imports."};
}
