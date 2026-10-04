import { createHash } from "node:crypto";
import { load } from "cheerio/slim";
import { fetchText, rows } from "./http";
import { fabricJson } from "./ontario-fabric-rights";
import type { Row } from "./model";
import { SPA_FIELDS, SPA_ITEM, SPA_LICENCE, SPA_NAME, SPA_OFFER, SPA_ROOT, SPA_SOURCE } from "./ontario-source-protection-sources";

export function validSpaCatalogue(r: Row): boolean {
  const d = r.result as Row | undefined, org = d?.organization as Row | undefined;
  return r.success === true && !!d && d.id === "6dc5dd56-bf09-409d-91a4-619203313301" && d.name === "source-protection-area-generalized" && d.title === SPA_NAME && d.state === "active" && d.private === false && d.owner_org === "0f5368c3-b553-4f82-8909-80e8756f24f4" && org?.id === d.owner_org && org.name === "environment-conservation-and-parks" && org.state === "active" && d.license_id === "OGL-ON-1.0" && d.license_url === SPA_LICENCE && rows(d.resources).filter(a => a.id === "4a781374-7612-4acb-98c0-d57e78161210" && a.package_id === d.id && a.state === "active" && a.language === "english" && a.url === SPA_OFFER).length === 1;
}
export function validSpaItem(r: Row): boolean {
  const $ = load(typeof r.licenseInfo === "string" ? r.licenseInfo : "");
  return r.id === SPA_ITEM && r.owner === "LandInformationOntario" && r.orgId === "a03W7iZ8T3s5vB7p" && r.access === "public" && r.type === "Feature Service" && r.title === SPA_NAME && r.url === SPA_SOURCE.url && $('a').length === 1 && $('a').attr('href') === SPA_LICENCE && $.root().text().trim() === "Open Government Licence – Ontario";
}
export function validSpaMetadata(root: Row, child: Row): boolean {
  const fields = rows(child.fields), q = child.advancedQueryCapabilities as Row | undefined;
  return root.mapName === "service05" && rows(root.layers).filter(a => a.id === 2 && a.name === SPA_NAME && a.type === "Feature Layer" && a.geometryType === "esriGeometryPolygon").length === 1 && child.id === 2 && child.name === SPA_NAME && child.type === "Feature Layer" && child.geometryType === "esriGeometryPolygon" && child.copyrightText === SPA_LICENCE && String(child.capabilities).split(",").includes("Query") && q?.supportsOrderBy === true && Object.entries(SPA_FIELDS).every(([name, type]) => fields.filter(a => a.name === name && a.type === type).length === 1 && fields.filter(a => a.name === name).length === 1);
}
export async function verifySpaSource() {
  const [licence, offer, catalogue, item, root, child] = await Promise.all([fetchText(new URL(SPA_LICENCE)), fetchText(new URL(SPA_OFFER)), fabricJson("https://data.ontario.ca/api/3/action/package_show?id=source-protection-area-generalized"), fabricJson(`https://www.arcgis.com/sharing/rest/content/items/${SPA_ITEM}`), fabricJson(SPA_ROOT), fabricJson(SPA_SOURCE.url)]);
  const body = load(licence)("#main-content .body-field"), thumbnail = load(offer)('meta[name="twitter:image"]');
  if (body.length !== 1 || createHash("sha256").update(body.text().replace(/\s+/g, " ").trim()).digest("hex") !== "87588763e2552bbb40ce62f9f3ae255c8dc7058ac8601c56d1edfd081adf6bb8" || thumbnail.length !== 1 || !String(thumbnail.attr('content')).startsWith(`https://www.arcgis.com/sharing/rest/content/items/${SPA_ITEM}_2/info/thumbnail/`) || !validSpaCatalogue(catalogue) || !validSpaItem(item) || !validSpaMetadata(root, child)) throw Error("Original source-protection grant or source binding changed");
  const d = catalogue.result as Row, resource = rows(d.resources).find(a => a.id === "4a781374-7612-4acb-98c0-d57e78161210")!;
  return { catalogueMetadataModifiedAt: d.metadata_modified ?? null, catalogueRefreshFrequency: d.update_frequency ?? null, catalogueResourcePublicationDate: resource.data_last_updated ?? null, catalogueResourceRangeStart: resource.data_range_start ?? null, catalogueResourceRangeEnd: resource.data_range_end ?? null, itemMetadataModifiedEpochMilliseconds: item.modified ?? null, publishedDataLastEditEpochMilliseconds: (child.editingInfo as Row | undefined)?.dataLastEditDate ?? null, liveServiceObservationDate: null, dateFieldTimezoneVerified: false, currentPlanPolicyDateVerified: false };
}
