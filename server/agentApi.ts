/**
 * Agent API — bearer-token authenticated REST endpoints used by the
 * @realist/mcp Model Context Protocol server and other AI-agent integrations.
 *
 * All routes are mounted under /api/agent/* and require an
 *   Authorization: Bearer realist_live_<token>
 * header. Keys are minted by users at /account/api-keys and stored as
 * SHA-256 hashes.
 */
import type { Express, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { eq, and, isNull, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { storage } from "./storage";
import { apiKeys, analyses, propertyAnalyses, users } from "@shared/schema";
import { calculateInvestmentMetrics } from "@shared/investmentMetrics";
import { isAuthenticated } from "./auth";
import { agentRateLimit, usageMeter, getUsageSummaryForUser } from "./services/usage";
import { getRentEstimate } from "./rentIntelligence";
import { executeMultiplexUnderwriter, underwriteRequestSchema } from "./multiplexUnderwriter";
import { dealDeskSubmitSchema, submitDealDesk } from "./routes/dealDesk";
import {
  REFERRAL_OUTCOME_ACTIONS,
  getSafeReferralOutcomeForAgent,
  updateReferralOutcomeForAgent,
} from "./referralOutcomes";

// ---------- key helpers ----------
const KEY_PREFIX = "realist_live_";
export const AGENT_API_SCOPES = [
  "read",
  "underwrite",
  "community:write",
  "deal:submit",
  "partner:referrals",
] as const;
export type AgentApiScope = (typeof AGENT_API_SCOPES)[number];
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
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "missing_bearer_token", message: "Authorization: Bearer <token> required" });
    }
    const token = header.slice("Bearer ".length).trim();
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
// Uses the shared `calculateInvestmentMetrics` engine (same one the main app
// analyzer relies on) so MCP/CLI underwriting is the single source of truth
// for cap rate, NOI, monthly cash flow, DSCR, and cash-on-cash return.
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
  const beds = input.beds || 2;

  // Estimate rent if not supplied (very rough fallback by bed count × units).
  let monthlyRent = input.monthlyRent || 0;
  let rentSource: "provided" | "estimated" = "provided";
  if (!monthlyRent) {
    const baseFallback: Record<number, number> = { 0: 1200, 1: 1500, 2: 1800, 3: 2200, 4: 2600, 5: 3000 };
    monthlyRent = (baseFallback[beds] || 1800) * units;
    rentSource = "estimated";
  }

  // The shared engine takes maintenance + management as separate %.
  // To honour callers passing a single `expenseRatio`, we put the whole
  // ratio under `maintenancePercent` and zero out management — the engine
  // sums them for the final operating-expense figure.
  const expenseRatio = input.expenseRatio ?? 35;
  const metrics = calculateInvestmentMetrics(price, {
    monthlyRent,
    unitCount: units,
    vacancyPercent: input.vacancyRate ?? 5,
    maintenancePercent: expenseRatio,
    managementPercent: 0,
    annualPropertyTax: input.annualPropertyTax ?? null,
    downPaymentPercent: input.downPaymentPercent ?? 20,
    interestRate: input.interestRate ?? 5.5,
    amortizationYears: 25,
    rentSource,
  });

  const downPayment = price * ((input.downPaymentPercent ?? 20) / 100);
  const mortgageAmount = price - downPayment;
  // Monthly mortgage payment via amortizing PMT (same formula the engine uses
  // internally for DSCR — recomputed here so we can return it to the caller).
  const monthlyRate = ((input.interestRate ?? 5.5) / 100) / 12;
  const months = 25 * 12;
  const monthlyMortgage = mortgageAmount <= 0
    ? 0
    : monthlyRate <= 0
      ? mortgageAmount / months
      : mortgageAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);

  return {
    price,
    monthlyRent: Math.round(monthlyRent),
    rentSource,
    units,
    annualRent: metrics.annualGrossRent != null ? Math.round(metrics.annualGrossRent) : 0,
    noi: metrics.noi != null ? Math.round(metrics.noi) : 0,
    capRate: metrics.capRate ?? 0,
    downPayment: Math.round(downPayment),
    mortgageAmount: Math.round(mortgageAmount),
    monthlyMortgage: Math.round(monthlyMortgage),
    monthlyCashFlow: metrics.monthlyCashFlow != null ? Math.round(metrics.monthlyCashFlow) : 0,
    annualCashFlow: metrics.monthlyCashFlow != null ? Math.round(metrics.monthlyCashFlow * 12) : 0,
    cashOnCash: metrics.cashOnCashReturn ?? 0,
    dscr: metrics.dscr,
    assumptions: {
      downPaymentPercent: input.downPaymentPercent ?? 20,
      interestRate: input.interestRate ?? 5.5,
      vacancyRate: input.vacancyRate ?? 5,
      expenseRatio,
      amortizationYears: 25,
    },
    calculationVersion: metrics.calculationVersion,
    warnings: metrics.calculationWarnings,
  };
}

