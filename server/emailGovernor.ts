/**
 * Server-side email frequency governor — the thin DB layer over the pure
 * decision logic in shared/emailGovernor.ts. This is the SINGLE gate every
 * marketing/content producer calls immediately before sending.
 *
 * Canonical send-log: retention_email_log is the ONE marketing-send ledger.
 * Its shape (user_id, dedupe_key, email_type, sent_at) already fits and it
 * already backs the retention + onboarding weekly cap, so all newly-governed
 * marketing sends write there too. The rolling 7-day count is read from this
 * one table, giving a single cap across every marketing stream. (Producers
 * that historically wrote their send-record elsewhere — weeklyDigest and
 * monthlyWinner into notification_queue — keep their own per-type dedupe row
 * there for idempotency, but ALSO claim a retention_email_log row through the
 * governor so they count toward the shared cap. See each producer for the
 * ordering.)
 *
 * Consent + preferences are folded in here so the governor is the one yes/no:
 *   - users.email_digest_opt_in flag + append-only email_consent (CASL) ledger
 *     (same query enqueueForRecipients / optedInUsers use), and
 *   - notification_preferences (master marketing switch + per-stream toggle).
 */

import { sql } from "drizzle-orm";
import { db } from "./db";
import {
  decideEmailSend,
  resolveWeeklyCap,
  type EmailGovernorDecision,
  type MarketingStream,
  type UserEmailState,
} from "@shared/emailGovernor";

export type { MarketingStream } from "@shared/emailGovernor";
export type { EmailGovernorDecision } from "@shared/emailGovernor";

/**
 * Maps each governed stream to the notification_preferences boolean column
 * that toggles it. Kept here (server-only) because it's a DB-column mapping;
 * the pure logic only knows "streamEnabled".
 */
const STREAM_PREF_COLUMN: Record<MarketingStream, string> = {
  retention: "retention_tips_enabled",
  watchlist_alerts: "listing_watch_alerts_enabled",
  weekly_digest: "weekly_digest_enabled",
  monthly_rank: "monthly_rank_enabled",
  community: "community_alerts_enabled",
  podcast_digest: "podcast_digest_enabled",
  product_updates: "product_updates_enabled",
};

function weeklyCap(): number {
  return resolveWeeklyCap(process.env.EMAIL_WEEKLY_CAP);
}

/**
 * Gather the consent + preference + recent-send snapshot for one user in a
 * single round trip. recentMarketingCount is computed by the caller of
 * governMarketingSend AFTER the dedupe row is claimed (so it includes the
 * just-claimed row); this function is used for the read-only preview path
 * (mayISend) where no row is claimed.
 */
async function loadUserState(
  userId: string,
  stream: MarketingStream,
  recentMarketingCount: number,
): Promise<UserEmailState> {
  const prefColumn = STREAM_PREF_COLUMN[stream];
  const result = await db.execute(sql`
    SELECT
      COALESCE(u.email_digest_opt_in, true) AS digest_opt_in,
      COALESCE((
        SELECT ec.status FROM email_consent ec
        WHERE ec.user_id = u.id AND ec.channel = 'email'
        ORDER BY ec.created_at DESC LIMIT 1
      ), 'granted') AS consent_status,
      np.marketing_email_enabled AS marketing_enabled,
      np.${sql.raw(prefColumn)} AS stream_enabled,
      np.weekly_email_frequency AS weekly_freq
    FROM users u
    LEFT JOIN notification_preferences np ON np.user_id = u.id
    WHERE u.id = ${userId}
    LIMIT 1
  `);
  const row = (result as any).rows?.[0] as
    | {
        digest_opt_in: boolean;
        consent_status: string;
        marketing_enabled: boolean | null;
        stream_enabled: boolean | null;
        weekly_freq: number | null;
      }
    | undefined;

  // No user row → treat as fully permissive (the send will fail later anyway
  // if there's no email); no notification_preferences row → prefs default on.
  const hasPrefs = row ? row.marketing_enabled !== null : false;

  return {
    digestOptIn: row ? Boolean(row.digest_opt_in) : true,
    consentStatus: row?.consent_status === "revoked" ? "revoked" : "granted",
    preferences: hasPrefs
      ? {
          marketingEmailEnabled: Boolean(row!.marketing_enabled),
          streamEnabled: Boolean(row!.stream_enabled),
        }
      : null,
    recentMarketingCount,
  };
}

