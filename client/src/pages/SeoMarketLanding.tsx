import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ReferenceLine,
} from "recharts";
import { ArrowLeft, TrendingDown, TrendingUp, Minus, AlertCircle, Loader2, BarChart3, Building, ArrowRight } from "lucide-react";
import { Helmet } from "react-helmet-async";

interface ScopeReport {
  scope: string;
  scopeLabel: string;
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
  byCity: Array<{ city: string; region: string; floorplans: number; cuts: number; raises: number; flat: number; avgDeltaPct: number }>;
  byBuildingCategory: Array<{ category: string; floorplans: number; cuts: number; raises: number; flat: number; avgDeltaPct: number }>;
  byBedType: Array<{ bed: string; floorplans: number; cuts: number; raises: number; flat: number; avgDeltaPct: number }>;
  topCuts: Array<{ project: string; developer: string; city: string; region: string; floorplan: string; bed: string; fromPsf: number; toPsf: number; deltaPct: number }>;
  topRaises: Array<{ project: string; developer: string; city: string; region: string; floorplan: string; bed: string; fromPsf: number; toPsf: number; deltaPct: number }>;
  projectsMostCuts: Array<{ project: string; developer: string; city: string; region: string; cuts: number; total: number; avgDeltaPct: number; maxCutPct: number | null }>;
  windowFrom: string;
  windowTo: string;
}

const fmtPct = (n: number, d = 1) => `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`;
const fmtNum = (n: number) => new Intl.NumberFormat("en-CA").format(n);

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/['']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export interface SeoMarketLandingConfig {
  routePath: string;        // e.g. "/toronto-condo-prices-dropping"
  scopeQuery: string;       // e.g. "city=Toronto" or "" for full GTA
  h1: string;               // exact-match keyword H1
  pageTitle: string;        // 60-char title tag
  metaDescription: string;  // 155-char meta
  intro: string;            // direct answer paragraph (data tokens injected)
  contextHeading?: string;  // h2 above intro
  faqs: Array<{ q: string; a: string }>;
  emphasis: "cuts" | "raises" | "balanced";
  internalLinks?: Array<{ href: string; label: string }>;
}

