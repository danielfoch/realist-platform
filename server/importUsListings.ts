/**
 * Import US listings from a HomeHarvest CSV export into the us_listings table.
 *
 * Produce the CSV with the HomeHarvest Python library (scrapes Realtor.com):
 *   pip install homeharvest
 *   homeharvest "Buffalo, NY" --listing_type for_sale --output csv --filename us_listings
 *
 * Usage:
 *   npm run import:us -- path/to/us_listings.csv
 *   (requires DATABASE_URL; deploy schema first with `npm run db:push`)
 *
 * Behavior intentionally mirrors POST /api/ingest/us-listings (server/routes.ts):
 *   - idempotent upsert keyed on (source='homeharvest', source_id)
 *   - firstSeenAt preserved on update; lastSeenAt/lastCheckedAt bumped
 *   - a us_listing_price_history row is appended when list_price changed
 * so a market can be fed by either the HTTP ingest or this CSV job
 * interchangeably. See US_LISTINGS.md at the repo root.
 */

import { promises as fs } from "fs";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "./db";
import {
  insertUsListingSchema,
  usListingPriceHistory,
  usListings,
  type InsertUsListing,
} from "@shared/schema";
import { csvRowsToRecords, mapHomeHarvestCsvRecord, parseCsv } from "@shared/usListingsCsv";

const BATCH_SIZE = 250;
const SOURCE = "homeharvest";

interface ImportSummary {
  inserted: number;
  updated: number;
  skipped: number;
  priceChanges: number;
}

async function upsertBatch(rows: InsertUsListing[], summary: ImportSummary): Promise<void> {
  const now = new Date();
  const sourceIds = rows.map((row) => row.sourceId);

  // Pre-upsert snapshot: used both to split inserted/updated counts and to
  // derive price-history transitions from the previous stored value.
  const existingRows = await db
    .select({
      id: usListings.id,
      sourceId: usListings.sourceId,
      listPrice: usListings.listPrice,
    })
    .from(usListings)
    .where(and(eq(usListings.source, SOURCE), inArray(usListings.sourceId, sourceIds)));
  const existingByKey = new Map(existingRows.map((row) => [row.sourceId, row]));

  const result = await db
    .insert(usListings)
    .values(rows.map((row) => ({
      ...row,
      firstSeenAt: row.firstSeenAt ?? row.scrapedAt,
      lastSeenAt: row.scrapedAt,
      lastCheckedAt: now,
      updatedAt: now,
    })))
    .onConflictDoUpdate({
      target: [usListings.source, usListings.sourceId],
      set: {
        sourceUrl: sql`excluded.source_url`,
        formattedAddress: sql`excluded.formatted_address`,
        streetAddress: sql`excluded.street_address`,
        city: sql`excluded.city`,
        state: sql`excluded.state`,
        postalCode: sql`excluded.postal_code`,
        county: sql`excluded.county`,
        lat: sql`excluded.lat`,
        lng: sql`excluded.lng`,
        propertyType: sql`excluded.property_type`,
        beds: sql`excluded.beds`,
        baths: sql`excluded.baths`,
        sqft: sql`excluded.sqft`,
        lotSqft: sql`excluded.lot_sqft`,
        yearBuilt: sql`excluded.year_built`,
        listPrice: sql`excluded.list_price`,
        estHoa: sql`excluded.est_hoa`,
        daysOnMarket: sql`excluded.days_on_market`,
        listDate: sql`excluded.list_date`,
        status: sql`excluded.status`,
        isActive: sql`excluded.is_active`,
        statusConfidence: sql`excluded.status_confidence`,
        raw: sql`excluded.raw`,
        scrapedAt: sql`excluded.scraped_at`,
        lastSeenAt: sql`excluded.last_seen_at`,
        lastCheckedAt: sql`excluded.last_checked_at`,
        updatedAt: sql`excluded.updated_at`,
      },
    })
    .returning({ id: usListings.id, sourceId: usListings.sourceId });

  for (const row of result) {
    if (existingByKey.has(row.sourceId)) {
      summary.updated += 1;
    } else {
      summary.inserted += 1;
    }
  }

  // Append-only price history, same rules as the HTTP ingest: oldPrice from
  // the pre-upsert snapshot, newPrice from the payload row; the partial
  // unique index dedupes concurrent re-imports of the same scrape.
  const idByKey = new Map(result.map((row) => [row.sourceId, row.id]));
  const priceHistoryRows = rows.flatMap((row) => {
    const previous = existingByKey.get(row.sourceId);
    const listingId = idByKey.get(row.sourceId);
    if (!previous || !listingId) return [];
    if (previous.listPrice == null || row.listPrice == null) return [];
    if (previous.listPrice === row.listPrice) return [];
    const changeAmount = row.listPrice - previous.listPrice;
    const changePercent = previous.listPrice !== 0
      ? Number(((changeAmount / previous.listPrice) * 100).toFixed(4))
      : null;
    return [{
      listingId,
      source: SOURCE,
      sourceId: row.sourceId,
      oldPrice: previous.listPrice,
      newPrice: row.listPrice,
      changeAmount,
      changePercent,
      scrapedAt: row.scrapedAt,
    }];
  });
  if (priceHistoryRows.length > 0) {
    // Bare onConflictDoNothing on purpose: the dedupe index is partial
    // (WHERE scraped_at IS NOT NULL) and Drizzle's `target` shorthand cannot
    // express the predicate — same approach as /api/ingest/us-listings.
    await db.insert(usListingPriceHistory).values(priceHistoryRows).onConflictDoNothing();
    summary.priceChanges += priceHistoryRows.length;
  }
}

