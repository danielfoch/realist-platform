/**
 * Rent data ingestion — feeds the comp tables the rent estimator reads.
 *
 * Source: CREA DDF lease listings (the ones carrying a LeaseAmount), licensed
 * data we already pull for sales. ListPrice on a lease listing is the monthly
 * asking rent. Mapping/sanity rules live in lib/rents/observations.ts; this
 * module owns paging, dedupe, and the rent_pulse aggregate rebuild. Scheduling
 * lives with the callers (scripts/sync-rents.ts on GitHub Actions cron).
 *
 * Dedupe: rows key on externalId (ddf-lease:<ListingKey>). New listings
 * insert; still-active ones get scrapedAt refreshed so the estimator's
 * recency weighting reflects that the asking rent is still current.
 *
 * Adding another source later = another adapter producing
 * RentObservationRow[] + a call to upsertObservations.
 */

import { inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { rentListings } from "@/lib/db/schema";
import { searchDdfListings, isDdfConfigured } from "@/lib/ddf/client";
import { ddfLeaseToRentObservation, type RentObservationRow } from "./observations";

const DEFAULT_PROVINCES = [
  "Ontario",
  "British Columbia",
  "Quebec",
  "Alberta",
  "Manitoba",
  "Saskatchewan",
  "Nova Scotia",
  "New Brunswick",
  "Prince Edward Island",
  "Newfoundland and Labrador",
];

const PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 60; // 6k lease listings per province per run
const PAGE_DELAY_MS = 250;
/** rent_pulse aggregates summarize observations from this window. */
const PULSE_WINDOW_DAYS = 90;
/** City×bedrooms groups below this sample size don't produce an aggregate. */
const PULSE_MIN_SAMPLE = 5;
const DEDUPE_CHUNK = 500;

export interface IngestionCounts {
  fetched: number;
  mapped: number;
  inserted: number;
  refreshed: number;
}

async function upsertObservations(rows: RentObservationRow[], dryRun: boolean): Promise<{ inserted: number; refreshed: number }> {
  const db = getDb();
  let inserted = 0;
  let refreshed = 0;
  const now = new Date();

  for (let i = 0; i < rows.length; i += DEDUPE_CHUNK) {
    const chunk = rows.slice(i, i + DEDUPE_CHUNK);
    const ids = chunk.map((r) => r.externalId);
    const existing = await db
      .select({ externalId: rentListings.externalId })
      .from(rentListings)
      .where(inArray(rentListings.externalId, ids));
    const existingIds = new Set(existing.map((e) => e.externalId));

    const fresh = chunk.filter((r) => !existingIds.has(r.externalId));
    const stale = ids.filter((id) => existingIds.has(id));

    if (!dryRun) {
      if (fresh.length > 0) {
        await db.insert(rentListings).values(fresh.map((r) => ({ ...r, scrapedAt: now })));
      }
      if (stale.length > 0) {
        await db.update(rentListings)
          .set({ scrapedAt: now })
          .where(inArray(rentListings.externalId, stale));
      }
    }
    inserted += fresh.length;
    refreshed += stale.length;
  }
  return { inserted, refreshed };
}

export interface RentIngestionOptions {
  provinces?: string[];
  maxPagesPerProvince?: number;
  dryRun?: boolean;
}

/**
 * Crawl DDF lease listings for the given provinces into rent_listings.
 * dryRun fetches and maps without writing — use it to validate volume and
 * mapping quality after deploy.
 */
export async function ingestDdfLeaseListings(options: RentIngestionOptions = {}): Promise<{ totals: IngestionCounts; byProvince: Record<string, IngestionCounts> }> {
  if (!isDdfConfigured()) {
    throw new Error("DDF is not configured (missing credentials)");
  }
  const provinces = options.provinces?.length ? options.provinces : DEFAULT_PROVINCES;
  const maxPages = options.maxPagesPerProvince ?? DEFAULT_MAX_PAGES;
  const dryRun = options.dryRun ?? false;

  const byProvince: Record<string, IngestionCounts> = {};
  const totals: IngestionCounts = { fetched: 0, mapped: 0, inserted: 0, refreshed: 0 };

  for (const province of provinces) {
    const counts: IngestionCounts = { fetched: 0, mapped: 0, inserted: 0, refreshed: 0 };
    const seen = new Set<string>();

    for (let page = 0; page < maxPages; page++) {
      let listings;
      try {
        const result = await searchDdfListings({
          stateOrProvince: province,
          forLease: true,
          top: PAGE_SIZE,
          skip: page * PAGE_SIZE,
        });
        listings = result.listings;
      } catch (error) {
        console.error(`[rent-ingestion] DDF lease search failed for ${province} page ${page}:`, error);
        break;
      }
      if (!listings || listings.length === 0) break;
      counts.fetched += listings.length;

      const rows: RentObservationRow[] = [];
      for (const listing of listings) {
        const row = ddfLeaseToRentObservation(listing);
        // DDF pagination by ModificationTimestamp can repeat across pages
        if (row && !seen.has(row.externalId)) {
          seen.add(row.externalId);
          rows.push(row);
        }
      }
      counts.mapped += rows.length;

      const { inserted, refreshed } = await upsertObservations(rows, dryRun);
      counts.inserted += inserted;
      counts.refreshed += refreshed;

      if (listings.length < PAGE_SIZE) break;
      await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS));
    }

    byProvince[province] = counts;
    totals.fetched += counts.fetched;
    totals.mapped += counts.mapped;
    totals.inserted += counts.inserted;
    totals.refreshed += counts.refreshed;
  }

  return { totals, byProvince };
}

/**
 * Rebuild city-level rent aggregates from recent observations. Inserts a
 * fresh snapshot per (city, province, bedrooms) — rent_pulse is a time
 * series; the estimator reads the latest row per group.
 */
export async function rebuildRentPulse(): Promise<number> {
  const since = new Date(Date.now() - PULSE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const result = await getDb().execute(sql`
    INSERT INTO rent_pulse (city, province, bedrooms, median_rent, average_rent, min_rent, max_rent, sample_size, scraped_at)
    SELECT
      city,
      province,
      bedrooms,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rent))::int,
      ROUND(AVG(rent))::int,
      MIN(rent),
      MAX(rent),
      COUNT(*)::int,
      NOW()
    FROM rent_listings
    WHERE scraped_at >= ${since}
    GROUP BY city, province, bedrooms
    HAVING COUNT(*) >= ${PULSE_MIN_SAMPLE}
  `);
  return (result as { rowCount?: number | null }).rowCount ?? 0;
}

/**
 * Full ingestion pass: crawl DDF lease listings into rent_listings, then
 * rebuild the rent_pulse aggregates the estimator reads. This is the unit
 * cron callers invoke.
 */
export async function runRentIngestion(options: RentIngestionOptions = {}): Promise<{
  totals: IngestionCounts;
  byProvince: Record<string, IngestionCounts>;
  pulseRows: number;
}> {
  const { totals, byProvince } = await ingestDdfLeaseListings(options);
  const pulseRows = options.dryRun ? 0 : await rebuildRentPulse();
  return { totals, byProvince, pulseRows };
}
