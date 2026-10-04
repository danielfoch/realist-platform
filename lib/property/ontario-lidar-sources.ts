import type { Source } from "./model";

export const LIDAR_KEY = "ontarioLidarCoverageReference";
export const LIDAR_LICENCE = "https://www.ontario.ca/page/open-government-licence-ontario";
export const LIDAR_OFFER = "https://geohub.lio.gov.on.ca/datasets/mnrf::ontario-digital-terrain-model-lidar-derived";
export const LIDAR_MAP = "776819a7a0de42f3b75e40527cc36a0a";
export const LIDAR_ITEM = "ae2f11bd9e0e473080a4c5ded9ff93da";
export const LIDAR_CHILD_NAME = "Ontario DTM (Lidar-Derived) Package Index";
export const LIDAR_ROOT = "https://services1.arcgis.com/TJH5KDher0W13Kgo/arcgis/rest/services/Ontario_Digital_Terrain_Model_Lidar_Derived_WFL1/FeatureServer";
export const LIDAR_FIELDS = { OBJECTID: "esriFieldTypeOID", Package: "esriFieldTypeString", Resolution: "esriFieldTypeDouble", Project: "esriFieldTypeString" };
export const LIDAR_SOURCE: Source = { id: "ontario:lidar-dtm-package-index:0", name: "Ontario Digital Terrain Model (Lidar-Derived) Package Index", url: `${LIDAR_ROOT}/0`, licence: "Open Government Licence – Ontario", licenceUrl: LIDAR_LICENCE, attribution: "Contains information licensed under the Open Government Licence – Ontario. Ministry of Natural Resources / Geospatial Ontario." };
export const LIDAR_NOTE = "Original lidar download-package index reference at an independent point. Overlapping packages are retained separately; project names are raw source labels, not verified acquisition dates. Reported raster resolution in metres is not horizontal/vertical accuracy or property measurement. Simplified index intersection does not verify actual raster coverage, current ground condition or parcel-wide coverage. No raster pixels, elevation, slope, building height, contour, floodplain or conservation-regulation screen is returned. No-match does not establish absence of terrain data, regulatory clearance, flood safety or insurance eligibility. Original raster sampling timed out during the audit and remains unintegrated; never infer a numeric elevation from package labels.";
