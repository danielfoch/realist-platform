/**
 * Watched listings + saved searches with alerts — the retention loop.
 *
 * CRUD (session-auth) for explicit listing watches and saved searches, plus
 * an alert sweep that runs on the hourly lifecycle-job cadence
 * (server/index.ts runLifecycleJobs) and enqueues batched, consent-gated
 * alert emails through the email_triggers queue (server/emailQueue.ts,
 * trigger types `watchlist_price_change` / `saved_search_matches`).
 *
 * Consent + volume rules:
 *  - Watches are created ONLY by an explicit Watch click. The old passive
 *    auto-watcher creation (listing views / shortlist saves silently minting
 *    listing_watchers rows) is retired — see server/notifications.ts. Legacy
 *    auto-created rows still show up in GET /api/watchlists and are deletable.
 *  - At most one pending email per (user, trigger type) at a time — the
 *    uq_email_triggers_pending_user_type partial index dedupes naturally, and
 *    the sweep folds every price change / matching search into ONE payload.
 *    Saved-search alerts are digest-style per frequency window, never per-match.
 *  - Sends are consent-gated twice: the sweep respects notification_preferences
 *    (listing_watch_alerts_enabled + product_updates_enabled), and the email
 *    worker re-checks the CASL consent ledger + digest opt-in at send time
 *    (emailQueue getConsentedUser).
 *
 * What change detection can honestly do today:
 *  - US listings: real. The ingest endpoint upserts us_listings continuously
 *    and us_listing_price_history records every observed change, so watched
 *    US listings alert within one ingest + sweep cycle.
 *  - Canadian (DDF) listings: slow but real. Live map listings come
 *    per-request from the DDF API and are NOT persisted per-listing; the only
 *    stored CA price series is ddf_listing_snapshots, written by the yield
 *    crawler on a roughly monthly cadence. A watched CA listing alerts when a
 *    NEWER snapshot disagrees with the price the user watched — daily CA
 *    change detection is not possible until the crawler runs more often.
 *  - Saved-search "new listing" matching has the same asymmetry: US new
 *    listings are detected via us_listings.first_seen_at; CA new listings are
 *    keys whose first snapshot appeared since the last run (crawler cadence).
 *
 * In-app notifications: notification_events / notification_queue were
 * investigated and are outbound marketing plumbing (channel 'ghl_webhook' →
 * Google Sheet / GHL webhook drained by processPendingGhlNotifications) with
 * no user-facing in-app feed reading them, so no in-app rows are written —
 * email + the watchlist page's "last alert" timestamps are the surface.
 */

