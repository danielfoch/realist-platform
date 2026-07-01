import { describe, expect, it } from "vitest";
import {
  amortizationSurchargePct,
  basePremiumPct,
  computeMliTakeout,
  paymentFactorMonthly,
  scoreMliPoints,
  tierForPoints,
  totalPremiumPct,
} from "./mliSelect";

describe("mliSelect premiums", () => {
  it("reproduces the published 5.18% golden case (>90% LTV, 50yr, 100 points)", () => {
    // REIC Sept 2025: base 6.15% (>90% other purposes) + 1.25% (50yr am)
    // = 7.40% x 0.70 (100-point discount) = 5.18%
    expect(totalPremiumPct({ ltv: 0.95, amortYears: 50, purpose: "other", points: 100 })).toBe(5.18);
  });

  it("reproduces REIC example B: 85% LTV term, 25yr, 100 points = 3.745%", () => {
    expect(totalPremiumPct({ ltv: 0.85, amortYears: 25, purpose: "other", points: 100 })).toBe(3.745);
  });

  it("reproduces REIC example A: 80% LTV construction, 40yr, 70 points = 4.60%", () => {
    // (5.00 + 0.75) x 0.80 = 4.60
    expect(totalPremiumPct({ ltv: 0.8, amortYears: 40, purpose: "construction", points: 70 })).toBe(4.6);
  });

  it("amortization surcharge is 0.25% per 5 years beyond 25", () => {
    expect(amortizationSurchargePct(25)).toBe(0);
    expect(amortizationSurchargePct(35)).toBe(0.5);
    expect(amortizationSurchargePct(40)).toBe(0.75);
    expect(amortizationSurchargePct(50)).toBe(1.25);
  });

  it("base premium tiers step at LTV boundaries", () => {
    expect(basePremiumPct(0.65, "other")).toBe(2.6);
    expect(basePremiumPct(0.8, "other")).toBe(4.35);
    expect(basePremiumPct(0.81, "other")).toBe(5.35);
    expect(basePremiumPct(0.95, "construction")).toBe(7.0);
  });
});

describe("mliSelect points & tiers", () => {
  it("scores commitment levels", () => {
    expect(scoreMliPoints({ affordabilityLevel: 3, energyLevel: 0, accessibilityLevel: 0 })).toBe(100);
    expect(scoreMliPoints({ affordabilityLevel: 1, energyLevel: 1, accessibilityLevel: 0 })).toBe(70);
    expect(scoreMliPoints({ affordabilityLevel: 1, energyLevel: 0, accessibilityLevel: 0 })).toBe(50);
    expect(scoreMliPoints({ affordabilityLevel: 0, energyLevel: 1, accessibilityLevel: 1 })).toBe(40);
  });

  it("maps points to benefit tiers", () => {
    expect(tierForPoints(100)?.maxLtv).toBe(0.95);
    expect(tierForPoints(100)?.maxAmortYears).toBe(50);
    expect(tierForPoints(70)?.maxLtv).toBe(0.9);
    expect(tierForPoints(50)?.maxLtv).toBe(0.85);
    expect(tierForPoints(49)).toBeNull();
  });
});

describe("mliSelect loan sizing", () => {
  const base = {
    noi: 114817,
    lendingValue: 2400000,
    points: 100,
    purpose: "other" as const,
    interestRate: 0.045,
  };

  it("gates configurations under 5 units", () => {
    const r = computeMliTakeout({ ...base, units: 4 });
    expect(r.eligible).toBe(false);
    expect(r.reason).toContain("5+");
  });

  it("gates applications under 50 points", () => {
    const r = computeMliTakeout({ ...base, units: 6, points: 40 });
    expect(r.eligible).toBe(false);
  });

  it("sizes the loan to the binding constraint and holds DSCR >= 1.10", () => {
    const r = computeMliTakeout({ ...base, units: 6 });
    expect(r.eligible).toBe(true);
    expect(r.amortYears).toBe(50);
    expect(r.maxLoan).toBe(Math.min(r.maxLoanByLtv, r.maxLoanByDscr));
    expect(r.actualDscr).toBeGreaterThanOrEqual(1.1);
    expect(r.actualLtv).toBeLessThanOrEqual(0.95 + 1e-6);
    // LTV cap: 2.4M x 0.95 = 2.28M; DSCR cap ~2.07M at 4.5%/50yr -> DSCR binds
    expect(r.maxLoanByLtv).toBe(2280000);
    expect(r.bindingConstraint).toBe("dscr");
    expect(r.maxLoanByDscr).toBeGreaterThan(2000000);
    expect(r.maxLoanByDscr).toBeLessThan(2150000);
  });

  it("clamps amortization to the tier ceiling", () => {
    const r = computeMliTakeout({ ...base, units: 6, points: 50, amortYears: 50 });
    expect(r.amortYears).toBe(40);
  });

  it("payment factor matches annuity math at zero rate", () => {
    expect(paymentFactorMonthly(0, 25)).toBeCloseTo(1 / 300, 10);
  });
});
