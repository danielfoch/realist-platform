import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { multiplexUnderwritings } from "@/lib/db/schema";
import {
  SESSION_COOKIE,
  createSession,
  destroySession,
  sessionCookieOptions,
  type SessionVia,
} from "./sessions";
import { touchLastLogin } from "./users";

/** The anonymous visitor id set by /api/multiplex/underwrite. */
const ANON_COOKIE = "realist_sid";

/**
 * Work done before signing in follows the person into their account: any
 * underwrite run under this browser's anonymous id, and not yet owned by
 * anyone, becomes theirs. Never steals — only unowned rows are claimed.
 */
async function claimAnonymousWork(userId: string, anonymousId: string | undefined): Promise<void> {
  if (!anonymousId) return;
  try {
    await getDb()
      .update(multiplexUnderwritings)
      .set({ userId })
      .where(and(eq(multiplexUnderwritings.sessionId, anonymousId), isNull(multiplexUnderwritings.userId)));
  } catch (error) {
    console.error("[auth] claiming anonymous work failed:", (error as Error).message);
  }
}

/** Create a session for the user and set the cookie on the current response. */
export async function beginSession(userId: string, request: Request, via: SessionVia = "password"): Promise<void> {
  const { token, expiresAt } = await createSession(userId, request.headers.get("user-agent"), via);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  await Promise.all([touchLastLogin(userId), claimAnonymousWork(userId, store.get(ANON_COOKIE)?.value)]);
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  await destroySession(store.get(SESSION_COOKIE)?.value);
  store.delete(SESSION_COOKIE);
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function fail(status: number, error: string): Response {
  return Response.json({ ok: false, error }, { status });
}

/** One message for every database-down case, so nothing leaks and nothing 500s. */
export const UNAVAILABLE = "Accounts are briefly unavailable. Please try again in a minute.";
