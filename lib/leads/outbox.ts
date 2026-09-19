import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { leadDeliveries, leads, type Lead, type LeadDestination } from "@/lib/db/schema";
import { deliverToGhl } from "./ghl";
import { deliverToKeypr } from "./keypr";
import { deliverToTeam } from "./teamEmail";

/**
 * Delivery with a memory. A lead is tried the moment it's captured and then on
 * a schedule until it lands: 1 min, 5 min, 30 min, 2 h, 12 h. A destination
 * that has no credentials yet costs no attempts — it waits, so nothing
 * captured before the CRM key is added is lost.
 */

export type DeliveryResult =
  | { outcome: "sent"; progress?: Record<string, unknown>; externalId?: string | null }
  | { outcome: "retry"; progress?: Record<string, unknown>; error: string }
  | { outcome: "failed"; progress?: Record<string, unknown>; error: string }
  | { outcome: "skipped" }
  | { outcome: "not_configured" };

const BACKOFF_MS = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000];
export const MAX_ATTEMPTS = BACKOFF_MS.length + 1;
const UNCONFIGURED_RECHECK_MS = 30 * 60_000;
/** How long a claimed row is off-limits to other workers; outlives any one attempt. */
const LEASE = sql`interval '10 minutes'`;

/** Delay before the next try, given how many have been made. Null = give up. */
export function retryDelayMs(attemptsMade: number): number | null {
  if (attemptsMade >= MAX_ATTEMPTS) return null;
  return BACKOFF_MS[Math.min(Math.max(attemptsMade - 1, 0), BACKOFF_MS.length - 1)];
}

const DELIVERERS: Record<LeadDestination, (lead: Lead, progress: Record<string, unknown>) => Promise<DeliveryResult>> = {
  ghl: deliverToGhl,
  team_email: (lead) => deliverToTeam(lead),
  keypr: (lead) => deliverToKeypr(lead),
};

interface ClaimedRow {
  id: string;
  lead_id: string;
  destination: LeadDestination;
  attempts: number;
  progress: Record<string, unknown> | null;
}

export interface DeliverySummary {
  claimed: number;
  sent: number;
  retrying: number;
  failed: number;
  skipped: number;
  waiting: number;
}

/**
 * Work the outbox: everything due, or just one lead's rows. Claiming is a
 * single statement with SKIP LOCKED, so the inline attempt and the cron can
 * never both send the same row.
 */
export async function deliverDue(options: { leadId?: string; limit?: number } = {}): Promise<DeliverySummary> {
  const db = getDb();
  const limit = options.limit ?? 25;
  const onlyLead = options.leadId ? sql`AND lead_id = ${options.leadId}` : sql``;
  const claimed = await db.execute(sql`
    UPDATE lead_deliveries AS d
    SET attempts = d.attempts + 1, next_attempt_at = (now() AT TIME ZONE 'utc') + ${LEASE}
    WHERE d.id IN (
      SELECT id FROM lead_deliveries
      WHERE status = 'pending' AND next_attempt_at <= (now() AT TIME ZONE 'utc') ${onlyLead}
      ORDER BY next_attempt_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING d.id, d.lead_id, d.destination, d.attempts, d.progress
  `);
  const rows = claimed.rows as unknown as ClaimedRow[];
  const summary: DeliverySummary = { claimed: rows.length, sent: 0, retrying: 0, failed: 0, skipped: 0, waiting: 0 };

  for (const row of rows) {
    const [lead] = await db.select().from(leads).where(eq(leads.id, row.lead_id)).limit(1);
    let result: DeliveryResult;
    try {
      result = lead
        ? await DELIVERERS[row.destination](lead, row.progress ?? {})
        : { outcome: "failed", error: "lead no longer exists" };
    } catch (error) {
      result = { outcome: "retry", error: (error as Error).message };
    }

    const now = new Date();
    const where = eq(leadDeliveries.id, row.id);
    if (result.outcome === "sent") {
      summary.sent += 1;
      await db
        .update(leadDeliveries)
        .set({ status: "sent", deliveredAt: now, lastError: null, progress: result.progress ?? row.progress, externalId: result.externalId ?? null })
        .where(where);
    } else if (result.outcome === "skipped") {
      summary.skipped += 1;
      await db.update(leadDeliveries).set({ status: "skipped", lastError: null }).where(where);
    } else if (result.outcome === "not_configured") {
      summary.waiting += 1;
      await db
        .update(leadDeliveries)
        .set({ attempts: row.attempts - 1, nextAttemptAt: new Date(now.getTime() + UNCONFIGURED_RECHECK_MS), lastError: "destination not configured" })
        .where(where);
    } else {
      const delay = result.outcome === "retry" ? retryDelayMs(row.attempts) : null;
      const error = result.error.slice(0, 500);
      if (delay === null) {
        summary.failed += 1;
        console.error(`[leads] ${row.destination} delivery failed for lead ${row.lead_id}: ${error}`);
        await db.update(leadDeliveries).set({ status: "failed", lastError: error, progress: result.progress ?? row.progress }).where(where);
      } else {
        summary.retrying += 1;
        await db
          .update(leadDeliveries)
          .set({ nextAttemptAt: new Date(now.getTime() + delay), lastError: error, progress: result.progress ?? row.progress })
          .where(where);
      }
    }
  }
  return summary;
}

/** Put a failed delivery back in line (after fixing a credential, say). */
export async function requeueFailed(destination?: LeadDestination): Promise<number> {
  const condition = destination
    ? and(eq(leadDeliveries.status, "failed"), eq(leadDeliveries.destination, destination))
    : eq(leadDeliveries.status, "failed");
  const rows = await getDb()
    .update(leadDeliveries)
    .set({ status: "pending", attempts: 0, nextAttemptAt: new Date() })
    .where(condition)
    .returning({ id: leadDeliveries.id });
  return rows.length;
}
