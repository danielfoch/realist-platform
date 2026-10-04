import { provinceKey } from "./geocode";
import { rows } from "./http";
import { layer, text, type Layer, type Location, type Row } from "./model";
import { fabricJson } from "./ontario-fabric-rights";
import { verifyLidarSource } from "./ontario-lidar-rights";
import { LIDAR_FIELDS, LIDAR_KEY, LIDAR_NOTE, LIDAR_SOURCE } from "./ontario-lidar-sources";

export function lidarQueryRecords(r: Row) {
  const features = rows(r.features), ids = new Set<number>();
  if (r.objectIdFieldName !== "OBJECTID" || features.length > 51 || (r.exceededTransferLimit !== undefined && typeof r.exceededTransferLimit !== "boolean")) throw Error("Invalid lidar query identity or limit");
  // Native complete empty responses omit fields; nonempty responses must carry the selected typed schema.
  if (features.length || r.fields !== undefined) {
    const fields = rows(r.fields);
    if (!Object.entries(LIDAR_FIELDS).every(([name, type]) => fields.filter(a => a.name === name && a.type === type).length === 1 && fields.filter(a => a.name === name).length === 1) || fields.find(a => a.name === "Resolution")?.alias !== "Resolution (m)") throw Error("Invalid lidar query schema");
  }
  const truncated = r.exceededTransferLimit === true || features.length === 51;
  const records = features.map(f => {
    const a = f.attributes as Row | undefined;
    if (!a || typeof a !== "object" || Array.isArray(a) || !Object.keys(LIDAR_FIELDS).every(k => k in a) || !Number.isSafeInteger(a.OBJECTID) || Number(a.OBJECTID) < 1 || ids.has(Number(a.OBJECTID)) || (a.Package !== null && typeof a.Package !== "string") || (a.Project !== null && typeof a.Project !== "string") || (a.Resolution !== null && (typeof a.Resolution !== "number" || !Number.isFinite(a.Resolution) || a.Resolution <= 0))) throw Error("Invalid lidar package attributes");
    ids.add(Number(a.OBJECTID));
    return { recordId: String(a.OBJECTID), reportedPackage: text(a.Package), reportedProject: text(a.Project), reportedRasterResolutionM: a.Resolution, elevationM: null, actualRasterCoverageVerified: false, acquisitionDateVerified: false };
  }).slice(0, 50);
  if (!records.length && truncated) throw Error("Incomplete lidar query cannot establish no match");
  return { records, truncated, queryCoverageComplete: !truncated, sourceQueryRecordCount: features.length };
}
export async function ontarioLidarLayer(p: Location | null): Promise<Layer> {
  if (!p || p.latitude === null || p.longitude === null) return layer("skipped", null, LIDAR_SOURCE, "No independently resolved point for original lidar package references.");
  if (provinceKey(p.province ?? "") !== "ontario") return layer("not_supported", null, LIDAR_SOURCE, "This original lidar package index covers Ontario.");
  if (!["source_building_point", "source_civic_address_point", "caller_supplied"].includes(p.accuracy) || !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude) || p.latitude < 41 || p.latitude > 57 || p.longitude < -96 || p.longitude > -74) return layer("skipped", null, LIDAR_SOURCE, "A verified Ontario point is required; interpolated, ambiguous or invalid coordinates do not screen lidar references.");
  try {
    const vintage = await verifyLidarSource(), result = lidarQueryRecords(await fabricJson(`${LIDAR_SOURCE.url}/query`, { where: "1=1", geometry: `${p.longitude},${p.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: Object.keys(LIDAR_FIELDS).join(","), returnGeometry: "false", orderByFields: "OBJECTID ASC", resultRecordCount: "51" }));
    return { ...layer(result.truncated ? "ambiguous" : result.records.length ? "available" : "no_match", { assessment: "lidar_package_index_reference", matchMethod: "published_index_polygon_intersects_independent_point", coordinateAccuracy: p.accuracy, coverageComplete: false, absenceEstablished: false, parcelWideScreenPerformed: false, sourceGeometryReused: false, actualRasterCoverageVerified: false, rasterSamplePerformed: false, elevationM: null, ...result, vintage }, LIDAR_SOURCE, LIDAR_NOTE), truncated: result.truncated };
  } catch { return layer("unavailable", null, LIDAR_SOURCE, "Original Ontario lidar grant, catalogue/map/item/typed-child lineage or bounded index query could not be verified. No elevation, terrain coverage or absence finding was inferred."); }
}
export async function ontarioLidarCoverage() {
  let dataset;
  try {
    const vintage = await verifyLidarSource(), r = await fabricJson(`${LIDAR_SOURCE.url}/query`, { where: "1=1", returnCountOnly: "true" });
    if (!Number.isSafeInteger(r.count) || Number(r.count) < 0) throw Error("Invalid lidar package count");
    dataset = { layer: LIDAR_KEY, source: LIDAR_SOURCE, status: "verified", records: r.count, sourceUpdatedAt: null, vintage };
  } catch { dataset = { layer: LIDAR_KEY, source: LIDAR_SOURCE, status: "unavailable", records: null, sourceUpdatedAt: null }; }
  return { layer: "ontarioLidarPackageIndex", geography: "Ontario lidar package reference", delivery: "cached_live_queries", cacheSeconds: 3600, datasets: [dataset], note: "Count measures overlapping download-package index polygons, not lidar pixels, properties, data points or imports. French duplicate offers and the raster service are not counted. " + LIDAR_NOTE };
}
