import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ExternalLink,
  Home,
  Landmark,
  LineChart as LineChartIcon,
  Percent,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SOURCE_URL =
  "https://budget.canada.ca/update-miseajour/2026/report-rapport/overview-apercu-en.html";
const SOURCE_TITLE = "Spring Economic Update 2026 — Economic and Fiscal Overview";
const RELEASE_LABEL = "Department of Finance Canada · Spring 2026";

const headlineKpis = [
  {
    label: "National home prices vs peak",
    value: "−20%",
    sub: "Roughly 20% below recent peak levels",
    icon: TrendingDown,
    accent: "text-rose-500",
  },
  {
    label: "National rents vs peak",
    value: "−9%",
    sub: "Asking rents down ~9% nationally from peak",
    icon: TrendingDown,
    accent: "text-rose-500",
  },
  {
    label: "Rental vacancy rate, 2025",
    value: "3.1%",
    sub: "Up from a historical low of 1.5% in 2023",
    icon: Home,
    accent: "text-amber-500",
  },
  {
    label: "Housing starts, 2025",
    value: "260,000",
    sub: "Vs 2000–2019 average of ~200,000 units",
    icon: Building2,
    accent: "text-emerald-500",
  },
  {
    label: "Headline CPI, March 2026",
    value: "2.4%",
    sub: "Within BoC 1–3% band for 27 straight months",
    icon: Percent,
    accent: "text-blue-500",
  },
  {
    label: "2025–26 deficit (revised)",
    value: "$66.9B",
    sub: "$11.5B better than Budget 2025 · 2.1% of GDP",
    icon: Landmark,
    accent: "text-violet-500",
  },
];

const housingStartsData = [
  { period: "2000–2019 avg", total: 200, purposeBuiltRental: 24 },
  { period: "2025", total: 260, purposeBuiltRental: 120 },
];

const inflationByComponent = [
  { component: "Headline CPI", value: 2.4, withinBand: true },
  { component: "Core (avg)", value: 2.0, withinBand: true },
  { component: "Shelter", value: 1.7, withinBand: true },
  { component: "Rent", value: 4.1, withinBand: false },
  { component: "Groceries", value: 4.4, withinBand: false },
  { component: "Energy YoY", value: 3.9, withinBand: false },
];

const populationGrowthData = [
  { quarter: "Q2 2024", growthPct: 3.2 },
  { quarter: "Q4 2024", growthPct: 1.8 },
  { quarter: "Q2 2025", growthPct: 0.7 },
  { quarter: "Q4 2025", growthPct: -0.2 },
];

const fiscalPathData = [
  { fiscalYear: "2024–25", deficitB: 36.3 },
  { fiscalYear: "2025–26", deficitB: 66.9 },
  { fiscalYear: "2026–27", deficitB: 65.3 },
  { fiscalYear: "2027–28", deficitB: 63.1 },
  { fiscalYear: "2028–29", deficitB: 57.7 },
  { fiscalYear: "2029–30", deficitB: 55.6 },
  { fiscalYear: "2030–31", deficitB: 53.2 },
];

const executiveSummary = [
  "Ottawa's own read on housing is that affordability is improving, not worsening: home prices ~20% below peak, rents off ~9%, and rental vacancy at 3.1% (up from a historical low of 1.5% in 2023).",
  "Supply is the unambiguous bright spot — 260,000 starts in 2025 vs the 200,000 long-run average, with purpose-built rental starts running at roughly 5x their 2000–2019 average.",
  "Inflation has stayed inside the Bank of Canada's 1–3% band for 27 straight months. Shelter inflation is at 1.7% — its lowest since 2021. Rent inflation is still ~4% but is forecast to ease as new supply arrives and population growth slows.",
  "Canada's policy rate has fallen further than the U.S.'s, and long-term Canadian rates remain below U.S. equivalents — a structurally favorable backdrop for Canadian mortgage carry and refinance math.",
  "Demand-side cooling is real: population growth peaked at 3.2% (Q2 2024) and turned slightly negative (-0.2%) by end of 2025. Existing home sales in Ontario and B.C. are roughly 30% below their 10-year averages.",
  "Fiscal trajectory is improving but not loose: the 2025–26 deficit is now projected at $66.9B (2.1% of GDP), $11.5B better than Budget 2025; new measures total $37.5B over six years, with 45% directed at affordability.",
];

