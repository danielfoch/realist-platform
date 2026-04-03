import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Calendar, Clock, User } from "lucide-react";
import { format } from "date-fns";
import type { BlogPost } from "@shared/schema";

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
  return new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
}

function estimateReadTime(content: string): number {
  const text = stripHtml(content);
  const wordsPerMinute = 200;
  const words = text.split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

const categories = [
  { value: "all", label: "All" },
  { value: "market-analysis", label: "Market Analysis" },
  { value: "strategy", label: "Strategy" },
  { value: "deal-breakdown", label: "Deal Breakdown" },
  { value: "news", label: "News" },
];

export default function Blog() {
  const [selectedCategory, setSelectedCategory] = useState("all");

  const { data: dbPosts, isLoading: dbLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog/posts/db"],
    staleTime: 1000 * 60 * 5,
  });

  const { data: rssData, isLoading: rssLoading } = useQuery<RSSFeedResponse>({
    queryKey: ["/api/blog/posts"],
    staleTime: 1000 * 60 * 30,
  });

  const filteredPosts = (dbPosts || []).filter(
    (p) => selectedCategory === "all" || p.category === selectedCategory
  );

  const substackPosts = rssData?.items || [];

  const categoryLabels: Record<string, string> = {
    "market-analysis": "Market Analysis",
    "strategy": "Strategy",
    "deal-breakdown": "Deal Breakdown",
    "news": "News",
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Canadian Real Estate Blog - Market Analysis & Investment Tips"
        description="Expert insights on Canadian real estate investing from Daniel Foch and the Realist.ca team. Toronto market analysis, BRRR strategies, multiplex investing tips, and wealth-building advice for Canadian investors."
        keywords="canadian real estate blog, toronto real estate news, real estate investing tips canada, daniel foch blog, housing market analysis canada, BRRR strategy guide, rental property investing"
        canonicalUrl="/insights/blog"
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
        </div>

        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-2" data-testid="text-substack-label">
            From Our Substack
          </h2>
          <h3 className="text-xl font-semibold mb-6 text-muted-foreground" data-testid="text-realist-blog-heading">
            Monthly Real Estate Market Reports
          </h3>

          <div className="flex items-center flex-wrap gap-2 mb-8" data-testid="container-category-filters">
            {categories.map((cat) => (
              <Button
                key={cat.value}
                variant={selectedCategory === cat.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat.value)}
                data-testid={`button-filter-${cat.value}`}
              >
                {cat.label}
              </Button>
            ))}
          </div>

          {dbLoading && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <Skeleton className="h-48 w-full" />
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3 mt-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!dbLoading && filteredPosts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground" data-testid="text-no-db-posts">
                No articles found{selectedCategory !== "all" ? " in this category" : ""}. Check back soon!
              </p>
            </div>
          )}

          {!dbLoading && filteredPosts.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredPosts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/insights/blog/${post.slug}`}
                  className="block group"
                  data-testid={`link-db-post-${post.slug}`}
                >
                  <Card className="h-full hover-elevate transition-all duration-200">
                    {post.coverImage && (
                      <div className="aspect-video overflow-hidden">
                        <img
                          src={post.coverImage}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          data-testid={`img-db-post-${post.slug}`}
                        />
                      </div>
                    )}
                    {!post.coverImage && (
                      <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <span className="text-4xl font-bold text-primary/30">R</span>
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex items-center flex-wrap gap-2 mb-2">
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-category-${post.slug}`}>
                          {categoryLabels[post.category] || post.category}
                        </Badge>
                      </div>
                      <h3
                        className="font-semibold text-lg leading-tight line-clamp-2 group-hover:text-primary transition-colors"
                        data-testid={`text-db-post-title-${post.slug}`}
                      >
                        {post.title}
                      </h3>
                      <div className="flex items-center flex-wrap gap-3 text-sm text-muted-foreground mt-2">
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {post.authorName}
                        </span>
                        {post.publishedAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(new Date(post.publishedAt), "MMM d, yyyy")}
                          </span>
                        )}
                        {post.readTimeMinutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {post.readTimeMinutes} min
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p
                        className="text-sm text-muted-foreground line-clamp-3"
                        data-testid={`text-db-post-excerpt-${post.slug}`}
                      >
                        {post.excerpt}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
            <h2 className="text-2xl font-bold" data-testid="text-substack-heading">
              Latest Substack Posts
            </h2>
            <a
              href="https://padder.substack.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" data-testid="button-subscribe-substack">
                Subscribe on Substack
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>

          {rssLoading && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <Skeleton className="h-48 w-full" />
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3 mt-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!rssLoading && substackPosts.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground" data-testid="text-no-substack-posts">
                Unable to load Substack posts.
              </p>
              <a
                href="https://padder.substack.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3"
              >
                <Button data-testid="button-view-substack">
                  View on Substack
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </a>
            </div>
          )}

          {!rssLoading && substackPosts.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {substackPosts.map((post, index) => {
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
                    data-testid={`link-substack-post-${index}`}
                  >
                    <Card className="h-full hover-elevate transition-all duration-200">
                      {thumbnail && (
                        <div className="aspect-video overflow-hidden">
                          <img
                            src={thumbnail}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            data-testid={`img-substack-post-${index}`}
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
                          data-testid={`text-substack-post-title-${index}`}
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
                          data-testid={`text-substack-post-desc-${index}`}
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
        </section>
      </div>
    </div>
  );
}
