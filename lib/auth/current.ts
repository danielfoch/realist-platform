import { cookies } from "next/headers";
import type { User } from "@/lib/db/schema";
import { SESSION_COOKIE, findSessionUser, sessionCookieOptions, type SessionVia } from "./sessions";

/**
 * The signed-in user for the current request, or null. Safe to call from
 * server components, route handlers and server actions. Any database trouble
 * reads as "signed out" rather than an error page.
 */
export async function getCurrentUser(): Promise<User | null> {
  return (await getCurrentSession())?.user ?? null;
}

/** The user plus how and when this session was opened. */
export async function getCurrentSession(): Promise<{ user: User; via: SessionVia; openedAt: Date } | null> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    const found = await findSessionUser(token);
    if (!found) return null;
    if (found.renewedUntil && token) {
      try {
        store.set(SESSION_COOKIE, token, sessionCookieOptions(found.renewedUntil));
      } catch {
        // Server components cannot write cookies; the next route handler will.
      }
    }
    return { user: found.user, via: found.via, openedAt: found.openedAt };
  } catch {
    return null;
  }
}

/** The fields the browser is allowed to know about the signed-in user. */
export function toViewer(user: User) {
  return { id: user.id, email: user.email, name: user.name, city: user.city };
}
