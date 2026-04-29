import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import {
  listingSaleResolutions,
  propertySaleEstimateRevisions,
  propertySaleEstimates,
  userSaleEstimatorMetrics,
} from "@shared/schema";
import {
  calculateUserSaleEstimatorMetrics,
  shouldConfirmListingAbsence,
  shouldExcludeResolutionFromMetrics,
  validateSaleEstimate,
} from "@shared/salePriceOracle";
import { logUserActivity } from "./userActivity";
import { getSalePriceProviders, type SalePriceLookupListing } from "./salePriceProviders";
import type { Request } from "express";

export const SALE_PRICE_RETRY_DAYS = [0, 3, 7, 14, 30];

function nextLookupAttemptDate(attemptCount: number, status: string): Date | null {
  if (status === "resolved" || status === "not_allowed") return null;
  const maxAttempts = Number(process.env.SALE_PRICE_LOOKUP_MAX_ATTEMPTS || 5);
  if (attemptCount >= maxAttempts) return null;
  const retryDays = SALE_PRICE_RETRY_DAYS[Math.min(attemptCount, SALE_PRICE_RETRY_DAYS.length - 1)] ?? 30;
  return new Date(Date.now() + retryDays * 24 * 60 * 60 * 1000);
}

export async function getCurrentSaleEstimate(userId: string, listingKey: string) {
  const [estimate] = await db.select().from(propertySaleEstimates).where(and(
    eq(propertySaleEstimates.userId, userId),
    eq(propertySaleEstimates.listingKey, listingKey),
  )).limit(1);
  const [resolution] = await db.select().from(listingSaleResolutions).where(eq(listingSaleResolutions.listingKey, listingKey)).limit(1);
  return { estimate: estimate || null, resolution: resolution || null };
}

export async function upsertSaleEstimate(req: Request, input: {
  userId: string;
  listingKey: string;
  listingId?: string | null;
  mlsNumber?: string | null;
  boardListingId?: string | null;
  board?: string | null;
  sourceBoard?: string | null;
  province?: string | null;
  estimatePriceCents: number;
  listPriceCents?: number | null;
  currency?: string;
  estimateContext?: Record<string, unknown> | null;
  confirmedOutOfRange?: boolean;
}) {
  const [resolution] = await db.select().from(listingSaleResolutions).where(eq(listingSaleResolutions.listingKey, input.listingKey)).limit(1);
  const locked = Boolean(resolution?.ddfAbsentSince || resolution?.resolutionStatus === "pending" || resolution?.resolutionStatus === "resolved");
  const validation = validateSaleEstimate({
    estimatePriceCents: input.estimatePriceCents,
    listPriceCents: input.listPriceCents,
    confirmedOutOfRange: input.confirmedOutOfRange,
    locked,
  });
  if (!validation.ok) {
    return { ok: false as const, status: validation.requiresConfirmation ? 409 : 400, error: validation.error, requiresConfirmation: validation.requiresConfirmation };
  }

  const [existing] = await db.select().from(propertySaleEstimates).where(and(
    eq(propertySaleEstimates.userId, input.userId),
    eq(propertySaleEstimates.listingKey, input.listingKey),
  )).limit(1);

  if (existing?.lockedAt || existing?.status === "locked" || existing?.status === "resolved") {
    return { ok: false as const, status: 409, error: "Prediction is locked" };
  }

  if (existing) {
    const estimateMetadata = {
      estimatePriceCents: input.estimatePriceCents,
      estimated_sale_to_list_ratio: input.listPriceCents ? input.estimatePriceCents / input.listPriceCents : null,
      city: input.estimateContext?.city,
      province: input.province || input.estimateContext?.province,
      propertyType: input.estimateContext?.propertyType,
    };
    const [updated] = await db.update(propertySaleEstimates)
      .set({
        estimatePriceCents: input.estimatePriceCents,
        estimateContext: input.estimateContext || existing.estimateContext,
        status: "updated",
        updatedAt: new Date(),
      })
      .where(eq(propertySaleEstimates.id, existing.id))
      .returning();
    await db.insert(propertySaleEstimateRevisions).values({
      estimateId: existing.id,
      userId: input.userId,
      listingKey: input.listingKey,
      previousEstimatePriceCents: existing.estimatePriceCents,
      estimatePriceCents: input.estimatePriceCents,
      revisionReason: "user_update",
      metadata: { source: "listing_card" },
    });
    await logUserActivity(req, {
      userId: input.userId,
      sessionId: req.sessionID,
      eventName: "sale_estimate_updated",
      listingKey: input.listingKey,
      component: "sale_price_prompt",
      metadata: estimateMetadata,
    });
    return { ok: true as const, estimate: updated };
  }

  const [created] = await db.insert(propertySaleEstimates).values({
    userId: input.userId,
    listingId: input.listingId || null,
    listingKey: input.listingKey,
    mlsNumber: input.mlsNumber || null,
    boardListingId: input.boardListingId || null,
    board: input.board || null,
    sourceBoard: input.sourceBoard || null,
    province: input.province || null,
    estimatePriceCents: input.estimatePriceCents,
    currency: input.currency || "CAD",
    estimateContext: input.estimateContext || null,
    status: "active",
  }).returning();

  await db.insert(propertySaleEstimateRevisions).values({
    estimateId: created.id,
    userId: input.userId,
    listingKey: input.listingKey,
    previousEstimatePriceCents: null,
    estimatePriceCents: input.estimatePriceCents,
    revisionReason: "user_submit",
    metadata: { source: "listing_card" },
  });
  await logUserActivity(req, {
    userId: input.userId,
    sessionId: req.sessionID,
    eventName: "sale_estimate_submitted",
    listingKey: input.listingKey,
    component: "sale_price_prompt",
    metadata: {
      estimatePriceCents: input.estimatePriceCents,
      estimated_sale_to_list_ratio: input.listPriceCents ? input.estimatePriceCents / input.listPriceCents : null,
      city: input.estimateContext?.city,
      province: input.province || input.estimateContext?.province,
      propertyType: input.estimateContext?.propertyType,
    },
  });
  return { ok: true as const, estimate: created };
}

