import { describe, expect, it } from "vitest";
import { previousCalendarMonth, summarizeDistressCohort, type DistressObservationForCohort } from "./distressIntelligence";

function row(overrides: Partial<DistressObservationForCohort>): DistressObservationForCohort {
  return {
    listingKey: "listing-a",
    listPrice: 500_000,
    primaryCategory: "motivated",
    foreclosurePos: false,
    motivated: true,
    vtb: false,
    ...overrides,
  };
}

describe("distress cohort intelligence", () => {
  it("handles year boundaries when selecting the prior capture", () => {
    expect(previousCalendarMonth("2026-01")).toBe("2025-12");
    expect(previousCalendarMonth("2026-08")).toBe("2026-07");
    expect(() => previousCalendarMonth("2026-13")).toThrow();
  });

  it("separates new, persistent, exited, and repriced listings", () => {
    const previous = [
      row({ listingKey: "a", listPrice: 500_000 }),
      row({ listingKey: "b", listPrice: 600_000, primaryCategory: "foreclosure_pos", foreclosurePos: true, motivated: false }),
      row({ listingKey: "gone", listPrice: 450_000 }),
    ];
    const current = [
      row({ listingKey: "a", listPrice: 475_000 }),
      row({ listingKey: "b", listPrice: 600_000, primaryCategory: "foreclosure_pos", foreclosurePos: true, motivated: false }),
      row({ listingKey: "new", listPrice: 700_000, primaryCategory: "vtb", motivated: false, vtb: true }),
    ];

    const summary = summarizeDistressCohort(current, previous);
    expect(summary).toMatchObject({
      currentListings: 3,
      previousListings: 3,
      newlyFlagged: 1,
      persistent: 2,
      noLongerFlagged: 1,
      priceReduced: 1,
      priceUnchanged: 1,
      priceIncreased: 0,
      primaryCategoryCounts: { foreclosure_pos: 1, motivated: 1, vtb: 1 },
    });
    expect(summary.persistenceRatePct).toBeCloseTo(66.67, 1);
    expect(summary.medianPriceChangePct).toBeCloseTo(-2.5, 4);
  });

  it("keeps overlapping triggered categories separate from exclusive primary categories", () => {
    const summary = summarizeDistressCohort([
      row({ listingKey: "multi", primaryCategory: "foreclosure_pos", foreclosurePos: true, motivated: true, vtb: true }),
    ], []);
    expect(summary.triggeredCategoryCounts).toEqual({ foreclosure_pos: 1, motivated: 1, vtb: 1 });
    expect(summary.primaryCategoryCounts).toEqual({ foreclosure_pos: 1, motivated: 0, vtb: 0 });
  });
});
