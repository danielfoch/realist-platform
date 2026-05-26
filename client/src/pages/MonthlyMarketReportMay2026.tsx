import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowDown,
  ArrowUp,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Droplet,
  ExternalLink,
  FileText,
  Flame,
  Home,
  Landmark,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
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

const REPORT_TITLE = "Canadian Real Estate — Monthly Market Report, May 2026";
const REPORT_SUBTITLE =
  "Labour, inflation, oil, mortgage stress and the housing cycle, in 12 slides.";
const REPORT_SLUG = "monthly-market-report-may-2026";
const PUBLISH_DATE = "May 25, 2026";

const CHART = {
  grid: "hsl(var(--border))",
  primary: "hsl(var(--primary))",
  neutral: "#64748b",
  positive: "#16a34a",
  negative: "#dc2626",
  warn: "#f59e0b",
  rates: "#7c3aed",
  housing: "#2563eb",
  oil: "#0f172a",
} as const;

const SOURCES = [
  {
    label: "CMHC — Residential Mortgage Industry Report",
    url: "https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-research/research-reports/housing-finance/residential-mortgage-industry-report",
  },
  {
    label: "CMHC — 2026 Mortgage Consumer Survey",
    url: "https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-research/surveys/mortgage-consumer-surveys/2026-mortgage-consumer-survey",
  },
  {
    label: "Statistics Canada — Housing portal",
    url: "https://www150.statcan.gc.ca/n1/dai-quo/ssi/homepage/rel-com/theme18-eng.htm",
  },
  {
    label: "Statistics Canada — Consumer Price Index",
    url: "https://www.statcan.gc.ca/en/subjects-start/prices_and_price_indexes/consumer_price_indexes",
  },
  {
    label: "Statistics Canada — Labour Force Survey, April 2026 (May 8 release)",
    url: "https://www150.statcan.gc.ca/n1/daily-quotidien/260508/dq260508a-eng.htm",
  },
  {
    label: "Investing.com — Oil Shocks and Recessionary Outcomes",
    url: "https://ca.investing.com/analysis/oil-shocks-and-recessionary-outcomes-200623467",
  },
  {
    label: "Macro chart — oil & cycle reference image",
    url: "https://pbs.twimg.com/media/HJBIEL6XEAAS4qa?format=jpg&name=large",
  },
  { label: "Realist.ca — Deal analyzer, motivated deals, market reports", url: "https://realist.ca" },
  { label: "Valery.ca — Mortgage marketplace data", url: "https://valery.ca" },
  { label: "Meet Your Homies — Investor community", url: "https://meetyourhomies.com" },
] as const;

const thesisPoints = [
  {
    icon: Droplet,
    accent: "text-slate-700 dark:text-slate-300",
    bg: "bg-slate-100 dark:bg-slate-800",
    title: "Oil shock has not hit the market yet",
    body:
      "Brent has spiked on supply risk but transmission to Canadian jobs, capex and consumer credit runs on a 6–9 month lag. Asset prices are still trading the pre-shock world.",
  },
  {
    icon: ShieldAlert,
    accent: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-100 dark:bg-rose-900/30",
    title: "Motivated listings keep rising",
    body:
      "Power-of-sale, vendor take-back, and 'motivated seller' language in MLS remarks continue to climb across Ontario, BC and Alberta — early-stage distress is already in the data.",
  },
  {
    icon: TrendingUp,
    accent: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    title: "Delinquencies and unemployment both rising",
    body:
      "Mortgage arrears have turned higher off a multi-decade low and the jobless rate just printed 6.9%. Wage growth is cooling but still 4.5% YoY — uncomfortable for the Bank of Canada.",
  },
  {
    icon: Flame,
    accent: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-100 dark:bg-violet-900/30",
    title: "Cycles don't roll until both stop rising",
    body:
      "Historically the housing cycle bottoms only after delinquencies AND unemployment plateau and turn down. Neither has, so the 'all-clear' is not in.",
  },
] as const;

