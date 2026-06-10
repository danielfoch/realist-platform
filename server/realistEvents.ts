import crypto from "crypto";
import type { CrmWebhookPayload, RealistEvent } from "@shared/engagement";
import { buildCrmWebhookPayload, sendCrmWebhook } from "./crmWebhook";

export const REALIST_EVENT_TYPES = [
  "user.signed_up",
  "user.completed_onboarding",
  "user.updated_buy_box",
  "user.joined_waitlist",
  "user.requested_consult",
  "deal.saved",
  "deal.note_created",
  "deal.feedback_submitted",
  "deal.risk_flagged",
  "deal.underwritten",
  "deal.quote_requested",
  "deal.professional_quote_submitted",
  "deal.watchlist_updated",
  "professional.lead_requested",
  "professional.quote_requested",
  "professional.feedback_submitted",
  "professional.profile_viewed",
  "professional.application_submitted",
  "leaderboard.rank_changed",
  "leaderboard.weekly_digest",
  "challenge.submitted",
  "challenge.completed",
  "digest.daily_deal_drop",
  "digest.weekly_summary",
  "admin.new_lead",
  "admin.high_intent_user",
  "admin.crm_sync_failed",
  "admin.webhook_failed",
] as const;

export type RealistEventType = typeof REALIST_EVENT_TYPES[number];

export async function trackRealistEvent(input: Omit<Partial<CrmWebhookPayload>, "eventVersion" | "source" | "environment"> & {
  eventType: RealistEventType;
  target?: RealistEvent["target"];
  trainingRelevance?: RealistEvent["trainingRelevance"];
}) {
  const payload = buildCrmWebhookPayload(input);
  const event: RealistEvent = {
    id: payload.eventId || crypto.randomUUID(),
    type: payload.eventType,
    source: "realist.ca",
    createdAt: payload.occurredAt,
    actor: payload.actor,
    target: input.target,
    payload: {
      recipient: payload.recipient,
      listing: payload.listing,
      deal: payload.deal,
      professionalRequest: payload.professionalRequest,
      email: payload.email,
      metadata: payload.metadata || {},
    },
    trainingRelevance: input.trainingRelevance,
  };

  console.log(JSON.stringify({ type: "realist_structured_event", event }));

  const webhook = await sendCrmWebhook(payload);
  return { event, webhook };
}
