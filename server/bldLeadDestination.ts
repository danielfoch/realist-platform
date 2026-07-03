/**
 * BLD Financial lead destination — env-driven STUB.
 *
 * Qualified booked-call leads get flipped to a financing contact at BLD
 * Financial (Nick Hill's commercial mortgage shop). The actual destination is
 * NOT wired yet — both env vars below are intentionally UNSET in every
 * environment, so nothing leaves the app. Until Dan configures one, leads are
 * stored in booked_call_leads and reviewed at /admin (Call Leads tab) or
 * GET /api/booked-call-leads.
 *
 * To wire the real destination, set ONE of:
 *   BLD_LEAD_WEBHOOK_URL  — HTTPS endpoint (BLD intake / GHL / Zapier) that
 *                           receives the JSON payload built by
 *                           buildBldLeadPayload (shared/bookedCallLeads.ts)
 *   BLD_LEAD_EMAIL        — inbox for BLD's financing contact; the lead is
 *                           sent via the existing Resend integration
 *
 * See ENVIRONMENT_VARIABLES.md. Delivery is best-effort and never throws —
 * a lead is always persisted first, so a failed forward only means manual
 * follow-up from the admin list.
 */

import { buildBldLeadPayload, type BldLeadEvent, type BldPayloadLead } from "@shared/bookedCallLeads";

export function bldDestinationStatus(): { webhook: boolean; email: boolean; configured: boolean } {
  const webhook = !!process.env.BLD_LEAD_WEBHOOK_URL;
  const email = !!process.env.BLD_LEAD_EMAIL;
  return { webhook, email, configured: webhook || email };
}

export type BldForwardResult =
  | { delivered: true; via: "webhook" | "email" }
  | { delivered: false; reason: "unconfigured" | "error" };

/**
 * Forward a lead to the configured BLD destination. With both env vars unset
 * (the current state everywhere) this logs and returns
 * { delivered: false, reason: "unconfigured" } — no external call is made.
 */
export async function forwardLeadToBld(lead: BldPayloadLead, event: BldLeadEvent): Promise<BldForwardResult> {
  const webhookUrl = process.env.BLD_LEAD_WEBHOOK_URL;
  const emailTo = process.env.BLD_LEAD_EMAIL;

  if (!webhookUrl && !emailTo) {
    console.log(
      `[bld-lead] no destination configured (BLD_LEAD_WEBHOOK_URL / BLD_LEAD_EMAIL unset) — lead ${lead.id} (${event}) stored for admin review only`
    );
    return { delivered: false, reason: "unconfigured" };
  }

  const payload = buildBldLeadPayload(lead, event);

  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        console.error(`[bld-lead] webhook rejected lead ${lead.id}: HTTP ${response.status}`);
        return { delivered: false, reason: "error" };
      }
      console.log(`[bld-lead] lead ${lead.id} (${event}) delivered via webhook`);
      return { delivered: true, via: "webhook" };
    } catch (err) {
      console.error(`[bld-lead] webhook error for lead ${lead.id}:`, err instanceof Error ? err.message : err);
      return { delivered: false, reason: "error" };
    }
  }

  // Email destination — reuses the existing Resend integration. Dynamic import
  // so this module stays import-light when the destination is unconfigured.
  try {
    const { getResendClient } = await import("./resend");
    const { client, fromEmail } = await getResendClient();
    const contextLines = [
      `Intent: ${payload.intent}`,
      `Event: ${payload.event}`,
      payload.context.sourcePage ? `Source page: ${payload.context.sourcePage}` : null,
      payload.context.underwritingId ? `Underwriting id: ${payload.context.underwritingId}` : null,
      payload.context.analysisId ? `Analysis id: ${payload.context.analysisId}` : null,
      payload.context.dealSnapshot ? `Deal: ${JSON.stringify(payload.context.dealSnapshot)}` : null,
      payload.message ? `Message: ${payload.message}` : null,
    ].filter(Boolean);
    await client.emails.send({
      from: fromEmail,
      to: emailTo!,
      subject: `Realist financing lead (${payload.event}): ${payload.contact.fullName}`,
      text: [
        `New booked-call lead from realist.ca (lead ${payload.leadId}).`,
        ``,
        `Name: ${payload.contact.fullName}`,
        `Email: ${payload.contact.email}`,
        payload.contact.phone ? `Phone: ${payload.contact.phone}` : null,
        ``,
        ...contextLines,
      ]
        .filter((line) => line !== null)
        .join("\n"),
    });
    console.log(`[bld-lead] lead ${lead.id} (${event}) delivered via email`);
    return { delivered: true, via: "email" };
  } catch (err) {
    console.error(`[bld-lead] email error for lead ${lead.id}:`, err instanceof Error ? err.message : err);
    return { delivered: false, reason: "error" };
  }
}
