/**
 * Social proof / data-moat stats — makes platform activity visible.
 *
 *  - GET /api/stats/analyses-count      → sitewide "N deals analyzed" counter
 *    (total + this week), cached 60s in memory. Also consumed server-side by
 *    the homepage SEO fallback so the number is crawlable.
 *  - GET /api/listings/:mlsNumber/engagement → per-listing engagement strip
 *    (analyzed / saved / favorited / watching / field notes), cached 120s.
 *
 * Counts are computed from the live tables:
 *  - `analyses` records every analyzer run (Home.tsx auto-save), MLS linkage
 *    lives in inputs_json; `property_analyses` records community analyses with
 *    a proper listing_mls_number column — the per-listing "analyzed" count sums
 *    both lineages.
 *  - `saved_deals.mls_number` records saves; `listing_watchers` records
 *    watches (sourceType "saved_listing" is the favorite signal — there is no
 *    separate favorites table on this branch).
 *  - `expert_field_notes` (visible only) records field notes.
 */

import type { Express, Request, Response } from "express";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "./db";
import {
  analyses,
  expertFieldNotes,
  listingWatchers,
  propertyAnalyses,
  savedDeals,
} from "@shared/schema";

type CacheEntry<T> = { data: T; expiresAt: number };

const ANALYSES_COUNT_TTL_MS = 60 * 1000;
const ENGAGEMENT_TTL_MS = 120 * 1000;

export interface AnalysesCountStats {
  total: number;
  thisWeek: number;
}

export interface ListingEngagementStats {
  analyzedCount: number;
  savedCount: number;
  favoritedCount: number;
  watchCount: number;
  noteCount: number;
}

let analysesCountCache: CacheEntry<AnalysesCountStats> | null = null;
const engagementCache = new Map<string, CacheEntry<ListingEngagementStats>>();

function countValue(row: { count: number } | undefined): number {
  return Number(row?.count || 0);
}

/**
 * Sitewide analyzer-run counts (total + trailing 7 days), cached 60s.
 * Shared by the /api/stats endpoint and the SEO homepage fallback.
 */
export async function getAnalysesCountStats(): Promise<AnalysesCountStats> {
  if (analysesCountCache && Date.now() < analysesCountCache.expiresAt) {
    return analysesCountCache.data;
  }
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [[totalRow], [weekRow]] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(analyses),
    db.select({ count: sql<number>`count(*)` }).from(analyses).where(gte(analyses.createdAt, weekAgo)),
  ]);
  const data: AnalysesCountStats = {
    total: countValue(totalRow),
    thisWeek: countValue(weekRow),
  };
  analysesCountCache = { data, expiresAt: Date.now() + ANALYSES_COUNT_TTL_MS };
  return data;
}

/** Per-listing engagement counts, cached 120s per listing key. */
export async function getListingEngagementStats(mlsNumber: string): Promise<ListingEngagementStats> {
  const cached = engagementCache.get(mlsNumber);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const [
    [communityAnalysesRow],
    [analyzerRunsRow],
    [savedRow],
    [watcherRow],
    [favoriteRow],
    [noteRow],
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(propertyAnalyses)
      .where(and(eq(propertyAnalyses.listingMlsNumber, mlsNumber), eq(propertyAnalyses.isDeleted, false))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(analyses)
      .where(
        sql`(${analyses.inputsJson} ->> 'mlsNumber' = ${mlsNumber} OR ${analyses.inputsJson} ->> 'listingMlsNumber' = ${mlsNumber})`,
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(savedDeals)
      .where(eq(savedDeals.mlsNumber, mlsNumber)),
    db
      .select({ count: sql<number>`count(distinct ${listingWatchers.userId})` })
      .from(listingWatchers)
      .where(eq(listingWatchers.listingMlsNumber, mlsNumber)),
    db
      .select({ count: sql<number>`count(distinct ${listingWatchers.userId})` })
      .from(listingWatchers)
      .where(and(eq(listingWatchers.listingMlsNumber, mlsNumber), eq(listingWatchers.sourceType, "saved_listing"))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(expertFieldNotes)
      .where(and(eq(expertFieldNotes.listingMlsNumber, mlsNumber), eq(expertFieldNotes.status, "visible"))),
  ]);

  const data: ListingEngagementStats = {
    analyzedCount: countValue(communityAnalysesRow) + countValue(analyzerRunsRow),
    savedCount: countValue(savedRow),
    favoritedCount: countValue(favoriteRow),
    watchCount: countValue(watcherRow),
    noteCount: countValue(noteRow),
  };
  engagementCache.set(mlsNumber, { data, expiresAt: Date.now() + ENGAGEMENT_TTL_MS });

  // Keep the per-listing cache bounded.
  if (engagementCache.size > 2000) {
    const now = Date.now();
    for (const [key, entry] of engagementCache) {
      if (entry.expiresAt <= now) engagementCache.delete(key);
    }
  }
  return data;
}

export function registerSocialStatsRoutes(app: Express): void {
  // Live sitewide counter — public social proof for the homepage hero and
  // the analyzer header.
  app.get("/api/stats/analyses-count", async (_req: Request, res: Response) => {
    try {
      const stats = await getAnalysesCountStats();
      res.set("Cache-Control", "public, max-age=60");
      res.json(stats);
    } catch (error) {
      console.error("[socialStats] analyses-count failed:", error);
      res.status(500).json({ error: "Failed to load analysis counts" });
    }
  });

  // Per-listing engagement strip ("Analyzed 14× · Saved 6× · 3 field notes").
  app.get("/api/listings/:mlsNumber/engagement", async (req: Request, res: Response) => {
    try {
      const mlsNumber = String(req.params.mlsNumber || "").trim();
      if (!mlsNumber || mlsNumber.length > 50) {
        return res.status(400).json({ error: "Invalid listing key" });
      }
      const stats = await getListingEngagementStats(mlsNumber);
      res.set("Cache-Control", "public, max-age=120");
      res.json(stats);
    } catch (error) {
      console.error("[socialStats] engagement failed:", error);
      res.status(500).json({ error: "Failed to load engagement stats" });
    }
  });
}
