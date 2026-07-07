/**
 * Firebase Cloud Messaging (HTTP v1) sender — dependency-free.
 *
 * Sends the two user-requested push kinds (watchlist price changes,
 * saved-search matches — payloads built in shared/fcmPayload.ts) to the
 * device tokens registered by server/mobilePush.ts. Google service-account
 * OAuth2 is implemented with node:crypto (RS256 JWT via createSign) + fetch,
 * in the same no-new-dependencies spirit as server/podcastFeed.ts.
 *
 * Configuration: env FCM_SERVICE_ACCOUNT holds the full service-account JSON
 * (we read project_id / client_email / private_key). When it is unset or
 * unparseable the sender is DISABLED: we log once at startup and every send
 * becomes a silent no-op returning { sent: 0, disabled: true } — the app must
 * boot and behave identically without the secret.
 *
 * Best-effort by contract: sendPushToUser never throws into a caller — the
 * alert sweeps fire-and-forget it beside the email path, and a push failure
 * must never affect an email.
 */

import { createSign } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { pushDeviceTokens } from "@shared/schema";
import { buildFcmEnvelope, isDeadTokenResponse, type PushKind } from "@shared/fcmPayload";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
/** Refresh the cached access token ~5 minutes before it expires. */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

interface ServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/** undefined = not evaluated yet; null = disabled (missing/invalid secret). */
let cachedAccount: ServiceAccount | null | undefined;

function getServiceAccount(): ServiceAccount | null {
  if (cachedAccount !== undefined) return cachedAccount;

  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) {
    cachedAccount = null;
    console.log("[fcm] FCM_SERVICE_ACCOUNT not set — push sending disabled (sends are silent no-ops)");
    return cachedAccount;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const projectId = parsed.project_id;
    const clientEmail = parsed.client_email;
    const privateKey = parsed.private_key;
    if (typeof projectId !== "string" || !projectId
      || typeof clientEmail !== "string" || !clientEmail
      || typeof privateKey !== "string" || !privateKey) {
      throw new Error("missing project_id / client_email / private_key");
    }
    cachedAccount = {
      projectId,
      clientEmail,
      // Secrets pasted into env vars often carry literal "\n" sequences.
      privateKey: privateKey.replace(/\\n/g, "\n"),
    };
  } catch (error: any) {
    cachedAccount = null;
    console.error(`[fcm] FCM_SERVICE_ACCOUNT unparseable — push sending disabled: ${error?.message || error}`);
  }
  return cachedAccount;
}

// Evaluate at module load so the enabled/disabled state is logged once at
// startup (watchlists.ts imports this module on the boot path).
getServiceAccount();

let tokenCache: { accessToken: string; expiresAtMs: number } | null = null;

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

/**
 * Service-account OAuth2: self-signed RS256 JWT exchanged for a Bearer token
 * (https://developers.google.com/identity/protocols/oauth2/service-account).
 */
async function getAccessToken(account: ServiceAccount): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAtMs - TOKEN_REFRESH_MARGIN_MS) {
    return tokenCache.accessToken;
  }

  // iat backdated 30s: absorbs server clock skew vs Google's tolerance.
  const nowSeconds = Math.floor(Date.now() / 1000) - 30;
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({
    iss: account.clientEmail,
    aud: TOKEN_URL,
    scope: FCM_SCOPE,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.privateKey).toString("base64url");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }).toString(),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`token exchange failed: HTTP ${response.status} ${body.slice(0, 200)}`);
  }
  const json = await response.json() as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    throw new Error("token exchange returned no access_token");
  }
  tokenCache = {
    accessToken: json.access_token,
    expiresAtMs: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return tokenCache.accessToken;
}

export interface PushSendResult {
  /** Messages accepted by FCM (or validated, in dry-run mode). */
  sent: number;
  /** Tokens that errored for transient/other reasons (kept for retry next alert). */
  failed: number;
  /** Dead tokens deleted from push_device_tokens. */
  deleted: number;
  /** True when FCM_SERVICE_ACCOUNT is missing/invalid and nothing was attempted. */
  disabled: boolean;
}

export interface PushSendOptions {
  /**
   * FCM validate_only dry-run: the message is fully validated but never
   * delivered. For tests/ops probes only — the alert sweeps never set this.
   */
  validateOnly?: boolean;
}

/**
 * Send one push notification to every active device token registered for a
 * user. Best-effort: never throws, returns counts. Dead tokens (uninstalled
 * apps) are pruned as FCM reports them.
 */
export async function sendPushToUser(
  userId: string,
  push: { title: string; body: string; link: string; kind: PushKind },
  options: PushSendOptions = {},
): Promise<PushSendResult> {
  const result: PushSendResult = { sent: 0, failed: 0, deleted: 0, disabled: false };

  const account = getServiceAccount();
  if (!account) {
    result.disabled = true;
    return result;
  }

  try {
    const rows = await db.select({ token: pushDeviceTokens.token })
      .from(pushDeviceTokens)
      .where(and(
        eq(pushDeviceTokens.userId, userId),
        eq(pushDeviceTokens.isActive, true),
      ));
    if (!rows.length) return result;

    const accessToken = await getAccessToken(account);
    const message = buildFcmEnvelope(push);
    const endpoint = `https://fcm.googleapis.com/v1/projects/${account.projectId}/messages:send`;

    for (const row of rows) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            ...(options.validateOnly ? { validate_only: true } : {}),
            message: { ...message, token: row.token },
          }),
        });

        if (response.ok) {
          result.sent++;
          continue;
        }

        const body = await response.text().catch(() => "");
        if (isDeadTokenResponse(response.status, body)) {
          // Soft-deactivate (matches mobilePush.ts's unregister lifecycle) so
          // a misclassification is recoverable, and log so pruning is visible.
          await db.update(pushDeviceTokens)
            .set({ isActive: false })
            .where(eq(pushDeviceTokens.token, row.token));
          result.deleted++;
          console.log(
            `[fcm] deactivated dead token ${row.token.slice(0, 12)}… for user ${userId} (HTTP ${response.status})`,
          );
        } else {
          result.failed++;
          console.warn(`[fcm] send failed for user ${userId}: HTTP ${response.status}`);
        }
      } catch (error: any) {
        result.failed++;
        console.warn(`[fcm] send error for user ${userId}: ${error?.message || error}`);
      }
    }
  } catch (error: any) {
    // Token lookup / OAuth exchange failed — swallow, the email path must not care.
    result.failed++;
    console.warn(`[fcm] push skipped for user ${userId}: ${error?.message || error}`);
  }

  return result;
}
