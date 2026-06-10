/**
 * Deal Desk scoring + underwriting engine.
 *
 * Lead intent scoring, deal scoring, and the deterministic underwriting
 * model for long-term rentals. All scorers are pure: events/metrics in,
 * score out. The LLM layer narrates these numbers; it never produces them.
 *
 * Ported verbatim from the idx app (src/scoring.ts + src/underwriting.ts +
 * src/investment-metrics.ts). The only adaptation: event deal ids are
 * strings in the live app (UUID analysis ids), so `deal_id` accepts both.
 */

// ---------- Intent scoring ----------

export interface ScorableEvent {
  event: string;
  created_at: Date | string;
  deal_id?: number | string | null;
}

export interface IntentProfile {
  hasPhone?: boolean;
  financingHelp?: boolean;
  buyingHelp?: boolean;
}

export type IntentBand = "hot" | "warm" | "nurture" | "audience";

const EVENT_WEIGHTS: Record<string, number> = {
  deal_submitted: 40,
  buyer_rep_requested: 40,
  referral_requested: 40,
  deal_desk_cta_clicked: 20,
  return_threshold_hit: 20,
  report_exported: 15,
  deal_saved: 15,
  call_booked: 15,
  financing_changed: 10,
  market_researched: 0, // scored via repeat-search bonus below
  deal_rejected: 5,     // rejection is engagement + buy-box signal
  model_run: 2,
  assumption_edited: 5, // capped per deal below
};

const ASSUMPTION_EDIT_CAP_PER_DEAL = 20;
const REPEAT_SEARCH_THRESHOLD = 3;
const REPEAT_SEARCH_BONUS = 10;
const WEEKLY_DECAY = 0.9;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function decayFactor(createdAt: Date | string, now: Date): number {
  const ts = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
  if (Number.isNaN(ts)) return 1;
  const weeks = Math.max(0, (now.getTime() - ts) / MS_PER_WEEK);
  return Math.pow(WEEKLY_DECAY, weeks);
}

export function computeIntentScore(
  events: ScorableEvent[],
  profile: IntentProfile = {},
  now: Date = new Date(),
): number {
  let score = 0;
  let marketSearches = 0;
  const assumptionPointsByDeal = new Map<number | string, number>();

  for (const e of events) {
    const decay = decayFactor(e.created_at, now);

    if (e.event === "market_researched") {
      marketSearches += 1;
      continue;
    }

    if (e.event === "assumption_edited") {
      const dealKey = e.deal_id ?? "no_deal";
      const accrued = assumptionPointsByDeal.get(dealKey) ?? 0;
      const weight = EVENT_WEIGHTS.assumption_edited;
      const allowed = Math.min(weight, ASSUMPTION_EDIT_CAP_PER_DEAL - accrued);
      if (allowed > 0) {
        assumptionPointsByDeal.set(dealKey, accrued + allowed);
        score += allowed * decay;
      }
      continue;
    }

    const weight = EVENT_WEIGHTS[e.event];
    if (weight) score += weight * decay;
  }

  if (marketSearches >= REPEAT_SEARCH_THRESHOLD) score += REPEAT_SEARCH_BONUS;

  // Profile bonuses don't decay — they're facts, not actions
  if (profile.hasPhone) score += 10;
  if (profile.financingHelp) score += 15;
  if (profile.buyingHelp) score += 15;

  return Math.round(score);
}

export function intentBand(score: number): IntentBand {
  if (score >= 80) return "hot";
  if (score >= 50) return "warm";
  if (score >= 20) return "nurture";
  return "audience";
}

export function suggestedNextAction(band: IntentBand): string {
  switch (band) {
    case "hot":
      return "Call within 5 minutes";
    case "warm":
      return "Email/SMS/call within 24 hours";
    case "nurture":
      return "Send market/deal education sequence";
    case "audience":
      return "Newsletter/retargeting only";
  }
}

// ---------- Deal scoring ----------

