/** Public property datasets. Re-exported through the platform schema. */
import { pgTable, text, varchar, integer, bigint, bigserial, real, doublePrecision, jsonb, timestamp, date, boolean, uuid, index, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const propertyPublicSnapshots = pgTable("property_public_snapshots", {
  key: text("key").primaryKey(), payload: jsonb("payload").notNull(), publishedAt: timestamp("published_at").notNull().defaultNow(),
});
export const propertyRefreshRuns = pgTable("property_refresh_runs", {
  key: text("key").primaryKey(), token: text("token"), leaseUntil: timestamp("lease_until"), lastAttemptAt: timestamp("last_attempt_at"), lastSuccessAt: timestamp("last_success_at"), status: text("status").notNull(), errorCode: text("error_code"),
});

export const dataLayers = pgTable("data_layers", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  sourceUrl: text("source_url"),
  licence: text("licence"),
  attribution: text("attribution"),
  geography: text("geography"),
  refreshCadence: text("refresh_cadence"),
  lastImportedAt: timestamp("last_imported_at"),
  rowCount: integer("row_count"),
  notes: text("notes"),
});

export const censusDaBoundaries = pgTable("census_da_boundaries", {
  dauid: text("dauid").primaryKey(),
  provinceCode: text("province_code"),
  landAreaKm2: real("land_area_km2"),
  geojson: jsonb("geojson").notNull(),
  minLng: doublePrecision("min_lng").notNull(),
  minLat: doublePrecision("min_lat").notNull(),
  maxLng: doublePrecision("max_lng").notNull(),
  maxLat: doublePrecision("max_lat").notNull(),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  simplificationM: doublePrecision("simplification_m").notNull().default(0),
}, (t) => [
  index("census_da_bbox_idx").on(t.minLat, t.maxLat, t.minLng, t.maxLng),
  index("census_da_gist_idx").using("gist", sql`box(point(${t.minLng},${t.minLat}),point(${t.maxLng},${t.maxLat}))`),
]);

export const censusDaProfiles = pgTable("census_da_profiles", {
  dauid: text("dauid").primaryKey(),
  censusYear: integer("census_year").notNull(),
  profile: jsonb("profile").notNull(),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
});

export const assessmentUnits = pgTable("assessment_units", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  source: text("source").notNull(),
  municipalityCode: text("municipality_code").notNull(),
  municipalityName: text("municipality_name"),
  rollYear: integer("roll_year"),
  matricule: text("matricule"),
  address: text("address"),
  looseAddressKey: text("loose_address_key"),
  lotNumber: text("lot_number"),
  cubf: text("cubf"),
  frontageM: real("frontage_m"),
  lotAreaM2: doublePrecision("lot_area_m2"),
  storeys: real("storeys"),
  yearBuilt: integer("year_built"),
  yearBuiltEstimated: boolean("year_built_estimated"),
  floorAreaM2: real("floor_area_m2"),
  dwellings: integer("dwellings"),
  marketRefDate: text("market_ref_date"),
  landValue: bigint("land_value", { mode: "number" }),
  buildingValue: bigint("building_value", { mode: "number" }),
  totalValue: bigint("total_value", { mode: "number" }),
  previousRollValue: bigint("previous_roll_value", { mode: "number" }),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  province: text("province"),
  bedrooms: real("bedrooms"),
  bathrooms: real("bathrooms"),
  landUse: text("land_use"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
  attributes: jsonb("attributes").notNull().default({}),
}, (t) => [
  uniqueIndex("assessment_units_source_municipality_code_matricule_key").on(t.source, t.municipalityCode, t.matricule),
  index("assessment_units_loose_key_idx").on(t.looseAddressKey),
  index("assessment_units_muni_idx").on(t.municipalityCode),
  index("assessment_units_source_idx").on(t.source),
]);

