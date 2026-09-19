import { normalizeKeyprPhone, type KeyprContact } from "../shared/keypr";

export const KEYPR_ENDPOINT = "https://platform-prod-api.keypr.ca/public/realist-leads";
export type KeyprPayload = { lead_id: string; first_name: string; last_name: string; email: string; phone: string };
export function keyprPayload(leadId: string, contact: KeyprContact): KeyprPayload {
  return { lead_id: leadId, first_name: contact.firstName, last_name: contact.lastName,
    email: contact.email.toLowerCase(), phone: normalizeKeyprPhone(contact.phone) };
}
export type DeliveryResult = { status: "sent" | "retry" | "failed"; code: string; leadRef?: string };
export async function deliverKeyprLead(payload: KeyprPayload, secret: string, fetcher: typeof fetch = fetch): Promise<DeliveryResult> {
  try {
    const response = await fetcher(KEYPR_ENDPOINT, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/json", "X-Realist-Secret": secret },
      body: JSON.stringify(payload),
    });
    if (response.status === 201 || response.status === 202) {
      const data = await response.json().catch(() => ({})) as { lead_ref?: unknown };
      return { status: "sent", code: String(response.status),
        leadRef: typeof data.lead_ref === "string" && /^[a-f0-9]{32}$/i.test(data.lead_ref) ? data.lead_ref : undefined };
    }
    return { status: response.status >= 500 || response.status === 429 ? "retry" : "failed", code: String(response.status) };
  } catch {
    // Never persist/log upstream bodies, contact information, or the secret.
    return { status: "retry", code: "network_or_timeout" };
  }
}
export function retryDelayMs(attempt: number): number {
  return [60_000, 300_000, 1_800_000][Math.min(Math.max(attempt - 1, 0), 2)];
}
