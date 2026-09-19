import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { publicName } from "./dealKey";

/**
 * What other people see of the analysis log: medians on a deal, a member's
 * track record, the leaderboard. Numbers only ever appear once enough
 * different people are behind them — one person's analysis is never exposed
 * as "the community". Only members count: anonymous sessions are free to mint.
 */

/** Below this many people, a deal shows a count but no medians. */
export const CONSENSUS_FLOOR = 3;

export interface DealConsensus {
  analysts: number;
  /** Null until CONSENSUS_FLOOR people have weighed in. */
  medians: { monthlyRent: number | null; capRate: number | null; monthlyCashFlow: number | null; offerPrice: number | null } | null;
  verdicts: { pursue: number; watch: number; pass: number };
}

type Row = Record<string, unknown>;
const num = (value: unknown): number | null => (value == null ? null : Number(value));

export async function getDealConsensus(dealKey: string): Promise<DealConsensus> {
  const result = await getDb().execute(sql`
    SELECT count(*)::int AS analysts,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY monthly_rent) AS rent,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY cap_rate) AS cap,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY monthly_cash_flow) AS cash_flow,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY offer_price) FILTER (WHERE offer_price IS NOT NULL) AS offer,
      count(*) FILTER (WHERE verdict = 'pursue')::int AS pursue,
      count(*) FILTER (WHERE verdict = 'watch')::int AS watch,
      count(*) FILTER (WHERE verdict = 'pass')::int AS pass
    FROM deal_analyses
    WHERE deal_key = ${dealKey} AND eligible AND is_public AND user_id IS NOT NULL
  `);
  const row = (result.rows[0] ?? {}) as Row;
  const analysts = Number(row.analysts ?? 0);
  return {
    analysts,
    medians:
      analysts >= CONSENSUS_FLOOR
        ? { monthlyRent: num(row.rent), capRate: num(row.cap), monthlyCashFlow: num(row.cash_flow), offerPrice: num(row.offer) }
        : null,
    verdicts: { pursue: Number(row.pursue ?? 0), watch: Number(row.watch ?? 0), pass: Number(row.pass ?? 0) },
  };
}

export interface ActorStats {
  deals: number;
  thisWeek: number;
  /** Consecutive weeks, up to and including this one (or last), with at least one analysis. */
  streakWeeks: number;
  score: number;
}

/** Monday 00:00 UTC of the week containing `date`. */
export function weekStart(date: Date): number {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = (day.getUTCDay() + 6) % 7;
  return day.getTime() - weekday * 86_400_000;
}

/** Pure: given the weeks a person was active, how long is the run that is still alive? */
export function streakFromWeeks(activeWeekStarts: number[], now: Date = new Date()): number {
  const weeks = new Set(activeWeekStarts);
  const WEEK = 7 * 86_400_000;
  let cursor = weekStart(now);
  // A streak survives until the end of the following week.
  if (!weeks.has(cursor)) cursor -= WEEK;
  let streak = 0;
  while (weeks.has(cursor)) {
    streak += 1;
    cursor -= WEEK;
  }
  return streak;
}

export async function getActorStats(actorKey: string, now: Date = new Date()): Promise<ActorStats> {
  const result = await getDb().execute(sql`
    SELECT extract(epoch FROM date_trunc('week', created_at))::bigint AS week_epoch,
      count(*)::int AS deals, coalesce(sum(quality), 0)::float AS quality
    FROM deal_analyses WHERE actor_key = ${actorKey} AND eligible
    GROUP BY 1 ORDER BY 1 DESC LIMIT 260
  `);
  const rows = result.rows as Row[];
  const thisWeek = weekStart(now);
  let deals = 0;
  let quality = 0;
  let inThisWeek = 0;
  const weeks: number[] = [];
  for (const row of rows) {
    // An epoch, not a timestamp: drivers disagree about zone-less timestamps, never about a number.
    const start = weekStart(new Date(Number(row.week_epoch) * 1000));
    weeks.push(start);
    deals += Number(row.deals);
    quality += Number(row.quality);
    if (start === thisWeek) inThisWeek = Number(row.deals);
  }
  return { deals, thisWeek: inThisWeek, streakWeeks: streakFromWeeks(weeks, now), score: Math.round(quality * 10) };
}

