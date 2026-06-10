/**
 * Lead intent scoring and deal scoring for the Deal Desk loop.
 *
 * Both scorers are deterministic and pure: events/metrics in, score out.
 * The LLM layer narrates these numbers; it never produces them.
 */

// ---------- Intent scoring ----------

export interface ScorableEvent {
  event: string;
  created_at: Date | string;
  deal_id?: number | null;
}

export interface IntentProfile {
  hasPhone?: boolean;
  financingHelp?: boolean;
  buyingHelp?: boolean;
}

export type IntentBand = 'hot' | 'warm' | 'nurture' | 'audience';

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

    if (e.event === 'market_researched') {
      marketSearches += 1;
      continue;
    }

    if (e.event === 'assumption_edited') {
      const dealKey = e.deal_id ?? 'no_deal';
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
  if (score >= 80) return 'hot';
  if (score >= 50) return 'warm';
  if (score >= 20) return 'nurture';
  return 'audience';
}

export function suggestedNextAction(band: IntentBand): string {
  switch (band) {
    case 'hot':
      return 'Call within 5 minutes';
    case 'warm':
      return 'Email/SMS/call within 24 hours';
    case 'nurture':
      return 'Send market/deal education sequence';
    case 'audience':
      return 'Newsletter/retargeting only';
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
  rentSource?: 'default' | 'user_edited' | 'comp_derived' | null;
  /** Active listing count in the market — liquidity proxy */
  marketListingCount?: number | null;
}

export type DealVerdict = 'submit' | 'negotiate' | 'watch' | 'pass';

export function computeDealScore(input: DealScoreInput): number {
  let score = 50; // start neutral; evidence moves it

  const { cashFlowMonthly, dscr, capRate, cityMedianCapRate, askingPrice, maxOfferPrice, rentSource, marketListingCount } = input;

  if (typeof cashFlowMonthly === 'number') {
    if (cashFlowMonthly >= 200) score += 25;
    else if (cashFlowMonthly >= 0) score += 15;
    else score -= 20;
  }

  if (typeof dscr === 'number') {
    if (dscr >= 1.2) score += 20;
    else if (dscr >= 1.0) score += 10;
    else score -= 15;
  }

  if (typeof capRate === 'number' && typeof cityMedianCapRate === 'number' && cityMedianCapRate > 0) {
    if (capRate > cityMedianCapRate) score += 15;
    else if (capRate >= cityMedianCapRate * 0.95) score += 8;
  }

  if (typeof askingPrice === 'number' && typeof maxOfferPrice === 'number' && askingPrice > 0 && maxOfferPrice > 0) {
    const ratio = askingPrice / maxOfferPrice;
    if (ratio <= 1.0) score += 15;
    else if (ratio <= 1.05) score += 8;
    else if (ratio > 1.1) score -= 10;
  }

  if (rentSource === 'user_edited' || rentSource === 'comp_derived') score += 10;
  else if (rentSource === 'default') score -= 5;

  if (typeof marketListingCount === 'number' && marketListingCount >= 50) score += 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function dealVerdict(score: number): DealVerdict {
  if (score >= 75) return 'submit';
  if (score >= 50) return 'negotiate';
  if (score >= 25) return 'watch';
  return 'pass';
}
