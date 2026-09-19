import { describe, expect, it } from "vitest";
import { mapLegacyAnalysis } from "./legacyAnalyses";

const row = {
  id: "a-1",
  user_id: "u-1",
  strategy_type: "buy_hold",
  address: "5 King St.",
  city: "Hamilton",
  province: "Ontario",
  created_at: new Date("2025-06-01T12:00:00Z"),
  inputs_json: {
    purchasePrice: 650_000, closingCosts: 12_000, downPaymentPercent: 25, interestRate: 5.5, amortizationYears: 30,
    monthlyRent: 5200, vacancyPercent: 3, propertyTax: 5200, insurance: 1900, utilities: 150, otherExpenses: 50,
    maintenancePercent: 5, capexReservePercent: 5, managementPercent: 8, appreciationPercent: 2, holdingPeriodYears: 10, sellingCostsPercent: 5,
  },
};

describe("mapLegacyAnalysis", () => {
  it("re-expresses a v1 analysis in today's inputs and recomputes it on today's engine", () => {
    const mapped = mapLegacyAnalysis(row)!;
    expect(mapped.dealKey).toBe("addr:5 king st");
    expect(mapped).toMatchObject({ source: "manual", city: "Hamilton", province: "ON", price: 650_000, monthlyRent: 5200, eligible: true });
    expect(mapped.inputs).toMatchObject({ maintenancePercent: 10, monthlyUtilities: 200, annualPropertyTax: 5200, holdPeriodYears: 10 });
    expect(mapped.capRate).toBeGreaterThan(0);
    expect(mapped.createdAt).toEqual(new Date("2025-06-01T12:00:00Z"));
    expect(mapped.engineVersion).toMatch(/\+legacy$/);
  });

  it("knows which assumptions the person actually moved — that's the learning signal", () => {
    const mapped = mapLegacyAnalysis(row)!;
    expect(mapped.edited.sort()).toEqual(["amortizationYears", "downPaymentPercent", "managementPercent", "monthlyUtilities", "vacancyPercent"]);
    // Price, rent, tax and insurance belong to the property, not to the person's judgement.
    expect(mapped.edited).not.toContain("price");
    expect(mapped.edited).not.toContain("annualPropertyTax");
  });

  it("keeps an address-less analysis countable, once", () => {
    expect(mapLegacyAnalysis({ ...row, address: null })!.dealKey).toBe("legacy:a-1");
  });

  it("keys a listing by its MLS number", () => {
    const mapped = mapLegacyAnalysis({ ...row, inputs_json: { ...row.inputs_json, mlsNumber: "h4123" } })!;
    expect(mapped).toMatchObject({ dealKey: "mls:H4123", source: "listing", mlsNumber: "h4123" });
  });

  it("leaves behind other strategies and empty shells", () => {
    expect(mapLegacyAnalysis({ ...row, strategy_type: "flip" })).toBeNull();
    expect(mapLegacyAnalysis({ ...row, inputs_json: { purchasePrice: 0, monthlyRent: 0 } })).toBeNull();
    expect(mapLegacyAnalysis({ ...row, inputs_json: { ...row.inputs_json, interestRate: 900 } })).toBeNull();
  });

  it("falls back to the typed columns when the blob lacks price or rent", () => {
    const mapped = mapLegacyAnalysis({ ...row, inputs_json: {}, purchase_price_num: 400_000, monthly_rent_num: 2800 })!;
    expect(mapped).toMatchObject({ price: 400_000, monthlyRent: 2800 });
  });
});
