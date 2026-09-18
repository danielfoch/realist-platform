/**
 * HTTP surface of the OAuth 2.1 authorization server for the hosted MCP endpoint.
 *
 * Discovery (what an MCP client follows after a 401 from /mcp):
 *   GET  /.well-known/oauth-protected-resource[/mcp]   RFC 9728 — "who protects /mcp?"
 *   GET  /.well-known/oauth-authorization-server[/mcp] RFC 8414 — "where do I send the user?"
 * Protocol (the MCP SDK's handlers, mounted under /oauth so they cannot collide
 * with site routes such as /register):
 *   POST /oauth/register     RFC 7591 dynamic client registration
 *   GET  /oauth/authorize    → parks the request, redirects to the consent page
 *   POST /oauth/token        authorization_code + refresh_token, PKCE S256 only
 *   POST /oauth/revoke       RFC 7009
 * Consent + account management (session-authenticated JSON for the React app):
 *   GET    /api/oauth/requests/:id            what is being asked, by whom
 *   POST   /api/oauth/requests/:id/approve    → { redirectTo }
 *   POST   /api/oauth/requests/:id/deny       → { redirectTo }
 *   GET    /api/oauth/grants                  "Connected apps"
 *   DELETE /api/oauth/grants/:id              disconnect
 */
