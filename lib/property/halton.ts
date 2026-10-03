import { fetchJson, literal, rows } from "./http";
import { civicStreetKey, cityKey, hasUnit, layer, number, streetNumber, text, type Layer, type Location, type PropertyRequest, type Row } from "./model";
import { provinceKey } from "./geocode";
import { nationalAddress } from "./national";
import { haversineMeters } from "@/lib/geo/geometry";
import { arcgisDate } from "./hamilton";
import { municipalMetadata, municipalPointLayer } from "./ontario-municipal";
import type { HaltonMarket, MunicipalFeed } from "./ontario-municipal-sources";
import { HALTON_FEEDS, HALTON_GUIDANCE, HALTON_PLAN_GUIDANCE } from "./halton-sources";

export function haltonMarket(city:string|null,province:string|null):HaltonMarket|null {
  const name=cityKey(city??"").replace(/^town of\s+/,"");
  const markets=new Map<string,HaltonMarket>([["burlington","Burlington"],["milton","Milton"],["oakville","Oakville"]]);
  return provinceKey(province??"")==="ontario"?markets.get(name)??null:null;
}
const bounds:Record<HaltonMarket,[number,number,number,number]>={Burlington:[43.25,43.52,-79.99,-79.68],Milton:[43.4,43.75,-80.2,-79.69],Oakville:[43.35,43.6,-79.85,-79.54]};
function point(market:HaltonMarket,g:Row|null):g is Row & {x:number;y:number} {const [s,n,w,e]=bounds[market];return typeof g?.x==="number"&&typeof g.y==="number"&&g.y>s&&g.y<n&&g.x>w&&g.x<e;}
async function get(url:string,params:Record<string,string>={}):Promise<Row> {
  const u=new URL(url);Object.entries({f:"json",...params}).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetchJson(new URL(u.href.replace(/\+/g,"%20"))) as Row;
  if(!r||typeof r!=="object"||Array.isArray(r)||r.error)throw new Error("Halton source unavailable");return r;
}
function features(r:Row,f:MunicipalFeed) {
  if(r.exceededTransferLimit)throw new Error("Incomplete civic candidates");
  const all=rows(r.features);if(all.length>=501)throw new Error("Civic bound exceeded");
  return all.map(x=>{const a=x.attributes as Row;if(!a||typeof a!=="object"||Array.isArray(a)||a[f.oid]==null||!Object.keys(f.fields).every(k=>k in a))throw new Error("Invalid civic record");return {a:Object.fromEntries(Object.keys(f.fields).map(k=>[k,a[k]])),g:x.geometry&&typeof x.geometry==="object"&&!Array.isArray(x.geometry)?x.geometry as Row:null};});
}
function mapped(a:Row,f:MunicipalFeed):Row{return Object.fromEntries(Object.entries(f.fields).map(([k,v])=>[v,f.dates?.includes(k)?arcgisDate(a[k]):a[k]]));}
function addressAt(market:HaltonMarket,a:Row):string {
  const civic=market==="Milton"?number(a.ADDRESS_NUM)?.toString():text(market==="Burlington"?a.HOUSENUM:a.STREET_NUM);
  return market==="Milton"?[civic,text(a.GEOSTNAME),text(a.STREET_TYPE),text(a.ST_DIR_SUFFIX)].filter(Boolean).join(" "):market==="Burlington"?[civic,text(a.STREET),text(a.STRTYPE),text(a.STRDIR)].filter(Boolean).join(" "):[`${civic??""}${text(a.SUFFIX)??""}`,text(a.STREET_DIR_PREFIX),text(a.STREET_TYPE_PREFIX),text(a.STREET_NAME),text(a.STREET_TYPE),text(a.STREET_DIR)].filter(Boolean).join(" ");
}
function eligible(market:HaltonMarket,a:Row):boolean {
  if(market==="Burlington")return a.PROPSTATUSDESC==="Active"&&cityKey(text(a.CITY)??"")==="burlington"&&provinceKey(text(a.PROVINCE)??"")==="ontario";
  if(market==="Oakville")return (!text(a.CITY)||cityKey(String(a.CITY))==="oakville")&&(!text(a.PROV)||provinceKey(String(a.PROV))==="ontario");
  return true;
}
export async function haltonLocation(input:PropertyRequest):Promise<Layer<Location>|null> {
  const city=input.city??input.address?.split(",")[1]?.trim()??null,province=input.province??input.address?.split(",")[2]?.trim()??"ON",market=haltonMarket(city,province);
  if(!market||!input.address||input.lat!==undefined||hasUnit(input.address))return null;
  const address=input.address.split(",")[0].trim(),civic=streetNumber(address);if(!civic)return null;
  const f=HALTON_FEEDS.find(f=>f.market===market&&f.key==="addresses")!;
  const where=market==="Milton"?`ADDRESS_NUM = ${parseInt(civic,10)}`:`UPPER(${market==="Burlington"?"HOUSENUM":"STREET_NUM"}) IN (${[...new Set([civic.toUpperCase(),String(parseInt(civic,10))])].map(literal).join(",")})`;
  try {
    const m=await municipalMetadata(f),r=await get(f.url+"/query",{where,outFields:Object.keys(f.fields).join(","),returnGeometry:"true",outSR:"4326",resultRecordCount:"501",orderByFields:f.oid});
    const exact=features(r,f).filter(({a})=>eligible(market,a)&&civicStreetKey(addressAt(market,a))===civicStreetKey(address));if(!exact.length)return null;
    const primary=exact.find(({a})=>!text(a.UNIT_NUMBER)&&!text(a.UNIT)&&!text(a.SUITE))??exact[0];
    if(!point(market,primary.g)||exact.some(({g})=>!point(market,g)||haversineMeters(primary.g!.y as number,primary.g!.x as number,g.y,g.x)>20))return layer("ambiguous",null,f.source,"Exact civic points lack usable coordinates or span more than 20 metres. Provide verified building coordinates; no arbitrary point is assigned.",m.sourceUpdatedAt);
    const registered=await nationalAddress({address,city:market,province:"ON"},provinceKey),n=registered?.status==="available"?registered.data:null;
    const nar=n?.accuracy==="source_building_point"&&n.address&&civicStreetKey(n.address)===civicStreetKey(address)&&haltonMarket(n.city,n.province)===market&&typeof n.latitude==="number"&&typeof n.longitude==="number"&&haversineMeters(primary.g.y,primary.g.x,n.latitude,n.longitude)<=20?n.addressRegister:undefined;
    const result=layer("available",{address:addressAt(market,primary.a),city:market,province:"ON",latitude:primary.g.y,longitude:primary.g.x,accuracy:"source_civic_address_point",provider:f.source.id,...(nar?{addressRegister:nar}:{}),municipalAddress:{recordIds:exact.map(({a})=>String(a[f.oid])),community:market,permitAddressKeys:[civicStreetKey(address)],source:f.source,sourceUpdatedAt:m.sourceUpdatedAt,publishedRecords:exact.slice(0,50).map(({a})=>mapped(a,f)),publishedAddressRecordCount:exact.length,publishedRecordsTruncated:exact.length>50}},f.source,f.note+" Civic type, suffix and direction are matched exactly after normalization. Shared points within 20 metres remain building/site context; they do not identify an individual unit.",m.sourceUpdatedAt);result.truncated=exact.length>50;return result;
  }catch{return null;}
}
export async function haltonAddressEvidence(f:MunicipalFeed,address:string|null,location:Location|null,context?:Map<string,Promise<Row>>):Promise<Layer> {
  const civic=address?streetNumber(address):null;if(!address||!civic)return layer("skipped",null,f.source,"A civic building address is required.");
  const permits=f.key==="permits",burl=f.market==="Burlington";
  const field=permits?burl?"ADDRESS":"FOLDERNAME":burl?"HOUSENUM":"ADDRESS_NUM";
  const where=permits?`UPPER(${field}) LIKE ${literal(civic.toUpperCase()+" %")}`:burl?`UPPER(HOUSENUM) = ${literal(civic.toUpperCase())}`:`ADDRESS_NUM = ${parseInt(civic,10)}`;
  try {
    const m=await municipalMetadata(f,context),r=await get(f.url+"/query",{where,outFields:Object.keys(f.fields).join(","),returnGeometry:permits?"false":"true",outSR:"4326",resultRecordCount:"501",orderByFields:permits?`ISSUEDATE DESC,${f.oid} DESC`:f.oid});
    const exact=features(r,f).filter(({a})=>{const published=permits?text(a[field]):`${burl?text(a.HOUSENUM):number(a.ADDRESS_NUM)} ${text(a.STREET_NAME)??""}`;return Boolean(published)&&civicStreetKey(published!)===civicStreetKey(address);});
    const precise=location&&haltonMarket(location.city,location.province)===f.market&&["source_civic_address_point","source_building_point","caller_supplied"].includes(location.accuracy)&&point(f.market as HaltonMarket,{x:location.longitude,y:location.latitude});
    const records=exact.slice(0,50).map(({a,g})=>({...mapped(a,f),...(!permits?{sourcePointSeparationM:precise&&point(f.market as HaltonMarket,g)?Math.round(haversineMeters(location!.latitude!,location!.longitude!,g.y,g.x)):null}:{})}));
    const ambiguous=!permits&&precise&&exact.some(({g})=>!point(f.market as HaltonMarket,g)||haversineMeters(location!.latitude!,location!.longitude!,g.y,g.x)>100);
    const result=layer(ambiguous?"ambiguous":exact.length?"available":"no_match",{records,matchMethod:"exact_normalized_published_civic_address",scope:"building_or_civic_site",publishedAddressMatchCount:exact.length,queryCoverageComplete:exact.length<=50,coverageComplete:false,fullPropertyHistorySearched:false,absenceEstablished:false,...(permits?{currency:"CAD",distinctPermitCount:null,finalInspectionsVerified:false,occupancyVerified:false,...(burl?{}:{catalogueAdvertisedScope:"last ten years",grossFloorAreaUnits:null})}:{fullCurrentHeritageRegisterVerified:false})},f.source,f.note+(!permits?" Exact source points more than 100 metres from a usable property point stay ambiguous.":"")+" Unknown dates remain null; catalogue metadata is not an observation date.",m.sourceUpdatedAt);result.truncated=exact.length>50;return result;
  }catch{return layer("unavailable",null,f.source,"Publisher, reuse terms, schema or complete civic-address query could not be verified. No factual result is returned.");}
}
function zoningGroup(market:HaltonMarket,entries:Record<string,Layer>):Layer {
  const keys=market==="Milton"?["urbanZoning","ruralZoning"]:market==="Oakville"?["zoning2014","zoning2009"]:["zoning2020Mapping","residentialZoning2026"];
  const enabled=keys.filter(k=>!HALTON_FEEDS.find(f=>f.market===market&&f.key===k)?.disabledReason),all=keys.map(k=>entries[k]);
  const queried=enabled.every(k=>["available","no_match"].includes(entries[k].status)&&!entries[k].truncated);
  const status=all.some(l=>l.status==="available")?"available":queried?"no_match":all.some(l=>l.status==="unavailable")?"unavailable":"skipped";
  const first=HALTON_FEEDS.find(f=>f.market===market&&f.key===keys[0])!;
  return layer(status,{datasets:Object.fromEntries(keys.map(k=>[k,entries[k]])),bylaws:market==="Milton"?["016-2014","144-2003"]:market==="Oakville"?["2014-014","2009-189"]:["2020","09-2026"],coverageComplete:false,enabledQueryCoverageComplete:queried,fullCurrentZoningScreenPerformed:false,currentAmendmentsVerified:false,parcelWideScreenPerformed:false,absenceEstablished:false,verificationUrl:HALTON_GUIDANCE[market].zoning,...(market==="Burlington"?{newResidentialBylawEffectiveDate:"2026-03-02",currentResidentialZoningMappingVerified:false}:{})},{...first.source,id:`${market.toLowerCase()}:zoning`,name:`${market} municipal zoning point screens`,url:HALTON_GUIDANCE[market].zoning},market==="Burlington"?"Incomplete current zoning: older 2020 mapping cannot establish current residential zoning after March 2, 2026. The new 09-2026 enacted mapping is unverified; the discovered draft is withheld. Verify both bylaws, applicability, exceptions and amendments with the City.":"Zone-label point screens are incomplete zoning verification. Read both nested source statuses and preserve holding/exception text; current written rules, overlays, amendments, appeals and legal permissions remain unverified.");
}
export async function haltonLayers(address:string|null,city:string|null,province:string|null,location:Location|null,requestedCity?:string):Promise<Record<string,Layer>> {
  const market=haltonMarket(requestedCity??city,province);if(!market)return {};
  const feeds=HALTON_FEEDS.filter(f=>f.market===market&&f.key!=="addresses"),context=new Map<string,Promise<Row>>();
  const pointLocation=haltonMarket(location?.city??null,location?.province??null)===market?location:null;
  const matchedCity=haltonMarket(city,province)===market;
  const entries=Object.fromEntries(await Promise.all(feeds.map(async f=>[f.key,["permits","heritageAddressEvidence"].includes(f.key)||market==="Milton"&&f.key==="heritage"?await haltonAddressEvidence(f,matchedCity?address:null,pointLocation,context):await municipalPointLayer(f,pointLocation,context)] as const)));
  const result:Record<string,Layer>=Object.fromEntries(Object.entries(entries).filter(([k])=>!k.startsWith("zoning")&&!k.endsWith("Zoning")&&k!=="residentialZoning2026"));
  result.zoning=zoningGroup(market,entries);
  if(market==="Burlington"&&result.heritage?.data)result.heritage={...result.heritage,data:{...result.heritage.data as Row,coverageComplete:false,fullCurrentHeritageRegisterVerified:false}};
  if(market==="Milton"&&result.planningApplications?.data)result.planningApplications={...result.planningApplications,data:{...result.planningApplications.data as Row,queryCoverageComplete:!result.planningApplications.truncated,coverageComplete:false,fullPlanningHistorySearched:false,currentApprovalConditionsVerified:false,appealOutcomesVerified:false}};
  result.officialPlan=layer("not_supported",{coverageComplete:false,currentPlanScreenPerformed:false,currentMunicipalAmendmentsVerified:false,formerRegionalPlanBecameMunicipalDate:"2024-07-01",verificationUrl:HALTON_GUIDANCE[market].plan,formerRegionalPlanVerificationUrl:HALTON_PLAN_GUIDANCE,...(market==="Milton"?{currentPublishedMunicipalConsolidation:"February 2026"}:{})},null,"Current municipal plan schedules, amendments and constraints are not yet connected as licensed property-level evidence. Halton's former regional plan became a plan of each local municipality on July 1, 2024; generalized land use, hamlet and community boundaries do not replace both applicable plan reviews.");
  result.development=layer("not_supported",{fullPlanningHistorySearched:false,coverageComplete:false},null,market==="Milton"?"Subject-point development polygons are returned separately in planningApplications; nearby proposals, full file history, decision conditions and appeals remain unverified.":"Complete current planning applications, decisions, appeals and nearby proposals are not yet connected as verified licensed evidence.");
  if(market==="Milton")result.permits=layer("not_supported",null,null,"Milton's property-level permit history, published status, final inspections and occupancy documents are not yet connected to a verified licensed open feed.");
  return result;
}
export async function haltonCoverage() {
  const context=new Map<string,Promise<Row>>();
  const inspect=async(f:MunicipalFeed)=>{
    if(f.disabledReason)return {city:f.market,layer:f.key,status:"withheld",records:null,source:{...f.source,licence:"Dataset reuse or current enacted scope unverified; adapter withheld"},note:f.disabledReason};
    try {const m=await municipalMetadata(f,context),r=await get(f.url+"/query",{where:"1=1",returnCountOnly:"true"}),count=number(r.count);if(count===null||count<0||!Number.isInteger(count))throw new Error("Invalid count");return {city:f.market,layer:f.key,status:"verified",records:count,source:f.source,sourceUpdatedAt:m.sourceUpdatedAt,note:f.note};}
    catch{return {city:f.market,layer:f.key,status:"unavailable",records:null,source:f.source,note:"Publisher, exact endpoint, licence, named child layer, schema or live count could not be verified."};}
  };
  const datasets:Awaited<ReturnType<typeof inspect>>[]=[];for(let i=0;i<HALTON_FEEDS.length;i+=4)datasets.push(...await Promise.all(HALTON_FEEDS.slice(i,i+4).map(inspect)));
  return {cities:["Burlington","Milton","Oakville"],delivery:"cached_live_queries",cacheSeconds:3600,datasets,note:"Partial municipal coverage; Halton Hills remains queued. The former regional plan became local plans July 1, 2024; current plans/amendments and full legal permissions remain unverified. Oakville permits advertise a rolling ten-year scope; Burlington observations can repeat permit numbers. Dataset rows overlap and are not distinct properties, unique data points or database imports."};
}
