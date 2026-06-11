import { describe, expect, it } from "vitest";
import { scoreLeadInput, scoreToStatusAndAction, selectEmailTriggers } from "./leadScoring";

describe("scoreToStatusAndAction", () => {
  it("maps 80+ to hot with immediate call action", () => {
    const r = scoreToStatusAndAction(80);
    expect(r.status).toBe("hot");
    expect(r.suggestedNextAction).toBe("Call within 5 minutes");
  });

  it("maps 100 to hot", () => {
    expect(scoreToStatusAndAction(100).status).toBe("hot");
  });

  it("maps 79 to warm", () => {
    const r = scoreToStatusAndAction(79);
    expect(r.status).toBe("warm");
    expect(r.suggestedNextAction).toBe("Email/SMS/call within 24 hours");
  });

  it("maps 50 to warm", () => {
    expect(scoreToStatusAndAction(50).status).toBe("warm");
  });

  it("maps 49 to nurture", () => {
    const r = scoreToStatusAndAction(49);
    expect(r.status).toBe("nurture");
    expect(r.suggestedNextAction).toBe("Send market/deal education sequence");
  });

  it("maps 20 to nurture", () => {
    expect(scoreToStatusAndAction(20).status).toBe("nurture");
  });

  it("maps 19 to audience", () => {
    const r = scoreToStatusAndAction(19);
    expect(r.status).toBe("audience");
    expect(r.suggestedNextAction).toBe("Newsletter/retargeting only");
  });

  it("maps 0 to audience", () => {
    expect(scoreToStatusAndAction(0).status).toBe("audience");
  });
});

describe("scoreLeadInput", () => {
  it("scores zero for all-false input", () => {
    const r = scoreLeadInput({});
    expect(r.intentScore).toBe(0);
    expect(r.status).toBe("audience");
    expect(r.breakdown).toHaveLength(0);
  });

  it("deal_submitted alone gives 40 → nurture", () => {
    const r = scoreLeadInput({ dealSubmitted: true });
    expect(r.intentScore).toBe(40);
    expect(r.status).toBe("nurture");
  });

  it("deal_submitted + phone_provided = 50 → warm boundary", () => {
    const r = scoreLeadInput({ dealSubmitted: true, phoneProvided: true });
    expect(r.intentScore).toBe(50);
    expect(r.status).toBe("warm");
  });

  it("hot submission: deal_submitted + buying + financing + return_threshold_hit = 90", () => {
    const r = scoreLeadInput({
      dealSubmitted: true,
      buyingHelpWanted: true,
      financingHelpWanted: true,
      returnThresholdHit: true,
    });
    expect(r.intentScore).toBe(90);
    expect(r.status).toBe("hot");
  });

  it("all flags on equals all weights summed = 170", () => {
    const r = scoreLeadInput({
      dealSubmitted: true,
      dealDeskCtaClicked: true,
      reportExported: true,
      dealSaved: true,
      financingChanged: true,
      returnThresholdHit: true,
      repeatMarketSearches: true,
      phoneProvided: true,
      financingHelpWanted: true,
      buyingHelpWanted: true,
    });
    // 40+20+15+15+10+20+10+10+15+15 = 170
    expect(r.intentScore).toBe(170);
    expect(r.status).toBe("hot");
    expect(r.breakdown).toHaveLength(10);
  });

  it("report_exported + deal_saved = 30 → nurture", () => {
    const r = scoreLeadInput({ reportExported: true, dealSaved: true });
    expect(r.intentScore).toBe(30);
    expect(r.status).toBe("nurture");
  });

  it("breakdown only includes factors that were true", () => {
    const r = scoreLeadInput({ dealSubmitted: true, dealDeskCtaClicked: false });
    expect(r.breakdown.map(b => b.factor)).toContain("deal_submitted");
    expect(r.breakdown.map(b => b.factor)).not.toContain("deal_desk_cta_clicked");
  });
});

