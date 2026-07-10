import { describe, expect, it } from "vitest";
import { computeOperatingCosts, estimateTorontoAssessedValue, TORONTO_RESIDENTIAL_TAX_RATE, TORONTO_MULTIRES_TAX_RATE } from "./operatingCosts";

const base = { units: 6, grossPotentialRent: 164400, effectiveGrossIncome: 159468, currentValue: 3956584, isNewBuild: true };

describe("computeOperatingCosts — Toronto small multiplex", () => {
  it("taxes a ≤6-unit multiplex in the residential class", () => {
    const r = computeOperatingCosts(base);
    expect(r.propertyTaxClass).toBe("residential");
    const tax = r.lines.find((l) => l.key === "property_tax")!.annual;
    // assessed = 60% of 3,956,584 = 2,373,950 ; × 0.767311% ≈ 18,215
    expect(tax).toBe(Math.round(estimateTorontoAssessedValue(3956584) * TORONTO_RESIDENTIAL_TAX_RATE));
    expect(tax).toBeGreaterThan(17000);
    expect(tax).toBeLessThan(19000);
  });

  it("flips to multi-residential (legacy rate) for a 7+ unit non-new building", () => {
    const r = computeOperatingCosts({ ...base, units: 8, isNewBuild: false });
    expect(r.propertyTaxClass).toBe("multi_residential");
    const tax = r.lines.find((l) => l.key === "property_tax")!.annual;
    expect(tax).toBe(Math.round(estimateTorontoAssessedValue(3956584) * TORONTO_MULTIRES_TAX_RATE));
  });

  it("a NEW 7+ unit build gets the New Multi-Residential rate (= residential)", () => {
    const r = computeOperatingCosts({ ...base, units: 8, isNewBuild: true });
    expect(r.propertyTaxClass).toBe("new_multi_residential");
    const tax = r.lines.find((l) => l.key === "property_tax")!.annual;
    expect(tax).toBe(Math.round(estimateTorontoAssessedValue(3956584) * TORONTO_RESIDENTIAL_TAX_RATE));
  });

  it("honours a provided assessed value over the 2016-base estimate", () => {
    const r = computeOperatingCosts({ ...base, assessedValueOverride: 2000000 });
    expect(r.assessedValueUsed).toBe(2000000);
    expect(r.lines.find((l) => l.key === "property_tax")!.annual).toBe(Math.round(2000000 * TORONTO_RESIDENTIAL_TAX_RATE));
    expect(r.notes.some((n) => /provided directly/i.test(n))).toBe(true);
  });

  it("itemises six lines that sum to the total and a sane EGI ratio", () => {
    const r = computeOperatingCosts(base);
    expect(r.lines).toHaveLength(6);
    expect(r.total).toBe(r.lines.reduce((s, l) => s + l.annual, 0));
    // A high-value Toronto sixplex lands materially above a flat 28% because
    // property tax alone is ~11% of EGI.
    expect(r.totalPctOfEgi).toBeGreaterThan(0.28);
    expect(r.totalPctOfEgi).toBeLessThan(0.45);
  });

  it("scales insurance/reserve/utilities with unit count", () => {
    const six = computeOperatingCosts(base);
    const three = computeOperatingCosts({ ...base, units: 3 });
    const perUnitLines = (r: ReturnType<typeof computeOperatingCosts>) =>
      r.lines.filter((l) => ["insurance", "reserve", "utilities"].includes(l.key)).reduce((s, l) => s + l.annual, 0);
    expect(perUnitLines(six)).toBe(2 * perUnitLines(three));
  });
});
