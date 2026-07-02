import { describe, expect, it } from "vitest";
import {
  buildCapRatesSearchUrl,
  describeSearchCriteria,
  detectPriceChange,
  isSearchDue,
  matchesSearchCriteria,
  type CandidateListing,
} from "./watchlistAlerts";

function listing(overrides: Partial<CandidateListing> = {}): CandidateListing {
  return {
    key: "X123456",
    country: "CA",
    address: "42 Barton St E",
    city: "Edmonton",
    province: "AB",
    propertyType: "Multi-family",
    price: 899000,
    capRate: 6.2,
    ...overrides,
  };
}

describe("detectPriceChange", () => {
  it("returns null when either price is missing or non-positive", () => {
    expect(detectPriceChange(null, 500000)).toBeNull();
    expect(detectPriceChange(500000, undefined)).toBeNull();
    expect(detectPriceChange(0, 500000)).toBeNull();
    expect(detectPriceChange(500000, Number.NaN)).toBeNull();
  });

  it("returns null when the price is unchanged", () => {
    expect(detectPriceChange(500000, 500000)).toBeNull();
  });

  it("suppresses moves below both the $5k and 1.5% noise floors", () => {
    // $4k on $500k = 0.8% — below both thresholds.
    expect(detectPriceChange(500000, 496000)).toBeNull();
  });

  it("detects a drop that clears the absolute threshold", () => {
    const change = detectPriceChange(500000, 480000);
    expect(change).not.toBeNull();
    expect(change!.direction).toBe("drop");
    expect(change!.changeAmount).toBe(-20000);
    expect(change!.changePercent).toBe(-4);
  });

  it("detects a small-dollar change on a cheap listing via the percent threshold", () => {
    // $4.5k on $100k = 4.5% — below $5k but above 1.5%.
    const change = detectPriceChange(100000, 95500);
    expect(change).not.toBeNull();
    expect(change!.direction).toBe("drop");
  });

  it("detects increases too", () => {
    const change = detectPriceChange(700000, 725000);
    expect(change).not.toBeNull();
    expect(change!.direction).toBe("increase");
    expect(change!.changeAmount).toBe(25000);
  });
});

describe("matchesSearchCriteria", () => {
  it("matches on city case-insensitively", () => {
    expect(matchesSearchCriteria({ city: "edmonton" }, listing())).toBe(true);
    expect(matchesSearchCriteria({ city: "Calgary" }, listing())).toBe(false);
  });

  it("matches property type bidirectionally (partial containment)", () => {
    expect(matchesSearchCriteria({ propertyType: "multi" }, listing())).toBe(true);
    expect(
      matchesSearchCriteria({ propertyType: "Multi-family home" }, listing({ propertyType: "Multi-family" })),
    ).toBe(true);
    expect(matchesSearchCriteria({ propertyType: "condo" }, listing())).toBe(false);
  });

  it("does not match a propertyType criterion when the listing type is unknown", () => {
    expect(matchesSearchCriteria({ propertyType: "duplex" }, listing({ propertyType: null }))).toBe(false);
  });

  it("enforces max/min price and rejects unknown prices when a price filter is set", () => {
    expect(matchesSearchCriteria({ maxPrice: 900000 }, listing())).toBe(true);
    expect(matchesSearchCriteria({ maxPrice: 800000 }, listing())).toBe(false);
    expect(matchesSearchCriteria({ minPrice: 1000000 }, listing())).toBe(false);
    expect(matchesSearchCriteria({ maxPrice: 900000 }, listing({ price: null }))).toBe(false);
  });

  it("only matches minCap when the cap rate is actually known", () => {
    expect(matchesSearchCriteria({ minCap: 6 }, listing())).toBe(true);
    expect(matchesSearchCriteria({ minCap: 7 }, listing())).toBe(false);
    // Unknown cap rate: never claim a match we can't verify.
    expect(matchesSearchCriteria({ minCap: 5 }, listing({ capRate: null }))).toBe(false);
  });

  it("filters by country", () => {
    expect(matchesSearchCriteria({ country: "CA" }, listing())).toBe(true);
    expect(matchesSearchCriteria({ country: "US" }, listing())).toBe(false);
    expect(matchesSearchCriteria({ country: "US" }, listing({ country: "US" }))).toBe(true);
  });

  it("matches everything when no criteria are set", () => {
    expect(matchesSearchCriteria({}, listing())).toBe(true);
  });

  it("requires all set criteria to hold simultaneously", () => {
    const criteria = { city: "Edmonton", propertyType: "multi", maxPrice: 950000, minCap: 6 };
    expect(matchesSearchCriteria(criteria, listing())).toBe(true);
    expect(matchesSearchCriteria(criteria, listing({ city: "Red Deer" }))).toBe(false);
    expect(matchesSearchCriteria(criteria, listing({ capRate: 4.1 }))).toBe(false);
  });
});

describe("isSearchDue", () => {
  const now = new Date("2026-07-01T12:00:00Z");

  it("is due when the search has never run", () => {
    expect(isSearchDue("daily", null, now)).toBe(true);
    expect(isSearchDue("weekly", undefined, now)).toBe(true);
  });

  it("daily searches come due after ~a day and not before", () => {
    expect(isSearchDue("daily", new Date("2026-07-01T02:00:00Z"), now)).toBe(false);
    expect(isSearchDue("daily", new Date("2026-06-30T11:00:00Z"), now)).toBe(true);
  });

  it("weekly searches come due after ~a week and not before", () => {
    expect(isSearchDue("weekly", new Date("2026-06-28T12:00:00Z"), now)).toBe(false);
    expect(isSearchDue("weekly", new Date("2026-06-24T11:00:00Z"), now)).toBe(true);
  });
});

describe("buildCapRatesSearchUrl", () => {
  it("prefers the original free-text query", () => {
    expect(buildCapRatesSearchUrl({ query: "6 plex edmonton", city: "Edmonton" }))
      .toBe("/tools/cap-rates?q=6+plex+edmonton");
  });

  it("falls back to composing a query from structured criteria", () => {
    expect(buildCapRatesSearchUrl({ propertyType: "duplex", city: "Hamilton" }))
      .toBe("/tools/cap-rates?q=duplex+Hamilton");
  });

  it("carries the min cap filter the map can re-apply", () => {
    expect(buildCapRatesSearchUrl({ city: "Windsor", minCap: 6.5 }))
      .toBe("/tools/cap-rates?q=Windsor&minCapRate=6.5");
  });

  it("degrades to the bare map when there is nothing to encode", () => {
    expect(buildCapRatesSearchUrl({})).toBe("/tools/cap-rates");
  });
});

describe("describeSearchCriteria", () => {
  it("builds a readable label from structured criteria", () => {
    expect(describeSearchCriteria({ propertyType: "duplex", city: "Hamilton", minCap: 6, maxPrice: 750000 }))
      .toBe("duplex · Hamilton · 6%+ cap · under $750,000");
  });

  it("falls back to the raw query, then a generic label", () => {
    expect(describeSearchCriteria({ query: "brrr windsor" })).toBe("brrr windsor");
    expect(describeSearchCriteria({})).toBe("Saved search");
  });
});
