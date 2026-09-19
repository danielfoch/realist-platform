/**
 * The hosted, interactive version of an agent underwriting.
 *
 * The document carries the exact BuyHoldInputs the agent's numbers came from.
 * Everything on screen is recomputed in the browser with the shared buy & hold
 * engine, so editing an assumption re-underwrites the deal instantly — and the
 * Excel download is rebuilt from whatever the visitor has on screen.
 */
import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, RotateCcw, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProformaTable } from "@/components/ProformaTable";
import { AnalysisCharts } from "@/components/AnalysisCharts";
import { useToast } from "@/hooks/use-toast";
import { calculateBuyHoldAnalysis, calculateStressTest, formatCurrency } from "@/lib/calculations";
import type { AnalysisResults, BuyHoldInputs } from "@shared/schema";
import type { UnderwritingViewDocument } from "@shared/agentViews";
import { ViewLinks } from "./ViewChrome";

type PublicUnderwritingDocument = Omit<UnderwritingViewDocument, "analysisId">;

type NumericInputKey = {
  [K in keyof BuyHoldInputs]: BuyHoldInputs[K] extends number ? K : never;
}[keyof BuyHoldInputs];

interface FieldSpec {
  key: NumericInputKey;
  label: string;
  unit: "$" | "%" | "yrs";
  min: number;
  max: number;
  step: number;
  hint?: string;
}

const FIELD_GROUPS: Array<{ title: string; fields: FieldSpec[] }> = [
  {
    title: "Purchase & financing",
    fields: [
      { key: "purchasePrice", label: "Purchase price", unit: "$", min: 0, max: 100_000_000, step: 5000 },
      { key: "closingCosts", label: "Closing costs", unit: "$", min: 0, max: 10_000_000, step: 500 },
      { key: "downPaymentPercent", label: "Down payment", unit: "%", min: 0, max: 100, step: 1 },
      { key: "interestRate", label: "Interest rate", unit: "%", min: 0, max: 25, step: 0.05 },
      { key: "amortizationYears", label: "Amortization", unit: "yrs", min: 1, max: 40, step: 1 },
    ],
  },
  {
    title: "Income",
    fields: [
      { key: "monthlyRent", label: "Monthly rent (all units)", unit: "$", min: 0, max: 1_000_000, step: 50 },
      { key: "vacancyPercent", label: "Vacancy", unit: "%", min: 0, max: 50, step: 0.5 },
      { key: "rentGrowthPercent", label: "Rent growth / yr", unit: "%", min: -10, max: 20, step: 0.25 },
    ],
  },
  {
    title: "Operating expenses",
    fields: [
      { key: "propertyTax", label: "Property tax / yr", unit: "$", min: 0, max: 1_000_000, step: 100 },
      { key: "insurance", label: "Insurance / yr", unit: "$", min: 0, max: 1_000_000, step: 100 },
      { key: "utilities", label: "Utilities / mo", unit: "$", min: 0, max: 100_000, step: 25, hint: "Owner-paid only" },
      { key: "maintenancePercent", label: "Maintenance", unit: "%", min: 0, max: 100, step: 0.5, hint: "% of rent" },
      { key: "managementPercent", label: "Management", unit: "%", min: 0, max: 100, step: 0.5, hint: "% of rent" },
      { key: "capexReservePercent", label: "CapEx reserve", unit: "%", min: 0, max: 100, step: 0.5, hint: "% of rent" },
      { key: "otherExpenses", label: "Other / mo", unit: "$", min: 0, max: 100_000, step: 25 },
      { key: "expenseInflationPercent", label: "Expense inflation / yr", unit: "%", min: -10, max: 20, step: 0.25 },
    ],
  },
  {
    title: "Exit",
    fields: [
      { key: "appreciationPercent", label: "Appreciation / yr", unit: "%", min: -10, max: 20, step: 0.25 },
      { key: "holdingPeriodYears", label: "Holding period", unit: "yrs", min: 1, max: 30, step: 1 },
      { key: "sellingCostsPercent", label: "Selling costs", unit: "%", min: 0, max: 20, step: 0.5 },
    ],
  },
];

const RENT_SOURCE_LABEL: Record<UnderwritingViewDocument["rent"]["source"], string> = {
  provided: "Rent supplied by you",
  actual: "Actual rent from the listing",
  realist_estimate: "Rent estimated by Realist",
  fallback_table: "Placeholder rent — replace it",
};

/**
 * A number input that tolerates half-typed values ("5.", "-", "") without
 * fighting the user: it keeps its own text and only commits finite numbers.
 */
