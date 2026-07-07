import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { SEO } from "@/components/SEO";
import { YOUTUBE_CHANNEL_URL } from "@shared/brand";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Youtube, Loader2, Play } from "lucide-react";

interface VideoListItem {
  slug: string;
  videoId: string;
  title: string;
  description: string;
  pubDate: string;
  link: string;
  thumbnailUrl: string;
  viewCount: string;
  likeCount: string;
}

export default function Videos() {
  const { data: videos, isLoading } = useQuery<VideoListItem[]>({
    queryKey: ["/api/youtube/videos"],
  });

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SEO
        title="Daniel Foch on YouTube - Canadian Real Estate Videos"
        description="Watch Daniel Foch's latest videos on the Canadian housing market, mortgages, and real estate investing. Every video has its own page with the full description."
        canonicalUrl="/insights/videos"
      />

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
            <Youtube className="w-4 h-4" />
            <span className="text-sm font-medium">Daniel Foch on YouTube</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Latest Videos</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Data-driven breakdowns of the Canadian housing market, mortgages, and real estate
            investing strategy — with an embedded player and full description on every page.
          </p>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : videos && videos.length > 0 ? (
            videos.map((video, index) => (
              <Card
                key={video.slug}
                className="hover-elevate transition-all"
                data-testid={`card-video-${index}`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Link
                      href={`/insights/videos/${video.slug}`}
                      className="relative flex-shrink-0 w-full sm:w-56 aspect-video rounded-md overflow-hidden bg-muted group"
                      data-testid={`link-video-thumb-${index}`}
                    >
                      {video.thumbnailUrl && (
                        <img
                          src={video.thumbnailUrl}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      )}
                      <span className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-10 h-10 text-white" />
                      </span>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-lg leading-tight mb-2">
                        <Link
                          href={`/insights/videos/${video.slug}`}
                          className="hover:text-primary transition-colors"
                          data-testid={`link-video-title-${index}`}
                        >
                          {video.title}
                        </Link>
                      </h2>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {video.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {video.pubDate ? format(new Date(video.pubDate), "MMM d, yyyy") : "Unknown date"}
                        </span>
                        <Link
                          href={`/insights/videos/${video.slug}`}
                          className="flex items-center gap-1 hover:text-primary transition-colors font-medium"
                          data-testid={`link-video-${index}`}
                        >
                          Watch & details
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Youtube className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No videos available yet. Check back soon!</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">Subscribe on YouTube for new videos</p>
          <Button variant="outline" asChild>
            <a href={YOUTUBE_CHANNEL_URL} target="_blank" rel="noopener noreferrer" data-testid="link-youtube-channel">
              <Youtube className="w-4 h-4 mr-2" />
              @daniel_foch
            </a>
          </Button>
        </div>
      </main>
    </div>
  );
}
