/**
 * Toronto Address Points geocoder.
 *
 * The permits + Committee of Adjustment datasets carry a street address but no
 * coordinates, and Address Points carries no GEO_ID — so the join is on a
 * normalized address string. This owns the address-point table + the lookups:
 *
 *   toronto_address_points — ADDRESS_FULL point layer (normalized key → lat/lng/ward)
 *
 * Runtime: geocodeTorontoAddress(address) for exact civic-address resolution
 * (cheaper + more precise than Nominatim inside Toronto) and its ward.
 * Import time: buildGeocodeIndex() loads the table into a Map for bulk joins.
 *
 * Populated by scripts/import-toronto-precedents.ts (address mode).
 */

import { sql } from "drizzle-orm";
import { db } from "./db";
import { normalizeAddressKey } from "./torontoGeo";

export async function ensureAddressPointTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS toronto_address_points (
      address_key text PRIMARY KEY,
      full_address text,
      ward        integer,
      lat         double precision NOT NULL,
      lng         double precision NOT NULL,
      imported_at timestamp NOT NULL DEFAULT now()
    )
  `);
}

export interface TorontoGeocode {
  lat: number;
  lng: number;
  ward: number | null;
  fullAddress: string | null;
}

/** Resolve a Toronto civic address to a point + ward via Address Points. */
export async function geocodeTorontoAddress(address: string): Promise<TorontoGeocode | null> {
  const key = normalizeAddressKey(address);
  if (!key) return null;
  const rows = await db.execute(sql`
    SELECT full_address, ward, lat, lng FROM toronto_address_points WHERE address_key = ${key} LIMIT 1
  `);
  const r = rows.rows[0] as { full_address: string | null; ward: number | null; lat: number; lng: number } | undefined;
  if (!r) return null;
  return { lat: r.lat, lng: r.lng, ward: r.ward, fullAddress: r.full_address };
}

/** Load the whole address-point table into a Map for import-time bulk geocoding. */
export async function buildGeocodeIndex(): Promise<Map<string, TorontoGeocode>> {
  const rows = await db.execute(sql`SELECT address_key, full_address, ward, lat, lng FROM toronto_address_points`);
  const index = new Map<string, TorontoGeocode>();
  for (const r of rows.rows as Array<{ address_key: string; full_address: string | null; ward: number | null; lat: number; lng: number }>) {
    index.set(r.address_key, { lat: r.lat, lng: r.lng, ward: r.ward, fullAddress: r.full_address });
  }
  return index;
}

export async function addressPointsLoaded(): Promise<boolean> {
  const r = await db.execute(sql`SELECT 1 FROM toronto_address_points LIMIT 1`);
  return r.rows.length > 0;
}
