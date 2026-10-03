import { createHash } from "node:crypto";
import { load } from "cheerio/slim";
import { fetchJson, literal, rows } from "./http";
import { civicStreetKey, cityKey, hasUnit, layer, number, streetNumber, text, type Layer, type Location, type PropertyRequest, type Row } from "./model";
import { provinceKey } from "./geocode";
import { arcgisDate, streetVariants } from "./hamilton";
import { BRAMPTON_FEEDS, BRAMPTON_GRANT, BRAMPTON_WITHHELD, type BramptonFeed } from "./brampton-sources";

type Context = Map<string, Promise<Row>>;
const normalized = (s: string) => load(s).text().replace(/\s+/g, " ").trim();
const sha = (s: string) => createHash("sha256").update(normalized(s)).digest("hex");
const termsSha = (s: string) => createHash("sha256").update(JSON.stringify({ text: normalized(s), links: load(s)("a").toArray().map(a => load(s)(a).attr("href") ?? "") })).digest("hex");
const feed = (key: string) => BRAMPTON_FEEDS.find(f => f.key === key)!;
const base = "https://www.arcgis.com/sharing/rest/";
export const bramptonMarket = (city: string | null, province: string | null) => cityKey(city ?? "") === "brampton" && provinceKey(province ?? "") === "ontario";
export async function bramptonLocation(input: PropertyRequest): Promise<Layer<Location> | null> {
  const p = input.address?.split(",").map(s => s.trim());
  if (!bramptonMarket(input.city ?? p?.[1] ?? null, input.province ?? p?.[2] ?? "ON")) return null;
  if ((p?.[1] && !bramptonMarket(p[1], "ON")) || (p?.[2] && provinceKey(p[2]) !== "ontario")) return layer("ambiguous", null, feed("municipalAddresses").source, "The explicit municipality/province conflicts with the submitted address. Correct identity before screening.");
  return null; // Generic municipal civic geometry is not a verified building point.
}
async function get(url: string, params: Record<string, string> = {}): Promise<Row> {
  const u = new URL(url); Object.entries({ f: "json", ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  const target = new URL(u.href.replace(/\+/g, "%20"));
  let r = await fetchJson(target) as Row;
  // This public enterprise service intermittently responds with ArcGIS 500
  // for valid read-only queries. Retry once; never retry access restrictions.
  if (target.hostname === "maps1.brampton.ca" && (r?.error as Row | undefined)?.code === 500) r = await fetchJson(target, 8000, 0) as Row;
  if (!r || typeof r !== "object" || Array.isArray(r) || r.error) throw Error("Brampton source unavailable");
  return r;
}
function read(c: Context, url: string): Promise<Row> { const p = c.get(url) ?? get(url); c.set(url, p); return p; }
function failure(f: BramptonFeed, e: unknown) {
  const reason = e instanceof Error ? e.message : "unknown";
  console.warn("Brampton property source unavailable", { feed: f.key, reason: reason.startsWith("Brampton ") || /^Source unavailable \(HTTP \d{3}\)$/.test(reason) ? reason : "bounded_fetch_or_invalid_response" });
}
async function grant(c: Context) {
  const key = "brampton:catalogue", previous = c.get(key); if (previous) return previous;
  const pending = (async () => {
    const b = BRAMPTON_GRANT;
    const [site, data, group] = await Promise.all([read(c, base + "content/items/" + b.site), read(c, base + "content/items/" + b.site + "/data"), read(c, base + "community/groups/" + b.group)]);
    const v = data.values as Row | undefined, scopes = (data.catalogV2 as Row | undefined)?.scopes as Row | undefined;
    const predicates = rows((scopes?.item as Row | undefined)?.filters ?? []).flatMap(f => rows(f.predicates ?? []));
    if (site.id !== b.site || site.type !== b.siteType || site.title !== b.siteTitle || site.url !== b.siteUrl || site.owner !== b.owner || site.orgId !== b.org || site.access !== "public" ||
      v?.defaultHostname !== b.defaultHostname || v?.customHostname !== b.customHostname ||
      !predicates.some(p => Array.isArray(p.group) && p.group.length === b.catalogueGroups.length && b.catalogueGroups.every(g => (p.group as unknown[]).includes(g))) ||
      group.id !== b.group || group.title !== b.groupTitle || group.owner !== b.owner || group.orgId !== b.org || group.access !== "public") throw Error("Brampton official catalogue/publisher binding changed");
    return {};
  })(); c.set(key, pending); return pending;
}
export async function bramptonMetadata(f: BramptonFeed, c: Context = new Map()) {
  const b = BRAMPTON_GRANT, u = new URL(base + "search");
  u.searchParams.set("q", `id:${f.item} AND (${b.catalogueGroups.map(g => `group:${g}`).join(" OR ")})`); u.searchParams.set("num", "10");
  const [item, root, m, curated] = await Promise.all([read(c, base + "content/items/" + f.item), read(c, f.rootUrl), read(c, f.url), read(c, u.href)]);
  const members = rows(curated.results ?? []), children = [...rows(root.layers ?? []), ...rows(root.tables ?? [])];
  // Inspected City GeoHub offers and the planning-parent grant specify CC BY 4.0; the site-wide
  // CC BY-SA licence is not substituted for the datasets' inspected grants.
  if (item.id !== f.item || item.owner !== b.owner || item.orgId !== b.org || item.access !== "public" || item.type !== f.expectedItemType || item.title !== f.expectedItemTitle || item.url !== f.itemUrl ||
    (item.accessInformation ?? null) !== f.expectedAccessInformation || sha(String(item.description ?? "")) !== f.itemDescriptionHash || termsSha(String(item.licenseInfo ?? "")) !== f.termsHash ||
    curated.total !== 1 || members.length !== 1 || members[0].id !== f.item || members[0].owner !== b.owner || (members[0].orgId ?? null) !== null || members[0].access !== "public" || members[0].url !== f.itemUrl ||
    (root.serviceItemId ?? null) !== f.expectedRootServiceItem || !children.some(x => x.id === f.child && x.name === f.expectedLayerName && x.type === f.childType && (x.geometryType ?? null) === f.geometry) ||
    (root.copyrightText ?? "") !== f.expectedRootCopyright || sha(String(root.description ?? "")) !== f.rootDescriptionHash ||
    (m.serviceItemId ?? null) !== f.expectedServiceItem || m.id !== f.child || m.type !== f.childType || m.name !== f.expectedLayerName || (m.geometryType ?? null) !== f.geometry ||
    (m.copyrightText ?? "") !== f.expectedCopyright || sha(String(m.description ?? "")) !== f.descriptionHash || (m.objectIdField !== undefined && m.objectIdField !== f.oid) ||
    !Object.entries(f.fieldTypes).every(([name, type]) => rows(m.fields).some(x => x.name === name && x.type === type))) throw Error("Brampton exact curated item grant, endpoint, lineage or typed child changed");
  if (f.licenceParent) {
    const p = await read(c, base + "content/items/" + f.licenceParent), html = load(String(p.licenseInfo ?? ""));
    if (p.id !== b.planningParent || p.owner !== b.owner || p.orgId !== b.org || p.access !== "public" || p.type !== "Feature Service" || p.title !== b.planningParentTitle || p.url !== b.planningParentUrl ||
      termsSha(String(p.licenseInfo ?? "")) !== b.planningParentTermsHash || html("a").attr("href") !== b.licenceUrl || root.serviceItemId !== b.planningParent || m.serviceItemId !== b.planningParent) throw Error("Brampton complete City planning-parent grant changed");
  }
  await grant(c); return { sourceUpdatedAt: arcgisDate((m.editingInfo as Row | undefined)?.dataLastEditDate) };
}
const inArea = (lat: unknown, lng: unknown) => typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && lat > 43.5 && lat < 43.95 && lng > -80.05 && lng < -79.45;
function precise(l: Location | null): l is Location & { latitude: number; longitude: number } {
  return Boolean(l && inArea(l.latitude, l.longitude) && ["source_building_point", "source_civic_address_point", "caller_supplied"].includes(l.accuracy) && !l.provider.startsWith("brampton:"));
}
function civicMatches(a: Row, address: string): boolean {
  const full = text(a.FULL_ADDRESS), components = `${text(a.CIVIC_NUMBER) ?? ""} ${text(a.STREET_NAME) ?? ""} ${text(a.STREET_TYPE) ?? ""} ${text(a.STREET_DIRECTION) ?? ""}`;
  return Boolean(full && !full.includes(",") && !hasUnit(full) && !text(a.UNIT_NO) && bramptonMarket(text(a.CITY), text(a.PROVINCE)) && civicStreetKey(full) === civicStreetKey(address) && civicStreetKey(components) === civicStreetKey(address) && streetNumber(components)?.toUpperCase() === streetNumber(address)?.toUpperCase());
}
function features(r: Row, f: BramptonFeed): Row[] {
  return rows(r.features).map(x => {
    const a = x.attributes as Row;
    if (!a || typeof a !== "object" || Array.isArray(a) || !Object.entries(f.fieldTypes).every(([k, t]) => {
      if (!(k in a)) return false; const v = a[k];
      return k === f.oid ? typeof v === "number" && Number.isSafeInteger(v) && v > 0 : v === null || (t === "esriFieldTypeString" ? typeof v === "string" : typeof v === "number" && Number.isFinite(v));
    })) throw Error("Brampton invalid typed record");
    return Object.fromEntries(Object.keys(f.fields).map(k => [k, a[k]]));
  });
}
const mapped = (a: Row, f: BramptonFeed) => Object.fromEntries(Object.entries(f.fields).map(([k, v]) => [v, f.dates.includes(k) ? arcgisDate(a[k]) : a[k]]));
function historyMatches(a: Row, f: BramptonFeed, address: string): boolean {
  const value = text(a[f.matchField!]); if (!value) return false;
  const parts = value.split(",").map(s => s.trim());
  if (f.key === "permits") {
    if (parts.length < 3 || parts.length > 4 || !bramptonMarket(parts[1], parts[2]) || (parts[3] && !/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s?\d[ABCEGHJ-NPRSTV-Z]\d$/i.test(parts[3]))) return false;
  } else if (parts.length !== 1) return false;
  return !hasUnit(parts[0]) && civicStreetKey(parts[0]) === civicStreetKey(address);
}
async function query(f: BramptonFeed, l: Location, address: string | null, c: Context, permitLinks?: Map<number, string[]>, civic?: Row): Promise<Layer> {
  if (f.matchField && (!address || hasUnit(address) || !streetNumber(address))) return layer("skipped", null, f.source, "An exact building civic address is required; coordinate-only calls do not search address histories.");
  try {
    const m = await bramptonMetadata(f, c), variants = f.matchField ? streetVariants(civicStreetKey(address!)) : [];
    // A single stem predicate avoids expensive compound LIKE scans on the
    // enterprise view. Every candidate still passes full civic/City checks.
    const stem = `${text(civic?.publishedCivicNumber) ?? ""} ${text(civic?.publishedStreetName) ?? ""}`.toUpperCase();
    const where = f.key === "permits" ? `UPPER(ADDRESS) LIKE ${literal(stem + (text(civic?.publishedStreetType) || text(civic?.publishedStreetDirection) ? " %" : ",%"))}` : f.matchField ? `UPPER(${f.matchField}) IN (${variants.map(literal).join(",")})` : permitLinks ? `FOLDERRSN IN (${[...permitLinks.keys()].join(",")})` : "1=1";
    const r = await get(f.url + "/query", { where,
      ...(!f.matchField && !permitLinks ? { geometry: `${l.longitude},${l.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects" } : {}),
      outFields: Object.keys(f.fields).join(","), returnGeometry: "false", resultRecordCount: "51", orderByFields: f.oid,
    });
    const all = features(r, f); if (!all.length && r.exceededTransferLimit) throw Error("Brampton incomplete empty query");
    if (permitLinks && all.some(a => !Number.isSafeInteger(a.FOLDERRSN) || !permitLinks.has(a.FOLDERRSN as number))) throw Error("Brampton activity returned an unlinked folder identifier");
    const exact = all.filter(a => f.matchField ? f.key === "municipalAddresses" ? civicMatches(a, address!) : historyMatches(a, f, address!) : true);
    const truncated = Boolean(r.exceededTransferLimit || all.length > 50), spatial = !f.matchField && !permitLinks;
    const result = layer(exact.length ? "available" : "no_match", {
      records: exact.slice(0, 50).map(a => ({ ...mapped(a, f), ...(permitLinks ? { matchedPermitNumbers: permitLinks.get(a.FOLDERRSN as number) } : {}) })),
      matchMethod: f.matchField ? "exact_normalized_civic_address" : permitLinks ? "exact_folder_id_from_complete_address_matched_permits" : "published_polygon_intersects_point",
      scope: spatial ? "subject_point" : "building_or_site_address", spatialScreenPerformed: spatial, screenedPoint: spatial ? { latitude: l.latitude, longitude: l.longitude, accuracy: l.accuracy, provider: l.provider } : null,
      coverageComplete: false, queryCoverageComplete: !truncated, absenceEstablished: false, parcelWideScreenPerformed: false, parcelIdentityVerified: false, unitIdentityVerified: false, sourcePointGeometryReused: false,
      ...(f.key === "municipality" ? { currentLegalBoundaryVerified: false } : {}),
      ...(["permits", "permitActivities"].includes(f.key) ? { currentUnitLegalityVerified: false, finalInspectionVerified: false, occupancyVerified: false, completePermitHistoryScreenPerformed: false, currentPermitStatusVerified: false } : {}),
      ...(permitLinks ? { joinedFolderIds: [...permitLinks.keys()], exactPermitIdentityJoinPerformed: true, latestActivitySelectedAsCurrentStatus: false } : {}),
      ...(f.planningApplication ? { currentApprovalVerified: false, currentConditionsVerified: false, currentAppealsVerified: false, legalPermissionsEstablished: false, titleOrSeveranceRegistrationVerified: false } : {}),
      ...(["officialPlanReference", "majorTransitStationArea"].includes(f.key) ? { currentApplicabilityVerified: false, currentLegalInstrumentsVerified: false, currentAmendmentsVerified: false, currentAppealsVerified: false, legalPermissionsEstablished: false, sourceAreaIsSurveyedLotArea: false } : {}),
      ...(f.key === "heritageDetails" ? { currentRegisterVerified: false, buildingAgeEstablished: false, heritageAlterationPermissionEstablished: false } : {}),
      ...(f.key === "ward" ? { currentElectionBoundaryVerified: false, publishedReferenceDate: "2014-12-01" } : {}),
    }, f.source, f.note + " Source item edit dates are metadata; feed currency is unknown when dataLastEditDate is unpublished. No-match does not establish absence.", m.sourceUpdatedAt);
    result.truncated = truncated; return result;
  } catch (e) { failure(f, e); return layer("unavailable", null, f.source, "The inspected grant, exact City curation/publisher/endpoint/lineage, typed schema or complete bounded query could not be verified. No factual result is returned."); }
}
export async function bramptonLayers(address: string | null, city: string | null, province: string | null, l: Location | null, requestedCity?: string): Promise<Record<string, Layer>> {
  if (!bramptonMarket(requestedCity ?? city, province)) return {};
  const c: Context = new Map(), suitable = precise(l) && bramptonMarket(l.city ?? city, l.province ?? province), f = feed("municipality");
  const municipality = suitable ? await query(f, l, null, c) : layer("skipped", null, f.source, "A suitable independent building point or caller-verified Brampton coordinate was not confirmed; City civic geometry is not reused as precise identity.");
  const references = rows((municipality.data as Row | null)?.records ?? []), agrees = suitable && municipality.status === "available" && !municipality.truncated && references.length === 1 && references[0].recordId === 322;
  if (suitable && municipality.status === "available" && !agrees) { municipality.status = "ambiguous"; municipality.note = "No unique licensed City Limit reference was confirmed; no further spatial queries were performed. Current legal boundary remains unverified."; }
  const addressOnly = !suitable && l && ["street_interpolated", "blockface_representative"].includes(l.accuracy) && bramptonMarket(l.city, l.province) && inArea(l.latitude, l.longitude);
  const civic = agrees || addressOnly ? await query(feed("municipalAddresses"), l!, address, c) : layer("skipped", null, feed("municipalAddresses").source, "Independent municipality/identity evidence conflicts or is unusable; no civic query was performed.");
  const civicRows = rows((civic.data as Row | null)?.records ?? []), exactCivic = (agrees || addressOnly) && civic.status === "available" && !civic.truncated && civicRows.length === 1;
  if (civic.status === "available" && !civic.truncated && civicRows.length !== 1) { civic.status = "ambiguous"; civic.note = "Several strict City civic rows match this address; a unique building/site identity was not established and no address histories were searched."; }
  const entries: Record<string, Layer> = { municipality, municipalAddresses: civic };
  const pending = BRAMPTON_FEEDS.filter(f => !["municipality", "municipalAddresses", "permitActivities"].includes(f.key));
  for (let i = 0; i < pending.length; i += 4) for (const [key, value] of await Promise.all(pending.slice(i, i + 4).map(async f => [f.key, (f.matchField ? exactCivic : agrees) ? await query(f, l!, address, c, undefined, civicRows[0]) : layer("skipped", null, f.source, f.matchField ? "A complete unique strict City civic-address match was not confirmed; no address-history query was performed." : "A suitable independent point and unique licensed City Limit reference were not confirmed; no spatial query was performed.")] as const))) entries[key] = value;
  const permits = entries.permits, permitRows = rows((permits.data as Row | null)?.records ?? []), links = new Map<number, string[]>();
  const joinable = permits.status === "available" && !permits.truncated && permitRows.length > 0 && permitRows.every(r => Number.isSafeInteger(r.publishedFolderId) && Number(r.publishedFolderId) > 0 && text(r.publishedPermitNumber));
  if (joinable) for (const r of permitRows) { const id = r.publishedFolderId as number; links.set(id, [...new Set([...(links.get(id) ?? []), r.publishedPermitNumber as string])]); }
  // A reused folder attached to different permit numbers is ambiguous, not a join.
  entries.permitActivities = joinable && [...links.values()].every(v => v.length === 1) ? await query(feed("permitActivities"), l!, null, c, links) : layer("skipped", null, feed("permitActivities").source, "No complete unambiguous exact-address permit set with safe folder identifiers was confirmed; no activity query was performed.");
  return { ...entries, ...Object.fromEntries(BRAMPTON_WITHHELD.map(g => [g.layer, layer("unavailable", { coverageComplete: false, screenPerformed: false, recordsQueried: false, withheld: g }, null, g.reason)])) };
}
export async function bramptonCoverage() {
  const c: Context = new Map(), datasets = [];
  for (let i = 0; i < BRAMPTON_FEEDS.length; i += 4) datasets.push(...await Promise.all(BRAMPTON_FEEDS.slice(i, i + 4).map(async f => {
    try { const m = await bramptonMetadata(f, c), countWhere = ["permits", "permitActivities"].includes(f.key) ? "OBJECTID > 0" : "1=1", r = await get(f.url + "/query", { where: countWhere, returnCountOnly: "true" }), count = number(r.count);
      if (count === null || !Number.isSafeInteger(count) || count < 0) throw Error("Brampton invalid count");
      return { market: "Brampton", layer: f.key, status: "verified", records: count, countWhere, source: f.source, sourceUpdatedAt: m.sourceUpdatedAt, note: f.note };
    } catch (e) { failure(f, e); return { market: "Brampton", layer: f.key, status: "unavailable", records: null, source: f.source, note: "Exact City grant/curation/publisher/endpoint/lineage, typed child or count could not be verified." }; }
  })));
  return { cities: ["Brampton"], auditDate: "2026-10-03", delivery: "cached_live_queries", cacheSeconds: 3600, datasets, withheld: BRAMPTON_WITHHELD.map(g => ({ ...g, status: "withheld", records: null })), complete: false,
    guidance: { catalogue: "https://geohub.brampton.ca", zoning: "https://www.brampton.ca/en/Business/planning-development/zoning/Pages/ZoningOnline.aspx", officialPlan: "https://www.brampton.ca/EN/Business/planning-development/Plans-and-Policies/Pages/Official-Plan.aspx" },
    note: "Fifteen licensed municipal feeds supplement the separate existing registration/heritage snapshots. Permit activities are process observations joined by folder ID, not distinct properties or permits; all row counts overlap and are not bulk imports or unique property/data-point totals. Current dual-zoning, plan/appeal instruments, rental licensing, cadastral/footprint facts and current conservation regulation remain explicit gaps." };
}
