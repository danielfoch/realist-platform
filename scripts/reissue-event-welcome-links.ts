/**
 * Re-issue welcome/set-password links to event users whose original links
 * were dead (tokens were stored raw while /api/auth/set-password looks up
 * the sha256 hash — fixed in the same PR as this script).
 *
 * Targets: users linked from realist_event_orders or realist_event_rsvps
 * who still have no password set (password_hash IS NULL) — i.e. accounts
 * auto-created at checkout/RSVP that nobody has ever been able to enter.
 *
 * Idempotent and safe to re-run: deletes the user's stale reset tokens,
 * issues one fresh hashed token, sends one email per user.
 *
 * Usage (Replit shell):
 *   npx tsx scripts/reissue-event-welcome-links.ts --dry-run   # list only
 *   npx tsx scripts/reissue-event-welcome-links.ts             # send
 */

import crypto from "crypto";
import { db } from "../server/db";
import { realistEventOrders, realistEventRsvps } from "../shared/schema";
import { users, passwordResetTokens } from "../shared/models/auth";
import { sendWelcomeAccountEmail } from "../server/resend";
import { eq, isNull, inArray, sql } from "drizzle-orm";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  // Distinct user ids touched by event checkout or RSVP
  const orderUsers = await db
    .selectDistinct({ userId: realistEventOrders.userId })
    .from(realistEventOrders)
    .where(sql`${realistEventOrders.userId} IS NOT NULL`);
  const rsvpUsers = await db
    .selectDistinct({ userId: realistEventRsvps.userId })
    .from(realistEventRsvps)
    .where(sql`${realistEventRsvps.userId} IS NOT NULL`);

  const ids = Array.from(
    new Set(
      [...orderUsers, ...rsvpUsers]
        .map((r) => r.userId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  if (ids.length === 0) {
    console.log("No event-linked users found. Nothing to do.");
    return;
  }

  // Only accounts that still cannot log in
  const affected = await db
    .select({ id: users.id, email: users.email, firstName: users.firstName })
    .from(users)
    .where(sql`${inArray(users.id, ids)} AND ${isNull(users.passwordHash)}`);

  console.log(
    `${affected.length} passwordless event user(s) of ${ids.length} event-linked total`,
  );

  if (DRY_RUN) {
    for (const u of affected) console.log(`  would reissue: ${u.email}`);
    return;
  }

  const baseUrl = (process.env.PUBLIC_BASE_URL || "https://realist.ca").replace(/\/$/, "");
  let sent = 0;
  let failed = 0;

  for (const u of affected) {
    try {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, u.id));
      await db.insert(passwordResetTokens).values({
        userId: u.id,
        token: tokenHash,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });

      await sendWelcomeAccountEmail({
        toEmail: u.email,
        firstName: u.firstName || "there",
        setupLink: `${baseUrl}/set-password?token=${rawToken}`,
        leadSource: "Realist Events (link re-issue)",
      });
      sent++;
      console.log(`  reissued: ${u.email}`);
    } catch (err) {
      failed++;
      console.error(`  FAILED ${u.email}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`Done. Sent ${sent}, failed ${failed}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
