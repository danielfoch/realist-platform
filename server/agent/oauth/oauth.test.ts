/**
 * The whole OAuth 2.1 journey a connector (claude.ai, ChatGPT, …) takes, over
 * real HTTP: discovery → dynamic registration → authorize → consent → token →
 * call /mcp → refresh → disconnect. In-memory stores; no database.
 */
import crypto from "crypto";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectMock: vi.fn(),
  updateMock: vi.fn(),
  insertMock: vi.fn(),
  usageRows: [] as any[],
}));

vi.mock("../../db", () => ({ db: { select: mocks.selectMock, update: mocks.updateMock, insert: mocks.insertMock } }));
vi.mock("../../rentIntelligence", () => ({ getRentEstimate: vi.fn() }));
vi.mock("../../multiplexUnderwriter", async () => {
  const { z } = await import("zod");
  return { underwriteRequestSchema: z.object({ address: z.string().optional() }), executeMultiplexUnderwriter: vi.fn() };
});
vi.mock("../../routes/dealDesk", async () => {
  const { z } = await import("zod");
  return { dealDeskSubmitSchema: z.object({ name: z.string() }), submitDealDesk: vi.fn() };
});
vi.mock("../../storage", () => ({ storage: {} }));

import { registerMcpRoutes } from "../mcpServer";
import { createMemoryAgentViewStore, setAgentViewStore } from "../viewStore";
import { registerOAuthRoutes, describeRedirect } from "./routes";
import { normalizeRequestedScopes } from "./provider";
import { createMemoryOAuthStore, setOAuthStore, sha256, type OAuthStore } from "./store";

const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const MCP_ACCEPT = "application/json, text/event-stream";
let sessionUserId: string | null;
let store: OAuthStore;

function app() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use((req: any, _res, next) => {
    req.session = { userId: sessionUserId };
    next();
  });
  registerMcpRoutes(app);
  registerOAuthRoutes(app);
  return app;
}

function pkce() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  return { verifier, challenge: crypto.createHash("sha256").update(verifier).digest("base64url") };
}

async function register(server: express.Express, overrides: Record<string, unknown> = {}) {
  const response = await request(server).post("/oauth/register").send({
    client_name: "Claude",
    redirect_uris: [REDIRECT],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    ...overrides,
  });
  expect(response.status).toBe(201);
  return response.body as { client_id: string; client_secret?: string };
}

async function authorize(server: express.Express, clientId: string, challenge: string, extra: Record<string, string> = {}) {
  const response = await request(server).get("/oauth/authorize").query({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "xyz",
    scope: "read underwrite deal:submit community:write",
    resource: "https://realist.ca/mcp",
    ...extra,
  });
  return response;
}

/** Runs registration → authorize → approve → token and returns everything the later steps need. */
async function connect(server: express.Express, approvedScopes = ["read", "underwrite"]) {
  const client = await register(server);
  const { verifier, challenge } = pkce();
  const redirect = await authorize(server, client.client_id, challenge);
  const requestId = new URL(redirect.headers.location, "https://realist.ca").searchParams.get("request")!;
  const approval = await request(server).post(`/api/oauth/requests/${requestId}/approve`).send({ scopes: approvedScopes });
  const code = new URL(approval.body.redirectTo).searchParams.get("code")!;
  const token = await request(server).post("/oauth/token").type("form").send({
    grant_type: "authorization_code",
    client_id: client.client_id,
    code,
    code_verifier: verifier,
    redirect_uri: REDIRECT,
    resource: "https://realist.ca/mcp",
  });
  return { client, verifier, code, requestId, token };
}

const rpc = (method: string, params: unknown = {}) => ({ jsonrpc: "2.0", id: 1, method, params });
const callMcp = (server: express.Express, accessToken: string, body: unknown) =>
  request(server).post("/mcp").set({ Authorization: `Bearer ${accessToken}`, Accept: MCP_ACCEPT }).send(body as object);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.usageRows.length = 0;
  sessionUserId = "user-1";
  store = createMemoryOAuthStore();
  setOAuthStore(store);
  setAgentViewStore(createMemoryAgentViewStore());
  // realist_whoami reads the user row; usage metering inserts.
  mocks.selectMock.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [{ id: "user-1", email: "dan@example.com" }] }) }) });
  mocks.insertMock.mockReturnValue({ values: (row: any) => { mocks.usageRows.push(row); return { catch: vi.fn() }; } });
});

