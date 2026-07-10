import { describe, expect, it } from "vitest";
import { computeMliAffordability, affordableRentCapForMarket, AFFORDABILITY_UNIT_SHARE, AFFORDABILITY_COMMITMENT_YEARS } from "./mliAffordability";

describe("affordableRentCapForMarket", () => {
  it("derives Toronto's cap from the verified median renter income", () => {
    // 30% of $53,900 / 12 = $1,347.50
    expect(affordableRentCapForMarket("Toronto")).toBe(1347.5);
    expect(affordableRentCapForMarket("Vancouver")).toBe(1672.5);
    expect(affordableRentCapForMarket("Nowhere")).toBeNull();
  });
});

// 6 units: 2×1br @ $1,800, 3×2br @ $2,400, 1×3br @ $2,900 (the sixplex fixture rents).
const mix = [
  { marketRent: 1800, count: 2 },
  { marketRent: 2400, count: 3 },
  { marketRent: 2900, count: 1 },
];

describe("computeMliAffordability", () => {
  it("requires 10% of units at level 1 (rounded up)", () => {
    const r = computeMliAffordability({ unitMix: mix, affordableRentCap: 1500, affordabilityLevel: 1 });
    expect(r.unitsRequired).toBe(1); // ceil(6 × 0.10) = 1
    expect(r.commitmentYears).toBe(AFFORDABILITY_COMMITMENT_YEARS);
  });

  it("requires 15% at level 2 and 25% at level 3", () => {
    expect(computeMliAffordability({ unitMix: mix, affordableRentCap: 1500, affordabilityLevel: 2 }).unitsRequired).toBe(1); // ceil(0.9)
    expect(computeMliAffordability({ unitMix: mix, affordableRentCap: 1500, affordabilityLevel: 3 }).unitsRequired).toBe(2); // ceil(1.5)
  });

  it("designates the cheapest units affordable (minimises rent forgone)", () => {
    // cap $1,500; level 1 → 1 unit. Cheapest market rent is $1,800 → give up $300/mo = $3,600/yr.
    const r = computeMliAffordability({ unitMix: mix, affordableRentCap: 1500, affordabilityLevel: 1 });
    expect(r.annualRentForgone).toBe(3600);
    expect(r.marketAnnualRent).toBe((1800 * 2 + 2400 * 3 + 2900) * 12);
    expect(r.affordabilityAdjustedAnnualRent).toBe(r.marketAnnualRent - 3600);
    expect(r.alreadyAffordable).toBe(false);
  });

  it("level 3 gives up the two cheapest units' discount", () => {
    // 2 units at cap $1,500: both cheapest are the $1,800 1-brs → 2 × $300 × 12 = $7,200.
    const r = computeMliAffordability({ unitMix: mix, affordableRentCap: 1500, affordabilityLevel: 3 });
    expect(r.annualRentForgone).toBe(7200);
  });

  it("costs nothing when market rents already meet the cap", () => {
    const r = computeMliAffordability({ unitMix: mix, affordableRentCap: 3000, affordabilityLevel: 3 });
    expect(r.annualRentForgone).toBe(0);
    expect(r.alreadyAffordable).toBe(true);
    expect(r.affordabilityAdjustedAnnualRent).toBe(r.marketAnnualRent);
  });

  it("supports per-type caps aligned to the mix", () => {
    // caps [1600 for 1br, 2000 for 2br, 2400 for 3br]; level 1 → cheapest give-up
    // is the 1br ($1,800−$1,600=$200) → $2,400/yr.
    const r = computeMliAffordability({ unitMix: mix, affordableRentCap: [1600, 2000, 2400], affordabilityLevel: 1 });
    expect(r.annualRentForgone).toBe(2400);
  });

  it("exposes the standard unit-share ladder", () => {
    expect(AFFORDABILITY_UNIT_SHARE[1]).toBe(0.10);
    expect(AFFORDABILITY_UNIT_SHARE[2]).toBe(0.15);
    expect(AFFORDABILITY_UNIT_SHARE[3]).toBe(0.25);
  });
});
