import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { track } from "@/lib/analytics";
import {
  Radio, BookOpen, TrendingUp, AlertTriangle, LineChart,
  Calculator, ArrowRight, BarChart3, ChevronRight, Building2, BriefcaseBusiness,
  Youtube,
} from "lucide-react";
import { sortedReports, reportDateLabel, type ReportKind } from "@shared/reportsRegistry";
import type { PublishedResearchSummary } from "@shared/researchPublishing";

type GeneratedReportSummary = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string | null;
  updatedAt: string;
};

const kindIcons: Record<ReportKind, typeof LineChart> = {
  macro: LineChart,
  market: Building2,
  research: BriefcaseBusiness,
};

const kindLabels: Record<ReportKind, string> = {
  macro: "Macro",
  market: "Market Data",
  research: "Research",
};

const kindFilters = [
  { value: "all", label: "All" },
  { value: "macro", label: "Macro" },
  { value: "market", label: "Market Data" },
  { value: "research", label: "Research" },
];

// Newest release overall drives the marquee slot — no baked month names.
const staticReports = sortedReports();

// Section 3 — Learn & Media: education and ongoing content surfaces.
const mediaItems = [
  {
    href: "/insights/guides",
    title: "Guides & Encyclopedia",
    description: "Step-by-step guides plus searchable definitions, formulas, examples, caveats, and calculator specs.",
    icon: BookOpen,
    badge: "Education",
    cta: "Open Library",
  },
  {
    href: "/insights/podcast",
    title: "Podcast",
    description: "In-depth conversations with Canadian real estate investors, analysts, and operators. Real deals, real numbers.",
    icon: Radio,
    badge: "Audio",
    cta: "Listen Now",
  },
  {
    href: "/insights/videos",
    title: "Videos",
    description: "Daniel Foch's latest YouTube videos on the Canadian housing market, mortgages, and investing strategy — with the full breakdown on every page.",
    icon: Youtube,
    badge: "Video",
    cta: "Watch Now",
  },
];

type HubItem = {
  href: string;
  title: string;
  description: string;
  icon: typeof LineChart;
  badge: string;
  cta: string;
};

