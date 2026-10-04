import type { Source } from "./model";

export const WELL_CATALOGUE = "https://data.ontario.ca/api/3/action/package_show?id=well-records";
export const WELL_MAP = "https://www.ontario.ca/page/map-well-records";
export const WELL_APP = "https://files.ontario.ca/moe_mapping/mapping/js/React/well-records/en/index.html";
export const WELL_BUNDLE = "https://files.ontario.ca/moe_mapping/mapping/js/React/well-records/en/assets/index-CCQIzaLj.js";
export const WELL_ROOT = "https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/MOE/Wells/MapServer";
export const WELL_LICENCE = "https://www.ontario.ca/page/open-government-licence-ontario";
export const WELL_SOURCE: Source = { id: "ontario:wwis:wells:0", name: "Ontario reported well records — nearby context", url: `${WELL_ROOT}/0`, licence: "Open Government Licence – Ontario", licenceUrl: WELL_LICENCE, attribution: "Contains information licensed under the Open Government Licence – Ontario." };
export const WELL_FIELDS = {
  OBJECTID: "esriFieldTypeOID", BORE_HOLE_ID: "esriFieldTypeInteger", WELL_ID: "esriFieldTypeString",
  WELL_COMPLETED_DATE: "esriFieldTypeString", RECEIVED_DATE: "esriFieldTypeString",
  FINAL_STATUS_DESCR: "esriFieldTypeString", USE1: "esriFieldTypeString", USE2: "esriFieldTypeString",
  MOE_COUNTY_DESCR: "esriFieldTypeString", MOE_MUNICIPALITY_DESCR: "esriFieldTypeString",
  DEPTH_M: "esriFieldTypeDouble", COMPLETED_YEAR: "esriFieldTypeInteger", GEOGRAPHIC_TOWNSHIP_NAME: "esriFieldTypeString",
} as const;
export const WELL_RADIUS_METERS = 500;
export const WELL_NOTE = "Selected reported well records within a 500-metre source query around the caller-supplied or independently resolved property point. Distances refer to approximate published map points, not surveyed well locations. These are nearby context, never a well confirmed to serve the property. Records include water-supply wells, test holes and dewatering wells, and can contain submitted-location and data-entry errors. Preserve raw reported use/status and completion/receipt dates; these do not establish current operation, water quality, potability, yield, contamination or municipal/private servicing. Confirm the actual well identity and connection, current maintenance/abandonment, water testing and performance with the owner and qualified professionals. No match is not proof of no well. The live service has no verified observation date; catalogue metadata, download vintage, record dates and retrieval date are separate. Confidential commissioning-person information and original well PDFs are excluded.";
