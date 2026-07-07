/**
 * Email-trigger template builders — pure (type, payload) → { subject, html }
 * renderers moved verbatim from server/emailQueue.ts so BOTH transports can
 * import them:
 *   - the legacy email_triggers worker (server/emailQueue.ts, 30s), and
 *   - the notification_queue drain (server/notifications.ts, 60s) for
 *     channel='email_resend' rows whose templateKey is a trigger type.
 *
 * No DB, no Resend, no side effects — the only inputs besides the payload are
 * process.env (REPLIT_DOMAINS for admin links, SESSION_SECRET for unsubscribe
 * tokens), which keeps output deterministic under a fixed environment and lets
 * shared/emailTriggerTemplates.test.ts pin byte-exact parity hashes.
 */

import crypto from "crypto";

// Same HMAC token server/weeklyDigest.ts has always minted (it now re-exports
// from here) — /api/email/unsubscribe verifies against this exact scheme.
const UNSUBSCRIBE_SECRET = process.env.SESSION_SECRET || "realist-digest-secret";

export function generateUnsubscribeToken(userId: string): string {
  return crypto.createHmac("sha256", UNSUBSCRIBE_SECRET).update(userId).digest("hex");
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  const expected = generateUnsubscribeToken(userId);
  if (token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
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

// ── Behavioural nudges (sweep-generated, user-facing) ───────────────────────

function unsubscribeFooter(userId: string): string {
  const token = generateUnsubscribeToken(userId);
  const unsubscribeUrl = `https://realist.ca/api/email/unsubscribe?uid=${encodeURIComponent(userId)}&token=${token}`;
  return `<p style="color:#9ca3af;font-size:12px;margin-top:24px;">Realist.ca — Canada's real estate deal analyzer · <a href="${unsubscribeUrl}" style="color:#9ca3af;">Unsubscribe</a></p>`;
}

function nudgeCta(href: string, label: string): string {
  return `<p style="margin:20px 0;"><a href="${href}" style="background:#16a34a;color:#fff;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:600;">${label}</a></p>`;
}

function wrapNudge(userId: string, body: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">${body}${unsubscribeFooter(userId)}</div>`;
}

function nudgeFirstName(payload: Record<string, any>): string {
  return payload.firstName || (payload.name || "there").split(" ")[0];
}

export function buildSavedDealNoSubmitNudge(payload: Record<string, any>): { subject: string; html: string; to: string } {
  const firstName = nudgeFirstName(payload);
  const dealRef = payload.dealRef || payload.address || null;
  const dealLabel = dealRef ? `<strong>${dealRef}</strong>` : "a deal";
  const html = wrapNudge(payload.userId || "", `
    <h2 style="font-size:20px;">Ready to take the next step${dealRef ? ` on ${dealRef}` : ""}?</h2>
    <p>Hi ${firstName},</p>
    <p>You ran the numbers on ${dealLabel} and saved it — but it's been sitting there since. If the deal is worth saving, it's worth a second opinion.</p>
    <p>Submit it to the Deal Desk and our team will pressure-test your assumptions and flag anything you missed. Free, takes two minutes.</p>
    ${nudgeCta("https://realist.ca/deal-desk?utm_source=email&utm_campaign=saved_deal_no_submit", "Submit to the Deal Desk")}`);
  return {
    subject: `Ready to take the next step on ${dealRef || "your saved deal"}?`,
    html,
    to: payload.email,
  };
}

export function buildAbandonedUnderwritingNudge(payload: Record<string, any>): { subject: string; html: string; to: string } {
  const firstName = nudgeFirstName(payload);
  const dealRef = payload.dealRef || payload.address || null;
  const dealLabel = dealRef ? `<strong>${dealRef}</strong>` : "a deal";
  const html = wrapNudge(payload.userId || "", `
    <h2 style="font-size:20px;">Your analysis is still open</h2>
    <p>Hi ${firstName},</p>
    <p>You started underwriting ${dealLabel} but didn't get to the verdict. Your inputs are saved exactly where you left them — sixty seconds gets you cash flow, cap rate, and DSCR.</p>
    ${nudgeCta("https://realist.ca/tools/analyzer?utm_source=email&utm_campaign=abandoned_underwriting", "Finish your analysis")}`);
  return {
    subject: `Finish your analysis${dealRef ? ` on ${dealRef}` : ""} — the numbers are waiting`,
    html,
    to: payload.email,
  };
}

export function buildFinancingInterestNudge(payload: Record<string, any>): { subject: string; html: string; to: string } {
  const firstName = nudgeFirstName(payload);
  const dealRef = payload.dealRef || payload.address || null;
  const html = wrapNudge(payload.userId || "", `
    <h2 style="font-size:20px;">Financing changes the math more than price does</h2>
    <p>Hi ${firstName},</p>
    <p>Noticed you've been adjusting the financing assumptions${dealRef ? ` on <strong>${dealRef}</strong>` : " on your analysis"}. Rate, amortization, and structure usually move a deal's verdict more than negotiating the price down.</p>
    <p>Our team can walk you through what lenders are actually offering for a deal like yours — no cost, no pitch.</p>
    ${nudgeCta("https://realist.ca/deal-desk?utm_source=email&utm_campaign=financing_interest", "Talk financing options")}`);
  return {
    subject: `Financing options${dealRef ? ` for ${dealRef}` : " for your next deal"} — let's talk numbers`,
    html,
    to: payload.email,
  };
}

export function buildSlaBreachNag(payload: Record<string, any>): { subject: string; html: string } {
  const name = payload.name || "Unknown lead";
  const html = wrapEmail(`
    ${emailHeader("⏰ SLA BREACH — Hot Lead Uncontacted", "Past the 30-minute first-contact window", "#dc2626")}
    <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
      <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 12px 16px; margin: 0 0 16px 0;">
        <p style="margin: 0; color: #991b1b; font-weight: 700; font-size: 14px;">This hot lead has had no first contact past the SLA. Call now — conversion drops fast.</p>
      </div>

      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 0 0 16px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          ${row("Name", name)}
          ${row("Email", payload.email)}
          ${row("Phone", payload.phone)}
          ${row("Property", payload.address)}
          ${row("Market", payload.market)}
          ${row("Intent Score", payload.intentScore)}
          ${row("Assigned To", payload.assigned_to || payload.assignedTo || "Unassigned")}
          ${row("Opportunity", payload.opportunity_id ? String(payload.opportunity_id).slice(0, 8) + "…" : undefined)}
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
    subject: `Hot lead waiting: ${name} — uncontacted past SLA`,
    html,
  };
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

// ── Watchlist + saved-search alerts (server/watchlists.ts sweep) ────────────
//
// Both types are user-REQUESTED alerts (an explicit Watch click / saved
// search), consent-gated like the behavioural nudges and batched: the sweep
// enqueues at most ONE pending trigger per (user, type) — enforced by the
// uq_email_triggers_pending_user_type partial index — with every change /
// matching search folded into a single payload. Never one email per match.

function formatDollars(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : `$${Math.round(value).toLocaleString("en-CA")}`;
}

export interface WatchlistPriceChangeItem {
  listingKey: string;
  address?: string | null;
  city?: string | null;
  previousPrice: number;
  currentPrice: number;
  direction: "drop" | "increase";
}

export function buildWatchlistPriceChangeEmail(payload: Record<string, any>): { subject: string; html: string; to: string } {
  const firstName = nudgeFirstName(payload);
  const items = (payload.items || []) as WatchlistPriceChangeItem[];
  const first = items[0];
  const label = first?.address || first?.listingKey || "A listing you watch";
  const verb = first?.direction === "increase" ? "went up" : "dropped";
  const subject = items.length > 1
    ? `${label} ${verb} — and ${items.length - 1} more on your watchlist moved`
    : `${label} ${verb} from ${formatDollars(first?.previousPrice)} to ${formatDollars(first?.currentPrice)}`;

  const analyzerParams = new URLSearchParams();
  if (first?.listingKey) analyzerParams.set("mls", first.listingKey);
  if (first?.address) analyzerParams.set("address", first.address);
  if (first?.city) analyzerParams.set("city", first.city);
  if (first?.currentPrice) analyzerParams.set("price", String(first.currentPrice));
  analyzerParams.set("utm_source", "email");
  analyzerParams.set("utm_campaign", "watchlist_price_change");
  const ctaUrl = `https://realist.ca/tools/analyzer?${analyzerParams.toString()}`;

  const rows = items.slice(0, 3).map((item) => `
    <li style="margin:0 0 8px;">
      <strong>${item.address || item.listingKey}</strong>${item.city ? `, ${item.city}` : ""} —
      ${item.direction === "increase" ? "up" : "down"} from ${formatDollars(item.previousPrice)} to <strong>${formatDollars(item.currentPrice)}</strong>
    </li>`).join("");

  const html = wrapNudge(payload.userId || "", `
    <h2 style="font-size:20px;">Price ${first?.direction === "increase" ? "increase" : "drop"} on your watchlist</h2>
    <p>Hi ${firstName},</p>
    <p>${items.length > 1 ? `${items.length} listings you watch just changed price:` : "A listing you watch just changed price:"}</p>
    <ul style="padding-left:18px;">${rows}</ul>
    ${items.length > 3 ? `<p>…and ${items.length - 3} more.</p>` : ""}
    <p>The old numbers are stale — re-run your underwriting at the new price.</p>
    ${nudgeCta(ctaUrl, "Re-run your numbers")}`);
  return { subject, html, to: payload.email };
}

export interface SavedSearchMatchesItem {
  name: string;
  matchCount: number;
  city?: string | null;
  url: string; // relative /tools/cap-rates?... deep link
  sampleAddresses?: string[];
}

export function buildSavedSearchMatchesEmail(payload: Record<string, any>): { subject: string; html: string; to: string } {
  const firstName = nudgeFirstName(payload);
  const searches = (payload.searches || []) as SavedSearchMatchesItem[];
  const first = searches[0];
  const totalMatches = searches.reduce((sum, search) => sum + (search.matchCount || 0), 0);
  const subject = first
    ? `${first.matchCount} new ${first.city ? `${first.city} ` : ""}listing${first.matchCount === 1 ? "" : "s"} match "${first.name}"`
    : "New listings match your saved search";
  const ctaUrl = `https://realist.ca${first?.url || "/tools/cap-rates"}${(first?.url || "").includes("?") ? "&" : "?"}utm_source=email&utm_campaign=saved_search_matches`;

  const rows = searches.slice(0, 3).map((search) => `
    <li style="margin:0 0 8px;">
      <strong>${search.matchCount}</strong> new match${search.matchCount === 1 ? "" : "es"} for “${search.name}”
      ${search.sampleAddresses?.length ? `<br/><span style="color:#6b7280;font-size:13px;">${search.sampleAddresses.slice(0, 2).join(" · ")}</span>` : ""}
    </li>`).join("");

  const html = wrapNudge(payload.userId || "", `
    <h2 style="font-size:20px;">${totalMatches} new listing${totalMatches === 1 ? "" : "s"} match your saved search${searches.length > 1 ? "es" : ""}</h2>
    <p>Hi ${firstName},</p>
    <ul style="padding-left:18px;">${rows}</ul>
    <p>Fresh inventory moves fast — see the matches on the map and run the numbers before someone else does.</p>
    ${nudgeCta(ctaUrl, "See the matches")}`);
  return { subject, html, to: payload.email };
}

export const EMAIL_TRIGGER_TYPES = [
  "deal_submitted_confirmation",
  "hot_lead_immediate_followup",
  "warm_lead_24h_followup",
  "warm_lead_user_nudge",
  "financing_interest_followup",
  "lost_reason_nurture",
  // Sweep-generated behavioural triggers (server/dealDesk.ts POST /api/deal-desk/sweep)
  "sla_breach_nag",
  "saved_deal_no_submit",
  "abandoned_underwriting",
  "financing_interest",
  // Watchlist alerts (server/watchlists.ts sweep) — user-requested, batched
  "watchlist_price_change",
  "saved_search_matches",
] as const;

export type EmailTriggerType = (typeof EMAIL_TRIGGER_TYPES)[number];

export function getSampleTriggerPayload(triggerType: string): Record<string, any> {
  return {
    name: "Jordan Sample",
    firstName: "Jordan",
    userId: "sample-user-id",
    dealRef: "123 Maple Avenue, Toronto, ON",
    assigned_to: "dan",
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
    // watchlist_price_change sample
    items: [{
      listingKey: "X9912345",
      address: "123 Maple Avenue",
      city: "Toronto",
      previousPrice: 869000,
      currentPrice: 849000,
      direction: "drop",
    }],
    // saved_search_matches sample
    searches: [{
      name: "Edmonton multiplexes under $900k",
      matchCount: 3,
      city: "Edmonton",
      url: "/tools/cap-rates?q=multiplex+edmonton",
      sampleAddresses: ["10715 82 Ave NW", "9203 111 St NW"],
    }],
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
    case "sla_breach_nag": {
      const { subject, html } = buildSlaBreachNag(payload);
      return { subject, html, defaultTo: [], audience: "team" };
    }
    case "saved_deal_no_submit": {
      const { subject, html, to } = buildSavedDealNoSubmitNudge(payload);
      return { subject, html, defaultTo: to ? [to] : [], audience: "lead" };
    }
    case "abandoned_underwriting": {
      const { subject, html, to } = buildAbandonedUnderwritingNudge(payload);
      return { subject, html, defaultTo: to ? [to] : [], audience: "lead" };
    }
    case "financing_interest": {
      const { subject, html, to } = buildFinancingInterestNudge(payload);
      return { subject, html, defaultTo: to ? [to] : [], audience: "lead" };
    }
    case "watchlist_price_change": {
      const { subject, html, to } = buildWatchlistPriceChangeEmail(payload);
      return { subject, html, defaultTo: to ? [to] : [], audience: "lead" };
    }
    case "saved_search_matches": {
      const { subject, html, to } = buildSavedSearchMatchesEmail(payload);
      return { subject, html, defaultTo: to ? [to] : [], audience: "lead" };
    }
    default:
      throw new Error(`Unknown trigger type: ${triggerType}`);
  }
}
