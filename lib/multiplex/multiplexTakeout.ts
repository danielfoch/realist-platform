/**
 * Dual-takeout exit comparator (pure, unit-tested).
 *
 * Per Dan's spec (2026-07-03): every Toronto multiplex underwrite ends in one
 * of two takeouts, and the engine picks the better one dynamically while every
 * parameter stays user-tunable:
 *
 *   A. MLI Select hold — build apartment-style, refinance onto CMHC MLI Select
 *      insured debt (5+ unit gate, points tiers -> LTV/amortization/premium; see
 *      shared/mliSelect.ts), hold as rental.
 *   B. Condo termination — register a plan of condominium and sell the units.
 *      Toronto condo APARTMENTS are illiquid mid-2026 (GTA condo-apt sales at a
 *      35-year low, resale ~$859/sf, TRREB Q1-2026), so the model prefers fewer,
 *      larger units in CONDO-TOWNHOUSE form: form-specific $/sf, an
 *      apartment-form illiquidity discount, and slower apartment absorption.
 *
 * Both takeouts are expressed in comparable dollars: condo profit at exit vs
 * hold value-creation plus a tunable horizon of levered cash flow. Nothing here
 * fetches — fully deterministic. Defaults live in TAKEOUT_ASSUMPTION_DEFAULTS
 * (admin-overridable via multiplex_assumptions, per-request via
 * assumptionOverrides). UNVERIFIED defaults are marked for Dan's calibration.
 */

import type { BuildConfiguration } from "./multiplexConfigs";
import type { CostStack, DevAssumptions, RentalHold } from "./multiplexProForma";
import {
  computeMliTakeout,
  paymentFactorMonthly,
  MLI_SELECT_RULES,
  type MliTakeoutResult,
} from "./mliSelect";
import type { RiskFlag } from "./multiplexTypes";

// ─── Defaults (sources cited; admin-overridable) ─────────────────────────────

export const TAKEOUT_ASSUMPTION_DEFAULTS = {
  source:
    "TRREB Q1-2026 condo market report (resale condo-apt ~$859/sf, condo-town avg $729k, 35-year sales low); City of Toronto draft-plan-of-condominium process; CMHC MLI Select rules verified 2026-07 (see shared/mliSelect.ts)",
  lastVerified: "2026-07",

  // ── Condo termination ──
  /**
   * New-build condo-TOWNHOUSE sale price, $/sf net. UNVERIFIED — set between
   * Q1-2026 resale comps (~$859/sf apt) and new-build asking (~$1,189/sf that
   * is not clearing); ground-related town product carries a liquidity premium.
   * Calibrate against project comps.
   */
  condoTownPsf: 1000,
  /**
   * New-build condo-APARTMENT sale price, $/sf net. UNVERIFIED — new product
   * must price near resale comps (TRREB Q1-2026 resale avg $859/sf) to clear
   * in the current market.
   */
  condoAptPsf: 900,
  /**
   * Additional clearance haircut applied to apartment-form pricing only —
   * encodes the mid-2026 condo-apartment illiquidity (35-year sales low).
   * UNVERIFIED — calibrate.
   */
  condoAptIlliquidityDiscountPct: 0.05,
  /**
   * Max units marketable as condo towns on a standard multiplex lot (beyond
   * this the building reads as an apartment). UNVERIFIED planning/marketing
   * judgement — calibrate.
   */
  maxCondoTownUnits: 4,
  /** Min average net sqft/unit for town form — smaller units read as apartments. UNVERIFIED. */
  minCondoTownAvgSqft: 650,
  /**
   * Plan-of-condominium fixed cost: draft plan application (City of Toronto
   * community planning fee schedule), condo lawyer, OLS survey/description.
   * UNVERIFIED — practitioner range; calibrate with Dan's condo lawyer.
   */
  condoRegistrationFixedCost: 60000,
  /** Per-unit registration extras (disclosure, unit deeds). UNVERIFIED. */
  condoRegistrationPerUnitCost: 5000,
  /**
   * Months from completion to condo registration (draft plan approval →
   * registration; approvals lapse after 5 years). UNVERIFIED — 12 months is a
   * common small-project experience; calibrate.
   */
  condoRegistrationMonths: 12,
  /** Months to sell out after registration — town form. UNVERIFIED. */
  condoTownAbsorptionMonths: 4,
  /** Months to sell out after registration — apartment form (35-yr sales low). UNVERIFIED. */
  condoAptAbsorptionMonths: 9,

  // ── MLI Select hold ──
  /** CMHC premium is typically capitalized into the insured loan. */
  capitalizeMliPremium: true,
  /**
   * Years of levered cash flow counted when comparing hold vs condo dollars.
   * Undiscounted simplification — tunable. UNVERIFIED preference parameter.
   */
  holdHorizonYears: 5,

  // ── Comparator ──
  /**
   * Form-preference tie-break: when a condo-townhouse-form config's profit is
   * within this fraction of the best apartment-form (or hold) score, prefer
   * the town form (fewer, more liquid units). UNVERIFIED preference parameter.
   */
  formPreferenceTolerancePct: 0.1,
} as const;

