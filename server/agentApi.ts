/**
 * Agent API — bearer-token authenticated REST endpoints used by the
 * @realist/mcp Model Context Protocol server and other AI-agent integrations.
 *
 * All routes are mounted under /api/agent/* and require an
 *   Authorization: Bearer realist_live_<token>
 * header. Keys are minted by users at /account/api-keys and stored as
 * SHA-256 hashes.
 *
 * The endpoints here are thin wrappers: every one of them runs a tool from the
 * shared registry (server/agent/tools.ts), which is also what the hosted MCP
 * endpoint (/mcp) and the versioned REST API (/api/v1) serve. Add or change
 * behaviour in the registry, not in this file.
 */
import type { Express, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { eq, and, isNull, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { apiKeys } from "@shared/schema";
import { isAuthenticated } from "./auth";
import { agentRateLimit, usageMeter, getUsageSummaryForUser } from "./services/usage";
import { AGENT_API_SCOPES, AgentToolError, type AgentApiScope, type AgentChannel, type AgentContext } from "./agent/context";
import { getAgentTool, invokeAgentTool } from "./agent/tools";
import { fallbackMonthlyRent, resolveBuyHoldInputs, runAgentUnderwriting } from "./agent/underwriting";

export { AGENT_API_SCOPES, type AgentApiScope };

// ---------- key helpers ----------
const KEY_PREFIX = "realist_live_";
const AGENT_API_SCOPE_SET = new Set<string>(AGENT_API_SCOPES);
const DEFAULT_AGENT_API_SCOPES: AgentApiScope[] = ["read", "underwrite", "deal:submit"];
const STRUCTURED_USAGE_POLICY_VERSION = "agent-usage-structured-v1";

function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

function generateKey(): { raw: string; prefix: string; hash: string } {
  const random = crypto.randomBytes(24).toString("base64url");
  const raw = `${KEY_PREFIX}${random}`;
  const prefix = raw.slice(0, 16);
  return { raw, prefix, hash: hashKey(raw) };
}

function normalizeScopes(value: unknown): AgentApiScope[] {
  if (!Array.isArray(value) || value.length === 0) return [...DEFAULT_AGENT_API_SCOPES];
  const scopes = value
    .map((scope) => String(scope).trim())
    .filter((scope): scope is AgentApiScope => AGENT_API_SCOPE_SET.has(scope));
  return scopes.length ? Array.from(new Set(scopes)) : [...DEFAULT_AGENT_API_SCOPES];
}

const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.enum(AGENT_API_SCOPES)).optional(),
  structuredUsageConsent: z.boolean().optional(),
});

// ---------- bearer auth middleware ----------
declare global {
  namespace Express {
    interface Request {
      agentUserId?: string;
      agentKeyId?: string;
      agentScopes?: AgentApiScope[];
      agentStructuredUsageAllowed?: boolean;
    }
  }
}

export async function bearerAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = String(req.headers.authorization || "").trim();
    // Harnesses disagree on who adds the scheme: some send the bare key, some
    // "bearer" in lowercase, a few double it up. Accept all of them.
    const token = header.replace(/^(?:bearer\s+)+/i, "").trim();
    if (!token) {
      return res.status(401).json({ error: "missing_bearer_token", message: "Authorization: Bearer <token> required" });
    }
    if (!token.startsWith(KEY_PREFIX)) {
      return res.status(401).json({ error: "invalid_token_format" });
    }
    const hash = hashKey(token);
    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash)).limit(1);
    if (!row || row.revokedAt) {
      return res.status(401).json({ error: "invalid_or_revoked_token" });
    }
    req.agentUserId = row.userId;
    req.agentKeyId = row.id;
    req.agentScopes = normalizeScopes(row.scopes);
    req.agentStructuredUsageAllowed = Boolean((row as any).usagePayloadConsentAt);
    // best-effort lastUsed touch (don't block request)
    db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id)).catch(() => {});
    next();
  } catch (err) {
    console.error("[agent-auth] error:", err);
    res.status(500).json({ error: "auth_check_failed" });
  }
}

