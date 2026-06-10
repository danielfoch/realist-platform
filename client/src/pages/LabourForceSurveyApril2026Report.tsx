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
  AlertTriangle,
  MapPin,
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

const SOURCE_URL =
  "https://www150.statcan.gc.ca/n1/daily-quotidien/260508/dq260508a-eng.htm";
const SOURCE_PDF_URL =
  "https://www150.statcan.gc.ca/n1/daily-quotidien/260508/dq260508a-eng.pdf";
const SOURCE_TITLE = "Labour Force Survey, April 2026 — Statistics Canada";
const RELEASE_LABEL = "Statistics Canada · May 8, 2026";
const REPORT_SLUG = "statcan-labour-force-survey-april-2026";

const heroSummary =
  "Canadian employment was little changed in April 2026 (−18,000; −0.1%), but the unemployment rate ticked up to 6.9% as more Canadians joined the labour force. Beneath the headline, full-time work fell again, Quebec lost another 43,000 jobs, the Montréal unemployment rate jumped to its highest level since 2016, and youth unemployment climbed to 14.3%. For real estate, that mix — softer labour, sticky wage growth, and stress concentrated in Quebec — keeps the case for further Bank of Canada easing alive while the affordability backdrop stays fragile.";

const keyTakeaways = [
  {
    icon: Users,
    accent: "text-rose-500",
    bg: "bg-rose-100 dark:bg-rose-900/30",
    title: "Unemployment Climbs to 6.9%",
    bullets: [
      "Unemployment rate +0.2 pp to 6.9% in April 2026.",
      "Up 0.4 pp since January, but still below the 7.1% peak from Aug/Sep 2025.",
      "Long-term unemployment now 22.5% of the unemployed — well above the 17.1% pre-COVID norm.",
    ],
  },
  {
    icon: Briefcase,
    accent: "text-amber-500",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    title: "Full-Time Work Keeps Slipping",
    bullets: [
      "Full-time employment −47,000 in April; −111,000 over the first four months of 2026.",
      "Part-time work edged up +29,000 (+0.8%).",
      "Net employment is down 112,000 (−0.5%) year-to-date despite +67,000 YoY.",
    ],
  },
  {
    icon: MapPin,
    accent: "text-blue-500",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    title: "Quebec & Montréal Lead the Slowdown",
    bullets: [
      "Quebec lost another 43,000 jobs (−0.9%); −91,000 since January.",
      "Montréal CMA unemployment rate +1.3 pp to 7.7% — highest since July 2016.",
      "Ontario added +42,000 (+0.5%); Manitoba's 5.0% rate is the lowest in the country.",
    ],
  },
  {
    icon: Wallet,
    accent: "text-violet-500",
    bg: "bg-violet-100 dark:bg-violet-900/30",
    title: "Wages Still Growing 4.5% YoY",
    bullets: [
      "Average hourly wages +4.5% YoY to $37.77 (was +4.7% in March).",
      "Strongest gains in the upper wage quartiles; bottom 25% only +3.5%.",
      "Composition-adjusted wage growth a steadier 3.4% YoY.",
    ],
  },
] as const;

const dataHighlights = [
  { label: "Headline employment change", value: "−18,000 (−0.1%)", icon: Users },
  { label: "Employment rate", value: "60.5% (−0.1 pp)", icon: TrendingDown },
  { label: "Unemployment rate", value: "6.9% (+0.2 pp)", icon: TrendingUp },
  { label: "Participation rate", value: "65.0% (+0.1 pp)", icon: TrendingUp },
  { label: "Full-time jobs (Apr)", value: "−47,000 (−0.3%)", icon: TrendingDown },
  { label: "Part-time jobs (Apr)", value: "+29,000 (+0.8%)", icon: TrendingUp },
  { label: "Net employment YTD 2026", value: "−112,000 (−0.5%)", icon: TrendingDown },
  { label: "Long-term unemployed share", value: "22.5%", icon: AlertTriangle },
  { label: "Youth unemployment (15–24)", value: "14.3% (+0.5 pp)", icon: AlertTriangle },
  { label: "Core-age men unemployment", value: "6.1% (+0.3 pp)", icon: TrendingUp },
  { label: "Average hourly wages, YoY", value: "+4.5% to $37.77", icon: Wallet },
  { label: "Health care employment, YoY", value: "+119,000 (+4.1%)", icon: TrendingUp },
] as const;

