/**
 * Analyst badge ladder + milestone-progress math (pure, shared).
 *
 * Single source of truth for the deal-count badge thresholds that were
 * previously duplicated inline in server/routes.ts (/api/user-performance and
 * /api/user-stats). Lives in shared/ so the ladder and the "how far to the next
 * badge" math are unit-testable without a database, and so the daily-glance
 * dashboard (server/routes.ts /api/dashboard/glance) surfaces the same numbers
 * the My Performance page and the leaderboard emails already show.
 *
 * NOTE: this is the *badge* ladder (earned by lifetime analyses). It is
 * deliberately distinct from ANALYSIS_MILESTONES in shared/retentionPolicy.ts,
 * which gates behavioural retention emails on a different threshold set.
 */

export interface AnalystBadge {
  /** Lifetime analyses required to earn the badge. */
  threshold: number;
  /** Display name. */
  name: string;
  /** lucide-react icon id used by the client badge rows. */
  icon: string;
}

/** The badge ladder, ascending by threshold. */
export const ANALYST_BADGES: readonly AnalystBadge[] = [
  { threshold: 10, name: "Analyst", icon: "search" },
  { threshold: 50, name: "Power User", icon: "zap" },
  { threshold: 100, name: "Deal Hunter", icon: "target" },
  { threshold: 250, name: "Veteran", icon: "shield" },
  { threshold: 500, name: "Legend", icon: "crown" },
] as const;

export interface MilestoneProgress {
  /** Total analyses the count was measured against. */
  totalDeals: number;
  /** Highest badge already earned, or null before the first threshold. */
  currentBadge: AnalystBadge | null;
  /** Next badge to earn, or null once the top badge is earned. */
  nextBadge: AnalystBadge | null;
  /** Analyses remaining to the next badge (0 once maxed out). */
  dealsToNext: number;
  /**
   * Progress toward the next badge as a 0–100 integer. When the top badge is
   * already earned this is 100. This measures progress from the CURRENT badge
   * threshold to the NEXT one, so a user just past a threshold reads near 0,
   * not near 100 — a truer "how close am I" bar than count/nextThreshold.
   */
  progressPercent: number;
}

/**
 * Compute badge standing + progress toward the next badge for a lifetime
 * analysis count. Pure; safe for non-finite / negative input (treated as 0).
 */
export function computeMilestoneProgress(
  totalDeals: number,
  badges: readonly AnalystBadge[] = ANALYST_BADGES,
): MilestoneProgress {
  const count = Number.isFinite(totalDeals) && totalDeals > 0 ? Math.floor(totalDeals) : 0;
  const currentBadge = badges.filter((b) => count >= b.threshold).pop() ?? null;
  const nextBadge = badges.find((b) => count < b.threshold) ?? null;
  const dealsToNext = nextBadge ? nextBadge.threshold - count : 0;

  let progressPercent = 100;
  if (nextBadge) {
    const floor = currentBadge ? currentBadge.threshold : 0;
    const span = nextBadge.threshold - floor;
    progressPercent = span > 0
      ? Math.max(0, Math.min(100, Math.round(((count - floor) / span) * 100)))
      : 0;
  }

  return { totalDeals: count, currentBadge, nextBadge, dealsToNext, progressPercent };
}
