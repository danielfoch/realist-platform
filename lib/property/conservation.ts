import { fetchJson, rows } from "./http";
import { layer, text, number, type Layer, type Location, type Row, type Source } from "./model";
import { provinceKey } from "./geocode";

const BASE = "https://gis.lsrca.on.ca/gis/rest/services/OpenData/MapServer";
const ATTRIBUTION = "Contains Information made available under Lake Simcoe Region Conservation Authority Open Data Licence v1.0. https://lsrca.on.ca/index.php/home/open-data/";
export const CONSERVATION_SOURCE: Source = { id: "lsrca:open-data", name: "Lake Simcoe Region Conservation Authority open GIS data", url: "https://lsrca.on.ca/index.php/home/open-data/", licence: "LSRCA Open Data Licence v1.0", attribution: ATTRIBUTION };
const FEEDS = [
  { key: "regulationLimit", id: 36, name: "Regulation limit", fields: "OBJECTID,RAREAID,SUBWATERSHED,APPROVALDATE" },
  { key: "regulatedWetlands", id: 19, name: "Regulated wetlands with adjacent lands", fields: "OBJECTID,WL_AREAID,PUBLISH_DATE" },
  { key: "floodplain", id: 76, name: "Mapped floodplain", fields: "OBJECTID,PUBLISH_DATE,STORM_LEVEL,FLOODPLAIN_TYPE" },
  { key: "shorelineHazard", id: 58, name: "Lake shoreline hazard", fields: "OBJECTID,SHORELINEHAZARD_ID,PUBLISH_DATE" },
  { key: "shorelineFlood", id: 59, name: "Lake shoreline flood hazard", fields: "OBJECTID,ID" },
  { key: "shorelineErosion", id: 60, name: "Lake shoreline erosion hazard", fields: "OBJECTID,REACH" },
];
const sourceFor = (id: number, name: string): Source => ({ ...CONSERVATION_SOURCE, id: `lsrca:${id}`, name: `LSRCA ${name}`, url: `${BASE}/${id}/iteminfo` });
const timestamp = (v: unknown): string | null => {
  const n = number(v);
  if (n === null) return text(v);
  if (n < 0 || n > 8_640_000_000_000_000) return null;
  return new Date(n).toISOString();
};
async function atPoint(id: number, fields: string, location: Location): Promise<Row[]> {
  const url = new URL(`${BASE}/${id}/query`);
  for (const [key, value] of Object.entries({ f: "json", where: "1=1", geometry: `${location.longitude},${location.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: fields, returnGeometry: "false", resultRecordCount: "51" })) url.searchParams.set(key, value);
  const response = await fetchJson(url, 6500) as { error?: unknown; features?: unknown; exceededTransferLimit?: boolean; fields?: { name: string }[] };
  if (response.error || response.exceededTransferLimit || !Array.isArray(response.fields) || !fields.split(",").every(name => response.fields!.some(f => f.name === name))) throw new Error("Incomplete spatial source response");
  const matches = rows(response.features).map(feature => {
    const attributes = feature.attributes;
    if (!attributes || typeof attributes !== "object" || Array.isArray(attributes) || !("OBJECTID" in attributes)) throw new Error("Invalid spatial feature");
    return attributes as Row;
  });
  if (matches.length >= 51) throw new Error("Spatial source candidate bound exceeded");
  return matches;
}
export async function conservationLayer(location: Location | null): Promise<Layer> {
  const caution = "Point intersections at the published building point or verified caller coordinates, not a parcel-wide search. Mapping is screening evidence: no intersection is not proof of no regulation, no wetlands or flood safety. Verify boundary proximity and current authority requirements. Some shoreline layers have no published observation date.";
  if (!location || location.latitude === null || location.longitude === null) return layer("skipped", null, CONSERVATION_SOURCE, "No resolved property coordinates.");
  if (location.province && provinceKey(location.province) !== "ontario") return layer("not_supported", null, CONSERVATION_SOURCE, "These feeds cover the Lake Simcoe watershed in Ontario.");
  if (!["source_building_point", "caller_supplied"].includes(location.accuracy)) return layer("skipped", null, CONSERVATION_SOURCE, "Street or blockface interpolation is insufficient for constraint intersections. Supply verified property coordinates.");
  // Cheap geographic guard, followed by the source's actual mapped watershed test.
  if (location.latitude < 43.8 || location.latitude > 45.0 || location.longitude < -80.3 || location.longitude > -78.8) return layer("not_supported", null, CONSERVATION_SOURCE, "Outside the Lake Simcoe source search envelope; other conservation authorities are not searched.");
  let watershed: Row[];
  try { watershed = await atPoint(20, "OBJECTID,WATERSHEDNAME", location); }
  catch { return layer("unavailable", null, CONSERVATION_SOURCE, "Lake Simcoe watershed coverage query failed; no constraint absence was inferred."); }
  if (!watershed.length) return layer("not_supported", null, sourceFor(20, "mapped scientific watershed"), "No intersection with the mapped Lake Simcoe scientific watershed. This does not determine conservation jurisdiction or regulation elsewhere.");
  const attempts = await Promise.all(FEEDS.map(async feed => {
    const source = sourceFor(feed.id, feed.name);
    try {
      const matches = await atPoint(feed.id, feed.fields, location);
      const records = matches.map(r => ({ recordId: String(r.OBJECTID), matchMethod: "point_intersection", geometryScope: location.accuracy === "source_building_point" ? "building_point" : "caller_supplied_point", publishedDate: timestamp(r.PUBLISH_DATE), approvedDate: timestamp(r.APPROVALDATE), subwatershed: text(r.SUBWATERSHED), floodplainType: text(r.FLOODPLAIN_TYPE), stormLevel: text(r.STORM_LEVEL) ?? number(r.STORM_LEVEL), shorelineReach: text(r.REACH) ?? number(r.REACH) }));
      return [feed.key, layer(matches.length ? "available" : "no_match", { records }, source, caution)] as const;
    } catch { return [feed.key, layer("unavailable", null, source, "Source query failed or exceeded the candidate bound; no absence was inferred.")] as const; }
  }));
  const datasets = Object.fromEntries(attempts);
  const found = attempts.some(([, value]) => value.status === "available");
  const incomplete = attempts.some(([, value]) => value.status === "unavailable");
  const result = layer(found ? "available" : incomplete ? "unavailable" : "no_match", { authority: "Lake Simcoe Region Conservation Authority", watershed: watershed.map(r => text(r.WATERSHEDNAME)), coordinateAccuracy: location.accuracy, geometryScope: location.accuracy === "source_building_point" ? "building_point" : "caller_supplied_point", datasets }, CONSERVATION_SOURCE, `${incomplete ? "Incomplete: one or more constraint feeds could not be read. " : ""}${caution}`);
  result.truncated = incomplete;
  return result;
}
export function conservationCoverage() {
  return { layer: "conservation", geography: "Mapped Lake Simcoe scientific watershed; building-point screening only", delivery: "cached_live_queries", source: CONSERVATION_SOURCE, datasets: FEEDS.map(feed => ({ layer: feed.key, source: sourceFor(feed.id, feed.name) })), cacheSeconds: 3600, timeoutPerSourceSeconds: 6.5, note: "Other conservation authorities and parcel-wide overlaps are not covered. No-intersection does not establish flood safety or absence of regulation." };
}
