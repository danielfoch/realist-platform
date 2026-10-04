import { createHash } from "node:crypto";
import { load } from "cheerio/slim";
import { fetchJson, fetchText, rows } from "./http";
import type { Row } from "./model";
import { WELL_APP, WELL_BUNDLE, WELL_CATALOGUE, WELL_FIELDS, WELL_LICENCE, WELL_MAP, WELL_ROOT, WELL_SOURCE } from "./ontario-wells-sources";

const PACKAGE = "c1a624a7-fbd4-4bc8-8e65-41b294443123";
const ORG = "0f5368c3-b553-4f82-8909-80e8756f24f4";
const BUNDLE_HASH = "f2447ff2cddbdccc2fa7f5e2fdadd2fd4fe8cb5863c1d47dbf6a0a5659383c07";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export function validWellCatalogue(response: Row): boolean {
  const d = response.result as Row | undefined, org = d?.organization as Row | undefined;
  if (response.success !== true || !d || d.id !== PACKAGE || d.name !== "well-records" || d.title !== "Well Records" || d.state !== "active" || d.private !== false || d.owner_org !== ORG || org?.id !== ORG || org.name !== "environment-conservation-and-parks" || org.state !== "active" || d.license_id !== "OGL-ON-1.0" || d.license_url !== WELL_LICENCE || typeof d.notes !== "string" || !d.notes.includes(`](${WELL_MAP})`)) return false;
  const resources = rows(d.resources);
  return [
    ["eff25bb8-d7d3-412d-a2ac-18c0a1a7bccc", "WWIS - GIS Shapefile", "https://files.ontario.ca/moe_mapping/downloads/2Water/Well_Records/WWIS_2026a.zip"],
    ["3031344e-e3f2-48d5-888c-c1deadfd2f77", "Metadata record", "https://files.ontario.ca/moe_mapping/downloads/metadata/opendata/Wells_Records_metadata_EN_2026a.pdf"],
  ].every(([id, name, url]) => resources.some(r => r.id === id && r.name === name && r.url === url && r.package_id === PACKAGE && r.state === "active"));
}
export function validWellLineage(offer: string, index: string, bundleHash: string, bundleHasEndpoint: boolean): boolean {
  const $ = load(offer), app = load(index);
  return $(`iframe[src="${WELL_APP}"]`).length === 1 && app('title').text() === "Well Records" && app('script[src="assets/index-CCQIzaLj.js"]').length === 1 && bundleHash === BUNDLE_HASH && bundleHasEndpoint;
}
export function validWellMetadata(root: Row, m: Row): boolean {
  const fields = rows(m.fields);
  return root.mapName === "Wells" && rows(root.layers).filter(l => l.id === 0 && l.name === "Wells").length === 1 && m.id === 0 && m.name === "Wells" && m.type === "Feature Layer" && m.geometryType === "esriGeometryPoint" && String(m.capabilities).split(",").includes("Query") && (m.advancedQueryCapabilities as Row | undefined)?.supportsQueryWithDistance === true && Object.entries(WELL_FIELDS).every(([name, type]) => fields.filter(f => f.name === name).length === 1 && fields.find(f => f.name === name)?.type === type);
}
export async function wellJson(url: string, params: Record<string, string> = {}): Promise<Row> {
  const u = new URL(url);
  Object.entries({ ...(u.pathname.startsWith("/api/3/action/") ? {} : { f: "json" }), ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetchJson(u) as Row;
  if (!r || typeof r !== "object" || Array.isArray(r) || r.error) throw new Error("Ontario well source unavailable");
  return r;
}
export async function verifyWellSource() {
  // All URLs are fixed audited originals. A new download/app revision needs a source audit.
  const catalogue = await wellJson(WELL_CATALOGUE);
  if (!validWellCatalogue(catalogue)) throw new Error("Ontario well catalogue or grant binding changed");
  const licence = load(await fetchText(new URL(WELL_LICENCE))), section = licence("#main-content .body-field");
  if (section.length !== 1 || sha(section.text().replace(/\s+/g, " ").trim()) !== "87588763e2552bbb40ce62f9f3ae255c8dc7058ac8601c56d1edfd081adf6bb8") throw new Error("Complete Ontario grant changed");
  const offer = await fetchText(new URL(WELL_MAP));
  const index = await fetchText(new URL(WELL_APP));
  const bundle = await fetchText(new URL(WELL_BUNDLE));
  if (!validWellLineage(offer, index, sha(bundle), bundle.includes(WELL_ROOT))) throw new Error("Original Ontario well map/service lineage changed");
  const root = await wellJson(WELL_ROOT), metadata = await wellJson(WELL_SOURCE.url);
  if (!validWellMetadata(root, metadata)) throw new Error("Ontario well service schema changed");
  const d = catalogue.result as Row, resource = rows(d.resources).find(r => r.id === "eff25bb8-d7d3-412d-a2ac-18c0a1a7bccc")!;
  return { catalogueMetadataModifiedAt: d.metadata_modified ?? null, catalogueRefreshFrequency: d.update_frequency ?? null, downloadPublicationDate: resource.data_last_updated ?? null, downloadRangeStart: resource.data_range_start ?? null, downloadRangeEnd: resource.data_range_end ?? null, liveServiceObservationDate: null };
}
