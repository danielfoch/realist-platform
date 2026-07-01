import { describe, expect, it } from "vitest";
import { assessEnvelopeFit, computeEnvelope } from "./multiplexEnvelope";

describe("computeEnvelope", () => {
  it("standard 25x120 RD lot: coverage governs the footprint", () => {
    // lot 3000 sqft; coverage 0.35 -> 1050 sqft footprint (plate is ~1446, so
    // coverage binds); 3 storeys -> 3150 theoretical; x0.78 practical = 2457
    const e = computeEnvelope({ lotFrontageFt: 25, lotDepthFt: 120, sixplexEligible: false });
    expect(e.lotAreaSqft.value).toBe(3000);
    expect(e.footprintSqft.value).toBe(1050);
    expect(e.footprintBasis).toBe("coverage");
    expect(e.storeys.value).toBe(3);
    expect(e.theoreticalGfaSqft.value).toBe(3150);
    expect(e.practicalGfaSqft.value).toBe(2457);
    expect(e.flags.find((f) => f.key === "narrow_lot")).toBeUndefined();
  });

  it("sixplex geography unlocks 4 storeys / 12m", () => {
    const e = computeEnvelope({ lotFrontageFt: 40, lotDepthFt: 120, sixplexEligible: true });
    expect(e.storeys.value).toBe(4);
    expect(e.maxHeightM.value).toBe(12);
    // 4800 x 0.35 = 1680 footprint; x4 = 6720; x0.78 = 5241.6 -> 5242
    expect(e.theoreticalGfaSqft.value).toBe(6720);
    expect(e.practicalGfaSqft.value).toBe(5242);
  });

  it("narrow lot takes the extra haircut and flags", () => {
    const e = computeEnvelope({ lotFrontageFt: 18, lotDepthFt: 135, sixplexEligible: false });
    // 2430 x 0.35 = 850.5; x3 = 2551.5; x0.78 x0.9 = 1791.2 -> 1791
    expect(e.practicalGfaSqft.value).toBe(1791);
    expect(e.haircutsApplied.map((h) => h.key)).toContain("narrow_lot");
    expect(e.flags.find((f) => f.key === "narrow_lot")).toBeDefined();
  });

  it("heritage and conservation stack multiplicatively", () => {
    const e = computeEnvelope({
      lotFrontageFt: 30,
      lotDepthFt: 120,
      sixplexEligible: false,
      heritage: true,
      conservationConstraint: true,
    });
    // 3600 x 0.35 = 1260; x3 = 3780; x0.78 x0.85 x0.80 = 2004.5 -> 2005
    expect(e.theoreticalGfaSqft.value).toBe(3780);
    expect(e.practicalGfaSqft.value).toBe(2005);
    expect(e.flags.map((f) => f.key)).toEqual(expect.arrayContaining(["heritage", "conservation"]));
  });

  it("setbacks govern on wide-but-shallow lots", () => {
    // 60x60: coverage cap = 1260; plate = (60-5.9) x (60-44.29) ~ 850 -> setbacks bind
    const e = computeEnvelope({ lotFrontageFt: 60, lotDepthFt: 60, sixplexEligible: false });
    expect(e.footprintBasis).toBe("setbacks");
    expect(e.footprintSqft.value).toBeLessThan(1260);
  });

  it("flags when setbacks consume the lot", () => {
    const e = computeEnvelope({ lotFrontageFt: 20, lotDepthFt: 40, sixplexEligible: false });
    expect(e.flags.find((f) => f.key === "no_buildable_plate")).toBeDefined();
  });

  it("wider side setbacks for 5+ unit buildings shrink the plate", () => {
    const small = computeEnvelope({ lotFrontageFt: 40, lotDepthFt: 120, sixplexEligible: true });
    const large = computeEnvelope({ lotFrontageFt: 40, lotDepthFt: 120, sixplexEligible: true, fivePlusUnits: true });
    expect(large.buildableWidthFt.value).toBeLessThan(small.buildableWidthFt.value);
  });

  it("carries provenance on every figure", () => {
    const e = computeEnvelope({ lotFrontageFt: 25, lotDepthFt: 120, sixplexEligible: false });
    expect(e.practicalGfaSqft.certainty).toBe("estimate");
    expect(e.storeys.certainty).toBe("verified");
    expect(e.lotAreaSqft.certainty).toBe("inferred");
    expect(e.storeys.source).toContain("569-2013");
  });
});

describe("assessEnvelopeFit", () => {
  const envelope = computeEnvelope({ lotFrontageFt: 40, lotDepthFt: 120, sixplexEligible: true });

  it("as-of-right when units and GFA fit with slack", () => {
    const fit = assessEnvelopeFit({ proposedGfaSqft: 3500, envelope, proposedUnits: 4, maxUnitsAsOfRight: 6 });
    expect(fit.path).toBe("as_of_right");
    expect(fit.slackPct).toBeGreaterThan(0.1);
  });

  it("minor variance when unit count exceeds as-of-right", () => {
    const fit = assessEnvelopeFit({ proposedGfaSqft: 4000, envelope, proposedUnits: 7, maxUnitsAsOfRight: 6 });
    expect(fit.path).toBe("minor_variance");
  });

  it("minor variance when GFA exceeds the envelope", () => {
    const fit = assessEnvelopeFit({ proposedGfaSqft: 6000, envelope, proposedUnits: 6, maxUnitsAsOfRight: 6 });
    expect(fit.path).toBe("minor_variance");
    expect(fit.slackPct).toBeLessThan(0);
  });

  it("rezoning when far past the unit ceiling", () => {
    const fit = assessEnvelopeFit({ proposedGfaSqft: 5000, envelope, proposedUnits: 9, maxUnitsAsOfRight: 6 });
    expect(fit.path).toBe("rezoning");
  });
});
