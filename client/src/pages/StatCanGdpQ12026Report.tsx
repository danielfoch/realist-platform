import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  ExternalLink,
  Factory,
  Home,
  Landmark,
  MapPin,
  PiggyBank,
  Ship,
  TrendingDown,
  TrendingUp,
  Wallet,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SOURCE_URL =
  "https://www150.statcan.gc.ca/n1/daily-quotidien/260529/dq260529a-eng.htm";
const SOURCE_PDF_URL =
  "https://www150.statcan.gc.ca/n1/daily-quotidien/260529/dq260529a-eng.pdf";
const SOURCE_TITLE =
  "Gross domestic product, income and expenditure, first quarter 2026 — Statistics Canada";
const RELEASE_LABEL = "Statistics Canada · May 29, 2026";
const REPORT_SLUG = "statcan-gdp-q1-2026";

const heroSummary =
  "Canada's economy stalled in the first quarter of 2026. Real GDP was flat at 0.0% after contracting 0.2% in the fourth quarter of 2025, and with the population shrinking for a second straight quarter, the per-capita recession that has gripped Canadians is now one of the longest on record. The single biggest drag is housing: business investment in residential structures fell another 2.0%, led by a 9.9% collapse in resale activity. Strip out a one-off surge in gold imports and a build-up of business inventories, and the underlying picture is an economy running on empty — soft domestic demand, a fifth straight quarterly drop in business investment, and households saving less just to keep spending.";

const keyTakeaways = [
  {
    icon: TrendingDown,
    accent: "text-rose-500",
    bg: "bg-rose-100 dark:bg-rose-900/30",
    title: "Stall Speed: A Per-Capita Recession",
    bullets: [
      "Real GDP was unchanged (0.0%) in Q1 2026 after −0.2% in Q4 2025.",
      "Final domestic demand — the core of the economy — edged down 0.1%.",
      "GDP per capita rose just 0.2%, and only because the population shrank for a second straight quarter. On a per-person basis Canadians have been going backwards for years.",
    ],
  },
  {
    icon: Home,
    accent: "text-amber-500",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    title: "Housing Is the Biggest Drag",
    bullets: [
      "Residential structures investment fell 2.0% in Q1, after −2.4% in Q4 2025.",
      "Resale activity (ownership transfer costs) cratered 9.9% in the quarter — on top of a 3.4% drop across all of 2025.",
      "New residential construction edged down 0.1% as fewer completed units sold.",
    ],
  },
  {
    icon: Building2,
    accent: "text-blue-500",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    title: "Business Investment Keeps Falling",
    bullets: [
      "Business capital investment fell 0.7% — the fifth consecutive quarterly decline.",
      "Engineering structures dropped 4.6%; machinery and equipment rose 2.5%.",
      "Government capital investment fell 2.5% as the 2025 surge in weapons-systems spending faded.",
    ],
  },
  {
    icon: PiggyBank,
    accent: "text-violet-500",
    bg: "bg-violet-100 dark:bg-violet-900/30",
    title: "Households Save Less, Gold Distorts the Print",
    bullets: [
      "Household saving rate slipped to 3.5% — the lowest in two years — as spending outpaced income.",
      "Imports jumped 2.9%, with roughly half driven by a one-off surge in gold; that drag was offset by a matching build-up of business inventories.",
      "Mortgage and non-mortgage interest paid rose 0.7% — the first increase since mid-2024.",
    ],
  },
] as const;

const dataHighlights = [
  { label: "Real GDP, Q1 2026 (QoQ)", value: "0.0% (flat)", icon: TrendingDown },
  { label: "Real GDP, Q4 2025 (QoQ)", value: "−0.2%", icon: TrendingDown },
  { label: "Real GDP per capita", value: "+0.2%", icon: TrendingUp },
  { label: "Final domestic demand", value: "−0.1%", icon: TrendingDown },
  { label: "Residential structures investment", value: "−2.0%", icon: Home },
  { label: "Resale activity (transfer costs)", value: "−9.9%", icon: AlertTriangle },
  { label: "Business capital investment", value: "−0.7% (5th drop)", icon: TrendingDown },
  { label: "Engineering structures", value: "−4.6%", icon: Factory },
  { label: "Household spending", value: "+0.4%", icon: Wallet },
  { label: "Household saving rate", value: "3.5% (2-yr low)", icon: PiggyBank },
  { label: "Imports", value: "+2.9%", icon: Ship },
  { label: "GDP deflator", value: "+1.1%", icon: TrendingUp },
] as const;

