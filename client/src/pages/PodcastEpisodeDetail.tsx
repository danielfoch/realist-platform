import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, Clock, Headphones, Loader2 } from "lucide-react";
import {
  PODCAST_APPLE_URL,
  PODCAST_NAME,
  PODCAST_SPOTIFY_URL,
  PODCAST_YOUTUBE_URL,
} from "@shared/brand";

const BASE_URL = "https://realist.ca";

interface EpisodeCtaLink {
  href: string;
  label: string;
}

interface EpisodePayload {
  slug: string;
  title: string;
  pubDate: string;
  audioUrl: string;
  duration: string;
  link: string;
  imageUrl: string;
  /** Sanitized + encyclopedia-linked server-side (server/podcastFeed.ts). */
  showNotesHtml: string;
  topics: string[];
  keywords: string;
  cta: { copy: string; primary: EpisodeCtaLink; secondary?: EpisodeCtaLink };
  related: Array<{ slug: string; title: string; pubDate: string }>;
  /** Future AI enrichment seam — null today. */
  enrichment: { summaryHtml?: string; keyTakeaways?: string[] } | null;
}

function formatEpisodeDate(pubDate: string): string | null {
  const date = new Date(pubDate);
  return isNaN(date.getTime()) ? null : format(date, "MMMM d, yyyy");
}

export default function PodcastEpisodeDetail() {
  const [, params] = useRoute("/insights/podcast/:slug");
  const slug = params?.slug;

  const { data: episode, isLoading, error } = useQuery<EpisodePayload>({
    queryKey: [`/api/podcast/episodes/${slug}`],
    enabled: !!slug,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="mx-auto max-w-4xl px-4 py-16 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (error || !episode) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="mx-auto max-w-4xl px-4 py-16">
          <h1 className="text-3xl font-bold">Episode not found</h1>
          <p className="mt-2 text-muted-foreground">
            This episode is unavailable. Browse all episodes on the podcast page.
          </p>
          <Button asChild className="mt-6">
            <Link href="/insights/podcast">All episodes</Link>
          </Button>
        </main>
      </div>
    );
  }

  const dateLabel = formatEpisodeDate(episode.pubDate);
  const episodeUrl = `${BASE_URL}/insights/podcast/${episode.slug}`;
  const publishedIso = (() => {
    const date = new Date(episode.pubDate);
    return isNaN(date.getTime()) ? undefined : date.toISOString();
  })();

  // Mirrors the server-rendered PodcastEpisode JSON-LD in server/seoMeta.ts.
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "PodcastEpisode",
    "@id": `${episodeUrl}#episode`,
    name: episode.title,
    url: episodeUrl,
    ...(publishedIso ? { datePublished: publishedIso } : {}),
    description: episode.showNotesHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500),
    ...(episode.audioUrl
      ? { associatedMedia: { "@type": "MediaObject", contentUrl: episode.audioUrl, encodingFormat: "audio/mpeg" } }
      : {}),
    partOfSeries: {
      "@type": "PodcastSeries",
      "@id": `${BASE_URL}/insights/podcast#podcast`,
      name: PODCAST_NAME,
      url: `${BASE_URL}/insights/podcast`,
    },
    inLanguage: "en-CA",
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SEO
        title={`${episode.title} - ${PODCAST_NAME} Podcast`}
        description={structuredData.description.slice(0, 158)}
        canonicalUrl={`/insights/podcast/${episode.slug}`}
        ogImage={episode.imageUrl || undefined}
        keywords={episode.keywords}
        structuredData={structuredData}
      />

      <main className="mx-auto max-w-4xl px-4 py-12">
        <Link
          href="/insights/podcast"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
          data-testid="link-back-to-podcast"
        >
          <ChevronLeft className="w-4 h-4" />
          All episodes
        </Link>

        <header className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary mb-4">
            <Headphones className="w-4 h-4" />
            <span className="text-xs font-medium">{PODCAST_NAME}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4" data-testid="text-episode-title">
            {episode.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {dateLabel && (
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {dateLabel}
              </span>
            )}
            {episode.duration && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {episode.duration}
              </span>
            )}
          </div>
          {episode.topics.length > 0 && (
            <p className="mt-3 text-sm text-muted-foreground" data-testid="text-episode-topics">
              <span className="font-medium text-foreground">Topics:</span> {episode.topics.join(", ")}
            </p>
          )}
        </header>

        {episode.audioUrl && (
          <Card className="mb-8">
            <CardContent className="p-4">
              <audio
                controls
                preload="none"
                src={episode.audioUrl}
                className="w-full"
                data-testid="audio-episode-player"
              >
                <a href={episode.audioUrl}>Listen to {episode.title}</a>
              </audio>
            </CardContent>
          </Card>
        )}

        {/* Future enrichment seam: when getEpisodeEnrichment() starts returning
            AI-written summaries/key takeaways, they render here above the raw
            show notes. */}
        {episode.enrichment?.summaryHtml && (
          <section
            className="prose prose-neutral dark:prose-invert max-w-none mb-8"
            dangerouslySetInnerHTML={{ __html: episode.enrichment.summaryHtml }}
          />
        )}
        {episode.enrichment?.keyTakeaways && episode.enrichment.keyTakeaways.length > 0 && (
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-3">Key Takeaways</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              {episode.enrichment.keyTakeaways.map((takeaway) => (
                <li key={takeaway}>{takeaway}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">Show Notes</h2>
          <div
            className="prose prose-neutral dark:prose-invert max-w-none [&_a]:text-primary"
            data-testid="text-episode-shownotes"
            // Sanitized + encyclopedia-linked server-side in server/podcastFeed.ts
            dangerouslySetInnerHTML={{ __html: episode.showNotesHtml }}
          />
        </section>

        <Card className="mb-10 border-primary/30">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-2">Put this episode to work</h2>
            <p className="text-muted-foreground mb-4" data-testid="text-episode-cta-copy">
              {episode.cta.copy}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild data-testid="button-episode-cta-primary">
                <Link href={episode.cta.primary.href}>{episode.cta.primary.label}</Link>
              </Button>
              {episode.cta.secondary && (
                <Button variant="outline" asChild data-testid="button-episode-cta-secondary">
                  <Link href={episode.cta.secondary.href}>{episode.cta.secondary.label}</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <section className="mb-10">
          <p className="text-muted-foreground mb-3 text-sm">Listen on your favourite platform</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" asChild>
              <a href={PODCAST_APPLE_URL} target="_blank" rel="noopener noreferrer" data-testid="link-episode-apple">
                Apple Podcasts
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={PODCAST_SPOTIFY_URL} target="_blank" rel="noopener noreferrer" data-testid="link-episode-spotify">
                Spotify
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={PODCAST_YOUTUBE_URL} target="_blank" rel="noopener noreferrer" data-testid="link-episode-youtube">
                YouTube
              </a>
            </Button>
          </div>
        </section>

        {episode.related.length > 0 && (
          <section>
            <h2 className="text-2xl font-semibold mb-4">Related Episodes</h2>
            <div className="space-y-3">
              {episode.related.map((related) => {
                const relatedDate = formatEpisodeDate(related.pubDate);
                return (
                  <Card key={related.slug} className="hover-elevate transition-all">
                    <CardContent className="p-4">
                      <Link
                        href={`/insights/podcast/${related.slug}`}
                        className="font-medium hover:text-primary transition-colors"
                        data-testid={`link-related-${related.slug}`}
                      >
                        {related.title}
                      </Link>
                      {relatedDate && (
                        <p className="text-xs text-muted-foreground mt-1">{relatedDate}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
