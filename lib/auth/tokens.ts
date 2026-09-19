import crypto from "node:crypto";

/**
 * Opaque bearer secrets (session cookies, emailed links). The raw token goes
 * to the person; only its SHA-256 is ever stored, so a database read cannot be
 * replayed as a login.
 */

export function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}
