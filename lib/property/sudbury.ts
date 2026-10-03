import { createHash } from "node:crypto";
import { load } from "cheerio/slim";
import { fetchJson, fetchText, literal, rows } from "./http";
import { civicStreetKey, cityKey, hasUnit, layer, streetNumber, text, type Layer, type Location, type PropertyRequest, type Row } from "./model";
import { provinceKey } from "./geocode";
import { arcgisDate, streetVariants } from "./hamilton";
import { niagaraMetadata } from "./niagara";
import { NIAGARA_FEEDS } from "./niagara-sources";
import { SUDBURY_FEEDS, SUDBURY_GRANT, SUDBURY_WITHHELD, SUDBURY_ZONING_MAP, type SudburyFeed } from "./sudbury-sources";

type Context = Map<string, Promise<Row>>;
const base = "https://www.arcgis.com/sharing/rest/";
const feed = (key: string) => SUDBURY_FEEDS.find(f => f.key === key)!;
const normalized = (s: string) => load(s).text().replace(/\s+/g, " ").trim();
const sha = (s: string) => createHash("sha256").update(normalized(s)).digest("hex");
const termsSha = (s: string) => createHash("sha256").update(JSON.stringify({ text: normalized(s), links: load(s)("a").toArray().map(a => load(s)(a).attr("href") ?? "") })).digest("hex");
const communities = ["greater sudbury", "sudbury", "azilda", "capreol", "chelmsford", "coniston", "copper cliff", "dowling", "falconbridge", "garson", "hanmer", "levack", "lively", "onaping", "val caron", "val therese", "walden", "rayside balfour", "nickel centre"];
const communityKey = (s: string) => cityKey(s).replace(/[-’']/g, " ").replace(/\s+/g, " ").trim();
const broadCity = (s: string) => ["greater sudbury", "sudbury"].includes(communityKey(s));
// Names select a candidate only; one original Ontario municipal polygon must agree.
export const sudburyMarket = (city: string | null, province: string | null) => communities.includes(communityKey(city ?? "")) && provinceKey(province ?? "") === "ontario";
const inArea = (lat: unknown, lng: unknown): boolean => typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && lat > 46 && lat < 47.5 && lng > -82 && lng < -80;
function precise(l: Location | null): l is Location & { latitude: number; longitude: number } {
  return Boolean(l && inArea(l.latitude, l.longitude) && ["source_building_point", "source_civic_address_point", "caller_supplied"].includes(l.accuracy) && (!l.provider.startsWith("sudbury:") || l.provider === "sudbury:municipalAddresses"));
}
async function get(url: string, params: Record<string, string> = {}): Promise<Row> {
  const u = new URL(url); Object.entries({ f: "json", ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetchJson(new URL(u.href.replace(/\+/g, "%20"))) as Row;
  if (!r || typeof r !== "object" || Array.isArray(r) || r.error) throw Error("Sudbury source unavailable");
  return r;
}
function read(c: Context, url: string): Promise<Row> { const p = c.get(url) ?? get(url); c.set(url, p); return p; }
function failure(key: string, e: unknown) {
  const reason = e instanceof Error ? e.message : "unknown";
  console.warn("Sudbury property source unavailable", { feed: key, reason: reason.startsWith("Sudbury ") || /^Source unavailable \(HTTP \d{3}\)$/.test(reason) ? reason : "bounded_fetch_or_invalid_response" });
}
function region(s: string): string {
  const r = load(s)(".mura-region-loose > .mura-region-local");
  if (r.length !== 1) throw Error("Sudbury full licence/policy/offer section changed");
  return r.html() ?? "";
}
async function grant(c: Context) {
  const key = "sudbury:catalogue", previous = c.get(key); if (previous) return previous;
  const pending = (async () => {
    const b = SUDBURY_GRANT;
    const [site, data, group, licence, policy, offer] = await Promise.all([read(c, base + "content/items/" + b.site), read(c, base + "content/items/" + b.site + "/data"), read(c, base + "community/groups/" + b.group), fetchText(new URL(b.licenceUrl)), fetchText(new URL(b.policyUrl)), fetchText(new URL(b.officialOffer))]);
    const v = data.values as Row | undefined, catalog = data.catalog as Row | undefined, $ = load(offer);
    // Portal application CC-BY-SA is separate from each dataset's explicit City licence/policy.
    // This legacy portal curates through top-level catalog.groups, not values.groups/catalogV2.
    if (site.id !== b.site || site.type !== b.siteType || site.title !== b.siteTitle || site.url !== b.siteUrl || site.owner !== b.siteOwner || site.orgId !== b.org || site.access !== "public" || termsSha(String(site.licenseInfo ?? "")) !== b.siteTermsHash ||
      v?.customHostname !== new URL(b.catalogueUrl).hostname || v?.defaultHostname !== "opendata-sudbury.opendata.arcgis.com" || JSON.stringify(catalog?.groups) !== JSON.stringify([b.group]) ||
      group.id !== b.group || group.title !== b.groupTitle || group.owner !== b.groupOwner || group.orgId !== b.org || group.access !== "public" || group.isOpenData !== true ||
      sha(region(licence)) !== b.fullGrantHash || sha(region(policy)) !== b.policyHash || termsSha(region(offer)) !== b.offerHash ||
      !$("a").toArray().some(a => $(a).attr("href")?.replace(/\/$/, "") === b.catalogueUrl)) throw Error("Sudbury full City licence, linked policy or exact curated offer changed");
    return {};
  })(); c.set(key, pending); return pending;
}
async function currentZoningMap(c: Context) {
  const key = "sudbury:currentZoningMap", previous = c.get(key); if (previous) return previous;
  const pending = (async () => {
    const b = SUDBURY_ZONING_MAP;
    const [offer, app, appData, map, mapData] = await Promise.all([fetchText(new URL(b.officialOffer)), read(c, base + "content/items/" + b.app), read(c, base + "content/items/" + b.app + "/data"), read(c, base + "content/items/" + b.map), read(c, base + "content/items/" + b.map + "/data")]);
    const layers = rows(mapData.operationalLayers), mapConfig = appData.map as Row | undefined;
    if (termsSha(region(offer)) !== b.offerHash || app.id !== b.app || app.owner !== b.owner || app.orgId !== SUDBURY_GRANT.org || app.access !== "public" || app.type !== "Web Mapping Application" || app.title !== b.appTitle || app.url !== b.appUrl || mapConfig?.itemId !== b.map ||
      map.id !== b.map || map.owner !== b.owner || map.orgId !== SUDBURY_GRANT.org || map.access !== "public" || map.type !== "Web Map" || map.title !== b.mapTitle ||
      !SUDBURY_FEEDS.filter(f => ["zoning", "temporaryZoning"].includes(f.key)).every(f => layers.filter(x => x.itemId === f.item && x.url === f.url).length === 1)) throw Error("Sudbury current official zoning offer or exact app/map source lineage changed");
    return {};
  })(); c.set(key, pending); return pending;
}
export async function sudburyMetadata(f: SudburyFeed, c: Context = new Map()) {
  const b = SUDBURY_GRANT, u = new URL(base + "search"); u.searchParams.set("q", `id:${f.item} AND group:${b.group}`); u.searchParams.set("num", "10");
  const [item, root, m, curated] = await Promise.all([read(c, base + "content/items/" + f.item), read(c, f.rootUrl), read(c, f.url), read(c, u.href)]);
  const members = rows(curated.results ?? []);
  if (item.id !== f.item || item.owner !== f.owner || item.orgId !== b.org || item.access !== "public" || item.type !== "Feature Service" || item.title !== f.title || item.url !== f.itemUrl ||
    (item.accessInformation ?? null) !== f.accessInformation || sha(String(item.description ?? "")) !== f.itemDescriptionHash || termsSha(String(item.licenseInfo ?? "")) !== f.termsHash ||
    curated.total !== 1 || members.length !== 1 || members[0].id !== f.item || members[0].owner !== f.owner || (members[0].orgId ?? null) !== null || members[0].access !== "public" || members[0].url !== f.itemUrl ||
    !f.rootUrl.startsWith(`https://services.arcgis.com/${b.org}/arcgis/rest/services/`) || root.serviceItemId !== f.item || !rows(root.layers ?? []).some(x => x.id === f.child && x.name === f.layerName && x.type === "Feature Layer" && x.geometryType === f.geometry) ||
    (root.copyrightText ?? "") !== f.rootCopyright || sha(String(root.description ?? "")) !== f.rootDescriptionHash || m.serviceItemId !== f.item || m.id !== f.child || m.type !== "Feature Layer" || m.name !== f.layerName || m.geometryType !== f.geometry ||
    (m.copyrightText ?? "") !== f.copyright || sha(String(m.description ?? "")) !== f.descriptionHash || m.objectIdField !== f.oid || !Object.entries(f.fieldTypes).every(([name, type]) => rows(m.fields).some(x => x.name === name && x.type === type))) throw Error("Sudbury exact City curation, publisher, grant, lineage or typed child changed");
  await grant(c);
  if (["zoning", "temporaryZoning"].includes(f.key)) await currentZoningMap(c);
  return { sourceUpdatedAt: arcgisDate((m.editingInfo as Row | undefined)?.dataLastEditDate) };
}
function attributes(r: Row, f: SudburyFeed): { a: Row; geometry: Row | null }[] {
  const records = rows(r.features).map(x => {
    const a = x.attributes as Row;
    if (!a || typeof a !== "object" || Array.isArray(a) || !Object.entries(f.fieldTypes).every(([k, t]) => k in a && (k === f.oid ? typeof a[k] === "number" && Number.isSafeInteger(a[k]) && Number(a[k]) > 0 : a[k] === null || (t === "esriFieldTypeString" ? typeof a[k] === "string" : typeof a[k] === "number" && Number.isFinite(a[k]) && (!/Integer$/.test(t) || Number.isSafeInteger(a[k])))))) throw Error("Sudbury invalid typed record");
    return { a, geometry: x.geometry as Row | null ?? null };
  });
  if (new Set(records.map(x => x.a[f.oid])).size !== records.length) throw Error("Sudbury duplicate GIS identifiers");
  if (!records.length && r.exceededTransferLimit) throw Error("Sudbury incomplete empty query");
  return records;
}
const mapped = (a: Row, f: SudburyFeed) => Object.fromEntries(Object.entries(f.fields).map(([k, v]) => [v, a[k]]));
const variants = (address: string) => [...new Set(streetVariants(civicStreetKey(address)).flatMap(v => [v, v.replace(/\bAVE\b/g, "AV").replace(/\bCT\b/g, "CRT")]))].slice(0, 128);
function civicMatch(a: Row, address: string, requestedCity: string): boolean {
  const full = text(a.FULLADDRESSTEXT), component = `${text(a.ADDRESSNUMBER) ?? ""}${text(a.ADDRESSNUMBERPREFIX) ?? ""}${text(a.ADDRESSNUMBERSUFFIX) ?? ""} ${text(a.FULLSTREETNAME) ?? ""}`, community = text(a.COMMUNITY);
  return Boolean(full && community && sudburyMarket(community, "ON") && !full.includes(",") && !hasUnit(full) && civicStreetKey(full) === civicStreetKey(address) && civicStreetKey(component) === civicStreetKey(address) && (broadCity(requestedCity) || communityKey(community) === communityKey(requestedCity)));
}
export interface SudburyResearch { location: Layer<Location> | null; civic: Layer; context: Context; }
export async function sudburyResearch(input: PropertyRequest): Promise<SudburyResearch | null> {
  const parts = input.address?.split(",").map(s => s.trim()), city = input.city ?? parts?.[1] ?? "", province = input.province ?? parts?.[2] ?? "ON";
  if (!sudburyMarket(city, province)) return null;
  const f = feed("municipalAddresses"), context: Context = new Map();
  const fail = (note: string): SudburyResearch => ({ location: layer("ambiguous", null, f.source, note), civic: layer("skipped", null, f.source, note), context });
  if ((parts?.[1] && (!sudburyMarket(parts[1], "ON") || (!broadCity(city) && !broadCity(parts[1]) && communityKey(parts[1]) !== communityKey(city)))) || (parts?.[2] && provinceKey(parts[2]) !== "ontario")) return fail("The submitted municipality/community or province conflicts with the explicit address. Correct identity before screening.");
  if (!input.address || hasUnit(input.address) || !streetNumber(input.address)) return { location: null, civic: layer("skipped", null, f.source, "An exact building civic address is required; coordinate-only calls do not query address records."), context };
  try {
    const metadata = await sudburyMetadata(f, context), n = streetNumber(input.address)!;
    const r = await get(f.url + "/query", { where: `UPPER(ADDRESSNUMBER) IN (${[...new Set([n.toUpperCase(), n.replace(/[a-z]$/i, "")])].map(literal).join(",")}) AND UPPER(FULLSTREETNAME) IN (${variants(input.address.replace(/^\d+[a-z]?\s+/i, "")).map(literal).join(",")})`, outFields: Object.keys(f.fields).join(","), returnGeometry: "true", outSR: "4326", resultRecordCount: "51", orderByFields: f.oid });
    const all = attributes(r, f), matches = all.filter(({ a }) => civicMatch(a, input.address!, city)), active = matches.filter(({ a }) => a.ADDRESSLIFECYCLESTATUS === "Active");
    const primary = active.filter(({ a }) => a.STYPE === "Primary" && a.UNIT_OR_AMENITY !== "Unit" && (!text(a.ASSIGNEDADDRESSID) || a.ASSIGNEDADDRESSID === a.ADDRESSID)), truncated = Boolean(r.exceededTransferLimit || all.length > 50);
    const unique = !truncated && active.length === 1 && primary.length === 1;
    const civic = layer(matches.length ? unique ? "available" : "ambiguous" : "no_match", { records: matches.slice(0, 50).map(({ a }) => mapped(a, f)), matchMethod: "exact_full_civic_components_and_community", scope: "building_or_site_address", coverageComplete: false, queryCoverageComplete: !truncated, absenceEstablished: false, spatialScreenPerformed: false, unitIdentityVerified: false, parcelIdentityVerified: false, primaryPointIdentityEstablished: unique, sourceGeometryReused: unique }, f.source, f.note, metadata.sourceUpdatedAt); civic.truncated = truncated;
    if (!matches.length) return { location: null, civic, context };
    if (!unique) return { location: layer("ambiguous", null, f.source, "The civic register has retired, secondary/unit, duplicate or incomplete matching evidence. A unique complete active primary building point was not established; no City spatial queries are performed."), civic, context };
    const g = primary[0].geometry;
    if (!g || !inArea(g.y, g.x)) throw Error("Sudbury invalid civic point geometry");
    if (input.lat !== undefined && input.lng !== undefined && Math.hypot((input.lat - Number(g.y)) * 111000, (input.lng - Number(g.x)) * 76000) > 50) return { ...fail("The caller-supplied coordinate conflicts with the uniquely matched City primary address point. Correct identity before screening."), civic: { ...civic, status: "ambiguous", data: { ...(civic.data as Row), primaryPointIdentityEstablished: false, sourceGeometryReused: false } } };
    const a = primary[0].a;
    const location = layer("available", { address: String(a.FULLADDRESSTEXT), city: "Greater Sudbury", province: "ON", latitude: input.lat ?? Number(g.y), longitude: input.lng ?? Number(g.x), accuracy: input.lat === undefined ? "source_civic_address_point" : "caller_supplied", provider: input.lat === undefined ? "sudbury:municipalAddresses" : "caller", municipalAddress: { recordIds: [String(a.OBJECTID)], community: String(a.COMMUNITY), permitAddressKeys: [String(a.FULLADDRESSTEXT)], source: f.source, sourceUpdatedAt: metadata.sourceUpdatedAt } }, f.source, "One complete active primary City civic point matched full address components and community. Individual address update/verification dates remain separate from feed edits; unit, survey and legal parcel identity are unverified.", metadata.sourceUpdatedAt);
    return { location, civic, context };
  } catch (e) { failure(f.key, e); return { location: null, civic: layer("unavailable", null, f.source, "The full City grant, exact curator/source/typed schema or bounded civic query could not be verified. Independent national/geocoder evidence may remain available."), context }; }
}
const provincial = NIAGARA_FEEDS.find(f => f.key === "ontarioMunicipality")!;
const boundarySource = { ...provincial.source, id: "sudbury:ontarioMunicipality", name: "Ontario — Greater Sudbury municipal boundary reference" };
async function boundary(l: Location, c: Context): Promise<Layer> {
  try {
    const m = await niagaraMetadata(provincial, c), r = await get(provincial.url + "/query", { where: "1=1", geometry: `${l.longitude},${l.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "OBJECTID,MUNICIPAL_NAME", returnGeometry: "false", resultRecordCount: "51", orderByFields: "OBJECTID" });
    const a = rows(r.features).map(x => x.attributes as Row);
    if (a.some(x => !x || typeof x !== "object" || Array.isArray(x) || typeof x.OBJECTID !== "number" || !Number.isSafeInteger(x.OBJECTID) || x.OBJECTID <= 0 || typeof x.MUNICIPAL_NAME !== "string")) throw Error("Sudbury invalid provincial boundary record");
    const agrees = !r.exceededTransferLimit && a.length === 1 && cityKey(String(a[0].MUNICIPAL_NAME)) === "greater sudbury";
    return layer(agrees ? "available" : a.length || r.exceededTransferLimit ? "ambiguous" : "no_match", { records: a.slice(0, 2).map(x => ({ recordId: x.OBJECTID, publishedMunicipality: x.MUNICIPAL_NAME })), matchMethod: "licensed_provincial_polygon_intersects_point", scope: "subject_point", screenedPoint: { latitude: l.latitude, longitude: l.longitude, accuracy: l.accuracy, provider: l.provider }, queryCoverageComplete: !r.exceededTransferLimit && a.length < 51, coverageComplete: false, absenceEstablished: false, currentLegalBoundaryVerified: false, parcelIdentityVerified: false }, boundarySource, "One unique complete original Ontario polygon must name Greater Sudbury before City GIS or permit queries. Community aliases do not substitute for polygon containment. The provincial dataset is counted once.", m.sourceUpdatedAt);
  } catch (e) { failure("municipality", e); return layer("unavailable", null, boundarySource, "The original Ontario grant/typed polygon or complete unique named municipality was not verified. No City spatial or permit query was performed."); }
}
export const SUDBURY_STATUS_GUIDANCE = { source: "https://www.greatersudbury.ca/live/building-and-renovating/open-permit-search/", reviewedAt: "2026-10-03", definitions: { Abandoned: "Application deemed abandoned and cancelled by the Chief Building Official.", Canceled: "Application cancelled at the property owner's request.", Completed: "City definition: all mandatory inspections completed and file closed; independently verified subject-unit occupancy remains unestablished.", "Conditionally Closed": "Mandatory inspection requirements have not all been completed.", "Conditional Permit Issued": "Active conditionally issued permit.", "Full Permit Issued": "Active fully issued permit.", Open: "Application not yet a permit, or a migrated file requiring administrative adjustment." } };
function calendarDate(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v + "T00:00:00Z"); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
}
async function query(f: SudburyFeed, l: Location, address: string | null, community: string | null, c: Context): Promise<Layer> {
  const permit = f.key === "permits";
  if (permit && (!address || !streetNumber(address) || hasUnit(address) || !community || !sudburyMarket(community, "ON"))) return layer("skipped", null, f.source, "An exact building civic address and confirmed source community are required. Coordinates do not identify a permit address.");
  try {
    const m = await sudburyMetadata(f, c), cities = communityKey(community ?? "") === "sudbury" ? ["SUDBURY", "GREATER SUDBURY", "CITY OF GREATER SUDBURY"] : [String(community).toUpperCase()];
    const values = permit ? variants(address!).flatMap(a => cities.flatMap(city => ["ON", "ONTARIO"].map(p => `${a}, ${city}, ${p}`))) : [];
    const r = await get(f.url + "/query", { where: permit ? `UPPER(Address) IN (${values.map(literal).join(",")})` : "1=1", ...(!permit ? { geometry: `${l.longitude},${l.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects" } : {}), outFields: Object.keys(f.fields).join(","), returnGeometry: "false", resultRecordCount: "51", orderByFields: f.oid });
    const all = attributes(r, f), exact = all.filter(({ a }) => { if (!permit) return true; const p = text(a.Address)?.split(",").map(s => s.trim()); return Boolean(p?.length === 3 && !hasUnit(p[0]) && civicStreetKey(p[0]) === civicStreetKey(address!) && cities.map(communityKey).includes(communityKey(p[1])) && provinceKey(p[2]) === "ontario"); });
    const truncated = Boolean(r.exceededTransferLimit || all.length > 50), records = exact.slice(0, 50).map(({ a }) => ({ ...mapped(a, f), ...(permit ? { submittedCalendarDate: calendarDate(a.SubmittedDate), issuedCalendarDate: calendarDate(a.IssuedDate), statusMeaning: Object.hasOwn(SUDBURY_STATUS_GUIDANCE.definitions, String(a.RecordStatus)) ? SUDBURY_STATUS_GUIDANCE.definitions[a.RecordStatus as keyof typeof SUDBURY_STATUS_GUIDANCE.definitions] : null, statusInterpretationVerified: Object.hasOwn(SUDBURY_STATUS_GUIDANCE.definitions, String(a.RecordStatus)) } : {}) }));
    const result = layer(records.length ? "available" : "no_match", { records, matchMethod: permit ? "exact_full_civic_address_and_confirmed_community" : "published_polygon_intersects_point", scope: permit ? "building_or_site_address" : "subject_point", spatialScreenPerformed: !permit, screenedPoint: permit ? null : { latitude: l.latitude, longitude: l.longitude, accuracy: l.accuracy, provider: l.provider }, coverageComplete: false, queryCoverageComplete: !truncated, absenceEstablished: false, parcelWideScreenPerformed: false, parcelIdentityVerified: false, unitIdentityVerified: false, sourceGeometryReused: false,
      ...(permit ? { statusGuidance: SUDBURY_STATUS_GUIDANCE, completePermitHistoryVerified: false, formerMunicipalityCrosswalkVerified: false, independentlyVerifiedFinalInspection: false, occupancyEstablished: false, projectMeasuresAreCurrentBuildingFacts: false, groundGrossAreaUnitsVerified: false, estimatedValueCurrencyVerified: false, repeatedFileAmountsAggregated: false } : {}),
      ...(["zoning", "temporaryZoning"].includes(f.key) ? { governingBylaw: "2010-100Z", currentOfficialMapLineageVerified: true, officialMap: SUDBURY_ZONING_MAP.appUrl, currentWrittenProvisionsVerified: false, currentAmendmentsVerified: false, currentAppealsVerified: false, legalPermissionsEstablished: false, ...(f.key === "temporaryZoning" ? { expiryOrExtensionVerified: false } : {}) } : {}),
      ...(f.key === "buildingFootprintReference" ? { originalObservationDate: null, currentFootprintVerified: false, measuredBuildingAreaReturned: false, constructionYearEstablished: false, currentHeritageRegisterVerified: false } : {}),
    }, f.source, f.note + " Feed dataLastEditDate is separate from item/schema edits and individual record events. No-match does not establish absence.", m.sourceUpdatedAt); result.truncated = truncated; return result;
  } catch (e) { failure(f.key, e); return layer("unavailable", null, f.source, "The full City grant, exact curator/publisher/lineage, typed schema or bounded query could not be verified. No factual result is returned."); }
}
export async function sudburyLayers(address: string | null, city: string | null, province: string | null, l: Location | null, requestedCity?: string, research?: SudburyResearch | null): Promise<Record<string, Layer>> {
  if (!sudburyMarket(requestedCity ?? city, province)) return {};
  const c = research?.context ?? new Map(), suitable = precise(l) && sudburyMarket(l.city ?? city, l.province ?? province);
  const municipality = suitable ? await boundary(l, c) : layer("skipped", null, boundarySource, "A suitable independent building/civic point or caller coordinate was not confirmed; approximate, ambiguous and unit locations do not trigger City GIS or permit queries.");
  const agrees = suitable && municipality.status === "available";
  const community = l?.municipalAddress?.source.id === "sudbury:municipalAddresses" ? l.municipalAddress.community : requestedCity && !broadCity(requestedCity) ? requestedCity : cityKey(l?.city ?? "") === "sudbury" ? "Sudbury" : null;
  const entries = await Promise.all(SUDBURY_FEEDS.filter(f => f.key !== "municipalAddresses").map(async f => [f.key, agrees ? await query(f, l!, address, community, c) : layer("skipped", null, f.source, "A suitable point and one complete original Ontario polygon naming Greater Sudbury were not confirmed; no City GIS or permit query was performed.")] as const));
  return { municipality, municipalAddresses: research?.civic ?? layer("skipped", null, feed("municipalAddresses").source, "No civic-address query was requested."), ...Object.fromEntries(entries), ...Object.fromEntries(SUDBURY_WITHHELD.map(g => [g.layer, layer("unavailable", { coverageComplete: false, recordsQueried: false, screenPerformed: false, withheld: g }, null, g.reason)])) };
}
export async function sudburyCoverage() {
  const c: Context = new Map(), datasets = [];
  for (let i = 0; i < SUDBURY_FEEDS.length; i += 4) datasets.push(...await Promise.all(SUDBURY_FEEDS.slice(i, i + 4).map(async f => {
    try { const m = await sudburyMetadata(f, c), r = await get(f.url + "/query", { where: "1=1", returnCountOnly: "true" }), count = r.count as number; if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) throw Error("Sudbury invalid count"); return { market: "Greater Sudbury", layer: f.key, status: "verified", records: count, source: f.source, sourceUpdatedAt: m.sourceUpdatedAt, note: f.note }; }
    catch (e) { failure(f.key, e); return { market: "Greater Sudbury", layer: f.key, status: "unavailable", records: null, source: f.source, note: "Exact full City licence/policy/curation/publisher/lineage, typed child or bounded count could not be verified." }; }
  })));
  return { cities: ["Greater Sudbury", "Sudbury"], auditDate: "2026-10-03", delivery: "cached_live_queries", cacheSeconds: 3600, datasets, withheld: SUDBURY_WITHHELD.map(g => ({ ...g, status: "withheld", records: null })), complete: false, municipalityReference: { source: boundarySource, countIncludedHere: false, countAlreadyIncludedUnder: "Original Ontario municipality dataset in Niagara coverage; count once province-wide." }, guidance: { catalogue: SUDBURY_GRANT.catalogueUrl, permitStatus: SUDBURY_STATUS_GUIDANCE.source, zoning: "https://www.greatersudbury.ca/do-business/zoning/", officialPlan: "https://www.greatersudbury.ca/city-hall/reports-studies-policies-and-plans/official-plan/" }, note: "Eight City-curated permit/civic/reference layers. Native legacy Swagger API is not queried. Full current legal instruments, planning decisions, heritage/ARU and source-protection/conservation remain separate audits. Rows overlap addresses, buildings and repeated historical permit files; not unique properties, field data points or imports." };
}
