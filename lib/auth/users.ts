import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sessions, users, type User } from "@/lib/db/schema";

/** Emails are compared and stored lowercased and trimmed — one place decides. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const rows = await getDb().select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
  return rows[0] ?? null;
}

export async function findUserByGoogleId(googleId: string): Promise<User | null> {
  const rows = await getDb().select().from(users).where(eq(users.googleId, googleId)).limit(1);
  return rows[0] ?? null;
}

export async function createUser(input: {
  email: string;
  passwordHash?: string | null;
  googleId?: string | null;
  name?: string | null;
  emailVerified?: boolean;
  consentMarketing?: boolean;
  consentSource?: string;
}): Promise<User> {
  const now = new Date();
  const [row] = await getDb()
    .insert(users)
    .values({
      email: normalizeEmail(input.email),
      passwordHash: input.passwordHash ?? null,
      googleId: input.googleId ?? null,
      name: input.name?.trim() || null,
      emailVerifiedAt: input.emailVerified ? now : null,
      consentMarketing: Boolean(input.consentMarketing),
      consentAt: input.consentMarketing ? now : null,
      consentSource: input.consentMarketing ? (input.consentSource ?? "signup") : null,
    })
    .returning();
  return row;
}

export async function touchLastLogin(userId: string): Promise<void> {
  await getDb().update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
}

/**
 * The first proof that a person owns this inbox: they opened an emailed link,
 * or Google vouches for the address. Password sign-up proves nothing about an
 * inbox, so an account made that way may have been made by someone else — who
 * would still hold its password and sessions after the real owner arrives
 * (and, for an address in ADMIN_EMAILS, would inherit the operator view).
 *
 * So on first verification: if the browser doing the verifying is already
 * signed in to this account, it is the person who set the password and nothing
 * changes. Otherwise that password and every session it opened are discarded;
 * the owner can set a new password straight away. Accounts carried over from
 * the previous site keep their passwords: their provenance is that site's.
 */
export async function confirmEmailOwnership(
  user: User,
  options: { sameBrowserIsSignedInAs: string | null; googleId?: string },
): Promise<{ firstVerification: boolean; passwordCleared: boolean }> {
  const db = getDb();
  if (user.emailVerifiedAt) {
    if (options.googleId && !user.googleId) await db.update(users).set({ googleId: options.googleId, updatedAt: new Date() }).where(eq(users.id, user.id));
    return { firstVerification: false, passwordCleared: false };
  }
  const provenPasswordSetter = options.sameBrowserIsSignedInAs === user.id || Boolean(user.legacy);
  const clearPassword = Boolean(user.passwordHash) && !provenPasswordSetter;
  await db
    .update(users)
    .set({
      emailVerifiedAt: new Date(),
      updatedAt: new Date(),
      ...(options.googleId && !user.googleId ? { googleId: options.googleId } : {}),
      ...(clearPassword ? { passwordHash: null } : {}),
    })
    .where(eq(users.id, user.id));
  if (clearPassword) await db.delete(sessions).where(eq(sessions.userId, user.id));
  return { firstVerification: true, passwordCleared: clearPassword };
}
