import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Flame,
  Gauge,
  Home,
  Landmark,
  Percent,
  Share2,
  TrendingDown,
  TrendingUp,
  Users,
  AlertTriangle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const SOURCE_PDF_URL =
  "https://www.bankofcanada.ca/wp-content/uploads/2026/04/mpr-2026-04-29.pdf";
const SOURCE_TITLE = "Bank of Canada Monetary Policy Report, April 2026";
const RELEASE_LABEL = "Bank of Canada · April 29, 2026";
const REPORT_SLUG = "bank-of-canada-april-2026";

const heroSummary =
  "The Bank of Canada's April 2026 report shows a Canadian economy growing slowly, a housing market still under pressure, and renewed inflation risk caused by higher oil prices from the war in the Middle East. The result is a complicated rate environment: economic weakness supports future easing, but sticky inflation could limit how quickly rates fall.";

const keyTakeaways = [
  {
    icon: Flame,
    accent: "text-rose-500",
    bg: "bg-rose-100 dark:bg-rose-900/30",
    title: "Inflation Risk Is Back",
    bullets: [
      "CPI inflation rose to 2.4% in March 2026.",
      "The Bank of Canada expects inflation to peak around 3% in April.",
      "Base case: inflation returns to 2% in early 2027 — if oil prices decline.",
    ],
  },
  {
    icon: TrendingUp,
    accent: "text-amber-500",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    title: "Growth Is Modest",
    bullets: [
      "GDP growth forecast: 1.2% in 2026, 1.6% in 2027, 1.7% in 2028.",
      "Growth supported by consumption and government spending.",
      "Exports and business investment remain weak from US tariffs and trade uncertainty.",
    ],
  },
  {
    icon: Home,
    accent: "text-blue-500",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    title: "Housing Remains Subdued",
    bullets: [
      "Residential investment expected to stay subdued.",
      "Demand limited by affordability, slower population growth, and weak investor interest.",
      "Small-condo inventory overhang in major centres restraining new construction.",
    ],
  },
  {
    icon: Gauge,
    accent: "text-violet-500",
    bg: "bg-violet-100 dark:bg-violet-900/30",
    title: "Rate-Cut Story Is Complicated",
    bullets: [
      "Weak economy supports lower-rate expectations.",
      "Higher oil-driven inflation makes the Bank more cautious.",
      "If oil stays high, inflation could sit near 3% for over a year in the illustrative scenario.",
    ],
  },
] as const;

const dataHighlights = [
  { label: "CPI inflation, Mar 2026", value: "2.4%", icon: Percent },
  { label: "Expected CPI peak, Apr 2026", value: "≈3.0%", icon: TrendingUp },
  { label: "Base-case return to 2% target", value: "Early 2027", icon: Check },
  { label: "GDP growth, 2026", value: "1.2%", icon: TrendingUp },
  { label: "GDP growth, 2027", value: "1.6%", icon: TrendingUp },
  { label: "GDP growth, 2028", value: "1.7%", icon: TrendingUp },
  { label: "Unemployment range, prior 12 mo", value: "6.5–7.0%", icon: Users },
  { label: "Output gap, Q1 2026", value: "−1.5% to −0.5%", icon: TrendingDown },
  { label: "Brent oil base case (Q2 2026)", value: "US$90 → US$75 (mid-2027)", icon: Flame },
  { label: "Persistent-oil scenario", value: "US$100 / barrel", icon: AlertTriangle },
  { label: "Persistent-oil inflation peak", value: "3.1% in Q1 2027", icon: AlertTriangle },
  { label: "Canadian nominal neutral rate", value: "2.25–3.25%", icon: Landmark },
  { label: "US tariff rate on Canadian goods", value: "5.1%", icon: AlertTriangle },
  { label: "Canadian tariff rate on US goods", value: "1.5%", icon: AlertTriangle },
] as const;

