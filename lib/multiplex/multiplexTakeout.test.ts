import { describe, expect, it } from "vitest";
import type { BuildConfiguration } from "./multiplexConfigs";
import { computeEnvelope } from "./multiplexEnvelope";
import { generateConfigurations } from "./multiplexConfigs";
import {
  DEV_ASSUMPTION_DEFAULTS,
  computeCostStack,
  computeRentalHold,
  type CostStack,
  type DevAssumptions,
} from "./multiplexProForma";
import { paymentFactorMonthly } from "./mliSelect";
import {
  TAKEOUT_ASSUMPTION_DEFAULTS,
  compareTakeouts,
  computeCondoTermination,
  computeMliHold,
  determineCondoForm,
  pickRecommendedTakeout,
  type CondoTerminationResult,
  type MliHoldResult,
  type TakeoutAssumptions,
  type TakeoutCandidate,
} from "./multiplexTakeout";

const dev = DEV_ASSUMPTION_DEFAULTS as unknown as DevAssumptions;
const ta = TAKEOUT_ASSUMPTION_DEFAULTS as unknown as TakeoutAssumptions;

/** Hand-built 4-unit town-form fixture: 1x1BR + 2x2BR + 1x3BR = 3,000 net sqft. */
function fourplex(): BuildConfiguration {
  return {
    key: "fourplex",
    label: "4-unit multiplex",
    units: 4,
    unitMix: [
      { type: "1br", count: 1, netSqftEach: 550 },
      { type: "2br", count: 2, netSqftEach: 750 },
      { type: "3br", count: 1, netSqftEach: 950 },
    ],
    grossGfaSqft: 3529,
    netSqft: 3000,
    includesSuite: false,
    suiteGfaSqft: 0,
    parkingRequired: 0,
    parkingProvided: 0,
    approvalPath: "as_of_right",
    approvalCertainty: "verified",
    envelopeSlackPct: 0.2,
    constraints: [],
    flags: [],
  };
}

/** Hand-built 6-unit apartment-form fixture: 2x1BR + 3x2BR + 1x3BR = 4,300 net sqft. */
function sixplex(): BuildConfiguration {
  return {
    ...fourplex(),
    key: "sixplex",
    label: "6-unit multiplex",
    units: 6,
    unitMix: [
      { type: "1br", count: 2, netSqftEach: 550 },
      { type: "2br", count: 3, netSqftEach: 750 },
      { type: "3br", count: 1, netSqftEach: 950 },
    ],
    grossGfaSqft: 5059,
    netSqft: 4300,
  };
}

/** Synthetic cost stack — only totalDevCost matters to the takeout engine. */
function costsOf(totalDevCost: number): CostStack {
  return {
    land: 0,
    landTransferTax: 0,
    hardCosts: 0,
    softCosts: 0,
    contingency: 0,
    developmentCharges: 0,
    dcUnitsCharged: 0,
    financingCarry: 0,
    totalDevCost,
    costPerUnit: 0,
    costPerNetSqft: 0,
  };
}

// ─── Form determination ──────────────────────────────────────────────────────

describe("determineCondoForm", () => {
  it("4 ground-related units of decent size read as condo towns", () => {
    const { form } = determineCondoForm({ units: 4, netSqft: 3000 }, ta);
    expect(form).toBe("condo_town");
  });

  it("unit count above the ceiling forces apartment form", () => {
    const { form, reason } = determineCondoForm({ units: 6, netSqft: 4300 }, ta);
    expect(form).toBe("condo_apartment");
    expect(reason).toContain("6 units");
  });

  it("small average units force apartment form even at low counts", () => {
    const { form } = determineCondoForm({ units: 4, netSqft: 2000 }, ta); // 500 sqft avg
    expect(form).toBe("condo_apartment");
  });

  it("the ceiling is tunable", () => {
    const { form } = determineCondoForm({ units: 6, netSqft: 4300 }, { ...ta, maxCondoTownUnits: 6 });
    expect(form).toBe("condo_town");
  });
});

// ─── Condo termination ───────────────────────────────────────────────────────