export type LeaderboardPeriod = "week" | "month" | "all";

export interface LeaderboardRow {
  rank: number;
  userId: string;
  name: string;
  city: string | null;
  deals: number;
  score: number;
  markets: number;
}

/**
 * Members ranked by quality-weighted deals underwritten. One deal counts once
 * per person (the table's unique key), implausible numbers never count, and
 * anonymous visitors aren't ranked — an account is the price of a place.
 */
export async function getLeaderboard(period: LeaderboardPeriod, options: { city?: string | null; limit?: number } = {}): Promise<LeaderboardRow[]> {
  const since =
    period === "week" ? sql`AND a.created_at >= date_trunc('week', now() AT TIME ZONE 'utc')`
    : period === "month" ? sql`AND a.created_at >= date_trunc('month', now() AT TIME ZONE 'utc')`
    : sql``;
  const inCity = options.city ? sql`AND lower(a.city) = ${options.city.toLowerCase()}` : sql``;
  const result = await getDb().execute(sql`
    SELECT u.id AS user_id, u.name, u.city,
      count(*)::int AS deals,
      round(sum(a.quality) * 10)::int AS score,
      count(DISTINCT lower(a.city))::int AS markets
    FROM deal_analyses a
    JOIN users u ON u.id = a.user_id
    WHERE a.eligible AND u.show_on_leaderboard ${since} ${inCity}
    GROUP BY u.id, u.name, u.city
    ORDER BY score DESC, deals DESC, min(a.created_at) ASC
    LIMIT ${options.limit ?? 25}
  `);
  return (result.rows as Row[]).map((row, index) => ({
    rank: index + 1,
    userId: String(row.user_id),
    name: publicName(row.name as string | null),
    city: (row.city as string | null) ?? null,
    deals: Number(row.deals),
    score: Number(row.score),
    markets: Number(row.markets),
  }));
}

/**
 * One member's place on each board, without fetching the boards. Same ordering
 * as getLeaderboard (score, then deals, then who got there first). Null when
 * they have no eligible deal in that period or have stepped off the board.
 */
export async function getRanks(userId: string): Promise<Record<LeaderboardPeriod, number | null>> {
  const result = await getDb().execute(sql`
    WITH periods(period, since) AS (
      VALUES ('week', date_trunc('week', now() AT TIME ZONE 'utc')),
             ('month', date_trunc('month', now() AT TIME ZONE 'utc')),
             ('all', 'epoch'::timestamp)
    ),
    scored AS (
      SELECT p.period, a.user_id, sum(a.quality) AS score, count(*) AS deals, min(a.created_at) AS first_at
      FROM periods p
      JOIN deal_analyses a ON a.created_at >= p.since AND a.eligible
      JOIN users u ON u.id = a.user_id AND u.show_on_leaderboard
      GROUP BY p.period, a.user_id
    ),
    ranked AS (
      SELECT period, user_id, row_number() OVER (PARTITION BY period ORDER BY round(score * 10) DESC, deals DESC, first_at ASC) AS rank
      FROM scored
    )
    SELECT period, rank::int AS rank FROM ranked WHERE user_id = ${userId}
  `);
  const ranks: Record<LeaderboardPeriod, number | null> = { week: null, month: null, all: null };
  for (const row of result.rows as Array<Record<string, unknown>>) {
    const period = String(row.period) as LeaderboardPeriod;
    if (period in ranks) ranks[period] = Number(row.rank);
  }
  return ranks;
}

/** One ladder. Thresholds are deals underwritten. */
export const BADGES = [
  { at: 500, name: "Legend" },
  { at: 250, name: "Veteran" },
  { at: 100, name: "Deal hunter" },
  { at: 50, name: "Power user" },
  { at: 10, name: "Analyst" },
  { at: 1, name: "First underwrite" },
] as const;

export function badgeFor(deals: number): { name: string; next: { name: string; at: number } | null } | null {
  const earned = BADGES.find((badge) => deals >= badge.at);
  const ladder = [...BADGES].reverse();
  const next = ladder.find((badge) => badge.at > deals) ?? null;
  if (!earned) return next ? { name: "", next } : null;
  return { name: earned.name, next };
}