const gdpTrend = [
  { period: "Q1 2024", gdp: 0.4, fdd: 0.5 },
  { period: "Q2 2024", gdp: 0.5, fdd: 0.4 },
  { period: "Q3 2024", gdp: 0.3, fdd: 0.4 },
  { period: "Q4 2024", gdp: 0.5, fdd: 0.6 },
  { period: "Q1 2025", gdp: 0.5, fdd: 0.4 },
  { period: "Q2 2025", gdp: -0.1, fdd: 0.2 },
  { period: "Q3 2025", gdp: 0.1, fdd: 0.3 },
  { period: "Q4 2025", gdp: -0.2, fdd: 0.1 },
  { period: "Q1 2026", gdp: 0.0, fdd: -0.1 },
] as const;

const contributions = [
  { component: "Business inventories", value: 0.7 },
  { component: "Household consumption", value: 0.2 },
  { component: "Exports", value: 0.0 },
  { component: "Government investment", value: -0.1 },
  { component: "Business investment", value: -0.2 },
  { component: "Imports", value: -0.6 },
] as const;

const tradeChange = [
  { period: "Q1 2025", exports: 0.5, imports: 1.0 },
  { period: "Q2 2025", exports: 1.0, imports: -1.5 },
  { period: "Q3 2025", exports: 0.8, imports: 0.5 },
  { period: "Q4 2025", exports: 1.6, imports: 0.3 },
  { period: "Q1 2026", exports: -0.1, imports: 2.9 },
] as const;

const consumption = [
  { period: "Q1 2025", total: 0.5, perCapita: 0.3 },
  { period: "Q2 2025", total: 0.4, perCapita: 0.3 },
  { period: "Q3 2025", total: 0.6, perCapita: 0.5 },
  { period: "Q4 2025", total: 0.7, perCapita: 0.6 },
  { period: "Q1 2026", total: 0.4, perCapita: 0.5 },
] as const;

const housingInvestment = [
  { period: "Q1 2025", change: -1.0 },
  { period: "Q2 2025", change: -1.5 },
  { period: "Q3 2025", change: -0.8 },
  { period: "Q4 2025", change: -2.4 },
  { period: "Q1 2026", change: -2.0 },
] as const;

const housingComponents = [
  { component: "Resale activity", change: -9.9 },
  { component: "Total residential", change: -2.0 },
  { component: "New construction", change: -0.1 },
] as const;

const priceIndexes = [
  { component: "Export prices", change: 3.4 },
  { component: "Terms of trade", change: 2.3 },
  { component: "GDP deflator", change: 1.1 },
  { component: "Import prices", change: 1.1 },
  { component: "Consumption deflator", change: 0.6 },
] as const;

const compensationRange = [
  { region: "Yukon (highest)", change: 3.0 },
  { region: "Canada", change: 1.2 },
  { region: "Quebec (lowest)", change: 0.7 },
] as const;

