import crypto from "crypto";
import type { Request } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import {
  analysisQualityScores,
  userActivityEvents,
  userInferenceProfiles,
  userSaleEstimatorMetrics,
} from "@shared/schema";

function shortHash(value?: string | null): string | null {
  if (!value) return null;
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 32);
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
      },
      analysisQualityFeatures: quality || null,
      antiSpamFeatures: {
        avgSpamRisk: quality?.avgSpamRisk ?? null,
        excludedAnalysisCount: quality?.excludedCount ?? 0,
      },
      lastFeatureBuildAt: new Date(),
    },
  });
}
