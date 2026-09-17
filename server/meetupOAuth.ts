/**
 * "Continue with Meetup" — member-level OAuth so an RSVP can be placed from
 * inside realist.ca.
 *
 * Meetup's OAuth2 server flow (https://www.meetup.com/graphql/authentication/):
 *   authorize  https://secure.meetup.com/oauth2/authorize?client_id&response_type=code&redirect_uri&state
 *   token      POST https://secure.meetup.com/oauth2/access  (authorization_code / refresh_token)
 * Access tokens last one hour; refresh tokens are single-use, so the refreshed
 * pair always replaces the stored one.
 *
 * Everything here is dormant until MEETUP_CLIENT_ID and MEETUP_CLIENT_SECRET
 * are set. The member token lives in the server session only (no schema
 * change); a later step can persist it on the user row.
 *
 * The RSVP mutation itself is NOT hard-coded: Meetup's public docs list the
 * event-management mutations but we have not yet confirmed the member RSVP
 * mutation in the live schema. Once verified in the GraphQL playground, paste
 * the full document into MEETUP_RSVP_MUTATION_DOCUMENT (it must declare a
 * single `$eventId: ID!` variable) and RSVPs complete in-page.
 */
import type { Express, Request, Response } from "express";
import "express-session";
import crypto from "crypto";
import { baseUrlFromRequest } from "./eventsModule";

declare module "express-session" {
  interface SessionData {
    meetupOAuthState?: string;
    meetupOAuthReturnTo?: string;
    meetupAuth?: { accessToken: string; refreshToken: string | null; expiresAt: number };
  }
}

const AUTHORIZE_URL = "https://secure.meetup.com/oauth2/authorize";
const TOKEN_URL = "https://secure.meetup.com/oauth2/access";
const GRAPHQL_URL = "https://api.meetup.com/gql-ext";

export function isMeetupOAuthConfigured(): boolean {
  return Boolean(process.env.MEETUP_CLIENT_ID && process.env.MEETUP_CLIENT_SECRET);
}

function redirectUri(req: Request): string {
  return process.env.MEETUP_OAUTH_REDIRECT_URI || `${baseUrlFromRequest(req)}/api/meetup/oauth/callback`;
}

/** Only ever send people back to a path on this site. */
function safeReturnTo(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/meetups";
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

async function exchangeToken(params: Record<string, string>): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: process.env.MEETUP_CLIENT_ID || "",
    client_secret: process.env.MEETUP_CLIENT_SECRET || "",
    ...params,
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || `Meetup token exchange failed (${response.status})`);
  }
  return json;
}

/** The member's access token, refreshed when within a minute of expiry; null when not connected. */
export async function getMeetupSessionAccessToken(req: Request): Promise<string | null> {
  const auth = req.session?.meetupAuth;
  if (!auth) return null;
  if (auth.expiresAt - Date.now() > 60_000) return auth.accessToken;
  if (!auth.refreshToken || !isMeetupOAuthConfigured()) return null;
  try {
    const refreshed = await exchangeToken({ grant_type: "refresh_token", refresh_token: auth.refreshToken });
    req.session.meetupAuth = {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? null,
      expiresAt: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
    };
    return refreshed.access_token;
  } catch (error) {
    console.error("[meetup-oauth] refresh failed:", (error as Error).message);
    delete req.session.meetupAuth;
    return null;
  }
}

async function graphql<T>(token: string, query: string, variables: Record<string, unknown>): Promise<{ data?: T; errors?: Array<{ message: string }> }> {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(10_000),
  });
  return (await response.json().catch(() => ({ errors: [{ message: `HTTP ${response.status}` }] }))) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };
}

export async function fetchMeetupSelf(token: string): Promise<{ id: string; name: string | null } | null> {
  const result = await graphql<{ self?: { id?: string; name?: string } }>(token, "query { self { id name } }", {});
  if (!result.data?.self?.id) return null;
  return { id: result.data.self.id, name: result.data.self.name ?? null };
}

export async function rsvpViaMeetupApi(
  token: string,
  eventId: string,
): Promise<{ attempted: boolean; ok: boolean; error?: string }> {
  const document = process.env.MEETUP_RSVP_MUTATION_DOCUMENT;
  if (!document) return { attempted: false, ok: false, error: "MEETUP_RSVP_MUTATION_DOCUMENT is not set" };
  try {
    const result = await graphql<Record<string, unknown>>(token, document, { eventId });
    if (result.errors?.length) return { attempted: true, ok: false, error: result.errors.map((e) => e.message).join("; ") };
    // Meetup mutations report domain errors inside the payload as `errors: [{ message }]`.
    const payload = result.data ? (Object.values(result.data)[0] as { errors?: Array<{ message: string }> } | undefined) : undefined;
    if (payload?.errors?.length) return { attempted: true, ok: false, error: payload.errors.map((e) => e.message).join("; ") };
    return { attempted: true, ok: true };
  } catch (error) {
    return { attempted: true, ok: false, error: (error as Error).message };
  }
}

export function registerMeetupOAuthRoutes(app: Express): void {
  // Feature flags the client reads to decide whether to show "Continue with Meetup".
  app.get("/api/meetup/me", async (req: Request, res: Response) => {
    const configured = isMeetupOAuthConfigured();
    const token = configured ? await getMeetupSessionAccessToken(req) : null;
    const member = token ? await fetchMeetupSelf(token).catch(() => null) : null;
    res.set("Cache-Control", "private, no-store");
    res.json({
      configured,
      connected: Boolean(member),
      canRsvpInPage: Boolean(member) && Boolean(process.env.MEETUP_RSVP_MUTATION_DOCUMENT),
      member,
    });
  });

  app.get("/api/meetup/oauth/start", (req: Request, res: Response) => {
    if (!isMeetupOAuthConfigured()) return res.status(404).json({ error: "Meetup sign-in is not configured" });
    const state = crypto.randomBytes(16).toString("hex");
    req.session.meetupOAuthState = state;
    req.session.meetupOAuthReturnTo = safeReturnTo(req.query.returnTo);
    const params = new URLSearchParams({
      client_id: process.env.MEETUP_CLIENT_ID!,
      response_type: "code",
      redirect_uri: redirectUri(req),
      state,
    });
    if (process.env.MEETUP_OAUTH_SCOPE) params.set("scope", process.env.MEETUP_OAUTH_SCOPE);
    res.redirect(`${AUTHORIZE_URL}?${params.toString()}`);
  });

  app.get("/api/meetup/oauth/callback", async (req: Request, res: Response) => {
    const returnTo = safeReturnTo(req.session?.meetupOAuthReturnTo);
    const expectedState = req.session?.meetupOAuthState;
    delete req.session.meetupOAuthState;
    delete req.session.meetupOAuthReturnTo;
    const { code, state, error } = req.query as Record<string, string | undefined>;
    if (error || !code || !state || !expectedState || state !== expectedState) {
      return res.redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}meetup=denied`);
    }
    try {
      const token = await exchangeToken({ grant_type: "authorization_code", redirect_uri: redirectUri(req), code });
      req.session.meetupAuth = {
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? null,
        expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
      };
      res.redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}meetup=connected`);
    } catch (err) {
      console.error("[meetup-oauth] callback failed:", (err as Error).message);
      res.redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}meetup=error`);
    }
  });

  app.post("/api/meetup/oauth/disconnect", (req: Request, res: Response) => {
    delete req.session.meetupAuth;
    res.json({ ok: true });
  });
}
