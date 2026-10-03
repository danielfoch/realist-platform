import { createHash } from "node:crypto";
import { load } from "cheerio/slim";
import { haversineMeters } from "@/lib/geo/geometry";
import { fetchJson, literal, rows } from "./http";
import { civicStreetKey, cityKey, hasUnit, layer, number, text, type Layer, type Location, type PropertyRequest, type Row } from "./model";
import { provinceKey } from "./geocode";
import { nationalAddress } from "./national";
import { arcgisDate, streetVariants } from "./hamilton";
import { MARKHAM_BUILDING_URL, MARKHAM_COMMUNITIES, MARKHAM_FEEDS, MARKHAM_GRANT_HASH, MARKHAM_HERITAGE_URL, MARKHAM_PLAN_URL, MARKHAM_PLANNING_URL, MARKHAM_TERMS_EPOCH, MARKHAM_TERMS_ITEM, MARKHAM_WITHHELD, type MarkhamFeed } from "./markham-sources";

function community(city:string|null):string { return cityKey(city??"").replace(/^city of\s+/,""); }
export function markhamMarket(city:string|null,province:string|null):boolean { return provinceKey(province??"")==="ontario" && ["markham","unionville"].includes(community(city)); }
async function get(url:string,params:Record<string,string>={}):Promise<Row> {
  const u=new URL(url);Object.entries({f:"json",...params}).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetchJson(u) as Row;if(!r||typeof r!=="object"||Array.isArray(r)||r.error)throw new Error("Markham source unavailable");return r;
}
function grant(data:Row):unknown {
  // The inspected Hub Page contains one grant card. Changed structures fail closed.
  try {return (data as {values:{layout:{sections:{rows:{cards:{component:{settings:{markdown:unknown}}}[]}[]}[]}}}).values.layout.sections[0].rows[0].cards[0].component.settings.markdown;}catch{return null;}
}
export async function markhamMetadata(f:MarkhamFeed,context=new Map<string,Promise<Row>>()) {
  const read=(url:string)=>{const pending=context.get(url)??get(url);context.set(url,pending);return pending;};
  const base=`https://www.arcgis.com/sharing/rest/content/items/${MARKHAM_TERMS_ITEM}`;
  const [licence,data,item,m]=await Promise.all([read(base),read(base+"/data"),read(`https://www.arcgis.com/sharing/rest/content/items/${f.item}`),read(f.url)]);
  const fragment=grant(data),terms=typeof item.licenseInfo==="string"?load(item.licenseInfo):null;
  const anchor=terms?.("a");
  if(!Object.entries(MARKHAM_TERMS_EPOCH).every(([k,v])=>licence[k]===v)||typeof fragment!=="string"||createHash("sha256").update(fragment).digest("hex")!==MARKHAM_GRANT_HASH||item.owner!==f.owner||item.orgId!==f.org||item.access!=="public"||item.title!==f.expectedItemTitle||item.url!==f.rootUrl||terms?.text().replace(/\s+/g," ").trim()!=="This work is licensed under The City of Markham's Terms of Use"||anchor?.length!==1||anchor.attr("href")!==f.licenceAnchors[0]||m.name!==f.expectedLayerName||m.geometryType!==f.geometry||(m.copyrightText??"")!==""||!Object.entries(f.fieldTypes).every(([name,type])=>rows(m.fields).some(x=>x.name===name&&x.type===type)))throw new Error("Markham publisher, grant or schema changed");
  return {sourceUpdatedAt:arcgisDate((m.editingInfo as Row|undefined)?.dataLastEditDate)};
}
function point(g:Row|null):g is Row&{x:number;y:number} {return typeof g?.x==="number"&&typeof g.y==="number"&&g.x> -79.52&&g.x< -79.05&&g.y>43.75&&g.y<44.1;}
function precise(l:Location|null):l is Location&{latitude:number;longitude:number} {return Boolean(l&&point({x:l.longitude,y:l.latitude})&&["source_building_point","source_civic_address_point","caller_supplied"].includes(l.accuracy));}
function features(r:Row,f:MarkhamFeed) {
  return rows(r.features).map(x=>{
    const a=x.attributes as Row;
    if(!a||typeof a!=="object"||Array.isArray(a)||!Object.entries(f.fieldTypes).every(([k,t])=>{
      if(!(k in a))return false;const v=a[k];if(k===f.oid)return typeof v==="number"&&Number.isInteger(v)&&v>0;
      return v===null||(t==="esriFieldTypeString"?typeof v==="string":typeof v==="number"&&Number.isFinite(v));
    }))throw new Error("Invalid Markham record");
    return {a:Object.fromEntries(Object.keys(f.fields).map(k=>[k,a[k]])),g:x.geometry&&typeof x.geometry==="object"&&!Array.isArray(x.geometry)?x.geometry as Row:null};
  });
}
function mapped(a:Row,f:MarkhamFeed):Row {return Object.fromEntries(Object.entries(f.fields).map(([k,v])=>[v,a[k]]));}
function civicKey(address:string):string {
  return civicStreetKey(address.replace(/\b(pky|pkwy)(?=\s*(?:[nsew]|north|south|east|west)?\s*$)/ig,"parkway"));
}
function civicVariants(address:string):string[] {
  const base=streetVariants(civicKey(address));
  return [...new Set([...base,...base.map(v=>v.replace(/\bPARKWAY\b/g,"PKY")),...base.map(v=>v.replace(/\bCOURT\b/g,"CRT"))])].slice(0,384);
}
const civicScope=`MUNICIPALITY IN (${MARKHAM_COMMUNITIES.map(literal).join(",")})`;
export async function markhamLocation(input:PropertyRequest):Promise<Layer<Location>|null> {
  const city=input.city??input.address?.split(",")[1]?.trim()??null,province=input.province??input.address?.split(",")[2]?.trim()??"ON";
  if(!markhamMarket(city,province)||!input.address||input.lat!==undefined||hasUnit(input.address))return null;
  const f=MARKHAM_FEEDS[0],embedded=input.address.split(",")[1]?.trim();
  if(input.city&&embedded&&(!markhamMarket(embedded,"ON")||!markhamMarket(input.city,"ON")))return layer("ambiguous",null,f.source,"The explicit municipality conflicts with the address community. Correct the civic identity before screening.");
  const requested=[community(city),community(embedded??null)],unionville=requested.includes("unionville"),address=input.address.split(",")[0].trim();
  try {
    const m=await markhamMetadata(f),r=await get(f.url+"/query",{where:`${civicScope} AND UPPER(FULL_ADDRESS) IN (${civicVariants(address).map(literal).join(",")})`,outFields:Object.keys(f.fields).join(","),returnGeometry:"true",outSR:"4326",resultRecordCount:"501",orderByFields:f.oid});
    const all=features(r,f);if(r.exceededTransferLimit||all.length>=501)throw new Error("Incomplete civic candidates");
    const exact=all.filter(({a})=>MARKHAM_COMMUNITIES.includes(String(a.MUNICIPALITY))&&(!unionville||a.MUNICIPALITY==="UNIONVILLE")&&civicKey(String(a.FULL_ADDRESS))===civicKey(address)&&civicKey(`${text(a.ADDRESS)??""} ${text(a.FULL_STREET_NAME)??""}`)===civicKey(address));
    if(!exact.length)return null;const primary=exact[0];
    if(!point(primary.g)||exact.some(({g})=>!point(g)||haversineMeters(primary.g!.y as number,primary.g!.x as number,g.y,g.x)>20)||new Set(exact.map(({a})=>a.MUNICIPALITY)).size>1)return layer("ambiguous",null,f.source,"Matching civic points have conflicting communities, unusable coordinates or points more than 20 metres apart. No arbitrary point is selected.",m.sourceUpdatedAt);
    const registered=await nationalAddress({address,city:"Markham",province:"ON"},provinceKey),n=registered?.status==="available"?registered.data:null;
    const nar=n?.accuracy==="source_building_point"&&n.address&&civicKey(n.address)===civicKey(address)&&markhamMarket(n.city,n.province)&&typeof n.latitude==="number"&&typeof n.longitude==="number"&&haversineMeters(primary.g.y,primary.g.x,n.latitude,n.longitude)<=20?n.addressRegister:undefined;
    const result=layer("available",{address:String(primary.a.FULL_ADDRESS),city:"Markham",province:"ON",latitude:primary.g.y,longitude:primary.g.x,accuracy:"source_civic_address_point",provider:f.source.id,...(nar?{addressRegister:nar}:{}),municipalAddress:{recordIds:exact.map(({a})=>String(a[f.oid])),community:text(primary.a.MUNICIPALITY),permitAddressKeys:[civicStreetKey(address)],source:f.source,sourceUpdatedAt:m.sourceUpdatedAt,publishedRecords:exact.slice(0,50).map(({a})=>mapped(a,f)),publishedAddressRecordCount:exact.length,publishedRecordsTruncated:exact.length>50}},f.source,f.note+" Civic suffix, street type and direction must match; duplicates do not establish units. A unique York municipality boundary must confirm Markham before municipal polygon screening.",m.sourceUpdatedAt);result.truncated=exact.length>50;return result;
  }catch{return null;}
}
async function pointLayer(f:MarkhamFeed,location:Location,context:Map<string,Promise<Row>>):Promise<Layer> {
  try {
    const m=await markhamMetadata(f,context),r=await get(f.url+"/query",{where:"1=1",geometry:`${location.longitude},${location.latitude}`,geometryType:"esriGeometryPoint",inSR:"4326",spatialRel:"esriSpatialRelIntersects",outFields:Object.keys(f.fields).join(","),returnGeometry:"false",resultRecordCount:"51",orderByFields:f.oid});
    const all=features(r,f);if(!all.length&&r.exceededTransferLimit)throw new Error("Incomplete empty query");const truncated=Boolean(r.exceededTransferLimit||all.length>50);
    const result=layer(all.length?"available":"no_match",{records:all.slice(0,50).map(({a})=>mapped(a,f)),matchMethod:"published_polygon_intersects_point",screenedPoint:{latitude:location.latitude,longitude:location.longitude,accuracy:location.accuracy},coverageComplete:false,queryCoverageComplete:!truncated,parcelWideScreenPerformed:false,absenceEstablished:false,
      ...(f.key==="heritageDistrict"?{fullHeritageScreenPerformed:false,individualRegisterSearched:false,currentDesignationBylawVerified:false,verificationUrl:MARKHAM_HERITAGE_URL}:{}),
      ...(f.key==="secondaryPlans"?{currentPlanScreenPerformed:false,currentMunicipalAmendmentsVerified:false,currentAppealsVerified:false,inForcePolicyEstablished:false,verificationUrl:MARKHAM_PLAN_URL}:{}),
      ...(f.key==="developmentChargeAreas"?{currentRatesVerified:false,feesCalculated:false,paymentOrExemptionEstablished:false,currentServicingEstablished:false}: {})},f.source,f.note+" Source data-update time is unknown where editingInfo is unpublished. This is a subject-point screen; no-match does not establish absence.",m.sourceUpdatedAt);result.truncated=truncated;return result;
  }catch{return layer("unavailable",null,f.source,"The exact public publisher, inspected terms-page grant, named typed schema or bounded query could not be verified. No factual result is returned.");}
}
export async function markhamLayers(city:string|null,province:string|null,location:Location|null,boundary:Layer|undefined,requestedCity?:string):Promise<Record<string,Layer>> {
  if(!markhamMarket(requestedCity??city,province))return {};
  const context=new Map<string,Promise<Row>>(),records=rows((boundary?.data as Row|null)?.records??[]);
  const agreed=precise(location)&&boundary?.status==="available"&&!boundary.truncated&&records.length===1&&records[0].municipality==="Markham";
  const entries=await Promise.all(MARKHAM_FEEDS.slice(1).map(async f=>[f.key,agreed?await pointLayer(f,location!,context):layer("skipped",null,f.source,"A precise civic/building/caller point and unique York boundary confirming Markham are required; this municipal point screen was not performed.")] as const));
  return {...Object.fromEntries(entries),
    heritage:layer("unavailable",{fullHeritageScreenPerformed:false,individualRegisterSearched:false,verificationUrl:MARKHAM_HERITAGE_URL},null,"The individual heritage register's public GIS item has no explicit reuse grant and is withheld. Licensed heritageDistrict evidence is a separate partial screen."),
    zoning:layer("unavailable",{zoningScreenPerformed:false,currentMunicipalAmendmentsVerified:false,verificationUrl:MARKHAM_BUILDING_URL},null,"The public interactive zoning item has no explicit dataset reuse grant and is withheld. Current bylaws, exceptions, holding provisions and appeals require City verification through its current services."),
    officialPlan:layer("not_supported",{currentPlanScreenPerformed:false,currentMunicipalAmendmentsVerified:false,currentAppealsVerified:false,verificationUrl:MARKHAM_PLAN_URL},null,"The City reports the 2014 plan is partially approved and the 1987 plan remains in force in certain appealed and secondary-plan areas. Licensed secondaryPlans mapping supplies area references and source status; it does not complete a current plan/policy screen."),
    permits:layer("not_supported",{verificationUrl:MARKHAM_BUILDING_URL,fullPermitHistorySearched:false},null,"No verified licensed property-level permit history is connected. The City provides public ePLAN search and requests for inspections, completion/compliance reports and permit drawings; those records have not been retrieved."),
    planningApplications:layer("not_supported",{fullPlanningHistorySearched:false,verificationUrl:MARKHAM_PLANNING_URL},null,"Full municipal application history, current decisions, conditions and appeals remain unsearched. York regional commenting boundaries are separate."),
    development:layer("not_supported",{nearbySearchPerformed:false,fullPlanningHistorySearched:false,verificationUrl:MARKHAM_PLANNING_URL},null,"Nearby municipal proposals and complete file history are not yet connected. Secondary-plan and charge-area polygons do not establish an active development application.")};
}
export async function markhamCoverage() {
  const context=new Map<string,Promise<Row>>();
  const datasets=await Promise.all(MARKHAM_FEEDS.map(async f=>{try {
    const m=await markhamMetadata(f,context),r=await get(f.url+"/query",{where:f.key==="addresses"?civicScope:"1=1",returnCountOnly:"true"}),count=number(r.count);if(count===null||!Number.isInteger(count)||count<0)throw new Error("Invalid count");
    return {layer:f.key,status:"verified",records:count,source:f.source,sourceUpdatedAt:m.sourceUpdatedAt,note:f.note,countScope:f.key==="addresses"?"Published MARKHAM, UNIONVILLE and THORNHILL civic labels in the City-owned feed":"All published source polygons; boundaries are subject-point reference screens"};
  }catch{return {layer:f.key,status:"unavailable",records:null,source:f.source,note:"The exact publisher, grant epoch/hash, schema or bounded live count could not be verified."};}}));
  return {city:"Markham",delivery:"cached_live_queries",cacheSeconds:3600,datasets,withheld:MARKHAM_WITHHELD.map(f=>({...f,status:"withheld",records:null,url:`https://www.arcgis.com/home/item.html?id=${f.item}`})),complete:false,note:"Municipal point evidence adds to York regional coverage. Current permits/inspections, detailed zoning, individual heritage register, current applicable plans and complete local applications remain gaps. Source rows overlap; counts are not unique properties, field-level data points or database imports."};
}
