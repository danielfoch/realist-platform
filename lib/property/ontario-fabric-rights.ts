import { createHash } from "node:crypto";
import { load } from "cheerio/slim";
import { fetchJson, fetchText, rows } from "./http";
import type { Row } from "./model";
import { FABRIC_LICENCE, FABRIC_ROOT, type FabricFeed } from "./ontario-fabric-sources";

export async function fabricJson(url: string, params: Record<string, string> = {}): Promise<Row> {
  const u = new URL(url); Object.entries({ ...(u.pathname.startsWith("/api/3/action/") ? {} : { f: "json" }), ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetchJson(u) as Row;
  if (!r || typeof r !== "object" || Array.isArray(r) || r.error) throw Error("Ontario fabric source unavailable");
  return r;
}
export function validFabricCatalogue(r: Row, f: FabricFeed): boolean {
  const d = r.result as Row | undefined, org = d?.organization as Row | undefined;
  return r.success === true && !!d && d.id === f.packageId && d.name === f.slug && d.title === f.title && d.state === "active" && d.private === false && d.owner_org === "22ec1874-e3bb-4368-8db2-e4b0a77eff15" && org?.id === d.owner_org && org.name === "natural-resources" && org.state === "active" && d.license_id === "OGL-ON-1.0" && d.license_url === FABRIC_LICENCE && rows(d.resources).filter(a => a.id === f.resourceId && a.package_id === f.packageId && a.state === "active" && a.language === "english" && a.name === f.title && a.url === `https://geohub.lio.gov.on.ca/datasets/${f.slug}`).length === 1;
}
export function validFabricItem(r: Row, f: FabricFeed): boolean {
  const $ = load(typeof r.licenseInfo === "string" ? r.licenseInfo : "");
  return r.id === f.item && r.owner === "LandInformationOntario" && r.orgId === "a03W7iZ8T3s5vB7p" && r.access === "public" && r.type === "Feature Service" && r.title === f.title && r.url === f.source.url && $('a').length === 1 && $('a').attr('href') === FABRIC_LICENCE && $.root().text().trim() === "Open Government Licence – Ontario";
}
export function validFabricMetadata(root: Row, m: Row, f: FabricFeed): boolean {
  const fields = rows(m.fields), q = m.advancedQueryCapabilities as Row | undefined;
  return root.mapName === "service06" && rows(root.layers).filter(a => a.id === f.child && a.name === f.name && a.type === "Feature Layer" && a.geometryType === "esriGeometryPolygon").length === 1 && m.id === f.child && m.name === f.name && m.type === "Feature Layer" && m.geometryType === "esriGeometryPolygon" && m.copyrightText === FABRIC_LICENCE && String(m.capabilities).split(",").includes("Query") && q?.supportsOrderBy === true && Object.entries(f.fields).every(([name, type]) => fields.filter(a => a.name === name && a.type === type).length === 1 && fields.filter(a => a.name === name).length === 1);
}
export async function verifyFabricGrant() {
  const $ = load(await fetchText(new URL(FABRIC_LICENCE))), body = $("#main-content .body-field");
  if (body.length !== 1 || createHash("sha256").update(body.text().replace(/\s+/g, " ").trim()).digest("hex") !== "87588763e2552bbb40ce62f9f3ae255c8dc7058ac8601c56d1edfd081adf6bb8") throw Error("Complete Ontario fabric grant changed");
  return { root: await fabricJson(FABRIC_ROOT) };
}
export async function verifyFabricFeed(f: FabricFeed, shared: Awaited<ReturnType<typeof verifyFabricGrant>>) {
  const catalogue = await fabricJson(`https://data.ontario.ca/api/3/action/package_show?id=${f.slug}`);
  if (!validFabricCatalogue(catalogue, f)) throw Error("Ontario fabric catalogue binding changed");
  const offer = load(await fetchText(new URL(`https://geohub.lio.gov.on.ca/datasets/${f.slug}`))), image = offer('meta[name="twitter:image"]');
  if (image.length !== 1 || !String(image.attr('content')).startsWith(`https://www.arcgis.com/sharing/rest/content/items/${f.item}_${f.child}/info/thumbnail/`)) throw Error("Ontario fabric resource offer changed");
  const item = await fabricJson(`https://www.arcgis.com/sharing/rest/content/items/${f.item}`);
  if (!validFabricItem(item, f) || !validFabricMetadata(shared.root, await fabricJson(f.source.url), f)) throw Error("Ontario fabric publisher, grant or typed child changed");
  const d = catalogue.result as Row, resource = rows(d.resources).find(a => a.id === f.resourceId)!;
  return { catalogueMetadataModifiedAt: d.metadata_modified ?? null, catalogueRefreshFrequency: d.update_frequency ?? null, catalogueResourcePublicationDate: resource.data_last_updated ?? null, catalogueResourceRangeStart: resource.data_range_start ?? null, catalogueResourceRangeEnd: resource.data_range_end ?? null, itemMetadataModifiedEpochMilliseconds: item.modified ?? null, liveServiceObservationDate: null, dateFieldTimezoneVerified: false };
}
