import { useRef, useEffect, useState, lazy, Suspense, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SEO, organizationSchema, websiteSchema, softwareSchema } from "@/components/SEO";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { track } from "@/lib/analytics";
import {
  ArrowRight, Users, MapPin, TrendingUp, GraduationCap,
  Calculator, Map, Trophy, BarChart3, Crown, Medal, Search,
  Building2, DollarSign, Zap, BarChart2, BookOpen, Radio,
  ChevronRight, MessageSquare, Award,
} from "lucide-react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const Home = lazy(() => import("@/pages/Home"));

import reutersLogo from "@assets/image_1767559636706.png";
import wsjLogo from "@assets/image_1767563210169.png";
import bloombergLogo from "@assets/image_1767559733359.png";
import investingLogo from "@assets/image_1767559017226.png";
import cbcLogo from "@assets/image_1767559058457.png";
import hgtvLogo from "@assets/image_1767559257023.png";
import torontoStarLogo from "@assets/image_1767559616553.png";
import ctvLogo from "@assets/image_1767559371656.png";
import cp24Logo from "@assets/image_1767559398760.png";
import financialPostLogo from "@assets/image_1767559424338.png";
import bnnBloombergLogo from "@assets/image_1767559654950.png";
import globeMailLogo from "@assets/image_1767559703750.png";
import nationalPostLogo from "@assets/image_1767559826327.png";
import storeysLogo from "@assets/image_1767562262018.png";

const TORONTO_CENTER: [number, number] = [43.65, -79.38];

function GeolocateOnMount() {
  const map = useMap();
  const attempted = useRef(false);
  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    setTimeout(() => { try { map.invalidateSize(); } catch {} }, 200);
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try {
          const { latitude: lat, longitude: lng } = pos.coords;
          if (isFinite(lat) && isFinite(lng)) map.flyTo([lat, lng], 8, { duration: 1.5 });
        } catch {}
      },
      () => {},
      { timeout: 5000, maximumAge: 300000 }
    );
  }, [map]);
  return null;
}

const NL_EXAMPLES = [
  "Find cash-flowing duplexes in Ontario under $900k",
  "Analyze this fourplex as a BRRR strategy",
  "What are cap rates in Hamilton vs Kitchener right now?",
  "Show me distress deals near Toronto with VTB potential",
  "Best neighbourhoods for legal secondary suites in BC?",
  "How does this listing perform as short-term rental?",
];

const stats = [
  { icon: Users, value: "11,000+", label: "investors" },
  { icon: TrendingUp, value: "$2.6B", label: "deals analyzed" },
  { icon: MapPin, value: "26", label: "Canadian cities" },
  { icon: GraduationCap, value: "1,200+", label: "Skool members" },
];

const mediaLogos = [
  { name: "Reuters", image: reutersLogo, url: "https://www.reuters.com/markets/supply-canadas-property-market-surges-mortgage-renewals-loom-2024-07-17/" },
  { name: "WSJ", image: wsjLogo, url: "https://www.wsj.com/economy/housing/canadas-real-estate-market-stumbles-as-rate-hikes-bite-24a8a2da" },
  { name: "Investing.com", image: investingLogo, url: "https://ca.investing.com/members/contributors/245556786" },
  { name: "Bloomberg", image: bloombergLogo, url: "https://www.bloomberg.com" },
  { name: "Globe and Mail", image: globeMailLogo, url: "https://www.theglobeandmail.com/real-estate/article-for-a-few-homeowners-the-end-of-the-road-is-a-power-of-sale/" },
  { name: "CBC", image: cbcLogo, url: "https://www.cbc.ca/news/business/housing-prices-april-1.6454728" },
  { name: "Financial Post", image: financialPostLogo, url: "https://financialpost.com/news/canadians-down-payments-family-money-housing-market" },
  { name: "Toronto Star", image: torontoStarLogo, url: "https://www.thestar.com/real-estate" },
  { name: "BNN Bloomberg", image: bnnBloombergLogo, url: "https://www.bnnbloomberg.ca/video/shows/taking-stock/2024/09/06/taking-stock-what-the-bank-of-canadas-cut-might-do-to-the-housing-market/" },
  { name: "CTV", image: ctvLogo, url: "https://www.ctvnews.ca/video/c2839217-mortgage-agent--interest-payments-up-90-" },
  { name: "HGTV", image: hgtvLogo, url: "https://www.hgtv.ca" },
  { name: "CP24", image: cp24Logo, url: "https://www.cp24.com" },
  { name: "National Post", image: nationalPostLogo, url: "https://nationalpost.com" },
  { name: "Storeys", image: storeysLogo, url: "https://storeys.com" },
];

