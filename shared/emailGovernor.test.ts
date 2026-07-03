import { describe, expect, it } from "vitest";
import {
  DEFAULT_EMAIL_WEEKLY_CAP,
  decideEmailSend,
  resolveWeeklyCap,
  type UserEmailState,
} from "./emailGovernor";

/** Fully-permissive baseline state: opted in, granted, no prefs row, no sends yet. */
function baseState(overrides: Partial<UserEmailState> = {}): UserEmailState {
  return {
    digestOptIn: true,
    consentStatus: "granted",
    preferences: null,
    recentMarketingCount: 0,
    ...overrides,
  };
}

describe("decideEmailSend — transactional exemption", () => {
  it("always allows transactional regardless of consent/prefs/cap", () => {
    const decision = decideEmailSend({
      category: "transactional",
      state: baseState({
        digestOptIn: false,
        consentStatus: "revoked",
        preferences: { marketingEmailEnabled: false, streamEnabled: false },
        recentMarketingCount: 999,
      }),
    });
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("transactional_exempt");
    expect(decision.category).toBe("transactional");
  });

  it("does not require a stream for transactional", () => {
    expect(decideEmailSend({ category: "transactional", state: baseState() }).allowed).toBe(true);
  });
});

describe("decideEmailSend — consent gate", () => {
  it("denies when digest opt-in is off", () => {
    const decision = decideEmailSend({
      category: "marketing",
      stream: "retention",
      state: baseState({ digestOptIn: false }),
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("consent_revoked");
  });

  it("denies when the CASL ledger latest row is revoked", () => {
    const decision = decideEmailSend({
      category: "marketing",
      stream: "weekly_digest",
      state: baseState({ consentStatus: "revoked" }),
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("consent_revoked");
  });

  it("consent denial takes precedence over the cap", () => {
    const decision = decideEmailSend({
      category: "marketing",
      stream: "retention",
      state: baseState({ consentStatus: "revoked", recentMarketingCount: 99 }),
    });
    expect(decision.reason).toBe("consent_revoked");
  });
});

describe("decideEmailSend — preference gates", () => {
  it("denies all marketing when the master switch is off", () => {
    const decision = decideEmailSend({
      category: "marketing",
      stream: "watchlist_alerts",
      state: baseState({ preferences: { marketingEmailEnabled: false, streamEnabled: true } }),
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("marketing_disabled");
  });

  it("denies with user_pref when the per-category toggle is off", () => {
    const decision = decideEmailSend({
      category: "marketing",
      stream: "monthly_rank",
      state: baseState({ preferences: { marketingEmailEnabled: true, streamEnabled: false } }),
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("user_pref");
  });

  it("allows when both master and per-category toggles are on", () => {
    const decision = decideEmailSend({
      category: "marketing",
      stream: "community",
      state: baseState({ preferences: { marketingEmailEnabled: true, streamEnabled: true } }),
    });
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("allowed");
  });

  it("treats an absent preferences row as all-on", () => {
    const decision = decideEmailSend({
      category: "marketing",
      stream: "retention",
      state: baseState({ preferences: null }),
    });
    expect(decision.allowed).toBe(true);
  });

  it("master-off precedence over per-category and cap", () => {
    const decision = decideEmailSend({
      category: "marketing",
      stream: "retention",
      state: baseState({
        preferences: { marketingEmailEnabled: false, streamEnabled: false },
        recentMarketingCount: 99,
      }),
    });
    expect(decision.reason).toBe("marketing_disabled");
  });
});

describe("decideEmailSend — rolling 7-day cap boundary", () => {
  it("allows exactly at the cap (count includes the just-claimed row)", () => {
    // 2 prior + this claim = 3 = default cap → still the 3rd email is allowed.
    const decision = decideEmailSend({
      category: "marketing",
      stream: "retention",
      state: baseState({ recentMarketingCount: DEFAULT_EMAIL_WEEKLY_CAP }),
    });
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("allowed");
  });

  it("suppresses one past the cap", () => {
    const decision = decideEmailSend({
      category: "marketing",
      stream: "retention",
      state: baseState({ recentMarketingCount: DEFAULT_EMAIL_WEEKLY_CAP + 1 }),
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("capped");
  });

  it("allows the first send of the window", () => {
    expect(
      decideEmailSend({
        category: "marketing",
        stream: "retention",
        state: baseState({ recentMarketingCount: 1 }),
      }).allowed,
    ).toBe(true);
  });

  it("honours a custom weekly cap", () => {
    expect(
      decideEmailSend({
        category: "marketing",
        stream: "retention",
        state: baseState({ recentMarketingCount: 2 }),
        weeklyCap: 1,
      }).reason,
    ).toBe("capped");
    expect(
      decideEmailSend({
        category: "marketing",
        stream: "retention",
        state: baseState({ recentMarketingCount: 1 }),
        weeklyCap: 1,
      }).allowed,
    ).toBe(true);
  });
});

describe("decideEmailSend — governor is additive to per-type dedupe", () => {
  it("does not itself dedupe: two independent streams both pass under the cap", () => {
    // The governor never inspects a dedupe key. A milestone email and a
    // watchlist email for the same user, both under the cap, are BOTH allowed;
    // per-type dedupe (milestone key vs. watchlist key) is the producer's job.
    const milestone = decideEmailSend({
      category: "marketing",
      stream: "retention",
      state: baseState({ recentMarketingCount: 1 }),
    });
    const watchlist = decideEmailSend({
      category: "marketing",
      stream: "watchlist_alerts",
      state: baseState({ recentMarketingCount: 2 }),
    });
    expect(milestone.allowed).toBe(true);
    expect(watchlist.allowed).toBe(true);
  });
});

describe("resolveWeeklyCap", () => {
  it("defaults on missing/invalid values", () => {
    expect(resolveWeeklyCap(undefined)).toBe(DEFAULT_EMAIL_WEEKLY_CAP);
    expect(resolveWeeklyCap("")).toBe(DEFAULT_EMAIL_WEEKLY_CAP);
    expect(resolveWeeklyCap("nope")).toBe(DEFAULT_EMAIL_WEEKLY_CAP);
    expect(resolveWeeklyCap("0")).toBe(DEFAULT_EMAIL_WEEKLY_CAP);
    expect(resolveWeeklyCap("-4")).toBe(DEFAULT_EMAIL_WEEKLY_CAP);
  });

  it("parses a valid positive integer and floors it", () => {
    expect(resolveWeeklyCap("5")).toBe(5);
    expect(resolveWeeklyCap("2.9")).toBe(2);
  });
});
