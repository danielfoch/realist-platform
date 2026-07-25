/**
 * Email + phone verification for new accounts.
 *
 * Policy (chosen deliberately, see the two constants below):
 *
 *  - Verification gates the TOOLS, never the login. An unverified user can sign
 *    in, browse, read the encyclopedia and buy an event ticket; what they cannot
 *    do is underwrite, save, or submit a deal. Gating login would mean a
 *    spam-filtered email or a failed SMS turns into a dead account and a support
 *    request, which is a worse failure than an unverified row.
 *
 *  - Only accounts created from ENFORCED_FROM onward are subject to it. Existing
 *    users are grandfathered by signup date rather than by back-filling
 *    `email_verified = true`, because that would be recording something we never
 *    actually checked. The date is explicit and auditable; nobody's access
 *    changes retroactively.
 *
 * Email ownership is also proven by two flows that predate this module: setting a
 * password from an emailed token, and signing in with a magic link. Both mark the
 * address verified — re-asking someone to click a second email right after they
 * clicked the first is theatre, not security.
 */

import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { users } from "@shared/models/auth";
import { verificationTokens } from "@shared/schema";
import { appBaseUrl } from "./auth";

/**
 * Accounts created before this instant are exempt. Set to the deploy of the
 * verification requirement — moving it forward re-exempts people, moving it back
 * subjects existing users to a wall they did not sign up for.
 */
export const VERIFICATION_ENFORCED_FROM = new Date("2026-07-25T00:00:00.000Z");

/** How long an emailed verification link stays good. */
const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface VerificationState {
  required: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  /** True when the account may use gated tools. */
  satisfied: boolean;
  missing: Array<"email" | "phone">;
}

/**
 * Whether this account must verify, and what it still owes.
 *
 * A skipped phone (phone_verification_skipped_at) does NOT satisfy the
 * requirement — skip exists so OAuth users stop being re-prompted on every
 * visit, not as a way out of a requirement.
 */
export async function getVerificationState(userId: string): Promise<VerificationState> {
  const [user] = await db
    .select({
      createdAt: users.createdAt,
      emailVerified: users.emailVerified,
      phoneVerified: users.phoneVerified,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return { required: false, emailVerified: false, phoneVerified: false, satisfied: true, missing: [] };
  }

  const emailVerified = !!user.emailVerified;
  const phoneVerified = !!user.phoneVerified;

  // A null createdAt (possible on very old rows) is treated as grandfathered —
  // fail open rather than lock someone out over a missing timestamp.
  const required = !!user.createdAt && user.createdAt >= VERIFICATION_ENFORCED_FROM;

  const missing: Array<"email" | "phone"> = [];
  if (!emailVerified) missing.push("email");
  if (!phoneVerified) missing.push("phone");

  return {
    required,
    emailVerified,
    phoneVerified,
    satisfied: !required || missing.length === 0,
    missing: required ? missing : [],
  };
}

/**
 * Express guard for tool endpoints. 403 with a structured body so the client can
 * route straight to the right step instead of showing a generic error.
 *
 * Deliberately NOT an auth check — pair it with isAuthenticated where the route
 * needs a session. Anonymous callers pass through untouched, because the
 * anonymous tool limits are a separate concern (server/usageLimits.ts).
 */
export async function requireVerified(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).session?.userId as string | undefined;
  if (!userId) return next();

  try {
    const state = await getVerificationState(userId);
    if (state.satisfied) return next();

    return res.status(403).json({
      error: "verification_required",
      message:
        state.missing.length === 2
          ? "Verify your email and phone number to use this tool."
          : state.missing[0] === "email"
            ? "Verify your email address to use this tool."
            : "Verify your phone number to use this tool.",
      missing: state.missing,
    });
  } catch (err) {
    // Fail OPEN. A verification lookup failing must not take the product down;
    // the cost of letting an unverified underwrite through is far lower than the
    // cost of blocking every verified user during a database blip.
    console.error("[verification] state check failed, allowing through:", err);
    return next();
  }
}

// ─── Email verification ──────────────────────────────────────────────────────

/**
 * Issue a fresh email-verification token and return the link to email.
 *
 * Outstanding tokens for the account are invalidated first, so a link from an
 * earlier request cannot be replayed after the user asks for a new one.
 */
export async function issueEmailVerificationLink(userId: string): Promise<string> {
  await db
    .update(verificationTokens)
    .set({ verifiedAt: new Date() })
    .where(
      and(
        eq(verificationTokens.userId, userId),
        eq(verificationTokens.type, "email"),
        isNull(verificationTokens.verifiedAt),
      ),
    );

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  await db.insert(verificationTokens).values({
    userId,
    type: "email",
    // Stored hashed, matching how passwordResetTokens are handled: a database
    // read must not hand someone a working verification link.
    token: tokenHash,
    expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
  });

  return `${appBaseUrl()}/verify-email?token=${rawToken}`;
}

export type EmailVerificationResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "expired" | "already_used" };

/** Consume an emailed token and mark the address verified. */
export async function consumeEmailVerificationToken(rawToken: string): Promise<EmailVerificationResult> {
  if (!/^[a-f0-9]{64}$/.test(rawToken)) return { ok: false, reason: "invalid" };

  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const [record] = await db
    .select()
    .from(verificationTokens)
    .where(and(eq(verificationTokens.token, tokenHash), eq(verificationTokens.type, "email")))
    .limit(1);

  if (!record) return { ok: false, reason: "invalid" };
  if (record.verifiedAt) return { ok: false, reason: "already_used" };
  if (record.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };

  await db
    .update(verificationTokens)
    .set({ verifiedAt: new Date() })
    .where(eq(verificationTokens.id, record.id));

  await markEmailVerified(record.userId);
  return { ok: true, userId: record.userId };
}

/**
 * Mark an address verified without a dedicated click.
 *
 * Used by the set-password and magic-link flows: both require the person to open
 * a link we emailed to that address, which is the same proof a verification email
 * would collect.
 */
export async function markEmailVerified(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

/** Rate-limit resends: at most one outstanding link per minute per account. */
export async function hasRecentEmailVerificationToken(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.userId, userId),
        eq(verificationTokens.type, "email"),
        gt(verificationTokens.createdAt, new Date(Date.now() - 60_000)),
      ),
    );
  return Number(row?.n || 0) > 0;
}
