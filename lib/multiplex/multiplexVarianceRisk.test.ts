import { describe, expect, it } from "vitest";
import { assessVarianceRisk } from "./multiplexVarianceRisk";

const cleanConfig = {
  approvalPath: "as_of_right" as const,
  envelopeSlackPct: 0.3,
  approvalCertainty: "verified" as const,
  units: 4,
};

const noOverlays = {
  heritage: false,
  conservationRegulated: false,
  cityTreeConflict: false,
  narrowLot: false,
};

describe("assessVarianceRisk", () => {
  it("clean as-of-right fourplex is LOW", () => {
    const r = assessVarianceRisk({ config: cleanConfig, ...noOverlays });
    expect(r.level).toBe("low");
    expect(r.factors).toHaveLength(0);
  });

  it("tight envelope alone is MEDIUM", () => {
    const r = assessVarianceRisk({ config: { ...cleanConfig, envelopeSlackPct: 0.05 }, ...noOverlays });
    expect(r.level).toBe("medium");
    expect(r.factors.map((f) => f.key)).toContain("tight_envelope");
  });

  it("heritage pushes to HIGH", () => {
    const r = assessVarianceRisk({ config: cleanConfig, ...noOverlays, heritage: true });
    expect(r.level).toBe("high");
  });

  it("conservation regulation pushes to HIGH", () => {
    const r = assessVarianceRisk({ config: cleanConfig, ...noOverlays, conservationRegulated: true });
    expect(r.level).toBe("high");
  });

  it("variance-requiring config is HIGH", () => {
    const r = assessVarianceRisk({
      config: { ...cleanConfig, approvalPath: "minor_variance", envelopeSlackPct: -0.05 },
      ...noOverlays,
    });
    expect(r.level).toBe("high");
    expect(r.factors.map((f) => f.key)).toEqual(expect.arrayContaining(["variance_needed", "envelope_breach"]));
  });

  it("city tree + narrow lot stack to HIGH without any single high factor", () => {
    const r = assessVarianceRisk({
      config: { ...cleanConfig, envelopeSlackPct: 0.08 },
      ...noOverlays,
      cityTreeConflict: true,
      narrowLot: true,
    });
    // 25 + 20 + 20 = 65
    expect(r.level).toBe("high");
    expect(r.factors.length).toBe(3);
  });

  it("unverified sixplex geography adds a factor on 5+ unit configs", () => {
    const r = assessVarianceRisk({
      config: { ...cleanConfig, units: 6, approvalCertainty: "inferred" },
      ...noOverlays,
    });
    expect(r.factors.map((f) => f.key)).toContain("sixplex_unverified");
    expect(r.level).toBe("low");
  });
});
