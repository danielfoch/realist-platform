import { describe, expect, it } from "vitest";
import { calculateBuyHoldAnalysis } from "@shared/buyHoldAnalysis";
import {
  AGENT_UNDERWRITING_DEFAULTS,
  AGENT_UNDERWRITING_VERSION,
  fallbackMonthlyRent,
  perUnitBedrooms,
  resolveBuyHoldInputs,
  runAgentUnderwriting,
  type ResolvedRent,
} from "./underwriting";

const providedRent: ResolvedRent = { monthlyRent: 4200, source: "provided" };

function annualOpex(inputs: ReturnType<typeof resolveBuyHoldInputs>["inputs"]): number {
  return calculateBuyHoldAnalysis(inputs).monthlyExpenses * 12;
}

describe("resolveBuyHoldInputs", () => {
  it("fills every gap with the web analyzer defaults and says what it assumed", () => {
    const { inputs, notes } = resolveBuyHoldInputs({ price: 750_000, units: 3, rent: providedRent });

    expect(inputs).toMatchObject({
      purchasePrice: 750_000,
      closingCosts: 22_500, // 3% of price
      downPaymentPercent: 20,
      interestRate: 5.5,
      amortizationYears: 25,
      monthlyRent: 4200,
      vacancyPercent: 5,
      propertyTax: 7500, // 1% of price
      insurance: 3600, // $1,200 × 3 units
      maintenancePercent: 5,
      managementPercent: 5,
      capexReservePercent: 5,
      holdingPeriodYears: 10,
    });
    expect(notes.join(" ")).toMatch(/Property tax estimated/);
    expect(notes.join(" ")).toMatch(/Insurance estimated/);
    expect(notes.join(" ")).toMatch(/Closing costs estimated/);
  });

  it("prefers a known listing tax over the 1% estimate and a caller value over both", () => {
    const fromListing = resolveBuyHoldInputs({ price: 750_000, units: 1, rent: providedRent, knownAnnualPropertyTax: 5123 });
    expect(fromListing.inputs.propertyTax).toBe(5123);
    expect(fromListing.notes.join(" ")).toMatch(/listing feed/);

    const fromCaller = resolveBuyHoldInputs(
      { price: 750_000, units: 1, rent: providedRent, knownAnnualPropertyTax: 5123 },
      { annualPropertyTax: 6000 },
    );
    expect(fromCaller.inputs.propertyTax).toBe(6000);
  });

  it("treats expenseRatio as ALL-IN operating expenses — never double counts tax and insurance", () => {
    const { inputs, notes } = resolveBuyHoldInputs({ price: 750_000, units: 3, rent: providedRent }, { expenseRatio: 35 });

    // Total opex must equal 35% of gross rent (percent shares round to 2dp, so within a few dollars).
    expect(annualOpex(inputs)).toBeCloseTo(4200 * 12 * 0.35, -1);
    // Tax + insurance stay visible as line items; the remainder is spread evenly.
    expect(inputs.propertyTax).toBe(7500);
    expect(inputs.insurance).toBe(3600);
    expect(inputs.maintenancePercent).toBeCloseTo(inputs.managementPercent, 2);
    expect(notes.join(" ")).toMatch(/all-in 35%/);
  });

  it("scales line items down, with a warning, when the all-in ratio cannot cover tax + insurance", () => {
    const { inputs, notes } = resolveBuyHoldInputs({ price: 2_000_000, units: 2, rent: providedRent }, { expenseRatio: 20 });

    expect(annualOpex(inputs)).toBeCloseTo(4200 * 12 * 0.2, -1);
    expect(inputs.maintenancePercent).toBe(0);
    expect(notes.join(" ")).toMatch(/optimistic/);
  });

  it("flags estimated and placeholder rents", () => {
    const estimated = resolveBuyHoldInputs({ price: 500_000, units: 1, rent: { monthlyRent: 2300, source: "realist_estimate", detail: "city comps, 14 comps, medium confidence" } });
    expect(estimated.notes[0]).toMatch(/Realist estimate \(city comps, 14 comps, medium confidence\)/);

    const placeholder = resolveBuyHoldInputs({ price: 500_000, units: 1, rent: { monthlyRent: 1800, source: "fallback_table" } });
    expect(placeholder.notes[0]).toMatch(/placeholder/);
  });
});

describe("runAgentUnderwriting", () => {
  it("returns the pre-registry keys plus IRR, exit and a stress test, all from the shared engine", () => {
    const { inputs, notes } = resolveBuyHoldInputs({ price: 750_000, units: 3, rent: providedRent });
    const { underwriting, results } = runAgentUnderwriting(inputs, { units: 3, rent: providedRent, notes });
    const engine = calculateBuyHoldAnalysis(inputs);

    expect(underwriting).toMatchObject({
      price: 750_000,
      monthlyRent: 4200,
      rentSource: "provided",
      units: 3,
      annualRent: 50_400,
      downPayment: 150_000,
      mortgageAmount: 600_000,
      calculationVersion: AGENT_UNDERWRITING_VERSION,
    });
    expect(underwriting.noi).toBe(Math.round(engine.annualNoi));
    expect(underwriting.capRate).toBeCloseTo(engine.capRate, 2);
    expect(underwriting.monthlyCashFlow).toBe(Math.round(engine.monthlyCashFlow));
    expect(underwriting.totalCashInvested).toBe(150_000 + 22_500);
    expect(underwriting.irr).not.toBeNull();
    expect(underwriting.exit?.holdingPeriodYears).toBe(10);
    expect(underwriting.stressTest.bear.annualCashFlow).toBeLessThan(underwriting.stressTest.bull.annualCashFlow);
    // The default line items land near a realistic ~37% expense ratio — the old
    // agent path reported 35% but actually charged ~57%.
    expect(underwriting.assumptions.expenseRatio).toBeGreaterThan(30);
    expect(underwriting.assumptions.expenseRatio).toBeLessThan(45);
    expect(results.yearlyProjections).toHaveLength(10);
  });

  it("stays JSON-safe on an all-cash deal (engine DSCR is Infinity)", () => {
    const { inputs, notes } = resolveBuyHoldInputs({ price: 400_000, units: 1, rent: providedRent }, { downPaymentPercent: 100 });
    const { underwriting, results } = runAgentUnderwriting(inputs, { units: 1, rent: providedRent, notes });

    expect(underwriting.dscr).toBeNull();
    expect(underwriting.monthlyMortgage).toBe(0);
    expect(() => JSON.stringify({ underwriting, results })).not.toThrow();
    expect(JSON.parse(JSON.stringify(results)).dscr).toBe(0);
  });
});

describe("rent fallbacks", () => {
  it("converts a listing's TOTAL bedrooms into bedrooms per unit", () => {
    expect(perUnitBedrooms(6, 3)).toBe(2);
    expect(perUnitBedrooms(3, 1)).toBe(3);
    expect(perUnitBedrooms(null, 2)).toBe(1);
  });

  it("prices the placeholder rent per unit", () => {
    expect(fallbackMonthlyRent(6, 3)).toBe(1800 * 3);
    expect(fallbackMonthlyRent(undefined, 1)).toBe(1800);
  });

  it("keeps defaults in lockstep with the web analyzer", () => {
    expect(AGENT_UNDERWRITING_DEFAULTS).toMatchObject({ vacancyPercent: 5, maintenancePercent: 5, managementPercent: 5, capexReservePercent: 5, holdingPeriodYears: 10 });
  });
});
