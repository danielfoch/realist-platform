import { describe, expect, it } from "vitest";
import {
  SMALL_RENTAL_SCREEN_RULES,
  computeSmallRentalMortgageScreen,
} from "./multiplexFinancing";

describe("CMHC small-rental financing screen", () => {
  it("screens a fourplex without pretending to approve the borrower", () => {
    const result = computeSmallRentalMortgageScreen({
      units: 4,
      lendingValue: 1_200_000,
      noi: 72_000,
      interestRate: 0.05,
    });

    expect(result.eligible).toBe(true);
    expect(result.indicativeLoan).toBe(960_000);
    expect(result.indicativeEquity).toBe(240_000);
    expect(result.noiCoverageRatio).toBeGreaterThan(1);
    expect(result.qualificationNote).toContain("lender must qualify");
  });

  it("sends five-plus-unit projects to the multi-unit lane", () => {
    const result = computeSmallRentalMortgageScreen({
      units: 5,
      lendingValue: 1_500_000,
      noi: 90_000,
      interestRate: 0.05,
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("MLI Select");
  });

  it("pins its default leverage to the documented screening assumption", () => {
    expect(SMALL_RENTAL_SCREEN_RULES.maxLtv).toBe(0.8);
  });
});
