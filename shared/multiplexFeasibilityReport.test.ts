import { describe, expect, it } from "vitest";
import {
  buildMultiplexDevelopmentReport,
  type DevelopmentReportInput,
} from "./multiplexFeasibilityReport";

const baseInput: DevelopmentReportInput = {
  municipality: "City of Toronto",
  frontageFt: 25,
  depthFt: 120,
  lotAreaSqft: 3000,
  coverageRatio: 0.35,
  practicalGfaSqft: 2457,
  asOfRightStoreys: 3,
  policyStoreys: null,
  effectiveBaselineUnits: 4,
  sixUnitStatus: "possible_unverified",
  laneAccess: false,
  gardenSuitePossible: true,
  lanewaySuitePossible: true,
  majorStreet: false,
  transitStatus: "unknown",
  approvalPath: "as_of_right",
};

describe("multiplex development concept", () => {
  it("builds a narrow-lot concept without inventing a rear suite", () => {
    const report = buildMultiplexDevelopmentReport(baseInput);

    expect(report).not.toBeNull();
    expect(report!.concept.widthBand).toBe("25_ft");
    expect(report!.concept.principalUnits).toBe(4);
    expect(report!.concept.includesRearSuite).toBe(false);
    expect(report!.concept.sitePlan.buildings).toHaveLength(1);
    expect(report!.concept.sitePlan.lotFrontageFt).toBe(25);
    expect(report!.concept.sitePlan.lotDepthFt).toBe(120);
  });

  it("adds a lane suite on a deep, wide site and carries it into the pro forma", () => {
    const report = buildMultiplexDevelopmentReport({
      ...baseInput,
      frontageFt: 40,
      depthFt: 130,
      lotAreaSqft: 5200,
      practicalGfaSqft: 4250,
      sixUnitStatus: "more_likely_area",
      laneAccess: true,
    })!;

    expect(report.concept.widthBand).toBe("40_ft");
    expect(report.concept.rearSuiteType).toBe("laneway");
    expect(report.concept.totalUnits).toBe(report.concept.principalUnits + 1);
    expect(report.concept.sitePlan.buildings.find((b) => b.id === "rear_suite")).toBeDefined();
    expect(report.proForma.configuration.units).toBe(report.concept.totalUnits);
    expect(report.proForma.cmhcTakeout.eligible).toBe(true);
  });

  it("keeps MTSA policy height separate from the as-of-right concept", () => {
    const report = buildMultiplexDevelopmentReport({
      ...baseInput,
      transitStatus: "pmtsa",
      majorStreet: true,
      policyStoreys: 6,
    })!;

    expect(report.concept.asOfRightStoreys).toBe(3);
    expect(report.concept.policyUpsideStoreys).toBe(6);
    expect(report.concept.policyUpsideNote).toContain("not guaranteed");
    expect(report.proForma.assumptions.constructionMonths).toBeGreaterThan(0);
  });

  it("compares 25/30/40/50-foot frontages at the submitted depth", () => {
    const report = buildMultiplexDevelopmentReport(baseInput)!;

    expect(report.outcomeMatrix.map((row) => row.frontageFt)).toEqual([25, 30, 40, 50]);
    for (const row of report.outcomeMatrix) {
      expect(row.laneUnits).toBeGreaterThanOrEqual(row.noLaneUnits);
      expect(row.depthRead).toContain("120");
    }
    expect(report.outcomeMatrix.filter((row) => row.isCurrentBand)).toHaveLength(1);
  });
});

describe("sample multiplex pro forma", () => {
  it("labels land as excluded when no acquisition price is supplied", () => {
    const report = buildMultiplexDevelopmentReport(baseInput)!;

    expect(report.proForma.landPriceProvided).toBe(false);
    expect(report.proForma.costs.purchasePrice).toBeNull();
    expect(report.proForma.costs.totalDevelopmentCost).toBe(report.proForma.costs.totalBeforeLand);
    expect(report.proForma.notes.some((note) => note.includes("exclude land"))).toBe(true);
  });

  it("includes acquisition price and transfer tax when supplied", () => {
    const withoutLand = buildMultiplexDevelopmentReport(baseInput)!;
    const withLand = buildMultiplexDevelopmentReport({
      ...baseInput,
      purchasePrice: 1_250_000,
    })!;

    expect(withLand.proForma.landPriceProvided).toBe(true);
    expect(withLand.proForma.costs.purchasePrice).toBe(1_250_000);
    expect(withLand.proForma.costs.landTransferTax).toBeGreaterThan(0);
    expect(withLand.proForma.costs.totalDevelopmentCost).toBeGreaterThan(
      withoutLand.proForma.costs.totalDevelopmentCost,
    );
  });
});

describe("project timeline", () => {
  it("covers acquisition through CMHC takeout with construction phasing", () => {
    const timeline = buildMultiplexDevelopmentReport(baseInput)!.timeline;
    const ids = timeline.phases.map((phase) => phase.id);

    expect(ids).toEqual(expect.arrayContaining([
      "site_control",
      "due_diligence",
      "construction_loan",
      "foundation",
      "structure",
      "rough_ins",
      "interiors",
      "lease_up",
      "stabilization",
      "cmhc_takeout",
    ]));

    const occupancy = timeline.milestones.find((item) => item.id === "occupancy")!;
    const stabilized = timeline.milestones.find((item) => item.id === "stabilized")!;
    const takeout = timeline.milestones.find((item) => item.id === "takeout_funded")!;
    expect(stabilized.month).toBeGreaterThan(occupancy.month);
    expect(takeout.month).toBeGreaterThan(stabilized.month);
    expect(timeline.totalMonths).toBe(Math.ceil(takeout.month));
  });

  it("extends the front end for a rezoning path", () => {
    const asOfRight = buildMultiplexDevelopmentReport(baseInput)!.timeline.totalMonths;
    const rezoning = buildMultiplexDevelopmentReport({
      ...baseInput,
      approvalPath: "rezoning_required",
    })!.timeline.totalMonths;

    expect(rezoning).toBeGreaterThan(asOfRight);
  });
});