export async function markListingsSeenFromActiveFeed(listings: SalePriceLookupListing[]) {
  const now = new Date();
  for (const listing of listings) {
    await db.insert(listingSaleResolutions).values({
      listingKey: listing.listingKey,
      mlsNumber: listing.mlsNumber || null,
      board: listing.board || null,
      province: listing.province || null,
      ddfLastSeenAt: now,
      absenceDetectionCount: 0,
      absenceReason: "still_active",
      resolutionStatus: "not_started",
      excludeFromMetrics: true,
    }).onConflictDoUpdate({
      target: listingSaleResolutions.listingKey,
      set: {
        ddfLastSeenAt: now,
        absenceDetectionCount: 0,
        absenceReason: "still_active",
        updatedAt: now,
      },
    });
  }
}

export async function markListingsAbsent(req: Request | null, listingKeys: string[], reason = "missing_from_feed", options: { force?: boolean } = {}) {
  if (!listingKeys.length) return { lockedEstimateCount: 0 };
  const now = new Date();
  const confirmationHours = Number(process.env.SALE_PRICE_ABSENCE_CONFIRMATION_HOURS || 24);
  const minConsecutiveAbsences = options.force ? 1 : 2;

  await db.insert(listingSaleResolutions).values(listingKeys.map((listingKey) => ({
    listingKey,
    absenceDetectionCount: 0,
    absenceReason: "unknown",
    resolutionStatus: "not_started",
    excludeFromMetrics: true,
  }))).onConflictDoNothing();

  await db.update(listingSaleResolutions)
    .set({
      absenceDetectionCount: sql`${listingSaleResolutions.absenceDetectionCount} + 1`,
      absenceReason: reason,
      updatedAt: now,
    })
    .where(inArray(listingSaleResolutions.listingKey, listingKeys));

  const candidates = await db.select().from(listingSaleResolutions).where(inArray(listingSaleResolutions.listingKey, listingKeys));
  const confirmedKeys = candidates
    .filter((row) => shouldConfirmListingAbsence({
      force: options.force,
      absenceDetectionCount: row.absenceDetectionCount || 0,
      ddfAbsentSince: row.ddfAbsentSince,
      ddfLastSeenAt: row.ddfLastSeenAt,
      now,
      minConsecutiveAbsences,
      confirmationHours,
    }))
    .map((row) => row.listingKey);

  if (!confirmedKeys.length) return { lockedEstimateCount: 0 };

  await db.update(listingSaleResolutions)
    .set({
      ddfAbsentSince: sql`COALESCE(${listingSaleResolutions.ddfAbsentSince}, now())`,
      absenceReason: reason,
      resolutionStatus: "pending",
      nextLookupAttemptAt: now,
      updatedAt: now,
    })
    .where(inArray(listingSaleResolutions.listingKey, confirmedKeys));

  const locked = await db.update(propertySaleEstimates)
    .set({ status: "locked", lockedAt: now, updatedAt: now })
    .where(and(inArray(propertySaleEstimates.listingKey, confirmedKeys), sql`${propertySaleEstimates.lockedAt} IS NULL`))
    .returning();

  for (const estimate of locked) {
    await logUserActivity(req, {
      userId: estimate.userId,
      eventName: "sale_estimate_locked",
      listingKey: estimate.listingKey,
      component: "ddf_absence_detection",
      metadata: { reason },
    });
  }
  for (const listingKey of confirmedKeys) {
    await logUserActivity(req, {
      eventName: "listing_marked_absent_from_ddf",
      listingKey,
      component: "ddf_absence_detection",
      metadata: { reason },
    });
    await logUserActivity(req, {
      eventName: "sold_price_lookup_queued",
      listingKey,
      component: "sale_price_resolver",
    });
  }

  return { lockedEstimateCount: locked.length };
}

