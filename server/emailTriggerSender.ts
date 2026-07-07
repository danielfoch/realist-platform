/**
 * Send-time engine for email triggers — the per-type recipient resolution,
 * consent gates, governor calls, enrichment, and Resend delivery that used to
 * live inline in server/emailQueue.ts's processEmailTrigger. Extracted so the
 * SAME logic serves both transports:
 *
 *   - the legacy email_triggers worker (server/emailQueue.ts), which keeps
 *     running to drain pre-deploy rows, and
 *   - the notification_queue drain (server/notifications.ts) for
 *     channel='email_resend' rows whose templateKey is a trigger type.
 *
 * Callers own the row-status bookkeeping: this module returns an outcome and
 * each worker maps it onto its own table (email_triggers vs
 * notification_queue). All governance is unchanged and applied at SEND time:
 * user-facing marketing types still pass through getConsentedUser +
 * governMarketingSend with the same streams and per-row dedupe keys as before.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { storage } from "./storage";
import { getResendClient } from "./resend";
import { db } from "./db";
import { governMarketingSend } from "./emailGovernor";
import { analyses, propertyAnalyses, users } from "@shared/schema";
import {
  buildAbandonedUnderwritingNudge,
  buildDealSubmittedConfirmation,
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
} from "@shared/emailTriggerTemplates";

async function getTeamNotifyEmails(): Promise<string[]> {
  // Instant per-lead admin alerts are OPT-IN now — the team gets a weekly
  // CRM summary instead (server/adminWeeklySummary.ts). Set
  // ADMIN_INSTANT_LEAD_ALERTS=true to restore real-time alert emails.
  if (process.env.ADMIN_INSTANT_LEAD_ALERTS !== "true") return [];

  const emails: string[] = [];

  const dbEmail = await storage.getAppSetting("deal_desk_notify_email").catch(() => null);
  if (dbEmail) {
    emails.push(...dbEmail.split(",").map(e => e.trim()).filter(Boolean));
    return emails;
  }

  if (process.env.DEAL_DESK_NOTIFY_EMAIL) {
    emails.push(...process.env.DEAL_DESK_NOTIFY_EMAIL.split(",").map(e => e.trim()).filter(Boolean));
    return emails;
  }

  if (process.env.PODCAST_NOTIFY_EMAIL) emails.push(process.env.PODCAST_NOTIFY_EMAIL);
  if (process.env.NOTIFY_CC_EMAIL) emails.push(process.env.NOTIFY_CC_EMAIL);
  return emails;
}

/**
 * Internal ops alerts (SLA breach nags). Unlike getTeamNotifyEmails this is
 * NOT gated behind ADMIN_INSTANT_LEAD_ALERTS — an SLA breach means a hot lead
 * is going cold right now. Mirrors adminWeeklySummary's recipients().
 */
async function getAdminNotifyEmails(): Promise<string[]> {
  const dbEmail = await storage.getAppSetting("deal_desk_notify_email").catch(() => null);
  const raw = dbEmail || process.env.DEAL_DESK_NOTIFY_EMAIL || process.env.PODCAST_NOTIFY_EMAIL || "";
  return raw.split(",").map(e => e.trim()).filter(Boolean);
}

async function getDealDeskNotifyEmail(): Promise<string> {
  const dbEmail = await storage.getAppSetting("deal_desk_notify_email").catch(() => null);
  if (dbEmail) return dbEmail.split(",")[0].trim();
  return process.env.DEAL_DESK_NOTIFY_EMAIL || process.env.PODCAST_NOTIFY_EMAIL || "";
}

interface ConsentedUser {
  id: string;
  email: string;
  firstName: string | null;
}

/**
 * Consent gate for sweep-generated user-facing nudges — same rule as
 * retentionEmails.optedInUsers: digest opt-in flag AND latest email_consent
 * ledger row (CASL, append-only) isn't 'revoked'.
 */
