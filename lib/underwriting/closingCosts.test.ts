import { describe, expect, it } from "vitest";
import { closingCostsNote, estimateClosingCosts, landTransferTax } from "./closingCosts";

describe("landTransferTax", () => {
  it("charges a Toronto buyer the Ontario tax twice", () => {
    // $899,000: 275 + 1,950 + 2,250 + 9,980 = 14,455 provincial, and the same again municipally.
    expect(landTransferTax(899_000, "ON", "Hamilton")).toBe(14_455);
    expect(landTransferTax(899_000, "Ontario", "Toronto")).toBe(28_910);
    expect(landTransferTax(899_000, "ON", "etobicoke")).toBe(28_910);
  });

  it("knows the provinces that barely charge and the ones that charge a lot", () => {
    expect(landTransferTax(500_000, "AB", "Calgary")).toBe(550);
    expect(landTransferTax(1_000_000, "BC", "Vancouver")).toBe(18_000);
    expect(landTransferTax(300_000, "MB", "Winnipeg")).toBe(3_650);
    expect(landTransferTax(400_000, "NB", "Moncton")).toBe(4_000);
    expect(landTransferTax(400_000, "NS", "Halifax")).toBe(6_000);
    expect(landTransferTax(0, "ON", "Toronto")).toBe(0);
  });

  it("applies Montréal's higher tiers only in Montréal", () => {
    expect(landTransferTax(800_000, "QC", "Montréal")).toBeGreaterThan(landTransferTax(800_000, "QC", "Sherbrooke"));
  });
});

describe("estimateClosingCosts", () => {
  it("is the tax plus the fixed costs of any purchase", () => {
    expect(estimateClosingCosts(899_000, "ON", "Toronto")).toBe(31_410);
    expect(estimateClosingCosts(500_000, "AB", "Calgary")).toBe(3_050);
  });

  it("falls back to a flat rate rather than guess a jurisdiction", () => {
    expect(estimateClosingCosts(500_000, null)).toBe(10_000);
    expect(closingCostsNote(null)).toMatch(/until you pick a province/);
    expect(closingCostsNote("ON", "Toronto")).toMatch(/^Ontario \+ Toronto land transfer tax/);
    expect(closingCostsNote("AB", "Calgary")).toMatch(/no transfer tax here/);
  });
});
