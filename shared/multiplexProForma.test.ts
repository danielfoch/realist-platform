import { describe, expect, it } from "vitest";
import { computeEnvelope } from "./multiplexEnvelope";
import { generateConfigurations, type BuildConfiguration } from "./multiplexConfigs";
import {
  DEV_ASSUMPTION_DEFAULTS,
  computeCondoExit,
  computeCostStack,
  computeRentalHold,
  computeResidualLandValue,
  torontoLandTransferTax,
  type DevAssumptions,
} from "./multiplexProForma";

const a = DEV_ASSUMPTION_DEFAULTS as unknown as DevAssumptions;

/** Canonical fixture: 40x120 sixplex-ward lot -> 6-unit config (4300 net sqft). */
function sixplexFixture(): BuildConfiguration {
  const envelope = computeEnvelope({ lotFrontageFt: 40, lotDepthFt: 120, sixplexEligible: true });
  const configs = generateConfigurations({
    envelope,
    maxUnitsAsOfRight: 6,
    sixplexCertainty: "verified",
    lanewayEligible: false,
    gardenSuiteEligible: false,
  });
  return configs.find((c) => c.key === "sixplex")!;
}

describe("torontoLandTransferTax", () => {
  it("doubles the provincial brackets (ON LTT + Toronto MLTT)", () => {
    // ON LTT on $1.2M: 275 + 1,950 + 2,250 + 16,000 = 20,475; x2 = 40,950
    expect(torontoLandTransferTax(1200000)).toBe(40950);
    // $400k: 275 + 1,950 + 2,250 = 4,475; x2 = 8,950
    expect(torontoLandTransferTax(400000)).toBe(8950);
    expect(torontoLandTransferTax(0)).toBe(0);
  });
});

describe("computeCostStack", () => {
  it("golden numbers for the sixplex fixture at $1.2M land", () => {
    const config = sixplexFixture();
    // Hand math (defaults): net 4300 sqft -> gross 4300/0.85 = 5059
    // hard = 5059 x $400 = 2,023,600
    // soft = 15% = 303,540 ; contingency = 10% x (hard+soft) = 232,714
    // DCs: MM32.5 exempts units 2-6 -> 1 unit x $80,690 (apt 2+bed) ; LTT(1.2M) = 40,950
    // carry = (hard+soft+cont+dc)=2,640,544 x 0.75 x 0.5 x 6.5% x 14/12 = 75,090
    // total = 3,956,584
    const costs = computeCostStack(config, 1200000, a);
    expect(config.netSqft).toBe(4300);
    expect(config.grossGfaSqft).toBe(5059);
    expect(costs.hardCosts).toBe(2023600);
    expect(costs.softCosts).toBe(303540);
    expect(costs.contingency).toBe(232714);
    // Corrected: a sixplex pays DC on ONE unit (units 2-6 exempt under MM32.5),
    // not (6-3) single-detached charges. Was $423,417 -> now $80,690.
    expect(costs.developmentCharges).toBe(80690);
    expect(costs.dcUnitsCharged).toBe(1);
    expect(costs.dcExemptUnits).toBe(5);
    expect(costs.dcExemptionBasis).toBe("toronto_multiplex_mm32_5");
    expect(costs.landTransferTax).toBe(40950);
    expect(costs.financingCarry).toBe(75090);
    expect(costs.totalDevCost).toBe(3956584);
    expect(costs.costPerUnit).toBe(Math.round(3956584 / 6));
  });
});

describe("condo exit vs rental hold", () => {
  const config = sixplexFixture();
  const costs = computeCostStack(config, 1200000, a);

  it("condo sellout golden numbers", () => {
    // 4300 net x $1,050 = 4,515,000 gross; -5% selling = 4,289,250 net
    const exit = computeCondoExit(config, costs, a);
    expect(exit.grossSellout).toBe(4515000);
    expect(exit.netSellout).toBe(4289250);
    expect(exit.profit).toBe(4289250 - 3956584); // lower DCs -> more profit
    expect(exit.marginOnCost).toBeCloseTo(exit.profit / 3956584, 3);
  });

  it("rental hold golden numbers", () => {
    // Rent roll: 2x1BR 1800 + 3x2BR 2400 + 1x3BR 2900 = 13,700/mo -> GPR 164,400
    // EGI x0.97 = 159,468 ; opex 28% -> NOI = 114,817
    const hold = computeRentalHold(config, costs, a);
    expect(hold.grossPotentialRent).toBe(164400);
    expect(hold.effectiveGrossIncome).toBe(159468);
    expect(hold.noi).toBe(114817);
    // Value at 4.75% cap
    expect(hold.stabilizedValue).toBe(2417199);
    expect(hold.yieldOnCost).toBeCloseTo(114817 / 3956584, 4); // yield rises on lower cost
  });
});

describe("computeResidualLandValue", () => {
  const config = sixplexFixture();

  it("condo path lands in the hand-checked band and rental path floors at zero", () => {
    // With the corrected (much lower) DCs, the condo path supports more land.
    // Condo: netSellout 4,289,250 / 1.15 - nonLand(now ~2.73M + LTT) -> ~982k
    // Rental: NOI/5.25% = ~2.19M < non-land costs -> 0 (does not pencil)
    const rlv = computeResidualLandValue(config, a);
    expect(rlv.condoPath).toBeGreaterThan(950000);
    expect(rlv.condoPath).toBeLessThan(1010000);
    expect(rlv.rentalPath).toBe(0);
  });

  it("higher condo PSF raises what you can pay for land", () => {
    const base = computeResidualLandValue(config, a);
    const hot = computeResidualLandValue(config, { ...a, condoPsf: 1250 });
    expect(hot.condoPath).toBeGreaterThan(base.condoPath);
  });

  it("lower target yield-on-cost raises the rental land bid", () => {
    const generous = computeResidualLandValue(config, { ...a, targetYieldOnCost: 0.035, opexPctOfEgi: 0.2 });
    const strict = computeResidualLandValue(config, { ...a, targetYieldOnCost: 0.055, opexPctOfEgi: 0.2 });
    expect(generous.rentalPath).toBeGreaterThanOrEqual(strict.rentalPath);
  });
});
