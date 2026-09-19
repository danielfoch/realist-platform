"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { eyebrowClass } from "@/components/auth/shared";
import { fmtNum } from "@/components/multiplex/format";
import { BadgeProgress, focusRing, streakLabel, type BadgeProgressValue, type TrackRecordStats } from "./TrackRecord";

/**
 * The viewer's own place on the board. The leaderboard itself is rendered once
 * and cached for everyone; who is looking is layered on here, in the browser,
 * from /api/me/track-record.
 */

type Period = "week" | "month" | "all";

interface TrackRecord {
  signedIn: boolean;
  userId?: string;
  showOnLeaderboard?: boolean;
  stats: TrackRecordStats | null;
  badge: BadgeProgressValue | null;
  rank: Record<Period, number | null> | null;
}

// On the dark band the brighter red is the one that clears contrast for a focus ring.
const linkOnNight =
  "font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function YouStrip({ period, phrase, filtered }: { period: Period; phrase: string; filtered: boolean }) {
  // undefined while loading; null when it couldn't be loaded.
  const [record, setRecord] = useState<TrackRecord | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    fetch("/api/me/track-record", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: TrackRecord | null) => {
        if (alive) setRecord(body);
      })
      .catch(() => {
        if (alive) setRecord(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Hold the space so the board doesn't jump when the answer arrives.
  if (record === undefined) return <div className="min-h-[6rem]" aria-hidden="true" />;
  if (record === null) return null;

  if (!record.signedIn) {
    return (
      <div className="flex min-h-[5.5rem] flex-col justify-center gap-1 rounded-lg border border-hairline bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="text-sm leading-relaxed text-ink-soft">
          <span className="font-semibold text-ink">Not on the board yet?</span> Every deal you underwrite counts once you have a free account —
          including the ones you&rsquo;ve already run on this device.
        </p>
        <Link href="/login?next=/community/leaderboard" className={`shrink-0 text-sm font-semibold text-brand hover:text-brand-deep ${focusRing}`}>
          Sign in or join free →
        </Link>
      </div>
    );
  }

  const { stats, badge } = record;
  if (!stats || !badge) return null;
  const rank = record.rank?.[period] ?? null;
  const hidden = record.showOnLeaderboard === false;

  return (
    <section aria-labelledby="you-strip" className="band-night rounded-lg px-5 py-5 sm:px-6">
      <div className="grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,16rem)] lg:items-center lg:gap-10">
        <div>
          <h2 id="you-strip" className={`${eyebrowClass} text-ink-faint`}>
            You · {phrase}
            {filtered ? " · all markets" : ""}
          </h2>
          {rank != null ? (
            <p className="tnum font-display mt-1 text-4xl font-semibold leading-none tracking-tight text-ink">
              <span className="text-accent" aria-hidden="true">
                #
              </span>
              <span className="sr-only">Rank </span>
              {fmtNum(rank)}
            </p>
          ) : (
            <p className="mt-1.5 text-base font-semibold leading-snug text-ink">
              {hidden ? "Hidden from the board" : stats.deals === 0 ? "No deals yet" : `Not ranked yet ${phrase}`}
            </p>
          )}
        </div>

        <dl className="grid grid-cols-3 gap-4">
          {[
            ["Deals", fmtNum(stats.deals)],
            ["This week", fmtNum(stats.thisWeek)],
            ["Streak", stats.streakWeeks > 0 ? streakLabel(stats.streakWeeks) : "—"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className={`${eyebrowClass} text-ink-faint`}>{label}</dt>
              <dd className="tnum mt-1 text-lg font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        <BadgeProgress badge={badge} deals={stats.deals} />
      </div>

      <p className="mt-4 border-t border-hairline pt-3 text-xs leading-relaxed text-ink-soft">
        {hidden ? (
          <>
            Your deals still count toward your badges.{" "}
            <Link href="/account#account-profile" className={linkOnNight}>
              Show me on the board
            </Link>
          </>
        ) : rank == null ? (
          <>
            {period === "week" ? "One deal this week puts you on it. " : "One deal that counts puts you on it. "}
            <Link href="/listings" className={linkOnNight}>
              Find a deal to underwrite
            </Link>
          </>
        ) : (
          <>
            Every careful underwrite moves you up.{" "}
            <Link href="/listings" className={linkOnNight}>
              Underwrite another
            </Link>
            {record.userId && (
              <>
                {" · "}
                <Link href={`/u/${encodeURIComponent(record.userId)}`} className={linkOnNight}>
                  Your public profile
                </Link>
              </>
            )}
          </>
        )}
      </p>
    </section>
  );
}
