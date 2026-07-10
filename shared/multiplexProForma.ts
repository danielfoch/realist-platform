/**
 * Multiplex development pro forma (pure, unit-tested).
 *
 * Per configuration: development cost stack -> condo-exit sellout vs
 * rental-hold NOI/value, plus residual land value both ways. All money in CAD.
 *
 * Assumption defaults live in DEV_ASSUMPTION_DEFAULTS with sources; the
 * orchestrator overlays admin-edited values from multiplex_assumptions and
 * user overrides on top. Nothing here fetches — fully deterministic.
 */

import type { BuildConfiguration } from "./multiplexConfigs";
import type { UnitType } from "./multiplexTypes";
import { computeTorontoDevelopmentCharges, dcUnitsFromMix } from "./developmentCharges";
import { computeOperatingCosts, type OperatingCostLine } from "./operatingCosts";

// ─── Defaults (sources cited; admin-overridable) ─────────────────────────────

export const DEV_ASSUMPTION_DEFAULTS = {
  source: "Altus 2024-25 cost guide ranges; Toronto DC By-law 1137-2022 rates + MM32.5 multiplex exemption (see shared/developmentCharges.ts); CMHC Toronto rents (see shared/cmhcRents.ts)",
  lastVerified: "2026-07",
  /** New-build multiplex hard cost, $/sf of gross GFA (Toronto, mid-range). */
  hardCostPsf: 400,
  /** Soft costs (design, permits, legal, marketing) as % of hard cost. */
  softCostPctOfHard: 0.15,
  /** Contingency on hard+soft. */
  contingencyPct: 0.1,
  /** Construction loan rate (annual) and months, for carry estimate. */
  constructionRate: 0.065,
  constructionMonths: 14,
  /** Share of total cost financed during construction. */
  loanToCost: 0.75,
  vacancyPct: 0.03,
  exitCapRate: 0.0475,
  condoSellingCostPct: 0.05,
  /** Target margins for residual land value. */
  targetCondoMarginOnCost: 0.15,
  targetYieldOnCost: 0.0525,
  /** Toronto monthly market rents by unit type (CMHC-seeded; estimate). */
  monthlyRents: {
    bachelor: 1450,
    "1br": 1800,
    "2br": 2400,
    "3br": 2900,
  } as Record<UnitType, number>,
  /** Condo sale price $/sf net (assumption — no comps integration yet). */
  condoPsf: 1050,
} as const;

export interface DevAssumptions {
  source: string;
  lastVerified: string;
  hardCostPsf: number;
  softCostPctOfHard: number;
  contingencyPct: number;
  constructionRate: number;
  constructionMonths: number;
  loanToCost: number;
  vacancyPct: number;
  exitCapRate: number;
  condoSellingCostPct: number;
  targetCondoMarginOnCost: number;
  targetYieldOnCost: number;
  monthlyRents: Record<UnitType, number>;
  condoPsf: number;
}

// ─── Land transfer tax (ON + Toronto MLTT, residential brackets) ────────────

const ON_LTT_BRACKETS: Array<[number, number]> = [
  [55000, 0.005],
  [250000, 0.01],
  [400000, 0.015],
  [2000000, 0.02],
  [Infinity, 0.025],
];

function bracketTax(price: number, brackets: Array<[number, number]>): number {
  let tax = 0;
  let prev = 0;
  for (const [cap, rate] of brackets) {
    if (price <= prev) break;
    tax += (Math.min(price, cap) - prev) * rate;
    prev = cap;
  }
  return tax;
}

/** Combined Ontario LTT + Toronto MLTT (Toronto mirrors the provincial brackets at these price points). */
export function torontoLandTransferTax(price: number): number {
  return Math.round(bracketTax(price, ON_LTT_BRACKETS) + bracketTax(price, ON_LTT_BRACKETS));
}

// ─── Cost stack ──────────────────────────────────────────────────────────────

export interface CostStack {
  land: number;
  landTransferTax: number;
  hardCosts: number;
  softCosts: number;
  contingency: number;
  developmentCharges: number;
  dcUnitsCharged: number;
  dcExemptUnits: number;
  dcExemptionBasis: string;
  financingCarry: number;
  totalDevCost: number;
  costPerUnit: number;
  costPerNetSqft: number;
}

export function computeCostStack(
  config: BuildConfiguration,
  landPrice: number,
  a: DevAssumptions,
): CostStack {
  const totalGfa = config.grossGfaSqft + config.suiteGfaSqft;
  const hard = totalGfa * a.hardCostPsf;
  const soft = hard * a.softCostPctOfHard;
  const contingency = (hard + soft) * a.contingencyPct;
  // Development charges via the exemption-aware Toronto engine: units 2–6 in an
  // up-to-six-unit multiplex are $0 (MM32.5), so a small multiplex pays DC on
  // one unit, not (units − 3) single-detached charges.
  const dc = computeTorontoDevelopmentCharges({ units: dcUnitsFromMix(config.unitMix), tenure: "ownership" });
  const dcs = dc.total;
  const dcUnitsCharged = dc.chargedUnits;
  const ltt = torontoLandTransferTax(landPrice);

  // Carry: interest on the financed share of (hard+soft+contingency+DCs),
  // half-drawn on average over the construction period.
  const financedBase = (hard + soft + contingency + dcs) * a.loanToCost;
  const carry = financedBase * 0.5 * a.constructionRate * (a.constructionMonths / 12);

  const total = landPrice + ltt + hard + soft + contingency + dcs + carry;
  return {
    land: Math.round(landPrice),
    landTransferTax: ltt,
    hardCosts: Math.round(hard),
    softCosts: Math.round(soft),
    contingency: Math.round(contingency),
    developmentCharges: Math.round(dcs),
    dcUnitsCharged,
    dcExemptUnits: dc.exemptUnits,
    dcExemptionBasis: dc.exemptionBasis,
    financingCarry: Math.round(carry),
    totalDevCost: Math.round(total),
    costPerUnit: config.units > 0 ? Math.round(total / config.units) : 0,
    costPerNetSqft: config.netSqft > 0 ? Math.round(total / config.netSqft) : 0,
  };
}