describe("discovery", () => {
  it("sends an unauthenticated MCP client to the OAuth metadata", async () => {
    const response = await request(app()).post("/mcp").set({ Accept: MCP_ACCEPT }).send(rpc("initialize"));
    expect(response.status).toBe(401);
    expect(response.headers["www-authenticate"]).toContain('resource_metadata="https://realist.ca/.well-known/oauth-protected-resource/mcp"');
  });

  it("publishes protected-resource and authorization-server metadata", async () => {
    const resource = await request(app()).get("/.well-known/oauth-protected-resource/mcp");
    expect(resource.body).toMatchObject({ resource: "https://realist.ca/mcp", authorization_servers: ["https://realist.ca"], bearer_methods_supported: ["header"] });

    const server = await request(app()).get("/.well-known/oauth-authorization-server");
    expect(server.body).toMatchObject({
      issuer: "https://realist.ca",
      authorization_endpoint: "https://realist.ca/oauth/authorize",
      token_endpoint: "https://realist.ca/oauth/token",
      registration_endpoint: "https://realist.ca/oauth/register",
      code_challenge_methods_supported: ["S256"],
      grant_types_supported: ["authorization_code", "refresh_token"],
    });
    // partner:referrals is never grantable through a consent screen.
    expect(server.body.scopes_supported).toEqual(["read", "underwrite", "deal:submit", "community:write"]);
  });
});

describe("registration", () => {
  it("registers public clients without a secret and confidential ones with a secret stored only as a hash", async () => {
    const server = app();
    const publicClient = await register(server);
    expect(publicClient.client_secret).toBeUndefined();

    const confidential = await register(server, { token_endpoint_auth_method: "client_secret_post" });
    expect(confidential.client_secret).toMatch(/^[a-f0-9]{64}$/);
    const stored = await store.getClient(confidential.client_id);
    expect(stored!.clientSecretHash).toBe(sha256(confidential.client_secret!));
    expect(JSON.stringify(stored)).not.toContain(confidential.client_secret);
  });

  it("rejects malformed registrations", async () => {
    const response = await request(app()).post("/oauth/register").send({ client_name: "x", redirect_uris: ["not a url"] });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("invalid_client_metadata");
  });
});