const gdpForecastData = [
  { year: "2026", growth: 1.2 },
  { year: "2027", growth: 1.6 },
  { year: "2028", growth: 1.7 },
];

// Anchor points stated directly in the BoC April 2026 MPR.
// Lines between points are visual interpolation only.
const cpiPathData = [
  { period: "Feb 2026", cpi: 1.8 },
  { period: "Mar 2026", cpi: 2.4 },
  { period: "Apr 2026 (forecast peak)", cpi: 3.0 },
  { period: "Mid 2027 (target)", cpi: 2.0 },
];

// Brent base-case anchors stated in the report; persistent-high scenario held at US$100.
const oilScenarioData = [
  { period: "Q2 2026", baseCase: 90, persistent: 100 },
  { period: "Mid 2027", baseCase: 75, persistent: 100 },
];

const tariffComparisonData = [
  { side: "US tariffs on Canadian goods", rate: 5.1, fill: "hsl(0, 70%, 55%)" },
  { side: "Canadian tariffs on US goods", rate: 1.5, fill: "hsl(220, 70%, 50%)" },
];

const sourceChartReferences = [
  { id: 1,  title: "GDP Growth and Inventory Drawdown",         page: 5,  desc: "Sharp inventory drawdown that lowered GDP in Q4 2025 and the estimated rebound in Q1 2026." },
  { id: 3,  title: "Labour Market Slack",                        page: 7,  desc: "Labour market indicators point to some slack." },
  { id: 5,  title: "CPI Inflation Near 2%, Then Rising",         page: 9,  desc: "CPI sat close to 2% for over a year before gasoline pushed inflation higher." },
  { id: 8,  title: "Business Inflation Expectations",            page: 13, desc: "Short-term business inflation expectations rose after the war in the Middle East." },
  { id: 9,  title: "Oil Prices Have Surged",                     page: 14, desc: "Brent, WTI, and Western Canadian Select oil-price assumptions." },
  { id: 14, title: "US Tariffs",                                 page: 20, desc: "US tariffs decreased from their 2025 peak but remain a major risk." },
  { id: 15, title: "GDP Growth Projection",                      page: 24, desc: "GDP growth projected to outpace potential output and gradually absorb excess supply." },
  { id: 17, title: "Consumption Growth",                         page: 27, desc: "Consumption growth averaging just above 1% over the projection horizon." },
  { id: 19, title: "CPI Inflation Contributions",                page: 29, desc: "CPI inflation peaks in Q2 2026 then begins to decline." },
  { id: 20, title: "Oil Cost Pressures Into 2027",               page: 30, desc: "Oil prices create upward cost pressures into 2027." },
  { id: 25, title: "Higher-Oil Scenario",                        page: 47, desc: "Inflation stays close to 3% for over a year in a persistently high oil-price scenario." },
  { id: 26, title: "Trade Restrictions by Sector",               page: 48, desc: "Steel exports have declined more than other tariff-affected sectors." },
] as const;

const realEstateImplications = {
  buyers: [
    "Don't rely on future rate cuts — the path is uncertain.",
    "Stress-test affordability using current payments, not hoped-for ones.",
    "Watch inflation prints and bond yields, not just Bank of Canada announcements.",
    "Use this softer market to negotiate price, conditions, and seller credits.",
  ],
  sellers: [
    "Pricing discipline matters — overpriced listings will sit.",
    "Weak affordability means buyers are stretched; price for the market that exists.",
    "Rate relief may not arrive quickly enough to rescue sloppy pricing.",
    "Presentation, staging, and condition matter more in a slow market.",
  ],
  investors: [
    "Weak investor interest and condo inventory overhang are major warnings.",
    "The deal must work on cash flow, financing costs, and holding power — not appreciation.",
    "Don't assume population growth will absorb supply at current levels.",
    "Underwrite for higher-for-longer rates as a base case, not a worst case.",
    "Exit liquidity is uncertain — model 6-12 month sale timelines.",
  ],
  renewers: [
    "Rate timing is the single biggest risk in the renewal decision.",
    "Inflation cooling would help — but persistent oil could keep rates higher for longer.",
    "Compare fixed-rate certainty against variable-rate optionality given your cash-flow tolerance.",
    "Consider shorter terms (1–3 years) if you believe the easing cycle is delayed but real.",
    "Talk to a broker before your renewal letter arrives — banks rarely lead with their best rate.",
  ],
  realtors: [
    "Frame the market as a tension between weak demand and renewed inflation risk.",
    "Help clients understand that housing softness does not automatically mean fast rate cuts.",
    "Educate sellers on pricing-to-the-market vs anchoring to peak comps.",
    "Use this report and similar macro context to win listings — sellers want a guide, not a cheerleader.",
    "Stay current on the Bank's communications between MPRs — narrative shifts move buyer behaviour.",
  ],
} as const;