export interface TakeoutAssumptions {
  source: string;
  lastVerified: string;
  condoTownPsf: number;
  condoAptPsf: number;
  condoAptIlliquidityDiscountPct: number;
  maxCondoTownUnits: number;
  minCondoTownAvgSqft: number;
  condoRegistrationFixedCost: number;
  condoRegistrationPerUnitCost: number;
  condoRegistrationMonths: number;
  condoTownAbsorptionMonths: number;
  condoAptAbsorptionMonths: number;
  capitalizeMliPremium: boolean;
  holdHorizonYears: number;
  formPreferenceTolerancePct: number;
}

// ─── Condo termination ───────────────────────────────────────────────────────

export type CondoForm = "condo_town" | "condo_apartment";

export interface CondoTerminationResult {
  form: CondoForm;
  formReason: string;
  /** Form-adjusted sale price, $/sf net (after any illiquidity discount). */
  pricePsf: number;
  grossSellout: number;
  perUnitValues: Array<{ type: string; count: number; netSqftEach: number; priceEach: number }>;
  avgPricePerUnit: number;
  sellingCosts: number;
  registrationCost: number;
  registrationCarry: number;
  absorptionCarry: number;
  netProceeds: number;
  profit: number;
  marginOnCost: number;
  profitPerUnit: number;
  monthsToExit: number;
  flags: RiskFlag[];
}

/** Which condo form this configuration can realistically be marketed as. */
export function determineCondoForm(
  config: Pick<BuildConfiguration, "units" | "netSqft">,
  a: TakeoutAssumptions,
): { form: CondoForm; reason: string } {
  const avgSqft = config.units > 0 ? config.netSqft / config.units : 0;
  if (config.units > a.maxCondoTownUnits) {
    return {
      form: "condo_apartment",
      reason: `${config.units} units exceeds the ${a.maxCondoTownUnits}-unit condo-townhouse ceiling — markets as condo apartments.`,
    };
  }
  if (avgSqft < a.minCondoTownAvgSqft) {
    return {
      form: "condo_apartment",
      reason: `Average unit of ${Math.round(avgSqft)} sqft is below the ${a.minCondoTownAvgSqft} sqft condo-town minimum — markets as condo apartments.`,
    };
  }
  return {
    form: "condo_town",
    reason: `${config.units} ground-related units averaging ${Math.round(avgSqft)} sqft market as condo townhouses.`,
  };
}

/**
 * Condo-termination proforma: form-adjusted per-unit exit values, plan-of-
 * condominium registration cost + carry, and absorption carry. Carry accrues
 * on the financed share of the completed project (dev.loanToCost x total cost)
 * at the construction rate — full balance during registration, half the
 * balance on average during sell-out.
 */