describe("computeCondoTermination", () => {
  it("town-form golden numbers (fourplex, $3.0M all-in)", () => {
    // gross = 3000 x $1,000 = 3,000,000 ; selling 5% = 150,000
    // registration = 60,000 + 4x5,000 = 80,000
    // carry base = 3,000,000 x 0.75 = 2,250,000 @ 6.5%
    // registration carry = 2,250,000 x 6.5% x 12/12 = 146,250
    // absorption carry = 2,250,000 x 6.5% x 4/12 x 0.5 = 24,375
    // net = 2,599,375 ; profit = -400,625
    const r = computeCondoTermination(fourplex(), costsOf(3_000_000), dev, ta);
    expect(r.form).toBe("condo_town");
    expect(r.pricePsf).toBe(1000);
    expect(r.grossSellout).toBe(3_000_000);
    expect(r.sellingCosts).toBe(150_000);
    expect(r.registrationCost).toBe(80_000);
    expect(r.registrationCarry).toBe(146_250);
    expect(r.absorptionCarry).toBe(24_375);
    expect(r.netProceeds).toBe(2_599_375);
    expect(r.profit).toBe(-400_625);
    expect(r.marginOnCost).toBe(-0.134);
    expect(r.monthsToExit).toBe(16);
    expect(r.flags).toHaveLength(0);
  });

  it("apartment-form golden numbers (sixplex, $3.0M all-in) — discount, slower absorption, illiquidity flag", () => {
    // psf = 900 x (1 - 0.05) = 855 ; gross = 4300 x 855 = 3,676,500
    // selling 5% = 183,825 ; registration = 60,000 + 6x5,000 = 90,000
    // registration carry = 146,250 ; absorption carry = 2,250,000 x 6.5% x 9/12 x 0.5 = 54,844
    const r = computeCondoTermination(sixplex(), costsOf(3_000_000), dev, ta);
    expect(r.form).toBe("condo_apartment");
    expect(r.pricePsf).toBe(855);
    expect(r.grossSellout).toBe(3_676_500);
    expect(r.sellingCosts).toBe(183_825);
    expect(r.registrationCost).toBe(90_000);
    expect(r.registrationCarry).toBe(146_250);
    expect(r.absorptionCarry).toBe(54_844);
    expect(r.netProceeds).toBe(3_201_581);
    expect(r.profit).toBe(201_581);
    expect(r.monthsToExit).toBe(21);
    expect(r.flags.map((f) => f.key)).toContain("condo_apt_illiquidity");
  });

  it("per-unit exit values scale with unit size", () => {
    const r = computeCondoTermination(fourplex(), costsOf(3_000_000), dev, ta);
    expect(r.perUnitValues).toEqual([
      { type: "1br", count: 1, netSqftEach: 550, priceEach: 550_000 },
      { type: "2br", count: 2, netSqftEach: 750, priceEach: 750_000 },
      { type: "3br", count: 1, netSqftEach: 950, priceEach: 950_000 },
    ]);
    expect(r.avgPricePerUnit).toBe(750_000);
  });

  it("registration timeline and costs are tunable", () => {
    const fast = computeCondoTermination(fourplex(), costsOf(3_000_000), dev, {
      ...ta,
      condoRegistrationMonths: 6,
      condoRegistrationFixedCost: 30_000,
    });
    expect(fast.registrationCarry).toBe(73_125);
    expect(fast.registrationCost).toBe(50_000);
    expect(fast.profit).toBeGreaterThan(-400_625);
  });
});

// ─── MLI Select hold ─────────────────────────────────────────────────────────

