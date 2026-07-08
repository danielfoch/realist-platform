/**
 * Import Toronto precedent data: Address Points (geocoder), building permits
 * that created units, and Committee of Adjustment decisions.
 *
 *   npx tsx scripts/import-toronto-precedents.ts addresses   # do FIRST — geocoder
 *   npx tsx scripts/import-toronto-precedents.ts permits     # cleared + active
 *   npx tsx scripts/import-toronto-precedents.ts coa
 *   npx tsx scripts/import-toronto-precedents.ts all
 *
 * All three are CKAN datastore resources (verified 2026-07-07). Permits and CoA
 * carry a street address but no coordinates, so they are geocoded against the
 * address-point table built by `addresses` — run it first. Licence: OGL – Toronto.
 */

import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { ensureEnrichmentTables, recordDataLayer } from "../server/enrichment";
import { normalizeAddressKey } from "../server/torontoGeo";
import { ensureAddressPointTables, buildGeocodeIndex, type TorontoGeocode } from "../server/geocodeToronto";
import { ensurePrecedentTables, classifyCoaDecision } from "../server/precedents";
import { eachDatastoreBatch, parseCkanGeometry, resolveResourceId, type CkanRecord } from "./ckanDatastore";

const ATTRIBUTION = "Contains information licensed under the Open Government Licence – Toronto.";

// Verified datastore resource ids (env-overridable for refresh).
const ADDRESS_RESOURCE = process.env.TORONTO_ADDRESS_RESOURCE_ID || "0b3756af-9caf-4f0f-ac28-9c6617adede4";
const PERMITS_CLEARED_RESOURCE = process.env.TORONTO_PERMITS_CLEARED_RESOURCE_ID || "a96c0ba4-3026-402b-b09d-5b1268b8f810";
const COA_RESOURCE = process.env.TORONTO_COA_RESOURCE_ID || "51fd09cd-99d6-430a-9d42-c24a937b0cb0";

function str(rec: CkanRecord, keys: string[]): string | null {
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}
function int(rec: CkanRecord, keys: string[]): number | null {
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Math.round(Number(v));
  }
  return null;
}
/** Build a normalized address key from separate street-part fields. */
function addressKeyFromParts(rec: CkanRecord): { key: string; display: string } | null {
  const numRaw = str(rec, ["STREET_NUM", "STREET_NUMBER"]);
  const name = str(rec, ["STREET_NAME", "LINEAR_NAME"]);
  if (!numRaw || !name) return null;
  const type = str(rec, ["STREET_TYPE"]) || "";
  const dir = str(rec, ["STREET_DIRECTION"]) || "";
  const display = [numRaw, name, type, dir].filter(Boolean).join(" ");
  return { key: normalizeAddressKey(display), display };
}

async function importAddresses(): Promise<void> {
  await db.execute(sql`TRUNCATE toronto_address_points`);
  let imported = 0, skipped = 0;
  const total = await eachDatastoreBatch(ADDRESS_RESOURCE, async (records) => {
    for (const rec of records) {
      const geom = parseCkanGeometry(rec.geometry);
      const full = str(rec, ["ADDRESS_FULL"]);
      if (!geom || geom.type !== "Point" || !Array.isArray(geom.coordinates) || !full) { skipped++; continue; }
      const [lng, lat] = geom.coordinates as [number, number];
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) { skipped++; continue; }
      const key = normalizeAddressKey(full);
      if (!key) { skipped++; continue; }
      const ward = int(rec, ["WARD"]);
      // ON CONFLICT: first write wins; duplicate civic addresses (rare) keep one point.
      await db.execute(sql`
        INSERT INTO toronto_address_points (address_key, full_address, ward, lat, lng)
        VALUES (${key}, ${full}, ${ward}, ${lat}, ${lng})
        ON CONFLICT (address_key) DO NOTHING
      `);
      imported++;
    }
    if (imported % 50000 < records.length) console.log(`[addresses] ${imported}...`);
  });
  console.log(`[addresses] done: ${imported} imported, ${skipped} skipped (of ${total})`);
  await recordDataLayer({
    key: "toronto_address_points", name: "Toronto Address Points (geocoder)",
    sourceUrl: "https://open.toronto.ca/dataset/address-points-municipal-toronto-one-address-repository/",
    licence: "Open Government Licence – Toronto", attribution: ATTRIBUTION,
    geography: "City of Toronto (civic address points)", refreshCadence: "as-available",
    rowCount: imported, notes: "Civic-address geocoder + ward for permit/CoA joins.",
  });
}

async function geocodeAndInsertPermits(resourceId: string, index: Map<string, TorontoGeocode>): Promise<{ imported: number; unmatched: number }> {
  let imported = 0, unmatched = 0;
  await eachDatastoreBatch(resourceId, async (records) => {
    for (const rec of records) {
      const created = int(rec, ["DWELLING_UNITS_CREATED"]);
      if (created == null || created < 1) continue; // only unit-adding permits
      const addr = addressKeyFromParts(rec);
      if (!addr) continue;
      const geo = index.get(addr.key);
      if (!geo) { unmatched++; continue; }
      await db.execute(sql`
        INSERT INTO toronto_permits (permit_num, geo_id, address, structure_type, permit_type, work, current_use, proposed_use, units_created, units_lost, status, issued_date, lat, lng)
        VALUES (
          ${str(rec, ["PERMIT_NUM"])}, ${str(rec, ["GEO_ID"])}, ${addr.display},
          ${str(rec, ["STRUCTURE_TYPE"])}, ${str(rec, ["PERMIT_TYPE"])}, ${str(rec, ["WORK"])},
          ${str(rec, ["CURRENT_USE"])}, ${str(rec, ["PROPOSED_USE"])},
          ${created}, ${int(rec, ["DWELLING_UNITS_LOST"])}, ${str(rec, ["STATUS"])},
          ${str(rec, ["ISSUED_DATE", "APPLICATION_DATE"])}, ${geo.lat}, ${geo.lng}
        )
      `);
      imported++;
    }
  });
  return { imported, unmatched };
}

