import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Building2,
  ExternalLink,
  Home,
  Landmark,
  TrendingDown,
  TrendingUp,
  Users,
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

const LFS_SOURCE_URL = "https://www150.statcan.gc.ca/n1/daily-quotidien/260508/dq260508a-eng.htm";
const PAYROLL_SOURCE_URL = "https://www150.statcan.gc.ca/n1/daily-quotidien/260430/dq260430b-eng.htm";
const CBA_SOURCE_URL = "https://cba.ca/article/mortgages-in-arrears";
const REPORT_SLUG = "labour-mortgage-stress-april-2026";

const heroSummary =
  "Canada's April 2026 Labour Force Survey and February 2026 payroll release are telling the same broad story from different angles: job growth has cooled, full-time work is soft, payroll employment slipped, vacancies are no longer absorbing slack, and mortgage arrears remain low but are moving onto the watchlist. For housing, the key link is simple: unemployment is typically a leading indicator for mortgage delinquencies and arrears, because lost income shows up in missed payments with a lag.";

const headlineMetrics = [
  { label: "LFS unemployment rate", value: "6.9%", detail: "+0.2 pp in April 2026", icon: TrendingUp },
  { label: "LFS employment change", value: "-18,000", detail: "-0.1% month over month", icon: Users },
  { label: "Full-time jobs", value: "-47,000", detail: "-111,000 YTD 2026", icon: Briefcase },
  { label: "Payroll employment", value: "-60,200", detail: "-0.3% in February 2026", icon: TrendingDown },
  { label: "Job vacancies", value: "497,200", detail: "-29,000 YoY", icon: Building2 },
  { label: "Bank mortgage arrears", value: "0.28%", detail: "February 2026, CBA", icon: AlertTriangle },
] as const;

const compareRows = [
  {
    topic: "Survey lens",
    lfs: "Household survey; captures employees, self-employed and unemployment status.",
    payroll: "Employer/payroll records; excludes self-employed and focuses on paid employees, earnings and hours.",
    read: "Use LFS for unemployment risk. Use payroll/JVWS for employer demand and pay conditions.",
  },
  {
    topic: "Latest direction",
    lfs: "April employment little changed at -18,000; unemployment rose to 6.9%.",
    payroll: "February payroll employment fell 60,200 after a January increase of 44,300.",
    read: "Both releases point to a labour market losing momentum, not a sudden break.",
  },
  {
    topic: "Income signal",
    lfs: "Average hourly wages rose 4.5% YoY to $37.77, with composition-adjusted growth at 3.4%.",
    payroll: "Average weekly earnings rose 3.4% YoY to $1,338.24; weekly hours were 33.3.",
    read: "Pay is still growing, but employment quality and hours matter for mortgage resilience.",
  },
  {
    topic: "Housing risk",
    lfs: "Higher unemployment raises household cash-flow risk and weakens buyer confidence.",
    payroll: "Lower vacancies reduce re-employment optionality after a job loss.",
    read: "The delinquency risk is a lagged story: low arrears today can still rise after labour softening.",
  },
] as const;

const labourCoolingData = [
  { signal: "LFS employment", change: -18 },
  { signal: "LFS full-time", change: -47 },
  { signal: "Payroll employment", change: -60.2 },
  { signal: "Job vacancies YoY", change: -29 },
] as const;

const unemploymentTrend = [
  { period: "Jan 2026", rate: 6.5 },
  { period: "Feb 2026", rate: 6.6 },
  { period: "Mar 2026", rate: 6.7 },
  { period: "Apr 2026", rate: 6.9 },
] as const;

const payrollSectorChange = [
  { sector: "Transportation", change: -14.0 },
  { sector: "Admin support", change: -7.5 },
  { sector: "Retail", change: -5.9 },
  { sector: "Construction", change: -4.2 },
  { sector: "Accommodation", change: -4.1 },
] as const;