export interface DealScoreInput {
  /** Monthly cash flow after debt service, dollars */
  cashFlowMonthly?: number | null;
  /** Debt service coverage ratio (NOI / annual debt service) */
  dscr?: number | null;
  /** Cap rate, percent (e.g. 5.2) */
  capRate?: number | null;
  /** Median cap rate for the same city from our own listings, percent */
  cityMedianCapRate?: number | null;
  /** Asking price */
  askingPrice?: number | null;
  /** Engine-computed max offer price */
  maxOfferPrice?: number | null;
  /** Where the rent number came from */
  rentSource?: "default" | "user_edited" | "comp_derived" | null;
  /** Active listing count in the market — liquidity proxy */
  marketListingCount?: number | null;
}

export type DealVerdict = "submit" | "negotiate" | "watch" | "pass";

export function computeDealScore(input: DealScoreInput): number {
  let score = 50; // start neutral; evidence moves it

  const { cashFlowMonthly, dscr, capRate, cityMedianCapRate, askingPrice, maxOfferPrice, rentSource, marketListingCount } = input;

  if (typeof cashFlowMonthly === "number") {
    if (cashFlowMonthly >= 200) score += 25;
    else if (cashFlowMonthly >= 0) score += 15;
    else score -= 20;
  }

  if (typeof dscr === "number") {
    if (dscr >= 1.2) score += 20;
    else if (dscr >= 1.0) score += 10;
    else score -= 15;
  }

  if (typeof capRate === "number" && typeof cityMedianCapRate === "number" && cityMedianCapRate > 0) {
    if (capRate > cityMedianCapRate) score += 15;
    else if (capRate >= cityMedianCapRate * 0.95) score += 8;
  }

  if (typeof askingPrice === "number" && typeof maxOfferPrice === "number" && askingPrice > 0 && maxOfferPrice > 0) {
    const ratio = askingPrice / maxOfferPrice;
    if (ratio <= 1.0) score += 15;
    else if (ratio <= 1.05) score += 8;
    else if (ratio > 1.1) score -= 10;
  }

  if (rentSource === "user_edited" || rentSource === "comp_derived") score += 10;
  else if (rentSource === "default") score -= 5;

  if (typeof marketListingCount === "number" && marketListingCount >= 50) score += 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function dealVerdict(score: number): DealVerdict {
  if (score >= 75) return "submit";
  if (score >= 50) return "negotiate";
  if (score >= 25) return "watch";
  return "pass";
}

// ---------- Underwriting engine ----------
// Deterministic financial model for long-term rentals: DSCR, total cash
// required, max offer price, break-even rent, and a sensitivity grid.

export interface UnderwritingInput {
  listPrice: number;
  monthlyRent: number;
  maintenanceFee?: number;
  noiRatio?: number;          // share of rent that becomes NOI (default 0.6)
  downPaymentRatio?: number;  // default 0.2
  annualInterestRate?: number; // default 0.05
  amortizationYears?: number; // default 25
  closingCostRatio?: number;  // default 0.015 (land transfer varies by province)
}

export interface SensitivityCell {
  label: string;
  cashFlowMonthly: number;
  dscr: number;
}

export interface UnderwritingOutput {
  capRate: number;
  grossYield: number;
  cashFlowMonthly: number;
  dscr: number;
  monthlyMortgage: number;
  downPayment: number;
  closingCosts: number;
  cashRequired: number;
  /** Highest price at which DSCR >= 1.2 AND monthly cash flow >= 0. Null if unreachable. */
  maxOfferPrice: number | null;
  breakEvenRent: number;
  sensitivity: SensitivityCell[];
}

const TARGET_DSCR = 1.2;

function round2(value: number): number {
  return Number.parseFloat(value.toFixed(2));
}

function monthlyMortgagePayment(loanAmount: number, annualRate: number, years: number): number {
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return loanAmount / n;
  return (loanAmount * (r * (1 + r) ** n)) / ((1 + r) ** n - 1);
}

interface CoreNumbers {
  cashFlowMonthly: number;
  dscr: number;
  monthlyMortgage: number;
}

function core(input: Required<Omit<UnderwritingInput, "closingCostRatio" | "maintenanceFee">> & { maintenanceFee: number }): CoreNumbers {
  const { listPrice, monthlyRent, maintenanceFee, noiRatio, downPaymentRatio, annualInterestRate, amortizationYears } = input;

  const annualRent = monthlyRent * 12;
  const noi = annualRent * noiRatio - maintenanceFee * 12;
  const loanAmount = listPrice * (1 - downPaymentRatio);
  const monthlyMortgage = monthlyMortgagePayment(loanAmount, annualInterestRate, amortizationYears);
  const annualDebtService = monthlyMortgage * 12;

  const operatingExpensesMonthly = (annualRent - annualRent * noiRatio) / 12 + maintenanceFee;
  const cashFlowMonthly = monthlyRent - operatingExpensesMonthly - monthlyMortgage;
  const dscr = annualDebtService > 0 ? noi / annualDebtService : Infinity;

  return { cashFlowMonthly, dscr, monthlyMortgage };
}

export function computeUnderwriting(input: UnderwritingInput): UnderwritingOutput {
  const {
    listPrice,
    monthlyRent,
    maintenanceFee = 0,
    noiRatio = 0.6,
    downPaymentRatio = 0.2,
    annualInterestRate = 0.05,
    amortizationYears = 25,
    closingCostRatio = 0.015,
  } = input;

  if (listPrice <= 0 || monthlyRent <= 0) {
    throw new Error("listPrice and monthlyRent must be greater than 0");
  }

  const base = { listPrice, monthlyRent, maintenanceFee, noiRatio, downPaymentRatio, annualInterestRate, amortizationYears };
  const { cashFlowMonthly, dscr, monthlyMortgage } = core(base);

  // Cap rate / gross yield — same arithmetic as the idx metrics engine
  const annualRent = monthlyRent * 12;
  const noi = annualRent * noiRatio;
  const capRate = (noi / listPrice) * 100;
  const grossYield = (annualRent / listPrice) * 100;

  const downPayment = listPrice * downPaymentRatio;
  const closingCosts = listPrice * closingCostRatio;

  // Max offer: binary-search the highest price meeting DSCR >= 1.2 and CF >= 0
  const meets = (price: number): boolean => {
    const c = core({ ...base, listPrice: price });
    return c.dscr >= TARGET_DSCR && c.cashFlowMonthly >= 0;
  };

  let maxOfferPrice: number | null = null;
  let lo = 1;
  let hi = listPrice * 2;
  if (meets(lo)) {
    while (meets(hi)) hi *= 2; // rent supports more than 2x asking — expand
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (meets(mid)) lo = mid;
      else hi = mid;
    }
    maxOfferPrice = Math.round(lo);
  }

  // Break-even rent: solve monthlyRent for cash flow == 0 at asking price.
  // CF = rent*noiRatio - maintenanceFee - mortgage  =>  rent = (mortgage + fee) / noiRatio
  const breakEvenRent = (monthlyMortgage + maintenanceFee) / noiRatio;

  const scenario = (label: string, overrides: Partial<typeof base>): SensitivityCell => {
    const c = core({ ...base, ...overrides });
    return { label, cashFlowMonthly: round2(c.cashFlowMonthly), dscr: round2(c.dscr) };
  };

  const sensitivity: SensitivityCell[] = [
    scenario("base", {}),
    scenario("rent -10%", { monthlyRent: monthlyRent * 0.9 }),
    scenario("rent +10%", { monthlyRent: monthlyRent * 1.1 }),
    scenario("rate +1%", { annualInterestRate: annualInterestRate + 0.01 }),
    scenario("rate -1%", { annualInterestRate: Math.max(0.001, annualInterestRate - 0.01) }),
    scenario("expenses +25%", { noiRatio: Math.max(0.05, 1 - (1 - noiRatio) * 1.25) }),
  ];

  return {
    capRate: round2(capRate),
    grossYield: round2(grossYield),
    cashFlowMonthly: round2(cashFlowMonthly),
    dscr: round2(dscr),
    monthlyMortgage: round2(monthlyMortgage),
    downPayment: round2(downPayment),
    closingCosts: round2(closingCosts),
    cashRequired: round2(downPayment + closingCosts),
    maxOfferPrice,
    breakEvenRent: round2(breakEvenRent),
    sensitivity,
  };
}
