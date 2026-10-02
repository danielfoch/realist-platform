import { describe, expect, it } from "vitest";
import { richAddressLayers, richCoverage } from "./rich";

describe("Ontario public building and registration snapshots", () => {
  it("matches a normalized Toronto civic address and retains building-level provenance", () => {
    const result = richAddressLayers("260 Sherbourne Street", "Toronto", "ON");
    expect(result.rentalBuilding.status).toBe("available");
    expect(result.rentalBuilding.data).toMatchObject({ scope: "building", reportingBasis: "owner_manager_registration", yearBuilt: 1809, storeys: 4, dwellingUnits: 10, elevators: 0, heatingType: "HOT WATER" });
    expect(result.rentalBuilding.source?.licence).toBe("Open Government Licence – Toronto");
    expect(result.rentalBuilding.sourceUpdatedAt).not.toBe(result.rentalBuilding.retrievedAt);
    expect(result.rentalBuilding.note).toContain("not unit-specific");
  });
  it("keeps dated evaluation history and missing category scores without inventing a condition guarantee", () => {
    const result = richAddressLayers("376 Brunswick Ave", "Toronto", "Ontario").buildingEvaluations;
    expect(result.status).toBe("available");
    const data = result.data as { latestEvaluation: { evaluatedOn: string; currentBuildingEvaluationScore: number }; history: unknown[] };
    expect(data.latestEvaluation).toMatchObject({ evaluatedOn: "2026-07-15", currentBuildingEvaluationScore: 71 });
    expect(data.history.length).toBeGreaterThan(1);
    expect(result.note).toContain("not a unit inspection");
  });
  it("does not turn a garden-suite registration into a fourth unit or fill absent second-unit dates", () => {
    const result = richAddressLayers("12 Abell Drive", "Brampton", "ON").additionalUnits;
    expect(result.status).toBe("available");
    expect(result.data).toMatchObject({ records: [{ secondUnitRegisteredDate: null, thirdUnitRegisteredDate: null, gardenSuiteRegisteredDate: "April 27, 2026" }] });
    expect(JSON.stringify(result.data)).not.toContain("fourth");
    expect(result.sourceUpdatedAt).toBeNull();
    expect(result.note).toContain("does not establish present compliance");
  });
  it("preserves listed versus designated heritage status", () => {
    expect(richAddressLayers("2 Wellington Street W", "Brampton", "ON").heritage.data).toMatchObject({ records: [{ publishedStatus: "LISTED" }] });
    expect(richAddressLayers("69 Elliott Street", "Brampton", "ON").heritage.data).toMatchObject({ records: [{ publishedStatus: "DESIGNATED" }] });
  });
  it("refuses another municipality, province or street rather than attaching a near match", () => {
    expect(richAddressLayers("12 Abell Drive", "Brampton", "BC").additionalUnits.status).toBe("not_supported");
    expect(richAddressLayers("260 Sherbourne Street", "Ottawa", "ON").rentalBuilding.status).toBe("not_supported");
    expect(richAddressLayers("260 Sherbourne Road", "Toronto", "ON").rentalBuilding.status).toBe("no_match");
    expect(richAddressLayers(null, "Brampton", "ON").additionalUnits.status).toBe("skipped");
  });
  it("reports exact dataset record counts and separate source and snapshot dates", () => {
    const coverage = richCoverage();
    expect(coverage).toHaveLength(4);
    expect(coverage.reduce((total, item) => total + item.records, 0)).toBe(41567);
    expect(coverage.every(item => item.retrievedAt && item.source.attribution)).toBe(true);
  });
});
