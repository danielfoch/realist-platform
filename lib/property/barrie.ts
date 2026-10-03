import { createHash } from "node:crypto";
import { load } from "cheerio/slim";
import { haversineMeters } from "@/lib/geo/geometry";
import { fetchBytes, fetchJson, literal, rows } from "./http";
import { civicStreetKey, cityKey, hasUnit, layer, number, streetNumber, text, type Layer, type Location, type PropertyRequest, type Row } from "./model";
import { provinceKey } from "./geocode";
import { arcgisDate, streetVariants } from "./hamilton";
import { BARRIE_FEEDS, BARRIE_GRANT, BARRIE_WITHHELD, type BarrieFeed } from "./barrie-sources";

type Context = Map<string, Promise<Row>>;
const sha = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");
const normalized = (s: string) => load(s).text().replace(/\s+/g, " ").trim();
const feed = (key: string) => BARRIE_FEEDS.find(f => f.key === key)!;
const strings = (v: unknown): string[] => typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];
export const barrieMarket = (city: string | null, province: string | null): boolean => cityKey(city ?? "") === "barrie" && provinceKey(province ?? "") === "ontario";
export async function barrieLocation(input: PropertyRequest): Promise<Layer<Location> | null> {
  const p = input.address?.split(",").map(s => s.trim());
  if (!barrieMarket(input.city ?? p?.[1] ?? null, input.province ?? p?.[2] ?? "ON")) return null;
  if ((p?.[1] && !barrieMarket(p[1], "ON")) || (p?.[2] && provinceKey(p[2]) !== "ontario")) return layer("ambiguous", null, feed("addresses").source, "The explicit municipality/province conflicts with the submitted address. Correct identity before screening.");
  // The City does not publish building/GPS accuracy for this address view.
  return null;
}
async function get(url: string, params: Record<string, string> = {}): Promise<Row> {
  const u = new URL(url); Object.entries({ f: "json", ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetchJson(new URL(u.href.replace(/\+/g, "%20"))) as Row;
  if (!r || typeof r !== "object" || Array.isArray(r) || r.error) throw Error("Barrie source unavailable");
  return r;
}
function read(c: Context, url: string): Promise<Row> { const p = c.get(url) ?? get(url); c.set(url, p); return p; }
function failure(f: BarrieFeed, e: unknown) {
  const reason = e instanceof Error ? e.message : "unknown";
  console.warn("Barrie property source unavailable", { feed: f.key, reason: reason.startsWith("Barrie ") || /^Source unavailable \(HTTP \d{3}\)$/.test(reason) ? reason : "bounded_fetch_or_invalid_response" });
}
async function grant(c: Context): Promise<Row> {
  const key = "barrie:complete-grant", existing = c.get(key); if (existing) return existing;
  const pending = (async () => {
    const b = BARRIE_GRANT, base = "https://www.arcgis.com/sharing/rest/";
    const [site, data, group, bytes] = await Promise.all([read(c, base + "content/items/" + b.site), read(c, base + "content/items/" + b.site + "/data"), read(c, base + "community/groups/" + b.group), fetchBytes(new URL(b.licenceUrl))]);
    const v = data.values as Row | undefined, scopes = (data.catalogV2 as Row | undefined)?.scopes as Row | undefined;
    const predicates = rows((scopes?.item as Row | undefined)?.filters ?? []).flatMap(f => rows(f.predicates ?? []));
    const offers = strings(v?.layout).filter(s => s.includes("By downloading data from this site you are agreeing to the terms of the"));
    const offer = offers[0], anchors = offer ? load(offer)("a").toArray().filter(a => load(offer)(a).attr("href") === b.licenceUrl) : [];
    if (site.id !== b.site || site.type !== "Hub Site Application" || site.title !== b.siteTitle || site.url !== b.siteUrl || site.owner !== b.owner || site.orgId !== b.org || site.access !== "public" ||
      v?.defaultHostname !== b.defaultHostname || v?.customHostname !== b.customHostname ||
      !predicates.some(p => Array.isArray(p.group) && p.group.length === b.catalogueGroups.length && b.catalogueGroups.every(g => (p.group as unknown[]).includes(g))) ||
      group.id !== b.group || group.title !== b.groupTitle || group.owner !== b.owner || group.orgId !== b.org || group.access !== "public" ||
      offers.length !== 1 || anchors.length !== 1 || sha(normalized(offer)) !== b.offerHash || sha(bytes) !== b.pdfHash) throw Error("Barrie complete grant, explicit City offer or catalogue binding changed");
    return {};
  })(); c.set(key, pending); return pending;
}
export async function barrieMetadata(f: BarrieFeed, c: Context = new Map()) {
  const b = BARRIE_GRANT, base = "https://www.arcgis.com/sharing/rest/", u = new URL(base + "search");
  u.searchParams.set("q", `id:${f.item} AND group:${b.group}`); u.searchParams.set("num", "10");
  const [item, root, m, curated] = await Promise.all([read(c, base + "content/items/" + f.item), read(c, f.rootUrl), read(c, f.url), read(c, u.href)]);
  const members = rows(curated.results ?? []);
  if (item.id !== f.item || item.owner !== b.owner || item.orgId !== b.org || item.access !== "public" || item.type !== f.expectedItemType || item.title !== f.expectedItemTitle || item.url !== f.itemUrl ||
    (item.accessInformation ?? null) !== f.expectedAccessInformation || sha(normalized(String(item.description ?? ""))) !== f.itemDescriptionHash || sha(normalized(String(item.licenseInfo ?? ""))) !== f.termsHash ||
    curated.total !== 1 || members.length !== 1 || members[0].id !== f.item || members[0].owner !== b.owner || (members[0].orgId ?? null) !== null || members[0].access !== "public" || members[0].url !== f.itemUrl ||
    (root.serviceItemId ?? null) !== f.expectedRootServiceItem || !rows(root.layers ?? []).some(x => x.id === f.child && x.name === f.expectedLayerName && x.type === "Feature Layer" && x.geometryType === f.geometry) ||
    (root.copyrightText ?? "") !== f.expectedRootCopyright || sha(normalized(String(root.description ?? ""))) !== f.rootDescriptionHash ||
    (m.serviceItemId ?? null) !== f.expectedServiceItem || m.id !== f.child || m.type !== "Feature Layer" || m.name !== f.expectedLayerName || m.geometryType !== f.geometry ||
    (m.copyrightText ?? "") !== f.expectedCopyright || sha(normalized(String(m.description ?? ""))) !== f.descriptionHash || (m.objectIdField !== undefined && m.objectIdField !== f.oid) ||
    !Object.entries(f.fieldTypes).every(([name, type]) => rows(m.fields).some(x => x.name === name && x.type === type))) throw Error("Barrie exact curated publisher, endpoint, item terms, lineage or typed child changed");
  await grant(c); return { sourceUpdatedAt: arcgisDate((m.editingInfo as Row | undefined)?.dataLastEditDate) };
}
const inArea = (lat: unknown, lng: unknown): boolean => typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && lat > 44.15 && lat < 44.6 && lng > -79.95 && lng < -79.4;
function precise(l: Location | null): l is Location & { latitude: number; longitude: number } {
  return Boolean(l && inArea(l.latitude, l.longitude) && ["source_building_point", "source_civic_address_point", "caller_supplied"].includes(l.accuracy) && !l.provider.startsWith("barrie:"));
}
function civicMatches(a: Row, address: string): boolean {
  const p = text(a.FULLADDR), component = `${text(a.ADDRNUMBER) ?? ""} ${text(a.SSTRNAME) ?? ""} ${text(a.SSTRSUFF) ?? ""} ${text(a.SSTRDIR) ?? ""}`;
  return Boolean(a.STATUS === "Current" && p && !p.includes(",") && !hasUnit(p) && !text(a.UNITNUMBER) && civicStreetKey(p) === civicStreetKey(address) && civicStreetKey(component) === civicStreetKey(address) && streetNumber(component)?.toUpperCase() === streetNumber(address)?.toUpperCase());
}
function features(r: Row, f: BarrieFeed): { a: Row; g: Row | null }[] {
  return rows(r.features).map(x => {
    const a = x.attributes as Row;
    if (!a || typeof a !== "object" || Array.isArray(a) || !Object.entries(f.fieldTypes).every(([k, t]) => {
      if (!(k in a)) return false; const v = a[k];
      return k === f.oid ? typeof v === "number" && Number.isInteger(v) && v > 0 : v === null || (t === "esriFieldTypeString" ? typeof v === "string" : typeof v === "number" && Number.isFinite(v));
    })) throw Error("Barrie invalid typed record");
    const g = x.geometry as Row | undefined;
    if (f.nearbyRadiusM && (!g || !inArea(g.y, g.x) || (r.spatialReference as Row | undefined)?.wkid !== 4326)) throw Error("Barrie invalid nearby point coordinates or reference system");
    return { a: Object.fromEntries(Object.keys(f.fields).map(k => [k, a[k]])), g: f.nearbyRadiusM ? g! : null };
  });
}
const mapped = (a: Row, f: BarrieFeed): Row => Object.fromEntries(Object.entries(f.fields).map(([k, v]) => [v, f.dates.includes(k) ? arcgisDate(a[k]) : a[k]]));
async function query(f: BarrieFeed, l: Location, address: string | null, c: Context): Promise<Layer> {
  if (f.matchField && (!address || hasUnit(address) || !streetNumber(address))) return layer("skipped", null, f.source, "An exact building civic address is required; coordinate-only calls do not search address histories.");
  try {
    const m = await barrieMetadata(f, c), r = await get(f.url + "/query", {
      where: f.matchField ? `(${f.where}) AND UPPER(${f.matchField}) IN (${streetVariants(civicStreetKey(address!)).map(literal).join(",")})` : f.where,
      ...(!f.matchField ? { geometry: `${l.longitude},${l.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects" } : {}),
      ...(f.nearbyRadiusM ? { distance: String(f.nearbyRadiusM), units: "esriSRUnit_Meter", outSR: "4326" } : {}),
      outFields: Object.keys(f.fields).join(","), returnGeometry: f.nearbyRadiusM ? "true" : "false", resultRecordCount: "51", orderByFields: f.oid,
    });
    const all = features(r, f); if (!all.length && r.exceededTransferLimit) throw Error("Barrie incomplete empty query");
    const exact = all.filter(({ a, g }) => f.matchField ? f.key === "addresses" ? civicMatches(a, address!) : typeof a[f.matchField] === "string" && !String(a[f.matchField]).includes(",") && !hasUnit(String(a[f.matchField])) && civicStreetKey(String(a[f.matchField])) === civicStreetKey(address!) : f.nearbyRadiusM ? haversineMeters(l.latitude!, l.longitude!, Number(g?.y), Number(g?.x)) <= f.nearbyRadiusM : true);
    const truncated = Boolean(r.exceededTransferLimit || all.length > 50);
    const result = layer(exact.length ? "available" : "no_match", {
      records: exact.slice(0, 50).map(({ a, g }) => ({ ...mapped(a, f), ...(f.nearbyRadiusM ? { distanceM: Math.round(haversineMeters(l.latitude!, l.longitude!, Number(g?.y), Number(g?.x))) } : {}) })),
      matchMethod: f.matchField ? "exact_normalized_civic_address" : f.nearbyRadiusM ? "nearby_published_point" : "published_polygon_intersects_point",
      scope: f.matchField ? "building_or_site_address" : f.nearbyRadiusM ? "nearby_observations_not_subject_property" : "subject_point",
      spatialScreenPerformed: !f.matchField, screenedPoint: f.matchField ? null : { latitude: l.latitude, longitude: l.longitude, accuracy: l.accuracy, provider: l.provider },
      coverageComplete: false, queryCoverageComplete: !truncated, absenceEstablished: false, parcelWideScreenPerformed: false,
      ...(f.matchField ? { sourcePointGeometryReused: false, unitIdentityVerified: false, parcelIdentityVerified: false } : {}),
      ...(f.key === "municipality" ? { currentLegalBoundaryVerified: false, annex2026CoverageVerified: false } : {}),
      ...(f.key === "addresses" ? { cadastralGeometryReused: false } : {}),
      ...(f.nearbyRadiusM ? { radiusM: f.nearbyRadiusM, subjectPropertyAssignmentEstablished: false, distanceBasis: "straight-line distance to published source point with unverified geometry accuracy; not lot-boundary or walking distance" } : {}),
      ...(f.key === "nearbyPermitApplications" ? { exactPropertyApplicationScreenPerformed: false, publishedApplicationFileNumber: null, publishedApplicationAddress: null } : {}),
      ...(f.key === "culturalHeritage" ? { fullHeritageScreenPerformed: false, currentRegisterVerified: false, subjectBuildingConstructionYearEstablished: false } : {}),
      ...(["permits", "additionalUnits"].includes(f.key) ? { currentUnitLegalityVerified: false, finalInspectionVerified: false, occupancyVerified: false, completePermitHistoryScreenPerformed: false } : {}),
      ...(f.key === "planningApplications" ? { currentApprovalVerified: false, currentConditionsVerified: false, currentAppealsVerified: false, proposedUnitTotalsAreCurrentLegalUnitCount: false, legalPermissionsEstablished: false, linkedPlanDocumentsCopied: false } : {}),
      ...(["zoning", "sitePlanControl", "officialPlanReference", "majorTransitStationArea", "specialPolicyArea", "historicNeighbourhood", "urbanGrowthCentre", "builtUpArea", "employmentArea"].includes(f.key) ? { currentApplicabilityVerified: false, currentLegalInstrumentsVerified: false, currentAmendmentsVerified: false, currentAppealsVerified: false, communityPlanningPermitDistrictScreenPerformed: false, legalPermissionsEstablished: false } : {}),
      ...(f.key === "historicNeighbourhood" ? { heritageDesignationEstablished: false } : {}),
      ...(["ward", "futureWard2026"].includes(f.key) ? { currentElectionBoundaryVerified: false, ...(f.key === "futureWard2026" ? { publishedMapLabel: "Wards (Nov 2026)", treatedAsCurrentWard: false } : {}) } : {}),
    }, f.source, f.note + " Feed update time is unknown when editingInfo is unpublished; record edit dates are separate from feed currency. No-match does not establish absence.", m.sourceUpdatedAt);
    result.truncated = truncated; return result;
  } catch (e) { failure(f, e); return layer("unavailable", null, f.source, "The complete inspected grant, explicit City offer, exact curation/publisher/endpoint/lineage, typed schema or bounded query could not be verified. No factual result is returned."); }
}
export async function barrieLayers(address: string | null, city: string | null, province: string | null, l: Location | null, requestedCity?: string): Promise<Record<string, Layer>> {
  if (!barrieMarket(requestedCity ?? city, province)) return {};
  const c: Context = new Map(), suitable = precise(l) && barrieMarket(l.city ?? city, l.province ?? province), f = feed("municipality");
  const municipality = suitable ? await query(f, l, null, c) : layer("skipped", null, f.source, "A suitable independent building point or caller-verified Barrie coordinate was not confirmed; City civic geometry is not used as precise identity.");
  const r = rows((municipality.data as Row | null)?.records ?? []), agrees = suitable && municipality.status === "available" && !municipality.truncated && r.length === 1 && r[0].recordId === 1;
  if (suitable && municipality.status === "available" && !agrees) { municipality.status = "ambiguous"; municipality.note = "No unique licensed City boundary reference was confirmed; no further spatial queries were performed. Current legal/annex boundaries remain unverified."; }
  const addressOnly = !suitable && l && ["street_interpolated", "blockface_representative"].includes(l.accuracy) && barrieMarket(l.city, l.province) && inArea(l.latitude, l.longitude);
  const civic = agrees || addressOnly ? await query(feed("addresses"), l!, address, c) : layer("skipped", null, feed("addresses").source, "Independent municipality/identity evidence conflicts or is unusable; no civic query was performed.");
  const exactCivic = (agrees || addressOnly) && civic.status === "available" && !civic.truncated, entries: Record<string, Layer> = { municipality, municipalAddresses: civic };
  const pending = BARRIE_FEEDS.filter(f => !["municipality", "addresses"].includes(f.key));
  for (let i = 0; i < pending.length; i += 4) for (const [key, value] of await Promise.all(pending.slice(i, i + 4).map(async f => [f.key, (f.matchField ? exactCivic : agrees) ? await query(f, l!, address, c) : layer("skipped", null, f.source, f.matchField ? "A complete strict Current City civic-address match was not confirmed; no address-history query was performed." : "A suitable independent point and unique licensed City boundary reference were not confirmed; no spatial query was performed.")] as const))) entries[key] = value;
  return { ...entries, ...Object.fromEntries(BARRIE_WITHHELD.map(g => [g.layer, layer("unavailable", { coverageComplete: false, screenPerformed: false, recordsQueried: false, withheld: g }, null, g.reason)])) };
}
export async function barrieCoverage() {
  const c: Context = new Map(), datasets = [];
  for (let i = 0; i < BARRIE_FEEDS.length; i += 4) datasets.push(...await Promise.all(BARRIE_FEEDS.slice(i, i + 4).map(async f => {
    try { const m = await barrieMetadata(f, c), r = await get(f.url + "/query", { where: f.where, returnCountOnly: "true" }), count = number(r.count);
      if (count === null || !Number.isInteger(count) || count < 0) throw Error("Barrie invalid count");
      return { market: "Barrie", layer: f.key, status: "verified", records: count, source: f.source, sourceUpdatedAt: m.sourceUpdatedAt, note: f.note };
    } catch (e) { failure(f, e); return { market: "Barrie", layer: f.key, status: "unavailable", records: null, source: f.source, note: "Complete grant, exact City offer/curation/publisher/endpoint/lineage, typed child or count could not be verified." }; }
  })));
  return { cities: ["Barrie"], auditDate: "2026-10-03", delivery: "cached_live_queries", cacheSeconds: 3600, datasets, withheld: BARRIE_WITHHELD.map(g => ({ ...g, status: "withheld", records: null })), complete: false,
    guidance: { catalogue: BARRIE_GRANT.siteUrl, zoning: "https://www.barrie.ca/government/policies-laws/laws-listing/zoning-law", officialPlan: "https://www.barrie.ca/government-news/adopted-strategies-plans/official-plan", allandale: "https://www.barrie.ca/services-payments/permits-licences-applications/community-planning-permit-system-allandale-major-transit-station-area" },
    note: "Eighteen licensed City feeds: civic attributes/boundary reference, active issued permits since2018, nearby active applications without address/file identity, two-unit registrations, published zoning/site-plan-control and planning polygons, plan/strategy references, cultural landmarks and separately labelled wards. City civic geometry is not reused as precise identity. Current legal/annex/CPP boundaries, instruments, full heritage/permit/variance files, cadastral/footprint facts and current conservation regulation remain explicit gaps. Rows overlap and are not distinct properties, permits, field data points or imports." };
}
