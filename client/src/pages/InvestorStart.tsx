import { Link } from "wouter";
import { SEO, organizationSchema, websiteSchema } from "@/components/SEO";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { getSavedListingSignals, getSavedSearchSignals, syncDiscoverySignalsWithAccount, track } from "@/lib/analytics";
import { ArrowRight, BarChart3, Compass, Map, Save, Search, Target } from "lucide-react";
import { useEffect, useState } from "react";

function formatCurrency(value?: number) {
  if (!value) return null;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function InvestorStart() {
  const { isAuthenticated, user } = useAuth();
  const [recentSavedListing, setRecentSavedListing] = useState(() => getSavedListingSignals()[0]);
  const [recentSavedSearch, setRecentSavedSearch] = useState(() => getSavedSearchSignals()[0]);

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
    : "Start with the job you need done.";

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Realist | Analyze Your Deal or Search the Map"
        description="Choose the fastest path into Realist: analyze your own deal or search the map for opportunities."
        canonicalUrl="/"
        structuredData={combinedSchema}
      />
      <Navigation />

      <main>
        <section className="border-b border-border/50 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.14),transparent_38%),radial-gradient(circle_at_top_right,hsl(var(--accent)/0.12),transparent_32%)]">
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-16 md:py-24">
            <div className="max-w-3xl">
              <Badge variant="secondary" className="mb-4">
                Realist investor workflow
              </Badge>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-4">
                {greeting}
              </p>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.02] text-balance">
                Two clear ways to use Realist.
              </h1>
              <p className="mt-5 text-lg md:text-xl text-muted-foreground max-w-2xl">
                Bring your own property into underwriting, or search the map for investable opportunities.
                Start in one path, then move into the other when you need it.
              </p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-2">
              <Card className="border-primary/25 bg-gradient-to-br from-background via-background to-primary/10 shadow-sm">
                <CardHeader className="space-y-4">
                  <Badge className="w-fit gap-1 bg-primary text-primary-foreground hover:bg-primary">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Analyze my own deal
                  </Badge>
                  <div className="space-y-2">
                    <CardTitle className="text-2xl">Underwrite a property you already have</CardTitle>
                    <p className="text-muted-foreground">
                      Paste an address, listing URL, or MLS number and get to cash flow, yield, and next steps quickly.
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Input</p>
                      <p className="mt-2 text-sm font-medium">Address, listing, or thesis</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Value</p>
                      <p className="mt-2 text-sm font-medium">Cash flow, cap rate, stress test</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Next step</p>
                      <p className="mt-2 text-sm font-medium">Save, export, or connect</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link href="/tools/analyzer">
                      <Button
                        size="lg"
                        className="gap-2 w-full sm:w-auto"
                        onClick={() => track({ event: "cta_clicked", cta: "homepage_path_analyze", location: "homepage", destination: "/tools/analyzer" })}
                        data-testid="button-home-analyze-path"
                      >
                        Open deal analyzer
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
                    Search for deals on the map
                  </Badge>
                  <div className="space-y-2">
                    <CardTitle className="text-2xl">Discover opportunities before you underwrite</CardTitle>
                    <p className="text-muted-foreground">
                      Browse the map, screen geographies, and look for deal flow worth pulling into analysis.
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Search</p>
                      <p className="mt-2 text-sm font-medium">Map-based investor discovery</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Filter</p>
                      <p className="mt-2 text-sm font-medium">Markets, yields, distress, fit</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background/80 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Handoff</p>
                      <p className="mt-2 text-sm font-medium">Send winners into underwriting</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link href="/tools/cap-rates">
                      <Button
                        size="lg"
                        variant="outline"
                        className="gap-2 w-full sm:w-auto"
                        onClick={() => track({ event: "cta_clicked", cta: "homepage_path_map", location: "homepage", destination: "/tools/cap-rates" })}
                        data-testid="button-home-map-path"
                      >
                        Open the map
                        <Compass className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href="/tools/distress-deals">
                      <Button
                        size="lg"
                        variant="ghost"
                        className="gap-2 w-full sm:w-auto"
                        onClick={() => track({ event: "cta_clicked", cta: "homepage_path_distress", location: "homepage", destination: "/tools/distress-deals" })}
                      >
                        <Search className="h-4 w-4" />
                        Distress deals
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-10 md:py-14">
          <div className="max-w-6xl mx-auto px-4 md:px-6">
            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-xl">How the flow works</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl bg-muted/35 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Path 1</p>
                    <p className="mt-2 font-medium">Analyze your own deal</p>
                    <p className="mt-2 text-sm text-muted-foreground">Best when you already have a listing, address, or a clear acquisition idea.</p>
                  </div>
                  <div className="rounded-xl bg-muted/35 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Path 2</p>
                    <p className="mt-2 font-medium">Search the map</p>
                    <p className="mt-2 text-sm text-muted-foreground">Best when you are still sourcing, comparing markets, or screening opportunities.</p>
                  </div>
                  <div className="rounded-xl bg-muted/35 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Loop</p>
                    <p className="mt-2 font-medium">Move between them</p>
                    <p className="mt-2 text-sm text-muted-foreground">Discovery feeds analysis. Analysis feeds saved intent, exports, and execution.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-xl">Continue where you left off</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {recentSavedListing ? (
                    <div className="rounded-xl border border-border/60 p-4">
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
                    <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                      No saved deal yet. Start with the analyzer if you already have a property in mind.
                    </div>
                  )}

                  {recentSavedSearch ? (
                    <div className="rounded-xl border border-border/60 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Recent search</p>
                      <p className="mt-2 font-medium">{recentSavedSearch.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {[recentSavedSearch.geography, recentSavedSearch.query || recentSavedSearch.strategy?.replace(/_/g, " "), formatCurrency(recentSavedSearch.budgetMax) ? `Up to ${formatCurrency(recentSavedSearch.budgetMax)}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                      No saved search yet. Start on the map if you want to source before you underwrite.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 border-t border-border/50">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">R</span>
              </div>
              <span>Realist.ca</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="/about" className="hover:text-foreground transition-colors">About</a>
              <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
