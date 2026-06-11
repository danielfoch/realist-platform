export interface ScoringInput {
  dealSubmitted?: boolean;
  dealDeskCtaClicked?: boolean;
  reportExported?: boolean;
  dealSaved?: boolean;
  financingChanged?: boolean;
  returnThresholdHit?: boolean;
  repeatMarketSearches?: boolean;
  phoneProvided?: boolean;
  financingHelpWanted?: boolean;
  buyingHelpWanted?: boolean;
}

export interface LeadScoreResult {
  intentScore: number;
  status: "hot" | "warm" | "nurture" | "audience";
  suggestedNextAction: string;
  breakdown: Array<{ factor: string; points: number }>;
}

const WEIGHTS: Record<string, number> = {
  deal_submitted: 40,
  deal_desk_cta_clicked: 20,
  report_exported: 15,
  deal_saved: 15,
  financing_changed: 10,
  return_threshold_hit: 20,
  repeat_market_searches: 10,
  phone_provided: 10,
  financing_help_wanted: 15,
  buying_help_wanted: 15,
};

export function scoreLeadInput(input: ScoringInput): LeadScoreResult {
  const breakdown: Array<{ factor: string; points: number }> = [];
  let total = 0;

  function add(factor: string, condition: boolean) {
    if (condition) {
      const points = WEIGHTS[factor] ?? 0;
      breakdown.push({ factor, points });
      total += points;
    }
  }

  add("deal_submitted", !!input.dealSubmitted);
  add("deal_desk_cta_clicked", !!input.dealDeskCtaClicked);
  add("report_exported", !!input.reportExported);
  add("deal_saved", !!input.dealSaved);
  add("financing_changed", !!input.financingChanged);
  add("return_threshold_hit", !!input.returnThresholdHit);
  add("repeat_market_searches", !!input.repeatMarketSearches);
  add("phone_provided", !!input.phoneProvided);
  add("financing_help_wanted", !!input.financingHelpWanted);
  add("buying_help_wanted", !!input.buyingHelpWanted);

  const intentScore = total;
  const { status, suggestedNextAction } = scoreToStatusAndAction(intentScore);

  return {
    intentScore,
    status,
    suggestedNextAction,
    breakdown: breakdown.filter(b => b.points > 0),
  };
}

export function scoreToStatusAndAction(intentScore: number): {
  status: "hot" | "warm" | "nurture" | "audience";
  suggestedNextAction: string;
} {
  if (intentScore >= 80) {
    return { status: "hot", suggestedNextAction: "Call within 5 minutes" };
  }
  if (intentScore >= 50) {
    return { status: "warm", suggestedNextAction: "Email/SMS/call within 24 hours" };
  }
  if (intentScore >= 20) {
    return { status: "nurture", suggestedNextAction: "Send market/deal education sequence" };
  }
  return { status: "audience", suggestedNextAction: "Newsletter/retargeting only" };
}

export function selectEmailTriggers(
  status: "hot" | "warm" | "nurture" | "audience",
  financingHelpWanted: boolean,
): string[] {
  const triggers: string[] = ["deal_submitted_confirmation"];
  if (status === "hot") triggers.push("hot_lead_immediate_followup");
  if (status === "warm") triggers.push("warm_lead_24h_followup");
  if (status === "warm" || status === "nurture") triggers.push("warm_lead_user_nudge");
  if (financingHelpWanted) triggers.push("financing_interest_followup");
  return triggers;
}
