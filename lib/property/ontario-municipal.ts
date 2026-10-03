import { fetchJson, literal, rows } from "./http";
import { civicStreetKey, cityKey, hasUnit, layer, number, streetNumber, text, type Layer, type Location, type PropertyRequest, type Row } from "./model";
import { provinceKey } from "./geocode";
import { nationalAddress } from "./national";
import { arcgisDate, streetVariants } from "./hamilton";
import { haversineMeters } from "@/lib/geo/geometry";
import { ONTARIO_MUNICIPAL, validMunicipalItem, type Market, type MunicipalFeed } from "./ontario-municipal-sources";

const aliases: Record<string, Market> = { mississauga:"Mississauga", london:"London", ottawa:"Ottawa", nepean:"Ottawa", kanata:"Ottawa", orleans:"Ottawa", gloucester:"Ottawa", "stittsville":"Ottawa" };
export function ontarioMarket(city: string | null, province: string | null): Market | null { return provinceKey(province ?? "") === "ontario" ? aliases[cityKey(city ?? "")] ?? null : null; }
const bounds: Record<Market, [number, number, number, number]> = { Mississauga:[43.42,43.78,-79.95,-79.5], London:[42.8,43.2,-81.5,-81.05], Ottawa:[44.8,45.7,-76.5,-75.2] };
function validPoint(market: Market, lat: unknown, lng: unknown): lat is number {
  const [south,north,west,east] = bounds[market]; return typeof lat === "number" && typeof lng === "number" && lat > south && lat < north && lng > west && lng < east;
}
function precise(market: Market, l: Location | null): l is Location & { latitude:number; longitude:number } { return Boolean(l && validPoint(market,l.latitude,l.longitude) && ["source_building_point","source_civic_address_point","caller_supplied"].includes(l.accuracy)); }
async function get(url: string, params: Record<string,string> = {}): Promise<Row> {
  const u = new URL(url); Object.entries({ f:"json",...params }).forEach(([k,v])=>u.searchParams.set(k,v));
  const r = await fetchJson(u) as Row; if (!r || typeof r !== "object" || Array.isArray(r) || r.error) throw new Error("Municipal source unavailable"); return r;
}
export async function municipalMetadata(f: MunicipalFeed) {
  if (f.disabledReason) throw new Error("Reuse not enabled");
  const [item,m] = await Promise.all([get(`https://www.arcgis.com/sharing/rest/content/items/${f.item}`),get(f.url)]);
  if (!validMunicipalItem(item,f) || m.geometryType !== f.geometry || !Object.keys(f.fields).every(k=>rows(m.fields).some(x=>x.name === k)) || !rows(m.fields).some(x=>x.name === f.oid && x.type === "esriFieldTypeOID")) throw new Error("Municipal publisher, rights or schema changed");
  return { sourceUpdatedAt:arcgisDate((m.editingInfo as Row | undefined)?.dataLastEditDate) };
}
function features(r: Row, f: MunicipalFeed): { attributes:Row; geometry:Row|null }[] {
  return rows(r.features).map(x=>{
    const a=x.attributes as Row;
    if (!a || typeof a !== "object" || Array.isArray(a) || a[f.oid] === null || a[f.oid] === undefined || !Object.keys(f.fields).every(k=>k in a)) throw new Error("Invalid municipal record");
    return { attributes:Object.fromEntries(Object.keys(f.fields).map(k=>[k,a[k]])), geometry:x.geometry && typeof x.geometry === "object" && !Array.isArray(x.geometry) ? x.geometry as Row : null };
  });
}
function mapped(a:Row,f:MunicipalFeed):Row { return Object.fromEntries(Object.entries(f.fields).map(([key,label])=>[label, f.dates?.includes(key) ? arcgisDate(a[key]) : a[key]])); }
function addressParts(f:MunicipalFeed,a:Row): { address:string; unit:string|null; issued:boolean } {
  if(f.market === "Mississauga") return { address:String(a.FULLNAME), unit:text(a.UNIT_NO), issued:true };
  if(f.market === "London") return { address:`${a.FullNumber} ${a.FullStreetName}`, unit:text(a.UnitNumber), issued:a.Status === "IA" || a.Status === "IU" };
  return { address:`${a.ADDRNUM}${text(a.QUALIFIER) ?? ""} ${a.FULL_ROADNAME_EN}`, unit:text(a.UNIT), issued:["Main","Subordinate"].includes(String(a.ADDRTYPE)) && ["ottawa","old ottawa","nepean","kanata","gloucester","vanier","cumberland","goulbourn","west carleton","osgoode","rideau","rockcliffe park"].includes(cityKey(String(a.MUNICIPALITY))) };
}
export async function ontarioMunicipalLocation(input:PropertyRequest):Promise<Layer<Location>|null> {
  const city = input.city ?? input.address?.split(",")[1]?.trim() ?? null;
  const province = input.province ?? input.address?.split(",")[2]?.trim() ?? "ON";
  const market=ontarioMarket(city,province);
  if(!market || !input.address || input.lat !== undefined || hasUnit(input.address))return null;
  const address=input.address.split(",")[0].trim(), civic=streetNumber(address); if(!civic)return null;
  const f=ONTARIO_MUNICIPAL.find(f=>f.market===market && f.key==="addresses")!;
  const street=address.replace(/^\d+[a-z]?\s+/i,"");
  const candidates = streetVariants(street).map(literal).join(",");
  const where = market === "Mississauga" ? `UPPER(STNO) = ${literal(civic.toUpperCase())} AND UPPER(FULLNAME) IN (${streetVariants(address).map(literal).join(",")})` : market === "London" ? `UPPER(FullNumber) = ${literal(civic.toUpperCase())} AND UPPER(FullStreetName) IN (${candidates})` : `ADDRNUM = ${parseInt(civic,10)} AND UPPER(FULL_ROADNAME_EN) IN (${candidates})`;
  try {
    const meta=await municipalMetadata(f);
    const r=await get(f.url+"/query",{ where,outFields:Object.keys(f.fields).join(","),returnGeometry:"true",outSR:"4326",resultRecordCount:"501",orderByFields:f.oid });
    if(r.exceededTransferLimit)throw new Error("Incomplete address candidates");
    const all=features(r,f); if(all.length>=501)throw new Error("Address bound exceeded");
    const exact=all.filter(x=>{ const p=addressParts(f,x.attributes);const requestedCity=cityKey(city!);const communityMatches=market!=="Ottawa" || requestedCity==="ottawa" || cityKey(String(x.attributes.MUNICIPALITY))===requestedCity || cityKey(String(x.attributes.CP_MUNICIPALITY))===requestedCity;return p.issued && communityMatches && civicStreetKey(p.address)===civicStreetKey(address); });
    if(!exact.length)return null;
    const primary=exact.find(x=>!addressParts(f,x.attributes).unit) ?? exact[0];
    if(exact.some(x=>!validPoint(market,x.geometry?.y,x.geometry?.x)) || exact.some(x=>haversineMeters(Number(primary.geometry?.y),Number(primary.geometry?.x),Number(x.geometry?.y),Number(x.geometry?.x))>20))return layer("ambiguous",null,f.source,"Matching municipal civic-address points disagree or lack usable coordinates; provide verified building-level coordinates.",meta.sourceUpdatedAt);
    const registered=await nationalAddress({address,city:city!,province:"ON"},provinceKey);
    const nar=registered?.status==="available" && registered.data?.accuracy==="source_building_point" && registered.data.address && civicStreetKey(registered.data.address)===civicStreetKey(address) && validPoint(market,registered.data.latitude,registered.data.longitude) && haversineMeters(Number(primary.geometry!.y),Number(primary.geometry!.x),registered.data.latitude!,registered.data.longitude!)<=20 ? registered.data.addressRegister : undefined;
    return layer("available",{ address:addressParts(f,primary.attributes).address, city:market, province:"ON", latitude:Number(primary.geometry!.y),longitude:Number(primary.geometry!.x),accuracy:"source_civic_address_point",provider:f.source.id,...(nar?{addressRegister:nar}:{}),municipalAddress:{ recordIds:exact.map(x=>String(x.attributes[f.oid])),community:market,permitAddressKeys:[civicStreetKey(address)],source:f.source,sourceUpdatedAt:meta.sourceUpdatedAt } },f.source,f.note+" Multiple unit records are grouped only when their points agree within 20 metres; this does not identify or verify an individual unit. National Address Register metadata is retained only when its unique published building point agrees within 20 metres.",meta.sourceUpdatedAt);
  } catch { return null; }
}

