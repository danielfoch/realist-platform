import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { analysisQuality, houseDefaults, underwrite } from "@/lib/underwriting/underwriter";
import { PROVEN_MEMBER, type LeaderboardPeriod } from "./community";
import { safeCity } from "./profile";

/**
 * What the leaderboard page needs around the board itself: reading its two
 * query parameters, building its links, the markets worth filtering by, and
 * the real point values its "how scoring works" copy quotes.
 */

export const BOARD_PATH = "/community/leaderboard";

export const PERIODS: ReadonlyArray<{ key: LeaderboardPeriod; label: string; phrase: string }> = [
  { key: "week", label: "This week", phrase: "this week" },
  { key: "month", label: "This month", phrase: "this month" },
  { key: "all", label: "All time", phrase: "all time" },
];

type QueryValue = string | string[] | undefined;
const first = (value: QueryValue): string | undefined => (Array.isArray(value) ? value[0] : value);

export function parsePeriod(value: QueryValue): LeaderboardPeriod {
  const period = first(value);
  return period === "month" || period === "all" ? period : "week";
}

/** A market to filter by, or null. Rejects anything that isn't a plain city name. */
export function parseCity(value: QueryValue): string | null {
  return safeCity(first(value));
}

/** The canonical link for a view of the board: defaults are left out. */
export function boardHref(view: { period?: LeaderboardPeriod; city?: string | null } = {}): string {
  const params = new URLSearchParams();
  if (view.period && view.period !== "week") params.set("period", view.period);
  if (view.city) params.set("city", view.city);
  const query = params.toString();
  return query ? `${BOARD_PATH}?${query}` : BOARD_PATH;
}

/**
 * A hand-typed "?city=st. catharines" reads as "St. Catharines" in the heading.
 * Anything that already carries capitals is left exactly as written.
 */
export function cityLabel(city: string): string {
  if (city !== city.toLowerCase()) return city;
  return city.replace(/(^|[\s-])(\p{L})/gu, (_, lead: string, letter: string) => lead + letter.toUpperCase());
}

/**
 * Points one eligible deal is worth on the board, by how much of it the person
 * worked — read off the real scoring function, so the page can't drift from it.
 */
export function scoringPoints(): { untouched: number; light: number; worked: number } {
  const result = underwrite(houseDefaults({ price: 600_000, monthlyRent: 4_000, units: 2 }));
  const points = (edits: string[]) => Math.round(analysisQuality(result, edits).score * 100) / 10;
  return { untouched: points([]), light: points(["a"]), worked: points(["a", "b", "c"]) };
}

/** Markets with the most ranked activity in the period — the board's filter chips. */
export async function getBoardMarkets(period: LeaderboardPeriod, limit = 6): Promise<Array<{ city: string; deals: number }>> {
  const since =
    period === "week" ? sql`AND a.created_at >= date_trunc('week', now() AT TIME ZONE 'utc')`
    : period === "month" ? sql`AND a.created_at >= date_trunc('month', now() AT TIME ZONE 'utc')`
    : sql``;
  const result = await getDb().execute(sql`
    SELECT mode() WITHIN GROUP (ORDER BY a.city) AS city, count(*)::int AS deals
    FROM deal_analyses a
    JOIN users u ON u.id = a.user_id
    WHERE a.eligible AND u.show_on_leaderboard AND ${PROVEN_MEMBER} AND a.city IS NOT NULL ${since}
    GROUP BY lower(a.city)
    ORDER BY deals DESC, 1 ASC
    LIMIT ${limit + 4}
  `);
  return (result.rows as Array<Record<string, unknown>>)
    .map((row) => ({ city: safeCity(row.city as string | null), deals: Number(row.deals) }))
    .filter((market): market is { city: string; deals: number } => market.city !== null)
    .slice(0, limit);
}
