import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, Clock, User } from "lucide-react";
import { format } from "date-fns";
import type { BlogPost as BlogPostType } from "@shared/schema";

export default function BlogPost() {
  const [, params] = useRoute("/insights/blog/:slug");
  const slug = params?.slug;

  const { data: post, isLoading, error } = useQuery<BlogPostType>({
    queryKey: ["/api/blog/posts/db", slug],
    queryFn: async () => {
      const res = await fetch(`/api/blog/posts/db/${slug}`);
      if (!res.ok) throw new Error("Post not found");
      return res.json();
    },
    enabled: !!slug,
  });

  const { data: allPosts } = useQuery<BlogPostType[]>({
    queryKey: ["/api/blog/posts/db"],
  });

  const relatedPosts = allPosts
    ?.filter((p) => p.slug !== slug && p.category === post?.category)
    .slice(0, 3) || [];

  const categoryLabels: Record<string, string> = {
    "market-analysis": "Market Analysis",
    "strategy": "Strategy",
    "deal-breakdown": "Deal Breakdown",
    "news": "News",
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={post?.metaTitle || post?.title || "Blog Post"}
        description={post?.metaDescription || post?.excerpt || "Read this article on Realist.ca"}
        canonicalUrl={post?.category === "market-analysis" ? `/reports/${slug}` : `/insights/blog/${slug}`}
        ogImage={post?.coverImage || undefined}
        ogType="article"
      />
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
        <Link href="/insights/blog">
          <Button variant="ghost" size="sm" className="mb-6 gap-2" data-testid="button-back-to-blog">
            <ArrowLeft className="h-4 w-4" />
            Back to Blog
          </Button>
        </Link>

        {isLoading && (
          <div className="space-y-6">
            <Skeleton className="h-64 w-full rounded-md" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <div className="space-y-3 mt-8">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        )}

        {error && (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4" data-testid="text-post-error">
              This blog post could not be found.
            </p>
            <Link href="/insights/blog">
              <Button data-testid="button-browse-blog">Browse All Posts</Button>
            </Link>
          </div>
        )}

        {!isLoading && !error && post && (
          <article>
            {post.coverImage && (
              <div className="aspect-video overflow-hidden rounded-md mb-8">
                <img
                  src={post.coverImage}
                  alt={post.title}
                  className="w-full h-full object-cover"
                  data-testid="img-post-cover"
                />
              </div>
            )}

            <div className="mb-6">
              <Badge variant="secondary" data-testid="badge-post-category">
                {categoryLabels[post.category] || post.category}
              </Badge>
            </div>

            <h1
              className="text-3xl md:text-4xl font-bold mb-4 leading-tight"
              data-testid="text-post-title"
            >
              {post.title}
            </h1>

            <div className="flex items-center flex-wrap gap-4 text-sm text-muted-foreground mb-8">
              <span className="flex items-center gap-1.5" data-testid="text-post-author">
                <User className="h-4 w-4" />
                {post.authorName}
              </span>
              {post.publishedAt && (
                <span className="flex items-center gap-1.5" data-testid="text-post-date">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(post.publishedAt), "MMMM d, yyyy")}
                </span>
              )}
              {post.readTimeMinutes && (
                <span className="flex items-center gap-1.5" data-testid="text-post-readtime">
                  <Clock className="h-4 w-4" />
                  {post.readTimeMinutes} min read
                </span>
              )}
            </div>

            {post.excerpt && (
              <p className="text-lg text-muted-foreground mb-8 border-l-2 border-primary/30 pl-4" data-testid="text-post-excerpt">
                {post.excerpt}
              </p>
            )}

            <div
              className="prose prose-neutral dark:prose-invert max-w-none"
              data-testid="content-post-body"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {post.tags && post.tags.length > 0 && (
              <div className="flex items-center flex-wrap gap-2 mt-8 pt-6 border-t" data-testid="container-post-tags">
                {post.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </article>
        )}

        {!isLoading && !error && relatedPosts.length > 0 && (
          <section className="mt-16 pt-8 border-t">
            <h2 className="text-2xl font-bold mb-6" data-testid="text-related-heading">
              Related Articles
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {relatedPosts.map((rp) => (
                <Link key={rp.slug} href={rp.category === "market-analysis" ? `/reports/${rp.slug}` : `/insights/blog/${rp.slug}`}>
                  <Card className="h-full hover-elevate transition-all duration-200" data-testid={`card-related-${rp.slug}`}>
                    {rp.coverImage && (
                      <div className="aspect-video overflow-hidden">
                        <img
                          src={rp.coverImage}
                          alt={rp.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <Badge variant="secondary" className="w-fit text-xs mb-1">
                        {categoryLabels[rp.category] || rp.category}
                      </Badge>
                      <h3 className="font-semibold leading-tight line-clamp-2">
                        {rp.title}
                      </h3>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {rp.excerpt}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
