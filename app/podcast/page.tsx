import Link from "next/link";
import type { Metadata } from "next";
import { getPodcastEpisodes, stripShowNotes } from "@/lib/podcast/feed";
import { EpisodePlayer } from "@/components/podcast/EpisodePlayer";
import { JsonLd } from "@/components/JsonLd";
import { jsonLdDocument, podcastSeriesNode, breadcrumbNode } from "@/lib/seo/jsonld";
import { deriveEpisodeTopics } from "@/lib/podcast/episodes";
import {
  PODCAST_APPLE_URL,
  PODCAST_NAME,
  PODCAST_SPOTIFY_URL,
  PODCAST_YOUTUBE_URL,
} from "@/lib/brand";

export const revalidate = 1800;

const RECENT_COUNT = 24;

export const metadata: Metadata = {
  title: `${PODCAST_NAME} — Canada's #1 Real Estate Podcast`,
  description:
    "Every episode of The Canadian Real Estate Investor with Daniel Foch and Nick Hill: markets, rates, rentals, multiplexes, and the numbers behind Canadian real estate investing. New episodes Tuesdays and Fridays.",
  alternates: { canonical: "/podcast" },
};

function formatDate(pubDate: string): string {
  const date = new Date(pubDate);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function PodcastPage() {
  const episodes = await getPodcastEpisodes().catch(() => []);
  const [latest, ...older] = episodes;
  // The recent ones get the full treatment; the back catalogue is a compact archive of links.
  // Every episode stays one click (and one crawl) away without shipping 400 descriptions.
  const rest = older.slice(0, RECENT_COUNT);
  const archive = new Map<string, typeof older>();
  for (const episode of older.slice(RECENT_COUNT)) {
    const year = String(new Date(episode.pubDate).getUTCFullYear() || "Earlier");
    archive.set(year, [...(archive.get(year) ?? []), episode]);
  }

  return (
    <>
      <JsonLd
        json={jsonLdDocument(
          podcastSeriesNode(),
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "Podcast", path: "/podcast" },
          ]),
        )}
      />

      <section className="border-b border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">
            Canada&rsquo;s #1 real estate podcast
          </p>
          <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {PODCAST_NAME}
          </h1>
          <p className="mt-3 max-w-2xl text-ink-soft">
            Daniel Foch and Nick Hill on the markets, the math, and the mistakes of
            Canadian real estate investing. New episodes every Tuesday and Friday.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold">
            <a className="text-brand hover:text-brand-deep" href={PODCAST_APPLE_URL} target="_blank" rel="noopener noreferrer">
              Apple Podcasts ↗
            </a>
            <a className="text-brand hover:text-brand-deep" href={PODCAST_SPOTIFY_URL} target="_blank" rel="noopener noreferrer">
              Spotify ↗
            </a>
            <a className="text-brand hover:text-brand-deep" href={PODCAST_YOUTUBE_URL} target="_blank" rel="noopener noreferrer">
              YouTube ↗
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {latest && (
          <article className="rounded-xl border border-brand/40 bg-brand-wash/40 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">
              Latest episode · {formatDate(latest.pubDate)}
            </p>
            <Link
              href={`/podcast/${latest.slug}`}
              className="font-display mt-2 block text-2xl font-semibold leading-snug hover:text-brand"
            >
              {latest.title}
            </Link>
            <p className="mt-2 max-w-3xl text-sm text-ink-soft">
              {stripShowNotes(latest.description, 220)}
            </p>
            <div className="mt-4 max-w-xl">
              <EpisodePlayer audioUrl={latest.audioUrl} title={latest.title} />
            </div>
          </article>
        )}

        <div className="mt-10 divide-y divide-hairline border-t border-hairline">
          {rest.map((episode) => {
            const topics = deriveEpisodeTopics(episode.title, 3);
            return (
              <article key={episode.slug} className="flex flex-col gap-1 py-5">
                <div className="flex items-baseline justify-between gap-4">
                  <Link
                    href={`/podcast/${episode.slug}`}
                    className="font-display text-lg font-semibold leading-snug hover:text-brand"
                  >
                    {episode.title}
                  </Link>
                  <span className="tnum shrink-0 text-xs text-ink-faint">
                    {formatDate(episode.pubDate)}
                  </span>
                </div>
                <p className="line-clamp-2 max-w-3xl text-sm text-ink-soft">
                  {stripShowNotes(episode.description, 180)}
                </p>
                {topics.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {topics.map((topic) => (
                      <span
                        key={topic}
                        className="rounded-full border border-hairline bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-faint"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {archive.size > 0 && (
          <div className="mt-14">
            <h2 className="font-display text-2xl font-semibold tracking-tight">Every episode</h2>
            {[...archive.entries()].map(([year, list]) => (
              <details key={year} className="group border-b border-hairline py-4" open={false}>
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink">
                  <span>
                    {year} <span className="tnum font-normal text-ink-faint">· {list.length} episodes</span>
                  </span>
                  <span className="text-brand transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <ul className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  {list.map((episode) => (
                    <li key={episode.slug} className="text-sm leading-snug">
                      <Link href={`/podcast/${episode.slug}`} className="text-ink-soft hover:text-brand">
                        {episode.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}

        {episodes.length === 0 && (
          <p className="py-12 text-center text-ink-soft">
            The episode feed is warming up — listen on{" "}
            <a className="text-brand underline" href={PODCAST_APPLE_URL}>
              Apple Podcasts
            </a>{" "}
            in the meantime.
          </p>
        )}
      </section>
    </>
  );
}
