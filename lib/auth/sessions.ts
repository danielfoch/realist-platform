import { and, eq, gt, lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sessions, users, type User } from "@/lib/db/schema";
import { generateToken, hashToken } from "./tokens";

/**
 * Persistent logins: a 30-day session that renews itself while it is being
 * used, so an active member effectively stays signed in.
 */
export const SESSION_COOKIE = "realist_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Renew at most this often, so ordinary page views do not write to the db. */
const RENEW_AFTER_MS = 24 * 60 * 60 * 1000;

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export type SessionVia = "password" | "google" | "magic_link";

export async function createSession(
  userId: string,
  userAgent?: string | null,
  via: SessionVia = "password",
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await getDb()
    .insert(sessions)
    .values({
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      userAgent: userAgent?.slice(0, 300) ?? null,
      via,
    });
  return { token, expiresAt };
}

/**
 * The signed-in user for a session token, or null. Renews the session when it
 * was last touched more than a day ago; `renewedUntil` tells the caller to
 * push the cookie's expiry out to match.
 */
export async function findSessionUser(
  token: string | undefined | null,
  now: Date = new Date(),
): Promise<{ user: User; renewedUntil: Date | null; via: SessionVia; openedAt: Date } | null> {
  if (!token) return null;
  const db = getDb();
  const tokenHash = hashToken(token);
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  let renewedUntil: Date | null = null;
  if (now.getTime() - row.session.lastSeenAt.getTime() > RENEW_AFTER_MS) {
    renewedUntil = new Date(now.getTime() + SESSION_TTL_MS);
    await db
      .update(sessions)
      .set({ lastSeenAt: now, expiresAt: renewedUntil })
      .where(eq(sessions.tokenHash, tokenHash));
  }
  return { user: row.user, renewedUntil, via: row.session.via, openedAt: row.session.createdAt };
}

export async function destroySession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await getDb().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

/** Sign out everywhere — used after a password reset. */
export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.userId, userId));
}

export async function pruneExpiredSessions(now: Date = new Date()): Promise<void> {
  await getDb().delete(sessions).where(lt(sessions.expiresAt, now));
}
