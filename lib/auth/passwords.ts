import bcrypt from "bcryptjs";

/**
 * bcrypt at cost 12 — the same scheme the legacy app used, so password hashes
 * carried over by scripts/migrate-users.ts keep working unchanged.
 */
const BCRYPT_COST = 12;
export const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;

/** A real cost-12 hash of a discarded random string: compared against when the
 * account does not exist, so "no such user" and "wrong password" take the same
 * time. */
const DUMMY_HASH = "$2b$12$icpOjLPkcpy89d7E94gCbenw/of6Pz8Ex3Y2UoGP8lzEWNfDl8tCO";

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) return "That password is too long.";
  return null;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  try {
    if (!hash) {
      await bcrypt.compare(password, DUMMY_HASH);
      return false;
    }
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