export function computeCondoTermination(
  config: BuildConfiguration,
  costs: CostStack,
  dev: DevAssumptions,
  a: TakeoutAssumptions,
): CondoTerminationResult {
  const { form, reason } = determineCondoForm(config, a);
  const flags: RiskFlag[] = [];

  const basePsf = form === "condo_town" ? a.condoTownPsf : a.condoAptPsf;
  const discount = form === "condo_apartment" ? a.condoAptIlliquidityDiscountPct : 0;
  const pricePsf = basePsf * (1 - discount);
  if (form === "condo_apartment") {
    flags.push({
      key: "condo_apt_illiquidity",
      severity: "caution",
      message: `Apartment-form condo exit modelled with a ${Math.round(discount * 1000) / 10}% clearance discount and ${a.condoAptAbsorptionMonths}-month absorption — Toronto condo-apartment resale volumes are at multi-decade lows.`,
    });
  }

  const gross = config.netSqft * pricePsf;
  const perUnitValues = config.unitMix.map((e) => ({
    type: e.type,
    count: e.count,
    netSqftEach: e.netSqftEach,
    priceEach: Math.round(e.netSqftEach * pricePsf),
  }));

  const selling = gross * dev.condoSellingCostPct;
  const registrationCost = a.condoRegistrationFixedCost + config.units * a.condoRegistrationPerUnitCost;

  const absorptionMonths = form === "condo_town" ? a.condoTownAbsorptionMonths : a.condoAptAbsorptionMonths;
  const carryBase = costs.totalDevCost * dev.loanToCost;
  const registrationCarry = carryBase * dev.constructionRate * (a.condoRegistrationMonths / 12);
  const absorptionCarry = carryBase * dev.constructionRate * (absorptionMonths / 12) * 0.5;

  const net = gross - selling - registrationCost - registrationCarry - absorptionCarry;
  const profit = net - costs.totalDevCost;

  return {
    form,
    formReason: reason,
    pricePsf: Math.round(pricePsf),
    grossSellout: Math.round(gross),
    perUnitValues,
    avgPricePerUnit: config.units > 0 ? Math.round(gross / config.units) : 0,
    sellingCosts: Math.round(selling),
    registrationCost: Math.round(registrationCost),
    registrationCarry: Math.round(registrationCarry),
    absorptionCarry: Math.round(absorptionCarry),
    netProceeds: Math.round(net),
    profit: Math.round(profit),
    marginOnCost: costs.totalDevCost > 0 ? round3(profit / costs.totalDevCost) : 0,
    profitPerUnit: config.units > 0 ? Math.round(profit / config.units) : 0,
    monthsToExit: a.condoRegistrationMonths + absorptionMonths,
    flags,
  };
}

// ─── MLI Select hold ─────────────────────────────────────────────────────────

export interface MliHoldInput {
  config: Pick<BuildConfiguration, "units">;
  costs: Pick<CostStack, "totalDevCost">;
  rentalHold: Pick<RentalHold, "noi" | "stabilizedValue">;
  /** MLI Select points already scored (see scoreMliPoints in shared/mliSelect.ts). */
  points: number;
  interestRate: number;
  purpose?: "construction" | "other";
}

export interface MliHoldResult {
  eligible: boolean;
  reason?: string;
  /** Loan sizing detail from the verified MLI Select model. */
  mli: MliTakeoutResult;
  /** Balance owed incl. capitalized CMHC premium (when capitalizeMliPremium). */
  loanBalance: number;
  equityLeftIn: number;
  annualDebtService: number;
  annualCashFlow: number;
  cashOnCash: number | null;
  /** Stabilized value minus all-in cost — the development lift kept on hold. */
  valueCreation: number;
  devMarginOnCost: number;
  horizonYears: number;
  /** valueCreation + annualCashFlow x horizonYears — dollars comparable to condo profit. */
  horizonProfit: number;
  flags: RiskFlag[];
}

