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

  it("does not qualify weak or ordinary listing language by itself", () => {
    expect(isQualifiedDistressResult(scoreDistress("Estate sale in a beautiful family neighbourhood.", "ON"))).toBe(false);
    expect(isQualifiedDistressResult(scoreDistress("Handyman special with TLC required.", "AB"))).toBe(false);
    expect(isQualifiedDistressResult(scoreDistress("As-is property with office space and warehouse storage.", "BC"))).toBe(false);
    expect(isQualifiedDistressResult(scoreDistress("Price reduced on this clean move-in-ready home.", "ON"))).toBe(false);
  });

  it("keeps weak condition terms when paired with hard distress signals", () => {
    expect(isQualifiedDistressResult(scoreDistress("As is where is under power of sale.", "ON"))).toBe(true);
    expect(isQualifiedDistressResult(scoreDistress("Handyman special. Motivated seller, quick close preferred.", "BC"))).toBe(true);
  });

  it("respects negated distress language", () => {
    expect(isQualifiedDistressResult(scoreDistress("Not a power of sale. No VTB or seller financing.", "ON"))).toBe(false);
  });
});