interface ReportProps {
  embed?: boolean;
}

function buildEmbedSnippet(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `<iframe src="${origin}/embed/insights/${REPORT_SLUG}" width="100%" height="900" style="border:0;border-radius:16px;" loading="lazy"></iframe>`;
}

function HeroKpiStat({
  label,
  value,
  icon: Icon,
  testId,
}: {
  label: string;
  value: string;
  icon: typeof Percent;
  testId?: string;
}) {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4" data-testid={testId ?? `kpi-${slug}`}>
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div className="text-lg font-semibold" data-testid={`kpi-value-${slug}`}>{value}</div>
    </div>
  );
}

function CopyEmbedButton() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildEmbedSnippet());
      setCopied(true);
      toast({ title: "Embed code copied", description: "Paste into any HTML page to embed this report." });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ title: "Copy failed", description: "Please copy the snippet manually.", variant: "destructive" });
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} data-testid="button-copy-embed">
      {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
      {copied ? "Copied" : "Copy Embed Code"}
    </Button>
  );
}

function ShareReportButton() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: SOURCE_TITLE, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Link copied", description: "Share this report with your network." });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ title: "Couldn't share", description: "Copy the URL from your browser bar.", variant: "destructive" });
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={handleShare} data-testid="button-share-report">
      {copied ? <Check className="mr-2 h-4 w-4" /> : <Share2 className="mr-2 h-4 w-4" />}
      {copied ? "Copied" : "Share Report"}
    </Button>
  );
}

function SourceLine({ chartId, page }: { chartId?: number; page?: number }) {
  return (
    <p className="mt-3 text-xs text-muted-foreground">
      Source: {SOURCE_TITLE}
      {chartId !== undefined ? `, Chart ${chartId}` : ""}
      {page !== undefined ? `, p. ${page}` : ""}.
    </p>
  );
}