describe("authorize + consent", () => {
  it("parks a valid request and sends the browser to the consent page", async () => {
    const server = app();
    const client = await register(server);
    const response = await authorize(server, client.client_id, pkce().challenge);

    expect(response.status).toBe(302);
    expect(response.headers.location).toMatch(/^\/oauth\/consent\?request=[A-Za-z0-9_-]{32}$/);
  });

  it("refuses an unregistered redirect_uri outright and never redirects to it", async () => {
    const server = app();
    const client = await register(server);
    const response = await authorize(server, client.client_id, pkce().challenge, { redirect_uri: "https://evil.example/cb" });
    expect(response.status).toBe(400);
    expect(response.headers.location).toBeUndefined();
  });

  it("requires PKCE S256 and only issues tokens for this MCP server", async () => {
    const server = app();
    const client = await register(server);
    const plain = await authorize(server, client.client_id, "abc", { code_challenge_method: "plain" });
    expect(new URL(plain.headers.location).searchParams.get("error")).toBe("invalid_request");

    const elsewhere = await authorize(server, client.client_id, pkce().challenge, { resource: "https://other.example/mcp" });
    expect(new URL(elsewhere.headers.location).searchParams.get("error")).toBe("invalid_target");
  });

  it("shows the signed-in user who is asking, for what, and where they will be sent", async () => {
    const server = app();
    // Registration is open to anyone, so client metadata is hostile input. The SDK
    // refuses script URLs at the door…
    const hostile = await request(server).post("/oauth/register").send({ client_name: "x", redirect_uris: [REDIRECT], client_uri: "javascript:alert(1)" });
    expect(hostile.status).toBe(400);
    // …and the consent API still only ever hands the page a web link.
    const client = await register(server);
    (await store.getClient(client.client_id))!.metadata.client_uri = "javascript:alert(1)";
    const redirect = await authorize(server, client.client_id, pkce().challenge);
    const id = new URL(redirect.headers.location, "https://realist.ca").searchParams.get("request");

    const details = await request(server).get(`/api/oauth/requests/${id}`);
    expect(details.body.client).toEqual({ name: "Claude", uri: null, redirect: { display: "claude.ai", kind: "known", knownAs: "Claude" } });
    expect(details.body.scopes.map((scope: any) => [scope.id, scope.actsForYou])).toEqual([
      ["read", false], ["underwrite", false], ["deal:submit", true], ["community:write", true],
    ]);

    sessionUserId = null;
    expect((await request(server).get(`/api/oauth/requests/${id}`)).status).toBe(401);
    expect((await request(server).post(`/api/oauth/requests/${id}/approve`).send({ scopes: ["read"] })).status).toBe(401);
  });

  it("flags redirect targets it does not recognise", () => {
    expect(describeRedirect("https://claude.ai/api/mcp/auth_callback").kind).toBe("known");
    expect(describeRedirect("http://127.0.0.1:33418/callback")).toEqual({ display: "an app on this computer", kind: "local" });
    expect(describeRedirect("cursor://anysphere.cursor-mcp/oauth/callback").kind).toBe("local");
    expect(describeRedirect("https://claude.ai.evil.example/cb")).toEqual({ display: "claude.ai.evil.example", kind: "unknown" });
  });

  it("lets the user deny, and treats every decision as single-use", async () => {
    const server = app();
    const client = await register(server);
    const redirect = await authorize(server, client.client_id, pkce().challenge);
    const id = new URL(redirect.headers.location, "https://realist.ca").searchParams.get("request");

    const denied = await request(server).post(`/api/oauth/requests/${id}/deny`);
    const target = new URL(denied.body.redirectTo);
    expect(target.origin + target.pathname).toBe(REDIRECT);
    expect(target.searchParams.get("error")).toBe("access_denied");
    expect(target.searchParams.get("state")).toBe("xyz");

    expect((await request(server).post(`/api/oauth/requests/${id}/approve`).send({ scopes: ["read"] })).status).toBe(404);
  });

  it("blocks approval attempts posted from another origin", async () => {
    const server = app();
    const client = await register(server);
    const redirect = await authorize(server, client.client_id, pkce().challenge);
    const id = new URL(redirect.headers.location, "https://realist.ca").searchParams.get("request");

    const response = await request(server).post(`/api/oauth/requests/${id}/approve`).set("Origin", "https://evil.example").send({ scopes: ["read"] });
    expect(response.status).toBe(403);
    expect(await store.getPending(id!)).not.toBeNull();
  });

  it("falls back to read + underwrite when a client asks for nothing it may have", () => {
    expect(normalizeRequestedScopes(undefined)).toEqual(["read", "underwrite"]);
    expect(normalizeRequestedScopes(["partner:referrals", "admin"])).toEqual(["read", "underwrite"]);
    expect(normalizeRequestedScopes(["read", "read", "deal:submit"])).toEqual(["read", "deal:submit"]);
  });
});