export function SeoMarketLandingPage({ config }: { config: SeoMarketLandingConfig }) {
  const apiUrl = `/api/seo/precon-scope${config.scopeQuery ? `?${config.scopeQuery}` : ""}`;
  const { data, isLoading, error } = useQuery<ScopeReport>({
    queryKey: ["/api/seo/precon-scope", config.scopeQuery],
    queryFn: async () => {
      const r = await fetch(apiUrl);
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
    staleTime: 60 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container max-w-6xl mx-auto px-4 py-20 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading market data...</p>
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
          <p className="text-muted-foreground">Unable to load market data. Please try again shortly.</p>
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
  const cityChart = data.byCity.slice(0, 12).map(c => ({ name: c.city, avg: Number(c.avgDeltaPct.toFixed(2)) }));

  // FAQ JSON-LD
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: config.faqs.map(f => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title={config.pageTitle} description={config.metaDescription} />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqLd).replace(/</g, "\\u003c")}</script>
      </Helmet>
      <Navigation />

      <div className="container max-w-6xl mx-auto px-4 py-8">
        <Link href="/insights" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6" data-testid="link-back-insights">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Insights
        </Link>

        {/* Hero with H1 + direct answer */}
        <div className="mb-8">
          <Badge variant="outline" className="mb-3">Live data · Updated {new Date().toLocaleDateString("en-CA", { month: "short", year: "numeric" })}</Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-4" data-testid="text-h1">{config.h1}</h1>
          <p className="text-lg text-muted-foreground leading-relaxed" data-testid="text-intro">
            {config.intro
              .replace("{{cuts}}", fmtNum(t.cuts))
              .replace("{{raises}}", fmtNum(t.raises))
              .replace("{{floorplans}}", fmtNum(t.floorplans))
              .replace("{{projects}}", fmtNum(t.projects))
              .replace("{{cutShare}}", t.cutSharePct.toFixed(1))
              .replace("{{ratio}}", t.cutToRaiseRatio ? t.cutToRaiseRatio.toFixed(1) : "n/a")
              .replace("{{avgCut}}", Math.abs(t.avgCutPct).toFixed(1))
              .replace("{{biggestCut}}", Math.abs(t.biggestCutPct).toFixed(1))
              .replace("{{scope}}", data.scopeLabel)}
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />} label="Active floorplans" value={fmtNum(t.floorplans)} sub={`${fmtNum(t.projects)} projects`} />
          <StatCard icon={<TrendingDown className="h-4 w-4 text-red-500" />} label="Price cuts" value={fmtNum(t.cuts)} sub={`${t.cutSharePct.toFixed(1)}% of plans`} />
          <StatCard icon={<TrendingUp className="h-4 w-4 text-green-600" />} label="Price raises" value={fmtNum(t.raises)} sub={`${t.raiseSharePct.toFixed(1)}% of plans`} />
          <StatCard icon={<Minus className="h-4 w-4 text-muted-foreground" />} label="Cut : raise" value={t.cutToRaiseRatio ? `${t.cutToRaiseRatio.toFixed(1)} : 1` : "—"} sub={`Avg cut ${fmtPct(t.avgCutPct, 1)}`} />
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardHeader><CardTitle className="text-base">Movement breakdown</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={movementPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {movementPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Avg PSF change by city</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={cityChart} margin={{ left: 0, right: 8, top: 10, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-30} textAnchor="end" height={60} interval={0} fontSize={11} />
                  <YAxis tickFormatter={(v) => `${v}%`} fontSize={11} />
                  <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)}%`} />
                  <ReferenceLine y={0} stroke="#888" />
                  <Bar dataKey="avg">
                    {cityChart.map((c, i) => <Cell key={i} fill={c.avg < 0 ? "hsl(0,70%,55%)" : "hsl(150,55%,45%)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Top moves table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">{config.emphasis === "raises" ? "Biggest price raises" : "Biggest price cuts"}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th scope="col" className="px-4 py-2">Project</th>
                    <th scope="col" className="px-4 py-2">Floorplan</th>
                    <th scope="col" className="px-4 py-2">City</th>
                    <th scope="col" className="px-4 py-2 text-right">From PSF</th>
                    <th scope="col" className="px-4 py-2 text-right">To PSF</th>
                    <th scope="col" className="px-4 py-2 text-right">Δ%</th>
                  </tr>
                </thead>
                <tbody>
                  {(config.emphasis === "raises" ? data.topRaises : data.topCuts).slice(0, 10).map((r, i) => {
                    const slug = slugify(`${r.project}-${r.city}`);
                    return (
                      <tr key={i} className="border-t hover:bg-muted/30" data-testid={`row-move-${i}`}>
                        <td className="px-4 py-2">
                          <Link href={`/projects/${slug}`} className="text-primary hover:underline" data-testid={`link-project-${slug}`}>{r.project}</Link>
                          <div className="text-xs text-muted-foreground">{r.developer}</div>
                        </td>
                        <td className="px-4 py-2">{r.floorplan} <span className="text-xs text-muted-foreground">{r.bed}</span></td>
                        <td className="px-4 py-2">{r.city}</td>
                        <td className="px-4 py-2 text-right tabular-nums">${r.fromPsf.toFixed(0)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">${r.toPsf.toFixed(0)}</td>
                        <td className={`px-4 py-2 text-right font-mono ${r.deltaPct < 0 ? "text-red-600" : "text-green-600"}`}>{fmtPct(r.deltaPct, 1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Projects with most cuts */}
        {data.projectsMostCuts.length > 0 && (
          <Card className="mb-8">
            <CardHeader><CardTitle className="text-base">Projects with the most price cuts</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th scope="col" className="px-4 py-2">Project</th>
                      <th scope="col" className="px-4 py-2">City</th>
                      <th scope="col" className="px-4 py-2 text-right">Cuts / Total</th>
                      <th scope="col" className="px-4 py-2 text-right">Avg Δ%</th>
                      <th scope="col" className="px-4 py-2 text-right">Deepest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.projectsMostCuts.slice(0, 10).map((p, i) => {
                      const slug = slugify(`${p.project}-${p.city}`);
                      return (
                        <tr key={i} className="border-t hover:bg-muted/30">
                          <td className="px-4 py-2">
                            <Link href={`/projects/${slug}`} className="text-primary hover:underline">{p.project}</Link>
                            <div className="text-xs text-muted-foreground">{p.developer}</div>
                          </td>
                          <td className="px-4 py-2">{p.city}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{p.cuts} / {p.total}</td>
                          <td className={`px-4 py-2 text-right font-mono ${p.avgDeltaPct < 0 ? "text-red-600" : "text-green-600"}`}>{fmtPct(p.avgDeltaPct, 1)}</td>
                          <td className="px-4 py-2 text-right font-mono text-red-600">{p.maxCutPct != null ? fmtPct(p.maxCutPct, 1) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* FAQ */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Frequently asked questions</h2>
          <div className="space-y-4">
            {config.faqs.map((f, i) => (
              <Card key={i}>
                <CardContent className="pt-4">
                  <h3 className="font-semibold mb-2">{f.q}</h3>
                  <p className="text-muted-foreground">{f.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Internal links */}
        {config.internalLinks && config.internalLinks.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-3">Related research</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {config.internalLinks.map((l, i) => (
                <Link key={i} href={l.href} className="block p-4 rounded-lg border hover:border-primary hover:bg-muted/30 transition" data-testid={`link-related-${i}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{l.label}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg mb-1">Run the numbers on a real deal</h3>
              <p className="text-sm text-muted-foreground">Free Canadian rental property analyzer. Cap rate, cash-on-cash, IRR, BRRR — in seconds.</p>
            </div>
            <Link href="/tools/analyzer">
              <Button data-testid="button-cta-analyzer">Open Deal Analyzer</Button>
            </Link>
          </CardContent>
        </Card>

        <p className="mt-6 text-xs text-muted-foreground">
          Source: Realist.ca analysis of Red Bricks Data (redbricksdata.com) and Valery.ca floorplan datasets. Window: {data.windowFrom || "—"} to {data.windowTo || "—"}.
        </p>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">{icon}{label}</div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
