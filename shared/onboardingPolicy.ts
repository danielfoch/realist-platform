/**
 * Pure decision logic for the onboarding email sequence
 * (server/onboardingEmails.ts). Lives in shared/ so the step/skip/cadence
 * rules are unit-testable without a database or SMTP — the server module only
 * wires these decisions to SQL and Resend. Mirrors shared/retentionPolicy.ts.
 *
 * The sequence is behaviour-aware, not a dumb drip: each step is SKIPPED when
 * the user already did the thing it nudges toward, and skips are re-evaluated
 * every sweep (so a step can become due later if behaviour changes — e.g. a
 * user who runs their first analysis on day 4 unlocks the Deal Desk step).
 */

export const ONBOARDING_STEPS = [
  /** D1: never ran an analysis → "Analyze your first deal in 60 seconds". */
  { key: "onboarding_first_analysis", day: 1 },
  /** D3: fewer than 2 analyses → cap rate / DSCR explainers + cap rate map. */
  { key: "onboarding_learn_metrics", day: 3 },
  /** D5: has ≥1 analysis but no Deal Desk submission → "second set of eyes". */
  { key: "onboarding_deal_desk", day: 5 },
  /** D7: podcast + events — always relevant, never behaviour-skipped. */
  { key: "onboarding_community", day: 7 },
] as const;

export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number]["key"];

/**
 * Sequence window: steps stop being due after this many days post-signup.
 * Also the first-deploy guard — without it, every historical user would get
 * the whole sequence dripped at them (same failure mode the retention
 * milestone "newly crossed" check protects against).
 */
export const ONBOARDING_MAX_DAYS = 14;

export interface OnboardingBehavior {
  /** Lifetime deal analyses (analyses + property_analyses). */
  analysisCount: number;
  /** Has at least one Deal Desk submission (opportunities row). */
  hasDealDeskSubmission: boolean;
}

/** True when the user already did the thing the step nudges toward → skip. */
export function isOnboardingStepSatisfied(
  key: OnboardingStepKey,
  behavior: OnboardingBehavior,
): boolean {
  switch (key) {
    case "onboarding_first_analysis":
      return behavior.analysisCount >= 1;
    case "onboarding_learn_metrics":
      return behavior.analysisCount >= 2;
    case "onboarding_deal_desk":
      // Only relevant for users with ≥1 analysis and no submission yet;
      // "satisfied" (skip) when that condition doesn't hold.
      return !(behavior.analysisCount >= 1 && !behavior.hasDealDeskSubmission);
    case "onboarding_community":
      return false;
  }
}

export function daysSinceSignup(signupAt: Date, now: Date): number {
  return Math.floor((now.getTime() - signupAt.getTime()) / 86_400_000);
}

/**
 * Which onboarding step (if any) is due for this user right now.
 *
 * Rules, in order:
 *  - nothing before D1, nothing after ONBOARDING_MAX_DAYS;
 *  - at most one onboarding email per user per rolling day (`sentInLastDay`);
 *  - steps are evaluated in sequence order: the OLDEST due, unsent,
 *    unsatisfied step wins (a D7 user who never analyzed still gets the
 *    first-analysis email before the community one);
 *  - a step already in `sentSteps` is never re-sent (log-table dedupe);
 *  - a satisfied step is skipped without being burned — it stays eligible
 *    to fire later only if behaviour regresses, which analysis counts can't.
 */
export function decideOnboardingStep(params: {
  signupAt: Date;
  now?: Date;
  behavior: OnboardingBehavior;
  /** Step keys already sent to this user (retention_email_log dedupe keys). */
  sentSteps: readonly string[];
  /** Any onboarding email sent to this user in the last 24h. */
  sentInLastDay: boolean;
}): OnboardingStepKey | null {
  const now = params.now ?? new Date();
  const days = daysSinceSignup(params.signupAt, now);
  if (days < 1) return null;
  if (days > ONBOARDING_MAX_DAYS) return null;
  if (params.sentInLastDay) return null;

  for (const step of ONBOARDING_STEPS) {
    if (step.day > days) break; // steps are ordered by day; nothing further is due
    if (params.sentSteps.includes(step.key)) continue;
    if (isOnboardingStepSatisfied(step.key, params.behavior)) continue;
    return step.key;
  }
  return null;
}
