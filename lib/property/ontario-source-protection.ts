import { provinceKey } from "./geocode";
import { rows } from "./http";
import { layer, text, type Layer, type Location, type Row } from "./model";
import { fabricJson } from "./ontario-fabric-rights";
import { verifySpaSource } from "./ontario-source-protection-rights";
import { HISTORICAL_SPA, HISTORICAL_SPR, SPA_FIELDS, SPA_KEY, SPA_LOOKUP, SPA_NOTE, SPA_SOURCE } from "./ontario-source-protection-sources";

export function spaQueryRecords(r: Row) {
  const features = rows(r.features), fields = rows(r.fields), ids = new Set<number>();
  // This original MapServer omits objectIdFieldName; require the selected typed OID even for empty responses.
  if (!Array.isArray(r.features) || features.length !== r.features.length || features.length > 51 || (r.objectIdFieldName !== undefined && r.objectIdFieldName !== "OBJECTID") || r.displayFieldName !== "LEAD_SPA" || (r.exceededTransferLimit !== undefined && typeof r.exceededTransferLimit !== "boolean") || !Object.entries(SPA_FIELDS).every(([name, type]) => fields.filter(a => a.name === name && a.type === type).length === 1 && fields.filter(a => a.name === name).length === 1)) throw Error("Invalid source-protection query identity or schema");
  const truncated = r.exceededTransferLimit === true || features.length === 51;
  const records = features.map(f => {
    const a = f.attributes as Row | undefined;
    if (!a || typeof a !== "object" || Array.isArray(a) || !Object.keys(SPA_FIELDS).every(k => k in a) || !Number.isSafeInteger(a.OBJECTID) || Number(a.OBJECTID) < 1 || ids.has(Number(a.OBJECTID)) || !["OGF_ID", "SPP_ID", "SPR_ID"].every(k => a[k] === null || (Number.isSafeInteger(a[k]) && Number(a[k]) >= 0)) || !["LEAD_SPA", "FTYPE", "LOCATION_ACCURACY"].every(k => a[k] === null || typeof a[k] === "string") || !["GEOMETRY_UPDATE_DATETIME", "EFFECTIVE_DATETIME", "SYSTEM_DATETIME"].every(k => a[k] === null || Number.isSafeInteger(a[k]))) throw Error("Invalid source-protection attributes");
    ids.add(Number(a.OBJECTID));
    const area = a.SPP_ID === null ? undefined : HISTORICAL_SPA[Number(a.SPP_ID)], region = a.SPR_ID === null ? undefined : HISTORICAL_SPR[Number(a.SPR_ID)];
    return { recordId: String(a.OBJECTID), reportedProvincialId: a.OGF_ID, reportedSourceProtectionAreaId: a.SPP_ID, reportedSourceProtectionRegionId: a.SPR_ID, historicalAreaName: area?.[0] ?? null, historicalRegionName: region ?? null, historicalAreaRegionIdsAgree: !area || a.SPR_ID === null ? null : area[1] === a.SPR_ID, reportedAdministrativeLeadLabel: text(a.LEAD_SPA), reportedLandformType: text(a.FTYPE), reportedLocationAccuracy: text(a.LOCATION_ACCURACY), geometryUpdatedEpochMilliseconds: a.GEOMETRY_UPDATE_DATETIME, recordEffectiveEpochMilliseconds: a.EFFECTIVE_DATETIME, systemEpochMilliseconds: a.SYSTEM_DATETIME, currentNamesVerified: false, currentLegalBoundaryVerified: false, currentPlanPolicyDateVerified: false };
  }).slice(0, 50);
  if (!records.length && truncated) throw Error("Incomplete source-protection query cannot establish no match");
  return { records, truncated, queryCoverageComplete: !truncated, sourceQueryRecordCount: features.length };
}
export async function ontarioSourceProtectionLayer(p: Location | null): Promise<Layer> {
  if (!p || p.latitude === null || p.longitude === null) return layer("skipped", null, SPA_SOURCE, "No independently resolved point for original generalized source-protection references.");
  if (provinceKey(p.province ?? "") !== "ontario") return layer("not_supported", null, SPA_SOURCE, "This original generalized source-protection reference covers Ontario.");
  if (!["source_building_point", "source_civic_address_point", "caller_supplied"].includes(p.accuracy) || !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude) || p.latitude < 41 || p.latitude > 57 || p.longitude < -96 || p.longitude > -74) return layer("skipped", null, SPA_SOURCE, "A verified Ontario point is required; interpolated, ambiguous or invalid coordinates do not screen source-protection references.");
  try {
    const vintage = await verifySpaSource(), result = spaQueryRecords(await fabricJson(`${SPA_SOURCE.url}/query`, { where: "1=1", geometry: `${p.longitude},${p.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: Object.keys(SPA_FIELDS).join(","), returnGeometry: "false", orderByFields: "OBJECTID ASC", resultRecordCount: "51" }));
    const ambiguous = result.truncated || result.records.length > 1 || result.records.some(a => a.historicalAreaRegionIdsAgree === false);
    return { ...layer(ambiguous ? "ambiguous" : result.records.length ? "available" : "no_match", { assessment: "generalized_source_protection_area_reference", matchMethod: "generalized_polygon_intersects_independent_point", coordinateAccuracy: p.accuracy, coverageComplete: false, absenceEstablished: false, parcelWideScreenPerformed: false, sourceGeometryReused: false, legalBoundaryScreenPerformed: false, vulnerableAreaScreenPerformed: false, waterQualityAssessed: false, currentNamesVerified: false, lookup: SPA_LOOKUP, ...result, vintage }, SPA_SOURCE, SPA_NOTE), truncated: result.truncated };
  } catch { return layer("unavailable", null, SPA_SOURCE, "Original Ontario source-protection grant, catalogue/item/typed-child lineage or bounded attribute query could not be verified. No current legal boundary, policy, vulnerability, water-quality or absence finding was inferred."); }
}
export async function ontarioSourceProtectionCoverage() {
  let dataset;
  try {
    const vintage = await verifySpaSource(), r = await fabricJson(`${SPA_SOURCE.url}/query`, { where: "1=1", returnCountOnly: "true" });
    if (!Number.isSafeInteger(r.count) || Number(r.count) < 0) throw Error("Invalid source-protection row count");
    dataset = { layer: SPA_KEY, source: SPA_SOURCE, status: "verified", records: r.count, sourceUpdatedAt: null, vintage };
  } catch { dataset = { layer: SPA_KEY, source: SPA_SOURCE, status: "unavailable", records: null, sourceUpdatedAt: null }; }
  return { layer: "ontarioGeneralizedSourceProtectionAreas", geography: "Ontario generalized source-protection area reference", delivery: "cached_live_queries", cacheSeconds: 3600, datasets: [dataset], note: "Count measures generalized boundary rows; one area can have multiple landform polygons. It is not a count of distinct areas, properties, vulnerable zones or imports. French duplicate offers are not counted. " + SPA_NOTE };
}
