import { zipEntries, dbfRows } from "./ingest/archive";
import { rows } from "./http";
import type { Row } from "./model";
import type { Dataset, Snapshot } from "./snapshots";
import { HAMILTON, validHamiltonItem, type HamiltonFeed } from "./hamilton-sources";
import { createHash } from "node:crypto";
import { OTTAWA_PERMIT_FILES, validOttawaPermitItem } from "./ottawa-permit-sources";
import { parseOttawaPermits, OTTAWA_PERMIT_FIELDS } from "./ingest/ottawa-permits";

const CKAN = "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/";
const HOSTS = new Set(["ckan0.cf.opendata.inter.prod-toronto.ca", "open.toronto.ca", "maps1.brampton.ca", "services3.arcgis.com", "services.arcgis.com", "www.arcgis.com"]);
async function bytes(url: URL, max = 2_000_000, permitDownload?: { item: string; name: string }): Promise<Buffer> {
  if (url.protocol !== "https:" || !HOSTS.has(url.hostname)) throw new Error("Unsupported refresh provider");
  const options = () => ({ redirect: "error" as const, cache: "no-store" as const, signal: AbortSignal.timeout(45_000), headers: { "User-Agent": "Realist Homies public-property refresh (hello@realist.ca)" } });
  let r = await fetch(url, { ...options(), redirect: permitDownload ? "manual" : "error" });
  if (permitDownload && r.status === 302) {
    const next = new URL(r.headers.get("location") ?? "", url);
    await r.body?.cancel();
    // ArcGIS returns a signed public-file path on its own origin. Do not log/store
    // its temporary query or follow redirects to an arbitrary host or item.
    if (next.origin !== "https://www.arcgis.com" || next.pathname.split("/").slice(-2).join("/") !== `${permitDownload.item}/${permitDownload.name}` || !/^\/itemdata\/[a-f0-9]{32}\//.test(next.pathname)) throw new Error("Unsupported permit download redirect");
    r = await fetch(next, options());
  }
  if (!r.ok || !r.body) throw new Error(`Source unavailable (${r.status}; ${url.pathname})`);
  const reader = r.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > max) throw new Error("Refresh response bound exceeded"); chunks.push(value); } } finally { await reader.cancel(); }
  return Buffer.concat(chunks);
}
async function get(base: string, params: Record<string, string> = {}): Promise<Row> {
  const u = new URL(base); for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const data = JSON.parse((await bytes(u)).toString("utf8"));
  if (!data || data.error || data.success === false) throw new Error("Source query failed");
  return data;
}
export async function parallelMap<T, U>(values: T[], concurrency: number, fn: (v: T) => Promise<U>): Promise<U[]> {
  const output: U[] = new Array(values.length); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => { for (;;) { const i = cursor++; if (i >= values.length) break; output[i] = await fn(values[i]); } }));
  return output;
}
const REG = "RSN,SITE_ADDRESS,YEAR_BUILT,YEAR_REGISTERED,CONFIRMED_STOREYS,NO_OF_STOREYS,CONFIRMED_UNITS,NO_OF_UNITS,HEATING_TYPE,AIR_CONDITIONING_TYPE,NO_OF_ELEVATORS,ELEVATOR_STATUS,PARKING_TYPE,VISITOR_PARKING,BARRIER_FREE_ACCESSIBILTY_ENTR,NO_BARRIER_FREE_ACCESSBLE_UNITS,BALCONIES,LAUNDRY_ROOM,NON_SMOKING_BUILDING,NON-SMOKING_BUILDING,SEPARATE_HYDRO_METER_EACH_UNIT,SEPARATE_GAS_METERS_EACH_UNIT,SEPARATE_WATER_METERS_EA_UNIT,AMENITIES_AVAILABLE,FACILITIES_AVAILABLE,PETS_ALLOWED,PET_RESTRICTIONS";
const EVAL = "_id,RSN,SITE ADDRESS,YEAR BUILT,YEAR EVALUATED,EVALUATION COMPLETED ON,CURRENT BUILDING EVAL SCORE,PROACTIVE BUILDING SCORE,CURRENT REACTIVE SCORE,NO OF AREAS EVALUATED,COMMON AREA PESTS,BUILDING CLEANLINESS,ELEVATOR MAINTENANCE,EXTERIOR GROUNDS,BUILDING EXTERIOR,STATE OF GOOD REPAIR PLAN";
const DEV = "_id,APPLICATION_TYPE,APPLICATION#,STREET_NUM,STREET_NAME,STREET_TYPE,STREET_DIRECTION,DATE_SUBMITTED,STATUS,X,Y,DESCRIPTION,APPLICATION_URL,WARD_NUMBER,WARD_NAME";
const HERITAGE = "OBJECTID,STATUS,LISTED,DESIGNATED,BYLAW_NO,HTG_CONSER,BUILDING_T,DESCRIPTIO,CONSTRUCTI,YEAR_DEMOL,ADDRESS,HOUSE,PREFIX,STREET,STREET_TYP,DIRECTION";
function select(record: Row, fields: string[]): Row { return Object.fromEntries(fields.map(k => [k, record[k] ?? null])); }
function snapshot(key: Dataset, records: Row[], updated: string | null, query: string, fields: string[], release?: string): Snapshot {
  return { dataset: key, retrievedAt: new Date().toISOString(), sourceUpdatedAt: updated, rowCount: records.length, sourceQuery: query, selectedFields: fields, sourceRelease: release, records };
}
async function ckanPackage(slug: string): Promise<Row> {
  const p = (await get(CKAN + "package_show", { id: slug })).result as Row;
  if (!["heritage-register", "development-applications"].includes(slug)) {
    if (p.license_id !== "open-government-licence-toronto") throw new Error("Toronto licence changed");
  } else {
    // These two packages omit the licence enum. Bind to their official catalogue page's explicit licence link.
    if (![null, undefined, "notspecified", "open-government-licence-toronto"].includes(p.license_id as string | null | undefined)) throw new Error("Toronto licence changed");
    const page = (await bytes(new URL(`https://open.toronto.ca/dataset/${slug}/`), 3_000_000)).toString("utf8");
    if (!/href=[\"']https:\/\/open\.toronto\.ca\/open-data-licence\/[\"']/i.test(page)) throw new Error("Toronto licence link could not be verified");
  }
  return p;
}
async function ckanSnapshot(key: Dataset, slug: string, rid: string, selected: string): Promise<Snapshot> {
  const before = await ckanPackage(slug); const resources = rows(before.resources);
  const resource = resources.find(r => r.id === rid && r.datastore_active);
  if (!resource) throw new Error("Resource changed");
  const fields = selected.split(",");
  const args = { resource_id: rid, limit: "500", fields: selected, sort: "_id asc" };
  const first = (await get(CKAN + "datastore_search", args)).result as Row;
  const total = Number(first.total);
  if (first.total_was_estimated || !Number.isInteger(total) || total < 1 || total > 50_000 || !fields.every(k => rows(first.fields).some(f => f.id === k))) throw new Error("Count or schema changed");
  const offsets = Array.from({ length: Math.ceil(total / 500) - 1 }, (_, i) => (i + 1) * 500);
  const pages = await parallelMap(offsets, 5, async offset => {
    const r = (await get(CKAN + "datastore_search", { ...args, offset: String(offset) })).result as Row;
    if (r.total_was_estimated || r.total !== total || rows(r.records).length !== Math.min(500, total - offset)) throw new Error("Incomplete CKAN page");
    return rows(r.records);
  });
  const records = [...rows(first.records), ...pages.flat()].map(r => select(r, fields));
  const after = await ckanPackage(slug);
  const end = (await get(CKAN + "datastore_search", { resource_id: rid, limit: "0" })).result as Row;
  if (end.total !== total || end.total_was_estimated || before.metadata_modified !== after.metadata_modified || records.length !== total) throw new Error("Source changed during refresh");
  const updated = resource.last_modified ?? resources.find(r => r.name === `${resource.name}.csv`)?.last_modified ?? null;
  return snapshot(key, records, typeof updated === "string" ? updated + (updated.endsWith("Z") ? "" : "Z") : null, CKAN + "datastore_search?resource_id=" + rid, fields);
}
async function heritageSnapshot(): Promise<Snapshot> {
  const p = await ckanPackage("heritage-register");
  const r = rows(p.resources).find(r => r.id === "108b1080-d048-439f-a9e8-e8d6cd81bddb");
  if (!r || typeof r.url !== "string" || !r.url.endsWith("/heritage_register_address_points_wgs84.zip")) throw new Error("Heritage resource changed");
  const files = zipEntries(await bytes(new URL(r.url), 20_000_000));
  const dbfs = [...files.keys()].filter(k => /^HRAPQ[1-4]20\d\d_OpenData\.dbf$/i.test(k));
  if (dbfs.length !== 1) throw new Error("Heritage release schema changed");
  const fields = HERITAGE.split(","); const records = dbfRows(files.get(dbfs[0])!(), fields);
  if (records.some(x => !["PartV", "PartIV", "Listed"].includes(String(x.STATUS).replace(/\s/g, "")))) throw new Error("Heritage status changed");
  const after = await ckanPackage("heritage-register");
  if (p.metadata_modified !== after.metadata_modified) throw new Error("Heritage source changed during refresh");
  return snapshot("toronto-heritage", records, typeof r.last_modified === "string" ? r.last_modified + "Z" : null, r.url, fields, dbfs[0].replace(/\.dbf$/i, ""));
}
async function arcgisSnapshot(key: Dataset, service: string, itemId: string, selected: string): Promise<Snapshot> {
  const item = await get(`https://www.arcgis.com/sharing/rest/content/items/${itemId}`, { f: "json" });
  if (item.access !== "public" || item.licenseInfo !== "CC BY" || item.url !== service) throw new Error("Brampton rights changed");
  const metadata = await get(service, { f: "json" }); const fields = selected.split(","); const schema = rows(metadata.fields);
  if (!fields.every(k => schema.some(f => f.name === k)) || key === "brampton-additional-units" && schema.find(f => f.name === "FOURTH_REG")?.alias !== "Garden Suite Registered Date") throw new Error("Brampton schema changed");
  const ids = async () => { const r = await get(service + "/query", { f: "json", where: "1=1", returnIdsOnly: "true" }); if (!Array.isArray(r.objectIds) || r.objectIds.some(id => !Number.isInteger(id))) throw new Error("Invalid IDs"); return (r.objectIds as number[]).sort((a, b) => a - b); };
  const requested = await ids(); if (!requested.length || requested.length > 50_000 || new Set(requested).size !== requested.length) throw new Error("Brampton count changed");
  const width = service.includes("services3") ? 100 : 500;
  const batches = Array.from({ length: Math.ceil(requested.length / width) }, (_, i) => requested.slice(i * width, (i + 1) * width));
  const records = (await parallelMap(batches, 5, async batch => {
    const r = await get(service + "/query", { f: "json", objectIds: batch.join(","), outFields: selected, returnGeometry: "false" });
    const page = rows(r.features).map(f => select(f.attributes as Row, fields));
    if (r.exceededTransferLimit || JSON.stringify(page.map(r => Number(r.OBJECTID)).sort((a, b) => a - b)) !== JSON.stringify(batch)) throw new Error("Incomplete ArcGIS page");
    return page;
  })).flat();
  const after = await get(service, { f: "json" });
  if (JSON.stringify(await ids()) !== JSON.stringify(requested) || JSON.stringify(metadata.editingInfo) !== JSON.stringify(after.editingInfo)) throw new Error("Brampton source changed during refresh");
  const edited = (metadata.editingInfo as Row | undefined)?.dataLastEditDate;
  return snapshot(key, records, typeof edited === "number" ? new Date(edited).toISOString() : null, service, fields);
}
async function hamiltonSnapshot(key: Dataset, feed: HamiltonFeed): Promise<Snapshot> {
  const itemUrl = `https://www.arcgis.com/sharing/rest/content/items/${feed.item}`;
  const item = await get(itemUrl, { f: "json" });
  if (!validHamiltonItem(item, feed)) throw new Error("Hamilton rights changed");
  const metadata = await get(feed.url, { f: "json" });
  if (metadata.geometryType !== "esriGeometryPoint" || !feed.fields.every(k => rows(metadata.fields).some(f => f.name === k))) throw new Error("Hamilton schema changed");
  const ids = async () => {
    const r = await get(feed.url + "/query", { f: "json", where: "1=1", returnIdsOnly: "true" });
    if (!Array.isArray(r.objectIds) || r.objectIds.some(id => !Number.isInteger(id))) throw new Error("Hamilton IDs invalid");
    return (r.objectIds as number[]).sort((a, b) => a - b);
  };
  const requested = await ids();
  if (!requested.length || requested.length > 50_000 || new Set(requested).size !== requested.length) throw new Error("Hamilton count changed");
  // Keep ArcGIS GET URLs below its gateway's query-length limit.
  const batches = Array.from({ length: Math.ceil(requested.length / 100) }, (_, i) => requested.slice(i * 100, (i + 1) * 100));
  const records = (await parallelMap(batches, 3, async batch => {
    const r = await get(feed.url + "/query", { f: "json", objectIds: batch.join(","), outFields: feed.fields.join(","), returnGeometry: "true", outSR: "4326" });
    const page: Row[] = rows(r.features).map(f => ({ ...select(f.attributes as Row, feed.fields), longitude: (f.geometry as Row | null)?.x ?? null, latitude: (f.geometry as Row | null)?.y ?? null }));
    if (r.exceededTransferLimit || JSON.stringify(page.map(r => Number(r.OBJECTID)).sort((a, b) => a - b)) !== JSON.stringify(batch)) throw new Error("Hamilton page incomplete");
    return page;
  })).flat();
  const after = await get(feed.url, { f: "json" }); const endItem = await get(itemUrl, { f: "json" });
  if (!validHamiltonItem(endItem, feed) || item.modified !== endItem.modified || JSON.stringify(await ids()) !== JSON.stringify(requested) || JSON.stringify(metadata.editingInfo) !== JSON.stringify(after.editingInfo)) throw new Error("Hamilton source changed during refresh");
  const edited = (metadata.editingInfo as Row | undefined)?.dataLastEditDate;
  return snapshot(key, records, typeof edited === "number" ? new Date(edited).toISOString() : null, feed.url, [...feed.fields, "longitude", "latitude"]);
}
export function fetchSnapshot(key: Dataset): Promise<Snapshot> {
  switch (key) {
    case "toronto-rental-buildings": return ckanSnapshot(key, "apartment-building-registration", "3ad76a8c-0518-4df2-b94e-8c747d62f8c1", REG);
    case "toronto-building-evaluations": return ckanSnapshot(key, "apartment-building-evaluation", "244f7a02-da5c-425b-b55f-fbdd133dd732", EVAL);
    case "toronto-development": return ckanSnapshot(key, "development-applications", "8907d8ed-c515-4ce9-b674-9f8c6eefcf0d", DEV);
    case "toronto-heritage": return heritageSnapshot();
    case "hamilton-heritage": return hamiltonSnapshot(key, HAMILTON.heritage);
    case "hamilton-development": return hamiltonSnapshot(key, HAMILTON.development);
    case "ottawa-permits": return ottawaPermitSnapshot();
    case "brampton-additional-units": return arcgisSnapshot(key, "https://maps1.brampton.ca/arcgis/rest/services/Two_Unit_Dwellings/Planning_Registered_Additional_Residential_Units/MapServer/0", "7d9df6528d474b43b6771cb7feefc35e", "OBJECTID,FULL_ADDRESS,SECOND_REG,THIRD_REG,FOURTH_REG,WARD");
    case "brampton-heritage": return arcgisSnapshot(key, "https://services3.arcgis.com/rl7ACuZkiFsmDA2g/arcgis/rest/services/Planning_Local_Government/FeatureServer/13", "2511924166364ccab6228b804f0e134d", "OBJECTID,ADDRESS,PROPERTY_NAME,HERITAGE_STATUS");
  }
}

export async function ottawaPermitSnapshot(): Promise<Snapshot> {
  const releases = await parallelMap([...OTTAWA_PERMIT_FILES], 2, async file => {
    const itemUrl = `https://www.arcgis.com/sharing/rest/content/items/${file.item}`;
    const before = await get(itemUrl, { f: "json" });
    if (!validOttawaPermitItem(before, file) || !Number.isInteger(before.modified) || !Number.isInteger(before.size) || Number(before.size) < 1 || Number(before.size) > 6_000_000) throw new Error("Ottawa permit rights/release changed");
    const url = itemUrl + "/data", raw = await bytes(new URL(url), 6_000_000, file);
    if (raw.length !== before.size) throw new Error("Incomplete Ottawa permit file");
    const parsed = parseOttawaPermits(raw, file);
    const after = await get(itemUrl, { f: "json" });
    if (!validOttawaPermitItem(after, file) || before.modified !== after.modified || before.size !== after.size) throw new Error("Ottawa release changed during refresh");
    return { ...parsed, metadata: { itemId: file.item, sourceUrl: url, catalogueModifiedAt: new Date(Number(before.modified)).toISOString(), sha256: createHash("sha256").update(raw).digest("hex"), rowCount: parsed.records.length, reportingPeriods: parsed.reportingPeriods } };
  });
  const periods = releases.flatMap(r => r.reportingPeriods).sort();
  const baseline = Array.from({ length: 32 }, (_, i) => `${2024 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, "0")}`);
  if (new Set(periods).size !== periods.length || !baseline.every(p => periods.includes(p)) || periods.some((p, i) => p !== `${2024 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, "0")}`)) throw new Error("Ottawa reporting months incomplete");
  // Catalogue edit time is metadata, not a claimed dataset observation date.
  return { dataset: "ottawa-permits", retrievedAt: new Date().toISOString(), sourceUpdatedAt: null, rowCount: releases.reduce((n, r) => n + r.records.length, 0), records: releases.flatMap(r => r.records), selectedFields: OTTAWA_PERMIT_FIELDS, sourceRelease: "Ottawa monthly permit reports 2024–2026", reportingPeriods: periods, sourceFiles: releases.map(r => r.metadata) };
}
