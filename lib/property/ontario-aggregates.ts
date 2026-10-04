import { provinceKey } from "./geocode";
import { rows } from "./http";
import { layer, text, type Layer, type Location, type Row } from "./model";
import { aggregateJson, verifyAggregateFeed, verifyAggregateGrant } from "./ontario-aggregates-rights";
import { AGGREGATE_FEEDS, AGGREGATE_MAP, AGGREGATE_NOTE, AGGREGATE_RADIUS_METERS, aggregateFields, type AggregateFeed } from "./ontario-aggregates-sources";

const validPoint = (p: Location): boolean => typeof p.longitude === "number" && Number.isFinite(p.longitude) && p.longitude >= -96 && p.longitude <= -74 && typeof p.latitude === "number" && Number.isFinite(p.latitude) && p.latitude >= 41 && p.latitude <= 57;
export function aggregateQueryRecords(r: Row, f: AggregateFeed) {
  const expected = aggregateFields(f), fields = rows(r.fields), features = rows(r.features), ids = new Set<number>();
  if (!Object.entries(expected).every(([name, type]) => fields.filter(a => a.name === name).length === 1 && fields.find(a => a.name === name)?.type === type)) throw new Error("Aggregate query fields changed");
  if (features.length > 51 || (r.exceededTransferLimit !== undefined && typeof r.exceededTransferLimit !== "boolean")) throw new Error("Invalid aggregate query limit");
  const truncated = r.exceededTransferLimit === true || features.length === 51;
  const records = features.map(row => {
    const a = row.attributes as Row | undefined;
    if (!a || !Object.keys(expected).every(k => k in a) || !Number.isSafeInteger(a.OBJECTID) || Number(a.OBJECTID) < 1 || ids.has(Number(a.OBJECTID)) || !Number.isSafeInteger(a.OGF_ID) || Number(a.OGF_ID) < 1 || !Number.isSafeInteger(a.ALPS_ID) || Number(a.ALPS_ID) < 1) throw new Error("Invalid aggregate identity");
    ids.add(Number(a.OBJECTID));
    for (const [name, type] of Object.entries(expected)) {
      if (a[name] !== null && (type === "esriFieldTypeString" ? typeof a[name] !== "string" : typeof a[name] !== "number" || !Number.isFinite(a[name]) || (["esriFieldTypeOID", "esriFieldTypeInteger", "esriFieldTypeDate"].includes(type) && !Number.isSafeInteger(a[name])))) throw new Error("Invalid aggregate field value");
    }
    return { recordId: String(a.OBJECTID), provincialFeatureId: String(a.OGF_ID), authorizationId: String(a.ALPS_ID),
      reportedLocationAccuracy: text(a.LOCATION_ACCURACY), reportedCurrentStatus: text(a.CURRENT_STATUS), reportedOperationType: text(a.OPERATION_TYPE), reportedAuthorityType: text(a.AUTH_TYPE_DESCR),
      reportedUnlimitedTonnageIndicator: text(a.UNLIMITED_TONNAGE_IND), reportedMaximumTonnageMetricTonnes: a.MAX_TONNAGE, reportedLicensedAreaHectares: a.LICENCED_AREA,
      reportedLocationName: text(a.LOCATION_NAME), reportedWaterStatus: text(a.WATER_STATUS), reportedRecordEffectiveTimestamp: a.EFFECTIVE_DATETIME, reportedSystemTimestamp: a.SYSTEM_DATETIME,
      ...(f.child === 23 ? { reportedPartialSurrenderIndicator: text(a.PARTIAL_SURRENDER_IND) } : {}),
    };
  }).slice(0, 50);
  if (!records.length && truncated) throw new Error("Incomplete aggregate query cannot establish no match");
  return { records, truncated, coverageComplete: !truncated, sourceQueryRecordCount: features.length };
}
export async function ontarioAggregateLayers(location: Location | null): Promise<Record<string, Layer>> {
  const noQuery = (status: "skipped" | "not_supported", note: string) => Object.fromEntries(AGGREGATE_FEEDS.map(f => [f.key, layer(status, null, f.source, note)]));
  if (!location || location.latitude === null || location.longitude === null) return noQuery("skipped", "No independently resolved point for nearby aggregate context.");
  if (provinceKey(location.province ?? "") !== "ontario") return noQuery("not_supported", "These aggregate-site sources cover Ontario.");
  if (!["source_building_point", "source_civic_address_point", "caller_supplied"].includes(location.accuracy) || !validPoint(location)) return noQuery("skipped", "A verified Ontario point is required; street interpolation is insufficient for nearby aggregate context.");
  const shared = verifyAggregateGrant();
  const results = await Promise.all(AGGREGATE_FEEDS.map(async f => {
    try {
      const vintage = await verifyAggregateFeed(f, await shared);
      const r = await aggregateJson(f.source.url + "/query", { where: "1=1", geometry: `${location.longitude},${location.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", distance: String(AGGREGATE_RADIUS_METERS), units: "esriSRUnit_Meter", outFields: Object.keys(aggregateFields(f)).join(","), returnGeometry: "false", orderByFields: "OBJECTID ASC", resultRecordCount: "51" });
      const result = aggregateQueryRecords(r, f);
      return [f.key, { ...layer(result.records.length ? "available" : "no_match", { assessment: "nearby_published_aggregate_site_context", matchMethod: "source_polygon_distance_query", coordinateAccuracy: location.accuracy, queryRadiusMeters: AGGREGATE_RADIUS_METERS, subjectParcelMatchVerified: false, currentExtractionVerified: false, impactsAssessed: false, ...result, vintage, verificationUrl: AGGREGATE_MAP }, f.source, `${result.truncated ? "Partial selection: more than 50 source records may match; this is not a complete nearby or nearest-site result. " : ""}${AGGREGATE_NOTE}`), truncated: result.truncated }];
    } catch { return [f.key, layer("unavailable", null, f.source, "Ontario aggregate grant, original catalogue/item/typed-child lineage, schema or bounded nearby query could not be verified. No absence, current extraction, property impact or development-permission finding was inferred.")]; }
  }));
  return Object.fromEntries(results);
}
export async function ontarioAggregateCoverage() {
  const shared = verifyAggregateGrant();
  const datasets = await Promise.all(AGGREGATE_FEEDS.map(async f => {
    try {
      const vintage = await verifyAggregateFeed(f, await shared), r = await aggregateJson(f.source.url + "/query", { where: "1=1", returnCountOnly: "true" });
      if (!Number.isSafeInteger(r.count) || Number(r.count) < 0) throw new Error("Invalid aggregate count");
      return { layer: f.key, source: f.source, status: "verified", records: r.count, sourceUpdatedAt: null, vintage };
    } catch { return { layer: f.key, source: f.source, status: "unavailable", records: null, sourceUpdatedAt: null }; }
  }));
  return { layer: "ontarioAggregateSites", geography: "Ontario; nearby ARA pit/quarry authorization context only", delivery: "cached_live_queries", cacheSeconds: 3600, datasets, note: "Counts describe overlapping published polygons, not unique authorizations, distinct properties, imported rows or field data points. French duplicate items are excluded. " + AGGREGATE_NOTE };
}