describe("selectEmailTriggers", () => {
  it("always includes deal_submitted_confirmation", () => {
    for (const status of ["hot", "warm", "nurture", "audience"] as const) {
      expect(selectEmailTriggers(status, false)).toContain("deal_submitted_confirmation");
    }
  });

  it("hot includes hot_lead_immediate_followup, not warm", () => {
    const t = selectEmailTriggers("hot", false);
    expect(t).toContain("hot_lead_immediate_followup");
    expect(t).not.toContain("warm_lead_24h_followup");
  });

  it("warm includes warm_lead_24h_followup, not hot", () => {
    const t = selectEmailTriggers("warm", false);
    expect(t).toContain("warm_lead_24h_followup");
    expect(t).not.toContain("hot_lead_immediate_followup");
  });

  it("nurture/audience gets no extra band trigger", () => {
    const nt = selectEmailTriggers("nurture", false);
    const at = selectEmailTriggers("audience", false);
    expect(nt).not.toContain("hot_lead_immediate_followup");
    expect(nt).not.toContain("warm_lead_24h_followup");
    expect(at).not.toContain("hot_lead_immediate_followup");
  });

  it("includes financing_interest_followup when financingHelpWanted is true", () => {
    expect(selectEmailTriggers("warm", true)).toContain("financing_interest_followup");
    expect(selectEmailTriggers("nurture", true)).toContain("financing_interest_followup");
    expect(selectEmailTriggers("hot", false)).not.toContain("financing_interest_followup");
  });
});

describe("end-to-end orchestration: score → status → triggers", () => {
  it("hot submission with financing: score 90, hot status, correct triggers", () => {
    const input = {
      dealSubmitted: true,
      buyingHelpWanted: true,
      financingHelpWanted: true,
      returnThresholdHit: true,
    };
    const score = scoreLeadInput(input);
    expect(score.intentScore).toBe(90);
    expect(score.status).toBe("hot");
    expect(score.suggestedNextAction).toBe("Call within 5 minutes");

    const triggers = selectEmailTriggers(score.status as "hot", !!input.financingHelpWanted);
    expect(triggers).toContain("deal_submitted_confirmation");
    expect(triggers).toContain("hot_lead_immediate_followup");
    expect(triggers).toContain("financing_interest_followup");
    expect(triggers).not.toContain("warm_lead_24h_followup");
  });

  it("warm submission with phone but no buying/financing: score 50, warm, 24h followup", () => {
    const input = { dealSubmitted: true, phoneProvided: true };
    const score = scoreLeadInput(input);
    expect(score.intentScore).toBe(50);
    expect(score.status).toBe("warm");

    const triggers = selectEmailTriggers(score.status as "warm", !!input.financingHelpWanted);
    expect(triggers).toContain("deal_submitted_confirmation");
    expect(triggers).toContain("warm_lead_24h_followup");
    expect(triggers).not.toContain("hot_lead_immediate_followup");
    expect(triggers).not.toContain("financing_interest_followup");
  });

  it("minimal submission (deal only): score 40, nurture, only confirmation trigger", () => {
    const input = { dealSubmitted: true };
    const score = scoreLeadInput(input);
    expect(score.intentScore).toBe(40);
    expect(score.status).toBe("nurture");

    const triggers = selectEmailTriggers(score.status as "nurture", !!input.financingHelpWanted);
    expect(triggers).toHaveLength(1);
    expect(triggers[0]).toBe("deal_submitted_confirmation");
  });

  it("breakdown length matches number of true signals", () => {
    const score = scoreLeadInput({
      dealSubmitted: true,
      phoneProvided: true,
      buyingHelpWanted: true,
    });
    expect(score.breakdown).toHaveLength(3);
    // breakdown items use 'factor' key (snake_case signal names)
    const factors = score.breakdown.map(b => b.factor);
    expect(factors).toContain("deal_submitted");
    expect(factors).toContain("phone_provided");
    expect(factors).toContain("buying_help_wanted");
  });
});
