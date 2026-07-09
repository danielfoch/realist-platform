import { useRef, useEffect, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { SEO, organizationSchema, websiteSchema, softwareSchema } from "@/components/SEO";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import {
  captureInvestorPreference,
  getRecentViewedListingSignals,
  getSavedListingSignals,
  syncDiscoverySignalsWithAccount,
  track,
} from "@/lib/analytics";
import {
  ArrowRight, Users, MapPin, TrendingUp, GraduationCap,
  Calculator, Map, Search,
  Building2, Zap,
  ChevronRight, Award,
} from "lucide-react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { mediaLogos } from "@/lib/mediaLogos";
import { ANALYZED_VOLUME_LABEL } from "@/lib/platformStats";

const TORONTO_CENTER: [number, number] = [43.65, -79.38];

// This map is decorative (blurred, pointer-events-none) — never request a
// browser permission for it. Sizing fix only.
function InvalidateSizeOnMount() {
  const map = useMap();
  const attempted = useRef(false);
  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    setTimeout(() => { try { map.invalidateSize(); } catch {} }, 200);
  }, [map]);
  return null;
}

const NL_EXAMPLES = [
  "Find cash-flowing duplexes in Ontario under $900k",
  "Analyze this fourplex as a BRRR strategy",
  "What are cap rates in Hamilton vs Kitchener right now?",
  "Show me motivated deals near Toronto with VTB potential",
  "Best neighbourhoods for legal secondary suites in BC?",
  "How does this listing perform as short-term rental?",
];

const QUICK_STARTS = [
  {
    label: "Ontario buy & hold",
    query: "Find buy and hold rental opportunities in Ontario under $1M",
    strategy: "buy_hold",
    geography: "Ontario",
    budgetMax: 1000000,
  },
  {
    label: "BRRR candidates",
    query: "Show BRRR properties with value-add upside near Toronto",
    strategy: "brrr",
    geography: "Greater Toronto Area",
  },
  {
    label: "Multiplex plays",
    query: "Analyze a multiplex acquisition in Hamilton or Kitchener",
    strategy: "multiplex",
    geography: "Southwestern Ontario",
  },
  {
    label: "Cash-flow focus",
    query: "Find higher-yield rental properties in Alberta",
    strategy: "buy_hold",
    geography: "Alberta",
    targetGrossYield: 6,
  },
];

const stats = [
  { icon: Users, value: "11,000+", label: "investors" },
  { icon: TrendingUp, value: ANALYZED_VOLUME_LABEL, label: "deals analyzed" },
  { icon: MapPin, value: "26", label: "Canadian cities" },
  { icon: GraduationCap, value: "1,200+", label: "Skool members" },
];


const sourcingPaths = [
  {
    icon: Map,
    title: "Open the yield map",
    description: "Pan into a market, screen live listings, and send promising properties into the analyzer.",
    href: "/tools/cap-rates",
    cta: "Open map",
  },
  {
    icon: Building2,
    title: "Browse motivated deals",
    description: "Look for power of sale, motivated sellers, and off-consensus entry points worth underwriting.",
    href: "/tools/cap-rates?deals=power_of_sale,motivated,vtb&distressOnly=1",
    cta: "Search motivated",
  },
  {
    icon: Calculator,
    title: "Already have a property?",
    description: "Skip sourcing and move straight into underwriting when you already know the address or listing.",
    href: "/tools/analyzer",
    cta: "Open analyzer",
  },
];

// ─── NL Command Bar ────────────────────────────────────────────────────────────