export async function lookupSoldPriceForListing(req: Request | null, listingKey: string) {
  const [resolution] = await db.select().from(listingSaleResolutions).where(eq(listingSaleResolutions.listingKey, listingKey)).limit(1);
  if (!resolution) return null;
  if (process.env.ENABLE_SOLD_PRICE_RESOLUTION !== "true") {
    const attemptCount = (resolution.lookupAttemptCount || 0) + 1;
    await db.update(listingSaleResolutions).set({
      resolutionStatus: "unavailable",
      actualSalePriceCents: null,
      sourceType: "unavailable",
      sourceName: "Resolution disabled",
      excludeFromMetrics: true,
      lookupAttemptCount: attemptCount,
      lastLookupAttemptAt: new Date(),
      nextLookupAttemptAt: nextLookupAttemptDate(attemptCount, "unavailable"),
      updatedAt: new Date(),
    }).where(eq(listingSaleResolutions.id, resolution.id));
    await logUserActivity(req, { eventName: "sold_price_unavailable", listingKey, component: "sale_price_resolver", metadata: { reason: "disabled" } });
    return { status: "unavailable" };
  }

  const listing = {
    listingKey,
    mlsNumber: resolution.mlsNumber,
    board: resolution.board,
    province: resolution.province,
  };
  await logUserActivity(req, { eventName: "sold_price_lookup_attempted", listingKey, component: "sale_price_resolver" });
  for (const provider of getSalePriceProviders()) {
    if (!provider.isEnabled() || !provider.supports(listing)) continue;
    const result = await provider.lookupSoldPrice(listing);
    const attemptCount = (resolution.lookupAttemptCount || 0) + 1;
    const excludeFromMetrics = shouldExcludeResolutionFromMetrics({
      resolutionStatus: result.status,
      actualSalePriceCents: result.actualSalePriceCents || null,
    });
    await db.update(listingSaleResolutions).set({
      resolutionStatus: result.status,
      actualSalePriceCents: result.actualSalePriceCents || null,
      soldDate: result.soldDate || null,
      sourceType: result.sourceType,
      sourceName: result.sourceName,
      sourceUrl: result.sourceUrl || null,
      sourceConfidence: result.confidence != null ? String(result.confidence) : null,
      excludeFromMetrics,
      errorMessage: result.errorMessage || null,
      lookupAttemptCount: attemptCount,
      lastLookupAttemptAt: new Date(),
      nextLookupAttemptAt: nextLookupAttemptDate(attemptCount, result.status),
      updatedAt: new Date(),
    }).where(eq(listingSaleResolutions.id, resolution.id));
    await logUserActivity(req, {
      eventName: result.status === "resolved" ? "sold_price_resolved" : "sold_price_unavailable",
      listingKey,
      component: "sale_price_resolver",
      metadata: { provider: provider.name, status: result.status },
    });
    if (result.status === "resolved") await recalculateEstimatorMetricsForListing(listingKey);
    return result;
  }
  return { status: "unavailable" };
}

