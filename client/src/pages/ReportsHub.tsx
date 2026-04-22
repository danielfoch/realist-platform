import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO, organizationSchema, websiteSchema } from "@/components/SEO";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { BlogPost } from "@shared/schema";

export default function ReportsHub() {
  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog/posts/db", "reports_hub"],
    queryFn: async () => {
      const res = await fetch("/api/blog/posts/db?category=market-analysis");
      if (!res.ok) throw new Error("Failed to load reports");
      return res.json();
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Canadian Real Estate Reports"
        description="Index of Realist market reports, housing intelligence, and research pages built for Canadian real estate investors."
        canonicalUrl="/reports"
        structuredData={{
          "@context": "https://schema.org",
          "@graph": [organizationSchema, websiteSchema],
        }}
      />
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-12">
        <div className="max-w-3xl mb-10">
          <Badge variant="outline" className="mb-3">Reports</Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Canadian Real Estate Reports</h1>
          <p className="text-lg text-muted-foreground">
            Market intelligence, pricing reports, and housing data pages designed to be crawlable, readable, and useful to investors.
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, index) => (
              <Card key={index}>
                <CardHeader>
                  <Skeleton className="h-5 w-24 mb-2" />
                  <Skeleton className="h-8 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {(posts || []).map((post) => (
              <Link key={post.slug} href={`/reports/${post.slug}`}>
                <Card className="h-full hover-elevate cursor-pointer">
                  <CardHeader className="pb-2">
                    <Badge variant="secondary" className="w-fit text-xs mb-2">
                      {post.category === "market-analysis" ? "Report" : post.category}
                    </Badge>
                    <h2 className="text-xl font-semibold leading-tight">{post.title}</h2>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{post.excerpt}</p>
                    <p className="text-xs text-muted-foreground">
                      {post.publishedAt
                        ? new Date(post.publishedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })
                        : "Draft"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
