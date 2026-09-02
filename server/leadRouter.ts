/**
 * Site-wide lead routing — the one place that decides which human hears about
 * an inquiry.
 *
 * Every capture surface (contact page, analyzer, offers, booked calls, deal
 * desk, waitlists, partner applications) calls notifyTeamOfLead with an
 * intent, and this module turns that into recipients:
 *
 *   acquisition → Daniel (danielfoch@gmail.com)
 *   financing   → Nick Hill (nick@bldfinancial.ca), Daniel cc'd
 *   general     → both
 *
 * Before this existed, most surfaces resolved their recipients to [] (see the
 * comment on getNotifyEmails in resend.ts) or only alerted on the first-ever
 * lead per email — a known investor going serious was the exact moment we
 * stopped hearing about them. The defaults live in code so a fresh deploy
 * works without a config step; the *_LEAD_EMAILS env vars override.
 *
 * Recipient lists are defined here rather than in resend.ts so the pure
 * routing helpers can be imported (and unit-tested, and used from modules
 * whose tests mock resend.ts) without dragging the Resend client along.
 * resend.ts re-exports them for its existing callers. Delivery goes through a
 * dynamic import of resend.ts, so there is no static cycle.
 */

import { upsertPlatformCrmContact } from "./crmIngest";

export type LeadIntent = "acquisition" | "financing" | "general";

const DEFAULT_ACQUISITION_EMAILS = ["danielfoch@gmail.com"];
const DEFAULT_FINANCING_EMAILS = ["nick@bldfinancial.ca"];

/** Comma-separated env list → addresses; empty/garbage falls back. */
function parseEmailList(raw: string | undefined, fallback: string[]): string[] {
  if (raw) {
    const parsed = raw
      .split(",")
      .map(e => e.trim())
      .filter(e => e.includes("@"));
    if (parsed.length) return parsed;
  }
  return [...fallback];
}

