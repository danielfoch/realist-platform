import { describe, it, expect } from "vitest";
import {
  computeMonthlyPayment,
  computeFixedAmortization,
  computeVariableAmortization,
  generateRatePath,
  generateConstantPath,
  computeBreakevenSpread,
} from "./amortization";

describe("computeMonthlyPayment", () => {
  it("calculates correct payment for known values", () => {
    const payment = computeMonthlyPayment(400000, 5.0, 300);
    expect(payment).toBeCloseTo(2338.36, 0);
  });

  it("handles zero rate", () => {
    const payment = computeMonthlyPayment(300000, 0, 300);
    expect(payment).toBe(1000);
  });
});

describe("computeFixedAmortization", () => {
  it("produces correct totals for a 5-year horizon", () => {
    const result = computeFixedAmortization(
      { principal: 400000, annualRate: 5.0, amortizationYears: 25 },
      5
    );
    expect(result.yearlyRows.length).toBe(5);
    expect(result.monthlyPayment).toBeGreaterThan(2000);
    expect(result.totalInterestPaid).toBeGreaterThan(0);
    expect(result.totalPrincipalPaid).toBeGreaterThan(0);
    expect(result.totalInterestPaid + result.totalPrincipalPaid).toBeCloseTo(result.totalPaid, 0);
    expect(result.endingBalance).toBeLessThan(400000);
    expect(result.endingBalance).toBeGreaterThan(0);
  });

  it("fully amortizes over 25 years", () => {
    const result = computeFixedAmortization(
      { principal: 400000, annualRate: 5.0, amortizationYears: 25 },
      25
    );
    expect(result.yearlyRows.length).toBe(25);
    expect(result.endingBalance).toBeCloseTo(0, 0);
  });

  it("yearly rows sum to totals", () => {
    const result = computeFixedAmortization(
      { principal: 300000, annualRate: 4.5, amortizationYears: 25 },
      10
    );
    const sumInterest = result.yearlyRows.reduce((s, r) => s + r.interestPaid, 0);
    const sumPrincipal = result.yearlyRows.reduce((s, r) => s + r.principalPaid, 0);
    expect(sumInterest).toBeCloseTo(result.totalInterestPaid, 0);
    expect(sumPrincipal).toBeCloseTo(result.totalPrincipalPaid, 0);
  });
});

describe("computeVariableAmortization", () => {
  it("matches fixed when variable rate is constant and equal", () => {
    const rate = 5.0;
    const principal = 400000;
    const fixedResult = computeFixedAmortization(
      { principal, annualRate: rate, amortizationYears: 25 },
      5
    );
    const variableResult = computeVariableAmortization(
      { principal, monthlyRates: generateConstantPath(rate), amortizationYears: 25 },
      5
    );
    expect(variableResult.totalInterestPaid).toBeCloseTo(fixedResult.totalInterestPaid, -1);
    expect(variableResult.totalPrincipalPaid).toBeCloseTo(fixedResult.totalPrincipalPaid, -1);
  });

  it("linear rate increase produces more interest than constant", () => {
    const principal = 400000;
    const baseRate = 4.0;
    const constantPath = generateConstantPath(baseRate);
    const risingPath = constantPath.map((r, i) => r + (i / 300) * 2);

    const constantResult = computeVariableAmortization(
      { principal, monthlyRates: constantPath, amortizationYears: 25 },
      25
    );
    const risingResult = computeVariableAmortization(
      { principal, monthlyRates: risingPath, amortizationYears: 25 },
      25
    );
    expect(risingResult.totalInterestPaid).toBeGreaterThan(constantResult.totalInterestPaid);
  });
});

describe("generateRatePath", () => {
  it("produces correct length", () => {
    const path = generateRatePath({
      baseVariableRate: 3.5,
      severityBps: 100,
      direction: "rising",
      speed: "even",
    });
    expect(path.length).toBe(300);
  });

  it("starts at base rate", () => {
    const path = generateRatePath({
      baseVariableRate: 3.5,
      severityBps: 100,
      direction: "rising",
      speed: "even",
    });
    expect(path[0]).toBeCloseTo(3.5, 1);
  });

  it("ends at base + severity for rising", () => {
    const path = generateRatePath({
      baseVariableRate: 3.5,
      severityBps: 100,
      direction: "rising",
      speed: "even",
    });
    expect(path[60]).toBeCloseTo(4.5, 1);
    expect(path[299]).toBeCloseTo(4.5, 1);
  });

  it("ends at base - severity for falling", () => {
    const path = generateRatePath({
      baseVariableRate: 4.0,
      severityBps: 100,
      direction: "falling",
      speed: "even",
    });
    expect(path[60]).toBeCloseTo(3.0, 1);
  });

  it("front-loaded reaches delta faster than back-loaded", () => {
    const front = generateRatePath({
      baseVariableRate: 3.5,
      severityBps: 200,
      direction: "rising",
      speed: "front-loaded",
    });
    const back = generateRatePath({
      baseVariableRate: 3.5,
      severityBps: 200,
      direction: "rising",
      speed: "back-loaded",
    });
    expect(front[24]).toBeGreaterThan(back[24]);
  });

  it("front-loaded produces higher 5y interest than back-loaded", () => {
    const principal = 400000;
    const front = generateRatePath({
      baseVariableRate: 3.5,
      severityBps: 150,
      direction: "rising",
      speed: "front-loaded",
    });
    const back = generateRatePath({
      baseVariableRate: 3.5,
      severityBps: 150,
      direction: "rising",
      speed: "back-loaded",
    });
    const frontResult = computeVariableAmortization(
      { principal, monthlyRates: front, amortizationYears: 25 },
      5
    );
    const backResult = computeVariableAmortization(
      { principal, monthlyRates: back, amortizationYears: 25 },
      5
    );
    expect(frontResult.totalInterestPaid).toBeGreaterThan(backResult.totalInterestPaid);
  });
});

describe("computeBreakevenSpread", () => {
  it("breakeven rate matches fixed rate for equal horizon", () => {
    const breakeven = computeBreakevenSpread(400000, 5.0, 25, 5);
    expect(breakeven).toBeCloseTo(5.0, 1);
    expect(breakeven).toBeGreaterThan(0);
  });

  it("breakeven for full amortization equals the fixed rate", () => {
    const breakeven = computeBreakevenSpread(400000, 5.0, 25, 25);
    expect(breakeven).toBeCloseTo(5.0, 1);
  });
});
