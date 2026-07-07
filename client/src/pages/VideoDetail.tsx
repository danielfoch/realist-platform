import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ExternalLink, Loader2, Youtube } from "lucide-react";
import { YOUTUBE_CHANNEL_URL } from "@shared/brand";

const BASE_URL = "https://realist.ca";

interface VideoCtaLink {
  href: string;
  label: string;
}

interface VideoPayload {
  slug: string;
  videoId: string;
  title: string;
  description: string;
  pubDate: string;
  link: string;
  thumbnailUrl: string;
  viewCount: string;
  likeCount: string;
  /** Description rendered to safe paragraph HTML server-side. */
  descriptionHtml: string;
  embedUrl: string;
  topics: string[];
  keywords: string;
  cta: { copy: string; primary: VideoCtaLink; secondary?: VideoCtaLink };
  related: Array<{ slug: string; title: string; pubDate: string; thumbnailUrl: string }>;
  /** Future AI enrichment seam — null today. */
  enrichment: { summaryHtml?: string; keyTakeaways?: string[] } | null;
}

function formatVideoDate(pubDate: string): string | null {
  const date = new Date(pubDate);
  return isNaN(date.getTime()) ? null : format(date, "MMMM d, yyyy");
}

export default function VideoDetail() {
  const [, params] = useRoute("/insights/videos/:slug");
  const slug = params?.slug;

  const { data: video, isLoading, error } = useQuery<VideoPayload>({
    queryKey: [`/api/youtube/videos/${slug}`],
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

  if (error || !video) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="mx-auto max-w-4xl px-4 py-16">
          <h1 className="text-3xl font-bold">Video not found</h1>
          <p className="mt-2 text-muted-foreground">
            This video is unavailable. Browse all videos on the videos page.
          </p>
          <Button asChild className="mt-6">
            <Link href="/insights/videos">All videos</Link>
          </Button>
        </main>
      </div>
    );
  }

  const dateLabel = formatVideoDate(video.pubDate);
  const videoUrl = `${BASE_URL}/insights/videos/${video.slug}`;
  const uploadDate = (() => {
    const date = new Date(video.pubDate);
    return isNaN(date.getTime()) ? undefined : date.toISOString();
  })();
  const plainDescription = video.descriptionHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Mirrors the server-rendered VideoObject JSON-LD in server/seoMeta.ts.
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "@id": `${videoUrl}#video`,
    name: video.title,
    description: plainDescription.slice(0, 500),
    ...(video.thumbnailUrl ? { thumbnailUrl: [video.thumbnailUrl] } : {}),
    ...(uploadDate ? { uploadDate } : {}),
    embedUrl: video.embedUrl,
    contentUrl: video.link,
    url: videoUrl,
    publisher: { "@id": `${BASE_URL}/#organization` },
    inLanguage: "en-CA",
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SEO
        title={`${video.title} - Daniel Foch`}
        description={plainDescription.slice(0, 158)}
        canonicalUrl={`/insights/videos/${video.slug}`}
        ogImage={video.thumbnailUrl || undefined}
        keywords={video.keywords}
        structuredData={structuredData}
      />

      <main className="mx-auto max-w-4xl px-4 py-12">
        <Link
          href="/insights/videos"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
          data-testid="link-back-to-videos"
        >
          <ChevronLeft className="w-4 h-4" />
          All videos
        </Link>

        <header className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary mb-4">
            <Youtube className="w-4 h-4" />
            <span className="text-xs font-medium">Daniel Foch on YouTube</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4" data-testid="text-video-title">
            {video.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {dateLabel && (
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {dateLabel}
              </span>
            )}
          </div>
          {video.topics.length > 0 && (
            <p className="mt-3 text-sm text-muted-foreground" data-testid="text-video-topics">
              <span className="font-medium text-foreground">Topics:</span> {video.topics.join(", ")}
            </p>
          )}
        </header>

        <div
          className="relative w-full mb-8 rounded-lg overflow-hidden bg-muted"
          style={{ aspectRatio: "16 / 9" }}
        >
          <iframe
            src={video.embedUrl}
            title={video.title}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            data-testid="iframe-video-player"
          />
        </div>

        {/* Future enrichment seam: when getVideoEnrichment() starts returning
            AI-written summaries/key takeaways, they render here above the raw
            description. */}
        {video.enrichment?.summaryHtml && (
          <section
            className="prose prose-neutral dark:prose-invert max-w-none mb-8"
            dangerouslySetInnerHTML={{ __html: video.enrichment.summaryHtml }}
          />
        )}
        {video.enrichment?.keyTakeaways && video.enrichment.keyTakeaways.length > 0 && (
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-3">Key Takeaways</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              {video.enrichment.keyTakeaways.map((takeaway) => (
                <li key={takeaway}>{takeaway}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">About this video</h2>
          <div
            className="prose prose-neutral dark:prose-invert max-w-none [&_a]:text-primary whitespace-pre-line"
            data-testid="text-video-description"
            // Rendered to safe paragraph HTML server-side in server/youtubeFeed.ts
            dangerouslySetInnerHTML={{ __html: video.descriptionHtml }}
          />
        </section>

        <Card className="mb-10 border-primary/30">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-2">Put this video to work</h2>
            <p className="text-muted-foreground mb-4" data-testid="text-video-cta-copy">
              {video.cta.copy}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild data-testid="button-video-cta-primary">
                <Link href={video.cta.primary.href}>{video.cta.primary.label}</Link>
              </Button>
              {video.cta.secondary && (
                <Button variant="outline" asChild data-testid="button-video-cta-secondary">
                  <Link href={video.cta.secondary.href}>{video.cta.secondary.label}</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <section className="mb-10">
          <p className="text-muted-foreground mb-3 text-sm">Watch and subscribe on YouTube</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" asChild>
              <a href={video.link} target="_blank" rel="noopener noreferrer" data-testid="link-watch-on-youtube">
                <ExternalLink className="w-4 h-4 mr-1" />
                Watch on YouTube
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={YOUTUBE_CHANNEL_URL} target="_blank" rel="noopener noreferrer" data-testid="link-video-channel">
                <Youtube className="w-4 h-4 mr-1" />
                @daniel_foch
              </a>
            </Button>
          </div>
        </section>

        {video.related.length > 0 && (
          <section>
            <h2 className="text-2xl font-semibold mb-4">Related Videos</h2>
            <div className="space-y-3">
              {video.related.map((related) => {
                const relatedDate = formatVideoDate(related.pubDate);
                return (
                  <Card key={related.slug} className="hover-elevate transition-all">
                    <CardContent className="p-4 flex gap-4 items-center">
                      {related.thumbnailUrl && (
                        <img
                          src={related.thumbnailUrl}
                          alt=""
                          loading="lazy"
                          className="w-28 aspect-video object-cover rounded-md flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <Link
                          href={`/insights/videos/${related.slug}`}
                          className="font-medium hover:text-primary transition-colors"
                          data-testid={`link-related-${related.slug}`}
                        >
                          {related.title}
                        </Link>
                        {relatedDate && (
                          <p className="text-xs text-muted-foreground mt-1">{relatedDate}</p>
                        )}
                      </div>
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