const vacancyProvinceData = [
  { province: "B.C.", rate: 3.3 },
  { province: "Nova Scotia", rate: 3.0 },
  { province: "Alberta", rate: 3.0 },
  { province: "Quebec", rate: 2.7 },
  { province: "Ontario", rate: 2.5 },
  { province: "N.L.", rate: 2.3 },
] as const;

const arrearsLeadLagData = [
  { point: "Feb 2026 arrears", arrears: 0.28, note: "CBA reported" },
  { point: "+1 pp unemployment lag", arrears: 0.38, note: "BoC/CBA sensitivity" },
] as const;

const mortgageStatusData = [
  { status: "Not seriously delinquent", share: 99.72 },
  { status: "In arrears", share: 0.28 },
] as const;

const stakeholderImplications = [
  {
    key: "buyers",
    label: "Buyers",
    headline: "The rate-cut case improves, but income risk matters more",
    points: [
      "A 6.9% unemployment rate and weaker full-time employment support a softer Bank of Canada path, but lenders will scrutinize income stability.",
      "Do not treat lower rates as pure purchasing power. If your sector is seeing payroll losses, preserve a larger cash buffer.",
      "Markets with weak labour absorption may offer better pricing leverage, but they also carry higher tenant and resale risk.",
    ],
  },
  {
    key: "investors",
    label: "Investors",
    headline: "Underwrite arrears as a lagging risk, not a current headline",
    points: [
      "CBA's 0.28% arrears rate is still low, but unemployment typically leads mortgage arrears with a lag.",
      "Use more conservative vacancy, bad-debt and turnover assumptions where unemployment is rising or vacancies are falling.",
      "For tenant-heavy assets, watch local job losses in retail, accommodation, construction and administrative support.",
    ],
  },
  {
    key: "renewers",
    label: "Renewers",
    headline: "Payment stress and job-market stress can compound",
    points: [
      "If renewal payments are rising, employment stability is the swing factor between manageable strain and arrears risk.",
      "Borrowers in higher-risk sectors should talk to their lender early rather than waiting for missed payments.",
      "The CBA arrears definition is three or more months overdue, so the published data will lag real household stress.",
    ],
  },
  {
    key: "realtors",
    label: "Realtors",
    headline: "Lead conversations with employment quality, not just rates",
    points: [
      "A buyer who still qualifies may be more cautious if full-time work is weakening in their industry.",
      "Sellers in markets with rising unemployment need tighter pricing and cleaner financing conditions.",
      "Use payroll and vacancy data to explain market depth: it shows whether buyers can replace income if something goes wrong.",
    ],
  },
] as const;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  headline: "Canada Labour Market and Mortgage Arrears Watch: April 2026",
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
  isBasedOn: [LFS_SOURCE_URL, PAYROLL_SOURCE_URL, CBA_SOURCE_URL],
  keywords:
    "Canada unemployment, mortgage arrears, mortgage delinquencies, Labour Force Survey April 2026, payroll employment February 2026, Canadian housing market, job vacancies",
};

