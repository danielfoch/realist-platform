import { createHash } from "node:crypto";
import { load } from "cheerio/slim";
import { fetchJson, literal, rows } from "./http";
import { civicStreetKey, cityKey, hasUnit, layer, number, streetNumber, text, type Layer, type Location, type PropertyRequest, type Row } from "./model";
import { geocode, provinceKey } from "./geocode";
import { arcgisDate, streetVariants } from "./hamilton";
import { haversineMeters } from "@/lib/geo/geometry";
import { GUELPH_FEEDS, GUELPH_GRANT, GUELPH_WITHHELD, type GuelphFeed } from "./guelph-sources";
import { withGuelphSession } from "./guelph-session";

type Context={cache:Map<string,Promise<Row>>;renew:()=>Promise<void>;lastFinished:number};
const context=(renew:()=>Promise<void>):Context=>({cache:new Map(),renew,lastFinished:Date.now()});
const sha=(s:string)=>createHash("sha256").update(load(s).text().replace(/\s+/g," ").trim()).digest("hex");
const feed=(key:string)=>GUELPH_FEEDS.find(f=>f.key===key)!;
export function guelphMarket(city:string|null,province:string|null):boolean{return provinceKey(province??"")==="ontario"&&cityKey(city??"")==="guelph";}
async function get(c:Context,url:string,params:Record<string,string>={}):Promise<Row>{
  await c.renew();
  const delay=250-(Date.now()-c.lastFinished);if(delay>0)await new Promise(r=>setTimeout(r,delay));
  const u=new URL(url);Object.entries({f:"json",...params}).forEach(([k,v])=>u.searchParams.set(k,v));
  try{const r=await fetchJson(new URL(u.href.replace(/\+/g,"%20")))as Row;if(!r||typeof r!=="object"||Array.isArray(r)||r.error)throw new Error("Guelph source unavailable");return r;}finally{c.lastFinished=Date.now();}
}
function read(c:Context,url:string):Promise<Row>{const pending=c.cache.get(url)??get(c,url);c.cache.set(url,pending);return pending;}
function markdown(d:Row):string{
  const sections=rows(((d.values as Row|undefined)?.layout as Row|undefined)?.sections??[]);
  return sections.flatMap(s=>rows(s.rows).flatMap(r=>rows(r.cards).map(x=>((x.component as Row|undefined)?.settings as Row|undefined)?.markdown))).map(v=>{if(typeof v!=="string")throw new Error("Grant text missing");return v;}).join(" ");
}
async function grant(c:Context){
  const b=GUELPH_GRANT,base="https://www.arcgis.com/sharing/rest/content/items/";
  // Sequential reads are required by the City terms, including City-owned ArcGIS metadata.
  const site=await read(c,base+b.site),siteData=await read(c,base+b.site+"/data"),licence=await read(c,base+b.page),licenceData=await read(c,base+b.page+"/data"),terms=await read(c,base+b.terms),termsData=await read(c,base+b.terms+"/data");
  const pages=rows((siteData.values as Row|undefined)?.pages??[]),groups=(siteData.catalog as Row|undefined)?.groups;
  if(![site,licence,terms].every(x=>x.owner===b.owner&&x.orgId===b.org&&x.access==="public")||site.id!==b.site||site.title!=="Guelph Open Data"||licence.id!==b.page||licence.title!=="Open Data License"||terms.id!==b.terms||terms.title!=="Terms of use"||!Array.isArray(groups)||!groups.includes(b.group)||!pages.some(x=>x.id===b.page&&x.slug==="open-data-license")||!pages.some(x=>x.id===b.terms&&x.slug==="terms-of-use")||sha(markdown(licenceData))!==b.licenceHash||sha(markdown(termsData))!==b.termsHash)throw new Error("City licence or traffic terms changed");
}
async function metadata(f:GuelphFeed,c:Context){
  const i=await read(c,`https://www.arcgis.com/sharing/rest/content/items/${f.item}`),m=await read(c,f.url),terms=typeof i.licenseInfo==="string"?i.licenseInfo:"";
  if(i.id!==f.item||i.owner!==f.owner||i.orgId!==f.org||i.access!=="public"||i.title!==f.expectedItemTitle||i.url!==f.url||sha(terms)!==f.termsHash||m.name!==f.expectedLayerName||m.geometryType!==f.geometry||(m.copyrightText??"")!==f.expectedCopyright||m.objectIdField!==f.oid||!Object.entries(f.fieldTypes).every(([name,type])=>rows(m.fields).some(x=>x.name===name&&x.type===type)))throw new Error("Publisher, full item terms or typed endpoint changed");
  await grant(c);
  if(f.requiresCatalogueGrant){
    const b=GUELPH_GRANT,g=await read(c,`https://www.arcgis.com/sharing/rest/community/groups/${b.group}`),url=`https://www.arcgis.com/sharing/rest/search?${new URLSearchParams({q:`id:${f.item} AND group:${b.group} AND orgid:${f.org} AND access:public`,num:"1"})}`,membership=await read(c,url),items=rows(membership.results);
    if(g.id!==b.group||g.owner!==b.groupOwner||g.title!=="City of Guelph Open Data"||g.access!=="public"||membership.total!==1||items.length!==1||items[0].id!==f.item||items[0].owner!==f.owner||items[0].orgId!==f.org||items[0].access!=="public")throw new Error("Individual City-curated dataset grant missing");
  }else if(!terms.includes("https://explore.guelph.ca/pages/open-data-license"))throw new Error("Exact referred grant missing");
  return {sourceUpdatedAt:arcgisDate((m.editingInfo as Row|undefined)?.dataLastEditDate)};
}
export async function guelphMetadata(f:GuelphFeed){return withGuelphSession(renew=>metadata(f,context(renew)));}
function point(g:Row|null):g is Row&{x:number;y:number}{return typeof g?.x==="number"&&typeof g.y==="number"&&g.y>43.4&&g.y<43.7&&g.x> -80.4&&g.x< -80.05;}
function precise(l:Location|null):l is Location&{latitude:number;longitude:number}{return Boolean(l&&point({x:l.longitude,y:l.latitude})&&["source_building_point","source_civic_address_point","caller_supplied"].includes(l.accuracy));}
function features(r:Row,f:GuelphFeed){return rows(r.features).map(x=>{
  const a=x.attributes as Row;
  if(!a||typeof a!=="object"||Array.isArray(a)||!Object.entries(f.fieldTypes).every(([k,t])=>{if(!(k in a))return false;const v=a[k];if(k===f.oid)return typeof v==="number"&&Number.isInteger(v)&&v>0;return v===null||(t==="esriFieldTypeString"?typeof v==="string":typeof v==="number"&&Number.isFinite(v));}))throw new Error("Invalid source record");
  return {a:Object.fromEntries(Object.keys(f.fields).map(k=>[k,a[k]])),g:x.geometry&&typeof x.geometry==="object"&&!Array.isArray(x.geometry)?x.geometry as Row:null};
});}
function mapped(a:Row,f:GuelphFeed):Row{return Object.fromEntries(Object.entries(f.fields).map(([k,v])=>[v,f.dates.includes(k)?arcgisDate(a[k]):a[k]]));}
async function resolve(input:PropertyRequest,c:Context):Promise<Layer<Location>|null>{
  if(!input.address||input.lat!==undefined||hasUnit(input.address))return null;
  const embedded=input.address.split(",")[1]?.trim(),f=feed("addresses");
  if(input.city&&embedded&&!guelphMarket(embedded,"ON"))return layer("ambiguous",null,f.source,"The explicit City conflicts with the civic municipality. Correct identity before screening.");
  const address=input.address.split(",")[0].trim(),civic=streetNumber(address);if(!civic)return null;
  try{
    const m=await metadata(f,c),street=address.replace(/^\d+[a-z]?\s+/i,"");
    const r=await get(c,f.url+"/query",{where:`UPPER(STREETNO) = ${literal(civic.toUpperCase())} AND UPPER(FULLNAME) IN (${streetVariants(street).map(literal).join(",")})`,outFields:Object.keys(f.fields).join(","),returnGeometry:"true",outSR:"4326",resultRecordCount:"501",orderByFields:f.oid});
    const all=features(r,f);if(r.exceededTransferLimit||all.length>=501)throw new Error("Incomplete civic candidates");
    const exact=all.filter(({a})=>a.STATUS==="Active"&&civicStreetKey(`${text(a.STREETNO)??""} ${text(a.FULLNAME)??""}`)===civicStreetKey(address)&&(text(a.UNIT_NO)||civicStreetKey(text(a.ADDRESS)??"")===civicStreetKey(address))&&civicStreetKey(`${text(a.STREETNO)??""} ${text(a.STREETNAME)??""}`)===civicStreetKey(address)&&(!text(a.PLACE)||cityKey(String(a.PLACE))==="guelph"));
    if(!exact.length)return null;const primary=exact.find(({a})=>!text(a.UNIT_NO))??exact[0];
    if(!point(primary.g)||exact.some(({g})=>!point(g)||haversineMeters(primary.g!.y as number,primary.g!.x as number,g.y,g.x)>20))return layer("ambiguous",null,f.source,"Matching civic points are unusable or disagree by more than 20 metres. No arbitrary property point is selected.",m.sourceUpdatedAt);
    const result=layer("available",{address:`${text(primary.a.STREETNO)} ${text(primary.a.FULLNAME)}`,city:"Guelph",province:"ON",latitude:primary.g.y,longitude:primary.g.x,accuracy:"source_civic_address_point",provider:f.source.id,municipalAddress:{recordIds:exact.map(({a})=>String(a[f.oid])),community:"Guelph",permitAddressKeys:[civicStreetKey(address)],source:f.source,sourceUpdatedAt:m.sourceUpdatedAt,publishedRecords:exact.slice(0,50).map(({a})=>mapped(a,f)),publishedAddressRecordCount:exact.length,publishedRecordsTruncated:exact.length>50}},f.source,f.note+" Full civic suffix, street type and direction must agree. Published address status is retained without inferring occupancy or current title.",m.sourceUpdatedAt);result.truncated=exact.length>50;return result;
  }catch{return null;}
}
async function query(f:GuelphFeed,l:Location|null,address:string|null,c:Context):Promise<Layer>{
  if(!precise(l))return layer("skipped",null,f.source,"A precise civic, building or caller point is required; interpolated points are not screened.");
  if(f.matchField&&(!address||!streetNumber(address)))return layer("skipped",null,f.source,"An exact civic building address is required; coordinate-only requests do not search address histories.");
  try{
    const m=await metadata(f,c),byAddress=Boolean(f.matchField),r=await get(c,f.url+"/query",{where:byAddress?`UPPER(${f.matchField}) IN (${streetVariants(address!).map(literal).join(",")})`:"1=1",...(!byAddress?{geometry:`${l.longitude},${l.latitude}`,geometryType:"esriGeometryPoint",inSR:"4326",spatialRel:"esriSpatialRelIntersects"}:{}),outFields:Object.keys(f.fields).join(","),returnGeometry:"false",outSR:"4326",resultRecordCount:"51",orderByFields:f.oid});
    const all=features(r,f);if(!all.length&&r.exceededTransferLimit)throw new Error("Incomplete empty response");
    const exact=byAddress?all.filter(({a})=>typeof a[f.matchField!]==="string"&&!String(a[f.matchField!]).includes(",")&&civicStreetKey(String(a[f.matchField!]))===civicStreetKey(address!)):all;
    const truncated=Boolean(r.exceededTransferLimit||all.length>50),result=layer(exact.length?"available":"no_match",{records:exact.slice(0,50).map(({a})=>mapped(a,f)),matchMethod:byAddress?"exact_normalized_civic_address":"published_polygon_intersects_point",scope:byAddress?"building_or_site_address":"subject_point",screenedPoint:{latitude:l.latitude,longitude:l.longitude,accuracy:l.accuracy},coverageComplete:false,queryCoverageComplete:!truncated,absenceEstablished:false,parcelWideScreenPerformed:false,...(f.key==="planningApplications"?{nearbySearchPerformed:false,fullHistorySearched:false,activeFileStatusEstablished:false,currentDecisionVerified:false,municipalApprovalEstablished:false}:{}),...(["zoning","legacyZoning1995"].includes(f.key)?{fullCurrentZoningScreenPerformed:false,currentAmendmentsVerified:false,currentAppealsVerified:false,communityPlanningPermitApplicabilityVerified:false,legalPermissionsEstablished:false}:{}),...(f.key==="formerTermiteManagement"?{currentRegentGroveAreaScreenPerformed:false,currentInfestationEstablished:false,eradicationEstablished:false,treatmentVerified:false,inspectionPerformed:false,termiteAbsenceEstablished:false}:{}),...(f.key==="parcelReference"?{titleSearchPerformed:false,surveyVerified:false}:{}),...(f.key==="buildingFootprints"?{interiorFloorAreaEstablished:false,unitLegalityEstablished:false}:{}),...(f.key==="watercourseReference"?{conservationAuthorityRegulatoryScreenPerformed:false,floodRiskEstablished:false,environmentalClearanceEstablished:false}:{})},f.source,f.note+" Source update time remains unknown if editingInfo is unpublished. No-match does not establish absence.",m.sourceUpdatedAt);result.truncated=truncated;return result;
  }catch{return layer("unavailable",null,f.source,"The complete inspected licence/traffic terms, exact publisher/endpoint/schema or serialized source query could not be verified. No factual result is returned.");}
}
function gaps():Record<string,Layer>{return {...Object.fromEntries(GUELPH_WITHHELD.map(f=>[f.layer,layer("unavailable",{coverageComplete:false,screenPerformed:false,withheld:f},null,f.reason)])),officialPlan:layer("not_supported",{currentPlanScreenPerformed:false,inForcePolicyEstablished:false,guidanceUrl:"https://guelph.ca/plans-and-strategies/official-plan/"},null,"Current Official Plan legal schedules/policies, amendments and tribunal decisions are unconnected. The City's online consolidation is dated February 2024; later plan changes require City confirmation."),development:layer("not_supported",{nearbySearchPerformed:false,fullPlanningHistorySearched:false},null,"Nearby applications, full decisions/appeals and closed-file history are unsearched. Exact-address active files are separate evidence.")};}
async function layers(address:string|null,l:Location|null,c:Context):Promise<Record<string,Layer>>{
  const f=feed("municipality");let b=await query(f,l,null,c);const records=rows((b.data as Row|null)?.records??[]),agrees=b.status==="available"&&!b.truncated&&records.length===1&&cityKey(text(records[0].publishedBoundary)??"")==="guelph";
  if(b.status==="available"&&!agrees)b=layer("ambiguous",{...b.data as Row,expectedMunicipality:"Guelph"},f.source,"The City boundary is non-unique or conflicts with the request; no property layers are assigned.",b.sourceUpdatedAt);
  const result:Record<string,Layer>={municipality:b,...gaps()};
  for(const f of GUELPH_FEEDS.filter(f=>!["addresses","municipality"].includes(f.key)))result[f.key]=agrees?await query(f,l,address,c):layer("skipped",null,f.source,"A precise point and unique matching City boundary were not confirmed; no property query was performed.");
  return result;
}
export async function guelphLayers(address:string|null,city:string|null,province:string|null,l:Location|null,requestedCity?:string):Promise<Record<string,Layer>>{
  if(!guelphMarket(requestedCity??city,province))return {};
  try{return await withGuelphSession(renew=>layers(address,l,context(renew)));}catch{return {...gaps(),...Object.fromEntries(GUELPH_FEEDS.filter(f=>f.key!=="addresses").map(f=>[f.key,layer("unavailable",null,f.source,"Guelph's serialized source session is busy or unavailable. Retry later; no property query was performed.")]))};}
}
export async function guelphResearch(input:PropertyRequest):Promise<{location:Layer<Location>;layers:Record<string,Layer>}>{
  try{return await withGuelphSession(async renew=>{const c=context(renew),location=await resolve(input,c)??await geocode(input);return {location,layers:await layers(input.address?location.data?.address??input.address.split(",")[0]:null,location.data,c)};});}catch{return {location:await geocode(input),layers:{...gaps(),...Object.fromEntries(GUELPH_FEEDS.filter(f=>f.key!=="addresses").map(f=>[f.key,layer("unavailable",null,f.source,"Guelph's serialized source session is busy or unavailable. Retry later; no property query was performed.")]))}};}
}
export async function guelphCoverage(){
  const inspect=async(c:Context)=>{const datasets=[];for(const f of GUELPH_FEEDS){try{const m=await metadata(f,c),r=await get(c,f.url+"/query",{where:"1=1",returnCountOnly:"true"}),count=number(r.count);if(count===null||!Number.isInteger(count)||count<0)throw new Error("Invalid count");datasets.push({market:"Guelph",layer:f.key,status:"verified",records:count,source:f.source,sourceUpdatedAt:m.sourceUpdatedAt,note:f.note});}catch{datasets.push({market:"Guelph",layer:f.key,status:"unavailable",records:null,source:f.source,note:"Publisher, complete grant/traffic terms, typed schema or live count could not be verified."});}}return datasets;};
  let datasets;try{datasets=await withGuelphSession(renew=>inspect(context(renew)));}catch{datasets=GUELPH_FEEDS.map(f=>({market:"Guelph",layer:f.key,status:"unavailable",records:null,source:f.source,note:"Serialized Guelph source session is busy or unavailable; no source count is queried."}));}
  return {cities:["Guelph"],auditDate:"2026-10-03",delivery:"cached_live_queries",cacheSeconds:3600,datasets,withheld:GUELPH_WITHHELD.map(f=>({...f,status:"withheld",records:null})),complete:false,guidance:{catalogue:"https://explore.guelph.ca/search",licence:"https://explore.guelph.ca/pages/open-data-license",terms:"https://explore.guelph.ca/pages/terms-of-use",zoning:"https://guelph.ca/city-government/by-laws-and-policies/zoning-by-law/",termites:"https://guelph.ca/living/house-and-home/termites/",officialPlan:"https://guelph.ca/plans-and-strategies/official-plan/"},note:"Selected civic, boundary, property/building references, zoning labels, active exact-address planning files, 61M plans, watercourses/parks and historical termite mapping. Full current zoning/CPP/appeals/ADU rights, current termite management, heritage, permits, adjustment, current plan policy and conservation regulation remain gaps. Published source rows overlap and are not distinct properties, unique data points or database imports."};
}
