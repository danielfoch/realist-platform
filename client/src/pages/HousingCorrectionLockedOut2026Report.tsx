import { Link } from "wouter";
import {
  ArrowLeft,
  Building2,
  Construction,
  ExternalLink,
  Home,
  KeyRound,
  Landmark,
  Percent,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportEndCta } from "@/components/ReportEndCta";

const SOURCE_URL =
  "https://financialpost.com/real-estate/housing-drop-leaves-canadians-locked-out-market";
const SOURCE_TITLE =
  "A 20% housing drop still leaves Canadians locked out — Financial Post / Bloomberg";
const RELEASE_LABEL = "Financial Post · June 2, 2026";
const REPORT_SLUG = "housing-correction-locked-out-2026";

const heroSummary =
  "Canada just lived through one of its sharpest housing corrections on record — benchmark prices are down roughly 20% nationally from their 2022 peak, and more than 30% in some cities. And yet most Canadians say it still isn't enough. Prices have only fallen back to where they sat just before the pandemic, when affordability was already a national crisis. A Nanos poll for Bloomberg found 55% of Canadians want prices to fall further, rising to 69% among 18-to-34-year-olds. In Vancouver, housing still eats 88% of a typical household's income; in Toronto, 63%. Supply is finally rising, but it's the wrong supply — record condo inventory nobody wants, and too few family-sized homes. This is what 'improved affordability' looks like when prices were never close to incomes to begin with.";

const keyTakeaways = [
  {
    icon: TrendingDown,
    accent: "text-rose-500",
    bg: "bg-rose-100 dark:bg-rose-900/30",
    title: "A Real Correction — But Only Back to 2019",
    bullets: [
      "Benchmark prices are down ~20% nationally from the 2022 peak; more than 30% in the hardest-hit cities.",
      "BC and Ontario — which ran up the most after COVID — have fallen the most.",
      "RBC: the market is essentially back to just before the pandemic, when affordability was already viewed as a crisis.",
    ],
  },
  {
    icon: Users,
    accent: "text-amber-500",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    title: "Canadians Want Prices Even Lower",
    bullets: [
      "55% of Canadians want home prices to fall further (Nanos for Bloomberg).",
      "That jumps to 69% among 18-to-34-year-olds — the priced-out generation.",
      "Even two-thirds of homeowners called the decline a positive or somewhat positive development.",
    ],
  },
  {
    icon: Wallet,
    accent: "text-blue-500",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    title: "Affordability Is Still Broken in the Big Two",
    bullets: [
      "Housing costs eat 88% of a typical household's income in Vancouver and 63% in Toronto.",
      "Only about half of Canadian markets were still on an easing trajectory in H2 2025 (RBC).",
      "A 15–20% drop still prices out middle-class families — a measure of how far prices ran from incomes.",
    ],
  },
  {
    icon: Construction,
    accent: "text-violet-500",
    bg: "bg-violet-100 dark:bg-violet-900/30",
    title: "Rising Supply — But the Wrong Supply",
    bullets: [
      "Housing starts rose 6% in 2025, but CMHC warns of 'major vulnerabilities' and rising unsold inventory.",
      "Record condo inventory, yet family-sized ownership homes are well below historical averages in Toronto, Montreal, Vancouver and Ottawa.",
      "Asking rents fell 3.2% (2024→2025); vacancy is back to 3% — the threshold for a balanced market.",
    ],
  },
] as const;

const dataHighlights = [
  { label: "National benchmark vs 2022 peak", value: "−20%", icon: TrendingDown },
  { label: "Hardest-hit cities", value: "−30%+", icon: TrendingDown },
  { label: "Want prices to fall further (all)", value: "55%", icon: Users },
  { label: "Want prices to fall further (18–34)", value: "69%", icon: Users },
  { label: "Homeowners who view drop positively", value: "~67%", icon: Home },
  { label: "Vancouver housing cost / income", value: "88%", icon: Wallet },
  { label: "Toronto housing cost / income", value: "63%", icon: Wallet },
  { label: "Housing starts, 2025", value: "+6%", icon: Construction },
  { label: "Asking rents, 2024→2025", value: "−3.2%", icon: TrendingDown },
  { label: "Rental vacancy rate, 2026", value: "3.0% (balanced)", icon: Building2 },
  { label: "Say Ottawa is doing enough (Abacus)", value: "17%", icon: Landmark },
  { label: "Shelter inflation", value: "5-yr low, sub-2%", icon: Percent },
] as const;

const pollData = [
  { group: "All Canadians", pct: 55 },
  { group: "Ages 18–34", pct: 69 },
] as const;

const priceDecline = [
  { market: "National benchmark", change: -20 },
  { market: "Hardest-hit cities", change: -30 },
] as const;

