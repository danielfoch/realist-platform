/**
 * Durable per-day usage caps for free-tier tools.
 *
 * The multiplex underwriter enforced its cap (3/day anonymous, 20/day signed in)
 * with a process-local Map. On Replit, where the process restarts often, that
 * handed every visitor a fresh allowance on each boot — so the cap leaked in the
 * one place it matters most, because hitting it is the platform's only reason to
 * sign up. Counters now live in usage_counters, keyed by (scope, key, day).
 *
 * Fails OPEN: if the counter table is unreachable the tool still runs. A cap is a
 * conversion nudge, not a security boundary, and a database blip must not take
 * the product down.
 */

import crypto from "node:crypto";
import type { Request } from "express";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "./db";
import { usageCounters } from "@shared/schema";

export interface UsageDecision {
  allowed: boolean;
  /** Cap that applied to this caller. */
  limit: number;
  /** Uses remaining after this call (0 when the cap was just hit). */
  remaining: number;
  /** True when the check itself failed and the call was let through. */
  degraded: boolean;
}

/** UTC day bucket — matches how the in-memory counter sliced days. */
function today(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Identity for counting. A signed-in user is counted by id across devices; an
 * anonymous visitor by session, falling back to a hashed IP so that clearing
 * cookies alone does not reset the allowance. The IP is hashed because this row
 * outlives the request and a raw IP is personal data we have no reason to keep.
 */
export function usageKey(req: Request): { key: string; identified: boolean } {
  const userId = (req as any).session?.userId as string | undefined;
  if (userId) return { key: `u:${userId}`, identified: true };

  const sessionId = (req as any).sessionID as string | undefined;
  if (sessionId) return { key: `s:${sessionId}`, identified: false };

  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  return { key: `i:${crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32)}`, identified: false };
}

/**
 * Consume one unit against a daily cap.
 *
 * The increment and the check are one statement: the UPSERT returns the new
 * count, and the caller is over the cap only if that count exceeds the limit.
 * Doing it in two steps would let two concurrent requests both read count = 2
 * against a cap of 3 and both proceed.
 *
 * Note this counts the rejected attempt too, which is intentional — a caller
 * hammering a capped endpoint should not get a free retry budget.
 */
export async function consumeDailyUsage(
  scope: string,
  req: Request,
  limits: { anonymous: number; identified: number },
): Promise<UsageDecision> {
  const { key, identified } = usageKey(req);
  const limit = identified ? limits.identified : limits.anonymous;

  try {
    const [row] = await db
      .insert(usageCounters)
      .values({ scope, key, day: today(), count: 1 })
      .onConflictDoUpdate({
        target: [usageCounters.scope, usageCounters.key, usageCounters.day],
        set: { count: sql`${usageCounters.count} + 1`, updatedAt: new Date() },
      })
      .returning({ count: usageCounters.count });

    const count = Number(row?.count ?? 1);
    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      degraded: false,
    };
  } catch (err) {
    console.error(`[usage-limits] ${scope} check failed, allowing through:`, err);
    return { allowed: true, limit, remaining: limit, degraded: true };
  }
}

/** Read the current count without consuming — for "N left today" UI. */
export async function peekDailyUsage(
  scope: string,
  req: Request,
  limits: { anonymous: number; identified: number },
): Promise<UsageDecision> {
  const { key, identified } = usageKey(req);
  const limit = identified ? limits.identified : limits.anonymous;

  try {
    const [row] = await db
      .select({ count: usageCounters.count })
      .from(usageCounters)
      .where(
        and(
          eq(usageCounters.scope, scope),
          eq(usageCounters.key, key),
          eq(usageCounters.day, today()),
        ),
      )
      .limit(1);

    const count = Number(row?.count ?? 0);
    return { allowed: count < limit, limit, remaining: Math.max(0, limit - count), degraded: false };
  } catch (err) {
    console.error(`[usage-limits] ${scope} peek failed:`, err);
    return { allowed: true, limit, remaining: limit, degraded: true };
  }
}

/**
 * Record that this caller unlocked a higher allowance today (by handing over an
 * email, typically). Stored as its own daily counter so it expires with the day
 * and rides the same prune.
 */
export async function grantDailyUnlock(scope: string, req: Request): Promise<void> {
  const { key } = usageKey(req);
  try {
    await db
      .insert(usageCounters)
      .values({ scope: `${scope}:unlock`, key, day: today(), count: 1 })
      .onConflictDoUpdate({
        target: [usageCounters.scope, usageCounters.key, usageCounters.day],
        set: { count: sql`${usageCounters.count} + 1`, updatedAt: new Date() },
      });
  } catch (err) {
    console.error(`[usage-limits] failed to record ${scope} unlock:`, err);
  }
}

/** Whether this caller already unlocked today. Fails CLOSED — see below. */
export async function hasDailyUnlock(scope: string, req: Request): Promise<boolean> {
  const { key } = usageKey(req);
  try {
    const [row] = await db
      .select({ count: usageCounters.count })
      .from(usageCounters)
      .where(
        and(
          eq(usageCounters.scope, `${scope}:unlock`),
          eq(usageCounters.key, key),
          eq(usageCounters.day, today()),
        ),
      )
      .limit(1);
    return Number(row?.count ?? 0) > 0;
  } catch (err) {
    // Opposite of consumeDailyUsage on purpose: there, failing open keeps the
    // product working. Here, failing open would silently hand everyone the
    // raised limit, so the cheaper mistake is to show the unlock prompt again.
    console.error(`[usage-limits] ${scope} unlock lookup failed:`, err);
    return false;
  }
}

/**
 * Drop buckets for elapsed days. Yesterday's rows are never read again, and
 * without this the table grows by one row per caller per day forever.
 */
export async function pruneUsageCounters(retainDays = 3): Promise<number> {
  try {
    const cutoff = today(new Date(Date.now() - retainDays * 24 * 60 * 60 * 1000));
    const result = await db.delete(usageCounters).where(lt(usageCounters.day, cutoff));
    return result.rowCount ?? 0;
  } catch (err) {
    console.error("[usage-limits] prune failed:", err);
    return 0;
  }
}
