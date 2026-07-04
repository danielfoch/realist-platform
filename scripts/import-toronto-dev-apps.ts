/**
 * Toronto Development Applications importer for the enrichment spine.
 *
 *   npx tsx scripts/import-toronto-dev-apps.ts
 *
 * Streams the CKAN datastore dump CSV (open.toronto.ca resource 8907d8ed),
 * reprojects each record's MTM Zone 10 X/Y to WGS84 (shared/torontoMtm.ts), and
 * upserts into development_applications by (source, application_number). The
 * enrichment API then surfaces "development activity within 800m" on listings.
 * Re-runnable; schedule ~weekly (the AIC dataset updates frequently).
 */

import { Readable } from "node:stream";
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { ensureEnrichmentTables, recordDataLayer } from "../server/enrichment";
import { createCsvStreamParser } from "../shared/streamingCsv";
import {
  mapDevelopmentRow,
  DEVELOPMENT_APPLICATIONS_ATTRIBUTION,
  type DevelopmentApplication,
} from "../shared/developmentApplications";

const SOURCE = "toronto";
const BATCH_SIZE = 500;
const DUMP_URL =
  process.env.TORONTO_DEV_APPS_URL ||
  "https://ckan0.cf.opendata.inter.prod-toronto.ca/datastore/dump/8907d8ed-c515-4ce9-b674-9f8c6eefcf0d";

async function flushBatch(batch: DevelopmentApplication[]): Promise<void> {
  if (!batch.length) return;
  const unique = [...new Map(batch.map((r) => [r.applicationNumber, r])).values()];
  const values = unique.map(
    (r) => sql`(${SOURCE}, ${r.applicationNumber}, ${r.applicationType}, ${r.status}, ${r.address},
        ${r.description}, ${r.dateSubmitted}, ${r.wardNumber}, ${r.wardName}, ${r.applicationUrl},
        ${r.lat}, ${r.lng}, now())`,
  );
  await db.execute(sql`
    INSERT INTO development_applications
      (source, application_number, application_type, status, address, description, date_submitted,
       ward_number, ward_name, application_url, lat, lng, imported_at)
    VALUES ${sql.join(values, sql`, `)}
    ON CONFLICT (source, application_number) DO UPDATE SET
      application_type = EXCLUDED.application_type,
      status = EXCLUDED.status,
      address = EXCLUDED.address,
      description = EXCLUDED.description,
      date_submitted = EXCLUDED.date_submitted,
      ward_number = EXCLUDED.ward_number,
      ward_name = EXCLUDED.ward_name,
      application_url = EXCLUDED.application_url,
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      imported_at = now()
  `);
}

async function main(): Promise<void> {
  await ensureEnrichmentTables();
  console.log(`Downloading Toronto development applications — ${DUMP_URL}`);
  const resp = await fetch(DUMP_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (realist.ca open-data importer; hello@realist.ca)" },
    signal: AbortSignal.timeout(20 * 60 * 1000),
  });
  if (!resp.ok || !resp.body) throw new Error(`Toronto dev apps: HTTP ${resp.status}`);

  const parser = createCsvStreamParser();
  const decoder = new TextDecoder("utf-8");
  let header: string[] | null = null;
  let batch: DevelopmentApplication[] = [];
  let imported = 0;
  let skipped = 0;
  let geocoded = 0;

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
      const rec = mapDevelopmentRow(row);
      if (!rec) {
        skipped++;
        continue;
      }
      if (rec.lat !== null) geocoded++;
      batch.push(rec);
      if (batch.length >= BATCH_SIZE) {
        await flushBatch(batch);
        imported += batch.length;
        batch = [];
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
    key: "toronto_development_applications",
    name: "Toronto development applications (AIC)",
    sourceUrl: "https://open.toronto.ca/dataset/development-applications/",
    licence: "Open Government Licence – Toronto",
    attribution: DEVELOPMENT_APPLICATIONS_ATTRIBUTION,
    geography: "Toronto",
    refreshCadence: "weekly (Application Information Centre updates frequently)",
    rowCount: imported,
    notes: `${geocoded}/${imported} geocoded (MTM Zone 10 → WGS84)`,
  });
  console.log(`Toronto dev apps done: ${imported} imported (${geocoded} geocoded), ${skipped} skipped`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[toronto-dev-apps] import failed:", err);
  process.exit(1);
});
