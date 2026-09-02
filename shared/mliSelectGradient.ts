/**
 * CMHC MLI Select estimate gradient (pure, unit-tested).
 *
 * The single-point takeout (computeMliTakeout) answers "what is the max loan at
 * my points?". A buyer choosing commitments wants the whole surface: for each
 * points tier (0 / 50 / 70 / 100) and each LTV step, does the debt service
 * still clear CMHC's 1.10x DSCR floor, and what does the premium cost? Rows are
 * tiers, columns are LTV; each cell is coloured by where DSCR holds.
 *
 * Uses the same premium schedule and payment math as shared/mliSelect.ts so
 * the gradient always agrees with the takeout card.
 */

import {
  MLI_SELECT_RULES,
  paymentFactorMonthly,
  tierForPoints,
  totalPremiumPct,
} from "./mliSelect";

export type GradientCellStatus = "strong" | "ok" | "fails" | "not_allowed";

export interface GradientCell {
  ltv: number;
  allowed: boolean;
  loan: number;
  annualDebtService: number;
  dscr: number;
  premiumPct: number;
  premiumDollars: number;
  cashEquity: number;
  status: GradientCellStatus;
}

export interface GradientRow {
  points: number;
  tier: { minPoints: number; premiumDiscount: number; maxLtv: number; maxAmortYears: number } | null;
  label: string;
  maxLtv: number;
  maxAmortYears: number;
  cells: GradientCell[];
}

export interface GradientBestCell extends GradientCell {
  points: number;
  amortYears: number;
}

export interface MliSelectGradient {
  eligible: boolean;
  units: number;
  noi: number;
  lendingValue: number;
  interestRate: number;
  purpose: "construction" | "other";
  ltvSteps: number[];
  rows: GradientRow[];
  bestCell: GradientBestCell | null;
  notes: string[];
}

export interface MliSelectGradientInput {
  units: number;
  /** Stabilized NOI, annual dollars. */
  noi: number;
  /** Lending value the LTV is applied to. */
  lendingValue: number;
  interestRate: number;
  purpose: "construction" | "other";
  ltvSteps?: number[];
  /** Points tiers to model as rows. */
  tiers?: number[];
}

export const DEFAULT_LTV_STEPS = [0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95];
export const DEFAULT_POINT_TIERS = [0, 50, 70, 100];

/** DSCR at/above this reads as comfortable headroom, not just clearing the floor. */
export const STRONG_DSCR = 1.25;

export const TIER_LABELS: Record<number, string> = {
  0: "No MLI Select points",
  50: "50 pts — 10% premium discount",
  70: "70 pts — 20% premium discount",
  100: "100 pts — 30% premium discount",
};

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function cellStatus(allowed: boolean, dscr: number): GradientCellStatus {
  if (!allowed) return "not_allowed";
  if (dscr >= STRONG_DSCR) return "strong";
  if (dscr >= MLI_SELECT_RULES.minDscr) return "ok";
  return "fails";
}

