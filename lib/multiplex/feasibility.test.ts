/**
 * Tests for the transit station area layer of the feasibility engine
 * (lib/multiplex/feasibility.ts).
 *
 * MTSA/PMTSA membership is the one input where a wrong answer costs real money —
 * it decides whether parking minimums exist and whether a height argument is
 * available — so what these pin down is the boundary between what the engine
 * *knows* and what it *guessed*: a distance never becomes a delineation, and an
 * unimplemented provincial height direction never becomes buildable GFA.
 */
import { describe, expect, it } from "vitest";
import {
  computeMultiplexFeasibility,
  MTSA_OUTER_RADIUS_M,
  TORONTO_MTSA_LOW_RISE_STOREYS,
  type FeasibilityInput,
} from "./feasibility";

const torontoLot: FeasibilityInput = {
  address: "123 Main St",
  city: "Toronto",
  province: "ON",
  lotFrontage: 30,
  lotDepth: 120,
};

describe("transit station area status", () => {
  it("stays out of the way when no transit input is supplied", () => {
    const r = computeMultiplexFeasibility(torontoLot);

    expect(r.transit.status).toBe("unknown");
    expect(r.transit.certainty).toBe("unknown");
    expect(r.transit.parking_minimums_prohibited).toBe(false);
    expect(r.transit.policy_height_storeys).toBeNull();
    // No transit sources get cited for a screening that applied no transit policy.
    expect(r.sources.some((s) => s.name.includes("Major Transit Station Area"))).toBe(false);
  });

  it("infers a possible MTSA inside the radius without claiming a delineation", () => {
    const r = computeMultiplexFeasibility({ ...torontoLot, transitStationDistanceM: 400 });

    expect(r.transit.status).toBe("likely_mtsa_inferred");
    expect(r.transit.certainty).toBe("inferred");
    // An inferred area never unlocks the in-force parking rule or the height uplift.
    expect(r.transit.parking_minimums_prohibited).toBe(false);
    expect(r.transit.policy_height_storeys).toBeNull();
    expect(r.quick_read.key_blockers.some((b) => b.includes("verify the delineation"))).toBe(true);
    expect(r.risk_flags.some((f) => f.flag === "MTSA Status Inferred From Distance")).toBe(true);
  });

  it("treats distance beyond the radius as probably outside", () => {
    const r = computeMultiplexFeasibility({
      ...torontoLot,
      transitStationDistanceM: MTSA_OUTER_RADIUS_M + 1,
    });

    expect(r.transit.status).toBe("outside");
    expect(r.transit.certainty).toBe("inferred");
  });

  it("lets a confirmed status override a contradicting distance", () => {
    const r = computeMultiplexFeasibility({
      ...torontoLot,
      transitAreaStatus: "outside",
      transitStationDistanceM: 100,
    });

    expect(r.transit.status).toBe("outside");
    expect(r.transit.certainty).toBe("direct");
    expect(r.transit.parking_minimums_prohibited).toBe(false);
  });
});

describe("confirmed P/MTSA effects", () => {
  it("removes parking minimums inside a confirmed MTSA and cites Bill 185", () => {
    const r = computeMultiplexFeasibility({ ...torontoLot, transitAreaStatus: "mtsa" });

    expect(r.transit.parking_minimums_prohibited).toBe(true);
    expect(r.risk_flags.some((f) => f.flag.includes("none can be imposed"))).toBe(true);
    expect(r.sources.some((s) => s.name.includes("Bill 185"))).toBe(true);
  });

  it("gates inclusionary zoning on PMTSA status specifically", () => {
    const mtsa = computeMultiplexFeasibility({ ...torontoLot, transitAreaStatus: "mtsa" });
    const pmtsa = computeMultiplexFeasibility({ ...torontoLot, transitAreaStatus: "pmtsa" });

    expect(mtsa.transit.inclusionary_zoning_possible).toBe(false);
    expect(pmtsa.transit.inclusionary_zoning_possible).toBe(true);
    // ...and says plainly that a multiplex is nowhere near the threshold.
    expect(pmtsa.transit.inclusionary_zoning_note).toContain("100+ units");
  });

  it("offers the Toronto height direction as an application, never as-of-right", () => {
    const r = computeMultiplexFeasibility({ ...torontoLot, transitAreaStatus: "pmtsa" });

    expect(r.transit.policy_height_storeys).toBe(TORONTO_MTSA_LOW_RISE_STOREYS.interior);

    const upside = r.permissions.scenarios.find((s) => s.name.includes("Transit-Oriented"));
    expect(upside).toBeDefined();
    expect(upside!.approval_path).toBe("rezoning_required");
    expect(r.risk_flags.some((f) => f.flag === "Transit-Area Height Is Policy, Not Zoning")).toBe(true);
  });

  it("uses the major-street height where the lot fronts one", () => {
    const r = computeMultiplexFeasibility({
      ...torontoLot,
      transitAreaStatus: "pmtsa",
      majorStreet: true,
    });

    expect(r.transit.policy_height_storeys).toBe(TORONTO_MTSA_LOW_RISE_STOREYS.majorStreet);
  });

  it("never lets the transit-area height inflate the envelope math", () => {
    const base = computeMultiplexFeasibility(torontoLot);
    const inPmtsa = computeMultiplexFeasibility({
      ...torontoLot,
      transitAreaStatus: "pmtsa",
      majorStreet: true,
    });

    expect(inPmtsa.envelope.estimated_storeys).toBe(base.envelope.estimated_storeys);
    expect(inPmtsa.envelope.estimated_practical_gfa_sqft).toBe(base.envelope.estimated_practical_gfa_sqft);
  });

  it("keeps the Toronto-specific height direction out of other municipalities", () => {
    const r = computeMultiplexFeasibility({
      address: "123 Main St",
      city: "Hamilton",
      province: "ON",
      transitAreaStatus: "pmtsa",
    });

    // The parking prohibition is provincial, so it still applies...
    expect(r.transit.parking_minimums_prohibited).toBe(true);
    // ...but the 4/6-storey figure came from Toronto's delineation approval.
    expect(r.transit.policy_height_storeys).toBeNull();
    expect(r.permissions.scenarios.some((s) => s.name.includes("Transit-Oriented"))).toBe(false);
  });
});

describe("traceability", () => {
  it("adds a transit layer to the rules hierarchy at every certainty level", () => {
    const cases: Array<[FeasibilityInput, "direct" | "heuristic" | "missing"]> = [
      [torontoLot, "missing"],
      [{ ...torontoLot, transitStationDistanceM: 300 }, "heuristic"],
      [{ ...torontoLot, transitAreaStatus: "pmtsa" }, "direct"],
    ];

    for (const [input, expected] of cases) {
      const layer = computeMultiplexFeasibility(input).rules_hierarchy.find(
        (l) => l.layer === "transit_overlay",
      );
      expect(layer).toBeDefined();
      expect(layer!.status).toBe(expected);
    }
  });

  it("scores confirmed status above a bare distance", () => {
    const unknown = computeMultiplexFeasibility(torontoLot).confidence_breakdown.transit_area.score;
    const distance = computeMultiplexFeasibility({ ...torontoLot, transitStationDistanceM: 300 })
      .confidence_breakdown.transit_area.score;
    const confirmed = computeMultiplexFeasibility({ ...torontoLot, transitAreaStatus: "mtsa" })
      .confidence_breakdown.transit_area.score;

    expect(unknown).toBe(0);
    expect(distance).toBeGreaterThan(unknown);
    expect(confirmed).toBeGreaterThan(distance);
  });
});