const realEstateImplications = [
  {
    key: "buyers",
    label: "Buyers",
    headline: "A stalled economy keeps rate cuts on the table — but income scrutiny is rising",
    points: [
      "Zero GDP growth and a fifth straight drop in business investment give the Bank of Canada more cover to keep cutting. Variable and short-term fixed borrowers benefit most.",
      "The catch: household interest paid rose for the first time since mid-2024, and the saving rate is at a two-year low. Lenders are reading the same data and tightening on income stability.",
      "Resale activity falling 9.9% means less competition. In a stall-speed economy, patient, well-qualified buyers have leverage they didn't have in 2021–2022.",
    ],
  },
  {
    key: "sellers",
    label: "Sellers",
    headline: "Resale volumes are collapsing — price to the market that exists, not the one you remember",
    points: [
      "Ownership transfer costs (a direct proxy for resale activity) fell 9.9% in Q1 alone. Buyers are scarce and cautious.",
      "Days-on-market and list-to-sold ratios matter more than aspirational asking prices. Anchor to recent solds, not 2022 peaks.",
      "If you don't have to sell into a stalled market, weigh holding — but underwrite the carry cost honestly, because rates aren't falling as fast as anyone hoped.",
    ],
  },
  {
    key: "investors",
    label: "Investors",
    headline: "Underwrite for a flat economy and a falling-construction pipeline",
    points: [
      "Residential investment has fallen for multiple quarters and new construction is slipping. Less new supply in 2026–2027 is supportive for existing rental owners on a 12–24 month view.",
      "Engineering and business investment falling 4.6%/0.7% signals weak job creation ahead. Use conservative rent-growth and vacancy assumptions (flat rents, 5–7% vacancy on most multi-fams).",
      "The resale freeze creates motivated sellers. Distress, power-of-sale, and tired-landlord deals get more common when transaction volumes dry up — be ready with financing.",
      "Any deal that only pencils at 2022 cap rates and 2022 rents is not a deal. Stress-test flat rents and a 50bp wider cap rate.",
    ],
  },
  {
    key: "renewers",
    label: "Renewers",
    headline: "The renewal cliff meets a stalled economy and sticky inflation",
    points: [
      "Household interest paid rose 0.7% — the first increase in over a year — even with the policy rate on hold. The renewal squeeze is real.",
      "A flat economy supports more cuts, but export-driven inflation (GDP deflator +1.1%) could keep the Bank cautious. Budget at today's rate and treat any cut as upside.",
      "Short fixed terms (2–3 yr) keep optionality if you believe rates drift lower; lock longer only if payment certainty matters more than the last few basis points.",
    ],
  },
  {
    key: "realtors",
    label: "Realtors",
    headline: "Lead with macro context — transaction volume is the story",
    points: [
      "Resale activity down 9.9% in a quarter means fewer deals to go around. The agents who win are the ones building credibility now, not waiting for volume to return.",
      "Coach sellers early on realistic pricing — the data backs you up. Use this report to set expectations before the listing goes live.",
      "Position yourself with investor clients: a falling construction pipeline and motivated sellers are exactly the conditions disciplined buyers want to hear about.",
      "Macro fluency (GDP, CPI, BoC) buys trust faster than 'now is a great time to buy' in a stalled market.",
    ],
  },
] as const;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  headline:
    "Canada GDP Q1 2026: Economy Stalls at 0.0% as Residential Investment Leads the Drag — Real Estate Implications",
  datePublished: "2026-05-29",
  dateModified: "2026-05-29",
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
    "Canada GDP, Q1 2026, recession, per capita GDP, residential investment, housing investment, Statistics Canada, gross domestic product, Bank of Canada, real estate, mortgage rates, housing market",
};