export function computeMliHold(input: MliHoldInput, a: TakeoutAssumptions): MliHoldResult {
  const { noi, stabilizedValue } = input.rentalHold;
  const totalDevCost = input.costs.totalDevCost;
  const mli = computeMliTakeout({
    units: input.config.units,
    noi,
    lendingValue: Math.min(stabilizedValue, totalDevCost > 0 ? totalDevCost : stabilizedValue),
    points: input.points,
    purpose: input.purpose ?? "other",
    interestRate: input.interestRate,
  });

  const valueCreation = stabilizedValue - totalDevCost;
  const devMarginOnCost = totalDevCost > 0 ? round3(valueCreation / totalDevCost) : 0;

  if (!mli.eligible) {
    return {
      eligible: false,
      reason: mli.reason,
      mli,
      loanBalance: 0,
      equityLeftIn: totalDevCost,
      annualDebtService: 0,
      annualCashFlow: Math.round(noi),
      cashOnCash: totalDevCost > 0 ? round4(noi / totalDevCost) : null,
      valueCreation: Math.round(valueCreation),
      devMarginOnCost,
      horizonYears: a.holdHorizonYears,
      horizonProfit: Math.round(valueCreation + noi * a.holdHorizonYears),
      flags: [],
    };
  }

  const flags: RiskFlag[] = [];
  const loanBalance = a.capitalizeMliPremium ? mli.maxLoan + mli.premiumDollars : mli.maxLoan;
  const pf = paymentFactorMonthly(input.interestRate, mli.amortYears);
  const annualDebtService = Math.round(loanBalance * pf * 12);
  const annualCashFlow = Math.round(noi - annualDebtService);
  const equityLeftIn = Math.max(0, totalDevCost - mli.maxLoan);
  const cashOnCash = equityLeftIn > 0 ? round4(annualCashFlow / equityLeftIn) : null;

  const dscrAfterPremium = annualDebtService > 0 ? noi / annualDebtService : 0;
  if (a.capitalizeMliPremium && dscrAfterPremium < MLI_SELECT_RULES.minDscr) {
    flags.push({
      key: "dscr_after_premium",
      severity: "caution",
      message: `Capitalizing the ${mli.premiumPct}% CMHC premium takes DSCR to ${Math.round(dscrAfterPremium * 100) / 100} — below the ${MLI_SELECT_RULES.minDscr} covenant; the lender may size the loan down.`,
    });
  }

  return {
    eligible: true,
    mli,
    loanBalance: Math.round(loanBalance),
    equityLeftIn: Math.round(equityLeftIn),
    annualDebtService,
    annualCashFlow,
    cashOnCash,
    valueCreation: Math.round(valueCreation),
    devMarginOnCost,
    horizonYears: a.holdHorizonYears,
    horizonProfit: Math.round(valueCreation + annualCashFlow * a.holdHorizonYears),
    flags,
  };
}

// ─── Comparator ──────────────────────────────────────────────────────────────

export type TakeoutChoice = "mli_hold" | "condo_termination" | "neither";

export interface TakeoutDecision {
  recommended: TakeoutChoice;
  /** Condo profit, dollars. */
  condoScore: number;
  /** Hold horizon profit, dollars (null when MLI-ineligible). */
  holdScore: number | null;
  deltaDollars: number;
  reasons: string[];
}

