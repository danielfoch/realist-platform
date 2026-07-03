/**
 * Toronto parcel-boundary importer for the enrichment spine.
 *
 *   npx tsx scripts/import-toronto-parcels.ts
 *
 * Streams the City's "Property Boundaries - 4326" CSV (WGS84; each row carries a
 * GeoJSON MultiPolygon string + STATEDAREA) into the toronto_parcels table.
 * Toronto has no open assessment roll, so this is the lot-size source: a listing
 * is matched to its parcel by point-in-polygon and inherits the parcel's area.
 * Re-runnable (upsert by parcel_id). Large file (~500k parcels) — streamed.
 */

import { Readable } from "node:stream";
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { ensureEnrichmentTables, recordDataLayer } from "../server/enrichment";
import { createCsvStreamParser } from "../shared/streamingCsv";
import { parseParcelRow, TORONTO_PARCELS_ATTRIBUTION, type ParcelRecord } from "../shared/parcels";

const BATCH_SIZE = 200; // polygons are large payloads — keep batches modest
const CSV_URL =
  process.env.TORONTO_PARCELS_URL ||
  "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/1acaa8b0-f235-4df6-8305-02025ccdeb07/resource/23d1f792-018f-4069-ac5d-443e932e1b78/download/property-boundaries-4326.csv";

async function flushBatch(batch: ParcelRecord[]): Promise<void> {
  if (!batch.length) return;
  const unique = [...new Map(batch.map((p) => [p.parcelId, p])).values()];
  const values = unique.map(
    (p) => sql`(${p.parcelId}, ${p.lotAreaM2}, ${JSON.stringify(p.geometry)}::jsonb,
        ${p.bbox.minLng}, ${p.bbox.minLat}, ${p.bbox.maxLng}, ${p.bbox.maxLat}, now())`,
  );
  await db.execute(sql`
    INSERT INTO toronto_parcels (parcel_id, lot_area_m2, geojson, min_lng, min_lat, max_lng, max_lat, imported_at)
    VALUES ${sql.join(values, sql`, `)}
    ON CONFLICT (parcel_id) DO UPDATE SET
      lot_area_m2 = EXCLUDED.lot_area_m2,
      geojson = EXCLUDED.geojson,
      min_lng = EXCLUDED.min_lng, min_lat = EXCLUDED.min_lat,
      max_lng = EXCLUDED.max_lng, max_lat = EXCLUDED.max_lat,
      imported_at = now()
  `);
}

async function main(): Promise<void> {
  await ensureEnrichmentTables();
  console.log(`Downloading Toronto parcels — ${CSV_URL}`);
  const resp = await fetch(CSV_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (realist.ca open-data importer; hello@realist.ca)" },
    signal: AbortSignal.timeout(45 * 60 * 1000),
  });
  if (!resp.ok || !resp.body) throw new Error(`Toronto parcels: HTTP ${resp.status}`);

  const parser = createCsvStreamParser();
  const decoder = new TextDecoder("utf-8");
  let header: string[] | null = null;
  let batch: ParcelRecord[] = [];
  let imported = 0;
  let skipped = 0;
  let withArea = 0;

  const handleRows = async (rows: string[][]): Promise<void> => {
    for (const cells of rows) {
      if (!header) {
        header = cells.map((c) => c.replace(/^\uFEFF/, "").trim().toLowerCase());
        continue;
      }
      if (cells.length < 2) continue;
      const row: Record<string, string> = {};
      header.forEach((name, i) => {
        row[name] = cells[i] ?? "";
      });
      const rec = parseParcelRow(row);
      if (!rec) {
        skipped++;
        continue;
      }
      if (rec.lotAreaM2 !== null) withArea++;
      batch.push(rec);
      if (batch.length >= BATCH_SIZE) {
        await flushBatch(batch);
        imported += batch.length;
        batch = [];
        if (imported % 50_000 === 0) console.log(`  ${imported} parcels...`);
      }
    }
  };

  for await (const chunk of Readable.fromWeb(resp.body as import("node:stream/web").ReadableStream)) {
    await handleRows(parser.push(decoder.decode(chunk as Uint8Array, { stream: true })));
  }
  await handleRows(parser.push(decoder.decode()));
  await handleRows(parser.end());
  await flushBatch(batch);
  imported += batch.length;

  await recordDataLayer({
    key: "toronto_parcels",
    name: "Toronto property boundaries (parcels)",
    sourceUrl: "https://open.toronto.ca/dataset/property-boundaries/",
    licence: "Open Government Licence – Toronto",
    attribution: TORONTO_PARCELS_ATTRIBUTION,
    geography: "Toronto",
    refreshCadence: "on parcel-fabric update (periodic)",
    rowCount: imported,
    notes: `${withArea}/${imported} with a stated lot area`,
  });
  console.log(`Toronto parcels done: ${imported} imported (${withArea} with area), ${skipped} skipped`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[toronto-parcels] import failed:", err);
  process.exit(1);
});
