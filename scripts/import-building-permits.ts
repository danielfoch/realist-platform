/**
 * Municipal building-permit importer for the enrichment spine.
 *
 * Streams each city's open-data CSV export straight from the source into the
 * building_permits table (server/enrichment.ts) and records freshness in
 * data_layers:
 *
 *   npx tsx scripts/import-building-permits.ts vancouver,calgary,montreal
 *   npx tsx scripts/import-building-permits.ts all
 *   npx tsx scripts/import-building-permits.ts list
 *
 * Adapters live in shared/buildingPermits.ts (one mapRow per city; endpoints
 * verified 2026-07). Files are 50-500MB with newlines inside quoted fields —
 * parsed via the incremental RFC 4180 parser in shared/streamingCsv.ts.
 * Re-runnable: upserts by (source, permit_number) — schedule monthly.
 */

import { Readable } from "node:stream";
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { ensureEnrichmentTables, recordDataLayer } from "../server/enrichment";
import { createCsvStreamParser } from "../shared/streamingCsv";
import {
  PERMIT_CITY_ADAPTERS,
  type BuildingPermit,
  type PermitCityAdapter,
} from "../shared/buildingPermits";

const BATCH_SIZE = 500;

async function flushBatch(adapter: PermitCityAdapter, batch: BuildingPermit[]): Promise<void> {
  if (!batch.length) return;
  // The same permit number can appear on multiple CSV rows (one per location);
  // keep the last so the multi-row VALUES upsert never collides with itself.
  const unique = [...new Map(batch.map((p) => [p.permitNumber, p])).values()];
  const values = unique.map(
    (p) => sql`(${adapter.key}, ${p.permitNumber}, ${p.city}, ${p.province}, ${p.address},
        ${p.looseAddressKey}, ${p.permitType}, ${p.workType}, ${p.status}, ${p.description},
        ${p.units}, ${p.estimatedValue}, ${p.issuedDate}, ${p.lat}, ${p.lng}, now())`,
  );
  await db.execute(sql`
    INSERT INTO building_permits
      (source, permit_number, city, province, address, loose_address_key, permit_type,
       work_type, status, description, units, estimated_value, issued_date, lat, lng, imported_at)
    VALUES ${sql.join(values, sql`, `)}
    ON CONFLICT (source, permit_number) DO UPDATE SET
      city = EXCLUDED.city,
      province = EXCLUDED.province,
      address = EXCLUDED.address,
      loose_address_key = EXCLUDED.loose_address_key,
      permit_type = EXCLUDED.permit_type,
      work_type = EXCLUDED.work_type,
      status = EXCLUDED.status,
      description = EXCLUDED.description,
      units = EXCLUDED.units,
      estimated_value = EXCLUDED.estimated_value,
      issued_date = EXCLUDED.issued_date,
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      imported_at = now()
  `);
}

async function importCity(adapter: PermitCityAdapter): Promise<number> {
  console.log(`Downloading ${adapter.name} permits — ${adapter.downloadUrl}`);
  const resp = await fetch(adapter.downloadUrl, {
    headers: adapter.headers,
    signal: AbortSignal.timeout(30 * 60 * 1000),
  });
  if (!resp.ok || !resp.body) throw new Error(`${adapter.name}: HTTP ${resp.status}`);

  const parser = createCsvStreamParser();
  const decoder = new TextDecoder("utf-8");
  let header: string[] | null = null;
  let batch: BuildingPermit[] = [];
  let imported = 0;
  let skipped = 0;

  const handleRows = async (rows: string[][]): Promise<void> => {
    for (const cells of rows) {
      if (!header) {
        // Strip the BOM some exports prepend to the first header cell.
        header = cells.map((c) => c.replace(/^\uFEFF/, "").trim().toLowerCase());
        continue;
      }
      if (cells.length < 2) continue;
      const row: Record<string, string> = {};
      header.forEach((name, i) => {
        row[name] = cells[i] ?? "";
      });
      const permit = adapter.mapRow(row);
      if (!permit) {
        skipped++;
        continue;
      }
      batch.push(permit);
      if (batch.length >= BATCH_SIZE) {
        await flushBatch(adapter, batch);
        imported += batch.length;
        batch = [];
        if (imported % 50_000 === 0) console.log(`  [${adapter.name}] ${imported} permits...`);
      }
    }
  };

  for await (const chunk of Readable.fromWeb(resp.body as import("node:stream/web").ReadableStream)) {
    await handleRows(parser.push(decoder.decode(chunk as Uint8Array, { stream: true })));
  }
  await handleRows(parser.push(decoder.decode()));
  await handleRows(parser.end());
  await flushBatch(adapter, batch);
  imported += batch.length;

  console.log(`  [${adapter.name}] done: ${imported} permits, ${skipped} rows skipped`);
  return imported;
}

async function updateRegistry(): Promise<void> {
  const counts = await db.execute(sql`
    SELECT source, COUNT(*)::int AS n, MAX(issued_date)::text AS latest
    FROM building_permits GROUP BY source ORDER BY source
  `);
  const parts = (counts.rows as Array<{ source: string; n: number; latest: string | null }>).map(
    (r) => `${r.source}: ${r.n} (latest ${r.latest ?? "n/a"})`,
  );
  const total = (counts.rows as Array<{ n: number }>).reduce((s, r) => s + r.n, 0);
  await recordDataLayer({
    key: "building_permits",
    name: "Municipal building permits (open data)",
    sourceUrl: "see shared/buildingPermits.ts adapters",
    licence: PERMIT_CITY_ADAPTERS.map((a) => `${a.name}: ${a.licence}`).join("; "),
    attribution: PERMIT_CITY_ADAPTERS.map((a) => a.attribution).join(" "),
    geography: PERMIT_CITY_ADAPTERS.map((a) => a.name).join(", "),
    refreshCadence: "monthly re-run recommended (datasets update daily/weekly)",
    rowCount: total,
    notes: parts.join("; "),
  });
  console.log(`Registry updated: ${parts.join("; ")}`);
}

async function main(): Promise<void> {
  const arg = (process.argv[2] || "").trim();

  if (arg === "list" || !arg) {
    console.log("Available cities:");
    for (const a of PERMIT_CITY_ADAPTERS) console.log(`  ${a.key}  (${a.name}, ${a.province}) — ${a.licence}`);
    if (!arg) {
      console.error("\nUsage: npx tsx scripts/import-building-permits.ts <city[,city...]|all>");
      process.exit(1);
    }
    return;
  }

  const keys =
    arg === "all"
      ? PERMIT_CITY_ADAPTERS.map((a) => a.key)
      : arg.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);

  await ensureEnrichmentTables();
  for (const key of keys) {
    const adapter = PERMIT_CITY_ADAPTERS.find((a) => a.key === key);
    if (!adapter) throw new Error(`unknown city '${key}' — run with 'list'`);
    await importCity(adapter);
  }
  await updateRegistry();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[building-permits] import failed:", err);
    process.exit(1);
  });
