import { fetchJson, rows } from "./http";
import { layer, type Layer, type Location, type Row, type Source } from "./model";
import { provinceKey } from "./geocode";

const BASE = "https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/LIO_OPEN_DATA/LIO_Open06/MapServer";
const LICENCE = "https://www.ontario.ca/page/open-government-licence-ontario";
export const ONTARIO_PLANNING_SOURCE: Source = { id: "ontario:provincial-planning", name: "Ontario LIO provincial planning screens", url: BASE, licence: "Open Government Licence – Ontario", attribution: "Contains information licensed under the Open Government Licence – Ontario." };
export const ONTARIO_PLANNING_FEEDS = [
  { key: "greenbeltDesignation", id: 15, name: "Greenbelt Designation", fields: ["OBJECTID", "OGF_ID", "DESIGNATION", "EFFECTIVE_DATETIME", "SYSTEM_DATETIME"] },
  { key: "niagaraEscarpmentPlanBoundary", id: 25, name: "Niagara Escarpment Plan Boundary", fields: ["OBJECTID", "OGF_ID", "LOCATION_ACCURACY", "GEOMETRY_UPDATE_DATETIME", "EFFECTIVE_DATETIME", "SYSTEM_DATETIME"] },
  { key: "niagaraEscarpmentPlanDesignation", id: 26, name: "Niagara Escarpment Plan Designation", fields: ["OBJECTID", "OGF_ID", "DESIGNATION", "LOCATION_ACCURACY", "GEOMETRY_UPDATE_DATETIME", "EFFECTIVE_DATETIME", "SYSTEM_DATETIME"] },
] as const;
type Feed = typeof ONTARIO_PLANNING_FEEDS[number];
const sourceFor = (f: Feed): Source => ({ ...ONTARIO_PLANNING_SOURCE, id: `ontario:lio-open06:${f.id}`, name: `Ontario ${f.name}`, url: `${BASE}/${f.id}` });
const date = (v: unknown): string | null => typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 8.64e15 ? new Date(v).toISOString() : null;
async function get(path: string, params: Record<string, string> = {}): Promise<Row> {
  const url = new URL(path); Object.entries({ f: "json", ...params }).forEach(([k, v]) => url.searchParams.set(k, v));
  const result = await fetchJson(url) as Row; if (!result || result.error) throw new Error("Ontario planning source unavailable"); return result;
}
export function validPlanningMetadata(m: Row, f: Feed): boolean {
  return m.id === f.id && m.name === f.name && m.geometryType === "esriGeometryPolygon" && m.copyrightText === LICENCE && f.fields.every(name => rows(m.fields).some(field => field.name === name));
}
const NOTE = "Preliminary point screen of separately published Greenbelt designations, Niagara Escarpment Plan boundary and Plan designations. A civic point can be a rural entrance far from buildings. Preserve every published LOCATION_ACCURACY value; some records are only within 1,000 or 10,000 metres, which cannot verify an individual lot. Published effective/system/geometry dates describe source records, not confirmed legal currency. The service does not publish a dataset observation date; sourceUpdatedAt stays unknown. Plan boundary is not the Niagara Escarpment development-control area: development-control mapping and permits are not searched. These are not municipal official-plan land-use or parcel-wide determinations, zoning permissions, flood screens or proof of buildability. Confirm current legal maps, amendments and proposed work with the City and NEC. No intersection is not proof of absence of restrictions.";
export async function provincialPlanningLayer(location: Location | null): Promise<Layer> {
  if (!location || location.latitude === null || location.longitude === null) return layer("skipped", null, ONTARIO_PLANNING_SOURCE, "No resolved property point.");
  if (provinceKey(location.province ?? "") !== "ontario") return layer("not_supported", null, ONTARIO_PLANNING_SOURCE, "These planning sources cover Ontario.");
  if (!["source_building_point", "source_civic_address_point", "caller_supplied"].includes(location.accuracy)) return layer("skipped", null, ONTARIO_PLANNING_SOURCE, "Street interpolation is insufficient for a planning screen; provide verified coordinates.");
  const attempts = await Promise.all(ONTARIO_PLANNING_FEEDS.map(async f => {
    const source = sourceFor(f);
    try {
      const m = await get(source.url); if (!validPlanningMetadata(m, f)) throw new Error("Ontario licence/schema changed");
      const r = await get(source.url + "/query", { where: "1=1", geometry: `${location.longitude},${location.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: f.fields.join(","), returnGeometry: "false", resultRecordCount: "51" });
      const features = rows(r.features);
      if (r.exceededTransferLimit || features.length >= 51 || !f.fields.every(name => rows(r.fields).some(field => field.name === name))) throw new Error("Incomplete planning query");
      const records = features.map(feature => {
        const a = feature.attributes as Row;
        if (!a || !f.fields.every(name => name in a) || a.OBJECTID === null || a.OBJECTID === undefined) throw new Error("Invalid planning record");
        return { recordId: String(a.OBJECTID), publishedFields: Object.fromEntries(f.fields.filter(k => k !== "OBJECTID").map(k => [k, /_DATETIME$/.test(k) ? date(a[k]) : a[k]])) };
      });
      return [f.key, layer(records.length ? "available" : "no_match", { assessment: "preliminary_point_screen", geometryScope: location.accuracy, matchMethod: "point_intersection", records }, source, NOTE)] as const;
    } catch { return [f.key, layer("unavailable", null, source, "Ontario planning licence, schema or complete point query could not be verified; no constraint absence was inferred.")] as const; }
  }));
  const coverageComplete = attempts.every(([, l]) => l.status !== "unavailable");
  return layer(attempts.some(([, l]) => l.status === "available") ? "available" : coverageComplete ? "no_match" : "unavailable", { assessment: "preliminary_point_screen", coordinateAccuracy: location.accuracy, coverageComplete, developmentControlScreenPerformed: false, officialPlanLandUseScreenPerformed: false, verificationUrl: "https://escarpment.org/developing/", datasets: Object.fromEntries(attempts) }, ONTARIO_PLANNING_SOURCE, `${coverageComplete ? "" : "Incomplete: one or more planning sources failed. "}${NOTE}`);
}
export async function provincialPlanningCoverage() {
  const datasets = await Promise.all(ONTARIO_PLANNING_FEEDS.map(async f => {
    const source = sourceFor(f);
    try {
      const m = await get(source.url); if (!validPlanningMetadata(m, f)) throw new Error("Rights changed");
      const r = await get(source.url + "/query", { where: "1=1", returnCountOnly: "true" }); if (!Number.isInteger(r.count) || Number(r.count) < 0) throw new Error("Invalid count");
      return { layer: f.key, source, status: "reachable", publishedRecords: r.count, sourceUpdatedAt: null };
    } catch { return { layer: f.key, source, status: "unavailable", publishedRecords: null, sourceUpdatedAt: null }; }
  }));
  return { layer: "provincialPlanning", geography: "Ontario; preliminary point screens only", delivery: "cached_live_queries", cacheSeconds: 3600, datasets, note: NOTE };
}
