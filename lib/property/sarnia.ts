import { createHash } from "node:crypto";
import { load } from "cheerio/slim";
import { fetchJson, fetchText, literal, rows } from "./http";
import { civicStreetKey, cityKey, hasUnit, layer, streetNumber, text, type Layer, type Location, type PropertyRequest, type Row } from "./model";
import { provinceKey } from "./geocode";
import { arcgisDate, streetVariants } from "./hamilton";
import { NIAGARA_FEEDS } from "./niagara-sources";
import { niagaraMetadata } from "./niagara";
import { SARNIA_FEEDS, SARNIA_GRANT, SARNIA_WITHHELD, type SarniaFeed } from "./sarnia-sources";

type Context = Map<string, Promise<Row>>;
const normalized = (s: string) => load(s).text().replace(/\s+/g, " ").trim();
const sha = (s: string) => createHash("sha256").update(normalized(s)).digest("hex");
const termsSha = (s: string) => createHash("sha256").update(JSON.stringify({ text: normalized(s), links: load(s)("a").toArray().map(a => load(s)(a).attr("href") ?? "") })).digest("hex");
const feed = (key: string) => SARNIA_FEEDS.find(f => f.key === key)!;
const base = "https://www.arcgis.com/sharing/rest/";
export const sarniaMarket = (city: string | null, province: string | null) => cityKey(city ?? "") === "sarnia" && provinceKey(province ?? "") === "ontario";
export async function sarniaLocation(input: PropertyRequest): Promise<Layer<Location> | null> {
  const p = input.address?.split(",").map(s => s.trim());
  if (!sarniaMarket(input.city ?? p?.[1] ?? null, input.province ?? p?.[2] ?? "ON")) return null;
  if ((p?.[1] && !sarniaMarket(p[1], "ON")) || (p?.[2] && provinceKey(p[2]) !== "ontario")) return layer("ambiguous", null, feed("municipalAddresses").source, "The explicit municipality/province conflicts with the submitted address. Correct identity before screening.");
  return null;
}
async function get(url: string, params: Record<string, string> = {}): Promise<Row> {
  const u = new URL(url); Object.entries({ f: "json", ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetchJson(new URL(u.href.replace(/\+/g, "%20"))) as Row;
  if (!r || typeof r !== "object" || Array.isArray(r) || r.error) throw Error("Sarnia source unavailable");
  return r;
}
function read(c: Context, url: string): Promise<Row> { const p = c.get(url) ?? get(url); c.set(url, p); return p; }
function failure(f: SarniaFeed, e: unknown) {
  const reason = e instanceof Error ? e.message : "unknown";
  console.warn("Sarnia property source unavailable", { feed: f.key, reason: reason.startsWith("Sarnia ") || /^Source unavailable \(HTTP \d{3}\)$/.test(reason) ? reason : "bounded_fetch_or_invalid_response" });
}
function markdowns(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(markdowns);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, v]) => key === "markdown" && typeof v === "string" ? [v] : markdowns(v));
}
async function grant(c: Context) {
  const key = "sarnia:catalogue", previous = c.get(key); if (previous) return previous;
  const pending = (async () => {
    const b = SARNIA_GRANT;
    const [site, data, group, page, pageData, offer] = await Promise.all([read(c, base + "content/items/" + b.site), read(c, base + "content/items/" + b.site + "/data"), read(c, base + "community/groups/" + b.group), read(c, base + "content/items/" + b.page), read(c, base + "content/items/" + b.page + "/data"), fetchText(new URL(b.officialOffer))]);
    const v = data.values as Row | undefined, groups = (data.catalog as Row | undefined)?.groups;
    const pages = rows(v?.pages ?? []), parents = rows((pageData.values as Row | undefined)?.sites ?? []);
    const linked = markdowns(v?.layout).some(html => load(html)("a").toArray().some(a => load(html)(a).attr("href") === "/pages/terms-of-use"));
    const full = markdowns((pageData.values as Row | undefined)?.layout).filter(html => html.includes("Information Provider grants"));
    const official = load(offer), offered = official("a").toArray().some(a => official(a).attr("href") === b.siteUrl + "/");
    // Public ArcGIS metadata omits orgId for these private member/org profiles.
    // Preserve that absence; exact City page, catalogue, publisher and service IDs bind the offer.
    if (site.id !== b.site || site.type !== "Hub Site Application" || site.title !== b.siteTitle || site.url !== b.siteUrl || site.owner !== b.siteOwner || (site.orgId ?? null) !== b.org || site.access !== "public" ||
      v?.defaultHostname !== b.defaultHostname || !Array.isArray(groups) || groups.length !== 1 || groups[0] !== b.group || !pages.some(p => p.id === b.page && p.slug === "terms-of-use") || parents.length !== 1 || parents[0].id !== b.site ||
      group.id !== b.group || group.title !== b.groupTitle || group.owner !== b.groupOwner || (group.orgId ?? null) !== null || group.access !== "public" || (group.isOpenData ?? null) !== null ||
      page.id !== b.page || page.title !== b.pageTitle || page.type !== "Hub Page" || page.owner !== b.siteOwner || (page.orgId ?? null) !== null || page.access !== "public" || !linked ||
      full.length !== 1 || termsSha(full[0]) !== b.fullGrantHash || !offered || !normalized(offer).includes("Our Open Data Portal provides up-to-date datasets and interactive maps")) throw Error("Sarnia complete grant or explicit City catalogue offer changed");
    return {};
  })(); c.set(key, pending); return pending;
}
export async function sarniaMetadata(f: SarniaFeed, c: Context = new Map()) {
  const b = SARNIA_GRANT, u = new URL(base + "search");
  u.searchParams.set("q", `id:${f.item} AND group:${b.group}`); u.searchParams.set("num", "10");
  const [item, root, m, curated] = await Promise.all([read(c, base + "content/items/" + f.item), read(c, f.rootUrl), read(c, f.url), read(c, u.href)]);
  const members = rows(curated.results ?? []);
  if (item.id !== f.item || item.owner !== b.publisher || (item.orgId ?? null) !== null || item.access !== "public" || item.type !== f.expectedItemType || item.title !== f.expectedItemTitle || item.url !== f.itemUrl ||
    (item.accessInformation ?? null) !== f.expectedAccessInformation || sha(String(item.description ?? "")) !== f.itemDescriptionHash || termsSha(String(item.licenseInfo ?? "")) !== f.termsHash ||
    curated.total !== 1 || members.length !== 1 || members[0].id !== f.item || members[0].owner !== b.publisher || (members[0].orgId ?? null) !== null || members[0].access !== "public" || members[0].url !== f.itemUrl ||
    !f.rootUrl.startsWith(`https://services1.arcgis.com/${b.serviceOrg}/arcgis/rest/services/`) || root.serviceItemId !== f.expectedRootServiceItem || !rows(root.layers ?? []).some(x => x.id === f.child && x.name === f.expectedLayerName && x.type === "Feature Layer" && x.geometryType === f.geometry) ||
    (root.copyrightText ?? "") !== f.expectedRootCopyright || sha(String(root.description ?? "")) !== f.rootDescriptionHash ||
    m.serviceItemId !== f.expectedServiceItem || m.id !== f.child || m.type !== "Feature Layer" || m.name !== f.expectedLayerName || m.geometryType !== f.geometry ||
    (m.copyrightText ?? "") !== f.expectedCopyright || sha(String(m.description ?? "")) !== f.descriptionHash || m.objectIdField !== f.oid ||
    !Object.entries(f.fieldTypes).every(([name, type]) => rows(m.fields).some(x => x.name === name && x.type === type && (x.domain ?? null) === null))) throw Error("Sarnia exact City curation, publisher, terms, lineage or typed child changed");
  await grant(c); return { sourceUpdatedAt: arcgisDate((m.editingInfo as Row | undefined)?.dataLastEditDate) };
}
const inArea = (lat: unknown, lng: unknown): boolean => typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && lat > 42.85 && lat < 43.15 && lng > -82.5 && lng < -82.1;
function precise(l: Location | null): l is Location & { latitude: number; longitude: number } {
  return Boolean(l && inArea(l.latitude, l.longitude) && ["source_building_point", "source_civic_address_point", "caller_supplied"].includes(l.accuracy) && !l.provider.startsWith("sarnia:"));
}
function civicVariants(address: string): string[] {
  // Include supported AV/CRT aliases; every candidate still needs full component verification.
  return [...new Set(streetVariants(civicStreetKey(address)).flatMap(v => [v, v.replace(/\bAVE\b/g, "AV").replace(/\bCT\b/g, "CRT")]))].slice(0, 128);
}
function civicMatches(a: Row, address: string): boolean {
  const published = text(a.ADDRESS), num = text(a.STNUM), street = text(a.STNAME);
  const types = [text(a.STTYPE), text(a.STTYPE_A)].filter((v): v is string => Boolean(v));
  const directions = [text(a.STDIR), text(a.STDIR_A)].filter((v): v is string => Boolean(v));
  const components = types.flatMap(t => (directions.length ? directions : [""]).map(d => `${num} ${street} ${t} ${d}`));
  return Boolean(published && !published.includes(",") && !hasUnit(published) && num && street && types.length && sarniaMarket(text(a.CITY), "ON") &&
    civicStreetKey(published) === civicStreetKey(address) && num.toUpperCase() === streetNumber(address)?.toUpperCase() && components.every(v => civicStreetKey(v) === civicStreetKey(address)));
}
function features(r: Row, f: SarniaFeed): Row[] {
  return rows(r.features).map(x => {
    const a = x.attributes as Row;
    if (!a || typeof a !== "object" || Array.isArray(a) || !Object.entries(f.fieldTypes).every(([k, t]) => {
      if (!(k in a)) return false; const v = a[k];
      return k === f.oid ? typeof v === "number" && Number.isSafeInteger(v) && v > 0 : v === null || (t === "esriFieldTypeString" ? typeof v === "string" : typeof v === "number" && Number.isFinite(v) && (!/Integer$/.test(t) || Number.isSafeInteger(v)));
    })) throw Error("Sarnia invalid typed record");
    return Object.fromEntries(Object.keys(f.fields).map(k => [k, a[k]]));
  });
}
async function query(f: SarniaFeed, l: Location, address: string | null, c: Context): Promise<Layer> {
  if (f.matchField && (!address || hasUnit(address) || !streetNumber(address))) return layer("skipped", null, f.source, "An exact building civic address is required; coordinate-only calls do not search civic attributes.");
  try {
    const m = await sarniaMetadata(f, c), r = await get(f.url + "/query", {
      where: f.matchField ? `UPPER(${f.matchField}) IN (${civicVariants(address!).map(literal).join(",")})` : "1=1",
      ...(!f.matchField ? { geometry: `${l.longitude},${l.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", ...(f.radiusMeters ? { distance: String(f.radiusMeters), units: "esriSRUnit_Meter" } : {}) } : {}),
      outFields: Object.keys(f.fields).join(","), returnGeometry: "false", resultRecordCount: "51", orderByFields: f.oid,
    });
    const all = features(r, f); if (!all.length && r.exceededTransferLimit) throw Error("Sarnia incomplete empty query");
    const exact = all.filter(a => !f.matchField || civicMatches(a, address!)), truncated = Boolean(r.exceededTransferLimit || all.length > 50), spatial = !f.matchField;
    const unique = !f.matchField || !truncated && exact.length === 1;
    const result = layer(f.matchField && (truncated || exact.length > 1) ? "ambiguous" : exact.length ? "available" : "no_match", {
      records: exact.slice(0, 50).map(a => Object.fromEntries(Object.entries(f.fields).map(([k, v]) => [v, f.fieldTypes[k] === "esriFieldTypeDate" ? arcgisDate(a[k]) : a[k]]))),
      matchMethod: spatial ? f.radiusMeters ? "published_geometry_intersects_search_buffer" : "published_polygon_intersects_point" : "exact_normalized_civic_address", scope: spatial ? f.radiusMeters ? "nearby_reference_only" : "subject_point" : "building_or_site_address", searchRadiusMeters: f.radiusMeters ?? null, ...(f.radiusMeters ? { subjectPropertyRecords: false } : {}), uniqueCivicMatch: f.matchField ? unique : null, preciseBuildingIdentityEstablished: false,
      spatialScreenPerformed: spatial, screenedPoint: spatial ? { latitude: l.latitude, longitude: l.longitude, accuracy: l.accuracy, provider: l.provider } : null,
      coverageComplete: false, queryCoverageComplete: !truncated, absenceEstablished: false, parcelWideScreenPerformed: false, parcelIdentityVerified: false, unitIdentityVerified: false, sourcePointGeometryReused: false,
      ...(f.key === "catalogueZoningReference" ? { governingBylawVerified: false, currentZoningScreenPerformed: false, currentApplicabilityVerified: false, currentAmendmentsVerified: false, currentAppealsVerified: false, interimControlAreaScreenPerformed: false, legalPermissionsEstablished: false } : {}),
      ...(f.key === "buildingFootprintReference" ? { buildingIdentityEstablished: false, sourceGeometryReused: false, measuredBuildingAreaReturned: false, constructionYearEstablished: false, currentFootprintVerified: false } : {}),
      ...(f.key === "developmentChargeAreas" ? { currentFeesVerified: false, exemptionEstablished: false, paymentVerified: false, eligibilityEstablished: false, actualServicingVerified: false, governingBylawVerified: false } : {}),
      ...(f.key === "parkReference" ? { walkingAccessVerified: false, currentAmenitiesVerified: false, nearestFeatureRankingPerformed: false } : {}),
    }, f.source, f.note + " Source item/schema edit dates are separate from published dataLastEditDate. No-match does not establish absence.", m.sourceUpdatedAt);
    result.truncated = truncated; return result;
  } catch (e) { failure(f, e); return layer("unavailable", null, f.source, "The full City grant, explicit catalogue offer, exact curation/publisher/endpoint/lineage, typed schema or bounded query could not be verified. No factual result is returned."); }
}
const provincial = NIAGARA_FEEDS.find(f => f.key === "ontarioMunicipality")!;
const boundarySource = { ...provincial.source, id: "sarnia:ontarioMunicipality", name: "Ontario — Sarnia municipal boundary reference" };
async function boundary(l: Location, c: Context): Promise<Layer> {
  try {
    const m = await niagaraMetadata(provincial, c), r = await get(provincial.url + "/query", { where: "1=1", geometry: `${l.longitude},${l.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "OBJECTID,MUNICIPAL_NAME", returnGeometry: "false", resultRecordCount: "51", orderByFields: "OBJECTID" });
    const a = rows(r.features).map(f => f.attributes as Row);
    if (a.some(x => !x || typeof x !== "object" || Array.isArray(x) || typeof x.OBJECTID !== "number" || !Number.isSafeInteger(x.OBJECTID) || x.OBJECTID <= 0 || typeof x.MUNICIPAL_NAME !== "string")) throw Error("Sarnia invalid provincial boundary record");
    const agrees = !r.exceededTransferLimit && a.length === 1 && cityKey(String(a[0].MUNICIPAL_NAME)) === "sarnia";
    const result = layer(agrees ? "available" : a.length || r.exceededTransferLimit ? "ambiguous" : "no_match", { records: a.slice(0, 2).map(x => ({ recordId: x.OBJECTID, publishedMunicipality: x.MUNICIPAL_NAME })), matchMethod: "licensed_provincial_polygon_intersects_point", scope: "subject_point", spatialScreenPerformed: true, queryCoverageComplete: !r.exceededTransferLimit && a.length < 51, coverageComplete: false, absenceEstablished: false, currentLegalBoundaryVerified: false, parcelIdentityVerified: false }, boundarySource, "One unique complete original Ontario polygon must name Sarnia before City spatial queries. Current legal and surveyed property boundaries remain unverified.", m.sourceUpdatedAt);
    result.truncated = Boolean(r.exceededTransferLimit || a.length >= 51); return result;
  } catch (e) { failure(feed("municipalAddresses"), e); return layer("unavailable", null, boundarySource, "The original provincial grant, typed polygon or unique named municipality could not be verified; no City spatial queries were performed."); }
}
export async function sarniaLayers(address: string | null, city: string | null, province: string | null, l: Location | null, requestedCity?: string): Promise<Record<string, Layer>> {
  if (!sarniaMarket(requestedCity ?? city, province)) return {};
  const c: Context = new Map(), conflict = Boolean(l && (!sarniaMarket(l.city ?? city, l.province ?? province) || l.provider.startsWith("sarnia:"))), suitable = !conflict && precise(l);
  const municipality = suitable ? await boundary(l, c) : layer("skipped", null, boundarySource, "A suitable independent building point or caller-verified Sarnia coordinate was not confirmed; generic City civic geometry is not reused as precise identity.");
  const agrees = suitable && municipality.status === "available" && !municipality.truncated;
  const addressOnly = !conflict && l && ["street_interpolated", "blockface_representative"].includes(l.accuracy) && sarniaMarket(l.city, l.province) && inArea(l.latitude, l.longitude);
  const civic = agrees || addressOnly ? await query(feed("municipalAddresses"), l!, address, c) : layer("skipped", null, feed("municipalAddresses").source, "Independent municipality/identity evidence conflicts or is unusable; no civic query was performed.");
  // Incomplete or duplicate civic evidence must be resolved before property screening.
  const screen = agrees && ["available", "no_match", "skipped"].includes(civic.status);
  const entries: Record<string, Layer> = { municipality, municipalAddresses: civic };
  for (const [key, value] of await Promise.all(SARNIA_FEEDS.filter(f => f.key !== "municipalAddresses").map(async f => [f.key, screen ? await query(f, l!, null, c) : layer("skipped", null, f.source, "A suitable independent point, unique named Ontario municipality and non-ambiguous civic evidence were not confirmed; no City spatial query was performed.")] as const))) entries[key] = value;
  return { ...entries, ...Object.fromEntries(SARNIA_WITHHELD.map(g => [g.layer, layer("unavailable", { coverageComplete: false, screenPerformed: false, recordsQueried: false, withheld: g }, null, g.reason)])) };
}
export async function sarniaCoverage() {
  const c: Context = new Map(), datasets = [];
  for (let i = 0; i < SARNIA_FEEDS.length; i += 4) datasets.push(...await Promise.all(SARNIA_FEEDS.slice(i, i + 4).map(async f => {
    try { const m = await sarniaMetadata(f, c), r = await get(f.url + "/query", { where: "1=1", returnCountOnly: "true" }), count = typeof r.count === "number" ? r.count : null;
      if (count === null || !Number.isSafeInteger(count) || count < 0) throw Error("Sarnia invalid count");
      return { market: "Sarnia", layer: f.key, status: "verified", records: count, source: f.source, sourceUpdatedAt: m.sourceUpdatedAt, note: f.note };
    } catch (e) { failure(f, e); return { market: "Sarnia", layer: f.key, status: "unavailable", records: null, source: f.source, note: "Exact City grant/curation/publisher/endpoint/lineage, typed child or count could not be verified." }; }
  })));
  return { cities: ["Sarnia"], auditDate: "2026-10-03", delivery: "cached_live_queries", cacheSeconds: 3600, datasets, withheld: SARNIA_WITHHELD.map(g => ({ ...g, status: "withheld", records: null })), complete: false,
    municipalityReference: { source: boundarySource, countIncludedHere: false, countAlreadyIncludedUnder: "original Ontario Municipality dataset in Niagara coverage" },
    guidance: { catalogue: SARNIA_GRANT.siteUrl, zoning: "https://www.sarnia.ca/planning-zoning-by-law-document/", zoningReview: "https://www.speakupsarnia.ca/zoning", officialPlan: "https://www.sarnia.ca/official-plan-document/", developmentCharges: "https://www.sarnia.ca/development-charges-guidelines/" },
    note: "Five licensed City catalogue civic/reference feeds. Parks are nearby references within a 1,000-metre buffer; other polygons screen only the independently suitable subject point. Separate permit/planning/current-instrument/heritage/ADU/cadastral and original authority hazard/airport/shoreline/source-protection research remains incomplete. Dataset counts overlap and are not unique properties, field data points or imports. The original Ontario municipality dataset is reused as a gate and counted once elsewhere." };
}
