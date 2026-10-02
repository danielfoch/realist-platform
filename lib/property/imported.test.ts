import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { useTestDb } from "@/lib/test/db";
import { importedLayers, inventory } from "./imported";
import type { Location } from "./model";
let testDb: Awaited<ReturnType<typeof useTestDb>>;
beforeAll(async () => { testDb = await useTestDb(); }, 30_000);
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
});
