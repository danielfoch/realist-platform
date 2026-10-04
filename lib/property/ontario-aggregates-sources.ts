import type { Source } from "./model";

export const AGGREGATE_CATALOGUE = "https://data.ontario.ca/api/3/action/package_show?id=aggregate-site-authorized";
export const AGGREGATE_LICENCE = "https://www.ontario.ca/page/open-government-licence-ontario";
export const AGGREGATE_ROOT = "https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/LIO_OPEN_DATA/LIO_Open05/MapServer";
export const AGGREGATE_MAP = "https://www.ontario.ca/page/find-pits-and-quarries";
export const AGGREGATE_RADIUS_METERS = 2000;
export interface AggregateFeed {
  key: string; child: number; name: string; item: string; title: string;
  resourceId: string; resourceName: string; source: Source;
}
const feed = (key: string, child: number, name: string, item: string, title: string, resourceId: string, resourceName: string): AggregateFeed => ({
  key, child, name, item, title, resourceId, resourceName,
  source: { id: `ontario:aggregate-site-authorized:${child}`, name, url: `${AGGREGATE_ROOT}/${child}`, licence: "Open Government Licence – Ontario", licenceUrl: AGGREGATE_LICENCE, attribution: "Contains information licensed under the Open Government Licence – Ontario." },
});
export const AGGREGATE_FEEDS = [
  feed("ontarioAggregateActiveSites", 17, "Aggregate Site Authorized Active", "874e7fa67ce94cc5b1e8e98c59ca06eb", "Aggregate site authorized - active", "06de3b90-e453-4871-9f48-bf2f68fd23cb", "Aggregate Site Authorized - Active"),
  feed("ontarioAggregateInactiveSites", 16, "Aggregate Site Authorized Inactive", "b83d0aef05fa49da9e12288bdb36992b", "Aggregate site authorized - inactive", "c8d36603-2c3f-42ef-9935-925caaedc06a", "Aggregate Site Authorized - Inactive"),
  feed("ontarioAggregatePartialSurrender", 23, "Aggregate Site Authorized Partial Surrender", "4a83d157a2c24b4b9f32266d997e3632", "Aggregate site authorized - partial surrender", "15b92ab7-563c-44d3-a92d-b31bfdbf3247", "Aggregate Site Authorized – Partial Surrender"),
];
export const AGGREGATE_FIELDS = {
  OBJECTID: "esriFieldTypeOID", OGF_ID: "esriFieldTypeDouble", ALPS_ID: "esriFieldTypeInteger", LOCATION_ACCURACY: "esriFieldTypeString",
  CURRENT_STATUS: "esriFieldTypeString", OPERATION_TYPE: "esriFieldTypeString", AUTH_TYPE_DESCR: "esriFieldTypeString",
  UNLIMITED_TONNAGE_IND: "esriFieldTypeString", MAX_TONNAGE: "esriFieldTypeInteger", LICENCED_AREA: "esriFieldTypeDouble",
  LOCATION_NAME: "esriFieldTypeString", EFFECTIVE_DATETIME: "esriFieldTypeDate", SYSTEM_DATETIME: "esriFieldTypeDate", WATER_STATUS: "esriFieldTypeString",
};
export const aggregateFields = (feed: AggregateFeed): Record<string, string> => feed.child === 23 ? { ...AGGREGATE_FIELDS, PARTIAL_SURRENDER_IND: "esriFieldTypeString" } : AGGREGATE_FIELDS;
export const AGGREGATE_NOTE = "Selected published aggregate-site polygons intersect a 2-kilometre source query around the resolved Ontario point. This is nearby context, not a surveyed parcel match, measured distance or nearest-site ranking. Preserve each layer's raw status, operation/authority type, water-status label and location accuracy. Active authorizations can include applications and do not prove current extraction; Application is not an issued approval. Inactive Surrendered/Revoked labels and historical partially surrendered areas do not independently verify present rehabilitation, safety, permitted redevelopment or contamination. Partial surrender is a separate historical area, not a Current Status value or the status of the whole site. Tonnage is a reported authorization limit in metric tonnes, not actual production or truck traffic; null is not inferred to mean unlimited. Reported licensed area is in hectares, not measured extraction footprint or subject lot area. No noise, dust, blasting, traffic, water-quality, health, value, zoning or development-permission conclusion is inferred. MTO sites and unrecorded/non-ARA operations are outside this source. No match is not proof of no pit or quarry. Source polygons can overlap and share authorization IDs. The live observation date and date-field timezone are unverified; raw ArcGIS record timestamps, catalogue vintage, item metadata edit and retrieval dates are separate. Client names and source-detail free text are excluded.";