function HubCard({ item }: { item: HubItem }) {
  return (
    <Card className="h-full hover-elevate border-border/60 group flex flex-col">
      <CardContent className="p-6 flex flex-col flex-1 space-y-4">
        <div className="flex items-start justify-between">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <item.icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">{item.badge}</Badge>
        </div>

        <div className="flex-1">
          <h3 className="text-base font-semibold mb-1.5">{item.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
        </div>

        <div className="pt-2">
          <Link href={item.href}>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 group-hover:border-primary/40 transition-colors"
              data-testid={`button-${item.title.toLowerCase().replace(/[\s–—]+/g, "-")}`}
              onClick={() => track({ event: "content_consumed", content_type: "report", content_id: item.href, title: item.title })}
            >
              {item.cta}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InsightsHub() {
  const [selectedKind, setSelectedKind] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");
  const { data: publishedResearch = [] } = useQuery<PublishedResearchSummary[]>({
    queryKey: ["/api/research/articles"],
    retry: false,
  });
  const { data: generatedDistressReports = [] } = useQuery<GeneratedReportSummary[]>({
    queryKey: ["/api/blog/posts/db", "distress-report", 12],
    queryFn: async () => {
      const response = await fetch("/api/blog/posts/db?category=distress-report&limit=12");
      if (!response.ok) throw new Error("Generated reports are unavailable");
      return response.json();
    },
    retry: false,
  });

  const allReports = useMemo(() => {
    const byRoute = new Map<string, (typeof staticReports)[number]>();
    for (const report of publishedResearch) {
      byRoute.set(report.route, {
        slug: report.slug,
        route: report.route,
        title: report.title,
        description: report.dek,
        date: report.publishDate,
        tags: report.tags,
        kind: report.kind,
      });
    }
    for (const report of generatedDistressReports) {
      const route = `/insights/blog/${report.slug}`;
      byRoute.set(route, {
        slug: report.slug,
        route,
        title: report.title,
        description: report.excerpt,
        date: (report.publishedAt || report.updatedAt).slice(0, 10),
        tags: ["motivated sellers", "power of sale", "VTB"],
        kind: "market",
      });
    }
    for (const report of staticReports) if (!byRoute.has(report.route)) byRoute.set(report.route, report);
    return [...byRoute.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [generatedDistressReports, publishedResearch]);
  const latestRelease = allReports[0] || staticReports[0];
  const yearFilters = useMemo(() => [
    { value: "all", label: "All years" },
    ...[...new Set(allReports.map((entry) => entry.date.slice(0, 4)))].map((year) => ({ value: year, label: year })),
  ], [allReports]);
  const liveDataItems: HubItem[] = [
    {
      href: "/insights/mortgage-rates",
      title: "Mortgage Rates",
      description: "Current best rates across Canada with historical context — fixed vs. variable, insured vs. conventional.",
      icon: TrendingUp,
      badge: "Live",
      cta: "See Rates",
    },
    {
      href: "/insights/motivated-report",
      title: "Motivated Report",
      description: "Monthly snapshot of power of sale, foreclosures, motivated sellers, and VTB opportunities across Canada.",
      icon: AlertTriangle,
      badge: "Monthly",
      cta: "View Report",
    },
    {
      href: latestRelease.route,
      title: latestRelease.title,
      description: latestRelease.description,
      icon: kindIcons[latestRelease.kind],
      badge: `Latest · ${reportDateLabel(latestRelease)}`,
      cta: "Read Report",
    },
  ];

  useEffect(() => {
    track({ event: "page_viewed", path: "/insights", title: "Market Intelligence" });
  }, []);

  const filteredReports = allReports.filter(
    (entry) =>
      (selectedKind === "all" || entry.kind === selectedKind) &&
      (selectedYear === "all" || entry.date.startsWith(selectedYear))
  );

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SEO
        title="Canadian Real Estate Research, Reports & Data | Realist.ca"
        description="Canadian housing research for regular investors: market reports, podcast evidence packs, mortgage rates, motivated listings, interactive charts, and sourced StatCan and CMHC analysis."
        canonicalUrl="/insights"
      />

      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-3 text-xs">Latest release · {reportDateLabel(latestRelease)}</Badge>
          <h1 className="text-4xl font-bold mb-3">Canadian Real Estate Research</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Institutional-grade evidence translated into decisions regular Canadian investors can actually use.
          </p>
        </div>

        <div className="space-y-10 mb-12">
          {/* Section 1 — Live Data */}
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Live Data</h2>
              <p className="text-sm text-muted-foreground">Recurring data products, monitoring pages, and the latest release.</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {liveDataItems.map((item) => (
                <HubCard key={item.href} item={item} />
              ))}
            </div>
          </section>

          {/* Section 2 — Research Library */}
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Research Library</h2>
              <p className="text-sm text-muted-foreground">Every Realist report — macro releases, market data, and long-form research, newest first.</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap" data-testid="filter-kinds">
              {kindFilters.map((filter) => (
                <Button
                  key={filter.value}
                  variant={selectedKind === filter.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedKind(filter.value)}
                  data-testid={`filter-kind-${filter.value}`}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap" data-testid="filter-years">
              {yearFilters.map((filter) => (
                <Button
                  key={filter.value}
                  variant={selectedYear === filter.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedYear(filter.value)}
                  data-testid={`filter-year-${filter.value}`}
                >
                  {filter.label}
                </Button>
              ))}
            </div>

            {filteredReports.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredReports.map((entry) => (
                  <HubCard
                    key={entry.slug}
                    item={{
                      href: entry.route,
                      title: entry.title,
                      description: entry.description,
                      icon: kindIcons[entry.kind],
                      badge: kindLabels[entry.kind],
                      cta: "Open Report",
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground" data-testid="text-no-reports">No reports match these filters.</p>
            )}
          </section>

          {/* Section 3 — Learn & Media */}
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Learn & Media</h2>
              <p className="text-sm text-muted-foreground">Education and ongoing content surfaces.</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {mediaItems.map((item) => (
                <HubCard key={item.href} item={item} />
              ))}
            </div>
          </section>
        </div>

        {/* Bottom CTA — route users into deal analyzer */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-8 text-center space-y-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Ready to run the numbers?</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Every insight here connects to a real deal. Use the free analyzer to model any property in Canada.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/tools/analyzer">
              <Button
                size="lg"
                className="gap-2"
                onClick={() => track({ event: "cta_clicked", cta: "analyze_deal", location: "insights_hub_bottom" })}
              >
                <Calculator className="h-4 w-4" />
                Analyze a Deal — Free
              </Button>
            </Link>
            <Link href="/tools/cap-rates">
              <Button
                variant="outline"
                size="lg"
                className="gap-2"
                onClick={() => track({ event: "cta_clicked", cta: "yield_map", location: "insights_hub_bottom" })}
              >
                Browse Yield Map
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
