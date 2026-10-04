import { createHash } from "node:crypto";
import { load } from "cheerio/slim";
import { fetchText, rows } from "./http";
import { fabricJson } from "./ontario-fabric-rights";
import type { Row } from "./model";
import { LIDAR_CHILD_NAME, LIDAR_FIELDS, LIDAR_ITEM, LIDAR_LICENCE, LIDAR_MAP, LIDAR_OFFER, LIDAR_ROOT, LIDAR_SOURCE } from "./ontario-lidar-sources";

export function validLidarCatalogue(r: Row): boolean {
  const d = r.result as Row | undefined, org = d?.organization as Row | undefined;
  return r.success === true && !!d && d.id === "7c3d7022-2631-45bc-8f6b-f3d51b7779a7" && d.name === "ontario-digital-terrain-model-lidar-derived" && d.title === "Ontario Digital Terrain Model (Lidar-Derived)" && d.state === "active" && d.private === false && d.owner_org === "22ec1874-e3bb-4368-8db2-e4b0a77eff15" && org?.id === d.owner_org && org.name === "natural-resources" && org.state === "active" && d.license_id === "OGL-ON-1.0" && d.license_url === LIDAR_LICENCE && rows(d.resources).filter(a => a.id === "4f4483c5-3baf-4265-ba1b-bb1cd2a42899" && a.package_id === d.id && a.state === "active" && a.language === "english" && a.url === LIDAR_OFFER).length === 1;
}
export function validLidarItem(r: Row, map = false): boolean {
  const $ = load(typeof r.licenseInfo === "string" ? r.licenseInfo : "");
  return r.id === (map ? LIDAR_MAP : LIDAR_ITEM) && r.owner === "OntarioProvincialMapping" && r.orgId === "TJH5KDher0W13Kgo" && r.access === "public" && r.type === (map ? "Web Map" : "Feature Service") && r.title === (map ? "Ontario Digital Terrain Model (Lidar-Derived)" : LIDAR_SOURCE.name) && (map || r.url === LIDAR_ROOT) && $('a').length === 1 && $('a').attr('href') === LIDAR_LICENCE && $.root().text().trim() === "Open Government Licence – Ontario";
}
export function validLidarMap(r: Row): boolean {
  return rows(r.operationalLayers).filter(a => a.itemId === LIDAR_ITEM && a.url === `${LIDAR_ROOT}/0` && a.layerType === "ArcGISFeatureLayer").length === 1;
}
export function validLidarMetadata(root: Row, child: Row): boolean {
  const fields = rows(child.fields), q = child.advancedQueryCapabilities as Row | undefined;
  return root.serviceItemId === LIDAR_ITEM && rows(root.layers).filter(a => a.id === 0 && a.name === LIDAR_CHILD_NAME && a.type === "Feature Layer" && a.geometryType === "esriGeometryPolygon").length === 1 && child.id === 0 && child.name === LIDAR_CHILD_NAME && child.type === "Feature Layer" && child.geometryType === "esriGeometryPolygon" && String(child.capabilities).split(",").includes("Query") && q?.supportsOrderBy === true && Object.entries(LIDAR_FIELDS).every(([name, type]) => fields.filter(a => a.name === name && a.type === type).length === 1 && fields.filter(a => a.name === name).length === 1) && fields.find(a => a.name === "Resolution")?.alias === "Resolution (m)";
}
export async function verifyLidarSource() {
  const [licence, offer, catalogue, mapItem, mapData, item, root, child] = await Promise.all([
    fetchText(new URL(LIDAR_LICENCE)), fetchText(new URL(LIDAR_OFFER)),
    fabricJson("https://data.ontario.ca/api/3/action/package_show?id=ontario-digital-terrain-model-lidar-derived"),
    fabricJson(`https://www.arcgis.com/sharing/rest/content/items/${LIDAR_MAP}`),
    fabricJson(`https://www.arcgis.com/sharing/rest/content/items/${LIDAR_MAP}/data`),
    fabricJson(`https://www.arcgis.com/sharing/rest/content/items/${LIDAR_ITEM}`), fabricJson(LIDAR_ROOT), fabricJson(`${LIDAR_ROOT}/0`),
  ]);
  const body = load(licence)("#main-content .body-field"), thumbnail = load(offer)('meta[name="twitter:image"]');
  if (body.length !== 1 || createHash("sha256").update(body.text().replace(/\s+/g, " ").trim()).digest("hex") !== "87588763e2552bbb40ce62f9f3ae255c8dc7058ac8601c56d1edfd081adf6bb8" || thumbnail.length !== 1 || !String(thumbnail.attr('content')).startsWith(`https://www.arcgis.com/sharing/rest/content/items/${LIDAR_MAP}/info/thumbnail/`) || !validLidarCatalogue(catalogue) || !validLidarItem(mapItem, true) || !validLidarItem(item) || !validLidarMap(mapData) || !validLidarMetadata(root, child)) throw Error("Original Ontario lidar grant or source binding changed");
  const d = catalogue.result as Row, resource = rows(d.resources).find(a => a.id === "4f4483c5-3baf-4265-ba1b-bb1cd2a42899")!;
  return { catalogueMetadataModifiedAt: d.metadata_modified ?? null, catalogueRefreshFrequency: d.update_frequency ?? null, catalogueResourceRangeStart: resource.data_range_start ?? null, catalogueResourceRangeEnd: resource.data_range_end ?? null, itemMetadataModifiedEpochMilliseconds: item.modified ?? null, publishedDataLastEditEpochMilliseconds: (child.editingInfo as Row | undefined)?.dataLastEditDate ?? null, acquisitionDateVerified: false, liveRasterObservationDate: null };
}
