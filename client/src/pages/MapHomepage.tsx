import { useRef, useEffect, useState, lazy, Suspense } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SEO, organizationSchema, websiteSchema, softwareSchema } from "@/components/SEO";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight, Users, MapPin, TrendingUp, GraduationCap,
  Calculator, Map, Eye, MessageSquare, Award, Trophy, BarChart3, Crown, Medal,
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

    setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {}
    }, 200);

    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (isFinite(lat) && isFinite(lng)) {
            map.flyTo([lat, lng], 8, { duration: 1.5 });
          }
        } catch {}
      },
      () => {},
      { timeout: 5000, maximumAge: 300000 }
    );
  }, [map]);
  return null;
}

const stats = [
  { icon: Users, value: "11,000+", label: "meetup members" },
  { icon: GraduationCap, value: "1,200+", label: "skool members" },
  { icon: MapPin, value: "26", label: "Canadian cities" },
  { icon: TrendingUp, value: "$2.6B", label: "in deals analyzed" },
];

const mediaLogos = [
  { name: "Reuters", image: reutersLogo, url: "https://www.reuters.com/markets/supply-canadas-property-market-surges-mortgage-renewals-loom-2024-07-17/" },
  { name: "WSJ", image: wsjLogo, url: "https://www.wsj.com/economy/housing/canadas-real-estate-market-stumbles-as-rate-hikes-bite-24a8a2da" },
  { name: "Investing.com", image: investingLogo, url: "https://ca.investing.com/members/contributors/245556786" },
  { name: "Bloomberg", image: bloombergLogo, url: "https://www.bloomberg.com" },
  { name: "Globe and Mail", image: globeMailLogo, url: "https://www.theglobeandmail.com/real-estate/article-for-a-few-homeowners-the-end-of-the-road-is-a-power-of-sale/" },
  { name: "CBC", image: cbcLogo, url: "https://www.cbc.ca/news/business/housing-prices-april-1.6454728" },
  { name: "Financial Post", image: financialPostLogo, url: "https://financialpost.com/news/canadians-down-payments-family-money-housing-market" },
  { name: "Toronto Star", image: torontoStarLogo, url: "https://www.thestar.com/real-estate/more-than-25-ontario-housing-developers-saw-projects-go-bust-this-year-a-higher-number/article_054d5bb4-60b5-11ef-abf2-6772c8215759.html" },
  { name: "BNN Bloomberg", image: bnnBloombergLogo, url: "https://www.bnnbloomberg.ca/video/shows/taking-stock/2024/09/06/taking-stock-what-the-bank-of-canadas-cut-might-do-to-the-housing-market/" },
  { name: "CTV", image: ctvLogo, url: "https://www.ctvnews.ca/video/c2839217-mortgage-agent--interest-payments-up-90-" },
  { name: "HGTV", image: hgtvLogo, url: "https://www.hgtv.ca" },
  { name: "CP24", image: cp24Logo, url: "https://www.cp24.com" },
  { name: "National Post", image: nationalPostLogo, url: "https://nationalpost.com" },
  { name: "Storeys", image: storeysLogo, url: "https://storeys.com" },
];

