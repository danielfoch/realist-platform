import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  CircleDollarSign,
  Gavel,
  Headphones,
  Layers3,
  Map,
  Mic2,
  Play,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO, organizationSchema, websiteSchema } from "@/components/SEO";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { mediaLogos } from "@/lib/mediaLogos";
import { SITE_STATS } from "@/lib/siteStats";
import {
  PODCAST_APPLE_URL,
  PODCAST_NAME,
  PODCAST_SPOTIFY_URL,
  PODCAST_YOUTUBE_URL,
} from "@shared/brand";
import { SHARED_ROUTE_META } from "@shared/routeMeta";
import nickImage from "@assets/ChatGPT_Image_Jan_6,_2026,_02_50_25_PM_1767729122931.webp";
import danielImage from "@assets/ChatGPT_Image_Jan_6,_2026,_03_03_13_PM_1767729810400.webp";

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

const PRODUCT_LANES = [
  {
    eyebrow: "Search Canada",
    title: "Deals, already underwritten",
    description:
      "Browse CREA DDF listings by the numbers that matter: estimated rent, cap rate, cash flow, financing pressure, and deal quality.",
    href: "/tools/cap-rates",
    cta: "Browse investment deals",
    icon: Map,
    accent: "from-blue-500/15 to-cyan-400/5",
    proof: ["CREA DDF inventory", "Rent confidence ranges", "Saved searches & alerts"],
  },
  {
    eyebrow: "Toronto",
    title: "The multiplex underwriter",
    description:
      "Start with an address. Realist checks the lot, zoning and constraints, then models unit configurations, costs, rents, and the best takeout.",
    href: "/tools/multiplex-underwriter",
    cta: "Underwrite a Toronto lot",
    icon: Building2,
    accent: "from-primary/15 to-orange-400/5",
    proof: ["Lot & zoning screen", "CMHC MLI Select", "Concept massing & pro forma"],
  },
  {
    eyebrow: "Opportunity feed",
    title: "Distressed and creative deals",
    description:
      "A focused search for power of sale, court-ordered sale, motivated-vendor and VTB language—with history instead of a disappearing list.",
    href: "/tools/cap-rates?deals=power_of_sale,motivated,vtb&distressOnly=1",
    cta: "See motivated deals",
    icon: Gavel,
    accent: "from-amber-500/15 to-yellow-400/5",
    proof: ["Power of sale", "VTB signals", "Monthly distress tracking"],
  },
] as const;

function stripHtml(value: string) {
  if (!value) return "";
  const text = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 180 ? `${text.slice(0, 177).replace(/\s+\S*$/, "")}…` : text;
}

function episodeDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : format(parsed, "MMMM d, yyyy");
}

function trackCta(cta: string, destination: string, location: string) {
  track({ event: "cta_clicked", cta, destination, location });
}

