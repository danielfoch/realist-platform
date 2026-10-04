import { haversineMeters } from "@/lib/geo/geometry";
import { provinceKey } from "./geocode";
import { rows } from "./http";
import { layer, text, type Layer, type Location, type Row } from "./model";
import { verifyWellSource, wellJson } from "./ontario-wells-rights";
import { WELL_FIELDS, WELL_MAP, WELL_NOTE, WELL_RADIUS_METERS, WELL_SOURCE } from "./ontario-wells-sources";

function validPoint(lng: unknown, lat: unknown): boolean {
  return typeof lng === "number" && Number.isFinite(lng) && lng >= -96 && lng <= -74 && typeof lat === "number" && Number.isFinite(lat) && lat >= 41 && lat <= 57;
}
export function wellQueryRecords(r: Row, location: Location) {
  const fields = rows(r.fields);
  if (!Object.entries(WELL_FIELDS).every(([name, type]) => fields.filter(f => f.name === name).length === 1 && fields.find(f => f.name === name)?.type === type)) throw new Error("Well query fields changed");
  const features = rows(r.features);
  if (features.length > 51 || (r.exceededTransferLimit !== undefined && typeof r.exceededTransferLimit !== "boolean")) throw new Error("Invalid well query limit");
  const truncated = r.exceededTransferLimit === true || features.length === 51;
  if (features.length && (r.spatialReference as Row | undefined)?.wkid !== 4326) throw new Error("Unverified well query coordinate system");
  const ids = new Set<number>();
  const records = features.map(f => {
    const a = f.attributes as Row | undefined, g = f.geometry as Row | undefined;
    if (!a || !Object.keys(WELL_FIELDS).every(k => k in a) || !Number.isSafeInteger(a.OBJECTID) || Number(a.OBJECTID) < 1 || ids.has(Number(a.OBJECTID)) || !g || !validPoint(g.x, g.y)) throw new Error("Invalid well identity or geometry");
    ids.add(Number(a.OBJECTID));
    for (const [k, t] of Object.entries(WELL_FIELDS)) {
      if (a[k] !== null && (t === "esriFieldTypeString" ? typeof a[k] !== "string" : typeof a[k] !== "number" || !Number.isFinite(a[k]))) throw new Error("Invalid well field value");
    }
    const distance = haversineMeters(location.latitude!, location.longitude!, Number(g.y), Number(g.x));
    return { distance, record: {
      recordId: String(a.OBJECTID), wellId: text(a.WELL_ID), boreHoleId: a.BORE_HOLE_ID,
      reportedCompletionDate: text(a.WELL_COMPLETED_DATE), reportedReceivedDate: text(a.RECEIVED_DATE), reportedCompletionYear: a.COMPLETED_YEAR,
      reportedFinalStatus: text(a.FINAL_STATUS_DESCR), reportedUses: [text(a.USE1), text(a.USE2)], reportedDepthMeters: a.DEPTH_M,
      reportedCounty: text(a.MOE_COUNTY_DESCR), reportedMunicipality: text(a.MOE_MUNICIPALITY_DESCR), reportedGeographicTownship: text(a.GEOGRAPHIC_TOWNSHIP_NAME),
      approximatePublishedMapPoint: { longitude: g.x, latitude: g.y }, distanceToPublishedMapPointMeters: Math.round(distance),
    } };
  }).filter(r => r.distance <= WELL_RADIUS_METERS).sort((a, b) => a.distance - b.distance).slice(0, 50).map(r => r.record);
  if (!records.length && truncated) throw new Error("Incomplete well query cannot establish no match");
  return { records, truncated, coverageComplete: !truncated, sourceQueryRecordCount: features.length };
}
export async function ontarioWellRecordsLayer(location: Location | null): Promise<Layer> {
  if (!location || location.latitude === null || location.longitude === null) return layer("skipped", null, WELL_SOURCE, "No independently resolved property point for nearby well context.");
  if (provinceKey(location.province ?? "") !== "ontario") return layer("not_supported", null, WELL_SOURCE, "This reported-well source covers Ontario.");
  if (!["source_building_point", "source_civic_address_point", "caller_supplied"].includes(location.accuracy) || !validPoint(location.longitude, location.latitude)) return layer("skipped", null, WELL_SOURCE, "A verified Ontario property point is required; street interpolation is insufficient for nearby well context.");
  try {
    const vintage = await verifyWellSource();
    const r = await wellJson(WELL_SOURCE.url + "/query", { where: "1=1", geometry: `${location.longitude},${location.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", distance: String(WELL_RADIUS_METERS), units: "esriSRUnit_Meter", outFields: Object.keys(WELL_FIELDS).join(","), returnGeometry: "true", outSR: "4326", orderByFields: "OBJECTID ASC", resultRecordCount: "51" });
    const result = wellQueryRecords(r, location);
    return { ...layer(result.records.length ? "available" : "no_match", { assessment: "nearby_reported_well_context", matchMethod: "source_distance_query_and_published_point_distance", coordinateAccuracy: location.accuracy, queryRadiusMeters: WELL_RADIUS_METERS, subjectWellConnectionVerified: false, waterQualityAssessed: false, nearestRankingComplete: !result.truncated, ...result, vintage, verificationUrl: WELL_MAP }, WELL_SOURCE, `${result.truncated ? "Partial result: source query exceeded the 50-record display limit; sorted results are not a complete nearest-well ranking. " : ""}${WELL_NOTE}`), truncated: result.truncated };
  } catch {
    return layer("unavailable", null, WELL_SOURCE, "Ontario well rights, original map/service lineage, schema or bounded nearby query could not be verified. No absence, subject-well connection or water-quality finding was inferred.");
  }
}
export async function ontarioWellRecordsCoverage() {
  let dataset;
  try {
    const vintage = await verifyWellSource(), r = await wellJson(WELL_SOURCE.url + "/query", { where: "1=1", returnCountOnly: "true" });
    if (!Number.isSafeInteger(r.count) || Number(r.count) < 0) throw new Error("Invalid well count");
    dataset = { layer: "ontarioWellRecords", source: WELL_SOURCE, status: "verified", records: r.count, sourceUpdatedAt: null, vintage };
  } catch { dataset = { layer: "ontarioWellRecords", source: WELL_SOURCE, status: "unavailable", records: null, sourceUpdatedAt: null }; }
  return { layer: "ontarioWellRecords", geography: "Ontario; nearby reported-well context only", delivery: "cached_live_queries", cacheSeconds: 3600, datasets: [dataset], note: "Counts describe published well-report rows, not distinct properties or confirmed operating wells. The duplicate Wells_Report child is excluded. " + WELL_NOTE };
}
