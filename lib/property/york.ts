import { load } from "cheerio/slim";
import { fetchJson, literal, rows } from "./http";
import { civicStreetKey, cityKey, hasUnit, layer, number, streetNumber, text, type Layer, type Location, type PropertyRequest, type Row } from "./model";
import { provinceKey } from "./geocode";
import { nationalAddress } from "./national";
import { arcgisDate, streetVariants } from "./hamilton";
import { haversineMeters } from "@/lib/geo/geometry";
import { YORK_COMMUNITIES, YORK_FEEDS, YORK_LICENCE_EPOCH, YORK_LICENCE_ITEM, YORK_MUNICIPALITIES, YORK_PLAN_GUIDANCE, YORK_PROPERTY_ADDRESS_TYPES, YORK_PUBLISHED_MUNICIPAL_LABELS, YORK_REVIEW_GUIDANCE, YORK_WITHHELD, type YorkFeed, type YorkMunicipality } from "./york-sources";

const aliases:Record<string,YorkMunicipality>=Object.fromEntries(YORK_MUNICIPALITIES.map(m=>[cityKey(m),m]));
function cityName(city:string|null):string {return cityKey(city??"").replace(/^(city of|town of|township of)\s+/,"");}
export function yorkMunicipality(city:string|null,province:string|null):YorkMunicipality|null {
  return provinceKey(province??"")==="ontario"?aliases[cityName(city)]??YORK_COMMUNITIES[cityName(city)]?.municipality??null:null;
}
async function get(url:string,params:Record<string,string>={}):Promise<Row> {
  const u=new URL(url);Object.entries({f:"json",...params}).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetchJson(new URL(u.href.replace(/\+/g,"%20"))) as Row;
  if(!r||typeof r!=="object"||Array.isArray(r)||r.error)throw new Error("York source unavailable");return r;
}
/** Pin the inspected grant's metadata, exact item endpoint, named schema and field types before any record query. */
export async function yorkMetadata(f:YorkFeed,context=new Map<string,Promise<Row>>()) {
  const read=(url:string)=>{const pending=context.get(url)??get(url);context.set(url,pending);return pending;};
  const [licence,item,m]=await Promise.all([read(`https://www.arcgis.com/sharing/rest/content/items/${YORK_LICENCE_ITEM}`),read(`https://www.arcgis.com/sharing/rest/content/items/${f.item}`),read(f.url)]);
  const terms=typeof item.licenseInfo==="string"?load(item.licenseInfo).text().replace(/\s+/g," ").trim():"";
  if(!Object.entries(YORK_LICENCE_EPOCH).every(([k,v])=>licence[k]===v)||item.owner!==f.owner||item.orgId!==f.org||item.access!=="public"||item.title!==f.expectedItemTitle||item.url!==f.url||!f.licenceAnchors.includes(terms)||m.name!==f.expectedLayerName||m.geometryType!==f.geometry||(m.copyrightText??"")!==f.expectedCopyright||!Object.entries(f.fieldTypes).every(([name,type])=>rows(m.fields).some(x=>x.name===name&&x.type===type)))throw new Error("York publisher, licence or schema changed");
  return {sourceUpdatedAt:arcgisDate((m.editingInfo as Row|undefined)?.dataLastEditDate)};
}
function point(g:Row|null):g is Row&{x:number;y:number} {return typeof g?.x==="number"&&typeof g.y==="number"&&g.y>43.7&&g.y<44.55&&g.x> -79.85&&g.x< -79.0;}
function precise(l:Location|null):l is Location&{latitude:number;longitude:number} {return Boolean(l&&point({x:l.longitude,y:l.latitude})&&["source_building_point","source_civic_address_point","caller_supplied"].includes(l.accuracy));}
function features(r:Row,f:YorkFeed) {
  return rows(r.features).map(x=>{
    const a=x.attributes as Row;
    if(!a||typeof a!=="object"||Array.isArray(a)||!Object.entries(f.fieldTypes).every(([k,t])=>{
      if(!(k in a))return false;const v=a[k];
      if(k===f.oid)return typeof v==="number"&&Number.isInteger(v)&&v>0;
      return v===null||(t==="esriFieldTypeString"?typeof v==="string":typeof v==="number"&&Number.isFinite(v));
    }))throw new Error("Invalid York record");
    return {a:Object.fromEntries(Object.keys(f.fields).map(k=>[k,a[k]])),g:x.geometry&&typeof x.geometry==="object"&&!Array.isArray(x.geometry)?x.geometry as Row:null};
  });
}
function mapped(a:Row,f:YorkFeed):Row {return Object.fromEntries(Object.entries(f.fields).map(([k,v])=>[v,f.dates?.includes(k)?arcgisDate(a[k]):a[k]]));}
function addressAt(a:Row):string {return `${number(a.ADDRESS_NUMBER)??""}${text(a.ADD_NUM_SUFFIX)??""} ${text(a.FULL_STREET_NAME)??""}`.trim();}
function scopeWhere(f:YorkFeed,municipality?:YorkMunicipality):string {
  const mun=(field:string)=>`${field} IN (${(municipality?[municipality]:YORK_MUNICIPALITIES).map(literal).join(",")})`;
  if(f.key==="addresses")return `${mun("MUNICIPALITY")} AND LIFESTATUS = 'Active' AND ADDRS_PNT_TYPE IN (${YORK_PROPERTY_ADDRESS_TYPES.map(literal).join(",")})`;
  if(f.key==="municipality")return mun("NAME");
  if(f.key==="parcel")return `${mun("MUNNAME")} AND LIFESTATUS = 'Active' AND SOURCE = 'York Region'`;
  if(f.key==="regionalPlanningApplications")return mun("MUN_NAME");
  if(f.key==="employmentInventory2025")return `MUNNAME IN (${(municipality?[municipality]:YORK_MUNICIPALITIES).map(m=>literal(YORK_PUBLISHED_MUNICIPAL_LABELS[m])).join(",")})`;
  return "1=1";
}
export async function yorkLocation(input:PropertyRequest):Promise<Layer<Location>|null> {
  const requestedCity=input.city??input.address?.split(",")[1]?.trim()??null;
  const municipality=yorkMunicipality(requestedCity,input.province??input.address?.split(",")[2]?.trim()??"ON");
  if(!municipality||!input.address||input.lat!==undefined||hasUnit(input.address))return null;
  const address=input.address.split(",")[0].trim(),civic=streetNumber(address);if(!civic)return null;
  const f=YORK_FEEDS.find(f=>f.key==="addresses")!;
  const embeddedCity=input.address.split(",")[1]?.trim();
  if(input.city&&embeddedCity&&cityName(input.city)!==cityName(embeddedCity)&&(yorkMunicipality(embeddedCity,"ON")!==municipality||(YORK_COMMUNITIES[cityName(input.city)]&&YORK_COMMUNITIES[cityName(embeddedCity)]&&YORK_COMMUNITIES[cityName(input.city)].publishedCommunity!==YORK_COMMUNITIES[cityName(embeddedCity)].publishedCommunity)))return layer("ambiguous",null,f.source,"The explicit city conflicts with the address's community. Correct the civic identity before screening.");
  try {
    const m=await yorkMetadata(f);
    const street=address.replace(/^\d+[a-z]?\s+/i,"");
    const r=await get(f.url+"/query",{where:`${scopeWhere(f,municipality)} AND ADDRESS_NUMBER = ${parseInt(civic,10)} AND UPPER(FULL_STREET_NAME) IN (${streetVariants(street).map(literal).join(",")})`,outFields:Object.keys(f.fields).join(","),returnGeometry:"true",outSR:"4326",resultRecordCount:"501",orderByFields:f.oid});
    const all=features(r,f);if(r.exceededTransferLimit||all.length>=501)throw new Error("Incomplete civic candidates");
    const community=YORK_COMMUNITIES[cityName(requestedCity)]?.publishedCommunity;
    const exact=all.filter(({a})=>a.MUNICIPALITY===municipality&&a.LIFESTATUS==="Active"&&YORK_PROPERTY_ADDRESS_TYPES.includes(String(a.ADDRS_PNT_TYPE))&&(!community||cityKey(text(a.MAIL_COMMUNITY_NAME)??"")===cityKey(community))&&civicStreetKey(addressAt(a))===civicStreetKey(address));
    if(!exact.length)return null;
    const primary=exact.find(({a})=>!text(a.SUITE_NUMBER))??exact[0];
    if(!point(primary.g)||exact.some(({g})=>!point(g)||haversineMeters(primary.g!.y as number,primary.g!.x as number,g.y,g.x)>20)||new Set(exact.map(({a})=>cityKey(text(a.MAIL_COMMUNITY_NAME)??""))).size>1)return layer("ambiguous",null,f.source,"Exact civic points have conflicting postal communities, unusable coordinates or points more than 20 metres apart. No arbitrary point is selected.",m.sourceUpdatedAt);
    const registered=await nationalAddress({address,city:municipality,province:"ON"},provinceKey),n=registered?.status==="available"?registered.data:null;
    const nar=n?.accuracy==="source_building_point"&&n.address&&civicStreetKey(n.address)===civicStreetKey(address)&&yorkMunicipality(n.city,n.province)===municipality&&typeof n.latitude==="number"&&typeof n.longitude==="number"&&haversineMeters(primary.g.y,primary.g.x,n.latitude,n.longitude)<=20?n.addressRegister:undefined;
    const result=layer("available",{address:addressAt(primary.a),city:municipality,province:"ON",latitude:primary.g.y,longitude:primary.g.x,accuracy:"source_civic_address_point",provider:f.source.id,...(nar?{addressRegister:nar}:{}),municipalAddress:{recordIds:exact.map(({a})=>String(a[f.oid])),community:text(primary.a.MAIL_COMMUNITY_NAME),permitAddressKeys:[civicStreetKey(address)],source:f.source,sourceUpdatedAt:m.sourceUpdatedAt,publishedRecords:exact.slice(0,50).map(({a})=>mapped(a,f)),publishedAddressRecordCount:exact.length,publishedRecordsTruncated:exact.length>50}},f.source,f.note+" Civic suffix, street type and direction must match. Civic parcel IDs are municipal references, not title or PIN records. National building metadata is retained only when civic identity, municipality and a unique point agree within 20 metres.",m.sourceUpdatedAt);result.truncated=exact.length>50;return result;
  }catch{return null;}
}
async function yorkPointLayer(f:YorkFeed,municipality:YorkMunicipality,location:Location|null,context:Map<string,Promise<Row>>):Promise<Layer> {
  if(!precise(location))return layer("skipped",null,f.source,"A verified civic/building point or caller-supplied point is required. Street interpolation is not screened.");
  try {
    const m=await yorkMetadata(f,context),r=await get(f.url+"/query",{where:scopeWhere(f,f.key==="municipality"?undefined:municipality),geometry:`${location.longitude},${location.latitude}`,geometryType:"esriGeometryPoint",inSR:"4326",spatialRel:"esriSpatialRelIntersects",outFields:Object.keys(f.fields).join(","),returnGeometry:"false",resultRecordCount:"51",orderByFields:f.oid});
    const all=features(r,f);if(!all.length&&r.exceededTransferLimit)throw new Error("Incomplete empty query");
    if(all.some(({a})=>f.key==="parcel"&&(a.LIFESTATUS!=="Active"||a.SOURCE!=="York Region"||a.MUNNAME!==municipality)||(f.key==="regionalPlanningApplications"&&a.MUN_NAME!==municipality)||(f.key==="employmentInventory2025"&&a.MUNNAME!==YORK_PUBLISHED_MUNICIPAL_LABELS[municipality])))throw new Error("Query scope mismatch");
    const truncated=Boolean(r.exceededTransferLimit||all.length>50);
    const civicIds=new Set<unknown>(rows(location.municipalAddress?.publishedRecords??[]).map(r=>r.municipalParcelId).filter(v=>v!==null&&v!==undefined));
    const parcelAmbiguous=f.key==="parcel"&&(all.length>1||(civicIds.size>0&&location.provider==="york:addresses"&&all.some(({a})=>!civicIds.has(a.PAR_GIS_ID))));
    const result=layer(parcelAmbiguous?"ambiguous":all.length?"available":"no_match",{records:all.slice(0,50).map(({a})=>mapped(a,f)),matchMethod:f.key==="regionalPlanningApplications"?"published_application_boundary_intersects_subject_point":"published_polygon_intersects_point",screenedPoint:{latitude:location.latitude,longitude:location.longitude,accuracy:location.accuracy},coverageComplete:!truncated&&!["parcel","regionalPlanningApplications"].includes(f.key),queryCoverageComplete:!truncated,parcelWideScreenPerformed:false,absenceEstablished:false,...(f.key==="parcel"?{recordScope:"Active York Region-sourced records only",fullParcelFabricSearched:false,civicParcelReferenceAgreement:location.provider==="york:addresses"&&civicIds.size>0?all.length>0&&!parcelAmbiguous:null}:{}),...(f.key==="regionalPlanningApplications"?{scope:"regional_commenting_and_review_application_area",fullPlanningHistorySearched:false,municipalApprovalEstablished:false,currentMunicipalAmendmentsVerified:false,nearbySearchPerformed:false,verificationUrl:YORK_REVIEW_GUIDANCE}:{}),...(f.key==="employmentInventory2025"?{inventoryYear:2025,currentZoningScreenPerformed:false}:{}),...(f.key==="wellheadProtection"?{currentActivitySpecificRulesVerified:false,waterSafetyEstablished:false}:{} )},f.source,f.note+" This is a subject-point screen; no-match does not establish absence.",m.sourceUpdatedAt);result.truncated=truncated;return result;
  }catch{return layer("unavailable",null,f.source,"The exact publisher, licence-document epoch, named schema, record scope or bounded query could not be verified. No factual result is returned.");}
}
export async function yorkLayers(city:string|null,province:string|null,location:Location|null,requestedCity?:string):Promise<Record<string,Layer>> {
  const municipality=yorkMunicipality(requestedCity??city,province);if(!municipality)return {};
  const context=new Map<string,Promise<Row>>(),boundaryFeed=YORK_FEEDS.find(f=>f.key==="municipality")!;
  let boundary=await yorkPointLayer(boundaryFeed,municipality,location,context);
  const records=rows((boundary.data as Row|null)?.records??[]),agreed=boundary.status==="available"&&!boundary.truncated&&records.length===1&&records[0].municipality===municipality;
  if(boundary.status==="available"&&!agreed)boundary=layer("ambiguous",{...boundary.data as Row,expectedMunicipality:municipality,coverageComplete:false},boundaryFeed.source,"The published boundary is non-unique or conflicts with the requested municipality. Regional property layers are not assigned.",boundary.sourceUpdatedAt);
  const entries=await Promise.all(YORK_FEEDS.filter(f=>!["addresses","municipality"].includes(f.key)).map(async f=>[f.key,agreed?await yorkPointLayer(f,municipality,location,context):layer("skipped",null,f.source,"A unique municipal boundary did not confirm the requested municipality; this point screen was not performed.")] as const));
  const note=`${municipality}'s current licensed municipal property-level feed has not yet been integrated. Regional evidence does not complete this municipal review.`;
  return {municipality:boundary,...Object.fromEntries(entries),permits:layer("not_supported",null,null,"Municipal permit history, final inspections and occupancy: "+note),zoning:layer("not_supported",{zoningScreenPerformed:false,currentMunicipalAmendmentsVerified:false},null,"Current detailed zones, exceptions, holding provisions, amendments and appeals: "+note),heritage:layer("not_supported",{fullHeritageScreenPerformed:false},null,"Individual heritage register and districts: "+note),officialPlan:layer("not_supported",{currentPlanScreenPerformed:false,currentMunicipalAmendmentsVerified:false,municipalResponsibilityDate:"2024-07-01",verificationUrl:YORK_PLAN_GUIDANCE},null,"York reports that regional-plan implementation transferred to municipalities on July 1, 2024. Current local schedules, amendments and appeals need verification. "+note),planningApplications:layer("not_supported",{fullPlanningHistorySearched:false,verificationUrl:YORK_REVIEW_GUIDANCE},null,"Full municipal planning applications, decisions and appeals: "+note),development:layer("not_supported",{nearbySearchPerformed:false,fullPlanningHistorySearched:false},null,"A nearby-development search and complete municipal planning history are not yet connected; returned regional applications intersect the subject point only." )};
}
export async function yorkCoverage() {
  const context=new Map<string,Promise<Row>>();
  const inspect=async(f:YorkFeed)=>{try {
    const m=await yorkMetadata(f,context),r=await get(f.url+"/query",{where:scopeWhere(f),returnCountOnly:"true"}),count=number(r.count);if(count===null||!Number.isInteger(count)||count<0)throw new Error("Invalid count");
    return {layer:f.key,status:"verified",records:count,source:f.source,sourceUpdatedAt:m.sourceUpdatedAt,note:f.note,countScope:f.key==="addresses"?"Active allowed property-address types in the nine York municipalities only":f.key==="parcel"?"Active York Region-sourced parcel-reference records in the nine municipalities only":f.key==="wellheadProtection"?"Published wellhead-protection polygons; property queries require a confirmed York municipality":"Published records assigned to the nine York municipalities only"};
  }catch{return {layer:f.key,status:"unavailable",records:null,source:f.source,note:"Publisher, grant epoch, schema or scoped live count could not be verified."};}};
  const datasets=[];for(let i=0;i<YORK_FEEDS.length;i+=3)datasets.push(...await Promise.all(YORK_FEEDS.slice(i,i+3).map(inspect)));
  return {cities:[...YORK_MUNICIPALITIES],layers:YORK_FEEDS.filter(f=>f.key!=="addresses").map(f=>f.key),delivery:"cached_live_queries",cacheSeconds:3600,datasets,withheld:YORK_WITHHELD.map(f=>({...f,status:"withheld",records:null,url:`https://www.arcgis.com/home/item.html?id=${f.item}`})),note:"Regional point evidence is partial municipal coverage. Current zoning, municipal permit/inspection history, heritage, local planning decisions and current municipal Official Plan amendments remain separate gaps. Source rows overlap and are not distinct properties, unique data points or database imports."};
}
