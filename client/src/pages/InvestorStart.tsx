import { Link } from "wouter";
import { SEO, organizationSchema, websiteSchema } from "@/components/SEO";
import { SHARED_ROUTE_META } from "@shared/routeMeta";
import { Navigation } from "@/components/Navigation";
import { AnalysesCounter } from "@/components/AnalysesCounter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { getSavedListingSignals, getSavedSearchSignals, syncDiscoverySignalsWithAccount, track, trackRealistEvent } from "@/lib/analytics";
import { ArrowRight, BarChart3, Brain, Compass, Gauge, Map, PhoneCall, Radar, Radio, Save, Target } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { CANADA_SVG_PATH, CANADA_VIEWBOX } from "@/lib/canadaSilhouette";
import { mediaLogos } from "@/lib/mediaLogos";
import { SITE_STATS } from "@/lib/siteStats";

function formatCurrency(value?: number) {
  if (!value) return null;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

type CalculationParticle = {
  id: number;
  x: number;
  y: number;
  label: string;
};

const calculationLabels = [
  "cap 5.8%",
  "cash +$420",
  "rent $3,850",
  "DSCR 1.18x",
  "score 84",
  "risk med",
  "NOI $28k",
];

export default function InvestorStart() {
  const { isAuthenticated, user } = useAuth();
  const [recentSavedListing, setRecentSavedListing] = useState(() => getSavedListingSignals()[0]);
  const [recentSavedSearch, setRecentSavedSearch] = useState(() => getSavedSearchSignals()[0]);
  // First-time visitors have no history — never show them their own empty state.
  const hasResumeSignals = Boolean(recentSavedListing || recentSavedSearch);
  const [calculationParticles, setCalculationParticles] = useState<CalculationParticle[]>([]);
  const particleIdRef = useRef(0);
  const lastParticleAtRef = useRef(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    syncDiscoverySignalsWithAccount().then(() => {
      setRecentSavedListing(getSavedListingSignals()[0]);
      setRecentSavedSearch(getSavedSearchSignals()[0]);
    });
  }, [isAuthenticated]);

  const combinedSchema = {
    "@context": "https://schema.org",
    "@graph": [organizationSchema, websiteSchema],
  };

  const greeting = isAuthenticated
    ? `Welcome back${user?.firstName ? `, ${user.firstName}` : ""}.`
    : null;

  const learningSignals = [
    "Learns your markets",
    "Learns your budget",
    "Learns your strategy",
    "Learns your return targets",
    "Powers smarter recommendations",
  ];

  const handleHeroPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;
    const now = window.performance.now();
    if (now - lastParticleAtRef.current < 120) return;
    lastParticleAtRef.current = now;

    const rect = event.currentTarget.getBoundingClientRect();
    const particle: CalculationParticle = {
      id: particleIdRef.current++,
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
      label: calculationLabels[particleIdRef.current % calculationLabels.length],
    };

    setCalculationParticles((items) => [...items.slice(-9), particle]);
    window.setTimeout(() => {
      setCalculationParticles((items) => items.filter((item) => item.id !== particle.id));
    }, 1250);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={SHARED_ROUTE_META["/"].title}
        description={SHARED_ROUTE_META["/"].description}
        canonicalUrl="/"
        structuredData={combinedSchema}
      />
      <Navigation />

      <main>
        <section
          className="relative overflow-hidden border-b border-border/50 bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.22))]"
          onPointerMove={handleHeroPointerMove}
        >
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
          >
            {/* Soft brand glows */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,hsl(var(--primary)/0.10),transparent_32%),radial-gradient(circle_at_82%_22%,hsl(var(--accent)/0.08),transparent_28%)]" />

            {/* Faded Canada silhouette — projected from world-atlas countries-50m */}
            <svg
              viewBox={CANADA_VIEWBOX}
              preserveAspectRatio="xMidYMid slice"
              className="absolute inset-0 h-full w-full opacity-[0.20]"
            >
              <path
                d={CANADA_SVG_PATH}
                fill="hsl(var(--primary) / 0.55)"
                stroke="hsl(var(--primary) / 0.45)"
                strokeWidth="0.5"
                strokeLinejoin="round"
                fillRule="evenodd"
              />
            </svg>
          </div>

          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {calculationParticles.map((particle) => (
              <span
                key={particle.id}
                className="absolute rounded-md border border-border/70 bg-background/85 px-2 py-1 font-mono text-[11px] font-semibold text-foreground shadow-sm animate-[calc-float_1.25s_ease-out_forwards]"
                style={{ left: `${particle.x}%`, top: `${particle.y}%` }}
              >
                {particle.label}
              </span>
            ))}
          </div>

          <style>{`
            @keyframes calc-float {
              0% { opacity: 0; transform: translate3d(0, 0, 0) scale(0.96); }
              15% { opacity: 0.78; }
              100% { opacity: 0; transform: translate3d(18px, -34px, 0) scale(1); }
            }
          `}</style>

          <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-16 md:py-24">
            <div className="max-w-[860px]">
              {greeting && (
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-4">
                  {greeting}
                </p>
              )}
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.04] text-balance">
                Canadian real estate investing, underwritten by AI.
              </h1>
              <p className="mt-5 text-lg md:text-xl text-muted-foreground max-w-[760px]">
                Paste a listing or address and get cash flow, yield, and risk in seconds.
                Realist learns your buy box with every deal you run.
              </p>
              <AnalysesCounter className="mt-5 bg-background/80" />
              <div className="mt-7 flex flex-col sm:flex-row gap-3">
                <Link href="/tools/analyzer">
                  <Button
                    size="lg"
                    className="gap-2 w-full sm:w-auto"
                    onClick={() => {
                      track({ event: "cta_clicked", cta: "homepage_hero_analyze", location: "homepage_hero", destination: "/tools/analyzer" });
                      trackRealistEvent("homepage.cta_clicked", { cta: "start_analyzing_deals", location: "homepage_hero", destination: "/tools/analyzer" });
                    }}
                    data-testid="button-home-hero-analyze"
                  >
                    Start analyzing deals
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/tools/cap-rates">
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2 w-full sm:w-auto bg-background/70"
                    onClick={() => {
                      track({ event: "cta_clicked", cta: "homepage_hero_map", location: "homepage_hero", destination: "/tools/cap-rates" });
                      trackRealistEvent("homepage.cta_clicked", { cta: "explore_yield_map", location: "homepage_hero", destination: "/tools/cap-rates" });
                    }}
                    data-testid="button-home-hero-map"
                  >
                    <Map className="h-4 w-4" />
                    Explore the yield map
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Estimated metrics only. Screening signals are based on assumptions, not guaranteed returns.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Save assumptions", icon: Save },
                  { label: "Apply to similar deals", icon: Radar },
                  { label: "Send an inspector", icon: Target },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/75 px-3 py-2 text-sm font-medium">
                      <Icon className="h-4 w-4 text-primary" />
                      {item.label}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="py-8 border-y border-border/40 bg-muted/20">
          <div className="max-w-6xl mx-auto px-4 md:px-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {[
                { value: SITE_STATS.communityMembers, label: "community members" },
                { value: SITE_STATS.dealsAnalyzedVolume, label: "in deals analyzed" },
                { value: SITE_STATS.canadianCities, label: "Canadian cities" },
                { value: SITE_STATS.skoolMembers, label: "Skool members" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-2xl md:text-3xl font-bold font-mono">{stat.value}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="text-center space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest" data-testid="text-as-seen-on">
                As seen on
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 md:gap-4 max-w-4xl mx-auto">
                {mediaLogos.map((media) => {
                  const logo = (
                    <img
                      src={media.image}
                      alt={media.name}
                      className="h-4 md:h-5 w-auto max-w-full object-contain grayscale opacity-55 transition-all group-hover:grayscale-0 group-hover:opacity-100"
                    />
                  );
                  return media.url ? (
                    <a
                      key={media.name}
                      href={media.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group hover-elevate px-2 py-2 rounded-md flex items-center justify-center"
                      title={media.name}
                    >
                      {logo}
                    </a>
                  ) : (
                    <div key={media.name} className="group px-2 py-2 rounded-md flex items-center justify-center" title={media.name}>
                      {logo}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Funnel band — the three doors into working with the team */}
        <section className="py-10 md:py-14">
          <div className="max-w-6xl mx-auto px-4 md:px-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Link
                href="/tools/financing-readiness"
                onClick={() => track({ event: "cta_clicked", cta: "financing_readiness", location: "homepage_funnel_band", destination: "/tools/financing-readiness" })}
                data-testid="link-funnel-readiness"
                className="block"
              >
                <Card className="h-full hover-elevate cursor-pointer">
                  <CardContent className="pt-6">
                    <Gauge className="h-6 w-6 text-primary mb-3" />
                    <p className="font-semibold mb-1">Know your buying power</p>
                    <p className="text-sm text-muted-foreground">
                      Your stress-tested max purchase price in 30 seconds, then a free consultation to make it real.
                    </p>
                  </CardContent>
                </Card>
              </Link>
              <Link
                href="/book-a-call"
                onClick={() => track({ event: "cta_clicked", cta: "book_call", location: "homepage_funnel_band", destination: "/book-a-call" })}
                data-testid="link-funnel-call"
                className="block"
              >
                <Card className="h-full hover-elevate cursor-pointer border-primary/40 bg-primary/5">
                  <CardContent className="pt-6">
                    <PhoneCall className="h-6 w-6 text-primary mb-3" />
                    <p className="font-semibold mb-1">Talk to the team</p>
                    <p className="text-sm text-muted-foreground">
                      A free call with Dan, Nick, or a financing specialist about your deal, financing, or strategy.
                    </p>
                  </CardContent>
                </Card>
              </Link>
              <Link
                href="/deal-room"
                onClick={() => track({ event: "cta_clicked", cta: "deal_room", location: "homepage_funnel_band", destination: "/deal-room" })}
                data-testid="link-funnel-deal-room"
                className="block"
              >
                <Card className="h-full hover-elevate cursor-pointer">
                  <CardContent className="pt-6">
                    <Radio className="h-6 w-6 text-primary mb-3" />
                    <p className="font-semibold mb-1">Live Deal Room</p>
                    <p className="text-sm text-muted-foreground">
                      Real deals underwritten live, Mondays 11:30am ET. Free, and the replays are too.
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-14 md:py-20">
          <div className="max-w-6xl mx-auto px-4 md:px-6">
            <div className="mb-6 md:mb-8">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                Start with a deal, or start with the market.
              </h2>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="border-primary/25 bg-gradient-to-br from-background via-background to-primary/10 shadow-sm">
                <CardHeader className="space-y-4">
                  <Badge className="w-fit gap-1 bg-primary text-primary-foreground hover:bg-primary">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Use AI underwriting
                  </Badge>
                  <div className="space-y-2">
                    <CardTitle className="text-2xl">Analyze a property</CardTitle>
                    <p className="text-muted-foreground">
                      Paste an address, listing, or MLS number. Realist turns it into cash flow, yield,
                      risk signals, and next steps.
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link href="/tools/analyzer">
                      <Button
                        size="lg"
                        className="gap-2 w-full sm:w-auto"
                        onClick={() => track({ event: "cta_clicked", cta: "homepage_path_analyze", location: "homepage", destination: "/tools/analyzer" })}
                        data-testid="button-home-analyze-path"
                      >
                        Analyze a Deal
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    {isAuthenticated && (
                      <Link href="/investor">
                        <Button
                          size="lg"
                          variant="outline"
                          className="gap-2 w-full sm:w-auto"
                          onClick={() => track({ event: "cta_clicked", cta: "homepage_path_investor_portal", location: "homepage", destination: "/investor" })}
                        >
                          <Target className="h-4 w-4" />
                          Open investor portal
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-gradient-to-br from-background via-background to-accent/10 shadow-sm">
                <CardHeader className="space-y-4">
                  <Badge variant="secondary" className="w-fit gap-1">
                    <Map className="h-3.5 w-3.5" />
                    Search investor opportunities
                  </Badge>
                  <div className="space-y-2">
                    <CardTitle className="text-2xl">Find deals on the map</CardTitle>
                    <p className="text-muted-foreground">
                      Search investor-focused listings by market fit, rental yield, price cuts,
                      distress signals, and upside potential.
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link href="/tools/cap-rates">
                      <Button
                        size="lg"
                        variant="outline"
                        className="gap-2 w-full sm:w-auto"
                        onClick={() => track({ event: "cta_clicked", cta: "homepage_path_map", location: "homepage", destination: "/tools/cap-rates" })}
                        data-testid="button-home-map-path"
                      >
                        Explore the Map
                        <Compass className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="pb-10 md:pb-14">
          <div className="max-w-6xl mx-auto px-4 md:px-6">
            <div className={hasResumeSignals ? "grid gap-5 lg:grid-cols-[1.2fr_0.8fr]" : "grid gap-5"}>
              <Card className="border-border/60 bg-gradient-to-br from-card via-card to-primary/5">
                <CardHeader>
                  <Badge variant="secondary" className="mb-2 w-fit gap-1">
                    <Brain className="h-3.5 w-3.5" />
                    Compounding intelligence
                  </Badge>
                  <CardTitle className="text-2xl">Every deal teaches Realist your buy box.</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-muted-foreground">
                    The more you search, save, and analyze, the better Realist understands your strategy -
                    helping you spot better opportunities, avoid weaker deals, and move faster when the numbers work.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {learningSignals.map((signal) => (
                      <div key={signal} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm font-medium">
                        <Radar className="h-4 w-4 text-primary" />
                        {signal}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {hasResumeSignals && (
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-xl">Continue where you left off</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {recentSavedListing ? (
                    <div className="rounded-lg border border-border/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Recent deal</p>
                          <p className="mt-2 font-medium">{recentSavedListing.label}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {[recentSavedListing.city, recentSavedListing.strategy?.replace(/_/g, " "), recentSavedListing.capRate != null ? `${recentSavedListing.capRate.toFixed(1)}% cap` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <Save className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                      No saved deal yet. Start with the analyzer if you already have a property in mind.
                    </div>
                  )}

                  {recentSavedSearch ? (
                    <div className="rounded-lg border border-border/60 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Recent search</p>
                      <p className="mt-2 font-medium">{recentSavedSearch.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {[recentSavedSearch.geography, recentSavedSearch.query || recentSavedSearch.strategy?.replace(/_/g, " "), formatCurrency(recentSavedSearch.budgetMax) ? `Up to ${formatCurrency(recentSavedSearch.budgetMax)}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                      No saved search yet. Start on the map if you want to source before you underwrite.
                    </div>
                  )}
                </CardContent>
              </Card>
              )}
            </div>
          </div>
        </section>

        <section className="py-10 md:py-14 border-t border-border/40">
          <div className="max-w-6xl mx-auto px-4 md:px-6">
            <div className="rounded-xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/5 p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div className="max-w-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">For professionals</p>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight">
                  Realtor, mortgage pro, or building expert?
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Investors on Realist are underwriting deals in your market right now. Join the Power Team
                  to get matched with them when a deal moves forward.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                <Link href="/power-team">
                  <Button
                    className="gap-2 w-full sm:w-auto"
                    onClick={() => track({ event: "cta_clicked", cta: "homepage_power_team", location: "homepage_pro_band", destination: "/power-team" })}
                    data-testid="button-home-power-team"
                  >
                    Join the Power Team
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/join/realtors">
                  <Button variant="outline" className="w-full sm:w-auto" data-testid="button-home-join-realtors">
                    I'm a realtor
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

    </div>
  );
}
