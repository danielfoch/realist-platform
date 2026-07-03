/**
 * Daily-glance dashboard data (server/routes.ts GET /api/dashboard/glance).
 *
 * The retention audit's finding: "everything a daily-glance product needs —
 * new matches, price changes, rank deltas, milestones — is already computed, it
 * just exits exclusively as email." This module surfaces that same data
 * in-product for the signed-in home, assembling every card in ONE response with
 * parallel queries, briefly cached per user.
 *
 * It deliberately REUSES the email producers' logic rather than reinventing it:
 *  - milestone / badge ladder  → shared/milestones.ts (also feeds My Performance)
 *  - saved-search new matches   → loadNewCandidates + matchesSearchCriteria
 *                                 (the exact sweep in server/watchlists.ts)
 *  - watched-listing price moves → resolveCurrentPrices + detectPriceChange
 *  - leaderboard rank + delta   → same deal-count ranking the monthly/weekly
 *                                 emails use, with a month-over-month delta
 *
 * Read-only: unlike the alert sweep it never writes baselines, enqueues email,
 * or advances lastRunAt — the dashboard is a view, the sweep owns state.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { analyses, expertFieldNotes, listingWatchers, savedSearches } from "@shared/schema";
import { computeMilestoneProgress } from "@shared/milestones";
import {
  buildCapRatesSearchUrl,
  describeSearchCriteria,
  detectPriceChange,
  matchesSearchCriteria,
  type SavedSearchCriteria,
} from "@shared/watchlistAlerts";
import { loadNewCandidates, resolveCurrentPrices } from "./watchlists";

const RECENT_ANALYSES_LIMIT = 5;

// Same test/example-account exclusion the leaderboard emails and the
// /api/user-performance ranking already apply, kept in sync here.
const leaderboardEligibleUserSql = sql`
  LOWER(COALESCE(u.email, '')) NOT LIKE '%@example.com'
  AND NOT (
    LOWER(COALESCE(u.first_name, '')) = 'test'
    AND LOWER(COALESCE(u.last_name, '')) = 'user'
  )
`;

export interface GlanceRecentAnalysis {
  id: string;
  address: string | null;
  city: string | null;
  province: string | null;
  strategyType: string;
  countryMode: string;
  capRate: number | null;
  createdAt: string;
  /** Deep link back into the analyzer with the inputs prefilled to re-run. */
  rerunUrl: string;
}

export interface GlanceSavedSearchMatch {
  id: string;
  name: string;
  newMatchCount: number;
  sampleAddresses: string[];
  url: string;
}

export interface GlancePriceChange {
  listingKey: string;
  address: string | null;
  city: string | null;
  previousPrice: number;
  currentPrice: number;
  direction: "drop" | "increase";
  changePercent: number;
  /** Re-analyze the listing at its new price. */
  rerunUrl: string;
}

export interface GlanceLeaderboard {
  rank: number | null;
  previousRank: number | null;
  /** previousRank - rank: positive = climbed, negative = slipped, null = new. */
  rankDelta: number | null;
  dealsThisMonth: number;
  totalRanked: number;
  monthLabel: string;
}

export interface GlanceFieldNoteActivity {
  noteCount: number;
  netScore: number;
}

export interface DashboardGlance {
  recentAnalyses: GlanceRecentAnalysis[];
  totalAnalyses: number;
  savedSearches: {
    total: number;
    withNewMatches: GlanceSavedSearchMatch[];
    newMatchTotal: number;
  };
  priceChanges: GlancePriceChange[];
  watchCount: number;
  leaderboard: GlanceLeaderboard;
  milestone: ReturnType<typeof computeMilestoneProgress>;
  fieldNotes: GlanceFieldNoteActivity;
  generatedAt: string;
}

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** Prefill deep link into the analyzer from a stored analysis's inputs. */
function analyzerRerunUrl(row: {
  address: string | null;
  city: string | null;
  province: string | null;
  inputsJson: unknown;
}, priceOverride?: number | null): string {
  const params = new URLSearchParams();
  if (row.address) params.set("address", row.address);
  if (row.city) params.set("city", row.city);
  if (row.province) params.set("state", row.province);
  const inputs = (row.inputsJson || {}) as Record<string, unknown>;
  const price = priceOverride ?? num(inputs.purchasePrice);
  if (price != null && price > 0) params.set("price", String(Math.round(price)));
  const rent = num(inputs.monthlyRent);
  if (rent != null && rent > 0) params.set("rent", String(Math.round(rent)));
  const suffix = params.toString();
  return `/tools/analyzer${suffix ? `?${suffix}` : ""}`;
}

