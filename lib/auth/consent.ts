import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { emailConsent, users } from "@/lib/db/schema";

/**
 * Record a marketing-consent decision: append to the CASL ledger (never
 * update it) and mirror the current state onto the user row for cheap reads.
 */
export async function recordConsent(userId: string, granted: boolean, source: string): Promise<void> {
  const db = getDb();
  const now = new Date();
  await db.insert(emailConsent).values({
    userId,
    channel: "email",
    status: granted ? "granted" : "revoked",
    source: source.slice(0, 100),
    createdAt: now,
  });
  await db
    .update(users)
    .set({
      consentMarketing: granted,
      consentAt: now,
      consentSource: source.slice(0, 100),
      updatedAt: now,
    })
    .where(eq(users.id, userId));
}
