import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { JsonLd } from "@/components/JsonLd";
import { eyebrowClass, formatDay, primaryButtonClass } from "@/components/auth/shared";
import { BadgeProgress, StatTiles, VerdictChip, dealsLabel, focusRing, streakLabel, textLinkClass } from "@/components/community/TrackRecord";
import { DdfAttribution } from "@/components/listings/DdfAttribution";
import { boardHref } from "@/lib/analyses/board";
import { INDEXABLE_AT, getPublicProfile, type DealCall } from "@/lib/analyses/profile";
import { breadcrumbNode, jsonLdDocument } from "@/lib/seo/jsonld";

export const revalidate = 300;

/** No profile is built ahead of time; each is rendered on its first visit, then cached. */
export function generateStaticParams() {
  return [];
}

/** generateMetadata and the page share one load. A database hiccup reads as "no such profile". */
const loadProfile = cache(async (id: string) => {
  try {
    return await getPublicProfile(id);
  } catch (error) {
    console.error("[profile]", (error as Error).message);
    return null;
  }
});

function listCities(cities: string[]): string {
  if (cities.length <= 1) return cities.join("");
  return `${cities.slice(0, -1).join(", ")} and ${cities[cities.length - 1]}`;
}

export async function generateMetadata(props: PageProps<"/u/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const profile = await loadProfile(id);
  if (!profile) return { title: "Member not found", robots: { index: false, follow: false } };

  const { stats } = profile;
  const markets = listCities(profile.topMarkets.map((market) => market.city));
  return {
    title: `${profile.name} — ${dealsLabel(stats.deals)} underwritten`,
    description: [
      `${profile.name} has underwritten ${dealsLabel(stats.deals)} on Realist`,
      stats.streakWeeks > 1 ? `, on a ${stats.streakWeeks}-week streak` : "",
      markets ? `, mostly in ${markets}` : "",
      ". See the track record — and start your own.",
    ].join(""),
    alternates: { canonical: `/u/${encodeURIComponent(profile.userId)}` },
    // A handful of deals is thin content; let a record earn its place in the index.
    robots: { index: stats.deals >= INDEXABLE_AT, follow: true },
  };
}

const CALLS: Array<{ key: DealCall; label: string; bar: string }> = [
  { key: "pursue", label: "Pursue", bar: "bg-ink" },
  { key: "watch", label: "Watch", bar: "bg-hairline-strong" },
  { key: "pass", label: "Pass", bar: "bg-raised" },
];

const cardClass = "rounded-lg border border-hairline bg-surface p-5";

