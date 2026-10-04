import { createHash } from "node:crypto";
import { load } from "cheerio/slim";
import { fetchBytes, fetchJson, rows } from "./http";
import { cityKey, layer, number, type Layer, type Location, type PropertyRequest, type Row } from "./model";
import { provinceKey } from "./geocode";
import { arcgisDate } from "./hamilton";
import { niagaraMetadata } from "./niagara";
import { NIAGARA_FEEDS } from "./niagara-sources";
import { QUINTEWEST_FEEDS, QUINTEWEST_GRANT, QUINTEWEST_WITHHELD, type QuinteWestFeed } from "./quintewest-sources";

type Context = Map<string, Promise<Row>>;
const normalized = (s: string) => load(s).text().replace(/\s+/g, " ").trim();
const sha = (s: string) => createHash("sha256").update(normalized(s)).digest("hex");
const termsSha = (s: string) => createHash("sha256").update(JSON.stringify({ text: normalized(s), links: load(s)("a").toArray().map(a => load(s)(a).attr("href") ?? "") })).digest("hex");
const base = "https://www.arcgis.com/sharing/rest/";
// Community aliases select a candidate market; the licensed provincial polygon must still agree.
export const quinteWestMarket = (city: string | null, province: string | null) => ["quinte west", "trenton", "frankford", "batawa"].includes(cityKey(city ?? "")) && provinceKey(province ?? "") === "ontario";
export async function quinteWestLocation(input: PropertyRequest): Promise<Layer<Location> | null> {
  const p = input.address?.split(",").map(s => s.trim());
  if (!quinteWestMarket(input.city ?? p?.[1] ?? null, input.province ?? p?.[2] ?? "ON")) return null;
  if ((p?.[1] && !quinteWestMarket(p[1], "ON")) || (p?.[2] && provinceKey(p[2]) !== "ontario")) return layer("ambiguous", null, null, "The explicit municipality/province conflicts with the submitted address. Correct identity before screening.");
  return null;
}
async function get(url: string, params: Record<string, string> = {}): Promise<Row> {
  const u = new URL(url); Object.entries({ f: "json", ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetchJson(new URL(u.href.replace(/\+/g, "%20"))) as Row;
  if (!r || typeof r !== "object" || Array.isArray(r) || r.error) throw Error("Quinte West source unavailable");
  return r;
}
function read(c: Context, url: string): Promise<Row> { const p = c.get(url) ?? get(url); c.set(url, p); return p; }
function failure(key: string, e: unknown) {
  const reason = e instanceof Error ? e.message : "unknown";
  console.warn("Quinte West property source unavailable", { feed: key, reason: reason.startsWith("Quinte West ") || /^Source unavailable \(HTTP \d{3}\)$/.test(reason) ? reason : "bounded_fetch_or_invalid_response" });
}
function markdowns(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(markdowns);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, v]) => key === "markdown" && typeof v === "string" ? [v] : markdowns(v));
}
async function grant(c: Context) {
  const key = "quintewest:catalogue", previous = c.get(key); if (previous) return previous;
  const pending = (async () => {
    const b = QUINTEWEST_GRANT;
    const [site, data, group, licence, bytes] = await Promise.all([read(c, base + "content/items/" + b.site), read(c, base + "content/items/" + b.site + "/data"), read(c, base + "community/groups/" + b.group), read(c, base + "content/items/" + b.licenceItem), fetchBytes(new URL(b.licenceUrl), 8000, 3600, b.licenceFileRedirect)]);
    const v = data.values as Row | undefined, offers = markdowns(v?.layout).filter(html => html.includes("The data is provided under the"));
    // This older City portal curates through values.groups. Empty catalogV2 filters are not a grant.
    if (site.id !== b.site || site.type !== b.siteType || site.title !== b.siteTitle || site.url !== b.siteUrl || site.owner !== b.owner || site.orgId !== b.org || site.access !== "public" || termsSha(String(site.licenseInfo ?? "")) !== b.siteTermsHash ||
      v?.defaultHostname !== new URL(b.siteUrl).hostname || JSON.stringify(v?.groups) !== JSON.stringify(b.groups) || offers.length !== 1 || termsSha(offers[0]) !== b.offerHash ||
      group.id !== b.group || group.title !== b.groupTitle || group.owner !== b.owner || group.orgId !== b.org || group.access !== "public" || group.isOpenData !== true ||
      licence.id !== b.licenceItem || licence.title !== "City of Quinte West Open Data Licence" || licence.type !== "PDF" || licence.owner !== b.owner || licence.orgId !== b.org || licence.access !== "public" ||
      createHash("sha256").update(bytes).digest("hex") !== b.licenceHash) throw Error("Quinte West full linked licence or City-curated open portal offer changed");
    return {};
  })(); c.set(key, pending); return pending;
}
export async function quinteWestMetadata(f: QuinteWestFeed, c: Context = new Map()) {
  const b = QUINTEWEST_GRANT, u = new URL(base + "search");
  u.searchParams.set("q", `id:${f.item} AND group:${b.group}`); u.searchParams.set("num", "10");
  const [item, root, m, curated] = await Promise.all([read(c, base + "content/items/" + f.item), read(c, f.rootUrl), read(c, f.url), read(c, u.href)]);
  // Public search omits orgId; exact item metadata independently binds the City organisation.
  const members = rows(curated.results ?? []);
  if (item.id !== f.item || item.owner !== b.owner || (item.orgId ?? null) !== f.expectedOrg || item.access !== "public" || item.type !== f.expectedItemType || item.title !== f.expectedItemTitle || item.url !== f.itemUrl ||
    (item.accessInformation ?? null) !== f.expectedAccessInformation || sha(String(item.description ?? "")) !== f.itemDescriptionHash || termsSha(String(item.licenseInfo ?? "")) !== f.termsHash ||
    curated.total !== 1 || members.length !== 1 || members[0].id !== f.item || members[0].owner !== b.owner || (members[0].orgId ?? null) !== null || members[0].access !== "public" || members[0].url !== f.itemUrl ||
    !f.rootUrl.startsWith(`https://services3.arcgis.com/${b.org}/arcgis/rest/services/`) || root.serviceItemId !== f.expectedRootServiceItem || !rows(root.layers ?? []).some(x => x.id === f.child && x.name === f.expectedLayerName && x.type === "Feature Layer" && x.geometryType === f.geometry) ||
    (root.copyrightText ?? "") !== f.expectedRootCopyright || sha(String(root.description ?? "")) !== f.rootDescriptionHash ||
    m.serviceItemId !== f.expectedServiceItem || m.id !== f.child || m.type !== "Feature Layer" || m.name !== f.expectedLayerName || m.geometryType !== f.geometry ||
    (m.copyrightText ?? "") !== f.expectedCopyright || sha(String(m.description ?? "")) !== f.descriptionHash || m.objectIdField !== f.oid ||
    !Object.entries(f.fieldTypes).every(([name, type]) => rows(m.fields).some(x => x.name === name && x.type === type))) throw Error("Quinte West exact City curation, publisher, terms, lineage or typed child changed");
  await grant(c); return { sourceUpdatedAt: arcgisDate((m.editingInfo as Row | undefined)?.dataLastEditDate) };
}
function precise(l: Location | null): l is Location & { latitude: number; longitude: number } {
  return Boolean(l && typeof l.latitude === "number" && typeof l.longitude === "number" && Number.isFinite(l.latitude) && Number.isFinite(l.longitude) && l.latitude > 43.94 && l.latitude < 44.36 && l.longitude > -77.83 && l.longitude < -77.25 &&
    ["source_building_point", "source_civic_address_point", "caller_supplied"].includes(l.accuracy) && !l.provider.startsWith("quintewest:"));
}
function features(r: Row, f: QuinteWestFeed): Row[] {
  const records = rows(r.features).map(x => {
    const a = x.attributes as Row;
    if (!a || typeof a !== "object" || Array.isArray(a) || !Object.entries(f.fieldTypes).every(([k, t]) => k in a && (k === f.oid ? typeof a[k] === "number" && Number.isSafeInteger(a[k]) && Number(a[k]) > 0 : a[k] === null || (t === "esriFieldTypeString" ? typeof a[k] === "string" : typeof a[k] === "number" && Number.isFinite(a[k]))))) throw Error("Quinte West invalid typed record");
    return Object.fromEntries(Object.entries(f.fields).map(([k, v]) => [v, a[k]]));
  });
  if (new Set(records.map(x => x.recordId)).size !== records.length) throw Error("Quinte West duplicate GIS identifiers");
  return records;
}
const provincial = NIAGARA_FEEDS.find(f => f.key === "ontarioMunicipality")!;
const boundarySource = { ...provincial.source, id: "quintewest:ontarioMunicipality", name: "Ontario — Quinte West municipal boundary reference" };
async function boundary(l: Location, c: Context): Promise<Layer> {
  try {
    const m = await niagaraMetadata(provincial, c), r = await get(provincial.url + "/query", { where: "1=1", geometry: `${l.longitude},${l.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "OBJECTID,MUNICIPAL_NAME", returnGeometry: "false", resultRecordCount: "51", orderByFields: "OBJECTID" });
    const a = rows(r.features).map(f => f.attributes as Row);
    if (a.some(x => !x || typeof x !== "object" || Array.isArray(x) || typeof x.OBJECTID !== "number" || !Number.isSafeInteger(x.OBJECTID) || x.OBJECTID <= 0 || typeof x.MUNICIPAL_NAME !== "string")) throw Error("Quinte West invalid provincial boundary record");
    const agrees = !r.exceededTransferLimit && a.length === 1 && cityKey(String(a[0].MUNICIPAL_NAME)) === "quinte west";
    const result = layer(agrees ? "available" : a.length || r.exceededTransferLimit ? "ambiguous" : "no_match", { records: a.slice(0, 2).map(x => ({ recordId: x.OBJECTID, publishedMunicipality: x.MUNICIPAL_NAME })), matchMethod: "licensed_provincial_polygon_intersects_point", scope: "subject_point", screenedPoint: { latitude: l.latitude, longitude: l.longitude, accuracy: l.accuracy, provider: l.provider }, spatialScreenPerformed: true, queryCoverageComplete: !r.exceededTransferLimit && a.length < 51, coverageComplete: false, absenceEstablished: false, currentLegalBoundaryVerified: false, parcelIdentityVerified: false }, boundarySource, "One unique complete original Ontario municipal polygon must name Quinte West before City reference queries. The City-curated boundary is a polyline and is not used for containment. Current legal boundary and precise property identity remain unverified.", m.sourceUpdatedAt);
    result.truncated = Boolean(r.exceededTransferLimit || a.length >= 51); return result;
  } catch (e) { failure("ontarioMunicipality", e); return layer("unavailable", null, boundarySource, "The original Ontario grant, catalogue, typed polygon or unique named municipality could not be verified. No City spatial queries were performed."); }
}
async function query(f: QuinteWestFeed, l: Location, c: Context): Promise<Layer> {
  try {
    const m = await quinteWestMetadata(f, c), r = await get(f.url + "/query", { where: "1=1", geometry: `${l.longitude},${l.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", ...(f.radiusMeters ? { distance: String(f.radiusMeters), units: "esriSRUnit_Meter" } : {}), outFields: Object.keys(f.fields).join(","), returnGeometry: "false", resultRecordCount: "51", orderByFields: f.oid });
    const all = features(r, f); if (!all.length && r.exceededTransferLimit) throw Error("Quinte West incomplete empty query");
    const truncated = Boolean(r.exceededTransferLimit || all.length > 50);
    const result = layer(all.length ? "available" : "no_match", { records: all.slice(0, 50), matchMethod: f.radiusMeters ? "published_geometry_intersects_search_buffer" : "published_polygon_intersects_point", scope: f.radiusMeters ? "nearby_reference_only" : "subject_point", searchRadiusMeters: f.radiusMeters || null, subjectPropertyRecords: false, spatialScreenPerformed: true, screenedPoint: { latitude: l.latitude, longitude: l.longitude, accuracy: l.accuracy, provider: l.provider }, coverageComplete: false, queryCoverageComplete: !truncated, absenceEstablished: false, parcelWideScreenPerformed: false, parcelIdentityVerified: false, unitIdentityVerified: false, sourceGeometryReused: false,
      ...(f.key === "buildingFootprintReference" ? { buildingIdentityEstablished: false, measuredBuildingAreaReturned: false, constructionYearEstablished: false, currentFootprintVerified: false, originalObservationDate: null } : {}),
      ...(f.key === "stormwaterReference" ? { floodplainScreenPerformed: false, drainagePerformanceEstablished: false, conservationRegulationScreenPerformed: false, safetyOrInsuranceDeterminationPerformed: false } : {}),
      ...(f.key === "nearbySchools" ? { catchmentEstablished: false, enrolmentEstablished: false, performanceRankingPerformed: false } : {}),
    }, f.source, f.note + " Published dataLastEditDate is separate from item/schema edits and does not prove present-day condition. No-match does not establish absence.", m.sourceUpdatedAt);
    result.truncated = truncated; return result;
  } catch (e) { failure(f.key, e); return layer("unavailable", null, f.source, "The full linked City licence, exact curated offer/publisher/endpoint/lineage, typed schema or bounded query could not be verified. No factual result is returned."); }
}
export async function quinteWestLayers(city: string | null, province: string | null, l: Location | null, requestedCity?: string): Promise<Record<string, Layer>> {
  if (!quinteWestMarket(requestedCity ?? city, province)) return {};
  const c: Context = new Map(), suitable = precise(l) && quinteWestMarket(l.city ?? city, l.province ?? province);
  const municipality = suitable ? await boundary(l, c) : layer("skipped", null, boundarySource, "A suitable independent building point or caller-supplied Quinte West coordinate was not confirmed. Street/blockface points do not select footprints or nearby references.");
  const agrees = suitable && municipality.status === "available" && !municipality.truncated;
  const entries = await Promise.all(QUINTEWEST_FEEDS.map(async f => [f.key, agrees ? await query(f, l!, c) : layer("skipped", null, f.source, "A suitable independent point and one complete original Ontario polygon naming Quinte West were not confirmed; no City reference query was performed.")] as const));
  return { municipality, ...Object.fromEntries(entries), ...Object.fromEntries(QUINTEWEST_WITHHELD.map(g => [g.layer, layer("unavailable", { coverageComplete: false, screenPerformed: false, recordsQueried: false, withheld: g }, null, g.reason)])) };
}
export async function quinteWestCoverage() {
  const c: Context = new Map(), datasets = await Promise.all(QUINTEWEST_FEEDS.map(async f => {
    try { const m = await quinteWestMetadata(f, c), r = await get(f.url + "/query", { where: "1=1", returnCountOnly: "true" }), count = number(r.count);
      if (count === null || !Number.isSafeInteger(count) || count < 0) throw Error("Quinte West invalid count");
      return { market: "Quinte West", layer: f.key, status: "verified", records: count, source: f.source, sourceUpdatedAt: m.sourceUpdatedAt, note: f.note };
    } catch (e) { failure(f.key, e); return { market: "Quinte West", layer: f.key, status: "unavailable", records: null, source: f.source, note: "Exact full City licence/curation/publisher/endpoint/lineage, typed child or count could not be verified." }; }
  }));
  return { cities: ["Quinte West", "Trenton", "Frankford", "Batawa"], auditDate: "2026-10-03", delivery: "cached_live_queries", cacheSeconds: 3600, datasets, withheld: QUINTEWEST_WITHHELD.map(g => ({ ...g, status: "withheld", records: null })), complete: false,
    municipalityReference: { source: boundarySource, countIncludedHere: false, countAlreadyIncludedUnder: "Original Ontario municipality dataset in Niagara coverage; count once province-wide." },
    guidance: { catalogue: QUINTEWEST_GRANT.siteUrl, zoning: "https://quintewest.ca/planning-development-business/zoning-bylaw/", officialPlan: "https://quintewest.ca/planning-development-business/official-plan/" },
    note: "Four licensed City-curated property/location reference feeds. Nearby references are not subject-property records. Separate general public GIS is restricted to personal/non-commercial use. Terrain derivation units/datum/originating rights remain unverified. Counted rows overlap and are not unique properties, fields or imports. Current core categories remain incomplete." };
}
