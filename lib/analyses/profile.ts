import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { badgeFor, getActorStats, type ActorStats } from "./community";
import { publicName } from "./dealKey";

/**
 * A member's public track record: what `/u/<id>` shows to anyone.
 *
 * The privacy line is drawn here, not in the page. A profile carries a first
 * name and initial, counts, a cap rate and a call per deal — never an email, a
 * phone number, a surname, or the rents and prices somebody typed. A listing is
 * already public, so its street address is shown; an off-market deal is
 * somebody's lead, so its address never leaves the database.
 */

export type DealCall = "pursue" | "watch" | "pass";

export interface PublicAnalysis {
  /** A listing's street line, or "Off-market · Hamilton". */
  label: string;
  /** The listing page. Null for anything off-market. */
  href: string | null;
  offMarket: boolean;
  city: string | null;
  province: string | null;
  /** Percent, one decimal. */
  capRate: number | null;
  verdict: DealCall | null;
  /** Epoch milliseconds of the person's latest numbers on the deal. */
  at: number;
}

export interface BadgeProgress {
  /** "" before the first deal. */
  name: string;
  next: { name: string; at: number } | null;
  /** 0–100: how far `deals` is toward the next badge. 100 at the top of the ladder. */
  percent: number;
  /** Deals still to go. 0 at the top of the ladder. */
  remaining: number;
}

export interface PublicProfile {
  userId: string;
  name: string;
  city: string | null;
  memberSince: Date;
  stats: ActorStats;
  badge: BadgeProgress;
  topMarkets: Array<{ city: string; province: string | null; deals: number }>;
  verdicts: Record<DealCall, number>;
  /** Percent, one decimal. */
  medianCapRate: number | null;
  recent: PublicAnalysis[];
}

/** Profiles thinner than this stay out of search indexes. */
export const INDEXABLE_AT = 10;

type Row = Record<string, unknown>;

/**
 * A city name fit to show. The city box is free text, so anything with a digit
 * in it is treated as an address typed in the wrong place and dropped.
 */
export function safeCity(city: string | null | undefined): string | null {
  const value = (city ?? "").trim().replace(/\s+/g, " ");
  if (!value || value.length > 60 || /\d/.test(value)) return null;
  return value;
}

/** "12 Main St, Hamilton, ON" → "12 Main St". */
export function streetLine(address: string | null | undefined): string | null {
  const line = (address ?? "").split(",")[0].trim();
  return line || null;
}

const CALLS: readonly string[] = ["pursue", "watch", "pass"];
const oneDecimal = (value: unknown): number | null => {
  const parsed = value == null ? NaN : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 10) / 10 : null;
};

/** One analysis, as a stranger may see it. */
export function toPublicAnalysis(row: {
  source: string;
  mlsNumber: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  capRate: number | null;
  verdict: string | null;
  at: number;
}): PublicAnalysis {
  const city = safeCity(row.city);
  const shared = {
    city,
    province: row.province?.trim() || null,
    capRate: oneDecimal(row.capRate),
    verdict: (row.verdict && CALLS.includes(row.verdict) ? row.verdict : null) as DealCall | null,
    at: row.at,
  };
  // Anything that isn't positively a listing is handled as off-market.
  if (row.source !== "listing") {
    return { ...shared, label: city ? `Off-market · ${city}` : "Off-market", href: null, offMarket: true };
  }
  const mls = row.mlsNumber?.trim() || null;
  return {
    ...shared,
    label: streetLine(row.address) ?? (mls ? `MLS® ${mls}` : city ? `Listing · ${city}` : "Listing"),
    href: mls ? `/listings/${encodeURIComponent(mls)}` : null,
    offMarket: false,
  };
}

