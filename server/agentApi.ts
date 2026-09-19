/**
 * Agent API — bearer-token authenticated REST endpoints used by the
 * @realist/mcp Model Context Protocol server and other AI-agent integrations.
 *
 * All routes are mounted under /api/agent/* and require an
 *   Authorization: Bearer realist_live_<token>
 * header. Keys are minted by users at /account/api-keys and stored as
 * SHA-256 hashes.
 *
 * Legacy underwrite / find-deals / rent / analyses routes are thin wrappers
 * over the shared registry (server/agent/tools.ts), which is also what the
 * hosted MCP endpoint (/mcp) and the versioned REST API (/api/v1) serve.
 *
 * Specialist spine routes (jobs, forms, listing extract, Realist CRM) live
 * here as well — they share bearer auth + scopes from @shared/agentSpine.
 */
import type { Express, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { eq, and, isNull, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { storage } from "./storage";
import { apiKeys } from "@shared/schema";
import {
  AGENT_API_SCOPE_SET,
  createAgentJobRequestSchema,
  crmUpdateInputSchema,
  scopesForJobType,
  underwriteCustomInputSchema,
  underwriteListingInputSchema,
} from "@shared/agentSpine";
import { AGENT_API_OPENAPI } from "@shared/agentOpenApi";
import {
  FormFillError,
  fillForm,
  formsFillInputSchema,
  getFormMap,
  listFormMaps,
} from "@shared/forms";
import {
  ListingExtractError,
  listExtractors,
  listingExtractInputSchema,
} from "@shared/listingExtract";
import { extractListing } from "./listingExtract";
import {
  applyCrmUpdate,
  getAgentCrmContact,
  listAgentCrmContacts,
  previewCrmUpdate,
} from "./agentCrm";
import { BrowserActError, previewBrowserAct, runBrowserAct } from "./browserAct";
import { browserActInputSchema, listBrowserPlaybooks } from "@shared/browserAct";
import { isAuthenticated } from "./auth";
import { agentRateLimit, usageMeter, getUsageSummaryForUser } from "./services/usage";
import {
  AGENT_API_SCOPES,
  DEFAULT_AGENT_API_SCOPES,
  AgentToolError,
  type AgentApiScope,
  type AgentChannel,
  type AgentContext,
} from "./agent/context";
import { getAgentTool, invokeAgentTool } from "./agent/tools";
import { fallbackMonthlyRent, resolveBuyHoldInputs, runAgentUnderwriting } from "./agent/underwriting";
import {
  AgentJobError,
  approveAgentJob,
  cancelAgentJob,
  createAgentJob,
  getAgentJob,
  listAgentJobs,
  registerSpecialistExecutor,
  serializeAgentJob,
} from "./agentJobs";

export { AGENT_API_SCOPES, DEFAULT_AGENT_API_SCOPES, type AgentApiScope };

// ---------- key helpers ----------
const KEY_PREFIX = "realist_live_";
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

function hasAnyScope(req: Request, scopes: AgentApiScope[]): boolean {
  return scopes.some((scope) => req.agentScopes?.includes(scope));
}

function requireScope(scope: AgentApiScope) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.agentScopes?.includes(scope)) {
      return res.status(403).json({
        error: "scope_required",
        requiredScope: scope,
        message: `This API key needs the ${scope} scope.`,
      });
    }
    next();
  };
}

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

function listingCurrencyFields(input: { currency?: string; fxToCad?: number; price: number }) {
  const currency = input.currency?.toUpperCase() || "CAD";
  const fxToCad = input.fxToCad ?? null;
  const priceCad = (() => {
    if (typeof input.fxToCad === "number" && Number.isFinite(input.fxToCad)) {
      return Math.round(input.price * input.fxToCad);
    }
    return currency === "CAD" ? Math.round(input.price) : null;
  })();
  const warnings: string[] = [];
  if (currency !== "CAD" && input.fxToCad == null) {
    warnings.push("Metrics are in listing currency. Pass fxToCad to add a CAD companion price; FX is never invented.");
  }
  return { currency, fxToCad, priceCad, warnings };
}

