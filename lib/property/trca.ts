import { fetchJson, rows } from "./http";
import { layer, text, type Layer, type Location, type Source } from "./model";
import { provinceKey } from "./geocode";

const BASE = "https://services1.arcgis.com/d0ZCwU7eGKVeNiEE/arcgis/rest/services/TRCA_Regulation_Limit2/FeatureServer/0";
export const TRCA_SOURCE: Source = {
  id: "trca:regulated-area-2025", name: "TRCA RegulationLimit_2025",
  url: "https://trca-camaps.opendata.arcgis.com/datasets/camaps::trca-regulated-area",
  licence: "TRCA Open Data Licence v1.0",
  attribution: "Contains information made available by Toronto and Region Conservation Authority under the TRCA Open Data Licence v1.0. https://trca.ca/about/open-data-licence/",
};
const CAUTION = "Published point screening against the conceptual 2025 regulation limit, not a parcel-wide or precise engineering boundary. Unmapped features may still be regulated. No intersection does not establish absence of regulation or flood safety. Confirm the current requirements with TRCA.";
export async function trcaLayer(location: Location | null): Promise<Layer> {
  if (!location || location.latitude === null || location.longitude === null) return layer("skipped", null, TRCA_SOURCE, "No resolved coordinates.");
  if (location.province && provinceKey(location.province) !== "ontario") return layer("not_supported", null, TRCA_SOURCE, "TRCA mapping is in Ontario.");
  if (!["source_building_point", "caller_supplied"].includes(location.accuracy)) return layer("skipped", null, TRCA_SOURCE, "This adapter requires a published building point or verified caller coordinates. Municipal civic, street and blockface points are not used for this TRCA screen.");
  if (location.latitude < 43.5 || location.latitude > 44.3 || location.longitude < -80.1 || location.longitude > -78.6) return layer("not_supported", null, TRCA_SOURCE, "Outside this source's search envelope; other authorities are not searched by this layer.");
  try {
    const metadata = await fetchJson(new URL(`${BASE}?f=json`), 5000) as { name?: string; fields?: { name: string }[]; editingInfo?: { dataLastEditDate?: number } };
    const fields = ["OBJECTID", "criteria_layers_contribution"];
    if (metadata.name !== "RegulationLimit_2025" || !fields.every(name => metadata.fields?.some(f => f.name === name))) throw new Error("Source version changed");
    const url = new URL(`${BASE}/query`);
    for (const [key, value] of Object.entries({ f: "json", where: "1=1", geometry: `${location.longitude},${location.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "OBJECTID,criteria_layers_contribution", returnGeometry: "false", resultRecordCount: "51" })) url.searchParams.set(key, value);
    const result = await fetchJson(url, 6500) as { error?: unknown; exceededTransferLimit?: boolean; fields?: { name: string }[]; features?: unknown };
    // ArcGIS omits `fields` on a valid empty result; bind the schema to the verified metadata above.
    if (result.error || result.exceededTransferLimit || result.fields && !fields.every(name => result.fields?.some(f => f.name === name))) throw new Error("Incomplete source response");
    const records = rows(result.features).map(f => {
      const r = f.attributes as Record<string, unknown> | undefined;
      if (!r || r.OBJECTID === undefined || r.OBJECTID === null || r.criteria_layers_contribution === undefined) throw new Error("Invalid feature");
      return { recordId: String(r.OBJECTID), publishedCriteria: text(r.criteria_layers_contribution), matchMethod: "point_intersection" };
    });
    if (records.length >= 51) throw new Error("Candidate bound exceeded");
    const sourceDate = metadata.editingInfo?.dataLastEditDate;
    return layer(records.length ? "available" : "no_match", { authority: "Toronto and Region Conservation Authority", mappingVersion: "2025", geometryScope: location.accuracy === "source_building_point" ? "building_point" : "caller_supplied_point", records }, TRCA_SOURCE, CAUTION, sourceDate ? new Date(sourceDate).toISOString() : null);
  } catch { return layer("unavailable", null, TRCA_SOURCE, "TRCA version/schema/query could not be verified; no absence was inferred."); }
}
export function trcaCoverage() { return { layer: "trca", geography: "TRCA published 2025 regulation limit", delivery: "cached_live_queries", source: TRCA_SOURCE, cacheSeconds: 3600, note: CAUTION }; }
