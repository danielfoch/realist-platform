import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { cityKey, layer, number, streetKey, type Layer, type Location, type PropertyRequest, type Source } from "./model";

export const NAR_SOURCE: Source = { id: "statcan-nar-202606", name: "National Address Register, June 2026", url: "https://www150.statcan.gc.ca/n1/pub/46-26-0002/462600022022001-eng.htm", licence: "Statistics Canada Open Licence; includes information under Open Government Licence – Yukon", attribution: "Source: Statistics Canada, National Address Register, June 2026. Adapted under the Statistics Canada Open Licence. Contains information licensed under the Open Government Licence – Yukon." };
const codes: Record<string, string> = { ontario: "ON", alberta: "AB", "british columbia": "BC", manitoba: "MB", "nova scotia": "NS", "new brunswick": "NB", quebec: "QC", saskatchewan: "SK", "newfoundland and labrador": "NL", "prince edward island": "PE", "northwest territories": "NT", nunavut: "NU", yukon: "YT" };

/** Resolve a building ID, never select one of several units or neighbouring buildings. */
export async function nationalAddress(input: PropertyRequest, provinceKey: (v: string) => string): Promise<Layer<Location> | null> {
  const address = input.address?.split(",")[0];
  const city = input.city ?? input.address?.split(",")[1]?.trim();
  const province = input.province ?? input.address?.split(",")[2]?.trim();
  if (!address || !city || !province || !codes[provinceKey(province)]) return null;
  try {
    const registered = await getDb().execute(sql`SELECT row_count FROM data_layers WHERE key = 'national_address_register' AND row_count > 0 LIMIT 1`);
    if (!registered.rows.length) return null;
    const key = streetKey(address), c = cityKey(city), p = codes[provinceKey(province)];
    const result = await getDb().execute(sql`SELECT l.location_id, l.latitude, l.longitude, l.blockface_latitude, l.blockface_longitude, l.csduid,
      count(*) AS published_address_records,
      array_remove(array_agg(DISTINCT to_jsonb(a)->>'postal_code'),NULL) AS postal_codes,
      array_remove(array_agg(DISTINCT to_jsonb(a)->>'building_usage'),NULL) AS building_usage_codes
      FROM national_addresses a JOIN national_locations l ON l.location_id = a.location_id
      WHERE a.province = ${p} AND (a.street_key = ${key} OR a.mailing_street_key = ${key})
      AND (a.city_key = ${c} OR a.city_fr_key = ${c} OR a.mailing_city_key = ${c})
      GROUP BY l.location_id,l.latitude,l.longitude,l.blockface_latitude,l.blockface_longitude,l.csduid LIMIT 51`);
    if (!result.rows.length) return null;
    if (result.rows.length !== 1) return layer("ambiguous", null, NAR_SOURCE, "More than one published building location uses this civic address; no location guessed.");
    const r = result.rows[0], building = number(r.latitude) !== null && number(r.longitude) !== null;
    const latitude = number(building ? r.latitude : r.blockface_latitude), longitude = number(building ? r.longitude : r.blockface_longitude);
    if (latitude === null || longitude === null || latitude < 41 || latitude > 84 || longitude < -142 || longitude > -52) return null;
    const municipality = String(r.csduid) === "3520005" ? "Toronto" : city;
    return layer("available", { address, city: municipality, province: p, latitude, longitude, accuracy: building ? "source_building_point" : "blockface_representative", provider: NAR_SOURCE.id,
      addressRegister: { buildingId: String(r.location_id), publishedAddressRecords: Number(r.published_address_records), postalCodes: r.postal_codes as string[], buildingUsageCodes: r.building_usage_codes as string[], csduid: r.csduid ? String(r.csduid) : null },
    }, NAR_SOURCE, building ? "Published building coordinate matched by civic address, municipality and province. Reference period June 2026; verify position near boundaries. Published address-record count is not a verified dwelling count." : "Blockface representative coordinate is approximate and must not select a parcel or zoning permission.", "2026-06-26");
  } catch { return null; }
}
