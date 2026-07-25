/**
 * Tests for the deal-intent capture service (server/dealIntent.ts).
 *
 * The db, storage, activity log, email producer and Resend are mocked — these
 * cover the three behaviours the lead funnel depends on and that nothing
 * exercised before: intent scored from real activity rather than client-declared
 * booleans, the in-house vs partner-referral routing split, and the in-house
 * team alert that keeps Toronto leads from landing silently.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock state ──────────────────────────────────────────────────────────────

const state = {
  /** Row returned by the activity-count aggregate in deriveScoringInput. */
  activityCounts: {} as Record<string, number>,
  /** Throw from the aggregate to exercise the fallback path. */
  activityThrows: false,
  userRows: [] as Record<string, unknown>[],
  /** Opportunities for this lead inside the throttle window, incl. the new one. */
  recentOpportunityCount: 1,
  throttleThrows: false,
  claims: [] as Record<string, unknown>[],
  claimsQueriedWith: [] as Array<{ city: string; region: string; partnerTypes?: string[] }>,
  notifications: [] as Record<string, unknown>[],
  activityEvents: [] as Record<string, unknown>[],
  queuedTriggers: [] as string[],
  leadNotifications: [] as Record<string, unknown>[],
  partnerAlerts: [] as Record<string, unknown>[],
  ghlPushes: [] as Array<{ email: string; name: string; source: string; city?: string | null }>,
};

vi.mock("./ghl-service", () => ({
  pushInvestorLeadToGHL: async (
    email: string,
    _phone: string | null | undefined,
    name: string,
    source: string,
    city?: string | null,
  ) => {
    state.ghlPushes.push({ email, name, source, city });
  },
}));

vi.mock("./db", () => {
  // select(...).from(...).where(...) is awaited directly in both call sites, so
  // `where` doubles as the thenable that resolves the rows.
  const makeChain = (rows: () => Record<string, unknown>[]) => {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.where = () => chain;
    chain.limit = () => chain;
    (chain as any).then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      try {
        resolve(rows());
      } catch (err) {
        reject(err);
      }
    };
    return chain;
  };
  return {
    db: {
      select: (shape?: Record<string, unknown>) =>
        makeChain(() => {
          // The aggregate selects named count columns; the user lookup selects
          // email/firstName/lastName/phone.
          if (shape && "exports" in shape) {
            if (state.activityThrows) throw new Error("aggregate boom");
            return [state.activityCounts];
          }
          if (shape && "recent" in shape) {
            if (state.throttleThrows) throw new Error("throttle boom");
            return [{ recent: state.recentOpportunityCount }];
          }
          return state.userRows;
        }),
      update: () => ({ set: () => ({ where: async () => ({ rowCount: 0 }) }) }),
      execute: async () => ({ rowCount: 0, rows: [] }),
    },
  };
});

vi.mock("./storage", () => ({
  storage: {
    upsertLeadByEmail: async (data: Record<string, unknown>) => ({
      id: "lead-1",
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
    }),
    createOpportunity: async (opp: Record<string, unknown>) => ({ id: "opp-1", ...opp }),
    getActiveClaimsForMarket: async (city: string, region: string, partnerTypes?: string[]) => {
      state.claimsQueriedWith.push({ city, region, partnerTypes });
      return state.claims;
    },
    createRealtorLeadNotification: async (n: Record<string, unknown>) => {
      state.notifications.push(n);
      return { id: `notif-${state.notifications.length}`, ...n };
    },
  },
}));

vi.mock("./userActivity", () => ({
  logUserActivity: async (_req: unknown, event: Record<string, unknown>) => {
    state.activityEvents.push(event);
  },
}));

vi.mock("./emailTriggerProducer", () => ({
  queueEmailTrigger: async (input: { triggerType: string }) => {
    state.queuedTriggers.push(input.triggerType);
    return { queued: true };
  },
}));

vi.mock("./resend", () => ({
  sendLeadNotification: async (lead: Record<string, unknown>) => {
    state.leadNotifications.push(lead);
  },
  sendRealtorLeadAlert: async (alert: Record<string, unknown>) => {
    state.partnerAlerts.push(alert);
  },
}));

const {
  captureDealLead,
  deriveScoringInput,
  routeLeadToPartnerClaims,
  recordDealIntent,
} = await import("./dealIntent");

