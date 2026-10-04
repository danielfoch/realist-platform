import { provinceKey } from "./geocode";
import { rows } from "./http";
import { layer, text, type Layer, type Location, type Row } from "./model";
import { FABRIC_FEEDS, FABRIC_NOTE, type FabricFeed } from "./ontario-fabric-sources";
import { fabricJson, verifyFabricFeed, verifyFabricGrant } from "./ontario-fabric-rights";

export function fabricQueryRecords(r: Row, f: FabricFeed) {
  if (!Array.isArray(r.fields) || !Array.isArray(r.features) || r.fields.some(v => !v || typeof v !== "object" || Array.isArray(v)) || r.features.some(v => !v || typeof v !== "object" || Array.isArray(v))) throw Error("Invalid Ontario fabric response arrays");
  const fields = rows(r.fields), features = rows(r.features), ids = new Set<number>();
  if (!Object.entries(f.fields).every(([name, type]) => fields.filter(a => a.name === name && a.type === type).length === 1 && fields.filter(a => a.name === name).length === 1) || features.length > 51 || (r.exceededTransferLimit !== undefined && typeof r.exceededTransferLimit !== "boolean")) throw Error("Invalid Ontario fabric query schema or limit");
  const truncated = r.exceededTransferLimit === true || features.length === 51;
  const records = features.map(row => {
    const a = row.attributes as Row | undefined;
    if (!a || typeof a !== "object" || Array.isArray(a) || !Object.keys(f.fields).every(k => k in a) || !Number.isSafeInteger(a.OBJECTID) || Number(a.OBJECTID) < 1 || ids.has(Number(a.OBJECTID)) || !Number.isSafeInteger(a.OGF_ID) || Number(a.OGF_ID) < 1) throw Error("Invalid Ontario fabric identity");
    ids.add(Number(a.OBJECTID));
    for (const [name, type] of Object.entries(f.fields)) if (a[name] !== null && (type === "esriFieldTypeString" ? typeof a[name] !== "string" : typeof a[name] !== "number" || !Number.isFinite(a[name]) || ((type === "esriFieldTypeDate" || type === "esriFieldTypeOID") && !Number.isSafeInteger(a[name])))) throw Error("Invalid Ontario fabric value");
    return { recordId: String(a.OBJECTID), provincialFeatureId: String(a.OGF_ID), reportedLocationAccuracy: text(a.LOCATION_ACCURACY), reportedGeometryUpdateTimestamp: a.GEOMETRY_UPDATE_DATETIME, reportedRecordEffectiveTimestamp: a.EFFECTIVE_DATETIME, reportedSystemTimestamp: a.SYSTEM_DATETIME,
      ...(f.child === 2 ? { reportedFeatureSubtype: text(a.CLASS_SUBTYPE), reportedOriginalLot: text(a.LOT_IDENT), reportedConcession: text(a.CONCESSION_IDENT), reportedGeographicTownship: text(a.GEOGRAPHIC_TOWNSHIP_NAME), reportedRoadAllowanceStatus: text(a.ROAD_ALLOWANCE_STATUS_FLG), reportedVerificationStatus: text(a.VERIFICATION_STATUS_FLG), reportedVerificationTimestamp: a.VERIFICATION_STATUS_DATE } : { reportedGeographicTownship: text(a.OFFICIAL_NAME), reportedTownshipSurveySystem: text(a.TOWNSHIP_SURVEY_SYSTEM), reportedAnnulmentStatus: text(a.ANNULMENT_STATUS_FLG) }),
    };
  }).slice(0, 50);
  if (!records.length && truncated) throw Error("Incomplete Ontario fabric query cannot establish no match");
  return { records, truncated, queryCoverageComplete: !truncated, sourceQueryRecordCount: features.length };
}
export async function ontarioFabricLayers(p: Location | null): Promise<Record<string, Layer>> {
  const skip = (status: "skipped" | "not_supported", note: string) => Object.fromEntries(FABRIC_FEEDS.map(f => [f.key, layer(status, null, f.source, note)]));
  if (!p || p.latitude === null || p.longitude === null) return skip("skipped", "No independently resolved point for original lot/township reference.");
  if (provinceKey(p.province ?? "") !== "ontario") return skip("not_supported", "These original lot/township reference sources cover Ontario.");
  if (!["source_building_point", "source_civic_address_point", "caller_supplied"].includes(p.accuracy) || !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude) || p.latitude < 41 || p.latitude > 57 || p.longitude < -96 || p.longitude > -74) return skip("skipped", "A verified Ontario point is required; interpolated, ambiguous or invalid coordinates do not screen original fabric.");
  const shared = verifyFabricGrant();
  return Object.fromEntries(await Promise.all(FABRIC_FEEDS.map(async f => {
    try {
      const vintage = await verifyFabricFeed(f, await shared), r = await fabricJson(f.source.url + "/query", { where: "1=1", geometry: `${p.longitude},${p.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: Object.keys(f.fields).join(","), returnGeometry: "false", orderByFields: "OBJECTID ASC", resultRecordCount: "51" }), result = fabricQueryRecords(r, f);
      return [f.key, { ...layer(result.records.length > 1 || result.truncated ? "ambiguous" : result.records.length ? "available" : "no_match", { assessment: "original_survey_fabric_reference", matchMethod: "published_polygon_intersects_independent_point", coordinateAccuracy: p.accuracy, coverageComplete: false, absenceEstablished: false, parcelIdentityVerified: false, legalDescriptionVerified: false, currentMunicipalityEstablished: false, surveyedBoundaryVerified: false, parcelWideScreenPerformed: false, sourceGeometryReused: false, legalAccessEstablished: false, sourceUpdatedAt: null, ...result, vintage }, f.source, `${result.records.length > 1 || result.truncated ? "Multiple or incomplete source candidates; a unique original-fabric reference is not established. " : ""}${FABRIC_NOTE}`), truncated: result.truncated }];
    } catch { return [f.key, layer("unavailable", null, f.source, "Original Ontario fabric grant, catalogue resource/item/typed-child lineage, query schema or bounded point query could not be verified. No boundary, legal description, access or absence finding was inferred.")]; }
  })));
}
export async function ontarioFabricCoverage() {
  const shared = verifyFabricGrant();
  const datasets = await Promise.all(FABRIC_FEEDS.map(async f => {
    try {
      const vintage = await verifyFabricFeed(f, await shared), r = await fabricJson(f.source.url + "/query", { where: "1=1", returnCountOnly: "true" });
      if (!Number.isSafeInteger(r.count) || Number(r.count) < 0) throw Error("Invalid Ontario fabric count");
      return { layer: f.key, source: f.source, status: "verified", records: r.count, sourceUpdatedAt: null, vintage };
    } catch { return { layer: f.key, source: f.source, status: "unavailable", records: null, sourceUpdatedAt: null }; }
  }));
  return { layer: "ontarioOriginalFabric", geography: "Ontario original lot/concession and geographic township reference", delivery: "cached_live_queries", cacheSeconds: 3600, datasets, note: "Counts are overlapping source polygons, not distinct properties, modern parcels, field data points or imports. French duplicate offers are excluded. " + FABRIC_NOTE };
}