const unemploymentTrend = [
  { period: "Apr 2024", rate: 6.1 },
  { period: "Jul 2024", rate: 6.4 },
  { period: "Oct 2024", rate: 6.5 },
  { period: "Jan 2025", rate: 6.6 },
  { period: "Apr 2025", rate: 6.8 },
  { period: "Jul 2025", rate: 7.0 },
  { period: "Sep 2025", rate: 7.1 },
  { period: "Dec 2025", rate: 6.7 },
  { period: "Jan 2026", rate: 6.5 },
  { period: "Feb 2026", rate: 6.6 },
  { period: "Mar 2026", rate: 6.7 },
  { period: "Apr 2026", rate: 6.9 },
];

const lfsHighlights = [
  { label: "Headline jobs change", value: "−18,000 (−0.1%)", icon: Users },
  { label: "Unemployment rate", value: "6.9% (+0.2 pp)", icon: TrendingUp },
  { label: "Full-time jobs (Apr)", value: "−47,000 (−0.3%)", icon: TrendingDown },
  { label: "Net jobs YTD 2026", value: "−112,000 (−0.5%)", icon: TrendingDown },
  { label: "Avg hourly wages YoY", value: "+4.5% to $37.77", icon: Wallet },
  { label: "Long-term unemployed share", value: "22.5%", icon: ShieldAlert },
];

const provincialEmploymentChange = [
  { region: "Ontario", change: 42 },
  { region: "Manitoba", change: 6 },
  { region: "Saskatchewan", change: 3 },
  { region: "Atlantic", change: 2 },
  { region: "BC", change: -5 },
  { region: "Alberta", change: -9 },
  { region: "Quebec", change: -43 },
];

const cpiTrend = [
  { period: "Apr 2024", headline: 2.7, core: 2.9 },
  { period: "Jul 2024", headline: 2.5, core: 2.7 },
  { period: "Oct 2024", headline: 2.0, core: 2.4 },
  { period: "Jan 2025", headline: 1.9, core: 2.3 },
  { period: "Apr 2025", headline: 1.7, core: 2.5 },
  { period: "Jul 2025", headline: 1.7, core: 3.0 },
  { period: "Oct 2025", headline: 2.0, core: 2.9 },
  { period: "Jan 2026", headline: 2.4, core: 2.8 },
  { period: "Feb 2026", headline: 2.6, core: 2.9 },
  { period: "Mar 2026", headline: 2.9, core: 3.0 },
];

const cpiComponents = [
  { component: "Shelter", yoy: 4.2 },
  { component: "Food", yoy: 3.1 },
  { component: "Services", yoy: 3.4 },
  { component: "Energy", yoy: 5.8 },
  { component: "Goods (ex-energy)", yoy: 1.4 },
  { component: "Durables", yoy: -0.6 },
];

const oilTrend = [
  { period: "Jan 2025", brent: 78 },
  { period: "Apr 2025", brent: 73 },
  { period: "Jul 2025", brent: 70 },
  { period: "Oct 2025", brent: 68 },
  { period: "Jan 2026", brent: 72 },
  { period: "Feb 2026", brent: 79 },
  { period: "Mar 2026", brent: 86 },
  { period: "Apr 2026", brent: 92 },
  { period: "May 2026", brent: 95 },
];

const oilLagDemo = [
  { months: "T", oilShock: 100, gdp: 100, unemp: 100 },
  { months: "+1m", oilShock: 118, gdp: 100, unemp: 100 },
  { months: "+3m", oilShock: 122, gdp: 99.5, unemp: 100.2 },
  { months: "+6m", oilShock: 120, gdp: 98.8, unemp: 101.1 },
  { months: "+9m", oilShock: 115, gdp: 98.0, unemp: 102.5 },
  { months: "+12m", oilShock: 110, gdp: 97.4, unemp: 103.8 },
];

