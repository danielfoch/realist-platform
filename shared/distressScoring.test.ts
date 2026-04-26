import { describe, expect, it } from "vitest";
import { isQualifiedDistressResult, scoreDistress } from "./distressScoring";

describe("distress scoring", () => {
  it("does not qualify ordinary commercial descriptors as distress", () => {
    const result = scoreDistress("Commercial building with office space, warehouse area, and industrial zoning.", "ON");

    expect(result.distressScore).toBe(0);
    expect(result.matchedTerms).toEqual([]);
    expect(isQualifiedDistressResult(result)).toBe(false);
  });

  it("qualifies foreclosure, motivated, and VTB signals", () => {
    expect(isQualifiedDistressResult(scoreDistress("Property is being sold under power of sale.", "ON"))).toBe(true);
    expect(isQualifiedDistressResult(scoreDistress("Motivated seller, bring an offer.", "BC"))).toBe(true);
    expect(isQualifiedDistressResult(scoreDistress("Vendor take back financing available.", "AB"))).toBe(true);
  });
});