describe("computeMliHold", () => {
  const input = {
    config: { units: 6 },
    costs: { totalDevCost: 3_600_000 },
    rentalHold: { noi: 200_000, stabilizedValue: 4_000_000 },
    points: 100,
    interestRate: 0.045,
  };

  it("golden numbers at 100 points (canonical 5.18% premium case)", () => {
    const r = computeMliHold(input, ta);
    expect(r.eligible).toBe(true);
    // Lending value = min(value, cost) = 3.6M ; 95% LTV binds below the DSCR loan
    expect(r.mli.maxLoan).toBe(3_420_000);
    expect(r.mli.bindingConstraint).toBe("ltv");
    // >90% LTV other-purpose base 6.15% + 1.25% (50-yr amort) = 7.4% x 0.70 = 5.18%
    expect(r.mli.premiumPct).toBe(5.18);
    expect(r.loanBalance).toBe(3_420_000 + r.mli.premiumDollars);
    expect(r.equityLeftIn).toBe(180_000);
    // Debt service on the premium-capitalized balance at the tier's 50-yr amort
    const expectedDs = Math.round(r.loanBalance * paymentFactorMonthly(0.045, 50) * 12);
    expect(r.annualDebtService).toBe(expectedDs);
    expect(r.annualCashFlow).toBe(200_000 - expectedDs);
    expect(r.valueCreation).toBe(400_000);
    expect(r.horizonYears).toBe(5);
    expect(r.horizonProfit).toBe(400_000 + r.annualCashFlow * 5);
    expect(r.cashOnCash).toBeCloseTo(r.annualCashFlow / 180_000, 4);
  });

  it("premium capitalization is tunable and flags a DSCR breach", () => {
    const capped = computeMliHold(input, ta);
    const uncapped = computeMliHold(input, { ...ta, capitalizeMliPremium: false });
    expect(uncapped.loanBalance).toBe(3_420_000);
    expect(uncapped.annualDebtService).toBeLessThan(capped.annualDebtService);
    // Sized exactly to DSCR 1.10, capitalizing the premium must breach the covenant
    const dscrCase = computeMliHold(
      { ...input, rentalHold: { noi: 172_000, stabilizedValue: 4_000_000 } },
      ta,
    );
    expect(dscrCase.mli.bindingConstraint).toBe("dscr");
    expect(dscrCase.flags.map((f) => f.key)).toContain("dscr_after_premium");
  });

  it("fourplex is ineligible and falls back to unlevered hold math", () => {
    const r = computeMliHold({ ...input, config: { units: 4 } }, ta);
    expect(r.eligible).toBe(false);
    expect(r.reason).toContain("5+ units");
    expect(r.equityLeftIn).toBe(3_600_000);
    expect(r.annualCashFlow).toBe(200_000);
    expect(r.horizonProfit).toBe(400_000 + 200_000 * 5);
  });
});

// ─── Comparator ──────────────────────────────────────────────────────────────

function condoResult(profit: number, form: "condo_town" | "condo_apartment" = "condo_town"): CondoTerminationResult {
  return {
    form,
    formReason: `${form} fixture`,
    pricePsf: 1000,
    grossSellout: 0,
    perUnitValues: [],
    avgPricePerUnit: 0,
    sellingCosts: 0,
    registrationCost: 0,
    registrationCarry: 0,
    absorptionCarry: 0,
    netProceeds: 0,
    profit,
    marginOnCost: 0,
    profitPerUnit: 0,
    monthsToExit: 16,
    flags: [],
  };
}

function holdResult(horizonProfit: number | null): MliHoldResult {
  const eligible = horizonProfit !== null;
  return {
    eligible,
    reason: eligible ? undefined : "MLI Select requires 5+ units — this configuration has 4. Compare against conventional financing instead.",
    mli: {} as MliHoldResult["mli"],
    loanBalance: 0,
    equityLeftIn: 0,
    annualDebtService: 0,
    annualCashFlow: 0,
    cashOnCash: null,
    valueCreation: 0,
    devMarginOnCost: 0,
    horizonYears: 5,
    horizonProfit: horizonProfit ?? 0,
    flags: [],
  };
}

describe("compareTakeouts", () => {
  it("condo wins when its profit clears the hold's horizon dollars", () => {
    const d = compareTakeouts(condoResult(500_000), holdResult(300_000), { units: 6 });
    expect(d.recommended).toBe("condo_termination");
    expect(d.deltaDollars).toBe(200_000);
  });

  it("hold wins when horizon profit is larger, and calls out apartment clearance risk", () => {
    const d = compareTakeouts(condoResult(300_000, "condo_apartment"), holdResult(500_000), { units: 6 });
    expect(d.recommended).toBe("mli_hold");
    expect(d.deltaDollars).toBe(200_000);
    expect(d.reasons.join(" ")).toContain("illiquid");
  });

  it("MLI-ineligible config recommends condo when it pencils", () => {
    const d = compareTakeouts(condoResult(250_000), holdResult(null), { units: 4 });
    expect(d.recommended).toBe("condo_termination");
    expect(d.holdScore).toBeNull();
    expect(d.reasons.join(" ")).toContain("5+ units");
  });

  it("neither pencils -> neither", () => {
    const d = compareTakeouts(condoResult(-100_000), holdResult(-50_000), { units: 6 });
    expect(d.recommended).toBe("neither");
  });
});

