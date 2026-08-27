import { describe, expect, it } from "vitest";
import { normalizeListingLot } from "./listingLot";

describe("DDF lot normalization", () => {
  it("uses explicit frontage and depth fields", () => {
    expect(normalizeListingLot({ frontage: 30, depth: 120 })).toMatchObject({
      frontageFt: 30,
      depthFt: 120,
      areaSqft: 3_600,
    });
  });

  it("recovers dimensions from a metric listing string", () => {
    const lot = normalizeListingLot({ dimensions: "9.14 x 36.58 metres" });
    expect(lot.frontageFt).toBeCloseTo(30, 0);
    expect(lot.depthFt).toBeCloseTo(120, 0);
    expect(lot.basis).toContain("dimension_text");
  });

  it("converts listed acreage to square feet", () => {
    expect(normalizeListingLot({ area: 0.1, areaUnit: "acres" }).areaSqft).toBe(4_356);
  });
});
