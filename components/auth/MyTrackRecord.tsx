import Link from "next/link";
import { BadgeProgress, StatTiles, VerdictChip, focusRing, textLinkClass, type BadgeProgressValue, type TrackRecordStats } from "@/components/community/TrackRecord";
import { DdfAttribution } from "@/components/listings/DdfAttribution";
import { fmtMoney } from "@/components/multiplex/format";
import { reopenHref } from "@/lib/analyses/history";
import type { DealAnalysis } from "@/lib/db/schema";
import { formatDay } from "./shared";

/**
 * The member's own view of their track record on /account: the four numbers
 * and badge bar, then every deal they've underwritten with a way back into it.
 * Server-rendered; nothing here needs the browser.
 */

export function TrackRecordBlock({
  stats,
  badge,
  profilePath,
}: {
  stats: TrackRecordStats;
  badge: BadgeProgressValue;
  /** Null when the member has stepped off the board — there is no public page to link to. */
  profilePath: string | null;
}) {
  return (
    <div>
      <StatTiles stats={stats} />
      <div className="mt-3 rounded-lg border border-hairline bg-surface px-4 py-4">
        <BadgeProgress badge={badge} deals={stats.deals} />
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href="/community/leaderboard" className={textLinkClass}>
          See the leaderboard →
        </Link>
        {profilePath && (
          <Link href={profilePath} className={textLinkClass}>
            Your public profile →
          </Link>
        )}
      </div>
    </div>
  );
}

const FIRST_SCREEN = 8;

function signedMoney(value: number): string {
  return `${value < 0 ? "−" : "+"}${fmtMoney(Math.abs(value))}`;
}

function AnalysisRow({ row }: { row: DealAnalysis }) {
  const href = reopenHref(row);
  const title = row.address?.trim() || (row.mlsNumber ? `MLS® ${row.mlsNumber}` : "Untitled deal");
  const cashFlow = row.monthlyCashFlow;
  // A stored address usually ends in its city already; don't say it twice.
  const city = row.city && !title.toLowerCase().includes(row.city.toLowerCase()) ? row.city : null;
  return (
    <li className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">
          {href ? (
            <Link href={href} className={`hover:text-brand ${focusRing}`}>
              {title}
            </Link>
          ) : (
            title
          )}
        </p>
        <p className="tnum mt-1 flex flex-wrap gap-x-1.5 text-xs leading-relaxed text-ink-soft">
          {city && <span>{city} ·</span>}
          {row.source === "multiplex" ? (
            <span>{row.price > 0 ? `${fmtMoney(row.price)} · ` : ""}zoning, massing and CMHC proforma</span>
          ) : (
            <>
              <span>{fmtMoney(row.price)} ·</span>
              {cashFlow != null && <span className={cashFlow < 0 ? "font-medium text-bad" : undefined}>{signedMoney(cashFlow)}/mo ·</span>}
              <span>{row.capRate == null ? "— cap" : `${row.capRate.toFixed(1)}% cap`}</span>
            </>
          )}
        </p>
        <p className="mt-1 text-[11px] text-ink-faint">
          {row.source === "multiplex" ? "Multiplex underwrite" : row.mlsNumber ? "Listing" : "Off-market"} · Updated {formatDay(row.updatedAt)}
          {!row.eligible && " · Not counted: the results fall outside what a real rental produces"}
        </p>
      </div>
      <span className="shrink-0 pt-0.5">
        <VerdictChip verdict={row.verdict} />
      </span>
    </li>
  );
}

export function AnalysesList({ analyses }: { analyses: DealAnalysis[] }) {
  if (analyses.length === 0) {
    return (
      <div className="rounded-lg border border-hairline bg-surface p-8">
        <h3 className="font-display text-lg font-semibold">No deals underwritten yet</h3>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
          Open any listing, change a number or make your call, and the analysis is logged here — and counted on the leaderboard.
        </p>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/listings" className={textLinkClass}>
            Browse listings →
          </Link>
          <Link href="/underwrite" className={textLinkClass}>
            Underwrite any deal →
          </Link>
        </div>
      </div>
    );
  }

  const first = analyses.slice(0, FIRST_SCREEN);
  const rest = analyses.slice(FIRST_SCREEN);
  return (
    <div>
      <ul className="divide-y divide-hairline border-y border-hairline">
        {first.map((row) => (
          <AnalysisRow key={row.id} row={row} />
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="group">
          <summary className={`cursor-pointer list-none py-3 text-sm font-semibold text-brand hover:text-brand-deep ${focusRing}`}>
            <span className="group-open:hidden">Show {rest.length} more</span>
            <span className="hidden group-open:inline">Earlier analyses</span>
          </summary>
          <ul className="divide-y divide-hairline border-y border-hairline">
            {rest.map((row) => (
              <AnalysisRow key={row.id} row={row} />
            ))}
          </ul>
        </details>
      )}
      {analyses.some((row) => row.mlsNumber) && (
        <div className="mt-4">
          <DdfAttribution />
        </div>
      )}
    </div>
  );
}
