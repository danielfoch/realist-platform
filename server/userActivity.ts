import crypto from "crypto";
import type { Request } from "express";
import cron from "node-cron";
import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "./db";
import {
  analysisQualityScores,
  analysisUnderwritingComparisons,
  marketSentimentEvents,
  userActivityEvents,
  userInferenceProfiles,
  userSaleEstimatorMetrics,
} from "@shared/schema";

function shortHash(value?: string | null): string | null {
  if (!value) return null;
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 32);
}

const sentimentEventNames = new Set([
  "listing_card_opened",
  "listing_card_reopened",
  "listing_watchlisted",
  "listing_unwatchlisted",
  "listing_shared",
  "listing_hidden",
  "listing_dismissed",
  "listing_compared",
  "listing_saved",
  "saved_listing",
  "listing_notes_added",
  "listing_sentiment_selected",
  "sale_estimate_submitted",
  "sale_estimate_updated",
  "underwriting_started",
  "underwriting_completed",
  "underwriting_inputs_changed",
  "rent_assumption_changed",
  "expense_assumption_changed",
  "financing_assumption_changed",
  "renovation_assumption_changed",
  "exit_price_assumption_changed",
  "strategy_selected",
  "deal_marked_good",
  "deal_marked_bad",
  "deal_marked_watchlist",
  "deal_marked_offer_candidate",
  "deal_saved",
  "deal_exported",
  "deal_shared",
  "analysis_started",
  "analysis_completed",
  "underwriting_opened",
  "underwriting_exported_or_saved",
  "market_filter_used",
  "region_filter_used",
  "property_type_filter_used",
  "price_band_filter_used",
  "yield_filter_used",
  "cap_rate_filter_used",
  "cashflow_filter_used",
]);

function sentimentScore(eventName: string, metadata: Record<string, unknown> | null | undefined): number | null {
  const explicit = metadata?.sentimentScore ?? metadata?.sentiment_score;
  if (typeof explicit === "number" && Number.isFinite(explicit)) return Math.max(-1, Math.min(1, explicit));
  const sentiment = String(metadata?.sentiment || metadata?.selection || "").toLowerCase();
  if (["bullish", "watch", "would_offer", "offer", "good"].includes(sentiment)) return sentiment === "watch" ? 0.4 : 0.8;
  if (["bearish", "pass", "would_not_offer", "bad"].includes(sentiment)) return sentiment === "pass" ? -0.8 : -0.6;
  if (["neutral"].includes(sentiment)) return 0;
  if (["listing_saved", "saved_listing", "listing_watchlisted", "deal_marked_watchlist"].includes(eventName)) return 0.4;
  if (["deal_marked_good", "deal_marked_offer_candidate"].includes(eventName)) return 0.8;
  if (["listing_hidden", "listing_dismissed", "deal_marked_bad"].includes(eventName)) return -0.8;
  return null;
}

function sentimentSource(eventName: string): string {
  if (eventName.startsWith("sale_estimate")) return "sale_prediction";
  if (eventName.includes("sentiment") || eventName.startsWith("deal_marked")) return "user_explicit";
  if (eventName.includes("underwriting") || eventName.includes("analysis")) return "user_behavioral";
  return "user_behavioral";
}

