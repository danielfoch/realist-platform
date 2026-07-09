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
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Brain,
  CheckCircle2,
  Compass,
  Headphones,
  Loader2,
  Map,
  Mic,
  Play,
  Quote,
  Radar,
  Radio,
  Save,
  Search,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CANADA_SVG_PATH, CANADA_VIEWBOX } from "@/lib/canadaSilhouette";
import { mediaLogos } from "@/lib/mediaLogos";
import { SITE_STATS } from "@/lib/siteStats";
import { PODCAST_NAME, PODCAST_APPLE_URL, PODCAST_SPOTIFY_URL, PODCAST_YOUTUBE_URL } from "@shared/brand";
import logoImage from "@assets/Untitled_design_(4)_1773356428184.png";
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

/* ==========================================================================
   HERO DEMO — fully deterministic sample deals that drive the self-running
   analyzer loop. Illustrative underwriting examples, NOT live listings;
   every surface that renders them is labelled as such.
   ========================================================================== */

type LedgerRow = { k: string; v: string; signal?: boolean };

type DemoDeal = {
  address: string;
  meta: string;
  capRate: string;
  cashFlow: string;
  dscr: string;
  score: number;
  verdict: string;
  ledger: LedgerRow[];
  bars: number[];
};

const DEMO_DEALS: DemoDeal[] = [
  {
    address: "128 Maple Ave, Hamilton, ON",
    meta: "Duplex · Long-term rental · $749,000",
    capRate: "5.8%",
    cashFlow: "+$420",
    dscr: "1.18x",
    score: 84,
    verdict: "within buy box @ 5.8% cap",
    ledger: [
      { k: "Gross rent / mo", v: "$3,850" },
      { k: "Operating costs", v: "−$1,290" },
      { k: "Debt service", v: "−$2,140" },
      { k: "Net cash flow / mo", v: "+$420", signal: true },
      { k: "DSCR", v: "1.18x" },
    ],
    bars: [46, 58, 63, 74, 88],
  },
  {
    address: "2204-110 9 Ave SW, Calgary, AB",
    meta: "Condo · Long-term rental · $424,900",
    capRate: "6.1%",
    cashFlow: "+$310",
    dscr: "1.24x",
    score: 78,
    verdict: "worth a closer look @ 6.1% cap",
    ledger: [
      { k: "Gross rent / mo", v: "$2,450" },
      { k: "Operating costs", v: "−$860" },
      { k: "Debt service", v: "−$1,280" },
      { k: "Net cash flow / mo", v: "+$310", signal: true },
      { k: "DSCR", v: "1.24x" },
    ],
    bars: [40, 52, 60, 68, 76],
  },
  {
    address: "41 Quinpool Ct, Halifax, NS",
    meta: "Triplex · House hack · $819,000",
    capRate: "6.4%",
    cashFlow: "+$730",
    dscr: "1.31x",
    score: 91,
    verdict: "top decile for this market",
    ledger: [
      { k: "Gross rent / mo", v: "$4,980" },
      { k: "Operating costs", v: "−$1,610" },
      { k: "Debt service", v: "−$2,640" },
      { k: "Net cash flow / mo", v: "+$730", signal: true },
      { k: "DSCR", v: "1.31x" },
    ],
    bars: [52, 64, 72, 84, 96],
  },
];

const ANALYZE_STEPS = [
  "Pulling comparable rents",
  "Estimating operating costs",
  "Stress-testing the financing",
];

type DemoPhase = "typing" | "analyzing" | "result";

/** Deal-score gauge geometry — r=26, deterministic circumference. */
const GAUGE_RADIUS = 26;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

/**
 * Static heights for the decorative audio-waveform motifs (%). Deterministic
 * (no Math.random) so SSR and the first client render agree — no hydration drift.
 */
const WAVEFORM_BARS = [
  34, 58, 82, 46, 96, 62, 38, 74, 90, 52, 30, 68, 88, 44, 78, 60, 36, 84, 54, 92,
  40, 70, 86, 48, 64, 32, 80, 56, 94, 42, 72, 66, 38, 88, 50, 76, 60, 34, 82, 58,
];

/** Short deterministic waveform for the terminal-footer micro-attribution. */
const MICRO_WAVE_BARS = [40, 72, 52, 96, 60, 34, 84, 48];

/**
 * Rolling network-credit ticker items. Rendered twice inside a marquee so the
 * -50% translate loops seamlessly; a sr-only sentence carries the meaning.
 */
