import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pointInGeometry, haversineMeters, type AreaGeometry } from "@/lib/geo/geometry";
import { cityKey, date, importedAddressKey, importedAddressKeys, layer, number, publishedYear, sameStreet, text, type Layer, type Location, type Row, type Source } from "./model";
import { SOURCES } from "./municipal";
import { provinceKey } from "./geocode";

const TABLES = ["data_layers", "assessment_units", "building_permits", "census_da_boundaries", "census_da_profiles", "toronto_parcels", "municipal_wards", "toronto_zoning_polygons", "development_applications", "coa_applications", "property_import_runs", "national_addresses", "assessment_history", "ns_property_land", "development_application_sites"] as const;
export interface Inventory { tables: Set<string>; sources: Row[]; available: boolean; imports?: Row[]; }
export async function inventory(): Promise<Inventory> {
  try {
    const result = await getDb().execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN (${sql.join(TABLES.map(t => sql`${t}`), sql`, `)})`);
    const tables = new Set(result.rows.map(r => String(r.table_name)));
    const sources = tables.has("data_layers") ? (await getDb().execute(sql`SELECT key, name, source_url, licence, attribution, geography, refresh_cadence, last_imported_at, row_count FROM data_layers ORDER BY key LIMIT 100`)).rows : [];
    const imports = tables.has("property_import_runs") ? (await getDb().execute(sql`SELECT key, status, expected_rows, processed_rows, rejected_rows, cursor, started_at, updated_at, completed_at, source_updated_at FROM property_import_runs ORDER BY key LIMIT 100`)).rows : [];
    return { tables, sources, available: true, imports };
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
  const key = { parcel: "toronto_parcels", ward: "toronto_wards", zoning: "toronto_zoning", neighbourhood: "census_da_profiles" }[name];
  const source = sourceFor(inv, key);
  if (!source) return layer("not_loaded", null, null, "This spatial layer has no completed, attributed import.");
  if (!location) return layer("skipped", null, null, "No resolved coordinates.");
  if (name !== "neighbourhood" && cityKey(location.city ?? "") !== "toronto") return layer("not_supported", null, null, "Imported spatial layer is scoped to Toronto.");
  // Interpolated road points cannot select a parcel; accept a published building point or verified caller coordinates.
  if (["parcel", "zoning"].includes(name) && !["caller_supplied", "source_building_point"].includes(location.accuracy)) return layer("skipped", null, null, "Supply verified property coordinates for parcel or zoning lookup; street or blockface interpolation is insufficient.");
  const { latitude: lat, longitude: lng } = location;
  const columns = { parcel: sql`parcel_id, lot_area_m2, geojson, imported_at`, ward: sql`ward_code, ward_name, geojson, imported_at`, zoning: sql`zone_code, zone_category, geojson, imported_at`, neighbourhood: sql`dauid, geojson, imported_at, to_jsonb(census_da_boundaries)->'simplification_m' AS simplification_m` }[name];
  const records = (await getDb().execute(sql`SELECT ${columns} FROM ${sql.identifier(table)} WHERE box(point(min_lng,min_lat),point(max_lng,max_lat)) @> point(${lng},${lat}) ${name === "ward" ? sql`AND city = 'Toronto'` : sql``} LIMIT 51`)).rows;
  if (records.length >= 51) return layer("ambiguous", null, null, "Spatial candidate limit reached.");
  const matches = records.filter(r => pointInGeometry(lng, lat, r.geojson as AreaGeometry));
  if (matches.length !== 1) return layer(matches.length ? "ambiguous" : "no_match");
  const r = matches[0];
  let data: unknown;
  if (name === "parcel") data = { parcelId: r.parcel_id, lotAreaM2: number(r.lot_area_m2) };
  else if (name === "ward") data = { code: r.ward_code, name: r.ward_name };
  else if (name === "zoning") data = { zoneCode: r.zone_code, zoneCategory: r.zone_category, scope: "GIS designation; confirm applicable bylaw and permissions with the municipality" };
  else {
    if (!inv.tables.has("census_da_profiles")) return layer("not_loaded", null, source);
    const profile = (await getDb().execute(sql`SELECT profile, census_year, imported_at FROM census_da_profiles WHERE dauid = ${String(r.dauid)} LIMIT 1`)).rows[0];
    if (!profile) return layer("no_match", null, source);
    const p = profile.profile as Row;
    data = { ...p, dauid: r.dauid, censusYear: number(profile.census_year), incomeReferenceYear: 2020, geographyLevel: "dissemination_area", boundarySimplificationM: number(r.simplification_m) ?? 0, note: "Neighbourhood census statistics describe the area, not the subject household or property." };
    r.imported_at = profile.imported_at;
  }
  const result = layer("available", data, source, "Matched to the supplied or approximate location. Verify boundary proximity. importedAt is the import date, not the source observation date.");
  result.importedAt = date(r.imported_at);
  return result;
}

async function addressLayer(inv: Inventory, name: "assessment" | "permits" | "variance", address: string | null, city: string | null, province: string | null): Promise<Layer> {
  const table = { assessment: "assessment_units", permits: "building_permits", variance: "coa_applications" }[name];
  const absent = ready(inv, table);
  if (absent) return absent;
  if (!address || !city) return layer("skipped", null, null, "Address and municipality are required for matching imported records.");
  if (name === "variance" && cityKey(city) !== "toronto") return layer("not_supported");
  const key = importedAddressKey(address);
  if (!key) return layer("skipped");
  const columns = {
    assessment: sql`source, address, municipality_name, roll_year, matricule, year_built, floor_area_m2, lot_area_m2, frontage_m, dwellings, land_value, building_value, total_value, market_ref_date, imported_at, to_jsonb(assessment_units)->'bedrooms' AS bedrooms, to_jsonb(assessment_units)->'bathrooms' AS bathrooms, to_jsonb(assessment_units)->'land_use' AS land_use, to_jsonb(assessment_units)->'storeys' AS storeys, to_jsonb(assessment_units)->'lot_number' AS lot_number, to_jsonb(assessment_units)->'year_built_estimated' AS year_built_estimated, to_jsonb(assessment_units)->'attributes' AS attributes, to_jsonb(assessment_units)->>'source_updated_at' AS source_updated_at`,
    permits: sql`source, address, city, permit_number, permit_type, work_type, status, description, issued_date, estimated_value, units, imported_at`,
    variance: sql`source, address, reference_file, status, decision, description, hearing_date, in_date, imported_at`,
  }[name];
  const municipalityColumn = name === "assessment" ? "municipality_name" : "city";
  const cityFilter = name === "variance" ? sql`` : sql`AND translate(lower(regexp_replace(${sql.identifier(municipalityColumn)}, '^(City of|Ville de) ', '', 'i')), 'àâäéèêëîïôöùûüç', 'aaaeeeeiioouuuc') = ${cityKey(city)}`;
  const provinceCodes: Record<string, string> = { ontario: "ON", alberta: "AB", "british columbia": "BC", manitoba: "MB", "nova scotia": "NS", "new brunswick": "NB", quebec: "QC", saskatchewan: "SK", "newfoundland and labrador": "NL", "prince edward island": "PE", yukon: "YT", "northwest territories": "NT", nunavut: "NU" };
  const code = province ? provinceCodes[provinceKey(province)] : null;
  if (code && name !== "variance") {
    const c = cityKey(city);
    const assessmentScope = (code === "QC" && inv.sources.some(s => s.key === "qc_assessment_roll")) || (code === "NS" && inv.sources.some(s => ["ns-pvsc", "ns-pvsc-values", "municipal_assessment_rolls"].includes(String(s.key)))) || (code === "NB" && inv.sources.some(s => s.key === "nb")) || [["calgary", "AB", "calgary"], ["edmonton", "AB", "edmonton"], ["winnipeg", "MB", "winnipeg"], ["vancouver", "BC", "vancouver-tax"]].some(([city, p, key]) => c === city && code === p && inv.sources.some(s => s.key === key || s.key === "municipal_assessment_rolls"));
    const permitScope = [["calgary", "AB"], ["vancouver", "BC"], ["toronto", "ON"], ["montreal", "QC"]].some(([city, p]) => c === city && code === p && inv.sources.some(s => s.key === `${city}-permits` || s.key === "building_permits"));
    if (!(name === "assessment" ? assessmentScope : permitScope)) return layer("not_supported", null, null, "No completed public import for this municipality/province and layer. Other layers may still return.");
  }
  const provinceFilter = !province ? sql`` : sql`AND COALESCE(to_jsonb(${sql.identifier(table)})->>'province', CASE source WHEN 'qc-mamh' THEN 'QC' WHEN 'ns-pvsc' THEN 'NS' WHEN 'ns-pvsc-values' THEN 'NS' WHEN 'calgary' THEN 'AB' WHEN 'edmonton' THEN 'AB' WHEN 'winnipeg' THEN 'MB' WHEN 'vancouver' THEN 'BC' WHEN 'vancouver-tax' THEN 'BC' WHEN 'montreal' THEN 'QC' WHEN 'nb' THEN 'NB' WHEN 'toronto' THEN 'ON' WHEN 'toronto-coa' THEN 'ON' END) = ${code ?? "unknown"}`;
  const records = (await getDb().execute(sql`SELECT ${columns} FROM ${sql.identifier(table)} WHERE loose_address_key IN (${sql.join(importedAddressKeys(address).map(k => sql`${k}`), sql`, `)}) ${cityFilter} ${provinceFilter} ${name === "permits" ? sql`ORDER BY issued_date DESC NULLS LAST` : name === "assessment" ? sql`ORDER BY CASE source WHEN 'ns-pvsc-values' THEN 0 WHEN 'ns-pvsc' THEN 2 ELSE 1 END` : sql``} LIMIT 51`)).rows;
  if (name === "assessment" && records.length >= 51 && !records.some(r => r.source === "ns-pvsc-values")) return layer("ambiguous", null, null, "Imported record candidate limit reached.");
  let matches = records.filter(r => sameStreet(address, String(r.address)) && (name === "variance" || cityKey(String(r.municipality_name ?? r.city ?? "")) === cityKey(city)));
  const characteristics = name === "assessment" ? matches.filter(r => r.source === "ns-pvsc") : [];
  if (name === "assessment" && matches.some(r => r.source === "ns-pvsc-values")) matches = matches.filter(r => r.source === "ns-pvsc-values");
  if (!matches.length) return layer("no_match");
  // Never collapse multiple condominium/assessment units at an address into a guessed value.
  if (name === "assessment" && matches.length !== 1) return layer("ambiguous", null, null, "Multiple assessment records; no property unit selected.");
  const sources = matches.map(r => name === "permits" ? SOURCES[`${String(r.source)}-permits`] ?? sourceFor(inv, `${String(r.source)}-permits`) ?? sourceFor(inv, "building_permits") : name === "variance" ? sourceFor(inv, "toronto_coa_applications") : sourceFor(inv, String(r.source)));
  if (sources.some(s => !s)) return layer("not_loaded", null, null, "Imported source/licence attribution is missing; records withheld.");
  const source = sources[0]!;
  const r = matches[0];
  if (name === "assessment" && r.source === "ns-pvsc-values") {
    const related = sourceFor(inv, "ns-pvsc") ? characteristics.filter(c => String(c.matricule).split("/")[0] === String(r.matricule)) : [];
    if (related.length === 1 && records.length < 51) for (const field of ["year_built", "floor_area_m2", "dwellings", "bedrooms", "bathrooms", "land_use", "attributes"]) r[field] = related[0][field];
    const publishedDwellings = [...new Set(related.map(c => number(c.dwellings)).filter(v => v !== null))];
    if (publishedDwellings.length === 1 && records.length < 51) r.dwellings = publishedDwellings[0];
    if (inv.tables.has("ns_property_land")) {
      const lot = (await getDb().execute(sql`SELECT lot_area_m2 FROM ns_property_land WHERE account_number = ${String(r.matricule)} LIMIT 1`)).rows[0];
      if (lot && sourceFor(inv, "ns-pvsc-land")) r.lot_area_m2 = lot.lot_area_m2;
    }
  }
  const data = name === "assessment" ? {
    address: matches[0].address, city: matches[0].municipality_name, rollNumber: String(matches[0].matricule).split("/")[0],
    rollYear: publishedYear(matches[0].roll_year), assessedValue: number(matches[0].total_value), landValue: number(matches[0].land_value), buildingValue: number(matches[0].building_value), yearBuilt: publishedYear(matches[0].year_built), floorAreaM2: number(matches[0].floor_area_m2), lotAreaM2: number(matches[0].lot_area_m2), frontageM: number(matches[0].frontage_m), dwellingUnits: number(matches[0].dwellings), currency: "CAD", valuationKind: "municipal_assessment", marketValueEstimate: null,
    bedrooms: number(matches[0].bedrooms), bathrooms: number(matches[0].bathrooms), landUse: text(matches[0].land_use), storeys: number(matches[0].storeys), lotNumber: text(matches[0].lot_number), yearBuiltEstimated: ["qc-mamh", "calgary"].includes(String(matches[0].source)) && typeof matches[0].year_built_estimated === "boolean" ? matches[0].year_built_estimated : null, valuationReferenceDate: date(matches[0].market_ref_date), publishedAttributes: matches[0].attributes ?? {},
  } : name === "permits" ? { permits: matches.slice(0, 25).map((r, i) => ({ permitNumber: r.permit_number, issuedDate: date(r.issued_date), status: r.status, workType: r.work_type, description: text(r.description)?.slice(0, 1000) ?? null, estimatedProjectValue: number(r.estimated_value), source: sources[i] })) } : { applications: matches.slice(0, 25).map(r => ({ fileNumber: /^(SYS:|ROW:)/.test(String(r.reference_file)) ? null : r.reference_file, status: r.status, decision: r.decision, receivedDate: date(r.in_date), hearingDate: date(r.hearing_date), description: text(r.description)?.slice(0, 1000) ?? null })) };
  const result = layer("available", data, source, "Matched by civic address and municipality; assessment values are not market-value estimates. importedAt is not the source observation date.");
  result.importedAt = date(matches[0].imported_at);
  result.sourceUpdatedAt = date(matches[0].source_updated_at);
  result.truncated = name !== "assessment" && (matches.length > 25 || records.length >= 51);
  if (name === "assessment" && inv.tables.has("assessment_history")) {
    const history = (await getDb().execute(sql`SELECT roll_year, land_value, building_value, total_value, taxable_value FROM assessment_history WHERE source = ${String(r.source)} AND account_number = ${String(r.matricule)} ORDER BY roll_year DESC LIMIT 15`)).rows;
    if (history.length) (result.data as Row).assessmentHistory = history.map(h => ({ rollYear: number(h.roll_year), assessedValue: number(h.total_value), landValue: number(h.land_value), buildingValue: number(h.building_value), taxableValue: number(h.taxable_value), currency: "CAD" }));
  }
  if (name === "assessment" && r.source === "ns-pvsc-values") {
    (result.data as Row).supportingSources = [sourceFor(inv, "ns-pvsc"), sourceFor(inv, "ns-pvsc-land")].filter(Boolean);
    result.note = "Municipal assessment applies to the published assessment account. Dwelling characteristics are included only when one matching dwelling is published; otherwise they remain unknown. importedAt is not the valuation date.";
  }
  return result;
}

async function development(inv: Inventory, location: Location | null): Promise<Layer> {
  const siteSource = sourceFor(inv, "toronto_development_sites");
  const table = siteSource && inv.tables.has("development_application_sites") ? "development_application_sites" : "development_applications";
  const absent = ready(inv, table);
  if (absent) return absent;
  if (!location) return layer("skipped");
  if (cityKey(location.city ?? "") !== "toronto") return layer("not_supported");
  const { latitude: lat, longitude: lng } = location;
  const records = (await getDb().execute(sql`SELECT source, application_number, address, status, application_type, description, date_submitted, lat, lng, imported_at FROM ${sql.identifier(table)} WHERE lat BETWEEN ${lat - 0.008} AND ${lat + 0.008} AND lng BETWEEN ${lng - 0.012} AND ${lng + 0.012} AND date_submitted >= now() - interval '36 months' ORDER BY date_submitted DESC LIMIT 201`)).rows;
  const nearby = records.filter(r => haversineMeters(lat, lng, Number(r.lat), Number(r.lng)) <= 800).sort((a, b) => haversineMeters(lat, lng, Number(a.lat), Number(a.lng)) - haversineMeters(lat, lng, Number(b.lat), Number(b.lng)));
  const matches = [...new Map(nearby.reverse().map(r => [r.application_number, r])).values()].sort((a, b) => String(b.date_submitted).localeCompare(String(a.date_submitted)));
  const source = siteSource ?? sourceFor(inv, "toronto_development_applications");
  if (!source) return layer("not_loaded", null, null, "Development source/licence registry entry missing.");
  const result = layer(matches.length ? "available" : "no_match", { radiusM: 800, windowMonths: 36, applications: matches.slice(0, 25).map(r => ({ applicationNumber: r.application_number, address: r.address, status: r.status, applicationType: r.application_type, description: text(r.description)?.slice(0, 1000), dateSubmitted: date(r.date_submitted), distanceM: Math.round(haversineMeters(lat, lng, Number(r.lat), Number(r.lng))) })) }, source, "Nearby development is area context, not a permission or approval on this property.");
  result.truncated = records.length >= 201 || matches.length > 25;
  return result;
}
export async function importedLayers(address: string | null, city: string | null, location: Location | null, province: string | null = location?.province ?? null): Promise<Record<string, Layer>> {
  const inv = await inventory();
  const jobs: Record<string, () => Promise<Layer>> = {
    assessment: () => addressLayer(inv, "assessment", address, city, province), permits: () => addressLayer(inv, "permits", address, city, province), variance: () => addressLayer(inv, "variance", address, city, province),
    neighbourhood: () => spatial(inv, "neighbourhood", location), parcel: () => spatial(inv, "parcel", location), ward: () => spatial(inv, "ward", location), zoning: () => spatial(inv, "zoning", location), development: () => development(inv, location),
  };
  return Object.fromEntries(await Promise.all(Object.entries(jobs).map(async ([name, run]) => {
    try { return [name, await run()]; } catch { return [name, layer("unavailable", null, null, "Imported layer could not be read.")]; }
  })));
}
