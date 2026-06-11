import { storage } from "./storage";
import { getResendClient } from "./resend";
import type { EmailTrigger } from "@shared/schema";

async function getTeamNotifyEmails(): Promise<string[]> {
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

async function getDealDeskNotifyEmail(): Promise<string> {
  const dbEmail = await storage.getAppSetting("deal_desk_notify_email").catch(() => null);
  if (dbEmail) return dbEmail.split(",")[0].trim();
  return process.env.DEAL_DESK_NOTIFY_EMAIL || process.env.PODCAST_NOTIFY_EMAIL || "";
}

function adminDashboardUrl() {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  return domain ? `https://${domain}/admin/deal-desk` : "https://realist.ca/admin/deal-desk";
}

function emailHeader(title: string, subtitle: string, accentColor = "#22c55e") {
  return `
    <div style="background: linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%); padding: 24px; border-radius: 8px 8px 0 0;">
      <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">${title}</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">${subtitle}</p>
    </div>
  `;
}

function emailFooter() {
  return `
    <div style="text-align: center; padding: 16px; border-top: 1px solid #e5e7eb; margin-top: 16px;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">Realist.ca — Canada's #1 Real Estate Deal Analyzer</p>
    </div>
  `;
}

function formatCurrency(n: number | null | undefined) {
  if (!n) return "—";
  return `$${Number(n).toLocaleString("en-CA")}`;
}

function row(label: string, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  return `
    <tr>
      <td style="padding: 7px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6; width: 40%;">${label}</td>
      <td style="padding: 7px 0; color: #111827; font-size: 13px; font-weight: 500; border-bottom: 1px solid #f3f4f6; text-align: right;">${value}</td>
    </tr>
  `;
}

function wrapEmail(body: string) {
  return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">${body}</div>`;
}

export function buildDealSubmittedConfirmation(payload: Record<string, any>): { subject: string; html: string; to: string } {
  const firstName = (payload.name || "there").split(" ")[0];
  const html = wrapEmail(`
    ${emailHeader("Deal Received — We're On It", "Realist Deal Desk", "#22c55e")}
    <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
      <p style="color: #111827; font-size: 15px; margin: 0 0 12px 0;">Hi ${firstName},</p>
      <p style="color: #374151; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0;">
        Thanks for submitting your deal to the Realist Deal Desk. We've received your information and a member of our team will be in touch shortly.
      </p>

      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 10px 0; font-weight: 600; color: #111827; font-size: 14px;">Your submission summary:</p>
        <table style="width: 100%; border-collapse: collapse;">
          ${row("Property", payload.address)}
          ${row("Market", payload.market)}
          ${row("Property Type", payload.propertyType)}
          ${row("Intent Score", payload.intentScore)}
        </table>
      </div>

      ${payload.status === "hot" ? `
      <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
        <p style="margin: 0; color: #991b1b; font-size: 13px; font-weight: 600;">🔥 High-priority deal — our team will reach out within minutes.</p>
      </div>
      ` : ""}

      <p style="color: #374151; font-size: 14px; line-height: 1.7; margin: 16px 0 0 0;">
        In the meantime, continue refining your analysis on <a href="https://realist.ca" style="color: #22c55e; text-decoration: none; font-weight: 500;">Realist.ca</a>.
      </p>
      <p style="color: #374151; font-size: 14px; margin: 12px 0 0 0;">
        — The Realist Team
      </p>
    </div>
    ${emailFooter()}
  `);
  return {
    subject: `Deal Desk: We received your submission — ${payload.address || "your property"}`,
    html,
    to: payload.email,
  };
}

export function buildHotLeadFollowup(payload: Record<string, any>): { subject: string; html: string } {
  const html = wrapEmail(`
    ${emailHeader("🔥 HOT LEAD — Action Required", "High-intent deal desk submission", "#dc2626")}
    <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
      <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 12px 16px; margin: 0 0 16px 0;">
        <p style="margin: 0; color: #991b1b; font-weight: 700; font-size: 14px;">Intent Score: ${payload.intentScore} — Call within 5 minutes for best conversion</p>
      </div>

      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 0 0 16px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          ${row("Name", payload.name)}
          ${row("Email", payload.email)}
          ${row("Phone", payload.phone)}
          ${row("Property", payload.address)}
          ${row("Market", payload.market)}
          ${row("Property Type", payload.propertyType)}
          ${row("Intent Score", payload.intentScore)}
          ${row("Next Action", payload.suggestedNextAction)}
        </table>
      </div>

      <div style="text-align: center; margin: 20px 0;">
        <a href="${adminDashboardUrl()}" style="display: inline-block; background: #dc2626; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
          View in Deal Desk →
        </a>
      </div>
    </div>
    ${emailFooter()}
  `);
  return {
    subject: `🔥 HOT LEAD (${payload.intentScore}pts): ${payload.name} — ${payload.address || payload.market || "Deal Desk"}`,
    html,
  };
}

export function buildWarmLeadFollowup(payload: Record<string, any>): { subject: string; html: string } {
  const html = wrapEmail(`
    ${emailHeader("Warm Lead — 24h Follow-up", "Deal desk submission flagged for follow-up", "#f59e0b")}
    <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
      <p style="color: #374151; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0;">
        This lead submitted a deal 24 hours ago and has not yet converted. Now is a good time to reach out.
      </p>

      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 0 0 16px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          ${row("Name", payload.name)}
          ${row("Email", payload.email)}
          ${row("Phone", payload.phone)}
          ${row("Property", payload.address)}
          ${row("Market", payload.market)}
          ${row("Intent Score", payload.intentScore)}
          ${row("Next Action", payload.suggestedNextAction)}
        </table>
      </div>

      <div style="text-align: center; margin: 20px 0;">
        <a href="${adminDashboardUrl()}" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
          View in Deal Desk →
        </a>
      </div>
    </div>
    ${emailFooter()}
  `);
  return {
    subject: `Warm Lead 24h Follow-up: ${payload.name} — ${payload.address || payload.market || "Deal Desk"}`,
    html,
  };
}

export function buildFinancingFollowup(payload: Record<string, any>): { subject: string; html: string } {
  const html = wrapEmail(`
    ${emailHeader("💰 Financing Help Requested", "Lead is looking for mortgage/financing assistance", "#7c3aed")}
    <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
      <div style="background: #f5f3ff; border: 1px solid #c4b5fd; border-radius: 8px; padding: 12px 16px; margin: 0 0 16px 0;">
        <p style="margin: 0; color: #5b21b6; font-weight: 600; font-size: 13px;">This investor has requested help with financing — high-value mortgage referral opportunity.</p>
      </div>

      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 0 0 16px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          ${row("Name", payload.name)}
          ${row("Email", payload.email)}
          ${row("Phone", payload.phone)}
          ${row("Property", payload.address)}
          ${row("Market", payload.market)}
          ${row("Property Type", payload.propertyType)}
          ${row("Intent Score", payload.intentScore)}
        </table>
      </div>

      <div style="text-align: center; margin: 20px 0;">
        <a href="${adminDashboardUrl()}" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
          View in Deal Desk →
        </a>
      </div>
    </div>
    ${emailFooter()}
  `);
  return {
    subject: `💰 Financing Request: ${payload.name} — ${payload.address || payload.market || "Deal Desk"}`,
    html,
  };
}

export function buildWarmLeadUserNudge(payload: Record<string, any>): { subject: string; html: string; to: string } {
  const firstName = (payload.name || "there").split(" ")[0];
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  const baseUrl = domain ? `https://${domain}` : "https://realist.ca";
  const analysisLink = payload.analysisId
    ? `${baseUrl}/analyze?id=${payload.analysisId}`
    : `${baseUrl}/analyze`;
  const bookingLink = "https://realist.ca/deal-desk";

  const html = wrapEmail(`
    ${emailHeader("Your Deal Analysis — Ready to Take the Next Step?", "Realist Deal Desk", "#22c55e")}
    <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
      <p style="color: #111827; font-size: 15px; margin: 0 0 12px 0;">Hi ${firstName},</p>
      <p style="color: #374151; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0;">
        You recently submitted a deal to the Realist Deal Desk — we wanted to follow up and make sure you have everything you need to move forward.
      </p>

      ${payload.address ? `
      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 10px 0; font-weight: 600; color: #111827; font-size: 14px;">Your property:</p>
        <table style="width: 100%; border-collapse: collapse;">
          ${row("Address", payload.address)}
          ${payload.market ? row("Market", payload.market) : ""}
          ${payload.propertyType ? row("Property Type", payload.propertyType) : ""}
        </table>
      </div>
      ` : ""}

      <p style="color: #374151; font-size: 14px; line-height: 1.7; margin: 16px 0;">
        Our team of real estate investment specialists can walk you through the numbers, help you stress-test your assumptions, and connect you with the right financing or buying resources — at no cost to you.
      </p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${bookingLink}" style="display: inline-block; background: #22c55e; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Book a Free Strategy Call →
        </a>
      </div>

      <p style="color: #374151; font-size: 14px; line-height: 1.7; margin: 16px 0;">
        Or, if you'd like to keep refining your numbers first, you can <a href="${analysisLink}" style="color: #22c55e; text-decoration: none; font-weight: 500;">return to your analysis here</a>.
      </p>

      <p style="color: #374151; font-size: 14px; margin: 20px 0 0 0;">
        — The Realist Team
      </p>
    </div>
    ${emailFooter()}
  `);
  return {
    subject: `Your deal on ${payload.address || "the property"} — ready to talk numbers?`,
    html,
    to: payload.email,
  };
}

export function buildLostReasonNurture(payload: Record<string, any>, leadInfo?: { name: string; email: string } | null, teamEmail?: string): { subject: string; html: string; to: string[] } {
  const name = leadInfo?.name || "the lead";
  const recipients: string[] = [];
  if (teamEmail) recipients.push(teamEmail);
  if (leadInfo?.email) recipients.push(leadInfo.email);

  const html = wrapEmail(`
    ${emailHeader("Deal Closed — Lost", "Opportunity marked as lost in the Deal Desk", "#6b7280")}
    <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
      <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">
        The opportunity for <strong>${name}</strong> has been marked as <strong>lost</strong>.
      </p>

      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 0 0 16px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          ${row("Lead", name)}
          ${leadInfo?.email ? row("Email", leadInfo.email) : ""}
          ${row("Lost Reason", payload.lostReason)}
          ${row("Opportunity ID", payload.opportunityId ? String(payload.opportunityId).slice(0, 8) + "…" : undefined)}
        </table>
      </div>

      <div style="text-align: center; margin: 20px 0;">
        <a href="${adminDashboardUrl()}" style="display: inline-block; background: #6b7280; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
          View Deal Desk →
        </a>
      </div>
    </div>
    ${emailFooter()}
  `);
  return {
    subject: `Deal Lost: ${name} — ${payload.lostReason || "reason not specified"}`,
    html,
    to: recipients,
  };
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

export const EMAIL_TRIGGER_TYPES = [
  "deal_submitted_confirmation",
  "hot_lead_immediate_followup",
  "warm_lead_24h_followup",
  "warm_lead_user_nudge",
  "financing_interest_followup",
  "lost_reason_nurture",
] as const;

export type EmailTriggerType = (typeof EMAIL_TRIGGER_TYPES)[number];

export function getSampleTriggerPayload(triggerType: string): Record<string, any> {
  return {
    name: "Jordan Sample",
    email: "jordan.sample@example.com",
    phone: "(416) 555-0188",
    address: "123 Maple Avenue, Toronto, ON",
    market: "Toronto",
    propertyType: "Duplex",
    purchasePrice: 850000,
    estimatedRent: 4200,
    intentScore: 78,
    status: triggerType === "hot_lead_immediate_followup" ? "hot" : "warm",
    suggestedNextAction: "Call within 24h to discuss financing options",
    analysisId: "sample-analysis-id",
    lostReason: "Went with another lender",
    opportunityId: "sample-opportunity-id",
  };
}

/**
 * Render the subject + HTML for any trigger type given a payload.
 * Used by the admin preview / test-send tooling. Returns the same
 * markup that the live queue would send. `defaultTo` is the recipient
 * the live queue would resolve (lead email for user-facing emails, or
 * empty for team-facing alerts which go to the configured notify list).
 */
export function buildEmailForTrigger(
  triggerType: string,
  payload: Record<string, any>,
): { subject: string; html: string; defaultTo: string[]; audience: "lead" | "team" } {
  switch (triggerType) {
    case "deal_submitted_confirmation": {
      const { subject, html, to } = buildDealSubmittedConfirmation(payload);
      return { subject, html, defaultTo: to ? [to] : [], audience: "lead" };
    }
    case "hot_lead_immediate_followup": {
      const { subject, html } = buildHotLeadFollowup(payload);
      return { subject, html, defaultTo: [], audience: "team" };
    }
    case "warm_lead_24h_followup": {
      const { subject, html } = buildWarmLeadFollowup(payload);
      return { subject, html, defaultTo: [], audience: "team" };
    }
    case "warm_lead_user_nudge": {
      const { subject, html, to } = buildWarmLeadUserNudge(payload);
      return { subject, html, defaultTo: to ? [to] : [], audience: "lead" };
    }
    case "financing_interest_followup": {
      const { subject, html } = buildFinancingFollowup(payload);
      return { subject, html, defaultTo: [], audience: "team" };
    }
    case "lost_reason_nurture": {
      const leadInfo = payload.name || payload.email
        ? { name: payload.name || "the lead", email: payload.email || "" }
        : null;
      const { subject, html, to } = buildLostReasonNurture(payload, leadInfo, payload.teamEmail);
      return { subject, html, defaultTo: to, audience: "team" };
    }
    default:
      throw new Error(`Unknown trigger type: ${triggerType}`);
  }
}

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

async function processEmailTrigger(trigger: EmailTrigger): Promise<void> {
  const payload = (trigger.payload as Record<string, any>) || {};
  const now = new Date();

  if (trigger.triggerType === "warm_lead_24h_followup" || trigger.triggerType === "warm_lead_user_nudge") {
    const createdAt = new Date(trigger.createdAt);
    const hoursElapsed = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursElapsed < 24) {
      return;
    }
  }

  if (trigger.triggerType === "warm_lead_user_nudge" && trigger.opportunityId) {
    try {
      const opportunity = await storage.getOpportunityById(trigger.opportunityId);
      if (opportunity && NUDGE_SUPPRESS_STATUSES.has(opportunity.status)) {
        console.log(`[email-queue] Cancelled trigger ${trigger.id} (warm_lead_user_nudge) — opportunity ${trigger.opportunityId} already moved to "${opportunity.status}"`);
        await storage.updateEmailTriggerStatus(trigger.id, "cancelled", undefined, `Lead already moved to "${opportunity.status}" before nudge fired`);
        return;
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
          await storage.updateEmailTriggerStatus(trigger.id, "failed", undefined, "No recipient email in payload");
          return;
        }
        const { subject, html, to } = buildDealSubmittedConfirmation(payload);
        result = await client.emails.send({ from: fromEmail, to, subject, html });
        break;
      }

      case "hot_lead_immediate_followup": {
        const recipients = await getTeamNotifyEmails();
        if (recipients.length === 0) {
          await storage.updateEmailTriggerStatus(trigger.id, "failed", undefined, "No team notify emails configured");
          return;
        }
        const { subject, html } = buildHotLeadFollowup(payload);
        result = await client.emails.send({ from: fromEmail, to: recipients, subject, html });
        break;
      }

      case "warm_lead_24h_followup": {
        const recipients = await getTeamNotifyEmails();
        if (recipients.length === 0) {
          await storage.updateEmailTriggerStatus(trigger.id, "failed", undefined, "No team notify emails configured");
          return;
        }
        const { subject, html } = buildWarmLeadFollowup(payload);
        result = await client.emails.send({ from: fromEmail, to: recipients, subject, html });
        break;
      }

      case "warm_lead_user_nudge": {
        if (!payload.email) {
          await storage.updateEmailTriggerStatus(trigger.id, "failed", undefined, "No recipient email in payload");
          return;
        }
        const { subject, html, to } = buildWarmLeadUserNudge(payload);
        result = await client.emails.send({ from: fromEmail, to, subject, html });
        break;
      }

      case "financing_interest_followup": {
        const recipients = await getTeamNotifyEmails();
        if (recipients.length === 0) {
          await storage.updateEmailTriggerStatus(trigger.id, "failed", undefined, "No team notify emails configured");
          return;
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
          await storage.updateEmailTriggerStatus(trigger.id, "failed", undefined, "No recipients for lost_reason_nurture");
          return;
        }
        result = await client.emails.send({ from: fromEmail, to, subject, html });
        break;
      }

      default:
        await storage.updateEmailTriggerStatus(trigger.id, "failed", undefined, `Unknown trigger type: ${trigger.triggerType}`);
        return;
    }

    if (result?.error) {
      const errMsg = typeof result.error === "string" ? result.error : JSON.stringify(result.error);
      console.error(`[email-queue] Send failed for trigger ${trigger.id} (${trigger.triggerType}):`, result.error);
      await storage.updateEmailTriggerStatus(trigger.id, "failed", undefined, errMsg.slice(0, 500));
    } else {
      console.log(`[email-queue] Sent trigger ${trigger.id} (${trigger.triggerType})`);
      await storage.updateEmailTriggerStatus(trigger.id, "sent", new Date());
    }
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error(`[email-queue] Error processing trigger ${trigger.id} (${trigger.triggerType}):`, msg);
    await storage.updateEmailTriggerStatus(trigger.id, "failed", undefined, msg.slice(0, 500));
  }
}

export async function processPendingEmailTriggers(): Promise<{ processed: number; sent: number; failed: number; skipped: number; cancelled: number }> {
  const pending = await storage.listPendingEmailTriggers();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let cancelled = 0;

  for (const trigger of pending) {
    const statusBefore = trigger.status;
    if (trigger.triggerType === "warm_lead_24h_followup" || trigger.triggerType === "warm_lead_user_nudge") {
      const hoursElapsed = (Date.now() - new Date(trigger.createdAt).getTime()) / (1000 * 60 * 60);
      if (hoursElapsed < 24) {
        skipped++;
        continue;
      }
    }
    await processEmailTrigger(trigger);
    const updated = await storage.listEmailTriggers(1);
    const latest = updated.find(t => t.id === trigger.id);
    if (latest?.status === "sent") sent++;
    else if (latest?.status === "failed") failed++;
    else if (latest?.status === "cancelled") cancelled++;
  }

  return { processed: pending.length, sent, failed, skipped, cancelled };
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
  runCycle();
  return setInterval(runCycle, intervalMs);
}
