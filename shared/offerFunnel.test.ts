import { describe, expect, it } from "vitest";
import {
  buildOfferDealSummary,
  buildOfferFunnelHref,
  parseOfferFunnelSearch,
} from "./offerFunnel";

describe("offer funnel context", () => {
  it("preserves listing and underwriting context through the offer URL", () => {
    const href = buildOfferFunnelHref({
      listingId: "C12345",
      address: "12 King St W #4, Toronto",
      city: "Toronto",
      province: "ON",
      price: 999_000,
      estimatedMonthlyRent: 6_200,
      capRate: 5.42,
      monthlyCashFlow: 875,
      source: "deals_map",
      signals: ["VTB", "power of sale"],
    });

    const parsed = parseOfferFunnelSearch(href.split("?")[1]);
    expect(parsed).toMatchObject({
      listingId: "C12345",
      address: "12 King St W #4, Toronto",
      city: "Toronto",
      province: "ON",
      price: 999_000,
      estimatedMonthlyRent: 6_200,
      capRate: 5.42,
      monthlyCashFlow: 875,
      source: "deals_map",
      signals: ["VTB", "power of sale"],
    });
  });

  it("omits invalid values and produces a clean direct URL", () => {
    expect(buildOfferFunnelHref({ price: Number.NaN, address: "  " })).toBe("/offer");
  });

  it("builds the structured handoff payload used by partners and CRM", () => {
    const summary = buildOfferDealSummary({
      listingId: "X1",
      address: "1 Main St",
      price: 750_000,
      capRate: 4.8,
      source: "listing_detail",
    });
    expect(summary.schemaVersion).toBe(1);
    expect(summary.source).toBe("listing_detail");
    expect(summary.listing.listPrice).toBe(750_000);
    expect(summary.underwriting.capRate).toBe(4.8);
  });
});
