import { fetchJson, literal, rows } from "./http";
import { civicStreetKey, cityKey, hasUnit, layer, number, streetNumber, text, type Layer, type Location, type PropertyRequest, type Row, type Source } from "./model";
import { provinceKey } from "./geocode";
import { nationalAddress } from "./national";
import { haversineMeters } from "@/lib/geo/geometry";
import { arcgisDate } from "./hamilton";
import { municipalMetadata, municipalPointLayer } from "./ontario-municipal";
import { DURHAM_ADDRESS, DURHAM_BOUNDARY, DURHAM_COMMUNITIES, DURHAM_FEEDS, DURHAM_MUNICIPALITIES, DURHAM_PLANNING, DURHAM_PLAN_GUIDANCE, DURHAM_PLAN_NOTE, DURHAM_TERMS, type DurhamMunicipality } from "./durham-sources";

const aliases:Record<string,DurhamMunicipality> = Object.fromEntries(DURHAM_MUNICIPALITIES.map(m=>[cityKey(m),m]));
export function durhamMunicipality(city:string|null,province:string|null):DurhamMunicipality|null {
  const key=cityKey(city??"").replace(/^(township of|town of|municipality of)\s+/,"");
  return provinceKey(province??"") === "ontario" ? aliases[key]??DURHAM_COMMUNITIES[key]?.municipality??null : null;
}
async function get(path:string,params:Record<string,string>):Promise<Row> {
  const u=new URL(path);Object.entries({f:"json",...params}).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetchJson(new URL(u.href.replace(/\+/g,"%20"))) as Row;if(!r || typeof r!=="object" || Array.isArray(r) || r.error)throw new Error("Durham source unavailable");return r;
}
function point(g:Row|null):g is Row & {x:number;y:number} {return typeof g?.x==="number" && typeof g.y==="number" && g.y>43.75 && g.y<44.65 && g.x>-79.4 && g.x< -78.3;}
function publishedAddress(a:Row):string {
  const direction=(text(a.ROAD_DIR)??"").replace(/^(North|South) (East|West)$/i,"$1$2");
  return [`${text(a.CIVIC_NUM)??""}${text(a.CIVIC_SFX)??""}`,text(a.ROAD_NAME),text(a.ROAD_TYPE),direction].filter(Boolean).join(" ");
}
export async function durhamLocation(input:PropertyRequest):Promise<Layer<Location>|null> {
  const requestedCity=input.city??input.address?.split(",")[1]?.trim()??null;
  const municipality=durhamMunicipality(requestedCity,input.province??input.address?.split(",")[2]?.trim()??"ON");
  if(!municipality || !input.address || input.lat!==undefined || hasUnit(input.address))return null;
  const address=input.address.split(",")[0].trim(),civic=streetNumber(address);if(!civic)return null;
  try {
    const meta=await municipalMetadata(DURHAM_ADDRESS);
    const numbers=[...new Set([civic.toUpperCase(),String(parseInt(civic,10))])].map(literal).join(",");
    const r=await get(DURHAM_ADDRESS.url+"/query",{where:`UPPER(CIVIC_NUM) IN (${numbers}) AND MUNICIPALITY = ${literal(municipality)}`,outFields:Object.keys(DURHAM_ADDRESS.fields).join(","),returnGeometry:"true",outSR:"4326",resultRecordCount:"501",orderByFields:DURHAM_ADDRESS.oid});
    if(!Array.isArray(r.features) || r.exceededTransferLimit || r.features.length>=501)throw new Error("Incomplete civic candidates");
    const candidates=rows(r.features).map(f=>{
      const a=f.attributes as Row;if(!a || typeof a!=="object" || Array.isArray(a) || a.OBJECTID==null || !Object.keys(DURHAM_ADDRESS.fields).every(k=>k in a))throw new Error("Invalid civic record");
      return {a,g:f.geometry && typeof f.geometry==="object" && !Array.isArray(f.geometry)?f.geometry as Row:null};
    });
    const requestedTown=DURHAM_COMMUNITIES[cityKey(requestedCity??"")]?.publishedTown;
    const exact=candidates.filter(({a})=>text(a.MUNICIPALITY)===municipality && (!requestedTown || cityKey(text(a.TOWN)??"")===cityKey(requestedTown)) && civicStreetKey(publishedAddress(a))===civicStreetKey(address));
    if(!exact.length)return null;
    const primary=exact.find(({a})=>!text(a.UNIT_NUM)&&!text(a.UNIT_RANGE))??exact[0];
    if(!point(primary.g) || exact.some(({g})=>!point(g) || haversineMeters(primary.g!.y as number,primary.g!.x as number,g.y,g.x)>20) || new Set(exact.map(({a})=>cityKey(text(a.TOWN)??""))).size>1)return layer("ambiguous",null,DURHAM_ADDRESS.source,"Exact regional civic matches have differing community names, unusable points or points more than 20 metres apart. Provide verified building coordinates; no arbitrary point is selected.",meta.sourceUpdatedAt);
    const registered=await nationalAddress({address,city:municipality,province:"ON"},provinceKey);
    const n=registered?.status==="available"?registered.data:null;
    const nar=n?.accuracy==="source_building_point" && n.address && civicStreetKey(n.address)===civicStreetKey(address) && durhamMunicipality(n.city,n.province)===municipality && typeof n.latitude==="number" && typeof n.longitude==="number" && haversineMeters(primary.g.y,primary.g.x,n.latitude,n.longitude)<=20?n.addressRegister:undefined;
    const publishedRecords=exact.slice(0,50).map(({a})=>Object.fromEntries(Object.entries(DURHAM_ADDRESS.fields).map(([key,label])=>[label,DURHAM_ADDRESS.dates?.includes(key)?arcgisDate(a[key]):a[key]])));
    const result=layer("available",{address:publishedAddress(primary.a),city:municipality,province:"ON",latitude:primary.g.y,longitude:primary.g.x,accuracy:"source_civic_address_point",provider:DURHAM_ADDRESS.source.id,...(nar?{addressRegister:nar}:{}),municipalAddress:{recordIds:exact.map(({a})=>String(a.OBJECTID)),community:text(primary.a.TOWN),permitAddressKeys:[civicStreetKey(address)],source:DURHAM_ADDRESS.source,sourceUpdatedAt:meta.sourceUpdatedAt,publishedRecords,publishedAddressRecordCount:exact.length,publishedRecordsTruncated:exact.length>50}},DURHAM_ADDRESS.source,DURHAM_ADDRESS.note+" UNIT is a published yes/no flag; UNIT_NUM and UNIT_RANGE remain source unit context. Agreement within 20 metres does not verify an individual unit or building. National building provenance is retained only when exact civic identity, municipality and point agree.",meta.sourceUpdatedAt);
    result.truncated=exact.length>50;return result;
  }catch{return null;}
}
const SOURCE:Source={id:"durham:planning-2024",name:"Durham 2024 regional planning point screens",url:DURHAM_PLAN_GUIDANCE,licence:"Region of Durham Open Data Licence v1.0",licenceUrl:DURHAM_TERMS,attribution:DURHAM_ADDRESS.source.attribution};
function gaps(municipality:DurhamMunicipality):Record<string,Layer> {
  if(municipality==="Oshawa")return {};
  const note=`${municipality}'s current municipal property-level feed is not yet connected as a verified licensed source. Regional 2024 planning mapping does not replace this review.`;
  return {permits:layer("not_supported",null,null,"Complete municipal permit history, published status and inspections: "+note),zoning:layer("not_supported",null,null,"Detailed current zoning, exceptions, holding provisions and amendments: "+note),heritage:layer("not_supported",null,null,"Individual heritage register and heritage districts: "+note),development:layer("not_supported",{fullPlanningHistorySearched:false},null,"Planning applications, decisions and appeal outcomes: "+note),officialPlan:layer("not_supported",{currentPlanScreenPerformed:false,currentMunicipalAmendmentsVerified:false,verificationUrl:DURHAM_PLAN_GUIDANCE},null,"Current municipal Official Plan schedules and amendments: "+note)};
}
export async function durhamLayers(city:string|null,province:string|null,location:Location|null,requestedCity?:string):Promise<Record<string,Layer>> {
  const municipality=durhamMunicipality(requestedCity??city,province);if(!municipality)return {};
  const context=new Map<string,Promise<Row>>();
  let boundary=await municipalPointLayer(DURHAM_BOUNDARY,location,context);
  const records=rows((boundary.data as Row|null)?.records??[]);
  const agreed=boundary.status==="available" && !boundary.truncated && records.length===1 && text(records[0].municipality)===municipality;
  if(boundary.status==="available" && !agreed)boundary=layer("ambiguous",{...boundary.data as Row,expectedMunicipality:municipality,coverageComplete:false},DURHAM_BOUNDARY.source,"The published point boundary is non-unique or conflicts with the requested municipality. No regional planning evidence is assigned to this property.",boundary.sourceUpdatedAt);
  const attempts=await Promise.all(DURHAM_PLANNING.map(async f=>[f.key,agreed || f.disabledReason?await municipalPointLayer(f,location,context):layer("skipped",null,f.source,"Regional plan screen was not performed because a unique boundary did not confirm the requested municipality.")] as const));
  const enabled=attempts.filter(([key])=>!DURHAM_PLANNING.find(f=>f.key===key)!.disabledReason);
  const queryCoverageComplete=agreed && enabled.every(([,l])=>["available","no_match"].includes(l.status)&&!l.truncated);
  const status=enabled.some(([,l])=>l.status==="available")?"available":!agreed?boundary.status==="ambiguous"?"ambiguous":boundary.status==="unavailable"?"unavailable":"skipped":queryCoverageComplete?"no_match":"unavailable";
  const planning=layer(status,{municipality,publishedConsolidationYear:2024,describedConsolidationDate:"2024-09-03",remainingNortheastPickeringApprovalDate:"2024-12-13",municipalResponsibilityDate:"2025-01-01",currentMunicipalAmendmentsVerified:false,fullCurrentOfficialPlanScreenPerformed:false,parcelWideScreenPerformed:false,coverageComplete:false,enabledQueryCoverageComplete:queryCoverageComplete,absenceEstablished:false,verificationUrl:DURHAM_PLAN_GUIDANCE,datasets:Object.fromEntries(attempts)},SOURCE,"Incomplete planning review: three blended third-party layers are withheld and current municipal amendments are unverified. "+DURHAM_PLAN_NOTE);
  return {...gaps(municipality),municipality:boundary,durhamPlanning:planning};
}
export async function durhamCoverage() {
  const context=new Map<string,Promise<Row>>();
  const inspect=async (f:typeof DURHAM_FEEDS[number])=>{
    if(f.disabledReason)return {layer:f.key,status:"withheld",records:null,source:{...f.source,licence:"Dataset reuse unresolved; adapter withheld"},note:f.disabledReason};
    try {
      const m=await municipalMetadata(f,context);
      const where=f===DURHAM_ADDRESS?`MUNICIPALITY IN (${DURHAM_MUNICIPALITIES.map(literal).join(",")})`:"1=1";
      const r=await get(f.url+"/query",{where,returnCountOnly:"true"}),count=number(r.count);if(count===null || count<0 || !Number.isInteger(count))throw new Error("Invalid count");
      return {layer:f.key,status:"verified",records:count,source:f.source,sourceUpdatedAt:m.sourceUpdatedAt,note:f.note,...(f===DURHAM_ADDRESS?{countScope:"Only civic rows assigned to the eight Durham municipalities; surrounding-municipality records excluded."}:{})};
    }catch{return {layer:f.key,status:"unavailable",records:null,source:f.source,note:"Exact publisher, reuse terms, named child layer, schema or live count could not be verified."};}
  };
  const datasets:Awaited<ReturnType<typeof inspect>>[]=[];
  for(let i=0;i<DURHAM_FEEDS.length;i+=3)datasets.push(...await Promise.all(DURHAM_FEEDS.slice(i,i+3).map(inspect)));
  return {cities:[...DURHAM_MUNICIPALITIES],layers:["municipality","durhamPlanning"],delivery:"cached_live_queries",cacheSeconds:3600,datasets,note:DURHAM_PLAN_NOTE+" Dataset rows overlap and are not distinct properties, unique data points or bulk database imports."};
}
