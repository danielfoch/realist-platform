import { describe, expect, it } from "vitest";
import {
  calculateUserSaleEstimatorMetrics,
  shouldConfirmListingAbsence,
  shouldExcludeResolutionFromMetrics,
  validateSaleEstimate,
} from "./salePriceOracle";

describe("sale price oracle scoring", () => {
  it("accepts a valid positive estimate in cents", () => {
    expect(validateSaleEstimate({ estimatePriceCents: 750_000_00, listPriceCents: 725_000_00 })).toEqual({ ok: true });
  });

  it("rejects locked listings", () => {
    expect(validateSaleEstimate({ estimatePriceCents: 750_000_00, locked: true })).toMatchObject({ ok: false });
  });

  it("allows plausible edits before lock", () => {
    expect(validateSaleEstimate({ estimatePriceCents: 760_000_00, listPriceCents: 750_000_00, locked: false })).toEqual({ ok: true });
  });

  it("requires confirmation for estimates outside 10%-300% of list price", () => {
    expect(validateSaleEstimate({ estimatePriceCents: 4_000_000_00, listPriceCents: 1_000_000_00 })).toMatchObject({
      ok: false,
      requiresConfirmation: true,
    });
  });

  it("keeps unavailable sold prices excluded and never treats null as zero", () => {
    expect(shouldExcludeResolutionFromMetrics({ resolutionStatus: "unavailable", actualSalePriceCents: null })).toBe(true);
    const metrics = calculateUserSaleEstimatorMetrics([
      {
        estimatePriceCents: 700_000_00,
        actualSalePriceCents: null,
        resolutionStatus: "unavailable",
        estimateSubmittedAt: new Date(),
      },
    ]);
    expect(metrics.eligibleEstimateCount).toBe(0);
    expect(metrics.unavailableEstimateCount).toBe(1);
    expect(metrics.oracleScore).toBe(0);
  });

  it("confirms absence only after threshold or sufficient age", () => {
    const now = new Date("2026-04-29T12:00:00Z");
    expect(shouldConfirmListingAbsence({
      absenceDetectionCount: 1,
      ddfLastSeenAt: "2026-04-29T11:00:00Z",
      now,
      confirmationHours: 24,
    })).toBe(false);
    expect(shouldConfirmListingAbsence({
      absenceDetectionCount: 2,
      ddfLastSeenAt: "2026-04-29T11:00:00Z",
      now,
      confirmationHours: 24,
    })).toBe(true);
    expect(shouldConfirmListingAbsence({
      absenceDetectionCount: 1,
      ddfLastSeenAt: "2026-04-28T11:00:00Z",
      now,
      confirmationHours: 24,
    })).toBe(true);
  });

  it("recalculates resolved accuracy and reliability multiplier", () => {
    const metrics = calculateUserSaleEstimatorMetrics([
      {
        estimatePriceCents: 720_000_00,
        actualSalePriceCents: 700_000_00,
        resolutionStatus: "resolved",
        estimateSubmittedAt: "2026-01-01",
        lockedAt: "2026-02-01",
        sourceConfidence: 0.95,
      },
      {
        estimatePriceCents: 810_000_00,
        actualSalePriceCents: 900_000_00,
        resolutionStatus: "resolved",
        estimateSubmittedAt: "2026-01-02",
        lockedAt: "2026-02-01",
        sourceConfidence: 0.95,
      },
    ]);
    expect(metrics.eligibleEstimateCount).toBe(2);
    expect(metrics.medianAbsolutePercentageError).toBeCloseTo((20 / 700 + 90 / 900) / 2, 4);
    expect(metrics.reliabilityMultiplier).toBeCloseTo(Math.sqrt(2 / 20), 4);
    expect(metrics.oracleScore).toBeGreaterThan(0);
    expect(metrics.oracleScore).toBeLessThan(100);
  });
});