function unique(list: string[]): string[] {
  const seen = new Set<string>();
  return list.filter(e => {
    const key = e.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Acquisition / realtor / representation inquiries. ACQUISITION_LEAD_EMAILS overrides. */
export function getAcquisitionNotifyEmails(): string[] {
  return parseEmailList(process.env.ACQUISITION_LEAD_EMAILS, DEFAULT_ACQUISITION_EMAILS);
}

/** Mortgage / financing inquiries. FINANCING_LEAD_EMAILS overrides. */
export function getFinancingNotifyEmails(): string[] {
  return parseEmailList(process.env.FINANCING_LEAD_EMAILS, DEFAULT_FINANCING_EMAILS);
}

/**
 * Everyone who should hear about a revenue event when intent is unknown —
 * the union of the two lanes. LEAD_NOTIFY_EMAILS overrides the whole list.
 */
export function getLeadNotifyEmails(): string[] {
  const configured = parseEmailList(process.env.LEAD_NOTIFY_EMAILS, []);
  if (configured.length) return configured;
  return unique([...getAcquisitionNotifyEmails(), ...getFinancingNotifyEmails()]);
}

export interface LeadRecipients {
  to: string[];
  cc: string[];
}

export function recipientsForIntent(intent: LeadIntent): LeadRecipients {
  switch (intent) {
    case "acquisition":
      return { to: getAcquisitionNotifyEmails(), cc: [] };
    case "financing": {
      const to = getFinancingNotifyEmails();
      // Daniel stays copied on financing so nothing depends on one inbox.
      const cc = getAcquisitionNotifyEmails().filter(e => !to.some(t => t.toLowerCase() === e.toLowerCase()));
      return { to, cc };
    }
    default:
      return { to: getLeadNotifyEmails(), cc: [] };
  }
}

/**
 * Map the formTag values the client already sends (/api/leads/engage, GHL
 * webhooks) onto a lane. Unknown tags are general, which reaches everyone.
 */
export function intentFromFormTag(formTag?: string | null): LeadIntent {
  const tag = (formTag ?? "").trim().toLowerCase();
  if (!tag) return "general";
  if (
    tag === "financing_consultation" ||
    tag === "mortgage_rate_request" ||
    tag.startsWith("mli_") ||
    tag.startsWith("financing_") ||
    tag.startsWith("mortgage_")
  ) {
    return "financing";
  }
  if (
    tag === "representation_interest" ||
    tag === "offer_request" ||
    tag.startsWith("buybox") ||
    tag.startsWith("acquisition")
  ) {
    return "acquisition";
  }
  return "general";
}

// ─── Double-submit throttle ──────────────────────────────────────────────────

const THROTTLE_WINDOW_MS = 10 * 60 * 1000;
const throttleSeen = new Map<string, number>();

/**
 * Same person, same surface, inside ten minutes → one email. Form
 * double-clicks and "did it go through?" resubmits were the main source of
 * duplicate alerts on the old first-lead gate. In-memory is fine: a restart
 * costs at most one extra email.
 */
export const leadAlertThrottle = {
  key(email: string, surface: string): string {
    return `${email.trim().toLowerCase()}|${surface.trim().toLowerCase()}`;
  },
  /** True when this email+surface already alerted inside the window. Records the hit otherwise. */
  shouldSuppress(email: string, surface: string, now: number = Date.now()): boolean {
    const key = this.key(email, surface);
    const last = throttleSeen.get(key);
    if (last !== undefined && now - last < THROTTLE_WINDOW_MS) return true;
    throttleSeen.set(key, now);
    // Keep the map from growing forever on a long-lived process.
    if (throttleSeen.size > 5000) {
      for (const [k, t] of throttleSeen) {
        if (now - t >= THROTTLE_WINDOW_MS) throttleSeen.delete(k);
      }
    }
    return false;
  },
  reset(): void {
    throttleSeen.clear();
  },
  windowMs: THROTTLE_WINDOW_MS,
};

// ─── Notification ────────────────────────────────────────────────────────────

export type LeadContextValue = string | number | boolean | null | undefined;

export interface NotifyTeamOfLeadInput {
  intent: LeadIntent;
  /** Human label for the surface, e.g. "Contact page", "Offer form". */
  surface: string;
  sourcePage?: string | null;
  name?: string | null;
  email: string;
  phone?: string | null;
  message?: string | null;
  /** Rendered as a key/value table — address, price, units, verdict, links. */
  context?: Record<string, LeadContextValue>;
  replyTo?: string;
  /**
   * Surfaces that already write a richer CRM entry (booked calls) pass true
   * so the contact doesn't get a second, thinner timeline row.
   */
  skipCrm?: boolean;
}

export interface NotifyTeamOfLeadResult {
  emailed: boolean;
  recipients: string[];
}

const INTENT_LABEL: Record<LeadIntent, string> = {
  acquisition: "Acquisition",
  financing: "Financing",
  general: "General",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatValue(value: LeadContextValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString("en-CA") : String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value;
}

function labelFromKey(key: string): string {
  // Accept both camelCase and already-human keys.
  if (/\s/.test(key)) return key;
  return key.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());
}

function toSlug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "lead";
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function buildLeadEmail(input: NotifyTeamOfLeadInput): { subject: string; html: string; text: string } {
  const name = (input.name ?? "").trim() || input.email;
  const headline =
    (input.context && [input.context.address, input.context.propertyAddress, input.context.market].find(v => typeof v === "string" && v.trim())) ||
    input.sourcePage ||
    input.surface;
  const subject = `[Realist lead · ${INTENT_LABEL[input.intent]}] ${name} — ${String(headline)}`;

  const rows: Array<[string, string]> = [
    ["Name", name],
    ["Email", input.email],
    ["Phone", input.phone?.trim() || ""],
    ["Surface", input.surface],
    ["Page", input.sourcePage ?? ""],
  ];
  for (const [key, value] of Object.entries(input.context ?? {})) {
    const rendered = formatValue(value);
    if (rendered !== "") rows.push([labelFromKey(key), rendered]);
  }
  const visibleRows = rows.filter(([, v]) => v !== "");

  const htmlRows = visibleRows
    .map(([label, value]) => {
      const cell = isUrl(value)
        ? `<a href="${escapeHtml(value)}" style="color:#16a34a;">${escapeHtml(value)}</a>`
        : escapeHtml(value);
      return `<tr>
        <td style="padding:8px 0;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:8px 0 8px 16px;color:#111827;font-size:14px;font-weight:500;border-bottom:1px solid #f3f4f6;text-align:right;word-break:break-word;">${cell}</td>
      </tr>`;
    })
    .join("");

  const message = input.message?.trim();
  const messageHtml = message
    ? `<div style="margin-top:20px;padding:16px;background:#fff;border:1px solid #e5e7eb;border-radius:6px;">
        <p style="margin:0 0 8px 0;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Message</p>
        <p style="margin:0;color:#111827;font-size:14px;white-space:pre-wrap;">${escapeHtml(message)}</p>
      </div>`
    : "";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">New ${escapeHtml(INTENT_LABEL[input.intent].toLowerCase())} lead</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">${escapeHtml(input.surface)} · Realist.ca</p>
      </div>
      <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse;">${htmlRows}</table>
        ${messageHtml}
        <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 20px;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">
            Reply to this email to answer ${escapeHtml(name)} directly.
            Submitted ${new Date().toLocaleString("en-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" })} ET.
          </p>
          <p style="margin: 8px 0 0 0;">
            <a href="https://realist.ca/admin" style="color: #22c55e; text-decoration: none; font-weight: 500;">View in Admin Dashboard →</a>
          </p>
        </div>
      </div>
      <div style="text-align: center; padding: 16px;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">Realist.ca - Canada's #1 Real Estate Deal Analyzer</p>
      </div>
    </div>
  `;

  const text = [
    `New ${INTENT_LABEL[input.intent].toLowerCase()} lead — ${input.surface}`,
    "",
    ...visibleRows.map(([label, value]) => `${label}: ${value}`),
    ...(message ? ["", "Message:", message] : []),
    "",
    `Reply to this email to answer ${name} directly.`,
    "https://realist.ca/admin",
  ].join("\n");

  return { subject, html, text };
}

/**
 * Send one routed alert and record the contact in the CRM. Never throws —
 * the capture endpoint has already persisted the lead, and a delivery
 * failure must not turn into a 500 for the visitor.
 */
export async function notifyTeamOfLead(input: NotifyTeamOfLeadInput): Promise<NotifyTeamOfLeadResult> {
  const email = (input.email ?? "").trim();
  if (!email.includes("@")) {
    console.warn(`[lead-router] ${input.surface}: no usable email, skipping alert`);
    return { emailed: false, recipients: [] };
  }

  const { to, cc } = recipientsForIntent(input.intent);
  const recipients = unique([...to, ...cc]);

  if (!input.skipCrm) {
    const name = (input.name ?? "").trim() || email;
    upsertPlatformCrmContact({
      name,
      email,
      phone: input.phone ?? null,
      source: toSlug(input.surface),
      sourceDetail: input.sourcePage ?? input.surface,
      activityBody: `${input.surface}: ${INTENT_LABEL[input.intent].toLowerCase()} inquiry${input.sourcePage ? ` from ${input.sourcePage}` : ""}${input.message ? ` — "${input.message.slice(0, 300)}"` : ""}.`,
      activityMetadata: { intent: input.intent, surface: input.surface, ...(input.context ?? {}) },
    }).catch(err => console.error("[lead-router] CRM handoff failed:", err instanceof Error ? err.message : err));
  }

  if (leadAlertThrottle.shouldSuppress(email, input.surface)) {
    console.log(`[lead-router] ${input.surface}: ${email} alerted inside the last ${leadAlertThrottle.windowMs / 60000} min, not re-sending`);
    return { emailed: false, recipients };
  }

  if (to.length === 0) {
    console.warn(`[lead-router] ${input.surface}: no recipients for intent ${input.intent}`);
    return { emailed: false, recipients };
  }

  try {
    const { getResendClient } = await import("./resend");
    const { client, fromEmail } = await getResendClient();
    const { subject, html, text } = buildLeadEmail(input);
    const { error } = await client.emails.send({
      from: fromEmail,
      to,
      ...(cc.length ? { cc } : {}),
      replyTo: input.replyTo ?? email,
      subject,
      html,
      text,
    });
    if (error) {
      console.error(`[lead-router] ${input.surface}: Resend rejected the alert:`, error);
      return { emailed: false, recipients };
    }
    console.log(`[lead-router] ${input.surface} (${input.intent}) → to ${to.join(", ")}${cc.length ? ` cc ${cc.join(", ")}` : ""}`);
    return { emailed: true, recipients };
  } catch (err) {
    console.error(`[lead-router] ${input.surface}: alert failed:`, err instanceof Error ? err.message : err);
    return { emailed: false, recipients };
  }
}