const employmentRateTrend = [
  { period: "Apr 2024", rate: 61.4 },
  { period: "Aug 2024", rate: 61.0 },
  { period: "Dec 2024", rate: 60.8 },
  { period: "Apr 2025", rate: 60.8 },
  { period: "Aug 2025", rate: 60.5 },
  { period: "Dec 2025", rate: 60.7 },
  { period: "Jan 2026", rate: 60.7 },
  { period: "Feb 2026", rate: 60.7 },
  { period: "Mar 2026", rate: 60.6 },
  { period: "Apr 2026", rate: 60.5 },
] as const;

const unemploymentTrend = [
  { period: "Apr 2024", rate: 6.2 },
  { period: "Aug 2024", rate: 6.6 },
  { period: "Dec 2024", rate: 6.7 },
  { period: "Apr 2025", rate: 6.9 },
  { period: "Aug 2025", rate: 7.1 },
  { period: "Dec 2025", rate: 6.7 },
  { period: "Jan 2026", rate: 6.5 },
  { period: "Feb 2026", rate: 6.6 },
  { period: "Mar 2026", rate: 6.7 },
  { period: "Apr 2026", rate: 6.9 },
] as const;

const provincialEmploymentChange = [
  { region: "Ontario", change: 42.0 },
  { region: "Quebec", change: -43.0 },
  { region: "Newfoundland & Labrador", change: -5.2 },
  { region: "Saskatchewan", change: -4.0 },
  { region: "New Brunswick", change: -2.7 },
] as const;

const provincialUnemployment = [
  { region: "Manitoba", rate: 5.0 },
  { region: "Saskatchewan", rate: 5.6 },
  { region: "Alberta", rate: 6.0 },
  { region: "Quebec", rate: 6.2 },
  { region: "British Columbia", rate: 6.4 },
  { region: "Nova Scotia", rate: 6.5 },
  { region: "New Brunswick", rate: 7.2 },
  { region: "Ontario", rate: 7.5 },
  { region: "Newfoundland & Labrador", rate: 10.0 },
] as const;

const industryChange = [
  { industry: "Business support svcs", change: 22.0 },
  { industry: "Health & social asst.", change: 18.0 },
  { industry: "Accommodation & food", change: 13.0 },
  { industry: "Other services", change: -13.0 },
  { industry: "Construction", change: -16.0 },
  { industry: "Info, culture & rec.", change: -25.0 },
] as const;

