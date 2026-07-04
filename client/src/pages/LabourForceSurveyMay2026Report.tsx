import { Link } from "wouter";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  ExternalLink,
  Home,
  Landmark,
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
  "https://www150.statcan.gc.ca/n1/daily-quotidien/260605/dq260605a-eng.htm";
const SOURCE_PDF_URL =
  "https://www150.statcan.gc.ca/n1/daily-quotidien/260605/dq260605a-eng.pdf";
const SOURCE_TITLE = "Labour Force Survey, May 2026 — Statistics Canada";
const RELEASE_LABEL = "Statistics Canada · June 5, 2026";
const REPORT_SLUG = "statcan-labour-force-survey-may-2026";

const heroSummary =
  "Canada's job market rebounded in May 2026: employment jumped 88,000 (+0.4%) — the first significant gain since November 2025 — and the unemployment rate fell 0.3 percentage points to 6.6%. The recovery was led by full-time work (+154,000), construction, and Ontario, while youth unemployment dropped to 13.4% and Toronto's jobless rate hit its lowest level since 2023. Wage growth cooled to 3.0% year-over-year. For real estate, a firmer labour market with softer wage pressure is a constructive mix — it supports buyer confidence while still leaving room for the Bank of Canada to ease.";

const keyTakeaways = [
  {
    icon: TrendingUp,
    accent: "text-emerald-500",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    title: "Employment Rebounds by 88,000",
    bullets: [
      "Employment +88,000 (+0.4%) in May — first significant gain since November 2025.",
      "Follows a net decline of 112,000 over the first four months of 2026.",
      "Employment rate rose 0.2 pp to 60.7%, the first increase since November 2025.",
    ],
  },
  {
    icon: Briefcase,
    accent: "text-emerald-500",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    title: "Full-Time Work Drives the Gain",
    bullets: [
      "Full-time employment +154,000 (+0.9%), offsetting the Jan–Apr slide.",
      "Part-time work fell 66,000 (-1.7%) as workers shifted into full-time roles.",
      "Private sector +56,000 and public sector +20,000; self-employment little changed.",
    ],
  },
  {
    icon: Users,
    accent: "text-emerald-500",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    title: "Unemployment Falls to 6.6%",
    bullets: [
      "Unemployment rate -0.3 pp to 6.6%, below the 7.1% peak of Aug/Sep 2025.",
      "Youth (15–24) unemployment -0.9 pp to 13.4%, the first decline since January.",
      "Core-aged women 5.5% (-0.4 pp) and core-aged men 5.7% (-0.4 pp).",
    ],
  },
  {
    icon: Wallet,
    accent: "text-amber-500",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    title: "Wage Growth Cools to 3.0%",
    bullets: [
      "Average hourly wages +3.0% YoY to $37.24, down from +4.5% in April.",
      "Construction led industry gains (+27,000); wholesale and retail trade fell 35,000.",
      "Ontario added 42,000 jobs for a second straight month of growth.",
    ],
  },
] as const;

const dataHighlights = [
  { label: "Headline employment change", value: "+88,000 (+0.4%)", icon: TrendingUp },
  { label: "Employment level", value: "21,122,000", icon: Users },
  { label: "Employment rate", value: "60.7% (+0.2 pp)", icon: TrendingUp },
  { label: "Unemployment rate", value: "6.6% (-0.3 pp)", icon: TrendingDown },
  { label: "Full-time jobs (May)", value: "+154,000 (+0.9%)", icon: TrendingUp },
  { label: "Part-time jobs (May)", value: "-66,000 (-1.7%)", icon: TrendingDown },
  { label: "Employment YoY", value: "+147,000 (+0.7%)", icon: TrendingUp },
  { label: "Youth unemployment (15–24)", value: "13.4% (-0.9 pp)", icon: TrendingDown },
  { label: "Core-age women unemployment", value: "5.5% (-0.4 pp)", icon: TrendingDown },
  { label: "Core-age men unemployment", value: "5.7% (-0.4 pp)", icon: TrendingDown },
  { label: "Average hourly wages, YoY", value: "+3.0% to $37.24", icon: Wallet },
  { label: "Construction employment (May)", value: "+27,000 (+1.7%)", icon: TrendingUp },
] as const;

