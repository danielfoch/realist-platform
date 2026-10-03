import { createHash } from "node:crypto";
import { load } from "cheerio/slim";
import { fetchBytes, fetchJson, fetchText, literal, rows } from "./http";
import { civicStreetKey, cityKey, hasUnit, layer, streetNumber, text, type Layer, type Location, type PropertyRequest, type Row } from "./model";
import { provinceKey } from "./geocode";
import { arcgisDate, streetVariants } from "./hamilton";
import { NIAGARA_FEEDS } from "./niagara-sources";
import { niagaraMetadata } from "./niagara";
import { CORNWALL_FEEDS, CORNWALL_GRANT, CORNWALL_WITHHELD, CORNWALL_GUIDANCE, type CornwallFeed } from "./cornwall-sources";

type Context = Map<string, Promise<Row>>;
const normalized = (s: string) => load(s).text().replace(/\s+/g, " ").trim();
const sha = (s: string) => createHash("sha256").update(normalized(s)).digest("hex");
const termsSha = (s: string) => createHash("sha256").update(JSON.stringify({ text: normalized(s), links: load(s)("a").toArray().map(a => load(s)(a).attr("href") ?? "") })).digest("hex");
const feed = (key: string) => CORNWALL_FEEDS.find(f => f.key === key)!;
const base = "https://www.arcgis.com/sharing/rest/";
export const cornwallMarket = (city: string | null, province: string | null) => cityKey(city ?? "") === "cornwall" && provinceKey(province ?? "") === "ontario";
export async function cornwallLocation(input: PropertyRequest): Promise<Layer<Location> | null> {
  const p = input.address?.split(",").map(s => s.trim());
  if (!cornwallMarket(input.city ?? p?.[1] ?? null, input.province ?? p?.[2] ?? "ON")) return null;
  if ((p?.[1] && !cornwallMarket(p[1], "ON")) || (p?.[2] && provinceKey(p[2]) !== "ontario")) return layer("ambiguous", null, feed("municipalAddresses").source, "The explicit municipality/province conflicts with the submitted address. Correct identity before screening.");
  return null;
}
async function get(url: string, params: Record<string, string> = {}): Promise<Row> {
  const u = new URL(url); Object.entries({ f: "json", ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetchJson(new URL(u.href.replace(/\+/g, "%20"))) as Row;
  if (!r || typeof r !== "object" || Array.isArray(r) || r.error) throw Error("Cornwall source unavailable");
  return r;
}
function read(c: Context, url: string): Promise<Row> { const p = c.get(url) ?? get(url); c.set(url, p); return p; }
function failure(f: CornwallFeed, e: unknown) {
  const reason = e instanceof Error ? e.message : "unknown";
  console.warn("Cornwall property source unavailable", { feed: f.key, reason: reason.startsWith("Cornwall ") || /^Source unavailable \(HTTP \d{3}\)$/.test(reason) ? reason : "bounded_fetch_or_invalid_response" });
}
function offerRegion(s: string): string {
  const $ = load(s), region = $("main > section").filter((_, e) => $(e).find("h1").text().trim() === "Open Data");
  if (region.length !== 1) throw Error("Cornwall complete official offer changed");
  return region.html() ?? "";
}
async function grant(c: Context) {
  const key = "cornwall:catalogue", previous = c.get(key); if (previous) return previous;
  const pending = (async () => {
    const b = CORNWALL_GRANT;
    const [site, data, group, offer, bytes] = await Promise.all([read(c, base + "content/items/" + b.site), read(c, base + "content/items/" + b.site + "/data"), read(c, base + "community/groups/" + b.group), fetchText(new URL(b.officialOffer)), fetchBytes(new URL(b.licenceUrl))]);
    const v = data.values as Row | undefined, groups = (data.catalog as Row | undefined)?.groups, $ = load(offer);
    // Legacy dataset licence links are 404. The current official City offer binds this exact catalogue to the fully read same-version licence PDF.
    if (site.id !== b.site || site.type !== b.siteType || site.title !== b.siteTitle || site.url !== b.siteUrl || site.owner !== b.siteOwner || site.orgId !== b.org || site.access !== "public" || termsSha(String(site.licenseInfo ?? "")) !== b.siteTermsHash ||
      v?.defaultHostname !== new URL(b.siteUrl).hostname || JSON.stringify(groups) !== JSON.stringify([b.group]) ||
      group.id !== b.group || group.title !== b.groupTitle || group.owner !== b.groupOwner || group.orgId !== b.org || group.access !== "public" || group.isOpenData !== true ||
      termsSha(offerRegion(offer)) !== b.offerHash || createHash("sha256").update(bytes).digest("hex") !== b.licenceHash ||
      !$("a,iframe").toArray().some(a => { const u = $(a).attr("href") ?? $(a).attr("src"); return u?.startsWith(b.siteUrl + "/search?"); }) ||
      !$("a").toArray().some(a => $(a).attr("href") === b.licenceUrl)) throw Error("Cornwall full current grant or exact City catalogue offer changed");
    return {};
  })(); c.set(key, pending); return pending;
}
export async function cornwallMetadata(f: CornwallFeed, c: Context = new Map()) {
  const b = CORNWALL_GRANT, u = new URL(base + "search");
  u.searchParams.set("q", `id:${f.item} AND group:${b.group}`); u.searchParams.set("num", "10");
  const [item, root, m, curated] = await Promise.all([read(c, base + "content/items/" + f.item), read(c, f.rootUrl), read(c, f.url), read(c, u.href)]);
  const members = rows(curated.results ?? []);
  if (item.id !== f.item || item.owner !== b.siteOwner || item.orgId !== b.org || item.access !== "public" || item.type !== f.expectedItemType || item.title !== f.expectedItemTitle || item.url !== f.itemUrl ||
    (item.accessInformation ?? null) !== f.expectedAccessInformation || sha(String(item.description ?? "")) !== f.itemDescriptionHash || termsSha(String(item.licenseInfo ?? "")) !== f.termsHash ||
    curated.total !== 1 || curated.nextStart !== -1 || members.length !== 1 || members[0].id !== f.item || members[0].owner !== b.siteOwner || (members[0].orgId ?? null) !== f.expectedCuratedOrg || members[0].access !== "public" || members[0].type !== f.expectedItemType || members[0].title !== f.expectedItemTitle || members[0].url !== f.itemUrl ||
    !f.rootUrl.startsWith(`https://services2.arcgis.com/${b.org}/arcgis/rest/services/`) || root.serviceItemId !== f.expectedRootServiceItem || !rows(root.layers ?? []).some(x => x.id === f.child && x.name === f.expectedLayerName && x.type === "Feature Layer" && x.geometryType === f.geometry) ||
    (root.copyrightText ?? "") !== f.expectedRootCopyright || sha(String(root.description ?? "")) !== f.rootDescriptionHash ||
    m.serviceItemId !== f.expectedServiceItem || m.id !== f.child || m.type !== "Feature Layer" || m.name !== f.expectedLayerName || m.geometryType !== f.geometry ||
    (m.copyrightText ?? "") !== f.expectedCopyright || sha(String(m.description ?? "")) !== f.descriptionHash || m.objectIdField !== f.oid ||
    !Object.entries(f.fieldTypes).every(([name, type]) => rows(m.fields).some(x => x.name === name && x.type === type)) || createHash("sha256").update(JSON.stringify(Object.keys(f.fields).map(name => ({ name, domain: rows(m.fields).find(x => x.name === name)?.domain ?? null })))).digest("hex") !== f.domainsHash) throw Error("Cornwall exact City curation, publisher, terms, lineage or typed child changed");
  await grant(c); return { sourceUpdatedAt: arcgisDate((m.editingInfo as Row | undefined)?.dataLastEditDate) };
}
const inArea = (lat: unknown, lng: unknown): boolean => typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && lat > 44.95 && lat < 45.12 && lng > -74.95 && lng < -74.5;
function precise(l: Location | null): l is Location & { latitude: number; longitude: number } {
  return Boolean(l && inArea(l.latitude, l.longitude) && ["source_building_point", "source_civic_address_point", "caller_supplied"].includes(l.accuracy) && !l.provider.startsWith("cornwall:"));
}
function civicVariants(address: string): string[] {
  // Include supported AV/CRT aliases; every candidate still needs full component verification.
  return [...new Set(streetVariants(civicStreetKey(address)).flatMap(v => [v, v.replace(/\bAVE\b/g, "AV").replace(/\bCT\b/g, "CRT")]))].slice(0, 128);
}
function civicMatches(a: Row, address: string, f: CornwallFeed): boolean {
  const published = text(a.ADDRESS);
  if (!published || published.includes(",") || hasUnit(published) || civicStreetKey(published) !== civicStreetKey(address)) return false;
  if (f.key === "designatedHeritageReference") return true;
  return cornwallMarket(text(a.CITY), text(a.PROVINCE)) && ["ca", "canada"].includes(text(a.COUNTRY)?.toLowerCase() ?? "") && text(a.ADD_TYPE)?.toUpperCase() === "PRIMARY" &&
    ![a.UNIT, a.FLOOR, a.BUILDING].some(v => text(v)) && String(a.ST_NUMBER) === streetNumber(address) &&
    civicStreetKey(`${a.ST_NUMBER} ${text(a.STREET) ?? ""} ${text(a.SUFFIX) ?? ""} ${text(a.DIRECTION) ?? ""}`) === civicStreetKey(address) &&
    Boolean(text(a.STREET_LNG)) && civicStreetKey(`${a.ST_NUMBER} ${text(a.STREET_LNG)}`) === civicStreetKey(address);
}
function features(r: Row, f: CornwallFeed): Row[] {
  return rows(r.features).map(x => {
    const a = x.attributes as Row;
    if (!a || typeof a !== "object" || Array.isArray(a) || !Object.entries(f.fieldTypes).every(([k, t]) => {
      if (!(k in a)) return false; const v = a[k];
      return k === f.oid ? typeof v === "number" && Number.isSafeInteger(v) && v >= 0 : v === null || (t === "esriFieldTypeString" ? typeof v === "string" : typeof v === "number" && Number.isFinite(v) && (!/Integer$/.test(t) || Number.isSafeInteger(v)));
    })) throw Error("Cornwall invalid typed record");
    return Object.fromEntries(Object.keys(f.fields).map(k => [k, a[k]]));
  });
}
async function query(f: CornwallFeed, l: Location, address: string | null, c: Context): Promise<Layer> {
  if (f.matchField && (!address || hasUnit(address) || !streetNumber(address))) return layer("skipped", null, f.source, "An exact building civic address is required; coordinate-only calls do not search civic attributes.");
  try {
    const m = await cornwallMetadata(f, c), r = await get(f.url + "/query", {
      where: f.matchField ? `UPPER(${f.matchField}) IN (${civicVariants(address!).map(literal).join(",")})` : "1=1",
      ...(!f.matchField ? { geometry: `${l.longitude},${l.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects" } : {}),
      outFields: Object.keys(f.fields).join(","), returnGeometry: "false", resultRecordCount: "51", orderByFields: f.oid,
    });
    const all = features(r, f);
    if (new Set(all.map(a => a[f.oid])).size !== all.length) throw Error("Cornwall duplicate identifiers");
    if (!all.length && r.exceededTransferLimit) throw Error("Cornwall incomplete empty query");
    const exact = all.filter(a => !f.matchField || civicMatches(a, address!, f)), truncated = Boolean(r.exceededTransferLimit || all.length > 50), spatial = !f.matchField;
    const conflictingCivic = f.key === "municipalAddresses" && all.length !== exact.length;
    const unique = !f.matchField || !truncated && !conflictingCivic && exact.length === 1;
    const result = layer(f.matchField && (truncated || conflictingCivic || exact.length > 1) ? "ambiguous" : exact.length ? "available" : "no_match", {
      records: exact.slice(0, 50).map(a => Object.fromEntries(Object.entries(f.fields).map(([k, v]) => [v, f.fieldTypes[k] === "esriFieldTypeDate" ? arcgisDate(a[k]) : a[k]]))),
      matchMethod: spatial ? "published_polygon_intersects_point" : "exact_normalized_civic_address", scope: spatial ? "subject_point" : "building_or_site_address", searchRadiusMeters: null, uniqueCivicMatch: f.matchField ? unique : null, preciseBuildingIdentityEstablished: false,
      spatialScreenPerformed: spatial, screenedPoint: spatial ? { latitude: l.latitude, longitude: l.longitude, accuracy: l.accuracy, provider: l.provider } : null,
      coverageComplete: false, queryCoverageComplete: !truncated, absenceEstablished: false, parcelWideScreenPerformed: false, parcelIdentityVerified: false, unitIdentityVerified: false, sourcePointGeometryReused: false,
      ...(f.key === "catalogueZoningReference" ? { governingBylawVerified: false, currentZoningScreenPerformed: false, currentApplicabilityVerified: false, currentAmendmentsVerified: false, currentAppealsVerified: false, interimControlAreaScreenPerformed: false, legalPermissionsEstablished: false } : {}),
      ...(f.key === "buildingFootprintReference" ? { buildingIdentityEstablished: false, sourceGeometryReused: false, measuredBuildingAreaReturned: false, constructionYearEstablished: false, currentFootprintVerified: false, publishedItemTopographicYear: 2022, publishedServiceTopographicYear: 2017, observationVintageResolved: false } : {}),
      ...(f.key === "officialPlanReference" ? { currentWrittenPoliciesVerified: false, currentApplicabilityVerified: false, currentAmendmentsVerified: false, currentAppealsVerified: false, legalPermissionsEstablished: false } : {}),
      ...(f.key === "designatedHeritageReference" ? { currentHeritageStatusVerified: false, fullCurrentRegisterScreenPerformed: false, designationInstrumentVerified: false } : {}),
    }, f.source, f.note + " Source item/schema edit dates are separate from published dataLastEditDate. No-match does not establish absence.", m.sourceUpdatedAt);
    result.truncated = truncated; return result;
  } catch (e) { failure(f, e); return layer("unavailable", null, f.source, "The full City grant, explicit catalogue offer, exact curation/publisher/endpoint/lineage, typed schema or bounded query could not be verified. No factual result is returned."); }
}
const provincial = NIAGARA_FEEDS.find(f => f.key === "ontarioMunicipality")!;
const boundarySource = { ...provincial.source, id: "cornwall:ontarioMunicipality", name: "Ontario — Cornwall municipal boundary reference" };
async function boundary(l: Location, c: Context): Promise<Layer> {
  try {
    const m = await niagaraMetadata(provincial, c), r = await get(provincial.url + "/query", { where: "1=1", geometry: `${l.longitude},${l.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "OBJECTID,MUNICIPAL_NAME", returnGeometry: "false", resultRecordCount: "51", orderByFields: "OBJECTID" });
    const a = rows(r.features).map(f => f.attributes as Row);
    if (a.some(x => !x || typeof x !== "object" || Array.isArray(x) || typeof x.OBJECTID !== "number" || !Number.isSafeInteger(x.OBJECTID) || x.OBJECTID <= 0 || typeof x.MUNICIPAL_NAME !== "string")) throw Error("Cornwall invalid provincial boundary record");
    const agrees = !r.exceededTransferLimit && a.length === 1 && cityKey(String(a[0].MUNICIPAL_NAME)) === "cornwall";
    const result = layer(agrees ? "available" : a.length || r.exceededTransferLimit ? "ambiguous" : "no_match", { records: a.slice(0, 2).map(x => ({ recordId: x.OBJECTID, publishedMunicipality: x.MUNICIPAL_NAME })), matchMethod: "licensed_provincial_polygon_intersects_point", scope: "subject_point", spatialScreenPerformed: true, queryCoverageComplete: !r.exceededTransferLimit && a.length < 51, coverageComplete: false, absenceEstablished: false, currentLegalBoundaryVerified: false, parcelIdentityVerified: false }, boundarySource, "One unique complete original Ontario polygon must name Cornwall before City spatial queries. Current legal and surveyed property boundaries remain unverified.", m.sourceUpdatedAt);
    result.truncated = Boolean(r.exceededTransferLimit || a.length >= 51); return result;
  } catch (e) { failure(feed("municipalAddresses"), e); return layer("unavailable", null, boundarySource, "The original provincial grant, typed polygon or unique named municipality could not be verified; no City spatial queries were performed."); }
}
export interface CornwallResearch { location: Layer<Location> | null; civic: Layer; context: Context; municipality?: Layer; }
export async function cornwallResearch(input: PropertyRequest): Promise<CornwallResearch | null> {
  const parts = input.address?.split(",").map(s => s.trim());
  if (!cornwallMarket(input.city ?? parts?.[1] ?? null, input.province ?? parts?.[2] ?? "ON")) return null;
  const f = feed("municipalAddresses"), context: Context = new Map();
  const stop = (note: string): CornwallResearch => ({ location: layer("ambiguous", null, f.source, note), civic: layer("ambiguous", null, f.source, note), context });
  if ((parts?.[1] && !cornwallMarket(parts[1], "ON")) || (parts?.[2] && provinceKey(parts[2]) !== "ontario")) return stop("The explicit municipality/province conflicts with the submitted address; correct identity before screening.");
  if (!input.address || input.lat !== undefined) return null;
  if (hasUnit(input.address) || !streetNumber(input.address)) return stop("Supply an exact building civic address. Unit identity is unsupported.");
  try {
    const m = await cornwallMetadata(f, context), r = await get(f.url + "/query", { where: `UPPER(ADDRESS) IN (${civicVariants(input.address).map(literal).join(",")})`, outFields: Object.keys(f.fields).join(","), returnGeometry: "true", outSR: "4326", resultRecordCount: "51", orderByFields: f.oid });
    const all = features(r, f), raw = rows(r.features), truncated = Boolean(r.exceededTransferLimit || all.length > 50);
    if (new Set(all.map(a => a[f.oid])).size !== all.length) throw Error("Cornwall duplicate civic identifiers");
    if (truncated || all.length > 1 || all.some(a => !civicMatches(a, input.address!, f))) return stop("Primary civic evidence is duplicated, incomplete, conflicts in full address components, or has an unresolved unit/floor/building distinction. No City point is selected.");
    if (!all.length) return { location: null, civic: layer("no_match", { records: [], coverageComplete: false, queryCoverageComplete: true, absenceEstablished: false, sourcePointGeometryReused: false, preciseBuildingIdentityEstablished: false }, f.source, "No complete primary City civic record matched. Independent national matching remains separate; no absence is established.", m.sourceUpdatedAt), context };
    const a = all[0], point = raw[0].geometry as Row | undefined, sr = r.spatialReference as Row | undefined;
    if (r.geometryType !== "esriGeometryPoint" || !point || !inArea(point.y, point.x) || sr?.wkid !== 4326 || (sr.latestWkid !== undefined && sr.latestWkid !== 4326)) throw Error("Cornwall source point or coordinate system could not be verified");
    const record = Object.fromEntries(Object.entries(f.fields).map(([k, v]) => [v, f.fieldTypes[k] === "esriFieldTypeDate" ? arcgisDate(a[k]) : a[k]]));
    const l: Location = { address: String(a.ADDRESS), city: "Cornwall", province: "ON", latitude: point.y as number, longitude: point.x as number, accuracy: "source_building_point", provider: f.source.id, municipalAddress: { recordIds: [String(a[f.oid])], community: "Cornwall", permitAddressKeys: [], source: f.source, sourceUpdatedAt: m.sourceUpdatedAt, publishedRecords: [record], publishedAddressRecordCount: 1, publishedRecordsTruncated: false } };
    const municipality = await boundary(l, context);
    if (municipality.status !== "available" || municipality.truncated) return { location: layer("ambiguous", null, f.source, "The unique primary City point could not be confirmed inside one complete licensed Ontario polygon naming Cornwall; no property point is selected."), civic: layer("skipped", null, f.source, "Municipal containment could not be verified."), context };
    const civic = layer("available", { records: [record], matchMethod: "exact_normalized_primary_civic_address", scope: "building_or_site_address", uniqueCivicMatch: true, preciseBuildingIdentityEstablished: false, sourcePointGeometryReused: true, spatialScreenPerformed: false, coverageComplete: false, queryCoverageComplete: true, absenceEstablished: false, unitIdentityVerified: false, parcelIdentityVerified: false, parcelWideScreenPerformed: false }, f.source, "One complete primary civic record matched all components. The licensed City source describes its point as placed over the represented building, and the original Ontario polygon confirms Cornwall. Published source placement is separate from current building condition, units and surveyed identity.", m.sourceUpdatedAt);
    return { location: layer("available", l, f.source, "Strict unique primary City civic point, described by the source as over the represented building, confirmed within the independently licensed Cornwall municipal polygon. Preserve original record/data edit dates; this is not a survey or current legal-unit verification.", m.sourceUpdatedAt), civic, context, municipality };
  } catch (e) { failure(f, e); return { location: null, civic: layer("unavailable", null, f.source, "The full licence, exact City lineage, complete primary civic attributes or source coordinate system could not be verified. Independent national matching remains separate."), context }; }
}
export async function cornwallLayers(address: string | null, city: string | null, province: string | null, l: Location | null, requestedCity?: string, research?: CornwallResearch | null): Promise<Record<string, Layer>> {
  if (!cornwallMarket(requestedCity ?? city, province)) return {};
  const c: Context = research?.context ?? new Map(), verifiedCityPoint = Boolean(research?.location?.status === "available" && research.location.data === l && research.civic.status === "available" && research.municipality?.status === "available" && !research.municipality.truncated);
  const conflict = Boolean(l && (!cornwallMarket(l.city ?? city, l.province ?? province) || l.provider.startsWith("cornwall:") && !verifiedCityPoint)), suitable = !conflict && (precise(l) || verifiedCityPoint);
  const municipality = suitable && l ? verifiedCityPoint ? research!.municipality! : await boundary(l, c) : layer("skipped", null, boundarySource, "A verified primary City point or suitable independent/caller point was not confirmed; no polygon screen was performed.");
  const agrees = suitable && municipality.status === "available" && !municipality.truncated;
  const addressOnly = !conflict && l && ["street_interpolated", "blockface_representative"].includes(l.accuracy) && cornwallMarket(l.city, l.province) && inArea(l.latitude, l.longitude);
  const civic = research?.civic ?? (agrees || addressOnly ? await query(feed("municipalAddresses"), l!, address, c) : layer("skipped", null, feed("municipalAddresses").source, "Independent municipality/identity evidence conflicts or is unusable; no civic query was performed."));
  // Incomplete or duplicate civic evidence must be resolved before property screening.
  const screen = agrees && ["available", "no_match", "skipped"].includes(civic.status);
  const entries: Record<string, Layer> = { municipality, municipalAddresses: civic };
  for (const [key, value] of await Promise.all(CORNWALL_FEEDS.filter(f => f.key !== "municipalAddresses").map(async f => [f.key, screen ? await query(f, l!, f.matchField ? address : null, c) : layer("skipped", null, f.source, "A verified primary City point or suitable independent point, unique named Ontario municipality and non-ambiguous civic evidence were not confirmed; no City reference query was performed.")] as const))) entries[key] = value;
  return { ...entries, ...Object.fromEntries(CORNWALL_WITHHELD.map(g => [g.layer, layer("unavailable", { coverageComplete: false, screenPerformed: false, recordsQueried: false, countsQueried: false, geometryQueried: false, withheld: g }, null, g.reason)])) };
}
export async function cornwallCoverage() {
  const c: Context = new Map(), datasets = [];
  for (let i = 0; i < CORNWALL_FEEDS.length; i += 4) datasets.push(...await Promise.all(CORNWALL_FEEDS.slice(i, i + 4).map(async f => {
    try { const m = await cornwallMetadata(f, c), r = await get(f.url + "/query", { where: "1=1", returnCountOnly: "true" }), count = typeof r.count === "number" ? r.count : null;
      if (count === null || !Number.isSafeInteger(count) || count < 0) throw Error("Cornwall invalid count");
      return { market: "Cornwall", layer: f.key, status: "verified", records: count, source: f.source, sourceUpdatedAt: m.sourceUpdatedAt, note: f.note };
    } catch (e) { failure(f, e); return { market: "Cornwall", layer: f.key, status: "unavailable", records: null, source: f.source, note: "Exact City grant/curation/publisher/endpoint/lineage, typed child or count could not be verified." }; }
  })));
  return { cities: ["Cornwall"], auditDate: "2026-10-03", delivery: "cached_live_queries", cacheSeconds: 3600, datasets, withheld: CORNWALL_WITHHELD.map(g => ({ ...g, status: "withheld", records: null })), complete: false,
    municipalityReference: { source: boundarySource, countIncludedHere: false, countAlreadyIncludedUnder: "original Ontario Municipality dataset in Niagara coverage" },
    guidance: CORNWALL_GUIDANCE,
    note: "Five licensed City civic/reference feeds; original Ontario municipality polygons gate independent point screening and are counted once elsewhere. Current permission, full permit/inspection/occupancy and planning files, full current heritage, legal units, cadastral/title and original authority regulation/source protection/sediment/airport constraints remain incomplete. Footprint item says 2022 while service says 2017; neither establishes present condition. Dataset counts overlap and are not unique properties, field data points or imports." };
}