const CREDIT_TICKER = [
  "The Canadian Real Estate Investor",
  "Canada's #1 real estate podcast",
  "120k monthly listeners",
  "Hosted by Daniel Foch & Nick Hill",
  "Part of The Canadian Investor Podcast Network",
  "Now underwriting your deals as Realist",
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

/** Catalogue-plate host figures — the only large-host treatment that works
    with the real opaque white-background portraits (object-cover crops). */
const hosts = [
  { img: danielImage, name: "Daniel Foch", fig: "Fig. 01" },
  { img: nickImage, name: "Nick Hill", fig: "Fig. 02" },
] as const;

/**
 * Radial deal-score gauge. Deterministic stroke-dashoffset math; the draw-in
 * animation is motion-gated, and the attribute value IS the completed ring,
 * so reduced-motion (and SSR) render the finished state.
 */
function ScoreGauge({ score }: { score: number }) {
  const offset = GAUGE_CIRCUMFERENCE * (1 - score / 100);
  return (
    <div className="relative shrink-0" role="img" aria-label={`Sample deal score: ${score} out of 100`}>
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={GAUGE_RADIUS} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={GAUGE_RADIUS}
          fill="none"
          stroke="url(#realist-score-gradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={GAUGE_CIRCUMFERENCE.toFixed(2)}
          strokeDashoffset={offset.toFixed(2)}
          className="realist-gauge"
        />
        <defs>
          <linearGradient id="realist-score-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--accent))" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className="font-mono text-base font-bold tabular-nums leading-none">{score}</span>
        <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">score</span>
      </span>
    </div>
  );
}

/** One rendered analysis frame inside the demo terminal. */
function DemoResult({ deal, ghost }: { deal: DemoDeal; ghost?: boolean }) {
  return (
    <div className={ghost ? "opacity-30 blur-[1.5px] saturate-50" : "realist-result"}>
      {/* Subject + gauge */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{deal.address}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{deal.meta}</p>
          <Badge variant="secondary" className="mt-2 gap-1.5 text-xs font-medium">
            <Sparkles className="h-3 w-3 text-primary" aria-hidden="true" />
            AI underwriting
          </Badge>
        </div>
        <ScoreGauge score={deal.score} />
      </div>

      {/* Metric trio */}
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {[
          { label: "Cap rate", value: deal.capRate, tone: "text-foreground" },
          { label: "Cash flow", value: deal.cashFlow, tone: "text-primary" },
          { label: "DSCR", value: deal.dscr, tone: "text-foreground" },
        ].map((m) => (
          <div key={m.label} className="rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.03)]">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{m.label}</p>
            <p className={`mt-0.5 font-mono text-lg font-bold tabular-nums ${m.tone}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Underwriting ledger with dotted leaders + verdict line */}
      <div className="mt-4 rounded-lg border border-border/60 bg-background/50 px-3.5 py-2.5 font-mono text-xs">
        {deal.ledger.map((row) => (
          <div key={row.k} className="flex items-baseline gap-2 py-[4px]">
            <span className="uppercase tracking-[0.06em] text-muted-foreground">{row.k}</span>
            <span className="flex-1 border-b border-dotted border-border" aria-hidden="true" />
            <span className={`font-semibold tabular-nums ${row.signal ? "text-primary" : "text-foreground"}`}>{row.v}</span>
          </div>
        ))}
        <p className="pt-1.5">
          <span className="text-muted-foreground">&gt; verdict:</span>{" "}
          <span className="font-semibold text-foreground">{deal.verdict}</span>
          <span className="realist-cursor ml-0.5 inline-block h-3 w-[7px] translate-y-[2px] bg-primary" aria-hidden="true" />
        </p>
      </div>

      {/* Y1–Y5 projection bars on a gridline plate */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">5-yr cash-flow projection</p>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
            trending up
          </span>
        </div>
        <div
          className="relative flex h-14 items-end gap-2 rounded-lg border border-border/50 bg-background/40 p-2 [background-image:linear-gradient(hsl(var(--border)/0.4)_1px,transparent_1px)] [background-size:100%_25%]"
          aria-hidden="true"
        >
          {deal.bars.map((h, i) => (
            <div key={i} className="flex h-full flex-1 items-end overflow-hidden rounded-t-md">
              <div
                className="realist-bar w-full rounded-t-md bg-gradient-to-t from-primary/75 to-accent/75 shadow-[0_0_12px_-4px_hsl(var(--primary)/0.6)]"
                style={{ height: `${h}%`, animationDelay: `${i * 90}ms` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between px-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70" aria-hidden="true">
          <span>Y1</span><span>Y2</span><span>Y3</span><span>Y4</span><span>Y5</span>
        </div>
      </div>
    </div>
  );
}

/**
 * The analyzer, performing. Self-driving demo loop: typing → analyzing →
 * result across three deterministic sample deals.
 *
 * SSR / reduced-motion strategy: state initializes to the COMPLETE final
 * frame of deal 0 (address fully typed, result on screen), so the server
 * render, the first client paint, and the prefers-reduced-motion experience
 * are identical — the loop only starts after mount, and only when the
 * visitor allows motion. All typing state lives in this leaf component so
 * the keystroke re-render never churns the rest of the page.
 */
function HeroDemoTerminal() {
  const [demoActive, setDemoActive] = useState(false);
  const [dealIndex, setDealIndex] = useState(0);
  const [phase, setPhase] = useState<DemoPhase>("result");
  const [typedChars, setTypedChars] = useState(DEMO_DEALS[0].address.length);

  const deal = DEMO_DEALS[dealIndex];
  const prevDeal = DEMO_DEALS[(dealIndex + DEMO_DEALS.length - 1) % DEMO_DEALS.length];
  const typedText = deal.address.slice(0, typedChars);

  useEffect(() => {
    // Respect prefers-reduced-motion: leave the static final frame in place.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setDemoActive(true);
  }, []);

  useEffect(() => {
    if (!demoActive) return;
    const current = DEMO_DEALS[dealIndex];
    let timer: number;
    if (phase === "typing") {
      timer =
        typedChars < current.address.length
          ? window.setTimeout(() => setTypedChars((c) => c + 1), 85)
          : window.setTimeout(() => setPhase("analyzing"), 450);
    } else if (phase === "analyzing") {
      timer = window.setTimeout(() => setPhase("result"), 1800);
    } else {
      timer = window.setTimeout(() => {
        setTypedChars(0);
        setDealIndex((i) => (i + 1) % DEMO_DEALS.length);
        setPhase("typing");
      }, 5200);
    }
    return () => window.clearTimeout(timer);
  }, [demoActive, phase, typedChars, dealIndex]);

  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      {/* Halo so the terminal floats off the aurora */}
      <div
        className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-[radial-gradient(closest-side,hsl(var(--primary)/0.12),transparent)] blur-xl"
        aria-hidden="true"
      />

      {/* Floating supporting chips (desktop only) */}
      <div className="pointer-events-none absolute -left-5 -top-5 z-10 hidden rounded-lg border border-border/60 bg-card/90 px-3 py-2 shadow-lg backdrop-blur md:block" aria-hidden="true">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Lender check</p>
        <p className="font-mono text-[13px] font-bold text-primary">DSCR 1.18x</p>
      </div>
      <div className="pointer-events-none absolute -right-5 top-32 z-10 hidden rounded-lg border border-border/60 bg-card/90 px-3 py-2 shadow-lg backdrop-blur md:block" aria-hidden="true">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Screening</p>
        <p className="font-mono text-[13px] font-bold text-accent">Cap 5.8%</p>
      </div>

      {/* Accessible summary of the demo — the moving frames are decorative */}
      <p className="sr-only">
        Product demo: a sample Realist analysis of {DEMO_DEALS[0].address} showing a cap rate of{" "}
        {DEMO_DEALS[0].capRate}, monthly cash flow of {DEMO_DEALS[0].cashFlow}, a DSCR of{" "}
        {DEMO_DEALS[0].dscr}, and a deal score of {DEMO_DEALS[0].score} out of 100. Illustrative
        sample data only — not live listings.
      </p>

      <div className="metric-glow relative overflow-hidden rounded-xl border border-border/70 bg-card/85 shadow-2xl shadow-primary/10 ring-1 ring-inset ring-foreground/[0.04] backdrop-blur-xl">
        {/* Terminal chrome */}
        <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-4 py-2.5 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)]">
          <div className="flex items-center gap-2">
            <img src={logoImage} alt="" className="h-4 w-auto dark:invert" aria-hidden="true" />
            <span className="font-mono text-[11px] font-medium tracking-wide text-muted-foreground">
              realist://analyzer
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
            <span className="realist-market-dot h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            Sample analysis
          </span>
        </div>

        {/* Address input — the typing loop, with a REAL link into the analyzer */}
        <div className="border-b border-border/60 px-4 py-3.5">
          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/80 py-1.5 pl-3.5 pr-1.5 shadow-inner">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate font-mono text-sm" aria-hidden="true">
              {typedText}
              {phase === "typing" && (
                <span className="realist-cursor ml-0.5 inline-block h-4 w-[2px] translate-y-[3px] bg-primary" />
              )}
            </span>
            <Link
              href="/tools/analyzer"
              className="shrink-0"
              onClick={() => {
                track({ event: "cta_clicked", cta: "homepage_demo_analyze", location: "homepage_demo", destination: "/tools/analyzer" });
                trackRealistEvent("homepage.cta_clicked", { cta: "demo_analyze", location: "homepage_demo", destination: "/tools/analyzer" });
              }}
              data-testid="button-home-demo-analyze"
            >
              <Button size="sm" className="gap-1.5">
                {phase === "analyzing" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    Underwriting…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    Analyze
                  </>
                )}
              </Button>
            </Link>
          </div>
        </div>

        {/* Result stage — cycles typing ghost / analyzing / result */}
        <div className="relative min-h-[420px] px-4 py-4" aria-hidden="true">
          {phase === "result" && <DemoResult key={`result-${dealIndex}`} deal={deal} />}

          {phase === "typing" && <DemoResult deal={prevDeal} ghost />}

          {phase === "analyzing" && (
            <div className="pt-1">
              <div className="space-y-3">
                {ANALYZE_STEPS.map((step, i) => (
                  <div
                    key={step}
                    className="realist-step flex items-center gap-2.5 text-sm text-muted-foreground"
                    style={{ animationDelay: `${i * 380}ms` }}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    </span>
                    {step}
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-2.5">
                {[100, 83, 62, 74].map((w, i) => (
                  <div
                    key={i}
                    className="h-9 animate-pulse rounded-lg bg-muted/70 motion-reduce:animate-none"
                    style={{ width: `${w}%`, animationDelay: `${i * 160}ms` }}
                  />
                ))}
              </div>
              <p className="mt-5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Modelling {deal.meta.split(" · ")[0]} economics…
              </p>
            </div>
          )}
        </div>

        {/* Terminal footer — provenance INSIDE the product mock + loop position */}
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/30 px-4 py-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <Mic className="h-3 w-3 text-primary" aria-hidden="true" />
            A {PODCAST_NAME} product
          </span>
          <span className="flex items-center gap-3">
            <span className="flex h-3 items-center gap-[2px]" aria-hidden="true">
              {MICRO_WAVE_BARS.map((h, i) => (
                <span
                  key={i}
                  className="realist-wave-bar w-[2px] origin-center rounded-full bg-primary/60"
                  style={{
                    height: `${h}%`,
                    "--wave-dur": `${1.3 + (i % 4) * 0.2}s`,
                    "--wave-delay": `${(i % 5) * 0.11}s`,
                  } as CSSProperties}
                />
              ))}
            </span>
            <span className="flex items-center gap-1.5" aria-hidden="true">
              {DEMO_DEALS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === dealIndex ? "w-5 bg-primary" : "w-1.5 bg-border"
                  }`}
                />
              ))}
            </span>
          </span>
        </div>
      </div>

      <p className="mt-2.5 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
        Sample data · Not live listings
      </p>
    </div>
  );
}

export default function InvestorStart() {
  const { isAuthenticated, user } = useAuth();
  const [recentSavedListing, setRecentSavedListing] = useState(() => getSavedListingSignals()[0]);
  const [recentSavedSearch, setRecentSavedSearch] = useState(() => getSavedSearchSignals()[0]);
  // First-time visitors have no history — never show them their own empty state.
  const hasResumeSignals = Boolean(recentSavedListing || recentSavedSearch);
  const heroGlowRef = useRef<HTMLDivElement>(null);

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

  /**
   * Signature hero interaction: a soft key-light follows the pointer, like a
   * spot operator tracking the subject. Mutates a CSS variable directly (no
   * re-render), skipped on touch; the default position is a deterministic
   * inline style so SSR and hydration agree.
   */
  const handleHeroPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;
    const node = heroGlowRef.current;
    if (!node) return;
    const rect = event.currentTarget.getBoundingClientRect();
    node.style.setProperty("--spot-x", `${(((event.clientX - rect.left) / rect.width) * 100).toFixed(2)}%`);
    node.style.setProperty("--spot-y", `${(((event.clientY - rect.top) / rect.height) * 100).toFixed(2)}%`);
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
        @keyframes realist-rise {
          from { opacity: 0; transform: translate3d(0, 18px, 0); }
          to { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        @keyframes realist-blink {
          0%, 45% { opacity: 1; }
          50%, 95% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes realist-result-in {
          from { opacity: 0; transform: translate3d(0, 12px, 0) scale(0.99); }
          to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes realist-step-in {
          from { opacity: 0; transform: translate3d(-8px, 0, 0); }
          to { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        @keyframes realist-bar-grow {
          from { transform: scaleY(0.15); }
          to { transform: scaleY(1); }
        }
        @keyframes realist-gauge-draw {
          from { stroke-dashoffset: ${GAUGE_CIRCUMFERENCE.toFixed(2)}; }
        }
        @keyframes realist-onair {
          0%, 100% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0.55); }
          50% { box-shadow: 0 0 0 6px hsl(var(--primary) / 0); }
        }
        @keyframes realist-dot-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.35); }
        }
        @keyframes realist-wave {
          0%, 100% { transform: scaleY(0.35); opacity: 0.55; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        @keyframes realist-ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes realist-aurora {
          0%, 100% { transform: translate3d(-4%, -2%, 0) rotate(0deg) scale(1); }
          50% { transform: translate3d(4%, 3%, 0) rotate(6deg) scale(1.08); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .realist-rise { animation: realist-rise 0.75s cubic-bezier(0.22, 1, 0.36, 1) both; }
          .realist-cursor { animation: realist-blink 1.05s step-end infinite; }
          .realist-result { animation: realist-result-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
          .realist-step { animation: realist-step-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
          .realist-bar { transform-origin: bottom; animation: realist-bar-grow 0.9s cubic-bezier(0.22, 1, 0.36, 1) both; }
          .realist-gauge { animation: realist-gauge-draw 1.4s cubic-bezier(0.22, 1, 0.36, 1) 0.2s both; }
          .realist-onair-dot { animation: realist-onair 1.8s ease-in-out infinite; }
          .realist-market-dot { animation: realist-dot-pulse 2.4s ease-in-out infinite; }
          .realist-ticker { animation: realist-ticker 36s linear infinite; }
          .realist-aurora { animation: realist-aurora 16s ease-in-out infinite; }
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

      <Navigation />

      {/* ============================================================
          MASTHEAD — the formal publisher lockup. Thick foreground rule
          above, hairline below: the first thing a new visitor reads is
          the provenance line, in ownership grammar rather than banner
          grammar. The Listen link stays visible on every breakpoint.
         ============================================================ */}
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="border-t-2 border-foreground" aria-hidden="true" />
          <div className="flex flex-col items-center justify-between gap-x-6 gap-y-1.5 py-3 text-center md:flex-row md:text-left">
            <p className="order-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground md:order-1">
              120,000 listeners / month
            </p>
            <p className="order-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground md:order-2">
              Presented by {PODCAST_NAME}
              <span className="font-medium text-muted-foreground"> — Canada&apos;s #1 real estate podcast</span>
            </p>
            <Link
              href="/insights/podcast"
              className="order-3 inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              onClick={() => track({ event: "cta_clicked", cta: "homepage_podcast_ribbon", location: "homepage_ribbon", destination: "/insights/podcast" })}
              data-testid="link-home-podcast-ribbon"
            >
              Listen
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ============================ HERO — THE ANALYZER, ON AIR ============================
            The product performs live under studio light: the self-driving
            analyzer demo is the visual anchor, hosts credited on a
            lower-third chyron beneath the headline. */}
        <section
          className="relative overflow-hidden border-b border-border/50 bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.22))]"
          onPointerMove={handleHeroPointerMove}
        >
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {/* Aurora layer 1 — soft static brand glows */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_14%_12%,hsl(var(--primary)/0.14),transparent_38%),radial-gradient(ellipse_at_86%_18%,hsl(var(--accent)/0.12),transparent_34%),radial-gradient(ellipse_at_50%_105%,hsl(var(--primary)/0.08),transparent_48%)]" />
            {/* Aurora layer 2 — slow-drifting blurred bloom for living depth (motion-gated) */}
            <div className="realist-aurora absolute -top-1/4 left-1/4 h-[70%] w-[60%] rounded-full bg-[radial-gradient(closest-side,hsl(var(--accent)/0.10),hsl(var(--primary)/0.07)_55%,transparent)] blur-3xl" />
            {/* Fine hairline grid, masked toward the terminal */}
            <div className="absolute inset-0 opacity-[0.45] [background-image:linear-gradient(hsl(var(--border)/0.4)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.4)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_65%_0%,black,transparent_78%)]" />
            {/* Faded Canada silhouette — projected from world-atlas countries-50m */}
            <svg
              viewBox={CANADA_VIEWBOX}
              preserveAspectRatio="xMidYMid slice"
              className="absolute inset-0 h-full w-full opacity-[0.15] [mask-image:linear-gradient(180deg,black,transparent_92%)]"
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
            {/* Bottom fade so the hero melts into the seam below */}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background/70" />
          </div>

          {/* Pointer-tracked key light (deterministic default position, no re-render) */}
          <div
            ref={heroGlowRef}
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(460px_circle_at_var(--spot-x)_var(--spot-y),hsl(var(--primary)/0.09),transparent_70%)]"
            style={{ "--spot-x": "70%", "--spot-y": "28%" } as CSSProperties}
            aria-hidden="true"
          />

          <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-14 md:py-20 lg:py-24">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:gap-14">
              {/* ---- Left: copy ---- */}
              <div className="realist-rise min-w-0 max-w-[640px]">
                {greeting && (
                  <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    {greeting}
                  </p>
                )}

                <h1 className="text-[2.6rem] font-bold leading-[1.02] tracking-[-0.022em] text-balance md:text-[3.4rem] lg:text-[3.9rem]">
                  Type an address.{" "}
                  <span className="text-gradient">AI underwrites the deal.</span>
                </h1>
                <p className="mt-5 max-w-[560px] text-lg leading-relaxed text-muted-foreground md:text-xl">
                  Cash flow, cap rate, DSCR, and risk on any Canadian listing — modelled in seconds,
                  tuned to your buy box with every deal you run. Watch it work, then run your own.
                </p>

                {/* Lower-third chyron — the in-hero broadcast credit. Gradient
                    light-bar edge + object-cover avatar crops + ON AIR tag. */}
                <div
                  className="relative mt-7 w-fit overflow-hidden rounded-md border border-border/60 bg-card/85 shadow-lg backdrop-blur"
                  data-testid="badge-home-hero-onair"
                >
                  <span className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-primary to-accent" aria-hidden="true" />
                  <div className="flex items-center gap-3.5 py-2.5 pl-5 pr-5">
                    <span className="flex shrink-0 -space-x-3" aria-hidden="true">
                      <img src={danielImage} alt="" className="h-11 w-11 rounded-full border-2 border-background bg-muted object-cover object-top shadow-sm" />
                      <img src={nickImage} alt="" className="h-11 w-11 rounded-full border-2 border-background bg-muted object-cover object-top shadow-sm" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold leading-tight">Built by Daniel Foch &amp; Nick Hill</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Hosts of {PODCAST_NAME} · 120k monthly listeners
                      </p>
                    </div>
                    <span className="ml-1 hidden items-center gap-1.5 border-l border-border pl-3.5 sm:flex">
                      <span className="realist-onair-dot inline-block h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary">On air</span>
                    </span>
                  </div>
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

                <p className="mt-4 max-w-[560px] text-sm text-muted-foreground">
                  Estimated metrics only. Screening signals are based on assumptions, not guaranteed returns.
                </p>

                {/* Indexed capability row — mono microcaps chrome */}
                <div className="mt-9 grid border-y border-border/70 sm:grid-cols-3 sm:divide-x sm:divide-border/70">
                  {[
                    { n: "i", label: "Save assumptions", icon: Save },
                    { n: "ii", label: "Apply to similar deals", icon: Radar },
                    { n: "iii", label: "Send an inspector", icon: Target },
                  ].map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className={`flex items-center gap-3 px-1 py-3 sm:px-4 ${i > 0 ? "border-t border-border/70 sm:border-t-0" : ""} ${i === 0 ? "sm:pl-1" : ""}`}
                      >
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{item.n}</span>
                        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ---- Right: the analyzer, performing (self-driving demo) ---- */}
              <div className="realist-rise relative min-w-0" style={{ animationDelay: "120ms" }}>
                <HeroDemoTerminal />
              </div>
            </div>
          </div>
        </section>

        {/* ============================ NETWORK CREDIT TICKER ============================
            A low-cost provenance seam between the hero and the stats band. */}
        <div className="relative overflow-hidden border-b border-border/50 bg-muted/30 py-2.5">
          <p className="sr-only">
            Presented by {PODCAST_NAME} — Canada&apos;s #1 real estate podcast, hosted by Daniel Foch and
            Nick Hill, part of The Canadian Investor Podcast Network.
          </p>
          <div className="realist-ticker flex w-max" aria-hidden="true">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex items-center">
                {CREDIT_TICKER.map((item) => (
                  <span key={`${copy}-${item}`} className="mx-6 flex items-center gap-6 whitespace-nowrap font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {item}
                    <span className="h-1 w-1 rounded-full bg-primary/70" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ============================ STATS + PRESS ============================ */}
        <section className="py-10 border-b border-border/40 bg-muted/20">
          <div className="max-w-6xl mx-auto px-4 md:px-6 space-y-7">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 text-center md:divide-x md:divide-border/50">
              {[
                { value: SITE_STATS.communityMembers, label: "community members" },
                { value: SITE_STATS.dealsAnalyzedVolume, label: "in deals analyzed" },
                { value: SITE_STATS.canadianCities, label: "Canadian cities" },
                { value: SITE_STATS.skoolMembers, label: "Skool members" },
              ].map((stat) => (
                <div key={stat.label} className="px-4">
                  <p className="text-2xl md:text-3xl font-bold font-mono tabular-nums">{stat.value}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="mx-auto h-px max-w-3xl bg-gradient-to-r from-transparent via-border to-transparent" aria-hidden="true" />
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
              {/* Low-cost podcast reinforcement under the press strip */}
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Headphones className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                And heard by ~120k Canadian investors a month on Apple, Spotify, and YouTube.
              </p>
            </div>
          </div>
        </section>

        {/* ============================ DEDICATED PODCAST BAND ============================
            The credibility engine, placed BEFORE the product-paths section:
            the hosts on catalogue plates, the show's credentials, and the
            live episode reel proving the show ships every week. */}
        <section className="relative overflow-hidden border-b border-border/40 bg-[linear-gradient(180deg,hsl(var(--muted)/0.25),hsl(var(--background)))] py-14 md:py-20">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,hsl(var(--primary)/0.09),transparent_36%),radial-gradient(circle_at_88%_85%,hsl(var(--accent)/0.08),transparent_38%)]" />
            {/* Faint oversized waveform running behind the whole band */}
            <div className="absolute inset-x-0 top-1/2 flex h-40 -translate-y-1/2 items-center gap-2 opacity-[0.05]">
              {WAVEFORM_BARS.map((h, i) => (
                <span key={i} className="w-full rounded-full bg-primary" style={{ height: `${h}%` }} />
              ))}
            </div>
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
                className="hidden h-12 items-center gap-[3px] rounded-xl border border-border/50 bg-background/50 px-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.03)] sm:flex sm:w-64 sm:justify-center lg:w-80"
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

            <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
              {/* Left: show story, spec-sheet credentials, pull-quote, CTAs (sticky on lg) */}
              <div className="lg:sticky lg:top-24 lg:self-start">
                <p className="text-muted-foreground text-lg">
                  {PODCAST_NAME} reaches over{" "}
                  <span className="font-semibold text-foreground">120,000 listeners a month</span>. Realist is
                  the AI deal-underwriting platform Daniel and Nick built to run the same numbers they teach on
                  the show — now open to every Canadian investor.
                </p>

                {/* Spec-sheet stat trio */}
                <div className="mt-7 grid grid-cols-3 divide-x divide-border/60 border-y border-border/60">
                  {[
                    { value: "120k", label: "Listeners / month", tone: "text-primary" },
                    { value: "#1", label: "CDN RE podcast", tone: "text-foreground" },
                    { value: "2", label: "Investor hosts", tone: "text-foreground" },
                  ].map((s, i) => (
                    <div key={s.label} className={`py-4 ${i === 0 ? "pr-4" : "px-4"}`}>
                      <p className={`font-mono text-2xl font-bold tabular-nums tracking-tight md:text-3xl ${s.tone}`}>{s.value}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Semantic pull-quote credited to both hosts */}
                <figure
                  className="mt-7 rounded-xl border border-primary/20 bg-card/70 p-5 shadow-sm backdrop-blur-sm"
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
                        className="flex h-11 w-11 items-center justify-center rounded-md border border-border/60 bg-background/70 text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary hover:shadow-[0_8px_20px_-12px_hsl(var(--primary)/0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                        onClick={() => track({ event: "cta_clicked", cta: `homepage_podcast_${key}`, location: "homepage_podcast", destination: href })}
                        data-testid={`link-home-podcast-${key}`}
                      >
                        <Glyph className="h-5 w-5" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: catalogue-plate host figures + the episode reel */}
              <div>
                {/* Fig. 01 / Fig. 02 — object-cover plates built for the real
                    opaque white-background portraits (never cutout staging) */}
                <div className="mb-7 grid grid-cols-2 gap-4 sm:gap-5">
                  {hosts.map((host) => (
                    <figure key={host.name} className="flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card/80 shadow-sm backdrop-blur-sm">
                      <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-3 py-1.5">
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{host.fig}</span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Co-host</span>
                      </div>
                      <div className="relative flex-1 bg-muted/20">
                        <img
                          src={host.img}
                          alt={`${host.name}, co-host of ${PODCAST_NAME}`}
                          className="aspect-[4/5] h-full w-full object-cover object-top"
                        />
                      </div>
                      <figcaption className="flex items-baseline justify-between border-t border-border/60 px-3 py-2.5">
                        <span className="text-sm font-semibold">{host.name}</span>
                        <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:inline">
                          {PODCAST_NAME}
                        </span>
                      </figcaption>
                    </figure>
                  ))}
                </div>

                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Latest episodes</p>
                  <Link
                    href="/insights/podcast"
                    className="group inline-flex items-center gap-1 rounded text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    onClick={() => track({ event: "cta_clicked", cta: "homepage_podcast_all_episodes", location: "homepage_podcast", destination: "/insights/podcast" })}
                    data-testid="link-home-podcast-all-episodes"
                  >
                    All episodes
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden="true" />
                  </Link>
                </div>

                <div className="space-y-3">
                  {episodesLoading &&
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4 rounded-xl border border-border/60 bg-card/70 p-3" aria-hidden="true">
                        <div className="hidden h-9 w-9 shrink-0 animate-pulse rounded-md bg-muted motion-reduce:animate-none sm:block" />
                        <div className="h-16 w-16 shrink-0 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-3/4 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                          <div className="h-3 w-1/2 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                        </div>
                      </div>
                    ))}

                  {!episodesLoading &&
                    latestEpisodes.map((episode, index) => {
                      const summary = stripHtml(episode.description);
                      const dateLabel = formatEpisodeDate(episode.pubDate);
                      return (
                        <Link
                          key={episode.slug}
                          href={`/insights/podcast/${episode.slug}`}
                          className="group flex items-center gap-3.5 rounded-xl border border-border/60 bg-card/70 p-3 shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_16px_32px_-20px_hsl(var(--primary)/0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                          onClick={() => track({ event: "cta_clicked", cta: "homepage_podcast_episode", location: "homepage_podcast", destination: `/insights/podcast/${episode.slug}` })}
                          data-testid={`link-home-podcast-episode-${episode.slug}`}
                        >
                          {/* Track-number index — reads like a playlist, not a blog list */}
                          <span
                            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/50 bg-background/60 font-mono text-xs font-bold tabular-nums text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary sm:flex"
                            aria-hidden="true"
                          >
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
                            {episode.imageUrl ? (
                              <img src={episode.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                <Mic className="h-6 w-6" aria-hidden="true" />
                              </div>
                            )}
                            <span className="absolute inset-0 flex items-center justify-center bg-background/50 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100" aria-hidden="true">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary shadow-md">
                                <Play className="ml-0.5 h-3.5 w-3.5 fill-primary-foreground text-primary-foreground" />
                              </span>
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              {dateLabel && <span>{dateLabel}</span>}
                              {dateLabel && episode.duration && <span aria-hidden="true">·</span>}
                              {episode.duration && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-1.5 py-px font-mono tabular-nums">
                                  <Headphones className="h-2.5 w-2.5" aria-hidden="true" />
                                  {episode.duration}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-sm font-semibold text-foreground group-hover:text-primary">
                              {episode.title}
                            </p>
                            {summary && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{summary}</p>}
                          </div>
                          <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:translate-y-0" aria-hidden="true" />
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
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">Two ways in</p>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                Start with a deal, or start with the market.
              </h2>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="hover-elevate border-primary/25 bg-gradient-to-br from-background via-background to-primary/10 shadow-sm">
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge className="w-fit gap-1 bg-primary text-primary-foreground hover:bg-primary">
                      <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                      Use AI underwriting
                    </Badge>
                    <span className="font-mono text-xs font-bold tabular-nums text-muted-foreground/60" aria-hidden="true">01</span>
                  </div>
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

              <Card className="hover-elevate border-border/70 bg-gradient-to-br from-background via-background to-accent/10 shadow-sm">
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="w-fit gap-1">
                      <Map className="h-3.5 w-3.5" aria-hidden="true" />
                      Search investor opportunities
                    </Badge>
                    <span className="font-mono text-xs font-bold tabular-nums text-muted-foreground/60" aria-hidden="true">02</span>
                  </div>
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

        {/* Quiet gradient seam between sections */}
        <div className="mx-auto h-px max-w-6xl bg-gradient-to-r from-transparent via-border to-transparent" aria-hidden="true" />

        {/* ============================ COMPOUNDING INTELLIGENCE + RESUME ============================ */}
        <section className="py-14 md:py-20">
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
                      <div
                        key={signal}
                        className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm font-medium shadow-[inset_0_1px_0_hsl(var(--foreground)/0.03)] transition-colors hover:border-primary/30"
                      >
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
                      <div className="rounded-lg border border-border/60 p-4 transition-colors hover:border-primary/30">
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
                      <div className="rounded-lg border border-border/60 p-4 transition-colors hover:border-primary/30">
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

        {/* ============================ PRO BAND + COLOPHON ============================ */}
        <section className="pb-14 pt-0 md:pb-16">
          <div className="max-w-6xl mx-auto px-4 md:px-6">
            {/* Gradient-border frame for a finished, premium close to the page */}
            <div className="rounded-xl bg-gradient-to-r from-primary/25 via-border to-accent/25 p-px">
              <div className="rounded-[calc(0.75rem-1px)] bg-gradient-to-br from-card via-card to-primary/5 p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                <div className="max-w-xl">
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">For professionals</p>
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

            {/* Colophon — the page opens and closes on provenance */}
            <div className="mt-12 border-t-2 border-foreground pt-3">
              <p className="text-center font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Realist — presented by {PODCAST_NAME} · Canada&apos;s #1 real estate podcast · 120,000 listeners / month
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
