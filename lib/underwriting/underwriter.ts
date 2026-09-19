/**
 * The underwriter's model: the inputs a person edits, where their starting
 * values come from, and what we say back. Pure — it runs in the browser on
 * every keystroke and on the server when an analysis is logged, through the one
 * engine in investmentMetrics.ts.
 */

import {
  INVESTMENT_METRIC_DEFAULTS,
  calculateInvestmentMetrics,
  type CalculatedInvestmentMetrics,
  type InvestmentMetricAssumptions,
} from "./investmentMetrics";

export interface UnderwriterInputs {
  price: number;
  /** Total monthly rent, all units. */
  monthlyRent: number;
  units: number;
  downPaymentPercent: number;
  interestRate: number;
  amortizationYears: number;
  vacancyPercent: number;
  managementPercent: number;
  maintenancePercent: number;
  annualPropertyTax: number;
  annualInsurance: number;
  monthlyCondoFees: number;
  /** Owner-paid utilities. */
  monthlyUtilities: number;
  closingCosts: number;
  holdPeriodYears: number;
  annualAppreciationPercent: number;
  annualRentGrowthPercent: number;
  sellingCostPercent: number;
}

export type UnderwriterField = keyof UnderwriterInputs;

/** What we know about a property before anyone types anything. */
export interface DealFacts {
  price: number;
  units?: number | null;
  /** Best available rent: actual, comps, or CMHC — see underwriteListing.ts. */
  monthlyRent?: number | null;
  annualPropertyTax?: number | null;
  monthlyCondoFees?: number | null;
}

/** A market's learned value for one field, and how much evidence is behind it. */
export interface LearnedValue {
  value: number;
  sampleSize: number;
  /** "Hamilton" / "Ontario" / "Canada" — what the median was taken over. */
  scopeLabel: string;
}

/**
 * Fields the community's edits can teach. Only ratios and financing terms:
 * dollar amounts (rent, tax, price) belong to a property, not to a market.
 */
export const LEARNABLE_FIELDS = [
  "vacancyPercent",
  "managementPercent",
  "maintenancePercent",
  "downPaymentPercent",
  "interestRate",
  "amortizationYears",
  "annualAppreciationPercent",
  "annualRentGrowthPercent",
] as const satisfies readonly UnderwriterField[];
export type LearnableField = (typeof LEARNABLE_FIELDS)[number];
export type LearnedDefaults = Partial<Record<LearnableField, LearnedValue>>;

/** Sane edges for each learnable field — a median outside them is noise, not knowledge. */
export const LEARNABLE_BOUNDS: Record<LearnableField, [number, number]> = {
  vacancyPercent: [0, 20],
  managementPercent: [0, 15],
  maintenancePercent: [0, 20],
  downPaymentPercent: [5, 100],
  interestRate: [1, 12],
  amortizationYears: [10, 50],
  annualAppreciationPercent: [-5, 10],
  annualRentGrowthPercent: [-5, 10],
};

export function houseDefaults(facts: DealFacts, learned: LearnedDefaults = {}): UnderwriterInputs {
  const price = Math.max(0, facts.price || 0);
  const units = Math.max(1, Math.round(facts.units || 1));
  const learnedValue = (field: LearnableField, fallback: number) => learned[field]?.value ?? fallback;
  return {
    price,
    monthlyRent: Math.max(0, Math.round(facts.monthlyRent || 0)),
    units,
    downPaymentPercent: learnedValue("downPaymentPercent", 20),
    interestRate: learnedValue("interestRate", 5.5),
    amortizationYears: learnedValue("amortizationYears", 25),
    vacancyPercent: learnedValue("vacancyPercent", INVESTMENT_METRIC_DEFAULTS.DEFAULT_VACANCY_PERCENT),
    managementPercent: learnedValue("managementPercent", INVESTMENT_METRIC_DEFAULTS.DEFAULT_MANAGEMENT_PERCENT),
    maintenancePercent: learnedValue("maintenancePercent", INVESTMENT_METRIC_DEFAULTS.DEFAULT_MAINTENANCE_PERCENT),
    annualPropertyTax: Math.round(
      facts.annualPropertyTax && facts.annualPropertyTax > 0
        ? facts.annualPropertyTax
        : price * (INVESTMENT_METRIC_DEFAULTS.DEFAULT_PROPERTY_TAX_PERCENT / 100),
    ),
    // Same proxy the listing pre-underwrite uses, so a card and its underwriter open on the same numbers.
    annualInsurance: Math.round(price * 0.003),
    monthlyCondoFees: Math.max(0, Math.round(facts.monthlyCondoFees || 0)),
    monthlyUtilities: 0,
    closingCosts: Math.round(price * (INVESTMENT_METRIC_DEFAULTS.DEFAULT_CLOSING_COST_PERCENT / 100)),
    holdPeriodYears: INVESTMENT_METRIC_DEFAULTS.DEFAULT_HOLD_PERIOD_YEARS,
    annualAppreciationPercent: learnedValue("annualAppreciationPercent", INVESTMENT_METRIC_DEFAULTS.DEFAULT_APPRECIATION_PERCENT),
    annualRentGrowthPercent: learnedValue("annualRentGrowthPercent", INVESTMENT_METRIC_DEFAULTS.DEFAULT_RENT_GROWTH_PERCENT),
    sellingCostPercent: INVESTMENT_METRIC_DEFAULTS.DEFAULT_SELLING_COST_PERCENT,
  };
}

