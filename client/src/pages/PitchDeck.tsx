/**
 * Investor pitch deck — a print-first deck generated from one of the user's
 * property_analyses rows (route: /analyses/:id/deck).
 *
 * Slides: cover → factual thesis → key-number tiles (only metrics that exist
 * in calculated_metrics, with snake/camel aliases) → assumptions → notes (if
 * present) → disclaimer. The Print button fires the live report-export
 * analytics event, then window.print(); print CSS hides nav/toolbar and keeps
 * each slide unbroken.
 *
 * Ported from the idx app's DealPitchDeckPage, adapted to wouter, shadcn,
 * the live session auth, and react-query.
 */

import { useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { authPath } from "@/lib/authReturn";
import { track } from "@/lib/analytics";
import { ArrowLeft, Printer } from "lucide-react";

interface DeckAnalysis {
  id: string;
  address: string;
  city: string | null;
  province: string | null;
  propertyType: string | null;
  listingMlsNumber: string;
  listingPrice: number | null;
  summary: string | null;
  sentiment: string | null;
  userNotes: string | null;
  calculatedMetrics: Record<string, unknown> | null;
  finalAssumptions: Record<string, unknown> | null;
  assumptions: Record<string, unknown> | null;
  createdAt: string;
  ownerName: string | null;
}

/** Key-number tiles — rendered only when the metric exists under any alias. */
const METRIC_TILES: Array<{ label: string; aliases: string[]; format: "currency" | "percent" | "ratio" }> = [
  { label: "Monthly Cash Flow", aliases: ["monthlyCashFlow", "cash_flow_monthly", "monthly_cash_flow"], format: "currency" },
  { label: "Annual Cash Flow", aliases: ["annualCashFlow", "cash_flow_annual", "annual_cash_flow"], format: "currency" },
  { label: "Cap Rate", aliases: ["capRate", "cap_rate"], format: "percent" },
  { label: "Cash-on-Cash", aliases: ["cashOnCash", "cash_on_cash", "coc"], format: "percent" },
  { label: "DSCR", aliases: ["dscr"], format: "ratio" },
  { label: "IRR", aliases: ["irr"], format: "percent" },
  { label: "NOI (Annual)", aliases: ["annualNoi", "noi", "net_operating_income"], format: "currency" },
  { label: "Gross Yield", aliases: ["grossYield", "gross_yield"], format: "percent" },
  { label: "Total Cash Invested", aliases: ["totalCashInvested", "total_cash_invested", "cash_required"], format: "currency" },
  { label: "Max Offer Price", aliases: ["maxOfferPrice", "max_offer_price"], format: "currency" },
];

function metricValue(metrics: Record<string, unknown>, aliases: string[]): number | null {
  for (const key of aliases) {
    const value = Number(metrics[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function formatMetric(value: number, format: "currency" | "percent" | "ratio"): string {
  if (format === "currency") {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);
  }
  if (format === "percent") {
    // Values may arrive as 0.062 or 6.2 — normalize fractions to percent.
    const pct = Math.abs(value) <= 1 ? value * 100 : value;
    return `${pct.toFixed(1)}%`;
  }
  return `${value.toFixed(2)}x`;
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatAssumption(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "number") {
    return Math.abs(value) >= 1000
      ? new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(value)
      : new Intl.NumberFormat("en-CA", { maximumFractionDigits: 2 }).format(value);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function PitchDeck() {
  const { id = "" } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation(authPath("/login", `/analyses/${id}/deck`));
    }
  }, [user, authLoading, setLocation, id]);

  const { data: payload, isLoading, isError } = useQuery<{ success: boolean; data: DeckAnalysis }>({
    queryKey: [`/api/my/analyses/${id}`],
    enabled: !!user && !!id,
    retry: 1,
  });
  const analysis = payload?.data;

  const handlePrint = () => {
    // Same report-export analytics event the analyzer's PDF export fires.
    track({ event: "analyzer_exported", format: "pdf" });
    window.print();
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-12 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const metrics = (analysis?.calculatedMetrics || {}) as Record<string, unknown>;
  const tiles = METRIC_TILES.flatMap((tile) => {
    const value = metricValue(metrics, tile.aliases);
    return value === null ? [] : [{ label: tile.label, format: tile.format, value }];
  });
  const assumptionEntries = Object.entries(
    (analysis?.finalAssumptions || analysis?.assumptions || {}) as Record<string, unknown>,
  ).filter(([, value]) => value != null && value !== "" && typeof value !== "object");

  const locationLine = [analysis?.city, analysis?.province].filter(Boolean).join(", ");
  const analyzedDate = analysis ? new Date(analysis.createdAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }) : "";

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Investor Pitch Deck | Realist.ca" description="Print-ready investor pitch deck for your property analysis." />
      {/* Hidden when printing */}
      <div className="print:hidden">
        <Navigation />
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 print:py-0 print:px-0 print:max-w-none">
        {/* Toolbar — hidden when printing */}
        <div className="flex items-center justify-between mb-6 print:hidden" data-testid="deck-toolbar">
          <Link href="/my-performance">
            <Button variant="ghost" size="sm" className="gap-1.5" data-testid="button-deck-back">
              <ArrowLeft className="h-4 w-4" />
              Back to My Performance
            </Button>
          </Link>
          <Button onClick={handlePrint} className="gap-2" disabled={!analysis} data-testid="button-deck-print">
            <Printer className="h-4 w-4" />
            Print Deck
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4 print:hidden">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
        ) : isError || !analysis ? (
          <Card className="max-w-md mx-auto mt-12 print:hidden" data-testid="card-deck-error">
            <CardContent className="p-6 text-center">
              <h2 className="text-lg font-semibold mb-2">Analysis not found</h2>
              <p className="text-sm text-muted-foreground mb-4">
                This analysis doesn't exist or doesn't belong to your account.
              </p>
              <Link href="/my-performance">
                <Button>Back to My Performance</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6 print:space-y-0">
            {/* Slide 1 — Cover */}
            <section
              className="rounded-xl border bg-card p-10 print:rounded-none print:border-0 print:min-h-[90vh] print:flex print:flex-col print:justify-center break-inside-avoid"
              data-testid="slide-cover"
            >
              <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">Investment Opportunity</p>
              <h1 className="text-4xl font-bold mb-2">{analysis.address}</h1>
              {locationLine && <p className="text-xl text-muted-foreground mb-6">{locationLine}</p>}
              <div className="space-y-1 text-sm text-muted-foreground">
                {analysis.propertyType && <p>Property type: <span className="text-foreground font-medium">{formatLabel(analysis.propertyType)}</span></p>}
                {analysis.listingPrice != null && (
                  <p>List price: <span className="text-foreground font-medium">{formatMetric(analysis.listingPrice, "currency")}</span></p>
                )}
                <p>MLS: <span className="text-foreground font-medium">{analysis.listingMlsNumber}</span></p>
                <p>Prepared {analyzedDate}{analysis.ownerName ? ` by ${analysis.ownerName}` : ""} · Realist.ca</p>
              </div>
            </section>

            {/* Slide 2 — Thesis (factual, from the saved analysis only) */}
            <section className="rounded-xl border bg-card p-10 print:rounded-none print:border-0 break-inside-avoid" data-testid="slide-thesis">
              <h2 className="text-2xl font-bold mb-4">Investment Thesis</h2>
              {analysis.summary ? (
                <p className="text-base leading-relaxed">{analysis.summary}</p>
              ) : (
                <p className="text-base leading-relaxed">
                  This deck summarizes the underwriting saved for {analysis.address}
                  {locationLine ? ` in ${locationLine}` : ""}. All figures below are the model
                  outputs and assumptions recorded at the time of analysis
                  {analysis.sentiment ? `; the analyst marked this deal "${formatLabel(analysis.sentiment)}"` : ""}.
                </p>
              )}
            </section>

            {/* Slide 3 — Key numbers (only metrics present in calculated_metrics) */}
            {tiles.length > 0 && (
              <section className="rounded-xl border bg-card p-10 print:rounded-none print:border-0 break-inside-avoid" data-testid="slide-metrics">
                <h2 className="text-2xl font-bold mb-6">Key Numbers</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {tiles.map((tile) => (
                    <div key={tile.label} className="rounded-lg bg-muted/50 p-4" data-testid={`tile-${tile.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{tile.label}</p>
                      <p className="text-2xl font-bold">{formatMetric(tile.value, tile.format)}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Slide 4 — Assumptions */}
            {assumptionEntries.length > 0 && (
              <section className="rounded-xl border bg-card p-10 print:rounded-none print:border-0 break-inside-avoid" data-testid="slide-assumptions">
                <h2 className="text-2xl font-bold mb-6">Underwriting Assumptions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-2">
                  {assumptionEntries.map(([key, value]) => (
                    <div key={key} className="flex items-baseline justify-between gap-4 border-b border-border/60 py-1.5">
                      <span className="text-sm text-muted-foreground">{formatLabel(key)}</span>
                      <span className="text-sm font-medium">{formatAssumption(value)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Slide 5 — Notes (only when present) */}
            {analysis.userNotes && (
              <section className="rounded-xl border bg-card p-10 print:rounded-none print:border-0 break-inside-avoid" data-testid="slide-notes">
                <h2 className="text-2xl font-bold mb-4">Analyst Notes</h2>
                <p className="text-base leading-relaxed whitespace-pre-wrap">{analysis.userNotes}</p>
              </section>
            )}

            {/* Slide 6 — Disclaimer */}
            <section className="rounded-xl border bg-card p-10 print:rounded-none print:border-0 break-inside-avoid" data-testid="slide-disclaimer">
              <h2 className="text-lg font-bold mb-3">Disclaimer</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This document was generated by Realist.ca from user-entered assumptions and automated
                model outputs. It is provided for informational purposes only and does not constitute
                investment, legal, tax, or accounting advice, nor an offer to sell or a solicitation to
                buy any security or property. Figures are estimates, are not guaranteed, and may differ
                materially from actual results. Verify all numbers independently and consult qualified
                professionals before making any investment decision.
              </p>
            </section>
          </div>
        )}
      </div>

      {/* Print rules: hide chrome, keep slides unbroken */}
      <style>{`
        @media print {
          nav, header, footer { display: none !important; }
          section { break-inside: avoid; page-break-inside: avoid; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}
