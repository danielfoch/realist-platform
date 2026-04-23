import { useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { track } from "@/lib/analytics";
import {
  Radio, BookOpen, FileText, TrendingUp, AlertTriangle, LineChart,
  Calculator, ArrowRight, BarChart3, ChevronRight, Building2,
} from "lucide-react";

const insightItems = [
  {
    href: "/insights/podcast",
    title: "Podcast",
    description: "In-depth conversations with Canadian real estate investors, analysts, and operators. Real deals, real numbers.",
    icon: Radio,
    badge: "Audio",
    cta: "Listen Now",
  },
  {
    href: "/insights/blog",
    title: "Blog & Research",
    description: "Market analysis, investment strategies, and data-driven perspectives for Canadian real estate investors.",
    icon: BookOpen,
    badge: "Articles",
    cta: "Read Articles",
  },
  {
    href: "/insights/guides",
    title: "Guides & Resources",
    description: "Step-by-step guides, templates, and frameworks for underwriting, financing, and operating real estate.",
    icon: FileText,
    badge: "Education",
    cta: "View Guides",
  },
  {
    href: "/reports/cmhc-land-use-regulations-housing-canada-2026",
    title: "CMHC Land Use Regulations Report",
    description: "What CMHC's 2026 research says about zoning, approval rules, house prices, and housing supply growth in Canada.",
    icon: Building2,
    badge: "CMHC 2026",
    cta: "Read Report",
  },
  {
    href: "/insights/mortgage-rates",
    title: "Mortgage Rates",
    description: "Current best rates across Canada with historical context — fixed vs. variable, insured vs. conventional.",
    icon: TrendingUp,
    badge: "Live",
    cta: "See Rates",
  },
  {
    href: "/insights/distress-report",
    title: "Distress Report",
    description: "Monthly snapshot of power of sale, foreclosures, motivated sellers, and VTB opportunities across Canada.",
    icon: AlertTriangle,
    badge: "Monthly",
    cta: "View Report",
  },
  {
    href: "/insights/cpi-march-2026",
    title: "CPI Report — March 2026",
    description: "Statistics Canada's latest inflation release with provincial breakdown and investor interpretation.",
    icon: LineChart,
    badge: "March 2026",
    cta: "Read Report",
  },
];

// Contextual bridges: content-specific prompts that route into product
const contextBridges: Record<string, { text: string; cta: string; href: string }> = {
  "Mortgage Rates": {
    text: "See how today's rates affect your deal returns",
    cta: "Model a Deal",
    href: "/tools/analyzer",
  },
  "CPI Report — March 2026": {
    text: "Run inflation assumptions through a live deal",
    cta: "Analyze a Deal",
    href: "/tools/analyzer",
  },
  "Distress Report": {
    text: "Search live distress opportunities in your market",
    cta: "Find Deals",
    href: "/tools/distress-deals",
  },
};

export default function InsightsHub() {
  useEffect(() => {
    track({ event: "page_viewed", path: "/insights", title: "Market Intelligence" });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-3 text-xs">Updated Monthly</Badge>
          <h1 className="text-4xl font-bold mb-3">Market Intelligence</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Data and analysis interpreted for Canadian real estate investors. From macro trends to deal-level implications.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
          {insightItems.map((item) => {
            const bridge = contextBridges[item.title];
            return (
              <Card
                key={item.href}
                className="h-full hover-elevate border-border/60 group flex flex-col"
              >
                <CardContent className="p-6 flex flex-col flex-1 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <item.icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">{item.badge}</Badge>
                  </div>

                  <div className="flex-1">
                    <h2 className="text-base font-semibold mb-1.5">{item.title}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>

                  <div className="space-y-2 pt-2">
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

                    {/* Content → Analyzer bridge */}
                    {bridge && (
                      <Link href={bridge.href}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full gap-1.5 text-xs text-muted-foreground hover:text-primary"
                          onClick={() => track({ event: "cta_clicked", cta: bridge.cta, location: `insights_hub_${item.title}`, destination: bridge.href })}
                        >
                          <Calculator className="h-3 w-3" />
                          {bridge.text}
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