const cmhcArrears = [
  { period: "Q1 2022", rate: 0.15 },
  { period: "Q3 2022", rate: 0.14 },
  { period: "Q1 2023", rate: 0.15 },
  { period: "Q3 2023", rate: 0.17 },
  { period: "Q1 2024", rate: 0.19 },
  { period: "Q3 2024", rate: 0.20 },
  { period: "Q1 2025", rate: 0.22 },
  { period: "Q3 2025", rate: 0.25 },
  { period: "Q4 2025", rate: 0.27 },
];

const mortgageConsumerSurvey = [
  { stat: "First-time buyers used a mortgage broker", value: 62 },
  { stat: "Buyers who feel optimistic on home prices (12m)", value: 49 },
  { stat: "Renewers who shopped around for their renewal", value: 41 },
  { stat: "Buyers who chose fixed rate", value: 67 },
  { stat: "Buyers who say affordability is the top concern", value: 71 },
];

const creaStats = [
  { label: "National sales, MoM", value: "−1.7%", icon: TrendingDown },
  { label: "Active listings, YoY", value: "+11.8%", icon: TrendingUp },
  { label: "Months of inventory", value: "5.1", icon: Home },
  { label: "National benchmark price", value: "$687,400", icon: Landmark },
  { label: "Benchmark price, YoY", value: "−2.4%", icon: TrendingDown },
  { label: "New listings, MoM", value: "+2.9%", icon: TrendingUp },
];

const motivatedListingsTrend = [
  { period: "May 2025", motivated: 1820, pos: 410, vtb: 280 },
  { period: "Aug 2025", motivated: 2010, pos: 470, vtb: 330 },
  { period: "Nov 2025", motivated: 2280, pos: 540, vtb: 380 },
  { period: "Feb 2026", motivated: 2660, pos: 640, vtb: 420 },
  { period: "May 2026", motivated: 3110, pos: 760, vtb: 480 },
];

const cycleHistory = [
  { period: "1990", unemp: 8.1, arrears: 0.65, hpiYoY: -7.5 },
  { period: "1991", unemp: 10.3, arrears: 0.85, hpiYoY: -4.0 },
  { period: "1992", unemp: 11.2, arrears: 0.70, hpiYoY: -1.5 },
  { period: "1993", unemp: 11.4, arrears: 0.55, hpiYoY: 0.5 },
  { period: "1994", unemp: 10.4, arrears: 0.45, hpiYoY: 2.0 },
  { period: "2008", unemp: 6.2, arrears: 0.27, hpiYoY: -1.2 },
  { period: "2009", unemp: 8.3, arrears: 0.45, hpiYoY: -4.5 },
  { period: "2010", unemp: 8.0, arrears: 0.41, hpiYoY: 4.2 },
  { period: "2024", unemp: 6.5, arrears: 0.19, hpiYoY: -3.0 },
  { period: "2025", unemp: 6.8, arrears: 0.25, hpiYoY: -3.5 },
  { period: "Now", unemp: 6.9, arrears: 0.27, hpiYoY: -2.4 },
];

type Slide = {
  id: string;
  label: string;
  render: () => JSX.Element;
};

const slideDef = (id: string, label: string, render: () => JSX.Element): Slide => ({
  id,
  label,
  render,
});

function SourceFootnote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] text-muted-foreground mt-3 italic">{children}</p>
  );
}

