import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Lock, ArrowLeft, Download, Printer, ExternalLink, ShieldCheck } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Row {
  year: number;
  preconLow: number;
  preconPoint: number;
  preconHigh: number;
  resaleLow: number;
  resalePoint: number;
  resaleHigh: number;
  preconPremiumPct: number;
}

interface ReportData {
  title: string;
  subtitle: string;
  generatedAt: string;
  preparedFor: string;
  footerNote: string;
  executiveSummary: string;
  keyTakeaways: string[];
  rows: Row[];
  methodology: string[];
  whatThisSuggests: string[];
  sources: Array<{ title: string; url: string }>;
  caveats: string[];
}

type FetchState =
  | { status: "loading" }
  | { status: "ok"; data: ReportData }
  | { status: "denied" }
  | { status: "unconfigured" }
  | { status: "error" };

function useReport(key: string): FetchState {
  const [state, setState] = useState<FetchState>({ status: "loading" });

  useEffect(() => {
    if (!key) {
      setState({ status: "denied" });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/insights/precon-vs-resale-1990s?key=${encodeURIComponent(key)}`,
          { credentials: "same-origin" },
        );
        if (cancelled) return;
        if (res.status === 401) {
          setState({ status: "denied" });
          return;
        }
        if (res.status === 503) {
          setState({ status: "unconfigured" });
          return;
        }
        if (!res.ok) {
          setState({ status: "error" });
          return;
        }
        const data = (await res.json()) as ReportData;
        setState({ status: "ok", data });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return state;
}

function PrivateNotice({ reason }: { reason: "denied" | "unconfigured" | "error" }) {
  const messages: Record<typeof reason, { title: string; body: string }> = {
    denied: {
      title: "This is a private client report",
      body: "Access requires a unique link sent directly by Realist.ca. If you believe you should have access, please contact us for the share link.",
    },
    unconfigured: {
      title: "Report access is not yet configured",
      body: "The site administrator has not enabled this report's access token. Please check back shortly.",
    },
    error: {
      title: "Couldn't load this report",
      body: "Something went wrong fetching the report. Please refresh the page or contact us if the problem persists.",
    },
  };
  const { title, body } = messages[reason];
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Private Client Report | Realist.ca"
        description="This Realist.ca research report is private. Access requires a unique share link."
        noIndex
      />
      <Navigation />
      <div className="max-w-2xl mx-auto px-4 py-20">
        <Card data-testid="card-private-notice">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Lock className="h-6 w-6 text-muted-foreground" />
              </div>
              <Badge variant="secondary" className="text-xs">Private Report</Badge>
            </div>
            <CardTitle className="text-2xl" data-testid="text-private-title">{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6" data-testid="text-private-body">{body}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/insights/market-report">
                <Button variant="outline" data-testid="button-back-to-market-report">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Market Report
                </Button>
              </Link>
              <Link href="/about/contact">
                <Button data-testid="button-contact-for-access">
                  Contact for access
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function downloadCsv(rows: Row[]) {
  const header = [
    "Year",
    "Precon Low",
    "Precon Point",
    "Precon High",
    "Resale Low",
    "Resale Point",
    "Resale High",
    "Precon Premium vs Resale (%)",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.year,
        r.preconLow,
        r.preconPoint,
        r.preconHigh,
        r.resaleLow,
        r.resalePoint,
        r.resaleHigh,
        r.preconPremiumPct.toFixed(1),
      ].join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "gta-precon-vs-resale-1985-2000.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ReportBody({ data }: { data: ReportData }) {
  const chartData = useMemo(
    () =>
      data.rows.map((r) => ({
        year: r.year,
        preconBand: [r.preconLow, r.preconHigh],
        resaleBand: [r.resaleLow, r.resaleHigh],
        precon: r.preconPoint,
        resale: r.resalePoint,
      })),
    [data.rows],
  );

  const premiumData = useMemo(
    () =>
      data.rows.map((r) => ({
        year: r.year,
        premium: r.preconPremiumPct,
      })),
    [data.rows],
  );

  const generated = new Date(data.generatedAt).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background print:bg-white">
      <SEO
        title={`${data.title} | Realist.ca`}
        description="Private Realist.ca research report on GTA pre-construction vs resale condo PSF after the 1990s correction."
        noIndex
      />
      <Navigation />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 print:py-4">
        <div className="flex items-center gap-2 mb-3 print:hidden">
          <Badge variant="secondary" className="text-xs flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            Private Client Report
          </Badge>
          <Badge variant="outline" className="text-xs">Prepared for {data.preparedFor}</Badge>
        </div>

        <header className="mb-8" data-testid="section-header">
          <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight" data-testid="text-report-title">
            {data.title}
          </h1>
          <p className="text-lg text-muted-foreground" data-testid="text-report-subtitle">
            {data.subtitle}
          </p>
        </header>

        <div className="flex flex-wrap gap-2 mb-8 print:hidden" data-testid="section-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv(data.rows)}
            data-testid="button-download-csv"
          >
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            data-testid="button-print"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print / Save PDF
          </Button>
          <Link href="/insights/market-report">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Market Report
            </Button>
          </Link>
        </div>

        <Card className="mb-8" data-testid="section-executive-summary">
          <CardHeader>
            <CardTitle>Executive Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed" data-testid="text-executive-summary">
              {data.executiveSummary}
            </p>
          </CardContent>
        </Card>

        <Card className="mb-8" data-testid="section-takeaways">
          <CardHeader>
            <CardTitle>Key Takeaways</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-muted-foreground">
              {data.keyTakeaways.map((t, i) => (
                <li key={i} className="flex gap-3" data-testid={`takeaway-${i}`}>
                  <span className="text-primary font-semibold mt-0.5">→</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-8" data-testid="section-chart-main">
          <CardHeader>
            <CardTitle>Estimated GTA Condo PSF: Pre-Con/New vs Resale, 1985-2000</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[420px]" data-testid="chart-precon-vs-resale">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="year" className="text-xs" />
                  <YAxis
                    className="text-xs"
                    tickFormatter={(v) => `$${v}`}
                    label={{ value: "CAD per sq ft", angle: -90, position: "insideLeft", className: "text-xs" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: unknown, name: string) => {
                      if (Array.isArray(value)) {
                        const [lo, hi] = value as [number, number];
                        return [`$${lo} – $${hi} /sq ft`, name];
                      }
                      return [`$${value} /sq ft`, name];
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="preconBand"
                    stroke="none"
                    fill="hsl(210, 80%, 55%)"
                    fillOpacity={0.15}
                    name="Pre-con confidence band"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="resaleBand"
                    stroke="none"
                    fill="hsl(25, 90%, 55%)"
                    fillOpacity={0.15}
                    name="Resale confidence band"
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="precon"
                    stroke="hsl(210, 80%, 45%)"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    name="Pre-con / new condo PSF"
                  />
                  <Line
                    type="monotone"
                    dataKey="resale"
                    stroke="hsl(25, 90%, 50%)"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    name="Resale condo PSF"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Smoothed lines show point estimates; shaded bands show low–high confidence ranges.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-8" data-testid="section-chart-premium">
          <CardHeader>
            <CardTitle>Estimated Pre-Con Premium / Discount vs Resale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]" data-testid="chart-premium">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={premiumData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="year" className="text-xs" />
                  <YAxis
                    className="text-xs"
                    tickFormatter={(v) => `${v}%`}
                    label={{ value: "Premium %", angle: -90, position: "insideLeft", className: "text-xs" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: unknown) => [`${(value as number).toFixed(1)}%`, "Premium"]}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} />
                  <Bar dataKey="premium" radius={[4, 4, 0, 0]}>
                    {premiumData.map((entry) => (
                      <Cell
                        key={entry.year}
                        fill={entry.premium >= 0 ? "hsl(150, 60%, 40%)" : "hsl(0, 70%, 55%)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Positive values indicate a pre-con premium over resale. Negative values indicate a pre-con discount.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-8" data-testid="section-dataset">
          <CardHeader>
            <CardTitle>Rough Dataset</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-dataset">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-semibold">Year</th>
                    <th className="text-right py-2 px-2 font-semibold">Pre-con Low</th>
                    <th className="text-right py-2 px-2 font-semibold">Pre-con Point</th>
                    <th className="text-right py-2 px-2 font-semibold">Pre-con High</th>
                    <th className="text-right py-2 px-2 font-semibold">Resale Low</th>
                    <th className="text-right py-2 px-2 font-semibold">Resale Point</th>
                    <th className="text-right py-2 px-2 font-semibold">Resale High</th>
                    <th className="text-right py-2 px-2 font-semibold">Premium %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.year} className="border-b last:border-0 hover:bg-muted/40" data-testid={`row-year-${r.year}`}>
                      <td className="py-2 px-2 font-medium">{r.year}</td>
                      <td className="py-2 px-2 text-right font-mono">${r.preconLow}</td>
                      <td className="py-2 px-2 text-right font-mono font-semibold">${r.preconPoint}</td>
                      <td className="py-2 px-2 text-right font-mono">${r.preconHigh}</td>
                      <td className="py-2 px-2 text-right font-mono">${r.resaleLow}</td>
                      <td className="py-2 px-2 text-right font-mono font-semibold">${r.resalePoint}</td>
                      <td className="py-2 px-2 text-right font-mono">${r.resaleHigh}</td>
                      <td
                        className={`py-2 px-2 text-right font-mono font-semibold ${
                          r.preconPremiumPct >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                        }`}
                      >
                        {r.preconPremiumPct >= 0 ? "+" : ""}
                        {r.preconPremiumPct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8" data-testid="section-methodology">
          <CardHeader>
            <CardTitle>Methodology &amp; Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-muted-foreground">
              {data.methodology.map((m, i) => (
                <li key={i} className="flex gap-3" data-testid={`methodology-${i}`}>
                  <span className="text-muted-foreground mt-0.5">•</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-8" data-testid="section-suggests">
          <CardHeader>
            <CardTitle>What This Suggests for Today</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-muted-foreground">
              {data.whatThisSuggests.map((s, i) => (
                <li key={i} className="flex gap-3" data-testid={`suggests-${i}`}>
                  <span className="text-primary font-semibold mt-0.5">→</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-8" data-testid="section-sources">
          <CardHeader>
            <CardTitle>Source Notes &amp; Caveats</CardTitle>
          </CardHeader>
          <CardContent>
            <h3 className="font-semibold mb-2">Sources</h3>
            <ul className="space-y-1.5 text-sm mb-6">
              {data.sources.map((s, i) => (
                <li key={i} data-testid={`source-${i}`}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {s.title}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              ))}
            </ul>
            <h3 className="font-semibold mb-2">Caveats</h3>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {data.caveats.map((c, i) => (
                <li key={i} className="flex gap-2" data-testid={`caveat-${i}`}>
                  <span>•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <footer className="border-t pt-6 text-xs text-muted-foreground" data-testid="text-footer">
          <p className="mb-1">{data.footerNote}</p>
          <p>Generated {generated}.</p>
        </footer>
      </div>
    </div>
  );
}

export default function PreconResale1990sReport() {
  const [location] = useLocation();
  const key = useMemo(() => {
    const queryStart = location.indexOf("?");
    const search = queryStart >= 0 ? location.slice(queryStart) : window.location.search;
    return new URLSearchParams(search).get("key") ?? "";
  }, [location]);

  const state = useReport(key);

  if (state.status === "loading") {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (state.status === "ok") {
    return <ReportBody data={state.data} />;
  }

  return <PrivateNotice reason={state.status} />;
}
