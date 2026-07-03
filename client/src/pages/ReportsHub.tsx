import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO, organizationSchema, websiteSchema } from "@/components/SEO";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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

        <Card className="mb-6 overflow-hidden border-stone-200 bg-[radial-gradient(circle_at_top_right,#fde68a,transparent_30%),linear-gradient(135deg,#0f0f0f_0%,#1c1917_60%,#292524_100%)] text-stone-50">
          <CardContent className="grid gap-6 p-8 md:grid-cols-[1.3fr_0.7fr] md:items-end">
            <div>
              <Badge variant="outline" className="mb-3 border-amber-200/40 bg-amber-100/10 text-amber-100">
                New · Homies × Realist
              </Badge>
              <h2 className="text-3xl font-bold leading-tight">HomeBench: AI Benchmark for Realtors</h2>
              <p className="mt-3 max-w-2xl text-stone-300">
                Fable 5, GPT 5.5, Opus 4.8, and Gemini 3.1 scored on the work agents actually do — offers, showings, CRM, email, research, marketing, and valuation.
              </p>
            </div>
            <div className="md:text-right">
              <Link href="/reports/realbench-ai-realtor-benchmark">
                <Button className="bg-amber-400 text-stone-950 hover:bg-amber-300">See the leaderboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-10 overflow-hidden border-stone-200 bg-[radial-gradient(circle_at_top_left,#fef3c7,transparent_28%),linear-gradient(135deg,#1c1917_0%,#292524_58%,#44403c_100%)] text-stone-50">
          <CardContent className="grid gap-6 p-8 md:grid-cols-[1.3fr_0.7fr] md:items-end">
            <div>
              <Badge variant="outline" className="mb-3 border-amber-200/40 bg-amber-100/10 text-amber-100">
                New report
              </Badge>
              <h2 className="text-3xl font-bold leading-tight">Canada Immigration Dashboard 2026</h2>
              <p className="mt-3 max-w-2xl text-stone-300">
                Interactive IRCC dashboard for temporary resident approvals, permanent resident admissions, and asylum claimant movement.
              </p>
            </div>
            <div className="md:text-right">
              <Link href="/reports/canada-immigration-dashboard-2026">
                <Button className="bg-amber-500 text-stone-950 hover:bg-amber-400">Open dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-10 overflow-hidden border-stone-200 bg-[radial-gradient(circle_at_top_right,#dbeafe,transparent_28%),linear-gradient(135deg,#082f49_0%,#0f172a_55%,#1e3a8a_100%)] text-stone-50">
          <CardContent className="grid gap-6 p-8 md:grid-cols-[1.3fr_0.7fr] md:items-end">
            <div>
              <Badge variant="outline" className="mb-3 border-sky-200/40 bg-sky-100/10 text-sky-100">
                New report
              </Badge>
              <h2 className="text-3xl font-bold leading-tight">Canada Interprovincial Migration 2026</h2>
              <p className="mt-3 max-w-2xl text-stone-300">
                Interactive breakdown of the Fraser Institute migration study showing Alberta&apos;s long-run domestic migration lead, Ontario&apos;s losses, age-group flows, and housing-market implications.
              </p>
            </div>
            <div className="md:text-right">
              <Link href="/insights/canada-interprovincial-migration-2026">
                <Button className="bg-sky-300 text-slate-950 hover:bg-sky-200">Open report</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

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