function toEngine(inputs: UnderwriterInputs): InvestmentMetricAssumptions {
  return {
    monthlyRent: inputs.monthlyRent,
    unitCount: inputs.units,
    vacancyPercent: inputs.vacancyPercent,
    maintenancePercent: inputs.maintenancePercent,
    managementPercent: inputs.managementPercent,
    annualPropertyTax: inputs.annualPropertyTax,
    annualInsurance: inputs.annualInsurance,
    annualCondoFees: inputs.monthlyCondoFees * 12,
    annualUtilities: inputs.monthlyUtilities * 12,
    downPaymentPercent: inputs.downPaymentPercent,
    interestRate: inputs.interestRate,
    amortizationYears: inputs.amortizationYears,
    holdPeriodYears: inputs.holdPeriodYears,
    annualAppreciationPercent: inputs.annualAppreciationPercent,
    annualRentGrowthPercent: inputs.annualRentGrowthPercent,
    sellingCostPercent: inputs.sellingCostPercent,
    closingCosts: inputs.closingCosts,
  };
}

export function underwrite(inputs: UnderwriterInputs): CalculatedInvestmentMetrics {
  return calculateInvestmentMetrics(inputs.price, toEngine(inputs));
}

/** Which fields a person actually changed from what they were offered. */
export function editedFields(defaults: UnderwriterInputs, inputs: UnderwriterInputs): UnderwriterField[] {
  return (Object.keys(defaults) as UnderwriterField[]).filter((field) => {
    const before = defaults[field];
    const after = inputs[field];
    return Math.abs(after - before) > Math.max(1e-9, Math.abs(before) * 1e-6);
  });
}

// ─── The offer-price solver ──────────────────────────────────────────────────

export type OfferTarget =
  | { metric: "cash_flow"; value: number } // dollars a month
  | { metric: "cash_on_cash"; value: number } // percent
  | { metric: "cap_rate"; value: number } // percent
  | { metric: "dscr"; value: number }; // ratio

function metricFor(target: OfferTarget, result: CalculatedInvestmentMetrics): number | null {
  switch (target.metric) {
    case "cash_flow":
      return result.monthlyCashFlow;
    case "cash_on_cash":
      return result.cashOnCashReturn;
    case "cap_rate":
      return result.capRate;
    case "dscr":
      return result.dscr;
  }
}

/** Price-linked defaults move with the price being tested; typed values stay put. */
function atPrice(inputs: UnderwriterInputs, price: number): UnderwriterInputs {
  const ratio = inputs.price > 0 ? price / inputs.price : 1;
  return { ...inputs, price, closingCosts: inputs.closingCosts * ratio, annualInsurance: inputs.annualInsurance * ratio };
}

/**
 * The highest price at which the deal still meets the target, holding rent and
 * operating assumptions fixed. Every target improves as price falls, so this
 * is a bisection. Null when no price in range gets there (the rent simply
 * doesn't support it) — which is an answer too.
 */
export function solveOfferPrice(inputs: UnderwriterInputs, target: OfferTarget): number | null {
  if (!(inputs.price > 0) || !(inputs.monthlyRent > 0)) return null;
  const meets = (price: number) => {
    const value = metricFor(target, underwrite(atPrice(inputs, price)));
    return value != null && value >= target.value;
  };
  let low = inputs.price * 0.05;
  let high = inputs.price * 3;
  if (!meets(low)) return null;
  if (meets(high)) return Math.round(high);
  for (let i = 0; i < 60 && high - low > 50; i += 1) {
    const mid = (low + high) / 2;
    if (meets(mid)) low = mid;
    else high = mid;
  }
  return Math.floor(low / 100) * 100;
}

