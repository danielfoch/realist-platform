/**
 * DDF crawl observability endpoints.
 *
 * The crawl itself has run nightly for months with no way to ask "did it
 * finish, and how much did it get" short of grepping whichever autoscale
 * instance's logs happened to survive. Both endpoints here read the run
 * ledger (ddf_crawl_runs) and the snapshot table, never the CREA API, so they
 * are cheap and safe to poll.
 *
 * The manual trigger (POST /api/ddf-crawl/trigger) and the older status /
 * /api/ddf/status routes still live in server/routes.ts.
 */
import type { Express, Request, Response } from "express";
import { isAdmin } from "./auth";
import { storage } from "./storage";
import { isDdfConfigured } from "./creaDdf";
import { currentSnapshotMonth, DDF_STALE_AFTER_HOURS } from "./ddfYieldCrawler";
import type { DdfCoverageEntry, DdfCrawlRun } from "@shared/schema";

const FRESHNESS_CACHE_TTL_MS = 5 * 60 * 1000;

interface FreshnessPayload {
  lastCrawlCompletedAt: string | null;
  hoursSinceLastCapture: number | null;
  activeListingsThisMonth: number;
  provincesCovered: number;
  stale: boolean;
}

let freshnessCache: { payload: FreshnessPayload; expiresAt: number } | null = null;

function hoursSince(date: Date | null | undefined, now: Date): number | null {
  if (!date) return null;
  return Math.round(((now.getTime() - date.getTime()) / 3_600_000) * 10) / 10;
}

function isStale(hours: number | null): boolean {
  return hours == null || hours > DDF_STALE_AFTER_HOURS;
}

/**
 * The coverage check writes onto the most recent run, which may be a 'skipped'
 * row from a lock loser; fall back through recent runs to the last one that
 * actually carries a coverage array.
 */
function latestCoverage(runs: DdfCrawlRun[]): DdfCoverageEntry[] {
  for (const run of runs) {
    if (Array.isArray(run.coverage) && run.coverage.length > 0) return run.coverage;
  }
  return [];
}

async function buildFreshness(now: Date): Promise<FreshnessPayload> {
  const month = currentSnapshotMonth(now);
  const [latestCompleted, freshness] = await Promise.all([
    storage.getLatestDdfCrawlRun({ status: "completed" }),
    storage.getDdfSnapshotFreshness(month),
  ]);
  const hoursSinceLastCapture = hoursSince(freshness.maxCapturedAt, now);
  return {
    lastCrawlCompletedAt: latestCompleted?.finishedAt ? latestCompleted.finishedAt.toISOString() : null,
    hoursSinceLastCapture,
    activeListingsThisMonth: freshness.count,
    provincesCovered: freshness.provinces.length,
    stale: isStale(hoursSinceLastCapture),
  };
}

export function registerDdfCrawlRoutes(app: Express): void {
  app.get("/api/ddf-crawl/health", isAdmin, async (_req: Request, res: Response) => {
    try {
      const now = new Date();
      const month = currentSnapshotMonth(now);
      const [latestRun, recentRuns, freshness] = await Promise.all([
        storage.getLatestDdfCrawlRun(),
        storage.listDdfCrawlRuns(5),
        storage.getDdfSnapshotFreshness(month),
      ]);
      const hoursSinceLastCapture = hoursSince(freshness.maxCapturedAt, now);
      const coverage = latestCoverage(latestRun ? [latestRun, ...recentRuns] : recentRuns);
      res.json({
        configured: isDdfConfigured(),
        month,
        latestRun: latestRun ?? null,
        recentRuns,
        snapshotsThisMonth: freshness.count,
        maxCapturedAt: freshness.maxCapturedAt ? freshness.maxCapturedAt.toISOString() : null,
        hoursSinceLastCapture,
        provinces: coverage.map(({ province, stored, apiCount, ratio }) => ({ province, stored, apiCount, ratio })),
        stale: isStale(hoursSinceLastCapture),
        staleAfterHours: DDF_STALE_AFTER_HOURS,
      });
    } catch (error) {
      // Before migration 0016 is applied the ledger tables may not exist yet;
      // report that rather than 500 so the endpoint is useful during rollout.
      console.error("[ddf-crawl-routes] health failed:", error);
      res.status(500).json({
        configured: isDdfConfigured(),
        error: error instanceof Error ? error.message : "Failed to read crawl health",
      });
    }
  });

  // Public and listing-free: only counts and timestamps, so a marketing page
  // or the mobile app can show "updated N hours ago" without an admin session.
  app.get("/api/ddf/freshness", async (_req: Request, res: Response) => {
    try {
      const now = new Date();
      if (!freshnessCache || freshnessCache.expiresAt <= now.getTime()) {
        freshnessCache = { payload: await buildFreshness(now), expiresAt: now.getTime() + FRESHNESS_CACHE_TTL_MS };
      }
      res.set("Cache-Control", "public, max-age=300");
      res.json(freshnessCache.payload);
    } catch (error) {
      console.error("[ddf-crawl-routes] freshness failed:", error);
      res.status(500).json({ error: "Failed to read DDF freshness" });
    }
  });
}