import type { Express, Request, Response } from "express";
import "express-session";
import { and, count, desc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { isAuthenticated, isAdmin } from "./auth";
import { storage } from "./storage";
import {
  ddfListingSnapshots,
  emailTriggers,
  listingWatchers,
  savedSearches,
  usListings,
  type ListingWatcher,
  type SavedSearch,
} from "@shared/schema";
import {
  buildCapRatesSearchUrl,
  detectPriceChange,
  isSearchDue,
  matchesSearchCriteria,
  type CandidateListing,
  type SavedSearchCriteria,
} from "@shared/watchlistAlerts";
import type { SavedSearchMatchesItem, WatchlistPriceChangeItem } from "./emailQueue";

const MAX_WATCHES_PER_USER = 200;
const MAX_SEARCHES_PER_USER = 25;
/** Explicit-watch source types written by the Watch button. */
const WATCH_SOURCE_BY_COUNTRY = { CA: "watch_ddf", US: "watch_us" } as const;

const createWatchSchema = z.object({
  listingKey: z.string().trim().min(1).max(64),
  /** 'ddf' = Canadian CREA DDF listing key / MLS number; 'us' = us_listings source id. */
  source: z.enum(["ddf", "us"]),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(120).optional(),
  price: z.number().positive().finite().optional(),
});

const searchCriteriaSchema = z.object({
  query: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  province: z.string().trim().max(60).optional(),
  propertyType: z.string().trim().max(80).optional(),
  minCap: z.number().min(0).max(100).optional(),
  minPrice: z.number().min(0).finite().optional(),
  maxPrice: z.number().min(0).finite().optional(),
  country: z.enum(["CA", "US"]).optional(),
});

const createSearchSchema = z.object({
  name: z.string().trim().min(1).max(120),
  criteria: searchCriteriaSchema,
  // Default 'daily' = one digest-style email per window, never per-match.
  frequency: z.enum(["daily", "weekly"]).default("daily"),
});

function watchJson(watch: ListingWatcher) {
  return {
    id: watch.id,
    listingKey: watch.listingMlsNumber,
    sourceType: watch.sourceType,
    address: watch.addressSnapshot,
    city: watch.citySnapshot,
    lastKnownPrice: watch.lastKnownPrice,
    lastAlertAt: watch.lastAlertAt,
    createdAt: watch.createdAt,
  };
}

function searchJson(search: SavedSearch) {
  return {
    id: search.id,
    name: search.name,
    criteria: search.criteriaJson as SavedSearchCriteria,
    frequency: search.frequency,
    lastRunAt: search.lastRunAt,
    lastMatchCount: search.lastMatchCount,
    lastAlertAt: search.lastAlertAt,
    createdAt: search.createdAt,
  };
}

/**
 * Same preference rule as notifications.ts recipientAllows("listing"):
 * absent row = allowed (prefs default on), otherwise both the master
 * product-updates switch and the listing-watch switch must be enabled.
 */
async function allowsWatchAlerts(userId: string): Promise<boolean> {
  const pref = await storage.getNotificationPreference(userId).catch(() => null);
  if (!pref) return true;
  return Boolean(pref.productUpdatesEnabled && pref.listingWatchAlertsEnabled);
}

export function registerWatchlistRoutes(app: Express): void {
  // Everything the watchlist UI needs, including LEGACY auto-created watcher
  // rows (source_type 'view' / 'saved_listing' / 'saved_deal') so users can
  // see and remove watchers they never explicitly asked for.
  app.get("/api/watchlists", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as string;
      const [watches, searches] = await Promise.all([
        db.select().from(listingWatchers)
          .where(eq(listingWatchers.userId, userId))
          .orderBy(desc(listingWatchers.createdAt)),
        db.select().from(savedSearches)
          .where(eq(savedSearches.userId, userId))
          .orderBy(desc(savedSearches.createdAt)),
      ]);
      res.json({
        watches: watches.map(watchJson),
        savedSearches: searches.map(searchJson),
      });
    } catch (error) {
      console.error("[watchlists] list error:", error);
      res.status(500).json({ error: "Failed to load watchlist" });
    }
  });

  app.post("/api/watchlists/watches", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as string;
      const body = createWatchSchema.parse(req.body);

      const [{ existing }] = await db.select({ existing: count() }).from(listingWatchers)
        .where(eq(listingWatchers.userId, userId));
      if (Number(existing) >= MAX_WATCHES_PER_USER) {
        res.status(400).json({ error: `Watch limit reached (${MAX_WATCHES_PER_USER}). Remove a watch first.` });
        return;
      }

      const sourceType = WATCH_SOURCE_BY_COUNTRY[body.source === "ddf" ? "CA" : "US"];
      const now = new Date();
      const [watch] = await db.insert(listingWatchers)
        .values({
          userId,
          listingMlsNumber: body.listingKey,
          sourceType,
          // sourceId mirrors the listing key so the 4-column unique index
          // (which treats NULLs as distinct) actually dedupes repeat clicks.
          sourceId: body.listingKey,
          addressSnapshot: body.address || null,
          citySnapshot: body.city || null,
          lastKnownPrice: body.price ?? null,
          lastSeenAt: now,
        })
        .onConflictDoUpdate({
          target: [
            listingWatchers.userId,
            listingWatchers.listingMlsNumber,
            listingWatchers.sourceType,
            listingWatchers.sourceId,
          ],
          set: {
            addressSnapshot: body.address || null,
            citySnapshot: body.city || null,
            // Re-watching refreshes the baseline to the price the user just saw.
            ...(body.price != null ? { lastKnownPrice: body.price } : {}),
            lastSeenAt: now,
            updatedAt: now,
          },
        })
        .returning();

      res.json({ success: true, watch: watchJson(watch) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid watch payload", details: error.errors });
        return;
      }
      console.error("[watchlists] create watch error:", error);
      res.status(500).json({ error: "Failed to watch listing" });
    }
  });

  app.delete("/api/watchlists/watches/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as string;
      const deleted = await db.delete(listingWatchers)
        .where(and(eq(listingWatchers.id, req.params.id), eq(listingWatchers.userId, userId)))
        .returning({ id: listingWatchers.id });
      if (!deleted.length) {
        res.status(404).json({ error: "Watch not found" });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      console.error("[watchlists] delete watch error:", error);
      res.status(500).json({ error: "Failed to remove watch" });
    }
  });

  app.post("/api/watchlists/searches", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as string;
      const body = createSearchSchema.parse(req.body);

      const [{ existing }] = await db.select({ existing: count() }).from(savedSearches)
        .where(eq(savedSearches.userId, userId));
      if (Number(existing) >= MAX_SEARCHES_PER_USER) {
        res.status(400).json({ error: `Saved-search limit reached (${MAX_SEARCHES_PER_USER}). Remove one first.` });
        return;
      }

      const [search] = await db.insert(savedSearches)
        .values({
          userId,
          name: body.name,
          criteriaJson: body.criteria,
          frequency: body.frequency,
        })
        .returning();
      res.json({ success: true, savedSearch: searchJson(search) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid saved-search payload", details: error.errors });
        return;
      }
      console.error("[watchlists] create search error:", error);
      res.status(500).json({ error: "Failed to save search" });
    }
  });

  app.delete("/api/watchlists/searches/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as string;
      const deleted = await db.delete(savedSearches)
        .where(and(eq(savedSearches.id, req.params.id), eq(savedSearches.userId, userId)))
        .returning({ id: savedSearches.id });
      if (!deleted.length) {
        res.status(404).json({ error: "Saved search not found" });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      console.error("[watchlists] delete search error:", error);
      res.status(500).json({ error: "Failed to remove saved search" });
    }
  });

  // Manual sweep for ops/testing — the hourly lifecycle job is the real driver.
  app.post("/api/watchlists/sweep", isAdmin, async (_req: Request, res: Response) => {
    try {
      const result = await runWatchlistAlertSweep();
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("[watchlists] manual sweep error:", error);
      res.status(500).json({ error: "Sweep failed" });
    }
  });
}

