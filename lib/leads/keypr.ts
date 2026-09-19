import type { Lead } from "@/lib/db/schema";
import { isE164, splitName } from "./phone";
import { provinceCode } from "./routing";
import type { DeliveryResult } from "./outbox";

/**
 * Keypr — the brokerage partner behind the Ontario cash-back offer. A lead
 * goes to them only when the person ticked the partner-consent box on an
 * Ontario offer. Nothing else is ever forwarded: not financing, not
 * out-of-province, not a plain signup.
 */

const KEYPR_ENDPOINT = "https://platform-prod-api.keypr.ca/public/realist-leads";

export { KEYPR_CONSENT_TEXT, KEYPR_CONSENT_VERSION } from "./consentText";

export function qualifiesForKeypr(
  lead: Pick<Lead, "kind" | "province" | "consentPartner" | "phone" | "name" | "email">,
): boolean {
  if (lead.kind !== "offer" && lead.kind !== "showing") return false;
  if (!lead.consentPartner) return false;
  if (provinceCode(lead.province) !== "ON") return false;
  const { first, last } = splitName(lead.name, lead.email);
  return isE164(lead.phone) && Boolean(first && last);
}

export async function deliverToKeypr(lead: Lead): Promise<DeliveryResult> {
  if (!qualifiesForKeypr(lead)) return { outcome: "skipped" };
  const secret = process.env.KEYPR_REALIST_SECRET?.trim();
  if (!secret) return { outcome: "not_configured" };

  const { first, last } = splitName(lead.name, lead.email);
  try {
    const response = await fetch(KEYPR_ENDPOINT, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/json", "X-Realist-Secret": secret },
      body: JSON.stringify({ lead_id: lead.id, first_name: first, last_name: last, email: lead.email, phone: lead.phone }),
    });
    if (response.status === 201 || response.status === 202) {
      const data = (await response.json().catch(() => ({}))) as { lead_ref?: unknown };
      const ref = typeof data.lead_ref === "string" && /^[a-f0-9]{32}$/i.test(data.lead_ref) ? data.lead_ref : null;
      return { outcome: "sent", externalId: ref };
    }
    // The partner's response body is never stored: it may echo contact details.
    const retryable = response.status >= 500 || response.status === 429;
    return { outcome: retryable ? "retry" : "failed", error: `HTTP ${response.status}` };
  } catch {
    return { outcome: "retry", error: "network_or_timeout" };
  }
}