// ---------- underwriting math ----------
/**
 * Synchronous underwrite for callers that already hold the numbers (the
 * on-site Ask Realist chat). Runs the same buy & hold engine as the agent
 * tools and the web analyzer; rent falls back to a rough per-bedroom figure
 * when omitted. `expenseRatio` is the ALL-IN operating expense ratio.
 *
 * Currency is native to the listing. FX is never invented — pass fxToCad
 * for a CAD companion price.
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
  currency?: string;
  fxToCad?: number;
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
  const underwriting = runAgentUnderwriting(inputs, { units, rent, notes }).underwriting;
  const currency = listingCurrencyFields({ currency: input.currency, fxToCad: input.fxToCad, price });
  return {
    ...underwriting,
    warnings: [...(underwriting.warnings || []), ...currency.warnings],
    currency: currency.currency,
    fxToCad: currency.fxToCad,
    priceCad: currency.priceCad,
  };
}

export class AgentCapabilityError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message || code);
    this.name = "AgentCapabilityError";
  }
}

/** Shared listing underwrite used by underwrite.listing jobs (CREA DDF CA). */
export async function executeListingUnderwrite(
  input: z.infer<typeof underwriteListingInputSchema>,
  userId: string,
) {
  const { isDdfConfigured, searchDdfByMlsNumber, normalizeDdfListing } = await import("./creaDdf");
  if (!isDdfConfigured()) {
    throw new AgentCapabilityError(503, "ddf_not_configured", "CREA DDF feed is unavailable");
  }
  const ddfListing = await searchDdfByMlsNumber(input.mlsNumber.replace(/[^a-zA-Z0-9]/g, ""));
  if (!ddfListing) {
    throw new AgentCapabilityError(404, "listing_not_found", undefined, { mlsNumber: input.mlsNumber });
  }
  const listing: any = normalizeDdfListing(ddfListing);
  const price = typeof listing.listPrice === "string" ? parseFloat(listing.listPrice) : listing.listPrice;
  if (!Number.isFinite(price) || price <= 1) {
    throw new AgentCapabilityError(422, "listing_has_no_price", undefined, { mlsNumber: input.mlsNumber });
  }

  const beds = listing.details?.numBedrooms || 2;
  const units = listing.numberOfUnitsTotal || 1;
  const monthlyRent = input.monthlyRent
    || (listing.totalActualRent && listing.totalActualRent > 0 ? listing.totalActualRent / 12 : undefined);

  const result = underwriteSimple({
    price,
    monthlyRent,
    units,
    beds,
    city: listing.address?.city,
    province: listing.address?.state,
    downPaymentPercent: input.downPaymentPercent,
    interestRate: input.interestRate,
    vacancyRate: input.vacancyRate,
    expenseRatio: input.expenseRatio,
  });

  const inputsJson = {
    mlsNumber: input.mlsNumber,
    strategyType: input.strategyType,
    ...result.assumptions,
    monthlyRent: result.monthlyRent,
    numberOfUnits: result.units,
    purchasePrice: price,
    source: "agent_api",
  };
  const analysis = await storage.createAnalysis({
    countryMode: "CA",
    strategyType: input.strategyType,
    inputsJson,
    resultsJson: result as any,
    userId,
    sessionId: null,
    address: listing.address?.streetAddress || listing.address?.address || null,
    city: listing.address?.city || null,
    province: listing.address?.state || null,
    rentInputs: { monthlyRent: result.monthlyRent, numberOfUnits: result.units },
    vacancyRate: result.assumptions.vacancyRate,
    expenseAssumptions: { expenseRatio: result.assumptions.expenseRatio },
  });

  return {
    analysisId: analysis.id,
    analysisUrl: `https://realist.ca/deal-analyzer?analysisId=${analysis.id}`,
    listing: {
      mlsNumber: input.mlsNumber,
      address: listing.address,
      listPrice: price,
      beds,
      units,
      daysOnMarket: listing.daysOnMarket,
      propertyType: listing.details?.propertyType,
    },
    underwriting: result,
    strategyType: input.strategyType,
  };
}

