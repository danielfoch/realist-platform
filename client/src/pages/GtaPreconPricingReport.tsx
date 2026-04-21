import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/SEO";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ReferenceLine,
} from "recharts";
import {
  ArrowLeft, TrendingDown, TrendingUp, Minus, AlertCircle, Loader2,
  Building, BarChart3, Hammer, Info,
} from "lucide-react";

interface PreconReport {
  generatedAt: string;
  windowFrom: string;
  windowTo: string;
  rebateBenchmarkPct: number;
  totals: {
    floorplans: number;
    projects: number;
    projectsWithMovement: number;
    cuts: number;
    raises: number;
    flat: number;
    cutSharePct: number;
    raiseSharePct: number;
    flatSharePct: number;
    cutToRaiseRatio: number | null;
    avgCutPct: number;
    avgRaisePct: number;
    medianCutPct: number;
    medianRaisePct: number;
    biggestCutPct: number;
    biggestRaisePct: number;
    raisesAboveRebate: number;
    raisesBelowRebate: number;
  };
  distribution: Array<{ band: string; count: number }>;
  byRegion: Array<{ region: string; floorplans: number; cuts: number; raises: number; flat: number; avgDeltaPct: number; cutToRaiseRatio: number | null }>;
  byCity: Array<{ city: string; region: string; floorplans: number; cuts: number; raises: number; flat: number; avgDeltaPct: number }>;
  byBuildingCategory: Array<{ category: string; floorplans: number; cuts: number; raises: number; flat: number; avgDeltaPct: number }>;
  byBedType: Array<{ bed: string; floorplans: number; cuts: number; raises: number; flat: number; avgDeltaPct: number }>;
  byDeveloper: Array<{ developer: string; floorplans: number; cuts: number; raises: number; avgDeltaPct: number }>;
  topCuts: Array<{ project: string; developer: string; city: string; region: string; floorplan: string; bed: string; fromPsf: number; toPsf: number; deltaPct: number }>;
  topRaises: Array<{ project: string; developer: string; city: string; region: string; floorplan: string; bed: string; fromPsf: number; toPsf: number; deltaPct: number }>;
  raisesAboveRebate: Array<{ project: string; developer: string; city: string; floorplan: string; bed: string; deltaPct: number }>;
  projectsMostCuts: Array<{ project: string; developer: string; city: string; region: string; cuts: number; total: number; avgDeltaPct: number; maxCutPct: number | null }>;
  projectsMostRaises: Array<{ project: string; developer: string; city: string; region: string; raises: number; total: number; avgDeltaPct: number; maxRaisePct: number | null }>;
  developersDeepestCuts: Array<{ developer: string; floorplansCut: number; avgCutPct: number; deepestCutPct: number }>;
}