const affordability = [
  { city: "Vancouver", pct: 88 },
  { city: "Toronto", pct: 63 },
] as const;

const vacancyTrend = [
  { period: "2022", rate: 1.9 },
  { period: "2023", rate: 1.5 },
  { period: "2024", rate: 2.2 },
  { period: "2025", rate: 2.6 },
  { period: "2026", rate: 3.0 },
] as const;

const realEstateImplications = [
  {
    key: "buyers",
    label: "Buyers",
    headline: "The best entry window in years — but only if the math works on your income",
    points: [
      "Prices are ~20% off peak and rates are relatively low; on paper this is the most buyer-friendly setup since before the pandemic.",
      "Don't try to time the exact bottom. With 55% of Canadians wanting further declines, sentiment is bearish — but RBC and CMHC both see the drop as a reversal of excess, not the start of a freefall.",
      "Be picky on product, not just price. 'Lots of supply' is mostly investor condos; family-sized homes that actually fit your needs are still scarce and sell faster.",
    ],
  },
  {
    key: "sellers",
    label: "Sellers",
    headline: "You're competing with record inventory — price to the buyer who exists",
    points: [
      "In Toronto and Vancouver especially, unsold inventory is piling up. Aspirational pricing just adds days-on-market.",
      "Condo sellers face the toughest crowd — record supply and hesitant first-time buyers. Differentiate on layout, condition, and fees, not just price.",
      "Family-sized freehold homes are the scarce good. If that's what you're selling, you have more leverage than the headlines suggest.",
    ],
  },
  {
    key: "investors",
    label: "Investors",
    headline: "Underwrite the supply mismatch, not the average",
    points: [
      "The glut is in small investor condos; the shortage is in family-sized ownership stock. Buy what's scarce, not what's cheap-and-everywhere.",
      "Rents fell 3.2% and vacancy is back to a balanced 3% — model flat-to-soft rent growth and realistic vacancy, not 2022 rent ramps.",
      "Government incentives (GST removal up to $1M, development-charge cuts) improve new-build economics — useful for pre-construction and small-scale infill underwriting.",
      "A 20% price reset plus soft rents means many 2021–2022 deals are underwater. Stress-test existing holdings for renewal at today's rates.",
    ],
  },
  {
    key: "renewers",
    label: "Renewers",
    headline: "Lower prices don't help if you're renewing into a higher payment",
    points: [
      "If you bought near the 2022 peak, your home may be worth less than you paid — watch loan-to-value at renewal, especially for refinances or switches.",
      "Shelter inflation is at a 5-year low and below the 2% target, which supports the case for steady-to-lower rates — but budget at today's rate, not a hoped-for cut.",
      "If you're in a soft market (BC, Ontario condos), avoid being forced to sell into weakness; protect cash flow and term flexibility.",
    ],
  },
  {
    key: "realtors",
    label: "Realtors",
    headline: "Sentiment is the obstacle — sell context, not urgency",
    points: [
      "First-time buyers are asking 'will it fall further?' Arm yourself with the data: this is a reversal of overshoot, and the big banks don't forecast a crash from here.",
      "Coach sellers early on realistic pricing against record inventory — the comparable solds, not the 2022 dream number.",
      "Lead investor clients toward the scarce family-sized segment and government-incentivized new builds.",
      "The agents who build credibility in a slow, bearish market are the ones who win the listings when sentiment turns.",
    ],
  },
] as const;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  headline:
    "A 20% Housing Correction Still Leaves Canadians Locked Out — What It Means for Real Estate",
  datePublished: "2026-06-02",
  dateModified: "2026-06-02",
  author: { "@type": "Organization", name: "Realist.ca" },
  publisher: {
    "@type": "Organization",
    name: "Realist.ca",
    logo: { "@type": "ImageObject", url: "https://realist.ca/og-image.png" },
  },
  description: heroSummary,
  mainEntityOfPage: `https://realist.ca/insights/${REPORT_SLUG}`,
  isBasedOn: SOURCE_URL,
  keywords:
    "Canada housing correction, home prices 2026, housing affordability, Toronto Vancouver prices, Nanos poll, RBC, CMHC, rental vacancy, asking rents, first-time buyers, real estate",
};

