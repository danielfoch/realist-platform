import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { JsonLd } from "@/components/JsonLd";
import { eyebrowClass, primaryButtonClass, secondaryButtonClass } from "@/components/auth/shared";
import { focusRing, textLinkClass } from "@/components/community/TrackRecord";
import { YouStrip } from "@/components/community/YouStrip";
import { fmtNum } from "@/components/multiplex/format";
import { PERIODS, boardHref, cityLabel, getBoardMarkets, parseCity, parsePeriod, scoringPoints } from "@/lib/analyses/board";
import { BADGES, getLeaderboard, type LeaderboardPeriod, type LeaderboardRow } from "@/lib/analyses/community";
import { safeCity } from "@/lib/analyses/profile";
import { DAILY_NEW_ANALYSIS_CAP } from "@/lib/analyses/store";
import { breadcrumbNode, jsonLdDocument } from "@/lib/seo/jsonld";

export const revalidate = 300;

const BOARD_SIZE = 50;

/**
 * Reading `searchParams` renders this page per request, so the five-minute
 * cache sits on the queries instead: one entry per period and market, shared
 * by every visitor. Who is looking is layered on in the browser (YouStrip).
 * A failed query throws straight through and is never cached.
 */
const loadBoard = unstable_cache(
  async (period: LeaderboardPeriod, city: string | null) => getLeaderboard(period, { city, limit: BOARD_SIZE }),
  ["leaderboard-rows"],
  { revalidate, tags: ["leaderboard"] },
);
const loadMarkets = unstable_cache(async (period: LeaderboardPeriod) => getBoardMarkets(period), ["leaderboard-markets"], {
  revalidate,
  tags: ["leaderboard"],
});

export async function generateMetadata(props: PageProps<"/community/leaderboard">): Promise<Metadata> {
  const query = await props.searchParams;
  const period = parsePeriod(query.period);
  const city = parseCity(query.city);
  const phrase = PERIODS.find((entry) => entry.key === period)?.phrase ?? "this week";
  return {
    title: `Leaderboard — who's underwriting the most deals ${phrase}`,
    description:
      "Canadian real estate investors ranked by quality-weighted deals underwritten on Realist. Every deal counts once, careful analysis beats volume, and the board resets every Monday.",
    // A market filter is a view of the board, not a page of its own.
    alternates: { canonical: boardHref({ period }) },
    robots: city ? { index: false, follow: true } : undefined,
  };
}

const TOP = 3;

