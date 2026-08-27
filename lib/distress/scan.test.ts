import { describe, expect, it } from "vitest";
import { scoreDistress } from "./scoring";
import {
  buildDistressListingRow,
  filterDistressListings,
  primaryDistressCategory,
  type ScoredDistressListing,
} from "./scan";

function scored(remarks: string, overrides: Partial<ScoredDistressListing> = {}): ScoredDistressListing {
  return {
    listingKey: "X100",
    mlsNumber: "X100",
    listPrice: 500000,
    address: { streetNumber: "123", streetName: "Main", streetSuffix: "St", city: "Hamilton", state: "Ontario", zip: "L8P 1A1" },
    map: { latitude: 43.25, longitude: -79.87 },
    type: "Single Family",
    distress: scoreDistress(remarks, "ON"),
    rawRemarks: remarks,
    ...overrides,
  };
}

describe("primaryDistressCategory", () => {
  it("prefers foreclosure over everything, then vtb, then motivated", () => {
    const posAndMotivated = scoreDistress("Under power of sale. Motivated seller, must sell.", "ON");
    expect(primaryDistressCategory(posAndMotivated)).toBe("foreclosure_pos");

    const vtbAndMotivated = scoreDistress("Vendor take back available. Motivated seller.", "ON");
    expect(primaryDistressCategory(vtbAndMotivated)).toBe("vtb");

    const motivatedOnly = scoreDistress("Motivated seller, bring an offer.", "ON");
    expect(primaryDistressCategory(motivatedOnly)).toBe("motivated");
  });
});

describe("buildDistressListingRow", () => {
  it("maps a scored listing into a durable history row", () => {
    const listing = scored("Property is being sold under power of sale.");
    const row = buildDistressListingRow(listing, "2026-08-27");

    expect(row).not.toBeNull();
    expect(row!.listingKey).toBe("X100");
    expect(row!.address).toBe("123 Main St");
    expect(row!.city).toBe("Hamilton");
    expect(row!.province).toBe("Ontario");
    expect(row!.category).toBe("foreclosure_pos");
    expect(row!.normalizedScore).toBe(listing.distress.distressScore);
    expect(row!.rawScore).toBe(listing.distress.rawScore);
    expect(row!.lat).toBe(43.25);
    expect(row!.lastListPrice).toBe(500000);
    expect(row!.priceHistory).toEqual([{ date: "2026-08-27", price: 500000 }]);
  });

  it("truncates the remarks excerpt to 500 characters", () => {
    const remarks = "Under power of sale. " + "x".repeat(600);
    const row = buildDistressListingRow(scored(remarks), "2026-08-27");
    expect(row!.publicRemarksExcerpt).toHaveLength(500);
  });

  it("seeds an empty price history when there is no list price", () => {
    const row = buildDistressListingRow(
      scored("Under power of sale.", { listPrice: 0 }),
      "2026-08-27"
    );
    expect(row!.listPrice).toBeNull();
    expect(row!.lastListPrice).toBeNull();
    expect(row!.priceHistory).toEqual([]);
  });

  it("returns null without a listing key", () => {
    const row = buildDistressListingRow(
      scored("Under power of sale.", { listingKey: "", mlsNumber: undefined }),
      "2026-08-27"
    );
    expect(row).toBeNull();
  });
});

describe("filterDistressListings", () => {
  const pos = scored("Property is being sold under power of sale.");
  const vtb = scored("Vendor take back financing available.", { listingKey: "X200" });
  const weak = scored("Handyman special with TLC required.", { listingKey: "X300" });

  it("drops unqualified listings even with no filters", () => {
    const filtered = filterDistressListings([pos, vtb, weak]);
    expect(filtered.map(l => l.listingKey)).toEqual(["X100", "X200"]);
  });

  it("filters by category", () => {
    const filtered = filterDistressListings([pos, vtb], { categories: ["vtb"] });
    expect(filtered.map(l => l.listingKey)).toEqual(["X200"]);
  });

  it("filters by excluded keywords in remarks", () => {
    const filtered = filterDistressListings([pos, vtb], { excludeKeywords: ["vendor take back"] });
    expect(filtered.map(l => l.listingKey)).toEqual(["X100"]);
  });

  it("filters by minimum score", () => {
    const filtered = filterDistressListings([pos], { minScore: 1000 });
    expect(filtered).toEqual([]);
  });
});