// ─── Alert sweep ─────────────────────────────────────────────────────────────

type CurrentPrice = { price: number; address?: string | null; city?: string | null };

/**
 * Latest stored price for each watched listing key.
 * US keys resolve against the continuously-ingested us_listings table;
 * CA keys resolve against the newest ddf_listing_snapshots row (crawler
 * cadence — see the module comment for what that honestly means).
 */
async function resolveCurrentPrices(keys: string[]): Promise<Map<string, CurrentPrice>> {
  const prices = new Map<string, CurrentPrice>();
  if (!keys.length) return prices;

  const ddfRows = await db.select({
    listingKey: ddfListingSnapshots.listingKey,
    mlsNumber: ddfListingSnapshots.mlsNumber,
    listPrice: ddfListingSnapshots.listPrice,
    city: ddfListingSnapshots.city,
    capturedAt: ddfListingSnapshots.capturedAt,
  }).from(ddfListingSnapshots)
    .where(or(
      inArray(ddfListingSnapshots.listingKey, keys),
      inArray(ddfListingSnapshots.mlsNumber, keys),
    ))
    .orderBy(desc(ddfListingSnapshots.capturedAt));

  // Rows arrive newest-first; first sighting per key wins.
  const keySet = new Set(keys);
  for (const row of ddfRows) {
    for (const key of [row.listingKey, row.mlsNumber]) {
      if (key && keySet.has(key) && !prices.has(key) && row.listPrice != null) {
        prices.set(key, { price: row.listPrice, city: row.city });
      }
    }
  }

  const usRows = await db.select({
    sourceId: usListings.sourceId,
    listPrice: usListings.listPrice,
    formattedAddress: usListings.formattedAddress,
    city: usListings.city,
  }).from(usListings).where(inArray(usListings.sourceId, keys));
  for (const row of usRows) {
    if (row.listPrice != null) {
      // us_listings is fresher than any DDF snapshot — let it win on key collisions.
      prices.set(row.sourceId, { price: row.listPrice, address: row.formattedAddress, city: row.city });
    }
  }

  return prices;
}