// ---------- underwriting math ----------
/**
 * Synchronous underwrite for callers that already hold the numbers (the
 * on-site Ask Realist chat). Runs the same buy & hold engine as the agent
 * tools and the web analyzer; rent falls back to a rough per-bedroom figure
 * when omitted. `expenseRatio` is the ALL-IN operating expense ratio.
 */
export function underwriteSimple(input: {
  price: number;
  monthlyRent?: number;
  units?: number;
  beds?: number;
  city?: string;
  province?: string;
  downPaymentPercent?: number;
  interestRate?: number;
  vacancyRate?: number;
  expenseRatio?: number;
  annualPropertyTax?: number;
}) {
  const price = Number(input.price);
  const units = input.units && input.units > 0 ? input.units : 1;
  const rent = input.monthlyRent && input.monthlyRent > 0
    ? { monthlyRent: input.monthlyRent, source: "provided" as const }
    : { monthlyRent: fallbackMonthlyRent(input.beds, units), source: "fallback_table" as const };
  const { inputs, notes } = resolveBuyHoldInputs({ price, units, rent }, {
    downPaymentPercent: input.downPaymentPercent,
    interestRate: input.interestRate,
    vacancyRate: input.vacancyRate,
    expenseRatio: input.expenseRatio,
    annualPropertyTax: input.annualPropertyTax,
  });
  return runAgentUnderwriting(inputs, { units, rent, notes }).underwriting;
}

// ---------- API key management (session-authenticated) ----------
export function registerApiKeyManagementRoutes(app: Express) {
  app.get("/api/api-keys", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const rows = await db.select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        usagePayloadConsentAt: apiKeys.usagePayloadConsentAt,
        usagePayloadPolicyVersion: apiKeys.usagePayloadPolicyVersion,
        lastUsedAt: apiKeys.lastUsedAt,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
      }).from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt));
      res.json({ keys: rows.map((row) => ({ ...row, scopes: normalizeScopes(row.scopes) })) });
    } catch (err) {
      console.error("[api-keys] list error:", err);
      res.status(500).json({ error: "Failed to list API keys" });
    }
  });

  app.post("/api/api-keys", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const parsed = createApiKeySchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.issues });
      const { name } = parsed.data;
      const scopes = normalizeScopes(parsed.data.scopes);
      const structuredUsageConsent = parsed.data.structuredUsageConsent !== false;
      const { raw, prefix, hash } = generateKey();
      const [row] = await db.insert(apiKeys).values({
        userId,
        name,
        keyPrefix: prefix,
        keyHash: hash,
        scopes,
        usagePayloadConsentAt: structuredUsageConsent ? new Date() : null,
        usagePayloadPolicyVersion: structuredUsageConsent ? STRUCTURED_USAGE_POLICY_VERSION : null,
      }).returning();
      // Return plaintext key ONCE, never again.
      res.json({
        id: row.id,
        name: row.name,
        keyPrefix: row.keyPrefix,
        scopes: normalizeScopes(row.scopes),
        usagePayloadConsentAt: row.usagePayloadConsentAt,
        usagePayloadPolicyVersion: row.usagePayloadPolicyVersion,
        createdAt: row.createdAt,
        key: raw,
      });
    } catch (err) {
      console.error("[api-keys] create error:", err);
      res.status(500).json({ error: "Failed to create API key" });
    }
  });

  app.get("/api/api-keys/usage", isAuthenticated, async (req: any, res) => {
    try {
      const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 90);
      const summary = await getUsageSummaryForUser(req.session.userId, days);
      res.json(summary);
    } catch (err) {
      console.error("[api-keys] usage summary error:", err);
      res.status(500).json({ error: "Failed to load usage summary" });
    }
  });

  /** The signed-in user's hosted agent results (/v/:token pages), newest first. */
  app.get("/api/api-keys/views", isAuthenticated, async (req: any, res) => {
    try {
      const { getAgentViewStore } = await import("./agent/viewStore");
      const { viewUrlForToken } = await import("./agent/viewDocuments");
      const views = await getAgentViewStore().listForUser(req.session.userId, 20);
      res.json({ views: views.map((view) => ({ ...view, url: viewUrlForToken(view.token) })) });
    } catch (err) {
      console.error("[api-keys] views list error:", err);
      res.status(500).json({ error: "Failed to load agent results" });
    }
  });

  app.delete("/api/api-keys/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const result = await db.update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(and(eq(apiKeys.id, req.params.id), eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
        .returning({ id: apiKeys.id });
      if (!result.length) return res.status(404).json({ error: "Key not found" });
      res.json({ revoked: true });
    } catch (err) {
      console.error("[api-keys] revoke error:", err);
      res.status(500).json({ error: "Failed to revoke API key" });
    }
  });
}