const employmentRateTrend = [
  { period: "May 2024", rate: 61.3 },
  { period: "Aug 2024", rate: 61.0 },
  { period: "Dec 2024", rate: 60.8 },
  { period: "May 2025", rate: 60.7 },
  { period: "Sep 2025", rate: 60.5 },
  { period: "Dec 2025", rate: 60.7 },
  { period: "Jan 2026", rate: 60.7 },
  { period: "Mar 2026", rate: 60.6 },
  { period: "Apr 2026", rate: 60.5 },
  { period: "May 2026", rate: 60.7 },
] as const;

const unemploymentTrend = [
  { period: "May 2024", rate: 6.2 },
  { period: "Aug 2024", rate: 6.6 },
  { period: "Dec 2024", rate: 6.7 },
  { period: "May 2025", rate: 6.9 },
  { period: "Sep 2025", rate: 7.1 },
  { period: "Dec 2025", rate: 6.7 },
  { period: "Jan 2026", rate: 6.5 },
  { period: "Mar 2026", rate: 6.8 },
  { period: "Apr 2026", rate: 6.9 },
  { period: "May 2026", rate: 6.6 },
] as const;

const provincialEmploymentChange = [
  { region: "Ontario", change: 42.0 },
  { region: "British Columbia", change: 25.0 },
  { region: "Alberta", change: 14.0 },
  { region: "Quebec", change: 13.0 },
  { region: "Prince Edward Island", change: 1.2 },
  { region: "Saskatchewan", change: -6.1 },
] as const;

const provincialUnemployment = [
  { region: "Manitoba", rate: 5.5 },
  { region: "Quebec", rate: 5.6 },
  { region: "Saskatchewan", rate: 6.2 },
  { region: "Alberta", rate: 6.6 },
  { region: "Prince Edward Island", rate: 6.7 },
  { region: "British Columbia", rate: 6.8 },
  { region: "Ontario", rate: 7.0 },
  { region: "Nova Scotia", rate: 7.1 },
  { region: "New Brunswick", rate: 7.2 },
  { region: "Newfoundland & Labrador", rate: 9.6 },
] as const;

const industryChange = [
  { industry: "Construction", change: 27.0 },
  { industry: "Info, culture & rec.", change: 19.0 },
  { industry: "Transport & warehousing", change: 19.0 },
  { industry: "Accommodation & food", change: 17.0 },
  { industry: "Manufacturing", change: 15.0 },
  { industry: "Wholesale & retail trade", change: -35.0 },
] as const;

const realEstateImplications = [
  {
    key: "buyers",
    label: "Buyers",
    headline: "A firmer job market supports confidence — and qualifying gets a little easier",
    points: [
      "An 88,000 job gain, a falling 6.6% unemployment rate, and rebounding full-time work all rebuild the income stability lenders look for. If you're newly employed, a stronger market eases the tenure scrutiny that tightened earlier in 2026.",
      "Wage growth cooling to 3.0% gives the Bank of Canada more room to keep cutting — supportive for variable-rate and upcoming renewals.",
      "The recovery is concentrated in Ontario, BC and Alberta — buyers in those markets face the most competition as confidence returns.",
    ],
  },
  {
    key: "sellers",
    label: "Sellers",
    headline: "The buyer pool is widening again — but price to current comparables",
    points: [
      "Ontario added jobs for a second straight month (+42,000) and Toronto's unemployment rate fell to 6.8%, its lowest since November 2023 — a healthier GTA buyer pool.",
      "BC (+25,000) and Alberta (+14,000) also gained, broadening demand beyond a single province.",
      "Wage growth has slowed to 3.0%, so household budgets are rising more slowly than in 2025 — price to sold comparables, not aspirational ask.",
    ],
  },
  {
    key: "investors",
    label: "Investors",
    headline: "Improving demand fundamentals, but underwrite conservatively",
    points: [
      "Falling unemployment and strong full-time gains support rent collection and tenant stability — tighten your vacancy assumption modestly in Ontario, BC and Alberta.",
      "Construction added 27,000 jobs in May, but is little changed year-over-year — new supply remains constrained, which is supportive for resale rents over the next 12–24 months.",
      "Wholesale and retail trade lost 35,000 jobs and is down 64,000 YoY — be cautious underwriting tenants and submarkets tied to discretionary retail.",
      "A single strong month is not a trend. Stress-test with flat rents and a 50bp wider cap rate before chasing the rebound.",
    ],
  },
  {
    key: "renewers",
    label: "Renewers",
    headline: "Cooling wages keep rate cuts on the table",
    points: [
      "Wage growth easing to 3.0% removes some inflation pressure, giving the Bank of Canada cover to keep cutting — helpful if you renew later in 2026.",
      "Lock vs float: with a slowly-falling rate path, short fixed terms (2–3 yr) keep optionality without paying the full long-fixed premium.",
      "A stronger job market lowers the odds of an income shock at renewal, but plan budgets at today's rate and treat any further cut as bonus.",
    ],
  },
  {
    key: "realtors",
    label: "Realtors",
    headline: "Use the rebound to re-engage cautious buyers",
    points: [
      "After months of soft prints, a clear jobs rebound is a credible reason to re-engage buyers who paused — pair it with CPI and Bank of Canada context, not hype.",
      "In Toronto, the unemployment rate fell to its lowest since 2023 — a tangible local data point for GTA buyer and seller conversations.",
      "Youth unemployment fell to 13.4% and student summer hiring improved — first-time-buyer pipelines may firm up into the second half of 2026.",
      "Keep coaching realistic pricing: wage growth at 3.0% means budgets are climbing slowly, so well-priced listings still win.",
    ],
  },
] as const;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  headline: "Labour Force Survey, May 2026: Employment Jumps 88,000, Unemployment Falls to 6.6% — Real Estate Implications",
  datePublished: "2026-06-05",
  dateModified: "2026-06-05",
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
    "Labour Force Survey, Statistics Canada, unemployment rate, Canadian jobs, May 2026, employment rebound, full-time work, Toronto unemployment, Bank of Canada, real estate, mortgage rates, housing market",
};