export default function BankOfCanadaApril2026Report({ embed = false }: ReportProps) {
  const seo = (
    <SEO
      title="Bank of Canada April 2026 Report: Inflation Risk Is Back, Housing Stays Weak"
      description="The Bank of Canada's April 2026 Monetary Policy Report — what it means for Canadian real estate, mortgage rates, buyers, sellers, investors, and renewals."
      canonicalUrl={`/insights/${REPORT_SLUG}`}
      keywords="Bank of Canada, MPR April 2026, Canadian real estate, mortgage rates, inflation, GDP, oil prices, tariffs, CUSMA"
      noIndex={embed}
    />
  );

  const hero = (
    <section className={embed ? "mb-8" : "mb-10"} data-testid="section-hero">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="text-xs">{RELEASE_LABEL}</Badge>
        <Badge variant="outline" className="text-xs">Monetary Policy</Badge>
        <Badge variant="outline" className="text-xs">Housing</Badge>
        <Badge variant="outline" className="text-xs">Canadian Economy</Badge>
      </div>
      <h1
        className={
          embed
            ? "text-2xl md:text-3xl font-bold leading-tight mb-3"
            : "text-3xl md:text-4xl font-bold leading-tight mb-3"
        }
        data-testid="text-report-title"
      >
        Bank of Canada April 2026 Report: Inflation Risk Is Back, But Housing Remains Weak
      </h1>
      <p className="text-base md:text-lg text-muted-foreground mb-2" data-testid="text-report-subtitle">
        What the latest Monetary Policy Report means for Canadian real estate, mortgage rates,
        buyers, sellers, investors, and renewals.
      </p>
      <p className="text-xs text-muted-foreground mb-5">Source: {SOURCE_TITLE}</p>
      <div className="flex flex-wrap gap-2">
        <a href={SOURCE_PDF_URL} target="_blank" rel="noopener noreferrer">
          <Button size="sm" data-testid="button-view-pdf">
            <FileText className="mr-2 h-4 w-4" />
            View Full PDF
            <ExternalLink className="ml-2 h-3.5 w-3.5" />
          </Button>
        </a>
        {!embed && <ShareReportButton />}
        {!embed && <CopyEmbedButton />}
        {embed && (
          <Link href={`/insights/${REPORT_SLUG}`}>
            <Button variant="outline" size="sm" data-testid="button-open-full">
              Open Full Report
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>
    </section>
  );

  const executiveSummary = (
    <Card className="mb-10 border-border/60 bg-muted/30" data-testid="section-exec-summary">
      <CardContent className="p-5 md:p-6">
        <p className="text-base leading-relaxed" data-testid="text-exec-summary">{heroSummary}</p>
      </CardContent>
    </Card>
  );

  const takeawaysGrid = (
    <section className="mb-12" data-testid="section-takeaways">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">Key Takeaways</h2>
        <p className="mt-1 text-sm text-muted-foreground">Four signals that frame the April 2026 release.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {keyTakeaways.map((t) => {
          const Icon = t.icon;
          return (
            <Card key={t.title} className="h-full border-border/60" data-testid={`card-takeaway-${t.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
              <CardHeader className="pb-3">
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${t.bg}`}>
                  <Icon className={`h-5 w-5 ${t.accent}`} />
                </div>
                <CardTitle className="text-base">{t.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {t.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-0.5 text-primary">•</span>
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
  );

  const dataHighlightsGrid = (
    <section className="mb-12" data-testid="section-data-highlights">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">Numbers at a Glance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every figure below is taken directly from the {SOURCE_TITLE} (April 29, 2026 release).
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {dataHighlights.map((h) => (
          <HeroKpiStat key={h.label} label={h.label} value={h.value} icon={h.icon} />
        ))}
      </div>
    </section>
  );

  const recreatedCharts = (
    <section className="mb-12" data-testid="section-charts-recreated">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">Bank of Canada Projections at a Glance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Charts recreated using values stated directly in the April 2026 MPR.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">GDP Growth Forecast (annual %)</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="h-[260px]"
              data-testid="chart-gdp-growth"
              role="img"
              aria-label="Bar chart of Canadian GDP growth: 2026 1.2 percent, 2027 1.6 percent, 2028 1.7 percent."
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gdpForecastData} margin={{ top: 16, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Bar dataKey="growth" name="GDP growth" fill="hsl(220, 70%, 50%)" radius={[4, 4, 0, 0]}>
                    {gdpForecastData.map((d) => (
                      <Cell key={d.year} fill="hsl(220, 70%, 50%)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <SourceLine chartId={15} page={24} />
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">CPI Inflation Path (Feb 2026 → mid-2027 target)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Anchor points stated in the BoC report; lines between points are visual interpolation only.
            </p>
          </CardHeader>
          <CardContent>
            <div
              className="h-[260px]"
              data-testid="chart-cpi-path"
              role="img"
              aria-label="Line chart of CPI inflation anchor points: February 2026 1.8 percent, March 2026 2.4 percent, April 2026 forecast peak 3.0 percent, returning to the 2 percent target by mid 2027."
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cpiPathData} margin={{ top: 16, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[1.5, 3.2]} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                  <ReferenceLine y={2} stroke="hsl(150, 60%, 40%)" strokeDasharray="4 4" label={{ value: "2% target", position: "right", fontSize: 10 }} />
                  <Line type="monotone" dataKey="cpi" stroke="hsl(0, 70%, 55%)" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <SourceLine chartId={19} page={29} />
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Brent Oil: Base Case vs Persistent-High Scenario (US$/bbl)</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="h-[260px]"
              data-testid="chart-oil-scenario"
              role="img"
              aria-label="Line chart of Brent oil price scenarios: base case US dollars 90 in Q2 2026 falling to US dollars 75 by mid 2027; persistent-high scenario held at US dollars 100 per barrel."
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={oilScenarioData} margin={{ top: 16, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} domain={[60, 110]} />
                  <Tooltip formatter={(v: number) => `US$${v}/bbl`} />
                  <Legend />
                  <Line type="monotone" dataKey="baseCase" name="Base case" stroke="hsl(220, 70%, 50%)" strokeWidth={2.5} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="persistent" name="Persistent-high" stroke="hsl(0, 70%, 55%)" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <SourceLine chartId={9} page={14} />
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Tariff Comparison (Average Rate, %)</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="h-[260px]"
              data-testid="chart-tariffs"
              role="img"
              aria-label="Horizontal bar chart of tariff rates: US tariffs on Canadian goods average 5.1 percent; Canadian tariffs on US goods average 1.5 percent."
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tariffComparisonData} layout="vertical" margin={{ top: 16, right: 24, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 6]} />
                  <YAxis type="category" dataKey="side" tick={{ fontSize: 11 }} width={180} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Bar dataKey="rate" name="Average tariff rate" radius={[0, 4, 4, 0]}>
                    {tariffComparisonData.map((d) => (
                      <Cell key={d.side} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <SourceLine chartId={14} page={20} />
          </CardContent>
        </Card>
      </div>
    </section>
  );

  const sourceChartGallery = (
    <section className="mb-12" data-testid="section-charts-source">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">More Charts in the Bank of Canada PDF</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Additional charts referenced in the April 2026 MPR. Each opens the relevant page of the
          official PDF.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sourceChartReferences.map((c) => (
          <a
            key={c.id}
            href={`${SOURCE_PDF_URL}#page=${c.page}`}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`link-source-chart-${c.id}`}
          >
            <Card className="h-full border-border/60 transition-all hover:border-primary/50 hover:shadow-sm">
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">Chart {c.id}</Badge>
                  <Badge variant="secondary" className="text-[10px]">p. {c.page}</Badge>
                </div>
                <h3 className="mb-1 text-sm font-semibold">{c.title}</h3>
                <p className="text-xs text-muted-foreground" aria-label={`Bank of Canada Chart ${c.id}: ${c.title} — ${c.desc}`}>
                  {c.desc}
                </p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
                  Open PDF <ExternalLink className="h-3 w-3" />
                </span>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </section>
  );

  const narrative = (
    <section className="mb-12" data-testid="section-narrative">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">The Full Story</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A market-report walk-through of the eight themes that define the April 2026 release.
        </p>
      </div>
      <div className="space-y-6">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">A · The Big Picture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Before the war in the Middle East, Canada's economy was broadly evolving as expected —
              soft, but on the path the Bank of Canada had laid out.
            </p>
            <p>
              Oil prices then surged. Gasoline pushed CPI inflation higher and reset the near-term
              risk picture. The Bank's outlook now depends heavily on whether oil declines from
              roughly <span className="font-semibold text-foreground">US$90 per barrel in Q2 2026</span>{" "}
              to <span className="font-semibold text-foreground">US$75 by mid-2027</span>.
            </p>
            <p>
              If oil does not fall, inflation could remain more persistent — and the path back to
              the 2% target gets pushed out.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">B · Economic Growth: Slow, But Not Collapsing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              GDP growth is forecast at <span className="font-semibold text-foreground">1.2%</span> in
              2026, <span className="font-semibold text-foreground">1.6%</span> in 2027, and{" "}
              <span className="font-semibold text-foreground">1.7%</span> in 2028. That is enough to
              gradually absorb excess supply, but not quickly.
            </p>
            <p>
              The output gap is estimated at{" "}
              <span className="font-semibold text-foreground">−1.5% to −0.5%</span> in Q1 2026 — the
              economy is running below potential. Labour market indicators support that read:
              unemployment has been around <span className="font-semibold text-foreground">6.5% to 7%</span>{" "}
              over the past 12 months, and wage growth is generally{" "}
              <span className="font-semibold text-foreground">3% to 3.5%</span>.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">C · Inflation: Why the Bank Is Cautious</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              CPI inflation slowed to <span className="font-semibold text-foreground">1.8%</span> in
              February, rose to <span className="font-semibold text-foreground">2.4%</span> in March,
              and is expected to reach about <span className="font-semibold text-foreground">3%</span> in
              April. Core measures are near 2%: CPI-trim 2.2% and CPI-median 2.3%.
            </p>
            <p>
              The risk list is real: gasoline, transportation, food, fertilizer, shipping
              disruptions, and fuel surcharges. Businesses' short-term inflation expectations
              increased after the war began. Longer-term expectations remain anchored — for now.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">D · Oil Prices: The Main Shock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Brent oil was trading around <span className="font-semibold text-foreground">US$100/bbl</span>{" "}
              at the time of the report. The Bank's base case assumes Brent falls from{" "}
              <span className="font-semibold text-foreground">US$90 in Q2 2026 to US$75 by mid-2027</span>.
            </p>
            <p>
              Higher oil helps Canada as a net energy exporter — but the benefit is muted compared
              with past oil booms. Energy-sector investment is less responsive than it used to be,
              and more profits flow to dividends. Households still feel the pain through gasoline,
              food, and transportation.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">E · Interest Rates and Mortgages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Two forces are pulling on the Bank in opposite directions: weak growth and housing
              softness argue for easier policy, while higher inflation risk argues for caution.
              The report does not promise a rate cut.
            </p>
            <p>
              If inflation broadens beyond gasoline and food, the Bank may need to keep monetary
              policy tighter for longer. The illustrative scenario is striking: if oil stays around{" "}
              <span className="font-semibold text-foreground">US$100/bbl</span>, inflation peaks
              near <span className="font-semibold text-foreground">3.1% in Q1 2027</span> and stays
              close to 3% for more than a year — which would require tighter monetary policy and
              even consecutive policy-rate increases.
            </p>
            <p>
              For mortgage-driven decisions, this means do not assume a rapid easing cycle. The
              Canadian nominal neutral rate is estimated at{" "}
              <span className="font-semibold text-foreground">2.25–3.25%</span>, and the path back
              to neutral depends on inflation behaviour.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">F · Housing Market Implications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              The report describes residential investment as subdued, with affordability, slower
              population growth, and weak investor interest all weighing on demand. A small-condo
              inventory overhang in some major centres is restraining new construction.
            </p>
            <p>
              Translation: the housing-starts story isn't going to rescue valuations on its own,
              and demand isn't going to surprise to the upside without a clear trigger like
              meaningful rate relief or a sharp inflation cooling.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">G · Trade, Tariffs, and CUSMA Risk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              US tariffs and CUSMA uncertainty continue to weigh on exports, investment, and
              hiring. The outlook embeds an average{" "}
              <span className="font-semibold text-foreground">5.1%</span> US tariff rate on
              Canadian goods and a <span className="font-semibold text-foreground">1.5%</span>{" "}
              Canadian rate on US goods.
            </p>
            <p>
              The Bank flags CUSMA outcomes as a major downside risk to growth and inflation.
              Tighter restrictions could weaken business confidence, hiring, household spending,
              and ultimately housing demand.
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">H · Bottom Line</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">
              The April 2026 Bank of Canada report does not point to a simple boom or crash
              narrative. It points to a market stuck between weak demand and renewed inflation
              risk. For Canadian real estate, that means affordability remains stretched, housing
              activity remains subdued, and rate relief may depend on whether oil prices and
              inflation pressures actually cool.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );

  const realEstateModule = (
    <section className="mb-12" data-testid="section-real-estate">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">What This Means for Real Estate</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Practical implications for the five groups that act on this report.
        </p>
      </div>
      <Card className="border-border/60">
        <CardContent className="p-4 md:p-6">
          <Tabs defaultValue="buyers" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
              <TabsTrigger value="buyers" data-testid="tab-buyers">Buyers</TabsTrigger>
              <TabsTrigger value="sellers" data-testid="tab-sellers">Sellers</TabsTrigger>
              <TabsTrigger value="investors" data-testid="tab-investors">Investors</TabsTrigger>
              <TabsTrigger value="renewers" data-testid="tab-renewers">Renewers</TabsTrigger>
              <TabsTrigger value="realtors" data-testid="tab-realtors">Realtors</TabsTrigger>
            </TabsList>
            {(["buyers", "sellers", "investors", "renewers", "realtors"] as const).map((k) => (
              <TabsContent key={k} value={k} className="mt-5">
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  {realEstateImplications[k].map((item, i) => (
                    <li key={i} className="flex gap-3" data-testid={`re-${k}-${i}`}>
                      <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </section>
  );

  const embedSection = (
    <section className="mb-12" data-testid="section-embed">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">Embed This Report</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Drop this report into any blog post, brokerage site, or newsletter. Renders responsively
          and lazy-loads.
        </p>
      </div>
      <Card className="border-border/60">
        <CardContent className="p-4 md:p-5">
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs" data-testid="text-embed-code">
            <code>{buildEmbedSnippet()}</code>
          </pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyEmbedButton />
            <Link href={`/embed/insights/${REPORT_SLUG}`}>
              <Button variant="ghost" size="sm" data-testid="button-preview-embed">
                Preview embed view
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </section>
  );

  const disclaimer = (
    <p className="border-t pt-6 text-xs text-muted-foreground" data-testid="text-disclaimer">
      This report is for informational purposes only and is not financial, legal, or mortgage
      advice. Source data: {SOURCE_TITLE} (released April 29, 2026).
    </p>
  );

  // Embed mode: compact layout — hero, takeaways, recreated charts, link to full
  if (embed) {
    return (
      <div className="min-h-screen bg-background">
        {seo}
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          {hero}
          {executiveSummary}
          {takeawaysGrid}
          {recreatedCharts}
          {disclaimer}
        </div>
      </div>
    );
  }

  // Full report
  return (
    <div className="min-h-screen bg-background">
      {seo}
      <Navigation />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="mb-6 print:hidden">
          <Link href="/insights/market-report">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Market Reports
            </Button>
          </Link>
        </div>
        {hero}
        {executiveSummary}
        <div className="mb-12 grid gap-3 sm:grid-cols-3">
          <HeroKpiStat label="CPI Mar 2026" value="2.4%" icon={Percent} />
          <HeroKpiStat label="GDP 2026" value="1.2%" icon={TrendingUp} />
          <HeroKpiStat label="Brent base case (mid-2027)" value="US$75/bbl" icon={Flame} />
        </div>
        {takeawaysGrid}
        {dataHighlightsGrid}
        {recreatedCharts}
        {sourceChartGallery}
        {narrative}
        {realEstateModule}
        {embedSection}
        {disclaimer}
        <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
          <Building2 className="h-3.5 w-3.5" />
          <span>Realist.ca · Canadian real estate intelligence</span>
        </div>
      </div>
    </div>
  );
}

export function BankOfCanadaApril2026ReportEmbed() {
  return <BankOfCanadaApril2026Report embed />;
}
