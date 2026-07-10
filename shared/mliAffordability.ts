/**
 * Realist.ca — CMHC MLI Select affordability tradeoff.
 *
 * MLI Select's affordability points are NOT free: to earn them a share of units
 * must rent at or below an "affordable" cap (CMHC defines it as ~30% of the
 * median renter household income for the market). Where market rent exceeds that
 * cap, the borrower gives up rent to unlock better leverage (higher LTV, longer
 * amortization, a premium discount). The underwriter previously granted the
 * 70-point benefit while still crediting full market rent — this quantifies the
 * rent actually forgone so the financing benefit is weighed against its cost.
 *
 * Pure logic. The affordable-rent cap is an INPUT (the market-specific figure
 * lives in one verified constant at the call site), so this module is
 * number-agnostic and unit-tested independently of any one market.
 */

import { MLI_SELECT_RULES } from "./mliSelect";

/**
 * Share of units that must rent at/below the affordable cap for each level —
 * NEW CONSTRUCTION. (Existing properties need 40/60/80% for the same tiers.)
 * Source: CMHC MLI Select fact sheet, doc 20251029-008A, verified 2026-07.
 */
export const AFFORDABILITY_UNIT_SHARE: Record<1 | 2 | 3, number> = {
  1: 0.10, // 50 points
  2: 0.15, // 70 points
  3: 0.25, // 100 points
};

/** Existing-property unit shares (for reference; the underwriter models new builds). */
export const AFFORDABILITY_UNIT_SHARE_EXISTING: Record<1 | 2 | 3, number> = { 1: 0.40, 2: 0.60, 3: 0.80 };

/**
 * CMHC median renter household income by CMA — the input to MLI Select's
 * affordability test (affordable rent = 30% of this ÷ 12). CMHC's current file
 * is the 2019 "Real Median Total Household Income (Before Taxes) — Renter
 * Households" XLSX, still operative in 2026. A SINGLE CMA-wide figure (not
 * per-bedroom). Verified 2026-07-09.
 */
export const MEDIAN_RENTER_INCOME: Record<string, number> = {
  Toronto: 53900,
  Vancouver: 66900,
  Montreal: 43600,
};

export const AFFORDABILITY_INCOME_SHARE = 0.30;
export const MLI_AFFORDABILITY_SOURCE =
  "CMHC MLI Select — affordable rent = 30% of median renter income (2019 CIS file, current 2026); fact sheet 20251029-008A";

/** Affordable-rent cap ($/month) for a market = 30% of median renter income ÷ 12. */
export function affordableRentCapForMarket(market: string): number | null {
  const income = MEDIAN_RENTER_INCOME[market];
  return income != null ? Math.round((income * AFFORDABILITY_INCOME_SHARE) / 12 * 100) / 100 : null;
}

/** Minimum affordability commitment period (years) under MLI Select. */
export const AFFORDABILITY_COMMITMENT_YEARS = 10;

export interface AffordableUnitMixEntry {
  /** Monthly market rent for this unit type. */
  marketRent: number;
  count: number;
}

export interface MliAffordabilityInput {
  /** Per-type market rent + counts (the config's stabilized rent roll). */
  unitMix: AffordableUnitMixEntry[];
  /**
   * The affordable-rent cap ($/month). A single cap, or a per-type cap aligned
   * to unitMix order. CMHC's cap ≈ 30% of median renter income for the market.
   */
  affordableRentCap: number | number[];
  affordabilityLevel: 1 | 2 | 3;
}

export interface MliAffordabilityResult {
  affordabilityLevel: 1 | 2 | 3;
  totalUnits: number;
  /** Units that must be set at/below the affordable cap. */
  unitsRequired: number;
  commitmentYears: number;
  /** Annual market rent across all units (before any affordability discount). */
  marketAnnualRent: number;
  /** Annual rent after discounting the required units to the cap. */
  affordabilityAdjustedAnnualRent: number;
  /** Annual rent given up to meet the commitment (market − adjusted). */
  annualRentForgone: number;
  /** The affordable units already rent at/below cap (no rent given up). */
  alreadyAffordable: boolean;
  notes: string[];
}

function capFor(cap: number | number[], index: number): number {
  return Array.isArray(cap) ? (cap[index] ?? cap[cap.length - 1] ?? 0) : cap;
}

/**
 * Compute the rent-forgone cost of an MLI Select affordability commitment.
 *
 * The required units are chosen to MINIMISE rent given up — i.e. the units whose
 * market rent is closest to (or already below) the cap are set affordable first,
 * because a rational borrower designates the cheapest units as the affordable
 * ones. That makes this a lower-bound cost estimate, surfaced as such.
 */
export function computeMliAffordability(input: MliAffordabilityInput): MliAffordabilityResult {
  const totalUnits = input.unitMix.reduce((s, e) => s + Math.max(0, e.count), 0);
  const share = AFFORDABILITY_UNIT_SHARE[input.affordabilityLevel];
  const unitsRequired = totalUnits > 0 ? Math.ceil(totalUnits * share) : 0;

  // Expand to per-unit (rent, cap), then pick the cheapest-to-discount units.
  const perUnit: Array<{ market: number; cap: number }> = [];
  input.unitMix.forEach((e, i) => {
    const cap = capFor(input.affordableRentCap, i);
    for (let n = 0; n < Math.max(0, e.count); n++) perUnit.push({ market: e.marketRent, cap });
  });
  const marketAnnualRent = perUnit.reduce((s, u) => s + u.market, 0) * 12;

  // Rent given up per unit if it were the affordable one = max(0, market − cap).
  // Choose the `unitsRequired` units with the SMALLEST give-up.
  const giveUps = perUnit
    .map((u) => Math.max(0, u.market - u.cap))
    .sort((a, b) => a - b)
    .slice(0, unitsRequired);
  const monthlyForgone = giveUps.reduce((s, g) => s + g, 0);
  const annualRentForgone = Math.round(monthlyForgone * 12);

  return {
    affordabilityLevel: input.affordabilityLevel,
    totalUnits,
    unitsRequired,
    commitmentYears: AFFORDABILITY_COMMITMENT_YEARS,
    marketAnnualRent: Math.round(marketAnnualRent),
    affordabilityAdjustedAnnualRent: Math.round(marketAnnualRent - annualRentForgone),
    annualRentForgone,
    alreadyAffordable: annualRentForgone === 0,
    notes: [
      `${input.affordabilityLevel === 1 ? "50" : input.affordabilityLevel === 2 ? "70" : "100"}-point affordability tier needs ${Math.round(share * 100)}% of units (${unitsRequired} of ${totalUnits}) at/below the affordable cap for ${AFFORDABILITY_COMMITMENT_YEARS} years.`,
      annualRentForgone === 0
        ? "The config's rents already meet the affordable cap — the points come at no rent cost here."
        : `Meeting the commitment gives up ~$${annualRentForgone.toLocaleString()}/yr in rent (lower bound: the cheapest units are designated affordable). Weigh this against the leverage/premium benefit.`,
      "Affordable cap ≈ 30% of the market's median renter income (CMHC) — confirm the current published figure for the market.",
    ],
  };
}

/** The MLI premium-discount for an affordability level's points, for context. */
export function affordabilityTierDiscount(level: 1 | 2 | 3): number {
  const points = MLI_SELECT_RULES.points.affordability[level - 1].points;
  return MLI_SELECT_RULES.tiers.find((t) => points >= t.minPoints)?.premiumDiscount ?? 0;
}
