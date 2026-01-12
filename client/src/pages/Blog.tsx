import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";

interface SubstackPost {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  content: string;
  thumbnail?: string;
  author?: string;
}

interface RSSFeedResponse {
  status: string;
  feed: {
    url: string;
    title: string;
    link: string;
    author: string;
    description: string;
    image: string;
  };
  items: SubstackPost[];
}

function extractImageFromContent(content: string): string | null {
  const imgMatch = content.match(/<img[^>]+src="([^"]+)"/);
  return imgMatch ? imgMatch[1] : null;
}

function stripHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

function estimateReadTime(content: string): number {
  const text = stripHtml(content);
  const wordsPerMinute = 200;
  const words = text.split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

export default function Blog() {
  const { data, isLoading, error } = useQuery<RSSFeedResponse>({
    queryKey: ["/api/blog/posts"],
    staleTime: 1000 * 60 * 30,
  });

  const posts = data?.items || [];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Canadian Real Estate Blog - Market Analysis & Investment Tips"
        description="Expert insights on Canadian real estate investing from Daniel Foch and the Realist.ca team. Toronto market analysis, BRRR strategies, multiplex investing tips, and wealth-building advice for Canadian investors."
        keywords="canadian real estate blog, toronto real estate news, real estate investing tips canada, daniel foch blog, housing market analysis canada, BRRR strategy guide, rental property investing"
        canonicalUrl="/blog"
      />
      <Navigation />
      
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-blog-title">
            Blog
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-blog-subtitle">
            Insights on Canadian real estate investing, market analysis, and wealth-building strategies from The Canadian Real Estate Investor Podcast.
          </p>
          <a 
            href="https://padder.substack.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block mt-4"
          >
            <Button variant="outline" data-testid="button-subscribe-substack">
              Subscribe on Substack
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </a>
        </div>

        {isLoading && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full mt-2" />
                  <Skeleton className="h-4 w-2/3 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4" data-testid="text-blog-error">
              Unable to load blog posts at this time.
            </p>
            <a 
              href="https://padder.substack.com" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Button data-testid="button-view-substack">
                View on Substack
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
        )}

        {!isLoading && !error && posts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground" data-testid="text-no-posts">
              No blog posts found. Check back soon!
            </p>
          </div>
        )}

        {!isLoading && !error && posts.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, index) => {
              const thumbnail = post.thumbnail || extractImageFromContent(post.content);
              const description = stripHtml(post.description || post.content).substring(0, 150);
              const readTime = estimateReadTime(post.content);
              const pubDate = new Date(post.pubDate);

              return (
                <a
                  key={post.link}
                  href={post.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                  data-testid={`link-blog-post-${index}`}
                >
                  <Card className="h-full overflow-hidden hover-elevate transition-all duration-200">
                    {thumbnail && (
                      <div className="aspect-video overflow-hidden">
                        <img
                          src={thumbnail}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          data-testid={`img-blog-post-${index}`}
                        />
                      </div>
                    )}
                    {!thumbnail && (
                      <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <span className="text-4xl font-bold text-primary/30">R</span>
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <h3 
                        className="font-semibold text-lg leading-tight line-clamp-2 group-hover:text-primary transition-colors"
                        data-testid={`text-blog-post-title-${index}`}
                      >
                        {post.title}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(pubDate, "MMM d, yyyy")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {readTime} min read
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p 
                        className="text-sm text-muted-foreground line-clamp-3"
                        data-testid={`text-blog-post-desc-${index}`}
                      >
                        {description}...
                      </p>
                    </CardContent>
                  </Card>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