/** Per-config decision: both takeouts in comparable dollars, better one wins. */
export function compareTakeouts(
  condo: CondoTerminationResult,
  hold: MliHoldResult,
  config: Pick<BuildConfiguration, "units">,
): TakeoutDecision {
  const condoScore = condo.profit;
  const holdScore = hold.eligible ? hold.horizonProfit : null;
  const reasons: string[] = [];

  if (!hold.eligible) {
    reasons.push(hold.reason ?? `MLI Select unavailable for ${config.units} units.`);
  }

  if (condoScore <= 0 && (holdScore === null || holdScore <= 0)) {
    reasons.push("Neither takeout pencils at these assumptions — the residual land value is the guide to a workable basis.");
    return { recommended: "neither", condoScore, holdScore, deltaDollars: 0, reasons };
  }

  if (holdScore === null || condoScore >= holdScore) {
    if (holdScore !== null) {
      reasons.push(
        `Condo termination (${condo.form === "condo_town" ? "townhouse form" : "apartment form"}) clears ${fmtDelta(condoScore - holdScore)} more than the MLI Select hold over ${hold.horizonYears} years.`,
      );
    } else if (condoScore > 0) {
      reasons.push("Condo termination is the only available takeout at this unit count.");
    }
    reasons.push(condo.formReason);
    return {
      recommended: condoScore > 0 ? "condo_termination" : "neither",
      condoScore,
      holdScore,
      deltaDollars: holdScore === null ? condoScore : condoScore - holdScore,
      reasons,
    };
  }

  reasons.push(
    `MLI Select hold creates ${fmtDelta(holdScore - condoScore)} more value than the condo exit over ${hold.horizonYears} years (development lift plus levered cash flow).`,
  );
  if (condo.form === "condo_apartment") {
    reasons.push("The condo alternative is apartment-form product in an illiquid market — the hold also avoids clearance risk.");
  }
  return { recommended: "mli_hold", condoScore, holdScore, deltaDollars: holdScore - condoScore, reasons };
}

// ─── Cross-config recommendation ─────────────────────────────────────────────

export interface TakeoutCandidate {
  configKey: string;
  configLabel: string;
  units: number;
  condo: CondoTerminationResult;
  hold: MliHoldResult;
  decision: TakeoutDecision;
}

export interface SiteTakeoutRecommendation {
  configKey: string | null;
  takeout: TakeoutChoice;
  /** Dollars behind the pick (condo profit or hold horizon profit). */
  score: number;
  /** True when the town-form preference overrode a marginally higher score. */
  formPreferenceApplied: boolean;
  reasons: string[];
}

/**
 * Picks the best config+takeout pair for the site. Dan's preference encoded:
 * when a condo-TOWNHOUSE-form exit is within formPreferenceTolerancePct of the
 * top score, take the fewer-unit town form over apartment-form product or a
 * hold — fewer, more liquid units beat a marginally bigger paper number.
 */
export function pickRecommendedTakeout(
  candidates: TakeoutCandidate[],
  a: TakeoutAssumptions,
): SiteTakeoutRecommendation {
  const viable = candidates.filter((c) => c.decision.recommended !== "neither");
  if (viable.length === 0) {
    return {
      configKey: null,
      takeout: "neither",
      score: 0,
      formPreferenceApplied: false,
      reasons: ["No configuration produces a positive takeout at these assumptions."],
    };
  }

  const scoreOf = (c: TakeoutCandidate) =>
    c.decision.recommended === "condo_termination" ? c.decision.condoScore : (c.decision.holdScore ?? 0);

  const ranked = [...viable].sort((x, y) => scoreOf(y) - scoreOf(x));
  let pick = ranked[0];
  let formPreferenceApplied = false;

  const pickIsTownCondo = pick.decision.recommended === "condo_termination" && pick.condo.form === "condo_town";
  if (!pickIsTownCondo) {
    const townAlternative = ranked.find(
      (c) =>
        c !== pick &&
        c.decision.recommended === "condo_termination" &&
        c.condo.form === "condo_town" &&
        c.decision.condoScore > 0 &&
        c.decision.condoScore >= scoreOf(pick) * (1 - a.formPreferenceTolerancePct),
    );
    if (townAlternative) {
      pick = townAlternative;
      formPreferenceApplied = true;
    }
  }

  const reasons = [...pick.decision.reasons];
  if (formPreferenceApplied) {
    reasons.unshift(
      `Preferred the ${pick.units}-unit condo-townhouse exit over a marginally higher-scoring alternative — fewer, ground-related units are the liquid product in the mid-2026 Toronto market (tolerance ${Math.round(a.formPreferenceTolerancePct * 100)}%).`,
    );
  }

  return {
    configKey: pick.configKey,
    takeout: pick.decision.recommended,
    score: scoreOf(pick),
    formPreferenceApplied,
    reasons,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDelta(n: number): string {
  return `$${Math.round(Math.abs(n)).toLocaleString("en-CA")}`;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
