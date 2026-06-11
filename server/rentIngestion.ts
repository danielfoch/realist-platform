/**
 * Rent data ingestion — feeds the comp tables the rent estimator reads.
 *
 * Source: CREA DDF lease listings (TransactionType For rent/For lease),
 * licensed data we already pull for sales. ListPrice on a lease listing is
 * the monthly asking rent. Mapping/sanity rules live in
 * shared/rentObservations.ts; this module owns paging, dedupe, and the
 * nightly rent_pulse aggregate rebuild.
 *
 * Dedupe: rows key on externalId (ddf-lease:<ListingKey>). New listings
 * insert; still-active ones get scrapedAt refreshed so the estimator's
 * recency weighting reflects that the asking rent is still current.
 *
 * Adding another source later = another adapter producing
 * RentObservationRow[] + a call to upsertObservations.
 */

import type { Express } from "express";
import { inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { rentListings, rentPulse } from "@shared/schema";
import { searchDdfListings, isDdfConfigured } from "./creaDdf";
import { ddfLeaseToRentObservation, type RentObservationRow } from "@shared/rentObservations";
import { requireIntelAdmin } from "./rentIntelligence";

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

/**
 * Crawl DDF lease listings for the given provinces into rent_listings.
 * dryRun fetches and maps without writing — use it to validate volume and
 * mapping quality after deploy.
 */
export async function ingestDdfLeaseListings(options: {
  provinces?: string[];
  maxPagesPerProvince?: number;
  dryRun?: boolean;
} = {}): Promise<{ totals: IngestionCounts; byProvince: Record<string, IngestionCounts> }> {
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
  const result = await db.execute(sql`
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
  return result.rowCount ?? 0;
}

export function registerRentIngestionRoutes(app: Express): void {
  app.post("/api/intelligence/ingest-rents", requireIntelAdmin, async (req, res) => {
    try {
      const provinces = typeof req.query.province === "string" ? [req.query.province] : undefined;
      const dryRun = req.query.dry_run === "true" || req.query.dryRun === "true";
      const maxPagesPerProvince = req.query.max_pages ? Number(req.query.max_pages) : undefined;
      const result = await ingestDdfLeaseListings({ provinces, dryRun, maxPagesPerProvince });
      const pulseRows = dryRun ? 0 : await rebuildRentPulse();
      res.json({ success: true, dryRun, ...result, pulseRows });
    } catch (error: any) {
      console.error("[rent-ingestion] manual ingestion failed:", error);
      res.status(500).json({ success: false, error: error.message || "Ingestion failed" });
    }
  });
}

/** Daily lease crawl + aggregate rebuild, alongside the other interval jobs. */
export function scheduleRentIngestionJobs(log: (msg: string, tag?: string) => void): void {
  const run = async () => {
    try {
      if (!isDdfConfigured()) {
        log("DDF not configured; skipping rent ingestion", "rent-ingestion");
        return;
      }
      const { totals } = await ingestDdfLeaseListings();
      const pulseRows = await rebuildRentPulse();
      log(
        `Lease ingestion: fetched=${totals.fetched}, mapped=${totals.mapped}, inserted=${totals.inserted}, refreshed=${totals.refreshed}, pulseRows=${pulseRows}`,
        "rent-ingestion",
      );
    } catch (err: any) {
      log(`Rent ingestion error: ${err.message}`, "rent-ingestion");
    }
  };
  // First run shortly after boot (offset from the prediction sweep), then daily.
  setTimeout(run, 10 * 60 * 1000);
  setInterval(run, 24 * 60 * 60 * 1000);
}
