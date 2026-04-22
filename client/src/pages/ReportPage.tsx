import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, Clock, User } from "lucide-react";
import { format } from "date-fns";
import type { BlogPost } from "@shared/schema";

export default function ReportPage() {
  const [, params] = useRoute("/reports/:slug");
  const slug = params?.slug;

  const { data: post, isLoading, error } = useQuery<BlogPost>({
    queryKey: ["/api/blog/posts/db", slug, "report_page"],
    queryFn: async () => {
      const res = await fetch(`/api/blog/posts/db/${slug}`);
      if (!res.ok) throw new Error("Report not found");
      return res.json();
    },
    enabled: !!slug,
  });

  const { data: relatedReports = [] } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog/posts/db", "related_reports"],
    queryFn: async () => {
      const res = await fetch("/api/blog/posts/db?category=market-analysis");
      if (!res.ok) throw new Error("Failed to load related reports");
      return res.json();
    },
  });

  const related = relatedReports.filter((item) => item.slug !== slug).slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={post?.metaTitle || post?.title || "Report"}
        description={post?.metaDescription || post?.excerpt || "Read this Realist report."}
        canonicalUrl={`/reports/${slug}`}
        ogImage={post?.coverImage || undefined}
        ogType="article"
      />
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-8">
        <Link href="/reports">
          <Button variant="ghost" size="sm" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Reports
          </Button>
        </Link>

        {isLoading && (
          <div className="space-y-6">
            <Skeleton className="h-64 w-full rounded-md" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        )}

        {error && (
          <div className="py-16 text-center">
            <p className="text-muted-foreground mb-4">This report could not be found.</p>
            <Link href="/reports">
              <Button>Browse Reports</Button>
            </Link>
          </div>
        )}

        {!isLoading && !error && post && (
          <>
            {post.coverImage && (
              <div className="aspect-video overflow-hidden rounded-md mb-8">
                <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
              </div>
            )}

            <div className="mb-6">
              <Badge variant="secondary">Report</Badge>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">{post.title}</h1>
            <div className="flex items-center flex-wrap gap-4 text-sm text-muted-foreground mb-8">
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                {post.authorName}
              </span>
              {post.publishedAt && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(post.publishedAt), "MMMM d, yyyy")}
                </span>
              )}
              {post.readTimeMinutes && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {post.readTimeMinutes} min read
                </span>
              )}
            </div>

            {post.excerpt && (
              <p className="text-lg text-muted-foreground mb-8 border-l-2 border-primary/30 pl-4">
                {post.excerpt}
              </p>
            )}

            <article
              className="prose prose-neutral dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {related.length > 0 && (
              <section className="mt-16 pt-8 border-t">
                <h2 className="text-2xl font-bold mb-6">Related Reports</h2>
                <div className="grid gap-6 md:grid-cols-3">
                  {related.map((item) => (
                    <Link key={item.slug} href={`/reports/${item.slug}`}>
                      <Card className="h-full hover-elevate cursor-pointer">
                        <CardHeader className="pb-2">
                          <Badge variant="secondary" className="w-fit text-xs mb-2">Report</Badge>
                          <h3 className="font-semibold leading-tight line-clamp-2">{item.title}</h3>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground line-clamp-3">{item.excerpt}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