import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import cors from "cors";
import { authorizationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/authorize.js";
import { clientRegistrationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/register.js";
import { revocationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/revoke.js";
import { tokenHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/token.js";
import { isAuthenticated } from "../../auth";
import { publicBaseUrl } from "../context";
import { OAUTH_SCOPES, OAUTH_SCOPE_INFO, mcpResourceUrl, oauthProvider, type OAuthScope } from "./provider";
import { getOAuthStore, secretMatchesHash } from "./store";

export const OAUTH_PROTECTED_RESOURCE_PATH = "/.well-known/oauth-protected-resource/mcp";

export function protectedResourceMetadataUrl(): string {
  return `${publicBaseUrl()}${OAUTH_PROTECTED_RESOURCE_PATH}`;
}

export function authorizationServerMetadata() {
  const base = publicBaseUrl();
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    revocation_endpoint: `${base}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    revocation_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    scopes_supported: [...OAUTH_SCOPES],
    service_documentation: `${base}/developers`,
  };
}

export function protectedResourceMetadata() {
  return {
    resource: mcpResourceUrl().href,
    authorization_servers: [publicBaseUrl()],
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "Realist.ca",
    resource_documentation: `${publicBaseUrl()}/developers`,
  };
}

/**
 * Client secrets are stored hashed, so the SDK's plaintext comparison cannot
 * run. This does the check instead, ahead of the SDK's token/revoke handlers
 * (which then see a client with no secret to compare).
 */
const verifyClientSecret: RequestHandler = async (req, res, next) => {
  try {
    const clientId = typeof req.body?.client_id === "string" ? req.body.client_id : null;
    const client = clientId ? await getOAuthStore().getClient(clientId) : null;
    if (client?.clientSecretHash) {
      const secret = req.body?.client_secret;
      if (typeof secret !== "string" || !secretMatchesHash(secret, client.clientSecretHash)) {
        res.setHeader("Cache-Control", "no-store");
        return res.status(401).json({ error: "invalid_client", error_description: "Invalid client credentials" });
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * The approve/deny calls change who can act on an account, so they must come
 * from our own consent page. The session cookie is SameSite=Lax (not sent on
 * cross-site POSTs); this Origin check is the second lock.
 */
function sameOriginOnly(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (origin) {
    const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
    let originHost = "";
    try { originHost = new URL(origin).host; } catch { /* malformed Origin → rejected below */ }
    if (!originHost || originHost !== host) return res.status(403).json({ error: "cross_origin_request_blocked" });
  }
  next();
}

/**
 * The redirect carries a live authorization code. The app's request logger
 * records whatever goes through res.json() for /api paths, so send it without
 * res.json() to keep codes out of the logs.
 */
function sendRedirectTarget(res: Response, redirectTo: string): void {
  res.setHeader("Cache-Control", "no-store");
  res.type("application/json").send(JSON.stringify({ redirectTo }));
}

const KNOWN_REDIRECT_HOSTS: Record<string, string> = {
  "claude.ai": "Claude",
  "claude.com": "Claude",
  "chatgpt.com": "ChatGPT",
  "chat.openai.com": "ChatGPT",
  "cursor.com": "Cursor",
  "vscode.dev": "VS Code",
};

/** Where the user will be sent back to — the one fact on the consent page an impostor cannot fake. */
export function describeRedirect(redirectUri: string): { display: string; kind: "known" | "local" | "unknown"; knownAs?: string } {
  try {
    const url = new URL(redirectUri);
    if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return { display: "an app on this computer", kind: "local" };
    if (url.protocol !== "https:" && url.protocol !== "http:") return { display: `the ${url.protocol.replace(":", "")} app on this device`, kind: "local" };
    const known = Object.entries(KNOWN_REDIRECT_HOSTS).find(([host]) => url.hostname === host || url.hostname.endsWith(`.${host}`));
    return known ? { display: url.hostname, kind: "known", knownAs: known[1] } : { display: url.hostname, kind: "unknown" };
  } catch {
    return { display: "an unrecognised address", kind: "unknown" };
  }
}

export function registerOAuthRoutes(app: Express): void {
  // ---------- discovery ----------
  const openCors = cors({ origin: true, credentials: false, maxAge: 86400 });
  const json = (body: () => unknown): RequestHandler => (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(body());
  };
  app.get(["/.well-known/oauth-protected-resource", OAUTH_PROTECTED_RESOURCE_PATH], openCors, json(protectedResourceMetadata));
  app.get(["/.well-known/oauth-authorization-server", "/.well-known/oauth-authorization-server/mcp"], openCors, json(authorizationServerMetadata));

  // ---------- protocol endpoints (MCP SDK handlers) ----------
  app.use("/oauth/register", clientRegistrationHandler({
    clientsStore: oauthProvider.clientsStore,
    // Connectors register once and keep the credentials for good; the SDK's
    // 30-day default silently breaks them a month later.
    clientSecretExpirySeconds: 0,
    rateLimit: { windowMs: 60 * 60 * 1000, max: 120 },
  }));
  // The SDK's per-IP defaults assume one user per IP. A connector backend (claude.ai, ChatGPT)
  // fronts every one of its users from a handful of addresses, so the ceilings are raised.
  app.use("/oauth/authorize", authorizationHandler({ provider: oauthProvider, rateLimit: { windowMs: 15 * 60 * 1000, max: 300 } }));
  app.use("/oauth/token", verifyClientSecret, tokenHandler({ provider: oauthProvider, rateLimit: { windowMs: 15 * 60 * 1000, max: 600 } }));
  app.use("/oauth/revoke", verifyClientSecret, revocationHandler({ provider: oauthProvider, rateLimit: { windowMs: 15 * 60 * 1000, max: 300 } }));

  // The consent page grants access to an account: it must never render inside someone else's frame.
  app.use("/oauth/consent", (_req, res, next) => {
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  // ---------- consent API (session) ----------
  app.get("/api/oauth/requests/:id", isAuthenticated, async (req: any, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      const store = getOAuthStore();
      const pending = await store.getPending(req.params.id);
      if (!pending || pending.expiresAt < new Date()) return res.status(404).json({ error: "request_not_found" });
      const client = await store.getClient(pending.clientId);
      if (!client) return res.status(404).json({ error: "request_not_found" });
      const metadata = client.metadata as { client_uri?: string };
      res.json({
        client: {
          name: client.clientName || "An application",
          // Registration is open to anyone, so this URL is untrusted input: web links only.
          uri: typeof metadata.client_uri === "string" && /^https?:\/\//i.test(metadata.client_uri) ? metadata.client_uri : null,
          redirect: describeRedirect(pending.redirectUri),
        },
        scopes: pending.scopes.map((scope) => ({ id: scope, ...OAUTH_SCOPE_INFO[scope as OAuthScope] })),
        expiresAt: pending.expiresAt,
      });
    } catch (error: any) {
      console.error("[oauth] consent lookup failed:", error?.message || error);
      res.status(500).json({ error: "consent_lookup_failed" });
    }
  });

  app.post("/api/oauth/requests/:id/approve", sameOriginOnly, isAuthenticated, async (req: any, res) => {
    try {
      const scopes = Array.isArray(req.body?.scopes) ? req.body.scopes.map(String) : [];
      const redirectTo = await oauthProvider.approve(req.params.id, req.session.userId, scopes);
      if (!redirectTo) return res.status(404).json({ error: "request_not_found" });
      sendRedirectTarget(res, redirectTo);
    } catch (error: any) {
      console.error("[oauth] approve failed:", error?.message || error);
      res.status(500).json({ error: "approve_failed" });
    }
  });

  app.post("/api/oauth/requests/:id/deny", sameOriginOnly, isAuthenticated, async (req: any, res) => {
    try {
      const redirectTo = await oauthProvider.deny(req.params.id);
      if (!redirectTo) return res.status(404).json({ error: "request_not_found" });
      sendRedirectTarget(res, redirectTo);
    } catch (error: any) {
      console.error("[oauth] deny failed:", error?.message || error);
      res.status(500).json({ error: "deny_failed" });
    }
  });

  // ---------- connected apps (session) ----------
  app.get("/api/oauth/grants", isAuthenticated, async (req: any, res) => {
    try {
      const store = getOAuthStore();
      const grants = await store.listGrantsForUser(req.session.userId);
      const rows = await Promise.all(grants.map(async (grant) => {
        const client = await store.getClient(grant.clientId);
        return {
          id: grant.id,
          clientName: client?.clientName || "An application",
          scopes: grant.scopes,
          createdAt: grant.createdAt,
          lastUsedAt: grant.lastUsedAt,
        };
      }));
      res.json({ grants: rows });
    } catch (error: any) {
      console.error("[oauth] grants list failed:", error?.message || error);
      res.status(500).json({ error: "grants_list_failed" });
    }
  });

  app.delete("/api/oauth/grants/:id", sameOriginOnly, isAuthenticated, async (req: any, res) => {
    try {
      const store = getOAuthStore();
      const grant = await store.getGrant(req.params.id);
      if (!grant || grant.userId !== req.session.userId || grant.revokedAt) return res.status(404).json({ error: "grant_not_found" });
      await store.revokeGrant(grant.id);
      res.json({ revoked: true });
    } catch (error: any) {
      console.error("[oauth] revoke failed:", error?.message || error);
      res.status(500).json({ error: "revoke_failed" });
    }
  });

  // Expired requests, codes and tokens are dead weight; sweep them hourly.
  setInterval(() => {
    getOAuthStore().purgeExpired().catch((error) => console.error("[oauth] purge failed:", error?.message || error));
  }, 60 * 60 * 1000).unref();
}
