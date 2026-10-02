import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { useTestDb } from "@/lib/test/db";
import { nationalAddress } from "./national";
import { provinceKey } from "./geocode";
let testDb: Awaited<ReturnType<typeof useTestDb>>;
beforeAll(async () => {
  testDb = await useTestDb();
  await testDb.sql.exec("DROP TABLE data_layers, national_addresses, national_locations");
  await testDb.sql.exec(`CREATE TABLE data_layers(key text, row_count integer);
    CREATE TABLE national_addresses(location_id text, province text,street_key text,mailing_street_key text,city_key text,city_fr_key text,mailing_city_key text);
    CREATE TABLE national_locations(location_id text,latitude real,longitude real,blockface_latitude real,blockface_longitude real,csduid text);
    INSERT INTO national_locations VALUES ('A',43.6,-79.4,43.61,-79.41,'3520005'),('B',43.62,-79.42,43.61,-79.41,'3520005');
    INSERT INTO national_addresses VALUES ('A','ON','90 ash crescent',NULL,'toronto',NULL,NULL),('A','ON','90 ash crescent',NULL,'toronto',NULL,NULL);`);
}, 30_000);
afterAll(async () => testDb.close());
const input = { address: "90 Ash Cres, Toronto, ON" };
describe("published national building coordinates", () => {
  it("requires a registered release before exposing partial import rows", async () => {
    expect(await nationalAddress(input, provinceKey)).toBeNull();
    await testDb.sql.exec("INSERT INTO data_layers VALUES('national_address_register',2)");
  });
  it("joins multiple units at one published building without guessing a unit", async () => {
    const result = await nationalAddress(input, provinceKey);
    expect(result?.status).toBe("available");
    expect(result?.data).toMatchObject({ accuracy: "source_building_point", province: "ON" });
    expect(result?.sourceUpdatedAt).toBe("2026-06-26");
    expect(await nationalAddress({ address: "90 Ash Cres, Toronto, BC" }, provinceKey)).toBeNull();
  });
  it("withholds a parcel position when two buildings use the same civic address", async () => {
    await testDb.sql.exec("INSERT INTO national_addresses VALUES('B','ON','90 ash crescent',NULL,'toronto',NULL,NULL)");
    const result = await nationalAddress(input, provinceKey);
    expect(result?.status).toBe("ambiguous"); expect(result?.data).toBeNull();
    await testDb.sql.exec("DELETE FROM national_addresses WHERE location_id='B'");
  });
  it("labels a blockface as approximate when building coordinates are unpublished", async () => {
    await testDb.sql.exec("UPDATE national_locations SET latitude=NULL,longitude=NULL WHERE location_id='A'");
    expect((await nationalAddress(input, provinceKey))?.data?.accuracy).toBe("blockface_representative");
  });
});