const investorTakeaways: Array<{ title: string; body: string; icon: typeof Home }> = [
  {
    title: "Underwriting: rent growth assumptions need a haircut",
    body: "Government's own outlook calls for rent inflation to ease as ~120k purpose-built rentals/year hit the market and population growth flatlines. Pro formas built on 4–5% rent growth are now the optimistic case, not the base case.",
    icon: TrendingDown,
  },
  {
    title: "Buy-side: ON/BC condos are where the dislocation lives",
    body: "Ottawa specifically calls out condo segments in Toronto and Vancouver as where price corrections are most pronounced. Existing-home sales in ON/BC are ~30% below 10-year norms — a buyer's market with motivated sellers.",
    icon: Building2,
  },
  {
    title: "Rates: structurally lower in Canada than the U.S.",
    body: "BoC has cut more than the Fed, and long Canadian yields sit below U.S. equivalents. That asymmetry supports lower mortgage rates and lower required cap rates here than across the border — but it can compress on news of Fed easing.",
    icon: Percent,
  },
  {
    title: "Fiscal: deficits are improving, not exploding",
    body: "$11.5B deficit improvement and a stable debt-to-GDP path through 2030–31 reduce the bond market's reason to demand a Canada-specific term premium. Watch CUSMA review headlines as the dominant tail risk.",
    icon: Landmark,
  },
];

const sourceCitations = [
  {
    label: "Spring Economic Update 2026 — Economic and Fiscal Overview",
    href: SOURCE_URL,
  },
  {
    label: "Department of Finance Canada — Spring Economic Update 2026 (root)",
    href: "https://budget.canada.ca/update-miseajour/2026/home-accueil-en.html",
  },
  {
    label: "Build Canada Homes (federal supply program)",
    href: "https://www.canada.ca/en/department-finance/news.html",
  },
];