export async function municipalPointLayer(f:MunicipalFeed, location:Location|null):Promise<Layer> {
  if(f.disabledReason)return layer("unavailable",null,{ ...f.source,licence:"Dataset reuse unresolved; adapter withheld" },f.disabledReason);
  if(!precise(f.market,location))return layer("skipped",null,f.source,"A verified municipal/building point or caller-supplied point in this market is required. Street interpolation and unresolved addresses are not screened.");
  try {
    const m=await municipalMetadata(f), r=await get(f.url+"/query",{ geometry:`${location.longitude},${location.latitude}`,geometryType:"esriGeometryPoint",inSR:"4326",spatialRel:"esriSpatialRelIntersects",outFields:Object.keys(f.fields).join(","),returnGeometry:"false",resultRecordCount:"51",orderByFields:f.oid });
    const all=features(r,f);if(!all.length && r.exceededTransferLimit)throw new Error("Incomplete empty query");
    const truncated=Boolean(r.exceededTransferLimit || all.length>50);
    const historical=f.key.includes("2010");
    const result=layer(all.length?"available":"no_match",{ records:all.slice(0,50).map(x=>mapped(x.attributes,f)),matchMethod:"published_polygon_intersects_point",screenedPoint:{ latitude:location.latitude,longitude:location.longitude,accuracy:location.accuracy },coverageComplete:!truncated,parcelWideScreenPerformed:false,...(historical?{ historical:true,planRepealedDate:"2026-03-24",currentPlanScreenPerformed:false,currentPlanVerificationUrl:"https://www.mississauga.ca/projects-and-strategies/strategies-and-plans/mississauga-official-plan/" }:{}),...(!all.length?{ absenceEstablished:false }:{}) },f.source,f.note+" This is a point screen, not a surveyed property-wide determination. A no-match does not prove absence.",m.sourceUpdatedAt);
    result.truncated=truncated;return result;
  }catch{return layer("unavailable",null,f.source,"The source, publisher/licence binding, query or expected schema could not be verified. No factual result is returned.");}
}
async function mississaugaPermits(f:MunicipalFeed,address:string|null):Promise<Layer> {
  if(!address || !streetNumber(address))return layer("skipped",null,f.source,"A civic building address is required.");
  try {
    const m=await municipalMetadata(f),r=await get(f.url+"/query",{ where:`UPPER(ADDRESS) IN (${streetVariants(address).map(literal).join(",")})`,outFields:Object.keys(f.fields).join(","),returnGeometry:"false",resultRecordCount:"51",orderByFields:`ISSUE_DATE DESC,${f.oid} DESC` });
    const all=features(r,f);if(!all.length && r.exceededTransferLimit)throw new Error("Incomplete query");
    const exact=all.filter(x=>civicStreetKey(String(x.attributes.ADDRESS))===civicStreetKey(address));
    const truncated=Boolean(r.exceededTransferLimit || all.length>50);
    const result=layer(exact.length?"available":"no_match",{ records:exact.slice(0,50).map(x=>mapped(x.attributes,f)),matchMethod:"exact_normalized_civic_address",coverageComplete:!truncated,scope:"building_level",currency:"CAD",absenceEstablished:false },f.source,f.note,m.sourceUpdatedAt);result.truncated=truncated;return result;
  }catch{return layer("unavailable",null,f.source,"The permit feed's publisher, licence, schema or query could not be verified.");}
}
export async function ontarioMunicipalLayers(address:string|null,city:string|null,province:string|null,location:Location|null):Promise<Record<string,Layer>> {
  const market=ontarioMarket(city,province);if(!market)return {};
  const feeds=ONTARIO_MUNICIPAL.filter(f=>f.market===market && f.key!=="addresses");
  const entries=await Promise.all(feeds.map(async f=>[f.key,f.key==="permits"?await mississaugaPermits(f,address):await municipalPointLayer(f,location)] as const));
  const result:Record<string,Layer>=Object.fromEntries(entries);
  if(market==="Mississauga")result.officialPlan=layer("not_supported",{ currentPlanScreenPerformed:false,plan:"Official Plan 2051",effectiveDate:"2026-03-24",verificationUrl:"https://www.mississauga.ca/projects-and-strategies/strategies-and-plans/mississauga-official-plan/" },null,"The current 2051 plan is not yet connected as a licensed GIS feed. The returned 2010 layers are historical only.");
  if(market==="London"){
    result.zoning=layer("not_supported",null,null,"The licensed generalized-land-use feed has no zone codes or permissions. Current Z.-1 zone details, exceptions, overlays and amendments remain to be integrated.");
    result.permits=layer("not_supported",null,null,"London's building-permit history is not yet connected to a verified open-data feed.");
  }
  if(market==="Ottawa")result.zoning=layer("not_supported",{ zoningScreenPerformed:false,bylaws:["2008-250","2026-50"],appealAndTransitionVerificationRequired:true,verificationUrl:"https://ottawa.ca/en/node/3046321" },null,"Ottawa's 2026-50 transition, appeals and the 2008-250 rules must be checked together. Neither current zoning service is connected as a verified licensed feed yet.");
  return result;
}
export async function ontarioMunicipalCoverage() {
  return Promise.all(ONTARIO_MUNICIPAL.map(async f=>{
    if(f.disabledReason)return { city:f.market,layer:f.key,status:"withheld",records:null,source:f.source,note:f.disabledReason };
    try {
      const m=await municipalMetadata(f),r=await get(f.url+"/query",{where:"1=1",returnCountOnly:"true"});const count=number(r.count);if(count===null || count<0 || !Number.isInteger(count))throw new Error("Invalid count");
      return { city:f.market,layer:f.key,status:"verified",records:count,source:f.source,sourceUpdatedAt:m.sourceUpdatedAt,note:f.note };
    }catch{return { city:f.market,layer:f.key,status:"unavailable",records:null,source:f.source,note:"Publisher, licence, schema or live count could not be verified." };}
  }));
}
