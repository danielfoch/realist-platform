import type { Lead } from "@/lib/db/schema";
import { emailConfigured, sendEmail } from "@/lib/email";
import { KIND_LABELS, leadSummaryLines } from "./crmPayload";
import { teamRecipients } from "./routing";
import type { DeliveryResult } from "./outbox";

/**
 * Every hand-raise reaches a person's inbox. Plain signups stay quiet unless
 * LEAD_EMAIL_SIGNUPS=1 — they're in the CRM, and the inbox is for people who
 * asked for something.
 */

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function teamEmailSubject(lead: Pick<Lead, "kind" | "name" | "email" | "city" | "property">): string {
  const who = lead.name?.trim() || lead.email;
  const where = lead.property?.address || lead.city || null;
  return `[Realist] ${KIND_LABELS[lead.kind]} — ${[who, where].filter(Boolean).join(" · ")}`;
}

export async function deliverToTeam(lead: Lead): Promise<DeliveryResult> {
  // CRM-only signals: worth a tag for segmenting, not worth an email.
  if (lead.kind === "first_underwrite") return { outcome: "skipped" };
  if (lead.kind === "signup" && process.env.LEAD_EMAIL_SIGNUPS !== "1") return { outcome: "skipped" };
  const { to, cc } = teamRecipients(lead.intent);
  if (!emailConfigured() || to.length === 0) return { outcome: "not_configured" };

  const contact = [lead.name, lead.email, lead.phone].filter(Boolean).join(" · ");
  const lines = [contact, "", ...leadSummaryLines(lead)];
  try {
    await sendEmail({
      to,
      cc,
      replyTo: lead.email,
      subject: teamEmailSubject(lead),
      text: lines.join("\n"),
      html: `<div style="font-family:Inter,Arial,sans-serif;color:#242424;font-size:14px;line-height:1.6;max-width:560px">
  <p style="font-size:16px;font-weight:600;margin:0 0 4px">${escapeHtml(KIND_LABELS[lead.kind])}</p>
  <p style="margin:0 0 16px;color:#4d4d4d">${escapeHtml(contact)}</p>
  ${leadSummaryLines(lead)
    .map((line) => `<p style="margin:0 0 6px">${escapeHtml(line)}</p>`)
    .join("\n  ")}
  <p style="margin:16px 0 0;font-size:12px;color:#696969">Reply to this email to answer them directly.</p>
</div>`,
    });
    return { outcome: "sent" };
  } catch (error) {
    return { outcome: "retry", error: (error as Error).message };
  }
}