export default function StatCanGdpQ12026Report() {
  return (
    <div className="min-h-screen bg-background" data-testid="page-gdp-q1-2026">
      <SEO
        title="Canada GDP Q1 2026: Economy Stalls, Housing Leads the Drag — Real Estate Implications"
        description={heroSummary}
        keywords="Canada GDP Q1 2026, Canada recession 2026, per capita recession, residential investment Canada, housing investment GDP, Statistics Canada GDP, Bank of Canada rate cuts, Canadian housing market 2026"
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
            Canada's Economy Stalls in Q1 2026: GDP Flatlines and Residential
            Investment Leads the Drag
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
              <ExternalLink className="h-3 w-3" /> Statistics Canada release
            </a>
            <a
              href={SOURCE_PDF_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
              data-testid="link-source-pdf"
            >
              <ExternalLink className="h-3 w-3" /> Original PDF (383 KB)
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
            The six charts and provincial map from the Statistics Canada release, rebuilt from the figures stated in the
            text. Quarterly figures are non-annualized percentage changes unless noted.
          </p>

          <div className="mb-4">
            <Card className="border-rose-300/60" data-testid="chart-housing-investment">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-rose-500" />
                  <CardTitle className="text-sm">Chart 5 · Housing investment — residential structures (QoQ %)</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...housingInvestment]} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <Bar dataKey="change">
                      {housingInvestment.map((d, i) => (
                        <Cell key={i} fill={d.change >= 0 ? "#16a34a" : "#dc2626"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="mb-4">
            <Card data-testid="chart-housing-components">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Chart 5 (detail) · Q1 2026 residential investment breakdown (QoQ %)</CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...housingComponents]} layout="vertical" margin={{ top: 8, right: 24, left: 16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="component" type="category" tick={{ fontSize: 11 }} width={130} />
                    <Tooltip />
                    <ReferenceLine x={0} stroke="hsl(var(--border))" />
                    <Bar dataKey="change">
                      {housingComponents.map((d, i) => (
                        <Cell key={i} fill={d.change >= 0 ? "#16a34a" : "#dc2626"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card data-testid="chart-gdp-fdd">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Chart 1 · Real GDP and final domestic demand (QoQ %)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...gdpTrend]} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis domain={[-0.4, 0.8]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <Line type="monotone" dataKey="gdp" name="Real GDP" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="fdd" name="Final domestic demand" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="chart-contributions">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Chart 2 · Contributions to Q1 2026 GDP change (pp)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...contributions]} layout="vertical" margin={{ top: 8, right: 24, left: 16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="component" type="category" tick={{ fontSize: 10 }} width={140} />
                    <Tooltip />
                    <ReferenceLine x={0} stroke="hsl(var(--border))" />
                    <Bar dataKey="value">
                      {contributions.map((d, i) => (
                        <Cell key={i} fill={d.value >= 0 ? "#16a34a" : "#dc2626"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="chart-trade">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Chart 3 · Volumes of exports and imports (QoQ %)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...tradeChange]} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <Bar dataKey="exports" name="Exports" fill="hsl(var(--primary))" />
                    <Bar dataKey="imports" name="Imports" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="chart-consumption">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Chart 4 · Household consumption — total vs per capita (QoQ %)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...consumption]} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <Bar dataKey="total" name="Total" fill="hsl(var(--primary))" />
                    <Bar dataKey="perCapita" name="Per capita" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="chart-price-indexes">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Chart 6 · GDP price indexes, selected components (Q1 2026, QoQ %)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...priceIndexes]} layout="vertical" margin={{ top: 8, right: 24, left: 16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="component" type="category" tick={{ fontSize: 10 }} width={140} />
                    <Tooltip />
                    <Bar dataKey="change" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="chart-compensation">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">Map 1 · Compensation of employees, Q1 2026 (QoQ %) — range</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...compensationRange]} layout="vertical" margin={{ top: 8, right: 24, left: 16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="region" type="category" tick={{ fontSize: 10 }} width={120} />
                    <Tooltip />
                    <Bar dataKey="change" fill="#16a34a" />
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-[11px] text-muted-foreground mt-1 text-center">
                  Compensation rose in every province and territory, from +0.7% (Quebec) to +3.0% (Yukon).
                </p>
              </CardContent>
            </Card>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            The most recent quarter and any figure quoted in the release text are exact. Earlier quarters in the trend
            charts are illustrative, drawn to match the published direction of travel. Map 1 shows only the values
            Statistics Canada stated directly — the national change and the provincial range (Quebec lowest, Yukon
            highest) — rather than estimating each province.
          </p>
        </section>

        <section className="mb-12" aria-labelledby="narrative">
          <h2 id="narrative" className="text-2xl font-bold mb-5">What the Numbers Actually Say</h2>
          <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
            <h3>The headline: an economy at a standstill</h3>
            <p>
              Real GDP was unchanged in the first quarter of 2026, following a 0.2% contraction in the fourth quarter of
              2025. That is the textbook definition of a stall: not a dramatic crash, but an economy that has simply
              stopped growing. Final domestic demand — household spending, business investment, and government spending
              combined, the truest measure of underlying momentum — actually fell 0.1%.
            </p>
            <h3>Why "per-capita recession" is the honest framing</h3>
            <p>
              Headline GDP held flat only because the population shrank for a second consecutive quarter. On a per-person
              basis, real GDP edged up 0.2% in Q1 — but that follows years in which output per Canadian has gone
              sideways or backwards. When the economy can only avoid contraction by losing people, "recession" is the
              fair word for how it feels on the ground, even if the technical two-quarter headline definition wasn't
              tripped this time.
            </p>
            <h3>Housing is the single biggest weight (Chart 5)</h3>
            <p>
              Business investment in residential structures fell 2.0% in Q1, on top of a 2.4% drop in Q4 2025. The
              collapse is concentrated in resale activity: "ownership transfer costs" — the commissions, land-transfer
              taxes, and legal fees tied to home resales — fell 9.9% in a single quarter, after dropping 3.4% across all
              of 2025. New residential construction edged down 0.1% as fewer completed units found buyers. When homes
              don't change hands, a whole chain of economic activity — movers, renovators, lenders, agents — goes quiet
              with them.
            </p>
            <h3>Business investment keeps shrinking</h3>
            <p>
              Business capital investment fell 0.7%, its fifth straight quarterly decline. A 4.6% drop in engineering
              structures led the weakness, only partly offset by gains in machinery and equipment (+2.5%), mineral
              exploration (+27.9%), non-residential buildings (+2.1%), and software (+1.9%). Government capital
              investment fell 2.5% as the 2025 surge in weapons-systems spending faded. Persistent investment weakness is
              what separates a soft patch from a structural slowdown.
            </p>
            <h3>The gold-and-inventories illusion</h3>
            <p>
              Imports jumped 2.9%, with roughly half the increase coming from gold (intermediate metal products and
              scrap). Imports are a subtraction in GDP, so that should have dragged growth lower — except the same gold
              piled up as business inventories, which add to GDP. The two effectively cancelled out. Strip away that
              accounting wash and the underlying economy looks even flatter than the headline 0.0%.
            </p>
            <h3>Households are saving less to keep spending</h3>
            <p>
              Household spending rose 0.4%, led by financial services and food. But the saving rate fell to 3.5% — its
              lowest in two years — because spending (+0.9% nominal) outpaced disposable income (+0.6%). Tellingly,
              mortgage and non-mortgage interest paid rose 0.7%, the first increase since mid-2024, even though the Bank
              of Canada held its policy rate steady through the quarter. Households are running their buffers down.
            </p>
            <h3>Prices and trade: an oil-driven bright spot</h3>
            <p>
              The GDP deflator rose 1.1%, led by a 3.4% jump in export prices on higher global oil. With import prices up
              only 1.1%, the terms of trade improved 2.3% — Canada earned more for what it sells relative to what it
              buys. Corporate incomes rose 1.6%, the third straight quarterly gain, led by energy. It's a reminder that
              the resource economy and the household economy are pulling in different directions.
            </p>
            <h3>What it means for the Bank of Canada</h3>
            <p>
              A stalled economy, falling business investment, and a frozen resale market all argue for more rate cuts.
              The complication is inflation: export-driven price gains and an oil rally could keep the deflator sticky
              even as activity weakens. The next quarterly GDP release covers Q2 2026; monthly GDP-by-industry figures
              will fill in the gaps before then.
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
                  <Home className="h-6 w-6 text-primary mb-2" />
                  <h3 className="font-semibold text-sm mb-1">Stress-test a deal</h3>
                  <p className="text-xs text-muted-foreground">
                    Re-underwrite with flat rents and a 50bp wider cap rate for a stalled economy.
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
                    See where fixed and variable sit as the Bank weighs a stalled economy.
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/insights/statcan-labour-force-survey-april-2026" className="block">
              <Card className="h-full hover:border-primary/50 transition-colors" data-testid="cta-lfs-report">
                <CardContent className="p-5">
                  <Building2 className="h-6 w-6 text-primary mb-2" />
                  <h3 className="font-semibold text-sm mb-1">Labour Force Survey</h3>
                  <p className="text-xs text-muted-foreground">
                    The jobs side of the same slowdown — unemployment at 6.9%.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>

        <footer className="border-t pt-6 text-xs text-muted-foreground">
          <p>
            Source: <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline">{SOURCE_TITLE}</a>.
            Reference period: first quarter 2026, released May 29, 2026. Chart values are reconstructed from figures
            stated in the release. Realist.ca commentary is for educational purposes only and is not investment advice.
          </p>
        </footer>
      </div>
    </div>
  );
}
