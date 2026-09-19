import crypto from "node:crypto";
import { SITE_BASE_URL } from "@/lib/brand";

/**
 * Unsubscribe links that work without signing in. The token is an HMAC of the
 * member's id, so a link can only ever unsubscribe the person it was sent to,
 * and nothing about it is guessable. It never expires: CASL requires an
 * unsubscribe mechanism to keep working long after the email was sent.
 */

function secret(): string | null {
  return process.env.EMAIL_LINK_SECRET?.trim() || process.env.CRON_SECRET?.trim() || null;
}

export function unsubscribeToken(userId: string): string | null {
  const key = secret();
  if (!key) return null;
  return crypto.createHmac("sha256", key).update(`unsubscribe:${userId}`).digest("base64url");
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  const expected = unsubscribeToken(userId);
  if (!expected || !token) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** The page a person lands on (a button, because mail scanners pre-fetch links). */
export function unsubscribePageUrl(userId: string): string | null {
  const token = unsubscribeToken(userId);
  return token ? `${SITE_BASE_URL}/unsubscribe?u=${encodeURIComponent(userId)}&t=${token}` : null;
}

/** The RFC 8058 one-click endpoint mail providers POST to from their own "unsubscribe" button. */
export function unsubscribeOneClickUrl(userId: string): string | null {
  const token = unsubscribeToken(userId);
  return token ? `${SITE_BASE_URL}/api/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${token}` : null;
}
