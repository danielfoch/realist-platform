import { createHash } from "node:crypto";
import { load } from "cheerio/slim";
import { XMLValidator } from "fast-xml-parser";
import { fetchBytes, fetchJson, fetchText, literal, rows } from "./http";
import { civicStreetKey, cityKey, hasUnit, layer, streetNumber, text, type Layer, type Location, type PropertyRequest, type Row } from "./model";
import { provinceKey } from "./geocode";
import { streetVariants } from "./hamilton";
import { NIAGARA_FEEDS } from "./niagara-sources";
import { niagaraMetadata } from "./niagara";
import { SIMCOE_FEEDS, SIMCOE_GRANT, SIMCOE_GUIDANCE, SIMCOE_MUNICIPALITIES, SIMCOE_WITHHELD, type SimcoeFeed } from "./simcoe-sources";

type Context = Map<string, Promise<unknown>>;
const sha = (v: string | Uint8Array) => createHash("sha256").update(v).digest("hex");
const municipalKey = (v: string) => cityKey(v).replace(/^(town|township|municipality) of\s+/, "");
export const simcoeMarket = (city: string | null, province: string | null) => provinceKey(province ?? "") === "ontario" ? SIMCOE_MUNICIPALITIES.find(c => municipalKey(c) === municipalKey(city ?? "")) ?? null : null;
const civicFeed = SIMCOE_FEEDS[0];
const endpoint = "https://opengis.simcoe.ca/geoserver/wfs";
function request(f: SimcoeFeed, params: Record<string, string>): URL {
  const u = new URL(endpoint);
  Object.entries({ service: "WFS", version: "2.0.0", typeNames: "simcoe:" + f.name, ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  return u;
}
function once<T>(c: Context, key: string, fn: () => Promise<T>): Promise<T> {
  const pending = c.get(key) as Promise<T> | undefined; if (pending) return pending;
  const p = fn(); c.set(key, p); return p;
}
function grantHash(bytes: Uint8Array): string {
  // The complete published text and every anchor are pinned. Only non-licence script/style contents are excluded; the anti-bot script has a changing cache-buster.
  const $ = load(new TextDecoder("windows-1252").decode(bytes)); $("script,style").remove();
  return sha(JSON.stringify({ text: $.text().replace(/\s+/g, " ").trim(), links: $("a").toArray().map(a => $(a).attr("href") ?? "") }));
}
async function grant(c: Context) {
  return once(c, "simcoe:grant", async () => {
    const g = SIMCOE_GRANT, [terms, licence] = await Promise.all([fetchBytes(new URL(g.termsUrl)), fetchBytes(new URL(g.licenceUrl))]);
    if (grantHash(terms) !== g.termsHash || grantHash(licence) !== g.licenceHash) throw Error("Simcoe complete current terms or licence changed");
  });
}
export async function simcoeMetadata(f: SimcoeFeed, c: Context = new Map()) {
  return once(c, f.key + ":metadata", async () => {
    const [rawLayer, rawType, schema] = await Promise.all([fetchJson(new URL(f.layerUrl)), fetchJson(new URL(f.typeUrl)), fetchBytes(request(f, { request: "DescribeFeatureType" }))]);
    const l = (rawLayer as Row)?.layer as Row | undefined, t = (rawType as Row)?.featureType as Row | undefined;
    const definition = Object.fromEntries(["name", "nativeName", "namespace", "title", "abstract", "keywords", "srs", "nativeCRS", "projectionPolicy", "enabled", "store", "attributes"].map(k => [k, t?.[k]]));
    // A generic footer alone is insufficient: this exact original County feature type must retain its explicit DOWNLOAD mark and typed lineage.
    if (!l || !t || l.name !== f.name || l.type !== "VECTOR" || JSON.stringify(l.resource) !== JSON.stringify({ "@class": "featureType", name: "simcoe:" + f.name, href: f.typeUrl }) ||
      sha(JSON.stringify(l.attribution)) !== f.layerAttributionHash || sha(JSON.stringify(definition)) !== f.definitionHash || t.name !== f.name || t.nativeName !== f.nativeName || t.title !== f.title || t.enabled !== true || t.srs !== "EPSG:3857" ||
      !rows((t.attributes as Row)?.attribute).every(a => a.nillable === true) || !Array.isArray((t.keywords as Row)?.string) || !((t.keywords as Row).string as unknown[]).includes("DOWNLOAD") || sha(schema) !== f.schemaHash) throw Error("Simcoe original downloadable offer, full source definition or WFS schema changed");
    await grant(c);
    return { sourceUpdatedAt: null, sourceMetadataModifiedAt: text(l.dateModified), observationVintageResolved: false as const };
  });
}
function failure(f: SimcoeFeed, e: unknown) {
  const reason = e instanceof Error ? e.message : "unknown";
  console.warn("Simcoe property source unavailable", { feed: f.key, reason: reason.startsWith("Simcoe ") || /^Source unavailable \(HTTP \d{3}\)$/.test(reason) ? reason : "bounded_fetch_or_invalid_response" });
}
function features(value: unknown, f: SimcoeFeed) {
  const r = value as Row;
  if (!r || r.type !== "FeatureCollection" || r.crs !== null) throw Error("Simcoe invalid collection or unexpected geometry CRS");
  const all = rows(r.features);
  if (all.length > 51 || r.numberReturned !== all.length || !(r.numberMatched === "unknown" || typeof r.numberMatched === "number" && Number.isSafeInteger(r.numberMatched) && r.numberMatched >= all.length) ||
    r.totalFeatures !== r.numberMatched) throw Error("Simcoe invalid query completeness");
  const records = all.map(x => {
    const a = x.properties as Row;
    if (x.type !== "Feature" || x.geometry !== null || typeof x.id !== "string" || !x.id.startsWith(f.name + ".") || x.id.length > 240 || !a || typeof a !== "object" || Array.isArray(a) ||
      Object.keys(a).length !== Object.keys(f.fields).length || !Object.entries(f.fieldTypes).every(([k, t]) => k in a && (k === "objectid" ? typeof a[k] === "number" && Number.isSafeInteger(a[k]) && (a[k] as number) > 0 : a[k] === null || (t === "java.lang.String" ? typeof a[k] === "string" : typeof a[k] === "number" && Number.isSafeInteger(a[k]))))) throw Error("Simcoe invalid typed attribute record or unexpected geometry");
    return { observationId: x.id, ...a } as Row & { observationId: string };
  });
  if (new Set(records.map(x => x.observationId)).size !== records.length || f.key === civicFeed.key && new Set(records.map(x => x.objectid)).size !== records.length) throw Error("Simcoe duplicate response identifiers");
  const complete = typeof r.numberMatched === "number" && r.numberMatched === records.length && records.length <= 50;
  if (!records.length && !complete) throw Error("Simcoe incomplete empty query");
  return { records, truncated: !complete };
}
function civicMatches(a: Row, address: string, city: string) {
  const published = text(a.full_address), street = text(a.fullname);
  return Boolean(published && street && !published.includes(",") && !hasUnit(published) && !text(a.unit) && municipalKey(text(a.muni) ?? "") === municipalKey(city) &&
    String(a.stnum) === streetNumber(address) && civicStreetKey(published) === civicStreetKey(address) && civicStreetKey(`${a.stnum} ${street}`) === civicStreetKey(address));
}
const variants = (address: string) => [...new Set(streetVariants(civicStreetKey(address)).flatMap(v => [v, v.replace(/\bAVE\b/g, "AV").replace(/\bCT\b/g, "CRT")]))].slice(0, 128);
function pointFilter(l: Location): string {
  // Explicit CRS84 is longitude/latitude; never infer the ECQL geometry CRS from conflicting native/declared source projections.
  return `<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0" xmlns:gml="http://www.opengis.net/gml/3.2"><fes:Intersects><fes:ValueReference>geom</fes:ValueReference><gml:Point srsName="urn:ogc:def:crs:OGC:1.3:CRS84"><gml:pos>${l.longitude} ${l.latitude}</gml:pos></gml:Point></fes:Intersects></fes:Filter>`;
}
async function query(f: SimcoeFeed, city: string, address: string | null, l: Location | null, c: Context): Promise<Layer> {
  const civic = f.key === civicFeed.key;
  if (civic && (!address || hasUnit(address) || !/^\d+$/.test(streetNumber(address) ?? ""))) return layer("skipped", null, f.source, "An exact unqualified numeric building civic address is required. Unit and letter-suffix identity are unsupported; coordinate-only calls do not search civic attributes.");
  try {
    const m = await simcoeMetadata(f, c), params: Record<string, string> = civic ? { cql_filter: `stnum=${Number(streetNumber(address!))} AND strToLowerCase(muni)=${literal(city.toLowerCase())} AND strToUpperCase(full_address) IN (${variants(address!).map(literal).join(",")})` } : { filter: pointFilter(l!) };
    const { records, truncated } = features(await fetchJson(request(f, { request: "GetFeature", outputFormat: "application/json", count: "51", propertyName: Object.keys(f.fields).join(","), ...params })), f);
    const exact = records.filter(a => !civic || civicMatches(a, address!, city)), ambiguous = civic && (truncated || exact.length !== records.length || exact.length > 1);
    const result = layer(ambiguous ? "ambiguous" : exact.length ? "available" : "no_match", {
      records: exact.slice(0, 50).map(a => ({ observationId: a.observationId, ...Object.fromEntries(Object.entries(f.fields).map(([k, v]) => [v, a[k]])) })),
      matchMethod: civic ? "exact_normalized_civic_attributes" : "published_generic_geometry_intersects_point", scope: civic ? "building_or_site_address" : "subject_point",
      spatialScreenPerformed: !civic, screenedPoint: civic ? null : { latitude: l!.latitude, longitude: l!.longitude, accuracy: l!.accuracy, provider: l!.provider },
      uniqueCivicMatch: civic ? !ambiguous && exact.length === 1 : null, queryCoverageComplete: !truncated, coverageComplete: false, absenceEstablished: false,
      preciseBuildingIdentityEstablished: false, sourcePointGeometryReused: false, sourceGeometryReturned: false, unitIdentityVerified: false, parcelIdentityVerified: false, parcelWideScreenPerformed: false,
      sourceGeometryRepresentation: "Generic geometry; published shape type is not guaranteed by the WFS schema", observationIdentifierStable: false,
      ...m,
      ...(f.key === "simcoeBuildingFootprintReference" ? { buildingIdentityEstablished: false, measuredBuildingAreaReturned: false, constructionYearEstablished: false, currentFootprintVerified: false, currentConditionVerified: false, legalPermissionsEstablished: false } : {}),
      ...(f.key === "simcoeMunicipalBoundaryReference" ? { officialBoundaryEstablished: false, usedForMunicipalityGate: false, currentLegalBoundaryVerified: false } : {}),
      ...(f.key === "simcoeWardReference" ? { electionYearEstablished: false, currentWardVerified: false, representativeVerified: false } : {}),
      ...(f.key === "simcoeWasteCollectionReference" ? { actualCollectionServiceVerified: false, specialOrHolidayScheduleVerified: false, currentCollectionCalendarVerified: false, separatedCityServiceVerified: false } : {}),
    }, f.source, f.note + " Source metadata modification is separate from data observation/update time. Generated WFS identifiers identify this response only. No-match does not establish absence.");
    result.truncated = truncated; return result;
  } catch (e) { failure(f, e); return layer("unavailable", null, f.source, "The complete current grant, exact original DOWNLOAD offer/definition, WFS schema or bounded selected-attribute query could not be verified. No factual result is returned."); }
}
const provincial = NIAGARA_FEEDS.find(f => f.key === "ontarioMunicipality")!;
const boundarySource = { ...provincial.source, id: "simcoe:ontarioMunicipality", name: "Ontario — Simcoe municipal containment reference" };
async function boundary(l: Location, city: string, c: Context): Promise<Layer> {
  try {
    const m = await niagaraMetadata(provincial, c as Map<string, Promise<Row>>), u = new URL(provincial.url + "/query");
    Object.entries({ f: "json", where: "1=1", geometry: `${l.longitude},${l.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "OBJECTID,MUNICIPAL_NAME", returnGeometry: "false", resultRecordCount: "51", orderByFields: "OBJECTID" }).forEach(([k, v]) => u.searchParams.set(k, v));
    const r = await fetchJson(u) as Row;
    if (!r || r.error) throw Error("Simcoe provincial boundary unavailable");
    const records = rows(r.features).map(f => f.attributes as Row);
    if (records.some(a => !a || typeof a.OBJECTID !== "number" || !Number.isSafeInteger(a.OBJECTID) || a.OBJECTID <= 0 || typeof a.MUNICIPAL_NAME !== "string")) throw Error("Simcoe invalid provincial boundary record");
    const complete = !r.exceededTransferLimit && records.length < 51, agrees = complete && records.length === 1 && municipalKey(String(records[0].MUNICIPAL_NAME)) === municipalKey(city);
    const result = layer(agrees ? "available" : records.length || !complete ? "ambiguous" : "no_match", { records: records.slice(0, 2).map(a => ({ recordId: a.OBJECTID, publishedMunicipality: a.MUNICIPAL_NAME })), scope: "subject_point", matchMethod: "licensed_provincial_polygon_intersects_point", spatialScreenPerformed: true, queryCoverageComplete: complete, coverageComplete: false, absenceEstablished: false, currentLegalBoundaryVerified: false, parcelIdentityVerified: false }, boundarySource, "One unique complete original Ontario municipal polygon must name the requested municipality before County spatial reference queries. County unofficial borders never supply this gate.", m.sourceUpdatedAt);
    result.truncated = !complete; return result;
  } catch (e) { failure(civicFeed, e); return layer("unavailable", null, boundarySource, "Original Ontario grant, typed polygon or named municipal containment could not be verified. No County spatial reference queries were performed."); }
}
export async function simcoeLocation(input: PropertyRequest): Promise<Layer<Location> | null> {
  const p = input.address?.split(",").map(s => s.trim()), city = simcoeMarket(input.city ?? p?.[1] ?? null, input.province ?? p?.[2] ?? "ON");
  if (city && (p?.[1] && municipalKey(p[1]) !== municipalKey(city) || p?.[2] && provinceKey(p[2]) !== "ontario")) return layer("ambiguous", null, civicFeed.source, "Submitted municipality/province conflicts with the explicit County-market request. Correct identity before screening.");
  return null;
}
export async function simcoeLayers(input: PropertyRequest, l: Location | null): Promise<Record<string, Layer>> {
  const p = input.address?.split(",").map(s => s.trim()), city = simcoeMarket(input.city ?? p?.[1] ?? l?.city ?? null, input.province ?? p?.[2] ?? l?.province ?? "ON");
  if (!city) return {};
  const c: Context = new Map(), address = input.address?.split(",")[0] ?? null;
  const conflict = Boolean(p?.[1] && municipalKey(p[1]) !== municipalKey(city) || p?.[2] && provinceKey(p[2]) !== "ontario" || l && (municipalKey(l.city ?? "") !== municipalKey(city) || provinceKey(l.province ?? "") !== "ontario" || l.provider.startsWith("simcoe:")));
  const civic = conflict ? layer("skipped", null, civicFeed.source, "Municipal identity evidence conflicts; no County civic query was performed.") : await query(civicFeed, city, address, null, c);
  const precise = !conflict && l && typeof l.latitude === "number" && typeof l.longitude === "number" && Number.isFinite(l.latitude) && Number.isFinite(l.longitude) && l.latitude > 43.85 && l.latitude < 45.05 && l.longitude > -80.5 && l.longitude < -78.9 && ["source_building_point", "source_civic_address_point", "caller_supplied"].includes(l.accuracy);
  const identity = ["available", "no_match", "skipped"].includes(civic.status) && !conflict;
  const municipality = precise && identity ? await boundary(l!, city, c) : layer("skipped", null, boundarySource, "A suitable independent/caller point and non-ambiguous civic evidence were not confirmed; no municipal containment query was performed.");
  const screen = precise && municipality.status === "available" && !municipality.truncated;
  const entries: Record<string, Layer> = { simcoeMunicipalContainment: municipality, simcoeMunicipalAddresses: civic };
  for (const [key, value] of await Promise.all(SIMCOE_FEEDS.slice(1).map(async f => [f.key, screen ? await query(f, city, null, l, c) : layer("skipped", null, f.source, "A suitable independent point, unique original Ontario municipality and non-ambiguous civic evidence were not confirmed. No County spatial reference query was performed.")] as const))) entries[key] = value;
  entries.simcoeLocalPropertyFiles = layer("unavailable", { coverageComplete: false, screenPerformed: false, recordsQueried: false, countsQueried: false, geometryQueried: false, guidance: city === "Orillia" ? SIMCOE_GUIDANCE : { viewer: SIMCOE_GUIDANCE.viewer } }, null,
    city === "Orillia" ? "County civic/building/boundary/ward/waste references do not provide Orillia current zoning/plan, permits/inspections/occupancy, planning decisions, heritage, legal units or cadastral/authority constraints. City-map rights remain unverified. Request the City Property Compliance report; the City restricts property-file release to owners or authorized lawyers, and excludes tax/water payments and Fire Code compliance from that report. Municipal source audits remain in progress." : "County civic/building/boundary/ward/waste references do not complete this municipality's current zoning/plan, permit/inspection/occupancy, planning decisions, heritage, legal units or cadastral/authority audit. Separate City evidence, where present, retains its own source, scope and gaps.");
  return entries;
}
function hits(xml: string): number {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw Error("Simcoe invalid count XML");
  const $ = load(xml, { xml: true }), roots = $.root().children(), root = roots.first();
  if (roots.length !== 1 || root[0]?.type !== "tag" || root[0].name !== "wfs:FeatureCollection" || root.attr("xmlns:wfs") !== "http://www.opengis.net/wfs/2.0" || root.children().length !== 0 || root.attr("numberReturned") !== "0" || !/^\d+$/.test(root.attr("numberMatched") ?? "")) throw Error("Simcoe invalid count response");
  const n = Number(root.attr("numberMatched")); if (!Number.isSafeInteger(n) || n < 0) throw Error("Simcoe invalid count"); return n;
}
export async function simcoeCoverage() {
  const c: Context = new Map(), datasets = [];
  for (const f of SIMCOE_FEEDS) {
    try { const m = await simcoeMetadata(f, c), count = hits(await fetchText(request(f, { request: "GetFeature", resultType: "hits" })));
      datasets.push({ market: "Simcoe County (including separated-city references)", layer: f.key, status: "verified", records: count, source: f.source, ...m, note: f.note });
    } catch (e) { failure(f, e); datasets.push({ market: "Simcoe County (including separated-city references)", layer: f.key, status: "unavailable", records: null, source: f.source, note: "Complete current grant, explicit original DOWNLOAD offer/definition, WFS schema or count could not be verified." }); }
  }
  return { cities: [...SIMCOE_MUNICIPALITIES], auditDate: "2026-10-03", delivery: "cached_live_queries", cacheSeconds: 3600, datasets, withheld: SIMCOE_WITHHELD.map(g => ({ ...g, status: "withheld", records: null, recordsQueried: false, countsQueried: false, geometryQueried: false })), complete: false,
    municipalityReference: { source: boundarySource, countIncludedHere: false, countAlreadyIncludedUnder: "original Ontario Municipality dataset in Niagara coverage" }, guidance: SIMCOE_GUIDANCE,
    note: "Five distinct County feeds counted once across all supported municipalities. Counts overlap and are not unique properties, field data points or imports; a County total does not prove per-city coverage. County civic geometry is never used to choose a property point. Generic reference geometry, unspecified observation vintages, unofficial borders, unresolved election year and separated-city waste service remain explicit limits. All municipal core audits remain incomplete." };
}
