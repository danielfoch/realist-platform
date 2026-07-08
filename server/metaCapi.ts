/**
 * Meta Conversions API (CAPI) — server-side event sender.
 *
 * Sends events directly to Meta's Marketing API in parallel with the
 * browser-side Meta Pixel. Deduplication is handled via the shared
 * event_id that the browser pixel also receives (fbq eventID option).
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
 */

const PIXEL_ID = "1661103374140663";
const API_VERSION = "v20.0";
const CAPI_URL = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;

export interface CapiUserData {
  clientIp: string;
  clientUserAgent: string;
  /** Raw _fbp cookie value (not hashed — Meta hashes it server-side) */
  fbp?: string;
  /** Raw _fbc cookie value */
  fbc?: string;
}

export interface CapiEventPayload {
  eventName: string;
  eventId: string;
  eventSourceUrl: string;
  userData: CapiUserData;
  customData?: Record<string, unknown>;
}

function sha256(value: string): string {
  return require("crypto").createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export async function sendCapiEvent(payload: CapiEventPayload): Promise<void> {
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  if (!accessToken) {
    console.warn("[CAPI] META_CAPI_ACCESS_TOKEN not set — skipping event:", payload.eventName);
    return;
  }

  const eventTime = Math.floor(Date.now() / 1000);

  const body = {
    data: [
      {
        event_name: payload.eventName,
        event_time: eventTime,
        event_id: payload.eventId,
        event_source_url: payload.eventSourceUrl,
        action_source: "website",
        user_data: {
          client_ip_address: payload.userData.clientIp,
          client_user_agent: payload.userData.clientUserAgent,
          ...(payload.userData.fbp ? { fbp: payload.userData.fbp } : {}),
          ...(payload.userData.fbc ? { fbc: payload.userData.fbc } : {}),
        },
        ...(payload.customData ? { custom_data: payload.customData } : {}),
      },
    ],
  };

  try {
    const res = await fetch(`${CAPI_URL}?access_token=${accessToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[CAPI] Error response:", res.status, text);
    } else {
      const json = await res.json() as any;
      console.log("[CAPI] Event sent:", payload.eventName, "events_received:", json.events_received);
    }
  } catch (err) {
    console.error("[CAPI] Network error sending event:", err);
  }
}