export async function importUsListingsCsv(csvPath: string): Promise<ImportSummary> {
  const content = await fs.readFile(csvPath, "utf8");
  const records = csvRowsToRecords(parseCsv(content));
  const scrapedAt = new Date();

  console.log(`[import-us-listings] ${csvPath}: ${records.length} CSV rows`);

  const summary: ImportSummary = { inserted: 0, updated: 0, skipped: 0, priceChanges: 0 };
  const mapped: InsertUsListing[] = [];
  const seenIds = new Set<string>();
  records.forEach((record, index) => {
    const row = mapHomeHarvestCsvRecord(record, index, scrapedAt);
    if (!row) {
      summary.skipped += 1;
      return;
    }
    // A CSV can repeat an mls_id (e.g. multi-market exports concatenated);
    // ON CONFLICT DO UPDATE cannot touch the same row twice in one INSERT,
    // so keep the last occurrence.
    const parsed = insertUsListingSchema.parse(row);
    if (seenIds.has(parsed.sourceId)) {
      const idx = mapped.findIndex((existing) => existing.sourceId === parsed.sourceId);
      mapped[idx] = parsed;
      summary.skipped += 1;
      return;
    }
    seenIds.add(parsed.sourceId);
    mapped.push(parsed);
  });

  for (let start = 0; start < mapped.length; start += BATCH_SIZE) {
    const batch = mapped.slice(start, start + BATCH_SIZE);
    await upsertBatch(batch, summary);
    console.log(
      `[import-us-listings] processed ${Math.min(start + BATCH_SIZE, mapped.length)}/${mapped.length} ` +
      `(inserted=${summary.inserted} updated=${summary.updated} skipped=${summary.skipped} priceChanges=${summary.priceChanges})`,
    );
  }

  console.log(
    `[import-us-listings] done: inserted=${summary.inserted} updated=${summary.updated} ` +
    `skipped=${summary.skipped} priceChanges=${summary.priceChanges}`,
  );
  return summary;
}

async function main(): Promise<void> {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Missing CSV path. Usage: npm run import:us -- path/to/us_listings.csv");
    process.exitCode = 1;
    return;
  }

  try {
    await importUsListingsCsv(csvPath);
  } catch (error) {
    console.error("[import-us-listings] failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

const isDirectRun = process.argv[1]?.endsWith("importUsListings.ts");
if (isDirectRun) {
  void main();
}
