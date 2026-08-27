import { paymentFactorMonthly } from "./mliSelect";

/**
 * A deliberately conservative screen for CMHC's 2–4 unit small-rental lane.
 *
 * Unlike MLI Select, qualification for a small rental mortgage depends on the
 * borrower's income, debts, credit, property use, and lender underwriting. The
 * product therefore reports an indicative 80% LTV ceiling and debt coverage;
 * it never calls that amount an approval or a CMHC commitment.
 */
export const SMALL_RENTAL_SCREEN_RULES = {
  source: "CMHC Homeowner and Small Rental Mortgage Loan Insurance (1–4 units)",
  sourceUrl:
    "https://www.cmhc-schl.gc.ca/professionals/project-funding-and-mortgage-financing/mortgage-loan-insurance/mortgage-loan-insurance-homeownership-programs",
  lastVerified: "2026-08",
  minUnits: 2,
  maxUnits: 4,
  maxLtv: 0.8,
  amortYears: 25,
} as const;

export interface SmallRentalMortgageInput {
  units: number;
  lendingValue: number;
  noi: number;
  interestRate: number;
  maxLtv?: number;
  amortYears?: number;
}

export interface SmallRentalMortgageResult {
  program: "cmhc_small_rental_screen";
  eligible: boolean;
  reason?: string;
  units: number;
  maxLtv: number;
  amortYears: number;
  indicativeLoan: number;
  indicativeEquity: number;
  annualDebtService: number;
  noiCoverageRatio: number | null;
  source: string;
  sourceUrl: string;
  qualificationNote: string;
}

export function computeSmallRentalMortgageScreen(
  input: SmallRentalMortgageInput,
): SmallRentalMortgageResult {
  const maxLtv = Math.min(Math.max(input.maxLtv ?? SMALL_RENTAL_SCREEN_RULES.maxLtv, 0), 1);
  const amortYears = Math.max(1, Math.round(input.amortYears ?? SMALL_RENTAL_SCREEN_RULES.amortYears));
  const base = {
    program: "cmhc_small_rental_screen" as const,
    units: input.units,
    maxLtv,
    amortYears,
    indicativeLoan: 0,
    indicativeEquity: Math.max(0, Math.round(input.lendingValue)),
    annualDebtService: 0,
    noiCoverageRatio: null,
    source: SMALL_RENTAL_SCREEN_RULES.source,
    sourceUrl: SMALL_RENTAL_SCREEN_RULES.sourceUrl,
    qualificationNote:
      "Indicative screen only. A lender must qualify the borrower and property; personal income, debts, credit, occupancy, appraisal, and final CMHC terms are not modelled.",
  };

  if (input.units < SMALL_RENTAL_SCREEN_RULES.minUnits) {
    return {
      ...base,
      eligible: false,
      reason: "The small-rental screen applies to non-owner-occupied properties with 2–4 units.",
    };
  }
  if (input.units > SMALL_RENTAL_SCREEN_RULES.maxUnits) {
    return {
      ...base,
      eligible: false,
      reason: "Properties with 5+ units belong in CMHC's multi-unit insurance lane, including MLI Select.",
    };
  }

  const lendingValue = Math.max(0, input.lendingValue);
  const indicativeLoan = lendingValue * maxLtv;
  const annualDebtService = indicativeLoan
    * paymentFactorMonthly(Math.max(0, input.interestRate), amortYears)
    * 12;

  return {
    ...base,
    eligible: true,
    indicativeLoan: Math.round(indicativeLoan),
    indicativeEquity: Math.round(lendingValue - indicativeLoan),
    annualDebtService: Math.round(annualDebtService),
    noiCoverageRatio: annualDebtService > 0
      ? Math.round((Math.max(0, input.noi) / annualDebtService) * 1000) / 1000
      : null,
  };
}
