import { createHash } from "node:crypto";
import { load } from "cheerio/slim";
import { fetchJson, literal, rows } from "./http";
import { civicStreetKey, cityKey, hasUnit, layer, number, streetNumber, text, type Layer, type Location, type PropertyRequest, type Row } from "./model";
import { provinceKey } from "./geocode";
import { arcgisDate, streetVariants } from "./hamilton";
import { haversineMeters } from "@/lib/geo/geometry";
import { WELLAND_FEEDS, WELLAND_GRANT, WELLAND_WITHHELD, type WellandFeed } from "./welland-sources";

type Context=Map<string,Promise<Row>>;
const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
const normalized=(s:string)=>load(s).text().replace(/\s+/g," ").trim();
const feed=(key:string)=>WELLAND_FEEDS.find(f=>f.key===key)!;
export function wellandMarket(city:string|null,province:string|null):boolean { return cityKey(city??"")==="welland"&&provinceKey(province??"")==="ontario"; }
async function get(url:string,params:Record<string,string>={}):Promise<Row> {
  const u=new URL(url);Object.entries({f:"json",...params}).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetchJson(new URL(u.href.replace(/\+/g,"%20")))as Row;
  if(!r||typeof r!=="object"||Array.isArray(r)||r.error)throw new Error("Welland source unavailable");return r;
}
function read(c:Context,url:string):Promise<Row> { const p=c.get(url)??get(url);c.set(url,p);return p; }
function sourceFailure(f:WellandFeed,error:unknown) {
  const message=error instanceof Error?error.message:"unknown";
  console.warn("Welland property source unavailable",{feed:f.key,reason:message.startsWith("Welland ")||/^Source unavailable \(HTTP \d{3}\)$/.test(message)?message:"bounded_fetch_or_invalid_response"});
}
function markdown(d:Row):string {
  return rows(((d.values as Row|undefined)?.layout as Row|undefined)?.sections??[]).flatMap(s=>rows(s.rows).flatMap(r=>rows(r.cards).map(x=>((x.component as Row|undefined)?.settings as Row|undefined)?.markdown??""))).map(v=>{if(typeof v!=="string")throw Error("Welland grant text missing");return v;}).join(" ");
}
async function grant(c:Context) {
  const b=WELLAND_GRANT,base="https://www.arcgis.com/sharing/rest/content/items/";
  const [site,siteData,page,pageData]=await Promise.all([read(c,base+b.site),read(c,base+b.site+"/data"),read(c,base+b.page),read(c,base+b.page+"/data")]);
  const v=siteData.values as Row|undefined;
  if(![site,page].every(i=>i.owner===b.owner&&i.orgId===b.org&&i.access==="public")||site.id!==b.site||site.type!=="Hub Site Application"||site.title!==b.siteTitle||site.url!==b.siteUrl||page.id!==b.page||page.type!=="Hub Page"||page.title!==b.pageTitle||v?.customHostname!==b.customHostname||v.defaultHostname!==b.defaultHostname||v.internalUrl!==b.defaultHostname||!rows(v.pages??[]).some(p=>p.id===b.page&&p.slug==="terms-of-use")||!rows((pageData.values as Row|undefined)?.sites??[]).some(s=>s.id===b.site&&s.title===b.siteTitle)||sha(normalized(markdown(pageData)))!==b.hash)throw Error("Welland complete licence or City site/page binding changed");
}
export async function wellandMetadata(f:WellandFeed,c:Context=new Map()) {
  const [item,root,m]=await Promise.all([read(c,`https://www.arcgis.com/sharing/rest/content/items/${f.item}`),read(c,f.rootUrl),read(c,f.url)]);
  const terms=typeof item.licenseInfo==="string"?item.licenseInfo:"",anchors=load(terms)("a");
  if(item.id!==f.item||item.owner!==WELLAND_GRANT.owner||item.orgId!==WELLAND_GRANT.org||item.access!=="public"||item.title!==f.expectedItemTitle||item.url!==f.itemUrl||root.serviceItemId!==f.serviceItem||!rows(root.layers??[]).some(x=>x.id===f.child&&x.name===f.expectedLayerName)||(root.copyrightText??"")!==f.expectedRootCopyright||sha(normalized(String(root.description??"")))!==f.rootDescriptionHash||m.serviceItemId!==f.serviceItem||m.id!==f.child||m.type!=="Feature Layer"||m.name!==f.expectedLayerName||m.geometryType!==f.geometry||(m.copyrightText??"")!==f.expectedCopyright||sha(normalized(String(m.description??"")))!==f.descriptionHash||(m.objectIdField!==undefined&&m.objectIdField!==f.oid)||!Object.entries(f.fieldTypes).every(([name,type])=>rows(m.fields).some(x=>x.name===name&&x.type===type))||sha(normalized(terms))!==f.termsHash||anchors.length!==1||anchors.attr("href")!==WELLAND_GRANT.licenceUrl)throw Error("Welland exact publisher, endpoint, grant referral, lineage or typed child changed");
  await grant(c);
  return {sourceUpdatedAt:arcgisDate((m.editingInfo as Row|undefined)?.dataLastEditDate)};
}
function point(g:Row|null):g is Row&{x:number;y:number} {return typeof g?.x==="number"&&typeof g.y==="number"&&Number.isFinite(g.x)&&Number.isFinite(g.y)&&g.y>42.7&&g.y<43.4&&g.x> -79.95&&g.x< -78.8;}
function precise(l:Location|null):l is Location&{latitude:number;longitude:number} {return Boolean(l&&point({x:l.longitude,y:l.latitude})&&["source_building_point","source_civic_address_point","caller_supplied"].includes(l.accuracy));}
function features(r:Row,f:WellandFeed) {
  return rows(r.features).map(x=>{
    const a=x.attributes as Row;
    if(!a||typeof a!=="object"||Array.isArray(a)||!Object.entries(f.fieldTypes).every(([k,t])=>{if(!(k in a))return false;const v=a[k];return k===f.oid?typeof v==="number"&&Number.isInteger(v)&&v>0:v===null||(t==="esriFieldTypeString"?typeof v==="string":typeof v==="number"&&Number.isFinite(v));}))throw Error("Welland invalid typed record");
    return {a:Object.fromEntries(Object.keys(f.fields).map(k=>[k,a[k]])),g:x.geometry&&typeof x.geometry==="object"&&!Array.isArray(x.geometry)?x.geometry as Row:null};
  });
}
function mapped(a:Row,f:WellandFeed):Row {return Object.fromEntries(Object.entries(f.fields).map(([k,v])=>[v,f.dates.includes(k)?arcgisDate(a[k]):a[k]]));}
export async function wellandLocation(input:PropertyRequest):Promise<Layer<Location>|null> {
  const city=input.city??input.address?.split(",")[1]?.trim()??null,province=input.province??input.address?.split(",")[2]?.trim()??"ON";
  if(!wellandMarket(city,province)||!input.address||input.lat!==undefined||hasUnit(input.address))return null;
  const f=feed("addresses"),embedded=input.address.split(",")[1]?.trim();
  if(input.city&&embedded&&!wellandMarket(embedded,province))return layer("ambiguous",null,f.source,"The explicit municipality conflicts with the civic community. Correct identity before screening.");
  const address=input.address.split(",")[0].trim(),n=streetNumber(address);if(!n)return null;
  try {
    const m=await wellandMetadata(f),r=await get(f.url+"/query",{where:`Civic_No = ${Number.parseInt(n,10)}`,outFields:Object.keys(f.fields).join(","),returnGeometry:"true",outSR:"4326",resultRecordCount:"501",orderByFields:f.oid}),all=features(r,f);
    if(r.exceededTransferLimit||all.length>=501)throw Error("Welland incomplete civic candidates");
    const exact=all.filter(({a})=>typeof a.Address==="string"&&!a.Address.includes(",")&&civicStreetKey(a.Address)===civicStreetKey(address)&&civicStreetKey(`${text(a.CivicNoLbl)??""} ${text(a.StName)??""}`)===civicStreetKey(address)&&`${a.Civic_No}${text(a.Suffix)??""}`.toUpperCase()===n.toUpperCase());
    if(!exact.length)return null;const first=exact[0];
    if(!point(first.g)||exact.some(({g})=>!point(g)||haversineMeters(first.g!.y as number,first.g!.x as number,g.y,g.x)>20))return layer("ambiguous",null,f.source,"Matching civic points are unusable or disagree by more than 20 metres. No arbitrary point is selected.",m.sourceUpdatedAt);
    const result=layer("available",{address:String(first.a.Address),city:"Welland",province:"ON",latitude:first.g.y,longitude:first.g.x,accuracy:"source_civic_address_point",provider:f.source.id,municipalAddress:{recordIds:exact.map(({a})=>String(a[f.oid])),community:"Welland",permitAddressKeys:[civicStreetKey(address)],source:f.source,sourceUpdatedAt:m.sourceUpdatedAt,publishedRecords:exact.slice(0,50).map(({a})=>mapped(a,f)),publishedAddressRecordCount:exact.length,publishedRecordsTruncated:exact.length>50}},f.source,f.note+" A unique licensed original Ontario polygon must confirm Welland before property queries.",m.sourceUpdatedAt);result.truncated=exact.length>50;return result;
  }catch(error){sourceFailure(f,error);return null;}
}
async function query(f:WellandFeed,l:Location&{latitude:number;longitude:number},address:string|null,c:Context):Promise<Layer> {
  if(f.matchField&&(!address||hasUnit(address)||!streetNumber(address)))return layer("skipped",null,f.source,"An exact building civic address is required; coordinate-only requests do not search address histories.");
  try {
    const m=await wellandMetadata(f,c),byAddress=Boolean(f.matchField),r=await get(f.url+"/query",{where:byAddress?`UPPER(${f.matchField}) IN (${streetVariants(civicStreetKey(address!)).map(literal).join(",")})`:"1=1",...(!byAddress?{geometry:`${l.longitude},${l.latitude}`,geometryType:"esriGeometryPoint",inSR:"4326",spatialRel:"esriSpatialRelIntersects"}:{}),outFields:Object.keys(f.fields).join(","),returnGeometry:"false",resultRecordCount:"51",orderByFields:f.key==="sitePlans"?`DateRecd DESC,${f.oid} DESC`:f.oid});
    const all=features(r,f);if(!all.length&&r.exceededTransferLimit)throw Error("Welland incomplete empty query");
    const exact=byAddress?all.filter(({a})=>typeof a[f.matchField!]==="string"&&!String(a[f.matchField!]).includes(",")&&!hasUnit(String(a[f.matchField!]))&&civicStreetKey(String(a[f.matchField!]))===civicStreetKey(address!)):all,truncated=Boolean(r.exceededTransferLimit||all.length>50);
    const result=layer(exact.length?"available":"no_match",{records:exact.slice(0,50).map(({a})=>mapped(a,f)),matchMethod:byAddress?"exact_normalized_civic_address":"published_polygon_intersects_point",scope:byAddress?"building_or_site_address":"subject_point",screenedPoint:{latitude:l.latitude,longitude:l.longitude,accuracy:l.accuracy},coverageComplete:false,queryCoverageComplete:!truncated,absenceEstablished:false,parcelWideScreenPerformed:false,
      ...(["zoning","legacyZoning"].includes(f.group)?{fullCurrentZoningScreenPerformed:false,currentApplicabilityVerified:false,applicationTransitionVerified:false,currentAmendmentsVerified:false,currentAppealsVerified:false,legalPermissionsEstablished:false}:{}),
      ...(f.group==="legacyZoning"?{historicalReference:true}:{}),
      ...(f.group==="officialPlan"?{currentPlanScreenPerformed:false,currentAmendmentsVerified:false,currentAppealsVerified:false,inForcePolicyEstablished:false,proposedPlanAdoptionVerified:false}:{}),
      ...(f.group==="heritage"?{cadastralGeometryReused:false,parcelIdentityVerified:false,fullHeritageScreenPerformed:false,currentRegisterVerified:false,currentDesignationBylawVerified:false}:{}),
      ...(f.group==="sitePlans"?{cadastralGeometryReused:false,parcelIdentityVerified:false,nearbySearchPerformed:false,fullHistorySearched:false,activeFileStatusEstablished:false,currentDecisionVerified:false,municipalApprovalEstablished:false,legalPermissionsEstablished:false}:{}),
      ...(f.group==="naturalEnvironmentReference"?{currentPolicyEstablished:false,conservationAuthorityRegulatoryScreenPerformed:false,floodRiskEstablished:false,environmentalClearanceEstablished:false}:{}),
      ...(f.group==="communityImprovement"?{currentProgramVerified:false,contaminationEstablished:false,remediationVerified:false,programEligibilityEstablished:false,fundingAvailabilityEstablished:false,grantApproved:false}:{}),
      ...(f.group==="businessImprovement"?{currentLeviesEstablished:false,currentBenefitsEstablished:false}:{}),
      ...(f.group==="ward"?{currentElectionBoundaryVerified:false}:{})},f.source,f.note+" Source update time is unknown when editingInfo is unpublished. No-match does not establish absence.",m.sourceUpdatedAt);result.truncated=truncated;return result;
  }catch(error){sourceFailure(f,error);return layer("unavailable",null,f.source,"The complete inspected grant, exact publisher/endpoint/lineage, typed schema or bounded query could not be verified. No factual result is returned.");}
}
function grouped(name:string,entries:Record<string,Layer>):Layer {
  const feeds=WELLAND_FEEDS.filter(f=>f.group===name),datasets=Object.fromEntries(feeds.map(f=>[f.key,entries[f.key]])),values=Object.values(datasets),status=values.some(v=>v.status==="available")?"available":values.some(v=>v.status==="unavailable")?"unavailable":values.every(v=>v.status==="skipped")?"skipped":"no_match";
  const result=layer(status,{datasets,coverageComplete:false,enabledQueryCoverageComplete:values.every(v=>["available","no_match"].includes(v.status)&&!v.truncated),absenceEstablished:false,parcelWideScreenPerformed:false,currentPlanScreenPerformed:false,inForcePolicyEstablished:false,currentAmendmentsVerified:false,currentAppealsVerified:false,currentPolicyEstablished:false,conservationAuthorityRegulatoryScreenPerformed:false,environmentalClearanceEstablished:false},{...feeds[0].source,id:`welland:${name}`,name:`Welland ${name} source references`},"Partial subject-point references. Read each nested status, date and truncation. Proposed policy and mapped appeal/deferral areas do not establish current adopted policy or tribunal status.");result.truncated=values.some(v=>v.truncated);return result;
}
export async function wellandLayers(address:string|null,city:string|null,province:string|null,l:Location|null,boundary:Layer|undefined,requestedCity?:string):Promise<Record<string,Layer>> {
  if(!wellandMarket(requestedCity??city,province))return {};
  const records=rows((boundary?.data as Row|null)?.records??[]),agrees=precise(l)&&wellandMarket(l.city??city,l.province??province)&&boundary?.source?.id==="niagara:ontario:municipality"&&boundary.status==="available"&&!boundary.truncated&&records.length===1&&wellandMarket(text(records[0].publishedName),"ON");
  const pending=WELLAND_FEEDS.filter(f=>f.key!=="addresses"),c:Context=new Map(),entries:Record<string,Layer>={};
  for(let i=0;i<pending.length;i+=4)for(const [key,value]of await Promise.all(pending.slice(i,i+4).map(async f=>[f.key,agrees?await query(f,l!,address,c):layer("skipped",null,f.source,"A precise point and one matching licensed original Ontario Welland polygon were not confirmed; no property query was performed.")]as const)))entries[key]=value;
  const direct=Object.fromEntries(pending.filter(f=>f.key===f.group).map(f=>[f.key,entries[f.key]])),groups=Object.fromEntries([...new Set(pending.filter(f=>f.key!==f.group).map(f=>f.group))].map(name=>[name,grouped(name,entries)]));
  const gaps=Object.fromEntries(WELLAND_WITHHELD.map(f=>[f.layer,layer("unavailable",{coverageComplete:false,screenPerformed:false,recordsQueried:false,withheld:f},null,f.reason)]));
  return {...direct,...groups,...gaps};
}
export async function wellandCoverage() {
  const c:Context=new Map(),datasets=[];
  for(let i=0;i<WELLAND_FEEDS.length;i+=4)datasets.push(...await Promise.all(WELLAND_FEEDS.slice(i,i+4).map(async f=>{try{const m=await wellandMetadata(f,c),r=await get(f.url+"/query",{where:"1=1",returnCountOnly:"true"}),count=number(r.count);if(count===null||!Number.isInteger(count)||count<0)throw Error("Welland invalid count");return{market:"Welland",layer:f.key,group:f.group,status:"verified",records:count,source:f.source,sourceUpdatedAt:m.sourceUpdatedAt,note:f.note};}catch(error){sourceFailure(f,error);return{market:"Welland",layer:f.key,group:f.group,status:"unavailable",records:null,source:f.source,note:"Complete licence, exact source/lineage, typed schema or live count could not be verified."};}})));
  return {cities:["Welland"],auditDate:"2026-10-03",delivery:"cached_live_queries",cacheSeconds:3600,datasets,withheld:WELLAND_WITHHELD.map(f=>({...f,status:"withheld",records:null})),complete:false,guidance:{catalogue:"https://open.welland.ca",zoning:"https://www.welland.ca/business-and-development/for-development/planning-and-zoning/comprehensive-zoning-by-law/",officialPlan:"https://www.welland.ca/business-and-development/for-development/planning-and-zoning/official-plan/"},note:"Thirteen licensed City feeds: civic points, current/old zoning, two environmental zoning overlays, three Official Plan references, exact-address heritage/site-plan attributes, CIP, BIA and wards. Shared Ontario municipality polygons are reused for identity and are counted once in Niagara coverage. Current permit history, complete decisions/appeals, supplier-derived footprints and current legal permissions remain unverified. Rows overlap; they are not distinct properties, unique data points or database imports."};
}
