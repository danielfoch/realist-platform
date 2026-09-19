import { fmtNum } from "@/components/multiplex/format";
import { eyebrowClass } from "@/components/auth/shared";

/**
 * The pieces a track record is drawn from — the four numbers, the badge bar,
 * the call chip. Plain markup with no state, so the account page, the public
 * profile and the leaderboard's "You" strip (a client component) all share them.
 */

export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
export const textLinkClass = `font-semibold text-brand hover:text-brand-deep ${focusRing}`;

export interface TrackRecordStats {
  deals: number;
  thisWeek: number;
  streakWeeks: number;
  score: number;
}

export interface BadgeProgressValue {
  name: string;
  next: { name: string; at: number } | null;
  percent: number;
  remaining: number;
}

export function streakLabel(weeks: number): string {
  return weeks === 1 ? "1 week" : `${fmtNum(weeks)} weeks`;
}

export function dealsLabel(deals: number): string {
  return deals === 1 ? "1 deal" : `${fmtNum(deals)} deals`;
}

/** Deals underwritten · this week · streak · score. */
export function StatTiles({ stats, className = "" }: { stats: TrackRecordStats; className?: string }) {
  const tiles: Array<{ label: string; value: string; hint?: string }> = [
    { label: "Deals underwritten", value: fmtNum(stats.deals) },
    { label: "This week", value: fmtNum(stats.thisWeek) },
    {
      label: "Streak",
      value: stats.streakWeeks > 0 ? streakLabel(stats.streakWeeks) : "—",
      hint: stats.streakWeeks > 0 ? "A deal a week keeps it alive" : "Starts with one deal this week",
    },
    { label: "Score", value: fmtNum(stats.score), hint: "Quality-weighted" },
  ];
  return (
    <dl className={`grid grid-cols-2 gap-3 sm:grid-cols-4 ${className}`}>
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-lg border border-hairline bg-surface px-4 py-3">
          <dt className={`${eyebrowClass} text-ink-faint`}>{tile.label}</dt>
          <dd className="tnum mt-1 text-xl font-semibold text-ink">{tile.value}</dd>
          {tile.hint && <dd className="mt-0.5 text-[11px] leading-snug text-ink-faint">{tile.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** The badge a member holds and a thin bar toward the next one. */
export function BadgeProgress({ badge, deals }: { badge: BadgeProgressValue; deals: number }) {
  const next = badge.next;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-ink">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" aria-hidden="true" />
          {badge.name || "No badge yet"}
        </p>
        <p className="tnum text-[11px] text-ink-faint">{next ? `${fmtNum(deals)} / ${fmtNum(next.at)}` : `${fmtNum(deals)} deals`}</p>
      </div>
      <div
        role="progressbar"
        aria-label={next ? `Progress to the ${next.name} badge` : "Badge ladder complete"}
        aria-valuemin={0}
        aria-valuemax={next ? next.at : deals}
        aria-valuenow={deals}
        className="mt-2 h-1 overflow-hidden rounded-full bg-raised"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${badge.percent}%` }} />
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
        {next ? (
          <>
            <span className="tnum">{fmtNum(badge.remaining)}</span> more to <span className="font-semibold text-ink">{next.name}</span>
          </>
        ) : (
          "Top of the ladder."
        )}
      </p>
    </div>
  );
}

const CALL_LABEL = { pursue: "Pursue", watch: "Watch", pass: "Pass" } as const;
const CALL_CLASS = {
  pursue: "border-ink bg-ink text-white",
  watch: "border-hairline-strong bg-surface text-ink",
  pass: "border-hairline bg-paper text-ink-faint",
} as const;

/** A person's own call on a deal. The word carries the meaning; the fill only echoes it. */
export function VerdictChip({ verdict }: { verdict: "pursue" | "watch" | "pass" | null | undefined }) {
  if (!verdict) return <span className="text-[11px] text-ink-faint">No call</span>;
  return (
    <span className={`inline-block rounded-[3px] border px-2 py-0.5 text-[11px] font-semibold ${CALL_CLASS[verdict]}`}>
      {CALL_LABEL[verdict]}
    </span>
  );
}
