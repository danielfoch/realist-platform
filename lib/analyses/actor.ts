import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/current";
import type { User } from "@/lib/db/schema";

/** The anonymous visitor id shared with the multiplex underwriter. */
export const ANON_COOKIE = "realist_sid";

export interface Actor {
  /** "user:<id>" or "sid:<anonymous id>". */
  key: string;
  user: User | null;
  sessionId: string | null;
}

/**
 * Who is doing the analysing. Signed-in members are themselves; everyone else
 * gets a long-lived anonymous id so their work is waiting for them if they
 * create an account later. Call from a route handler — it may set a cookie.
 */
export async function resolveActor(options: { create: boolean }): Promise<Actor | null> {
  const user = await getCurrentUser();
  const store = await cookies();
  let sessionId = store.get(ANON_COOKIE)?.value ?? null;
  if (sessionId && !/^[a-f0-9]{16,64}$/i.test(sessionId)) sessionId = null;

  if (user) return { key: `user:${user.id}`, user, sessionId };
  if (!sessionId) {
    if (!options.create) return null;
    sessionId = crypto.randomBytes(16).toString("hex");
    store.set(ANON_COOKIE, sessionId, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/", secure: process.env.NODE_ENV === "production" });
  }
  return { key: `sid:${sessionId}`, user: null, sessionId };
}
