import { SITE_BASE_URL } from "@/lib/brand";
import { mintLoginLink } from "@/lib/auth/magicLink";
import type { Lead, LeadKind } from "@/lib/db/schema";
import { emailConfigured, sendEmail } from "@/lib/email";
import { KIND_LABELS } from "./crmPayload";
import type { DeliveryResult } from "./outbox";

/**
 * The reply a person gets when they ask us for something: what we received, what
 * happens next — and one tap into their Realist account, where their numbers
 * are waiting. It turns a form into a member instead of a dead-end "thanks".
 *
 * It answers a request the person just made, so it goes regardless of marketing
 * consent; it carries nothing promotional. Behavioural signals and plain
 * sign-ups (which get their own confirmation) don't get one.
 */

const RECEIPT_KINDS: ReadonlySet<LeadKind> = new Set<LeadKind>(["offer", "showing", "financing", "power_team", "underwriting_help", "meetup_rsvp", "event_invites", "pro_application"]);
const LINK_TTL_MS = 3 * 86_400_000;

const NEXT_STEP: Partial<Record<LeadKind, string>> = {
  offer: "Someone on our team will reply within a business day to talk through the offer and how the cash back works.",
  showing: "Someone on our team will reply within a business day to line up the showing.",
  financing: "A mortgage broker who works with investors will reply within a business day.",
  power_team: "A person reads every request. We'll make the introductions by email, usually within a business day.",
  underwriting_help: "Someone who buys these for a living will look at your numbers and reply within a business day.",
  meetup_rsvp: "Finish your RSVP on Meetup so the host has a head-count — and we'll see you there.",
  event_invites: "You'll hear from us when a meetup is announced near you.",
  pro_application: "We'll be in touch to talk through how the network works.",
};

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function wantsReceipt(kind: LeadKind): boolean {
  return RECEIPT_KINDS.has(kind);
}

export function receiptContent(lead: Pick<Lead, "kind" | "name" | "property">): { subject: string; lines: string[] } {
  const about = lead.property?.address ?? (lead.property?.mlsNumber ? `MLS® ${lead.property.mlsNumber}` : null);
  const first = lead.name?.trim().split(/\s+/)[0];
  return {
    subject: about ? `We've got your request about ${about}` : `We've got your request — ${KIND_LABELS[lead.kind].toLowerCase()}`,
    lines: [
      first ? `${first},` : "Hi,",
      about ? `We've got your ${KIND_LABELS[lead.kind].toLowerCase()} about ${about}.` : `We've got your ${KIND_LABELS[lead.kind].toLowerCase()}.`,
      NEXT_STEP[lead.kind] ?? "A person will reply within a business day.",
    ],
  };
}

export async function deliverReceipt(lead: Lead): Promise<DeliveryResult> {
  if (!wantsReceipt(lead.kind)) return { outcome: "skipped" };
  if (!emailConfigured()) return { outcome: "not_configured" };
  try {
    const { subject, lines } = receiptContent(lead);
    const link = await mintLoginLink({ email: lead.email, next: "/account", origin: SITE_BASE_URL, ttlMs: LINK_TTL_MS });
    const account = "Your Realist account is ready: the deals you underwrite are saved there, with the numbers you used.";
    await sendEmail({
      to: lead.email,
      subject,
      text: [...lines, "", account, link, "", "The link works once and expires in 3 days. If you didn't send this request, ignore this email."].join("\n"),
      html: `<div style="font-family:Inter,Arial,sans-serif;color:#242424;font-size:15px;line-height:1.6;max-width:500px">
  <p style="font-size:18px;font-weight:600;margin:0 0 16px">realist<span style="color:#ff334b">.</span></p>
  ${lines.map((line) => `<p style="margin:0 0 10px">${escapeHtml(line)}</p>`).join("\n  ")}
  <p style="margin:18px 0 14px">${escapeHtml(account)}</p>
  <p style="margin:0 0 24px"><a href="${link}" style="background:#be1730;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 18px;border-radius:3px;display:inline-block">Open my account</a></p>
  <p style="font-size:12px;line-height:1.6;color:#696969;margin:0">The link works once and expires in 3 days. If you didn't send this request, ignore this email.</p>
</div>`,
    });
    return { outcome: "sent" };
  } catch (error) {
    return { outcome: "retry", error: (error as Error).message };
  }
}
