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
    expect(isReferralOutcomeStatus("closed")).toBe(true);
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
  });

  it("rejects backward moves", () => {
    expect(validateOutcomeTransition({
      currentStatus: "offer_submitted",
      action: "responded",
    })).toEqual({ ok: false, error: "Referral outcomes cannot move backward" });
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
