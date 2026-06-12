import { describe, expect, it } from "vitest";
import {
  ONBOARDING_MAX_DAYS,
  ONBOARDING_STEPS,
  decideOnboardingStep,
  isOnboardingStepSatisfied,
  type OnboardingBehavior,
} from "./onboardingPolicy";

const NOW = new Date("2026-06-11T12:00:00Z");

function signedUpDaysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 86_400_000);
}

const freshUser: OnboardingBehavior = { analysisCount: 0, hasDealDeskSubmission: false };

function decide(
  days: number,
  behavior: OnboardingBehavior = freshUser,
  sentSteps: string[] = [],
  sentInLastDay = false,
) {
  return decideOnboardingStep({
    signupAt: signedUpDaysAgo(days),
    now: NOW,
    behavior,
    sentSteps,
    sentInLastDay,
  });
}

describe("decideOnboardingStep — timing", () => {
  it("brand-new user gets nothing before D1", () => {
    expect(decide(0)).toBeNull();
    expect(
      decideOnboardingStep({
        signupAt: new Date(NOW.getTime() - 6 * 60 * 60 * 1000), // 6h old
        now: NOW,
        behavior: freshUser,
        sentSteps: [],
        sentInLastDay: false,
      }),
    ).toBeNull();
  });

  it("first-analysis nudge becomes due at D1", () => {
    expect(decide(1)).toBe("onboarding_first_analysis");
  });

  it("later steps are not due before their day offset", () => {
    // D1 sent; at D2 the learn-metrics step (D3) is not yet due.
    expect(decide(2, freshUser, ["onboarding_first_analysis"])).toBeNull();
  });

  it("sequence goes quiet after the onboarding window (first-deploy guard)", () => {
    expect(decide(ONBOARDING_MAX_DAYS + 1)).toBeNull();
    expect(decide(45)).toBeNull();
    // ... but the last day of the window still fires.
    expect(decide(ONBOARDING_MAX_DAYS)).toBe("onboarding_first_analysis");
  });
});

describe("decideOnboardingStep — behaviour-aware skipping", () => {
  it("skips the first-analysis step when the user already analyzed a deal", () => {
    expect(decide(1, { analysisCount: 1, hasDealDeskSubmission: false })).toBeNull();
  });

  it("sends learn-metrics at D3 to users with fewer than 2 analyses", () => {
    expect(decide(3, { analysisCount: 1, hasDealDeskSubmission: false })).toBe("onboarding_learn_metrics");
  });

  it("skips learn-metrics when the user already has 2+ analyses", () => {
    // first-analysis and learn-metrics both satisfied; deal-desk not due until D5.
    expect(decide(3, { analysisCount: 2, hasDealDeskSubmission: false })).toBeNull();
  });

  it("sends deal-desk at D5 only with ≥1 analysis and no submission", () => {
    expect(decide(5, { analysisCount: 2, hasDealDeskSubmission: false })).toBe("onboarding_deal_desk");
  });

  it("skips deal-desk when the user already submitted", () => {
    expect(decide(5, { analysisCount: 2, hasDealDeskSubmission: true })).toBeNull();
  });

  it("a skipped step can fire later when behaviour changes", () => {
    // 0 analyses at D5 → deal-desk irrelevant, first-analysis due instead...
    expect(decide(5, freshUser, [])).toBe("onboarding_first_analysis");
    // ...then the user analyzes a deal; at D6 deal-desk is now unlocked.
    expect(
      decide(6, { analysisCount: 1, hasDealDeskSubmission: false }, ["onboarding_first_analysis", "onboarding_learn_metrics"]),
    ).toBe("onboarding_deal_desk");
  });

  it("community step at D7 is never behaviour-skipped", () => {
    const powerUser: OnboardingBehavior = { analysisCount: 10, hasDealDeskSubmission: true };
    expect(decide(7, powerUser)).toBe("onboarding_community");
    expect(isOnboardingStepSatisfied("onboarding_community", powerUser)).toBe(false);
  });
});

describe("decideOnboardingStep — dedupe and cadence", () => {
  it("never double-sends a step already in the log", () => {
    expect(decide(1, freshUser, ["onboarding_first_analysis"])).toBeNull();
    expect(
      decide(7, freshUser, ONBOARDING_STEPS.map((s) => s.key)),
    ).toBeNull();
  });

  it("sends at most one onboarding email per day", () => {
    // Step is due, but something already went out in the last 24h.
    expect(decide(3, freshUser, ["onboarding_first_analysis"], true)).toBeNull();
  });

  it("oldest due step wins: a D7 user who never analyzed gets first-analysis, not community", () => {
    expect(decide(7, freshUser, [])).toBe("onboarding_first_analysis");
  });

  it("catches a dormant user up one email per day, in sequence order", () => {
    // User signs up, ignores everything until D7, then the sweep runs daily.
    const sent: string[] = [];
    const got: string[] = [];
    for (let day = 7; day <= ONBOARDING_MAX_DAYS; day++) {
      const step = decide(day, freshUser, sent, false);
      if (step) {
        got.push(step);
        sent.push(step);
      }
    }
    // deal_desk is behaviour-skipped (0 analyses), the rest arrive in order.
    expect(got).toEqual([
      "onboarding_first_analysis",
      "onboarding_learn_metrics",
      "onboarding_community",
    ]);
  });
});
