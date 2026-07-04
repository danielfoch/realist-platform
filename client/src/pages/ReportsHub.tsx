import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO, organizationSchema, websiteSchema } from "@/components/SEO";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { BlogPost } from "@shared/schema";
import { sortedReports, reportDateLabel, type ReportKind } from "@shared/reportsRegistry";

const kindLabels: Record<ReportKind, string> = {
  macro: "Macro",
  market: "Market Data",
  research: "Research",
};

// Newest-first, straight from the registry — no hand-picked marquee cards.
const allReports = sortedReports();
const latestRelease = allReports[0];
const gridReports = allReports.filter((entry) => entry.slug !== latestRelease.slug);
const registrySlugs = new Set(allReports.map((entry) => entry.slug));

export default function ReportsHub() {
  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog/posts/db", "reports_hub"],
    queryFn: async () => {
      const res = await fetch("/api/blog/posts/db?category=market-analysis");
      if (!res.ok) throw new Error("Failed to load reports");
      return res.json();
    },
  });

  // The registry grid already lists registered db-backed reports, so the
  // archive below only shows db posts the registry does not know about.
  const archivePosts = (posts || []).filter((post) => !registrySlugs.has(post.slug));

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
            Market reports, housing data, and research for Canadian real estate investors — newest first.
          </p>
        </div>

        <Card className="mb-10 overflow-hidden border-stone-200 bg-[radial-gradient(circle_at_top_right,#fde68a,transparent_30%),linear-gradient(135deg,#0f0f0f_0%,#1c1917_60%,#292524_100%)] text-stone-50">
          <CardContent className="grid gap-6 p-8 md:grid-cols-[1.3fr_0.7fr] md:items-end">
            <div>
              <Badge variant="outline" className="mb-3 border-amber-200/40 bg-amber-100/10 text-amber-100">
                Latest · {reportDateLabel(latestRelease)}
              </Badge>
              <h2 className="text-3xl font-bold leading-tight">{latestRelease.title}</h2>
              <p className="mt-3 max-w-2xl text-stone-300">{latestRelease.description}</p>
            </div>
            <div className="md:text-right">
              <Link href={latestRelease.route}>
                <Button className="bg-amber-400 text-stone-950 hover:bg-amber-300" data-testid="button-latest-report">
                  Open report
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-12" data-testid="grid-registry-reports">
          {gridReports.map((entry) => (
            <Link key={entry.slug} href={entry.route}>
              <Card className="h-full hover-elevate cursor-pointer" data-testid={`card-report-${entry.slug}`}>
                <CardHeader className="pb-2">
                  <Badge variant="secondary" className="w-fit text-xs mb-2">
                    {kindLabels[entry.kind]}
                  </Badge>
                  <h2 className="text-xl font-semibold leading-tight">{entry.title}</h2>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{entry.description}</p>
                  <p className="text-xs text-muted-foreground">{reportDateLabel(entry)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
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
        ) : archivePosts.length > 0 ? (
          <section>
            <h2 className="text-2xl font-bold mb-6">Report Archive</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {archivePosts.map((post) => (
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
          </section>
        ) : null}
      </main>
    </div>
  );
}