describe("tokens", () => {
  it("exchanges the code for a 1-hour access token and a refresh token, limited to what the user ticked", async () => {
    const { token } = await connect(app(), ["read", "underwrite"]);

    expect(token.status).toBe(200);
    expect(token.headers["cache-control"]).toBe("no-store");
    expect(token.body).toMatchObject({ token_type: "Bearer", expires_in: 3600, scope: "read underwrite" });
    expect(token.body.access_token).toMatch(/^realist_oat_/);
    expect(token.body.refresh_token).toMatch(/^realist_ort_/);
    // Only hashes are stored.
    expect(await store.getToken(sha256(token.body.access_token))).toMatchObject({ kind: "access" });
    expect(await store.getToken(token.body.access_token)).toBeNull();
  });

  it("rejects a wrong PKCE verifier, and burns the connection if a code is replayed", async () => {
    const server = app();
    const client = await register(server);
    const { challenge } = pkce();
    const redirect = await authorize(server, client.client_id, challenge);
    const id = new URL(redirect.headers.location, "https://realist.ca").searchParams.get("request");
    const approval = await request(server).post(`/api/oauth/requests/${id}/approve`).send({ scopes: ["read"] });
    const code = new URL(approval.body.redirectTo).searchParams.get("code");

    const wrong = await request(server).post("/oauth/token").type("form").send({ grant_type: "authorization_code", client_id: client.client_id, code, code_verifier: "not-the-verifier-not-the-verifier-not-the-verifier" });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error).toBe("invalid_grant");

    const first = await connect(server);
    const replay = await request(server).post("/oauth/token").type("form").send({ grant_type: "authorization_code", client_id: first.client.client_id, code: first.code, code_verifier: first.verifier });
    expect(replay.body.error).toBe("invalid_grant");
    // The tokens minted by the first, legitimate exchange die with the grant.
    expect((await callMcp(server, first.token.body.access_token, rpc("tools/list"))).status).toBe(401);
  });

  it("checks a confidential client's secret against the stored hash", async () => {
    const server = app();
    const client = await register(server, { token_endpoint_auth_method: "client_secret_post" });
    const form = { grant_type: "refresh_token", client_id: client.client_id, refresh_token: "realist_ort_nope" };

    expect((await request(server).post("/oauth/token").type("form").send(form)).status).toBe(401);
    expect((await request(server).post("/oauth/token").type("form").send({ ...form, client_secret: "wrong" })).body.error).toBe("invalid_client");
    // Right secret: gets past client auth and fails on the (bogus) token instead.
    const authed = await request(server).post("/oauth/token").type("form").send({ ...form, client_secret: client.client_secret });
    expect(authed.body.error).toBe("invalid_grant");
  });

  it("rotates refresh tokens; a replay right away fails quietly, a late one revokes the connection", async () => {
    const server = app();
    const { client, token } = await connect(server);
    const refresh = (refreshToken: string) =>
      request(server).post("/oauth/token").type("form").send({ grant_type: "refresh_token", client_id: client.client_id, refresh_token: refreshToken });

    const rotated = await refresh(token.body.refresh_token);
    expect(rotated.status).toBe(200);
    expect(rotated.body.refresh_token).not.toBe(token.body.refresh_token);

    // A client retrying after a dropped response: refused, but still connected.
    expect((await refresh(token.body.refresh_token)).body.error).toBe("invalid_grant");
    expect((await callMcp(server, rotated.body.access_token, rpc("tools/list"))).status).toBe(200);

    // The same spent token turning up later is what theft looks like.
    (await store.getToken(sha256(token.body.refresh_token)))!.revokedAt = new Date(Date.now() - 5 * 60 * 1000);
    expect((await refresh(token.body.refresh_token)).body.error).toBe("invalid_grant");
    expect((await callMcp(server, rotated.body.access_token, rpc("tools/list"))).status).toBe(401);
  });

  it("will not widen scopes on refresh", async () => {
    const server = app();
    const { client, token } = await connect(server, ["read"]);
    const response = await request(server).post("/oauth/token").type("form").send({ grant_type: "refresh_token", client_id: client.client_id, refresh_token: token.body.refresh_token, scope: "read underwrite" });
    expect(response.body.error).toBe("invalid_scope");
  });
});