// ---------- request schemas ----------
const underwriteListingSchema = z.object({
  mlsNumber: z.string().min(1),
  strategyType: z.enum(["buyHold", "brrr", "flip", "airbnb", "multiplex"]).default("buyHold"),
  monthlyRent: z.number().positive().optional(),
  downPaymentPercent: z.number().min(0).max(100).optional(),
  interestRate: z.number().min(0).max(25).optional(),
  vacancyRate: z.number().min(0).max(50).optional(),
  expenseRatio: z.number().min(0).max(80).optional(),
});

const underwriteCustomSchema = z.object({
  address: z.string().min(1),
  city: z.string().optional(),
  province: z.string().optional(),
  countryMode: z.enum(["CA", "US"]).default("CA"),
  strategyType: z.enum(["buyHold", "brrr", "flip", "airbnb", "multiplex"]).default("buyHold"),
  price: z.number().positive(),
  monthlyRent: z.number().positive().optional(),
  units: z.number().int().positive().optional(),
  beds: z.number().int().nonnegative().optional(),
  downPaymentPercent: z.number().min(0).max(100).optional(),
  interestRate: z.number().min(0).max(25).optional(),
  vacancyRate: z.number().min(0).max(50).optional(),
  expenseRatio: z.number().min(0).max(80).optional(),
});

const submitForReviewSchema = z.object({
  analysisId: z.string().min(1).optional(),
  mlsNumber: z.string().min(1),
  title: z.string().max(180).optional(),
  summary: z.string().max(2000).optional(),
  notes: z.string().max(20000).optional(),
  visibility: z.enum(["public", "private"]).default("public"),
  metrics: z.record(z.any()).optional(),
  assumptions: z.record(z.any()).optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  propertyType: z.string().optional(),
  market: z.string().optional(),
});

