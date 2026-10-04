import { createHash } from "node:crypto";
import { load } from "cheerio/slim";
import { fetchBytes, fetchJson, literal, rows } from "./http";
import { civicStreetKey, cityKey, hasUnit, layer, number, streetNumber, text, type Layer, type Location, type PropertyRequest, type Row } from "./model";
import { provinceKey } from "./geocode";
import { arcgisDate, streetVariants } from "./hamilton";
import { WINDSOR_FEEDS, WINDSOR_GRANT, WINDSOR_WITHHELD, type WindsorFeed } from "./windsor-sources";

type Context = Map<string, Promise<Row>>;
const sha = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");
const normalized = (s: string) => load(s).text().replace(/\s+/g, " ").trim();
const feed = (key: string) => WINDSOR_FEEDS.find(f => f.key === key)!;
export function windsorMarket(city: string | null, province: string | null): boolean {
  return cityKey(city ?? "") === "windsor" && provinceKey(province ?? "") === "ontario";
}
export async function windsorLocation(input: PropertyRequest): Promise<Layer<Location> | null> {
  const parts = input.address?.split(",").map(s => s.trim());
  if (!windsorMarket(input.city ?? parts?.[1] ?? null, input.province ?? parts?.[2] ?? "ON")) return null;
  if ((parts?.[1] && !windsorMarket(parts[1], "ON")) || (parts?.[2] && provinceKey(parts[2]) !== "ontario")) {
    return layer("ambiguous", null, feed("addresses").source, "The explicit municipality/province conflicts with the submitted civic address. Correct identity before screening.");
  }
  // Generic City point metadata does not establish a building or GPS position.
  // Continue to the national building-point resolver or caller coordinates.
  return null;
}
async function get(url: string, params: Record<string, string> = {}): Promise<Row> {
  const u = new URL(url);
  Object.entries({ f: "json", ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetchJson(new URL(u.href.replace(/\+/g, "%20"))) as Row;
  if (!r || typeof r !== "object" || Array.isArray(r) || r.error) throw Error("Windsor source unavailable");
  return r;
}
function read(c: Context, url: string): Promise<Row> {
  const p = c.get(url) ?? get(url); c.set(url, p); return p;
}
function sourceFailure(f: WindsorFeed, error: unknown) {
  const reason = error instanceof Error ? error.message : "unknown";
  console.warn("Windsor property source unavailable", { feed: f.key, reason: reason.startsWith("Windsor ") || /^Source unavailable \(HTTP \d{3}\)$/.test(reason) ? reason : "bounded_fetch_or_invalid_response" });
}
async function grant(c: Context): Promise<Row> {
  const key = "windsor:complete-grant", existing = c.get(key); if (existing) return existing;
  const pending = (async () => {
    const b = WINDSOR_GRANT, base = "https://www.arcgis.com/sharing/rest/";
    const [site, siteData, page, pageData, group, bytes] = await Promise.all([
      read(c, base + "content/items/" + b.site), read(c, base + "content/items/" + b.site + "/data"),
      read(c, base + "content/items/" + b.page), read(c, base + "content/items/" + b.page + "/data"),
      read(c, base + "community/groups/" + b.group), fetchBytes(new URL(b.licenceUrl)),
    ]);
    const v = siteData.values as Row | undefined;
    const scopes = (siteData.catalogV2 as Row | undefined)?.scopes as Row | undefined;
    const predicates = rows((scopes?.item as Row | undefined)?.filters ?? []).flatMap(f => rows(f.predicates ?? []));
    if (![site, page].every(i => i.owner === b.owner && (i.orgId ?? null) === null && i.access === "public") ||
      site.id !== b.site || site.type !== "Hub Site Application" || site.title !== b.siteTitle || site.url !== b.siteUrl ||
      page.id !== b.page || page.type !== "Hub Page" || page.title !== b.pageTitle || v?.defaultHostname !== b.defaultHostname ||
      !rows(v.pages ?? []).some(p => p.id === b.page && p.slug === "open-data") ||
      !rows((pageData.values as Row | undefined)?.sites ?? []).some(s => s.id === b.site && s.title === b.siteTitle) ||
      !predicates.some(p => Array.isArray(p.group) && p.group.length === 1 && p.group[0] === b.group) ||
      group.id !== b.group || group.owner !== b.owner || group.title !== b.groupTitle || group.access !== "public" ||
      sha(bytes) !== b.pdfHash) throw Error("Windsor complete licence or City site/page/curation binding changed");
    return {};
  })(); c.set(key, pending); return pending;
}
export async function windsorMetadata(f: WindsorFeed, c: Context = new Map()) {
  const base = "https://www.arcgis.com/sharing/rest/", membership = new URL(base + "search");
  membership.searchParams.set("q", `id:${f.item} AND group:${WINDSOR_GRANT.group}`); membership.searchParams.set("num", "10");
  const [item, root, m, curated] = await Promise.all([read(c, base + "content/items/" + f.item), read(c, f.rootUrl), read(c, f.url), read(c, membership.href)]);
  const terms = typeof item.licenseInfo === "string" ? item.licenseInfo : "", anchors = load(terms)("a"), members = rows(curated.results ?? []);
  if (item.id !== f.item || item.owner !== WINDSOR_GRANT.owner || (item.orgId ?? null) !== null || item.access !== "public" || item.type !== "Feature Service" ||
    item.title !== f.expectedItemTitle || item.url !== f.url || sha(normalized(String(item.description ?? ""))) !== f.itemDescriptionHash ||
    curated.total !== 1 || members.length !== 1 || members[0].id !== f.item || members[0].owner !== WINDSOR_GRANT.owner || members[0].url !== f.url || members[0].access !== "public" ||
    (root.serviceItemId ?? null) !== f.expectedRootServiceItem || !rows(root.layers ?? []).some(x => x.id === f.child && x.name === f.expectedLayerName && x.type === "Feature Layer") ||
    (root.copyrightText ?? "") !== f.expectedRootCopyright || sha(normalized(String(root.description ?? ""))) !== f.rootDescriptionHash ||
    (m.serviceItemId ?? null) !== f.expectedServiceItem || m.id !== f.child || m.type !== "Feature Layer" || m.name !== f.expectedLayerName || m.geometryType !== f.geometry ||
    (m.copyrightText ?? "") !== f.expectedCopyright || sha(normalized(String(m.description ?? ""))) !== f.descriptionHash ||
    (m.objectIdField !== undefined && m.objectIdField !== f.oid) ||
    !Object.entries(f.fieldTypes).every(([name, type]) => rows(m.fields).some(x => x.name === name && x.type === type)) ||
    sha(normalized(terms)) !== f.termsHash || anchors.length !== 1 || anchors.attr("href") !== WINDSOR_GRANT.licenceUrl) {
    throw Error("Windsor exact publisher, curated endpoint, grant referral, lineage or typed child changed");
  }
  await grant(c); return { sourceUpdatedAt: arcgisDate((m.editingInfo as Row | undefined)?.dataLastEditDate) };
}
function precise(l: Location | null): l is Location & { latitude: number; longitude: number } {
  return Boolean(l && typeof l.latitude === "number" && typeof l.longitude === "number" && Number.isFinite(l.latitude) && Number.isFinite(l.longitude) &&
    l.latitude > 42 && l.latitude < 42.6 && l.longitude > -83.3 && l.longitude < -82.6 &&
    ["source_building_point", "source_civic_address_point", "caller_supplied"].includes(l.accuracy) && !l.provider.startsWith("windsor:"));
}
function features(r: Row, f: WindsorFeed): Row[] {
  return rows(r.features).map(x => {
    const a = x.attributes as Row;
    if (!a || typeof a !== "object" || Array.isArray(a) || !Object.entries(f.fieldTypes).every(([k, t]) => {
      if (!(k in a)) return false; const v = a[k];
      return k === f.oid ? typeof v === "number" && Number.isInteger(v) && v > 0 : v === null || (t === "esriFieldTypeString" ? typeof v === "string" : typeof v === "number" && Number.isFinite(v));
    })) throw Error("Windsor invalid typed record");
    return Object.fromEntries(Object.keys(f.fields).map(k => [k, a[k]]));
  });
}
function mapped(a: Row, f: WindsorFeed): Row {
  return Object.fromEntries(Object.entries(f.fields).map(([k, v]) => [v, f.dates.includes(k) ? arcgisDate(a[k]) : a[k]]));
}
function civicMatches(a: Row, address: string): boolean {
  const published = text(a.Address), component = `${text(a.street_address) ?? ""} ${text(a.street_name) ?? ""} ${text(a.street_suffix) ?? ""} ${text(a.street_direction) ?? ""}`;
  return Boolean(published && !published.includes(",") && !hasUnit(published) && !text(a.unit_number) &&
    civicStreetKey(published) === civicStreetKey(address) && civicStreetKey(component) === civicStreetKey(address) &&
    streetNumber(component)?.toUpperCase() === streetNumber(address)?.toUpperCase());
}
async function query(f: WindsorFeed, l: Location, address: string | null, c: Context): Promise<Layer> {
  const byAddress = f.key === "addresses" || Boolean(f.matchField);
  if (byAddress && (!address || hasUnit(address) || !streetNumber(address))) return layer("skipped", null, f.source, "An exact building civic address is required; coordinate-only requests do not search address records.");
  try {
    const m = await windsorMetadata(f, c), field = f.key === "addresses" ? "Address" : f.matchField;
    const r = await get(f.url + "/query", {
      where: byAddress ? `UPPER(${field}) IN (${streetVariants(civicStreetKey(address!)).map(literal).join(",")})` : "1=1",
      ...(!byAddress ? { geometry: `${l.longitude},${l.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects" } : {}),
      outFields: Object.keys(f.fields).join(","), returnGeometry: "false", resultRecordCount: "51", orderByFields: f.oid,
    });
    const all = features(r, f); if (!all.length && r.exceededTransferLimit) throw Error("Windsor incomplete empty query");
    const exact = byAddress ? all.filter(a => f.key === "addresses" ? civicMatches(a, address!) : typeof a[field!] === "string" && !String(a[field!]).includes(",") && !hasUnit(String(a[field!])) && civicStreetKey(String(a[field!])) === civicStreetKey(address!)) : all;
    const truncated = Boolean(r.exceededTransferLimit || all.length > 50);
    const result = layer(exact.length ? "available" : "no_match", {
      records: exact.slice(0, 50).map(a => mapped(a, f)), matchMethod: byAddress ? "exact_normalized_civic_address" : "published_polygon_intersects_point",
      scope: byAddress ? "building_or_site_address" : "subject_point", spatialScreenPerformed: !byAddress,
      screenedPoint: byAddress ? null : { latitude: l.latitude, longitude: l.longitude, accuracy: l.accuracy, provider: l.provider },
      coverageComplete: false, queryCoverageComplete: !truncated, absenceEstablished: false, parcelWideScreenPerformed: false,
      ...(f.key === "addresses" ? { sourcePointGeometryReused: false, cadastralGeometryReused: false, unitIdentityVerified: false, parcelIdentityVerified: false } : {}),
      ...(f.key === "zoningExceptions" ? { baseZoningScreenPerformed: false, annexZoningScreenPerformed: false, fullCurrentZoningScreenPerformed: false, currentApplicabilityVerified: false, currentAmendmentsVerified: false, currentAppealsVerified: false, legalPermissionsEstablished: false } : {}),
      ...(["heritage", "heritageAreas"].includes(f.key) ? { fullHeritageScreenPerformed: false, currentRegisterVerified: false, currentDesignationBylawVerified: false, parcelIdentityVerified: false, ...(f.key === "heritage" ? { sourcePointGeometryReused: false } : { heritageConservationDistrictEstablished: false }) } : {}),
      ...(f.key === "planningDistrict" ? { currentPlanScreenPerformed: false, officialPlanLandUseDesignationEstablished: false, inForcePolicyEstablished: false, legalPermissionsEstablished: false } : {}),
      ...(f.key === "archaeologicalReference" ? { currentPlanScreenPerformed: false, archaeologicalSiteInventoryQueried: false, archaeologicalAssessmentVerified: false, archaeologicalClearanceEstablished: false, parcelWideApplicabilityVerified: false } : {}),
      ...(f.key === "businessImprovement" ? { currentLeviesEstablished: false, currentBenefitsEstablished: false, fundingAvailabilityEstablished: false } : {}),
      ...(f.key === "ward" ? { currentElectionBoundaryVerified: false } : {}),
    }, f.source, f.note + " Feed update time is unknown when editingInfo is unpublished; record edit dates do not establish feed currency. No-match does not establish absence.", m.sourceUpdatedAt);
    result.truncated = truncated; return result;
  } catch (error) {
    sourceFailure(f, error); return layer("unavailable", null, f.source, "The complete inspected grant, exact City curation/publisher/endpoint/lineage, typed schema or bounded query could not be verified. No factual result is returned.");
  }
}
export async function windsorLayers(address: string | null, city: string | null, province: string | null, l: Location | null, requestedCity?: string): Promise<Record<string, Layer>> {
  if (!windsorMarket(requestedCity ?? city, province)) return {};
  const c: Context = new Map(), boundaryFeed = feed("municipality"), suitable = precise(l) && windsorMarket(l.city ?? city, l.province ?? province);
  const municipality = suitable ? await query(boundaryFeed, l, null, c) : layer("skipped", null, boundaryFeed.source, "A suitable independently resolved building point or caller-verified coordinate in Windsor was not confirmed. Municipal address and heritage point geometry are not used as precise identity.");
  const records = rows((municipality.data as Row | null)?.records ?? []);
  const agrees = suitable && municipality.status === "available" && !municipality.truncated && records.length === 1 && windsorMarket(text(records[0].publishedName), "ON");
  if (suitable && municipality.status === "available" && !agrees) {
    municipality.status = "ambiguous"; municipality.note = "No unique matching City of Windsor boundary was confirmed; no further municipal property queries were performed.";
  }
  // Exact City civic attributes can still support address-only evidence when
  // the independent resolver returned an approximate street position.
  const addressOnly = !suitable && l?.accuracy === "street_interpolated" && windsorMarket(l.city, l.province) &&
    typeof l.latitude === "number" && typeof l.longitude === "number" && l.latitude > 42 && l.latitude < 42.6 && l.longitude > -83.3 && l.longitude < -82.6;
  const civic = agrees || addressOnly ? await query(feed("addresses"), l!, address, c) :
    layer("skipped", null, feed("addresses").source, "Independent municipality/identity evidence conflicts or is unusable; no civic query was performed.");
  const heritageAgrees = (agrees || addressOnly) && civic.status === "available" && !civic.truncated;
  const heritage = heritageAgrees ? await query(feed("heritage"), l!, address, c) :
    layer("skipped", null, feed("heritage").source, "A complete strict City civic-address match was not confirmed; no heritage-address query was performed.");
  const pending = WINDSOR_FEEDS.filter(f => !["municipality", "addresses", "heritage"].includes(f.key)), entries: Record<string, Layer> = { municipality, municipalAddresses: civic, heritage };
  for (let i = 0; i < pending.length; i += 4) {
    for (const [key, value] of await Promise.all(pending.slice(i, i + 4).map(async f => [f.key, agrees ? await query(f, l!, address, c) : layer("skipped", null, f.source, "A suitable independently resolved point and one licensed Windsor municipal polygon were not confirmed; no spatial property query was performed.")] as const))) entries[key] = value;
  }
  const gaps = Object.fromEntries(WINDSOR_WITHHELD.map(f => [f.layer, layer("unavailable", { coverageComplete: false, screenPerformed: false, recordsQueried: false, withheld: f }, null, f.reason)]));
  return { ...entries, ...gaps };
}
export async function windsorCoverage() {
  const c: Context = new Map(), datasets = [];
  for (let i = 0; i < WINDSOR_FEEDS.length; i += 4) datasets.push(...await Promise.all(WINDSOR_FEEDS.slice(i, i + 4).map(async f => {
    try {
      const m = await windsorMetadata(f, c), r = await get(f.url + "/query", { where: "1=1", returnCountOnly: "true" }), count = number(r.count);
      if (count === null || !Number.isInteger(count) || count < 0) throw Error("Windsor invalid count");
      return { market: "Windsor", layer: f.key, status: "verified", records: count, source: f.source, sourceUpdatedAt: m.sourceUpdatedAt, note: f.note };
    } catch (error) {
      sourceFailure(f, error); return { market: "Windsor", layer: f.key, status: "unavailable", records: null, source: f.source, note: "Complete grant, exact curated publisher/endpoint/lineage, typed schema or live count could not be verified." };
    }
  })));
  return { cities: ["Windsor"], auditDate: "2026-10-03", delivery: "cached_live_queries", cacheSeconds: 3600, datasets, withheld: WINDSOR_WITHHELD.map(f => ({ ...f, status: "withheld", records: null })), complete: false,
    guidance: { catalogue: WINDSOR_GRANT.siteUrl + "/pages/open-data", zoning: "https://citywindsor.ca/residents/planning/plans-and-community-information/Zoning-By-law", officialPlan: "https://www.citywindsor.ca/residents/planning/plans-and-community-information/windsor-official-plan", conservation: "https://www.essexregionconservation.ca/development-services" },
    note: "Nine licensed City feeds: civic attributes, municipal boundary, Section20 zoning exceptions, exact-address heritage, heritage areas, planning districts, archaeological classification references, BIA and wards. City address-point geometry is not reused as precise identity. Base/annex zoning, adopted plan instruments, full permit/planning/variance history, cadastral and aerial-derived facts, and current ERCA regulatory mapping remain visible gaps. Rows overlap; they are not distinct properties, unique data points or database imports." };
}