const NO_COUNTS = {
  exports: 0,
  saves: 0,
  financingChanges: 0,
  ctaClicks: 0,
  offerCandidates: 0,
  goodDeals: 0,
  searches: 0,
  underwrites: 0,
};

beforeEach(() => {
  state.activityCounts = { ...NO_COUNTS };
  state.activityThrows = false;
  state.recentOpportunityCount = 1;
  state.throttleThrows = false;
  state.userRows = [];
  state.claims = [];
  state.claimsQueriedWith = [];
  state.notifications = [];
  state.activityEvents = [];
  state.queuedTriggers = [];
  state.leadNotifications = [];
  state.partnerAlerts = [];
  state.ghlPushes = [];
});

// ─── Scoring derivation ──────────────────────────────────────────────────────

describe("deriveScoringInput", () => {
  it("returns only declared inputs when there is no identity to look up", async () => {
    const result = await deriveScoringInput({
      phoneProvided: true,
      financingHelpWanted: true,
      buyingHelpWanted: false,
      dealSubmitted: true,
    });

    expect(result).toEqual({
      dealSubmitted: true,
      phoneProvided: true,
      financingHelpWanted: true,
      buyingHelpWanted: false,
    });
    // Crucially: no behavioural flag is invented when we cannot verify one.
    expect(result.reportExported).toBeUndefined();
    expect(result.dealSaved).toBeUndefined();
  });

  it("derives behavioural flags from logged activity, not from the caller", async () => {
    state.activityCounts = {
      ...NO_COUNTS,
      exports: 2,
      saves: 1,
      financingChanges: 4,
      offerCandidates: 1,
    };

    const result = await deriveScoringInput({
      userId: "user-1",
      phoneProvided: false,
      financingHelpWanted: false,
      buyingHelpWanted: true,
    });

    expect(result.reportExported).toBe(true);
    expect(result.dealSaved).toBe(true);
    expect(result.financingChanged).toBe(true);
    expect(result.returnThresholdHit).toBe(true);
    expect(result.dealDeskCtaClicked).toBe(false);
  });

  it("treats one underwrite as a trial and two as a hunt", async () => {
    state.activityCounts = { ...NO_COUNTS, underwrites: 1 };
    const trial = await deriveScoringInput({
      sessionId: "sess-1",
      phoneProvided: false,
      financingHelpWanted: false,
      buyingHelpWanted: true,
    });
    expect(trial.repeatMarketSearches).toBe(false);

    state.activityCounts = { ...NO_COUNTS, underwrites: 2 };
    const hunt = await deriveScoringInput({
      sessionId: "sess-1",
      phoneProvided: false,
      financingHelpWanted: false,
      buyingHelpWanted: true,
    });
    expect(hunt.repeatMarketSearches).toBe(true);
  });

  it("falls back to declared inputs when the aggregate fails", async () => {
    state.activityThrows = true;

    const result = await deriveScoringInput({
      userId: "user-1",
      phoneProvided: true,
      financingHelpWanted: false,
      buyingHelpWanted: true,
      dealSubmitted: true,
    });

    expect(result.dealSubmitted).toBe(true);
    expect(result.phoneProvided).toBe(true);
    expect(result.reportExported).toBeUndefined();
  });
});

// ─── Partner routing ─────────────────────────────────────────────────────────

