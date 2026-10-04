import { createHash } from "node:crypto";
import { load } from "cheerio/slim";
import { fetchJson, fetchText, rows } from "./http";
import type { Row } from "./model";
import { AGGREGATE_CATALOGUE, AGGREGATE_FEEDS, AGGREGATE_LICENCE, AGGREGATE_ROOT, aggregateFields, type AggregateFeed } from "./ontario-aggregates-sources";

const PACKAGE = "69b95513-a28a-4d0c-b70c-483ea17882f3", ORG = "22ec1874-e3bb-4368-8db2-e4b0a77eff15";
export function validAggregateCatalogue(r: Row): boolean {
  const d = r.result as Row | undefined, org = d?.organization as Row | undefined;
  if (r.success !== true || !d || d.id !== PACKAGE || d.name !== "aggregate-site-authorized" || d.title !== "Aggregate Site Authorized" || d.state !== "active" || d.private !== false || d.owner_org !== ORG || org?.id !== ORG || org.name !== "natural-resources" || org.state !== "active" || d.license_id !== "OGL-ON-1.0" || d.license_url !== AGGREGATE_LICENCE) return false;
  return AGGREGATE_FEEDS.every(f => rows(d.resources).filter(a => a.id === f.resourceId && a.name === f.resourceName && a.url === `https://geohub.lio.gov.on.ca/datasets/${f.item}_${f.child}` && a.package_id === PACKAGE && a.state === "active").length === 1);
}
export function validAggregateItem(r: Row, f: AggregateFeed): boolean {
  const grant = load(typeof r.licenseInfo === "string" ? r.licenseInfo : "");
  return r.id === f.item && r.owner === "LandInformationOntario" && r.orgId === "a03W7iZ8T3s5vB7p" && r.access === "public" && r.type === "Feature Service" && r.title === f.title && r.url === f.source.url && grant('a').length === 1 && grant('a').attr('href') === AGGREGATE_LICENCE && grant('a').text() === "Open Government Licence – Ontario" && grant.root().text().trim() === "Open Government Licence – Ontario";
}
export function validAggregateMetadata(root: Row, m: Row, f: AggregateFeed): boolean {
  const fields = rows(m.fields), capabilities = m.advancedQueryCapabilities as Row | undefined;
  return root.mapName === "service05" && rows(root.layers).filter(l => l.id === f.child && l.name === f.name && l.type === "Feature Layer" && l.geometryType === "esriGeometryPolygon").length === 1 && m.id === f.child && m.name === f.name && m.type === "Feature Layer" && m.geometryType === "esriGeometryPolygon" && m.copyrightText === AGGREGATE_LICENCE && String(m.capabilities).split(",").includes("Query") && capabilities?.supportsQueryWithDistance === true && capabilities.supportsOrderBy === true && Object.entries(aggregateFields(f)).every(([name, type]) => fields.filter(a => a.name === name).length === 1 && fields.find(a => a.name === name)?.type === type);
}
export async function aggregateJson(url: string, params: Record<string, string> = {}): Promise<Row> {
  const u = new URL(url);
  Object.entries({ ...(u.pathname.startsWith("/api/3/action/") ? {} : { f: "json" }), ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetchJson(u) as Row;
  if (!r || typeof r !== "object" || Array.isArray(r) || r.error) throw new Error("Aggregate source unavailable");
  return r;
}
export async function verifyAggregateGrant() {
  const catalogue = await aggregateJson(AGGREGATE_CATALOGUE);
  if (!validAggregateCatalogue(catalogue)) throw new Error("Aggregate catalogue or grant binding changed");
  const grant = load(await fetchText(new URL(AGGREGATE_LICENCE))), section = grant("#main-content .body-field");
  if (section.length !== 1 || createHash("sha256").update(section.text().replace(/\s+/g, " ").trim()).digest("hex") !== "87588763e2552bbb40ce62f9f3ae255c8dc7058ac8601c56d1edfd081adf6bb8") throw new Error("Complete Ontario grant changed");
  return { catalogue: catalogue.result as Row, root: await aggregateJson(AGGREGATE_ROOT) };
}
export async function verifyAggregateFeed(f: AggregateFeed, shared: Awaited<ReturnType<typeof verifyAggregateGrant>>) {
  const item = await aggregateJson(`https://www.arcgis.com/sharing/rest/content/items/${f.item}`);
  if (!validAggregateItem(item, f)) throw new Error("Original aggregate publisher/item/typed child changed");
  if (!validAggregateMetadata(shared.root, await aggregateJson(f.source.url), f)) throw new Error("Aggregate child schema changed");
  const resource = rows(shared.catalogue.resources).find(r => r.id === f.resourceId)!;
  return { catalogueMetadataModifiedAt: shared.catalogue.metadata_modified ?? null, catalogueRefreshFrequency: shared.catalogue.update_frequency ?? null, catalogueResourcePublicationDate: resource.data_last_updated ?? null, catalogueResourceRangeStart: resource.data_range_start ?? null, catalogueResourceRangeEnd: resource.data_range_end ?? null, itemMetadataModifiedEpochMilliseconds: item.modified ?? null, liveServiceObservationDate: null, dateFieldTimezoneVerified: false };
}