describe("using the connection", () => {
  it("runs MCP tools as the user, scoped to what they approved, metered per connected app", async () => {
    const server = app();
    const { token } = await connect(server, ["read"]);
    const accessToken = token.body.access_token;

    const list = await callMcp(server, accessToken, rpc("tools/list"));
    const names = list.body.result.tools.map((tool: any) => tool.name);
    expect(names).toContain("realist_find_deals");
    expect(names).not.toContain("realist_underwrite_custom");

    const whoami = await callMcp(server, accessToken, rpc("tools/call", { name: "realist_whoami", arguments: {} }));
    const body = JSON.parse(whoami.body.result.content[0].text);
    expect(body).toMatchObject({ ok: true, scopes: ["read"] });
    expect(body.keyId).toMatch(/^oauth:/);
    expect(mocks.usageRows.at(-1)).toMatchObject({ userId: "user-1", endpoint: "mcp:realist_whoami", status: 200, inputSummary: null });
    expect(mocks.usageRows.at(-1).apiKeyId).toBe(body.keyId);

    const denied = await callMcp(server, accessToken, rpc("tools/call", { name: "realist_underwrite_custom", arguments: { address: "x", price: 1 } }));
    expect(JSON.parse(denied.body.result.content[0].text).error).toBe("scope_required");
  });

  it("refuses garbage, expired and wrong-audience tokens", async () => {
    const server = app();
    expect((await callMcp(server, "realist_oat_made-up", rpc("tools/list"))).status).toBe(401);

    const { token } = await connect(server);
    (await store.getToken(sha256(token.body.access_token)))!.expiresAt = new Date(Date.now() - 1000);
    expect((await callMcp(server, token.body.access_token, rpc("tools/list"))).status).toBe(401);

    // A refresh token is not an access token.
    expect((await callMcp(server, token.body.refresh_token, rpc("tools/list"))).status).toBe(401);
  });

  it("lists connected apps and disconnects them, for their owner only", async () => {
    const server = app();
    const { token } = await connect(server, ["read", "underwrite"]);

    const apps = await request(server).get("/api/oauth/grants");
    expect(apps.body.grants).toHaveLength(1);
    expect(apps.body.grants[0]).toMatchObject({ clientName: "Claude", scopes: ["read", "underwrite"] });
    const grantId = apps.body.grants[0].id;

    sessionUserId = "someone-else";
    expect((await request(server).get("/api/oauth/grants")).body.grants).toEqual([]);
    expect((await request(server).delete(`/api/oauth/grants/${grantId}`)).status).toBe(404);

    sessionUserId = "user-1";
    expect((await request(server).delete(`/api/oauth/grants/${grantId}`)).body).toEqual({ revoked: true });
    expect((await callMcp(server, token.body.access_token, rpc("tools/list"))).status).toBe(401);
    expect((await request(server).get("/api/oauth/grants")).body.grants).toEqual([]);
  });

  it("lets the client end the connection by revoking its refresh token", async () => {
    const server = app();
    const { client, token } = await connect(server);
    const revoked = await request(server).post("/oauth/revoke").type("form").send({ client_id: client.client_id, token: token.body.refresh_token });
    expect(revoked.status).toBe(200);
    expect((await callMcp(server, token.body.access_token, rpc("tools/list"))).status).toBe(401);
  });

  it("reconnecting the same app updates the one connection instead of stacking duplicates", async () => {
    const server = app();
    const client = await register(server);
    for (const scopes of [["read"], ["read", "underwrite"]]) {
      const { verifier, challenge } = pkce();
      const redirect = await authorize(server, client.client_id, challenge);
      const id = new URL(redirect.headers.location, "https://realist.ca").searchParams.get("request");
      const approval = await request(server).post(`/api/oauth/requests/${id}/approve`).send({ scopes });
      const code = new URL(approval.body.redirectTo).searchParams.get("code");
      await request(server).post("/oauth/token").type("form").send({ grant_type: "authorization_code", client_id: client.client_id, code, code_verifier: verifier });
    }
    const apps = await request(server).get("/api/oauth/grants");
    expect(apps.body.grants).toHaveLength(1);
    expect(apps.body.grants[0].scopes).toEqual(["read", "underwrite"]);
  });
});
