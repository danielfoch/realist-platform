/**
 * CMHC MLI Select underwriting model (pure, unit-tested).
 *
 * Encodes the July 14, 2025 multi-unit premium schedule and the MLI Select
 * points system. Verified against four published worked examples (REIC,
 * "How New CMHC Premiums Impact Your Pro Forma", Sept 2025), including the
 * canonical 5.18% case: >90% LTV refinance/purchase base 6.15% + 1.25%
 * 50-year amortization surcharge, x 0.70 at 100 points = 5.18%.
 *
 * Premium model: total = (base[LTV, purpose] + surcharges) x (1 - tierDiscount)
 *
 * Hard gate: MLI Select requires 5+ residential units. A fourplex does not
 * qualify — callers should fall back to conventional financing comparison.
 */

export const MLI_SELECT_RULES = {
  source:
    "CMHC MLI Select + multi-unit premium schedule effective 2025-07-14 (CMHC advisory; REIC worked examples Sept 2025)",
  lastVerified: "2026-07",
  minUnits: 5,
  minDscr: 1.1,
  /**
   * Base premiums (% of loan) for standard rental housing, by LTV ceiling.
   * Two purposes: construction financing vs all other loan purposes
   * (purchase/refinance).
   */
  basePremiums: [
    { maxLtv: 0.65, construction: 3.25, other: 2.6 },
    { maxLtv: 0.7, construction: 3.75, other: 2.85 },
    { maxLtv: 0.75, construction: 4.25, other: 3.35 },
    { maxLtv: 0.8, construction: 5.0, other: 4.35 },
    { maxLtv: 0.85, construction: 6.0, other: 5.35 },
    { maxLtv: 0.9, construction: 6.75, other: 5.9 },
    { maxLtv: 1.0, construction: 7.0, other: 6.15 },
  ],
  /** +0.25% for every 5 years of amortization beyond 25. */
  amortizationSurchargePer5Yr: 0.25,
  baseAmortizationYears: 25,
  /**
   * MLI Select benefit tiers. Premium discounts are applied to
   * (base + surcharges). LTV/amortization ceilings per tier follow the
   * published benefit ladder.
   */
  tiers: [
    { minPoints: 100, premiumDiscount: 0.3, maxLtv: 0.95, maxAmortYears: 50 },
    { minPoints: 70, premiumDiscount: 0.2, maxLtv: 0.9, maxAmortYears: 45 },
    { minPoints: 50, premiumDiscount: 0.1, maxLtv: 0.85, maxAmortYears: 40 },
  ],
  /**
   * Points matrix (new construction). Levels are commitments:
   *  - affordability: % of units at/below 30% of median renter income
   *  - energy: % better than reference building/code
   *  - accessibility: visitable/universal design commitments
   */
  points: {
    affordability: [
      { level: 1, points: 50, commitment: "10% of units at affordable rents, 10-year minimum" },
      { level: 2, points: 70, commitment: "15% of units at affordable rents, 10-year minimum" },
      { level: 3, points: 100, commitment: "25% of units at affordable rents, 10-year minimum" },
    ],
    energy: [
      { level: 1, points: 20, commitment: "20% better than reference code" },
      { level: 2, points: 35, commitment: "25% better than reference code" },
      { level: 3, points: 50, commitment: "40% better than reference code" },
    ],
    accessibility: [
      { level: 1, points: 20, commitment: "min. accessibility: 15% units accessible or 100% visitable" },
      { level: 2, points: 30, commitment: "full universal design / rated accessibility standard" },
    ],
  },
} as const;

// ─── Points ──────────────────────────────────────────────────────────────────

export interface MliCommitments {
  affordabilityLevel: 0 | 1 | 2 | 3;
  energyLevel: 0 | 1 | 2 | 3;
  accessibilityLevel: 0 | 1 | 2;
}

export function scoreMliPoints(c: MliCommitments): number {
  const a = c.affordabilityLevel > 0 ? MLI_SELECT_RULES.points.affordability[c.affordabilityLevel - 1].points : 0;
  const e = c.energyLevel > 0 ? MLI_SELECT_RULES.points.energy[c.energyLevel - 1].points : 0;
  const x = c.accessibilityLevel > 0 ? MLI_SELECT_RULES.points.accessibility[c.accessibilityLevel - 1].points : 0;
  return a + e + x;
}

export function tierForPoints(points: number) {
  return MLI_SELECT_RULES.tiers.find((t) => points >= t.minPoints) ?? null;
}

// ─── Premiums ────────────────────────────────────────────────────────────────

export function basePremiumPct(ltv: number, purpose: "construction" | "other"): number {
  const row = MLI_SELECT_RULES.basePremiums.find((r) => ltv <= r.maxLtv + 1e-9);
  const last = MLI_SELECT_RULES.basePremiums[MLI_SELECT_RULES.basePremiums.length - 1];
  return (row ?? last)[purpose];
}