function NumberField({ spec, value, original, onCommit }: { spec: FieldSpec; value: number; original: number; onCommit: (next: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    // Follow external changes (reset), but never clobber what is being typed.
    setText((current) => (Number(current) === value ? current : String(value)));
  }, [value]);

  const changed = value !== original;
  const id = `assumption-${spec.key}`;
  return (
    <div className="grid grid-cols-[1fr_8.5rem] items-center gap-3">
      <Label htmlFor={id} className="text-sm font-normal leading-tight">
        {spec.label}
        {spec.hint && <span className="block text-xs text-muted-foreground">{spec.hint}</span>}
      </Label>
      <div className="relative">
        {spec.unit === "$" && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>}
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={text}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          onChange={(event) => {
            setText(event.target.value);
            const next = Number(event.target.value);
            if (event.target.value.trim() !== "" && Number.isFinite(next)) {
              onCommit(Math.min(spec.max, Math.max(spec.min, next)));
            }
          }}
          onBlur={() => setText(String(value))}
          className={`h-9 font-mono text-sm text-right ${spec.unit === "$" ? "pl-6" : ""} ${spec.unit === "$" ? "pr-2.5" : "pr-9"} ${changed ? "border-primary/60 bg-primary/5" : ""}`}
          data-testid={`input-${spec.key}`}
        />
        {spec.unit !== "$" && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{spec.unit}</span>}
      </div>
    </div>
  );
}

