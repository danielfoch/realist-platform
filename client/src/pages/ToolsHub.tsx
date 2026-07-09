import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { SHARED_ROUTE_META } from "@shared/routeMeta";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Calculator, MapPin, Handshake, TrendingUp, FileSpreadsheet, DollarSign,
  Building2, Scale, ArrowLeftRight, Shield, Gavel, BriefcaseBusiness,
  Sparkles, Layers, Inbox, ArrowRight, Bell, Gauge,
} from "lucide-react";
import { NextStepBlock } from "@/components/NextStepBlock";

interface Tool {
  href: string;
  title: string;
  description: string;
  icon: typeof Calculator;
  badge?: string;
  primary?: boolean;
}

interface ToolSection {
  title: string;
  description: string;
  tools: Tool[];
}

// Grouped by the job the investor is doing, not by when we shipped the tool.
const sections: ToolSection[] = [
  {
    title: "Analyze",
    description: "Underwrite a property you already have your eye on.",
    tools: [
      {
        href: "/tools/analyzer",
        title: "Deal Analyzer",
        description: "Analyze any deal with institutional-grade calculations — yields, IRR, cash-on-cash, and multi-year projections. Includes MLI Select and renovation-estimate modes.",
        icon: Calculator,
        primary: true,
      },
      {
        href: "/tools/multiplex-underwriter",
        title: "Multiplex Underwriter",
        description: "Address-first AI underwrite: zoning, envelope, risk flags, and a machine-verified narrative report for multiplex conversions.",
        icon: Sparkles,
        badge: "AI",
        primary: true,
      },
      {
        href: "/tools/multiplex-feasibility",
        title: "Multiplex Feasibility",
        description: "Screen any property for multiplex development potential. Ontario Bill 23 + Toronto multiplex by-law logic with confidence scoring.",
        icon: Building2,
      },
      {
        href: "/tools/will-it-plex",
        title: "Will It Plex?",
        description: "Full financial pro forma for multiplex strategies. Import listings, configure financing, MLI Select points, and export your analysis.",
        icon: Layers,
      },
      {
        href: "/compare",
        title: "Compare Analyses",
        description: "Compare multiple deal analyses side-by-side to make informed investment decisions.",
        icon: FileSpreadsheet,
      },
    ],
  },
  {
    title: "Find deals",
    description: "Source properties worth underwriting.",
    tools: [
      {
        href: "/tools/cap-rates",
        title: "Yield Map",
        description: "Browse MLS listings by cap rate and rental yield. Find the highest-returning properties across markets with pre-calculated returns.",
        icon: TrendingUp,
      },
      {
        href: "/tools/cap-rates?deals=power_of_sale,motivated,vtb&distressOnly=1",
        title: "Motivated Deals",
        description: "Find power-of-sale, court-ordered, bank-owned, motivated sellers, and seller-financing opportunities across Canadian MLS listings.",
        icon: Gavel,
      },
      {
        href: "/tools/buybox",
        title: "BuyBox Builder",
        description: "Define your investment criteria and let realtors find properties that match your specific requirements.",
        icon: MapPin,
      },
      {
        href: "/tools/coinvest",
        title: "Co-Invest Finder",
        description: "Find investment partners to pool capital and share expertise on real estate deals.",
        icon: Handshake,
      },
    ],
  },
  {
    title: "Costs & financing",
    description: "Understand what a purchase really costs and how to finance it.",
    tools: [
      {
        href: "/tools/financing-readiness",
        title: "Financing Readiness",
        description: "Five inputs, thirty seconds: your stress-tested maximum purchase price, monthly payment, and readiness grade — then book a free consultation to make it real.",
        icon: Gauge,
        badge: "New",
        primary: true,
      },
      {
        href: "/tools/true-cost",
        title: "True Cost Calculator",
        description: "Discover all the hidden costs when buying a home in Ontario — development charges, land transfer taxes, HST rebates, and more.",
        icon: DollarSign,
      },
      {
        href: "/tools/hst-rebate",
        title: "Ontario HST Rebate",
        description: "Estimate buyer savings from the proposed Ontario new home HST relief policy and register for final-rule updates.",
        icon: DollarSign,
      },
      {
        href: "/tools/rent-vs-buy",
        title: "Rent vs Buy",
        description: "Compare the true financial impact of renting versus buying over time, factoring appreciation, opportunity cost, and maintenance.",
        icon: Scale,
      },
      {
        href: "/tools/rent-to-own",
        title: "Buy vs Rent-to-Own",
        description: "Compare a CMHC-insured purchase against a rent-to-own pathway — upfront cash, monthly cost, equity path, and total 5-year cost, side by side.",
        icon: Scale,
        badge: "New",
      },
      {
        href: "/tools/fixed-vs-variable",
        title: "Fixed vs Variable",
        description: "Compare total interest costs for fixed vs variable mortgages over 5, 10, and 25 years with stress-test scenarios.",
        icon: ArrowLeftRight,
      },
    ],
  },
  {
    title: "Due diligence & workspace",
    description: "Verify the details and keep your pipeline organized.",
    tools: [
      {
        href: "/tools/land-claim-screener",
        title: "Land Claim Screener",
        description: "Screen properties for potential overlap with historic treaties, modern treaties, and Indigenous agreement areas using official federal data.",
        icon: Shield,
      },
      {
        href: "/tools/investor-os",
        title: "My Deals",
        description: "Save deals, add structured notes, compare opportunities, and request professional feedback on your pipeline.",
        icon: BriefcaseBusiness,
        badge: "Preview",
      },
      {
        href: "/watchlist",
        title: "Watchlist & Alerts",
        description: "Watch listings and saved searches, and get alerted when prices drop or new matches appear.",
        icon: Bell,
        badge: "New",
      },
      {
        href: "/tools/deal-desk",
        title: "Deal Desk",
        description: "Submit a deal you're analyzing and our team will review it, score it, and reach out about next steps.",
        icon: Inbox,
      },
    ],
  },
];

