import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { useTestDb } from "@/lib/test/db";
import { importedLayers, inventory } from "./imported";
import type { Location } from "./model";
let testDb: Awaited<ReturnType<typeof useTestDb>>;
beforeAll(async () => {
  testDb = await useTestDb();
  await testDb.sql.exec("DROP TABLE data_layers, assessment_units, building_permits, census_da_boundaries, census_da_profiles, toronto_parcels, municipal_wards, toronto_zoning_polygons, development_applications, coa_applications, property_import_runs, national_addresses, assessment_history, ns_property_land, development_application_sites");
}, 30_000);
afterAll(async () => { await testDb.close(); });
const geo: Location = { address: "90 Ash Crescent", city: "Toronto", province: "Ontario", latitude: 43.6, longitude: -79.4, accuracy: "caller_supplied", provider: "caller" };
describe("existing Realist open-data imports", () => {
  it("reports absent tables without creating or importing them", async () => {
    const result = await importedLayers("90 Ash Crescent", "Toronto", geo);
    expect(result.parcel.status).toBe("not_loaded"); expect(result.assessment.status).toBe("not_loaded");
    expect((await inventory()).tables.size).toBe(0);
  });
  it("reads a registered parcel by point-in-polygon and separates import time from observation", async () => {
    await testDb.sql.exec(`CREATE TABLE data_layers (key text, name text, source_url text, licence text, attribution text, geography text, refresh_cadence text, last_imported_at timestamp, row_count integer);
      CREATE TABLE toronto_parcels (parcel_id text, lot_area_m2 real, geojson jsonb, min_lat real, max_lat real, min_lng real, max_lng real, imported_at timestamp);
      INSERT INTO data_layers (key,name,source_url,licence,attribution) VALUES ('toronto_parcels','Toronto parcels','https://open.toronto.ca/','OGL Toronto','City of Toronto');
      INSERT INTO toronto_parcels VALUES ('P1',400,'{"type":"Polygon","coordinates":[[[-79.5,43.5],[-79.3,43.5],[-79.3,43.7],[-79.5,43.7],[-79.5,43.5]]]}',43.5,43.7,-79.5,-79.3,'2026-07-01');`);
    const result = await importedLayers("90 Ash Crescent", "Toronto", geo);
    expect(result.parcel.status).toBe("available"); expect(result.parcel.data).toEqual({ parcelId: "P1", lotAreaM2: 400 }); expect(result.parcel.importedAt).not.toBeNull(); expect(result.parcel.sourceUpdatedAt).toBeNull();
  });
  it("withholds parcel data for interpolated coordinates and another city", async () => {
    expect((await importedLayers("90 Ash Crescent", "Toronto", { ...geo, accuracy: "street_interpolated" })).parcel.status).toBe("skipped");
    expect((await importedLayers("90 Ash Crescent", "Calgary", { ...geo, city: "Calgary" })).parcel.status).toBe("not_supported");
  });
  it("does not match an address in another municipality, even when it is the only candidate", async () => {
    await testDb.sql.exec(`CREATE TABLE assessment_units (source text, address text, municipality_name text, loose_address_key text, roll_year integer, matricule text, year_built integer, floor_area_m2 real, lot_area_m2 real, frontage_m real, dwellings integer, land_value bigint, building_value bigint, total_value bigint, market_ref_date text, imported_at timestamp);
      INSERT INTO data_layers (key,name,source_url,licence,attribution) VALUES ('qc_assessment_roll','Québec rolls','https://donneesouvertes.affmunqc.net/','CC BY 4.0','MAMH');
      INSERT INTO assessment_units (source,address,municipality_name,loose_address_key,total_value) VALUES ('qc-mamh','47 Chemin Saint-Isidore','Wrong City','47 saint isidore',200000);`);
    expect((await importedLayers("47 Chemin Saint-Isidore", "Right City", null)).assessment.status).toBe("no_match");
    const match = (await importedLayers("47 Chemin Saint-Isidore", "Wrong City", null)).assessment;
    expect(match.status).toBe("available"); expect(match.data).toMatchObject({ assessedValue: 200000 });
  });
  it("finds published abbreviations while withholding different streets and competing units", async () => {
    await testDb.sql.exec(`INSERT INTO assessment_units(source,address,municipality_name,loose_address_key,total_value) VALUES ('qc-mamh','90 ASH CRES','Toronto','90 ash cres',250000);`);
    expect((await importedLayers("90 Ash Crescent", "Toronto", null)).assessment.data).toMatchObject({ assessedValue: 250000 });
    expect((await importedLayers("90 Ash Road", "Toronto", null)).assessment.status).toBe("no_match");
    await testDb.sql.exec(`INSERT INTO assessment_units(source,address,municipality_name,loose_address_key,total_value) VALUES ('qc-mamh','90 ASH CRES','Toronto','90 ash cres',300000);`);
    expect((await importedLayers("90 Ash Crescent", "Toronto", null)).assessment.status).toBe("ambiguous");
  });
  it("rejects a record in a same-named municipality in another province", async () => {
    await testDb.sql.exec(`INSERT INTO assessment_units(source,address,municipality_name,loose_address_key,total_value) VALUES ('qc-mamh','40 Main Street','Richmond','40 main street',200000);`);
    expect((await importedLayers("40 Main Street", "Richmond", null, "BC")).assessment.status).toBe("not_supported");
    expect((await importedLayers("40 Main Street", "Richmond", null, "QC")).assessment.data).toMatchObject({ assessedValue: 200000 });
  });
  it("keeps account dwelling totals without summing duplicate NS building rows or guessing physical facts", async () => {
    await testDb.sql.exec(`INSERT INTO data_layers(key,name,source_url,licence,attribution) VALUES ('ns-pvsc-values','NS values','https://www.thedatazone.ca/','PVSC','PVSC'),('ns-pvsc','NS dwelling characteristics','https://www.thedatazone.ca/','PVSC','PVSC');
      INSERT INTO assessment_units(source,address,municipality_name,loose_address_key,matricule,total_value) VALUES ('ns-pvsc-values','23 Park Street','Halifax','23 park street','AN1',300000);
      INSERT INTO assessment_units(source,address,municipality_name,loose_address_key,matricule,dwellings,year_built,floor_area_m2) VALUES ('ns-pvsc','23 Park Street','Halifax','23 park street','AN1/R1',4,1980,100),('ns-pvsc','23 Park Street','Halifax','23 park street','AN1/R2',4,1990,200);`);
    expect((await importedLayers("23 Park St", "Halifax", null, "NS")).assessment.data).toMatchObject({ assessedValue: 300000, dwellingUnits: 4, yearBuilt: null, floorAreaM2: null });
    await testDb.sql.exec("DELETE FROM data_layers WHERE key='ns-pvsc'");
    expect((await importedLayers("23 Park St", "Halifax", null, "NS")).assessment.data).toMatchObject({ dwellingUnits: null, yearBuilt: null });
    await testDb.sql.exec(`INSERT INTO assessment_units(source,address,municipality_name,loose_address_key,matricule,total_value) VALUES ('ns-pvsc-values','23 Park Street','Halifax','23 park street','AN2',400000);`);
    expect((await importedLayers("23 Park St", "Halifax", null, "NS")).assessment.status).toBe("ambiguous");
  });
});
