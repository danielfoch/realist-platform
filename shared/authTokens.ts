/**
 * Passwordless-auth token + policy logic (pure, vitest-covered).
 *
 * Several flows silently create accounts (lead capture auto-enroll, event
 * ticket checkout, event RSVP, admin imports). Historically their ONLY key
 * was a set-password link with a short, path-dependent expiry (24h/7d/30d) —
 * an expired link meant a permanently locked-out user. This module is the
 * single source of truth for the durable replacement:
 *
 * - Magic-link login tokens: 30-minute, single-use, purpose-scoped sha256
 *   hashes stored in the existing password_reset_tokens table.
 * - Set-password/welcome tokens: uniform 14-day TTL across every path.
 * - A rolling one-hour rate window (max 3 link requests per email).
 * - Email normalization so casing/whitespace can't fork identities.
 *
 * Pure (crypto-only, injected clocks) so it lives in shared/ and is unit
 * tested; server/auth.ts owns the Express + DB wiring.
 */

import { createHash, randomBytes } from "crypto";

/** Magic sign-in links are short-lived: email access now == login now. */
export const LOGIN_LINK_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Uniform TTL for every set-password/welcome link (was 24h/7d/30d by path). */
export const SETUP_LINK_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

/** Rolling window for per-email magic-link request limiting. */
export const LOGIN_LINK_WINDOW_MS = 60 * 60 * 1000; // 1 hour
export const LOGIN_LINK_MAX_PER_WINDOW = 3;

/**
 * Canonical email form used by every silent account-creation path.
 * Lowercase + trim so "Dan@X.com " and "dan@x.com" cannot fork identities.
 */
export function normalizeEmail(raw: string | null | undefined): string {
  return (raw || "").trim().toLowerCase();
}

/**
 * Purpose-scoped hash for login tokens. They share the password_reset_tokens
 * table with set-password/reset-password tokens, but those endpoints hash the
 * bare token — so a leaked/expired login token can never be redeemed to set a
 * password, and a set-password token can never be redeemed as a login.
 */
export function hashLoginToken(rawToken: string): string {
  return createHash("sha256").update(`login-link:${rawToken}`).digest("hex");
}

export interface IssuedLoginToken {
  /** Goes into the emailed link, never stored. */
  rawToken: string;
  /** Goes into the database. */
  tokenHash: string;
  expiresAt: Date;
}

/** Mint a 32-byte random single-use login token (rng injectable for tests). */
export function issueLoginToken(
  now: number = Date.now(),
  randomHex: () => string = () => randomBytes(32).toString("hex"),
): IssuedLoginToken {
  const rawToken = randomHex();
  return {
    rawToken,
    tokenHash: hashLoginToken(rawToken),
    expiresAt: new Date(now + LOGIN_LINK_TTL_MS),
  };
}

export type LoginTokenFailure = "not_found" | "used" | "expired";
export type LoginTokenDecision = { ok: true } | { ok: false; reason: LoginTokenFailure };

/** Decide whether a stored token row (or its absence) grants a login. */
export function verifyLoginToken(
  record: { expiresAt: Date | string; usedAt?: Date | string | null } | null | undefined,
  now: number = Date.now(),
): LoginTokenDecision {
  if (!record) return { ok: false, reason: "not_found" };
  if (record.usedAt) return { ok: false, reason: "used" };
  const expiresAtMs =
    record.expiresAt instanceof Date ? record.expiresAt.getTime() : new Date(record.expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) return { ok: false, reason: "expired" };
  return { ok: true };
}

export interface LoginLinkRateDecision {
  allowed: boolean;
  /** Pruned request timestamps (including this one when allowed) for the caller to store back. */
  recentRequests: number[];
  /** When blocked: how long until the oldest counted request leaves the window. */
  retryAfterMs: number;
}

/**
 * Rolling-window limiter decision: at most LOGIN_LINK_MAX_PER_WINDOW requests
 * per email per LOGIN_LINK_WINDOW_MS. Applied uniformly whether or not an
 * account exists, so rate behaviour cannot be used to probe for accounts.
 */
export function evaluateLoginLinkRequest(
  previousRequests: readonly number[],
  now: number = Date.now(),
): LoginLinkRateDecision {
  const windowStart = now - LOGIN_LINK_WINDOW_MS;
  const recent = previousRequests.filter((t) => t > windowStart && t <= now);
  if (recent.length >= LOGIN_LINK_MAX_PER_WINDOW) {
    const oldest = Math.min(...recent);
    return {
      allowed: false,
      recentRequests: recent,
      retryAfterMs: Math.max(0, oldest + LOGIN_LINK_WINDOW_MS - now),
    };
  }
  return { allowed: true, recentRequests: [...recent, now], retryAfterMs: 0 };
}
