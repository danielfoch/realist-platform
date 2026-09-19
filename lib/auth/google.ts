import { SITE_BASE_URL } from "@/lib/brand";

/**
 * "Continue with Google" — the plain OAuth 2.0 authorization-code flow, no SDK.
 * Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and optionally
 * GOOGLE_REDIRECT_URI (defaults to <site>/api/auth/google/callback, which must
 * be listed on the OAuth client in Google Cloud).
 */

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export const GOOGLE_STATE_COOKIE = "realist_google_state";

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI?.trim() || `${SITE_BASE_URL}/api/auth/google/callback`;
}

export function googleAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

export async function exchangeGoogleCode(code: string): Promise<GoogleProfile> {
  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!tokenResponse.ok) throw new Error(`Google token exchange failed: HTTP ${tokenResponse.status}`);
  const tokens = (await tokenResponse.json()) as { access_token?: string };
  if (!tokens.access_token) throw new Error("Google returned no access token");

  const profileResponse = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileResponse.ok) throw new Error(`Google userinfo failed: HTTP ${profileResponse.status}`);
  const profile = (await profileResponse.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  if (!profile.sub || !profile.email) throw new Error("Google profile is missing id or email");
  return {
    sub: profile.sub,
    email: profile.email,
    emailVerified: profile.email_verified === true,
    name: profile.name ?? null,
  };
}