// ---------- agent endpoints (bearer-authenticated) ----------

/** Build the per-call context the tool registry expects from an authenticated request. */
export function agentContextFromRequest(req: Request, channel: AgentChannel): AgentContext {
  return {
    userId: req.agentUserId!,
    keyId: req.agentKeyId!,
    scopes: req.agentScopes ?? [],
    channel,
    req,
  };
}

/** Map a tool failure onto the HTTP response — shared by /api/agent and /api/v1. */
export function sendAgentToolError(res: Response, err: unknown, toolName: string): void {
  if (err instanceof AgentToolError) {
    res.status(err.status).json(err.toBody());
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[agent] ${toolName} failed:`, err);
  res.status(500).json({ error: "tool_failed", tool: toolName, message });
}

type InputFromRequest = (req: Request) => unknown;
const fromBody: InputFromRequest = (req) => req.body ?? {};

/**
 * The published /api/agent/* surface. Each entry maps a legacy route onto a
 * registry tool; the response body is the tool result, unchanged.
 */
const LEGACY_ROUTES: Array<{ method: "get" | "post"; path: string; tool: string; input: InputFromRequest }> = [
  { method: "get", path: "/me", tool: "realist_whoami", input: () => ({}) },
  { method: "post", path: "/underwrite/listing", tool: "realist_underwrite_listing", input: fromBody },
  { method: "post", path: "/underwrite/custom", tool: "realist_underwrite_custom", input: fromBody },
  { method: "post", path: "/find-deals", tool: "realist_find_deals", input: (req) => ({ ...(req.body ?? {}), limit: parseInt(String(req.body?.limit)) || undefined }) },
  { method: "post", path: "/estimate-rent", tool: "realist_estimate_rent", input: fromBody },
  { method: "post", path: "/underwrite-multiplex", tool: "realist_underwrite_multiplex", input: fromBody },
  { method: "post", path: "/deal-desk-submit", tool: "realist_submit_to_deal_desk", input: fromBody },
  // Query strings are untyped: an unparseable ?limit= falls back to the default, as it always has.
  { method: "get", path: "/analyses", tool: "realist_list_my_analyses", input: (req) => ({ limit: parseInt(String(req.query.limit)) || undefined }) },
  { method: "get", path: "/analyses/:id", tool: "realist_get_analysis", input: (req) => ({ id: req.params.id }) },
  { method: "post", path: "/community/submit", tool: "realist_submit_for_review", input: fromBody },
  { method: "get", path: "/mortgage-rates", tool: "realist_get_mortgage_rates", input: () => ({}) },
  { method: "get", path: "/market-report", tool: "realist_get_market_report", input: (req) => ({ city: typeof req.query.city === "string" && req.query.city.trim() ? req.query.city : undefined }) },
  { method: "get", path: "/referrals/:outcomeId", tool: "realist_get_referral", input: (req) => ({ outcomeId: req.params.outcomeId }) },
  { method: "post", path: "/referrals/:outcomeId", tool: "realist_update_referral", input: (req) => ({ ...(req.body ?? {}), outcomeId: req.params.outcomeId }) },
];

export function registerAgentRoutes(app: Express) {
  // Every /api/agent/* request: authenticate the key, enforce per-key rate
  // limits, and record a usage event (including 429s and errors).
  app.use("/api/agent", bearerAuth, agentRateLimit, usageMeter);

  for (const route of LEGACY_ROUTES) {
    const tool = getAgentTool(route.tool);
    if (!tool) throw new Error(`[agent] legacy route ${route.path} points at unknown tool ${route.tool}`);
    app[route.method](`/api/agent${route.path}`, async (req, res) => {
      try {
        res.json(await invokeAgentTool(agentContextFromRequest(req, "rest"), tool, route.input(req)));
      } catch (err) {
        sendAgentToolError(res, err, tool.name);
      }
    });
  }
}
