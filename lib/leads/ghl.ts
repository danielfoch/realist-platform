import type { Lead } from "@/lib/db/schema";
import { crmContact, crmTags, leadSummaryLines, webhookPayload } from "./crmPayload";
import type { DeliveryResult } from "./outbox";

/**
 * GoHighLevel. Two doors, either or both, using the env names the previous app
 * used so nothing has to be re-keyed:
 *   API v2   GHL_API_KEY (or HIGHLEVEL_TOKEN) + GHL_LOCATION_ID (or HIGHLEVEL_LOCATION_ID)
 *            — a private-integration token with contacts write scope
 *   webhook  GHL_WEBHOOK_URL — an "Inbound Webhook" workflow trigger
 *
 * The API's upsert REPLACES a contact's tags, which would erase whatever the
 * team has tagged by hand. So the contact is upserted without tags and tags
 * are added through the additive endpoint.
 */

const DEFAULT_API_BASE = "https://services.leadconnectorhq.com";
/** Overridable for tests against a local stand-in; production only ever talks HTTPS. */
function apiBase(): string {
  const override = process.env.GHL_API_BASE?.trim().replace(/\/$/, "");
  if (!override) return DEFAULT_API_BASE;
  if (override.startsWith("https://") || process.env.NODE_ENV !== "production") return override;
  return DEFAULT_API_BASE;
}
const API_VERSION = "2021-07-28";
const TIMEOUT_MS = 8000;

function apiCredentials(): { token: string; locationId: string } | null {
  const token = process.env.GHL_API_KEY?.trim() || process.env.HIGHLEVEL_TOKEN?.trim();
  const locationId = process.env.GHL_LOCATION_ID?.trim() || process.env.HIGHLEVEL_LOCATION_ID?.trim();
  return token && locationId ? { token, locationId } : null;
}

function webhookUrl(): string | null {
  const url = process.env.GHL_WEBHOOK_URL?.trim();
  return url && url.startsWith("https://") ? url : null;
}

export function ghlConfigured(): boolean {
  return Boolean(apiCredentials() || webhookUrl());
}

class GhlError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

async function call(path: string, token: string, body: unknown): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Version: API_VERSION,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new GhlError(`network: ${(error as Error).message}`, true);
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    // 4xx other than rate limiting will fail the same way every time.
    const retryable = response.status === 429 || response.status >= 500;
    throw new GhlError(`HTTP ${response.status} on ${path}: ${detail}`, retryable);
  }
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

/**
 * Deliver one lead. `progress` records finished steps so a retry after a
 * partial failure never writes a second note or re-fires the workflow.
 */
export async function deliverToGhl(lead: Lead, progress: Record<string, unknown>): Promise<DeliveryResult> {
  const api = apiCredentials();
  const hook = webhookUrl();
  if (!api && !hook) return { outcome: "not_configured" };

  const done = { ...progress };
  try {
    if (api) {
      if (typeof done.contactId !== "string") {
        const result = await call("/contacts/upsert", api.token, { locationId: api.locationId, ...crmContact(lead) });
        const contact = result.contact as { id?: unknown } | undefined;
        if (typeof contact?.id !== "string") throw new GhlError("upsert returned no contact id", true);
        done.contactId = contact.id;
      }
      if (!done.tagged) {
        await call(`/contacts/${done.contactId}/tags`, api.token, { tags: crmTags(lead) });
        done.tagged = true;
      }
      // A bare signup has nothing worth a note; everything else carries context.
      if (!done.noted && lead.kind !== "signup") {
        await call(`/contacts/${done.contactId}/notes`, api.token, { body: leadSummaryLines(lead).join("\n") });
        done.noted = true;
      }
    }
    if (hook && !done.webhooked) {
      let response: Response;
      try {
        response = await fetch(hook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookPayload(lead)),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        throw new GhlError(`webhook network: ${(error as Error).message}`, true);
      }
      if (!response.ok) throw new GhlError(`webhook HTTP ${response.status}`, response.status === 429 || response.status >= 500);
      done.webhooked = true;
    }
    return { outcome: "sent", progress: done, externalId: typeof done.contactId === "string" ? done.contactId : null };
  } catch (error) {
    const known = error instanceof GhlError;
    return {
      outcome: known && !error.retryable ? "failed" : "retry",
      progress: done,
      error: (error as Error).message,
    };
  }
}
