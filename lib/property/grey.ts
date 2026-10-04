import { createHash } from "node:crypto";
import { load } from "cheerio/slim";
import { fabricJson } from "./ontario-fabric-rights";
import { rows } from "./http";
import { cityKey, layer, type Layer, type Location, type PropertyRequest, type Row } from "./model";
import { provinceKey } from "./geocode";
import { niagaraMetadata } from "./niagara";
import { NIAGARA_FEEDS } from "./niagara-sources";
import { GREY_FEEDS, GREY_GRANT, GREY_MUNICIPALITIES, type GreyFeed } from "./grey-sources";

type Context = Map<string, Promise<Row>>;
const sha = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex");
const normalized = (html: string) => { const $ = load(html); return { text: $.text().replace(/\s+/g, " ").trim(), links: $("a[href]").map((_, e) => $(e).attr("href")).get() }; };
const itemUrl = (id: string) => `https://www.arcgis.com/sharing/rest/content/items/${id}`;
const municipalKey = (v: string) => cityKey(v).replace(/^(town|township|municipality) of\s+/, "").replace(/^the blue mountains$/, "blue mountains");
export const greyMarket = (city: string | null | undefined, province: string | null | undefined) => provinceKey(province ?? "") === "ontario" ? GREY_MUNICIPALITIES.find(c => municipalKey(c) === municipalKey(city ?? "")) ?? null : null;
function read(c: Context, url: string) { const p = c.get(url); if (p) return p; const next = fabricJson(url); c.set(url, next); return next; }
export function greyTermsHash(data: Row): string {
  const values = data.values as Row | undefined, layout = values?.layout as Row | undefined, sections = layout?.sections;
  if (!Array.isArray(sections) || !sections.length) throw Error("Grey complete terms missing");
  const markdown: ReturnType<typeof normalized>[] = [];
  function walk(x: unknown) { if (x && typeof x === "object") { const r = x as Row; if (typeof r.markdown === "string") markdown.push(normalized(r.markdown)); Object.values(r).forEach(walk); } }
  walk(sections); if (!markdown.length) throw Error("Grey complete terms missing"); return sha(markdown);
}
async function grant(c: Context) {
  const [site, data, terms, termsData] = await Promise.all([read(c, itemUrl(GREY_GRANT.site)), read(c, itemUrl(GREY_GRANT.site) + "/data"), read(c, itemUrl(GREY_GRANT.termsItem)), read(c, itemUrl(GREY_GRANT.termsItem) + "/data")]);
  const values = data.values as Row | undefined, tv = termsData.values as Row | undefined;
  if (site.id !== GREY_GRANT.site || site.owner !== "service_grey" || site.orgId !== "wE2uWQWlTTnVDgyt" || site.access !== "public" || site.title !== "maps.grey.ca" || site.url !== "https://maps.grey.ca" ||
    !rows(values?.pages).some(p => p.id === GREY_GRANT.termsItem && p.title === GREY_GRANT.termsTitle && p.slug === "terms") || terms.id !== GREY_GRANT.termsItem || terms.owner !== "service_grey" || terms.orgId !== site.orgId || terms.access !== "public" || terms.title !== GREY_GRANT.termsTitle || tv?.slug !== "terms" || !rows(tv.sites).some(s => s.id === GREY_GRANT.site) || greyTermsHash(termsData) !== GREY_GRANT.termsHash) throw Error("Grey current offered full terms changed");
}
export function validGreySource(f: GreyFeed, item: Row, root: Row, m: Row): boolean {
  const fields = rows(m.fields), q = m.advancedQueryCapabilities as Row | undefined;
  const licence = normalized(typeof item.licenseInfo === "string" ? item.licenseInfo : "");
  return item.id === f.item && item.owner === "service_grey" && item.orgId === "wE2uWQWlTTnVDgyt" && item.access === "public" && item.type === "Feature Service" && item.title === f.itemTitle && item.url === f.source.url && licence.links.length === 1 && licence.links[0] === f.source.licenceUrl &&
    sha({ license: licence, description: normalized(typeof item.description === "string" ? item.description : "") }) === f.itemDefinitionHash && root.serviceItemId === f.rootItem && (f.kind !== "plan" || root.mapName === "2018 Official Plan") &&
    rows(root.layers).filter(l => l.id === f.child && l.name === f.name && l.type === "Feature Layer" && l.geometryType === "esriGeometryPolygon").length === 1 && m.id === f.child && m.serviceItemId === f.rootItem && m.name === f.name && m.type === "Feature Layer" && m.geometryType === "esriGeometryPolygon" && m.displayField === f.display &&
    sha({ description: m.description, copyright: m.copyrightText, fields: m.fields }) === f.metadataDefinitionHash && String(m.capabilities).split(",").includes("Query") && q?.supportsOrderBy === true && Object.entries(f.fieldTypes).every(([name, type]) => fields.filter(a => a.name === name && a.type === type).length === 1 && fields.filter(a => a.name === name).length === 1);
}
export async function greyMetadata(f: GreyFeed, c: Context = new Map()) {
  const [item, root, m] = await Promise.all([read(c, itemUrl(f.item)), read(c, f.root), read(c, f.source.url)]);
  if (!validGreySource(f, item, root, m)) throw Error("Grey original item grant or typed source changed");
  await grant(c);
  return { catalogueMetadataModifiedEpochMilliseconds: item.modified ?? null, sourceDataLastEditEpochMilliseconds: (m.editingInfo as Row | undefined)?.dataLastEditDate ?? null, observationVintageResolved: false, historicalPlanLabel: f.kind === "plan" ? "2018 Official Plan" : null, currentPolicyVerified: false, dateFieldTimezoneVerified: false };
}
export function greyQueryRecords(r: Row, f: GreyFeed) {
  const features = rows(r.features), fields = rows(r.fields), ids = new Set<number>();
  // The hosted settlement FeatureServer omits displayFieldName; its typed OID is mandatory. The original MapServer returns the pinned display name but can omit objectIdFieldName.
  if (!Array.isArray(r.features) || features.length !== r.features.length || !Array.isArray(r.fields) || fields.length !== r.fields.length || features.length > 51 || (f.kind === "settlement" ? (r.displayFieldName !== undefined && r.displayFieldName !== f.display) || r.objectIdFieldName !== "OBJECTID" : r.displayFieldName !== f.display || (r.objectIdFieldName !== undefined && r.objectIdFieldName !== "OBJECTID")) || (r.exceededTransferLimit !== undefined && typeof r.exceededTransferLimit !== "boolean") || !Object.entries(f.fieldTypes).every(([name, type]) => fields.filter(a => a.name === name && a.type === type).length === 1 && fields.filter(a => a.name === name).length === 1)) throw Error("Grey query identity or schema changed");
  const truncated = r.exceededTransferLimit === true || features.length === 51;
  const records = features.map(feature => {
    const a = feature.attributes as Row | undefined;
    if (!a || typeof a !== "object" || Array.isArray(a) || Object.keys(a).length !== Object.keys(f.fields).length || feature.geometry != null || !Object.entries(f.fieldTypes).every(([k, t]) => k in a && (k === "OBJECTID" ? Number.isSafeInteger(a[k]) && Number(a[k]) > 0 : a[k] === null || (t === "esriFieldTypeString" ? typeof a[k] === "string" && String(a[k]).length <= 4000 : Number.isSafeInteger(a[k])))) || ids.has(Number(a.OBJECTID))) throw Error("Grey invalid selected attributes or duplicate identity");
    ids.add(Number(a.OBJECTID)); return Object.fromEntries(Object.entries(f.fields).map(([k, v]) => [v, a[k]]));
  }).slice(0, 50);
  if (!records.length && truncated) throw Error("Grey incomplete empty query");
  return { records, truncated, queryCoverageComplete: !truncated, sourceQueryRecordCount: features.length };
}
const provincial = NIAGARA_FEEDS.find(f => f.key === "ontarioMunicipality")!;
const boundarySource = { ...provincial.source, id: "grey:ontarioMunicipality", name: "Ontario — Grey municipal containment reference" };
async function containment(p: Location, city: string, c: Context): Promise<Layer> {
  try {
    const m = await niagaraMetadata(provincial, c), r = await fabricJson(provincial.url + "/query", { where: "1=1", geometry: `${p.longitude},${p.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "OBJECTID,MUNICIPAL_NAME", returnGeometry: "false", orderByFields: "OBJECTID", resultRecordCount: "51" });
    const features = rows(r.features), fields = rows(r.fields), records = features.map(f => f.attributes as Row);
    if (!Array.isArray(r.features) || features.length !== r.features.length || !Array.isArray(r.fields) || fields.length !== r.fields.length || r.displayFieldName !== "MUNICIPAL_NAME" || !Object.entries({ OBJECTID: "esriFieldTypeOID", MUNICIPAL_NAME: "esriFieldTypeString" }).every(([name, type]) => fields.filter(f => f.name === name).length === 1 && fields.some(f => f.name === name && f.type === type)) || features.length > 51 || (r.exceededTransferLimit !== undefined && typeof r.exceededTransferLimit !== "boolean") || records.some(a => !a || Array.isArray(a) || Object.keys(a).length !== 2 || !Number.isSafeInteger(a.OBJECTID) || Number(a.OBJECTID) < 1 || typeof a.MUNICIPAL_NAME !== "string" || a.MUNICIPAL_NAME.length > 100) || new Set(records.map(a => a.OBJECTID)).size !== records.length || features.some(f => f.geometry != null)) throw Error("Grey invalid original municipal identity");
    const complete = r.exceededTransferLimit !== true && records.length < 51, agrees = complete && records.length === 1 && municipalKey(String(records[0].MUNICIPAL_NAME)) === municipalKey(city);
    return { ...layer(agrees ? "available" : records.length || !complete ? "ambiguous" : "no_match", { records: records.slice(0, 2).map(a => ({ recordId: a.OBJECTID, reportedMunicipality: a.MUNICIPAL_NAME })), queryCoverageComplete: complete, coverageComplete: false, currentLegalBoundaryVerified: false, parcelIdentityVerified: false, parcelWideScreenPerformed: false }, boundarySource, "One complete unique original Ontario municipal polygon must agree with the requested municipality before County point-reference queries. County reference parcels and MNR-labelled boundaries never supply this gate.", m.sourceUpdatedAt), truncated: !complete };
  } catch { return layer("unavailable", null, boundarySource, "Original Ontario licence, typed boundary or named point containment could not be verified. County reference queries were not performed."); }
}
async function query(f: GreyFeed, p: Location, c: Context): Promise<Layer> {
  try {
    const vintage = await greyMetadata(f, c), result = greyQueryRecords(await fabricJson(f.source.url + "/query", { where: "1=1", geometry: `${p.longitude},${p.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: Object.keys(f.fields).join(","), returnGeometry: "false", orderByFields: "OBJECTID ASC", resultRecordCount: "51" }), f);
    return { ...layer(result.truncated || result.records.length > 1 ? "ambiguous" : result.records.length ? "available" : "no_match", { ...result, vintage, scope: "subject_point", matchMethod: "published_reference_polygon_intersects_independent_point", coordinateAccuracy: p.accuracy, coverageComplete: false, absenceEstablished: false, currentLegalBoundaryVerified: false, currentPolicyVerified: false, currentZoningVerified: false, developmentPermissionEstablished: false, parcelIdentityVerified: false, parcelWideScreenPerformed: false, sourceGeometryReused: false, measuredDimensionsReturned: false, actualServicingVerified: false, currentAuthorityRegulationVerified: false, waterQualityAssessed: false }, f.source, f.note), truncated: result.truncated };
  } catch { return layer("unavailable", null, f.source, "Complete current originating County open-data terms, item licence/lineage, typed child or bounded attribute query could not be verified. No absence, current policy, permission, hazard or safety finding was inferred."); }
}
export async function greyLayers(input: PropertyRequest, p: Location | null): Promise<Record<string, Layer>> {
  const parts = input.address?.split(",").map(s => s.trim()), city = greyMarket(input.city ?? parts?.[1] ?? p?.city, input.province ?? parts?.[2] ?? p?.province);
  if (!city) return {};
  const precise = p && provinceKey(p.province ?? "") === "ontario" && municipalKey(p.city ?? "") === municipalKey(city) && ["caller_supplied", "source_building_point", "source_civic_address_point"].includes(p.accuracy) && !p.provider.startsWith("grey:") && typeof p.latitude === "number" && typeof p.longitude === "number" && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && p.latitude > 43.7 && p.latitude < 45.3 && p.longitude > -81.4 && p.longitude < -79.8 && (!parts?.[1] || municipalKey(parts[1]) === municipalKey(city)) && (!parts?.[2] || provinceKey(parts[2]) === "ontario");
  const c: Context = new Map(), gate = precise ? await containment(p!, city, c) : layer("skipped", null, boundarySource, "A suitable independent Ontario point and consistent requested municipality were not confirmed. No County spatial reference query was performed.");
  const screen = precise && gate.status === "available" && gate.truncated === false;
  const pairs = await Promise.all(GREY_FEEDS.map(async f => [f.key, screen ? await query(f, p!, c) : layer("skipped", null, f.source, "An independent point and unique original Ontario municipal containment were not confirmed. No County reference query was performed.")] as const));
  return { greyMunicipalContainment: gate, ...Object.fromEntries(pairs) };
}
export async function greyCoverage() {
  const c: Context = new Map(), datasets = [];
  for (const f of GREY_FEEDS) {
    try { const vintage = await greyMetadata(f, c), r = await fabricJson(f.source.url + "/query", { where: "1=1", returnCountOnly: "true" }); if (!Number.isSafeInteger(r.count) || Number(r.count) < 0) throw Error("Grey invalid count"); datasets.push({ layer: f.key, status: "verified", records: r.count, source: f.source, sourceUpdatedAt: null, vintage, note: f.note }); }
    catch { datasets.push({ layer: f.key, status: "unavailable", records: null, source: f.source, sourceUpdatedAt: null, note: "Complete current County licence/item/typed source binding or count could not be verified." }); }
  }
  return { cities: [...GREY_MUNICIPALITIES], auditDate: "2026-10-04", delivery: "cached_live_queries", cacheSeconds: 3600, datasets, complete: false, municipalityReference: { source: boundarySource, countIncludedHere: false, countAlreadyIncludedUnder: "original Ontario Municipality dataset in Niagara coverage" }, note: "Five selected County references counted once across supported municipalities. The duplicate settlement offer and MNR-labelled County boundary/township layers are not queried or counted. Source rows overlap and are not unique properties, field data points or imports. Historical County plan references do not complete any current municipal, permit, heritage, unit, zoning or authority audit." };
}