/** Where a deal count sits on the badge ladder, as a bar can draw it. */
export function badgeProgress(deals: number): BadgeProgress {
  const badge = badgeFor(deals);
  const next = badge?.next ?? null;
  if (!next) return { name: badge?.name ?? "", next: null, percent: 100, remaining: 0 };
  const percent = Math.round((Math.max(0, deals) / next.at) * 100);
  return { name: badge?.name ?? "", next, percent: Math.min(99, percent), remaining: Math.max(0, next.at - deals) };
}

/**
 * Null unless the member exists, hasn't opted out, and has underwritten at
 * least one deal that counts. Everything below the headline counts is built
 * from analyses the person left public.
 */
export async function getPublicProfile(userId: string, now: Date = new Date()): Promise<PublicProfile | null> {
  const id = userId.trim();
  if (!id || id.length > 64) return null;
  const db = getDb();
  const [member] = await db
    .select({ id: users.id, name: users.name, city: users.city, createdAt: users.createdAt })
    .from(users)
    .where(and(eq(users.id, id), eq(users.showOnLeaderboard, true)))
    .limit(1);
  if (!member) return null;

  const actorKey = `user:${member.id}`;
  const stats = await getActorStats(actorKey, now);
  if (stats.deals < 1) return null;

  const [summary, markets, recent] = await Promise.all([
    db.execute(sql`
      SELECT count(*) FILTER (WHERE verdict = 'pursue')::int AS pursue,
        count(*) FILTER (WHERE verdict = 'watch')::int AS watch,
        count(*) FILTER (WHERE verdict = 'pass')::int AS pass,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY cap_rate) AS median_cap
      FROM deal_analyses
      WHERE actor_key = ${actorKey} AND eligible AND is_public
    `),
    db.execute(sql`
      SELECT mode() WITHIN GROUP (ORDER BY city) AS city,
        mode() WITHIN GROUP (ORDER BY province) AS province,
        count(*)::int AS deals
      FROM deal_analyses
      WHERE actor_key = ${actorKey} AND eligible AND is_public AND city IS NOT NULL
      GROUP BY lower(city)
      ORDER BY deals DESC, 1 ASC
      LIMIT 8
    `),
    // An off-market address is never selected, so nothing downstream can leak it.
    db.execute(sql`
      SELECT source, mls_number, city, province, cap_rate, verdict,
        CASE WHEN source = 'listing' THEN address END AS address,
        extract(epoch FROM updated_at)::bigint AS at_epoch
      FROM deal_analyses
      WHERE actor_key = ${actorKey} AND eligible AND is_public
      ORDER BY updated_at DESC
      LIMIT 8
    `),
  ]);

  const totals = (summary.rows[0] ?? {}) as Row;
  const topMarkets = (markets.rows as Row[])
    .map((row) => ({
      city: safeCity(row.city as string | null),
      province: ((row.province as string | null) ?? "").trim() || null,
      deals: Number(row.deals),
    }))
    .filter((market): market is { city: string; province: string | null; deals: number } => market.city !== null)
    .slice(0, 3);

  return {
    userId: member.id,
    name: publicName(member.name),
    city: safeCity(member.city),
    memberSince: member.createdAt,
    stats,
    badge: badgeProgress(stats.deals),
    topMarkets,
    verdicts: { pursue: Number(totals.pursue ?? 0), watch: Number(totals.watch ?? 0), pass: Number(totals.pass ?? 0) },
    medianCapRate: oneDecimal(totals.median_cap),
    recent: (recent.rows as Row[]).map((row) =>
      toPublicAnalysis({
        source: String(row.source),
        mlsNumber: (row.mls_number as string | null) ?? null,
        address: (row.address as string | null) ?? null,
        city: (row.city as string | null) ?? null,
        province: (row.province as string | null) ?? null,
        capRate: row.cap_rate == null ? null : Number(row.cap_rate),
        verdict: (row.verdict as string | null) ?? null,
        // An epoch, not a timestamp: drivers disagree about zone-less timestamps, never about a number.
        at: Number(row.at_epoch) * 1000,
      }),
    ),
  };
}
