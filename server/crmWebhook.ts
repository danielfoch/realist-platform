import crypto from "crypto";
import type { CrmWebhookPayload } from "@shared/engagement";

export type CrmWebhookResult = {
  success: boolean;
  eventId: string;
  status: "disabled" | "skipped" | "sent" | "failed";
  statusCode?: number;
  errorMessage?: string;
};

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_RETRY_COUNT = 2;

function getEnvironment(): CrmWebhookPayload["environment"] {
  const env = process.env.NODE_ENV;
  if (env === "production") return "production";
  if (env === "staging") return "staging";
  return "development";
}

function buildSignature(body: string, timestamp: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

function validatePayload(payload: CrmWebhookPayload): string | null {
  if (!payload.eventId) return "eventId is required";
  if (!payload.eventType) return "eventType is required";
  if (payload.eventVersion !== "1.0") return "eventVersion must be 1.0";
  if (payload.source !== "realist.ca") return "source must be realist.ca";
  if (!payload.occurredAt) return "occurredAt is required";
  return null;
}

export function buildCrmWebhookPayload(input: Omit<Partial<CrmWebhookPayload>, "eventVersion" | "source" | "environment"> & {
  eventType: string;
}): CrmWebhookPayload {
  return {
    eventId: input.eventId || crypto.randomUUID(),
    eventType: input.eventType,
    eventVersion: "1.0",
    source: "realist.ca",
    occurredAt: input.occurredAt || new Date().toISOString(),
    environment: getEnvironment(),
    actor: input.actor,
    recipient: input.recipient,
    listing: input.listing,
    deal: input.deal,
    professionalRequest: input.professionalRequest,
    email: input.email,
    metadata: input.metadata,
  };
}

export async function sendCrmWebhook(payload: CrmWebhookPayload): Promise<CrmWebhookResult> {
  const validationError = validatePayload(payload);
  if (validationError) {
    return { success: false, eventId: payload.eventId || "unknown", status: "failed", errorMessage: validationError };
  }

  if (process.env.CRM_WEBHOOK_ENABLED !== "true") {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[crm-webhook] disabled; skipped ${payload.eventType} (${payload.eventId})`);
    }
    return { success: true, eventId: payload.eventId, status: "disabled" };
  }

  const webhookUrl = process.env.CRM_WEBHOOK_URL;
  if (!webhookUrl) {
    return { success: false, eventId: payload.eventId, status: "skipped", errorMessage: "CRM_WEBHOOK_URL is not configured" };
  }

  const timeoutMs = Math.max(1000, Number(process.env.CRM_WEBHOOK_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const retryCount = Math.max(0, Number(process.env.CRM_WEBHOOK_RETRY_COUNT || DEFAULT_RETRY_COUNT));
  const secret = process.env.CRM_WEBHOOK_SECRET;
  const body = JSON.stringify(payload);
  let lastError = "";
  let lastStatusCode: number | undefined;

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const timestamp = new Date().toISOString();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Realist-Event-Id": payload.eventId,
      "X-Realist-Event-Type": payload.eventType,
      "X-Realist-Timestamp": timestamp,
      "Idempotency-Key": payload.eventId,
    };

    if (secret) {
      headers["X-Realist-Signature"] = buildSignature(body, timestamp, secret);
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
      lastStatusCode = response.status;

      if (response.ok) {
        if (process.env.NODE_ENV !== "production") {
          console.log(`[crm-webhook] sent ${payload.eventType} (${payload.eventId}) status=${response.status}`);
        }
        return { success: true, eventId: payload.eventId, status: "sent", statusCode: response.status };
      }

      lastError = `CRM webhook responded with HTTP ${response.status}`;
    } catch (error: any) {
      lastError = error?.name === "AbortError" ? `CRM webhook timed out after ${timeoutMs}ms` : error?.message || "CRM webhook failed";
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < retryCount) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** attempt, 5000)));
    }
  }

  console.error(`[crm-webhook] failed ${payload.eventType} (${payload.eventId}): ${lastError}`);
  return { success: false, eventId: payload.eventId, status: "failed", statusCode: lastStatusCode, errorMessage: lastError };
}