function NLCommandBar() {
  const [query, setQuery] = useState("");
  const [placeholder, setPlaceholder] = useState(NL_EXAMPLES[0]);
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  // Cycle through example placeholders
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % NL_EXAMPLES.length;
      setPlaceholder(NL_EXAMPLES[i]);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    track({ event: "nl_query_submitted", query: q });
    track({ event: "search_submitted", query: q, source: "discover_hero" });
    navigate(`/tools/cap-rates?q=${encodeURIComponent(q)}`);
  }, [query, navigate]);

  const handleExampleClick = useCallback((example: string) => {
    setQuery(example);
    inputRef.current?.focus();
    track({ event: "cta_clicked", cta: "nl_example", location: "hero", destination: example });
  }, []);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
        <div className="relative flex items-center">
        <Search className="absolute left-4 h-5 w-5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-11 pr-28 py-4 text-base rounded-xl border border-border/60 bg-card/90 backdrop-blur-sm shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/60 transition-all"
          data-testid="input-nl-query"
        />
        <Button
          type="submit"
          size="sm"
          className="absolute right-2 px-5"
          data-testid="button-nl-submit"
        >
          Analyze
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 justify-center">
          {NL_EXAMPLES.slice(0, 3).map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => handleExampleClick(ex)}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md bg-muted/50 hover:bg-muted transition-colors cursor-pointer truncate max-w-[200px]"
              data-testid="button-nl-example"
              title={ex}
            >
              {ex.length > 38 ? ex.slice(0, 38) + "…" : ex}
            </button>
          ))}
        </div>
      </form>

      <div className="rounded-2xl border border-border/60 bg-card/70 p-4 backdrop-blur-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Start fast</p>
            <p className="text-sm text-muted-foreground">Pick a sourcing brief and carry it straight into the map search.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_STARTS.map((start) => (
              <Button
                key={start.label}
                type="button"
                variant="outline"
                size="sm"
                className="bg-background/70"
                onClick={() => {
                  captureInvestorPreference({
                    strategy: start.strategy as "buy_hold" | "brrr" | "multiplex" | "flip" | "airbnb",
                    geography: start.geography,
                    preferred_geographies: [start.geography],
                    budget_max: start.budgetMax,
                    target_gross_yield: start.targetGrossYield,
                    financing_intent: true,
                    renovation_intent: start.strategy === "brrr",
                    search_query: start.query,
                  });
                  track({
                    event: "search_submitted",
                    query: start.query,
                    geography: start.geography,
                    budget_max: start.budgetMax,
                    strategy: start.strategy,
                    target_gross_yield: start.targetGrossYield,
                    source: "homepage_quick_start",
                  });
                  navigate(`/tools/cap-rates?q=${encodeURIComponent(start.query)}`);
                }}
                data-testid={`button-quick-start-${start.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {start.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function MapHomepage() {
  const { isAuthenticated } = useAuth();
  const [recentShortlist, setRecentShortlist] = useState(() => getSavedListingSignals().slice(0, 2));
  const [recentViewed, setRecentViewed] = useState(() => getRecentViewedListingSignals().slice(0, 2));
  const combinedSchema = {
    "@context": "https://schema.org",
    "@graph": [organizationSchema, websiteSchema, softwareSchema],
  };

  // Track page view on mount
  useEffect(() => {
    track({ event: "page_viewed", path: "/discover", title: "Discover" });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    syncDiscoverySignalsWithAccount().then(() => {
      setRecentShortlist(getSavedListingSignals().slice(0, 2));
      setRecentViewed(getRecentViewedListingSignals().slice(0, 2));
    });
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SEO
        title="Discover Real Estate Deals | Realist.ca"
        description="Search for Canadian real estate deals with the yield map, motivated-seller filters, and natural-language sourcing workflows."
        keywords="canadian real estate deals, yield map, motivated deals, motivated sellers, cap rates canada, real estate sourcing, investment property search"
        canonicalUrl="/discover"
        structuredData={combinedSchema}
      />
      <Navigation />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative" style={{ minHeight: "82vh" }}>
        {/* Background map - muted */}
        <div className="absolute inset-0 z-0">
          <div className="w-full h-full saturate-[0.25] blur-[3px]" style={{ pointerEvents: "none" }}>
            <MapContainer
              center={TORONTO_CENTER}
              zoom={6}
              scrollWheelZoom={false}
              dragging={false}
              zoomControl={false}
              doubleClickZoom={false}
              touchZoom={false}
              style={{ width: "100%", height: "100%", minHeight: "82vh" }}
              attributionControl={false}
            >
              <InvalidateSizeOnMount />
              <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution="" />
            </MapContainer>
          </div>
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-background/75 via-background/55 to-background/85 dark:from-background/85 dark:via-background/65 dark:to-background/90" />

        {/* Hero content */}
        <div className="relative z-20 flex items-center justify-center px-4" style={{ minHeight: "82vh" }}>
          <div className="max-w-3xl w-full text-center space-y-8">
            <div className="space-y-4">
              <Badge variant="secondary" className="text-xs px-3 py-1 font-medium">
                <Zap className="h-3 w-3 mr-1.5 text-primary" />
                Discovery workflow for Canadian real estate investors
              </Badge>
              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] uppercase"
                data-testid="text-map-hero-headline"
              >
                Real estate intelligence
                <br />
                <span className="text-gradient">that compounds.</span>
              </h1>
              <p
                className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
                data-testid="text-map-hero-subhead"
              >
                Deal analysis that gets smarter with every deal you run. Analyze any property,
                find listings worth underwriting, and let Realist learn your buy box from every search,
                save, and analysis — so the next opportunity is easier to spot than the last.
              </p>
            </div>

            {/* NL Command Bar */}
            <NLCommandBar />

            {/* Primary CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 flex-wrap">
              <Link href="/tools/analyzer">
                <Button
                  size="lg"
                  className="gap-2 px-8 h-11"
                  data-testid="button-analyze-deal"
                  onClick={() => track({ event: "cta_clicked", cta: "analyze_deal", location: "discover_hero" })}
                >
                  <Calculator className="h-4 w-4" />
                  Analyze a Deal
                </Button>
              </Link>
              <Link href="/tools/cap-rates">
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2 px-8 h-11 bg-card/60 backdrop-blur-sm"
                  data-testid="button-find-deals"
                  onClick={() => track({ event: "cta_clicked", cta: "find_deals_worth_analyzing", location: "discover_hero" })}
                >
                  <Map className="h-4 w-4" />
                  Find Deals Worth Analyzing
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span>Natural-language sourcing</span>
              <span className="hidden sm:inline text-border">•</span>
              <span>Map-first screening</span>
              <span className="hidden sm:inline text-border">•</span>
              <span>Analyzer handoff</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ─────────────────────────────────────────────────────── */}
      <section className="py-10 border-t border-border/40 bg-muted/20">
        <div className="max-w-4xl mx-auto px-4 md:px-6">
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-3" data-testid={`stat-${stat.label.replace(/\s+/g, "-")}`}>
                <stat.icon className="h-5 w-5 text-muted-foreground" />
                <div className="text-left">
                  <div className="font-bold text-lg md:text-xl font-mono">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Media Logos ───────────────────────────────────────────────────── */}
      <section className="py-8 border-t border-border/40">
        <div className="max-w-4xl mx-auto px-4 md:px-6 text-center space-y-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest" data-testid="text-as-seen-on">
            As seen on
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 md:gap-4">
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
                  data-testid={`link-media-${media.name.toLowerCase().replace(/\s+/g, "-")}`}
                  title={media.name}
                >
                  {logo}
                </a>
              ) : (
                <div
                  key={media.name}
                  className="group px-2 py-2 rounded-md flex items-center justify-center"
                  data-testid={`logo-media-${media.name.toLowerCase().replace(/\s+/g, "-")}`}
                  title={media.name}
                >
                  {logo}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 border-t border-border/40">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Choose your sourcing path
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Discovery should help you narrow the field fast, then pass the winners into underwriting.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {sourcingPaths.map((cap) => (
              <Link key={cap.href} href={cap.href}>
                <Card
                  className="h-full hover-elevate cursor-pointer group border-border/60 transition-all"
                  onClick={() => track({ event: "feature_used", feature: cap.title, details: { source: "discover_paths" } })}
                >
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <cap.icon className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-base mb-1.5">{cap.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{cap.description}</p>
                    </div>
                    <div className="flex items-center text-sm font-medium text-primary gap-1 group-hover:gap-2 transition-all">
                      {cap.cta}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {(recentShortlist.length > 0 || recentViewed.length > 0) && (
        <section className="py-12 border-t border-border/40 bg-muted/10">
          <div className="max-w-5xl mx-auto px-4 md:px-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold mb-2">Resume discovery</h2>
                <p className="text-muted-foreground">Your shortlist and recently viewed properties stay handy while you move between discovery and analysis.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {recentShortlist.length > 0 && (
                <Card className="border-border/60">
                  <CardHeader>
                    <CardTitle className="text-lg">Shortlist</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {recentShortlist.map((listing) => (
                      <div key={`discover-shortlist-${listing.id}`} className="rounded-lg border border-border/60 px-4 py-3">
                        <p className="font-medium">{listing.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {[listing.city, listing.capRate != null ? `${listing.capRate.toFixed(1)}% cap` : null, listing.price ? new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(listing.price) : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              {recentViewed.length > 0 && (
                <Card className="border-border/60">
                  <CardHeader>
                    <CardTitle className="text-lg">Recently viewed</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {recentViewed.map((listing) => (
                      <div key={`discover-recent-${listing.id}`} className="rounded-lg border border-border/60 px-4 py-3">
                        <p className="font-medium">{listing.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {[listing.city, listing.capRate != null ? `${listing.capRate.toFixed(1)}% cap` : null, listing.price ? new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(listing.price) : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── How Community Underwriting Works ─────────────────────────────── */}
      <section className="py-16 md:py-24 border-t border-border/40 bg-muted/10">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3" data-testid="text-how-it-works-title">
              Discovery to underwriting
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Use Realist to search broadly, narrow the shortlist, and carry the strongest properties into deeper analysis.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: Map,
                step: "01",
                title: "Search the market",
                description: "Start with the yield map or a natural-language brief to surface the part of the market you want to screen.",
              },
              {
                icon: Calculator,
                step: "02",
                title: "Shortlist the best fits",
                description: "Use yield, filters, and context to narrow the field to the few properties worth serious attention.",
              },
              {
                icon: Award,
                step: "03",
                title: "Hand off to analysis",
                description: "Open the selected property in the analyzer and move from sourcing into underwriting without re-entering the basics.",
              },
            ].map((step) => (
              <Card key={step.step} className="border-border/60">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <step.icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-3xl font-bold text-muted-foreground/20 font-mono">{step.step}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1.5" data-testid={`text-step-title-${step.step}`}>
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-8">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/tools/cap-rates">
                <Button variant="outline" size="lg" className="gap-2">
                  <Map className="h-4 w-4" />
                  Open the Yield Map
                </Button>
              </Link>
              <Link href="/tools/analyzer">
                <Button size="lg" className="gap-2">
                  <Calculator className="h-4 w-4" />
                  Analyze a property
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
    </div>
  );
}