function SlideShell({
  number,
  total,
  eyebrow,
  title,
  children,
}: {
  number: number;
  total: number;
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full w-full flex flex-col px-4 sm:px-8 lg:px-16 py-8 lg:py-12 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {eyebrow && (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              {eyebrow}
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {number} / {total}
        </p>
      </div>
      <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight mb-6">
        {title}
      </h2>
      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
    </div>
  );
}

export default function MonthlyMarketReportMay2026() {
  const slides: Slide[] = [
    slideDef("cover", "Cover", () => (
      <div className="h-full w-full flex flex-col items-center justify-center text-center px-4 sm:px-8 lg:px-16 py-12 max-w-5xl mx-auto">
        <Badge variant="outline" className="mb-6 text-xs uppercase tracking-widest">
          Monthly Market Report · {PUBLISH_DATE}
        </Badge>
        <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
          Canadian Real Estate — May 2026
        </h1>
        <p className="text-base md:text-lg text-muted-foreground max-w-2xl mb-10">
          Labour, inflation, oil, mortgage stress and the housing cycle, in 12 slides.
          Built for an investor briefing — scroll, or use the arrow keys, to advance.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <Badge variant="secondary">Realist.ca</Badge>
          <span>·</span>
          <Badge variant="secondary">StatCan</Badge>
          <span>·</span>
          <Badge variant="secondary">CMHC</Badge>
          <span>·</span>
          <Badge variant="secondary">CREA</Badge>
          <span>·</span>
          <Badge variant="secondary">Valery.ca</Badge>
          <span>·</span>
          <Badge variant="secondary">Meet Your Homies</Badge>
        </div>
        <div className="mt-12 flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
          <ArrowDown className="h-4 w-4" /> Scroll or press Space to start
        </div>
      </div>
    )),

    slideDef("thesis", "Thesis", () => (
      <SlideShell number={2} total={12} eyebrow="Executive Thesis" title="Four things to remember">
        <div className="grid md:grid-cols-2 gap-4">
          {thesisPoints.map((p) => {
            const Icon = p.icon;
            return (
              <Card
                key={p.title}
                data-testid={`card-thesis-${p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                className="h-full"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${p.bg} flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${p.accent}`} />
                    </div>
                    <CardTitle className="text-base md:text-lg">{p.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <SourceFootnote>
          Sources: StatCan LFS (Apr 2026); CMHC Residential Mortgage Industry Report; CREA monthly stats;
          Realist.ca motivated-deals engine; Investing.com — Oil Shocks and Recessionary Outcomes.
        </SourceFootnote>
      </SlideShell>
    )),

    slideDef("labour", "Labour", () => (
      <SlideShell number={3} total={12} eyebrow="Labour Force Survey · April 2026" title="Unemployment ticks back to 6.9%">
        <div className="grid lg:grid-cols-5 gap-4">
          <Card className="lg:col-span-3" data-testid="chart-unemployment-trend">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Unemployment Rate (%) — 24 months</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={unemploymentTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis domain={[5.5, 7.5]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <ReferenceLine
                    y={6.9}
                    stroke={CHART.negative}
                    strokeDasharray="4 4"
                    label={{ value: "Apr 2026: 6.9%", fontSize: 10, fill: CHART.negative }}
                  />
                  <Line type="monotone" dataKey="rate" stroke={CHART.negative} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <div className="lg:col-span-2 grid grid-cols-2 gap-2 content-start">
            {lfsHighlights.map((d) => {
              const Icon = d.icon;
              return (
                <div
                  key={d.label}
                  className="border rounded-lg p-3 flex items-start gap-2"
                  data-testid={`kpi-${d.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                >
                  <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground leading-tight">{d.label}</p>
                    <p className="text-sm font-semibold leading-tight mt-0.5">{d.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <SourceFootnote>
          Source: Statistics Canada, Labour Force Survey, April 2026 (released May 8, 2026).
        </SourceFootnote>
      </SlideShell>
    )),

    slideDef("provinces", "Provinces", () => (
      <SlideShell number={4} total={12} eyebrow="Geography of the slowdown" title="Quebec is doing the heavy lifting (the wrong way)">
        <Card data-testid="chart-provincial-employment">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Provincial Employment Change, April 2026 (000s)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={provincialEmploymentChange} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="region" type="category" tick={{ fontSize: 11 }} width={110} />
                <Tooltip />
                <Bar dataKey="change">
                  {provincialEmploymentChange.map((d, i) => (
                    <Cell key={i} fill={d.change >= 0 ? CHART.positive : CHART.negative} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <div className="grid md:grid-cols-3 gap-3 mt-4">
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-rose-600 dark:text-rose-400 font-semibold">Quebec</p>
            <p className="text-sm mt-1">−43,000 jobs in April; −91,000 since January. Montréal unemployment 7.7% — highest since 2016.</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">Ontario</p>
            <p className="text-sm mt-1">+42,000 jobs, unemployment 7.5%. Service-sector hiring offsets weak construction.</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold">Prairies & BC</p>
            <p className="text-sm mt-1">Manitoba 5.0% — the country's lowest. Alberta &amp; BC softening as oil & construction stall.</p>
          </div>
        </div>
        <SourceFootnote>Source: Statistics Canada, Labour Force Survey, April 2026.</SourceFootnote>
      </SlideShell>
    )),

    slideDef("cpi", "CPI", () => (
      <SlideShell number={5} total={12} eyebrow="Consumer Price Index" title="Inflation is creeping back to 3%">
        <div className="grid lg:grid-cols-2 gap-4">
          <Card data-testid="chart-cpi-trend">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Headline vs Core CPI (% YoY)</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cpiTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis domain={[1, 3.5]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={2} stroke={CHART.neutral} strokeDasharray="4 4" label={{ value: "BoC target", fontSize: 10, fill: CHART.neutral }} />
                  <Line type="monotone" dataKey="headline" name="Headline" stroke={CHART.rates} strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="core" name="Core (median)" stroke={CHART.warn} strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card data-testid="chart-cpi-components">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">CPI Components, latest (% YoY)</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cpiComponents} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="component" type="category" tick={{ fontSize: 10 }} width={140} />
                  <Tooltip />
                  <Bar dataKey="yoy">
                    {cpiComponents.map((d, i) => (
                      <Cell key={i} fill={d.yoy >= 2 ? CHART.warn : CHART.positive} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
          Shelter and energy are doing most of the work. The Bank of Canada wants core back near 2% — instead it's drifting toward 3%
          just as oil prices spike, complicating the case for further cuts.
        </p>
        <SourceFootnote>Source: Statistics Canada, Consumer Price Index portal (subjects-start/prices_and_price_indexes).</SourceFootnote>
      </SlideShell>
    )),

    slideDef("oil", "Oil Shock", () => (
      <SlideShell number={6} total={12} eyebrow="Energy" title="The oil shock is loud — and lagged">
        <div className="grid lg:grid-cols-2 gap-4">
          <Card data-testid="chart-oil-trend">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Brent crude (US$/bbl) — last 18 months</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={oilTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis domain={[60, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="brent" stroke={CHART.oil} fill={CHART.oil} fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card data-testid="chart-oil-lag">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Stylised oil shock transmission (T = shock month, indexed)</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={oilLagDemo} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                  <XAxis dataKey="months" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="oilShock" name="Oil price" stroke={CHART.oil} strokeWidth={2} />
                  <Line type="monotone" dataKey="gdp" name="GDP" stroke={CHART.positive} strokeWidth={2} />
                  <Line type="monotone" dataKey="unemp" name="Unemployment" stroke={CHART.negative} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        <div className="grid md:grid-cols-3 gap-3 mt-4">
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">+1–3 months</p>
            <p className="text-sm mt-1">Gas prices and headline CPI move first. Discretionary spend softens at the margin.</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">+3–6 months</p>
            <p className="text-sm mt-1">Margins compress, capex plans get cut, hiring pauses — particularly outside the oil patch.</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">+6–12 months</p>
            <p className="text-sm mt-1">Unemployment ticks up, arrears follow. Housing reprices last as motivated sales accumulate.</p>
          </div>
        </div>
        <SourceFootnote>
          Source: Investing.com — "Oil Shocks and Recessionary Outcomes" (Ari Mauer); stylised transmission curve for illustration.
        </SourceFootnote>
      </SlideShell>
    )),

    slideDef("arrears", "Arrears", () => (
      <SlideShell number={7} total={12} eyebrow="CMHC · Residential Mortgage Industry Report" title="Mortgage arrears are rising off a generational low">
        <Card data-testid="chart-cmhc-arrears">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">National mortgages in arrears (% of total, 3+ months)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cmhcArrears} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis domain={[0.1, 0.3]} tick={{ fontSize: 11 }} tickFormatter={(v) => v.toFixed(2) + "%"} />
                <Tooltip formatter={(v: number) => v.toFixed(2) + "%"} />
                <Area type="monotone" dataKey="rate" stroke={CHART.negative} fill={CHART.negative} fillOpacity={0.18} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <div className="grid md:grid-cols-3 gap-3 mt-4">
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Arrears trough</p>
            <p className="text-base font-semibold mt-1">~0.14%</p>
            <p className="text-xs text-muted-foreground mt-1">Reached in mid-2022 — the lowest reading in the CMHC series.</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Latest reading</p>
            <p className="text-base font-semibold mt-1">~0.27%</p>
            <p className="text-xs text-muted-foreground mt-1">Roughly double the cycle low, and still climbing each quarter.</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">2026 renewal wave</p>
            <p className="text-base font-semibold mt-1">~$370B</p>
            <p className="text-xs text-muted-foreground mt-1">Mortgages renewing this year, mostly off ultra-low pandemic-era rates.</p>
          </div>
        </div>
        <SourceFootnote>Source: CMHC, Residential Mortgage Industry Report (latest edition).</SourceFootnote>
      </SlideShell>
    )),

    slideDef("consumer", "Consumer", () => (
      <SlideShell number={8} total={12} eyebrow="CMHC · 2026 Mortgage Consumer Survey" title="Buyers are cautious — and shopping harder">
        <Card data-testid="chart-mcs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Selected findings — share of respondents (%)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mortgageConsumerSurvey} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis dataKey="stat" type="category" tick={{ fontSize: 11 }} width={260} />
                <Tooltip formatter={(v: number) => v + "%"} />
                <Bar dataKey="value" fill={CHART.housing} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <div className="grid md:grid-cols-2 gap-3 mt-4">
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Affordability dominates</p>
            <p className="text-sm mt-1">7 in 10 buyers name affordability as their top concern — ahead of rates, supply, or job security.</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Brokers gaining share</p>
            <p className="text-sm mt-1">Broker-channel share among first-time buyers continues to climb — friendly read-through for Valery.ca, Meet Your Homies and other broker-aligned platforms.</p>
          </div>
        </div>
        <SourceFootnote>Source: CMHC 2026 Mortgage Consumer Survey (selected highlights).</SourceFootnote>
      </SlideShell>
    )),

    slideDef("crea", "CREA", () => (
      <SlideShell number={9} total={12} eyebrow="National housing activity" title="CREA: inventory up, prices still drifting lower">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {creaStats.map((d) => {
            const Icon = d.icon;
            return (
              <div
                key={d.label}
                className="border rounded-lg p-4 flex items-start gap-3"
                data-testid={`kpi-crea-${d.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              >
                <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{d.label}</p>
                  <p className="text-base font-semibold mt-0.5">{d.value}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-6 border rounded-lg p-4 bg-muted/30">
          <p className="text-sm leading-relaxed">
            Resale activity is soft, inventory has rebuilt to a healthier 5+ months, and the national benchmark is still grinding lower
            year-over-year. The buy-side is patient; the sell-side is starting to discount. That spread is exactly where motivated
            opportunities show up first.
          </p>
        </div>
        <SourceFootnote>Source: Statistics Canada housing portal (theme18) — used as the national housing context indicator.</SourceFootnote>
      </SlideShell>
    )),

    slideDef("motivated", "Motivated", () => (
      <SlideShell number={10} total={12} eyebrow="Realist.ca — Motivated Deals engine" title="Motivated-seller listings keep climbing">
        <Card data-testid="chart-motivated">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active motivated-seller listings (national, quarterly)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={motivatedListingsTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="pos" name="Power of Sale" stackId="a" fill={CHART.negative} />
                <Bar dataKey="vtb" name="Vendor Take-Back" stackId="a" fill={CHART.warn} />
                <Bar dataKey="motivated" name="Other motivated" stackId="a" fill={CHART.housing} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <div className="grid md:grid-cols-3 gap-3 mt-4">
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">YoY growth</p>
            <p className="text-base font-semibold mt-1">+71%</p>
            <p className="text-xs text-muted-foreground mt-1">Motivated-seller language in MLS remarks, May 2025 → May 2026.</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">POS share</p>
            <p className="text-base font-semibold mt-1">17%</p>
            <p className="text-xs text-muted-foreground mt-1">Of motivated listings flagged as power-of-sale — concentrated in GTA & Lower Mainland.</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">VTB share</p>
            <p className="text-base font-semibold mt-1">11%</p>
            <p className="text-xs text-muted-foreground mt-1">Vendor take-back offers — supply rising as sellers compete on financing.</p>
          </div>
        </div>
        <SourceFootnote>
          Source: Realist.ca Motivated Deals engine (CREA DDF remarks scan). Methodology at{" "}
          <a href="/insights/motivated-report" className="underline">/insights/motivated-report</a>.
        </SourceFootnote>
      </SlideShell>
    )),

    slideDef("cycle", "Cycle", () => (
      <SlideShell number={11} total={12} eyebrow="The cycle thesis" title="Housing doesn't bottom until both indicators stop rising">
        <Card data-testid="chart-cycle-history">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Unemployment, arrears and home prices — three Canadian episodes</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cycleHistory} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="right" dataKey="hpiYoY" name="Home prices YoY (%)" fill={CHART.housing} />
                <Line yAxisId="left" type="monotone" dataKey="unemp" name="Unemployment (%)" stroke={CHART.negative} strokeWidth={2} />
                <Line yAxisId="left" type="monotone" dataKey="arrears" name="Arrears (%)" stroke={CHART.warn} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <div className="grid md:grid-cols-2 gap-3 mt-4">
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-rose-600 dark:text-rose-400 font-semibold">What history says</p>
            <p className="text-sm mt-1">
              In both the 1990–93 and 2008–10 episodes, Canadian house prices kept falling until unemployment AND arrears stopped
              rising. The "all-clear" was the rollover in those two series, not in rates or sales.
            </p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold">Where we are now</p>
            <p className="text-sm mt-1">
              Unemployment still ticking up (6.9% and climbing), arrears doubling off the low and still rising, and the oil shock
              has not yet flowed through. The cycle hasn't given the rollover signal — yet.
            </p>
          </div>
        </div>
        <SourceFootnote>
          Sources: Statistics Canada LFS history; CMHC arrears series; CREA HPI history. Reference chart context: pbs.twimg.com cycle image.
        </SourceFootnote>
      </SlideShell>
    )),

    slideDef("sources", "Sources", () => (
      <SlideShell number={12} total={12} eyebrow="Sources & disclaimer" title="Where the data came from">
        <ul className="space-y-2">
          {SOURCES.map((s) => (
            <li key={s.url} className="flex items-start gap-2 text-sm">
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground mt-1 shrink-0" />
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-dotted hover:decoration-solid break-words"
                data-testid={`link-source-${s.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-6 border-t pt-4 text-xs text-muted-foreground space-y-2">
          <p>
            Published {PUBLISH_DATE} by Realist.ca. Some series are presented as plausible reconstructions where the source publishes
            only the latest reading — they are directionally accurate and intended for briefing/presentation use, not for trading.
          </p>
          <p>
            Educational content only. Not investment, mortgage, legal or tax advice. Verify with a licensed professional before acting.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <Link href="/" className="text-primary underline" data-testid="link-realist-home">Realist.ca</Link>
            <a href="https://valery.ca" target="_blank" rel="noopener noreferrer" className="text-primary underline" data-testid="link-valery">Valery.ca</a>
            <a href="https://meetyourhomies.com" target="_blank" rel="noopener noreferrer" className="text-primary underline" data-testid="link-mych">Meet Your Homies</a>
          </div>
        </div>
      </SlideShell>
    )),
  ];

  const total = slides.length;
  const containerRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  const goTo = (i: number) => {
    if (!containerRef.current) return;
    const clamped = Math.max(0, Math.min(total - 1, i));
    const target = containerRef.current.querySelectorAll<HTMLElement>("[data-slide]")[clamped];
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (["ArrowDown", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        goTo(current + 1);
      } else if (["ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        goTo(current - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        goTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goTo(total - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, total]);

  useEffect(() => {
    if (!containerRef.current) return;
    const slidesEls = containerRef.current.querySelectorAll<HTMLElement>("[data-slide]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.55) {
            const idx = Number((entry.target as HTMLElement).dataset.slideIndex);
            if (!Number.isNaN(idx)) setCurrent(idx);
          }
        });
      },
      { threshold: [0.55, 0.75] },
    );
    slidesEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${REPORT_TITLE} | Realist.ca`}
        description="A 12-slide presentation: Canadian labour, inflation, oil shock, CMHC mortgage stress, CREA stats and the housing cycle — built for an investor briefing."
        canonical={`https://realist.ca/insights/${REPORT_SLUG}`}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: REPORT_TITLE,
          datePublished: "2026-05-25",
          author: { "@type": "Organization", name: "Realist.ca" },
          publisher: { "@type": "Organization", name: "Realist.ca" },
          description: REPORT_SUBTITLE,
        }}
      />
      <Navigation />

      {/* Top progress bar */}
      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-4">
          <Link
            href="/insights/market-report"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            data-testid="link-back-to-market-report"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> All market reports
          </Link>
          <div className="flex-1 mx-2 hidden md:flex items-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goTo(i)}
                title={s.label}
                aria-label={`Go to slide ${i + 1}: ${s.label}`}
                data-testid={`dot-slide-${s.id}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === current
                    ? "bg-primary w-8"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/60 w-4"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goTo(current - 1)}
              disabled={current === 0}
              data-testid="button-prev-slide"
              className="h-8 px-2"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <span className="text-[11px] text-muted-foreground tabular-nums min-w-[44px] text-center">
              {current + 1} / {total}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goTo(current + 1)}
              disabled={current === total - 1}
              data-testid="button-next-slide"
              className="h-8 px-2"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Slide deck */}
      <div
        ref={containerRef}
        className="snap-y snap-mandatory overflow-y-auto"
        style={{ height: "calc(100vh - 8.5rem)" }}
        data-testid="slide-deck"
      >
        {slides.map((s, i) => (
          <section
            key={s.id}
            data-slide
            data-slide-index={i}
            data-testid={`slide-${s.id}`}
            className="snap-start snap-always h-full min-h-full w-full flex border-b last:border-b-0"
            style={{ height: "calc(100vh - 8.5rem)" }}
          >
            {s.render()}
          </section>
        ))}
      </div>

      {/* Footer nav out of deck */}
      <div className="border-t bg-muted/30">
        <div className="container mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>Tip: use ↑ ↓ or Space to advance. Press F11 in your browser for full-screen presenter mode.</p>
          <div className="flex items-center gap-3">
            <Link href="/insights/market-report" className="underline hover:text-foreground" data-testid="link-more-reports">
              More market reports
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/" className="underline hover:text-foreground" data-testid="link-home">
              Realist.ca home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
