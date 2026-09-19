/**
 * OAuth 2.1 authorization server for the hosted MCP endpoint.
 *
 * Why it exists: connector UIs (claude.ai, Claude Desktop, ChatGPT) add a
 * remote MCP server by URL and cannot send a custom header, so without OAuth
 * their users have to paste a secret URL. With it, they enter
 * https://realist.ca/mcp, sign in to Realist, approve, and are connected.
 *
 * The protocol plumbing — request validation, PKCE, redirect-URI matching,
 * error formatting, rate limiting — is the MCP SDK's own handlers. This file is
 * the part that is ours: what a grant means, how long tokens live, and the rule
 * that nothing secret is stored unhashed.
 *
 *   /authorize → saves the pending request → /oauth/consent (React page; the
 *   user signs in and approves) → authorization code → /token → access token
 *   (1 h) + rotating refresh token (60 d).
 */
import crypto from "crypto";
import type { Response } from "express";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { AuthorizationParams, OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  InvalidGrantError,
  InvalidScopeError,
  InvalidTargetError,
  InvalidTokenError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { checkResourceAllowed } from "@modelcontextprotocol/sdk/shared/auth-utils.js";
import type { OAuthClientInformationFull, OAuthTokenRevocationRequest, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { publicBaseUrl, type AgentApiScope } from "../context";
import { getOAuthStore, sha256, type OAuthStore, type StoredOAuthClient } from "./store";

export const ACCESS_TOKEN_PREFIX = "realist_oat_";
export const REFRESH_TOKEN_PREFIX = "realist_ort_";

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 24 * 60 * 60;
const AUTHORIZATION_CODE_TTL_SECONDS = 5 * 60;
const PENDING_REQUEST_TTL_SECONDS = 15 * 60;
/**
 * A rotated refresh token presented again inside this window is treated as a
 * client retrying after a dropped response, not as theft: the request fails,
 * the connection survives. Outside it, reuse revokes the whole grant.
 */
const REFRESH_REUSE_GRACE_SECONDS = 60;

/**
 * What a user can hand to an app through consent. partner:referrals is
 * deliberately absent — partner access stays on explicitly minted API keys.
 */
export const OAUTH_SCOPES = ["read", "underwrite", "deal:submit", "community:write"] as const satisfies readonly AgentApiScope[];
export type OAuthScope = (typeof OAUTH_SCOPES)[number];
export const DEFAULT_OAUTH_SCOPES: OAuthScope[] = ["read", "underwrite"];

export const OAUTH_SCOPE_INFO: Record<OAuthScope, { label: string; description: string; actsForYou: boolean }> = {
  read: { label: "Look things up", description: "Search listings and deals, read market reports and mortgage rates, and see your saved analyses.", actsForYou: false },
  underwrite: { label: "Underwrite deals", description: "Run underwriting, rent estimates and multiplex models, and save the analyses to your account.", actsForYou: false },
  "deal:submit": { label: "Contact the Deal Desk for you", description: "Send a property and your contact details to Realist's team for follow-up. The app is told to ask you first.", actsForYou: true },
  "community:write": { label: "Post to the community", description: "Publish an underwriting to the public community feed under your name. The app is told to ask you first.", actsForYou: true },
};

/** The protected resource tokens are issued for (RFC 8707 audience). */
export function mcpResourceUrl(): URL {
  return new URL(`${publicBaseUrl()}/mcp`);
}

const seconds = (n: number) => new Date(Date.now() + n * 1000);
const randomToken = (prefix: string) => `${prefix}${crypto.randomBytes(32).toString("base64url")}`;

function toClientInformation(client: StoredOAuthClient): OAuthClientInformationFull {
  // No client_secret here on purpose: only its hash is stored, and
  // verifyClientSecret() (routes.ts) checks it before the SDK handlers run.
  return {
    ...(client.metadata as Partial<OAuthClientInformationFull>),
    client_id: client.clientId,
    client_name: client.clientName ?? undefined,
    redirect_uris: client.redirectUris,
    client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
  } as OAuthClientInformationFull;
}

/** Keeps only scopes we grant over OAuth; falls back to the defaults when none were asked for. */
export function normalizeRequestedScopes(requested: string[] | undefined): OAuthScope[] {
  const known = (requested ?? []).filter((scope): scope is OAuthScope => (OAUTH_SCOPES as readonly string[]).includes(scope));
  return known.length ? [...new Set(known)] : [...DEFAULT_OAUTH_SCOPES];
}

export class RealistOAuthProvider implements OAuthServerProvider {
  constructor(private readonly storeOverride?: OAuthStore) {}

  private get store(): OAuthStore {
    return this.storeOverride ?? getOAuthStore();
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    return {
      getClient: async (clientId) => {
        const client = await this.store.getClient(clientId);
        return client ? toClientInformation(client) : undefined;
      },
      registerClient: async (client) => {
        const registered = client as OAuthClientInformationFull;
        const { client_secret: secret, ...metadata } = registered;
        await this.store.saveClient({
          clientId: registered.client_id,
          clientSecretHash: secret ? sha256(secret) : null,
          clientName: registered.client_name?.slice(0, 120) ?? null,
          redirectUris: registered.redirect_uris,
          metadata: metadata as Record<string, unknown>,
          createdAt: new Date(),
        });
        // The plaintext secret goes back to the client exactly once, here.
        return registered;
      },
    };
  }

  /** Validated /authorize request → park it and send the browser to the consent page. */
  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    if (params.resource && !checkResourceAllowed({ requestedResource: params.resource, configuredResource: mcpResourceUrl() })) {
      throw new InvalidTargetError(`This server only issues tokens for ${mcpResourceUrl().href}`);
    }
    const id = crypto.randomBytes(24).toString("base64url");
    await this.store.savePending({
      id,
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      scopes: normalizeRequestedScopes(params.scopes),
      state: params.state ?? null,
      resource: params.resource?.href ?? null,
      expiresAt: seconds(PENDING_REQUEST_TTL_SECONDS),
    });
    res.redirect(302, `/oauth/consent?request=${encodeURIComponent(id)}`);
  }

  /**
   * The signed-in user approved: mint the single-use authorization code and
   * build the redirect back to the client. `approvedScopes` can only narrow
   * what was requested.
   */
  async approve(requestId: string, userId: string, approvedScopes: string[]): Promise<string | null> {
    const pending = await this.store.getPending(requestId);
    if (!pending || pending.expiresAt < new Date()) return null;
    if (!(await this.store.takePending(requestId))) return null;

    const scopes = pending.scopes.filter((scope) => approvedScopes.includes(scope));
    const redirect = new URL(pending.redirectUri);
    if (pending.state) redirect.searchParams.set("state", pending.state);
    if (!scopes.length) {
      redirect.searchParams.set("error", "access_denied");
      redirect.searchParams.set("error_description", "No permissions were approved");
      return redirect.href;
    }

    const code = crypto.randomBytes(32).toString("base64url");
    await this.store.saveCode(sha256(code), {
      clientId: pending.clientId,
      userId,
      redirectUri: pending.redirectUri,
      codeChallenge: pending.codeChallenge,
      scopes,
      resource: pending.resource,
      expiresAt: seconds(AUTHORIZATION_CODE_TTL_SECONDS),
    });
    redirect.searchParams.set("code", code);
    return redirect.href;
  }

  async deny(requestId: string): Promise<string | null> {
    const pending = await this.store.getPending(requestId);
    if (!pending || !(await this.store.takePending(requestId))) return null;
    const redirect = new URL(pending.redirectUri);
    redirect.searchParams.set("error", "access_denied");
    redirect.searchParams.set("error_description", "The user declined the request");
    if (pending.state) redirect.searchParams.set("state", pending.state);
    return redirect.href;
  }

  private async liveCode(client: OAuthClientInformationFull, authorizationCode: string) {
    const code = await this.store.getCode(sha256(authorizationCode));
    if (!code || code.clientId !== client.client_id || code.expiresAt < new Date()) {
      throw new InvalidGrantError("Authorization code is invalid or has expired");
    }
    return code;
  }

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    return (await this.liveCode(client, authorizationCode)).codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL,
  ): Promise<OAuthTokens> {
    const code = await this.liveCode(client, authorizationCode);
    if (redirectUri !== undefined && redirectUri !== code.redirectUri) {
      throw new InvalidGrantError("redirect_uri does not match the authorization request");
    }
    if (resource && code.resource && resource.href !== code.resource) {
      throw new InvalidTargetError("resource does not match the authorization request");
    }
    if (!(await this.store.markCodeUsed(sha256(authorizationCode)))) {
      // A code presented twice means it leaked: kill what the first use produced.
      const grants = await this.store.listGrantsForUser(code.userId);
      await Promise.all(grants.filter((g) => g.clientId === client.client_id).map((g) => this.store.revokeGrant(g.id)));
      throw new InvalidGrantError("Authorization code has already been used");
    }
    const grant = await this.store.upsertGrant({ userId: code.userId, clientId: client.client_id, scopes: code.scopes, resource: code.resource });
    return this.issueTokens(grant.id, code.scopes);
  }

  async exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string, scopes?: string[], resource?: URL): Promise<OAuthTokens> {
    const hash = sha256(refreshToken);
    const token = await this.store.getToken(hash);
    const grant = token ? await this.store.getGrant(token.grantId) : null;
    if (!token || token.kind !== "refresh" || !grant || grant.clientId !== client.client_id) {
      throw new InvalidGrantError("Refresh token is invalid");
    }
    if (token.revokedAt) {
      // Rotation means a refresh token is single-use. Seeing a spent one again is
      // the signature of a stolen token — unless it is a client retrying moments later.
      if (Date.now() - token.revokedAt.getTime() > REFRESH_REUSE_GRACE_SECONDS * 1000) await this.store.revokeGrant(grant.id);
      throw new InvalidGrantError("Refresh token has already been used");
    }
    if (grant.revokedAt || token.expiresAt < new Date()) throw new InvalidGrantError("Refresh token has expired or was revoked");
    if (resource && grant.resource && resource.href !== grant.resource) {
      throw new InvalidTargetError("resource does not match the original grant");
    }
    const granted = scopes?.length ? scopes : grant.scopes;
    if (granted.some((scope) => !grant.scopes.includes(scope))) throw new InvalidScopeError("Requested scope exceeds the original grant");

    await this.store.revokeToken(hash);
    return this.issueTokens(grant.id, granted);
  }

  private async issueTokens(grantId: string, scopes: string[]): Promise<OAuthTokens> {
    const accessToken = randomToken(ACCESS_TOKEN_PREFIX);
    const refreshToken = randomToken(REFRESH_TOKEN_PREFIX);
    await this.store.saveToken(sha256(accessToken), { kind: "access", grantId, expiresAt: seconds(ACCESS_TOKEN_TTL_SECONDS) });
    await this.store.saveToken(sha256(refreshToken), { kind: "refresh", grantId, expiresAt: seconds(REFRESH_TOKEN_TTL_SECONDS) });
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshToken,
      scope: scopes.join(" "),
    };
  }

  async verifyAccessToken(accessToken: string): Promise<AuthInfo> {
    const token = accessToken.startsWith(ACCESS_TOKEN_PREFIX) ? await this.store.getToken(sha256(accessToken)) : null;
    const grant = token ? await this.store.getGrant(token.grantId) : null;
    if (!token || token.kind !== "access" || token.revokedAt || token.expiresAt < new Date() || !grant || grant.revokedAt) {
      throw new InvalidTokenError("Access token is invalid, expired or revoked");
    }
    return {
      token: accessToken,
      clientId: grant.clientId,
      scopes: grant.scopes,
      expiresAt: Math.floor(token.expiresAt.getTime() / 1000),
      resource: grant.resource ? new URL(grant.resource) : undefined,
      extra: { userId: grant.userId, grantId: grant.id },
    };
  }

  async revokeToken(client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    const hash = sha256(request.token);
    const token = await this.store.getToken(hash);
    const grant = token ? await this.store.getGrant(token.grantId) : null;
    if (!token || !grant || grant.clientId !== client.client_id) return; // RFC 7009: unknown tokens are not an error
    // Revoking the refresh token ends the connection; an access token just dies on its own.
    if (token.kind === "refresh") await this.store.revokeGrant(grant.id);
    else await this.store.revokeToken(hash);
  }
}

export const oauthProvider = new RealistOAuthProvider();
