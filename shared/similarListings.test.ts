import { describe, expect, it } from "vitest";
import {
  isSubjectListing,
  isWithinPriceBand,
  rankSimilarListings,
  similarPriceBucket,
  SIMILAR_PRICE_BUCKET_SIZE,
  type SimilarListingCandidate,
} from "./similarListings";

function candidate(
  overrides: Partial<SimilarListingCandidate> = {},
): SimilarListingCandidate {
  return {
    mlsNumber: "X100001",
    address: "42 Barton St E",
    city: "Hamilton",
    province: "ON",
    propertyType: "Single Family",
    price: 800000,
    bedrooms: 3,
    bathrooms: 2,
    photoUrl: null,
    ...overrides,
  };
}

const target = { city: "Hamilton", propertyType: null, price: 800000 };

describe("rankSimilarListings", () => {
  it("only matches the same city, case-insensitively", () => {
    const rows = [
      candidate({ mlsNumber: "A1", city: "HAMILTON " }),
      candidate({ mlsNumber: "A2", city: "hamilton" }),
      candidate({ mlsNumber: "A3", city: "Toronto" }),
      candidate({ mlsNumber: "A4", city: null }),
    ];
    const ranked = rankSimilarListings(rows, target);
    expect(ranked.map((r) => r.mlsNumber)).toEqual(["A1", "A2"]);
  });

  it("matches property type loosely when the target specifies one, and never matches unknown types", () => {
    const rows = [
      candidate({ mlsNumber: "B1", propertyType: "Condo Apartment" }),
      candidate({ mlsNumber: "B2", propertyType: "Single Family" }),
      candidate({ mlsNumber: "B3", propertyType: null }),
    ];
    const typed = rankSimilarListings(rows, { ...target, propertyType: "condo" });
    expect(typed.map((r) => r.mlsNumber)).toEqual(["B1"]);

    // No target type → all real listings in the city/band qualify.
    const untyped = rankSimilarListings(rows, target);
    expect(untyped.map((r) => r.mlsNumber)).toEqual(["B1", "B2", "B3"]);
  });

  it("keeps prices exactly on the ±25% boundary and drops just-outside or unknown prices", () => {
    const rows = [
      candidate({ mlsNumber: "C1", price: 600000 }), // exactly -25%
      candidate({ mlsNumber: "C2", price: 1000000 }), // exactly +25%
      candidate({ mlsNumber: "C3", price: 599999 }),
      candidate({ mlsNumber: "C4", price: 1000001 }),
      candidate({ mlsNumber: "C5", price: null }),
    ];
    const ranked = rankSimilarListings(rows, target);
    expect(ranked.map((r) => r.mlsNumber).sort()).toEqual(["C1", "C2"]);
  });

  it("excludes the subject listing by MLS number or loose address match", () => {
    const rows = [
      candidate({ mlsNumber: "D1", address: "10 King St W" }),
      candidate({ mlsNumber: "D2", address: "42 Barton St E" }),
      candidate({ mlsNumber: "D3", address: "9 Queen Ave" }),
    ];
    const byAddress = rankSimilarListings(rows, { ...target, exclude: "42 Barton St" });
    expect(byAddress.map((r) => r.mlsNumber)).toEqual(["D1", "D3"]);

    const byMls = rankSimilarListings(rows, { ...target, exclude: "d3" });
    expect(byMls.map((r) => r.mlsNumber)).toEqual(["D1", "D2"]);
  });

  it("ranks by absolute price distance ascending and caps at the limit", () => {
    const rows = [
      candidate({ mlsNumber: "E1", price: 900000 }),
      candidate({ mlsNumber: "E2", price: 810000 }),
      candidate({ mlsNumber: "E3", price: 795000 }),
      candidate({ mlsNumber: "E4", price: 750000 }),
    ];
    const ranked = rankSimilarListings(rows, target);
    expect(ranked.map((r) => r.mlsNumber)).toEqual(["E3", "E2", "E4"]);
  });

  it("returns an empty array for empty candidates or an invalid target", () => {
    expect(rankSimilarListings([], target)).toEqual([]);
    expect(rankSimilarListings([candidate()], { ...target, city: "  " })).toEqual([]);
    expect(rankSimilarListings([candidate()], { ...target, price: 0 })).toEqual([]);
    expect(rankSimilarListings([candidate()], { ...target, price: Number.NaN })).toEqual([]);
  });
});

describe("isWithinPriceBand", () => {
  it("rejects unknown or non-positive prices", () => {
    expect(isWithinPriceBand(null, 800000)).toBe(false);
    expect(isWithinPriceBand(0, 800000)).toBe(false);
    expect(isWithinPriceBand(Number.NaN, 800000)).toBe(false);
  });
});

describe("isSubjectListing", () => {
  it("never excludes anything when no subject identifier was provided", () => {
    expect(isSubjectListing(candidate(), null)).toBe(false);
    expect(isSubjectListing(candidate(), "   ")).toBe(false);
  });

  it("does not treat an empty candidate address as a match", () => {
    expect(isSubjectListing(candidate({ address: null }), "42 Barton St")).toBe(false);
  });
});

describe("similarPriceBucket", () => {
  it("groups nearby prices into the same bucket and never returns zero", () => {
    expect(similarPriceBucket(800000)).toBe(similarPriceBucket(810000));
    expect(similarPriceBucket(800000)).toBe(800000 / SIMILAR_PRICE_BUCKET_SIZE);
    expect(similarPriceBucket(1)).toBe(1);
  });
});