export default function ToolsHub() {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={SHARED_ROUTE_META["/tools"].title}
        description={SHARED_ROUTE_META["/tools"].description}
        canonicalUrl="/tools"
      />
      <Navigation />

      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Investment Tools</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Professional-grade calculators and tools to analyze, compare, and optimize your real estate investments.
          </p>
        </div>

        <NextStepBlock
          title="Not sure where to start?"
          sourcePage="/tools"
          className="mb-12"
        />

        <div className="space-y-12">
          {sections.map((section) => (
            <section key={section.title}>
              <div className="mb-5">
                <h2 className="text-xl font-semibold">{section.title}</h2>
                <p className="text-sm text-muted-foreground">{section.description}</p>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {section.tools.map((tool) => {
                  const testIdBase = tool.title.toLowerCase().replace(/\s+/g, "-").replace(/\?/g, "");
                  return (
                    <Link key={tool.href} href={tool.href} data-testid={`link-${testIdBase}`} className="block h-full">
                      <Card className={`h-full hover-elevate cursor-pointer transition-all ${tool.primary ? "border-primary/50 bg-primary/5" : ""}`} data-testid={`card-${testIdBase}`}>
                        <CardHeader className="h-full flex flex-col">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${tool.primary ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                            <tool.icon className="h-6 w-6" />
                          </div>
                          <CardTitle className="text-xl flex items-center gap-2">
                            <span data-testid={`text-title-${testIdBase}`}>{tool.title}</span>
                            {tool.badge && <Badge variant="secondary" className="text-xs" data-testid={`badge-${testIdBase}`}>{tool.badge}</Badge>}
                          </CardTitle>
                          <CardDescription className="text-sm flex-1">{tool.description}</CardDescription>
                          <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                            Open tool
                            <ArrowRight className="h-3.5 w-3.5" />
                          </div>
                        </CardHeader>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