// ─── Cross-config recommendation (town-form preference) ─────────────────────

function candidate(
  configKey: string,
  units: number,
  condoProfit: number,
  form: "condo_town" | "condo_apartment",
  holdHorizonProfit: number | null,
): TakeoutCandidate {
  const condo = condoResult(condoProfit, form);
  const hold = holdResult(holdHorizonProfit);
  return { configKey, configLabel: configKey, units, condo, hold, decision: compareTakeouts(condo, hold, { units }) };
}

describe("pickRecommendedTakeout", () => {
  it("prefers a town-form condo exit within tolerance of a bigger apartment-form number", () => {
    const r = pickRecommendedTakeout(
      [
        candidate("sixplex", 6, 1_000_000, "condo_apartment", 400_000),
        candidate("fourplex", 4, 950_000, "condo_town", null),
      ],
      ta,
    );
    expect(r.configKey).toBe("fourplex");
    expect(r.takeout).toBe("condo_termination");
    expect(r.formPreferenceApplied).toBe(true);
  });

  it("does not stretch the preference past the tolerance", () => {
    const r = pickRecommendedTakeout(
      [
        candidate("sixplex", 6, 1_000_000, "condo_apartment", 400_000),
        candidate("fourplex", 4, 850_000, "condo_town", null),
      ],
      ta,
    );
    expect(r.configKey).toBe("sixplex");
    expect(r.formPreferenceApplied).toBe(false);
  });

  it("prefers a town-form condo within tolerance of a winning hold", () => {
    const r = pickRecommendedTakeout(
      [
        candidate("sixplex", 6, 200_000, "condo_apartment", 1_000_000),
        candidate("fourplex", 4, 980_000, "condo_town", null),
      ],
      ta,
    );
    expect(r.configKey).toBe("fourplex");
    expect(r.takeout).toBe("condo_termination");
    expect(r.formPreferenceApplied).toBe(true);
  });

  it("keeps the hold when no viable town alternative exists", () => {
    const r = pickRecommendedTakeout(
      [candidate("sixplex", 6, 200_000, "condo_apartment", 1_000_000)],
      ta,
    );
    expect(r.configKey).toBe("sixplex");
    expect(r.takeout).toBe("mli_hold");
  });

  it("all-negative slate -> neither", () => {
    const r = pickRecommendedTakeout([candidate("sixplex", 6, -10, "condo_apartment", -10)], ta);
    expect(r.takeout).toBe("neither");
    expect(r.configKey).toBeNull();
  });
});

// ─── End-to-end sanity with the real pipeline ────────────────────────────────

describe("integration with envelope/config/proforma engines", () => {
  it("runs the full dual-takeout pipeline on a 40x120 sixplex-ward lot without NaN", () => {
    const envelope = computeEnvelope({ lotFrontageFt: 40, lotDepthFt: 120, sixplexEligible: true });
    const configs = generateConfigurations({
      envelope,
      maxUnitsAsOfRight: 6,
      sixplexCertainty: "verified",
      lanewayEligible: false,
      gardenSuiteEligible: false,
    });
    expect(configs.length).toBeGreaterThan(0);

    const candidates: TakeoutCandidate[] = configs.map((config) => {
      const costs = computeCostStack(config, 1_200_000, dev);
      const rentalHold = computeRentalHold(config, costs, dev);
      const condo = computeCondoTermination(config, costs, dev, ta);
      const hold = computeMliHold(
        { config, costs, rentalHold, points: 70, interestRate: 0.045 },
        ta,
      );
      const decision = compareTakeouts(condo, hold, config);
      for (const n of [condo.profit, condo.netProceeds, hold.horizonProfit, decision.condoScore]) {
        expect(Number.isFinite(n)).toBe(true);
      }
      return { configKey: config.key, configLabel: config.label, units: config.units, condo, hold, decision };
    });

    const site = pickRecommendedTakeout(candidates, ta);
    expect(["mli_hold", "condo_termination", "neither"]).toContain(site.takeout);
    expect(site.reasons.length).toBeGreaterThan(0);
  });
});