export async function logUserActivity(req: Request | null, event: {
  userId?: string | null;
  sessionId?: string | null;
  eventName: string;
  listingId?: string | null;
  listingKey?: string | null;
  analysisId?: string | null;
  dealId?: string | null;
  source?: string | null;
  sourcePage?: string | null;
  component?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    const ip = req
      ? ((req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || null)
      : null;
    const userAgent = req ? req.headers["user-agent"] || null : null;
    await db.insert(userActivityEvents).values({
      userId: event.userId || null,
      sessionId: event.sessionId || null,
      eventName: event.eventName,
      listingId: event.listingId || null,
      listingKey: event.listingKey || null,
      analysisId: event.analysisId || null,
      dealId: event.dealId || null,
      source: event.source || null,
      sourcePage: event.sourcePage || null,
      component: event.component || null,
      metadata: event.metadata || null,
      hashedIp: shortHash(ip),
      userAgentHash: shortHash(userAgent),
      eventTimestamp: new Date(),
    });
    if (sentimentEventNames.has(event.eventName)) {
      const metadata = event.metadata || null;
      await db.insert(marketSentimentEvents).values({
        userId: event.userId || null,
        sessionId: event.sessionId || null,
        listingId: event.listingId || null,
        listingKey: event.listingKey || null,
        analysisId: event.analysisId || null,
        eventName: event.eventName,
        eventTimestamp: new Date(),
        province: (metadata?.province as string | undefined) || null,
        city: (metadata?.city as string | undefined) || (metadata?.geography as string | undefined) || null,
        neighborhood: (metadata?.neighborhood as string | undefined) || (metadata?.neighbourhood as string | undefined) || null,
        propertyType: (metadata?.property_type as string | undefined) || (metadata?.propertyType as string | undefined) || null,
        priceBand: (metadata?.price_band as string | undefined) || (metadata?.priceBand as string | undefined) || null,
        strategyType: (metadata?.strategy_type as string | undefined) || (metadata?.strategyType as string | undefined) || null,
        source: sentimentSource(event.eventName),
        sentimentScore: sentimentScore(event.eventName, metadata),
        confidenceScore: typeof metadata?.confidenceScore === "number" ? metadata.confidenceScore : null,
        metadata,
      });
    }
  } catch (error) {
    console.error("Failed to log user activity:", error);
  }
}

/** Only users active this recently get a nightly profile rebuild. */
const INFERENCE_ACTIVE_WINDOW_DAYS = 30;
/** Each rebuild is ~7 queries, so cap how many run at once. */
const INFERENCE_REBUILD_CONCURRENCY = 4;

/**
 * Rebuild inference profiles for recently active users.
 *
 * rebuildUserInferenceProfile has always been a capable feature builder with no
 * caller other than an admin route (POST /api/admin/user-inference/rebuild/:userId),
 * so user_inference_profiles sat empty and nothing downstream — lead scoring,
 * digests, notifications — could use preferred markets or bullishness.
 *
 * Scoped to the active window rather than every user who ever signed up: the
 * whole table would be re-derived nightly for people who left, and the cost
 * grows forever.
 */
export async function rebuildActiveUserInferenceProfiles(): Promise<{
  attempted: number;
  rebuilt: number;
  failed: number;
}> {
  const since = new Date(Date.now() - INFERENCE_ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db
    .selectDistinct({ userId: userActivityEvents.userId })
    .from(userActivityEvents)
    .where(and(isNotNull(userActivityEvents.userId), gte(userActivityEvents.eventTimestamp, since)));

  const userIds = rows.map(r => r.userId).filter((id): id is string => !!id);
  let rebuilt = 0;
  let failed = 0;

  for (let i = 0; i < userIds.length; i += INFERENCE_REBUILD_CONCURRENCY) {
    const batch = userIds.slice(i, i + INFERENCE_REBUILD_CONCURRENCY);
    const results = await Promise.allSettled(batch.map(id => rebuildUserInferenceProfile(id)));
    for (const r of results) {
      if (r.status === "fulfilled") rebuilt++;
      else {
        failed++;
        console.error("[user-inference] rebuild failed:", r.reason);
      }
    }
  }

  return { attempted: userIds.length, rebuilt, failed };
}

/** Nightly at 03:30 Toronto / 08:30 UTC — after the 07:00 UTC AI trainer. */
export function scheduleUserInferenceRebuild(): void {
  cron.schedule("30 8 * * *", () => {
    rebuildActiveUserInferenceProfiles()
      .then(({ attempted, rebuilt, failed }) =>
        console.log(`[user-inference] nightly rebuild: ${rebuilt}/${attempted} profiles, ${failed} failed`),
      )
      .catch(err => console.error("[user-inference] nightly rebuild error:", err));
  });
  console.log("[user-inference] Nightly profile rebuild scheduled (3:30am Toronto / 08:30 UTC)");
}

export async function rebuildUserInferenceProfile(userId: string) {
  const [eventCounts] = await db.select({
    promptViews: sql<number>`COUNT(*) FILTER (WHERE ${userActivityEvents.eventName} = 'estimate_prompt_viewed')::int`,
    estimateSubmits: sql<number>`COUNT(*) FILTER (WHERE ${userActivityEvents.eventName} IN ('sale_estimate_submitted', 'sale_estimate_updated'))::int`,
    listingOpens: sql<number>`COUNT(*) FILTER (WHERE ${userActivityEvents.eventName} IN ('listing_card_opened', 'listing_viewed'))::int`,
    underwritingOpens: sql<number>`COUNT(*) FILTER (WHERE ${userActivityEvents.eventName} = 'underwriting_opened')::int`,
    analysesCompleted: sql<number>`COUNT(*) FILTER (WHERE ${userActivityEvents.eventName} = 'analysis_completed')::int`,
  }).from(userActivityEvents).where(eq(userActivityEvents.userId, userId));

  const topMarkets = await db.execute(sql`
    SELECT COALESCE(metadata->>'city', metadata->>'geography') AS market, COUNT(*)::int AS count
    FROM user_activity_events
    WHERE user_id = ${userId}
      AND COALESCE(metadata->>'city', metadata->>'geography') IS NOT NULL
    GROUP BY 1
    ORDER BY count DESC
    LIMIT 10
  `);

  const topPropertyTypes = await db.execute(sql`
    SELECT COALESCE(metadata->>'property_type', metadata->>'propertyType') AS property_type, COUNT(*)::int AS count
    FROM user_activity_events
    WHERE user_id = ${userId}
      AND COALESCE(metadata->>'property_type', metadata->>'propertyType') IS NOT NULL
    GROUP BY 1
    ORDER BY count DESC
    LIMIT 10
  `);

  const [estimatorMetrics] = await db.select().from(userSaleEstimatorMetrics).where(eq(userSaleEstimatorMetrics.userId, userId)).limit(1);
  const [quality] = await db.select({
    avgConfidence: sql<number>`AVG(${analysisQualityScores.confidenceScore})`,
    eligibleCount: sql<number>`COUNT(*) FILTER (WHERE ${analysisQualityScores.leaderboardEligible})::int`,
    excludedCount: sql<number>`COUNT(*) FILTER (WHERE NOT ${analysisQualityScores.leaderboardEligible})::int`,
    avgSpamRisk: sql<number>`AVG(${analysisQualityScores.spamRiskScore})`,
  }).from(analysisQualityScores).where(eq(analysisQualityScores.userId, userId));

  const [sentiment] = await db.select({
    avgSentiment: sql<number>`AVG(${marketSentimentEvents.sentimentScore})`,
    watchlistCount: sql<number>`COUNT(*) FILTER (WHERE ${marketSentimentEvents.eventName} IN ('listing_watchlisted', 'listing_saved', 'deal_marked_watchlist'))::int`,
    offerCandidateCount: sql<number>`COUNT(*) FILTER (WHERE ${marketSentimentEvents.eventName} = 'deal_marked_offer_candidate')::int`,
    bullishCount: sql<number>`COUNT(*) FILTER (WHERE ${marketSentimentEvents.sentimentScore} > 0.25)::int`,
    bearishCount: sql<number>`COUNT(*) FILTER (WHERE ${marketSentimentEvents.sentimentScore} < -0.25)::int`,
  }).from(marketSentimentEvents).where(eq(marketSentimentEvents.userId, userId));

  const [comparison] = await db.select({
    avgYieldDelta: sql<number>`AVG(${analysisUnderwritingComparisons.yieldDelta})`,
    avgRentDeltaCents: sql<number>`AVG(${analysisUnderwritingComparisons.rentDeltaCents})`,
    avgCashflowDeltaCents: sql<number>`AVG(${analysisUnderwritingComparisons.cashflowDeltaCents})`,
    bullishVsAutoCount: sql<number>`COUNT(*) FILTER (WHERE ${analysisUnderwritingComparisons.userMoreBullishThanAuto})::int`,
    bearishVsAutoCount: sql<number>`COUNT(*) FILTER (WHERE ${analysisUnderwritingComparisons.userMoreBearishThanAuto})::int`,
  }).from(analysisUnderwritingComparisons).where(eq(analysisUnderwritingComparisons.userId, userId));

  const promptViews = Number(eventCounts?.promptViews || 0);
  const estimateSubmits = Number(eventCounts?.estimateSubmits || 0);
  const estimateSubmissionRate = promptViews > 0 ? estimateSubmits / promptViews : null;

  await db.insert(userInferenceProfiles).values({
    userId,
    preferredMarkets: topMarkets.rows,
    preferredPropertyTypes: topPropertyTypes.rows,
    estimateSubmissionRate,
    estimatorAccuracyFeatures: estimatorMetrics ? {
      eligibleEstimateCount: estimatorMetrics.eligibleEstimateCount,
      medianAbsolutePercentageError: estimatorMetrics.medianAbsolutePercentageError,
      oracleScore: estimatorMetrics.oracleScore,
      biasPercentage: estimatorMetrics.biasPercentage,
    } : null,
    underwritingAssumptionPatterns: {
      underwritingOpens: Number(eventCounts?.underwritingOpens || 0),
      analysesCompleted: Number(eventCounts?.analysesCompleted || 0),
      averageUserVsAutoYieldDelta: comparison?.avgYieldDelta ?? null,
      averageRentAssumptionDeltaCents: comparison?.avgRentDeltaCents ?? null,
      averageCashflowDeltaCents: comparison?.avgCashflowDeltaCents ?? null,
    },
    analysisQualityFeatures: quality || null,
    antiSpamFeatures: {
      avgSpamRisk: quality?.avgSpamRisk ?? null,
      excludedAnalysisCount: quality?.excludedCount ?? 0,
    },
    lastFeatureBuildAt: new Date(),
  }).onConflictDoUpdate({
    target: userInferenceProfiles.userId,
    set: {
      preferredMarkets: topMarkets.rows,
      preferredPropertyTypes: topPropertyTypes.rows,
      estimateSubmissionRate,
      estimatorAccuracyFeatures: estimatorMetrics ? {
        eligibleEstimateCount: estimatorMetrics.eligibleEstimateCount,
        medianAbsolutePercentageError: estimatorMetrics.medianAbsolutePercentageError,
        oracleScore: estimatorMetrics.oracleScore,
        biasPercentage: estimatorMetrics.biasPercentage,
      } : null,
      underwritingAssumptionPatterns: {
        underwritingOpens: Number(eventCounts?.underwritingOpens || 0),
        analysesCompleted: Number(eventCounts?.analysesCompleted || 0),
        averageUserVsAutoYieldDelta: comparison?.avgYieldDelta ?? null,
        averageRentAssumptionDeltaCents: comparison?.avgRentDeltaCents ?? null,
        averageCashflowDeltaCents: comparison?.avgCashflowDeltaCents ?? null,
        averageSentimentByUser: sentiment?.avgSentiment ?? null,
        bullishVsAutoCount: comparison?.bullishVsAutoCount ?? 0,
        bearishVsAutoCount: comparison?.bearishVsAutoCount ?? 0,
      },
      analysisQualityFeatures: quality || null,
      antiSpamFeatures: {
        avgSpamRisk: quality?.avgSpamRisk ?? null,
        excludedAnalysisCount: quality?.excludedCount ?? 0,
        highRawLowEligiblePattern: Number(quality?.excludedCount || 0) > Number(quality?.eligibleCount || 0),
      },
      lastFeatureBuildAt: new Date(),
    },
  });
}