async function getConsentedUser(userId: string): Promise<ConsentedUser | null> {
  const rows = await db
    .select({ id: users.id, email: users.email, firstName: users.firstName })
    .from(users)
    .where(and(
      eq(users.id, userId),
      eq(users.emailDigestOptIn, true),
      sql`COALESCE((
        SELECT ec.status FROM email_consent ec
        WHERE ec.user_id = ${users.id} AND ec.channel = 'email'
        ORDER BY ec.created_at DESC
        LIMIT 1
      ), 'granted') <> 'revoked'`,
    ))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Best-effort reference to the user's most recent deal so the nudge can name
 * it ("reference the specific deal"). Checks the deal-analyzer table first,
 * then listing underwriting; null → caller falls back to generic copy.
 */
async function getLatestDealRef(userId: string): Promise<string | null> {
  const [a] = await db
    .select({ address: analyses.address, city: analyses.city })
    .from(analyses)
    .where(eq(analyses.userId, userId))
    .orderBy(desc(analyses.createdAt))
    .limit(1);
  if (a?.address) return a.address;
  const [p] = await db
    .select({ title: propertyAnalyses.title, city: propertyAnalyses.city })
    .from(propertyAnalyses)
    .where(and(eq(propertyAnalyses.userId, userId), eq(propertyAnalyses.isDeleted, false)))
    .orderBy(desc(propertyAnalyses.createdAt))
    .limit(1);
  return p?.title || p?.city || a?.city || null;
}

const NUDGE_SUPPRESS_STATUSES = new Set([
  "contacted",
  "qualified",
  "booked_call",
  "preapproval_started",
  "buyer_agency_signed",
  "showing_booked",
  "offer_submitted",
  "won",
  "booked",
  "closed",
  "lost",
]);

/**
 * Transport-agnostic view of one queued trigger. `id` is the queue row's own
 * id (email_triggers.id or notification_queue.id) — it feeds the governor
 * dedupe key exactly as the legacy worker's trigger.id did, so each queued
 * email still consumes one cap slot.
 */
export interface TriggerLike {
  id: string;
  triggerType: string;
  payload: Record<string, any> | null;
  userId: string | null;
  leadId: string | null;
  opportunityId: string | null;
  createdAt: Date;
}

export type TriggerSendOutcome =
  | { status: "sent"; sentAt: Date }
  | { status: "failed"; reason: string }
  | { status: "cancelled"; reason: string }
  | { status: "not_due" };

/**
 * Attempt delivery of one trigger. Behavior is a 1:1 port of the legacy
 * processEmailTrigger: same 24h gating, same suppress/cancel checks, same
 * consent + governor gates per type, same Resend call, same single-attempt
 * failure semantics (no retries — a failure is terminal for the row).
 */
export async function sendEmailTrigger(trigger: TriggerLike): Promise<TriggerSendOutcome> {
  const payload = (trigger.payload as Record<string, any>) || {};
  const now = new Date();

  if (trigger.triggerType === "warm_lead_24h_followup" || trigger.triggerType === "warm_lead_user_nudge") {
    const createdAt = new Date(trigger.createdAt);
    const hoursElapsed = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursElapsed < 24) {
      return { status: "not_due" };
    }
  }

  if (trigger.triggerType === "warm_lead_user_nudge" && trigger.opportunityId) {
    try {
      const opportunity = await storage.getOpportunityById(trigger.opportunityId);
      if (opportunity && NUDGE_SUPPRESS_STATUSES.has(opportunity.status)) {
        console.log(`[email-queue] Cancelled trigger ${trigger.id} (warm_lead_user_nudge) — opportunity ${trigger.opportunityId} already moved to "${opportunity.status}"`);
        return { status: "cancelled", reason: `Lead already moved to "${opportunity.status}" before nudge fired` };
      }
    } catch (err: any) {
      console.error(`[email-queue] Could not check opportunity status for trigger ${trigger.id}:`, err?.message || String(err));
    }
  }

  try {
    const { client, fromEmail } = await getResendClient();

    let result: { data: any; error: any } | null = null;

    switch (trigger.triggerType) {
      case "deal_submitted_confirmation": {
        if (!payload.email) {
          return { status: "failed", reason: "No recipient email in payload" };
        }
        const { subject, html, to } = buildDealSubmittedConfirmation(payload);
        result = await client.emails.send({ from: fromEmail, to, subject, html });
        break;
      }

      case "hot_lead_immediate_followup": {
        const recipients = await getTeamNotifyEmails();
        if (recipients.length === 0) {
          return { status: "failed", reason: "No team notify emails configured" };
        }
        const { subject, html } = buildHotLeadFollowup(payload);
        result = await client.emails.send({ from: fromEmail, to: recipients, subject, html });
        break;
      }

      case "warm_lead_24h_followup": {
        const recipients = await getTeamNotifyEmails();
        if (recipients.length === 0) {
          return { status: "failed", reason: "No team notify emails configured" };
        }
        const { subject, html } = buildWarmLeadFollowup(payload);
        result = await client.emails.send({ from: fromEmail, to: recipients, subject, html });
        break;
      }

      case "warm_lead_user_nudge": {
        if (!payload.email) {
          return { status: "failed", reason: "No recipient email in payload" };
        }
        const { subject, html, to } = buildWarmLeadUserNudge(payload);
        result = await client.emails.send({ from: fromEmail, to, subject, html });
        break;
      }

      case "financing_interest_followup": {
        const recipients = await getTeamNotifyEmails();
        if (recipients.length === 0) {
          return { status: "failed", reason: "No team notify emails configured" };
        }
        const { subject, html } = buildFinancingFollowup(payload);
        result = await client.emails.send({ from: fromEmail, to: recipients, subject, html });
        break;
      }

      case "lost_reason_nurture": {
        let leadInfo: { name: string; email: string } | null = null;
        if (trigger.leadId) {
          try {
            const lead = await storage.getLead(trigger.leadId);
            if (lead) leadInfo = { name: lead.name, email: lead.email };
          } catch {
          }
        }
        const dealDeskEmail = await getDealDeskNotifyEmail();
        const { subject, html, to } = buildLostReasonNurture(payload, leadInfo, dealDeskEmail);
        if (to.length === 0) {
          return { status: "failed", reason: "No recipients for lost_reason_nurture" };
        }
        result = await client.emails.send({ from: fromEmail, to, subject, html });
        break;
      }

      case "sla_breach_nag": {
        // INTERNAL: nag the assignee/admin — not the user.
        const recipients = await getAdminNotifyEmails();
        if (recipients.length === 0) {
          return { status: "failed", reason: "No admin notify emails configured" };
        }
        const enriched: Record<string, any> = { ...payload };
        if (trigger.userId) {
          const [lead] = await db
            .select({ email: users.email, firstName: users.firstName, lastName: users.lastName, phone: users.phone })
            .from(users)
            .where(eq(users.id, trigger.userId))
            .limit(1);
          if (lead) {
            enriched.name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.email;
            enriched.email = lead.email;
            enriched.phone = lead.phone;
          }
        }
        if (trigger.opportunityId) {
          try {
            const opp = await storage.getOpportunityById(trigger.opportunityId);
            if (opp) {
              enriched.address = opp.propertyAddress;
              enriched.market = opp.market;
              enriched.intentScore = opp.intentScore;
              enriched.assigned_to = enriched.assigned_to || opp.assignedTo;
              // Contacted between the sweep and now? Stand down.
              if (opp.firstContactedAt) {
                return { status: "cancelled", reason: "Lead was contacted before the nag fired" };
              }
            }
          } catch {
          }
        }
        const { subject, html } = buildSlaBreachNag(enriched);
        result = await client.emails.send({ from: fromEmail, to: recipients, subject, html });
        break;
      }

      case "watchlist_price_change":
      case "saved_search_matches": {
        // User-requested watchlist alerts. Same CASL consent gate as the
        // behavioural nudges (digest opt-in AND consent ledger not revoked),
        // plus the notification_preferences check the sweep already applied
        // at enqueue time. Unsubscribe link included via wrapNudge.
        if (!trigger.userId) {
          return { status: "failed", reason: "No userId on trigger" };
        }
        const user = await getConsentedUser(trigger.userId);
        if (!user) {
          return { status: "cancelled", reason: "User not opted in or email consent revoked" };
        }
        // Unified governor: adds the rolling marketing cap + the
        // listing-watch-alerts preference toggle on top of the consent gate
        // above. dedupeKey is unique per trigger (each was already deduped to
        // one-pending-per-user-per-type upstream) so it consumes one cap slot.
        const wlGate = await governMarketingSend({
          userId: trigger.userId,
          stream: "watchlist_alerts",
          emailType: trigger.triggerType,
          dedupeKey: `${trigger.triggerType}:${trigger.userId}:${trigger.id}`,
        });
        if (!wlGate.ok) {
          return { status: "cancelled", reason: `Governor blocked: ${wlGate.reason}` };
        }
        const enriched = { ...payload, userId: user.id, email: user.email, firstName: user.firstName };
        const { subject, html, to } = trigger.triggerType === "watchlist_price_change"
          ? buildWatchlistPriceChangeEmail(enriched)
          : buildSavedSearchMatchesEmail(enriched);
        result = await client.emails.send({ from: fromEmail, to, subject, html });
        break;
      }

      case "saved_deal_no_submit":
      case "abandoned_underwriting":
      case "financing_interest": {
        // User-facing behavioural nudges — consent-gated, unsubscribe link included.
        if (!trigger.userId) {
          return { status: "failed", reason: "No userId on trigger" };
        }
        const user = await getConsentedUser(trigger.userId);
        if (!user) {
          return { status: "cancelled", reason: "User not opted in or email consent revoked" };
        }
        // These are behavioural retention nudges — same 'retention' stream and
        // shared weekly cap as retentionEmails/onboarding, so a user can't get
        // deal-desk nudges on top of a full retention quota.
        const nudgeGate = await governMarketingSend({
          userId: trigger.userId,
          stream: "retention",
          emailType: trigger.triggerType,
          dedupeKey: `${trigger.triggerType}:${trigger.userId}:${trigger.id}`,
        });
        if (!nudgeGate.ok) {
          return { status: "cancelled", reason: `Governor blocked: ${nudgeGate.reason}` };
        }
        const dealRef = await getLatestDealRef(trigger.userId).catch(() => null);
        const enriched = { ...payload, userId: user.id, email: user.email, firstName: user.firstName, dealRef };
        const { subject, html, to } =
          trigger.triggerType === "saved_deal_no_submit" ? buildSavedDealNoSubmitNudge(enriched)
          : trigger.triggerType === "abandoned_underwriting" ? buildAbandonedUnderwritingNudge(enriched)
          : buildFinancingInterestNudge(enriched);
        result = await client.emails.send({ from: fromEmail, to, subject, html });
        break;
      }

      default:
        return { status: "failed", reason: `Unknown trigger type: ${trigger.triggerType}` };
    }

    if (result?.error) {
      const errMsg = typeof result.error === "string" ? result.error : JSON.stringify(result.error);
      console.error(`[email-queue] Send failed for trigger ${trigger.id} (${trigger.triggerType}):`, result.error);
      return { status: "failed", reason: errMsg.slice(0, 500) };
    }
    console.log(`[email-queue] Sent trigger ${trigger.id} (${trigger.triggerType})`);
    return { status: "sent", sentAt: new Date() };
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error(`[email-queue] Error processing trigger ${trigger.id} (${trigger.triggerType}):`, msg);
    return { status: "failed", reason: msg.slice(0, 500) };
  }
}
