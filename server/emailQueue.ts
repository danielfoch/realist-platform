/**
 * Legacy email_triggers worker.
 *
 * Transport consolidation (see server/emailTriggerProducer.ts): producers now
 * default to writing notification_queue rows (channel='email_resend') that
 * the notification drain in server/notifications.ts delivers. This worker
 * KEEPS RUNNING unconditionally so it drains any pre-deploy email_triggers
 * rows — and everything written while EMAIL_TRIGGER_TRANSPORT=legacy or by
 * userless triggers — then no-ops when the table is empty. Removing it is a
 * follow-up PR after the queue transport has soaked.
 *
 * The template builders live in shared/emailTriggerTemplates.ts and the
 * send-time engine (recipients, consent, governor, Resend) in
 * server/emailTriggerSender.ts; both are re-exported here so existing
 * importers (server/routes/dealDesk.ts admin preview/test-send,
 * server/watchlists.ts types) keep working unchanged.
 */

import { sql } from "drizzle-orm";
import { storage } from "./storage";
import { getResendClient } from "./resend";
import { db } from "./db";
import { buildEmailForTrigger } from "@shared/emailTriggerTemplates";
import { sendEmailTrigger, type TriggerLike } from "./emailTriggerSender";
import { type EmailTrigger } from "@shared/schema";

export {
  buildAbandonedUnderwritingNudge,
  buildDealSubmittedConfirmation,
  buildEmailForTrigger,
  buildFinancingFollowup,
  buildFinancingInterestNudge,
  buildHotLeadFollowup,
  buildLostReasonNurture,
  buildSavedDealNoSubmitNudge,
  buildSavedSearchMatchesEmail,
  buildSlaBreachNag,
  buildWarmLeadFollowup,
  buildWarmLeadUserNudge,
  buildWatchlistPriceChangeEmail,
  getSampleTriggerPayload,
  EMAIL_TRIGGER_TYPES,
  type EmailTriggerType,
  type SavedSearchMatchesItem,
  type WatchlistPriceChangeItem,
} from "@shared/emailTriggerTemplates";

/**
 * Send a one-off test copy of a rendered trigger email to an explicit
 * recipient (the requesting admin). Does not touch the email_triggers
 * queue. Throws on Resend errors so the caller can surface them.
 */
export async function sendTestTriggerEmail(
  triggerType: string,
  payload: Record<string, any>,
  to: string,
): Promise<{ subject: string }> {
  const { subject, html } = buildEmailForTrigger(triggerType, payload);
  const { client, fromEmail } = await getResendClient();
  const testSubject = `[TEST] ${subject}`;
  const result = await client.emails.send({ from: fromEmail, to, subject: testSubject, html });
  if (result.error) {
    const errMsg = typeof result.error === "string" ? result.error : JSON.stringify(result.error);
    throw new Error(errMsg);
  }
  return { subject: testSubject };
}

function toTriggerLike(trigger: EmailTrigger): TriggerLike {
  return {
    id: trigger.id,
    triggerType: trigger.triggerType,
    payload: (trigger.payload as Record<string, any>) || {},
    userId: trigger.userId,
    leadId: trigger.leadId,
    opportunityId: trigger.opportunityId,
    createdAt: trigger.createdAt,
  };
}

export async function processPendingEmailTriggers(): Promise<{ processed: number; sent: number; failed: number; skipped: number; cancelled: number }> {
  const pending = await storage.listPendingEmailTriggers();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let cancelled = 0;

  for (const trigger of pending) {
    const outcome = await sendEmailTrigger(toTriggerLike(trigger));
    switch (outcome.status) {
      case "not_due":
        skipped++;
        break;
      case "sent":
        sent++;
        await storage.updateEmailTriggerStatus(trigger.id, "sent", outcome.sentAt);
        break;
      case "failed":
        failed++;
        await storage.updateEmailTriggerStatus(trigger.id, "failed", undefined, outcome.reason);
        break;
      case "cancelled":
        cancelled++;
        await storage.updateEmailTriggerStatus(trigger.id, "cancelled", undefined, outcome.reason);
        break;
    }
  }

  return { processed: pending.length, sent, failed, skipped, cancelled };
}

/**
 * Boot-time guard for the pending-trigger dedupe index (see emailTriggers in
 * shared/schema.ts). queueEmailTrigger's onConflictDoNothing is a silent no-op
 * without this index. Creating a unique index fails if prod already holds
 * duplicate pending rows, so we pre-dedupe (keep the newest row per
 * (user, type) pair) before creating it idempotently. Mirrors the
 * ensureRetentionTables / ensureAppTables boot-ensure pattern.
 */
export async function ensureEmailTriggerDedupe(): Promise<void> {
  try {
    await db.execute(sql`
      DELETE FROM email_triggers t USING email_triggers k
      WHERE t.status = 'pending' AND k.status = 'pending'
        AND t.user_id = k.user_id
        AND t.trigger_type = k.trigger_type
        AND (t.created_at < k.created_at OR (t.created_at = k.created_at AND t.id < k.id))
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_email_triggers_pending_user_type
      ON email_triggers (user_id, trigger_type) WHERE status = 'pending'
    `);
  } catch (err: any) {
    console.error("[email-queue] failed to ensure pending-trigger dedupe index:", err?.message || err);
  }
}

export function startEmailQueueWorker(intervalMs = 30_000): NodeJS.Timeout {
  async function warnIfUnconfigured() {
    try {
      const dbEmail = await storage.getAppSetting("deal_desk_notify_email").catch(() => null);
      const hasEmail =
        (dbEmail && dbEmail.trim().length > 0) ||
        process.env.DEAL_DESK_NOTIFY_EMAIL ||
        process.env.PODCAST_NOTIFY_EMAIL ||
        process.env.NOTIFY_CC_EMAIL;
      if (!hasEmail) {
        console.warn(
          "[email-queue] WARNING: No deal desk notification email is configured. " +
          "Set DEAL_DESK_NOTIFY_EMAIL or configure it in Admin > Deal Desk > Settings. " +
          "Team alerts (hot leads, warm leads, financing requests) will be silently dropped."
        );
      } else {
        const source = dbEmail ? "admin settings (DB)" : process.env.DEAL_DESK_NOTIFY_EMAIL ? "DEAL_DESK_NOTIFY_EMAIL env" : "legacy PODCAST_NOTIFY_EMAIL/NOTIFY_CC_EMAIL env";
        console.log(`[email-queue] Team notification email configured via ${source}.`);
      }
    } catch {
    }
  }

  async function runCycle() {
    try {
      const result = await processPendingEmailTriggers();
      if (result.sent > 0 || result.failed > 0) {
        console.log(`[email-queue] Cycle complete: sent=${result.sent}, failed=${result.failed}, skipped=${result.skipped}`);
      }
    } catch (err: any) {
      console.error("[email-queue] Worker cycle error:", err?.message || err);
    }
  }

  warnIfUnconfigured();
  ensureEmailTriggerDedupe().then(() => runCycle());
  return setInterval(runCycle, intervalMs);
}
