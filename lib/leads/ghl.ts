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

/** Requests that are deals in the making — each opens an opportunity so it can be worked stage by stage. */
const OPPORTUNITY_KINDS = new Set(["showing", "offer", "financing"]);

/**
 * Optional. With GHL_PIPELINE_ID set (and, to land in a particular column,
 * GHL_PIPELINE_STAGE_ID), a showing, offer or financing request also opens an
 * opportunity on that pipeline. Without it nothing changes.
 */
function pipeline(): { pipelineId: string; stageId: string | null } | null {
  const pipelineId = process.env.GHL_PIPELINE_ID?.trim();
  return pipelineId ? { pipelineId, stageId: process.env.GHL_PIPELINE_STAGE_ID?.trim() || process.env.GHL_STAGE_ID?.trim() || null } : null;
}

export function opportunityName(lead: Pick<Lead, "kind" | "name" | "email" | "property" | "city">): string {
  const what = lead.kind === "showing" ? "Showing" : lead.kind === "offer" ? "Offer" : "Financing";
  const where = lead.property?.address ?? (lead.property?.mlsNumber ? `MLS® ${lead.property.mlsNumber}` : lead.city) ?? "deal";
  return `${what} — ${where} (${lead.name?.trim() || lead.email})`.slice(0, 200);
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

async function call(path: string, token: string, body?: unknown, method: "POST" | "GET" | "PUT" = "POST"): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Version: API_VERSION,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
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
        // Look before writing. A web form is unverified: anyone who knows a contact's email could
        // otherwise overwrite that contact's name and phone in the CRM. An existing contact only
        // ever gains tags and a note (which records what was typed); a new one is created.
        const query = `/contacts/search/duplicate?locationId=${encodeURIComponent(api.locationId)}&email=${encodeURIComponent(lead.email)}`;
        const found = (await call(query, api.token, undefined, "GET")).contact as { id?: unknown } | null | undefined;
        if (typeof found?.id === "string") {
          done.contactId = found.id;
          done.existing = true;
        } else {
          const result = await call("/contacts/upsert", api.token, { locationId: api.locationId, ...crmContact(lead) });
          const contact = result.contact as { id?: unknown } | undefined;
          if (typeof contact?.id !== "string") throw new GhlError("upsert returned no contact id", true);
          done.contactId = contact.id;
        }
      }
      if (!done.tagged) {
        await call(`/contacts/${done.contactId}/tags`, api.token, { tags: crmTags(lead) });
        done.tagged = true;
      }
      // Someone who turned our email off must stop getting the CRM's too. The tag above is the dependable
      // signal (workflows can exclude it); the email do-not-disturb flag is set as well, best effort.
      if (lead.kind === "unsubscribe" && !done.dndTried) {
        done.dndTried = true;
        await call(`/contacts/${done.contactId}`, api.token, { dndSettings: { Email: { status: "active", message: "Unsubscribed on realist.ca" } } }, "PUT").catch(() => {});
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
    // Last, because it is optional and the likeliest to be refused (a wrong stage id, a pipeline that
    // doesn't allow a second opportunity for one contact): by now the contact, tags, note and workflow
    // have all landed, and nothing below can take them back.
    const board = pipeline();
    if (api && board && OPPORTUNITY_KINDS.has(lead.kind) && typeof done.contactId === "string" && !done.opportunityId && !done.opportunityError) {
      try {
        const name = opportunityName(lead);
        // A create that timed out may still have landed. Look before opening another.
        if (done.opportunityTried) {
          const query = `/opportunities/search?location_id=${encodeURIComponent(api.locationId)}&pipeline_id=${encodeURIComponent(board.pipelineId)}&contact_id=${encodeURIComponent(done.contactId)}&limit=20`;
          const found = await call(query, api.token, undefined, "GET").catch(() => null);
          const match = (Array.isArray(found?.opportunities) ? (found.opportunities as Array<{ id?: unknown; name?: unknown }>) : []).find((row) => row.name === name);
          if (typeof match?.id === "string") done.opportunityId = match.id;
        }
        if (!done.opportunityId) {
          done.opportunityTried = true;
          const created = await call("/opportunities/", api.token, {
            locationId: api.locationId,
            pipelineId: board.pipelineId,
            ...(board.stageId ? { pipelineStageId: board.stageId } : {}),
            name,
            status: "open",
            contactId: done.contactId,
            ...(lead.property?.price ? { monetaryValue: Math.round(lead.property.price) } : {}),
          });
          const opportunity = created.opportunity as { id?: unknown } | undefined;
          done.opportunityId = typeof opportunity?.id === "string" ? opportunity.id : "created";
        }
      } catch (error) {
        // Busy or unreachable: try again later. Refused outright: say why on /admin/leads and move on —
        // the lead itself is delivered.
        if (!(error instanceof GhlError) || error.retryable) throw error;
        done.opportunityError = error.message;
      }
    }
    return {
      outcome: "sent",
      progress: done,
      externalId: typeof done.contactId === "string" ? done.contactId : null,
      note: typeof done.opportunityError === "string" ? `delivered, but no opportunity was opened — ${done.opportunityError}` : null,
    };
  } catch (error) {
    const known = error instanceof GhlError;
    return {
      outcome: known && !error.retryable ? "failed" : "retry",
      progress: done,
      error: (error as Error).message,
    };
  }
}