// ─── What we say back ────────────────────────────────────────────────────────

export interface Verdict {
  tone: "good" | "neutral" | "bad";
  headline: string;
  detail: string;
}

/** A deterministic, numbers-only read of the deal. No model involved: it can't hallucinate. */
export function readTheDeal(result: CalculatedInvestmentMetrics): Verdict {
  const cashFlow = result.monthlyCashFlow;
  const dscr = result.dscr;
  if (cashFlow == null || !result.assumptionsComplete) {
    return { tone: "neutral", headline: "Add a price and a rent to see the deal.", detail: "Everything else has a sensible starting value you can change." };
  }
  const monthly = `$${Math.abs(Math.round(cashFlow)).toLocaleString("en-CA")}/mo`;
  if (cashFlow >= 0 && (dscr ?? 0) >= 1.2) {
    return {
      tone: "good",
      headline: `Pays for itself: +${monthly} after the mortgage.`,
      detail: `Debt coverage of ${dscr?.toFixed(2)} clears the 1.20 most lenders want on a rental.`,
    };
  }
  if (cashFlow >= 0) {
    return {
      tone: "neutral",
      headline: `Thin but positive: +${monthly}.`,
      detail: `Debt coverage of ${dscr?.toFixed(2)} is under the 1.20 lenders like — one vacancy or a rate reset turns this negative.`,
    };
  }
  return {
    tone: "bad",
    headline: `You'd feed it ${monthly}.`,
    detail:
      dscr != null && dscr < 1
        ? `Rent covers ${Math.round(dscr * 100)}% of the mortgage at these terms. It works with a lower price, more down, or a plan to raise the rent.`
        : "The rent covers the mortgage but not the costs of owning it. Price, down payment, or rent has to move.",
  };
}

// ─── Quality: what counts toward the leaderboard and the learning set ───────

export interface AnalysisQuality {
  /** 0..1 */
  score: number;
  /** Counts on the leaderboard and teaches market defaults. */
  eligible: boolean;
}

/**
 * Volume is easy to fake; a plausible, worked analysis is not. An analysis is
 * eligible when it is complete and its numbers fall inside what real rentals
 * produce; its score rises with how much of it the person actually worked.
 */
export function analysisQuality(result: CalculatedInvestmentMetrics, edited: readonly string[]): AnalysisQuality {
  const complete = result.assumptionsComplete;
  const within = (value: number | null, low: number, high: number) => value != null && value >= low && value <= high;
  const plausible = within(result.capRate, -10, 25) && within(result.cashOnCashReturn, -50, 60) && within(result.dscr, 0, 4);
  const depth = edited.length === 0 ? 0.4 : edited.length <= 2 ? 0.7 : 1;
  const score = (complete ? 0.2 : 0) + (plausible ? 0.5 : 0) + 0.3 * depth;
  return { score: Math.round(score * 100) / 100, eligible: complete && plausible };
}

/** Bounds a saved analysis must respect — the API rejects anything outside them. */
export const INPUT_LIMITS: Record<UnderwriterField, [number, number]> = {
  price: [1_000, 500_000_000],
  monthlyRent: [0, 5_000_000],
  units: [1, 2000],
  downPaymentPercent: [0, 100],
  interestRate: [0, 25],
  amortizationYears: [1, 50],
  vacancyPercent: [0, 100],
  managementPercent: [0, 100],
  maintenancePercent: [0, 100],
  annualPropertyTax: [0, 50_000_000],
  annualInsurance: [0, 50_000_000],
  monthlyCondoFees: [0, 1_000_000],
  monthlyUtilities: [0, 1_000_000],
  closingCosts: [0, 100_000_000],
  holdPeriodYears: [1, 40],
  annualAppreciationPercent: [-20, 30],
  annualRentGrowthPercent: [-20, 30],
  sellingCostPercent: [0, 20],
};

export function clampInputs(raw: Record<string, unknown>): UnderwriterInputs | null {
  const out = {} as UnderwriterInputs;
  for (const field of Object.keys(INPUT_LIMITS) as UnderwriterField[]) {
    const value = Number(raw[field]);
    if (!isFinite(value)) return null;
    const [low, high] = INPUT_LIMITS[field];
    if (value < low || value > high) return null;
    out[field] = value;
  }
  return out;
}