/** Per-user weekly-frequency override (notification_preferences), else the env/default cap. */
async function effectiveCap(userId: string): Promise<number> {
  const result = await db.execute(sql`
    SELECT weekly_email_frequency AS f FROM notification_preferences WHERE user_id = ${userId} LIMIT 1
  `);
  const raw = (result as any).rows?.[0]?.f;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  return weeklyCap();
}

/** Rolling-7-day marketing send count from the canonical ledger. */
async function countRecentMarketing(userId: string): Promise<number> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM retention_email_log
    WHERE user_id = ${userId} AND sent_at > ${weekAgo} AND email_type != 'capped'
  `);
  return Number((result as any).rows?.[0]?.n || 0);
}

export interface GovernResult extends EmailGovernorDecision {
  /**
   * True only when the caller may proceed to actually send. Convenience alias
   * for `allowed` so call sites read `if (!gate.ok) return;`.
   */
  ok: boolean;
}

/**
 * THE marketing gate. Atomically claims the per-type dedupe row in the
 * canonical ledger, then applies the governor (consent + prefs + rolling cap).
 * On a fresh claim that passes, the row is kept as the send record (the caller
 * then performs the actual Resend/queue send). On any denial the claimed row is
 * removed for 'consent_revoked' / 'user_pref' / 'marketing_disabled' (so the
 * trigger can fire again once the user re-opts-in) but KEPT for 'capped' (so a
 * capped trigger is burned, not retried after the window clears) — matching the
 * long-standing retention trySend semantics.
 *
 * dedupeKey MUST be the producer's existing per-type key (milestone:5,
 * weekly_leaderboard_digest:uid:week, monthly_winner:uid:month, …) so the
 * governor's global cap composes WITH, not instead of, per-type dedupe.
 */
export async function governMarketingSend(params: {
  userId: string;
  stream: MarketingStream;
  emailType: string;
  dedupeKey: string;
}): Promise<GovernResult> {
  const { userId, stream, emailType, dedupeKey } = params;

  // 1. Claim the dedupe row first (unique index collapses concurrent sweeps).
  const inserted = await db.execute(sql`
    INSERT INTO retention_email_log (user_id, dedupe_key, email_type)
    VALUES (${userId}, ${dedupeKey}, ${emailType})
    ON CONFLICT (user_id, dedupe_key) DO NOTHING
    RETURNING id
  `);
  const claimedId = (inserted as any).rows?.[0]?.id as string | undefined;
  if (!claimedId) {
    // Already handled this exact trigger before — never resend.
    return { ok: false, allowed: false, reason: "capped", category: "marketing" };
  }

  // 2. Count includes the row we just claimed; decide.
  const cap = await effectiveCap(userId);
  const recent = await countRecentMarketing(userId);
  const state = await loadUserState(userId, stream, recent);
  const decision = decideEmailSend({ category: "marketing", stream, state, weeklyCap: cap });

  if (!decision.allowed) {
    if (decision.reason === "capped") {
      // Burn the trigger: keep the claimed row so it isn't retried later.
    } else {
      // Consent/preference denial: release the claimed row so the trigger can
      // fire again if the user re-opts-in before the next natural trigger.
      await db.execute(sql`DELETE FROM retention_email_log WHERE id = ${claimedId}`);
    }
    return { ok: false, ...decision };
  }

  return { ok: true, ...decision };
}
