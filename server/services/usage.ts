/**
 * Agent API governance: per-key rate limiting + usage metering.
 *
 * Mounted on /api/agent/* AFTER bearerAuth (both middlewares rely on
 * req.agentKeyId / req.agentUserId that bearerAuth sets). Every request gets
 * one api_usage_events row — including 429s — so quota disputes and abuse
 * investigations have a complete record. Raw request bodies are never stored.
 * Keys minted with usage-payload consent also record an allowlisted structured
 * summary so underwriting/deal-submit demand can be reconstructed.
 */
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { and, eq, gte, sql as dsql } from "drizzle-orm";
import { db } from "../db";
import { apiUsageEvents } from "@shared/schema";
import { createKeyRateLimiter } from "./rateLimiter";
import { summarizeToolInput } from "../demandLedger";

const INPUT_SUMMARY_POLICY_VERSION = "agent-usage-structured-v1";

function intFromEnv(name: string, fallback: number): number {
  const raw = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

// Free-tier defaults; env-tunable until plan tiers land (Track E2).
const limiter = createKeyRateLimiter({
  perMinute: intFromEnv("AGENT_RATE_LIMIT_PER_MINUTE", 60),
  perDay: intFromEnv("AGENT_RATE_LIMIT_PER_DAY", 2000),
});
setInterval(() => limiter.evictIdle(), 60 * 60 * 1000).unref();

export function agentRateLimit(req: Request, res: Response, next: NextFunction) {
  const keyId = req.agentKeyId;
  if (!keyId) {
    // bearerAuth must run first; refuse rather than fall open un-keyed.
    return res.status(401).json({ error: "missing_bearer_token" });
  }
  const decision = limiter.check(keyId);
  res.setHeader("X-RateLimit-Remaining-Minute", String(decision.remainingMinute));
  res.setHeader("X-RateLimit-Remaining-Day", String(decision.remainingDay));
  if (!decision.allowed) {
    res.setHeader("Retry-After", String(decision.retryAfterSeconds));
    return res.status(429).json({
      error: "rate_limited",
      limit_exceeded: decision.limitExceeded,
      retry_after_seconds: decision.retryAfterSeconds,
      message: `Rate limit exceeded (${decision.limitExceeded} window). Retry after ${decision.retryAfterSeconds}s.`,
    });
  }
  next();
}

function hashInput(body: unknown): string | null {
  if (!body || (typeof body === "object" && Object.keys(body as object).length === 0)) {
    return null;
  }
  try {
    return crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 16);
  } catch {
    return null;
  }
}

export function usageMeter(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on("finish", () => {
    const keyId = req.agentKeyId;
    const userId = req.agentUserId;
    if (!keyId || !userId) return;
    const inputSummary = req.agentStructuredUsageAllowed ? summarizeToolInput(req.body) : null;
    db.insert(apiUsageEvents).values({
      apiKeyId: keyId,
      userId,
      method: req.method.slice(0, 8),
      endpoint: req.baseUrl + req.path,
      status: res.statusCode,
      latencyMs: Date.now() - start,
      inputHash: hashInput(req.body),
      inputSummary: inputSummary as any,
      inputSummaryPolicyVersion: inputSummary ? INPUT_SUMMARY_POLICY_VERSION : null,
    }).catch((err) => {
      console.error("[agent-usage] failed to record usage event:", err?.message || err);
    });
  });
  next();
}

/** Per-key usage rollup for the account dashboard (last `days` days). */
export async function getUsageSummaryForUser(userId: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.select({
    apiKeyId: apiUsageEvents.apiKeyId,
    calls: dsql<number>`count(*)::int`,
    errors: dsql<number>`count(*) filter (where ${apiUsageEvents.status} >= 400)::int`,
    rateLimited: dsql<number>`count(*) filter (where ${apiUsageEvents.status} = 429)::int`,
    avgLatencyMs: dsql<number>`round(avg(${apiUsageEvents.latencyMs}))::int`,
    lastCallAt: dsql<string>`max(${apiUsageEvents.createdAt})`,
  })
    .from(apiUsageEvents)
    .where(and(eq(apiUsageEvents.userId, userId), gte(apiUsageEvents.createdAt, since)))
    .groupBy(apiUsageEvents.apiKeyId);
  return { since: since.toISOString(), days, byKey: rows };
}
