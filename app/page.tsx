import Link from "next/link";
import type { Metadata } from "next";
import { getPodcastEpisodes, stripShowNotes } from "@/lib/podcast/feed";
import { EpisodePlayer } from "@/components/podcast/EpisodePlayer";
import { JsonLd } from "@/components/JsonLd";
import { jsonLdDocument, podcastSeriesNode } from "@/lib/seo/jsonld";
import {
  PODCAST_APPLE_URL,
  PODCAST_NAME,
  PODCAST_SPOTIFY_URL,
} from "@/lib/brand";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Realist — Institutional-grade tools for regular real estate investors",
  description:
    "From the hosts of Canada's #1 real estate podcast: browse pre-underwritten listings across Canada, underwrite Toronto multiplex sites in seconds, and find motivated-seller deals.",
  alternates: { canonical: "/" },
};

const TOOL_CARDS = [
  {
    href: "/multiplex",
    kicker: "Toronto",
    title: "Multiplex Underwriter",
    body: "Type an address, get a development-grade answer: zoning permissions, buildable envelope, unit configurations, sample massing boards, and a CMHC MLI Select proforma.",
    cta: "Underwrite a site",
    highlight: true,
  },
  {
    href: "/listings",
    kicker: "Canada-wide",
    title: "Pre-underwritten listings",
    body: "Every MLS® listing scored with rent estimates from our national rent database — cap rate, cash flow, and yield before you book a showing.",
    cta: "Browse listings",
  },
  {
    href: "/deals",
    kicker: "Motivated sellers",
    title: "Power of sale, VTB & distress",
    body: "A continuously updated database of power-of-sale, foreclosure, and vendor take-back listings across Canada, plus the monthly distress report.",
    cta: "Find deals",
  },
] as const;

export default async function HomePage() {
  const episodes = await getPodcastEpisodes().catch(() => []);
  const latest = episodes[0];
  const recent = episodes.slice(1, 4);

  return (
    <>
      <JsonLd json={jsonLdDocument(podcastSeriesNode())} />

      {/* Hero: the podcast is the credibility engine */}
      <section className="border-b border-hairline bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">
              From the hosts of Canada&rsquo;s #1 real estate podcast
            </p>
            <h1 className="font-display mt-4 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Institutional-grade tools for regular investors.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
              Daniel Foch and Nick Hill break down Canadian real estate twice a week
              for hundreds of thousands of investors. Realist is the toolkit behind
              the show — the same underwriting we&rsquo;d run on our own money, free.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/multiplex"
                className="rounded-md bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-deep"
              >
                Underwrite a multiplex site
              </Link>
              <Link
                href="/listings"
                className="rounded-md border border-hairline-strong bg-surface px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand"
              >
                Browse pre-underwritten listings
              </Link>
            </div>
          </div>

          {/* Latest episode card */}
          <div className="rounded-xl border border-hairline bg-paper p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
                Latest episode
              </p>
              <Link href="/podcast" className="text-xs font-semibold text-brand hover:text-brand-deep">
                All episodes →
              </Link>
            </div>
            {latest ? (
              <div className="mt-4">
                <div className="flex gap-4">
                  {latest.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={latest.imageUrl}
                      alt={PODCAST_NAME}
                      className="h-20 w-20 shrink-0 rounded-lg border border-hairline object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <Link
                      href={`/podcast/${latest.slug}`}
                      className="font-display text-lg font-semibold leading-snug hover:text-brand"
                    >
                      {latest.title}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-soft">
                      {stripShowNotes(latest.description, 140)}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <EpisodePlayer audioUrl={latest.audioUrl} title={latest.title} />
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-ink-soft">
                New episodes every Tuesday and Friday.{" "}
                <a className="text-brand underline" href={PODCAST_APPLE_URL}>
                  Listen on Apple Podcasts
                </a>{" "}
                or{" "}
                <a className="text-brand underline" href={PODCAST_SPOTIFY_URL}>
                  Spotify
                </a>
                .
              </p>
            )}
            {recent.length > 0 && (
              <ul className="mt-5 space-y-2 border-t border-hairline pt-4">
                {recent.map((episode) => (
                  <li key={episode.slug}>
                    <Link
                      href={`/podcast/${episode.slug}`}
                      className="line-clamp-1 text-sm text-ink-soft hover:text-brand"
                    >
                      {episode.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Tools */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Be excellent at a few things.
        </h2>
        <p className="mt-2 max-w-2xl text-ink-soft">
          No dashboards for the sake of dashboards. Three tools, each built to answer
          one question an investor actually asks.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {TOOL_CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={`group flex flex-col rounded-xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                "highlight" in card && card.highlight
                  ? "border-brand/40 bg-brand-wash/50"
                  : "border-hairline bg-surface"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-brand">
                {card.kicker}
              </p>
              <h3 className="font-display mt-2 text-xl font-semibold">{card.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">{card.body}</p>
              <span className="mt-4 text-sm font-semibold text-brand group-hover:text-brand-deep">
                {card.cta} →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Work with us band */}
      <section className="border-y border-hairline bg-ink text-paper">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Found a deal? Get 50% of our commission back.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-paper/70">
              Buy any property you find on Realist with our partner team and we
              rebate half our commission at closing. The tools stay free — the
              platform is paid for by deals, not subscriptions.
            </p>
          </div>
          <Link
            href="/work-with-us"
            className="shrink-0 rounded-md bg-signal px-5 py-3 text-sm font-semibold text-white transition-colors hover:brightness-110"
          >
            How it works
          </Link>
        </div>
      </section>

      {/* Community + research */}
      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-16 sm:px-6 md:grid-cols-2">
        <Link
          href="/community"
          className="group rounded-xl border border-hairline bg-surface p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">In person</p>
          <h3 className="font-display mt-2 text-xl font-semibold">Investor meetups across Canada</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            The podcast community meets monthly in Toronto, Vancouver, Calgary and
            beyond. Come argue about cap rates with people who actually own doors.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-brand group-hover:text-brand-deep">
            See upcoming events →
          </span>
        </Link>
        <Link
          href="/research"
          className="group rounded-xl border border-hairline bg-surface p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">Research</p>
          <h3 className="font-display mt-2 text-xl font-semibold">Data-first market reports</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            StatCan, CMHC, and Bank of Canada releases repackaged for investors —
            what changed, why it matters, and what it does to your underwriting.
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-brand group-hover:text-brand-deep">
            Read the research →
          </span>
        </Link>
      </section>
    </>
  );
}