/** Toronto-anchored [start, end) bounds for the current and previous month. */
function monthBounds(): { curStart: Date; prevStart: Date; label: string } {
  const now = new Date();
  const tor = new Date(now.toLocaleString("en-US", { timeZone: "America/Toronto" }));
  const curStart = new Date(tor.getFullYear(), tor.getMonth(), 1, 0, 0, 0, 0);
  const prevStart = new Date(tor.getFullYear(), tor.getMonth() - 1, 1, 0, 0, 0, 0);
  const label = curStart.toLocaleString("en-US", { month: "long", year: "numeric" });
  return { curStart, prevStart, label };
}

/**
 * Monthly deal-count ranking with a month-over-month delta — the number the
 * monthly leaderboard email sends, surfaced live. Ranks by eligible analyses in
 * a month window (same eligibility filter as the emails). One grouped query per
 * window; rank is the user's position in the ordered list.
 */
async function loadLeaderboard(userId: string): Promise<GlanceLeaderboard> {
  const { curStart, prevStart, label } = monthBounds();

  const rank = async (windowStart: Date, windowEnd: Date) => {
    const rows = await db.execute(sql`
      SELECT a.user_id, COUNT(a.id)::int AS deal_count
      FROM analyses a
      JOIN users u ON u.id = a.user_id
      WHERE a.user_id IS NOT NULL
        AND a.results_json IS NOT NULL
        AND a.created_at >= ${windowStart.toISOString()}
        AND a.created_at < ${windowEnd.toISOString()}
        AND ${leaderboardEligibleUserSql}
      GROUP BY a.user_id
      ORDER BY deal_count DESC
    `);
    const list = rows.rows as Array<{ user_id: string; deal_count: number }>;
    const idx = list.findIndex((r) => r.user_id === userId);
    return {
      rank: idx >= 0 ? idx + 1 : null,
      deals: idx >= 0 ? Number(list[idx].deal_count) : 0,
      total: list.length,
    };
  };

  const [current, previous] = await Promise.all([
    rank(curStart, new Date()),
    rank(prevStart, curStart),
  ]);

  const rankDelta =
    current.rank != null && previous.rank != null ? previous.rank - current.rank : null;

  return {
    rank: current.rank,
    previousRank: previous.rank,
    rankDelta,
    dealsThisMonth: current.deals,
    totalRanked: current.total,
    monthLabel: label,
  };
}

/** Last few analyses with re-run deep links + the lifetime count for milestones. */
async function loadRecentAnalyses(userId: string): Promise<{
  recent: GlanceRecentAnalysis[];
  total: number;
}> {
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: analyses.id,
        address: analyses.address,
        city: analyses.city,
        province: analyses.province,
        strategyType: analyses.strategyType,
        countryMode: analyses.countryMode,
        inputsJson: analyses.inputsJson,
        resultsJson: analyses.resultsJson,
        createdAt: analyses.createdAt,
      })
      .from(analyses)
      .where(eq(analyses.userId, userId))
      .orderBy(desc(analyses.createdAt))
      .limit(RECENT_ANALYSES_LIMIT),
    db
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(analyses)
      .where(and(eq(analyses.userId, userId), sql`${analyses.resultsJson} IS NOT NULL`)),
  ]);

  const recent = rows.map((row) => {
    const results = (row.resultsJson || {}) as Record<string, unknown>;
    return {
      id: row.id,
      address: row.address,
      city: row.city,
      province: row.province,
      strategyType: row.strategyType,
      countryMode: row.countryMode,
      capRate: num(results.capRate),
      createdAt: row.createdAt.toISOString(),
      rerunUrl: analyzerRerunUrl(row),
    };
  });

  return { recent, total: Number(total || 0) };
}

/**
 * New saved-search matches since each search last ran — the same match logic as
 * the alert sweep (loadNewCandidates + matchesSearchCriteria), read-only. The
 * "since" per search is lastRunAt ?? createdAt, exactly like the sweep, so the
 * dashboard count agrees with what the next email would report.
 */
async function loadSavedSearchMatches(userId: string): Promise<DashboardGlance["savedSearches"]> {
  const searches = await db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.userId, userId))
    .orderBy(desc(savedSearches.createdAt));

  if (!searches.length) {
    return { total: 0, withNewMatches: [], newMatchTotal: 0 };
  }

  const windows = searches.map((s) => (s.lastRunAt ?? s.createdAt).getTime());
  const minSince = new Date(Math.min(...windows));
  const candidates = await loadNewCandidates(minSince);

  const withNewMatches: GlanceSavedSearchMatch[] = [];
  let newMatchTotal = 0;

  for (const search of searches) {
    const since = (search.lastRunAt ?? search.createdAt).getTime();
    const criteria = (search.criteriaJson || {}) as SavedSearchCriteria;
    const matches = candidates.filter(
      (c) => c.firstSeenAt.getTime() > since && matchesSearchCriteria(criteria, c),
    );
    if (!matches.length) continue;
    newMatchTotal += matches.length;
    withNewMatches.push({
      id: search.id,
      name: search.name || describeSearchCriteria(criteria),
      newMatchCount: matches.length,
      sampleAddresses: matches
        .map((m) => m.address || m.city || m.key)
        .filter(Boolean)
        .slice(0, 3) as string[],
      url: buildCapRatesSearchUrl(criteria),
    });
  }

  return { total: searches.length, withNewMatches, newMatchTotal };
}