export default function HousingCorrectionLockedOut2026Report() {
  return (
    <div className="min-h-screen bg-background" data-testid="page-housing-correction-2026">
      <SEO
        title="A 20% Housing Correction Still Leaves Canadians Locked Out — Real Estate Implications"
        description={heroSummary}
        keywords="Canada housing correction 2026, home prices down 20 percent, housing affordability Canada, Toronto Vancouver home prices, Nanos poll home prices, rental vacancy 3 percent, asking rents falling, first-time buyers Canada"
        canonicalUrl={`/insights/${REPORT_SLUG}`}
        structuredData={structuredData}
      />
      <Navigation />

      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <Link
          href="/insights/market-report"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
          data-testid="link-back-market-report"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Market Reports
        </Link>

        <header className="mb-10">
          <Badge variant="outline" className="mb-3" data-testid="badge-release">
            {RELEASE_LABEL}
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4" data-testid="heading-report">
            A 20% Housing Correction Still Leaves Canadians Locked Out
          </h1>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed" data-testid="text-hero-summary">
            {heroSummary}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <a
              href={SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
              data-testid="link-source-html"
            >
              <ExternalLink className="h-3 w-3" /> Financial Post / Bloomberg article
            </a>
          </div>
        </header>

        <section className="mb-12" aria-labelledby="key-takeaways">
          <h2 id="key-takeaways" className="text-2xl font-bold mb-5">
            Four Key Takeaways
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {keyTakeaways.map((t) => {
              const Icon = t.icon;
              return (
                <Card key={t.title} data-testid={`card-takeaway-${t.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg ${t.bg} flex items-center justify-center`}>
                        <Icon className={`h-5 w-5 ${t.accent}`} />
                      </div>
                      <CardTitle className="text-base">{t.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      {t.bullets.map((b, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mb-12" aria-labelledby="numbers-glance">
          <h2 id="numbers-glance" className="text-2xl font-bold mb-5">Numbers at a Glance</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {dataHighlights.map((d) => {
              const Icon = d.icon;
              return (
                <div
                  key={d.label}
                  className="border rounded-lg p-3 flex items-start gap-3"
                  data-testid={`kpi-${d.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                >
                  <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{d.label}</p>
                    <p className="text-sm font-semibold">{d.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-12" aria-labelledby="charts">
          <h2 id="charts" className="text-2xl font-bold mb-2">The Data, Visualized</h2>
          <p className="text-sm text-muted-foreground mb-5">
            The four charts from the Financial Post / Bloomberg story, rebuilt from the figures stated in the article.
            Historical points on the vacancy chart are illustrative; see the note below the charts.
          </p>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card data-testid="chart-poll">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Canadians who want home prices to fall further (%)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...pollData]} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="group" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="pct" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="chart-price-decline">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Price decline from 2022 peak (%)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...priceDecline]} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="market" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <Bar dataKey="change">
                      {priceDecline.map((d, i) => (
                        <Cell key={i} fill="#dc2626" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-[11px] text-muted-foreground mt-1 text-center">
                  Article states ~20% nationally and "more than 30%" in some cities; the −30% bar is that stated floor.
                </p>
              </CardContent>
            </Card>

            <Card data-testid="chart-affordability">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Share of household income needed for housing (%)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...affordability]} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="city" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "50% = severely unaffordable", fontSize: 9, fill: "#f59e0b" }} />
                    <Bar dataKey="pct" fill="#dc2626" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="chart-vacancy">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Rental vacancy rate (%) — recovering to balanced</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...vacancyTrend]} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 3.5]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <ReferenceLine y={3} stroke="#16a34a" strokeDasharray="4 4" label={{ value: "3% = balanced", fontSize: 10, fill: "#16a34a" }} />
                    <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Values are reconstructed from figures stated in the Financial Post / Bloomberg article (Nanos and Abacus
            polls, RBC and CMHC commentary). The current 2026 vacancy rate (3%) is stated directly; earlier years are
            illustrative to show the recovery from post-pandemic lows. City-level price declines beyond the national
            average and the "30%+" floor are not itemized in the source.
          </p>
        </section>

        <section className="mb-12" aria-labelledby="narrative">
          <h2 id="narrative" className="text-2xl font-bold mb-5">What the Numbers Actually Say</h2>
          <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
            <h3>One of the sharpest corrections on record</h3>
            <p>
              Benchmark home prices have fallen roughly 20% nationally since the 2022 peak, and by more than 30% in some
              cities. By the raw numbers, that looks like a crash. But as RBC's Robert Hogue put it, "it's after prices
              had increased even more" — this is largely a reversal of pandemic-era excess, not a collapse in
              fundamentals.
            </p>
            <h3>And it still isn't enough</h3>
            <p>
              The striking part is the public mood. A Nanos poll for Bloomberg found 55% of Canadians want prices to fall
              further — 69% among 18-to-34-year-olds. Remarkably, two-thirds of homeowners also viewed the decline as
              positive. When even the people who own homes want them to be worth less, it tells you how deep the
              affordability frustration runs.
            </p>
            <h3>Back to 2019 — when it was already a crisis</h3>
            <p>
              Mike Moffatt of the University of Ottawa's Missing Middle Initiative notes the market is only back to where
              it sat just before the pandemic, when affordability was already broadly seen as a national crisis. "Prices
              can go down 15% to 20% and it's still priced out middle-class families," he said — a measure of how far
              prices had detached from incomes.
            </p>
            <h3>The big two are still brutal</h3>
            <p>
              Affordability gains have been lopsided. Prices fell most in BC and Ontario — the same regions that ran up
              the most — yet major metros there remain exorbitant. Housing costs absorb about 88% of a typical
              household's income in Vancouver and 63% in Toronto. RBC says only about half of Canadian markets were still
              on an easing path in the second half of 2025.
            </p>
            <h3>The supply mismatch</h3>
            <p>
              CMHC reports housing starts rose 6% in 2025, but warns of "major vulnerabilities" as unsold inventory
              builds. The problem isn't only quantity — it's fit. There's record condo inventory that doesn't match what
              buyers want, while family-sized ownership homes remain well below historical averages in Toronto, Montreal,
              Vancouver and Ottawa. As one Toronto agent put it: "Even though there's a lot of supply, it's not good
              supply."
            </p>
            <h3>Rents and rates ease the squeeze — a little</h3>
            <p>
              The rental market has loosened too: asking rents fell 3.2% between 2024 and 2025, and the vacancy rate has
              climbed to 3% — the threshold for a balanced market. Combined with relatively low rates, that pushed shelter
              inflation to a five-year low, below the 2% target. Yet only 17% of Canadians think Ottawa is doing enough.
            </p>
            <h3>The policy response</h3>
            <p>
              Governments are still leaning on supply. In March, the federal and Ontario governments removed sales tax on
              new homes up to $1 million for all buyers and agreed to cut development charges by up to 50% for three
              years. RBC's Hogue says the measures help avoid a "huge air pocket" in the construction pipeline when
              population growth eventually rebounds — but Moffatt cautions they're temporary fixes, not the structural
              reform the market actually needs.
            </p>
          </div>
        </section>

        <section className="mb-12" aria-labelledby="implications">
          <h2 id="implications" className="text-2xl font-bold mb-5">Real Estate Implications</h2>
          <Tabs defaultValue="buyers" className="w-full">
            <TabsList className="w-full flex-wrap h-auto justify-start">
              {realEstateImplications.map((s) => (
                <TabsTrigger key={s.key} value={s.key} data-testid={`tab-impl-${s.key}`}>
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {realEstateImplications.map((s) => (
              <TabsContent key={s.key} value={s.key}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{s.headline}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {s.points.map((p, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </section>

        <section className="mb-12" aria-labelledby="next-steps">
          <h2 id="next-steps" className="text-2xl font-bold mb-5">Put This to Work</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <Link href="/" className="block">
              <Card className="h-full hover:border-primary/50 transition-colors" data-testid="cta-deal-analyzer">
                <CardContent className="p-5">
                  <KeyRound className="h-6 w-6 text-primary mb-2" />
                  <h3 className="font-semibold text-sm mb-1">Underwrite a correction-era deal</h3>
                  <p className="text-xs text-muted-foreground">
                    Model soft rents, balanced vacancy, and a price 20% off peak.
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/insights/mortgage-rates" className="block">
              <Card className="h-full hover:border-primary/50 transition-colors" data-testid="cta-mortgage-rates">
                <CardContent className="p-5">
                  <Landmark className="h-6 w-6 text-primary mb-2" />
                  <h3 className="font-semibold text-sm mb-1">Today's mortgage rates</h3>
                  <p className="text-xs text-muted-foreground">
                    See where fixed and variable sit as shelter inflation cools.
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/insights/statcan-gdp-q1-2026" className="block">
              <Card className="h-full hover:border-primary/50 transition-colors" data-testid="cta-gdp-report">
                <CardContent className="p-5">
                  <Building2 className="h-6 w-6 text-primary mb-2" />
                  <h3 className="font-semibold text-sm mb-1">GDP Q1 2026</h3>
                  <p className="text-xs text-muted-foreground">
                    The macro backdrop: a stalled economy with housing as the biggest drag.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>

        <ReportEndCta sourcePage="/insights/housing-correction-locked-out-2026" />

        <footer className="border-t pt-6 text-xs text-muted-foreground">
          <p>
            Source: <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline">{SOURCE_TITLE}</a>,
            citing Nanos Research, Abacus Data, RBC, and CMHC. Chart values are reconstructed from figures stated in the
            article. Realist.ca commentary is for educational purposes only and is not investment advice.
          </p>
        </footer>
      </div>
    </div>
  );
}
