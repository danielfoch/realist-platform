import { and, desc, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dealAnalyses, type DealAnalysis } from "@/lib/db/schema";
import { INVESTMENT_METRIC_DEFAULTS } from "@/lib/underwriting/investmentMetrics";
import { LEARNABLE_FIELDS, RENT_RATIO_FIELD, analysisQuality, editedFields, underwrite, type UnderwriterInputs } from "@/lib/underwriting/underwriter";
import { provinceCode } from "@/lib/leads/routing";
import type { Actor } from "./actor";
import { fsaOf } from "./dealKey";

const KNOWN_LEARNED = new Set<string>([...LEARNABLE_FIELDS, RENT_RATIO_FIELD]);

/** More new deals than this in a day is a script, not a person. */
export const DAILY_NEW_ANALYSIS_CAP = 80;

export interface AnalysisPayload {
  dealKey: string;
  source: "listing" | "manual";
  mlsNumber?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  propertyType?: string | null;
  rentSource?: string | null;
  rentEstimate?: number | null;
  learnedApplied?: string[];
  inputs: UnderwriterInputs;
  defaults: UnderwriterInputs;
  offerPrice?: number | null;
  verdict?: "pursue" | "watch" | "pass" | null;
  isPublic?: boolean;
}

export class AnalysisCapError extends Error {}

/**
 * Log an analysis: one row per person per deal, latest numbers win. The
 * results are always recomputed here — a browser is never trusted with what a
 * deal "returns", since those numbers feed medians other people see.
 */
export async function saveAnalysis(actor: Actor, payload: AnalysisPayload): Promise<{ analysis: DealAnalysis; created: boolean }> {
  const db = getDb();
  const existing = await db
    .select({ id: dealAnalyses.id })
    .from(dealAnalyses)
    .where(and(eq(dealAnalyses.actorKey, actor.key), eq(dealAnalyses.dealKey, payload.dealKey)))
    .limit(1);

  if (existing.length === 0) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(dealAnalyses)
      .where(and(eq(dealAnalyses.actorKey, actor.key), gt(dealAnalyses.createdAt, new Date(Date.now() - 86_400_000))));
    if (count >= DAILY_NEW_ANALYSIS_CAP) throw new AnalysisCapError("daily cap reached");
  }

  const result = underwrite(payload.inputs);
  const edited = editedFields(payload.defaults, payload.inputs);
  const quality = analysisQuality(result, edited);
  const values = {
    userId: actor.user?.id ?? null,
    sessionId: actor.sessionId,
    source: payload.source,
    mlsNumber: payload.mlsNumber?.slice(0, 40) ?? null,
    address: payload.address?.slice(0, 300) ?? null,
    city: payload.city?.trim().slice(0, 120) || null,
    province: provinceCode(payload.province),
    fsa: fsaOf(payload.postalCode),
    propertyType: payload.propertyType?.slice(0, 80) ?? null,
    rentSource: payload.rentSource?.slice(0, 40) ?? null,
    rentEstimate: payload.rentEstimate && payload.rentEstimate > 0 ? payload.rentEstimate : null,
    learnedApplied: (payload.learnedApplied ?? []).filter((field) => KNOWN_LEARNED.has(field)),
    units: Math.round(payload.inputs.units),
    price: payload.inputs.price,
    inputs: payload.inputs as unknown as Record<string, number>,
    defaults: payload.defaults as unknown as Record<string, number>,
    edited: edited as string[],
    monthlyRent: payload.inputs.monthlyRent,
    capRate: result.capRate,
    cashOnCash: result.cashOnCashReturn,
    dscr: result.dscr,
    monthlyCashFlow: result.monthlyCashFlow,
    irr: result.irr,
    offerPrice: payload.offerPrice ?? null,
    quality: quality.score,
    eligible: quality.eligible,
    verdict: payload.verdict ?? null,
    isPublic: payload.isPublic ?? true,
    engineVersion: INVESTMENT_METRIC_DEFAULTS.CALCULATION_VERSION,
  };

  const [analysis] = await db
    .insert(dealAnalyses)
    .values({ actorKey: actor.key, dealKey: payload.dealKey, ...values })
    .onConflictDoUpdate({
      target: [dealAnalyses.actorKey, dealAnalyses.dealKey],
      set: { ...values, updatedAt: new Date() },
    })
    .returning();
  return { analysis, created: existing.length === 0 };
}

/**
 * Work done before signing in follows the person into their account. Where
 * they already analysed the same deal as a member, the member's version stays.
 */
export async function claimAnonymousAnalyses(userId: string, sessionId: string | undefined | null): Promise<void> {
  if (!sessionId) return;
  const db = getDb();
  const anon = `sid:${sessionId}`;
  const member = `user:${userId}`;
  await db.execute(sql`
    DELETE FROM deal_analyses a USING deal_analyses m
    WHERE a.actor_key = ${anon} AND m.actor_key = ${member} AND m.deal_key = a.deal_key
  `);
  await db.update(dealAnalyses).set({ actorKey: member, userId }).where(eq(dealAnalyses.actorKey, anon));
}

export async function listAnalyses(actorKey: string, limit = 100): Promise<DealAnalysis[]> {
  return getDb().select().from(dealAnalyses).where(eq(dealAnalyses.actorKey, actorKey)).orderBy(desc(dealAnalyses.updatedAt)).limit(limit);
}

export async function getAnalysis(actorKey: string, dealKey: string): Promise<DealAnalysis | null> {
  const rows = await getDb()
    .select()
    .from(dealAnalyses)
    .where(and(eq(dealAnalyses.actorKey, actorKey), eq(dealAnalyses.dealKey, dealKey)))
    .limit(1);
  return rows[0] ?? null;
}