async function importPermits(): Promise<void> {
  const index = await buildGeocodeIndex();
  if (index.size === 0) throw new Error("Address points not loaded — run `addresses` first.");
  await db.execute(sql`TRUNCATE toronto_permits`);

  const cleared = await geocodeAndInsertPermits(PERMITS_CLEARED_RESOURCE, index);
  let active = { imported: 0, unmatched: 0 };
  const activeResource = process.env.TORONTO_PERMITS_ACTIVE_RESOURCE_ID
    || await resolveResourceId("building-permits-active-permits");
  if (activeResource) active = await geocodeAndInsertPermits(activeResource, index);

  const imported = cleared.imported + active.imported;
  const unmatched = cleared.unmatched + active.unmatched;
  const seen = imported + unmatched;
  // Fail loudly rather than write an empty/degenerate precedent layer if the
  // address-key join silently stops matching (e.g. an upstream format change).
  if (seen > 0 && imported / seen < 0.5) {
    throw new Error(`[permits] geocode match rate ${(100 * imported / seen).toFixed(1)}% (< 50%) — address-key join likely broken; aborting before recording layer.`);
  }
  console.log(`[permits] done: ${imported} unit-adding permits (cleared ${cleared.imported}, active ${active.imported}); unmatched ${unmatched}`);
  await recordDataLayer({
    key: "toronto_permits", name: "Toronto Building Permits — unit-adding",
    sourceUrl: "https://open.toronto.ca/dataset/building-permits-cleared-permits/",
    licence: "Open Government Licence – Toronto", attribution: ATTRIBUTION,
    geography: "City of Toronto (geocoded permits)", refreshCadence: "daily",
    rowCount: imported, notes: "Permits with DWELLING_UNITS_CREATED ≥ 1 — the add-a-unit precedent signal.",
  });
}

async function importCoa(): Promise<void> {
  const index = await buildGeocodeIndex();
  if (index.size === 0) throw new Error("Address points not loaded — run `addresses` first.");
  await db.execute(sql`TRUNCATE toronto_coa`);
  let imported = 0, unmatched = 0;
  await eachDatastoreBatch(COA_RESOURCE, async (records) => {
    for (const rec of records) {
      const addr = addressKeyFromParts(rec);
      if (!addr) continue;
      const geo = index.get(addr.key);
      if (!geo) { unmatched++; continue; }
      const decision = str(rec, ["C_OF_A_DESCISION", "C_OF_A_DECISION", "DECISION"]);
      await db.execute(sql`
        INSERT INTO toronto_coa (reference_file, address, application_type, work_type, decision, decision_class, appeal_decision, hearing_date, lat, lng)
        VALUES (
          ${str(rec, ["REFERENCE_FILE#", "REFERENCE_FILE"])}, ${addr.display},
          ${str(rec, ["APPLICATION_TYPE"])}, ${str(rec, ["WORK_TYPE", "SUB_TYPE"])},
          ${decision}, ${classifyCoaDecision(decision)}, ${str(rec, ["OMB_DESCISION", "OMB_DECISION"])},
          ${str(rec, ["HEARING_DATE"])}, ${geo.lat}, ${geo.lng}
        )
      `);
      imported++;
    }
    if (imported % 20000 < records.length) console.log(`[coa] ${imported}...`);
  });
  const coaSeen = imported + unmatched;
  if (coaSeen > 0 && imported / coaSeen < 0.5) {
    throw new Error(`[coa] geocode match rate ${(100 * imported / coaSeen).toFixed(1)}% (< 50%) — address-key join likely broken; aborting before recording layer.`);
  }
  console.log(`[coa] done: ${imported} decisions imported; unmatched ${unmatched}`);
  await recordDataLayer({
    key: "toronto_coa", name: "Toronto Committee of Adjustment — decisions",
    sourceUrl: "https://open.toronto.ca/dataset/committee-of-adjustment-applications/",
    licence: "Open Government Licence – Toronto", attribution: ATTRIBUTION,
    geography: "City of Toronto (geocoded variance decisions)", refreshCadence: "weekly",
    rowCount: imported, notes: "Minor-variance approve/refuse record — the variance-approval-rate signal.",
  });
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (!mode || !["addresses", "permits", "coa", "all"].includes(mode)) {
    console.error("Usage: npx tsx scripts/import-toronto-precedents.ts <addresses|permits|coa|all>");
    process.exit(1);
  }
  await ensureEnrichmentTables();
  await ensureAddressPointTables();
  await ensurePrecedentTables();
  if (mode === "addresses" || mode === "all") await importAddresses();
  if (mode === "permits" || mode === "all") await importPermits();
  if (mode === "coa" || mode === "all") await importCoa();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