const realEstateImplications = [
  {
    key: "buyers",
    label: "Buyers",
    headline: "More room for rate cuts — but qualifying is the constraint, not pricing",
    points: [
      "A 6.9% unemployment rate, sub-trend hiring, and falling full-time work strengthen the case for more Bank of Canada cuts. Variable mortgage holders benefit most.",
      "But softer labour also means tighter lender stress tests on income and tenure. If you're newer at your job, expect more documentation pressure.",
      "Concentrated weakness in Quebec means GTA/Calgary buyers face less rate-vs-jobs trade-off than Montréal buyers do.",
    ],
  },
  {
    key: "sellers",
    label: "Sellers",
    headline: "Demand still real, but buyer pool is thinner outside Ontario",
    points: [
      "Ontario's +42,000 April print is the only major job gain — your buyer pool is healthiest in the GTA, Ottawa and Hamilton.",
      "In Quebec — especially Montréal CMA — assume softer absorption and price your listing tighter to comparable sold data, not aspirational ask.",
      "Wage growth at +4.5% YoY keeps household budgets moving up, but the bottom-quartile wage gain is only 3.5% — entry-level price points feel the strain first.",
    ],
  },
  {
    key: "investors",
    label: "Investors",
    headline: "Underwrite for a slower labour market, not the 2022 boom",
    points: [
      "Use a vacancy assumption that reflects rising unemployment (5–7% on most multi-fams; higher in Quebec secondary cities).",
      "Health care and social assistance added 119,000 jobs YoY — markets near hospitals, long-term-care nodes, and clinics keep tenant demand sticky.",
      "Construction lost 16,000 jobs in April. If the trend continues, expect new-build supply to slow further — supportive for resale rents in 12–24 months.",
      "Any deal that only works at 2022 rents and 2022 cap rates is not a deal. Stress-test with flat rents and a 50bp wider cap rate.",
    ],
  },
  {
    key: "renewers",
    label: "Renewers",
    headline: "The renewal cliff is meeting a softer job market",
    points: [
      "If you're renewing in 2026, the BoC has more cover to keep cutting — but don't bank on a 2021-style rate. Plan budgets at today's rate, and treat any cut as bonus.",
      "Lock vs float: a flatter, slowly-falling rate path means short fixed terms (2–3 yr) keep optionality without paying the full long-fixed premium.",
      "If your industry is on April's loser list (info/culture/rec, construction, other services), prioritize cash reserves over aggressive lump-sum prepayments.",
    ],
  },
  {
    key: "realtors",
    label: "Realtors",
    headline: "Lead with macro, not motivation",
    points: [
      "Buyer leads will be more cautious and more research-heavy. Macro context (LFS, CPI, BoC) buys you trust faster than 'now is a great time to buy.'",
      "In Quebec — particularly Montréal — coach sellers on realistic pricing early. The 7.7% CMA unemployment rate is the highest since 2016 ex-pandemic.",
      "Health care and education clients are your most resilient buyer cohort — build referral pipelines into hospital networks and school boards.",
      "Use the slow market to deepen underwriting skill — the agents who win 2027 listings are the ones building credibility right now.",
    ],
  },
] as const;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  headline: "Labour Force Survey, April 2026: Unemployment Hits 6.9% as Quebec Slides — Real Estate Implications",
  datePublished: "2026-05-08",
  dateModified: "2026-05-08",
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
    "Labour Force Survey, Statistics Canada, unemployment rate, Canadian jobs, April 2026, Quebec employment, Montreal unemployment, Bank of Canada, real estate, mortgage rates, housing market",
};