const howItWorksSteps = [
  {
    icon: Eye,
    title: "Browse Listings",
    description: "Explore active Canadian listings on an interactive yield map. Every property shows estimated gross yields using CMHC and market rent data.",
  },
  {
    icon: MessageSquare,
    title: "Underwrite & Comment",
    description: "Submit your own rent estimates, vacancy rates, and expense ratios. The community votes on the best analyses to surface consensus yields.",
  },
  {
    icon: Award,
    title: "Earn Recognition",
    description: "Climb the leaderboard by contributing quality underwriting notes and comments. Top analysts earn badges and community credibility.",
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
    <section className="py-16 md:py-24 border-t border-border/50 bg-muted/30" data-testid="section-leaderboard-preview">
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        <div className="text-center mb-8">
          <h2
            className="text-3xl md:text-4xl font-bold mb-4"
            data-testid="text-leaderboard-preview-title"
          >
            <Trophy className="inline-block h-8 w-8 mr-2 text-yellow-500 -mt-1" />
            Leaderboard
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Top analysts earning recognition for quality underwriting and deal analysis.
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

export default function MapHomepage() {
  const combinedSchema = {
    "@context": "https://schema.org",
    "@graph": [organizationSchema, websiteSchema, softwareSchema],
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SEO
        title="Realist.ca - Analyze Real Estate Deals to Train Ai That Investors Use"
        description="Canada's most researched real estate program. Browse listings with community-sourced yield estimates, analyze deals, and connect with 11,000+ investors."
        keywords="canadian real estate, yield map, real estate investing in canada, community underwriting, toronto real estate, daniel foch"
        canonicalUrl="/"
        structuredData={combinedSchema}
      />
      <Navigation />

      <section className="relative" style={{ minHeight: "80vh" }}>
        <div className="absolute inset-0 z-0">
          <div className="w-full h-full saturate-[0.3] blur-[2px]" style={{ pointerEvents: "none" }}>
            <MapContainer
              center={TORONTO_CENTER}
              zoom={6}
              scrollWheelZoom={false}
              dragging={false}
              zoomControl={false}
              doubleClickZoom={false}
              touchZoom={false}
              style={{ width: "100%", height: "100%", minHeight: "80vh" }}
              attributionControl={false}
            >
              <GeolocateOnMount />
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution=""
              />
            </MapContainer>
          </div>
        </div>

        <div className="absolute inset-0 z-10 bg-gradient-to-b from-background/70 via-background/50 to-background/80 dark:from-background/80 dark:via-background/60 dark:to-background/90" />

        <div className="relative z-20 flex items-center justify-center px-4" style={{ minHeight: "80vh" }}>
          <div className="max-w-2xl w-full">
            <Card className="backdrop-blur-md bg-card/80 dark:bg-card/70 border-border/60">
              <CardContent className="p-8 md:p-12 text-center space-y-6">
                <h1
                  className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight"
                  data-testid="text-map-hero-headline"
                >
                  Analyze real estate deals to train{" "}
                  <span className="text-gradient">Ai that investors use</span>
                </h1>
                <p
                  className="text-base md:text-lg text-muted-foreground max-w-lg mx-auto"
                  data-testid="text-map-hero-subhead"
                >
                  Real-time yield estimates powered by CMHC data and community underwriting.
                  See what investors are really paying attention to.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 flex-wrap">
                  <Link href="/tools/cap-rates">
                    <Button
                      size="lg"
                      className="gap-2 px-8"
                      data-testid="button-open-map"
                    >
                      <Map className="h-5 w-5" />
                      Open Yield Map
                    </Button>
                  </Link>
                  <Link href="/deal-analyzer">
                    <Button
                      variant="secondary"
                      size="lg"
                      className="gap-2 px-8"
                      data-testid="button-analyze-deal"
                    >
                      <Calculator className="h-5 w-5" />
                      Analyze a Deal
                    </Button>
                  </Link>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs text-muted-foreground">
                  <Link href="/community/leaderboard" className="underline underline-offset-2">
                    <span data-testid="link-leaderboard">Leaderboard</span>
                  </Link>
                  <a
                    href="https://www.skool.com/realist"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    <span data-testid="link-join-community">Join Community</span>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <>
          <section className="py-12 border-t border-border/50">
            <div className="max-w-7xl mx-auto px-4 md:px-6">
              <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
                {stats.map((stat, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3"
                    data-testid={`stat-${stat.label.replace(/\s+/g, "-")}`}
                  >
                    <stat.icon className="h-5 w-5 text-muted-foreground" />
                    <div className="text-left">
                      <div className="font-bold text-lg md:text-xl font-mono">
                        {stat.value}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {stat.label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="py-8 border-t border-border/50">
            <div className="max-w-4xl mx-auto px-4 md:px-6 text-center space-y-4">
              <h3 className="text-2xl font-bold text-gradient" data-testid="text-as-seen-on">
                As seen on:
              </h3>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 md:gap-4 max-w-4xl mx-auto">
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
                      className="h-4 md:h-5 w-auto max-w-full object-contain grayscale opacity-60 transition-all group-hover:grayscale-0 group-hover:opacity-100"
                    />
                  </a>
                ))}
              </div>
            </div>
          </section>

          <section className="py-16 md:py-24 border-t border-border/50" data-testid="section-deal-analyzer-embed">
            <div className="max-w-7xl mx-auto px-4 md:px-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl md:text-4xl font-bold mb-4" data-testid="text-analyzer-section-title">
                  Analyze Any Deal
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Underwrite buy & hold, BRRR, flip, Airbnb, and multiplex strategies with institutional-grade financial projections.
                </p>
              </div>
              <Suspense fallback={
                <div className="flex items-center justify-center py-20">
                  <div className="text-center space-y-3">
                    <Calculator className="h-8 w-8 mx-auto text-muted-foreground animate-pulse" />
                    <p className="text-sm text-muted-foreground">Loading Deal Analyzer...</p>
                  </div>
                </div>
              }>
                <Home embedded />
              </Suspense>
            </div>
          </section>

          <section className="py-16 md:py-24 border-t border-border/50">
            <div className="max-w-5xl mx-auto px-4 md:px-6">
              <div className="text-center mb-12">
                <h2
                  className="text-3xl md:text-4xl font-bold mb-4"
                  data-testid="text-how-it-works-title"
                >
                  How community underwriting works
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Combine public data with investor expertise to surface the most accurate yields in Canada.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {howItWorksSteps.map((step, idx) => (
                  <Card key={idx}>
                    <CardContent className="p-6 text-center space-y-4">
                      <div className="mx-auto w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center">
                        <step.icon className="h-6 w-6 text-primary" />
                      </div>
                      <Badge variant="secondary">Step {idx + 1}</Badge>
                      <h3 className="text-lg font-semibold" data-testid={`text-step-title-${idx + 1}`}>
                        {step.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {step.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          <LeaderboardPreview />

          <footer className="py-12 border-t border-border/50">
            <div className="max-w-7xl mx-auto px-4 md:px-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-center md:text-left">
                  <p className="font-bold text-lg">Realist.ca</p>
                  <p className="text-sm text-muted-foreground">
                    Canada's most researched real estate program.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
                  <Link href="/about">About</Link>
                  <Link href="/about/contact">Contact</Link>
                  <Link href="/privacy">Privacy</Link>
                  <Link href="/terms">Terms</Link>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-border/30 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-muted-foreground/70">
                <p>© {new Date().getFullYear()} Realist Inc. All rights reserved.</p>
                <p>
                  Real estate listings powered by{" "}
                  <a href="https://valery.ca" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">
                    valery.ca
                  </a>
                  {" / Valery Real Estate Inc."}
                </p>
              </div>
            </div>
          </footer>
      </>
    </div>
  );
}
