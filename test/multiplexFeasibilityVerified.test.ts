/**
 * Layer A — verified-input behaviour of the multiplex feasibility engine:
 * ward-driven sixplex certainty, overlay-driven coverage/height, and the
 * O.Reg 462/24 provincial ARU override. Uses jest (test/ runner).
 */
import { computeMultiplexFeasibility } from "../server/multiplexFeasibility";

const torontoBase = { address: "123 Test St", city: "Toronto", province: "ON", zoneCode: "RD" };

describe("verified ward → sixplex certainty", () => {
  it("confirms as-of-right in an eligible ward (verified)", () => {
    const r = computeMultiplexFeasibility({ ...torontoBase, verifiedWard: 14, verifiedWardName: "Toronto–Danforth" });
    expect(r.permissions.six_unit_area_status).toBe("more_likely_area");
    expect(r.permissions.six_unit_certainty).toBe("verified");
    expect(r.permissions.ward_number).toBe(14);
  });

  it("confirms NOT eligible in a non-sixplex ward (verified), capping at four", () => {
    const r = computeMultiplexFeasibility({ ...torontoBase, verifiedWard: 2 });
    expect(r.permissions.six_unit_area_status).toBe("not_applicable");
    expect(r.permissions.six_unit_certainty).toBe("verified");
    // No "verify the ward" nudge should be produced when the ward is known.
    const assumption = r.assumptions.find((a) => a.label === "Toronto 6-unit status")!;
    expect(assumption.value).toMatch(/capped at four/i);
    expect(assumption.certainty).toBe("direct");
  });

  it("does not contradict a verified non-sixplex ward anywhere in the result", () => {
    // Regression: range, scenarios, GFA rows, headline and six_unit_area_possible
    // must all honour the verified 'capped at four', not the static Toronto flag.
    const r = computeMultiplexFeasibility({ ...torontoBase, lotArea: 4000, verifiedWard: 20 });
    expect(r.permissions.six_unit_area_possible).toBe(false);
    expect(r.permissions.likely_units_high).toBeLessThanOrEqual(4);
    expect(r.permissions.likely_range_label).not.toMatch(/6/);
    expect(r.permissions.scenarios.some((s) => s.units === 6)).toBe(false);
    expect(r.envelope.unit_scenarios.some((u) => u.units === 6)).toBe(false);
    expect(r.quick_read.headline).not.toMatch(/up to 6/i);
  });

  it("falls back to inferred heuristic when no ward is provided", () => {
    const r = computeMultiplexFeasibility({ ...torontoBase, postalCode: "M4K 1A1" });
    expect(r.permissions.six_unit_certainty).toBe("inferred");
  });

  it("honours councillor opt-in wards passed by the caller", () => {
    // Ward 2 is not in the statutory nine; an admin-recorded opt-in flips it.
    const without = computeMultiplexFeasibility({ ...torontoBase, verifiedWard: 2 });
    expect(without.permissions.six_unit_area_status).toBe("not_applicable");
    const withOptIn = computeMultiplexFeasibility({ ...torontoBase, verifiedWard: 2, optInWards: [2] });
    expect(withOptIn.permissions.six_unit_area_status).toBe("more_likely_area");
    expect(withOptIn.permissions.six_unit_certainty).toBe("verified");
  });
});

describe("verified overlays → coverage/height basis", () => {
  it("uses the lot coverage overlay value with bylaw basis", () => {
    const r = computeMultiplexFeasibility({
      ...torontoBase, lotArea: 4000, verifiedLotCoverageRatio: 0.5,
    });
    expect(r.envelope.coverage_basis).toBe("bylaw");
    expect(r.envelope.estimated_lot_coverage_ratio).toBe(0.5);
  });

  it("derives storeys from a verified height overlay", () => {
    const r = computeMultiplexFeasibility({
      ...torontoBase, lotArea: 4000, verifiedMaxHeightM: 10,
    });
    expect(r.envelope.height_basis).toBe("overlay");
    expect(r.envelope.max_height_m).toBe(10);
    expect(r.envelope.estimated_storeys).toBe(3); // floor(10/3)
  });
});

describe("O.Reg 462/24 provincial ARU override", () => {
  it("raises a low municipal coverage to the 45% ARU floor on Ontario lots", () => {
    // RD zone hint gives 33% coverage; provincial floor should lift to 45%.
    const r = computeMultiplexFeasibility({ ...torontoBase, lotArea: 4000 });
    expect(r.permissions.provincial_aru_standard_applied).toBe(true);
    expect(r.envelope.estimated_lot_coverage_ratio).toBeGreaterThanOrEqual(0.45);
    expect(r.sources.some((s) => s.name.includes("O. Reg. 462/24"))).toBe(true);
  });

  it("does NOT lower a higher verified coverage to the floor", () => {
    const r = computeMultiplexFeasibility({ ...torontoBase, lotArea: 4000, verifiedLotCoverageRatio: 0.6 });
    expect(r.envelope.estimated_lot_coverage_ratio).toBe(0.6);
  });

  it("can be disabled explicitly (e.g. unserviced lot)", () => {
    const r = computeMultiplexFeasibility({ ...torontoBase, lotArea: 4000, applyProvincialAruStandards: false });
    expect(r.permissions.provincial_aru_standard_applied).toBe(false);
  });

  it("does not apply outside Ontario", () => {
    const r = computeMultiplexFeasibility({ address: "1 W St", city: "Vancouver", province: "BC", lotArea: 4000 });
    expect(r.permissions.provincial_aru_standard_applied).toBe(false);
  });
});