export function amortizationSurchargePct(amortYears: number): number {
  const extra = Math.max(0, amortYears - MLI_SELECT_RULES.baseAmortizationYears);
  if (extra === 0) return 0;
  return Math.ceil(extra / 5 - 1e-9) * MLI_SELECT_RULES.amortizationSurchargePer5Yr;
}

export function totalPremiumPct(params: {
  ltv: number;
  amortYears: number;
  purpose: "construction" | "other";
  points: number;
  additionalSurchargesPct?: number;
}): number {
  const base = basePremiumPct(params.ltv, params.purpose);
  const amort = amortizationSurchargePct(params.amortYears);
  const tier = tierForPoints(params.points);
  const discount = tier?.premiumDiscount ?? 0;
  const gross = base + amort + (params.additionalSurchargesPct ?? 0);
  return round3(gross * (1 - discount));
}

// ─── Loan sizing ─────────────────────────────────────────────────────────────

/** Monthly payment per dollar of loan for rate (annual, decimal) & amort years. */
export function paymentFactorMonthly(annualRate: number, amortYears: number): number {
  const r = annualRate / 12;
  const n = amortYears * 12;
  if (r === 0) return 1 / n;
  return r / (1 - Math.pow(1 + r, -n));
}

export interface MliTakeoutInput {
  units: number;
  /** Stabilized NOI, annual dollars. */
  noi: number;
  /** Lending value: for construction/refi takeout use min(cost, appraised value). */
  lendingValue: number;
  points: number;
  purpose: "construction" | "other";
  interestRate: number;
  /** Requested amortization; clamped to the tier maximum. */
  amortYears?: number;
}

export interface MliTakeoutResult {
  eligible: boolean;
  reason?: string;
  points: number;
  tier: { minPoints: number; premiumDiscount: number; maxLtv: number; maxAmortYears: number } | null;
  amortYears: number;
  maxLoanByLtv: number;
  maxLoanByDscr: number;
  maxLoan: number;
  bindingConstraint: "ltv" | "dscr";
  actualLtv: number;
  actualDscr: number;
  premiumPct: number;
  premiumDollars: number;
  annualDebtService: number;
}

export function computeMliTakeout(input: MliTakeoutInput): MliTakeoutResult {
  const empty = {
    points: input.points,
    tier: null,
    amortYears: 0,
    maxLoanByLtv: 0,
    maxLoanByDscr: 0,
    maxLoan: 0,
    bindingConstraint: "ltv" as const,
    actualLtv: 0,
    actualDscr: 0,
    premiumPct: 0,
    premiumDollars: 0,
    annualDebtService: 0,
  };

  if (input.units < MLI_SELECT_RULES.minUnits) {
    return {
      eligible: false,
      reason: `MLI Select requires ${MLI_SELECT_RULES.minUnits}+ units — this configuration has ${input.units}. Compare against conventional financing instead.`,
      ...empty,
    };
  }
  const tier = tierForPoints(input.points);
  if (!tier) {
    return {
      eligible: false,
      reason: `${input.points} points is below the 50-point minimum for MLI Select flexibilities.`,
      ...empty,
    };
  }

  const amortYears = Math.min(input.amortYears ?? tier.maxAmortYears, tier.maxAmortYears);
  const maxLoanByLtv = input.lendingValue * tier.maxLtv;

  const pf = paymentFactorMonthly(input.interestRate, amortYears);
  const maxAnnualDs = input.noi / MLI_SELECT_RULES.minDscr;
  const maxLoanByDscr = maxAnnualDs / (pf * 12);

  const maxLoan = Math.min(maxLoanByLtv, maxLoanByDscr);
  const bindingConstraint = maxLoanByLtv <= maxLoanByDscr ? "ltv" : "dscr";
  const actualLtv = input.lendingValue > 0 ? maxLoan / input.lendingValue : 0;
  const annualDebtService = maxLoan * pf * 12;
  const actualDscr = annualDebtService > 0 ? input.noi / annualDebtService : 0;

  const premiumPct = totalPremiumPct({
    ltv: actualLtv,
    amortYears,
    purpose: input.purpose,
    points: input.points,
  });

  return {
    eligible: true,
    points: input.points,
    tier,
    amortYears,
    maxLoanByLtv: Math.round(maxLoanByLtv),
    maxLoanByDscr: Math.round(maxLoanByDscr),
    maxLoan: Math.round(maxLoan),
    bindingConstraint,
    actualLtv: round3(actualLtv),
    actualDscr: round3(actualDscr),
    premiumPct,
    premiumDollars: Math.round(maxLoan * (premiumPct / 100)),
    annualDebtService: Math.round(annualDebtService),
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
