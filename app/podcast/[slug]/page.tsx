import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  durationToIso8601,
  getEpisodePayload,
  getPodcastEpisodes,
  stripShowNotes,
} from "@/lib/podcast/feed";
import { EpisodePlayer } from "@/components/podcast/EpisodePlayer";
import { JsonLd } from "@/components/JsonLd";
import {
  breadcrumbNode,
  jsonLdDocument,
  podcastEpisodeNode,
  podcastSeriesNode,
} from "@/lib/seo/jsonld";
import { PODCAST_APPLE_URL, PODCAST_NAME, PODCAST_SPOTIFY_URL } from "@/lib/brand";

export const revalidate = 3600;

/** Prerender the most recent episodes at build; older slugs render on demand. */
export async function generateStaticParams() {
  try {
    const episodes = await getPodcastEpisodes();
    return episodes.slice(0, 25).map((episode) => ({ slug: episode.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/podcast/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const payload = await getEpisodePayload(slug).catch(() => null);
  if (!payload) return { title: "Episode not found" };
  const description = stripShowNotes(payload.description, 160);
  return {
    title: `${payload.title} — ${PODCAST_NAME}`,
    description,
    keywords: payload.keywords,
    alternates: { canonical: `/podcast/${slug}` },
    openGraph: {
      title: payload.title,
      description,
      type: "article",
      images: payload.imageUrl ? [{ url: payload.imageUrl }] : undefined,
    },
  };
}

function formatDate(pubDate: string): string {
  const date = new Date(pubDate);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function EpisodePage({ params }: PageProps<"/podcast/[slug]">) {
  const { slug } = await params;
  const payload = await getEpisodePayload(slug).catch(() => null);
  if (!payload) notFound();

  const jsonLd = jsonLdDocument(
    podcastSeriesNode(),
    podcastEpisodeNode({
      slug: payload.slug,
      title: payload.title,
      description: stripShowNotes(payload.description, 300),
      pubDate: payload.pubDate,
      audioUrl: payload.audioUrl,
      durationIso: durationToIso8601(payload.duration),
      imageUrl: payload.imageUrl,
    }),
    breadcrumbNode([
      { name: "Home", path: "/" },
      { name: "Podcast", path: "/podcast" },
      { name: payload.title, path: `/podcast/${payload.slug}` },
    ]),
  );

  return (
    <>
      <JsonLd json={jsonLd} />

      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <nav className="text-xs text-ink-faint" aria-label="Breadcrumb">
          <Link href="/podcast" className="hover:text-brand">
            ← All episodes
          </Link>
        </nav>

        <header className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">
            {PODCAST_NAME} · {formatDate(payload.pubDate)}
          </p>
          <h1 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {payload.title}
          </h1>
          {payload.topics.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {payload.topics.map((topic) => (
                <span
                  key={topic}
                  className="rounded-full border border-hairline bg-surface px-2.5 py-0.5 text-xs font-medium text-ink-faint"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
        </header>

        <div className="mt-6">
          <EpisodePlayer audioUrl={payload.audioUrl} title={payload.title} />
          <p className="mt-2 text-xs text-ink-faint">
            Also on{" "}
            <a className="text-brand hover:underline" href={PODCAST_APPLE_URL} target="_blank" rel="noopener noreferrer">
              Apple Podcasts
            </a>{" "}
            and{" "}
            <a className="text-brand hover:underline" href={PODCAST_SPOTIFY_URL} target="_blank" rel="noopener noreferrer">
              Spotify
            </a>
            .
          </p>
        </div>

        {payload.enrichment?.summaryHtml && (
          <section className="mt-8 rounded-xl border border-hairline bg-surface p-5">
            <h2 className="font-display text-lg font-semibold">Episode briefing</h2>
            <div
              className="prose-notes mt-2 text-[15px]"
              dangerouslySetInnerHTML={{ __html: payload.enrichment.summaryHtml }}
            />
            {payload.enrichment.keyTakeaways && payload.enrichment.keyTakeaways.length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t border-hairline pt-3 text-sm text-ink-soft">
                {payload.enrichment.keyTakeaways.map((takeaway) => (
                  <li key={takeaway} className="flex gap-2">
                    <span className="text-brand">▸</span>
                    {takeaway}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="prose-notes mt-8 text-[15px]">
          <div dangerouslySetInnerHTML={{ __html: payload.showNotesHtml }} />
        </section>

        {payload.enrichment?.relatedResearch && payload.enrichment.relatedResearch.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
              Related research
            </h2>
            <ul className="mt-2 space-y-1.5">
              {payload.enrichment.relatedResearch.map((item) => (
                <li key={item.href}>
                  <a className="text-sm font-medium text-brand hover:underline" href={item.href}>
                    {item.label} →
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Contextual tool CTA */}
        <aside className="mt-10 rounded-xl border border-brand/40 bg-brand-wash/50 p-6">
          <p className="font-display text-lg font-semibold">{payload.cta.copy}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={payload.cta.primary.href}
              className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-deep"
            >
              {payload.cta.primary.label}
            </Link>
            {payload.cta.secondary && (
              <Link
                href={payload.cta.secondary.href}
                className="rounded-md border border-brand/40 px-4 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand-wash"
              >
                {payload.cta.secondary.label}
              </Link>
            )}
          </div>
        </aside>

        {payload.related.length > 0 && (
          <section className="mt-10 border-t border-hairline pt-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
              Related episodes
            </h2>
            <ul className="mt-3 space-y-2.5">
              {payload.related.map((related) => (
                <li key={related.slug}>
                  <Link
                    href={`/podcast/${related.slug}`}
                    className="text-sm font-medium text-ink-soft hover:text-brand"
                  >
                    {related.title}
                  </Link>
                  <span className="tnum ml-2 text-xs text-ink-faint">
                    {formatDate(related.pubDate)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </>
  );
}
