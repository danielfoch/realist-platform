import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Gauge,
  Headphones,
  Map,
  Mic,
  Newspaper,
  PhoneCall,
  Play,
  Radio,
  Users,
} from "lucide-react";
import { SEO, organizationSchema, websiteSchema } from "@/components/SEO";
import { SHARED_ROUTE_META } from "@shared/routeMeta";
import { PODCAST_NAME, PODCAST_APPLE_URL, PODCAST_SPOTIFY_URL, PODCAST_YOUTUBE_URL } from "@shared/brand";
import { Navigation } from "@/components/Navigation";
import { EventPromoFrame } from "@/components/home/EventPromoFrame";
import { AnalysesCounter } from "@/components/AnalysesCounter";
import { Skyline } from "@/components/landing/Skyline";
import { ProductFrame } from "@/components/landing/ProductFrame";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { track, trackRealistEvent } from "@/lib/analytics";
import { mediaLogos } from "@/lib/mediaLogos";
import { SITE_STATS } from "@/lib/siteStats";
// Host portraits — same assets and name mapping as the About page.
import nickImage from "@assets/ChatGPT_Image_Jan_6,_2026,_02_50_25_PM_1767729122931.webp";
import danielImage from "@assets/ChatGPT_Image_Jan_6,_2026,_03_03_13_PM_1767729810400.webp";

/* ------------------------------------------------------------------------ */
/* Podcast feed helpers                                                     */
/* ------------------------------------------------------------------------ */

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

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–",
  hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
};

/** Strip tags and decode the entities podcast RSS descriptions actually use. */
function stripHtml(value: string) {
  return (value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp|mdash|ndash|hellip|rsquo|lsquo|rdquo|ldquo);/g, (_, name) => NAMED_ENTITIES[name] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatEpisodeDate(pubDate: string) {
  if (!pubDate) return null;
  const parsed = new Date(pubDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "MMM d, yyyy");
}

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

const podcastHosts = [
  { img: danielImage, name: "Daniel Foch", role: "Broker and analyst" },
  { img: nickImage, name: "Nick Hill", role: "Mortgage and finance expert" },
] as const;

/* ------------------------------------------------------------------------ */
/* Content                                                                  */
/* ------------------------------------------------------------------------ */

const FEATURES = [
  {
    icon: Map,
    title: "Yield map",
    body: "Every investor listing in 26 cities, ranked by cap rate, price cuts, and distress signals.",
    href: "/tools/cap-rates",
    cta: "homepage_feature_map",
  },
  {
    icon: Building2,
    title: "Multiplex underwriter",
    body: "Paste an MLS number or Toronto address. Is it a 4+1 or a 6+1 lot, what it costs to build, MLI Select financing, and the price to offer.",
    href: "/tools/multiplex-underwriter",
    cta: "homepage_feature_multiplex",
  },
  {
    icon: Gauge,
    title: "Financing readiness",
    body: "Your stress-tested maximum purchase price in 30 seconds, then a call to make it real.",
    href: "/tools/financing-readiness",
    cta: "homepage_feature_readiness",
  },
  {
    icon: Radio,
    title: "Live Deal Room",
    body: "Real deals underwritten live every Monday at 11:30am ET. Free, and so are the replays.",
    href: "/deal-room",
    cta: "homepage_feature_deal_room",
  },
  {
    icon: Newspaper,
    title: "Market reports",
    body: "Rates, permits, migration, and construction costs, read the way an investor reads them.",
    href: "/reports",
    cta: "homepage_feature_reports",
  },
] as const;

/* ------------------------------------------------------------------------ */
/* Small building blocks                                                    */
/* ------------------------------------------------------------------------ */

const EASE = [0.22, 1, 0.36, 1] as const;

/** Fades and lifts children into place the first time they scroll into view. */
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
      <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
      {children}
    </p>
  );
}

/** Frosted card used for every content block that floats over the dark page. */
function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.035] shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Page                                                                     */
/* ------------------------------------------------------------------------ */

