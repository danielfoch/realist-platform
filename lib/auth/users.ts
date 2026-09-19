import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, type User } from "@/lib/db/schema";

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
