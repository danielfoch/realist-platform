import { createHash } from "node:crypto";
import { load } from "cheerio/slim";
import { fetchJson, fetchText, literal, rows } from "./http";
import { civicStreetKey, cityKey, hasUnit, layer, number, streetNumber, text, type Layer, type Location, type PropertyRequest, type Row } from "./model";
import { provinceKey } from "./geocode";
import { arcgisDate, streetVariants } from "./hamilton";
import { BRANTFORD_FEEDS, BRANTFORD_GRANT, BRANTFORD_WITHHELD, type BrantfordFeed } from "./brantford-sources";

type Context = Map<string, Promise<Row>>;
const normalized = (s: string) => load(s).text().replace(/\s+/g, " ").trim();
const sha = (s: string) => createHash("sha256").update(normalized(s)).digest("hex");
const termsSha = (s: string) => createHash("sha256").update(JSON.stringify({ text: normalized(s), links: load(s)("a").toArray().map(a => load(s)(a).attr("href") ?? "") })).digest("hex");
const feed = (key: string) => BRANTFORD_FEEDS.find(f => f.key === key)!;
const base = "https://www.arcgis.com/sharing/rest/";
export const brantfordMarket = (city: string | null, province: string | null) => cityKey(city ?? "") === "brantford" && provinceKey(province ?? "") === "ontario";
export async function brantfordLocation(input: PropertyRequest): Promise<Layer<Location> | null> {
  const p = input.address?.split(",").map(s => s.trim());
  if (!brantfordMarket(input.city ?? p?.[1] ?? null, input.province ?? p?.[2] ?? "ON")) return null;
  if ((p?.[1] && !brantfordMarket(p[1], "ON")) || (p?.[2] && provinceKey(p[2]) !== "ontario")) return layer("ambiguous", null, feed("municipalAddresses").source, "The explicit municipality/province conflicts with the submitted address. Correct identity before screening.");
  return null;
}
async function get(url: string, params: Record<string, string> = {}): Promise<Row> {
  const u = new URL(url); Object.entries({ f: "json", ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetchJson(new URL(u.href.replace(/\+/g, "%20"))) as Row;
  if (!r || typeof r !== "object" || Array.isArray(r) || r.error) throw Error("Brantford source unavailable");
  return r;
}
function read(c: Context, url: string): Promise<Row> { const p = c.get(url) ?? get(url); c.set(url, p); return p; }
function failure(f: BrantfordFeed, e: unknown) {
  const reason = e instanceof Error ? e.message : "unknown";
  console.warn("Brantford property source unavailable", { feed: f.key, reason: reason.startsWith("Brantford ") || /^Source unavailable \(HTTP \d{3}\)$/.test(reason) ? reason : "bounded_fetch_or_invalid_response" });
}
function markdowns(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(markdowns);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, v]) => key === "markdown" && typeof v === "string" ? [v] : markdowns(v));
}
async function grant(c: Context) {
  const key = "brantford:catalogue", previous = c.get(key); if (previous) return previous;
  const pending = (async () => {
    const b = BRANTFORD_GRANT;
    const [site, data, group, page, pageData, offer] = await Promise.all([read(c, base + "content/items/" + b.site), read(c, base + "content/items/" + b.site + "/data"), read(c, base + "community/groups/" + b.group), read(c, base + "content/items/" + b.page), read(c, base + "content/items/" + b.page + "/data"), fetchText(new URL(b.officialOffer))]);
    const v = data.values as Row | undefined, scopes = (data.catalogV2 as Row | undefined)?.scopes as Row | undefined;
    const predicates = rows((scopes?.item as Row | undefined)?.filters ?? []).flatMap(f => rows(f.predicates ?? []));
    const linked = markdowns(data.layout).some(html => load(html)("a").toArray().some(a => load(html)(a).attr("href") === b.licenceUrl));
    const full = markdowns((pageData.values as Row | undefined)?.layout).filter(html => html.includes("Information Provider grants"));
    const official = load(offer), offered = official("a").toArray().some(a => official(a).attr("href") === b.siteUrl);
    // Public ArcGIS metadata omits orgId for these private member/org profiles.
    // Preserve that absence; exact City page, catalogue, publisher and service IDs bind the offer.
    if (site.id !== b.site || site.type !== "Hub Site Application" || site.title !== b.siteTitle || site.url !== b.siteUrl || site.owner !== b.siteOwner || (site.orgId ?? null) !== b.org || site.access !== "public" ||
      v?.defaultHostname !== b.defaultHostname || v?.customHostname !== "" || !predicates.some(p => { const g = p.group as Row | undefined; return Array.isArray(g?.any) && g.any.length === 1 && g.any[0] === b.group; }) ||
      group.id !== b.group || group.title !== b.groupTitle || group.owner !== b.groupOwner || (group.orgId ?? null) !== null || group.access !== "public" || group.isOpenData !== true ||
      page.id !== b.page || page.title !== b.pageTitle || page.type !== "Hub Page" || page.owner !== b.siteOwner || (page.orgId ?? null) !== null || page.access !== "public" || !linked ||
      full.length !== 1 || sha(full[0]) !== b.fullGrantHash || !offered || !normalized(offer).includes("As per our Open Data Licence available in the footer of the Open Data Portal")) throw Error("Brantford complete grant or explicit City catalogue offer changed");
    return {};
  })(); c.set(key, pending); return pending;
}
export async function brantfordMetadata(f: BrantfordFeed, c: Context = new Map()) {
  const b = BRANTFORD_GRANT, u = new URL(base + "search");
  u.searchParams.set("q", `id:${f.item} AND group:${b.group}`); u.searchParams.set("num", "10");
  const [item, root, m, curated] = await Promise.all([read(c, base + "content/items/" + f.item), read(c, f.rootUrl), read(c, f.url), read(c, u.href)]);
  const members = rows(curated.results ?? []);
  if (item.id !== f.item || item.owner !== b.publisher || (item.orgId ?? null) !== null || item.access !== "public" || item.type !== f.expectedItemType || item.title !== f.expectedItemTitle || item.url !== f.itemUrl ||
    (item.accessInformation ?? null) !== f.expectedAccessInformation || sha(String(item.description ?? "")) !== f.itemDescriptionHash || termsSha(String(item.licenseInfo ?? "")) !== f.termsHash ||
    curated.total !== 1 || members.length !== 1 || members[0].id !== f.item || members[0].owner !== b.publisher || (members[0].orgId ?? null) !== null || members[0].access !== "public" || members[0].url !== f.itemUrl ||
    !f.rootUrl.startsWith(`https://services.arcgis.com/${b.serviceOrg}/arcgis/rest/services/`) || root.serviceItemId !== f.expectedRootServiceItem || !rows(root.layers ?? []).some(x => x.id === f.child && x.name === f.expectedLayerName && x.type === "Feature Layer" && x.geometryType === f.geometry) ||
    (root.copyrightText ?? "") !== f.expectedRootCopyright || sha(String(root.description ?? "")) !== f.rootDescriptionHash ||
    m.serviceItemId !== f.expectedServiceItem || m.id !== f.child || m.type !== "Feature Layer" || m.name !== f.expectedLayerName || m.geometryType !== f.geometry ||
    (m.copyrightText ?? "") !== f.expectedCopyright || sha(String(m.description ?? "")) !== f.descriptionHash || m.objectIdField !== f.oid ||
    !Object.entries(f.fieldTypes).every(([name, type]) => rows(m.fields).some(x => x.name === name && x.type === type))) throw Error("Brantford exact City curation, publisher, terms, lineage or typed child changed");
  await grant(c); return { sourceUpdatedAt: arcgisDate((m.editingInfo as Row | undefined)?.dataLastEditDate) };
}
const inArea = (lat: unknown, lng: unknown): boolean => typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && lat > 42.95 && lat < 43.3 && lng > -80.5 && lng < -80;
function precise(l: Location | null): l is Location & { latitude: number; longitude: number } {
  return Boolean(l && inArea(l.latitude, l.longitude) && ["source_building_point", "source_civic_address_point", "caller_supplied"].includes(l.accuracy) && !l.provider.startsWith("brantford:"));
}
function civicVariants(address: string): string[] {
  // Include supported AV/CRT aliases; every candidate still needs full component verification.
  return [...new Set(streetVariants(civicStreetKey(address)).flatMap(v => [v, v.replace(/\bAVE\b/g, "AV").replace(/\bCT\b/g, "CRT")]))].slice(0, 128);
}
function civicMatches(a: Row, address: string): boolean {
  const p = text(a.FULLADDRESS), n = `${text(a.STREETNUM) ?? ""}${text(a.STNUMSUFF) ?? ""}`, component = `${n} ${text(a.STREETNAME) ?? ""} ${text(a.STREETTYPE) ?? ""}`;
  return Boolean(p && !p.includes(",") && !hasUnit(p) && civicStreetKey(p) === civicStreetKey(address) && civicStreetKey(component) === civicStreetKey(address) && streetNumber(component)?.toUpperCase() === streetNumber(address)?.toUpperCase());
}
function features(r: Row, f: BrantfordFeed): Row[] {
  return rows(r.features).map(x => {
    const a = x.attributes as Row;
    if (!a || typeof a !== "object" || Array.isArray(a) || !Object.entries(f.fieldTypes).every(([k, t]) => {
      if (!(k in a)) return false; const v = a[k];
      return k === f.oid ? typeof v === "number" && Number.isSafeInteger(v) && v > 0 : v === null || (t === "esriFieldTypeString" ? typeof v === "string" : typeof v === "number" && Number.isFinite(v) && (!/Integer$/.test(t) || Number.isSafeInteger(v)));
    })) throw Error("Brantford invalid typed record");
    return Object.fromEntries(Object.keys(f.fields).map(k => [k, a[k]]));
  });
}
async function query(f: BrantfordFeed, l: Location, address: string | null, c: Context): Promise<Layer> {
  if (f.matchField && (!address || hasUnit(address) || !streetNumber(address))) return layer("skipped", null, f.source, "An exact building civic address is required; coordinate-only calls do not search civic attributes.");
  try {
    const m = await brantfordMetadata(f, c), r = await get(f.url + "/query", {
      where: f.matchField ? `UPPER(${f.matchField}) IN (${civicVariants(address!).map(literal).join(",")})` : "1=1",
      ...(!f.matchField ? { geometry: `${l.longitude},${l.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects" } : {}),
      outFields: Object.keys(f.fields).join(","), returnGeometry: "false", resultRecordCount: "51", orderByFields: f.oid,
    });
    const all = features(r, f); if (!all.length && r.exceededTransferLimit) throw Error("Brantford incomplete empty query");
    const exact = all.filter(a => !f.matchField || civicMatches(a, address!)), truncated = Boolean(r.exceededTransferLimit || all.length > 50), spatial = !f.matchField;
    const result = layer(exact.length ? "available" : "no_match", {
      records: exact.slice(0, 50).map(a => Object.fromEntries(Object.entries(f.fields).map(([k, v]) => [v, a[k]]))),
      matchMethod: spatial ? "published_polygon_intersects_point" : "exact_normalized_civic_address", scope: spatial ? "subject_point" : "building_or_site_address",
      spatialScreenPerformed: spatial, screenedPoint: spatial ? { latitude: l.latitude, longitude: l.longitude, accuracy: l.accuracy, provider: l.provider } : null,
      coverageComplete: false, queryCoverageComplete: !truncated, absenceEstablished: false, parcelWideScreenPerformed: false, parcelIdentityVerified: false, unitIdentityVerified: false, sourcePointGeometryReused: false,
      ...(f.key === "municipality" ? { currentLegalBoundaryVerified: false } : {}),
      ...(f.key === "catalogueZoningReference" ? { governingBylawVerified: false, currentZoningScreenPerformed: false, currentApplicabilityVerified: false, currentAmendmentsVerified: false, currentAppealsVerified: false, interimControlAreaScreenPerformed: false, legalPermissionsEstablished: false } : {}),
      ...(f.key === "buildingFootprintReference" ? { buildingIdentityEstablished: false, sourceGeometryReused: false, measuredBuildingAreaReturned: false, constructionYearEstablished: false, currentFootprintVerified: false } : {}),
      ...(f.key === "waterBodyReference" ? { currentFloodplainScreenPerformed: false, currentConservationRegulationScreenPerformed: false, safetyOrInsuranceDeterminationPerformed: false } : {}),
      ...(f.key === "ward" ? { currentElectionBoundaryVerified: false } : {}),
    }, f.source, f.note + " Source item/schema edit dates are separate from published dataLastEditDate. No-match does not establish absence.", m.sourceUpdatedAt);
    result.truncated = truncated; return result;
  } catch (e) { failure(f, e); return layer("unavailable", null, f.source, "The full City grant, explicit catalogue offer, exact curation/publisher/endpoint/lineage, typed schema or bounded query could not be verified. No factual result is returned."); }
}
export async function brantfordLayers(address: string | null, city: string | null, province: string | null, l: Location | null, requestedCity?: string): Promise<Record<string, Layer>> {
  if (!brantfordMarket(requestedCity ?? city, province)) return {};
  const c: Context = new Map(), suitable = precise(l) && brantfordMarket(l.city ?? city, l.province ?? province), f = feed("municipality");
  const municipality = suitable ? await query(f, l, null, c) : layer("skipped", null, f.source, "A suitable independent building point or caller-verified Brantford coordinate was not confirmed; City civic geometry is not reused as precise identity.");
  const r = rows((municipality.data as Row | null)?.records ?? []), agrees = suitable && municipality.status === "available" && !municipality.truncated && r.length === 1 && brantfordMarket(text(r[0].publishedMunicipality), "ON");
  if (suitable && municipality.status === "available" && !agrees) { municipality.status = "ambiguous"; municipality.note = "No unique named City boundary reference was confirmed; no further spatial queries were performed. Current legal/expansion boundaries remain unverified."; }
  const addressOnly = !suitable && l && ["street_interpolated", "blockface_representative"].includes(l.accuracy) && brantfordMarket(l.city, l.province) && inArea(l.latitude, l.longitude);
  const civic = agrees || addressOnly ? await query(feed("municipalAddresses"), l!, address, c) : layer("skipped", null, feed("municipalAddresses").source, "Independent municipality/identity evidence conflicts or is unusable; no civic query was performed.");
  if (civic.status === "available" && !civic.truncated && rows((civic.data as Row | null)?.records ?? []).length !== 1) { civic.status = "ambiguous"; civic.note = "Several strict City civic rows match; a unique building/site identity was not established. No City point geometry is reused."; }
  const entries: Record<string, Layer> = { municipality, municipalAddresses: civic };
  for (const [key, value] of await Promise.all(BRANTFORD_FEEDS.filter(f => !["municipality", "municipalAddresses"].includes(f.key)).map(async f => [f.key, agrees ? await query(f, l!, null, c) : layer("skipped", null, f.source, "A suitable independent point and unique named licensed City boundary were not confirmed; no spatial query was performed.")] as const))) entries[key] = value;
  return { ...entries, ...Object.fromEntries(BRANTFORD_WITHHELD.map(g => [g.layer, layer("unavailable", { coverageComplete: false, screenPerformed: false, recordsQueried: false, withheld: g }, null, g.reason)])) };
}
export async function brantfordCoverage() {
  const c: Context = new Map(), datasets = [];
  for (let i = 0; i < BRANTFORD_FEEDS.length; i += 4) datasets.push(...await Promise.all(BRANTFORD_FEEDS.slice(i, i + 4).map(async f => {
    try { const m = await brantfordMetadata(f, c), r = await get(f.url + "/query", { where: "1=1", returnCountOnly: "true" }), count = number(r.count);
      if (count === null || !Number.isSafeInteger(count) || count < 0) throw Error("Brantford invalid count");
      return { market: "Brantford", layer: f.key, status: "verified", records: count, source: f.source, sourceUpdatedAt: m.sourceUpdatedAt, note: f.note };
    } catch (e) { failure(f, e); return { market: "Brantford", layer: f.key, status: "unavailable", records: null, source: f.source, note: "Exact City grant/curation/publisher/endpoint/lineage, typed child or count could not be verified." }; }
  })));
  return { cities: ["Brantford"], auditDate: "2026-10-03", delivery: "cached_live_queries", cacheSeconds: 3600, datasets, withheld: BRANTFORD_WITHHELD.map(g => ({ ...g, status: "withheld", records: null })), complete: false,
    guidance: { catalogue: BRANTFORD_GRANT.siteUrl, zoning: "https://www.buildbrantford.ca/planning-and-development-services/zoning/", interimControl: "https://www.buildbrantford.ca/planning-and-development-services/zoning/interim-control-by-law-56-2026/", officialPlan: "https://www.buildbrantford.ca/planning-and-development-services/official-plan/" },
    note: "Six licensed City catalogue civic/reference feeds. Catalogue zoning/footprints/water bodies retain older data observation dates despite September2026 item/schema updates. Separate current permit/planning and zoning/ICBL maps are withheld pending grant binding. Rows overlap and are not unique properties, field data points or imports; complete core research remains in progress." };
}
