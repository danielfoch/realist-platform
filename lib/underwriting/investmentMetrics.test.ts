import { describe, expect, it } from "vitest";
import { calculateGrossYield, calculateInvestmentMetrics, calculateListingYield } from "./investmentMetrics";

describe("investment metrics", () => {
  it("calculates gross yield", () => {
    expect(calculateGrossYield(500000, { monthlyRent: 3000 })).toBe(7.2);
  });

  it("calculates cap rate and cash flow when assumptions exist", () => {
    const metrics = calculateInvestmentMetrics(500000, {
      monthlyRent: 3200,
      annualPropertyTax: 3600,
      annualInsurance: 1200,
      downPaymentPercent: 20,
      interestRate: 5,
      amortizationYears: 25,
      rentSource: "market",
    });

    expect(metrics.grossYield).toBe(7.68);
    expect(metrics.capRate).not.toBeNull();
    expect(metrics.monthlyCashFlow).not.toBeNull();
    expect(metrics.capRateConfidence).toBe("medium");
  });

  it("returns unavailable IRR when assumptions are incomplete", () => {
    const metrics = calculateInvestmentMetrics(500000, {
      monthlyRent: 0,
    });

    expect(metrics.irr).toBeNull();
    expect(metrics.calculationWarnings.some((warning) => warning.includes("IRR unavailable"))).toBe(true);
  });

  it("calculates IRR when complete assumptions exist", () => {
    const metrics = calculateInvestmentMetrics(400000, {
      monthlyRent: 3200,
      annualPropertyTax: 3200,
      annualInsurance: 1200,
      downPaymentPercent: 25,
      interestRate: 4.8,
      amortizationYears: 30,
      holdPeriodYears: 5,
      annualAppreciationPercent: 3,
      sellingCostPercent: 5,
      rentSource: "actual",
    });

    expect(metrics.irr).not.toBeNull();
    expect(metrics.irrConfidence).toBe("high");
  });
});

describe("calculateListingYield", () => {
  it("derives listing gross/net yield through the shared engine", () => {
    const y = calculateListingYield(500000, 3000, 4000, 400);
    // annual rent 36000; expenses = tax 4000 + condo 4800 + insurance 1500
    // + vacancy 1800 + maintenance 1800 + management 2880 = 16780
    expect(y.grossYield).toBe(7.2);
    expect(y.estimatedExpenses).toBe(16780);
    expect(y.estimatedNoi).toBe(19220);
    expect(y.netYield).toBe(3.84);
  });

  it("returns zeros without a positive list price", () => {
    expect(calculateListingYield(0, 3000)).toEqual({
      grossYield: 0,
      netYield: 0,
      estimatedExpenses: 0,
      estimatedNoi: 0,
    });
  });
});
