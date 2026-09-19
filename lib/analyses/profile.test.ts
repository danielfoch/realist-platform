import { describe, expect, it } from "vitest";
import { badgeProgress, safeCity, streetLine, toPublicAnalysis } from "./profile";

const base = {
  source: "listing",
  mlsNumber: "X5000123",
  address: "12 Main St, Hamilton, ON",
  city: "Hamilton",
  province: "ON",
  capRate: 5.4567,
  verdict: "pursue",
  at: 1_789_000_000_000,
};

describe("safeCity", () => {
  it("keeps a city name, tidied", () => {
    expect(safeCity("  St.  Catharines ")).toBe("St. Catharines");
    expect(safeCity("Montréal")).toBe("Montréal");
  });

  it("drops anything that looks like an address typed into the city box", () => {
    expect(safeCity("45 Secret Ave")).toBeNull();
    expect(safeCity("Hamilton L8P 1A1")).toBeNull();
  });

  it("drops blanks and essays", () => {
    expect(safeCity(null)).toBeNull();
    expect(safeCity("   ")).toBeNull();
    expect(safeCity("x".repeat(61))).toBeNull();
  });
});

describe("streetLine", () => {
  it("is the part of a full address before the city", () => {
    expect(streetLine("12 Main St, Hamilton, ON")).toBe("12 Main St");
    expect(streetLine("2 - 12 Main St")).toBe("2 - 12 Main St");
  });

  it("is null when there is nothing to show", () => {
    expect(streetLine(null)).toBeNull();
    expect(streetLine(" , Hamilton")).toBeNull();
  });
});

describe("toPublicAnalysis", () => {
  it("shows a listing as its market — never its address, its MLS number, or a link to it", () => {
    const shaped = toPublicAnalysis(base);
    expect(shaped).toEqual({
      label: "Listing · Hamilton",
      href: null,
      offMarket: false,
      city: "Hamilton",
      province: "ON",
      capRate: 5.5,
      verdict: "pursue",
      at: base.at,
    });
    // An address beside a "Pursue" call would tell every other investor what this person is chasing.
    expect(JSON.stringify(shaped)).not.toContain("Main St");
    expect(JSON.stringify(shaped)).not.toContain("X5000123");
  });

  it("never shows an off-market address, even when one is handed to it", () => {
    const shaped = toPublicAnalysis({ ...base, source: "manual", mlsNumber: null, address: "45 Secret Ave, Hamilton, ON" });
    expect(shaped.label).toBe("Off-market · Hamilton");
    expect(shaped.href).toBeNull();
    expect(shaped.offMarket).toBe(true);
    expect(JSON.stringify(shaped)).not.toContain("Secret");
  });

  it("treats an off-market deal as off-market even if it carries an MLS number", () => {
    const shaped = toPublicAnalysis({ ...base, source: "manual" });
    expect(shaped.href).toBeNull();
    expect(JSON.stringify(shaped)).not.toContain("Main St");
  });

  it("does not echo an address typed into an off-market deal's city box", () => {
    const shaped = toPublicAnalysis({ ...base, source: "manual", city: "45 Secret Ave" });
    expect(shaped.label).toBe("Off-market");
    expect(shaped.city).toBeNull();
  });

  it("labels a multiplex site and a deal with no city", () => {
    expect(toPublicAnalysis({ ...base, source: "multiplex", city: "Toronto" }).label).toBe("Multiplex site · Toronto");
    expect(toPublicAnalysis({ ...base, city: null }).label).toBe("Listing");
  });

  it("ignores a call it doesn't know", () => {
    const shaped = toPublicAnalysis({ ...base, verdict: "maybe", capRate: null });
    expect(shaped.verdict).toBeNull();
    expect(shaped.capRate).toBeNull();
  });
});

describe("badgeProgress", () => {
  it("counts toward the first badge before any deal", () => {
    expect(badgeProgress(0)).toEqual({ name: "", next: { name: "First underwrite", at: 1 }, percent: 0, remaining: 1 });
  });

  it("measures progress toward the next rung", () => {
    expect(badgeProgress(62)).toEqual({ name: "Power user", next: { name: "Deal hunter", at: 100 }, percent: 62, remaining: 38 });
    expect(badgeProgress(9)).toMatchObject({ name: "First underwrite", next: { name: "Analyst", at: 10 }, percent: 90, remaining: 1 });
  });

  it("never reads as complete while deals remain", () => {
    expect(badgeProgress(499)).toMatchObject({ percent: 99, remaining: 1 });
  });

  it("is full at the top of the ladder", () => {
    expect(badgeProgress(812)).toEqual({ name: "Legend", next: null, percent: 100, remaining: 0 });
  });
});
