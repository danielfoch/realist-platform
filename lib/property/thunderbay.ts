import { createHash } from "node:crypto";
import { load } from "cheerio/slim";
import { fetchBytes, fetchJson, fetchText, literal, rows } from "./http";
import { civicStreetKey, cityKey, hasUnit, layer, streetNumber, text, type Layer, type Location, type PropertyRequest, type Row } from "./model";
import { provinceKey } from "./geocode";
import { arcgisDate } from "./hamilton";
import { niagaraMetadata } from "./niagara";
import { NIAGARA_FEEDS } from "./niagara-sources";
import { createCsvStreamParser } from "./ingest/csv";
import { THUNDERBAY_FEEDS, THUNDERBAY_GRANT, THUNDERBAY_GUIDANCE, THUNDERBAY_HERITAGE, THUNDERBAY_WITHHELD, type ThunderBayFeed } from "./thunderbay-sources";

type Context = Map<string, Promise<Row>>;
const base = "https://www.arcgis.com/sharing/rest/";
const feed = (key: string) => THUNDERBAY_FEEDS.find(f => f.key === key)!;
const normalized = (s: string) => load(s).text().replace(/\s+/g, " ").trim();
const sha = (s: string) => createHash("sha256").update(normalized(s)).digest("hex");
const termsSha = (s: string) => createHash("sha256").update(JSON.stringify({ text: normalized(s), links: load(s)("a").toArray().map(a => load(s)(a).attr("href") ?? "") })).digest("hex");
// Preserve the City's apostrophe-bearing names; SQ/SQUARE are published street-type codes.
const civicKey = (s: string) => civicStreetKey(s.replace(/([a-z])[’']s\b/gi, "$1s")).replace(/\bsq\b/g, "square");
const bytesSha = (s: Uint8Array) => createHash("sha256").update(s).digest("hex");
// A market name is a candidate; one original Ontario polygon gates spatial queries.
export const thunderBayMarket = (city: string | null, province: string | null) => cityKey(city ?? "") === "thunder bay" && provinceKey(province ?? "") === "ontario";
async function get(url: string, params: Record<string, string> = {}): Promise<Row> {
  const u = new URL(url); Object.entries({ f: "json", ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetchJson(new URL(u.href.replace(/\+/g, "%20"))) as Row;
  if (!r || typeof r !== "object" || Array.isArray(r) || r.error) throw Error("Thunder Bay source unavailable");
  return r;
}
function read(c: Context, url: string): Promise<Row> { const p = c.get(url) ?? get(url); c.set(url, p); return p; }
function failure(key: string, e: unknown) {
  const reason = e instanceof Error ? e.message : "unknown";
  console.warn("Thunder Bay property source unavailable", { feed: key, reason: reason.startsWith("Thunder Bay ") || /^Source unavailable \(HTTP \d{3}\)$/.test(reason) ? reason : "bounded_fetch_or_invalid_response" });
}
function offerRegion(s: string): string {
  const $ = load(s), sections = $("main section.usn_cmp_text, main section.usn_cmp_anchoredaccordion");
  if (sections.length !== 3) throw Error("Thunder Bay full offer/licence sections changed");
  // The City generates new accordion UUIDs per response; only local UI fragments are canonicalized.
  sections.find("a").each((_, a) => { const href = $(a).attr("href"); if (href) $(a).attr("href", href.replace(/^#collapse_[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}_(\d+)$/, "#collapse_$1")); });
  return sections.toArray().map(e => $(e).html() ?? "").join("\n");
}
async function grant(c: Context) {
  const key = "thunderbay:catalogue", previous = c.get(key); if (previous) return previous;
  const pending = (async () => {
    const b = THUNDERBAY_GRANT;
    const [site, data, group, offer, bytes] = await Promise.all([read(c, base + "content/items/" + b.site), read(c, base + "content/items/" + b.site + "/data"), read(c, base + "community/groups/" + b.group), fetchText(new URL(b.officialOffer)), fetchBytes(new URL(b.licenceUrl))]);
    const v = data.values as Row | undefined, catalog = data.catalog as Row | undefined, $ = load(offer);
    // Public City items omit orgId. Bind City offer, exact publisher/group and hosted service path instead of inventing it.
    // The dataset-linked old PDF is 404; the City's current offer explicitly links the same full licence 1.0 here.
    if (site.id !== b.site || site.type !== b.siteType || site.title !== b.siteTitle || site.url !== b.siteUrl || site.owner !== b.siteOwner || (site.orgId ?? null) !== null || site.access !== "public" || termsSha(String(site.licenseInfo ?? "")) !== b.siteTermsHash ||
      v?.customHostname !== new URL(b.siteUrl).hostname || v?.defaultHostname !== "opendata-thunderbay.hub.arcgis.com" || JSON.stringify(catalog?.groups) !== JSON.stringify([b.group]) ||
      group.id !== b.group || group.title !== b.groupTitle || group.owner !== b.groupOwner || (group.orgId ?? null) !== null || group.access !== "public" || group.isOpenData !== true ||
      termsSha(offerRegion(offer)) !== b.offerHash || bytesSha(bytes) !== b.licenceHash ||
      !$("a").toArray().some(a => $(a).attr("href")?.replace(/\/$/, "") === b.siteUrl) ||
      !$("a").toArray().some(a => $(a).attr("href") === new URL(b.licenceUrl).pathname)) throw Error("Thunder Bay full current City licence or exact curated offer changed");
    return {};
  })(); c.set(key, pending); return pending;
}
async function itemMetadata(f: { item:string; title:string; owner:string; itemDescriptionHash:string; termsHash:string; accessInformation:string|null }, itemType: string, itemUrl: string | null, c: Context) {
  const b = THUNDERBAY_GRANT, u = new URL(base + "search"); u.searchParams.set("q", `id:${f.item} AND group:${b.group}`); u.searchParams.set("num", "10");
  const [item, curated] = await Promise.all([read(c, base + "content/items/" + f.item), read(c, u.href)]);
  const members = rows(curated.results ?? []);
  if (item.id !== f.item || item.owner !== f.owner || (item.orgId ?? null) !== null || item.access !== "public" || item.type !== itemType || item.title !== f.title || (item.url ?? null) !== itemUrl ||
    (item.accessInformation ?? null) !== f.accessInformation || sha(String(item.description ?? "")) !== f.itemDescriptionHash || termsSha(String(item.licenseInfo ?? "")) !== f.termsHash ||
    curated.total !== 1 || members.length !== 1 || members[0].id !== f.item || members[0].owner !== f.owner || (members[0].orgId ?? null) !== null || members[0].access !== "public" || members[0].type !== itemType || (members[0].url ?? null) !== itemUrl) throw Error("Thunder Bay exact City curation, publisher or dataset terms changed");
  await grant(c);
}
export async function thunderBayMetadata(f: ThunderBayFeed, c: Context = new Map()) {
  const [root, m] = await Promise.all([read(c, f.rootUrl), read(c, f.url), itemMetadata(f, "Feature Service", f.itemUrl, c)]);
  if (!f.rootUrl.startsWith(`https://services5.arcgis.com/${THUNDERBAY_GRANT.serviceOrg}/arcgis/rest/services/`) || root.serviceItemId !== f.item || !rows(root.layers ?? []).some(x => x.id === f.child && x.name === f.layerName && x.type === "Feature Layer" && x.geometryType === f.geometry) ||
    (root.copyrightText ?? "") !== f.rootCopyright || sha(String(root.description ?? "")) !== f.rootDescriptionHash || m.serviceItemId !== f.item || m.id !== f.child || m.type !== "Feature Layer" || m.name !== f.layerName || m.geometryType !== f.geometry ||
    (m.copyrightText ?? "") !== f.copyright || sha(String(m.description ?? "")) !== f.descriptionHash || m.objectIdField !== f.oid || !Object.entries(f.fieldTypes).every(([name, type]) => rows(m.fields).some(x => x.name === name && x.type === type))) throw Error("Thunder Bay fixed originating lineage or typed child changed");
  const streetDomain = (rows(m.fields).find(x => x.name === "STREET")?.domain as Row | null);
  const streetNames = f.key === "municipalAddresses" ? rows(streetDomain?.codedValues).map(x => x.code) : [];
  if (f.key === "municipalAddresses" && (streetDomain?.type !== "codedValue" || streetNames.length > 5000 || streetNames.some(x => typeof x !== "string"))) throw Error("Thunder Bay published street-name domain changed");
  return { sourceUpdatedAt: arcgisDate((m.editingInfo as Row | undefined)?.dataLastEditDate), streetNames: streetNames as string[] };
}
function attributes(r: Row, f: ThunderBayFeed): Row[] {
  const records = rows(r.features).map(x => {
    const a = x.attributes as Row;
    if (!a || typeof a !== "object" || Array.isArray(a) || !Object.entries(f.fieldTypes).every(([k, t]) => k in a && (k === f.oid ? typeof a[k] === "number" && Number.isSafeInteger(a[k]) && Number(a[k]) > 0 : a[k] === null || (t === "esriFieldTypeString" ? typeof a[k] === "string" : typeof a[k] === "number" && Number.isFinite(a[k]) && (!/Integer$/.test(t) || Number.isSafeInteger(a[k])))))) throw Error("Thunder Bay invalid typed record");
    return a;
  });
  if (new Set(records.map(x => x[f.oid])).size !== records.length) throw Error("Thunder Bay duplicate GIS identifiers");
  if (!records.length && r.exceededTransferLimit) throw Error("Thunder Bay incomplete empty query");
  return records;
}
const mapped = (a: Row, f: ThunderBayFeed) => Object.fromEntries(Object.entries(f.fields).map(([k, v]) => [v, a[k]]));
function civicMatch(a: Row, address: string): boolean {
  const full = text(a.COMPLETE), number = text(a.ADDRESS), qualifier = text(a.ADDRESS_QUALIFIER) ?? "", root = text(a.ROOT);
  const street = [text(a.STREET), text(a.ROWTYPE), text(a.SPLITLOC)].filter(Boolean).join(" ");
  return Boolean(full && number && root && !full.includes(",") && !hasUnit(full) && thunderBayMarket(text(a.CITY), text(a.PROVINCE)) &&
    Number(streetNumber(address)?.replace(/[a-z]$/i, "")) === a.ADDRESS_NUMBER && `${a.ADDRESS_NUMBER}${qualifier}`.toUpperCase() === number.toUpperCase() &&
    civicKey(full) === civicKey(address) && civicKey(`${number} ${root}`) === civicKey(address) && civicKey(`${number} ${street}`) === civicKey(address));
}
export interface ThunderBayResearch { location: Layer<Location> | null; civic: Layer; context: Context; }
export async function thunderBayResearch(input: PropertyRequest): Promise<ThunderBayResearch | null> {
  const p = input.address?.split(",").map(s => s.trim()), city = input.city ?? p?.[1] ?? "", province = input.province ?? p?.[2] ?? "ON";
  if (!thunderBayMarket(city, province)) return null;
  const f = feed("municipalAddresses"), context: Context = new Map();
  const stop = (note: string): ThunderBayResearch => ({ location: layer("ambiguous", null, f.source, note), civic: layer("skipped", null, f.source, note), context });
  if ((p?.[1] && !thunderBayMarket(p[1], "ON")) || (p?.[2] && provinceKey(p[2]) !== "ontario")) return stop("The explicit address municipality/province conflicts with the submitted identity; correct it before screening.");
  if (!input.address || hasUnit(input.address) || !streetNumber(input.address)) return { location: null, civic: layer("skipped", null, f.source, "An exact building civic address is required; coordinates alone do not query civic records."), context };
  try {
    const m = await thunderBayMetadata(f, context), n = streetNumber(input.address)!;
    const name = civicKey(input.address).replace(/^\d+[a-z]?\s+/, "").replace(/\s+(north|south|east|west|northeast|northwest|southeast|southwest)$/, "").replace(/\s+(street|avenue|road|drive|court|crescent|boulevard|lane|place|terrace|square)$/, "");
    const candidates = m.streetNames.filter(s => civicKey(s) === name);
    if (candidates.length > 64) throw Error("Thunder Bay street-name candidates incomplete");
    const r = await get(f.url + "/query", { where: `ADDRESS_NUMBER=${Number(n.replace(/[a-z]$/i, ""))} AND UPPER(STREET) IN (${(candidates.length ? candidates.map(s => s.toUpperCase()) : ["__NO_PUBLISHED_STREET_MATCH__"]).map(literal).join(",")})`, outFields: Object.keys(f.fields).join(","), returnGeometry: "false", resultRecordCount: "51", orderByFields: f.oid });
    const all = attributes(r, f), matches = all.filter(a => civicMatch(a, input.address!)), truncated = Boolean(r.exceededTransferLimit || all.length > 50), unique = !truncated && matches.length === 1 && matches[0].REFNAME === "ADDRESS-REGULAR";
    const civic = layer(matches.length ? unique ? "available" : "ambiguous" : truncated ? "ambiguous" : "no_match", { records: matches.slice(0, 50).map(a => mapped(a, f)), matchMethod: "exact_complete_civic_components_municipality_province", scope: "building_or_site_address", queryCoverageComplete: !truncated, coverageComplete: false, absenceEstablished: false, spatialScreenPerformed: false, unitIdentityVerified: false, parcelIdentityVerified: false, preciseBuildingIdentityEstablished: false, sourceGeometryReused: false, activeAddressStatusVerified: false }, f.source, f.note, m.sourceUpdatedAt); civic.truncated = truncated;
    return { location: truncated || (matches.length > 0 && !unique) ? layer("ambiguous", null, f.source, "Duplicate, non-regular or incomplete civic evidence must be resolved before spatial screening. No centroid geometry is reused.") : null, civic, context };
  } catch (e) { failure(f.key, e); return { location: null, civic: layer("unavailable", null, f.source, "The full grant, exact source schema or bounded civic query could not be verified; an independent national address match remains separate."), context }; }
}
function precise(l: Location | null): l is Location & { latitude: number; longitude: number } {
  return Boolean(l && typeof l.latitude === "number" && typeof l.longitude === "number" && Number.isFinite(l.latitude) && Number.isFinite(l.longitude) && l.latitude > 48.15 && l.latitude < 48.7 && l.longitude > -89.7 && l.longitude < -88.9 &&
    ["source_building_point", "source_civic_address_point", "caller_supplied"].includes(l.accuracy) && !l.provider.startsWith("thunderbay:"));
}
const provincial = NIAGARA_FEEDS.find(f => f.key === "ontarioMunicipality")!;
const boundarySource = { ...provincial.source, id: "thunderbay:ontarioMunicipality", name: "Ontario — Thunder Bay municipal boundary reference" };
async function boundary(l: Location, c: Context): Promise<Layer> {
  try {
    const m = await niagaraMetadata(provincial, c), r = await get(provincial.url + "/query", { where: "1=1", geometry: `${l.longitude},${l.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "OBJECTID,MUNICIPAL_NAME", returnGeometry: "false", resultRecordCount: "51", orderByFields: "OBJECTID" });
    const a = rows(r.features).map(f => f.attributes as Row);
    if (a.some(x => !x || typeof x !== "object" || Array.isArray(x) || typeof x.OBJECTID !== "number" || !Number.isSafeInteger(x.OBJECTID) || x.OBJECTID <= 0 || typeof x.MUNICIPAL_NAME !== "string")) throw Error("Thunder Bay invalid provincial boundary record");
    const agrees = !r.exceededTransferLimit && a.length === 1 && cityKey(String(a[0].MUNICIPAL_NAME)) === "thunder bay";
    const result = layer(agrees ? "available" : a.length || r.exceededTransferLimit ? "ambiguous" : "no_match", { records: a.slice(0, 2).map(x => ({ recordId: x.OBJECTID, publishedMunicipality: x.MUNICIPAL_NAME })), matchMethod: "licensed_provincial_polygon_intersects_point", scope: "subject_point", spatialScreenPerformed: true, queryCoverageComplete: !r.exceededTransferLimit && a.length < 51, coverageComplete: false, absenceEstablished: false, currentLegalBoundaryVerified: false, parcelIdentityVerified: false }, boundarySource, "One unique complete original Ontario polygon must name Thunder Bay before City spatial queries. The City boundary originates in 1969 and is only a historical reference, not this gate.", m.sourceUpdatedAt);
    result.truncated = Boolean(r.exceededTransferLimit || a.length >= 51); return result;
  } catch (e) { failure("ontarioMunicipality", e); return layer("unavailable", null, boundarySource, "The original provincial grant, typed polygon or unique named municipality could not be verified; no City spatial queries were performed."); }
}
async function query(f: ThunderBayFeed, l: Location, c: Context): Promise<Layer> {
  try {
    const m = await thunderBayMetadata(f, c), r = await get(f.url + "/query", { where: "1=1", geometry: `${l.longitude},${l.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: Object.keys(f.fields).join(","), returnGeometry: "false", resultRecordCount: "51", orderByFields: f.oid });
    const all = attributes(r, f), truncated = Boolean(r.exceededTransferLimit || all.length > 50);
    const result = layer(all.length ? "available" : "no_match", { records: all.slice(0, 50).map(a => mapped(a, f)), matchMethod: "published_polygon_intersects_independent_point", scope: "subject_point", screenedPoint: { latitude:l.latitude, longitude:l.longitude, accuracy:l.accuracy, provider:l.provider }, spatialScreenPerformed:true, queryCoverageComplete:!truncated, coverageComplete:false, absenceEstablished:false, parcelWideScreenPerformed:false, parcelIdentityVerified:false, unitIdentityVerified:false, sourceGeometryReused:false, currentLegalInstrumentVerified:false, legalPermissionsEstablished:false,
      ...(f.key === "buildingFootprintReference" ? { originalObservationDate:null, currentFootprintVerified:false, measuredBuildingAreaReturned:false, constructionYearEstablished:false } : {}),
      ...(["officialPlanReference","siteSpecificPolicyReference"].includes(f.key) ? { publishedInstrumentYear:2019, currentOfficialMapLineageVerified:false, currentAmendmentsVerified:false, currentAppealsVerified:false } : {}),
      ...(f.key === "heritageDistrict" ? { publishedBylaw:"65-1988", currentHeritageRegisterVerified:false } : {}),
      ...(f.key === "historicalMunicipalBoundary" ? { originalBoundaryReference:"Order in Council, May 1969", usedAsContainmentGate:false } : {}),
    }, f.source, f.note + " Feed dataLastEditDate is separate from item/schema edits and original observation/instrument vintage; no-match does not establish absence.", m.sourceUpdatedAt); result.truncated = truncated; return result;
  } catch (e) { failure(f.key,e); return layer("unavailable", null, f.source, "The full grant, exact curation/publisher/lineage, typed schema or bounded query could not be verified."); }
}
async function heritageRows(c: Context): Promise<Row[]> {
  const f = THUNDERBAY_HERITAGE, key = "thunderbay:heritageCSV";
  if (!c.has(key)) c.set(key, (async () => {
    await itemMetadata(f, "CSV", null, c);
    const bytes = await fetchBytes(new URL(f.url)); if (bytesSha(bytes) !== f.dataHash) throw Error("Thunder Bay historical heritage export changed; re-audit vintage and schema");
    const parser = createCsvStreamParser(), all = [...parser.push(new TextDecoder("utf-8", {fatal:true}).decode(bytes)), ...parser.end()].filter(r => r.some(x => x.trim()));
    const header = ["Building/Name","Address_#","Street","Cira","Status_on_Register","_Year_Added_","By-Law/Report","Ownership"];
    if (JSON.stringify(all[0]) !== JSON.stringify(header) || all.length > 501 || all.slice(1).some(r => r.length !== header.length)) throw Error("Thunder Bay historical heritage CSV schema changed");
    // The source byte hash pins the complete audited export. Ownership is never exposed.
    return {records:all.slice(1).map((r,i) => ({sourceRow:i+2,publishedBuildingName:r[0],publishedNumber:r[1],publishedStreet:r[2],publishedApproximateConstructionLabel:r[3],publishedRegisterStatus:r[4],publishedYearAddedLabel:r[5],publishedBylawOrReport:r[6]}))};
  })());
  return rows((await c.get(key)!).records);
}
async function historicalHeritage(address: string | null, c: Context): Promise<Layer> {
  const f = THUNDERBAY_HERITAGE;
  if (!address || !streetNumber(address) || hasUnit(address)) return layer("skipped",null,f.source,"An exact building civic address is required; historical register matching is not a coordinate or unit lookup.");
  try {
    const all = await heritageRows(c), exact = all.filter(r => typeof r.publishedNumber === "string" && /^\d+[a-z]?$/i.test(r.publishedNumber.trim()) && civicKey(`${r.publishedNumber} ${r.publishedStreet}`) === civicKey(address)), truncated = exact.length > 50;
    const result = layer(exact.length ? "available" : "no_match", {records:exact.slice(0,50),matchMethod:"exact_historical_civic_address",scope:"building_or_site_address",publishedVintage:f.publishedVintage,queryCoverageComplete:!truncated,coverageComplete:false,absenceEstablished:false,spatialScreenPerformed:false,currentHeritageRegisterVerified:false,individualCurrentDesignationVerified:false,constructionYearEstablished:false,unitIdentityVerified:false,ownershipReturned:false},f.source,f.note,f.publishedVintage);result.truncated=truncated;return result;
  } catch(e) { failure(f.key,e);return layer("unavailable",null,f.source,"The full City grant, exact curation, complete historical export or schema/vintage could not be verified."); }
}
export async function thunderBayLayers(address:string|null,city:string|null,province:string|null,l:Location|null,requestedCity?:string,research?:ThunderBayResearch|null):Promise<Record<string,Layer>> {
  if (!thunderBayMarket(requestedCity??city,province)) return {};
  const c=research?.context??new Map(), identityConflict=research?.location?.status==="ambiguous" || Boolean(l&&!thunderBayMarket(l.city??city,l.province??province));
  const suitable=!identityConflict&&precise(l)&&thunderBayMarket(l.city??city,l.province??province);
  const municipality=suitable?await boundary(l,c):layer("skipped",null,boundarySource,"An independent precise building/civic point or caller coordinate was not confirmed; City centroid address points, approximate and ambiguous evidence do not trigger spatial queries.");
  const agrees=suitable&&municipality.status==="available";
  const entries=await Promise.all(THUNDERBAY_FEEDS.filter(f=>f.key!=="municipalAddresses").map(async f=>[f.key,agrees?await query(f,l!,c):layer("skipped",null,f.source,"A suitable independent point and one complete original Ontario polygon naming Thunder Bay were not confirmed; no City spatial query was performed.")]as const));
  return {municipality,municipalAddresses:research?.civic??layer("skipped",null,feed("municipalAddresses").source,"No civic query was requested."),...Object.fromEntries(entries),historicalHeritageRegister:identityConflict?layer("skipped",null,THUNDERBAY_HERITAGE.source,"Resolve conflicting or ambiguous identity before matching the historical register."):await historicalHeritage(address,c),...Object.fromEntries(THUNDERBAY_WITHHELD.map(g=>[g.layer,layer("unavailable",{coverageComplete:false,recordsQueried:false,screenPerformed:false,withheld:g},null,g.reason)]))};
}
export async function thunderBayCoverage() {
  const c:Context=new Map(),datasets=[];
  for(let i=0;i<THUNDERBAY_FEEDS.length;i+=4)datasets.push(...await Promise.all(THUNDERBAY_FEEDS.slice(i,i+4).map(async f=>{
    try{const m=await thunderBayMetadata(f,c),r=await get(f.url+"/query",{where:"1=1",returnCountOnly:"true"}),count=r.count;if(typeof count!=="number"||!Number.isSafeInteger(count)||count<0)throw Error("Thunder Bay invalid count");return{market:"Thunder Bay",layer:f.key,status:"verified",records:count,source:f.source,sourceUpdatedAt:m.sourceUpdatedAt,note:f.note};}
    catch(e){failure(f.key,e);return{market:"Thunder Bay",layer:f.key,status:"unavailable",records:null,source:f.source,note:"Exact full City licence/offer/curation/publisher/lineage, typed child or bounded count could not be verified."};}
  })));
  const f=THUNDERBAY_HERITAGE;
  try{datasets.push({market:"Thunder Bay",layer:f.key,status:"verified",records:(await heritageRows(c)).length,source:f.source,sourceUpdatedAt:f.publishedVintage,note:f.note});}
  catch(e){failure(f.key,e);datasets.push({market:"Thunder Bay",layer:f.key,status:"unavailable",records:null,source:f.source,note:"Full grant or exact complete historical export/vintage could not be verified."});}
  return{cities:["Thunder Bay"],auditDate:"2026-10-03",delivery:"cached_live_queries",cacheSeconds:3600,datasets,withheld:THUNDERBAY_WITHHELD.map(g=>({...g,status:"withheld",records:null})),complete:false,municipalityReference:{source:boundarySource,countIncludedHere:false,countAlreadyIncludedUnder:"Original Ontario municipality dataset in Niagara coverage; count once province-wide."},guidance:THUNDERBAY_GUIDANCE,note:"Eight licensed City-curated civic, GIS and historical register references. No centroid geometry is reused. Current permits/zoning/planning instruments/register and originating airport/conservation/source-protection rights remain separate gaps. Rows overlap and include historical observations, not unique properties, field data points or imports."};
}
