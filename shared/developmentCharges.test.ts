import { describe, expect, it } from "vitest";
import { computeTorontoDevelopmentCharges, dcUnitsFromMix } from "./developmentCharges";

describe("Toronto development charges — MM32.5 multiplex exemption", () => {
  it("charges a sixplex ONE unit's DC, not six (units 2–6 exempt)", () => {
    // 6 × 2-bed apartments. Ownership rate 2+bed = $80,690.
    const r = computeTorontoDevelopmentCharges({ units: [{ bedrooms: "2plus", count: 6 }] });
    expect(r.exemptionBasis).toBe("toronto_multiplex_mm32_5");
    expect(r.chargedUnits).toBe(1);
    expect(r.exemptUnits).toBe(5);
    expect(r.total).toBe(80690); // one unit, not 6 × 80,690
  });

  it("a fourplex is likewise charged one unit", () => {
    const r = computeTorontoDevelopmentCharges({ units: [{ bedrooms: "lt2", count: 4 }] });
    expect(r.chargedUnits).toBe(1);
    expect(r.total).toBe(52676); // apartment <2bed ownership rate
  });

  it("uses the highest applicable rate for the single charged unit (conservative)", () => {
    // mixed mix with at least one 2+bed → charged at the 2+bed rate
    const r = computeTorontoDevelopmentCharges({ units: [{ bedrooms: "lt2", count: 3 }, { bedrooms: "2plus", count: 3 }] });
    expect(r.total).toBe(80690);
  });

  it("applies the lower rental schedule for purpose-built rental", () => {
    const r = computeTorontoDevelopmentCharges({ units: [{ bedrooms: "2plus", count: 6 }], tenure: "rental" });
    expect(r.total).toBe(48299);
  });
});

describe("fallbacks beyond the multiplex exemption", () => {
  it("above six units, only Bill 23 (2nd+3rd) is exempt", () => {
    // 8 units 2+bed ownership → charged 6 units × 80,690
    const r = computeTorontoDevelopmentCharges({ units: [{ bedrooms: "2plus", count: 8 }] });
    expect(r.exemptionBasis).toBe("bill_23_additional_units");
    expect(r.chargedUnits).toBe(6);
    expect(r.exemptUnits).toBe(2);
    expect(r.total).toBe(6 * 80690);
  });

  it("after the MM32.5 sunset, a sixplex falls back to Bill 23", () => {
    const r = computeTorontoDevelopmentCharges({ units: [{ bedrooms: "2plus", count: 6 }], permitDateISO: "2027-09-01" });
    expect(r.exemptionBasis).toBe("bill_23_additional_units");
    expect(r.chargedUnits).toBe(4); // 6 - 2 exempt
    expect(r.total).toBe(4 * 80690);
  });

  it("in-window permit date keeps MM32.5", () => {
    const r = computeTorontoDevelopmentCharges({ units: [{ bedrooms: "2plus", count: 6 }], permitDateISO: "2026-12-01" });
    expect(r.exemptionBasis).toBe("toronto_multiplex_mm32_5");
    expect(r.chargedUnits).toBe(1);
  });

  it("a single unit has no additional-unit exemption", () => {
    const r = computeTorontoDevelopmentCharges({ units: [{ bedrooms: "2plus", count: 1 }] });
    // ≤6 units → still MM32.5 window (charges the one unit)
    expect(r.chargedUnits).toBe(1);
    expect(r.total).toBe(80690);
  });

  it("zero units → zero", () => {
    expect(computeTorontoDevelopmentCharges({ units: [] }).total).toBe(0);
  });
});

describe("dcUnitsFromMix", () => {
  it("buckets bedroom types into <2 and 2+", () => {
    const u = dcUnitsFromMix([{ type: "bachelor", count: 1 }, { type: "1br", count: 2 }, { type: "2br", count: 2 }, { type: "3br", count: 1 }]);
    expect(u).toContainEqual({ bedrooms: "lt2", count: 3 });
    expect(u).toContainEqual({ bedrooms: "2plus", count: 3 });
  });
});