describe("routeLeadToPartnerClaims", () => {
  const base = {
    leadId: "lead-1",
    leadName: "Jordan Investor",
    intent: "purchase" as const,
    baseUrl: "https://realist.ca",
  };

  it("keeps Toronto-drive-zone leads in house and notifies no partner", async () => {
    state.claims = [{ id: "claim-1", userId: "partner-1", partnerType: "realtor" }];

    const result = await routeLeadToPartnerClaims({ ...base, city: "Toronto", region: "Ontario" });

    expect(result.channel).toBe("valery");
    expect(result.notified).toBe(0);
    expect(state.notifications).toHaveLength(0);
    expect(state.claimsQueriedWith).toHaveLength(0);
    expect(state.activityEvents.map(e => e.eventName)).toContain("lead_routing_policy_applied");
  });

  it("holds non-drive-zone Ontario leads for manual review", async () => {
    const result = await routeLeadToPartnerClaims({ ...base, city: "Sudbury", region: "Ontario" });

    expect(result.channel).toBe("manual_review");
    expect(result.notified).toBe(0);
    expect(state.notifications).toHaveLength(0);
  });

  it("fans out-of-province leads to realtor claims and emails each partner", async () => {
    state.claims = [
      { id: "claim-1", userId: "partner-1", partnerType: "realtor" },
      { id: "claim-2", userId: "partner-2", partnerType: "realtor" },
    ];
    state.userRows = [{ email: "agent@example.com", firstName: "Alex", lastName: "Agent", phone: null }];

    const result = await routeLeadToPartnerClaims({
      ...base,
      city: "Calgary",
      region: "Alberta",
      dealAddress: "123 Example Ave",
      dealStrategy: "buy_and_hold",
    });

    expect(result.channel).toBe("partner_referral");
    expect(result.notified).toBe(2);
    expect(state.notifications).toHaveLength(2);
    expect(state.claimsQueriedWith[0].partnerTypes).toEqual(["realtor"]);
    expect(state.partnerAlerts).toHaveLength(2);
    expect(state.partnerAlerts[0].claimUrl).toBe("https://realist.ca/partner");
  });

  it("routes financing intent to brokers and lenders instead of realtors", async () => {
    state.claims = [];

    await routeLeadToPartnerClaims({
      ...base,
      intent: "financing",
      city: "Vancouver",
      region: "British Columbia",
    });

    expect(state.claimsQueriedWith[0].partnerTypes).toEqual(["mortgage_broker", "lender"]);
  });

  it("leaves notifications unlinked when the surface has no property or analysis row", async () => {
    state.claims = [{ id: "claim-1", userId: "partner-1", partnerType: "realtor" }];
    state.userRows = [{ email: "agent@example.com", firstName: "Alex", lastName: "Agent", phone: null }];

    await routeLeadToPartnerClaims({ ...base, city: "Halifax", region: "Nova Scotia" });

    // The multiplex underwriter creates neither, and both columns are nullable.
    expect(state.notifications[0].propertyId).toBeNull();
    expect(state.notifications[0].analysisId).toBeNull();
  });
});

// ─── Full capture ────────────────────────────────────────────────────────────

