import { describe, expect, it } from "vitest";
import { deriveZoningTier, suiteForLot } from "./multiplexZoningTier";

describe("deriveZoningTier", () => {
  it("names a verified 6+1 site with the ward and the by-law", () => {
    const t = deriveZoningTier({
      sixplexEligible: true,
      sixplexCertainty: "verified",
      wardNumber: 14,
      wardName: "Toronto–Danforth",
      laneAccess: true,
      lotFrontageFt: 25,
      lotDepthFt: 120,
    });
    expect(t.code).toBe("6+1");
    expect(t.principalUnits).toBe(6);
    expect(t.suite).toBe("laneway");
    expect(t.certainty).toBe("verified");
    expect(t.wardLabel).toBe("Ward 14 (Toronto–Danforth)");
    expect(t.headline).toBe("6+1 site — Ward 14 (Toronto–Danforth) is a By-law 654-2025 sixplex ward; a laneway suite fits");
    expect(t.basis.some((b) => b.includes("654-2025"))).toBe(true);
  });

  it("drops to 6 when the lot is too shallow for a laneway suite", () => {
    const t = deriveZoningTier({
      sixplexEligible: true, sixplexCertainty: "verified", wardNumber: 9, wardName: "Davenport",
      laneAccess: true, lotFrontageFt: 25, lotDepthFt: 95,
    });
    expect(t.code).toBe("6");
    expect(t.suite).toBeNull();
    expect(t.headline).toMatch(/^6-unit site — Ward 9/);
    expect(t.headline).toMatch(/no rear suite/);
  });

  it("gives a 4+1 with a garden suite outside the sixplex wards", () => {
    const t = deriveZoningTier({
      sixplexEligible: false, sixplexCertainty: "verified", wardNumber: 3, wardName: "Etobicoke–Lakeshore",
      laneAccess: false, lotFrontageFt: 30, lotDepthFt: 130,
    });
    expect(t.code).toBe("4+1");
    expect(t.principalUnits).toBe(4);
    expect(t.suite).toBe("garden");
    expect(t.headline).toMatch(/outside the By-law 654-2025 sixplex wards/);
    expect(t.basis.some((b) => b.includes("Ward 3 (Etobicoke–Lakeshore) is not one of"))).toBe(true);
  });

  it("marks an inferred sixplex read as 'Likely' with an inferred badge", () => {
    const t = deriveZoningTier({
      sixplexEligible: true, sixplexCertainty: "inferred", laneAccess: false, lotFrontageFt: 20, lotDepthFt: 100,
    });
    expect(t.code).toBe("6");
    expect(t.certainty).toBe("inferred");
    expect(t.headline).toMatch(/^Likely 6-unit site/);
    expect(t.headline).toMatch(/ward not confirmed/);
  });

  it("treats a resolved non-sixplex ward as verified 4", () => {
    const t = deriveZoningTier({
      sixplexEligible: false, sixplexCertainty: "inferred", wardNumber: 20, wardName: "Scarborough Southwest",
      laneAccess: false, lotFrontageFt: 25, lotDepthFt: 100,
    });
    expect(t.code).toBe("4");
    expect(t.certainty).toBe("verified");
  });

  it("respects explicit suite possibilities from the feasibility engine", () => {
    const t = deriveZoningTier({
      sixplexEligible: false, sixplexCertainty: "inferred", laneAccess: true, lotFrontageFt: 25, lotDepthFt: 150,
      lanewaySuitePossible: false,
    });
    expect(t.code).toBe("4");
  });
});

describe("suiteForLot", () => {
  it("applies the report's thresholds exactly", () => {
    expect(suiteForLot({ laneAccess: true, lotFrontageFt: 20, lotDepthFt: 105 })).toBe("laneway");
    expect(suiteForLot({ laneAccess: true, lotFrontageFt: 20, lotDepthFt: 104 })).toBeNull();
    expect(suiteForLot({ laneAccess: false, lotFrontageFt: 28, lotDepthFt: 125 })).toBe("garden");
    expect(suiteForLot({ laneAccess: false, lotFrontageFt: 27, lotDepthFt: 125 })).toBeNull();
    expect(suiteForLot({ laneAccess: false, lotFrontageFt: 28, lotDepthFt: 124 })).toBeNull();
  });
});
