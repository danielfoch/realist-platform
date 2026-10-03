import { fetchJson, literal, rows } from "./http";
import { cityKey, civicStreetKey, fold, hasUnit, layer, publishedYear, streetNumber, text, type Layer, type Location, type PropertyRequest, type Row } from "./model";
import { provinceKey } from "./geocode";
import { HAMILTON, validHamiltonItem, type HamiltonFeed } from "./hamilton-sources";
import { loadSnapshot, type LoadedSnapshot } from "./snapshots";
import { haversineMeters } from "@/lib/geo/geometry";

const COMMUNITIES = new Set(["hamilton", "ancaster", "dundas", "flamborough", "glanbrook", "stoney creek", "waterdown"]);
export function isHamilton(city: string | null, province: string | null): boolean { return COMMUNITIES.has(cityKey(city ?? "")) && provinceKey(province ?? "") === "ontario"; }
const validPoint = (lat: unknown, lng: unknown) => typeof lat === "number" && typeof lng === "number" && lat > 43 && lat < 43.6 && lng > -80.5 && lng < -79.5;
const precise = (l: Location | null) => Boolean(l && validPoint(l.latitude, l.longitude) && ["source_building_point", "source_civic_address_point", "caller_supplied"].includes(l.accuracy));
export function arcgisDate(v: unknown): string | null { return typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 8.64e15 ? new Date(v).toISOString() : null; }
async function get(url: string, params: Record<string, string>): Promise<Row> {
  const u = new URL(url); Object.entries({ f: "json", ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetchJson(u) as Row;
  if (!r || r.error) throw new Error("Hamilton query failed"); return r;
}
async function metadata(feed: HamiltonFeed) {
  const [item, m] = await Promise.all([get(`https://www.arcgis.com/sharing/rest/content/items/${feed.item}`, {}), get(feed.url, {})]);
  if (!validHamiltonItem(item, feed) || !feed.fields.every(k => rows(m.fields).some(f => f.name === k))) throw new Error("Hamilton rights/schema changed");
  return { updated: arcgisDate((m.editingInfo as Row | undefined)?.dataLastEditDate), meta: m };
}
function features(r: Row, fields: readonly string[]): Row[] {
  return rows(r.features).map(f => {
    const a = f.attributes as Row;
    if (!a || a.OBJECTID === null || a.OBJECTID === undefined || !fields.every(k => k in a)) throw new Error("Invalid Hamilton feature");
    return { ...Object.fromEntries(fields.map(k => [k, a[k]])), longitude: (f.geometry as Row | null)?.x ?? null, latitude: (f.geometry as Row | null)?.y ?? null };
  });
}
export function streetVariants(address: string): string[] {
  let values = [civicStreetKey(address).toUpperCase()];
  for (const [full, short] of Object.entries({ STREET: "ST", AVENUE: "AVE", ROAD: "RD", DRIVE: "DR", COURT: "CT", CRESCENT: "CRES", BOULEVARD: "BLVD", LANE: "LN", PLACE: "PL", TERRACE: "TERR", NORTH: "N", SOUTH: "S", EAST: "E", WEST: "W", NORTHEAST: "NE", NORTHWEST: "NW", SOUTHEAST: "SE", SOUTHWEST: "SW", SAINT: "ST" })) {
    values = [...new Set([...values, ...values.map(s => s.replace(new RegExp(`\\b${full}\\b`, "g"), short))])].slice(0, 128);
  }
  return values;
}
function streetName(address: string): string {
  return civicStreetKey(address).replace(/^\d+[a-z]?\s+/, "").replace(/\s+(north|south|east|west|northeast|northwest|southeast|southwest)$/, "").replace(/\s+(street|avenue|road|drive|court|crescent|boulevard|lane|place|terrace)$/, "");
}
/** Permit feeds omit street types. Accept a shortened key only when the municipal register resolves it uniquely. */
export function permitKeys(address: string, candidates: Row[], community: string): string[] {
  const target = candidates.filter(r => cityKey(String(r.COMMUNITY)) === cityKey(community) && civicStreetKey(`${r.NUMBER_COMPLETE} ${r.FULL_STREET_NAME}`) === civicStreetKey(address));
  const keys = new Set([civicStreetKey(address)]);
  for (const r of target) {
    for (const direction of [text(r.STREET_SUFFIX_DIRECTION), null]) {
      const candidate = [r.NUMBER_COMPLETE, r.STREET_NAME, direction].filter(Boolean).join(" ");
      const same = candidates.filter(x => cityKey(String(x.COMMUNITY)) === cityKey(community) && civicStreetKey([x.NUMBER_COMPLETE, x.STREET_NAME, direction ? x.STREET_SUFFIX_DIRECTION : null].filter(Boolean).join(" ")) === civicStreetKey(candidate));
      const streets = new Set(same.map(x => civicStreetKey(`${x.NUMBER_COMPLETE} ${x.FULL_STREET_NAME}`)));
      if (streets.size === 1 && streets.has(civicStreetKey(address))) keys.add(civicStreetKey(candidate));
    }
  }
  return [...keys];
}
export async function hamiltonLocation(input: PropertyRequest): Promise<Layer<Location> | null> {
  const city = input.city ?? input.address?.split(",")[1]?.trim() ?? null;
  const province = input.province ?? input.address?.split(",")[2]?.trim() ?? "ON";
  if (!isHamilton(city, province) || !input.address || input.lat !== undefined) return null;
  const address = input.address.split(",")[0].trim(), civic = streetNumber(address);
  if (!civic || hasUnit(address)) return null;
  const feed = HAMILTON.addresses;
  try {
    const m = await metadata(feed);
    const where = `UPPER(NUMBER_COMPLETE) = ${literal(civic.toUpperCase())} AND UPPER(STREET_NAME) IN (${streetVariants(streetName(address)).map(literal).join(",")})`;
    const result = await get(feed.url + "/query", { where, outFields: feed.fields.join(","), returnGeometry: "true", outSR: "4326", resultRecordCount: "501" });
    if (result.exceededTransferLimit) throw new Error("Address candidates incomplete");
    const candidates = features(result, feed.fields); if (candidates.length >= 501) throw new Error("Address bound exceeded");
    const exact = candidates.filter(r => civicStreetKey(`${r.NUMBER_COMPLETE} ${r.FULL_STREET_NAME}`) === civicStreetKey(address) && cityKey(String(r.MUNICIPALITY)) === "hamilton" && provinceKey(String(r.PROVINCE)) === "ontario" && ["canada", "ca"].includes(fold(String(r.COUNTRY))) && (cityKey(city!) === "hamilton" || cityKey(String(r.COMMUNITY)) === cityKey(city!) || cityKey(city!) === "waterdown" && cityKey(String(r.COMMUNITY)) === "flamborough"));
    if (!exact.length) return null;
    const communities = new Set(exact.map(r => cityKey(String(r.COMMUNITY))));
    if (communities.size !== 1 || exact.some(r => !validPoint(r.latitude, r.longitude))) return layer("ambiguous", null, feed.source, "The municipal register did not resolve one community and usable address point.", m.updated);
    const primary = exact.find(r => !text(r.UNIT_NUMBER_COMPLETE)) ?? exact[0];
    if (exact.some(r => haversineMeters(Number(primary.latitude), Number(primary.longitude), Number(r.latitude), Number(r.longitude)) > 20)) return layer("ambiguous", null, feed.source, "Multiple civic-address points span more than 20 metres; provide verified coordinates.", m.updated);
    const community = text(primary.COMMUNITY);
    return layer("available", { address: `${primary.NUMBER_COMPLETE} ${primary.FULL_STREET_NAME}`, city: "Hamilton", province: "ON", latitude: Number(primary.latitude), longitude: Number(primary.longitude), accuracy: "source_civic_address_point", provider: "hamilton:municipal-addresses", municipalAddress: { recordIds: exact.map(r => String(r.OBJECTID)), community, permitAddressKeys: permitKeys(address, candidates, community!), source: feed.source, sourceUpdatedAt: m.updated } }, feed.source, "Published municipal civic-address point, not a surveyed boundary or verified building centroid. Unit records are grouped only for building-level research; former-community and street-direction ambiguity is checked.", m.updated);
  } catch { return null; }
}
function dated(status: Layer["status"], data: unknown, feed: HamiltonFeed, s: LoadedSnapshot, note: string): Layer {
  const result = layer(status, data, feed.source, `${note} Snapshot ${s.retrievedAt}; ${s.delivery}.`, s.sourceUpdatedAt); result.retrievedAt = s.retrievedAt; return result;
}
export function heritageMeaning(status: unknown): string {
  return ({ inventoried: "inventoried_not_a_designation", "registered non-designated": "registered_non_designated", designated: "designated_read_part_iv_and_part_v" } as Record<string, string>)[fold(String(status ?? ""))] ?? "unknown";
}
export async function hamiltonHeritage(address: string | null, location: Location | null, requestedCity: string | null = null): Promise<Layer> {
  const feed = HAMILTON.heritage;
  if (!address) return layer("skipped", null, feed.source);
  const s = await loadSnapshot("hamilton-heritage"); if (!s) return layer("unavailable", null, feed.source);
  const civic = streetNumber(address), community = location?.municipalAddress?.community ?? (requestedCity && (cityKey(requestedCity) !== "hamilton" || !precise(location)) ? cityKey(requestedCity) === "waterdown" ? "Flamborough" : requestedCity : null);
  const exact = s.records.filter(r => String(r.STREET_NO_1).toLowerCase() === civic?.toLowerCase() && civicStreetKey(`${r.STREET_NO_1} ${r.STREET_NAME}`) === civicStreetKey(address) && (!community || cityKey(String(r.COMMUNITY)) === cityKey(community) || precise(location) && validPoint(r.latitude, r.longitude) && haversineMeters(location!.latitude!, location!.longitude!, Number(r.latitude), Number(r.longitude)) < 40));
  const matched: (Row & { sourcePointSeparationM: number | null })[] = exact.map(r => ({ ...r, sourcePointSeparationM: precise(location) && validPoint(r.latitude, r.longitude) ? Math.round(haversineMeters(location!.latitude!, location!.longitude!, Number(r.latitude), Number(r.longitude))) : null }));
  const ambiguous = new Set(matched.map(r => cityKey(String(r.COMMUNITY)))).size > 1 || matched.some(r => text(r.STREET_NO_2) && r.STREET_NO_2 !== r.STREET_NO_1 || r.sourcePointSeparationM !== null && r.sourcePointSeparationM > 100);
  const result = dated(ambiguous ? "ambiguous" : matched.length ? "available" : "no_match", { scope: "published_heritage_inventory_and_register", matchMethod: "exact_civic_address_and_published_community_or_point", records: matched.slice(0, 25).map(r => ({ recordId: String(r.OBJECTID), address: `${r.STREET_NO_1} ${r.STREET_NAME}`, publishedAddressEndNumber: text(r.STREET_NO_2), community: text(r.COMMUNITY), name: text(r.NAME), publishedStatus: text(r.HERITAGE_STATUS), statusMeaning: heritageMeaning(r.HERITAGE_STATUS), partIV: text(r.PART_IV), partV: text(r.PART_V), bylawNumber: text(r.BYLAW_NO), heritageConservationDistrict: text(r.HCD_NAME), easement: text(r.EASEMENT), publishedHeritageYearField: text(r.DATE_HERITAGE), publishedLatitude: r.latitude, publishedLongitude: r.longitude, sourcePointSeparationM: r.sourcePointSeparationM })) }, feed, s, "Inventory, registered non-designated, Part IV and Part V are distinct. DATE_HERITAGE is an unexplained published year field, not a verified designation date or construction year. Address ranges and source points separated by more than 100 metres are ambiguous; an exact-address candidate is retained rather than inferred absent. Rural civic points can be entrances far from heritage buildings. Confirm identity, the current register, bylaw and district effective date; proposed districts are not inferred in force. No match does not establish absence of restrictions.");
  result.truncated = matched.length > 25; return result;
}
export function hamiltonApplications(records: Row[], lat: number, lng: number) {
  const groups = new Map<string, { r: Row; distance: number; addresses: Set<string> }>(); let unlocated = 0;
  for (const r of records) {
    if (!validPoint(r.latitude, r.longitude)) { unlocated++; continue; }
    const distance = haversineMeters(lat, lng, Number(r.latitude), Number(r.longitude)); if (distance > 800) continue;
    const id = text(r.FILE_NUM); if (!id) { unlocated++; continue; }
    const group = groups.get(id); if (group) { group.addresses.add(String(r.ADDRESS ?? "")); if (distance < group.distance) { group.r = r; group.distance = distance; } }
    else groups.set(id, { r, distance, addresses: new Set([String(r.ADDRESS ?? "")]) });
  }
  const all = [...groups.entries()].sort((a, b) => a[1].distance - b[1].distance);
  return { radiusM: 800, historyPolicy: "all published file years; source publishes no stage or approval status", totalNearbyApplications: all.length, sourceRecordsWithoutUsableCoordinates: unlocated, distanceBasis: "straight-line distance to published application-site point, not lot boundaries", applications: all.slice(0, 25).map(([applicationNumber, { r, distance, addresses }]) => ({ recordId: String(r.OBJECTID), applicationNumber, address: text(r.ADDRESS), nearbyAddresses: [...addresses], applicationType: text(r.FILE_TYPE), fileYear: publishedYear(r.FILE_YEAR), description: text(r.DESCRIP), publishedStatus: null, stage: "unknown", dateSubmitted: null, distanceM: Math.round(distance) })) };
}
async function development(location: Location | null): Promise<Layer> {
  const feed = HAMILTON.development;
  if (!precise(location)) return layer("skipped", null, feed.source, "A usable civic/building or caller-supplied point is required; street interpolation was not screened.");
  const s = await loadSnapshot("hamilton-development"); if (!s) return layer("unavailable", null, feed.source);
  const data = hamiltonApplications(s.records, location!.latitude!, location!.longitude!);
  const result = dated(data.applications.length ? "available" : "no_match", data, feed, s, "Nearby applications are context, not permissions on this property. This dataset has no status, approval or submission-date field: stage remains unknown, and file year does not establish current activity. All published years are searched and application numbers are grouped by nearest site.");
  result.truncated = data.totalNearbyApplications > 25; return result;
}
const POINT_NOTES = {
  zoning: "Point intersection against published zoning polygons. Hamilton has seven zoning bylaws; preserve the parent bylaw, exceptions, holding provisions and effective-date fields. GIS is not zoning verification or permission to build. Confirm current amendments, appeals and parcel-wide zoning with the City.",
  environmentalSensitivity: "Point intersection with Hamilton's environmentally sensitive areas, not a conservation-authority regulation map, environmental site assessment, contamination record or flood-safety determination. No intersection does not establish absence of environmental constraints. Confirm parcel-wide natural heritage requirements.",
  ward: "Published ward boundary at the screened point; confirm boundary-edge cases with the City.",
};
async function pointLayer(key: keyof typeof POINT_NOTES, location: Location | null): Promise<Layer> {
  const feed = HAMILTON[key];
  if (!precise(location)) return layer("skipped", null, feed.source, "A usable civic/building or caller-supplied point is required; street interpolation was not screened.");
  try {
    const m = await metadata(feed);
    if (m.meta.geometryType !== "esriGeometryPolygon") throw new Error("Hamilton geometry changed");
    const r = await get(feed.url + "/query", { where: "1=1", geometry: `${location!.longitude},${location!.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: feed.fields.join(","), returnGeometry: "false", resultRecordCount: "51" });
    const matched = features(r, feed.fields); if (r.exceededTransferLimit || matched.length >= 51) throw new Error("Point query incomplete");
    const records = matched.map(r => ({ recordId: String(r.OBJECTID), publishedFields: Object.fromEntries(feed.fields.filter(k => k !== "OBJECTID").map(k => [k, /_URL$/.test(k) ? safeCityUrl(r[k]) : /_DATE$/.test(k) ? arcgisDate(r[k]) : r[k]])) }));
    return layer(records.length > 1 && key === "zoning" ? "ambiguous" : records.length ? "available" : "no_match", { geometryScope: location!.accuracy, matchMethod: "point_intersection", records }, feed.source, POINT_NOTES[key], m.updated);
  } catch { return layer("unavailable", null, feed.source, "Hamilton licence, schema or complete query could not be verified; no absence was inferred."); }
}
function safeCityUrl(v: unknown): string | null { try { const u = new URL(String(v)); return u.protocol === "https:" && u.hostname === "www.hamilton.ca" ? u.href : null; } catch { return null; } }
export function permitRecord(r: Row, sourceId: string) {
  return { recordId: `${sourceId}:${r.OBJECTID}`, permitNumber: text(r.PERMITNUMBER), address: text(r.ORIGINALADDRESS1), publishedUnit: text(r.ORIGINALADDRESS2) === "NULL" ? null : text(r.ORIGINALADDRESS2), community: text(r.ORIGINALCITY), publishedStatus: text(r.STATUSCURRENT), appliedAt: arcgisDate(r.APPLIEDDATE), issuedAt: arcgisDate(r.ISSUEDDATE), completedAt: arcgisDate(r.COMPLETEDDATE), permitClass: text(r.PERMITCLASS), workClass: text(r.WORKCLASS), description: text(r.DESCRIPTION), sourceId };
}
async function permits(address: string | null, location: Location | null, requestedCity: string | null): Promise<Layer> {
  if (!address) return layer("skipped", null, HAMILTON.permitsRecent.source);
  const keys = location?.municipalAddress?.permitAddressKeys ?? [civicStreetKey(address)];
  const community = location?.municipalAddress?.community ?? (cityKey(requestedCity ?? "") !== "hamilton" ? requestedCity : null);
  const communityNames = community && ["waterdown", "flamborough"].includes(cityKey(community)) ? ["WATERDOWN", "FLAMBOROUGH"] : community ? [community.toUpperCase()] : [];
  const where = `UPPER(ORIGINALADDRESS1) IN (${[...new Set(keys.flatMap(streetVariants))].map(literal).join(",")})${communityNames.length ? ` AND UPPER(ORIGINALCITY) IN (${communityNames.map(literal).join(",")})` : ""}`;
  const datasets = await Promise.all([HAMILTON.permitsRecent, HAMILTON.permitsHistory].map(async feed => {
    try {
      const m = await metadata(feed);
      const count = Number((await get(feed.url + "/query", { where, returnCountOnly: "true" })).count);
      if (!Number.isInteger(count) || count < 0) throw new Error("Permit count invalid");
      const r = await get(feed.url + "/query", { where, outFields: feed.fields.join(","), returnGeometry: "false", resultRecordCount: "50", orderByFields: "APPLIEDDATE DESC,OBJECTID DESC" });
      const page = features(r, feed.fields);
      if (page.length !== Math.min(50, count) || r.exceededTransferLimit && count <= 50) throw new Error("Permit query incomplete");
      const matched = page.filter(r => keys.includes(civicStreetKey(String(r.ORIGINALADDRESS1))) && (!community || communityNames.includes(String(r.ORIGINALCITY).toUpperCase())));
      return { status: "available", source: feed.source, sourceUpdatedAt: m.updated, retrievedAt: new Date().toISOString(), totalAddressCandidates: count, truncated: count > 50, records: matched.map(r => permitRecord(r, feed.source.id)) };
    } catch { return { status: "unavailable", source: feed.source, sourceUpdatedAt: null, retrievedAt: null, totalAddressCandidates: null, truncated: false, records: [] }; }
  }));
  const records = datasets.flatMap(d => d.records), complete = datasets.every(d => d.status === "available");
  const ambiguous = !community && new Set(records.map(r => cityKey(r.community ?? ""))).size > 1;
  const result = layer(ambiguous ? "ambiguous" : records.length ? "available" : complete ? "no_match" : "unavailable", { scope: "historical_building_level_permit_records", matchMethod: location?.municipalAddress ? "exact_or_uniquely_resolved_municipal_street_abbreviation_and_community" : "exact_civic_address_only", coverageComplete: complete, datasets, records }, HAMILTON.permitsRecent.source, "Two published historic feeds are searched; each retains its own source and update date. The feed titled 2017 to Present has a 2024 published update date and does not establish current coverage. Shortened streets are used only after municipal-register uniqueness checks; unresolved cross-community matches are ambiguous. Records can concern units, but this is building-level research. Closed/completed dates do not independently prove final inspection, occupancy approval or current legality.", datasets[0].sourceUpdatedAt);
  result.truncated = datasets.some(d => d.truncated); return result;
}
export async function hamiltonLayers(address: string | null, city: string | null, province: string | null, location: Location | null): Promise<Record<string, Layer>> {
  if (!isHamilton(city, province)) return {};
  const [heritage, nearby, zoning, environment, ward, permit] = await Promise.all([hamiltonHeritage(address, location, city), development(location), pointLayer("zoning", location), pointLayer("environmentalSensitivity", location), pointLayer("ward", location), permits(address, location, city)]);
  return { heritage, development: nearby, zoning, environmentalSensitivity: environment, ward, permits: permit };
}
export async function hamiltonCoverage() {
  const snapshots = await Promise.all((["heritage", "development"] as const).map(async key => {
    const s = await loadSnapshot(`hamilton-${key}`);
    return { layer: key, geography: "Hamilton, ON (including former communities)", source: HAMILTON[key].source, status: s ? "loaded" : "unavailable", records: s?.rowCount ?? null, sourceUpdatedAt: s?.sourceUpdatedAt ?? null, retrievedAt: s?.retrievedAt ?? null, delivery: s?.delivery ?? "unavailable", refresh: "daily scheduled refresh; last good snapshot retained on failure" };
  }));
  const live = await Promise.all((["addresses", "zoning", "environmentalSensitivity", "ward", "permitsRecent", "permitsHistory"] as const).map(async key => {
    const feed = HAMILTON[key];
    try {
      const m = await metadata(feed); const r = await get(feed.url + "/query", { where: "1=1", returnCountOnly: "true" });
      if (!Number.isInteger(r.count) || Number(r.count) < 0) throw new Error("Count invalid");
      return { layer: key, source: feed.source, status: "reachable", publishedRecords: r.count, sourceUpdatedAt: m.updated, delivery: "cached_live_queries", cacheSeconds: 3600 };
    } catch { return { layer: key, source: feed.source, status: "unavailable", publishedRecords: null, sourceUpdatedAt: null, delivery: "cached_live_queries", cacheSeconds: 3600 }; }
  }));
  return { geography: "Hamilton, Ontario", snapshots, live, note: "Published counts measure dataset records, not distinct properties or ingested bulk rows. Permit feeds are historic despite the 2017 to Present title. Spatial layers require published civic/building or caller points; all seven zoning bylaws and former communities need City verification. Environmentally sensitive areas are not conservation-authority regulatory mapping." };
}