export default function InvestorStart() {
  const { data: episodes, isLoading: episodesLoading } = useQuery<PodcastEpisode[]>({
    queryKey: ["/api/podcast/episodes"],
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
  const latestEpisode = episodes?.[0];
  const moreEpisodes = episodes?.slice(1, 4) ?? [];

  const schema = {
    "@context": "https://schema.org",
    "@graph": [organizationSchema, websiteSchema],
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title={SHARED_ROUTE_META["/"].title}
        description={SHARED_ROUTE_META["/"].description}
        canonicalUrl="/"
        structuredData={schema}
      />

      <div className="border-b border-white/10 bg-[#111827] px-4 py-2 text-center text-xs font-medium text-white">
        <Link
          href="/insights/podcast"
          className="inline-flex items-center gap-2 hover:text-white/80"
          onClick={() => trackCta("podcast_credibility_bar", "/insights/podcast", "announcement")}
        >
          <Radio className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span>
            Built by the hosts of <strong>Canada&apos;s #1 real estate podcast</strong>
          </span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <Navigation />

      <main>
        <section className="relative overflow-hidden border-b border-border/60 bg-[#0b1220] text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,55,75,0.16),transparent_32%),radial-gradient(circle_at_85%_15%,rgba(56,189,248,0.10),transparent_28%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:py-24">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                Canadian real estate intelligence
              </div>
              <h1 className="max-w-4xl text-4xl font-bold leading-[1.02] tracking-[-0.04em] text-balance sm:text-5xl md:text-6xl lg:text-7xl">
                Institutional-grade tools. Built for regular investors.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
                Find Canadian investment properties, underwrite the real numbers, and know what to do next—without stitching together ten websites and a broken spreadsheet.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-12 gap-2 px-6 text-base"
                  onClick={() => trackCta("browse_deals", "/tools/cap-rates", "hero")}
                >
                  <Link href="/tools/cap-rates">
                    <Map className="h-4 w-4" />
                    Find an investment property
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 gap-2 border-white/20 bg-white/5 px-6 text-base text-white hover:bg-white/10 hover:text-white"
                  onClick={() => trackCta("analyze_deal", "/tools/analyzer", "hero")}
                >
                  <Link href="/tools/analyzer">
                    <BarChart3 className="h-4 w-4" />
                    Underwrite a deal
                  </Link>
                </Button>
              </div>

              <div className="mt-10 grid max-w-2xl grid-cols-3 divide-x divide-white/10 border-y border-white/10 py-5">
                <div className="pr-4">
                  <p className="text-xl font-bold sm:text-2xl">{SITE_STATS.dealsAnalyzedVolume}</p>
                  <p className="mt-1 text-xs leading-4 text-slate-400">in deals analyzed</p>
                </div>
                <div className="px-4 sm:px-6">
                  <p className="text-xl font-bold sm:text-2xl">{SITE_STATS.communityMembers}</p>
                  <p className="mt-1 text-xs leading-4 text-slate-400">investors in the community</p>
                </div>
                <div className="pl-4 sm:pl-6">
                  <p className="text-xl font-bold sm:text-2xl">Canada-wide</p>
                  <p className="mt-1 text-xs leading-4 text-slate-400">CREA listing coverage</p>
                </div>
              </div>
            </div>

            <article className="overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06] shadow-2xl shadow-black/30 backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    <img
                      src={danielImage}
                      alt="Daniel Foch"
                      className="h-11 w-11 rounded-full border-2 border-[#111827] object-cover object-top"
                    />
                    <img
                      src={nickImage}
                      alt="Nick Hill"
                      className="h-11 w-11 rounded-full border-2 border-[#111827] object-cover object-top"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Daniel Foch &amp; Nick Hill</p>
                    <p className="text-xs text-slate-400">Realist founders &amp; podcast hosts</p>
                  </div>
                </div>
                <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-300">
                  Latest episode
                </span>
              </div>

              <div className="p-5 sm:p-6">
                <div className="mb-5 flex gap-4">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-800">
                    {latestEpisode?.imageUrl ? (
                      <img src={latestEpisode.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Mic2 className="h-9 w-9 text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-300">
                      {PODCAST_NAME}
                    </p>
                    <h2 className="mt-2 line-clamp-3 text-lg font-bold leading-snug">
                      {latestEpisode?.title ?? (episodesLoading ? "Loading the latest episode…" : "New episodes every Tuesday and Friday")}
                    </h2>
                    {latestEpisode && (
                      <p className="mt-2 text-xs text-slate-400">
                        {[episodeDate(latestEpisode.pubDate), latestEpisode.duration].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>

                {latestEpisode?.description && (
                  <p className="mb-5 text-sm leading-6 text-slate-300">{stripHtml(latestEpisode.description)}</p>
                )}

                {latestEpisode?.audioUrl ? (
                  <audio
                    controls
                    preload="metadata"
                    src={latestEpisode.audioUrl}
                    className="h-11 w-full"
                    aria-label={`Play ${latestEpisode.title}`}
                    onPlay={() => trackCta("latest_episode_play", latestEpisode.audioUrl, "hero_podcast")}
                  />
                ) : (
                  <Button asChild variant="secondary" className="w-full gap-2">
                    <Link href="/insights/podcast">
                      <Play className="h-4 w-4 fill-current" />
                      Listen to the latest episode
                    </Link>
                  </Button>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                  <span className="mr-1 text-xs text-slate-400">Follow:</span>
                  {[
                    ["Apple", PODCAST_APPLE_URL],
                    ["Spotify", PODCAST_SPOTIFY_URL],
                    ["YouTube", PODCAST_YOUTUBE_URL],
                  ].map(([label, href]) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-white/30 hover:text-white"
                    >
                      {label}
                    </a>
                  ))}
                  <Link href="/insights/podcast" className="ml-auto text-xs font-semibold text-red-300 hover:text-red-200">
                    All episodes →
                  </Link>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="border-b border-border/60 bg-card/60 py-7" aria-label="Media coverage">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-4 md:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Analysis featured by
            </p>
            <div className="grid w-full grid-cols-3 items-center gap-x-6 gap-y-5 opacity-55 grayscale sm:grid-cols-6">
              {mediaLogos.slice(0, 6).map((media) => {
                const logo = <img src={media.image} alt={media.name} className="mx-auto max-h-6 max-w-[110px] object-contain" />;
                return media.url ? (
                  <a key={media.name} href={media.url} target="_blank" rel="noreferrer" className="hover:opacity-70">
                    {logo}
                  </a>
                ) : (
                  <div key={media.name}>{logo}</div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Three jobs, done exceptionally well</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance md:text-5xl">
                Go from “maybe” to a defensible investment decision.
              </h2>
              <p className="mt-5 text-lg leading-8 text-muted-foreground">
                Realist is not another dashboard. It is a short path from a live listing to an underwritten decision—and, when you want it, a team that can help you execute.
              </p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {PRODUCT_LANES.map((lane) => (
                <article key={lane.title} className="group flex min-h-[390px] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
                  <div className={`bg-gradient-to-br ${lane.accent} p-6`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{lane.eyebrow}</span>
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-background/70">
                        <lane.icon className="h-5 w-5 text-primary" />
                      </span>
                    </div>
                    <h3 className="mt-8 text-2xl font-bold tracking-tight">{lane.title}</h3>
                    <p className="mt-3 leading-7 text-muted-foreground">{lane.description}</p>
                  </div>
                  <div className="flex flex-1 flex-col p-6 pt-5">
                    <ul className="space-y-3">
                      {lane.proof.map((item) => (
                        <li key={item} className="flex items-center gap-2.5 text-sm">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Check className="h-3 w-3" />
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={lane.href}
                      onClick={() => trackCta(lane.eyebrow.toLowerCase().replace(/\s+/g, "_"), lane.href, "product_lanes")}
                      className="mt-auto inline-flex items-center gap-2 pt-8 text-sm font-bold text-primary hover:gap-3"
                    >
                      {lane.cta}
                      <ArrowRight className="h-4 w-4 transition-all" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border/60 bg-muted/35 py-16 md:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 md:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">The flagship tool</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance md:text-5xl">
                Put a Toronto address in. Get a development thesis out.
              </h2>
              <p className="mt-5 text-lg leading-8 text-muted-foreground">
                The multiplex underwriter connects site permissions, buildable area, unit mix, construction costs, market rents and financing into one transparent model. Assumptions stay visible; uncertainty does too.
              </p>
              <div className="mt-7 flex flex-wrap gap-2">
                {["Lot dimensions", "Zoning", "Heritage", "TRCA", "Major streets", "Sixplex areas", "MLI Select"].map((label) => (
                  <span key={label} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium">
                    {label}
                  </span>
                ))}
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="gap-2">
                  <Link href="/tools/multiplex-underwriter">
                    <Building2 className="h-4 w-4" />
                    Underwrite a Toronto site
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/work-with-realist">Talk to the multiplex team</Link>
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sample underwriting</p>
                  <p className="mt-1 font-bold">Toronto · 30 × 120 ft lot</p>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  Strong candidate
                </span>
              </div>
              <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
                {[
                  ["As-of-right", "6 units"],
                  ["Practical GFA", "4,240 sf"],
                  ["Stabilized NOI", "$142k"],
                  ["MLI takeout", "$2.31M"],
                ].map(([label, value]) => (
                  <div key={label} className="p-4">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 text-lg font-bold">{value}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-5 p-5 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-muted/35 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Layers3 className="h-4 w-4 text-primary" />
                    Planning screen
                  </div>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Height</span><strong>12 m / 4 storeys</strong></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Approval path</span><strong>As of right</strong></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Variance risk</span><strong className="text-amber-600">Moderate</strong></div>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-muted/35 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <CircleDollarSign className="h-4 w-4 text-primary" />
                    Rental hold
                  </div>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Gross rent</span><strong>$18,900/mo</strong></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">DSCR</span><strong>1.24×</strong></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Cash required</span><strong>$744k</strong></div>
                  </div>
                </div>
              </div>
              <div className="border-t border-border bg-[#0b1220] px-5 py-4 text-sm text-slate-300">
                Illustrative output only. Every live report shows the source, confidence and last-verified date for each material assumption.
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 md:px-6 lg:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                <Headphones className="h-4 w-4" />
                Research you can use
              </div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">The show is the front door. The data goes deeper.</h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                Every episode becomes a permanent research page with show notes, related concepts, supporting reports and the next practical tool—not another orphaned blog post.
              </p>
              <div className="mt-7 space-y-3">
                {moreEpisodes.length > 0 ? moreEpisodes.map((episode) => (
                  <Link
                    key={episode.slug}
                    href={`/insights/podcast/${episode.slug}`}
                    className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-primary/40"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Play className="h-4 w-4 fill-current" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold group-hover:text-primary">{episode.title}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{episodeDate(episode.pubDate)}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                )) : (
                  <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
                    The latest episode feed will appear here automatically.
                  </div>
                )}
              </div>
              <Button asChild variant="outline" className="mt-6">
                <Link href="/insights">Explore market research</Link>
              </Button>
            </div>

            <div className="rounded-2xl border border-border bg-[#0b1220] p-6 text-white sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                <Users className="h-6 w-6 text-red-300" />
              </div>
              <h2 className="mt-7 text-3xl font-bold tracking-tight">Real investing is local.</h2>
              <p className="mt-4 leading-7 text-slate-300">
                Meet investors in your market, bring a live deal to the weekly Deal Room, and connect with people who can help you finance, inspect, buy and operate it.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <Link href="/meetups" className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
                  <CalendarDays className="h-5 w-5 text-red-300" />
                  <p className="mt-3 font-bold">Local meetups</p>
                  <p className="mt-1 text-sm text-slate-400">Find the next event near you</p>
                </Link>
                <Link href="/deal-room" className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
                  <Radio className="h-5 w-5 text-red-300" />
                  <p className="mt-3 font-bold">Live Deal Room</p>
                  <p className="mt-1 text-sm text-slate-400">Free review, Mondays at 11:30 ET</p>
                </Link>
              </div>
              <Button asChild size="lg" className="mt-7 w-full">
                <Link href="/meetups">Find your investor community</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-primary px-4 py-14 text-primary-foreground md:py-18">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.15em] text-white/75">
                <ShieldCheck className="h-4 w-4" />
                From underwriting to offer
              </div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Found one worth buying?</h2>
              <p className="mt-3 text-lg text-white/80">
                Work with the Realist team to pressure-test the deal and write the offer. Eligible buyers receive 50% of the cooperating commission back.
              </p>
            </div>
            <Button asChild size="lg" variant="secondary" className="h-12 shrink-0 px-6 text-base">
              <Link href="/work-with-realist">Buy this property with us</Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