/** `showMarkets` is off on a single-market board, where the answer is always one. */
function Board({ rows, caption, showMarkets }: { rows: LeaderboardRow[]; caption: string; showMarkets: boolean }) {
  const headClass = `${eyebrowClass} border-b border-hairline py-3 text-ink-faint`;
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
      <table className="w-full table-fixed border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={`${headClass} w-12 pl-4 sm:w-16 sm:pl-6`}>
              <span className="sr-only">Rank</span>
              <span aria-hidden="true">#</span>
            </th>
            <th scope="col" className={`${headClass} pr-3`}>
              Member
            </th>
            <th scope="col" className={`${headClass} hidden w-40 pr-3 sm:table-cell`}>
              City
            </th>
            <th scope="col" className={`${headClass} w-14 pr-3 text-right sm:w-20`}>
              Deals
            </th>
            <th scope="col" className={`${headClass} w-16 pr-4 text-right sm:w-24 sm:pr-6`}>
              Score
            </th>
            {showMarkets && (
              <th scope="col" className={`${headClass} hidden w-24 pr-6 text-right sm:table-cell`}>
                Markets
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((row) => {
            const top = row.rank <= TOP;
            const city = safeCity(row.city);
            const pad = top ? "py-4" : "py-3";
            return (
              <tr key={row.userId}>
                <td className={`relative ${pad} pl-4 align-middle sm:pl-6`}>
                  {top && <span className="absolute inset-y-3 left-0 w-[3px] bg-accent" aria-hidden="true" />}
                  <span className={`tnum ${top ? "font-display text-2xl font-semibold leading-none text-ink" : "text-sm text-ink-faint"}`}>
                    {row.rank}
                  </span>
                </td>
                <th scope="row" className={`${pad} pr-3 align-middle font-normal`}>
                  <Link
                    href={`/u/${encodeURIComponent(row.userId)}`}
                    className={`block truncate text-ink hover:text-brand ${focusRing} ${top ? "text-base font-semibold" : "text-sm font-medium"}`}
                  >
                    {row.name}
                  </Link>
                  <span className="mt-0.5 block truncate text-xs text-ink-faint sm:hidden">
                    {[city, showMarkets ? `${fmtNum(row.markets)} ${row.markets === 1 ? "market" : "markets"}` : null].filter(Boolean).join(" · ")}
                  </span>
                </th>
                <td className={`${pad} hidden truncate pr-3 align-middle text-sm text-ink-soft sm:table-cell`}>{city ?? "—"}</td>
                <td className={`tnum ${pad} pr-3 text-right align-middle text-sm text-ink-soft`}>{fmtNum(row.deals)}</td>
                <td className={`tnum ${pad} pr-4 text-right align-middle font-semibold text-ink sm:pr-6 ${top ? "text-base" : "text-sm"}`}>
                  {fmtNum(row.score)}
                </td>
                {showMarkets && (
                  <td className={`tnum ${pad} hidden pr-6 text-right align-middle text-sm text-ink-soft sm:table-cell`}>{fmtNum(row.markets)}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function LeaderboardPage(props: PageProps<"/community/leaderboard">) {
  const query = await props.searchParams;
  const period = parsePeriod(query.period);
  const active = PERIODS.find((entry) => entry.key === period) ?? PERIODS[0];
  const markets = await loadMarkets(period).catch(() => []);
  // A market filter is one of the board's own markets or it is nothing: a hand-typed ?city= never
  // becomes a heading or a chip (someone else's words on our page), and never gets a cache entry.
  const requested = parseCity(query.city);
  const city = requested && markets.some((market) => market.city.toLowerCase() === requested.toLowerCase()) ? requested : null;
  const cityName = city ? cityLabel(city) : null;
  const rows = await loadBoard(period, city?.toLowerCase() ?? null).catch((error: Error) => {
    console.error("[leaderboard]", error.message);
    return null;
  });

  const chips = markets.map((market) => market.city);
  const points = scoringPoints();
  const heading = cityName ? `${active.label} · ${cityName}` : active.label;
  const chipClass = (on: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-medium transition-colors ${focusRing} ${
      on ? "border-ink bg-ink text-white" : "border-hairline-strong bg-surface text-ink-soft hover:border-ink hover:text-ink"
    }`;

  return (
    <>
      <JsonLd
        json={jsonLdDocument(
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "Community", path: "/community" },
            { name: "Leaderboard", path: "/community/leaderboard" },
          ]),
        )}
      />

      <section className="border-b border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <p className={`${eyebrowClass} text-brand`}>Leaderboard</p>
          <h1 className="font-display mt-2 max-w-3xl text-3xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            Who&rsquo;s underwriting the most <em>deals</em>.
          </h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">
            Ranked by quality-weighted deals underwritten. Every deal counts once, a worked analysis is worth more than a glance, and the
            weekly board resets every Monday.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <YouStrip period={period} phrase={active.phrase} filtered={Boolean(city)} />

        <section aria-labelledby="board-heading" className="mt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h2 id="board-heading" className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
              {heading}
            </h2>
            <nav aria-label="Leaderboard period" className="flex gap-5 border-b border-hairline text-sm">
              {PERIODS.map((entry) => {
                const on = entry.key === period;
                return (
                  <Link
                    key={entry.key}
                    href={boardHref({ period: entry.key, city })}
                    aria-current={on ? "page" : undefined}
                    className={`-mb-px border-b-2 pb-2 transition-colors ${focusRing} ${
                      on ? "border-accent font-semibold text-ink" : "border-transparent font-medium text-ink-faint hover:text-ink"
                    }`}
                  >
                    {entry.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {chips.length > 0 && (
            <nav aria-label="Filter by market" className="mt-4 flex flex-wrap items-center gap-1.5">
              <Link href={boardHref({ period })} aria-current={city ? undefined : "true"} className={chipClass(!city)}>
                All markets
              </Link>
              {chips.map((name) => {
                const on = cityName?.toLowerCase() === name.toLowerCase();
                return (
                  <Link key={name} href={boardHref({ period, city: name })} aria-current={on ? "true" : undefined} className={chipClass(on)}>
                    {name}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="mt-5">
            {rows === null ? (
              <div className="rounded-lg border border-hairline bg-surface p-8">
                <h3 className="font-display text-lg font-semibold">The board is briefly unavailable.</h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
                  Nothing is lost — every analysis is still being logged. Give it a minute and reload.
                </p>
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-lg border border-hairline bg-surface p-8">
                <h3 className="font-display text-lg font-semibold">
                  {cityName ? `Nobody has underwritten a deal in ${cityName} ${active.phrase === "all time" ? "yet" : active.phrase}.` : "Nobody's on the board yet."}
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
                  {period === "week" ? "The board resets every Monday. " : ""}
                  Underwrite a deal and you&rsquo;re on it.
                </p>
                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <Link href="/listings" className={textLinkClass}>
                    Browse listings →
                  </Link>
                  <Link href="/underwrite" className={textLinkClass}>
                    Underwrite any deal →
                  </Link>
                  {city && (
                    <Link href={boardHref({ period })} className={textLinkClass}>
                      See all markets →
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <>
                <Board showMarkets={!city} rows={rows} caption={`Members ranked by quality-weighted deals underwritten, ${active.phrase}${cityName ? `, in ${cityName}` : ""}`} />
                <p className="mt-3 text-xs leading-relaxed text-ink-faint">
                  {cityName ? `Counting only deals underwritten in ${cityName}. ` : ""}
                  {rows.length >= BOARD_SIZE ? `Top ${BOARD_SIZE} shown. ` : ""}
                  Members appear as &ldquo;First L.&rdquo; and can step off the board in account settings. Updated every five minutes.
                </p>
              </>
            )}
          </div>
        </section>
      </div>

      <section aria-labelledby="scoring-heading" className="border-t border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 id="scoring-heading" className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            How scoring <em>works</em>
          </h2>
          <div className="mt-7 grid gap-x-10 gap-y-7 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">One deal counts once.</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                Come back and change your numbers as often as you like — it&rsquo;s still one deal, scored on your latest numbers.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">Careful beats careless.</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                Making your call on our starting numbers is worth <span className="tnum font-medium text-ink">{points.untouched}</span> points.
                Change one or two of them and it&rsquo;s <span className="tnum font-medium text-ink">{points.light}</span>; work three or more
                and it&rsquo;s <span className="tnum font-medium text-ink">{points.worked}</span>. Your score is the total — so one deal you
                really underwrote beats four you glanced at.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">Implausible numbers never count.</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                A deal needs a price and a rent, and results a real rental could produce: a cap rate between −10% and 25%, cash-on-cash
                between −50% and 60%, debt coverage between 0 and 4. Past {DAILY_NEW_ANALYSIS_CAP} new deals in a day, the rest wait for tomorrow.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">A free account is the price of a place.</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                Anonymous analyses aren&rsquo;t ranked. Sign in and the deals you ran on this device come with you. Weeks run Monday to
                Sunday and months by the calendar, on UTC.
              </p>
            </div>
          </div>

          <h3 className={`${eyebrowClass} mt-10 text-ink-faint`}>The badge ladder · deals underwritten</h3>
          <ol className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-3 lg:grid-cols-6">
            {[...BADGES].reverse().map((badge) => (
              <li key={badge.name} className="bg-surface px-4 py-3">
                <span className="tnum block text-lg font-semibold text-ink">{fmtNum(badge.at)}</span>
                <span className="mt-0.5 block text-xs text-ink-soft">{badge.name}</span>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/listings" className={`${primaryButtonClass} ${focusRing}`}>
              Underwrite a listing
            </Link>
            <Link href="/underwrite" className={`${secondaryButtonClass} ${focusRing}`}>
              Underwrite any deal
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