const capabilities = [
  {
    icon: Calculator,
    title: "Deal Analyzer",
    description: "Turn a listing, address, or thesis into an underwriting decision. Stress-test rents, financing, and returns in minutes.",
    href: "/tools/analyzer",
    cta: "Analyze a Deal",
    badge: "Free",
  },
  {
    icon: Map,
    title: "Find Deals",
    description: "Scan live opportunities with map-based yield context, distress filters, and investor-first search paths.",
    href: "/tools/cap-rates",
    cta: "Find Opportunities",
    badge: "Live",
  },
  {
    icon: Users,
    title: "Expert Matching",
    description: "Move from analysis to execution with operator, lender, and market-expert pathways when you are ready to act.",
    href: "/about/contact",
    cta: "Talk to an Expert",
    badge: "High Intent",
  },
  {
    icon: Building2,
    title: "Distress Pipeline",
    description: "Search power of sale, foreclosure, and motivated-seller inventory when you want off-consensus entry points.",
    href: "/tools/distress-deals",
    cta: "Search Distress",
    badge: "New",
  },
];

const proofPillars = [
  {
    title: "Screen faster",
    description: "Start with plain-English search, a map workflow, or a known address and get to the right tool without hunting through menus.",
  },
  {
    title: "Underwrite with context",
    description: "Run the deal against yield, rent, financing, and strategy assumptions before you book calls or make offers.",
  },
  {
    title: "Act with conviction",
    description: "When a deal survives the numbers, route into experts, lenders, and next-step workflows instead of stalling out in research.",
  },
];

const insightPreviews = [
  {
    href: "/insights/mortgage-rates",
    label: "Mortgage Rates",
    description: "Best current rates in Canada",
    icon: TrendingUp,
  },
  {
    href: "/insights/cpi-march-2026",
    label: "CPI Report",
    description: "What March 2026 inflation means for investors",
    icon: BarChart3,
  },
  {
    href: "/insights/podcast",
    label: "Podcast",
    description: "Real estate investor conversations",
    icon: Radio,
  },
  {
    href: "/insights/blog",
    label: "Blog & Research",
    description: "Market analysis and strategies",
    icon: BookOpen,
  },
];

type LeaderboardEntry = {
  rank: number;
  userId: number;
  name: string;
  profileImageUrl: string | null;
  role: string;
  dealCount?: number;
  avgCapRate?: number | null;
  totalPoints?: number;
};

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className="h-4 w-4 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-gray-400" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-600" />;
  return <span className="text-xs font-mono text-muted-foreground w-4 text-center">{rank}</span>;
}