/**
 * Material price moves on watched listings vs the price the user last saw — the
 * same resolveCurrentPrices + detectPriceChange the sweep uses, read-only (the
 * sweep, not the dashboard, advances lastKnownPrice).
 */
async function loadPriceChanges(userId: string): Promise<{ changes: GlancePriceChange[]; watchCount: number }> {
  const watches = await db
    .select()
    .from(listingWatchers)
    .where(and(eq(listingWatchers.userId, userId), eq(listingWatchers.watchPriceUpdates, true)));

  if (!watches.length) return { changes: [], watchCount: 0 };

  const keys = Array.from(new Set(watches.map((w) => w.listingMlsNumber)));
  const prices = await resolveCurrentPrices(keys);

  const changes: GlancePriceChange[] = [];
  for (const watch of watches) {
    if (watch.lastKnownPrice == null) continue; // baseline not seeded yet
    const current = prices.get(watch.listingMlsNumber);
    if (!current) continue;
    const change = detectPriceChange(watch.lastKnownPrice, current.price);
    if (!change) continue;
    const address = watch.addressSnapshot || current.address || null;
    changes.push({
      listingKey: watch.listingMlsNumber,
      address,
      city: watch.citySnapshot || current.city || null,
      previousPrice: change.previousPrice,
      currentPrice: change.currentPrice,
      direction: change.direction,
      changePercent: change.changePercent,
      rerunUrl: analyzerRerunUrl(
        { address, city: watch.citySnapshot || current.city || null, province: null, inputsJson: {} },
        change.currentPrice,
      ),
    });
  }

  return { changes, watchCount: watches.length };
}

/**
 * Field-note engagement: the user's visible notes and their net score. Cheap —
 * expert_field_notes carries a denormalized `score` (net votes), so this is one
 * aggregate, no vote-table join.
 */
async function loadFieldNoteActivity(userId: string): Promise<GlanceFieldNoteActivity> {
  const [row] = await db
    .select({
      noteCount: sql<number>`COUNT(*)::int`,
      netScore: sql<number>`COALESCE(SUM(${expertFieldNotes.score}), 0)::int`,
    })
    .from(expertFieldNotes)
    .where(and(eq(expertFieldNotes.userId, userId), eq(expertFieldNotes.status, "visible")));
  return { noteCount: Number(row?.noteCount || 0), netScore: Number(row?.netScore || 0) };
}

/** Assemble every dashboard card in one shot with parallel queries. */
export async function buildDashboardGlance(userId: string): Promise<DashboardGlance> {
  const [analysesData, savedSearchData, priceData, leaderboard, fieldNotes] = await Promise.all([
    loadRecentAnalyses(userId),
    loadSavedSearchMatches(userId),
    loadPriceChanges(userId),
    loadLeaderboard(userId),
    loadFieldNoteActivity(userId),
  ]);

  return {
    recentAnalyses: analysesData.recent,
    totalAnalyses: analysesData.total,
    savedSearches: savedSearchData,
    priceChanges: priceData.changes,
    watchCount: priceData.watchCount,
    leaderboard,
    milestone: computeMilestoneProgress(analysesData.total),
    fieldNotes,
    generatedAt: new Date().toISOString(),
  };
}

// ── Per-user brief cache ─────────────────────────────────────────────────────
// Mirrors the userPerfCache pattern in routes.ts: a short TTL so a returning
// user's repeated glances don't re-run the ranking scan every navigation.

const GLANCE_TTL_MS = 60_000;
const glanceCache = new Map<string, { data: DashboardGlance; expiresAt: number }>();

export async function getDashboardGlanceCached(userId: string): Promise<DashboardGlance> {
  const hit = glanceCache.get(userId);
  if (hit && Date.now() < hit.expiresAt) return hit.data;

  const data = await buildDashboardGlance(userId);
  glanceCache.set(userId, { data, expiresAt: Date.now() + GLANCE_TTL_MS });
  if (glanceCache.size > 500) {
    const oldest = [...glanceCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    for (let i = 0; i < 50; i++) glanceCache.delete(oldest[i][0]);
  }
  return data;
}
