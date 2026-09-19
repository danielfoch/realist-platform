/**
 * Meetup OAuth2 JWT server flow — how the site reads the Pro network through
 * the GraphQL API without a person logging in.
 *
 * An OAuth client on meetup.com holds up to two RSA signing keys. We sign a
 * short-lived assertion with the private half, Meetup verifies it against the
 * public half it kept (chosen by the `kid` header), and returns a bearer token.
 *
 * Environment (all optional — with nothing set the public iCal feeds serve):
 *   MEETUP_ACCESS_TOKEN          Static bearer token; when set it is used as-is.
 *   MEETUP_CLIENT_ID             OAuth client key (the JWT `iss`).
 *   MEETUP_JWT_PRIVATE_KEY       PEM RSA private key shown once when a signing
 *                                key is created. Literal "\n" escapes accepted
 *                                so it fits in a single-line env var.
 *   MEETUP_JWT_KEY_ID            Signing key id listed beside the key (JWT `kid`).
 *   MEETUP_AUTHORIZED_MEMBER_ID  Member id the client acts as (JWT `sub`); must
 *                                be an admin of the Pro network.
 */

import crypto from "node:crypto";

export const MEETUP_TOKEN_URL = "https://secure.meetup.com/oauth2/access";
export const MEETUP_JWT_AUDIENCE = "api.meetup.com";

const JWT_TTL_SECONDS = 120;
const TOKEN_TIMEOUT_MS = 10_000;

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

/** Accept a PEM pasted on one line with literal "\n" escapes and/or quotes. */
export function normalizePrivateKeyPem(raw: string): string {
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n")
    .trim();
}

function base64Url(input: string | Buffer): string {
  return (typeof input === "string" ? Buffer.from(input, "utf8") : input).toString("base64url");
}

/**
 * Signed assertion: header {kid, typ: JWT, alg: RS256}, claims {sub: member,
 * iss: client, aud: api.meetup.com, exp: now + 120s}.
 */
export function buildMeetupJwtAssertion(input: {
  clientId: string;
  memberId: string;
  privateKeyPem: string;
  keyId?: string;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  const header = input.keyId
    ? { kid: input.keyId, typ: "JWT", alg: "RS256" }
    : { alg: "RS256", typ: "JWT" };
  const claims = {
    sub: input.memberId,
    iss: input.clientId,
    aud: MEETUP_JWT_AUDIENCE,
    exp: Math.floor(now.getTime() / 1000) + JWT_TTL_SECONDS,
  };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const signature = crypto.sign(
    "RSA-SHA256",
    Buffer.from(signingInput, "utf8"),
    normalizePrivateKeyPem(input.privateKeyPem),
  );
  return `${signingInput}.${base64Url(signature)}`;
}

let tokenCache: { token: string; expiresAt: number } | null = null;

/** Whether the JWT flow has everything it needs. */
export function meetupJwtConfigured(): boolean {
  return Boolean(
    env("MEETUP_CLIENT_ID") && env("MEETUP_AUTHORIZED_MEMBER_ID") && env("MEETUP_JWT_PRIVATE_KEY"),
  );
}

/**
 * Bearer token for the GraphQL API: the static MEETUP_ACCESS_TOKEN when set,
 * else one minted through the JWT flow and cached until 60s before expiry.
 * Returns null when nothing is configured; throws when credentials exist but
 * the exchange fails (callers fall back to the public iCal feed).
 */
export async function getMeetupAccessToken(now: Date = new Date()): Promise<string | null> {
  const staticToken = env("MEETUP_ACCESS_TOKEN");
  if (staticToken) return staticToken;
  if (!meetupJwtConfigured()) return null;
  if (tokenCache && now.getTime() < tokenCache.expiresAt) return tokenCache.token;

  const assertion = buildMeetupJwtAssertion({
    clientId: env("MEETUP_CLIENT_ID"),
    memberId: env("MEETUP_AUTHORIZED_MEMBER_ID"),
    privateKeyPem: env("MEETUP_JWT_PRIVATE_KEY"),
    keyId: env("MEETUP_JWT_KEY_ID") || undefined,
    now,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);
  try {
    const response = await fetch(MEETUP_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
      // A POST is never cached by default; "no-store" here only served to force every page
      // that lists meetups into per-request rendering.
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Meetup token request failed: HTTP ${response.status}`);
    const json = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
    if (typeof json.access_token !== "string" || !json.access_token) {
      throw new Error("Meetup token response had no access_token");
    }
    const expiresIn =
      typeof json.expires_in === "number" && json.expires_in > 0 ? json.expires_in : 3600;
    tokenCache = {
      token: json.access_token,
      expiresAt: now.getTime() + Math.max(expiresIn - 60, 30) * 1000,
    };
    return tokenCache.token;
  } finally {
    clearTimeout(timer);
  }
}

/** Test hook. */
export function resetMeetupTokenCache(): void {
  tokenCache = null;
}