export default function SpringEconomicUpdate2026Report() {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Spring Economic Update 2026: What It Means for Real Estate Investors"
        description="Housing-focused breakdown of Canada's Spring 2026 fiscal update — prices, rents, vacancy, supply, inflation, rates, and what investors should change in their underwriting."
        canonicalUrl="/insights/spring-economic-update-2026"
      />
      <Navigation />

      <article className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        {/* Back link */}
        <div className="mb-6">
          <Link href="/insights">
            <Button variant="ghost" size="sm" className="-ml-2" data-testid="link-back-insights">
              <ArrowLeft className="mr-2 h-4 w-4" />
              All Insights
            </Button>
          </Link>
        </div>

        {/* Hero */}
        <header className="mb-10">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" data-testid="badge-release">{RELEASE_LABEL}</Badge>
            <Badge variant="outline">Government Release</Badge>
            <Badge variant="outline">Housing · Inflation · Rates</Badge>
          </div>
          <h1 className="text-3xl font-bold leading-tight md:text-4xl" data-testid="heading-title">
            Spring Economic Update 2026: What Ottawa's Numbers Say About Canadian Real Estate
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">
            We pulled the housing- and macro-relevant content out of the federal government's
            Spring 2026 fiscal update and condensed it into the parts that actually move
            underwriting: prices, rents, vacancy, supply, inflation, rates, population, and the
            fiscal path that drives long bond yields.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <a
              href={SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
              data-testid="link-source-primary"
            >
              <ExternalLink className="h-4 w-4" />
              Read the original release
            </a>
            <span aria-hidden="true">·</span>
            <span>Source: {SOURCE_TITLE}</span>
          </div>
        </header>

        {/* KPIs */}
        <section className="mb-12" aria-labelledby="kpi-heading">
          <h2 id="kpi-heading" className="sr-only">Headline metrics</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {headlineKpis.map((k) => {
              const Icon = k.icon;
              const slug = k.label
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "");
              return (
                <Card key={k.label} className="border-border/60" data-testid={`kpi-${slug}`}>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${k.accent}`} />
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {k.label}
                      </span>
                    </div>
                    <div className="text-2xl font-bold">{k.value}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{k.sub}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Executive summary */}
        <section className="mb-12">
          <h2 className="mb-4 text-2xl font-bold">Executive Summary</h2>
          <Card className="border-border/60">
            <CardContent className="p-6">
              <ul className="space-y-3">
                {executiveSummary.map((point, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                    <span className="text-foreground/90">{point}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* Housing affordability */}
        <section className="mb-12">
          <div className="mb-4">
            <h2 className="text-2xl font-bold">Housing Affordability Is Quietly Improving</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              The government's own framing is that housing is undergoing a "gradual rebalancing" —
              softer prices and rents, more supply, looser vacancy. That's a meaningful tone shift
              from Budget 2025.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">National prices and rents (from peak)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Home prices vs recent peak</span>
                      <span className="font-semibold text-rose-500">−20%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded bg-muted">
                      <div className="h-full bg-rose-500" style={{ width: "20%" }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Down ~5% in the past year alone, per the federal release.
                    </p>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">National asking rents from peak</span>
                      <span className="font-semibold text-rose-500">−9%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded bg-muted">
                      <div className="h-full bg-rose-500" style={{ width: "9%" }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Cooling concentrated in Toronto and Vancouver condo markets.
                    </p>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Rental vacancy (2025)</span>
                      <span className="font-semibold text-amber-500">3.1%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded bg-muted">
                      <div className="h-full bg-amber-500" style={{ width: "62%" }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Up from a record low of 1.5% in 2023 — the loosest rental market in years.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Where the dislocation is concentrated</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                <p>
                  Ontario and British Columbia: existing home sales running roughly{" "}
                  <span className="font-semibold text-foreground">30% below their 10-year averages</span>,
                  with the sales-to-new-listings ratio below historical norms.
                </p>
                <p>
                  Condo segments are doing the heaviest lifting on price corrections — the federal
                  release explicitly flags weakness in condos as weighing on new home sales and
                  project launches.
                </p>
                <p>
                  Quebec, the Prairies, and Atlantic Canada are described as "more resilient,
                  supported by better affordability" — but cooling momentum is starting to show
                  there too as national conditions normalize.
                </p>
                <p className="text-xs">
                  Translation for investors: the buyer's market is real but uneven. The same ZIP
                  that was a bidding war in 2022 may now have 90+ days on market and a motivated
                  seller.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Supply chart */}
        <section className="mb-12">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Housing Starts: Purpose-Built Rental Is the Whole Story</CardTitle>
              <p className="text-sm text-muted-foreground">
                Total housing starts and the share that came from purpose-built rental
                construction. Rental starts hit ~120,000 units in 2025 — roughly 5x the
                2000–2019 average, with CMHC's multi-unit insurance backing nearly 90% of rental
                apartment starts in 2024.
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]" data-testid="chart-housing-starts">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={housingStartsData} margin={{ top: 16, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}k`} />
                    <Tooltip formatter={(v: number) => `${v}k units`} />
                    <Legend />
                    <Bar dataKey="total" name="Total starts" fill="hsl(220 70% 50%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="purposeBuiltRental" name="Purpose-built rental" fill="hsl(160 50% 45%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Source: Spring Economic Update 2026, "A Surge in Purpose-Built Rentals Is Expanding
                Supply." 2025 totals and long-run averages stated directly in the release.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Inflation */}
        <section className="mb-12">
          <div className="mb-4">
            <h2 className="text-2xl font-bold">Inflation: Boring Headline, Mixed Internals</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Headline CPI is 2.4% (March 2026) and core is back near 2%. Shelter inflation
              has cooled to 1.7% — its lowest reading since 2021. The pain points are real but
              narrow: groceries (concentrated in beef, coffee, confectionery, lettuce) and rent
              catch-up as tenancies turn over.
            </p>
          </div>
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Year-over-year inflation by component (March 2026)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]" data-testid="chart-inflation">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={inflationByComponent} margin={{ top: 16, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="component" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                    <ReferenceLine y={2} stroke="hsl(220 70% 50%)" strokeDasharray="4 4" label={{ value: "BoC target 2%", position: "insideTopRight", fontSize: 11 }} />
                    <ReferenceLine y={3} stroke="hsl(0 70% 55%)" strokeDasharray="4 4" label={{ value: "BoC ceiling 3%", position: "insideTopRight", fontSize: 11 }} />
                    <Bar dataKey="value" name="YoY %" radius={[4, 4, 0, 0]}>
                      {inflationByComponent.map((entry) => (
                        <Cell
                          key={entry.component}
                          fill={entry.withinBand ? "hsl(160 50% 45%)" : "hsl(20 80% 55%)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Green = within BoC's 1–3% target band. Orange = running hotter. Inflation has
                been inside the band for 27 consecutive months, per the release.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Rates context */}
        <section className="mb-12">
          <div className="mb-4">
            <h2 className="text-2xl font-bold">Rates: Canada Is Structurally Cheaper Than the U.S.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Two charts in the federal release matter for investors: Chart 22 shows Canada's
              policy rate has declined more than the U.S.'s, and Chart 23 shows long-term
              Canadian rates remain below U.S. equivalents. That asymmetry is the structural
              tailwind under Canadian mortgage rates.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/60">
              <CardHeader><CardTitle className="text-base">What's working in investors' favour</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>BoC has cut more aggressively than the Fed since 2024.</p>
                <p>Long-end Canadian yields persistently below U.S. equivalents.</p>
                <p>Improving fiscal trajectory reduces upward pressure on the term premium.</p>
                <p>Soft inflation prints (especially shelter at 1.7%) give BoC room to stay accommodative.</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardHeader><CardTitle className="text-base">What could compress the gap</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>An energy-driven inflation re-acceleration if the Middle East situation worsens.</p>
                <p>Fed easing meaningfully — narrows the rate differential.</p>
                <p>CUSMA review producing tariff escalation that hits the loonie.</p>
                <p>Fiscal slippage from new spending beyond the $37.5B announced package.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Population & demand */}
        <section className="mb-12">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Population Growth Has Decelerated Sharply — Demand Side of the Equation</CardTitle>
              <p className="text-sm text-muted-foreground">
                Quarterly year-over-year population growth, as cited in the federal release. The
                2026–2028 Immigration Levels Plan is doing exactly what it was designed to do:
                cap demand while supply ramps.
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]" data-testid="chart-population">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={populationGrowthData} margin={{ top: 16, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                    <ReferenceLine y={0} stroke="hsl(0 0% 60%)" />
                    <Line
                      type="monotone"
                      dataKey="growthPct"
                      name="Population growth YoY"
                      stroke="hsl(220 70% 50%)"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Source: Spring Economic Update 2026. Population growth peaked at 3.2% in Q2 2024
                and reached -0.2% by end of 2025, expected to remain subdued for the next two
                years.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Fiscal path */}
        <section className="mb-12">
          <div className="mb-4">
            <h2 className="text-2xl font-bold">The Fiscal Path (Why Bond Yields Should Behave)</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              The deficit is bigger in nominal dollars than people would like, but the trajectory
              is improving and debt-to-GDP is projected to be flat-to-down through 2030–31. That
              matters for real estate because it caps how much of a Canada-specific term premium
              the bond market should demand.
            </p>
          </div>
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">
                Federal budgetary deficit projection (after Spring Economic Update measures)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]" data-testid="chart-fiscal">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fiscalPathData} margin={{ top: 16, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="fiscalYear" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}B`} />
                    <Tooltip formatter={(v: number) => `$${v.toFixed(1)}B`} />
                    <Bar dataKey="deficitB" name="Deficit ($B)" fill="hsl(280 50% 50%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Source: Spring Economic Update 2026, Table 1. 2030–31 deficit projected at $53.2B,
                or 1.4% of GDP. New measures total $37.5B over six years; ~45% allocated to
                affordability (groceries benefit, housing supply, fuel excise tax suspension).
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Investor takeaways */}
        <section className="mb-12">
          <h2 className="mb-4 text-2xl font-bold">What This Means For Investors</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {investorTakeaways.map((t) => {
              const Icon = t.icon;
              return (
                <Card key={t.title} className="border-border/60">
                  <CardHeader>
                    <CardTitle className="flex items-start gap-2 text-base">
                      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                      <span>{t.title}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-muted-foreground">{t.body}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Cross-links */}
        <section className="mb-12">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-6">
              <h3 className="mb-2 text-lg font-semibold">Put these numbers to work</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                The fastest way to use this is to plug the new assumptions (slower rent growth,
                lower required cap rates, easier borrowing) into a live deal.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/tools/analyzer">
                  <Button size="sm" data-testid="link-cta-analyzer">
                    Analyze a Deal
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/insights/cpi-march-2026">
                  <Button size="sm" variant="outline" data-testid="link-cta-cpi">
                    <LineChartIcon className="mr-2 h-4 w-4" />
                    CPI Report — March 2026
                  </Button>
                </Link>
                <Link href="/insights/mortgage-rates">
                  <Button size="sm" variant="outline" data-testid="link-cta-rates">
                    <Percent className="mr-2 h-4 w-4" />
                    Today's Mortgage Rates
                  </Button>
                </Link>
                <Link href="/insights/the-spread-that-ate-the-economy">
                  <Button size="sm" variant="outline" data-testid="link-cta-spreads">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Credit Spreads Report
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Sources */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Sources</h2>
          <Card className="border-border/60">
            <CardContent className="p-4">
              <ul className="space-y-2 text-sm">
                {sourceCitations.map((s) => (
                  <li key={s.href} className="flex items-start gap-2">
                    <ExternalLink className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Quoted percentages, dollar figures, and unit counts are sourced from the federal
                release. Charts visualize the values stated in the text; any inferred or rounded
                values (e.g., older quarterly population data points) are noted in chart captions.
                This report is editorial commentary on a public government release, not
                investment advice.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Footer back */}
        <div className="flex items-center justify-between border-t border-border/60 pt-6">
          <Link href="/insights">
            <Button variant="ghost" size="sm" data-testid="link-back-insights-footer">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Insights
            </Button>
          </Link>
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            data-testid="link-source-footer"
          >
            Read the original release
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

      </article>
    </div>
  );
}
