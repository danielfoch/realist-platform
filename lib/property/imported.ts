import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pointInGeometry, haversineMeters, type AreaGeometry } from "@/lib/geo/geometry";
import { cityKey, date, importedAddressKey, layer, number, sameStreet, text, type Layer, type Location, type Row, type Source } from "./model";
import { SOURCES } from "./municipal";

const TABLES = ["data_layers", "assessment_units", "building_permits", "census_da_boundaries", "census_da_profiles", "toronto_parcels", "municipal_wards", "toronto_zoning_polygons", "development_applications", "coa_applications"] as const;
export interface Inventory { tables: Set<string>; sources: Row[]; available: boolean; }
export async function inventory(): Promise<Inventory> {
  try {
    const result = await getDb().execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN (${sql.join(TABLES.map(t => sql`${t}`), sql`, `)})`);
    const tables = new Set(result.rows.map(r => String(r.table_name)));
    const sources = tables.has("data_layers") ? (await getDb().execute(sql`SELECT key, name, source_url, licence, attribution, geography, refresh_cadence, last_imported_at, row_count FROM data_layers ORDER BY key LIMIT 100`)).rows : [];
    return { tables, sources, available: true };
  } catch { return { tables: new Set(), sources: [], available: false }; }
}
function sourceFor(inv: Inventory, key: string): Source | null {
  if (SOURCES[key] && inv.sources.some(s => s.key === "municipal_assessment_rolls")) return SOURCES[key];
  if (key === "ns-pvsc" && inv.sources.some(s => s.key === "municipal_assessment_rolls")) return SOURCES.ns;
  const registryKey = key === "qc-mamh" ? "qc_assessment_roll" : key;
  const r = inv.sources.find(s => s.key === registryKey);
  if (!r || !text(r.source_url) || !text(r.licence) || !text(r.attribution)) return null;
  return { id: `realist:${key}`, name: String(r.name), url: String(r.source_url), licence: String(r.licence), attribution: String(r.attribution) };
}
const ready = (inv: Inventory, table: string): Layer | null => !inv.available ? layer("unavailable", null, null, "Imported Realist database could not be read.") : !inv.tables.has(table) ? layer("not_loaded", null, null, "This open-data table has not been imported into the active Realist database.") : null;

async function spatial(inv: Inventory, name: "parcel" | "ward" | "zoning" | "neighbourhood", location: Location | null): Promise<Layer> {
  const table = { parcel: "toronto_parcels", ward: "municipal_wards", zoning: "toronto_zoning_polygons", neighbourhood: "census_da_boundaries" }[name];
  const absent = ready(inv, table);
  if (absent) return absent;
  if (!location) return layer("skipped", null, null, "No resolved coordinates.");
  if (name !== "neighbourhood" && cityKey(location.city ?? "") !== "toronto") return layer("not_supported", null, null, "Imported spatial layer is scoped to Toronto.");
  // An interpolated road point can land on the adjacent parcel. Require verified caller coordinates for parcel/zoning lookup.
  if (["parcel", "zoning"].includes(name) && location.accuracy !== "caller_supplied") return layer("skipped", null, null, "Supply verified property coordinates for parcel or zoning lookup; street interpolation is insufficient.");
  const { latitude: lat, longitude: lng } = location;
  const columns = { parcel: sql`parcel_id, lot_area_m2, geojson, imported_at`, ward: sql`ward_code, ward_name, geojson, imported_at`, zoning: sql`zone_code, zone_category, geojson, imported_at`, neighbourhood: sql`dauid, geojson, imported_at` }[name];
  const records = (await getDb().execute(sql`SELECT ${columns} FROM ${sql.identifier(table)} WHERE min_lat <= ${lat} AND max_lat >= ${lat} AND min_lng <= ${lng} AND max_lng >= ${lng} ${name === "ward" ? sql`AND city = 'Toronto'` : sql``} LIMIT 51`)).rows;
  if (records.length >= 51) return layer("ambiguous", null, null, "Spatial candidate limit reached.");
  const matches = records.filter(r => pointInGeometry(lng, lat, r.geojson as AreaGeometry));
  if (matches.length !== 1) return layer(matches.length ? "ambiguous" : "no_match");
  const r = matches[0];
  const key = { parcel: "toronto_parcels", ward: "toronto_wards", zoning: "toronto_zoning", neighbourhood: "census_da_profiles" }[name];
  const source = sourceFor(inv, key);
  if (!source) return layer("not_loaded", null, null, "Imported layer lacks a source/licence registry entry; data withheld until attribution is recorded.");
  let data: unknown;
  if (name === "parcel") data = { parcelId: r.parcel_id, lotAreaM2: number(r.lot_area_m2) };
  else if (name === "ward") data = { code: r.ward_code, name: r.ward_name };
  else if (name === "zoning") data = { zoneCode: r.zone_code, zoneCategory: r.zone_category, scope: "GIS designation; confirm applicable bylaw and permissions with the municipality" };
  else {
    if (!inv.tables.has("census_da_profiles")) return layer("not_loaded", null, source);
    const profile = (await getDb().execute(sql`SELECT profile, census_year, imported_at FROM census_da_profiles WHERE dauid = ${String(r.dauid)} LIMIT 1`)).rows[0];
    if (!profile) return layer("no_match", null, source);
    const p = profile.profile as Row;
    data = { dauid: r.dauid, censusYear: number(profile.census_year), population: number(p.population), medianHouseholdIncome: number(p.medianHouseholdIncome), medianDwellingValue: number(p.medianDwellingValue), medianRentedShelterCost: number(p.medianRentedShelterCost), geographyLevel: "dissemination_area", note: "Neighbourhood census statistics describe the area, not the subject household or property." };
    r.imported_at = profile.imported_at;
  }
  const result = layer("available", data, source, "Matched to the supplied or approximate location. Verify boundary proximity. importedAt is the import date, not the source observation date.");
  result.importedAt = date(r.imported_at);
  return result;
}

async function addressLayer(inv: Inventory, name: "assessment" | "permits" | "variance", address: string | null, city: string | null): Promise<Layer> {
  const table = { assessment: "assessment_units", permits: "building_permits", variance: "coa_applications" }[name];
  const absent = ready(inv, table);
  if (absent) return absent;
  if (!address || !city) return layer("skipped", null, null, "Address and municipality are required for matching imported records.");
  if (name === "variance" && cityKey(city) !== "toronto") return layer("not_supported");
  const key = importedAddressKey(address);
  if (!key) return layer("skipped");
  const columns = {
    assessment: sql`source, address, municipality_name, roll_year, matricule, year_built, floor_area_m2, lot_area_m2, frontage_m, dwellings, land_value, building_value, total_value, market_ref_date, imported_at`,
    permits: sql`source, address, city, permit_number, permit_type, work_type, status, description, issued_date, estimated_value, units, imported_at`,
    variance: sql`source, address, reference_file, status, decision, description, hearing_date, in_date, imported_at`,
  }[name];
  const records = (await getDb().execute(sql`SELECT ${columns} FROM ${sql.identifier(table)} WHERE loose_address_key = ${key} LIMIT 51`)).rows;
  if (records.length >= 51) return layer("ambiguous", null, null, "Imported record candidate limit reached.");
  const matches = records.filter(r => sameStreet(address, String(r.address)) && (name === "variance" || cityKey(String(r.municipality_name ?? r.city ?? "")) === cityKey(city)));
  if (!matches.length) return layer("no_match");
  // Never collapse multiple condominium/assessment units at an address into a guessed value.
  if (name === "assessment" && matches.length !== 1) return layer("ambiguous", null, null, "Multiple assessment records; no property unit selected.");
  const sources = matches.map(r => name === "permits" ? SOURCES[`${String(r.source)}-permits`] ?? sourceFor(inv, "building_permits") : name === "variance" ? sourceFor(inv, "toronto_coa_applications") : sourceFor(inv, String(r.source)));
  if (sources.some(s => !s)) return layer("not_loaded", null, null, "Imported source/licence attribution is missing; records withheld.");
  const source = sources[0]!;
  const data = name === "assessment" ? {
    address: matches[0].address, city: matches[0].municipality_name, rollNumber: matches[0].matricule,
    rollYear: number(matches[0].roll_year), assessedValue: number(matches[0].total_value), landValue: number(matches[0].land_value), buildingValue: number(matches[0].building_value), yearBuilt: number(matches[0].year_built), floorAreaM2: number(matches[0].floor_area_m2), lotAreaM2: number(matches[0].lot_area_m2), frontageM: number(matches[0].frontage_m), dwellingUnits: number(matches[0].dwellings), currency: "CAD", valuationKind: "municipal_assessment", marketValueEstimate: null,
  } : name === "permits" ? { permits: matches.map(r => ({ permitNumber: r.permit_number, issuedDate: date(r.issued_date), status: r.status, workType: r.work_type, description: text(r.description)?.slice(0, 1000) ?? null, estimatedProjectValue: number(r.estimated_value), source: sourceFor(inv, String(r.source)) })) } : { applications: matches.map(r => ({ fileNumber: r.reference_file, status: r.status, decision: r.decision, receivedDate: date(r.in_date), hearingDate: date(r.hearing_date), description: text(r.description)?.slice(0, 1000) ?? null })) };
  const result = layer("available", data, source, "Matched by civic address and municipality; assessment values are not market-value estimates. importedAt is not the source observation date.");
  result.importedAt = date(matches[0].imported_at);
  return result;
}

async function development(inv: Inventory, location: Location | null): Promise<Layer> {
  const absent = ready(inv, "development_applications");
  if (absent) return absent;
  if (!location) return layer("skipped");
  if (cityKey(location.city ?? "") !== "toronto") return layer("not_supported");
  const { latitude: lat, longitude: lng } = location;
  const records = (await getDb().execute(sql`SELECT source, application_number, address, status, application_type, description, date_submitted, lat, lng, imported_at FROM development_applications WHERE lat BETWEEN ${lat - 0.008} AND ${lat + 0.008} AND lng BETWEEN ${lng - 0.012} AND ${lng + 0.012} AND date_submitted >= now() - interval '36 months' ORDER BY date_submitted DESC LIMIT 201`)).rows;
  const matches = records.filter(r => haversineMeters(lat, lng, Number(r.lat), Number(r.lng)) <= 800);
  const source = sourceFor(inv, "toronto_development_applications");
  if (!source) return layer("not_loaded", null, null, "Development source/licence registry entry missing.");
  const result = layer(matches.length ? "available" : "no_match", { radiusM: 800, windowMonths: 36, applications: matches.slice(0, 25).map(r => ({ applicationNumber: r.application_number, address: r.address, status: r.status, applicationType: r.application_type, description: text(r.description)?.slice(0, 1000), dateSubmitted: date(r.date_submitted), distanceM: Math.round(haversineMeters(lat, lng, Number(r.lat), Number(r.lng))) })) }, source, "Nearby development is area context, not a permission or approval on this property.");
  result.truncated = records.length >= 201 || matches.length > 25;
  return result;
}
export async function importedLayers(address: string | null, city: string | null, location: Location | null): Promise<Record<string, Layer>> {
  const inv = await inventory();
  const jobs: Record<string, () => Promise<Layer>> = {
    assessment: () => addressLayer(inv, "assessment", address, city), permits: () => addressLayer(inv, "permits", address, city), variance: () => addressLayer(inv, "variance", address, city),
    neighbourhood: () => spatial(inv, "neighbourhood", location), parcel: () => spatial(inv, "parcel", location), ward: () => spatial(inv, "ward", location), zoning: () => spatial(inv, "zoning", location), development: () => development(inv, location),
  };
  return Object.fromEntries(await Promise.all(Object.entries(jobs).map(async ([name, run]) => {
    try { return [name, await run()]; } catch { return [name, layer("unavailable", null, null, "Imported layer could not be read.")]; }
  })));
}