const estimateRentSchema = z.object({
  bedrooms: z.union([z.number().int().nonnegative(), z.string().min(1)]),
  city: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  units: z.number().int().min(1).max(100).optional(),
  listingKey: z.string().optional().nullable(),
  analysisId: z.string().optional().nullable(),
}).refine((value) => Boolean(value.city) || (value.lat != null && value.lng != null), {
  message: "Provide city or lat/lng",
});

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
export function registerAgentRoutes(app: Express) {
  // Every /api/agent/* request: authenticate the key, enforce per-key rate
  // limits, and record a usage event (including 429s and errors).
  app.use("/api/agent", bearerAuth, agentRateLimit, usageMeter);

  /** Verify the key works and return the owning user. */
  app.get("/api/agent/me", requireScope("read"), async (req, res) => {
    try {
      const [user] = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      }).from(users).where(eq(users.id, req.agentUserId!)).limit(1);
      res.json({
        ok: true,
        user: user || { id: req.agentUserId },
        keyId: req.agentKeyId,
        scopes: req.agentScopes,
      });
    } catch (err) {
      console.error("[agent] me error:", err);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  /** Underwrite a CREA-listed property by MLS number. */
  app.post("/api/agent/underwrite/listing", requireScope("underwrite"), async (req, res) => {
    try {
      const parsed = underwriteListingSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.issues });
      const input = parsed.data;

      const { isDdfConfigured, searchDdfByMlsNumber, normalizeDdfToRepliersFormat } = await import("./creaDdf");
      if (!isDdfConfigured()) {
        return res.status(503).json({ error: "ddf_not_configured", message: "CREA DDF feed is unavailable" });
      }
      const ddfListing = await searchDdfByMlsNumber(input.mlsNumber.replace(/[^a-zA-Z0-9]/g, ""));
      if (!ddfListing) return res.status(404).json({ error: "listing_not_found", mlsNumber: input.mlsNumber });
      const listing: any = normalizeDdfToRepliersFormat(ddfListing);
      const price = typeof listing.listPrice === "string" ? parseFloat(listing.listPrice) : listing.listPrice;
      if (!Number.isFinite(price) || price <= 1) {
        return res.status(422).json({ error: "listing_has_no_price", mlsNumber: input.mlsNumber });
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

      // Save analysis owned by the API key's user
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
        userId: req.agentUserId!,
        sessionId: null,
        address: listing.address?.streetAddress || listing.address?.address || null,
        city: listing.address?.city || null,
        province: listing.address?.state || null,
        rentInputs: { monthlyRent: result.monthlyRent, numberOfUnits: result.units },
        vacancyRate: result.assumptions.vacancyRate,
        expenseAssumptions: { expenseRatio: result.assumptions.expenseRatio },
      });

      res.json({
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
      });
    } catch (err: any) {
      console.error("[agent] underwrite listing error:", err);
      res.status(500).json({ error: "underwrite_failed", message: err?.message });
    }
  });

  /** Underwrite a custom address with caller-provided price + assumptions. */
  app.post("/api/agent/underwrite/custom", requireScope("underwrite"), async (req, res) => {
    try {
      const parsed = underwriteCustomSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.issues });
      const input = parsed.data;
      const result = underwriteSimple(input);
      const analysis = await storage.createAnalysis({
        countryMode: input.countryMode,
        strategyType: input.strategyType,
        inputsJson: {
          ...input,
          purchasePrice: input.price,
          source: "agent_api",
        },
        resultsJson: result as any,
        userId: req.agentUserId!,
        sessionId: null,
        address: input.address,
        city: input.city || null,
        province: input.province || null,
        rentInputs: { monthlyRent: result.monthlyRent, numberOfUnits: result.units },
        vacancyRate: result.assumptions.vacancyRate,
        expenseAssumptions: { expenseRatio: result.assumptions.expenseRatio },
      });
      res.json({
        analysisId: analysis.id,
        analysisUrl: `https://realist.ca/deal-analyzer?analysisId=${analysis.id}`,
        underwriting: result,
        strategyType: input.strategyType,
      });
    } catch (err: any) {
      console.error("[agent] underwrite custom error:", err);
      res.status(500).json({ error: "underwrite_failed", message: err?.message });
    }
  });

  /** Natural-language deal search over CREA DDF. Internally proxies /api/find-deals logic. */
  app.post("/api/agent/find-deals", requireScope("read"), async (req, res) => {
    try {
      const query = (req.body?.query || "").toString().trim();
      if (!query) return res.status(400).json({ error: "query_required" });
      const limit = Math.min(Math.max(parseInt(req.body?.limit) || 10, 1), 25);

      const baseUrl = process.env.AGENT_INTERNAL_BASE_URL
        || `http://127.0.0.1:${process.env.PORT || 5000}`;
      const upstream = await fetch(`${baseUrl}/api/find-deals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          demandSource: "agent_api",
          demandChannel: "api",
          demandApiKeyId: req.agentKeyId,
          demandUserId: req.agentUserId,
        }),
      });
      if (!upstream.ok) {
        const text = await upstream.text();
        return res.status(upstream.status).json({ error: "find_deals_failed", upstream: text.slice(0, 200) });
      }
      const data: any = await upstream.json();
      const slim = (data.listings || []).slice(0, limit).map((l: any) => ({
        mlsNumber: l.mlsNumber,
        address: l.address,
        listPrice: l.price,
        capRate: l.cap_rate,
        cashOnCash: l.cash_on_cash,
        dealScore: l.deal_score,
        explanation: l.explanation,
        daysOnMarket: l.daysOnMarket,
        units: l.numberOfUnitsTotal,
        url: `https://realist.ca/deal-analyzer?mls=${l.mlsNumber}`,
      }));
      res.json({
        query,
        filters: data.filters_applied,
        total: data.total,
        listings: slim,
      });
    } catch (err: any) {
      console.error("[agent] find-deals error:", err);
      res.status(500).json({ error: "find_deals_failed", message: err?.message });
    }
  });

  /** Rent estimate from the same prediction-ledger-backed engine as /api/intelligence/rent-estimate. */
  app.post("/api/agent/estimate-rent", requireScope("underwrite"), async (req, res) => {
    try {
      const parsed = estimateRentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.issues });
      const input = parsed.data;
      const estimate = await getRentEstimate({
        bedrooms: input.bedrooms,
        city: input.city ?? null,
        province: input.province ?? null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        units: input.units,
        subjectType: input.listingKey ? "listing" : input.analysisId ? "analysis" : "adhoc",
        subjectId: input.listingKey ?? input.analysisId ?? null,
        userId: req.agentUserId ?? null,
      });
      res.json({ success: true, estimate, reason: estimate ? null : "no_data_for_market" });
    } catch (err: any) {
      console.error("[agent] estimate rent error:", err);
      res.status(500).json({ error: "estimate_rent_failed", message: err?.message });
    }
  });

  /** Multiplex underwriter for AI agents. Same engine as /api/multiplex-underwriter, metered under bearer auth. */
  app.post("/api/agent/underwrite-multiplex", requireScope("underwrite"), async (req, res) => {
    try {
      const parsed = underwriteRequestSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.issues });
      const result = await executeMultiplexUnderwriter(parsed.data, {
        userId: req.agentUserId ?? null,
        sessionId: null,
      });
      res.json(result);
    } catch (err: any) {
      console.error("[agent] underwrite multiplex error:", err);
      res.status(500).json({ error: "underwrite_multiplex_failed", message: err?.message });
    }
  });

  /** Submit a deal to Deal Desk from an authorized agent workflow. */
  app.post("/api/agent/deal-desk-submit", requireScope("deal:submit"), async (req, res) => {
    try {
      const parsed = dealDeskSubmitSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.issues });
      const result = await submitDealDesk(parsed.data, {
        req,
        userId: req.agentUserId ?? null,
        sessionId: null,
        source: "agent_api",
        sourcePage: "/api/agent/deal-desk-submit",
      });
      res.json(result);
    } catch (err: any) {
      console.error("[agent] deal desk submit error:", err);
      res.status(500).json({ error: "deal_desk_submit_failed", message: err?.message });
    }
  });

  /** List the calling user's saved underwritings. */
  app.get("/api/agent/analyses", requireScope("read"), async (req, res) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 25, 1), 100);
      const rows = await storage.getAnalysesByUser(req.agentUserId!);
      const slim = rows.slice(0, limit).map((a: any) => ({
        id: a.id,
        createdAt: a.createdAt,
        strategyType: a.strategyType,
        countryMode: a.countryMode,
        address: a.address,
        city: a.city,
        province: a.province,
        mlsNumber: (a.inputsJson as any)?.mlsNumber || null,
        purchasePrice: (a.inputsJson as any)?.purchasePrice || null,
        capRate: (a.resultsJson as any)?.capRate ?? null,
        monthlyCashFlow: (a.resultsJson as any)?.monthlyCashFlow ?? null,
        cashOnCash: (a.resultsJson as any)?.cashOnCash ?? null,
        url: `https://realist.ca/deal-analyzer?analysisId=${a.id}`,
      }));
      res.json({ count: slim.length, totalAvailable: rows.length, analyses: slim });
    } catch (err: any) {
      console.error("[agent] list analyses error:", err);
      res.status(500).json({ error: "list_failed", message: err?.message });
    }
  });

  /** Fetch a single analysis the caller owns. */
  app.get("/api/agent/analyses/:id", requireScope("read"), async (req, res) => {
    try {
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) return res.status(404).json({ error: "not_found" });
      if (analysis.userId !== req.agentUserId) return res.status(403).json({ error: "forbidden" });
      res.json({
        id: analysis.id,
        createdAt: analysis.createdAt,
        strategyType: analysis.strategyType,
        countryMode: analysis.countryMode,
        address: analysis.address,
        city: analysis.city,
        province: analysis.province,
        inputs: analysis.inputsJson,
        results: analysis.resultsJson,
        url: `https://realist.ca/deal-analyzer?analysisId=${analysis.id}`,
      });
    } catch (err: any) {
      console.error("[agent] get analysis error:", err);
      res.status(500).json({ error: "fetch_failed", message: err?.message });
    }
  });

  /** Submit an underwriting to the community feed for upvotes / comments. */
  app.post("/api/agent/community/submit", requireScope("community:write"), async (req, res) => {
    try {
      const parsed = submitForReviewSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.issues });
      const input = parsed.data;

      // If the caller passed an analysisId, hydrate metrics/assumptions from it.
      let metrics: Record<string, any> = input.metrics || {};
      let assumptions: Record<string, any> = input.assumptions || {};
      let city = input.city || null;
      let province = input.province || null;
      if (input.analysisId) {
        const existing = await storage.getAnalysis(input.analysisId);
        if (!existing || existing.userId !== req.agentUserId) {
          return res.status(404).json({ error: "analysis_not_found_or_forbidden" });
        }
        metrics = { ...(existing.resultsJson as any || {}), ...metrics };
        assumptions = { ...(existing.inputsJson as any || {}), ...assumptions };
        city = city || existing.city;
        province = province || existing.province;
      }

      const [created] = await db.insert(propertyAnalyses).values({
        userId: req.agentUserId!,
        listingMlsNumber: input.mlsNumber,
        title: input.title || null,
        summary: input.summary || null,
        userNotes: input.notes || null,
        visibility: input.visibility,
        assumptions: assumptions as any,
        calculatedMetrics: metrics as any,
        city,
        province,
        propertyType: input.propertyType || null,
        market: input.market || null,
        sourceContext: { source: "agent_api", apiKeyId: req.agentKeyId },
      } as any).returning();

      res.json({
        id: created.id,
        listingMlsNumber: created.listingMlsNumber,
        visibility: created.visibility,
        url: `https://realist.ca/listing-intelligence?mls=${input.mlsNumber}`,
      });
    } catch (err: any) {
      console.error("[agent] community submit error:", err);
      res.status(500).json({ error: "submit_failed", message: err?.message });
    }
  });

  /** Mortgage rates (no auth required at the source, but we keep it under the bearer for usage tracking). */
  app.get("/api/agent/mortgage-rates", requireScope("read"), async (_req, res) => {
    try {
      const baseUrl = process.env.AGENT_INTERNAL_BASE_URL
        || `http://127.0.0.1:${process.env.PORT || 5000}`;
      const upstream = await fetch(`${baseUrl}/api/mortgage-rates`);
      if (!upstream.ok) return res.status(upstream.status).json({ error: "rates_unavailable" });
      const data = await upstream.json();
      res.json(data);
    } catch (err: any) {
      console.error("[agent] mortgage rates error:", err);
      res.status(500).json({ error: "rates_failed", message: err?.message });
    }
  });

  /** City-level market report. */
  app.get("/api/agent/market-report", requireScope("read"), async (req, res) => {
    try {
      const city = (req.query.city as string || "").trim();
      const baseUrl = process.env.AGENT_INTERNAL_BASE_URL
        || `http://127.0.0.1:${process.env.PORT || 5000}`;
      const upstream = await fetch(`${baseUrl}/api/market-report/all`);
      if (!upstream.ok) return res.status(upstream.status).json({ error: "report_unavailable" });
      const data: any = await upstream.json();
      if (!city) return res.json({ cities: data });
      const arr: any[] = Array.isArray(data) ? data : (data?.reports || data?.cities || []);
      const match = arr.find((r: any) =>
        (r.city || r.cityName || "").toLowerCase() === city.toLowerCase()
      );
      if (!match) return res.status(404).json({ error: "city_not_found", city });
      res.json(match);
    } catch (err: any) {
      console.error("[agent] market report error:", err);
      res.status(500).json({ error: "report_failed", message: err?.message });
    }
  });

  /** Partner-owned referral outcome surface. This is the first A2A scope. */
  app.get("/api/agent/referrals/:outcomeId", requireScope("partner:referrals"), async (req, res) => {
    try {
      const result = await getSafeReferralOutcomeForAgent(req.params.outcomeId, req.agentUserId!);
      if (!result) return res.status(404).json({ error: "referral_not_found" });
      res.json(result);
    } catch (err: any) {
      console.error("[agent] referral get error:", err);
      res.status(500).json({ error: "referral_fetch_failed", message: err?.message });
    }
  });

  app.post("/api/agent/referrals/:outcomeId", requireScope("partner:referrals"), async (req, res) => {
    try {
      const parsed = z.object({
        action: z.enum(REFERRAL_OUTCOME_ACTIONS),
        closePrice: z.coerce.number().finite().nonnegative().optional(),
        gci: z.coerce.number().finite().positive().optional(),
        lostReason: z.string().trim().min(1).max(500).optional(),
        notes: z.string().trim().max(2000).optional(),
        reportedBy: z.string().trim().max(160).optional(),
      }).strict().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.issues });

      const result = await updateReferralOutcomeForAgent(req.params.outcomeId, req.agentUserId!, parsed.data);
      if (!result) return res.status(404).json({ error: "referral_not_found" });
      res.json(result);
    } catch (err: any) {
      const status = err?.name === "ReferralOutcomeValidationError" ? 400 : 500;
      console.error("[agent] referral update error:", err?.message || err);
      res.status(status).json({
        error: status === 400 ? "invalid_referral_update" : "referral_update_failed",
        message: err?.message,
      });
    }
  });
}
