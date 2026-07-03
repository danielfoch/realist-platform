/**
 * Pure decision logic for the passwordless-activation email sequence
 * (server/passwordlessActivation.ts). Mirrors shared/retentionPolicy.ts and
 * shared/onboardingPolicy.ts: the send/suppress rules live here so they are
 * unit-testable without a database or SMTP — the server module only wires
 * these decisions to SQL, token issuance, and the unified email governor.
 *
 * Who this targets: accounts with NO password (silently created via lead
 * capture, event checkout/RSVP, admin import) that are also DORMANT — no login
 * and no analysis activity in the trailing window. Passwordless users who keep
 * signing in via magic link are already "true users" (the dashboard
 * AddPasswordBanner covers them) and are excluded by the dormancy check.
 *
 * Stop conditions (each stops the sequence FOREVER for that user):
 *  (a) password gets set — they converted;
 *  (b) any login/activity occurs after the last send — they activated, and
 *      future dormancy is retention's job, not activation's;
 *  (c) ACTIVATION_MAX_LIFETIME_ATTEMPTS sends reached — dead emails get
 *      retired, protecting sender reputation.
 *
 * Cadence is rolling (30 days minimum between attempts per user), not a
 * calendar blast, so sends naturally spread across days.
 *
 * Note on the governor: the shared rolling 7-day marketing cap, the CASL
 * consent gate, and the per-category notification_preferences toggle are all
 * decided centrally by governMarketingSend (server/emailGovernor.ts) at send
 * time — they are deliberately NOT re-implemented here. This module owns only
 * the campaign-specific targeting (dormancy, monthly spacing, lifetime ceiling,
 * post-send activation).
 */

/**
 * email_type written to retention_email_log for this campaign, and the stream
 * key used in the per-attempt governor dedupe key. (The governor's `stream`
 * param is a MarketingStream enum — this campaign rides 'product_updates'; this
 * string is the free-form emailType / dedupe prefix.)
 */
export const ACTIVATION_EMAIL_TYPE = "passwordless_activation";

/** No login/analysis activity for this many days = dormant. */
export const ACTIVATION_DORMANCY_DAYS = 30;

/** Rolling minimum spacing between attempts (monthly cadence). */
export const ACTIVATION_MIN_DAYS_BETWEEN_SENDS = 30;

/** Lifetime attempt ceiling — after this the address is retired forever. */
export const ACTIVATION_MAX_LIFETIME_ATTEMPTS = 6;

const DAY_MS = 86_400_000;

/**
 * Per-attempt dedupe key for retention_email_log. Each attempt gets its own
 * key so the (user_id, dedupe_key) unique index dedupes retries of the SAME
 * attempt (concurrent sweeps collapse) without blocking the next attempt.
 * Shape: `passwordless_activation:<attempt#>`.
 */
export function activationDedupeKey(attemptNumber: number): string {
  return `${ACTIVATION_EMAIL_TYPE}:${attemptNumber}`;
}

export interface ActivationState {
  /** users.password_hash IS NOT NULL. */
  hasPassword: boolean;
  /**
   * Most recent activity across every available signal, or null for
   * never-active. The server computes this as the max of: users.created_at
   * (creation counts as activity, so brand-new accounts wait a full window and
   * never overlap the D1–D14 onboarding sequence), analyses.created_at,
   * property_analyses.created_at, user_activity_events.event_timestamp, and
   * live-session evidence (sessions.expire minus the 7-day TTL). There is no
   * users.last_login_at column in the schema, so login is inferred from these.
   */
  lastActivityAt: Date | null;
  /** Most recent passwordless_activation row in retention_email_log, or null. */
  lastSentAt: Date | null;
  /**
   * Lifetime passwordless_activation rows in retention_email_log. Includes
   * attempts suppressed by the shared weekly cap — the governor keeps the
   * claimed dedupe row when capped (the acknowledged "capped burns the trigger"
   * semantics), so a burned attempt still counts toward the lifetime ceiling
   * and toward spacing.
   */
  attemptsSent: number;
}

/** True when the user shows no activity within the dormancy window. */
export function isDormant(
  lastActivityAt: Date | null,
  now: Date,
  dormancyDays: number = ACTIVATION_DORMANCY_DAYS,
): boolean {
  if (!lastActivityAt) return true;
  const ageMs = now.getTime() - lastActivityAt.getTime();
  return ageMs >= dormancyDays * DAY_MS;
}

export type ActivationSkipReason =
  /** Stop forever: they set a password — mission accomplished. */
  | "password_set"
  /** Stop forever: lifetime attempt ceiling reached — address retired. */
  | "retired"
  /** Stop forever: they logged in / did something after our last send. */
  | "activated_after_send"
  /** Not dormant right now — the AddPasswordBanner covers active users. */
  | "active"
  /** Dormant and eligible, but the last attempt was under 30 days ago. */
  | "too_soon";

export type ActivationDecision =
  | { send: true; attemptNumber: number }
  | { send: false; reason: ActivationSkipReason };

/**
 * The whole targeting rule, in precedence order: forever-stops first
 * (password, retirement, post-send activity), then the dormancy gate, then
 * rolling spacing. `attemptNumber` = lifetime attempts + 1, which the server
 * feeds to activationDedupeKey and the subject-line ladder.
 */
export function decideActivationSend(
  state: ActivationState,
  now: Date = new Date(),
): ActivationDecision {
  if (state.hasPassword) return { send: false, reason: "password_set" };
  if (state.attemptsSent >= ACTIVATION_MAX_LIFETIME_ATTEMPTS) {
    return { send: false, reason: "retired" };
  }
  if (
    state.lastSentAt &&
    state.lastActivityAt &&
    state.lastActivityAt.getTime() > state.lastSentAt.getTime()
  ) {
    return { send: false, reason: "activated_after_send" };
  }
  if (!isDormant(state.lastActivityAt, now)) return { send: false, reason: "active" };
  if (
    state.lastSentAt &&
    now.getTime() - state.lastSentAt.getTime() < ACTIVATION_MIN_DAYS_BETWEEN_SENDS * DAY_MS
  ) {
    return { send: false, reason: "too_soon" };
  }
  return { send: true, attemptNumber: state.attemptsSent + 1 };
}
