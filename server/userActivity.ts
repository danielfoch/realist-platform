import crypto from "crypto";
import type { Request } from "express";
import { eq, sql } from "drizzle-orm";
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
