import { describe, expect, it } from "vitest";
import { assessRentRegulation, guidelineGrowthCapPct } from "./rentRegulation";

describe("Ontario rent regulation", () => {
  it("exempts a new multiplex suite from the guideline (post-Nov-15-2018)", () => {
    const r = assessRentRegulation({ province: "ON", isNewSuite: true });
    expect(r.supported).toBe(true);
    expect(r.exemptFromGuideline).toBe(true);
    expect(r.newSuiteUncapped).toBe(true);
    expect(r.guidelinePct).toBeNull(); // uncapped
    expect(r.summary).toMatch(/exempt/i);
  });

  it("caps a sitting tenant in an older unit at the 2026 guideline of 2.1%", () => {
    const r = assessRentRegulation({ province: "ON", year: 2026, firstOccupiedYear: 2005 });
    expect(r.exemptFromGuideline).toBe(false);
    expect(r.guidelinePct).toBe(2.1);
    expect(r.guidelineYear).toBe(2026);
    expect(r.vacancyDecontrol).toBe(true);
  });

  it("uses 1.9% for 2027 and 2.5% for 2024", () => {
    expect(assessRentRegulation({ province: "ON", year: 2027, firstOccupiedYear: 2000 }).guidelinePct).toBe(1.9);
    expect(assessRentRegulation({ province: "ON", year: 2024, firstOccupiedYear: 2000 }).guidelinePct).toBe(2.5);
  });

  it("treats a unit first occupied after 2018 as exempt via firstOccupiedYear", () => {
    expect(assessRentRegulation({ province: "ON", firstOccupiedYear: 2022 }).exemptFromGuideline).toBe(true);
    expect(assessRentRegulation({ province: "ON", firstOccupiedYear: 2015 }).exemptFromGuideline).toBe(false);
  });
});

describe("other provinces", () => {
  it("BC caps at 2.3% for 2026 with no new-build exemption", () => {
    const r = assessRentRegulation({ province: "BC", year: 2026, isNewSuite: true });
    expect(r.guidelinePct).toBe(2.3);
    expect(r.exemptFromGuideline).toBe(false); // BC has no new-build exemption
    expect(r.newSuiteUncapped).toBe(false);
    expect(r.vacancyDecontrol).toBe(true);
  });

  it("Alberta is uncapped (null guideline), not exempt", () => {
    const r = assessRentRegulation({ province: "AB" });
    expect(r.supported).toBe(true);
    expect(r.guidelinePct).toBeNull();
    expect(r.exemptFromGuideline).toBe(false);
    expect(r.summary).toMatch(/no rent-increase cap/i);
  });

  it("degrades gracefully for an unmodelled province", () => {
    const r = assessRentRegulation({ province: "ZZ" });
    expect(r.supported).toBe(false);
    expect(r.guidelinePct).toBeNull();
    expect(r.source).toBeNull();
  });

  it("accepts full names and codes", () => {
    expect(assessRentRegulation({ province: "Ontario", isNewSuite: true }).province).toBe("ON");
    expect(assessRentRegulation({ province: "british columbia", year: 2026 }).province).toBe("BC");
  });
});

describe("guidelineGrowthCapPct", () => {
  it("returns null for an exempt new suite (caller uses market growth)", () => {
    expect(guidelineGrowthCapPct({ province: "ON", isNewSuite: true })).toBeNull();
  });
  it("returns the guideline for a capped sitting tenancy", () => {
    expect(guidelineGrowthCapPct({ province: "ON", year: 2026, firstOccupiedYear: 2000 })).toBe(2.1);
  });
  it("returns null for uncapped Alberta", () => {
    expect(guidelineGrowthCapPct({ province: "AB" })).toBeNull();
  });
});