export default function Landing() {
  const { isAuthenticated, user } = useAuth();
  const reduce = useReducedMotion() ?? false;
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const copyY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  // The page forces dark styling, but the document behind it follows the
  // user's theme. Paint the canvas dark while mounted so rubber-band
  // overscroll and the space behind the footer never flash light.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.backgroundColor;
    root.style.backgroundColor = "hsl(222 47% 6%)";
    return () => {
      root.style.backgroundColor = previous;
    };
  }, []);

  const { data: episodes, isLoading: episodesLoading } = useQuery<PodcastEpisode[]>({
    queryKey: ["/api/podcast/episodes"],
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
  const latestEpisodes = (episodes ?? []).slice(0, 3);

  const combinedSchema = {
    "@context": "https://schema.org",
    "@graph": [organizationSchema, websiteSchema],
  };

  const greeting = isAuthenticated ? `Welcome back${user?.firstName ? `, ${user.firstName}` : ""}.` : null;

  return (
    // The landing page is deliberately dark in both themes: the scene, glows
    // and frosted cards are designed for it. `dark` here re-scopes every
    // design token for the nav and everything below it.
    <div className="dark min-h-screen bg-background text-foreground">
      <SEO
        title={SHARED_ROUTE_META["/"].title}
        description={SHARED_ROUTE_META["/"].description}
        canonicalUrl="/"
        structuredData={combinedSchema}
      />

      <Navigation />

      <main>
        {/* ============================ HERO ============================ */}
        <section
          ref={heroRef}
          className="relative overflow-hidden"
          data-testid="section-landing-hero"
        >
          {/* Sky */}
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 50% -10%, hsl(214 60% 30% / 0.45), transparent 70%), linear-gradient(180deg, hsl(222 47% 6%) 0%, hsl(222 45% 8%) 60%, hsl(222 47% 6%) 100%)",
            }}
          />
          {/* Fine grain so the gradients don't band */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
            aria-hidden="true"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />

          <Skyline progress={scrollYProgress} reduceMotion={reduce} />

          <div className="relative mx-auto max-w-6xl px-4 pt-16 md:px-6 md:pt-24">
            <motion.div
              className="mx-auto max-w-3xl text-center"
              style={reduce ? undefined : { y: copyY, opacity: copyOpacity }}
            >
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: EASE }}
              >
                <Link
                  href="/insights/podcast"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-3.5 text-xs font-medium text-white/75 transition-colors hover:border-primary/50 hover:text-white"
                  onClick={() => track({ event: "cta_clicked", cta: "homepage_podcast_ribbon", location: "homepage_hero", destination: "/insights/podcast" })}
                  data-testid="link-landing-podcast-pill"
                >
                  <span className="flex -space-x-2" aria-hidden="true">
                    <img src={danielImage} alt="" className="h-6 w-6 rounded-full border border-background object-cover object-top" />
                    <img src={nickImage} alt="" className="h-6 w-6 rounded-full border border-background object-cover object-top" />
                  </span>
                  <span>
                    From the hosts of <span className="font-semibold text-white">{PODCAST_NAME}</span>
                  </span>
                  <span className="hidden text-white/45 sm:inline">· Canada&apos;s #1 real estate podcast</span>
                </Link>
              </motion.div>

              {greeting && (
                <p className="mt-6 text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">{greeting}</p>
              )}

              <motion.h1
                className="mt-6 text-balance text-4xl font-bold leading-[1.02] tracking-tight sm:text-5xl md:text-6xl lg:text-[4.25rem]"
                initial={reduce ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.08 }}
              >
                Canadian real estate,{" "}
                <span className="bg-gradient-to-r from-primary via-rose-400 to-orange-300 bg-clip-text text-transparent">
                  underwritten in seconds.
                </span>
              </motion.h1>

              <motion.p
                className="mx-auto mt-5 max-w-2xl text-balance text-base text-white/65 sm:text-lg md:text-xl"
                initial={reduce ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.16 }}
              >
                Paste an address or listing. Realist returns cash flow, yield, and risk, then learns your
                buy box with every deal you run. Free to use, with the team behind the podcast one call away.
              </motion.p>

              <motion.div
                className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
                initial={reduce ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.24 }}
              >
                <Button
                  asChild
                  size="lg"
                  className="w-full gap-2 shadow-[0_10px_40px_-10px_hsl(356_100%_60%/0.7)] sm:w-auto"
                >
                  <Link
                    href="/tools/analyzer"
                    onClick={() => {
                      track({ event: "cta_clicked", cta: "homepage_hero_analyze", location: "homepage_hero", destination: "/tools/analyzer" });
                      trackRealistEvent("homepage.cta_clicked", { cta: "start_analyzing_deals", location: "homepage_hero", destination: "/tools/analyzer" });
                    }}
                    data-testid="button-home-hero-analyze"
                  >
                    Start analyzing deals
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="w-full gap-2 border-white/15 bg-white/[0.04] sm:w-auto">
                  <Link
                    href="/tools/cap-rates"
                    onClick={() => {
                      track({ event: "cta_clicked", cta: "homepage_hero_map", location: "homepage_hero", destination: "/tools/cap-rates" });
                      trackRealistEvent("homepage.cta_clicked", { cta: "explore_yield_map", location: "homepage_hero", destination: "/tools/cap-rates" });
                    }}
                    data-testid="button-home-hero-map"
                  >
                    <Map className="h-4 w-4" aria-hidden="true" />
                    Explore the yield map
                  </Link>
                </Button>
              </motion.div>

              <motion.div
                className="mt-6 flex flex-col items-center gap-2"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                <AnalysesCounter className="bg-white/[0.03]" />
                <p className="text-xs text-white/40">
                  Estimated metrics only. Screening signals are based on assumptions, not guaranteed returns.
                </p>
              </motion.div>
            </motion.div>

            {/* The product frame straddles the skyline, so its bottom edge is
                cut by the section and the street reads as its foreground. */}
            <div className="relative mt-14 md:mt-20">
              <ProductFrame />
            </div>
          </div>

          {/* Spacer so the street has room under the frame before the mist. */}
          <div className="h-28 md:h-40" aria-hidden="true" />
        </section>

        {/* ============================ TRUST STRIP ============================ */}
        <section className="relative border-y border-white/[0.06] bg-white/[0.015] py-8" data-testid="section-landing-trust">
          <div className="mx-auto max-w-6xl space-y-6 px-4 md:px-6">
            <Reveal>
              <div className="grid grid-cols-2 gap-4 text-center md:grid-cols-4">
                {[
                  { value: SITE_STATS.communityMembers, label: "community members" },
                  { value: SITE_STATS.dealsAnalyzedVolume, label: "in deals analyzed" },
                  { value: SITE_STATS.canadianCities, label: "Canadian cities" },
                  { value: SITE_STATS.skoolMembers, label: "Skool members" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className="font-mono text-2xl font-bold tabular-nums md:text-3xl">{stat.value}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="space-y-3 text-center">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground" data-testid="text-as-seen-on">
                  As seen on
                </p>
                <div className="mx-auto grid max-w-5xl grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-9 md:gap-3">
                  {mediaLogos.map((media) => {
                    // Some of these PNGs have an opaque white background, so
                    // they sit on a light pill rather than being inverted.
                    const logo = (
                      <img
                        src={media.image}
                        alt={media.name}
                        className="h-4 w-auto max-w-full object-contain grayscale transition-all group-hover:grayscale-0 md:h-5"
                      />
                    );
                    const pill =
                      "group flex h-10 items-center justify-center rounded-md bg-white/85 px-3 opacity-70 transition-opacity hover:opacity-100";
                    return media.url ? (
                      <a key={media.name} href={media.url} target="_blank" rel="noopener noreferrer" className={pill} title={media.name}>
                        {logo}
                      </a>
                    ) : (
                      <div key={media.name} className={pill} title={media.name}>
                        {logo}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ============================ FEATURES ============================ */}
        <section className="relative py-20 md:py-28" data-testid="section-landing-features">
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{ background: "radial-gradient(ellipse 50% 40% at 85% 20%, hsl(356 100% 60% / 0.08), transparent 70%)" }}
          />
          <div className="relative mx-auto max-w-6xl px-4 md:px-6">
            <Reveal>
              <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr] md:items-end">
                <div>
                  <Eyebrow>The platform</Eyebrow>
                  <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight md:text-5xl">
                    Find it, underwrite it, <span className="text-white/45">finance it, close it.</span>
                  </h2>
                </div>
                <p className="text-base text-white/60 md:text-lg">
                  One place for the whole deal. Free tools for Canadian investors, and the two people who built
                  them when a deal is worth acting on.
                </p>
              </div>
            </Reveal>

            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-12">
              {/* Highlight: analyzer */}
              <Reveal className="md:col-span-2 lg:col-span-8">
                <Link
                  href="/tools/analyzer"
                  className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  onClick={() => track({ event: "cta_clicked", cta: "homepage_feature_analyzer", location: "homepage_features", destination: "/tools/analyzer" })}
                  data-testid="link-landing-feature-analyzer"
                >
                  <GlassCard className="h-full overflow-hidden transition-colors group-hover:border-primary/40">
                    <div className="grid h-full gap-6 p-6 md:grid-cols-[1fr_0.9fr] md:p-8">
                      <div className="flex flex-col">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                          <BarChart3 className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <h3 className="mt-5 text-2xl font-bold tracking-tight">Deal analyzer</h3>
                        <p className="mt-2 text-white/60">
                          Paste an address, listing, or MLS number. Cap rate, cash-on-cash, DSCR, IRR, BRRR and
                          multiplex viability, with smart defaults from your market.
                        </p>
                        <span className="mt-auto inline-flex items-center gap-1 pt-6 text-sm font-semibold text-primary">
                          Analyze a deal
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </span>
                      </div>
                      {/* Mini result strip */}
                      <div className="rounded-xl border border-white/10 bg-black/30 p-4" aria-hidden="true">
                        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                          <span>Sample result</span>
                          <span className="text-emerald-300">score 84</span>
                        </div>
                        <dl className="mt-3 space-y-2 text-sm">
                          {[
                            ["Cap rate", "5.8%", 58],
                            ["Cash-on-cash", "7.9%", 79],
                            ["DSCR", "1.18x", 48],
                            ["5-yr IRR", "14.2%", 71],
                          ].map(([k, v, pct]) => (
                            <div key={k as string}>
                              <div className="flex justify-between">
                                <dt className="text-white/55">{k}</dt>
                                <dd className="font-mono tabular-nums text-white/90">{v}</dd>
                              </div>
                              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                                <motion.div
                                  className="h-full rounded-full bg-gradient-to-r from-primary to-orange-300"
                                  initial={reduce ? { width: `${pct}%` } : { width: 0 }}
                                  whileInView={{ width: `${pct}%` }}
                                  viewport={{ once: true }}
                                  transition={{ duration: 1, ease: EASE, delay: 0.2 }}
                                />
                              </div>
                            </div>
                          ))}
                        </dl>
                      </div>
                    </div>
                  </GlassCard>
                </Link>
              </Reveal>

              {FEATURES.map((feature, index) => {
                const Icon = feature.icon;
                // First card sits beside the highlight on large screens; the
                // remaining four tile a row beneath. On tablets the last card
                // stretches so the 2-up grid doesn't leave a hole.
                const span =
                  index === 0 ? "lg:col-span-4" : index === FEATURES.length - 1 ? "md:col-span-2 lg:col-span-3" : "lg:col-span-3";
                return (
                  <Reveal key={feature.title} className={span} delay={0.05 * (index + 1)}>
                    <Link
                      href={feature.href}
                      className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                      onClick={() => track({ event: "cta_clicked", cta: feature.cta, location: "homepage_features", destination: feature.href })}
                      data-testid={`link-landing-feature-${feature.href.split("/").filter(Boolean).pop()}`}
                    >
                      <GlassCard className="flex h-full flex-col p-6 transition-colors group-hover:border-primary/40">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.06] text-primary">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <h3 className="mt-5 text-lg font-bold tracking-tight">{feature.title}</h3>
                        <p className="mt-2 text-sm text-white/60">{feature.body}</p>
                        <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-white/70 transition-colors group-hover:text-primary">
                          Open
                          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                        </span>
                      </GlassCard>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ============================ PODCAST ============================ */}
        <section
          aria-label="The Canadian Real Estate Investor podcast"
          className="relative py-6 md:py-10"
          data-testid="section-home-podcast"
        >
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <Reveal>
              <GlassCard className="relative overflow-hidden">
                <div
                  className="pointer-events-none absolute inset-0"
                  aria-hidden="true"
                  style={{ background: "radial-gradient(ellipse 50% 60% at 0% 100%, hsl(356 100% 60% / 0.16), transparent 70%)" }}
                />
                <div className="relative grid gap-10 p-6 md:p-10 lg:grid-cols-[0.95fr_1.05fr]">
                  <div>
                    <Eyebrow>
                      <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                      The podcast behind Realist
                    </Eyebrow>
                    <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight md:text-4xl">
                      Canada&apos;s #1 real estate podcast, <span className="text-white/45">every week.</span>
                    </h2>
                    <p className="mt-4 text-white/60">
                      Every week, Daniel and Nick break down the Canadian housing market on{" "}
                      <span className="font-semibold text-white">{PODCAST_NAME}</span>. Realist is the platform
                      they built so listeners can run the same numbers on their own deals.
                    </p>

                    <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                      {podcastHosts.map((host) => (
                        <div key={host.name} className="flex items-center gap-3">
                          <img
                            src={host.img}
                            alt={`${host.name}, co-host of ${PODCAST_NAME}`}
                            className="h-12 w-12 rounded-full border-2 border-primary/30 bg-muted object-cover object-top"
                          />
                          <div>
                            <p className="text-sm font-semibold leading-tight">{host.name}</p>
                            <p className="text-xs text-white/50">{host.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <Button asChild size="lg" className="w-full gap-2 sm:w-auto">
                        <Link
                          href="/insights/podcast"
                          onClick={() => {
                            track({ event: "cta_clicked", cta: "homepage_podcast_listen", location: "homepage_podcast", destination: "/insights/podcast" });
                            trackRealistEvent("homepage.cta_clicked", { cta: "listen_to_podcast", location: "homepage_podcast", destination: "/insights/podcast" });
                          }}
                          data-testid="button-home-podcast-listen"
                        >
                          <Headphones className="h-4 w-4" aria-hidden="true" />
                          Listen to the podcast
                        </Link>
                      </Button>
                      <div className="flex items-center gap-2">
                        {podcastPlatforms.map(({ name, href, Glyph, key }) => (
                          <a
                            key={key}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Listen on ${name}`}
                            title={`Listen on ${name}`}
                            className="flex h-11 w-11 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/60 transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                            onClick={() => track({ event: "cta_clicked", cta: `homepage_podcast_${key}`, location: "homepage_podcast", destination: href })}
                            data-testid={`link-home-podcast-${key}`}
                          >
                            <Glyph className="h-5 w-5" />
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Latest episodes</p>
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
                        Array.from({ length: 3 }).map((_, index) => (
                          <div key={index} className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/20 p-3" aria-hidden="true">
                            <div className="h-16 w-16 shrink-0 animate-pulse rounded-lg bg-white/10" />
                            <div className="flex-1 space-y-2">
                              <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
                              <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
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
                              className="group flex items-center gap-4 rounded-xl border border-white/10 bg-black/20 p-3 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                              onClick={() => track({ event: "cta_clicked", cta: "homepage_podcast_episode", location: "homepage_podcast", destination: `/insights/podcast/${episode.slug}` })}
                              data-testid={`link-home-podcast-episode-${episode.slug}`}
                            >
                              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                                {episode.imageUrl ? (
                                  <img src={episode.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-white/50">
                                    <Mic className="h-6 w-6" aria-hidden="true" />
                                  </div>
                                )}
                                <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">
                                  <Play className="h-6 w-6 fill-primary text-primary" />
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 text-[11px] text-white/45">
                                  {dateLabel && <span>{dateLabel}</span>}
                                  {dateLabel && episode.duration && <span aria-hidden="true">·</span>}
                                  {episode.duration && <span className="font-mono tabular-nums">{episode.duration}</span>}
                                </div>
                                <p className="mt-0.5 truncate text-sm font-semibold text-white group-hover:text-primary">{episode.title}</p>
                                {summary && <p className="mt-0.5 line-clamp-1 text-xs text-white/50">{summary}</p>}
                              </div>
                              <ArrowUpRight className="h-4 w-4 shrink-0 text-white/40 transition-colors group-hover:text-primary" aria-hidden="true" />
                            </Link>
                          );
                        })}

                      {!episodesLoading && latestEpisodes.length === 0 && (
                        <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/20 p-5">
                          <Radio className="h-8 w-8 text-primary" aria-hidden="true" />
                          <div>
                            <p className="font-semibold">New episodes every week</p>
                            <p className="text-sm text-white/55">Catch the latest on {PODCAST_NAME}.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </Reveal>
          </div>
        </section>

        {/* ============================ EVENT ============================ */}
        <div className="mt-10 md:mt-14">
          <EventPromoFrame />
        </div>

        {/* ============================ DOORS ============================ */}
        <section className="py-16 md:py-24" data-testid="section-landing-doors">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <Reveal>
              <Eyebrow>Two ways in</Eyebrow>
              <h2 className="mt-4 max-w-2xl text-balance text-3xl font-bold tracking-tight md:text-5xl">
                Use the tools free. <span className="text-white/45">Bring in the team when it counts.</span>
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <Reveal>
                <GlassCard className="flex h-full flex-col p-6 md:p-8">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <PhoneCall className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Investor representation</p>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight">Have a deal you want to close?</h3>
                  <p className="mt-2 text-white/60">
                    Daniel and Nick work with experienced investors in select Canadian markets. Boots on the
                    ground, financing, or a second opinion before you offer.
                  </p>
                  <div className="mt-auto flex flex-col gap-3 pt-6 sm:flex-row">
                    <Button asChild className="w-full gap-2 sm:w-auto">
                      <Link
                        href="/work-with-realist"
                        onClick={() => track({ event: "cta_clicked", cta: "homepage_work_with_realist", location: "homepage_work_band", destination: "/work-with-realist" })}
                        data-testid="button-home-work-with-realist"
                      >
                        Work with Daniel &amp; Nick
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full border-white/15 bg-white/[0.04] sm:w-auto">
                      <Link
                        href="/book-a-call"
                        onClick={() => track({ event: "cta_clicked", cta: "book_call", location: "homepage_funnel_band", destination: "/book-a-call" })}
                        data-testid="link-funnel-call"
                      >
                        Book a free call
                      </Link>
                    </Button>
                  </div>
                </GlassCard>
              </Reveal>
              <Reveal delay={0.08}>
                <GlassCard className="flex h-full flex-col p-6 md:p-8">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.06] text-primary">
                    <Users className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">For professionals</p>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight">Realtor, mortgage pro, or builder?</h3>
                  <p className="mt-2 text-white/60">
                    Investors on Realist are underwriting deals in your market right now. Join the Power Team to
                    get matched with them when a deal moves forward.
                  </p>
                  <div className="mt-auto flex flex-col gap-3 pt-6 sm:flex-row">
                    <Button asChild className="w-full gap-2 sm:w-auto">
                      <Link
                        href="/power-team"
                        onClick={() => track({ event: "cta_clicked", cta: "homepage_power_team", location: "homepage_pro_band", destination: "/power-team" })}
                        data-testid="button-home-power-team"
                      >
                        Join the Power Team
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full border-white/15 bg-white/[0.04] sm:w-auto">
                      <Link href="/join/realtors" data-testid="button-home-join-realtors">
                        I&apos;m a realtor
                      </Link>
                    </Button>
                  </div>
                </GlassCard>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ============================ FINAL CTA ============================ */}
        <section className="relative overflow-hidden py-24 md:py-32" data-testid="section-landing-final-cta">
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{ background: "radial-gradient(ellipse 60% 60% at 50% 100%, hsl(356 100% 60% / 0.2), transparent 70%)" }}
          />
          <div className="relative mx-auto max-w-3xl px-4 text-center md:px-6">
            <Reveal>
              <h2 className="text-balance text-4xl font-bold tracking-tight md:text-6xl">Start with a deal.</h2>
              <p className="mx-auto mt-4 max-w-xl text-balance text-white/60 md:text-lg">
                Paste the listing you&apos;re looking at right now. It takes about ten seconds, and it&apos;s free.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="w-full gap-2 shadow-[0_10px_40px_-10px_hsl(356_100%_60%/0.7)] sm:w-auto">
                  <Link
                    href="/tools/analyzer"
                    onClick={() => track({ event: "cta_clicked", cta: "homepage_final_analyze", location: "homepage_final_cta", destination: "/tools/analyzer" })}
                    data-testid="button-home-final-analyze"
                  >
                    Analyze a deal
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="ghost" className="w-full gap-2 text-white/80 sm:w-auto">
                  <Link href="/tools" data-testid="button-home-final-tools">
                    Browse all tools
                  </Link>
                </Button>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
    </div>
  );
}