export default function LabourMortgageStressApril2026Report() {
  return (
    <div className="min-h-screen bg-background" data-testid="page-labour-mortgage-stress">
      <SEO
        title="Canada Labour Market and Mortgage Arrears Watch - April 2026"
        description={heroSummary}
        keywords="Canada unemployment mortgage arrears April 2026, StatCan Labour Force Survey April 2026, payroll employment February 2026, mortgage delinquencies Canada"
        canonicalUrl={`/insights/${REPORT_SLUG}`}
        structuredData={structuredData}
      />
      <Navigation />

      <main className="container mx-auto px-4 py-10 max-w-6xl">
        <Link
          href="/insights/market-report"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
          data-testid="link-back-market-report"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Market Reports
        </Link>

        <header className="mb-10">
          <Badge variant="outline" className="mb-3">StatCan + CBA Watch · May 8, 2026</Badge>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Canada Labour Market and Mortgage Arrears Watch: April 2026
          </h1>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-4xl">
            {heroSummary}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <a href={LFS_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              <ExternalLink className="h-3 w-3" /> StatCan LFS, April 2026
            </a>
            <a href={PAYROLL_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              <ExternalLink className="h-3 w-3" /> StatCan payroll and vacancies, February 2026
            </a>
            <a href={CBA_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              <ExternalLink className="h-3 w-3" /> CBA mortgages in arrears
            </a>
          </div>
        </header>

        <section className="mb-12" aria-labelledby="numbers-glance">
          <h2 id="numbers-glance" className="text-2xl font-bold mb-5">Numbers at a Glance</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {headlineMetrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className="border rounded-lg p-4 flex items-start gap-3">
                  <Icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{metric.label}</p>
                    <p className="text-xl font-bold leading-tight">{metric.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{metric.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-12" aria-labelledby="compare">
          <h2 id="compare" className="text-2xl font-bold mb-5">Compare and Contrast: LFS vs Payroll/JVWS</h2>
          <div className="grid gap-4">
            {compareRows.map((row) => (
              <Card key={row.topic}>
                <CardContent className="p-5">
                  <div className="grid md:grid-cols-[0.8fr_1.3fr_1.3fr_1.4fr] gap-4">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Data point</p>
                      <p className="font-semibold">{row.topic}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">May 8 LFS</p>
                      <p className="text-sm">{row.lfs}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Apr 30 payroll release</p>
                      <p className="text-sm">{row.payroll}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Real estate read</p>
                      <p className="text-sm">{row.read}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-12" aria-labelledby="charts">
          <h2 id="charts" className="text-2xl font-bold mb-5">Charts to Watch</h2>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card data-testid="chart-labour-cooling">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Labour Cooling Signals (000s)</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...labourCoolingData]} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="signal" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={55} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="change">
                      {labourCoolingData.map((d, i) => (
                        <Cell key={i} fill={d.change >= 0 ? "#16a34a" : "#dc2626"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="chart-unemployment-arrears">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Unemployment Is the Lead Signal</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...unemploymentTrend]} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis domain={[6.3, 7.1]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <ReferenceLine y={6.9} stroke="#dc2626" strokeDasharray="4 4" label={{ value: "Apr: 6.9%", fontSize: 10, fill: "#dc2626" }} />
                    <Line type="monotone" dataKey="rate" stroke="#dc2626" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="chart-payroll-sectors">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">February Payroll Losses by Sector (000s)</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...payrollSectorChange]} layout="vertical" margin={{ top: 8, right: 16, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="sector" type="category" tick={{ fontSize: 10 }} width={112} />
                    <Tooltip />
                    <Bar dataKey="change" fill="#dc2626" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="chart-vacancy-rates">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Job Vacancy Rate by Province, February 2026 (%)</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...vacancyProvinceData]} margin={{ top: 8, right: 16, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="province" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 4]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="rate" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="chart-arrears-sensitivity">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Mortgage Arrears Sensitivity (%)</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...arrearsLeadLagData]} margin={{ top: 8, right: 16, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="point" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 0.5]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="arrears" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="chart-mortgage-status">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Canadian Bank Mortgages, February 2026 (%)</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...mortgageStatusData]} margin={{ top: 8, right: 16, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="status" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="share">
                      {mortgageStatusData.map((d, i) => (
                        <Cell key={i} fill={d.status === "In arrears" ? "#dc2626" : "#16a34a"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Arrears sensitivity is an illustrative application of the CBA-cited Bank of Canada estimate: a 1 percentage point unemployment increase leads to an approximately 0.1 percentage point increase in mortgage arrears with about a one-year lag.
          </p>
        </section>

        <section className="mb-12" aria-labelledby="narrative">
          <h2 id="narrative" className="text-2xl font-bold mb-5">What This Means</h2>
          <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
            <h3>The two StatCan releases are complementary, not contradictory</h3>
            <p>
              The May 8 Labour Force Survey shows unemployment rising to 6.9% in April as more people searched for work. It also shows employment essentially flat, full-time work falling by 47,000, and employment down 112,000 over the first four months of 2026. The April 30 payroll release is older, covering February 2026, but it gives a harder employer-side signal: payroll employment fell 60,200 after a January gain, and job vacancies were only 497,200, down 29,000 from a year earlier.
            </p>
            <h3>Vacancies matter because they measure the exit ramp</h3>
            <p>
              A job loss becomes more dangerous for mortgage performance when replacement work is harder to find. The national vacancy rate was 2.8% in February, unchanged from January but down from 2.9% a year earlier and far below the 5.7% peak from March 2022. Ontario and Quebec also recorded the largest year-over-year vacancy declines, which matters because they carry large shares of Canadian mortgage debt.
            </p>
            <h3>Mortgage arrears are still low, but labour is the leading indicator</h3>
            <p>
              CBA reported that the national arrears rate for bank mortgages was 0.28% as of February 2026. That is still low: more than 99% of bank mortgage holders are not seriously delinquent. But arrears are a lagging household-stress measure. The key point from the CBA page is that missed mortgage payments have historically tracked labour-market conditions. In plain language, unemployment typically leads mortgage delinquencies and arrears because income shocks take time to turn into 90-day missed-payment data.
            </p>
            <h3>The housing read is risk segmentation</h3>
            <p>
              A softer labour market can help rates, but it also narrows the pool of confident, financeable buyers. That is why the same labour data can be bullish for variable-rate relief and bearish for credit quality. Strong borrowers may get better financing conditions; stretched borrowers and landlords with weaker tenants face higher renewal, vacancy and arrears risk.
            </p>
          </div>
        </section>

        <section className="mb-12" aria-labelledby="implications">
          <h2 id="implications" className="text-2xl font-bold mb-5">Real Estate Implications</h2>
          <Tabs defaultValue="investors" className="w-full">
            <TabsList className="w-full flex-wrap h-auto justify-start">
              {stakeholderImplications.map((section) => (
                <TabsTrigger key={section.key} value={section.key}>
                  {section.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {stakeholderImplications.map((section) => (
              <TabsContent key={section.key} value={section.key}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{section.headline}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {section.points.map((point) => (
                        <li key={point} className="flex gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </section>

        <section className="mb-12" aria-labelledby="next-actions">
          <h2 id="next-actions" className="text-2xl font-bold mb-5">Put This to Work</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <Link href="/" className="block">
              <Card className="h-full hover:border-primary/50 transition-colors">
                <CardContent className="p-5">
                  <Home className="h-6 w-6 text-primary mb-2" />
                  <h3 className="font-semibold text-sm mb-1">Stress-test a deal</h3>
                  <p className="text-xs text-muted-foreground">Add vacancy, bad-debt and rate-renewal cushions before bidding.</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/insights/statcan-labour-force-survey-april-2026" className="block">
              <Card className="h-full hover:border-primary/50 transition-colors">
                <CardContent className="p-5">
                  <Users className="h-6 w-6 text-primary mb-2" />
                  <h3 className="font-semibold text-sm mb-1">Read the LFS deep dive</h3>
                  <p className="text-xs text-muted-foreground">Provincial unemployment, wages, industries and local housing implications.</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/insights/mortgage-rates" className="block">
              <Card className="h-full hover:border-primary/50 transition-colors">
                <CardContent className="p-5">
                  <Landmark className="h-6 w-6 text-primary mb-2" />
                  <h3 className="font-semibold text-sm mb-1">Check mortgage rates</h3>
                  <p className="text-xs text-muted-foreground">Compare current fixed and variable options against renewal risk.</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>

        <footer className="border-t pt-6 text-xs text-muted-foreground">
          <p>
            Sources: <a href={LFS_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline">Statistics Canada Labour Force Survey, April 2026</a>;{" "}
            <a href={PAYROLL_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline">Statistics Canada payroll employment, earnings, hours and job vacancies, February 2026</a>;{" "}
            <a href={CBA_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline">Canadian Bankers Association mortgage arrears article</a>. Realist.ca commentary is for educational purposes only and is not financial, lending or investment advice.
          </p>
        </footer>
      </main>
    </div>
  );
}
