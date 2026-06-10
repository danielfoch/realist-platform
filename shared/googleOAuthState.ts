/**
 * HMAC-signed OAuth state helpers for the per-user Google Sheets flow.
 *
 * The state parameter carries the live app's user id (a uuid string) through
 * Google's redirect so the callback can attribute tokens without relying on
 * the session cookie surviving the round trip. The signature prevents a
 * crafted callback from attaching tokens to someone else's account, and the
 * embedded timestamp expires stale links.
 *
 * Pure (crypto-only) so it can live in shared/ and be vitest-covered.
 * Ported from the idx app (src/google-sheets.ts signState/verifyState),
 * adapted to string uuid user ids.
 */

import { createHmac, timingSafeEqual } from "crypto";

/** Auth links older than this are rejected — long enough for the consent screen, short enough to limit replay. */
export const GOOGLE_OAUTH_STATE_MAX_AGE_MS = 15 * 60 * 1000;

function hmac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Sign a user id into an opaque base64url state token: `userId.timestamp.sig`.
 * User ids are uuids (no "." characters), so "." is a safe delimiter.
 */
export function signGoogleOAuthState(userId: string, secret: string, now: number = Date.now()): string {
  if (!userId || userId.includes(".")) {
    throw new Error("signGoogleOAuthState requires a non-empty user id without '.'");
  }
  const payload = `${userId}.${now}`;
  const sig = hmac(payload, secret);
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

/**
 * Verify a state token and return the embedded user id, or null when the
 * token is malformed, tampered with, signed with another secret, or expired.
 */
export function verifyGoogleOAuthState(state: string, secret: string, now: number = Date.now()): string | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const [userId, tsStr, sig] = parts;
    if (!userId || !tsStr || !sig) return null;

    const expected = hmac(`${userId}.${tsStr}`, secret);
    const sigBuf = Buffer.from(sig, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

    const ts = Number(tsStr);
    if (!Number.isFinite(ts)) return null;
    if (now - ts > GOOGLE_OAUTH_STATE_MAX_AGE_MS) return null;
    if (ts - now > 60 * 1000) return null; // clock-skew guard: reject far-future stamps

    return userId;
  } catch {
    return null;
  }
}
