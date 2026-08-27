import { describe, expect, it } from "vitest";
import { computeEnvelope } from "./multiplexEnvelope";
import { generateConfigurations, mixNetSqft, packUnitMix } from "./multiplexConfigs";

describe("packUnitMix", () => {
  it("packs a family-friendly six-unit mix when the budget allows", () => {
    // 1x3BR + 3x2BR + 2x1BR = 950 + 2250 + 1100 = 4300 net sqft
    const mix = packUnitMix(6, 4300);
    expect(mix).not.toBeNull();
    expect(mixNetSqft(mix!)).toBe(4300);
    expect(mix!.find((e) => e.type === "3br")?.count).toBe(1);
    expect(mix!.find((e) => e.type === "2br")?.count).toBe(3);
    expect(mix!.find((e) => e.type === "1br")?.count).toBe(2);
  });

  it("downshifts 2BRs to 1BRs to fit a tighter budget", () => {
    const mix = packUnitMix(6, 4000);
    expect(mix).not.toBeNull();
    expect(mixNetSqft(mix!)).toBeLessThanOrEqual(4000);
    expect(mix!.reduce((s, e) => s + e.count, 0)).toBe(6);
  });

  it("returns null when the unit count cannot fit", () => {
    expect(packUnitMix(6, 3000)).toBeNull();
    expect(packUnitMix(0, 5000)).toBeNull();
  });

  it("skips the 3BR under four units", () => {
    const mix = packUnitMix(3, 3000);
    expect(mix!.find((e) => e.type === "3br")).toBeUndefined();
  });
});

describe("generateConfigurations", () => {
  it("small non-sixplex lot yields a right-sized as-of-right config", () => {
    const envelope = computeEnvelope({ lotFrontageFt: 25, lotDepthFt: 120, sixplexEligible: false });
    const configs = generateConfigurations({
      envelope,
      maxUnitsAsOfRight: 4,
      sixplexCertainty: "inferred",
      lanewayEligible: false,
      gardenSuiteEligible: false,
    });
    expect(configs.length).toBeGreaterThanOrEqual(1);
    const a = configs[0];
    // practical 2457 x 0.85 = ~2089 net budget -> 3 units is the honest fit
    expect(a.units).toBe(3);
    expect(a.approvalPath).toBe("as_of_right");
    expect(a.parkingRequired).toBe(0);
  });

  it("sixplex ward lot yields fourplex + sixplex + suite + stretch reads", () => {
    const envelope = computeEnvelope({ lotFrontageFt: 40, lotDepthFt: 120, sixplexEligible: true });
    const configs = generateConfigurations({
      envelope,
      maxUnitsAsOfRight: 6,
      sixplexCertainty: "verified",
      lanewayEligible: true,
      gardenSuiteEligible: true,
    });
    const keys = configs.map((c) => c.key);
    expect(keys).toContain("fourplex");
    expect(keys).toContain("sixplex");
    expect(keys).toContain("plus_suite");

    const six = configs.find((c) => c.key === "sixplex")!;
    expect(six.units).toBe(6);
    expect(six.approvalPath).toBe("as_of_right");

    const suite = configs.find((c) => c.key === "plus_suite")!;
    expect(suite.includesSuite).toBe(true);
    expect(suite.units).toBe(7);
    // The laneway suite does not trip the multiplex unit maximum
    expect(suite.approvalPath).toBe("as_of_right");
  });

  it("flags inferred sixplex geography on 5+ unit configs", () => {
    const envelope = computeEnvelope({ lotFrontageFt: 40, lotDepthFt: 120, sixplexEligible: true });
    const configs = generateConfigurations({
      envelope,
      maxUnitsAsOfRight: 6,
      sixplexCertainty: "inferred",
      lanewayEligible: false,
      gardenSuiteEligible: false,
    });
    const six = configs.find((c) => c.key === "sixplex")!;
    expect(six.flags.map((f) => f.key)).toContain("sixplex_unverified");
    expect(six.approvalCertainty).toBe("inferred");
  });

  it("stretch config carries a variance flag when it fits physically", () => {
    // Big lot so 8 units fit the envelope but exceed the 6-unit ceiling
    const envelope = computeEnvelope({ lotFrontageFt: 50, lotDepthFt: 150, sixplexEligible: true });
    const configs = generateConfigurations({
      envelope,
      maxUnitsAsOfRight: 6,
      sixplexCertainty: "verified",
      lanewayEligible: false,
      gardenSuiteEligible: false,
    });
    const stretch = configs.find((c) => c.key === "stretch");
    expect(stretch).toBeDefined();
    expect(stretch!.approvalPath).not.toBe("as_of_right");
    expect(stretch!.flags.map((f) => f.key)).toContain("stretch_variance");
  });
});