export default function LabourForceSurveyApril2026Report() {
  return (
    <div className="min-h-screen bg-background" data-testid="page-lfs-april-2026">
      <SEO
        title="Labour Force Survey, April 2026: Unemployment 6.9%, Quebec Slides — Real Estate Implications"
        description={heroSummary}
        keywords="Labour Force Survey April 2026, Statistics Canada jobs report, Canada unemployment rate 6.9%, Quebec employment, Montreal unemployment, Canadian wages 2026, Bank of Canada rate cuts, housing market labour"
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
            Labour Force Survey, April 2026: Unemployment Climbs to 6.9% as
            Quebec Sheds Another 43,000 Jobs
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
              <ExternalLink className="h-3 w-3" /> Original PDF (822 KB)
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
                    <ReferenceLine y={6.9} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: "Apr 2026: 6.9%", fontSize: 10, fill: "hsl(var(--destructive))" }} />
                    <Line type="monotone" dataKey="rate" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="chart-provincial-employment">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Provincial Employment Change, April 2026 (000s)</CardTitle>
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
                <CardTitle className="text-sm">Provincial Unemployment Rate, April 2026 (%)</CardTitle>
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
                <CardTitle className="text-sm">Employment Change by Industry, April 2026 (000s)</CardTitle>
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
            <h3>Headline: a soft month, not a crash</h3>
            <p>
              Employment was essentially flat in April 2026, falling by 18,000 (−0.1%). On its own that's a quiet print, but it's the
              second consecutive month of little variation following February's −84,000, and the year-to-date picture is now a net loss
              of 112,000 jobs (−0.5%) across the first four months of 2026. Year-over-year, employment is still up 67,000 (+0.3%) —
              but the trajectory is clearly cooling.
            </p>
            <h3>The mix matters: full-time down, part-time up</h3>
            <p>
              Full-time employment fell by 47,000 (−0.3%) in April while part-time rose 29,000 (+0.8%). Over the first four months of
              2026, the cumulative full-time loss is 111,000 (−0.6%). That mix shift typically signals genuine slack, not just a
              composition story — workers taking part-time work because full-time isn't available.
            </p>
            <h3>Unemployment rate: more job seekers, not fewer jobs</h3>
            <p>
              The unemployment rate rose 0.2 pp to 6.9%, driven mostly by 51,000 more people (+3.4%) actively searching for work, not
              a wave of layoffs. The participation rate ticked up 0.1 pp to 65.0%. The rate has now risen 0.4 pp since January but
              remains below the 7.1% peak of August/September 2025.
            </p>
            <h3>Long-term unemployment is sticky</h3>
            <p>
              The share of unemployed people who'd been searching for 27+ weeks was 22.5% in April — well above the 17.1% pre-COVID
              average from 2017–2019. Long-term unemployment tends to lag the cycle and is one of the more reliable signals that
              labour-market slack is real and not just statistical noise.
            </p>
            <h3>Geography: Quebec is the story</h3>
            <p>
              Quebec lost another 43,000 jobs (−0.9%) in April, the second significant monthly decline in the past three months. Since
              January, Quebec employment is down 91,000 (−1.9%), with most of that concentrated in the Montréal CMA (−56,000;
              −2.3%). The Quebec unemployment rate jumped 0.8 pp to 6.2%; Montréal's rate is 7.7% — its highest since July 2016
              outside the 2020–2021 pandemic window.
            </p>
            <p>
              Ontario went the other way, adding 42,000 jobs (+0.5%) and trimming its unemployment rate to 7.5%. Manitoba's 5.0% rate
              is now the lowest in Canada.
            </p>
            <h3>Industry: health care keeps carrying the YoY story</h3>
            <p>
              Month-over-month declines were concentrated in information, culture and recreation (−25,000), construction (−16,000)
              and 'other services' (−13,000). Gains in business support services (+22,000), health care and social assistance (+18,000),
              and accommodation and food services (+13,000). Year-over-year, health care and social assistance is up 119,000 (+4.1%) —
              essentially the only major industry pulling the YoY total positive.
            </p>
            <h3>Wages: still hot, but cooling slightly</h3>
            <p>
              Average hourly wages were up 4.5% YoY to $37.77, easing from 4.7% in March. Composition-adjusted wage growth (holding
              occupation and tenure constant) was 3.4% — closer to where the Bank of Canada wants it. The bottom wage quartile grew
              only 3.5%, while the top quartile grew 4.8% — affordability stress remains skewed to lower-income households.
            </p>
            <h3>Why this matters for the Bank of Canada</h3>
            <p>
              The April LFS gives the Bank of Canada more cover to keep cutting: hiring has stalled, full-time work is shrinking,
              long-term unemployment is sticky, and headline wage growth is moderating. The complication, as the April Monetary Policy
              Report flagged, is that oil-driven inflation could keep CPI near 3% even as the labour market softens. The next LFS prints
              on June 5, 2026 (covering May).
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
                    Re-underwrite with softer rents and a 50bp wider cap rate.
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
            <Link href="/insights/bank-of-canada-april-2026" className="block">
              <Card className="h-full hover:border-primary/50 transition-colors" data-testid="cta-boc-report">
                <CardContent className="p-5">
                  <Building2 className="h-6 w-6 text-primary mb-2" />
                  <h3 className="font-semibold text-sm mb-1">Bank of Canada April 2026</h3>
                  <p className="text-xs text-muted-foreground">
                    The Monetary Policy Report this LFS print feeds into.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>

        <footer className="border-t pt-6 text-xs text-muted-foreground">
          <p>
            Source: <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline">{SOURCE_TITLE}</a>.
            Reference week: April 12–18, 2026. Next release: June 5, 2026 (May 2026 data). Realist.ca commentary is for educational purposes only and is not investment advice.
          </p>
        </footer>
      </div>
    </div>
  );
}