export default async function ProfilePage(props: PageProps<"/u/[id]">) {
  const { id } = await props.params;
  const profile = await loadProfile(id);
  if (!profile) notFound();

  const { stats, badge, verdicts } = profile;
  const calls = verdicts.pursue + verdicts.watch + verdicts.pass;
  const showsListing = profile.recent.some((deal) => !deal.offMarket);
  const path = `/u/${encodeURIComponent(profile.userId)}`;

  return (
    <>
      <JsonLd
        json={jsonLdDocument(
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "Community", path: "/community" },
            { name: "Leaderboard", path: "/community/leaderboard" },
            { name: profile.name, path },
          ]),
        )}
      />

      <section className="border-b border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <p className={`${eyebrowClass} text-brand`}>Track record</p>
          <h1 className="font-display mt-2 break-words text-3xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            {profile.name}
            {badge.name && (
              <>
                , <em>{badge.name.toLowerCase()}</em>.
              </>
            )}
          </h1>
          <p className="mt-4 text-sm text-ink-soft">
            {[profile.city, `Member since ${formatDay(profile.memberSince)}`].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-2 max-w-2xl leading-relaxed text-ink-soft">
            <span className="tnum font-medium text-ink">{dealsLabel(stats.deals)}</span> underwritten on Realist
            {stats.streakWeeks > 1 && (
              <>
                , <span className="tnum font-medium text-ink">{streakLabel(stats.streakWeeks)}</span> running
              </>
            )}
            .
          </p>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-10">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="profile-numbers">
            <h2 id="profile-numbers" className="sr-only">
              The numbers and badge
            </h2>
            <StatTiles stats={stats} />
            <div className={`${cardClass} mt-3`}>
              <BadgeProgress badge={badge} deals={stats.deals} />
            </div>
          </section>

          <section aria-labelledby="profile-recent">
            <h2 id="profile-recent" className="font-display text-xl font-semibold tracking-tight">
              Recently underwritten
            </h2>
            <p className="mt-1.5 text-sm text-ink-soft">
              The cap rate each deal came out at, and the call made on it. Off-market deals stay anonymous.
            </p>
            {profile.recent.length > 0 ? (
              <ul className="mt-4 divide-y divide-hairline border-y border-hairline">
                {profile.recent.map((deal, index) => (
                  <li key={`${deal.at}-${index}`} className="flex items-center justify-between gap-4 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {deal.href ? (
                          <Link href={deal.href} className={`hover:text-brand ${focusRing}`}>
                            {deal.label}
                          </Link>
                        ) : (
                          deal.label
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ink-faint">
                        {[deal.offMarket ? deal.province : [deal.city, deal.province].filter(Boolean).join(", "), formatDay(new Date(deal.at))]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <p className="text-right">
                        <span className="tnum block text-sm font-semibold text-ink">{deal.capRate == null ? "—" : `${deal.capRate.toFixed(1)}%`}</span>
                        <span className="block text-[10px] uppercase tracking-[1.3px] text-ink-faint">cap</span>
                      </p>
                      <span className="w-14 text-right">
                        <VerdictChip verdict={deal.verdict} />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-lg border border-hairline bg-surface p-5 text-sm text-ink-soft">
                These analyses are kept private. The counts above still stand.
              </p>
            )}
            {showsListing && (
              <div className="mt-4">
                <DdfAttribution />
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4" aria-label="Calls and markets">
          <section aria-labelledby="profile-calls" className={cardClass}>
            <h2 id="profile-calls" className={`${eyebrowClass} text-ink-faint`}>
              The calls they make
            </h2>
            {calls > 0 ? (
              <>
                <div className="mt-4 flex h-1.5 overflow-hidden rounded-full border border-hairline" aria-hidden="true">
                  {CALLS.map((call) => (
                    <span key={call.key} className={call.bar} style={{ width: `${(verdicts[call.key] / calls) * 100}%` }} />
                  ))}
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-3">
                  {CALLS.map((call) => (
                    <div key={call.key}>
                      <dt className="text-xs text-ink-soft">{call.label}</dt>
                      <dd className="tnum mt-0.5 text-lg font-semibold text-ink">{Math.round((verdicts[call.key] / calls) * 100)}%</dd>
                      <dd className="tnum text-[11px] text-ink-faint">{dealsLabel(verdicts[call.key])}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">No calls made yet.</p>
            )}
          </section>

          <section aria-labelledby="profile-markets" className={cardClass}>
            <h2 id="profile-markets" className={`${eyebrowClass} text-ink-faint`}>
              Where they look
            </h2>
            {profile.topMarkets.length > 0 ? (
              <ol className="mt-3 space-y-2">
                {profile.topMarkets.map((market) => (
                  <li key={market.city} className="flex items-baseline justify-between gap-3 text-sm">
                    <Link href={boardHref({ period: "all", city: market.city })} className={`truncate font-medium text-ink hover:text-brand ${focusRing}`}>
                      {[market.city, market.province].filter(Boolean).join(", ")}
                    </Link>
                    <span className="tnum shrink-0 text-xs text-ink-faint">{dealsLabel(market.deals)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">No public markets yet.</p>
            )}
            <div className="mt-4 border-t border-hairline pt-4">
              <p className={`${eyebrowClass} text-ink-faint`}>Median cap rate they underwrite at</p>
              <p className="tnum mt-1 text-xl font-semibold text-ink">{profile.medianCapRate == null ? "—" : `${profile.medianCapRate.toFixed(1)}%`}</p>
            </div>
          </section>

          <p className="text-xs leading-relaxed text-ink-faint">
            Counts include every deal that scored; the detail here is drawn only from analyses left public.{" "}
            <Link href="/community/leaderboard" className={textLinkClass}>
              See the leaderboard →
            </Link>
          </p>
        </aside>
      </div>

      <section className="band-night">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Start your own track <em>record</em>.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
              Every listing on Realist opens already underwritten. Change a number, make your call, and it&rsquo;s on your record.
            </p>
          </div>
          <Link
            href="/listings"
            className={`${primaryButtonClass} shrink-0 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
          >
            Underwrite your first deal
          </Link>
        </div>
      </section>
    </>
  );
}
