import { createHash } from "node:crypto";
import { load } from "cheerio/slim";
import { fetchBytes, fetchJson, literal, rows } from "./http";
import { civicStreetKey, cityKey, hasUnit, layer, number, streetNumber, text, type Layer, type Location, type PropertyRequest, type Row } from "./model";
import { provinceKey } from "./geocode";
import { nationalAddress } from "./national";
import { arcgisDate, streetVariants } from "./hamilton";
import { haversineMeters } from "@/lib/geo/geometry";
import { KINGSTON_FEEDS, KINGSTON_GRANT_HASH, KINGSTON_GUIDANCE, KINGSTON_LEGACY_LICENCE_URL, KINGSTON_LICENCE_URL, KINGSTON_WITHHELD, type KingstonFeed } from "./kingston-sources";

type Context=Map<string,Promise<Row>>;
const sha=(data:string|Uint8Array)=>createHash("sha256").update(data).digest("hex");
export function kingstonMarket(city:string|null,province:string|null):boolean {return provinceKey(province??"")==="ontario"&&cityKey(city??"").replace(/^city of\s+/,"")==="kingston";}
async function get(url:string,params:Record<string,string>={}):Promise<Row> {
  const u=new URL(url);Object.entries({f:"json",...params}).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetchJson(new URL(u.href.replace(/\+/g,"%20"))) as Row;
  if(!r||typeof r!=="object"||Array.isArray(r)||r.error)throw new Error("Kingston source unavailable");return r;
}
/** Validate the inspected grant bytes and each explicit referral, publisher, root and typed child before records. */
export async function kingstonMetadata(f:KingstonFeed,context:Context=new Map()) {
  const read=(url:string,run=()=>get(url))=>{const pending=context.get(url)??run();context.set(url,pending);return pending;};
  const [grant,item,m]=await Promise.all([
    read(KINGSTON_LICENCE_URL,async()=>({hash:sha(await fetchBytes(new URL(KINGSTON_LICENCE_URL)))})),
    read(`https://www.arcgis.com/sharing/rest/content/items/${f.item}`),read(f.url)
  ]);
  const terms=typeof item.licenseInfo==="string"?item.licenseInfo:"",normalized=load(terms).text().replace(/\s+/g," ").trim();
  const referrals=[...load(terms)("a[href]")].map(a=>load(terms)(a).attr("href"));
  if(grant.hash!==KINGSTON_GRANT_HASH||item.owner!==f.owner||item.orgId!==f.org||item.access!=="public"||item.title!==f.expectedItemTitle||item.url!==f.rootUrl||!referrals.includes(KINGSTON_LEGACY_LICENCE_URL)||sha(normalized)!==f.termsHash||m.name!==f.expectedLayerName||m.geometryType!==f.geometry||(m.copyrightText??"")!==f.expectedCopyright||!Object.entries(f.fieldTypes).every(([name,type])=>rows(m.fields).some(x=>x.name===name&&x.type===type)))throw new Error("Kingston grant, publisher or schema changed");
  return {sourceUpdatedAt:arcgisDate((m.editingInfo as Row|undefined)?.dataLastEditDate)};
}
function point(g:Row|null):g is Row&{x:number;y:number} {return typeof g?.x==="number"&&typeof g.y==="number"&&g.y>44.1&&g.y<44.6&&g.x> -76.8&&g.x< -76.1;}
function precise(l:Location|null):l is Location&{latitude:number;longitude:number} {return Boolean(l&&point({x:l.longitude,y:l.latitude})&&["source_building_point","source_civic_address_point","caller_supplied"].includes(l.accuracy));}
function features(r:Row,f:KingstonFeed) {
  return rows(r.features).map(x=>{
    const a=x.attributes as Row;
    if(!a||typeof a!=="object"||Array.isArray(a)||!Object.entries(f.fieldTypes).every(([k,t])=>{
      if(!(k in a))return false;const v=a[k];if(k===f.oid)return typeof v==="number"&&Number.isInteger(v)&&v>0;
      return v===null||(t==="esriFieldTypeString"?typeof v==="string":typeof v==="number"&&Number.isFinite(v));
    }))throw new Error("Invalid Kingston record");
    return {a:Object.fromEntries(Object.keys(f.fields).map(k=>[k,a[k]])),g:x.geometry&&typeof x.geometry==="object"&&!Array.isArray(x.geometry)?x.geometry as Row:null};
  });
}
function mapped(a:Row,f:KingstonFeed):Row {return Object.fromEntries(Object.entries(f.fields).map(([k,v])=>[v,f.dates.includes(k)?arcgisDate(a[k]):a[k]]));}
function addressAt(a:Row):string {return `${number(a.ADDRESS_NUMBER)??""}${text(a.ADDRESS_NUMBER_SUFFIX)??""} ${text(a.STREET)??""}`.trim();}
export async function kingstonLocation(input:PropertyRequest):Promise<Layer<Location>|null> {
  const city=input.city??input.address?.split(",")[1]?.trim()??null,province=input.province??input.address?.split(",")[2]?.trim()??"ON";
  if(!kingstonMarket(city,province)||!input.address||input.lat!==undefined||hasUnit(input.address))return null;
  const f=KINGSTON_FEEDS.find(f=>f.key==="addresses")!,embedded=input.address.split(",")[1]?.trim();
  if(input.city&&embedded&&!kingstonMarket(embedded,province))return layer("ambiguous",null,f.source,"The explicit city conflicts with the address municipality. Correct the civic identity before screening.");
  const address=input.address.split(",")[0].trim(),civic=streetNumber(address);if(!civic)return null;
  try {
    const m=await kingstonMetadata(f),street=address.replace(/^\d+[a-z]?\s+/i,"");
    const r=await get(f.url+"/query",{where:`MUNICIPALITY = 'KINGSTON' AND ADDRESS_NUMBER = ${parseInt(civic,10)} AND UPPER(STREET) IN (${streetVariants(street).map(literal).join(",")})`,outFields:Object.keys(f.fields).join(","),returnGeometry:"true",outSR:"4326",resultRecordCount:"501",orderByFields:f.oid});
    const all=features(r,f);if(r.exceededTransferLimit||all.length>=501)throw new Error("Incomplete civic candidates");
    const exact=all.filter(({a})=>a.MUNICIPALITY==="KINGSTON"&&civicStreetKey(addressAt(a))===civicStreetKey(address)&&(!text(a.UNIT)?civicStreetKey(String(a.FULL_ADDRESS))===civicStreetKey(address):true));
    if(!exact.length)return null;const primary=exact.find(({a})=>!text(a.UNIT))??exact[0];
    if(!point(primary.g)||exact.some(({g})=>!point(g)||haversineMeters(primary.g!.y as number,primary.g!.x as number,g.y,g.x)>20))return layer("ambiguous",null,f.source,"Matching civic points are unusable or disagree by more than 20 metres. No arbitrary point is selected.",m.sourceUpdatedAt);
    const registered=await nationalAddress({address,city:"Kingston",province:"ON"},provinceKey),n=registered?.status==="available"?registered.data:null;
    const nar=n?.accuracy==="source_building_point"&&n.address&&civicStreetKey(n.address)===civicStreetKey(address)&&kingstonMarket(n.city,n.province)&&typeof n.latitude==="number"&&typeof n.longitude==="number"&&haversineMeters(primary.g.y,primary.g.x,n.latitude,n.longitude)<=20?n.addressRegister:undefined;
    const result=layer("available",{address:addressAt(primary.a),city:"Kingston",province:"ON",latitude:primary.g.y,longitude:primary.g.x,accuracy:"source_civic_address_point",provider:f.source.id,...(nar?{addressRegister:nar}:{}),municipalAddress:{recordIds:exact.map(({a})=>String(a[f.oid])),community:"KINGSTON",permitAddressKeys:[civicStreetKey(address)],source:f.source,sourceUpdatedAt:m.sourceUpdatedAt,publishedRecords:exact.slice(0,50).map(({a})=>mapped(a,f)),publishedAddressRecordCount:exact.length,publishedRecordsTruncated:exact.length>50}},f.source,f.note+" Suffixes, directions and street types must match. Shared-address records are grouped only when their points agree within 20 metres; this does not identify an individual unit. A unique City boundary must confirm Kingston before property-layer queries.",m.sourceUpdatedAt);result.truncated=exact.length>50;return result;
  }catch{return null;}
}
function exactApplicationAddress(value:unknown,address:string):boolean {
  if(typeof value!=="string")return false;
  const parts=value.split(",").map(s=>s.trim());
  const cityAndProvince=parts.length===3&&kingstonMarket(parts[1],"ON")&&/^(?:ON|ONTARIO)(?:\s+[A-Z]\d[A-Z]\s?\d[A-Z]\d)?$/i.test(parts[2]);
  return (parts.length===1||cityAndProvince)&&civicStreetKey(parts[0])===civicStreetKey(address);
}
async function queryLayer(f:KingstonFeed,location:Location|null,address:string|null,context:Context):Promise<Layer> {
  if(!precise(location))return layer("skipped",null,f.source,"A precise civic/building/caller point is required; street interpolation is not screened.");
  const byAddress=["permits","planningApplications","heritageApplications"].includes(f.key);
  if(byAddress&&(!address||!streetNumber(address)))return layer("skipped",null,f.source,"An exact civic building address is required; coordinate-only requests do not search address histories.");
  try {
    const m=await kingstonMetadata(f,context),addressField=f.key==="permits"?"ADDRESS":"ADDR_FULL";
    const variants=byAddress?streetVariants(address!):[];
    const addressWhere=f.key==="permits"?`UPPER(ADDRESS) IN (${variants.map(literal).join(",")})`:variants.map(v=>`(UPPER(ADDR_FULL) = ${literal(v)} OR UPPER(ADDR_FULL) LIKE ${literal(v+",%")})`).join(" OR ");
    const r=await get(f.url+"/query",{where:byAddress?addressWhere:"1=1",...(!byAddress?{geometry:`${location.longitude},${location.latitude}`,geometryType:"esriGeometryPoint",inSR:"4326",spatialRel:"esriSpatialRelIntersects"}:{}),outFields:Object.keys(f.fields).join(","),returnGeometry:"false",resultRecordCount:"51",orderByFields:f.key==="permits"?`DATE_APPLICATION DESC,${f.oid} DESC`:f.oid});
    const all=features(r,f);if(!all.length&&r.exceededTransferLimit)throw new Error("Incomplete empty query");
    const exact=byAddress?all.filter(({a})=>f.key==="permits"?civicStreetKey(String(a.ADDRESS))===civicStreetKey(address!):exactApplicationAddress(a[addressField],address!)):all;
    const truncated=Boolean(r.exceededTransferLimit||all.length>50);
    const result=layer(exact.length?"available":"no_match",{records:exact.slice(0,50).map(({a})=>mapped(a,f)),matchMethod:byAddress?"exact_normalized_civic_address":"published_polygon_intersects_point",scope:byAddress?"building_or_site_address":"subject_point",screenedPoint:{latitude:location.latitude,longitude:location.longitude,accuracy:location.accuracy},coverageComplete:false,queryCoverageComplete:!truncated,parcelWideScreenPerformed:false,absenceEstablished:false,...(byAddress?{fullHistorySearched:false,nearbySearchPerformed:false}:{}),...(["planningApplications","heritageApplications"].includes(f.key)?{municipalApprovalEstablished:false,currentDecisionVerified:false}:{}),...(f.key==="permits"?{finalInspectionsVerified:false,currentOccupancyApprovalVerified:false,unitLegalityEstablished:false}:{}),...(f.key==="airportNoiseOverlay"?{measuredNoiseEstablished:false}:{}),...(f.key==="floodplainOverlay"?{conservationAuthorityRegulatoryScreenPerformed:false,floodSafetyEstablished:false}:{})},f.source,f.note+" Source update time remains unknown where editingInfo is unpublished. No-match does not establish absence.",m.sourceUpdatedAt);result.truncated=truncated;return result;
  }catch{return layer("unavailable",null,f.source,"The inspected PDF grant, exact item referral/publisher/root, named typed schema or bounded query could not be verified. No factual result is returned.");}
}
function group(name:string,entries:Record<string,Layer>):Layer {
  const feeds=KINGSTON_FEEDS.filter(f=>f.group===name),nested=Object.fromEntries(feeds.map(f=>[f.key,entries[f.key]])),values=Object.values(nested);
  const status=values.some(v=>v.status==="available")?"available":values.some(v=>v.status==="unavailable")?"unavailable":values.every(v=>v.status==="skipped")?"skipped":"no_match";
  const data={datasets:nested,coverageComplete:false,enabledQueryCoverageComplete:values.every(v=>["available","no_match"].includes(v.status)&&!v.truncated),parcelWideScreenPerformed:false,absenceEstablished:false,currentAmendmentsVerified:false,currentAppealsVerified:false,...(name==="zoning"?{bylaw:"2022-62",fullCurrentZoningScreenPerformed:false,formerBylawApplicabilityVerified:false,legalPermissionsEstablished:false,verificationUrl:KINGSTON_GUIDANCE.zoning}:name==="officialPlan"?{currentPlanScreenPerformed:false,inForcePolicyEstablished:false,publishedCityConsolidationDate:"2025-05-31",draftPlanIsCurrentPolicy:false,verificationUrl:KINGSTON_GUIDANCE.officialPlan,draftPlanGuidanceUrl:KINGSTON_GUIDANCE.newPlan}:{fullHeritageScreenPerformed:false,currentRegisterVerified:false,verificationUrl:KINGSTON_GUIDANCE.heritage})};
  const result=layer(status,data,{...feeds[0].source,id:`kingston:${name}`,name:`Kingston ${name} source screens`,url:name==="zoning"?KINGSTON_GUIDANCE.zoning:name==="officialPlan"?KINGSTON_GUIDANCE.officialPlan:KINGSTON_GUIDANCE.heritage},"Partial subject-point evidence. Read every nested source, date, status and truncation; current legal instruments, parcel-wide conditions and permissions remain unverified.");result.truncated=values.some(v=>v.truncated);return result;
}
export async function kingstonLayers(address:string|null,city:string|null,province:string|null,location:Location|null,requestedCity?:string):Promise<Record<string,Layer>> {
  if(!kingstonMarket(requestedCity??city,province))return {};
  const context:Context=new Map(),f=KINGSTON_FEEDS.find(f=>f.key==="municipality")!;
  let boundary=await queryLayer(f,location,null,context);const records=rows((boundary.data as Row|null)?.records??[]);
  const agreed=boundary.status==="available"&&!boundary.truncated&&records.length===1&&records[0].municipality==="City of Kingston";
  if(boundary.status==="available"&&!agreed)boundary=layer("ambiguous",{...boundary.data as Row,expectedMunicipality:"City of Kingston"},f.source,"The point's boundary is non-unique or conflicts with Kingston; no property layers are assigned.",boundary.sourceUpdatedAt);
  const pending=KINGSTON_FEEDS.filter(f=>!["addresses","municipality"].includes(f.key)),pairs:(readonly [string,Layer])[]=[];
  // Keep source fan-out bounded: the municipal/proxied services can time out under a full-layer burst.
  for(let i=0;i<pending.length;i+=4)pairs.push(...await Promise.all(pending.slice(i,i+4).map(async f=>[f.key,agreed?await queryLayer(f,location,address,context):layer("skipped",null,f.source,"A precise point and unique City of Kingston boundary were not confirmed; this property query was not performed.")] as const)));
  const entries=Object.fromEntries(pairs);
  const direct=Object.fromEntries(KINGSTON_FEEDS.filter(f=>f.group===f.key&&!["addresses","municipality"].includes(f.key)).map(f=>[f.key,entries[f.key]]));
  return {municipality:boundary,...direct,zoning:group("zoning",entries),officialPlan:group("officialPlan",entries),heritage:group("heritage",entries),
    ...Object.fromEntries([...new Set(KINGSTON_WITHHELD.map(f=>f.layer))].map(name=>[name,layer("unavailable",{coverageComplete:false,screenPerformed:false,withheld:KINGSTON_WITHHELD.filter(f=>f.layer===name)},null,"Dataset reuse is unresolved and this source is withheld; no property records are queried.")])),
    development:layer("not_supported",{nearbySearchPerformed:false,fullPlanningHistorySearched:false,verificationUrl:KINGSTON_GUIDANCE.applications},null,"The active planning and heritage feeds are exact-address evidence, not a nearby-development search or complete history. Multi-address/range descriptions, closed planning files, conditions, tribunal outcomes and current decisions remain unsearched.")};
}
export async function kingstonCoverage() {
  const context:Context=new Map(),datasets=[];
  const inspect=async(f:KingstonFeed)=>{try{const m=await kingstonMetadata(f,context),r=await get(f.url+"/query",{where:f.key==="addresses"?"MUNICIPALITY = 'KINGSTON'":"1=1",returnCountOnly:"true"}),count=number(r.count);if(count===null||!Number.isInteger(count)||count<0)throw new Error("Invalid count");return {layer:f.key,group:f.group,status:"verified",records:count,source:f.source,sourceUpdatedAt:m.sourceUpdatedAt,note:f.note};}catch{return {layer:f.key,group:f.group,status:"unavailable",records:null,source:f.source,note:"Grant bytes, source/schema binding or live count could not be verified."};}};
  for(let i=0;i<KINGSTON_FEEDS.length;i+=4)datasets.push(...await Promise.all(KINGSTON_FEEDS.slice(i,i+4).map(inspect)));
  return {city:"Kingston",delivery:"cached_live_queries",cacheSeconds:3600,datasets,withheld:KINGSTON_WITHHELD.map(f=>({...f,status:"withheld",records:null,url:`https://www.arcgis.com/home/item.html?id=${f.item}`})),complete:false,note:"Twenty-four licensed City-owned source children add civic, permit, active application, heritage, zoning and existing-plan references. Current legal instruments, full file/decision history, additional-unit/servicing overlays and authority confirmation remain incomplete. Counts overlap and are source rows, not unique properties, data points or database imports."};
}