const fmtPct = (n: number, d = 2) => `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`;
const fmtNum = (n: number) => new Intl.NumberFormat("en-CA").format(n);
const fmtDate = (s: string) => s ? new Date(s + "T00:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : "—";

export default function GtaPreconPricingReport() {
  const { data, isLoading, error } = useQuery<PreconReport>({
    queryKey: ["/api/insights/gta-precon-pricing"],
    staleTime: 60 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container max-w-6xl mx-auto px-4 py-20 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading pre-construction pricing report...</p>
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

  const t = data.totals;

  const movementPie = [
    { name: "Cuts", value: t.cuts, color: "hsl(0, 70%, 55%)" },
    { name: "Unchanged", value: t.flat, color: "hsl(220, 10%, 65%)" },
    { name: "Raises", value: t.raises, color: "hsl(150, 55%, 45%)" },
  ];

  const distChart = data.distribution.map(d => ({
    band: d.band,
    count: d.count,
    fill: d.band === "0% (flat)" ? "hsl(220, 10%, 65%)"
      : d.band.startsWith("≤") || d.band.startsWith("−") ? "hsl(0, 70%, 55%)"
      : "hsl(150, 55%, 45%)",
  }));

  const regionChart = data.byRegion.map(r => ({ ...r, name: r.region }));

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="GTA Pre-Construction Pricing Movement Report — Realist.ca"
        description="Floorplan-level analysis of GTA pre-construction price changes. Cuts vs raises, regional breakdown, and what it means for the resale market."
      />
      <Navigation />

      <div className="container max-w-6xl mx-auto px-4 py-8">
        <Link href="/insights" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6" data-testid="link-back-insights">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Insights
        </Link>

        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline">GTA / Ontario</Badge>
            <Badge variant="outline">{fmtDate(data.windowFrom)} – {fmtDate(data.windowTo)}</Badge>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" data-testid="text-report-title">
            GTA Pre-Construction Pricing Movement
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Floorplan-level analysis of {fmtNum(t.floorplans)} active GTA pre-construction units across {fmtNum(t.projects)} projects.
            Cuts outnumber raises by <strong className="text-foreground">{t.cutToRaiseRatio?.toFixed(1) ?? "—"}:1</strong>,
            with the average cut roughly {Math.abs(t.avgCutPct).toFixed(1)}% and the deepest down {Math.abs(t.biggestCutPct).toFixed(1)}%.
            Combined with the new GST/HST rebate, builders look better positioned than resale on price — a likely drag on resale pricing over the next year.
          </p>
        </div>

        {/* Headline stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <Card data-testid="card-stat-floorplans">
            <CardContent className="p-5">
              <div className="text-xs uppercase text-muted-foreground tracking-wide">Floorplans Analyzed</div>
              <div className="text-3xl font-bold mt-2">{fmtNum(t.floorplans)}</div>
              <div className="text-xs text-muted-foreground mt-1">{fmtNum(t.projectsWithMovement)} projects with movement</div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-cuts">
            <CardContent className="p-5">
              <div className="text-xs uppercase text-muted-foreground tracking-wide flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-red-500" /> Cuts
              </div>
              <div className="text-3xl font-bold mt-2 text-red-600 dark:text-red-400">{fmtNum(t.cuts)}</div>
              <div className="text-xs text-muted-foreground mt-1">{t.cutSharePct.toFixed(1)}% of floorplans · avg {Math.abs(t.avgCutPct).toFixed(1)}%</div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-raises">
            <CardContent className="p-5">
              <div className="text-xs uppercase text-muted-foreground tracking-wide flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-emerald-500" /> Raises
              </div>
              <div className="text-3xl font-bold mt-2 text-emerald-600 dark:text-emerald-400">{fmtNum(t.raises)}</div>
              <div className="text-xs text-muted-foreground mt-1">{t.raiseSharePct.toFixed(1)}% of floorplans · avg +{t.avgRaisePct.toFixed(1)}%</div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-ratio">
            <CardContent className="p-5">
              <div className="text-xs uppercase text-muted-foreground tracking-wide">Cut : Raise Ratio</div>
              <div className="text-3xl font-bold mt-2">{t.cutToRaiseRatio?.toFixed(1) ?? "—"}:1</div>
              <div className="text-xs text-muted-foreground mt-1">{fmtNum(t.flat)} unchanged ({t.flatSharePct.toFixed(1)}%)</div>
            </CardContent>
          </Card>
        </div>

        {/* Executive summary */}
        <Card className="mb-10">
          <CardHeader><CardTitle>Executive Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              Across {fmtNum(t.floorplans)} active GTA pre-construction floorplans tracked between {fmtDate(data.windowFrom)} and {fmtDate(data.windowTo)},
              {" "}<strong>{fmtNum(t.cuts)} ({t.cutSharePct.toFixed(1)}%) saw price cuts</strong>, {fmtNum(t.raises)} ({t.raiseSharePct.toFixed(1)}%) saw raises,
              and {fmtNum(t.flat)} ({t.flatSharePct.toFixed(1)}%) were unchanged. For every floorplan that raised, {t.cutToRaiseRatio?.toFixed(1) ?? "—"} were cut.
            </p>
            <p>
              Cuts are also <em>deeper</em> than raises: average cut of {Math.abs(t.avgCutPct).toFixed(2)}% vs average raise of {t.avgRaisePct.toFixed(2)}%.
              The biggest single cut is {Math.abs(t.biggestCutPct).toFixed(1)}%; the biggest raise {t.biggestRaisePct.toFixed(1)}%.
            </p>
            <p>
              This is a market with <strong>weak builder pricing power</strong>. With the new federal GST/HST rebate giving buyers additional effective relief on new builds,
              a builder who simply <em>holds</em> sticker price is already delivering improved affordability — and many are cutting on top of that.
              Net effect: discounted and tax-advantaged new inventory competes directly with resale stock and is likely to weigh on resale prices over the next twelve months.
            </p>
            <p className="text-muted-foreground text-xs">
              Note: of {fmtNum(t.raises)} raises, only <strong>{t.raisesAboveRebate}</strong> exceed the rough {data.rebateBenchmarkPct}% rebate benchmark.
              We do <em>not</em> claim builders are broadly "capturing" the rebate — but the data does support the inverse: discounting and tax-adjusted affordability are both running in the buyer's favour.
            </p>
          </CardContent>
        </Card>

        {/* Charts row 1: pie + distribution */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <Card>
            <CardHeader><CardTitle className="text-base">Movement Mix</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={movementPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e: any) => `${e.name}: ${e.value}`}>
                    {movementPie.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Legend verticalAlign="bottom" />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Distribution of Floorplan PSF Changes</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={distChart} margin={{ top: 5, right: 10, left: 0, bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="band" angle={-35} textAnchor="end" height={70} tick={{ fontSize: 10 }} interval={0} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count">
                    {distChart.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Region chart */}
        <Card className="mb-10">
          <CardHeader><CardTitle className="text-base">Avg Floorplan Δ% by Region</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={regionChart} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)}%`} />
                <ReferenceLine y={0} stroke="#888" />
                <Bar dataKey="avgDeltaPct" fill="hsl(220, 70%, 50%)" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 text-xs text-muted-foreground">
              Negative bars = average price cut across all floorplans in that region.
            </div>
          </CardContent>
        </Card>

        {/* Building category + bed type */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <Card>
            <CardHeader><CardTitle className="text-base">By Building Category</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs text-muted-foreground"><th className="text-left py-2">Category</th><th className="text-right">Floorplans</th><th className="text-right">Cuts</th><th className="text-right">Raises</th><th className="text-right">Avg Δ</th></tr></thead>
                <tbody>
                  {data.byBuildingCategory.map((c) => (
                    <tr key={c.category} className="border-b">
                      <td className="py-2">{c.category}</td>
                      <td className="text-right font-mono">{fmtNum(c.floorplans)}</td>
                      <td className="text-right font-mono text-red-600 dark:text-red-400">{c.cuts}</td>
                      <td className="text-right font-mono text-emerald-600 dark:text-emerald-400">{c.raises}</td>
                      <td className={`text-right font-mono ${c.avgDeltaPct < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>{fmtPct(c.avgDeltaPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">By Bedroom Count</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs text-muted-foreground"><th className="text-left py-2">Beds</th><th className="text-right">Floorplans</th><th className="text-right">Cuts</th><th className="text-right">Raises</th><th className="text-right">Avg Δ</th></tr></thead>
                <tbody>
                  {data.byBedType.slice(0, 12).map((b) => (
                    <tr key={b.bed} className="border-b">
                      <td className="py-2">{b.bed}</td>
                      <td className="text-right font-mono">{fmtNum(b.floorplans)}</td>
                      <td className="text-right font-mono text-red-600 dark:text-red-400">{b.cuts}</td>
                      <td className="text-right font-mono text-emerald-600 dark:text-emerald-400">{b.raises}</td>
                      <td className={`text-right font-mono ${b.avgDeltaPct < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>{fmtPct(b.avgDeltaPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Top cuts and raises */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-500" /> Top 15 PSF Cuts</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b text-muted-foreground"><th className="text-left py-2">Project</th><th className="text-left">Plan</th><th className="text-left">Bed</th><th className="text-right">Δ%</th></tr></thead>
                  <tbody>
                    {data.topCuts.map((f, i) => (
                      <tr key={i} className="border-b" data-testid={`row-top-cut-${i}`}>
                        <td className="py-1.5 truncate max-w-[160px]" title={f.project}>{f.project}</td>
                        <td className="text-muted-foreground truncate max-w-[110px]" title={f.floorplan}>{f.floorplan}</td>
                        <td className="text-muted-foreground">{f.bed}</td>
                        <td className="text-right font-mono text-red-600 dark:text-red-400">{fmtPct(f.deltaPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-500" /> Top 15 PSF Raises</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b text-muted-foreground"><th className="text-left py-2">Project</th><th className="text-left">Plan</th><th className="text-left">Bed</th><th className="text-right">Δ%</th></tr></thead>
                  <tbody>
                    {data.topRaises.map((f, i) => (
                      <tr key={i} className="border-b" data-testid={`row-top-raise-${i}`}>
                        <td className="py-1.5 truncate max-w-[160px]" title={f.project}>{f.project}</td>
                        <td className="text-muted-foreground truncate max-w-[110px]" title={f.floorplan}>{f.floorplan}</td>
                        <td className="text-muted-foreground">{f.bed}</td>
                        <td className={`text-right font-mono ${f.deltaPct > data.rebateBenchmarkPct ? "text-amber-600 dark:text-amber-400 font-bold" : "text-emerald-600 dark:text-emerald-400"}`}>{fmtPct(f.deltaPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.raisesAboveRebate.length > 0 && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    Bold/amber = exceeds the {data.rebateBenchmarkPct}% Ontario HST rebate benchmark ({data.raisesAboveRebate.length} floorplan{data.raisesAboveRebate.length === 1 ? "" : "s"} total).
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects most cuts / raises */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <Card>
            <CardHeader><CardTitle className="text-base">Projects with the Most Cuts</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-xs">
                <thead><tr className="border-b text-muted-foreground"><th className="text-left py-2">Project</th><th className="text-left">City</th><th className="text-right">Cuts</th><th className="text-right">Avg Δ</th></tr></thead>
                <tbody>
                  {data.projectsMostCuts.map((p, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-1.5 truncate max-w-[180px]" title={p.project}>{p.project}</td>
                      <td className="text-muted-foreground">{p.city}</td>
                      <td className="text-right font-mono">{p.cuts}/{p.total}</td>
                      <td className="text-right font-mono text-red-600 dark:text-red-400">{fmtPct(p.avgDeltaPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Projects with the Most Raises</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-xs">
                <thead><tr className="border-b text-muted-foreground"><th className="text-left py-2">Project</th><th className="text-left">City</th><th className="text-right">Raises</th><th className="text-right">Avg Δ</th></tr></thead>
                <tbody>
                  {data.projectsMostRaises.map((p, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-1.5 truncate max-w-[180px]" title={p.project}>{p.project}</td>
                      <td className="text-muted-foreground">{p.city}</td>
                      <td className="text-right font-mono">{p.raises}/{p.total}</td>
                      <td className="text-right font-mono text-emerald-600 dark:text-emerald-400">{fmtPct(p.avgDeltaPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Developers deepest cuts */}
        <Card className="mb-10">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Hammer className="h-4 w-4" /> Developers with the Deepest Average Cuts</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-xs text-muted-foreground"><th className="text-left py-2">Developer</th><th className="text-right">Floorplans Cut</th><th className="text-right">Avg Cut</th><th className="text-right">Deepest Cut</th></tr></thead>
              <tbody>
                {data.developersDeepestCuts.map((d, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2 truncate max-w-[300px]" title={d.developer}>{d.developer}</td>
                    <td className="text-right font-mono">{d.floorplansCut}</td>
                    <td className="text-right font-mono text-red-600 dark:text-red-400">{fmtPct(d.avgCutPct)}</td>
                    <td className="text-right font-mono text-red-600 dark:text-red-400">{fmtPct(d.deepestCutPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Rebate benchmark */}
        <Card className="mb-10 border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Info className="h-4 w-4 text-amber-600" /> Rebate Benchmark Check</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <p>
              Using a rough <strong>{data.rebateBenchmarkPct}%</strong> Ontario HST benchmark, only <strong>{data.raisesAboveRebate.length}</strong> of {fmtNum(t.raises)} raises clearly exceed the rebate threshold.
              That means most price increases would still leave a buyer better off after factoring in improved tax treatment, and the {fmtNum(t.flat)} unchanged floorplans translate into <em>de facto</em> price relief on the same logic.
            </p>
            {data.raisesAboveRebate.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs mt-2">
                  <thead><tr className="border-b text-muted-foreground"><th className="text-left py-2">Project</th><th className="text-left">Floorplan</th><th className="text-left">Bed</th><th className="text-left">City</th><th className="text-right">Δ%</th></tr></thead>
                  <tbody>
                    {data.raisesAboveRebate.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-1.5 truncate max-w-[180px]" title={r.project}>{r.project}</td>
                        <td className="text-muted-foreground truncate max-w-[120px]" title={r.floorplan}>{r.floorplan}</td>
                        <td className="text-muted-foreground">{r.bed}</td>
                        <td className="text-muted-foreground">{r.city}</td>
                        <td className="text-right font-mono text-amber-600 dark:text-amber-400 font-bold">{fmtPct(r.deltaPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              The {data.rebateBenchmarkPct}% number is a rough analytical benchmark, not tax advice. Actual rebate eligibility, claw-backs, and net effective price relief depend on price tier, primary-residence rules, and project-specific incentives.
            </p>
          </CardContent>
        </Card>

        {/* Interpretation */}
        <Card className="mb-10">
          <CardHeader><CardTitle>Interpretation: What This Means for Resale</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              Three things stand out from the data:
            </p>
            <ul className="space-y-2 list-disc pl-5">
              <li><strong>Builder pricing power is weak.</strong> Cuts outnumber raises by {t.cutToRaiseRatio?.toFixed(1) ?? "—"} to 1, and average cuts ({Math.abs(t.avgCutPct).toFixed(1)}%) are deeper than average raises ({t.avgRaisePct.toFixed(1)}%).</li>
              <li><strong>Some builders are aggressively discounting to clear inventory.</strong> The deepest cuts run 15-25% PSF, concentrated in low-rise townhome projects in Durham, Halton, York and Hamilton.</li>
              <li><strong>Unchanged sticker prices still translate to better effective affordability for buyers</strong> once the GST/HST rebate is applied. {t.flatSharePct.toFixed(0)}% of floorplans were flat — that's a passive form of relief on top of active discounting.</li>
            </ul>
            <p>
              For the resale market, this is a headwind. New inventory is now competing on price <em>and</em> tax treatment.
              All else equal, expect downward pressure on resale pricing in the segments and submarkets where new supply is being most aggressively discounted —
              particularly Durham low-rise, Halton mid-rise, and parts of York Region.
            </p>
          </CardContent>
        </Card>

        {/* Methodology */}
        <Card className="mb-10">
          <CardHeader><CardTitle className="text-base">Methodology</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Universe:</strong> all active GTA / Ontario pre-construction floorplans with valid PSF pricing data at both window endpoints.
              Window: <strong className="text-foreground">{fmtDate(data.windowFrom)} → {fmtDate(data.windowTo)}</strong>.
            </p>
            <p>
              <strong className="text-foreground">As-of anchoring:</strong> each floorplan's "from" and "to" PSF is the most recent recorded value on or before the window boundary.
              A 90-day staleness guard excludes floorplans whose anchor predates the window by more than 90 days. A 50% PSF cap excludes moves likely caused by unit remeasurement rather than price changes.
              A 30-day intra-project staleness guard prevents stale single-floorplan anchors from showing up as false price movements.
            </p>
            <p>
              <strong className="text-foreground">Canonical floorplan matching</strong> resolves API ID renumbering across the window so the same physical floorplan is tracked even if its system identifier changed.
            </p>
            <p>
              <strong className="text-foreground">Rebate benchmark:</strong> raises are flagged when the PSF increase exceeds {data.rebateBenchmarkPct}% — a rough proxy for the Ontario HST rebate. This is an analytical filter, not a legal or tax determination.
            </p>
            <p>
              <strong className="text-foreground">Source:</strong> Red Bricks Data Inc. (terminal.redbricks.dev). Floorplan-level dataset reconciled against project-level rollups; project-level numbers verify floorplan-level direction counts.
            </p>
          </CardContent>
        </Card>

        {/* Limitations */}
        <Card className="mb-10">
          <CardHeader><CardTitle className="text-base">Limitations</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>This is not a perfect causal study of the GST/HST rebate. Specifically:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>The exact window boundaries materially affect the cut/raise mix.</li>
              <li>Sticker-price PSF movement is not the same as <em>closed-sale</em> pricing — incentives, deposit structures, capped levies and assignment terms may not be fully captured.</li>
              <li>Unchanged sticker prices may mask economic concessions (free upgrades, capped levies, extended deposit structures, cash credits).</li>
              <li>Some product categories — bespoke single-family, ultra-luxury — are difficult to compare apples-to-apples.</li>
              <li>City and submarket samples vary in size; small-N city averages should be read with care.</li>
            </ul>
            <p className="text-xs">
              Always distinguish between observed price changes, inferred buyer affordability, and broader market interpretation.
            </p>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground py-6">
          Generated {new Date(data.generatedAt).toLocaleString("en-CA")} · Realist.ca research
        </div>
      </div>
    </div>
  );
}
