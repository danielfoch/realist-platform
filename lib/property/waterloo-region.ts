import { createHash } from "node:crypto";
import { load } from "cheerio/slim";
import { fetchJson, fetchText, literal, rows } from "./http";
import { civicStreetKey, cityKey, hasUnit, layer, number, streetNumber, text, type Layer, type Location, type PropertyRequest, type Row } from "./model";
import { provinceKey } from "./geocode";
import { nationalAddress } from "./national";
import { arcgisDate, streetVariants } from "./hamilton";
import { haversineMeters } from "@/lib/geo/geometry";
import { WATERLOO_CITY_GRANT, WATERLOO_FEEDS, WATERLOO_GRANTS, WATERLOO_WITHHELD, type WaterlooFeed } from "./waterloo-region-sources";

type Context = Map<string, Promise<Row>>;
const sha = (s:string) => createHash("sha256").update(s).digest("hex");
const normalized = (s:string) => load(s).text().replace(/\s+/g," ").trim();
const feed = (market:string,key:string) => WATERLOO_FEEDS.find(f=>f.market===market&&f.key===key)!;
export function waterlooMarket(city:string|null,province:string|null):string|null {
  if(provinceKey(province??"")!=="ontario")return null;
  return ["Kitchener","Waterloo","Cambridge"].find(c=>cityKey(c)===cityKey(city??""))??null;
}
async function get(url:string,params:Record<string,string>={}):Promise<Row> {
  const u=new URL(url);Object.entries({f:"json",...params}).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetchJson(new URL(u.href.replace(/\+/g,"%20"))) as Row;
  if(!r||typeof r!=="object"||Array.isArray(r)||r.error)throw new Error("Waterloo-region source unavailable");return r;
}
function read(context:Context,url:string,run=()=>get(url)):Promise<Row> {
  const pending=context.get(url)??run();context.set(url,pending);return pending;
}
/** A blank item is licensed only through the inspected City-owned catalogue, site and complete licence text. */
async function cityGrant(f:WaterlooFeed,context:Context) {
  const b=WATERLOO_CITY_GRANT,base="https://www.arcgis.com/sharing/rest/";
  const [site,siteData,page,pageData,group,membership]=await Promise.all([
    read(context,base+`content/items/${b.site}`),read(context,base+`content/items/${b.site}/data`),
    read(context,base+`content/items/${b.page}`),read(context,base+`content/items/${b.page}/data`),
    read(context,base+`community/groups/${b.group}`),
    read(context,base+`search?${new URLSearchParams({q:`id:${f.item} AND group:${b.group} AND orgid:${f.org} AND access:public`,num:"1"})}`)
  ]);
  const groups=(siteData.catalog as Row|undefined)?.groups;
  const pages=rows((siteData.values as Row|undefined)?.pages??[]);
  const sections=rows(((pageData.values as Row|undefined)?.layout as Row|undefined)?.sections??[]);
  const firstRow=rows(sections[0]?.rows??[])[0],card=rows(firstRow?.cards??[])[0];
  const markdown=((card?.component as Row|undefined)?.settings as Row|undefined)?.markdown;
  const results=rows(membership.results??[]);
  if(site.id!==b.site||site.owner!=="OpenData_Waterloo"||site.orgId!==f.org||site.access!=="public"||!Array.isArray(groups)||!groups.includes(b.group)||!pages.some(p=>p.id===b.page&&p.slug==="open-data-licence")||page.id!==b.page||page.owner!==b.pageOwner||page.orgId!==f.org||page.access!=="public"||page.title!=="Open Data Licence"||group.id!==b.group||group.owner!=="OpenData_Waterloo"||group.title!=="City of Waterloo Open Data"||group.access!=="public"||typeof markdown!=="string"||sha(normalized(markdown))!==b.hash||membership.total!==1||results.length!==1||results[0].id!==f.item||results[0].owner!==f.owner||results[0].orgId!==f.org||results[0].access!=="public")throw new Error("City catalogue or grant binding changed");
}
export async function waterlooMetadata(f:WaterlooFeed,context:Context=new Map()) {
  const itemUrl=`https://www.arcgis.com/sharing/rest/content/items/${f.item}`;
  const [item,m]=await Promise.all([read(context,itemUrl),read(context,f.url)]);
  const terms=typeof item.licenseInfo==="string"?item.licenseInfo:"";
  if(item.id!==f.item||item.owner!==f.owner||item.orgId!==f.org||item.access!=="public"||item.title!==f.expectedItemTitle||item.url!==f.rootUrl||sha(normalized(terms))!==f.termsHash||m.name!==f.expectedLayerName||m.geometryType!==f.geometry||(m.copyrightText??"")!==f.expectedCopyright||!Object.entries(f.fieldTypes).every(([name,type])=>rows(m.fields).some(x=>x.name===name&&x.type===type)))throw new Error("Publisher, terms, endpoint or typed child changed");
  if(f.publisher==="waterloo")await cityGrant(f,context);
  else if(f.publisher!=="kitchener") {
    const grant=WATERLOO_GRANTS[f.publisher];
    const g=await read(context,grant.url,async()=>{
      const $=load(await fetchText(new URL(grant.url)));
      const matches=$(grant.selector).filter((_,el)=>sha($(el).text().replace(/\s+/g," ").trim())===grant.hash);
      if(matches.length!==1)throw new Error("Complete inspected grant missing or changed");return {hash:grant.hash};
    });
    // Regional items explicitly refer to the former official URL; the complete current Region grant is pinned separately.
    const referral=f.publisher==="region"?"https://www.regionofwaterloo.ca/en/regional-government/open-data.aspx#Open-Data-Licence":grant.url;
    if(g.hash!==grant.hash||!terms.includes(referral))throw new Error("Referred grant changed");
  }
  return {sourceUpdatedAt:arcgisDate((m.editingInfo as Row|undefined)?.dataLastEditDate)};
}
function point(g:Row|null):g is Row&{x:number;y:number} {return typeof g?.x==="number"&&typeof g.y==="number"&&g.y>43.05&&g.y<43.8&&g.x> -80.9&&g.x< -80.05;}
function precise(l:Location|null):l is Location&{latitude:number;longitude:number} {return Boolean(l&&point({x:l.longitude,y:l.latitude})&&["source_building_point","source_civic_address_point","caller_supplied"].includes(l.accuracy));}
function features(r:Row,f:WaterlooFeed) {
  return rows(r.features).map(x=>{
    const a=x.attributes as Row;
    if(!a||typeof a!=="object"||Array.isArray(a)||!Object.entries(f.fieldTypes).every(([k,t])=>{
      if(!(k in a))return false;const v=a[k];if(k===f.oid)return typeof v==="number"&&Number.isInteger(v)&&v>0;
      return v===null||(t==="esriFieldTypeString"?typeof v==="string":typeof v==="number"&&Number.isFinite(v));
    }))throw new Error("Invalid typed source record");
    return {a:Object.fromEntries(Object.keys(f.fields).map(k=>[k,a[k]])),g:x.geometry&&typeof x.geometry==="object"&&!Array.isArray(x.geometry)?x.geometry as Row:null};
  });
}
function mapped(a:Row,f:WaterlooFeed):Row {return Object.fromEntries(Object.entries(f.fields).map(([k,v])=>[v,f.dates.includes(k)?arcgisDate(a[k]):a[k]]));}
function civicAt(a:Row,f:WaterlooFeed):string {
  if(f.publisher==="region")return `${text(a.AddressNumber)??""} ${text(a.FullStreetName)??""}`.trim();
  if(f.publisher==="waterloo")return text(a.CIVIC_ADDR)??"";
  return `${number(a.HOUSE_NUMBER)??""} ${text(a.STREET_NAME)??""}`.trim();
}
export async function waterlooLocation(input:PropertyRequest):Promise<Layer<Location>|null> {
  const city=input.city??input.address?.split(",")[1]?.trim()??null,province=input.province??input.address?.split(",")[2]?.trim()??"ON",market=waterlooMarket(city,province);
  if(!market||!input.address||input.lat!==undefined||hasUnit(input.address))return null;
  const f=feed(market==="Kitchener"?"Region of Waterloo":market,"addresses"),embedded=input.address.split(",")[1]?.trim();
  if(input.city&&embedded&&waterlooMarket(embedded,province)!==market)return layer("ambiguous",null,f.source,"The explicit City conflicts with the civic municipality. Correct the identity before screening.");
  const address=input.address.split(",")[0].trim(),civic=streetNumber(address);if(!civic)return null;
  try {
    const m=await waterlooMetadata(f),street=input.address.split(",")[0].trim().replace(/^\d+[a-z]?\s+/i,"");
    const where=f.publisher==="region"?`UPPER(Municipality) = ${literal(market.toUpperCase())} AND UPPER(AddressNumber) = ${literal(civic.toUpperCase())} AND UPPER(FullStreetName) IN (${streetVariants(street).map(literal).join(",")})`:f.publisher==="waterloo"?`UPPER(CIVIC_ADDR) IN (${streetVariants(address).map(literal).join(",")}) AND UPPER(STREET_NM) IN (${streetVariants(street).map(literal).join(",")})`:`HOUSE_NUMBER = ${parseInt(civic,10)} AND UPPER(STREET_NAME) IN (${streetVariants(street).map(literal).join(",")})`;
    const r=await get(f.url+"/query",{where,outFields:Object.keys(f.fields).join(","),returnGeometry:"true",outSR:"4326",resultRecordCount:"501",orderByFields:f.oid});
    const all=features(r,f);if(r.exceededTransferLimit||all.length>=501)throw new Error("Incomplete civic candidates");
    const exact=all.filter(({a})=>civicStreetKey(civicAt(a,f))===civicStreetKey(address)&&(f.publisher!=="region"||waterlooMarket(text(a.Municipality),"ON")===market)&&
      (f.publisher!=="waterloo"||civicStreetKey(`${civic} ${text(a.STREET_NM)??""}`)===civicStreetKey(address))&&
      (f.publisher!=="cambridge"||a.STATUS==="ACTIVE"&&(text(a.UNIT_NUMBER)||civicStreetKey(String(a.ADDRESS_LABEL))===civicStreetKey(address)))&&
      (f.publisher!=="region"||text(a.UnitNumber)||civicStreetKey(String(a.FullAddress))===civicStreetKey(address)));
    if(!exact.length)return null;const primary=exact.find(({a})=>!text(a.UnitNumber??a.UNIT_NUMBER))??exact[0];
    if(!point(primary.g)||exact.some(({g})=>!point(g)||haversineMeters(primary.g!.y as number,primary.g!.x as number,g.y,g.x)>20))return layer("ambiguous",null,f.source,"Matching civic points are unusable or disagree by more than 20 metres. No arbitrary point is selected.",m.sourceUpdatedAt);
    const registered=await nationalAddress({address,city:market,province:"ON"},provinceKey),n=registered?.status==="available"?registered.data:null;
    const nar=n?.accuracy==="source_building_point"&&n.address&&civicStreetKey(n.address)===civicStreetKey(address)&&waterlooMarket(n.city,n.province)===market&&typeof n.latitude==="number"&&typeof n.longitude==="number"&&haversineMeters(primary.g.y,primary.g.x,n.latitude,n.longitude)<=20?n.addressRegister:undefined;
    const result=layer("available",{address:civicAt(primary.a,f),city:market,province:"ON",latitude:primary.g.y,longitude:primary.g.x,accuracy:"source_civic_address_point",provider:f.source.id,...(nar?{addressRegister:nar}:{}),municipalAddress:{recordIds:exact.map(({a})=>String(a[f.oid])),community:market,permitAddressKeys:[civicStreetKey(address)],source:f.source,sourceUpdatedAt:m.sourceUpdatedAt,publishedRecords:exact.slice(0,50).map(({a})=>mapped(a,f)),publishedAddressRecordCount:exact.length,publishedRecordsTruncated:exact.length>50}},f.source,f.note+" Suffixes, street types and directions must match. Shared civic points are grouped only within 20 metres; no individual unit is verified. Separate City and regional boundary confirmation precede property queries.",m.sourceUpdatedAt);result.truncated=exact.length>50;return result;
  }catch{return null;}
}
function civicQueryVariants(address:string):string[] {
  // Kitchener active files publish a double space after the civic number; candidates still require exact normalized identity.
  return [...new Set(streetVariants(address).flatMap(v=>[v,v.replace(/^(\d+[a-z]?) /i,"$1  ")]))];
}
async function queryLayer(f:WaterlooFeed,location:Location|null,address:string|null,context:Context):Promise<Layer> {
  if(!precise(location))return layer("skipped",null,f.source,"A precise civic/building/caller point is required; interpolated points are not screened.");
  if(f.matchField&&(!address||!streetNumber(address)))return layer("skipped",null,f.source,"An exact civic building address is required; coordinate-only requests do not search address histories.");
  try {
    const m=await waterlooMetadata(f,context),byAddress=Boolean(f.matchField);
    const where=byAddress?`UPPER(${f.matchField}) IN (${civicQueryVariants(address!).map(literal).join(",")})`:"1=1";
    const r=await get(f.url+"/query",{where,...(!byAddress?{geometry:`${location.longitude},${location.latitude}`,geometryType:"esriGeometryPoint",inSR:"4326",spatialRel:"esriSpatialRelIntersects"}:{}),outFields:Object.keys(f.fields).join(","),returnGeometry:f.key==="heritageProperties"?"true":"false",outSR:"4326",resultRecordCount:"51",orderByFields:f.key==="permits"?`${f.publisher==="kitchener"?"APPLICATION_DATE":"ISSUEDATE"} DESC,${f.oid} DESC`:f.oid});
    const all=features(r,f);if(!all.length&&r.exceededTransferLimit)throw new Error("Incomplete empty response");
    const exact=byAddress?all.filter(({a})=>typeof a[f.matchField!]==="string"&&!String(a[f.matchField!]).includes(",")&&civicStreetKey(String(a[f.matchField!]))===civicStreetKey(address!)):all;
    const truncated=Boolean(r.exceededTransferLimit||all.length>50);
    const heritageSeparations=f.key==="heritageProperties"?exact.map(({g})=>point(g)?haversineMeters(location.latitude,location.longitude,g.y,g.x):null):null;
    if(heritageSeparations?.some(d=>d===null||d>100)){const result=layer("ambiguous",{candidateRecords:exact.slice(0,50).map(({a})=>mapped(a,f)),sourcePointSeparationsM:heritageSeparations.slice(0,50),coverageComplete:false,absenceEstablished:false,parcelWideScreenPerformed:false},f.source,"Exact civic-address heritage candidates have unusable points or are more than 100 metres from the property point. Verify current parcel identity before treating them as property designations.",m.sourceUpdatedAt);result.truncated=truncated;return result;}
    const result=layer(exact.length?"available":"no_match",{records:exact.slice(0,50).map(({a})=>mapped(a,f)),matchMethod:byAddress?"exact_normalized_civic_address":"published_polygon_intersects_point",scope:byAddress?"building_or_site_address":"subject_point",...(heritageSeparations?{sourcePointSeparationsM:heritageSeparations}:{}),screenedPoint:{latitude:location.latitude,longitude:location.longitude,accuracy:location.accuracy},coverageComplete:false,queryCoverageComplete:!truncated,parcelWideScreenPerformed:false,absenceEstablished:false,...(f.group==="planningApplications"?{fullHistorySearched:false,nearbySearchPerformed:false,currentDecisionVerified:false,municipalApprovalEstablished:false}:{}),...(f.key==="permits"?{fullHistorySearched:false,finalInspectionsVerified:false,currentOccupancyApprovalVerified:false,unitLegalityEstablished:false}:{}),...(f.key==="waterPressureZone"?{actualConnectionEstablished:false,availableCapacityEstablished:false,servicingEligibilityEstablished:false,measuredPressureEstablished:false,waterSafetyEstablished:false}:{}),...(f.key==="communityImprovement"?{programEligibilityEstablished:false,fundingAvailabilityEstablished:false}:{})},f.source,f.note+" Source update time remains unknown if editingInfo is unpublished. No-match does not establish absence.",m.sourceUpdatedAt);result.truncated=truncated;return result;
  }catch{return layer("unavailable",null,f.source,"The inspected full grant, exact publisher/terms/endpoint, catalogue binding, typed schema or bounded query could not be verified. No factual result is returned.");}
}
function group(market:string,name:string,entries:Record<string,Layer>):Layer {
  const feeds=WATERLOO_FEEDS.filter(f=>f.market===market&&f.group===name),datasets=Object.fromEntries(feeds.map(f=>[f.key,entries[f.key]])),values=Object.values(datasets);
  const status=values.some(v=>v.status==="available")?"available":values.some(v=>v.status==="ambiguous")?"ambiguous":values.some(v=>v.status==="unavailable")?"unavailable":values.every(v=>v.status==="skipped")?"skipped":"no_match";
  const result=layer(status,{datasets,coverageComplete:false,enabledQueryCoverageComplete:values.every(v=>["available","no_match"].includes(v.status)&&!v.truncated),absenceEstablished:false,parcelWideScreenPerformed:false,currentAmendmentsVerified:false,currentAppealsVerified:false,...(name==="heritage"?{fullHeritageScreenPerformed:false,currentRegisterVerified:false}:name==="officialPlan"?{currentPlanScreenPerformed:false,inForcePolicyEstablished:false}:name==="planningApplications"?{fullHistorySearched:false,nearbySearchPerformed:false,currentDecisionVerified:false,municipalApprovalEstablished:false}:{currentPolicyEstablished:false,conservationAuthorityRegulatoryScreenPerformed:false,environmentalClearanceEstablished:false})},{...feeds[0].source,id:`waterloo-region:${cityKey(market)}:${name}`,name:`${market} ${name} source screens`},"Partial reference evidence at the subject point. Read each nested source status, date and truncation. Current legal instruments, permissions and parcel-wide conditions remain unverified.");result.truncated=values.some(v=>v.truncated);return result;
}
export async function waterlooLayers(address:string|null,city:string|null,province:string|null,location:Location|null,requestedCity?:string):Promise<Record<string,Layer>> {
  const market=waterlooMarket(requestedCity??city,province);if(!market)return {};
  const context:Context=new Map(),f=feed(market,"municipality"),regional=feed("Region of Waterloo","regionalBoundary");
  let [boundary,region]=await Promise.all([queryLayer(f,location,null,context),queryLayer(regional,location,null,context)]);
  const b=rows((boundary.data as Row|null)?.records??[]),r=rows((region.data as Row|null)?.records??[]);
  const cityAgrees=boundary.status==="available"&&!boundary.truncated&&b.length===1&&(market==="Waterloo"||waterlooMarket(text(b[0].publishedMunicipality),"ON")===market);
  const regionAgrees=region.status==="available"&&!region.truncated&&r.length===1&&r[0].publishedLongName==="Regional Municipality of Waterloo";
  if(boundary.status==="available"&&!cityAgrees)boundary=layer("ambiguous",{...boundary.data as Row,expectedMunicipality:market},f.source,"The City boundary is non-unique or conflicts with the request; no property layers are assigned.",boundary.sourceUpdatedAt);
  if(region.status==="available"&&!regionAgrees)region=layer("ambiguous",{...region.data as Row,expectedRegion:"Region of Waterloo"},regional.source,"The regional boundary is non-unique or conflicts with the request; no property layers are assigned.",region.sourceUpdatedAt);
  const pending=WATERLOO_FEEDS.filter(f=>[market,"Region of Waterloo"].includes(f.market)&&!["addresses","municipality","regionalBoundary"].includes(f.key)),pairs:(readonly[string,Layer])[]=[];
  for(let i=0;i<pending.length;i+=4)pairs.push(...await Promise.all(pending.slice(i,i+4).map(async f=>[f.key,cityAgrees&&regionAgrees?await queryLayer(f,location,address,context):layer("skipped",null,f.source,"A precise point, unique City boundary and matching regional boundary were not confirmed; the property query was not performed.")]as const)));
  const entries=Object.fromEntries(pairs),direct=Object.fromEntries(pending.filter(f=>f.group===f.key).map(f=>[f.key,entries[f.key]]));
  const grouped=Object.fromEntries([...new Set(pending.filter(f=>f.group!==f.key).map(f=>f.group))].map(name=>[name,group(name==="regionalEnvironment"?"Region of Waterloo":market,name,entries)]));
  const withheld=WATERLOO_WITHHELD.filter(f=>[market,"Region of Waterloo"].includes(f.market));
  const gaps:Record<string,Layer>=Object.fromEntries([...new Set(withheld.map(f=>f.layer))].filter(name=>!direct[name]&&!grouped[name]).map(name=>[name,layer("unavailable",{coverageComplete:false,screenPerformed:false,withheld:withheld.filter(f=>f.layer===name)},null,"Dataset reuse is unresolved or excluded; this source is withheld and no property records are queried.")]));
  if(!grouped.officialPlan)gaps.officialPlan=layer("not_supported",{currentPlanScreenPerformed:false,inForcePolicyEstablished:false},null,"No current licensed Official Plan layer is connected. Kitchener's June 2026 adoption and remaining prior-plan/secondary-plan applicability require current City confirmation.");
  if(!direct.zoning&&!gaps.zoning)gaps.zoning=layer("not_supported",{fullCurrentZoningScreenPerformed:false,legalPermissionsEstablished:false},null,"Current detailed zoning is unconnected. Waterloo zoning and the separate Erb Street community-planning-permit regime require City confirmation.");
  return {municipality:boundary,regionalBoundary:region,...direct,...grouped,...gaps,development:layer("not_supported",{nearbySearchPerformed:false,fullPlanningHistorySearched:false},null,"Nearby development and full decisions/appeals are unsearched. Exact-address active files and subject-point file polygons are separate evidence.")};
}
export async function waterlooCoverage() {
  const context:Context=new Map(),datasets=[];
  const inspect=async(f:WaterlooFeed)=>{try{const m=await waterlooMetadata(f,context),r=await get(f.url+"/query",{where:"1=1",returnCountOnly:"true"}),count=number(r.count);if(count===null||!Number.isInteger(count)||count<0)throw new Error("Invalid count");return{market:f.market,layer:f.key,group:f.group,status:"verified",records:count,source:f.source,sourceUpdatedAt:m.sourceUpdatedAt,note:f.note};}catch{return{market:f.market,layer:f.key,group:f.group,status:"unavailable",records:null,source:f.source,note:"Full grant, publisher/catalogue/schema binding or live count could not be verified."};}};
  for(let i=0;i<WATERLOO_FEEDS.length;i+=4)datasets.push(...await Promise.all(WATERLOO_FEEDS.slice(i,i+4).map(inspect)));
  return {cities:["Kitchener","Waterloo","Cambridge"],auditDate:"2026-10-03",guidance:{Kitchener:{catalogue:"https://open-kitchenergis.opendata.arcgis.com/",officialPlan:"https://www.kitchener.ca/development-and-construction/official-plan/",zoning:"https://www.kitchener.ca/development-and-construction/zoning/zoning-bylaw/"},Waterloo:{catalogue:"https://data.waterloo.ca/",zoning:"https://www.waterloo.ca/planning-and-development/check-zoning-and-land-use-rules/zoning-bylaw-and-map/"},Cambridge:{catalogue:"https://opendata-cityofcambridge.hub.arcgis.com/",officialPlan:"https://www.cambridge.ca/business-building-development/building-planning/official-plan/",zoning:"https://www.cambridge.ca/business-building-development/building-planning/zoning/"}},delivery:"cached_live_queries",cacheSeconds:3600,datasets,withheld:WATERLOO_WITHHELD.map(f=>({...f,status:"withheld",records:null})),complete:false,note:"Selected City and regional civic, permit, active-planning, heritage, plan-reference, improvement, pressure-zone, subwatershed and natural-heritage evidence. Current zoning, current plan instruments, complete file/decision histories, servicing capacity and conservation-authority clearance remain unverified. Regional feeds cover wider geography; counts overlap and are source rows, not unique properties, data points or database imports."};
}