/** New-since-`since` listings across both countries, with first-seen stamps. */
async function loadNewCandidates(since: Date): Promise<Array<CandidateListing & { firstSeenAt: Date }>> {
  const candidates: Array<CandidateListing & { firstSeenAt: Date }> = [];

  const usRows = await db.select().from(usListings)
    .where(and(
      gt(usListings.firstSeenAt, since),
      eq(usListings.isActive, true),
    ))
    .orderBy(desc(usListings.firstSeenAt))
    .limit(1000);
  for (const row of usRows) {
    if (row.delistedAt) continue;
    candidates.push({
      key: row.sourceId,
      country: "US",
      address: row.formattedAddress,
      city: row.city,
      province: row.state,
      propertyType: row.propertyType,
      price: row.listPrice,
      // No verified cap rate for US rows — minCap searches will (honestly) skip them.
      capRate: null,
      firstSeenAt: row.firstSeenAt,
    });
  }

  // CA "new" = listing keys whose FIRST snapshot landed after `since`.
  // Monthly re-snapshots of long-listed properties must not look new.
  const ddfRows = await db.execute(sql`
    SELECT DISTINCT ON (s.listing_key)
      s.listing_key, s.mls_number, s.city, s.province,
      s.property_sub_type, s.structure_type, s.list_price,
      s.net_yield, s.gross_yield, fresh.first_seen_at
    FROM ddf_listing_snapshots s
    JOIN (
      SELECT listing_key, MIN(captured_at) AS first_seen_at
      FROM ddf_listing_snapshots
      GROUP BY listing_key
      HAVING MIN(captured_at) > ${since}
    ) fresh ON fresh.listing_key = s.listing_key
    ORDER BY s.listing_key, s.captured_at DESC
    LIMIT 2000
  `);
  for (const row of (ddfRows.rows as Array<Record<string, unknown>>)) {
    const netYield = typeof row.net_yield === "number" ? row.net_yield : null;
    const grossYield = typeof row.gross_yield === "number" ? row.gross_yield : null;
    candidates.push({
      key: String(row.mls_number || row.listing_key),
      country: "CA",
      address: null,
      city: (row.city as string | null) ?? null,
      province: (row.province as string | null) ?? null,
      propertyType: (row.property_sub_type as string | null) || (row.structure_type as string | null),
      price: typeof row.list_price === "number" ? row.list_price : null,
      capRate: netYield ?? grossYield,
      firstSeenAt: new Date(row.first_seen_at as string),
    });
  }

  return candidates;
}

/** Batched enqueue: one pending trigger per (user, type); dupes collapse via the partial index. */
async function enqueueAlertTrigger(
  userId: string,
  triggerType: "watchlist_price_change" | "saved_search_matches",
  payload: Record<string, unknown>,
): Promise<boolean> {
  const inserted = await db.insert(emailTriggers)
    .values({ userId, triggerType, payload, status: "pending" })
    .onConflictDoNothing()
    .returning({ id: emailTriggers.id });
  return inserted.length > 0;
}

export interface WatchlistSweepResult {
  watchesChecked: number;
  baselinesSeeded: number;
  priceAlertUsers: number;
  searchesRun: number;
  searchAlertUsers: number;
}

