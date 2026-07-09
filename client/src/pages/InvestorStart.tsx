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
import { ArrowRight, ArrowUpRight, BarChart3, Brain, CheckCircle2, Compass, Headphones, Map, Mic, Play, Quote, Radar, Radio, Save, Sparkles, Target, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CANADA_SVG_PATH, CANADA_VIEWBOX } from "@/lib/canadaSilhouette";
import { mediaLogos } from "@/lib/mediaLogos";
import { SITE_STATS } from "@/lib/siteStats";
import { PODCAST_NAME, PODCAST_APPLE_URL, PODCAST_SPOTIFY_URL, PODCAST_YOUTUBE_URL } from "@shared/brand";
import danielImage from "@assets/ChatGPT_Image_Jan_6,_2026,_03_03_13_PM_1767729810400.png";
import nickImage from "@assets/ChatGPT_Image_Jan_6,_2026,_02_50_25_PM_1767729122931.png";

function formatCurrency(value?: number) {
  if (!value) return null;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Strip HTML tags + collapse whitespace from the RSS-sourced episode description. */
function stripHtml(value: string) {
  return (value || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

/** Safely format an episode pubDate; returns null when the date is unparseable. */
function formatEpisodeDate(pubDate: string) {
  if (!pubDate) return null;
  const parsed = new Date(pubDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "MMM d, yyyy");
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

type PodcastEpisode = {
  slug: string;
  title: string;
  description: string;
  pubDate: string;
  audioUrl: string;
  duration: string;
  link: string;
  imageUrl: string;
};

/**
 * Static heights for the decorative audio-waveform motif (%). Deterministic
 * (no Math.random) so SSR and the first client render agree — no hydration drift.
 */
const WAVEFORM_BARS = [
  34, 58, 82, 46, 96, 62, 38, 74, 90, 52, 30, 68, 88, 44, 78, 60, 36, 84, 54, 92,
  40, 70, 86, 48, 64, 32, 80, 56, 94, 42, 72, 66, 38, 88, 50, 76, 60, 34, 82, 58,
];

/**
 * Illustrative market-feed rows for the hero terminal panel. These are static
 * screening-vocabulary examples, NOT live data — the panel is labelled as such.
 */
const marketFeed = [
  { city: "Toronto", metric: "cap", value: "4.6%", delta: "+0.2", up: true },
  { city: "Calgary", metric: "cap", value: "6.1%", delta: "+0.4", up: true },
  { city: "Halifax", metric: "yield", value: "7.3%", delta: "+0.1", up: true },
  { city: "Ottawa", metric: "cash flow", value: "+$540", delta: "-$30", up: false },
  { city: "Edmonton", metric: "DSCR", value: "1.34x", delta: "+0.05", up: true },
];

/**
 * Inline monochrome platform glyphs styled via currentColor — no brand-icon
 * package is installed, and these render correctly in both light and dark mode.
 */
function AppleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.05 12.53c-.02-2.05 1.68-3.03 1.75-3.08-.95-1.4-2.44-1.59-2.97-1.61-1.26-.13-2.47.74-3.11.74-.64 0-1.63-.72-2.68-.7-1.38.02-2.65.8-3.36 2.04-1.43 2.49-.37 6.17 1.03 8.19.68.99 1.49 2.1 2.55 2.06 1.03-.04 1.42-.66 2.66-.66 1.24 0 1.59.66 2.68.64 1.11-.02 1.81-1 2.49-1.99.78-1.14 1.11-2.24 1.13-2.3-.03-.01-2.16-.83-2.18-3.27zM15.02 6.5c.56-.68.94-1.63.84-2.58-.81.03-1.79.54-2.37 1.22-.52.6-.98 1.56-.86 2.48.9.07 1.83-.46 2.39-1.12z" />
    </svg>
  );
}

function SpotifyGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm4.59 14.44a.62.62 0 01-.86.21c-2.35-1.44-5.3-1.76-8.79-.97a.62.62 0 11-.28-1.22c3.81-.87 7.08-.49 9.71 1.12.3.18.39.57.22.86zm1.22-2.72a.78.78 0 01-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.16a.78.78 0 11-.45-1.49c3.63-1.1 8.15-.57 11.24 1.32.36.22.48.7.25 1.07zm.1-2.83c-3.23-1.92-8.55-2.1-11.63-1.16a.94.94 0 11-.54-1.8c3.54-1.07 9.42-.86 13.14 1.34a.94.94 0 01-.97 1.62z" />
    </svg>
  );
}

function YouTubeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M23.5 6.2a3.02 3.02 0 00-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.51A3.02 3.02 0 00.5 6.2C0 8.09 0 12 0 12s0 3.91.5 5.8a3.02 3.02 0 002.12 2.14c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3.02 3.02 0 002.12-2.14C24 15.91 24 12 24 12s0-3.91-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" />
    </svg>
  );
}

const podcastPlatforms = [
  { name: "Apple Podcasts", href: PODCAST_APPLE_URL, Glyph: AppleGlyph, key: "apple" },
  { name: "Spotify", href: PODCAST_SPOTIFY_URL, Glyph: SpotifyGlyph, key: "spotify" },
  { name: "YouTube", href: PODCAST_YOUTUBE_URL, Glyph: YouTubeGlyph, key: "youtube" },
] as const;

export default function InvestorStart() {
  const { isAuthenticated, user } = useAuth();
  const [recentSavedListing, setRecentSavedListing] = useState(() => getSavedListingSignals()[0]);
  const [recentSavedSearch, setRecentSavedSearch] = useState(() => getSavedSearchSignals()[0]);
  // First-time visitors have no history — never show them their own empty state.
  const hasResumeSignals = Boolean(recentSavedListing || recentSavedSearch);
  const [calculationParticles, setCalculationParticles] = useState<CalculationParticle[]>([]);
  const particleIdRef = useRef(0);
  const lastParticleAtRef = useRef(0);

  const { data: episodes, isLoading: episodesLoading } = useQuery<PodcastEpisode[]>({
    queryKey: ["/api/podcast/episodes"],
    staleTime: 5 * 60 * 1000,
  });
  const latestEpisodes = (episodes ?? []).slice(0, 3);

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

      <style>{`
        @keyframes calc-float {
          0% { opacity: 0; transform: translate3d(0, 0, 0) scale(0.96); }
          15% { opacity: 0.78; }
          100% { opacity: 0; transform: translate3d(18px, -34px, 0) scale(1); }
        }
        @keyframes realist-rise {
          from { opacity: 0; transform: translate3d(0, 16px, 0); }
          to { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        @keyframes realist-wave {
          0%, 100% { transform: scaleY(0.35); opacity: 0.55; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        @keyframes realist-onair {
          0%, 100% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0.55); }
          50% { box-shadow: 0 0 0 6px hsl(var(--primary) / 0); }
        }
        @keyframes realist-bar-grow {
          from { transform: scaleY(0.15); }
          to { transform: scaleY(1); }
        }
        @keyframes realist-pulse-ring {
          0% { transform: scale(0.9); opacity: 0.7; }
          70% { transform: scale(1.9); opacity: 0; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes realist-dot-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.35); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .realist-rise { animation: realist-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
          .realist-bar { transform-origin: bottom; animation: realist-bar-grow 0.9s cubic-bezier(0.22, 1, 0.36, 1) both; }
          .realist-live-ring { animation: realist-pulse-ring 2.4s ease-out infinite; }
          .realist-onair-dot { animation: realist-onair 1.8s ease-in-out infinite; }
          .realist-market-dot { animation: realist-dot-pulse 2.4s ease-in-out infinite; }
        }
        /* Waveform bars animate only when motion is allowed; otherwise sit at a
           readable static height. */
        @media (prefers-reduced-motion: reduce) {
          .realist-wave-bar { animation: none !important; transform: scaleY(0.7); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .realist-wave-bar { animation: realist-wave var(--wave-dur, 1.4s) ease-in-out var(--wave-delay, 0s) infinite; }
        }
      `}</style>

      {/* ============================================================
          PODCAST RIBBON — persistent, before <Navigation>. The single
          most unmissable attribution device: a first-time visitor
          registers the podcast association before anything else.
         ============================================================ */}
      <div className="relative z-40 bg-gradient-to-r from-primary via-primary to-accent text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] sm:text-xs">
          <Radio className="h-3.5 w-3.5 shrink-0 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
          <span>
            Built by the hosts of <span className="font-bold">{PODCAST_NAME}</span> — Canada&apos;s #1 real estate podcast
          </span>
          <Link
            href="/insights/podcast"
            className="hidden shrink-0 items-center gap-1 rounded-full bg-primary-foreground/15 px-2.5 py-0.5 normal-case tracking-normal transition-colors hover:bg-primary-foreground/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground sm:inline-flex"
            onClick={() => track({ event: "cta_clicked", cta: "homepage_podcast_ribbon", location: "homepage_ribbon", destination: "/insights/podcast" })}
            data-testid="link-home-podcast-ribbon"
          >
            Listen
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <Navigation />

      <main>
        {/* ============================ HERO — ON-AIR STUDIO ============================ */}
        <section
          className="relative overflow-hidden border-b border-border/50 bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.22))]"
          onPointerMove={handleHeroPointerMove}
        >
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {/* Soft brand glows */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,hsl(var(--primary)/0.12),transparent_34%),radial-gradient(circle_at_84%_20%,hsl(var(--accent)/0.10),transparent_30%),radial-gradient(circle_at_50%_100%,hsl(var(--primary)/0.06),transparent_45%)]" />
            {/* Hairline grid for editorial-fintech texture */}
            <div className="absolute inset-0 opacity-[0.5] [background-image:linear-gradient(hsl(var(--border)/0.35)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.35)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(circle_at_50%_0%,black,transparent_75%)]" />
            {/* Faded Canada silhouette — projected from world-atlas countries-50m */}
            <svg
              viewBox={CANADA_VIEWBOX}
              preserveAspectRatio="xMidYMid slice"
              className="absolute inset-0 h-full w-full opacity-[0.16]"
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

          {/* Calculation particles follow the pointer */}
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

          <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-14 md:py-20 lg:py-24">
            <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
              {/* ---- Left: copy ---- */}
              <div className="realist-rise max-w-[640px]">
                {greeting && (
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-4">
                    {greeting}
                  </p>
                )}

                {/* ON-AIR pill — pulsing broadcast credential above the H1 */}
                <div
                  className="glass inline-flex items-center gap-2.5 rounded-full border border-primary/25 px-3.5 py-1.5 shadow-sm"
                  data-testid="badge-home-hero-onair"
                >
                  <span className="realist-onair-dot inline-block h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">On air</span>
                  <span className="h-3 w-px bg-border" aria-hidden="true" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Canada&apos;s #1 real estate podcast
                  </span>
                </div>

                <h1 className="mt-5 text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.03] text-balance">
                  Canadian real estate investing,{" "}
                  <span className="text-gradient">underwritten by AI.</span>
                </h1>
                <p className="mt-5 text-lg md:text-xl text-muted-foreground max-w-[560px]">
                  Paste a listing or address and get cash flow, yield, and risk in seconds.
                  Realist learns your buy box with every deal you run.
                </p>

                {/* Hosted-by line — explicit host attribution in-hero */}
                <div className="mt-6 flex items-center gap-3">
                  <span className="flex shrink-0 -space-x-3" aria-hidden="true">
                    <img src={danielImage} alt="" className="h-11 w-11 rounded-full border-2 border-background bg-muted object-cover object-top shadow-sm" />
                    <img src={nickImage} alt="" className="h-11 w-11 rounded-full border-2 border-background bg-muted object-cover object-top shadow-sm" />
                  </span>
                  <p className="text-sm text-muted-foreground">
                    Built by <span className="font-semibold text-foreground">Daniel Foch &amp; Nick Hill</span>,
                    hosts of <span className="font-semibold text-foreground">{PODCAST_NAME}</span>.
                  </p>
                </div>

                <AnalysesCounter className="mt-6 bg-background/80" />

                <div className="mt-7 flex flex-col sm:flex-row gap-3">
                  <Link href="/tools/analyzer">
                    <Button
                      size="lg"
                      className="gap-2 w-full sm:w-auto metric-glow"
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

                <p className="mt-4 text-sm text-muted-foreground max-w-[560px]">
                  Estimated metrics only. Screening signals are based on assumptions, not guaranteed returns.
                </p>

                {/* Feature row (3-up) */}
                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Save assumptions", icon: Save },
                    { label: "Apply to similar deals", icon: Radar },
                    { label: "Send an inspector", icon: Target },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/75 px-3 py-2 text-sm font-medium">
                        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                        {item.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ---- Right: realist://market-terminal — product visual anchor ---- */}
              <div className="realist-rise relative" style={{ animationDelay: "120ms" }}>
                <div className="relative mx-auto w-full max-w-md lg:max-w-none">
                  {/* Floating supporting chips (desktop only) */}
                  <div className="pointer-events-none absolute -left-4 -top-4 z-10 hidden rounded-lg border border-border/60 bg-card/90 px-3 py-2 shadow-lg backdrop-blur md:block" aria-hidden="true">
                    <p className="font-mono text-[11px] font-semibold text-primary">DSCR 1.18x</p>
                  </div>
                  <div className="pointer-events-none absolute -right-4 top-28 z-10 hidden rounded-lg border border-border/60 bg-card/90 px-3 py-2 shadow-lg backdrop-blur md:block" aria-hidden="true">
                    <p className="font-mono text-[11px] font-semibold text-accent">Cap 5.8%</p>
                  </div>

                  <div className="metric-glow relative overflow-hidden rounded-xl border border-border/70 bg-card/85 shadow-2xl shadow-primary/10 backdrop-blur-xl">
                    {/* Terminal chrome */}
                    <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex gap-1.5" aria-hidden="true">
                          <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
                          <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
                          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                        </span>
                        <span className="font-mono text-[11px] font-medium tracking-wide text-muted-foreground">
                          realist://market-terminal
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                        <span className="realist-market-dot h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                        Preview
                      </span>
                    </div>

                    {/* Mock underwriting result — the product stays the hero */}
                    <div className="border-b border-border/60 px-4 py-4">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="gap-1.5 text-xs font-medium">
                          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                          AI underwriting
                        </Badge>
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                          <span className="relative flex h-2 w-2">
                            <span className="realist-live-ring absolute inline-flex h-full w-full rounded-full bg-primary/60" aria-hidden="true" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                          </span>
                          Sample analysis
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-semibold">128 Maple Ave, Hamilton, ON</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Duplex · Long-term rental · $749,000</p>

                      {/* Metric grid */}
                      <div className="mt-4 grid grid-cols-3 gap-3">
                        {[
                          { label: "Cap rate", value: "5.8%", tone: "text-foreground" },
                          { label: "Cash flow", value: "+$420", tone: "text-primary" },
                          { label: "Deal score", value: "84", tone: "text-foreground" },
                        ].map((m) => (
                          <div key={m.label} className="rounded-lg border border-border/60 bg-background/60 p-3">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{m.label}</p>
                            <p className={`mt-1 font-mono text-xl font-bold tabular-nums ${m.tone}`}>{m.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Mini 5-yr cash-flow projection bars */}
                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground">5-yr cash-flow projection</p>
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                            <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                            +14%
                          </span>
                        </div>
                        <div className="flex h-16 items-end gap-2" aria-hidden="true">
                          {[46, 58, 63, 74, 88].map((h, i) => (
                            <div key={i} className="flex-1 overflow-hidden rounded-t-md bg-muted/60">
                              <div
                                className="realist-bar w-full rounded-t-md bg-gradient-to-t from-primary/70 to-accent/70"
                                style={{ height: `${h}%`, animationDelay: `${i * 90}ms` }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Signal rows */}
                      <div className="mt-4 space-y-2 rounded-lg border border-border/60 bg-background/50 p-3">
                        {[
                          "Rent supported by 3 comparable units",
                          "DSCR clears lender threshold (1.18x)",
                          "Below-median price for the postal area",
                        ].map((line) => (
                          <div key={line} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                            <span className="text-muted-foreground">{line}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Illustrative market feed — labelled, not live data */}
                    <div>
                      <div className="flex items-center justify-between px-4 pt-3 pb-1">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {SITE_STATS.canadianCities} Canadian markets
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                          Illustrative
                        </span>
                      </div>
                      <div className="divide-y divide-border/50">
                        {marketFeed.map((row) => (
                          <div key={row.city} className="flex items-center justify-between px-4 py-2">
                            <div className="flex items-center gap-2.5">
                              <span className="text-sm font-semibold">{row.city}</span>
                              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{row.metric}</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono text-sm font-bold tabular-nums">{row.value}</span>
                              <span className={`inline-flex items-center gap-0.5 font-mono text-[11px] font-semibold tabular-nums ${row.up ? "text-primary" : "text-muted-foreground"}`}>
                                <TrendingUp className={`h-3 w-3 ${row.up ? "" : "rotate-180"}`} aria-hidden="true" />
                                {row.delta}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================ STATS + PRESS ============================ */}
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
                  <p className="text-2xl md:text-3xl font-bold font-mono tabular-nums">{stat.value}</p>
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
              {/* Third, low-cost podcast reinforcement under the press strip */}
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Headphones className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                And heard by ~120k Canadian investors a month on Apple, Spotify, and YouTube.
              </p>
            </div>
          </div>
        </section>

        {/* ============================ DEDICATED PODCAST BAND ============================
            Placed BEFORE the product-paths section so it reads as the
            credibility / trust engine woven around the product. */}
        <section className="relative overflow-hidden border-b border-border/40 bg-[linear-gradient(180deg,hsl(var(--muted)/0.25),hsl(var(--background)))] py-14 md:py-20">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,hsl(var(--primary)/0.09),transparent_36%),radial-gradient(circle_at_88%_85%,hsl(var(--accent)/0.08),transparent_38%)]" />
          </div>

          <div className="relative max-w-6xl mx-auto px-4 md:px-6">
            {/* Section header with the broadcast waveform motif */}
            <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Badge className="w-fit gap-1.5 bg-primary text-primary-foreground hover:bg-primary">
                  <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                  The podcast behind Realist
                </Badge>
                <h2 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight text-balance">
                  Built by the hosts of Canada&apos;s #1 real estate podcast.
                </h2>
              </div>
              <div
                className="hidden h-12 items-center gap-[3px] rounded-xl border border-border/50 bg-background/50 px-3 sm:flex sm:w-64 sm:justify-center lg:w-80"
                aria-hidden="true"
              >
                {WAVEFORM_BARS.map((h, i) => (
                  <span
                    key={i}
                    className="realist-wave-bar w-[3px] shrink-0 origin-center rounded-full bg-gradient-to-t from-primary to-accent"
                    style={{
                      height: `${h}%`,
                      // Deterministic per-bar stagger — no random values, SSR-safe.
                      "--wave-dur": `${1.2 + (i % 5) * 0.18}s`,
                      "--wave-delay": `${(i % 7) * 0.09}s`,
                    } as CSSProperties}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              {/* Left: the show story + pull-quote + hosts + CTAs (sticky on lg) */}
              <div className="lg:sticky lg:top-24 lg:self-start">
                <p className="text-muted-foreground text-lg">
                  {PODCAST_NAME} reaches over{" "}
                  <span className="font-semibold text-foreground">120,000 listeners a month</span>. Realist is
                  the AI deal-underwriting platform Daniel and Nick built to run the same numbers they teach on
                  the show — now open to every Canadian investor.
                </p>

                {/* Semantic pull-quote credited to both hosts */}
                <figure
                  className="mt-6 rounded-xl border border-primary/20 bg-card/70 p-5 shadow-sm backdrop-blur-sm"
                  aria-labelledby="podcast-quote-attribution"
                >
                  <Quote className="h-5 w-5 text-primary/70" aria-hidden="true" />
                  <blockquote className="mt-2 text-base font-medium leading-relaxed text-foreground">
                    &ldquo;As heard by 120k Canadians every month — the same rigour we bring to the mic,
                    now underwriting your deals.&rdquo;
                  </blockquote>
                  <figcaption id="podcast-quote-attribution" className="mt-3 flex items-center gap-3">
                    <span className="flex shrink-0 -space-x-2.5" aria-hidden="true">
                      <img src={danielImage} alt="" className="h-9 w-9 rounded-full border-2 border-background bg-muted object-cover object-top" />
                      <img src={nickImage} alt="" className="h-9 w-9 rounded-full border-2 border-background bg-muted object-cover object-top" />
                    </span>
                    <span className="text-sm">
                      <span className="font-semibold text-foreground">Daniel Foch &amp; Nick Hill</span>
                      <span className="block text-xs text-muted-foreground">Part of The Canadian Investor Podcast Network</span>
                    </span>
                  </figcaption>
                </figure>

                {/* Host portraits with real, descriptive alt text */}
                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                  {[
                    { img: danielImage, name: "Daniel Foch", role: "Co-host" },
                    { img: nickImage, name: "Nick Hill", role: "Co-host" },
                  ].map((host) => (
                    <div key={host.name} className="flex items-center gap-3">
                      <img
                        src={host.img}
                        alt={`${host.name}, co-host of ${PODCAST_NAME}`}
                        className="h-14 w-14 rounded-full border-2 border-primary/25 bg-muted object-cover object-top shadow-sm"
                      />
                      <div>
                        <p className="text-sm font-semibold leading-tight">{host.name}</p>
                        <p className="text-xs text-muted-foreground">{host.role}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Listen CTA + platform links */}
                <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:items-center">
                  <Link href="/insights/podcast">
                    <Button
                      size="lg"
                      className="gap-2 w-full sm:w-auto"
                      onClick={() => {
                        track({ event: "cta_clicked", cta: "homepage_podcast_listen", location: "homepage_podcast", destination: "/insights/podcast" });
                        trackRealistEvent("homepage.cta_clicked", { cta: "listen_to_podcast", location: "homepage_podcast", destination: "/insights/podcast" });
                      }}
                      data-testid="button-home-podcast-listen"
                    >
                      <Headphones className="h-4 w-4" aria-hidden="true" />
                      Listen to the podcast
                    </Button>
                  </Link>
                  <div className="flex items-center gap-2">
                    {podcastPlatforms.map(({ name, href, Glyph, key }) => (
                      <a
                        key={key}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Listen on ${name}`}
                        title={`Listen on ${name}`}
                        className="flex h-11 w-11 items-center justify-center rounded-md border border-border/60 bg-background/70 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                        onClick={() => track({ event: "cta_clicked", cta: `homepage_podcast_${key}`, location: "homepage_podcast", destination: href })}
                        data-testid={`link-home-podcast-${key}`}
                      >
                        <Glyph className="h-5 w-5" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: compact stat card (lg) + live episodes rail */}
              <div>
                {/* Compact 120k / #1 / 2-hosts credibility card */}
                <Card className="mb-6 hidden border-primary/25 bg-card/70 backdrop-blur-xl lg:block">
                  <CardContent className="grid grid-cols-3 gap-4 p-5">
                    <div>
                      <p className="font-mono text-2xl font-bold tabular-nums text-primary">120k</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">listeners / month</p>
                    </div>
                    <div className="border-l border-border/60 pl-4">
                      <p className="font-mono text-2xl font-bold tabular-nums">#1</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">CDN real estate podcast</p>
                    </div>
                    <div className="border-l border-border/60 pl-4">
                      <p className="font-mono text-2xl font-bold tabular-nums">2</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">investor hosts</p>
                    </div>
                  </CardContent>
                </Card>

                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Latest episodes</p>
                  <Link
                    href="/insights/podcast"
                    className="inline-flex items-center gap-1 rounded text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    onClick={() => track({ event: "cta_clicked", cta: "homepage_podcast_all_episodes", location: "homepage_podcast", destination: "/insights/podcast" })}
                    data-testid="link-home-podcast-all-episodes"
                  >
                    All episodes
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>

                <div className="space-y-3">
                  {episodesLoading &&
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4 rounded-xl border border-border/60 bg-card/70 p-3" aria-hidden="true">
                        <div className="h-16 w-16 shrink-0 animate-pulse rounded-lg bg-muted" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                        </div>
                      </div>
                    ))}

                  {!episodesLoading &&
                    latestEpisodes.map((episode) => {
                      const summary = stripHtml(episode.description);
                      const dateLabel = formatEpisodeDate(episode.pubDate);
                      return (
                        <Link
                          key={episode.slug}
                          href={`/insights/podcast/${episode.slug}`}
                          className="group flex items-center gap-4 rounded-xl border border-border/60 bg-card/70 p-3 shadow-sm backdrop-blur-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                          onClick={() => track({ event: "cta_clicked", cta: "homepage_podcast_episode", location: "homepage_podcast", destination: `/insights/podcast/${episode.slug}` })}
                          data-testid={`link-home-podcast-episode-${episode.slug}`}
                        >
                          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
                            {episode.imageUrl ? (
                              <img src={episode.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                <Mic className="h-6 w-6" aria-hidden="true" />
                              </div>
                            )}
                            <span className="absolute inset-0 flex items-center justify-center bg-background/40 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">
                              <Play className="h-6 w-6 fill-primary text-primary" />
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              {dateLabel && <span>{dateLabel}</span>}
                              {dateLabel && episode.duration && <span aria-hidden="true">·</span>}
                              {episode.duration && <span className="font-mono tabular-nums">{episode.duration}</span>}
                            </div>
                            <p className="mt-0.5 truncate text-sm font-semibold text-foreground group-hover:text-primary">
                              {episode.title}
                            </p>
                            {summary && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{summary}</p>}
                          </div>
                          <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
                        </Link>
                      );
                    })}

                  {!episodesLoading && latestEpisodes.length === 0 && (
                    <Card className="border-border/60 bg-card/70">
                      <CardContent className="flex items-center gap-4 p-5">
                        <Radio className="h-8 w-8 text-primary" aria-hidden="true" />
                        <div>
                          <p className="font-semibold">New episodes every week</p>
                          <p className="text-sm text-muted-foreground">
                            Catch the latest on {PODCAST_NAME}.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================ PRODUCT PATHS ============================ */}
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
                    <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
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
                    <Map className="h-3.5 w-3.5" aria-hidden="true" />
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

        {/* ============================ COMPOUNDING INTELLIGENCE + RESUME ============================ */}
        <section className="pb-14 md:pb-20">
          <div className="max-w-6xl mx-auto px-4 md:px-6">
            <div className={hasResumeSignals ? "grid gap-5 lg:grid-cols-[1.2fr_0.8fr]" : "grid gap-5"}>
              <Card className="border-border/60 bg-gradient-to-br from-card via-card to-primary/5">
                <CardHeader>
                  <Badge variant="secondary" className="mb-2 w-fit gap-1">
                    <Brain className="h-3.5 w-3.5" aria-hidden="true" />
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
                        <Radar className="h-4 w-4 text-primary" aria-hidden="true" />
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
                          <Save className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
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

        {/* ============================ PRO BAND ============================ */}
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
                    I&apos;m a realtor
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