/** Shared custom underwrite used by underwrite.custom jobs. */
export async function executeCustomUnderwrite(
  input: z.infer<typeof underwriteCustomInputSchema>,
  userId: string,
  options: { persist?: "required" | "optional" } = {},
) {
  const persist = options.persist ?? "required";
  const result = underwriteSimple(input);
  const payload: {
    underwriting: ReturnType<typeof underwriteSimple>;
    strategyType: typeof input.strategyType;
    analysisId: string | null;
    analysisUrl: string | null;
  } = {
    underwriting: result,
    strategyType: input.strategyType,
    analysisId: null,
    analysisUrl: null,
  };
  try {
    if (typeof storage.createAnalysis === "function") {
      const analysis = await storage.createAnalysis({
        countryMode: input.countryMode,
        strategyType: input.strategyType,
        inputsJson: {
          ...input,
          purchasePrice: input.price,
          source: "agent_api",
        },
        resultsJson: result as any,
        userId,
        sessionId: null,
        address: input.address,
        city: input.city || null,
        province: input.province || null,
        rentInputs: { monthlyRent: result.monthlyRent, numberOfUnits: result.units },
        vacancyRate: result.assumptions.vacancyRate,
        expenseAssumptions: { expenseRatio: result.assumptions.expenseRatio },
      });
      payload.analysisId = analysis.id;
      payload.analysisUrl = `https://realist.ca/deal-analyzer?analysisId=${analysis.id}`;
    } else if (persist === "required") {
      throw new Error("createAnalysis unavailable");
    }
  } catch (error) {
    if (persist === "required") throw error;
    // Jobs still return currency-native metrics when analysis persist is unavailable.
  }
  return payload;
}

registerSpecialistExecutor("underwrite.custom", async (input, ctx) => {
  const parsed = underwriteCustomInputSchema.parse(input);
  return executeCustomUnderwrite(parsed, ctx.userId, { persist: "optional" });
});

registerSpecialistExecutor("underwrite.listing", async (input, ctx) => {
  const parsed = underwriteListingInputSchema.parse(input);
  try {
    return await executeListingUnderwrite(parsed, ctx.userId);
  } catch (err: any) {
    if (err instanceof AgentCapabilityError) {
      throw new AgentJobError(err.status, err.code, err.message);
    }
    throw err;
  }
});

