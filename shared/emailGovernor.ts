/**
 * Unified email frequency governor — the ONE gate every marketing/content
 * email producer calls immediately before sending. Pure decision logic lives
 * here (unit-testable without a DB); the server helper in server/emailGovernor.ts
 * gathers the inputs (send-log count, consent ledger, notification preferences)
 * and calls decideEmailSend().
 *
 * Consolidation goal (audit item 13): Realist grew many independent email
 * producers, so a single user could receive 6–8 emails a week and an
 * unsubscribe that only partly worked. This governor centralises three checks
 * that were previously scattered or missing:
 *   1. category — transactional/auth is EXEMPT (never capped, never logged);
 *      marketing/content is subject to the cap.
 *   2. consent — the same emailDigestOptIn flag + append-only email_consent
 *      (CASL) ledger that enqueueForRecipients uses.
 *   3. preferences — the notification_preferences row (master marketing switch
 *      + per-category toggle).
 * plus the rolling 7-day per-user marketing cap that previously only
 * retentionEmails/onboardingEmails honoured.
 *
 * This is an ADDITIONAL global gate. It does NOT replace each producer's own
 * per-type dedupe (milestone keys, monthly keys, per-week digest keys) — those
 * still run first and independently.
 */

export const DEFAULT_EMAIL_WEEKLY_CAP = 3;

/**
 * Every governed marketing/content stream. A producer declares which stream it
 * belongs to so the governor can map it to the right notification_preferences
 * toggle. Transactional/auth producers pass category 'transactional' and never
 * name a stream.
 */
export type MarketingStream =
  | "retention"          // behavioural retention nudges (co-analysis, price change, milestone) + onboarding sequence
  | "watchlist_alerts"   // listing price/status + saved-search match alerts
  | "weekly_digest"      // weekly leaderboard/KPI digest
  | "monthly_rank"       // monthly leaderboard rank/winner email
  | "community"          // field-note vote + other community engagement nudges
  | "podcast_digest"     // podcast episode digest (feature ships later; column added now)
  | "product_updates";   // product announcements

export type EmailCategory = "transactional" | "marketing";

export type EmailGovernorReason =
  | "allowed"
  | "transactional_exempt"
  | "consent_revoked"    // email_consent ledger latest row = revoked, or emailDigestOptIn=false
  | "user_pref"          // a per-category notification_preferences toggle is off
  | "marketing_disabled" // master marketing switch is off
  | "capped";            // over the rolling 7-day marketing cap

export interface EmailGovernorDecision {
  allowed: boolean;
  reason: EmailGovernorReason;
  /** The category that was evaluated — handy for the caller's logging. */
  category: EmailCategory;
}

/**
 * Consent + preference snapshot for one user, gathered by the server helper.
 * All fields use the "absent = permissive" convention that the existing gates
 * use (no notification_preferences row means prefs default ON; no email_consent
 * ledger row means no objection on record).
 */
export interface UserEmailState {
  /** users.email_digest_opt_in — false means globally unsubscribed. */
  digestOptIn: boolean;
  /** Latest email_consent ledger status for the email channel; 'granted' if no rows. */
  consentStatus: "granted" | "revoked";
  /**
   * notification_preferences, or null when the user has no row yet
   * (treated as all-on). Only the fields the governor needs.
   */
  preferences: {
    marketingEmailEnabled: boolean;
    streamEnabled: boolean;
  } | null;
  /**
   * Count of marketing sends already logged for this user in the trailing
   * 7 days, INCLUDING the row the caller is about to claim for this send.
   * (Matches decideRetentionSend's recentLogCount convention so a user with
   * `cap` prior sends arrives at cap+1 and is suppressed.)
   */
  recentMarketingCount: number;
}

export interface DecideEmailSendParams {
  category: EmailCategory;
  /** Required for marketing; ignored for transactional. */
  stream?: MarketingStream;
  state: UserEmailState;
  weeklyCap?: number;
}

/**
 * The single yes/no for "may I send this email to this user right now".
 *
 * Order of checks (first failure wins), mirroring the semantics of the gates
 * it replaces:
 *   transactional  → always allowed, never counted (auth/receipts must never
 *                    be capped or unsubscribed away).
 *   consent        → digest opt-out OR revoked CASL ledger row → denied.
 *   master switch  → notification_preferences.marketing_email_enabled off → denied.
 *   per-category   → the stream's toggle off → denied.
 *   cap            → over the rolling 7-day marketing cap → denied.
 * Otherwise allowed.
 */
export function decideEmailSend(params: DecideEmailSendParams): EmailGovernorDecision {
  if (params.category === "transactional") {
    return { allowed: true, reason: "transactional_exempt", category: "transactional" };
  }

  const { state } = params;

  // 1. Consent: the same rule enqueueForRecipients / optedInUsers apply.
  if (!state.digestOptIn || state.consentStatus === "revoked") {
    return { allowed: false, reason: "consent_revoked", category: "marketing" };
  }

  // 2. Preferences (absent row = all-on).
  if (state.preferences) {
    if (!state.preferences.marketingEmailEnabled) {
      return { allowed: false, reason: "marketing_disabled", category: "marketing" };
    }
    if (!state.preferences.streamEnabled) {
      return { allowed: false, reason: "user_pref", category: "marketing" };
    }
  }

  // 3. Rolling 7-day marketing cap. recentMarketingCount includes the row the
  // caller is about to claim, so `count > cap` suppresses the (cap+1)-th send.
  const cap = params.weeklyCap ?? DEFAULT_EMAIL_WEEKLY_CAP;
  if (state.recentMarketingCount > cap) {
    return { allowed: false, reason: "capped", category: "marketing" };
  }

  return { allowed: true, reason: "allowed", category: "marketing" };
}

/**
 * Read the env cap once, with a safe fallback. Exported so the server helper
 * and any producer that wants to display the cap share one definition.
 */
export function resolveWeeklyCap(rawEnvValue: string | undefined): number {
  const parsed = Number(rawEnvValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_EMAIL_WEEKLY_CAP;
  return Math.floor(parsed);
}