// ─── Exits ───────────────────────────────────────────────────────────────────

export interface CondoExit {
  grossSellout: number;
  sellingCosts: number;
  netSellout: number;
  profit: number;
  marginOnCost: number;
  profitPerUnit: number;
}

export function computeCondoExit(config: BuildConfiguration, costs: CostStack, a: DevAssumptions): CondoExit {
  const gross = config.netSqft * a.condoPsf;
  const selling = gross * a.condoSellingCostPct;
  const net = gross - selling;
  const profit = net - costs.totalDevCost;
  return {
    grossSellout: Math.round(gross),
    sellingCosts: Math.round(selling),
    netSellout: Math.round(net),
    profit: Math.round(profit),
    marginOnCost: costs.totalDevCost > 0 ? round3(profit / costs.totalDevCost) : 0,
    profitPerUnit: config.units > 0 ? Math.round(profit / config.units) : 0,
  };
}

export interface RentalHold {
  grossPotentialRent: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  /** Itemised operating budget (property tax, insurance, maintenance, …). */
  operatingCostLines: OperatingCostLine[];
  /** Realised opex as a fraction of EGI (was the flat assumption; now derived). */
  opexPctOfEgi: number;
  noi: number;
  stabilizedValue: number;
  yieldOnCost: number;
  monthlyRentRoll: Array<{ type: UnitType; count: number; rentEach: number }>;
}

export function computeRentalHold(config: BuildConfiguration, costs: CostStack, a: DevAssumptions): RentalHold {
  const rentRoll = config.unitMix.map((e) => ({
    type: e.type,
    count: e.count,
    rentEach: a.monthlyRents[e.type] ?? 0,
  }));
  const gpr = rentRoll.reduce((s, r) => s + r.count * r.rentEach, 0) * 12;
  const egi = gpr * (1 - a.vacancyPct);
  // Itemised opex replaces the flat % — property tax (off the MPAC 2016-base
  // proxy of dev cost), insurance, maintenance, reserve, management, utilities.
  const opexResult = computeOperatingCosts({
    units: config.units,
    grossPotentialRent: gpr,
    effectiveGrossIncome: egi,
    currentValue: costs.totalDevCost,
    isNewBuild: true,
  });
  const opex = opexResult.total;
  const noi = egi - opex;
  return {
    grossPotentialRent: Math.round(gpr),
    effectiveGrossIncome: Math.round(egi),
    operatingExpenses: Math.round(opex),
    operatingCostLines: opexResult.lines,
    opexPctOfEgi: opexResult.totalPctOfEgi,
    noi: Math.round(noi),
    stabilizedValue: a.exitCapRate > 0 ? Math.round(noi / a.exitCapRate) : 0,
    yieldOnCost: costs.totalDevCost > 0 ? round4(noi / costs.totalDevCost) : 0,
    monthlyRentRoll: rentRoll,
  };
}

// ─── Residual land value ─────────────────────────────────────────────────────

export interface ResidualLandValue {
  /** Max land price to hit the target condo margin on cost. */
  condoPath: number;
  /** Max land price to hit the target yield-on-cost as a rental. */
  rentalPath: number;
  targetCondoMarginOnCost: number;
  targetYieldOnCost: number;
}

/**
 * Solves for land such that the target is met. Non-land costs scale with the
 * config, LTT scales with land (solved iteratively — 3 passes converge well
 * within a dollar at these bracket sizes).
 */
export function computeResidualLandValue(
  config: BuildConfiguration,
  a: DevAssumptions,
): ResidualLandValue {
  const nonLand = (land: number) => {
    const stack = computeCostStack(config, land, a);
    return stack.totalDevCost - stack.land;
  };

  // Condo: netSellout = (1 + m) x totalDevCost  =>  land = netSellout/(1+m) − nonLand(land)
  const netSellout = config.netSqft * a.condoPsf * (1 - a.condoSellingCostPct);
  let condoLand = 0;
  for (let i = 0; i < 3; i++) {
    condoLand = Math.max(0, netSellout / (1 + a.targetCondoMarginOnCost) - nonLand(condoLand));
  }

  // Rental: NOI(land) / targetYoC = totalDevCost(land)  =>  land = NOI/target − nonLand(land).
  // NOI now depends on land via the property-tax line (assessed off dev cost),
  // so it is recomputed each pass alongside nonLand — the same iteration that
  // already resolves the LTT circularity.
  const gpr = config.unitMix.reduce((s, e) => s + e.count * (a.monthlyRents[e.type] ?? 0), 0) * 12;
  const egi = gpr * (1 - a.vacancyPct);
  const noiAtLand = (land: number) => {
    const stack = computeCostStack(config, land, a);
    const opex = computeOperatingCosts({
      units: config.units, grossPotentialRent: gpr, effectiveGrossIncome: egi,
      currentValue: stack.totalDevCost, isNewBuild: true,
    }).total;
    return egi - opex;
  };
  let rentalLand = 0;
  for (let i = 0; i < 3; i++) {
    rentalLand = Math.max(0, noiAtLand(rentalLand) / a.targetYieldOnCost - nonLand(rentalLand));
  }

  return {
    condoPath: Math.round(condoLand),
    rentalPath: Math.round(rentalLand),
    targetCondoMarginOnCost: a.targetCondoMarginOnCost,
    targetYieldOnCost: a.targetYieldOnCost,
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