function percent(value: number | null, decimals = 2): string {
  return value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(decimals)}%`;
}

function Kpi({ label, value, was, tone, testId }: { label: string; value: string; was?: string | null; tone?: "good" | "bad"; testId: string }) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`mt-1.5 font-mono text-xl sm:text-2xl font-bold whitespace-nowrap ${tone === "good" ? "text-emerald-600 dark:text-emerald-400" : tone === "bad" ? "text-red-600 dark:text-red-400" : ""}`}>
          {value}
        </div>
        {was && <div className="mt-0.5 text-xs text-muted-foreground">agent reported {was}</div>}
      </CardContent>
    </Card>
  );
}

function kpiValues(results: AnalysisResults) {
  return {
    capRate: percent(results.capRate),
    cashOnCash: percent(results.cashOnCash),
    cashFlow: `${formatCurrency(results.monthlyCashFlow)}/mo`,
    dscr: Number.isFinite(results.dscr) && results.dscr > 0 ? `${results.dscr.toFixed(2)}x` : "n/a",
    irr: percent(results.irr, 1),
    cashIn: formatCurrency(results.totalCashInvested),
  };
}

export function UnderwritingView({ token, document }: { token: string; document: PublicUnderwritingDocument }) {
  const { toast } = useToast();
  const original = document.inputs;
  const [inputs, setInputs] = useState<BuyHoldInputs>(original);
  const [downloading, setDownloading] = useState(false);

  const results = useMemo(() => calculateBuyHoldAnalysis(inputs), [inputs]);
  const originalResults = useMemo(() => calculateBuyHoldAnalysis(original), [original]);
  const stress = useMemo(() => calculateStressTest(inputs), [inputs]);
  const edited = useMemo(() => FIELD_GROUPS.some((group) => group.fields.some((f) => inputs[f.key] !== original[f.key])), [inputs, original]);

  const now = kpiValues(results);
  const before = kpiValues(originalResults);
  const was = (key: keyof typeof now) => (edited && now[key] !== before[key] ? before[key] : null);

  async function downloadExcel() {
    setDownloading(true);
    try {
      // Edited assumptions → the server rebuilds the workbook from what is on screen.
      const response = edited
        ? await fetch(`/api/views/${token}/model.xlsx`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inputs }) })
        : await fetch(`/api/views/${token}/model.xlsx`);
      if (!response.ok) throw new Error(`Export failed (${response.status})`);
      const filename = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") || "")?.[1] || "realist-model.xlsx";
      const url = URL.createObjectURL(await response.blob());
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({ title: "Could not build the Excel model", description: error?.message || "Try again in a moment.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  }

  const { property } = document;
  return (
    <main className="max-w-7xl mx-auto px-4 md:px-6 py-8" data-testid="underwriting-view">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-view-title">{document.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {document.subtitle && <span>{document.subtitle}</span>}
            {property.listPrice != null && <span>· Listed at {formatCurrency(property.listPrice)}</span>}
            <Badge variant={document.rent.source === "fallback_table" ? "destructive" : "outline"} className="font-normal">
              {RENT_SOURCE_LABEL[document.rent.source]}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button onClick={downloadExcel} disabled={downloading} className="gap-2" data-testid="button-download-xlsx">
            <FileSpreadsheet className="h-4 w-4" />
            {downloading ? "Building…" : edited ? "Download Excel (your edits)" : "Download Excel model"}
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <a href={`/api/views/${token}/proforma.csv`} data-testid="link-download-csv">
              <Download className="h-4 w-4" />
              CSV
            </a>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" data-testid="view-kpis">
        <Kpi testId="kpi-cap-rate" label="Cap rate" value={now.capRate} was={was("capRate")} />
        <Kpi testId="kpi-cash-on-cash" label="Cash-on-cash" value={now.cashOnCash} was={was("cashOnCash")} tone={results.cashOnCash >= 0 ? "good" : "bad"} />
        <Kpi testId="kpi-cash-flow" label="Cash flow" value={now.cashFlow} was={was("cashFlow")} tone={results.monthlyCashFlow >= 0 ? "good" : "bad"} />
        <Kpi testId="kpi-dscr" label="DSCR" value={now.dscr} was={was("dscr")} tone={!Number.isFinite(results.dscr) || results.dscr === 0 ? undefined : results.dscr >= 1.2 ? "good" : results.dscr < 1 ? "bad" : undefined} />
        <Kpi testId="kpi-irr" label={`${inputs.holdingPeriodYears}-yr IRR`} value={now.irr} was={was("irr")} />
        <Kpi testId="kpi-cash-invested" label="Cash invested" value={now.cashIn} was={was("cashIn")} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] items-start">
        <Card className="lg:sticky lg:top-20 print:hidden" data-testid="assumptions-panel">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Assumptions</CardTitle>
            {edited && (
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setInputs(original)} data-testid="button-reset-assumptions">
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to agent's
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-5 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto">
            <p className="text-xs text-muted-foreground leading-5">
              Change any number — the pro forma, charts and stress test recalculate as you type.
            </p>
            {FIELD_GROUPS.map((group) => (
              <div key={group.title} className="space-y-2.5">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</div>
                {group.fields.map((spec) => (
                  <NumberField
                    key={spec.key}
                    spec={spec}
                    value={inputs[spec.key]}
                    original={original[spec.key]}
                    onCommit={(next) => setInputs((current) => ({ ...current, [spec.key]: spec.unit === "yrs" ? Math.round(next) : next }))}
                  />
                ))}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="min-w-0">
          <Tabs defaultValue="proforma">
            <TabsList className="print:hidden">
              <TabsTrigger value="proforma" data-testid="tab-proforma">Pro forma</TabsTrigger>
              <TabsTrigger value="charts" data-testid="tab-charts">Charts</TabsTrigger>
              <TabsTrigger value="stress" data-testid="tab-stress">Stress test</TabsTrigger>
              <TabsTrigger value="notes" data-testid="tab-notes">
                Notes{document.assumptionNotes.length ? ` (${document.assumptionNotes.length})` : ""}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="proforma" className="mt-0">
              <ProformaTable results={results} inputs={inputs} />
            </TabsContent>

            <TabsContent value="charts" className="mt-4">
              <AnalysisCharts results={results} />
            </TabsContent>

            <TabsContent value="stress" className="mt-4">
              <div className="grid gap-4 md:grid-cols-3" data-testid="stress-test">
                {([stress.bear, stress.base, stress.bull] as const).map((scenario) => (
                  <Card key={scenario.label}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{scenario.label}</CardTitle>
                      <p className="text-xs text-muted-foreground leading-5">{scenario.description}</p>
                    </CardHeader>
                    <CardContent>
                      <dl className="space-y-2 text-sm">
                        {[
                          ["Rent", `${formatCurrency(scenario.monthlyRent)}/mo`],
                          ["Vacancy", percent(scenario.vacancyPercent, 1)],
                          ["Interest rate", percent(scenario.interestRate)],
                          ["Cap rate", percent(scenario.capRate)],
                          ["Cash-on-cash", percent(scenario.cashOnCash)],
                          ["DSCR", Number.isFinite(scenario.dscr) && scenario.dscr > 0 ? `${scenario.dscr.toFixed(2)}x` : "n/a"],
                        ].map(([label, value]) => (
                          <div key={label} className="flex justify-between gap-3">
                            <dt className="text-muted-foreground">{label}</dt>
                            <dd className="font-mono">{value}</dd>
                          </div>
                        ))}
                        <div className="flex justify-between gap-3 border-t pt-2 font-semibold">
                          <dt>Annual cash flow</dt>
                          <dd className={`font-mono ${scenario.annualCashFlow >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                            {formatCurrency(scenario.annualCashFlow)}
                          </dd>
                        </div>
                      </dl>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="notes" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TriangleAlert className="h-4 w-4 text-amber-500" />
                    What was assumed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {document.assumptionNotes.length ? (
                    <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-6" data-testid="assumption-notes">
                      {document.assumptionNotes.map((note) => <li key={note}>{note}</li>)}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Every assumption was supplied by you or your agent — nothing was estimated.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Card className="mt-8 border-primary/30 bg-primary/5 print:hidden">
        <CardContent className="p-5 md:p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold">Does this deal pencil?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Take it further in the full analyzer, or have Realist's Deal Desk pressure-test the numbers and line up financing.
            </p>
          </div>
          <ViewLinks links={document.links} />
        </CardContent>
      </Card>
    </main>
  );
}
