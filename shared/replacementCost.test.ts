import { describe, expect, it } from "vitest";
import {
  classifyReplacementCostProperty,
  estimateReplacementCost,
  parseReplacementCostSqft,
  parseReplacementCostYear,
} from "./replacementCost";

describe("replacement cost screening model", () => {
  it("parses exact and ranged square-footage values", () => {
    expect(parseReplacementCostSqft("1,500 sqft")).toBe(1500);
    expect(parseReplacementCostSqft("1,100 - 1,500")).toBe(1300);
    expect(parseReplacementCostSqft(875)).toBe(875);
    expect(parseReplacementCostSqft("not available")).toBeNull();
  });

  it("parses exact and ranged construction years", () => {
    expect(parseReplacementCostYear("Built in 1975")).toBe(1975);
    expect(parseReplacementCostYear("1970-1979")).toBe(1975);
    expect(parseReplacementCostYear(2028)).toBeNull();
  });

  it("selects a cost band from the property type", () => {
    expect(classifyReplacementCostProperty("Detached bungalow")).toBe("detached");
    expect(classifyReplacementCostProperty("Row / Townhouse")).toBe("attached");
    expect(classifyReplacementCostProperty("Duplex")).toBe("multi_residential");
    expect(classifyReplacementCostProperty("Condominium Apartment")).toBe("condo_apartment");
  });

  it("calculates replacement cost and age-life depreciation", () => {
    const estimate = estimateReplacementCost({
      squareFootage: 1500,
      yearBuilt: 1976,
      propertyType: "Detached",
    });

    expect(estimate.costPerSqft).toBe(378);
    expect(estimate.replacementCost).toBe(565_000);
    expect(estimate.buildingAge).toBe(50);
    expect(estimate.depreciationRate).toBe(0.5);
    expect(estimate.depreciatedReplacementCost).toBe(285_000);
  });

  it("caps age depreciation at 80 percent", () => {
    const estimate = estimateReplacementCost({
      squareFootage: 1000,
      yearBuilt: 1800,
      propertyType: "House",
    });

    expect(estimate.depreciationRate).toBe(0.8);
    expect(estimate.depreciatedReplacementCost).toBe(75_000);
  });

  it("keeps rebuild cost when year built is missing", () => {
    const estimate = estimateReplacementCost({ squareFootage: "900", propertyType: "Townhouse" });

    expect(estimate.replacementCost).toBe(300_000);
    expect(estimate.depreciatedReplacementCost).toBeNull();
  });
});
