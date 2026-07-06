/**
 * Single producer entry point for email triggers. Every site that used to
 * write an email_triggers row (deal-desk submission routes, the deal-desk
 * behavioural sweep, the watchlist alert sweep) calls queueEmailTrigger here.
 *
 * Transport (EMAIL_TRIGGER_TRANSPORT env, resolved per call):
 *   - 'queue' (default): write a notification_queue row
 *     (channel='email_resend', templateKey=trigger type). The
 *     notification-queue drain in server/notifications.ts delivers it via the
 *     shared trigger sender — one transport for all outbound email.
 *   - 'legacy': write an email_triggers row exactly as before — the
 *     no-deploy rollback lever. The legacy 30s worker keeps running either
 *     way, so flipping back requires nothing else.
 *
 * Triggers without a userId always ride the legacy pipe: notification_queue
 * requires a NOT NULL recipient_user_id (FK to users), which anonymous
 * deal-desk submissions can't satisfy without a schema change.
 *
 * Dedupe (preserves uq_email_triggers_pending_user_type semantics — at most
 * one PENDING row per (user, type), a new one allowed after the previous row
 * leaves 'pending'): the insert is INSERT ... SELECT ... WHERE NOT EXISTS a
 * pending row for the same (user, type) on EITHER transport (so a pre-deploy
 * legacy pending row still blocks a queue duplicate during soak), with a
 * millisecond-stamped dedupeKey (see shared/emailTriggerTransport.ts) so the
 * forever-unique notification_queue.dedupe_key index never blocks a later
 * legitimate re-send and same-instant races still collapse to one row.
 */

import { sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { emailTriggers } from "@shared/schema";
import { buildEmailForTrigger } from "@shared/emailTriggerTemplates";
import {
  emailTriggerDedupeKey,
  emailTriggerScheduledFor,
  isEmailTriggerTemplateKey,
  resolveEmailTriggerTransport,
  TEAM_AUDIENCE_TRIGGER_TYPES,
  type EmailTriggerTransport,
} from "@shared/emailTriggerTransport";

export function emailTriggerTransport(): EmailTriggerTransport {
  return resolveEmailTriggerTransport(process.env.EMAIL_TRIGGER_TRANSPORT);
}

export interface QueueEmailTriggerInput {
  triggerType: string;
  userId?: string | null;
  leadId?: string | null;
  opportunityId?: string | null;
  payload?: Record<string, unknown> | null;
  /**
   * Legacy-transport conflict behavior, kept per historical call site:
   * 'skip' = onConflictDoNothing (deal-desk + watchlist sweeps), 'throw' =
   * plain insert that surfaces a pending-duplicate constraint violation (the
   * old storage.createEmailTrigger sites). The queue transport always skips
   * duplicates silently.
   */
  onDuplicate?: "skip" | "throw";
}

export interface QueueEmailTriggerResult {
  transport: EmailTriggerTransport;
  /** false when a pending duplicate (or dedupe-key collision) absorbed the enqueue. */
  enqueued: boolean;
}

export async function queueEmailTrigger(input: QueueEmailTriggerInput): Promise<QueueEmailTriggerResult> {
  const { triggerType } = input;
  const userId = input.userId ?? null;
  const leadId = input.leadId ?? null;
  const opportunityId = input.opportunityId ?? null;
  const payload = (input.payload ?? {}) as Record<string, unknown>;

  // Unknown types fail loudly HERE (the legacy worker used to be the loud
  // failure point): an unrecognized templateKey would sail past the drain's
  // intercept and ride the GHL-webhook/sheet path — an email payload posted
  // to a CRM webhook and marked sent with no email.
  if (!isEmailTriggerTemplateKey(triggerType)) {
    throw new Error(`queueEmailTrigger: unknown trigger type "${triggerType}"`);
  }

  const transport = emailTriggerTransport();

  // Team-audience triggers ALWAYS ride legacy: a notification_queue row
  // carries recipient_user_id = the LEAD, and queue rows surface in that
  // user's in-app inbox (PR #131) — a lead must never see ops copy about
  // themselves ("HOT LEAD (78pts)", SLA nags). The legacy-removal follow-up
  // needs a team-notification design (nullable recipient or audience column)
  // before these can move.
  if (transport === "legacy" || !userId || TEAM_AUDIENCE_TRIGGER_TYPES.has(triggerType)) {
    // Cross-transport guard (the rollback lever must not double-send): if a
    // queue row for this (user, type) is still pending — e.g. the transport
    // was just flipped to 'legacy' while the drain holds a 24h-delayed row —
    // enqueueing a legacy duplicate would deliver both. Best-effort pre-check
    // (same non-atomicity caveat as the queue path; the window is the
    // incident-response case, not steady state).
    if (userId && (await hasPendingQueueTrigger(userId, triggerType))) {
      return { transport: "legacy", enqueued: false };
    }
    const base = db.insert(emailTriggers).values({
      leadId,
      userId,
      opportunityId,
      triggerType,
      payload,
      status: "pending",
    });
    if (input.onDuplicate === "throw") {
      await base.returning({ id: emailTriggers.id });
      return { transport: "legacy", enqueued: true };
    }
    const inserted = await base.onConflictDoNothing().returning({ id: emailTriggers.id });
    return { transport: "legacy", enqueued: inserted.length > 0 };
  }

  // Cheap pre-check so the every-cycle sweeps don't mint a notification_events
  // row per duplicate attempt; the insert below re-checks atomically.
  if (await hasPendingTrigger(userId, triggerType)) {
    return { transport: "queue", enqueued: false };
  }

  // Inbox-renderable content (PR #131's renderNotification reads the
  // GHL-payload fields subjectLine/previewText): best-effort subject render
  // from the un-enriched payload.
  let subjectLine: string | undefined;
  try {
    subjectLine = buildEmailForTrigger(triggerType, payload as Record<string, any>).subject;
  } catch {
    subjectLine = undefined;
  }

  // notification_queue.notification_event_id is NOT NULL — follow the other
  // producers' pattern (enqueueForRecipients, monthlyWinnerEmail,
  // podcastDigest) and mint one notification_events row per enqueue.
  const event = await storage.createNotificationEvent({
    eventType: triggerType,
    userId,
    payloadJson: { source: "email_trigger", triggerType, leadId, opportunityId, payload },
  });

  const now = new Date();
  const dedupeKey = emailTriggerDedupeKey(triggerType, userId, now);
  const scheduledFor = emailTriggerScheduledFor(triggerType, now);
  const payloadJson: Record<string, unknown> = {
    ...payload,
    ...(subjectLine ? { subjectLine, title: subjectLine } : {}),
    leadId: leadId ?? (payload.leadId as string | undefined) ?? null,
    opportunityId: opportunityId ?? (payload.opportunityId as string | undefined) ?? null,
  };

  const inserted = await db.execute(sql`
    INSERT INTO notification_queue
      (recipient_user_id, notification_event_id, channel, template_key, dedupe_key, status, scheduled_for, payload_json)
    SELECT ${userId}, ${event.id}, 'email_resend', ${triggerType}, ${dedupeKey}, 'pending', ${scheduledFor}, ${JSON.stringify(payloadJson)}::jsonb
    WHERE NOT EXISTS (
      SELECT 1 FROM notification_queue
      WHERE channel = 'email_resend'
        AND template_key = ${triggerType}
        AND recipient_user_id = ${userId}
        AND status = 'pending'
    )
    AND NOT EXISTS (
      SELECT 1 FROM email_triggers
      WHERE user_id = ${userId}
        AND trigger_type = ${triggerType}
        AND status = 'pending'
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  `);

  return { transport: "queue", enqueued: (inserted.rowCount ?? inserted.rows.length) > 0 };
}

async function hasPendingQueueTrigger(userId: string, triggerType: string): Promise<boolean> {
  const existing = await db.execute(sql`
    SELECT 1 FROM notification_queue
    WHERE channel = 'email_resend'
      AND template_key = ${triggerType}
      AND recipient_user_id = ${userId}
      AND status = 'pending'
    LIMIT 1
  `);
  return existing.rows.length > 0;
}

async function hasPendingTrigger(userId: string, triggerType: string): Promise<boolean> {
  const existing = await db.execute(sql`
    SELECT 1 FROM notification_queue
    WHERE channel = 'email_resend'
      AND template_key = ${triggerType}
      AND recipient_user_id = ${userId}
      AND status = 'pending'
    UNION ALL
    SELECT 1 FROM email_triggers
    WHERE user_id = ${userId}
      AND trigger_type = ${triggerType}
      AND status = 'pending'
    LIMIT 1
  `);
  return existing.rows.length > 0;
}