export const buildingPermits = pgTable("building_permits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  source: text("source").notNull(),
  permitNumber: text("permit_number").notNull(),
  city: text("city"),
  province: text("province"),
  address: text("address"),
  looseAddressKey: text("loose_address_key"),
  permitType: text("permit_type"),
  workType: text("work_type"),
  status: text("status"),
  description: text("description"),
  units: integer("units"),
  estimatedValue: doublePrecision("estimated_value"),
  issuedDate: date("issued_date"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("building_permits_source_permit_number_key").on(t.source, t.permitNumber),
  index("building_permits_loose_key_idx").on(t.looseAddressKey),
  index("building_permits_latlng_idx").on(t.lat, t.lng),
]);

export const developmentApplications = pgTable("development_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  source: text("source").notNull(),
  applicationNumber: text("application_number").notNull(),
  applicationType: text("application_type"),
  status: text("status"),
  address: text("address"),
  description: text("description"),
  dateSubmitted: date("date_submitted"),
  wardNumber: text("ward_number"),
  wardName: text("ward_name"),
  applicationUrl: text("application_url"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("development_applications_source_application_number_key").on(t.source, t.applicationNumber),
  index("development_applications_latlng_idx").on(t.lat, t.lng),
]);

export const torontoParcels = pgTable("toronto_parcels", {
  parcelId: text("parcel_id").primaryKey(),
  lotAreaM2: doublePrecision("lot_area_m2"),
  geojson: jsonb("geojson").notNull(),
  minLng: doublePrecision("min_lng").notNull(),
  minLat: doublePrecision("min_lat").notNull(),
  maxLng: doublePrecision("max_lng").notNull(),
  maxLat: doublePrecision("max_lat").notNull(),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
}, (t) => [
  index("toronto_parcels_bbox_idx").on(t.minLat, t.maxLat, t.minLng, t.maxLng),
  index("toronto_parcels_gist_idx").using("gist", sql`box(point(${t.minLng},${t.minLat}),point(${t.maxLng},${t.maxLat}))`),
]);

export const municipalWards = pgTable("municipal_wards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  city: text("city").notNull(),
  wardCode: text("ward_code").notNull(),
  wardName: text("ward_name"),
  geojson: jsonb("geojson").notNull(),
  minLng: doublePrecision("min_lng").notNull(),
  minLat: doublePrecision("min_lat").notNull(),
  maxLng: doublePrecision("max_lng").notNull(),
  maxLat: doublePrecision("max_lat").notNull(),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("municipal_wards_city_ward_code_key").on(t.city, t.wardCode),
  index("municipal_wards_bbox_idx").on(t.city, t.minLat, t.maxLat, t.minLng, t.maxLng),
]);

export const coaApplications = pgTable("coa_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  source: text("source").notNull(),
  referenceFile: text("reference_file").notNull(),
  sysId: text("sys_id"),
  applicationType: text("application_type"),
  subType: text("sub_type"),
  workType: text("work_type"),
  status: text("status"),
  decision: text("decision"),
  ombDecision: text("omb_decision"),
  address: text("address"),
  looseAddressKey: text("loose_address_key"),
  wardNumber: text("ward_number"),
  wardName: text("ward_name"),
  zoningReview: text("zoning_review"),
  zoningDesignation: text("zoning_designation"),
  description: text("description"),
  inDate: text("in_date"),
  hearingDate: text("hearing_date"),
  finalDate: text("final_date"),
  numberOfLotsCreated: integer("number_of_lots_created"),
  applicationUrl: text("application_url"),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("coa_applications_source_reference_file_key").on(t.source, t.referenceFile),
  index("coa_applications_loose_key_idx").on(t.looseAddressKey),
]);

export const torontoZoningPolygons = pgTable("toronto_zoning_polygons", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  zoneCode: text("zone_code").notNull(),
  zoneCategory: text("zone_category"),
  geojson: jsonb("geojson").notNull(),
  minLng: doublePrecision("min_lng").notNull(),
  minLat: doublePrecision("min_lat").notNull(),
  maxLng: doublePrecision("max_lng").notNull(),
  maxLat: doublePrecision("max_lat").notNull(),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  featureId: text("feature_id"),
}, (t) => [
  uniqueIndex("toronto_zoning_polygons_feature_id_key").on(t.featureId),
  index("toronto_zoning_bbox_idx").on(t.minLat, t.maxLat, t.minLng, t.maxLng),
  index("toronto_zoning_gist_idx").using("gist", sql`box(point(${t.minLng},${t.minLat}),point(${t.maxLng},${t.maxLat}))`),
]);