function LeaderboardPreview() {
  const [tab, setTab] = useState<"deals" | "contributions">("deals");

  const { data: dealData, isLoading: dealsLoading } = useQuery<{ analysts: LeaderboardEntry[] }>({
    queryKey: ["/api/leaderboard", "preview"],
    queryFn: async () => {
      const res = await fetch("/api/leaderboard?limit=5", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
  });

  const { data: contribLeaders, isLoading: contribLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard/contributions", "preview"],
    queryFn: async () => {
      const res = await fetch("/api/leaderboard/contributions?limit=5", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch contributions leaderboard");
      return res.json();
    },
  });

  const leaders = tab === "deals" ? (dealData?.analysts || []) : (contribLeaders || []);
  const isLoading = tab === "deals" ? dealsLoading : contribLoading;

  return (
    <section className="py-16 md:py-24 border-t border-border/50 bg-muted/20" data-testid="section-leaderboard-preview">
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-3" data-testid="text-leaderboard-preview-title">
            <Trophy className="inline-block h-7 w-7 mr-2 text-yellow-500 -mt-1" />
            Top Analysts
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Investors earning recognition for quality underwriting and deal analysis.
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-6">
          <Button
            variant={tab === "deals" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("deals")}
            className="gap-1.5"
            data-testid="button-tab-deals"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Deal Analysis
          </Button>
          <Button
            variant={tab === "contributions" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("contributions")}
            className="gap-1.5"
            data-testid="button-tab-contributions"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Community
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16 ml-auto" />
                  </div>
                ))}
              </div>
            ) : leaders.length > 0 ? (
              <div className="divide-y divide-border">
                {leaders.slice(0, 5).map((entry) => (
                  <div
                    key={entry.userId}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                    data-testid={`leaderboard-row-${entry.rank}`}
                  >
                    <div className="flex items-center justify-center w-6">
                      {getRankIcon(entry.rank)}
                    </div>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={entry.profileImageUrl || undefined} alt={entry.name} />
                      <AvatarFallback className="text-xs">
                        {entry.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.name}</p>
                      {entry.role && entry.role !== "investor" && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">{entry.role}</Badge>
                      )}
                    </div>
                    <div className="text-right">
                      {tab === "deals" ? (
                        <p className="text-sm font-mono font-medium" data-testid={`text-deals-${entry.rank}`}>
                          {entry.dealCount} {entry.dealCount === 1 ? "deal" : "deals"}
                        </p>
                      ) : (
                        <p className="text-sm font-mono font-medium" data-testid={`text-points-${entry.rank}`}>
                          {entry.totalPoints} pts
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Trophy className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No entries yet. Be the first to contribute!</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <Link href="/community/leaderboard">
            <Button variant="outline" size="lg" className="gap-2" data-testid="button-view-leaderboard">
              View Full Leaderboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

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
    track({ event: "search_submitted", query: q, source: "homepage_hero" });
    // Route to deal analyzer with query pre-filled via URL param
    navigate(`/tools/analyzer?q=${encodeURIComponent(q)}`);
  }, [query, navigate]);

  const handleExampleClick = useCallback((example: string) => {
    setQuery(example);
    inputRef.current?.focus();
    track({ event: "cta_clicked", cta: "nl_example", location: "hero", destination: example });
  }, []);

  return (
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
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function MapHomepage() {
  const combinedSchema = {
    "@context": "https://schema.org",
    "@graph": [organizationSchema, websiteSchema, softwareSchema],
  };

  // Track page view on mount
  useEffect(() => {
    track({ event: "page_viewed", path: "/", title: "Home" });
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SEO
        title="Realist.ca — AI-Powered Real Estate Investing Platform for Canada"
        description="Find deals, run institutional-grade underwriting, and track the Canadian market. Free deal analyzer used by 11,000+ investors across 26 cities."
        keywords="canadian real estate investing, deal analyzer, yield map, real estate AI, toronto real estate, BRRR, cap rates canada, multiplex investing"
        canonicalUrl="/"
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
              <GeolocateOnMount />
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
                AI-native acquisition workflow for Canadian real estate investors
              </Badge>
              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]"
                data-testid="text-map-hero-headline"
              >
                Find the deal.
                <br />
                <span className="text-gradient">Underwrite it. Move.</span>
              </h1>
              <p
                className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed"
                data-testid="text-map-hero-subhead"
              >
                Search in plain English, pressure-test any property, and route into the next action with investor-grade data.
                Built for serious Canadian investors who need clarity before they commit capital.
              </p>
            </div>

            {/* NL Command Bar */}
            <NLCommandBar />

            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span>Natural-language deal search</span>
              <span className="hidden sm:inline text-border">•</span>
              <span>Institutional-style underwriting</span>
              <span className="hidden sm:inline text-border">•</span>
              <span>Expert next steps when you are ready</span>
            </div>

            {/* Secondary CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 flex-wrap">
              <Link href="/tools/analyzer">
                <Button
                  size="lg"
                  className="gap-2 px-8 h-11"
                  data-testid="button-analyze-deal"
                  onClick={() => track({ event: "cta_clicked", cta: "analyze_deal", location: "hero_secondary" })}
                >
                  <Calculator className="h-4 w-4" />
                  Analyze a Deal
                </Button>
              </Link>
              <Link href="/tools/distress-deals">
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2 px-8 h-11 bg-card/60 backdrop-blur-sm"
                  data-testid="button-find-deals"
                  onClick={() => track({ event: "cta_clicked", cta: "find_deals", location: "hero_secondary" })}
                >
                  <Building2 className="h-4 w-4" />
                  Find Deals
                </Button>
              </Link>
              <Link href="/about/contact">
                <Button
                  variant="ghost"
                  size="lg"
                  className="gap-2 px-6 h-11"
                  data-testid="button-talk-expert"
                  onClick={() => track({ event: "cta_clicked", cta: "expert_matching", location: "hero_secondary" })}
                >
                  <Users className="h-4 w-4" />
                  Talk to an Expert
                </Button>
              </Link>
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
            {mediaLogos.map((media) => (
              <a
                key={media.name}
                href={media.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group hover-elevate px-2 py-2 rounded-md flex items-center justify-center"
                data-testid={`link-media-${media.name.toLowerCase().replace(/\s+/g, "-")}`}
                title={media.name}
              >
                <img
                  src={media.image}
                  alt={media.name}
                  className="h-4 md:h-5 w-auto max-w-full object-contain grayscale opacity-55 transition-all group-hover:grayscale-0 group-hover:opacity-100"
                />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust / Proof ─────────────────────────────────────────────────── */}
      <section className="py-12 border-t border-border/40 bg-muted/20">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Built for the investor decision, not just the listing click</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Realist is structured around the core loop that matters: find an opportunity, understand the numbers, and decide what to do next.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {proofPillars.map((pillar) => (
              <Card key={pillar.title} className="border-border/60 bg-card/70 backdrop-blur-sm">
                <CardContent className="p-6 space-y-3">
                  <p className="text-sm font-semibold">{pillar.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{pillar.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Capability Cards ──────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 border-t border-border/40">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Start with the workflow that matches your intent
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Realist works best when it routes you quickly into the right next step: sourcing, underwriting, or execution.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {capabilities.map((cap) => (
              <Link key={cap.href} href={cap.href}>
                <Card
                  className="h-full hover-elevate cursor-pointer group border-border/60 transition-all"
                  onClick={() => track({ event: "feature_used", feature: cap.title, details: { source: "homepage_capabilities" } })}
                >
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <cap.icon className="h-5 w-5 text-primary" />
                      </div>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">{cap.badge}</Badge>
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

      {/* ── Deal Analyzer Embed ───────────────────────────────────────────── */}
      <section className="py-16 md:py-24 border-t border-border/40 bg-muted/10" data-testid="section-deal-analyzer-embed">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-3 text-xs">Free Tool</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-3" data-testid="text-analyzer-section-title">
              Underwrite any deal in minutes
            </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
              Enter an address, import a listing, or carry over an idea from the homepage search bar.
              Stress-test the deal before you spend time on calls, tours, or offers.
            </p>
          </div>
          <Suspense fallback={
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-3">
                <Calculator className="h-8 w-8 mx-auto text-muted-foreground animate-pulse" />
                <p className="text-sm text-muted-foreground">Loading Deal Analyzer…</p>
              </div>
            </div>
          }>
            <Home embedded />
          </Suspense>
        </div>
      </section>

      {/* ── Market Intelligence Teaser ────────────────────────────────────── */}
      <section className="py-16 md:py-24 border-t border-border/40">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-10">
            <div>
              <h2 className="text-3xl font-bold mb-2">Market Intelligence</h2>
              <p className="text-muted-foreground">Data and analysis interpreted for investors who need timing, pricing, and financing context.</p>
            </div>
            <Link href="/insights">
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                All Insights <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {insightPreviews.map((item) => (
              <Link key={item.href} href={item.href}>
                <Card
                  className="hover-elevate cursor-pointer group h-full border-border/60"
                  onClick={() => track({ event: "cta_clicked", cta: item.label, location: "homepage_insights", destination: item.href })}
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center">
                      <item.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
                    </div>
                    <div className="flex items-center text-xs text-primary gap-1 group-hover:gap-1.5 transition-all font-medium">
                      Read more <ChevronRight className="h-3 w-3" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Content → Action bridge */}
          <div className="mt-10 p-6 rounded-xl border border-border/60 bg-muted/30 flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div>
              <p className="font-semibold text-sm">Seen something in the market?</p>
              <p className="text-sm text-muted-foreground mt-0.5">Run the numbers on a specific deal or neighbourhood right now.</p>
            </div>
            <Link href="/tools/analyzer">
              <Button
                size="sm"
                className="gap-2 shrink-0"
                onClick={() => track({ event: "cta_clicked", cta: "analyze_from_insights", location: "homepage_insights_bridge" })}
              >
                <Calculator className="h-4 w-4" />
                Analyze a Deal
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── How Community Underwriting Works ─────────────────────────────── */}
      <section className="py-16 md:py-24 border-t border-border/40 bg-muted/10">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3" data-testid="text-how-it-works-title">
              Community underwriting
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Investors analyzing deals together — improving assumptions, surfacing consensus yields, and building the best real estate data in Canada.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: Map,
                step: "01",
                title: "Browse the Yield Map",
                description: "Active listings with estimated gross yields from CMHC rent data and community estimates. Updated in real time.",
              },
              {
                icon: Calculator,
                step: "02",
                title: "Underwrite & Comment",
                description: "Submit your rent and expense assumptions. The best analyses surface to the top. Community votes improve the data.",
              },
              {
                icon: Award,
                step: "03",
                title: "Earn Recognition",
                description: "Top analysts earn leaderboard rank and community credibility. Quality underwriting gets seen by 11,000+ investors.",
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
            <Link href="/tools/cap-rates">
              <Button variant="outline" size="lg" className="gap-2">
                <Map className="h-4 w-4" />
                Open the Yield Map
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Leaderboard ───────────────────────────────────────────────────── */}
      <LeaderboardPreview />

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="py-12 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-8">
            <div className="max-w-xs">
              <p className="font-bold text-lg mb-1.5">Realist.ca</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The AI-powered platform Canadian real estate investors use to find deals, run the numbers, and understand the market.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-12 gap-y-4 text-sm">
              <div className="space-y-3">
                <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Tools</p>
                <div className="space-y-2 text-muted-foreground">
                  <Link href="/tools/analyzer" className="block hover:text-foreground transition-colors">Deal Analyzer</Link>
                  <Link href="/tools/cap-rates" className="block hover:text-foreground transition-colors">Yield Map</Link>
                  <Link href="/tools/distress-deals" className="block hover:text-foreground transition-colors">Distress Deals</Link>
                  <Link href="/tools" className="block hover:text-foreground transition-colors">All Tools</Link>
                </div>
              </div>
              <div className="space-y-3">
                <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Insights</p>
                <div className="space-y-2 text-muted-foreground">
                  <Link href="/insights/market-report" className="block hover:text-foreground transition-colors">Market Report</Link>
                  <Link href="/insights/mortgage-rates" className="block hover:text-foreground transition-colors">Mortgage Rates</Link>
                  <Link href="/insights/podcast" className="block hover:text-foreground transition-colors">Podcast</Link>
                  <Link href="/insights/blog" className="block hover:text-foreground transition-colors">Blog</Link>
                </div>
              </div>
              <div className="space-y-3">
                <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Company</p>
                <div className="space-y-2 text-muted-foreground">
                  <Link href="/about" className="block hover:text-foreground transition-colors">About</Link>
                  <Link href="/community/events" className="block hover:text-foreground transition-colors">Events</Link>
                  <Link href="/about/contact" className="block hover:text-foreground transition-colors">Contact</Link>
                  <Link href="/privacy" className="block hover:text-foreground transition-colors">Privacy</Link>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-border/30 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-muted-foreground/70">
            <p>© {new Date().getFullYear()} Realist Inc. All rights reserved.</p>
            <p>
              Listings powered by{" "}
              <a href="https://valery.ca" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">
                Valery Real Estate Inc.
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
