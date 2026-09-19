import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { authThrottle } from "@/lib/db/schema";

/**
 * Failed-attempt throttle. Serverless instances share nothing, so the counter
 * lives in Postgres: at most MAX_FAILURES per key per window. Keys are
 * "login:<email>" and "ip:<address>"; a success clears the email key.
 *
 * Throttle trouble never locks people out — if the counter cannot be read the
 * attempt proceeds (bcrypt's cost is the backstop).
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

export async function isThrottled(key: string, now: Date = new Date(), max: number = MAX_FAILURES): Promise<boolean> {
  try {
    const rows = await getDb().select().from(authThrottle).where(eq(authThrottle.key, key)).limit(1);
    const row = rows[0];
    if (!row) return false;
    if (now.getTime() - row.windowStartedAt.getTime() > WINDOW_MS) return false;
    return row.count >= max;
  } catch {
    return false;
  }
}

export async function recordFailure(key: string, now: Date = new Date()): Promise<void> {
  try {
    const windowFloor = new Date(now.getTime() - WINDOW_MS);
    await getDb()
      .insert(authThrottle)
      .values({ key, count: 1, windowStartedAt: now })
      .onConflictDoUpdate({
        target: authThrottle.key,
        set: {
          count: sql`CASE WHEN ${authThrottle.windowStartedAt} < ${windowFloor} THEN 1 ELSE ${authThrottle.count} + 1 END`,
          windowStartedAt: sql`CASE WHEN ${authThrottle.windowStartedAt} < ${windowFloor} THEN ${now} ELSE ${authThrottle.windowStartedAt} END`,
        },
      });
  } catch {
    // Counting is best-effort.
  }
}

/**
 * Count this use and say whether it is within the allowance — in ONE statement, so
 * a burst of parallel requests can't all read "under the limit" before any of them
 * is counted. For anything that costs money per call. Fails closed by default:
 * if the counter can't be written, the paid thing doesn't run.
 */
export async function takeToken(key: string, max: number, options: { windowMs?: number; now?: Date; failOpen?: boolean } = {}): Promise<boolean> {
  const now = options.now ?? new Date();
  const windowFloor = new Date(now.getTime() - (options.windowMs ?? WINDOW_MS));
  try {
    const rows = await getDb()
      .insert(authThrottle)
      .values({ key, count: 1, windowStartedAt: now })
      .onConflictDoUpdate({
        target: authThrottle.key,
        set: {
          count: sql`CASE WHEN ${authThrottle.windowStartedAt} < ${windowFloor} THEN 1 ELSE ${authThrottle.count} + 1 END`,
          windowStartedAt: sql`CASE WHEN ${authThrottle.windowStartedAt} < ${windowFloor} THEN ${now} ELSE ${authThrottle.windowStartedAt} END`,
        },
      })
      .returning({ count: authThrottle.count });
    return (rows[0]?.count ?? 1) <= max;
  } catch {
    return options.failOpen ?? false;
  }
}

export async function clearFailures(key: string): Promise<void> {
  try {
    await getDb().delete(authThrottle).where(eq(authThrottle.key, key));
  } catch {
    // Best-effort.
  }
}

export function clientIp(request: Request): string {
  return (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}
