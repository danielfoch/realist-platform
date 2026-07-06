/**
 * Pure decision helpers for the email-trigger transport consolidation:
 * which pipe a trigger rides (notification_queue vs legacy email_triggers),
 * the notification_queue dedupe key, and the delivery schedule.
 *
 * Kept side-effect free so shared/emailTriggerTransport.test.ts can pin the
 * semantics; the DB work lives in server/emailTriggerProducer.ts.
 */

import { EMAIL_TRIGGER_TYPES, type EmailTriggerType } from "./emailTriggerTemplates";

export type EmailTriggerTransport = "queue" | "legacy";

/**
 * EMAIL_TRIGGER_TRANSPORT env switch. Default (unset/anything else) is the
 * new 'queue' path; 'legacy' is the no-deploy rollback lever that reverts
 * producers to writing email_triggers rows exactly as before.
 */
export function resolveEmailTriggerTransport(raw: string | undefined | null): EmailTriggerTransport {
  return raw?.trim().toLowerCase() === "legacy" ? "legacy" : "queue";
}

const TRIGGER_TYPE_SET: ReadonlySet<string> = new Set(EMAIL_TRIGGER_TYPES);

/**
 * True when a notification_queue templateKey is a migrated email-trigger
 * type. The drain in server/notifications.ts routes ONLY these
 * channel='email_resend' rows through the trigger sender; every other row
 * (e.g. monthly_leaderboard_winner, podcast_digest — whose producers send
 * via Resend themselves) keeps its existing drain behavior untouched.
 */
export function isEmailTriggerTemplateKey(templateKey: string): templateKey is EmailTriggerType {
  return TRIGGER_TYPE_SET.has(templateKey);
}

/**
 * Dedupe key for trigger-originated notification_queue rows.
 *
 * notification_queue.dedupe_key is UNIQUE forever (rows are never deleted, so
 * a consumed key can never be reused), while the legacy semantics we must
 * preserve are the uq_email_triggers_pending_user_type partial index: at most
 * one PENDING row per (user, type), with a NEW row allowed as soon as the
 * previous one leaves 'pending'. A key without a time component would
 * therefore block every future email of the same type once the first one
 * sent. Instead:
 *
 *   - the "one pending per (user, type)" rule is DB-enforced by the partial
 *     unique index uq_notification_queue_pending_trigger (shared/schema.ts:
 *     (recipient_user_id, template_key) WHERE status='pending' AND dedupe_key
 *     LIKE 'email_trigger:%') — the true replacement for the legacy partial
 *     index; the producer's INSERT ... WHERE NOT EXISTS is only a cheap
 *     cross-transport pre-filter (NOT EXISTS under READ COMMITTED is NOT
 *     atomic across concurrent statements), and
 *   - the key carries a millisecond timestamp so each new generation gets a
 *     fresh, never-recycled key once the previous row leaves 'pending'.
 */
export function emailTriggerDedupeKey(triggerType: string, userId: string, at: Date = new Date()): string {
  return `email_trigger:${triggerType}:${userId}:${at.getTime()}`;
}

/** Trigger types the legacy worker only delivered 24h after enqueue. */
const DELAYED_TRIGGER_TYPES: ReadonlySet<string> = new Set([
  "warm_lead_24h_followup",
  "warm_lead_user_nudge",
]);

/**
 * scheduledFor for a trigger-originated queue row. Delivery gating itself
 * re-checks age at send time (same as the legacy worker), but scheduling the
 * 24h types in the future keeps them behind due work in the drain's
 * scheduled_for ordering instead of clogging the head of the queue.
 */
export function emailTriggerScheduledFor(triggerType: string, now: Date = new Date()): Date {
  return DELAYED_TRIGGER_TYPES.has(triggerType)
    ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
    : now;
}

/**
 * Trigger types whose emails go to the TEAM (deal-desk ops), not the lead.
 * These must never ride the notification_queue transport: queue rows carry
 * recipient_user_id = the LEAD's user id, and any queue row is visible in
 * that user's in-app inbox (PR #131) — a lead must not see "HOT LEAD (78pts)"
 * ops copy or SLA nags about themselves. Kept as a static set so the
 * producer can route without rendering; shared/emailTriggerTemplates.test.ts
 * pins it against buildEmailForTrigger's own audience field for all types.
 */
export const TEAM_AUDIENCE_TRIGGER_TYPES: ReadonlySet<string> = new Set([
  "hot_lead_immediate_followup",
  "warm_lead_24h_followup",
  "financing_interest_followup",
  "sla_breach_nag",
  "lost_reason_nurture",
]);