export default function LabourForceSurveyMay2026Report() {
  return (
    <div className="min-h-screen bg-background" data-testid="page-lfs-may-2026">
      <SEO
        title="Labour Force Survey, May 2026: Jobs Jump 88,000, Unemployment 6.6% — Real Estate Implications"
        description={heroSummary}
        keywords="Labour Force Survey May 2026, Statistics Canada jobs report, Canada unemployment rate 6.6%, employment rebound, full-time jobs, Toronto unemployment, Canadian wages 2026, Bank of Canada rate cuts, housing market labour"
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
            Labour Force Survey, May 2026: Employment Jumps 88,000 and
            Unemployment Falls to 6.6%
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
              <ExternalLink className="h-3 w-3" /> Original PDF (867 KB)
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
          <h2 id="charts" className="text-2xl font-bold mb-5">The Data, Visualized</h2>
          <p className="text-sm text-muted-foreground mb-4">
            The latest data point in each chart reflects the figures stated in the May 2026 release. Earlier points on the
            trend lines are illustrative, drawn to match the direction and turning points described in the source text.
          </p>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card data-testid="chart-employment-rate">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Employment Rate (%) — last 24 months</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...employmentRateTrend]} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis domain={[60, 62]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="chart-unemployment-trend">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Unemployment Rate (%) — last 24 months</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...unemploymentTrend]} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis domain={[5.5, 7.5]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <ReferenceLine y={6.6} stroke="#16a34a" strokeDasharray="4 4" label={{ value: "May 2026: 6.6%", fontSize: 10, fill: "#16a34a" }} />
                    <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="chart-provincial-employment">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Provincial Employment Change, May 2026 (000s)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...provincialEmploymentChange]} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="region" type="category" tick={{ fontSize: 10 }} width={140} />
                    <Tooltip />
                    <Bar dataKey="change">
                      {provincialEmploymentChange.map((d, i) => (
                        <Cell key={i} fill={d.change >= 0 ? "#16a34a" : "#dc2626"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="chart-provincial-unemployment">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Provincial Unemployment Rate, May 2026 (%)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...provincialUnemployment]} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="region" type="category" tick={{ fontSize: 10 }} width={150} />
                    <Tooltip />
                    <Bar dataKey="rate" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2" data-testid="chart-industry-change">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Employment Change by Industry, May 2026 (000s)</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...industryChange]} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="industry" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="change">
                      {industryChange.map((d, i) => (
                        <Cell key={i} fill={d.change >= 0 ? "#16a34a" : "#dc2626"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mb-12" aria-labelledby="narrative">
          <h2 id="narrative" className="text-2xl font-bold mb-5">What the Numbers Actually Say</h2>
          <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
            <h3>Headline: the first real gain in six months</h3>
            <p>
              Employment rose by 88,000 (+0.4%) in May 2026, the first significant gain since November 2025. It follows a net
              decline of 112,000 (−0.5%) over the first four months of the year, so this is a genuine turn in direction rather
              than continued drift. On a year-over-year basis, employment was up 147,000 (+0.7%).
            </p>
            <h3>The mix matters: full-time leads the way</h3>
            <p>
              The quality of the gain was encouraging. Full-time work rose by 154,000 (+0.9%), offsetting the downward trend from
              January to April, when full-time employment had fallen by 156,000. Part-time employment fell 66,000 (−1.7%),
              consistent with workers moving into full-time roles rather than settling for part-time. Both the private sector
              (+56,000) and public sector (+20,000) added jobs, while self-employment was little changed.
            </p>
            <h3>Unemployment rate: down to 6.6%</h3>
            <p>
              The unemployment rate fell 0.3 percentage points to 6.6%, reversing part of the climb from a recent low of 6.5% in
              January to 6.9% in April. It now sits below the 7.1% peak reached in August and September 2025. The job-finding rate
              improved, with 26.3% of people who were unemployed in April finding work in May — up 3.7 points from a year earlier,
              though still below the pre-pandemic norm. The layoff rate held steady at 0.6%.
            </p>
            <h3>Youth and core-aged workers both improve</h3>
            <p>
              Youth (aged 15 to 24) unemployment fell 0.9 percentage points to 13.4%, the first decline since January, driven by a
              99,000 jump in full-time work. Core-aged women added 31,000 jobs (all full-time) and their unemployment rate fell to
              5.5%; core-aged men added 25,000 and their rate fell to 5.7%. Returning students also saw a better start to the
              summer job season than in 2025, with their unemployment rate down 2.1 points to 18.0%.
            </p>
            <h3>Geography: Ontario leads, Toronto improves sharply</h3>
            <p>
              Ontario added 42,000 jobs (+0.5%) for a second straight month, bringing April and May gains to 84,000, and its
              unemployment rate fell to 7.0% — the lowest since September 2024. Toronto's unemployment rate dropped 1.1 points to
              6.8%, the lowest since November 2023 and well down from a 9.0% peak in 2025. British Columbia (+25,000), Alberta
              (+14,000), Quebec (+13,000) and Prince Edward Island (+1,200) also gained, while Saskatchewan lost 6,100 jobs.
            </p>
            <h3>Industry: construction and services lead</h3>
            <p>
              Gains were broad-based, led by construction (+27,000), information, culture and recreation (+19,000), transportation
              and warehousing (+19,000) and accommodation and food services (+17,000). Manufacturing added 15,000 but remains under
              pressure from U.S. tariff uncertainty. The main soft spot was wholesale and retail trade, which lost 35,000 jobs and
              is down 64,000 year-over-year.
            </p>
            <h3>Wages: growth cools to 3.0%</h3>
            <p>
              Average hourly wages were up 3.0% year-over-year to $37.24 in May, a marked slowdown from 4.5% in April. Cooling wage
              growth eases one of the inflation pressures the Bank of Canada watches most closely.
            </p>
            <h3>Why this matters for the Bank of Canada</h3>
            <p>
              May's report is a constructive mix: a firmer labour market reduces recession fears, while slowing wage growth keeps
              the door open to further rate cuts. For housing, that combination supports buyer confidence without removing the
              prospect of lower borrowing costs. The next LFS releases in July 2026, covering June.
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
                    Re-underwrite with conservative rents and a 50bp wider cap rate.
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
                    See where fixed and variable sit after the latest BoC moves.
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/insights/statcan-labour-force-survey-april-2026" className="block">
              <Card className="h-full hover:border-primary/50 transition-colors" data-testid="cta-lfs-april-report">
                <CardContent className="p-5">
                  <Building2 className="h-6 w-6 text-primary mb-2" />
                  <h3 className="font-semibold text-sm mb-1">Labour Force Survey April 2026</h3>
                  <p className="text-xs text-muted-foreground">
                    The prior month's jobs print, for month-over-month context.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>

        <ReportEndCta sourcePage="/insights/statcan-labour-force-survey-may-2026" />

        <footer className="border-t pt-6 text-xs text-muted-foreground">
          <p>
            Source: <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline">{SOURCE_TITLE}</a>.
            Reference week: May 10–16, 2026. Next release: July 2026 (June 2026 data). Realist.ca commentary is for educational purposes only and is not investment advice.
          </p>
        </footer>
      </div>
    </div>
  );
}
