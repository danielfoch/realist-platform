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

export async function isThrottled(key: string, now: Date = new Date()): Promise<boolean> {
  try {
    const rows = await getDb().select().from(authThrottle).where(eq(authThrottle.key, key)).limit(1);
    const row = rows[0];
    if (!row) return false;
    if (now.getTime() - row.windowStartedAt.getTime() > WINDOW_MS) return false;
    return row.count >= MAX_FAILURES;
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
