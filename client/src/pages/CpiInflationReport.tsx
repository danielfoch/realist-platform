import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/SEO";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import {
  ArrowLeft, TrendingDown, TrendingUp, AlertCircle, Loader2,
  Fuel, Home, ShoppingCart, Flame, ExternalLink,
} from "lucide-react";

interface CpiReport {
  generatedAt: string;
  referenceMonth: string;
  referenceMonthLabel: string;
  releaseDate: string;
  sourceUrl: string;
  sourceTable: string;
  headline: {
    yoyPct: number;
    yoyPctPrev: number;
    momPct: number;
    momSaPct: number | null;
    index: number;
    indexPrev: number;
    exGasYoyPct: number;
    exFoodEnergyYoyPct: number;
  };
  series: Array<{ refPer: string; label: string; index: number; yoyPct: number | null }>;
  components: Array<{
    key: string; label: string; index: number;
    yoyPct: number; momPct: number; yoyPctPrev: number;
  }>;
  provinces: Array<{
    abbr: string; name: string; geoId: number;
    index: number; yoyPct: number; yoyPctPrev: number; accelerationBps: number;
  }>;
  notableDrivers: Array<{ label: string; yoyPct: number; momPct: number; note: string }>;
  baseYearEffects: Array<{ label: string; yoyPct: number; note: string }>;
  summary: string[];
  investorTakeaways: string[];
}