export function buildMliSelectGradient(input: MliSelectGradientInput): MliSelectGradient {
  const ltvSteps = (input.ltvSteps ?? DEFAULT_LTV_STEPS).slice().sort((a, b) => a - b);
  const pointTiers = (input.tiers ?? DEFAULT_POINT_TIERS).slice().sort((a, b) => a - b);
  const notes: string[] = [];
  const base = {
    units: input.units,
    noi: input.noi,
    lendingValue: input.lendingValue,
    interestRate: input.interestRate,
    purpose: input.purpose,
    ltvSteps,
  };

  if (input.units < MLI_SELECT_RULES.minUnits) {
    notes.push(
      `MLI Select requires ${MLI_SELECT_RULES.minUnits}+ residential units — this configuration has ${input.units}. A 5-6 unit configuration (where the ward allows) or conventional financing is the alternative.`,
    );
    return { ...base, eligible: false, rows: [], bestCell: null, notes };
  }
  if (!(input.lendingValue > 0) || !(input.noi > 0)) {
    notes.push("No positive NOI or lending value to size a loan against — the gradient cannot be computed.");
    return { ...base, eligible: true, rows: [], bestCell: null, notes };
  }

  const rows: GradientRow[] = pointTiers.map((points) => {
    const tier = tierForPoints(points);
    const maxLtv = tier?.maxLtv ?? 0;
    const maxAmortYears = tier?.maxAmortYears ?? MLI_SELECT_RULES.baseAmortizationYears;
    const pf = paymentFactorMonthly(input.interestRate, maxAmortYears);

    const cells: GradientCell[] = ltvSteps.map((ltv) => {
      const allowed = tier != null && ltv <= maxLtv + 1e-9;
      const loan = input.lendingValue * ltv;
      const annualDebtService = loan * pf * 12;
      const dscr = annualDebtService > 0 ? input.noi / annualDebtService : 0;
      const premiumPct = totalPremiumPct({ ltv, amortYears: maxAmortYears, purpose: input.purpose, points });
      return {
        ltv,
        allowed,
        loan: Math.round(loan),
        annualDebtService: Math.round(annualDebtService),
        dscr: round3(dscr),
        premiumPct,
        premiumDollars: Math.round(loan * (premiumPct / 100)),
        cashEquity: Math.round(input.lendingValue - loan),
        status: cellStatus(allowed, dscr),
      };
    });

    return {
      points,
      tier: tier ? { ...tier } : null,
      label: TIER_LABELS[points] ?? `${points} pts`,
      maxLtv,
      maxAmortYears,
      cells,
    };
  });

  // Best cell: the highest LTV that clears the DSCR floor; ties go to the
  // higher points tier (cheaper premium, longer amortization).
  let bestCell: GradientBestCell | null = null;
  for (const row of rows) {
    for (const cell of row.cells) {
      if (!cell.allowed || cell.dscr < MLI_SELECT_RULES.minDscr) continue;
      if (!bestCell || cell.ltv > bestCell.ltv + 1e-9 || (Math.abs(cell.ltv - bestCell.ltv) < 1e-9 && row.points > bestCell.points)) {
        bestCell = { ...cell, points: row.points, amortYears: row.maxAmortYears };
      }
    }
  }

  // Where DSCR, not LTV, is the binding constraint, say so per tier.
  for (const row of rows) {
    if (!row.tier) continue;
    const allowed = row.cells.filter((c) => c.allowed);
    const clearing = allowed.filter((c) => c.dscr >= MLI_SELECT_RULES.minDscr);
    if (allowed.length === 0) continue;
    if (clearing.length === 0) {
      notes.push(`At ${row.points} points no LTV step clears the ${MLI_SELECT_RULES.minDscr.toFixed(2)}x DSCR floor — rents or NOI must rise before MLI Select works here.`);
    } else if (clearing.length < allowed.length) {
      const top = clearing[clearing.length - 1];
      notes.push(
        `At ${row.points} points DSCR is the binding constraint: coverage holds to ${Math.round(top.ltv * 100)}% LTV, below the ${Math.round(row.maxLtv * 100)}% the tier allows.`,
      );
    }
  }
  if (rows.some((r) => r.points < MLI_SELECT_RULES.tiers[MLI_SELECT_RULES.tiers.length - 1].minPoints)) {
    notes.push("Below 50 points the MLI Select flexibilities (higher LTV, 40-50 year amortization, premium discounts) do not apply.");
  }
  if (bestCell) {
    notes.push(
      `Best case: ${bestCell.points} points supports ${Math.round(bestCell.ltv * 100)}% LTV — a ${fmtMoney(bestCell.loan)} loan over ${bestCell.amortYears} years at DSCR ${bestCell.dscr.toFixed(2)}x; premium ≈ ${bestCell.premiumPct.toFixed(2)}% (${fmtMoney(bestCell.premiumDollars)}).`,
    );
  }

  return { ...base, eligible: true, rows, bestCell, notes };
}

function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString("en-CA")}`;
}