export async function manuallyResolveSoldPrice(req: Request, input: {
  listingKey: string;
  actualSalePriceCents: number | null;
  soldDate?: Date | null;
  sourceName: string;
  sourceConfidence?: number | null;
  unavailable?: boolean;
}) {
  const status = input.unavailable ? "unavailable" : "resolved";
  const actual = status === "resolved" && input.actualSalePriceCents && input.actualSalePriceCents > 0
    ? input.actualSalePriceCents
    : null;
  const finalStatus = actual ? "resolved" : "unavailable";
  const excludeFromMetrics = shouldExcludeResolutionFromMetrics({ resolutionStatus: finalStatus, actualSalePriceCents: actual });
  await db.insert(listingSaleResolutions).values({
    listingKey: input.listingKey,
    resolutionStatus: finalStatus,
    actualSalePriceCents: actual,
    soldDate: input.soldDate || null,
    sourceType: "manual_admin",
    sourceName: input.sourceName,
    sourceConfidence: input.sourceConfidence != null ? String(input.sourceConfidence) : null,
    excludeFromMetrics,
  }).onConflictDoUpdate({
    target: listingSaleResolutions.listingKey,
    set: {
      resolutionStatus: finalStatus,
      actualSalePriceCents: actual,
      soldDate: input.soldDate || null,
      sourceType: "manual_admin",
      sourceName: input.sourceName,
      sourceConfidence: input.sourceConfidence != null ? String(input.sourceConfidence) : null,
      excludeFromMetrics,
      updatedAt: new Date(),
    },
  });
  await db.update(propertySaleEstimates)
    .set({ status: finalStatus === "resolved" ? "resolved" : "excluded", resolvedAt: new Date(), lockedAt: sql`COALESCE(${propertySaleEstimates.lockedAt}, now())`, updatedAt: new Date() })
    .where(eq(propertySaleEstimates.listingKey, input.listingKey));
  await logUserActivity(req, {
    eventName: finalStatus === "resolved" ? "sold_price_resolved" : "sold_price_unavailable",
    listingKey: input.listingKey,
    component: "admin_manual_resolver",
    metadata: { sourceName: input.sourceName },
  });
  if (finalStatus === "resolved") await recalculateEstimatorMetricsForListing(input.listingKey);
}

export async function processDueSalePriceLookups(req: Request | null = null, limit = 50) {
  const rows = await db.select()
    .from(listingSaleResolutions)
    .where(sql`${listingSaleResolutions.nextLookupAttemptAt} IS NOT NULL AND ${listingSaleResolutions.nextLookupAttemptAt} <= now()`)
    .limit(limit);
  const results = [];
  for (const row of rows) {
    results.push(await lookupSoldPriceForListing(req, row.listingKey));
  }
  return { attempted: results.length, results };
}

export async function recalculateEstimatorMetrics(userId: string) {
  const rows = await db.select({
    estimatePriceCents: propertySaleEstimates.estimatePriceCents,
    actualSalePriceCents: listingSaleResolutions.actualSalePriceCents,
    resolutionStatus: listingSaleResolutions.resolutionStatus,
    excludeFromMetrics: listingSaleResolutions.excludeFromMetrics,
    estimateSubmittedAt: propertySaleEstimates.createdAt,
    lockedAt: propertySaleEstimates.lockedAt,
    resolvedAt: propertySaleEstimates.resolvedAt,
    sourceConfidence: listingSaleResolutions.sourceConfidence,
  })
    .from(propertySaleEstimates)
    .leftJoin(listingSaleResolutions, eq(propertySaleEstimates.listingKey, listingSaleResolutions.listingKey))
    .where(eq(propertySaleEstimates.userId, userId));

  const metrics = calculateUserSaleEstimatorMetrics(rows.map((row) => ({
    ...row,
    resolutionStatus: (row.resolutionStatus || "not_started") as never,
    excludeFromMetrics: row.excludeFromMetrics ?? true,
  })));

  await db.insert(userSaleEstimatorMetrics).values({
    userId,
    ...metrics,
    lastRecalculatedAt: new Date(),
  }).onConflictDoUpdate({
    target: userSaleEstimatorMetrics.userId,
    set: {
      ...metrics,
      lastRecalculatedAt: new Date(),
    },
  });
  return metrics;
}

async function recalculateEstimatorMetricsForListing(listingKey: string) {
  const estimates = await db.select({ userId: propertySaleEstimates.userId })
    .from(propertySaleEstimates)
    .where(eq(propertySaleEstimates.listingKey, listingKey));
  await Promise.all(Array.from(new Set(estimates.map((estimate) => estimate.userId))).map(recalculateEstimatorMetrics));
}