const fmtPct = (n: number | null | undefined, d = 1) =>
  n == null || Number.isNaN(n) ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`;
const fmtIdx = (n: number) => n.toFixed(1);

export default function CpiInflationReport() {
  const { data, isLoading, error } = useQuery<CpiReport>({
    queryKey: ["/api/insights/cpi-march-2026"],
    staleTime: 60 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container max-w-6xl mx-auto px-4 py-20 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading Canadian CPI report…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container max-w-6xl mx-auto px-4 py-20 flex flex-col items-center justify-center gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-muted-foreground">Unable to load the report. Please try again shortly.</p>
        </div>
      </div>
    );
  }

  const h = data.headline;
  const accel = h.yoyPct - h.yoyPctPrev;

  const provinceChart = [...data.provinces].sort((a, b) => b.yoyPct - a.yoyPct);
  const fastestAccel = [...data.provinces].sort((a, b) => b.accelerationBps - a.accelerationBps)[0];
  const slowestAccel = [...data.provinces].sort((a, b) => a.accelerationBps - b.accelerationBps)[0];

  const componentsChart = [...data.components]
    .filter(c => !["household", "clothing", "recreation", "alcoholTobacco", "health"].includes(c.key) || true)
    .sort((a, b) => b.yoyPct - a.yoyPct);

  const POS = "hsl(0, 70%, 55%)";
  const NEG = "hsl(150, 55%, 45%)";
  const NEUT = "hsl(220, 70%, 50%)";

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`Canadian CPI ${data.referenceMonthLabel} — Realist.ca`}
        description={`Canada's Consumer Price Index rose ${h.yoyPct.toFixed(1)}% YoY in ${data.referenceMonthLabel}. Gasoline-led, with shelter cooling. What it means for real estate investors.`}
      />
      <Navigation />

      <div className="container max-w-6xl mx-auto px-4 py-8">
        <Link href="/insights" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6" data-testid="link-back-insights">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Insights
        </Link>

        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge variant="outline">Canada · All Provinces</Badge>
            <Badge variant="outline">Reference: {data.referenceMonthLabel}</Badge>
            <Badge variant="outline" className="text-xs">
              Source:&nbsp;
              <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground inline-flex items-center gap-1">
                Statistics Canada <ExternalLink className="h-3 w-3" />
              </a>
              <span className="mx-1">·</span>
              {data.sourceTable}
            </Badge>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" data-testid="text-report-title">
            Canadian CPI: {data.referenceMonthLabel}
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Headline inflation accelerated to <strong className="text-foreground">{fmtPct(h.yoyPct)}</strong> year-over-year, up
            {" "}{Math.abs(Math.round(accel * 100))} bps from {fmtPct(h.yoyPctPrev)} in the prior month.
            Gasoline did most of the lifting ({fmtPct(data.components.find(c => c.key === "gasoline")?.momPct ?? null, 1)} month-over-month —
            the largest monthly gasoline increase on record). Strip out gas and CPI ran {fmtPct(h.exGasYoyPct)}.
          </p>
        </div>

        {/* Headline stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <Card data-testid="card-stat-headline">
            <CardContent className="p-5">
              <div className="text-xs uppercase text-muted-foreground tracking-wide">Headline CPI (YoY)</div>
              <div className="text-3xl font-bold mt-2">{fmtPct(h.yoyPct)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {accel >= 0 ? <TrendingUp className="h-3 w-3 inline text-red-500" /> : <TrendingDown className="h-3 w-3 inline text-emerald-500" />}
                {" "}{accel >= 0 ? "+" : ""}{Math.round(accel * 100)} bps vs prior
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-exgas">
            <CardContent className="p-5">
              <div className="text-xs uppercase text-muted-foreground tracking-wide">Ex-Gasoline (YoY)</div>
              <div className="text-3xl font-bold mt-2">{fmtPct(h.exGasYoyPct)}</div>
              <div className="text-xs text-muted-foreground mt-1">Underlying pressure, gas stripped out</div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-mom">
            <CardContent className="p-5">
              <div className="text-xs uppercase text-muted-foreground tracking-wide">Headline (MoM)</div>
              <div className="text-3xl font-bold mt-2">{fmtPct(h.momPct)}</div>
              <div className="text-xs text-muted-foreground mt-1">{h.momSaPct != null ? `${fmtPct(h.momSaPct)} seasonally adjusted` : "Not seasonally adjusted"}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-core">
            <CardContent className="p-5">
              <div className="text-xs uppercase text-muted-foreground tracking-wide">Ex-Food & Energy</div>
              <div className="text-3xl font-bold mt-2">{fmtPct(h.exFoodEnergyYoyPct)}</div>
              <div className="text-xs text-muted-foreground mt-1">Cleaner read on underlying trend</div>
            </CardContent>
          </Card>
        </div>

        {/* Executive summary */}
        <Card className="mb-10">
          <CardHeader><CardTitle>Executive Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            {data.summary.map((p, i) => <p key={i}>{p}</p>)}
          </CardContent>
        </Card>

        {/* Headline trend */}
        <Card className="mb-10">
          <CardHeader>
            <CardTitle className="text-base">24-Month Headline CPI (YoY %)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={data.series} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={1} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={['auto', 'auto']} />
                <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)}%`} />
                <ReferenceLine y={2} stroke="#888" strokeDasharray="4 4" label={{ value: "BoC 2% target", position: "right", fontSize: 10, fill: "#888" }} />
                <Line type="monotone" dataKey="yoyPct" stroke={NEUT} strokeWidth={2.5} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-3 text-xs text-muted-foreground">
              Source: Statistics Canada Table 18-10-0004-01, all-items CPI (2002=100), computed YoY from monthly index.
            </div>
          </CardContent>
        </Card>

        {/* Components + Drivers */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <Card>
            <CardHeader><CardTitle className="text-base">Components: YoY Change</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(260, componentsChart.length * 24)}>
                <BarChart data={componentsChart} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={170} />
                  <Tooltip formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
                  <ReferenceLine x={0} stroke="#888" />
                  <Bar dataKey="yoyPct">
                    {componentsChart.map((c, i) => <Cell key={i} fill={c.yoyPct < 0 ? NEG : c.yoyPct > h.yoyPct ? POS : NEUT} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 text-xs text-muted-foreground">
                Red = above headline; blue = below headline; green = deflating YoY.
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Fuel className="h-4 w-4" /> Notable Drivers</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                {data.notableDrivers.map((d, i) => (
                  <li key={i} className="border-b pb-2 last:border-0">
                    <div className="flex items-center justify-between">
                      <strong>{d.label}</strong>
                      <div className="font-mono text-xs">
                        <span className={d.yoyPct >= 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>YoY {fmtPct(d.yoyPct)}</span>
                        <span className="mx-2 text-muted-foreground">·</span>
                        <span className={d.momPct >= 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>MoM {fmtPct(d.momPct)}</span>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-xs mt-1">{d.note}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Provincial breakdown */}
        <Card className="mb-10">
          <CardHeader><CardTitle className="text-base">Provincial CPI (YoY % change, {data.referenceMonthLabel})</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={provinceChart} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="abbr" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  formatter={(v: any, _n: any, p: any) => [`${Number(v).toFixed(2)}%`, p.payload.name]}
                  labelFormatter={(l) => `Province: ${l}`}
                />
                <ReferenceLine y={h.yoyPct} stroke="#888" strokeDasharray="4 4"
                  label={{ value: `Canada ${fmtPct(h.yoyPct)}`, position: "right", fontSize: 10, fill: "#888" }} />
                <Bar dataKey="yoyPct">
                  {provinceChart.map((p, i) => <Cell key={i} fill={p.yoyPct >= h.yoyPct ? POS : NEUT} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2">Province</th>
                    <th className="text-right">Index</th>
                    <th className="text-right">YoY</th>
                    <th className="text-right">Prior YoY</th>
                    <th className="text-right">Accel (bps)</th>
                  </tr>
                </thead>
                <tbody>
                  {provinceChart.map((p) => (
                    <tr key={p.abbr} className="border-b" data-testid={`row-prov-${p.abbr}`}>
                      <td className="py-2">{p.name}</td>
                      <td className="text-right font-mono">{fmtIdx(p.index)}</td>
                      <td className={`text-right font-mono ${p.yoyPct >= h.yoyPct ? "text-red-600 dark:text-red-400" : ""}`}>{fmtPct(p.yoyPct, 2)}</td>
                      <td className="text-right font-mono text-muted-foreground">{fmtPct(p.yoyPctPrev, 2)}</td>
                      <td className={`text-right font-mono ${p.accelerationBps > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {p.accelerationBps >= 0 ? "+" : ""}{p.accelerationBps}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {fastestAccel && slowestAccel && (
              <p className="mt-3 text-xs text-muted-foreground">
                Fastest acceleration: <strong className="text-foreground">{fastestAccel.name}</strong> (+{fastestAccel.accelerationBps} bps).
                {" "}Slowest: <strong className="text-foreground">{slowestAccel.name}</strong> ({slowestAccel.accelerationBps >= 0 ? "+" : ""}{slowestAccel.accelerationBps} bps).
              </p>
            )}
          </CardContent>
        </Card>

        {/* Shelter + base-year effects */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Home className="h-4 w-4" /> Shelter Breakdown</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs text-muted-foreground"><th className="text-left py-2">Category</th><th className="text-right">YoY</th><th className="text-right">MoM</th></tr></thead>
                <tbody>
                  {["shelter", "rentedAccommodation", "ownedAccommodation", "electricity", "naturalGas", "fuelOil"].map(k => {
                    const c = data.components.find(x => x.key === k);
                    if (!c) return null;
                    return (
                      <tr key={k} className="border-b">
                        <td className="py-2">{c.label}</td>
                        <td className={`text-right font-mono ${c.yoyPct >= 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>{fmtPct(c.yoyPct)}</td>
                        <td className={`text-right font-mono ${c.momPct >= 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>{fmtPct(c.momPct, 2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground mt-3">
                Rent running well ahead of owned accommodation — the defining tension for Canadian housing data in 2026.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Flame className="h-4 w-4" /> GST/HST Base-Year Effects</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                {data.baseYearEffects.map((b, i) => (
                  <li key={i} className="border-b pb-2 last:border-0">
                    <div className="flex items-center justify-between">
                      <strong>{b.label}</strong>
                      <span className="font-mono text-xs text-red-600 dark:text-red-400">YoY {fmtPct(b.yoyPct)}</span>
                    </div>
                    <p className="text-muted-foreground text-xs mt-1">{b.note}</p>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-3">
                The Dec 2024–Feb 2025 tax break is dropping out of the YoY comparison over the next two prints. Expect noise.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Food */}
        <Card className="mb-10">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Food & Groceries</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-xs text-muted-foreground"><th className="text-left py-2">Category</th><th className="text-right">Index</th><th className="text-right">YoY</th><th className="text-right">MoM</th></tr></thead>
              <tbody>
                {["food", "freshVegetables", "freshFruit"].map(k => {
                  const c = data.components.find(x => x.key === k);
                  if (!c) return null;
                  return (
                    <tr key={k} className="border-b">
                      <td className="py-2">{c.label}</td>
                      <td className="text-right font-mono">{fmtIdx(c.index)}</td>
                      <td className={`text-right font-mono ${c.yoyPct >= 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>{fmtPct(c.yoyPct)}</td>
                      <td className={`text-right font-mono ${c.momPct >= 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>{fmtPct(c.momPct, 2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Investor takeaways */}
        <Card className="mb-10 border-primary/30">
          <CardHeader><CardTitle>What It Means for Real Estate Investors</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <ul className="space-y-3 list-disc pl-5">
              {data.investorTakeaways.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </CardContent>
        </Card>

        {/* Methodology */}
        <Card className="mb-10">
          <CardHeader><CardTitle className="text-base">Data & Methodology</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Primary source:</strong> {data.sourceTable}, pulled live from the
              {" "}<a href="https://www.statcan.gc.ca/en/developers/wds" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Statistics Canada Web Data Service</a>.
              All index levels are 2002=100 and are not seasonally adjusted unless noted.
            </p>
            <p>
              <strong className="text-foreground">Year-over-year %</strong> is computed from the unrounded monthly index against the same month prior year — which may differ by 0.1pp from rounded StatCan-published YoY prints.
            </p>
            <p>
              <strong className="text-foreground">Narrative:</strong> commentary summarizes the StatCan
              {" "}<a href={data.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Daily release</a> {" "}
              for {data.referenceMonthLabel}; investor interpretation is Realist.ca analysis.
            </p>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground py-6">
          Generated {new Date(data.generatedAt).toLocaleString("en-CA")} · Realist.ca research ·
          {" "}Data: Statistics Canada, reproduced and redistributed as available under the{" "}
          <a href="https://www.statcan.gc.ca/en/reference/licence" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
            Statistics Canada Open Licence
          </a>.
        </div>
      </div>
    </div>
  );
}
