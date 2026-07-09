import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  db: {},
}));

vi.mock("./auth", () => ({
  appBaseUrl: () => "https://realist.ca",
}));

import {
  computeReferralFee,
  isReferralOutcomeAction,
  isReferralOutcomeStatus,
  pickMostRecentModelPrediction,
  predictionMatchKeysForOutcome,
  predictionResolutionPatch,
  validateOutcomeTransition,
} from "./referralOutcomes";

describe("computeReferralFee", () => {
  it("computes the default 25 percent fee", () => {
    expect(computeReferralFee(10000)).toBe(2500);
  });

  it("uses the row referral fee percent when provided", () => {
    expect(computeReferralFee(10000, 30)).toBe(3000);
  });

  it("preserves cents", () => {
    expect(computeReferralFee(9999, 25)).toBe(2499.75);
  });

  it("allows zero GCI", () => {
    expect(computeReferralFee(0)).toBe(0);
  });

  it("rejects invalid money inputs", () => {
    expect(() => computeReferralFee(-1)).toThrow("Invalid GCI");
    expect(() => computeReferralFee(Number.NaN)).toThrow("Invalid GCI");
    expect(() => computeReferralFee(10000, -1)).toThrow("Invalid referral fee percent");
    expect(() => computeReferralFee(10000, 101)).toThrow("Invalid referral fee percent");
  });
});

describe("referral outcome transition validation", () => {
  it("accepts known statuses and actions", () => {
    expect(isReferralOutcomeStatus("pending")).toBe(true);
    expect(isReferralOutcomeStatus("under_contract")).toBe(true);
    expect(isReferralOutcomeStatus("closed")).toBe(true);
    expect(isReferralOutcomeAction("under_contract")).toBe(true);
    expect(isReferralOutcomeAction("showing_booked")).toBe(true);
    expect(isReferralOutcomeAction("pending")).toBe(false);
  });

  it("allows forward moves", () => {
    expect(validateOutcomeTransition({
      currentStatus: "pending",
      action: "responded",
    })).toEqual({ ok: true, nextStatus: "responded" });

    expect(validateOutcomeTransition({
      currentStatus: "responded",
      action: "offer_submitted",
    })).toEqual({ ok: true, nextStatus: "offer_submitted" });

    expect(validateOutcomeTransition({
      currentStatus: "offer_submitted",
      action: "under_contract",
    })).toEqual({ ok: true, nextStatus: "under_contract" });
  });

  it("rejects backward moves", () => {
    expect(validateOutcomeTransition({
      currentStatus: "offer_submitted",
      action: "responded",
    })).toEqual({ ok: false, error: "Referral outcomes cannot move backward" });

    expect(validateOutcomeTransition({
      currentStatus: "under_contract",
      action: "offer_submitted",
    })).toEqual({ ok: false, error: "Referral outcomes cannot move backward" });
  });

  it("allows intent-only writebacks without moving status", () => {
    expect(validateOutcomeTransition({
      currentStatus: "responded",
    })).toEqual({ ok: true, nextStatus: "responded" });
  });

  it("treats closed and lost as terminal", () => {
    expect(validateOutcomeTransition({
      currentStatus: "closed",
      action: "lost",
      lostReason: "No longer buying",
    })).toEqual({ ok: false, error: "This outcome is already terminal" });

    expect(validateOutcomeTransition({
      currentStatus: "lost",
      action: "closed",
      gci: 10000,
    })).toEqual({ ok: false, error: "This outcome is already terminal" });
  });

  it("requires lostReason for lost", () => {
    expect(validateOutcomeTransition({
      currentStatus: "responded",
      action: "lost",
    })).toEqual({ ok: false, error: "lostReason is required when marking a referral lost" });

    expect(validateOutcomeTransition({
      currentStatus: "responded",
      action: "lost",
      lostReason: "Bought outside our market",
    })).toEqual({ ok: true, nextStatus: "lost" });
  });

  it("requires positive gci for closed", () => {
    expect(validateOutcomeTransition({
      currentStatus: "offer_submitted",
      action: "closed",
    })).toEqual({ ok: false, error: "gci greater than 0 is required when marking a referral closed" });

    expect(validateOutcomeTransition({
      currentStatus: "offer_submitted",
      action: "closed",
      gci: 10000,
    })).toEqual({ ok: true, nextStatus: "closed" });
  });
});

describe("post-close model prediction reconciliation helpers", () => {
  it("matches referral outcomes to related analysis and deal predictions", () => {
    expect(predictionMatchKeysForOutcome({
      analysisId: "analysis-1",
      crmDealId: "deal-1",
    } as any)).toEqual([
      { subjectType: "analysis", subjectId: "analysis-1" },
      { subjectType: "deal", subjectId: "deal-1" },
    ]);
  });

  it("uses the most recent matching model prediction row", () => {
    const older = { id: "older", createdAt: new Date("2026-01-01T00:00:00Z") };
    const newer = { id: "newer", createdAt: new Date("2026-02-01T00:00:00Z") };
    expect(pickMostRecentModelPrediction([older, newer])).toBe(newer);
  });

  it("builds prediction resolution metrics from close price", () => {
    const patch = predictionResolutionPatch({ predictedValue: 900000 } as any, 1_000_000);
    expect(patch.actualValue).toBe(1_000_000);
    expect(patch.actualSource).toBe("referral_outcome_close");
    expect(patch.absError).toBe(100000);
    expect(patch.pctError).toBeCloseTo(11.111, 3);
  });
});
