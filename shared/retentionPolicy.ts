/**
 * Pure decision logic for behavioural retention emails
 * (server/retentionEmails.ts). Lives in shared/ so the send/suppress rules are
 * unit-testable without a database or SMTP — the server module only wires
 * these decisions to SQL and Resend.
 */

export const RETENTION_WEEKLY_CAP = 3;
export const ANALYSIS_MILESTONES = [5, 10, 25, 50, 100] as const;

export type RetentionSendDecision = "send" | "duplicate" | "capped";

/**
 * Decision core of trySend(): the dedupe row is claimed first (the unique
 * index makes concurrent sweeps collapse), then the rolling-7-day send count
 * is checked against the weekly cap.
 *
 * Semantics (deliberate, acknowledged in review):
 *  - "duplicate": the dedupe row already existed — this exact trigger was
 *    handled before; never resend.
 *  - "capped": over the weekly cap. The just-claimed dedupe row is KEPT, so a
 *    capped trigger is burned — it will not be retried after the cap clears.
 *  - `recentLogCount` INCLUDES the row claimed for this very send, so a user
 *    with `cap` prior sends arrives here at cap + 1 and is suppressed.
 */
export function decideRetentionSend(params: {
  /** False when the dedupe insert hit the unique-index conflict. */
  dedupeRowInserted: boolean;
  /** retention_email_log rows for this user in the trailing 7 days, including the row just claimed. */
  recentLogCount: number;
  weeklyCap?: number;
}): RetentionSendDecision {
  if (!params.dedupeRowInserted) return "duplicate";
  const cap = params.weeklyCap ?? RETENTION_WEEKLY_CAP;
  if (params.recentLogCount > cap) return "capped";
  return "send";
}

/**
 * Milestone guard: returns the highest milestone the user NEWLY crossed within
 * the sweep window — i.e. (lifetime - inWindow) < m <= lifetime — or null.
 *
 * Without the "newly crossed" condition, the first deploy would retroactively
 * email every recently-active user whose lifetime count passed a milestone at
 * any point in the past (anyone with >= 5 analyses).
 */
export function newlyCrossedMilestone(
  lifetimeCount: number,
  countInWindow: number,
  milestones: readonly number[] = ANALYSIS_MILESTONES,
): number | null {
  if (!Number.isFinite(lifetimeCount) || lifetimeCount <= 0) return null;
  const inWindow = Math.min(Math.max(countInWindow, 0), lifetimeCount);
  const countBeforeWindow = lifetimeCount - inWindow;
  let crossed: number | null = null;
  for (const m of milestones) {
    if (m > countBeforeWindow && m <= lifetimeCount && (crossed === null || m > crossed)) {
      crossed = m;
    }
  }
  return crossed;
}