registerSpecialistExecutor("listing.extract", async (input) => {
  const parsed = listingExtractInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new AgentJobError(400, "invalid_input", parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  try {
    return await extractListing(parsed.data);
  } catch (err: any) {
    if (err instanceof ListingExtractError) {
      throw new AgentJobError(
        err.code === "listing_not_found" ? 404 : err.code === "blocked_or_login_wall" ? 403 : 422,
        err.code,
        err.message,
      );
    }
    throw err;
  }
});

registerSpecialistExecutor("crm.update", async (input, ctx) => {
  if (ctx.mode === "apply") {
    return applyCrmUpdate(input, ctx.userId, ctx.previousResult);
  }
  return previewCrmUpdate(input, ctx.userId);
});

registerSpecialistExecutor("forms.fill", async (input) => {
  const parsed = formsFillInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new AgentJobError(400, "invalid_input", parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  try {
    return fillForm(parsed.data);
  } catch (err: any) {
    if (err instanceof FormFillError) {
      throw new AgentJobError(400, err.code, err.message);
    }
    throw err;
  }
});

registerSpecialistExecutor("browser.act", async (input, ctx) => {
  try {
    if (ctx.mode === "preview") {
      return previewBrowserAct(input) as unknown as Record<string, unknown>;
    }
    return await runBrowserAct(input, { jobId: ctx.jobId }) as unknown as Record<string, unknown>;
  } catch (err: any) {
    if (err instanceof BrowserActError) {
      throw new AgentJobError(
        err.code === "blocked_or_login_wall" ? 403 : err.code === "invalid_input" || err.code === "action_not_allowed" ? 400 : 503,
        err.code,
        err.message,
      );
    }
    throw err;
  }
});

function jobErrorResponse(res: Response, err: unknown) {
  if (err instanceof AgentJobError) {
    return res.status(err.status).json({ error: err.code, message: err.message });
  }
  console.error("[agent] jobs error:", err);
  return res.status(500).json({ error: "job_failed", message: (err as any)?.message });
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

function registerSpecialistRoutes(app: Express) {
  /** OpenAPI 3 document for the Agent API + jobs spine. */
  app.get("/api/agent/openapi.json", requireScope("read"), (_req, res) => {
    res.json(AGENT_API_OPENAPI);
  });

  /** List registered Ontario / OREA field maps (maps only, no PDF bodies). */
  app.get("/api/agent/forms", requireScope("read"), (_req, res) => {
    res.json({ forms: listFormMaps() });
  });

  /** Field map metadata for one form id. */
  app.get("/api/agent/forms/:formId", requireScope("read"), (req, res) => {
    const map = getFormMap(req.params.formId);
    if (!map) return res.status(404).json({ error: "form_not_found", formId: req.params.formId });
    res.json({ form: map });
  });

  /** Convenience wrapper: create a forms.fill job (always needs_approval). */
  app.post("/api/agent/forms/fill", async (req, res) => {
    try {
      const needed = scopesForJobType("forms.fill");
      if (!hasAnyScope(req, needed)) {
        return res.status(403).json({
          error: "scope_required",
          requiredScope: needed[0],
          requiredScopes: needed,
          message: `This API key needs one of: ${needed.join(", ")}.`,
        });
      }
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const { idempotencyKey, ...input } = body;
      const parsed = formsFillInputSchema.safeParse(input);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.issues });
      const { job, replayed } = await createAgentJob({
        request: {
          type: "forms.fill",
          input: parsed.data,
          idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : undefined,
        },
        userId: req.agentUserId!,
        apiKeyId: req.agentKeyId ?? null,
      });
      res.status(replayed ? 200 : 201).json({ job: serializeAgentJob(job), replayed });
    } catch (err) {
      jobErrorResponse(res, err);
    }
  });

  /** Registered listing URL extractors (Zillow for Earth). */
  app.get("/api/agent/listings/extractors", requireScope("read"), (_req, res) => {
    res.json({ extractors: listExtractors() });
  });

  /** Create a listing.extract job from a public URL, HTML, or MLS number. */
  app.post("/api/agent/listings/extract", async (req, res) => {
    try {
      const needed = scopesForJobType("listing.extract");
      if (!hasAnyScope(req, needed)) {
        return res.status(403).json({
          error: "scope_required",
          requiredScope: needed[0],
          requiredScopes: needed,
          message: `This API key needs one of: ${needed.join(", ")}.`,
        });
      }
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const { idempotencyKey, ...input } = body;
      const parsed = listingExtractInputSchema.safeParse(input);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.issues });
      const { job, replayed } = await createAgentJob({
        request: {
          type: "listing.extract",
          input: parsed.data,
          idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : undefined,
        },
        userId: req.agentUserId!,
        apiKeyId: req.agentKeyId ?? null,
      });
      res.status(replayed ? 200 : 201).json({
        job: serializeAgentJob(job),
        extract: job.result,
        replayed,
      });
    } catch (err) {
      jobErrorResponse(res, err);
    }
  });

  /**
   * Extract a listing URL then underwrite in listing currency.
   * Does not invent FX; pass fxToCad to get a CAD companion price.
   */
  app.post("/api/agent/listings/underwrite-url", async (req, res) => {
    try {
      if (!hasAnyScope(req, ["underwrite", "jobs:write"])) {
        return res.status(403).json({
          error: "scope_required",
          requiredScope: "underwrite",
          requiredScopes: ["underwrite", "jobs:write"],
          message: "This API key needs the underwrite scope.",
        });
      }
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const parsed = listingExtractInputSchema.and(z.object({
        monthlyRent: z.number().positive().optional(),
        downPaymentPercent: z.number().min(0).max(100).optional(),
        interestRate: z.number().min(0).max(25).optional(),
        vacancyRate: z.number().min(0).max(50).optional(),
        expenseRatio: z.number().min(0).max(80).optional(),
        fxToCad: z.number().positive().optional(),
        strategyType: z.enum(["buyHold", "brrr", "flip", "airbnb", "multiplex"]).optional(),
        idempotencyKey: z.string().optional(),
      })).safeParse(body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.issues });
      const { idempotencyKey, monthlyRent, downPaymentPercent, interestRate, vacancyRate, expenseRatio, fxToCad, strategyType, ...extractInput } = parsed.data;

      const extracted = await createAgentJob({
        request: {
          type: "listing.extract",
          input: extractInput,
          idempotencyKey: idempotencyKey ? `${idempotencyKey}:extract` : undefined,
        },
        userId: req.agentUserId!,
        apiKeyId: req.agentKeyId ?? null,
      });
      const extract = extracted.job.result as Record<string, any> | null;
      const address = extract?.property?.address;
      const price = extract?.listing?.listPrice;
      if (!extract || extracted.job.status !== "succeeded" || !address || !Number.isFinite(price) || price <= 0) {
        return res.status(extracted.job.status === "failed" ? 422 : 200).json({
          extractJob: serializeAgentJob(extracted.job),
          underwriteJob: null,
          extract,
          underwriting: null,
          warning: "Extract succeeded but underwrite needs a public list price and address. Missing facts were not invented.",
        });
      }

      const country = extract.property?.country || extractInput.country || "CA";
      const underwritten = await createAgentJob({
        request: {
          type: "underwrite.custom",
          input: {
            address,
            city: extract.property?.city,
            province: extract.property?.province || extract.property?.state || extract.property?.region,
            countryMode: typeof country === "string" && country.length === 2 ? country : "CA",
            price,
            currency: extract.listing?.currency || extractInput.currency,
            fxToCad,
            monthlyRent,
            beds: extract.property?.beds,
            units: extract.property?.units,
            downPaymentPercent,
            interestRate,
            vacancyRate,
            expenseRatio,
            strategyType: strategyType || "buyHold",
          },
          idempotencyKey: idempotencyKey ? `${idempotencyKey}:underwrite` : undefined,
        },
        userId: req.agentUserId!,
        apiKeyId: req.agentKeyId ?? null,
      });

      res.status(201).json({
        extractJob: serializeAgentJob(extracted.job),
        underwriteJob: serializeAgentJob(underwritten.job),
        extract,
        underwriting: underwritten.job.result,
      });
    } catch (err) {
      jobErrorResponse(res, err);
    }
  });

  /** Search the calling user's Realist CRM contacts (no external CRM). */
  app.get("/api/agent/crm/contacts", requireScope("read"), async (req, res) => {
    try {
      const query = typeof req.query.query === "string" ? req.query.query : undefined;
      const contacts = await listAgentCrmContacts(req.agentUserId!, query);
      res.json({ count: contacts.length, contacts });
    } catch (err) {
      jobErrorResponse(res, err);
    }
  });

  /** Create a crm.update upsert job (needs_approval + proposed diff). */
  app.post("/api/agent/crm/contacts/upsert", async (req, res) => {
    try {
      const needed = scopesForJobType("crm.update");
      if (!hasAnyScope(req, needed)) {
        return res.status(403).json({
          error: "scope_required",
          requiredScope: needed[0],
          requiredScopes: needed,
          message: `This API key needs one of: ${needed.join(", ")}.`,
        });
      }
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const { idempotencyKey, ...rest } = body;
      const parsed = crmUpdateInputSchema.safeParse({
        ...rest,
        action: "upsert_contact",
        contact: rest.contact ?? rest,
      });
      if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.issues });
      const { job, replayed } = await createAgentJob({
        request: {
          type: "crm.update",
          input: parsed.data,
          idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : undefined,
        },
        userId: req.agentUserId!,
        apiKeyId: req.agentKeyId ?? null,
      });
      res.status(replayed ? 200 : 201).json({ job: serializeAgentJob(job), proposedDiff: job.result?.proposedDiff, replayed });
    } catch (err) {
      jobErrorResponse(res, err);
    }
  });

  /** Read one owned Realist CRM contact. */
  app.get("/api/agent/crm/contacts/:id", requireScope("read"), async (req, res) => {
    try {
      const contact = await getAgentCrmContact(req.agentUserId!, req.params.id);
      if (!contact) return res.status(404).json({ error: "contact_not_found" });
      res.json({ contact });
    } catch (err) {
      jobErrorResponse(res, err);
    }
  });

  /** Registered listing-portal playbooks (host → allowed public actions). */
  app.get("/api/agent/browser/playbooks", requireScope("read"), (_req, res) => {
    res.json({ playbooks: listBrowserPlaybooks() });
  });

  /** Convenience wrapper: create a browser.act job. Clicks always need_approval. */
  app.post("/api/agent/browser/act", async (req, res) => {
    try {
      const needed = scopesForJobType("browser.act");
      if (!hasAnyScope(req, needed)) {
        return res.status(403).json({
          error: "scope_required",
          requiredScope: needed[0],
          requiredScopes: needed,
          message: `This API key needs one of: ${needed.join(", ")}.`,
        });
      }
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const { idempotencyKey, ...input } = body;
      const parsed = browserActInputSchema.safeParse(input);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.issues });
      const { job, replayed } = await createAgentJob({
        request: {
          type: "browser.act",
          input: parsed.data,
          idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : undefined,
        },
        userId: req.agentUserId!,
        apiKeyId: req.agentKeyId ?? null,
      });
      res.status(replayed ? 200 : 201).json({ job: serializeAgentJob(job), replayed });
    } catch (err) {
      jobErrorResponse(res, err);
    }
  });

  /** Create a specialist job. Idempotent on idempotencyKey per calling user. */
  app.post("/api/agent/jobs", async (req, res) => {
    try {
      const parsed = createAgentJobRequestSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.issues });
      const needed = scopesForJobType(parsed.data.type);
      if (!hasAnyScope(req, needed)) {
        return res.status(403).json({
          error: "scope_required",
          requiredScope: needed[0],
          requiredScopes: needed,
          message: `This API key needs one of: ${needed.join(", ")}.`,
        });
      }
      const { job, replayed } = await createAgentJob({
        request: parsed.data,
        userId: req.agentUserId!,
        apiKeyId: req.agentKeyId ?? null,
      });
      res.status(replayed ? 200 : 201).json({ job: serializeAgentJob(job), replayed });
    } catch (err) {
      jobErrorResponse(res, err);
    }
  });

  /** List the calling user's jobs. */
  app.get("/api/agent/jobs", requireScope("read"), async (req, res) => {
    try {
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || "25"), 10) || 25, 1), 100);
      const jobs = await listAgentJobs(req.agentUserId!, limit);
      res.json({ count: jobs.length, jobs: jobs.map(serializeAgentJob) });
    } catch (err) {
      jobErrorResponse(res, err);
    }
  });

  /** Fetch one job the caller owns. */
  app.get("/api/agent/jobs/:id", requireScope("read"), async (req, res) => {
    try {
      const job = await getAgentJob(req.params.id, req.agentUserId!);
      res.json({ job: serializeAgentJob(job) });
    } catch (err) {
      jobErrorResponse(res, err);
    }
  });

  /** Human approval gate — only valid from needs_approval. */
  app.post("/api/agent/jobs/:id/approve", async (req, res) => {
    try {
      const existing = await getAgentJob(req.params.id, req.agentUserId!);
      const needed = scopesForJobType(existing.type);
      if (!hasAnyScope(req, needed)) {
        return res.status(403).json({
          error: "scope_required",
          requiredScope: needed[0],
          requiredScopes: needed,
          message: `This API key needs one of: ${needed.join(", ")}.`,
        });
      }
      const job = await approveAgentJob(req.params.id, req.agentUserId!);
      res.json({ job: serializeAgentJob(job) });
    } catch (err) {
      jobErrorResponse(res, err);
    }
  });

  /** Cancel a queued, running, or needs_approval job. */
  app.post("/api/agent/jobs/:id/cancel", async (req, res) => {
    try {
      const existing = await getAgentJob(req.params.id, req.agentUserId!);
      const needed = scopesForJobType(existing.type);
      if (!hasAnyScope(req, needed)) {
        return res.status(403).json({
          error: "scope_required",
          requiredScope: needed[0],
          requiredScopes: needed,
          message: `This API key needs one of: ${needed.join(", ")}.`,
        });
      }
      const job = await cancelAgentJob(req.params.id, req.agentUserId!);
      res.json({ job: serializeAgentJob(job) });
    } catch (err) {
      jobErrorResponse(res, err);
    }
  });
}

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

  registerSpecialistRoutes(app);
}