export async function runWatchlistAlertSweep(now: Date = new Date()): Promise<WatchlistSweepResult> {
  const result: WatchlistSweepResult = {
    watchesChecked: 0,
    baselinesSeeded: 0,
    priceAlertUsers: 0,
    searchesRun: 0,
    searchAlertUsers: 0,
  };

  // ── Price changes on watched listings ─────────────────────────────────────
  const watches = await db.select().from(listingWatchers)
    .where(eq(listingWatchers.watchPriceUpdates, true));
  result.watchesChecked = watches.length;

  if (watches.length) {
    const keys = Array.from(new Set(watches.map((watch) => watch.listingMlsNumber)));
    const prices = await resolveCurrentPrices(keys);
    const changesByUser = new Map<string, WatchlistPriceChangeItem[]>();

    for (const watch of watches) {
      const current = prices.get(watch.listingMlsNumber);
      if (!current) continue; // no stored price source for this key yet

      if (watch.lastKnownPrice == null) {
        // First sighting: seed the baseline silently — alerting on a price
        // we never showed the user would be noise, not signal.
        await db.update(listingWatchers)
          .set({ lastKnownPrice: current.price, updatedAt: now })
          .where(eq(listingWatchers.id, watch.id));
        result.baselinesSeeded++;
        continue;
      }

      const change = detectPriceChange(watch.lastKnownPrice, current.price);
      if (!change) continue;

      await db.update(listingWatchers)
        .set({ lastKnownPrice: current.price, lastAlertAt: now, updatedAt: now })
        .where(eq(listingWatchers.id, watch.id));

      const items = changesByUser.get(watch.userId) || [];
      items.push({
        listingKey: watch.listingMlsNumber,
        address: watch.addressSnapshot || current.address,
        city: watch.citySnapshot || current.city,
        previousPrice: change.previousPrice,
        currentPrice: change.currentPrice,
        direction: change.direction,
      });
      changesByUser.set(watch.userId, items);
    }

    for (const [userId, items] of changesByUser.entries()) {
      if (!(await allowsWatchAlerts(userId))) continue;
      if (await enqueueAlertTrigger(userId, "watchlist_price_change", { items })) {
        result.priceAlertUsers++;
      }
    }
  }

  // ── Saved-search matching ─────────────────────────────────────────────────
  const searches = await db.select().from(savedSearches);
  const dueSearches = searches.filter((search) =>
    isSearchDue(search.frequency === "weekly" ? "weekly" : "daily", search.lastRunAt, now));

  if (dueSearches.length) {
    // One candidate scan per sweep (widest window), filtered per-search below.
    const windows = dueSearches.map((search) => (search.lastRunAt ?? search.createdAt).getTime());
    const minSince = new Date(Math.min(...windows));
    const candidates = await loadNewCandidates(minSince);
    const matchesByUser = new Map<string, SavedSearchMatchesItem[]>();

    for (const search of dueSearches) {
      // First run starts from createdAt: alert on listings that appear AFTER
      // the search was saved, not the whole back catalogue.
      const since = (search.lastRunAt ?? search.createdAt).getTime();
      const criteria = (search.criteriaJson || {}) as SavedSearchCriteria;
      const matches = candidates.filter((candidate) =>
        candidate.firstSeenAt.getTime() > since && matchesSearchCriteria(criteria, candidate));

      await db.update(savedSearches)
        .set({
          lastRunAt: now,
          lastMatchCount: matches.length,
          ...(matches.length ? { lastAlertAt: now } : {}),
          updatedAt: now,
        })
        .where(eq(savedSearches.id, search.id));
      result.searchesRun++;

      if (!matches.length) continue;
      const items = matchesByUser.get(search.userId) || [];
      items.push({
        name: search.name,
        matchCount: matches.length,
        city: criteria.city || matches[0]?.city || null,
        url: buildCapRatesSearchUrl(criteria),
        sampleAddresses: matches
          .map((match) => match.address || match.key)
          .filter(Boolean)
          .slice(0, 3) as string[],
      });
      matchesByUser.set(search.userId, items);
    }

    for (const [userId, items] of matchesByUser.entries()) {
      if (!(await allowsWatchAlerts(userId))) continue;
      if (await enqueueAlertTrigger(userId, "saved_search_matches", { searches: items })) {
        result.searchAlertUsers++;
      }
    }
  }

  return result;
}