describe("captureDealLead", () => {
  const signal = {
    surface: "multiplex_underwriter" as const,
    eventName: "underwriting_completed",
    userId: "user-1",
    address: "50 Sample St",
    city: "Toronto",
    region: "Ontario",
    propertyType: "multiplex",
    strategyType: "buy_and_hold",
    purchasePrice: 1_400_000,
    estimatedRent: 9_200,
    underwritingId: "uw-1",
  };
  const identity = { name: "Jordan Investor", email: "jordan@example.com", phone: "4165551234" };

  it("alerts the team when the lead stays in house", async () => {
    const result = await captureDealLead(null, signal, identity);

    expect(result.routing.channel).toBe("valery");
    expect(result.routing.notified).toBe(0);
    expect(state.leadNotifications).toHaveLength(1);
    expect(state.leadNotifications[0].address).toBe("50 Sample St");
    // The alert carries the score so the team can triage without opening /admin.
    expect(String(state.leadNotifications[0].source)).toContain("Multiplex Underwriter");
    expect(String(state.leadNotifications[0].source)).toMatch(/HOT|WARM|NURTURE|AUDIENCE/);
  });

  it("pushes every capture to the CRM with market tags", async () => {
    await captureDealLead(null, signal, identity);

    expect(state.ghlPushes).toHaveLength(1);
    expect(state.ghlPushes[0].email).toBe("jordan@example.com");
    expect(state.ghlPushes[0].source).toBe("Multiplex Underwriter");
    expect(state.ghlPushes[0].city).toBe("Toronto");
  });

  it("still pushes to the CRM when the team alert is throttled", async () => {
    // The throttle protects a human inbox; it must not skip the CRM.
    state.recentOpportunityCount = 4;

    await captureDealLead(null, signal, identity);

    expect(state.leadNotifications).toHaveLength(0);
    expect(state.ghlPushes).toHaveLength(1);
  });

  it("throttles a repeat warm capture from the same lead", async () => {
    // A prior opportunity inside the window means this is capture 2+. Someone
    // running twenty underwrites should not send twenty team emails.
    state.recentOpportunityCount = 2;

    const result = await captureDealLead(null, signal, identity);

    expect(result.status).toBe("warm");
    expect(state.leadNotifications).toHaveLength(0);
    // Still fully captured — only the human interrupt is suppressed.
    expect(result.opportunityId).toBe("opp-1");
    expect(state.queuedTriggers).toContain("deal_submitted_confirmation");
  });

  it("breaks the throttle when a repeat capture escalates to hot", async () => {
    state.recentOpportunityCount = 5;
    state.activityCounts = { ...NO_COUNTS, exports: 1, saves: 1, offerCandidates: 1 };

    const result = await captureDealLead(null, signal, identity);

    expect(result.status).toBe("hot");
    expect(state.leadNotifications).toHaveLength(1);
  });

  it("alerts anyway when the throttle query fails", async () => {
    // A broken throttle must not cost a lead alert.
    state.throttleThrows = true;
    state.recentOpportunityCount = 9;

    const result = await captureDealLead(null, signal, identity);

    expect(result.status).toBe("warm");
    expect(state.leadNotifications).toHaveLength(1);
  });

  it("does not double-notify when a partner already got the lead", async () => {
    state.claims = [{ id: "claim-1", userId: "partner-1", partnerType: "realtor" }];
    state.userRows = [{ email: "agent@example.com", firstName: "Alex", lastName: "Agent", phone: null }];

    const result = await captureDealLead(null, { ...signal, city: "Calgary", region: "Alberta" }, identity);

    expect(result.routing.notified).toBe(1);
    expect(state.leadNotifications).toHaveLength(0);
    expect(state.partnerAlerts).toHaveLength(1);
  });

  it("scores a submitted deal with a phone as at least warm and queues its triggers", async () => {
    const result = await captureDealLead(null, signal, identity);

    // deal_submitted (40) + phone (10) + buying_help (15) = 65 → warm.
    expect(result.intentScore).toBe(65);
    expect(result.status).toBe("warm");
    expect(state.queuedTriggers).toContain("deal_submitted_confirmation");
    expect(state.queuedTriggers).toContain("warm_lead_24h_followup");
  });

  it("escalates to hot once real behaviour backs the submission", async () => {
    state.activityCounts = { ...NO_COUNTS, exports: 1, saves: 1, offerCandidates: 1 };

    const result = await captureDealLead(null, signal, identity);

    // + report_exported (15) + deal_saved (15) + return_threshold_hit (20) = 115.
    expect(result.intentScore).toBeGreaterThanOrEqual(80);
    expect(result.status).toBe("hot");
    expect(result.suggestedNextAction).toBe("Call within 5 minutes");
    expect(state.queuedTriggers).toContain("hot_lead_immediate_followup");
  });

  it("carries the underwriting id onto the opportunity's activity event", async () => {
    await captureDealLead(null, signal, identity);

    const submitted = state.activityEvents.find(e => e.eventName === "deal_submitted");
    expect(submitted).toBeDefined();
    expect((submitted!.metadata as Record<string, unknown>).underwritingId).toBe("uw-1");
    expect((submitted!.metadata as Record<string, unknown>).leadId).toBe("lead-1");
  });

  it("treats a financing-intent capture as financing help wanted", async () => {
    const result = await captureDealLead(null, signal, identity, { intent: "financing" });

    expect(state.queuedTriggers).toContain("financing_interest_followup");
    expect(result.status).toBeDefined();
  });
});

// ─── Anonymous recording ─────────────────────────────────────────────────────

describe("recordDealIntent", () => {
  it("records anonymous work without creating a lead or notifying anyone", async () => {
    await recordDealIntent(null, {
      surface: "multiplex_underwriter",
      eventName: "underwriting_completed",
      sessionId: "sess-9",
      address: "50 Sample St",
      city: "Toronto",
      region: "Ontario",
    });

    expect(state.activityEvents).toHaveLength(1);
    expect(state.activityEvents[0].eventName).toBe("underwriting_completed");
    expect(state.activityEvents[0].sourcePage).toBe("/tools/multiplex-underwriter");
    expect(state.leadNotifications).toHaveLength(0);
    expect(state.notifications).toHaveLength(0);
  });
});