export const propertyImportRuns = pgTable("property_import_runs", {
  key: text("key").primaryKey(),
  status: text("status").notNull(),
  expectedRows: bigint("expected_rows", { mode: "number" }),
  processedRows: bigint("processed_rows", { mode: "number" }).notNull().default(0),
  rejectedRows: bigint("rejected_rows", { mode: "number" }).notNull().default(0),
  cursor: jsonb("cursor").notNull().default({}),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
  error: text("error"),
});

export const propertyImportFiles = pgTable("property_import_files", {
  datasetKey: text("dataset_key").notNull(),
  fileKey: text("file_key").notNull(),
  status: text("status").notNull(),
  rowCount: bigint("row_count", { mode: "number" }),
  sha256: text("sha256"),
  error: text("error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.datasetKey, t.fileKey] }),
]);

export const assessmentHistory = pgTable("assessment_history", {
  source: text("source").notNull(),
  accountNumber: text("account_number").notNull(),
  rollYear: integer("roll_year").notNull(),
  address: text("address"),
  city: text("city"),
  province: text("province"),
  landValue: bigint("land_value", { mode: "number" }),
  buildingValue: bigint("building_value", { mode: "number" }),
  totalValue: bigint("total_value", { mode: "number" }),
  taxableValue: bigint("taxable_value", { mode: "number" }),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.source, t.accountNumber, t.rollYear] }),
]);

export const nsPropertyLand = pgTable("ns_property_land", {
  accountNumber: text("account_number").primaryKey(),
  lotAreaM2: doublePrecision("lot_area_m2"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
});

export const nationalAddresses = pgTable("national_addresses", {
  addressId: uuid("address_id").primaryKey(),
  locationId: uuid("location_id"),
  civicNumber: text("civic_number"),
  unit: text("unit"),
  address: text("address"),
  mailingAddress: text("mailing_address"),
  streetKey: text("street_key"),
  mailingStreetKey: text("mailing_street_key"),
  city: text("city"),
  cityFr: text("city_fr"),
  mailingCity: text("mailing_city"),
  cityKey: text("city_key"),
  cityFrKey: text("city_fr_key"),
  mailingCityKey: text("mailing_city_key"),
  province: text("province"),
  postalCode: text("postal_code"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  coordinateKind: text("coordinate_kind"),
  csduid: text("csduid"),
  buildingUsage: text("building_usage"),
  referenceDate: date("reference_date").notNull().default(sql`'2026-06-26'`),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
}, (t) => [
  index("national_addresses_official_idx").on(t.streetKey, t.province, t.cityKey),
  index("national_addresses_mailing_idx").on(t.mailingStreetKey, t.province, t.mailingCityKey),
]);

export const nationalLocations = pgTable("national_locations", {
  locationId: uuid("location_id").primaryKey(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  blockfaceLatitude: doublePrecision("blockface_latitude"),
  blockfaceLongitude: doublePrecision("blockface_longitude"),
  csduid: text("csduid"),
  eruid: text("eruid"),
  feduid: text("feduid"),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
});

export const developmentApplicationSites = pgTable("development_application_sites", {
  source: text("source").notNull(),
  sourceRecordId: text("source_record_id").notNull(),
  applicationNumber: text("application_number").notNull(),
  applicationType: text("application_type"),
  status: text("status"),
  address: text("address"),
  description: text("description"),
  dateSubmitted: date("date_submitted"),
  wardNumber: text("ward_number"),
  wardName: text("ward_name"),
  applicationUrl: text("application_url"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.source, t.sourceRecordId] }),
  index("development_sites_latlng_idx").on(t.lat, t.lng),
]);
