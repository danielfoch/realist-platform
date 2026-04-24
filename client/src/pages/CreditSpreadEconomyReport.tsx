import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  Calendar,
  ExternalLink,
  Factory,
  Home,
  Landmark,
  Loader2,
  MoveRight,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Bar,
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
import { Slider } from "@/components/ui/slider";
import {
  DEFAULT_NOI,
  calculateYieldCompression,
  formatCompactCurrency,
  formatCurrency,
  formatPercent,
  generateYieldCurve,
} from "@/lib/creditSpreads";

type CreditMode = "official" | "entrepreneur";

interface SourceRegistryEntry {
  datasetId: string;
  geography: string;
  theme: string;
  frequency: string;
  officialSeriesOrTable: string;
  source: string;
  sourcePageUrl: string;
  downloadUrl: string;
  status: string;
  notes: string;
}

interface CreditSpreadPoint {
  period: string;
  label: string;
  mortgageRatePct: number;
  businessRatePct: number;
  spreadPctPoints: number;
  spreadBps: number;
  mortgageLabel: string;
  businessLabel: string;
  sourceUrl: string;
  caveat: string;
}

interface ReportData {
  generatedAt: string;
  title: string;
  subtitle: string;
  inputRoot: string;
  notes: {
    methodology: string;
    thesisGuardrail: string;
  };
  executiveSummary: string[];
  datasets: {
    officialCreditSpreadSeries: CreditSpreadPoint[];
    entrepreneurProxySeries: CreditSpreadPoint[];
    businessDynamism: Array<{
      year: number;
      entryRatePct: number;
      exitRatePct: number;
      netEntryRatePct: number;
      growthRateActiveBusinessesPct: number;
      sourceTable: string;
      sourceUrl: string;
    }>;
    gdpPerCapita: Array<{
      year: number;
      realGdpPerCapita2017Cad: number;
      sourceTable: string;
      sourceUrl: string;
    }>;
    housingEconomicAccount: Array<{
      year: number;
      metric: string;
      value: number;
      unit: string;
      sourceUrl: string;
    }>;
  };
  highlights: {
    latestOfficialSpreadBps: number | null;
    latestOfficialPeriod: string | null;
    latestEntrepreneurFacingSpreadBps: number | null;
    latestEntrepreneurFacingPeriod: string | null;
    latestEntryRatePct: number | null;
    latestExitRatePct: number | null;
    latestNetEntryRatePct: number | null;
    latestGdpPerCapita2017Cad: number | null;
    gdpPerCapitaChangeSince2019Pct: number | null;
    housingWealthSharePct: number | null;
  };
  sourceRegistry: SourceRegistryEntry[];
  sourceLookup: Record<string, SourceRegistryEntry | null>;
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
}) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="p-5">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="mt-1 text-sm font-medium">{title}</div>
        <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
      </CardContent>
    </Card>
  );
}

function CreditSpreadTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: CreditSpreadPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="max-w-xs rounded-lg border bg-card p-3 text-xs shadow-lg">
      <div className="font-semibold">{label}</div>
      <div className="mt-2 space-y-1">
        <div>Mortgage: {formatPercent(point.mortgageRatePct, 2)}</div>
        <div>Business credit: {formatPercent(point.businessRatePct, 2)}</div>
        <div>Spread: {point.spreadBps.toFixed(0)} bps</div>
      </div>
      <div className="mt-2 text-muted-foreground">{point.caveat}</div>
      <a
        href={point.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-primary hover:underline"
      >
        Source <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

export default function CreditSpreadEconomyReport() {
  const [creditMode, setCreditMode] = useState<CreditMode>("official");
  const [annualNoi, setAnnualNoi] = useState(DEFAULT_NOI);
  const [requiredYieldPct, setRequiredYieldPct] = useState(4);
  const [mortgageRatePct, setMortgageRatePct] = useState(5.25);
  const [loanToValuePct, setLoanToValuePct] = useState(75);
  const [annualAppreciationPct, setAnnualAppreciationPct] = useState(3);
  const [holdingPeriodYears, setHoldingPeriodYears] = useState(5);

  const { data, isLoading, error } = useQuery<ReportData>({
    queryKey: ["/data/credit-spreads/report-data.json"],
    staleTime: Infinity,
    queryFn: async () => {
      const response = await fetch("/data/credit-spreads/report-data.json");
      if (!response.ok) throw new Error("Failed to load report data");
      return response.json();
    },
  });

  const calculator = useMemo(
    () =>
      calculateYieldCompression({
        annualNoi,
        requiredYieldPct,
        mortgageRatePct,
        loanToValuePct,
        annualAppreciationPct,
        holdingPeriodYears,
      }),
    [annualNoi, requiredYieldPct, mortgageRatePct, loanToValuePct, annualAppreciationPct, holdingPeriodYears],
  );

  const valueCurve = useMemo(() => generateYieldCurve(annualNoi), [annualNoi]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 px-4 py-20">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading credit spreads report…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 px-4 py-20">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-muted-foreground">Unable to load the report data. Please try again shortly.</p>
        </div>
      </div>
    );
  }

  const publishedDate = new Date(data.generatedAt).toLocaleDateString("en-CA", {
    dateStyle: "long",
  });
  const activeSpreadSeries =
    creditMode === "official"
      ? data.datasets.officialCreditSpreadSeries
      : data.datasets.entrepreneurProxySeries;
  const businessDynamism = data.datasets.businessDynamism.map((row) => ({
    ...row,
    yearLabel: String(row.year),
  }));
  const gdpChart = data.datasets.gdpPerCapita.map((row) => ({
    ...row,
    yearLabel: String(row.year),
  }));
  const housingMetrics = Object.fromEntries(
    data.datasets.housingEconomicAccount.map((row) => [row.metric, row]),
  );

  const articleStructuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: data.title,
    description:
      "An interactive Realist research report on how Canada’s residential credit system, lower investor yield requirements, and business-credit frictions may have redirected capital toward housing and away from entrepreneurship.",
    author: {
      "@type": "Organization",
      name: "Realist",
    },
    publisher: {
      "@type": "Organization",
      name: "Realist",
      url: "https://realist.ca",
    },
    datePublished: data.generatedAt,
    dateModified: data.generatedAt,
    mainEntityOfPage: "https://realist.ca/insights/the-spread-that-ate-the-economy",
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="The Spread That Ate the Economy | Realist.ca"
        description="An interactive Realist research report on how Canada’s residential credit system, lower investor yield requirements, and business-credit frictions may have redirected capital toward housing and away from entrepreneurship."
        canonicalUrl="/insights/the-spread-that-ate-the-economy"
        structuredData={articleStructuredData}
      />
      <Navigation />

      <main className="container mx-auto max-w-6xl px-4 py-8">
        <Link href="/insights" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Insights
        </Link>

        <section className="mb-10">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              <Calendar className="mr-1 h-3 w-3" />
              {publishedDate}
            </Badge>
            <Badge variant="outline">Realist Research</Badge>
            <Badge variant="outline">Canada Macro</Badge>
          </div>
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">
            {data.title}
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-muted-foreground">{data.subtitle}</p>
          <div className="mt-5 max-w-3xl rounded-2xl border border-border/70 bg-muted/30 p-5 text-sm leading-relaxed text-muted-foreground">
            Canada’s housing problem is not only about zoning, rates, or population growth. It may also be a capital-allocation problem:
            when mortgage credit is cheaper, more standardized, and more scalable than business credit, capital can rationally drift toward housing.
            This report treats that as an evidence-backed framework, not a single-cause explanation.
          </div>
        </section>

        <section className="mb-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Latest official spread"
            value={data.highlights.latestOfficialSpreadBps != null ? `${data.highlights.latestOfficialSpreadBps.toFixed(0)} bps` : "—"}
            subtitle={`Aggregate bank-credit gap, ${data.highlights.latestOfficialPeriod ?? "n/a"}`}
            icon={Landmark}
          />
          <MetricCard
            title="Entrepreneur-facing proxy"
            value={data.highlights.latestEntrepreneurFacingSpreadBps != null ? `${data.highlights.latestEntrepreneurFacingSpreadBps.toFixed(0)} bps` : "—"}
            subtitle={`Point-in-time proxy, ${data.highlights.latestEntrepreneurFacingPeriod ?? "n/a"}`}
            icon={BriefcaseBusiness}
          />
          <MetricCard
            title="Latest net entry rate"
            value={formatPercent(data.highlights.latestNetEntryRatePct, 1)}
            subtitle="Canadian business dynamism, 2023"
            icon={Factory}
          />
          <MetricCard
            title="Housing share of wealth"
            value={formatPercent(data.highlights.housingWealthSharePct, 1)}
            subtitle="Housing assets as share of national wealth, 2024"
            icon={Home}
          />
        </section>

        <section className="mb-10">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Executive Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                {data.executiveSummary.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        <section className="mb-10">
          <div className="mb-4">
            <h2 className="text-2xl font-bold">Mechanism: Credit as Capital Allocation</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Mortgage credit and business credit are not interchangeable. They differ on rate, leverage, collateral, underwriting, standardization, and public-policy support.
              Official aggregate bank spreads capture only part of that story. A founder or small operator often faces additional friction: lower leverage, personal guarantees,
              weaker collateral treatment, and less standardization than an investor buying a financed residential asset.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/60">
              <CardContent className="p-5">
                <div className="mb-3 text-sm font-semibold">Residential mortgage channel</div>
                <p className="text-sm text-muted-foreground">
                  Standardized underwriting, deep lender participation, securitization support, and clear collateral make housing unusually financeable relative to many other assets.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-5">
                <div className="mb-3 text-sm font-semibold">Business credit channel</div>
                <p className="text-sm text-muted-foreground">
                  Founder-facing business borrowing often comes with lower leverage, less predictable terms, and a larger role for operational judgment, cash flow uncertainty, and guarantees.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-5">
                <div className="mb-3 text-sm font-semibold">Why the spread matters</div>
                <p className="text-sm text-muted-foreground">
                  If housing is easier to lever than productive business investment, even modest rate differences can redirect capital toward property ownership rather than business formation.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mb-10">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="gap-4 md:flex md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Canadian Mortgage vs Business Credit</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Compare official aggregate bank rates with a borrower-facing entrepreneur proxy.
                </p>
              </div>
              <div className="flex rounded-lg border border-border bg-muted/40 p-1">
                <Button
                  variant={creditMode === "official" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCreditMode("official")}
                >
                  Official aggregate
                </Button>
                <Button
                  variant={creditMode === "entrepreneur" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCreditMode("entrepreneur")}
                >
                  Entrepreneur proxy
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={activeSpreadSeries} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="rates" tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} />
                    <YAxis yAxisId="spread" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(value) => `${value} bps`} />
                    <Tooltip content={<CreditSpreadTooltip />} />
                    <Legend />
                    <Bar yAxisId="spread" dataKey="spreadBps" name="Spread (bps)" fill="hsl(35 80% 55%)" radius={[6, 6, 0, 0]} />
                    <Line yAxisId="rates" type="monotone" dataKey="mortgageRatePct" name="Mortgage rate proxy" stroke="hsl(220 70% 50%)" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line yAxisId="rates" type="monotone" dataKey="businessRatePct" name="Business lending proxy" stroke="hsl(160 50% 45%)" strokeWidth={2.5} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {creditMode === "official"
                    ? "Official Bank of Canada lending series are volume-weighted averages. They show that business borrowing is typically priced above residential mortgage credit, but they understate the full founder-facing friction that entrepreneurs often encounter."
                    : "The entrepreneur-facing view is intentionally labeled as a proxy. The supplied pack only includes a point-in-time BDC simulator observation, so this should be treated as a practical borrowing illustration rather than a formal time series."}
                </p>
                <Badge variant="outline" className="w-fit">
                  Caveat: borrower-facing spreads can differ materially from official bank averages
                </Badge>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-10">
          <div className="mb-4">
            <h2 className="text-2xl font-bold">Yield Compression and Price-to-Rent Distortion</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Lower required yields let investors pay more for the same income stream. In real estate, that means the same rent or NOI can justify a higher asset value when capital
              accepts a lower cap rate. If prices rise faster than rents, ownership values pull away from rental values and price-to-rent ratios stretch.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard title="5% yield" value={formatCurrency(30_000 / 0.05)} subtitle="$30,000 NOI / 5%" icon={Wallet} />
            <MetricCard title="4% yield" value={formatCurrency(30_000 / 0.04)} subtitle="$30,000 NOI / 4%" icon={TrendingUp} />
            <MetricCard title="3% yield" value={formatCurrency(30_000 / 0.03)} subtitle="$30,000 NOI / 3%" icon={Building2} />
            <MetricCard title="Interpretation" value="Same rent" subtitle="Only the required yield changed" icon={Home} />
          </div>
        </section>

        <section className="mb-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Yield Compression Model</CardTitle>
              <p className="text-sm text-muted-foreground">
                Property value = NOI / required yield. Lower yields support higher prices before rents change.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-5 md:grid-cols-2">
                <SliderField
                  label="Annual rent / NOI"
                  value={annualNoi}
                  display={formatCurrency(annualNoi)}
                  min={10_000}
                  max={100_000}
                  step={1_000}
                  onChange={setAnnualNoi}
                />
                <SliderField
                  label="Required yield / cap rate"
                  value={requiredYieldPct}
                  display={formatPercent(requiredYieldPct, 1)}
                  min={2}
                  max={8}
                  step={0.1}
                  onChange={setRequiredYieldPct}
                />
                <SliderField
                  label="Mortgage rate"
                  value={mortgageRatePct}
                  display={formatPercent(mortgageRatePct, 2)}
                  min={2}
                  max={8}
                  step={0.05}
                  onChange={setMortgageRatePct}
                />
                <SliderField
                  label="Loan-to-value"
                  value={loanToValuePct}
                  display={formatPercent(loanToValuePct, 0)}
                  min={40}
                  max={85}
                  step={1}
                  onChange={setLoanToValuePct}
                />
                <SliderField
                  label="Expected annual appreciation"
                  value={annualAppreciationPct}
                  display={formatPercent(annualAppreciationPct, 1)}
                  min={-2}
                  max={8}
                  step={0.1}
                  onChange={setAnnualAppreciationPct}
                />
                <SliderField
                  label="Holding period"
                  value={holdingPeriodYears}
                  display={`${holdingPeriodYears.toFixed(0)} years`}
                  min={1}
                  max={10}
                  step={1}
                  onChange={setHoldingPeriodYears}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {[5, 4, 3].map((preset) => (
                  <Button key={preset} variant="outline" size="sm" onClick={() => setRequiredYieldPct(preset)}>
                    {preset}% required yield
                  </Button>
                ))}
              </div>

              {calculator.appreciationDominanceWarning && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      Appreciation is doing most of the work here. The model shows a low running yield, with a majority of expected return coming from future price gains rather than current income.
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Model Output</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <OutputStat label="Implied property value" value={formatCurrency(calculator.impliedPropertyValue)} />
              <OutputStat label="Monthly interest cost" value={formatCurrency(calculator.monthlyInterestCost)} />
              <OutputStat label="Cash-on-cash yield" value={formatPercent(calculator.cashOnCashYieldPct, 1)} />
              <OutputStat label="Price-to-rent ratio" value={calculator.priceToRentRatio != null ? `${calculator.priceToRentRatio.toFixed(1)}x` : "—"} />
              <OutputStat label="Annual cash flow before tax" value={formatCurrency(calculator.annualCashFlowBeforeTax)} />
              <OutputStat label="Total return estimate" value={formatCurrency(calculator.totalReturnEstimate)} />
              <OutputStat label="Ending value" value={formatCurrency(calculator.endingValue)} />
              <OutputStat label="Appreciation share of return" value={formatPercent(calculator.appreciationDominanceSharePct, 0)} />
            </CardContent>
          </Card>
        </section>

        <section className="mb-10">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Price-to-Rent / Yield Compression Visual</CardTitle>
              <p className="text-sm text-muted-foreground">
                The income stream stays constant. Only investor yield tolerance changes.
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={valueCurve}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="requiredYieldPct" tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatCompactCurrency(value)} />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), "Implied property value"]}
                      labelFormatter={(value) => `Required yield: ${value}%`}
                    />
                    <Line type="monotone" dataKey="impliedPropertyValue" stroke="hsl(220 70% 50%)" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Tooltip interpretation: rents did not change here. The asset became more expensive because investors accepted a lower yield requirement.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="mb-10">
          <div className="mb-4">
            <h2 className="text-2xl font-bold">Housing vs Entrepreneurship</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Real estate can be attractive not only because of price appreciation, but because it may offer lower friction, more leverage, and clearer collateral than building an operating business.
              Business investment involves hiring risk, execution risk, market risk, and often personal guarantees. That does not prove causality, but it does shape incentives.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/60">
              <CardHeader><CardTitle className="text-base">Why rational capital may choose housing</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>More predictable collateral value</p>
                <p>Higher leverage relative to equity invested</p>
                <p>Clearer underwriting templates and distribution channels</p>
                <p>Lower perceived operational complexity than running a business</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardHeader><CardTitle className="text-base">What that can mean economically</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>More capital absorbed by housing and land</p>
                <p>Lower tolerance for entrepreneurial risk</p>
                <p>Weaker business dynamism and slower productivity growth</p>
                <p>Greater dependence on housing wealth to offset weak income growth</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mb-10">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Business Dynamism</CardTitle>
              <p className="text-sm text-muted-foreground">
                Statistics Canada business entry and exit rates, with 2023 highlighted.
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={businessDynamism}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="yearLabel" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                    <Legend />
                    <ReferenceLine x="2023" stroke="hsl(35 80% 55%)" strokeDasharray="4 4" label={{ value: "2023", position: "insideTopRight", fontSize: 11 }} />
                    <Line type="monotone" dataKey="entryRatePct" name="Entry rate" stroke="hsl(220 70% 50%)" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="exitRatePct" name="Exit rate" stroke="hsl(0 70% 55%)" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="netEntryRatePct" name="Net entry rate" stroke="hsl(160 50% 45%)" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Interpretation: Canadian business formation did not collapse, but the post-2010 profile is softer than the stronger entry years earlier in the sample. If housing repeatedly offers easier leverage and clearer downside protection, that relative attractiveness matters at the margin.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="mb-10">
          <div className="mb-4">
            <h2 className="text-2xl font-bold">Productivity and GDP Per Capita</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Aggregate GDP can still grow while individuals become worse off if GDP per capita stalls. Weak productivity makes housing affordability worse because incomes fail to keep up with asset values and carrying costs.
            </p>
          </div>
          {gdpChart.length > 0 ? (
            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle>Real GDP Per Capita (2017 CAD)</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Seed data available through 2024.
                </p>
              </CardHeader>
              <CardContent>
                <div className="mb-5 grid gap-4 md:grid-cols-3">
                  <MetricCard
                    title="2024 GDP per capita"
                    value={data.highlights.latestGdpPerCapita2017Cad != null ? formatCurrency(data.highlights.latestGdpPerCapita2017Cad) : "—"}
                    subtitle="2017 constant dollars"
                    icon={Wallet}
                  />
                  <MetricCard
                    title="Change since 2019"
                    value={formatPercent(data.highlights.gdpPerCapitaChangeSince2019Pct, 1)}
                    subtitle="Directionally weak per-capita growth"
                    icon={TrendingUp}
                  />
                  <MetricCard
                    title="2024 housing investment"
                    value={housingMetrics["Nominal investment in residential housing"] ? `${housingMetrics["Nominal investment in residential housing"].value.toFixed(1)}B` : "—"}
                    subtitle="Nominal CAD billions"
                    icon={Building2}
                  />
                </div>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={gdpChart}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="yearLabel" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatCompactCurrency(value)} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Line type="monotone" dataKey="realGdpPerCapita2017Cad" stroke="hsl(220 70% 50%)" strokeWidth={3} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-6 text-sm text-muted-foreground">
                GDP per capita data unavailable in the supplied pack. The chart is intentionally omitted rather than filled with fabricated values.
              </CardContent>
            </Card>
          )}
        </section>

        <section className="mb-10">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Systems Diagram</CardTitle>
              <p className="text-sm text-muted-foreground">
                One stylized loop showing how credit conditions can reinforce housing dependence.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  "Cheap / easy mortgage credit",
                  "Lower required yields",
                  "Higher ownership values",
                  "Higher price-to-rent ratios",
                  "More renter households / investor ownership",
                  "More capital into housing",
                  "Less capital into business formation",
                  "Weaker productivity and wage growth",
                  "Greater dependence on housing wealth",
                ].map((step, index, steps) => (
                  <div key={step} className="relative rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
                    <div className="font-medium">{step}</div>
                    {index < steps.length - 1 && (
                      <div className="mt-3 flex items-center text-muted-foreground md:hidden">
                        <MoveRight className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Read as an amplification loop, not a claim that mortgage credit alone explains Canadian economic outcomes.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="mb-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card className="border-border/60 shadow-sm">
            <CardHeader><CardTitle>Caveats and Limitations</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>Land-use regulation and approval friction still matter.</li>
                <li>Immigration, population growth, and household formation still matter.</li>
                <li>Tax treatment and capital-gains expectations still matter.</li>
                <li>Monetary policy is global; low rates are not uniquely Canadian.</li>
                <li>Cross-country credit comparisons are imperfect.</li>
                <li>Official aggregate lending rates do not fully describe founder-facing credit access.</li>
                <li>The thesis is about amplification and capital allocation, not single-cause determinism.</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader><CardTitle>Methodology Notes</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{data.notes.methodology}</p>
              <p>{data.notes.thesisGuardrail}</p>
              <p>
                Input root: <code className="rounded bg-muted px-1 py-0.5 text-xs">{data.inputRoot}</code>
              </p>
              <a
                href="/data/credit-spreads/README.md"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Data README <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          </Card>
        </section>

        <section className="mb-10">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Sources and Methodology</CardTitle>
              <p className="text-sm text-muted-foreground">
                Preserved from the supplied source registry. Dates, statuses, and caveats are shown as provided.
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Dataset</th>
                      <th className="px-3 py-2 font-medium">Source</th>
                      <th className="px-3 py-2 font-medium">Metric / table</th>
                      <th className="px-3 py-2 font-medium">Frequency</th>
                      <th className="px-3 py-2 font-medium">Caveat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sourceRegistry.map((source) => (
                      <tr key={source.datasetId} className="border-b align-top last:border-0">
                        <td className="px-3 py-3">
                          <div className="font-medium">{source.datasetId}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{source.status}</div>
                        </td>
                        <td className="px-3 py-3">
                          <a href={source.sourcePageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                            {source.source}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{source.officialSeriesOrTable}</td>
                        <td className="px-3 py-3 text-muted-foreground">{source.frequency}</td>
                        <td className="px-3 py-3 text-muted-foreground">{source.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

function SliderField({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-sm text-muted-foreground">{display}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(next) => onChange(next[0] ?? value)}
      />
    </div>
  );
}

function OutputStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
  );
}
