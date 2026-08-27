import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DevelopmentConcept,
  MultiplexDevelopmentReport,
  ProjectTimelinePhase,
  TimelineCategory,
} from "@shared/multiplexFeasibilityReport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  Banknote,
  Building2,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Home,
  Image as ImageIcon,
  Layers3,
  Loader2,
  RefreshCw,
  Ruler,
  Sparkles,
  TrainFront,
} from "lucide-react";

interface FeasibilityDevelopmentReportProps {
  report: MultiplexDevelopmentReport;
}

const MONEY = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

const CATEGORY_LABEL: Record<TimelineCategory, string> = {
  acquisition: "Acquisition",
  design_approvals: "Design & approvals",
  financing: "Financing",
  construction: "Construction",
  lease_up: "Lease-up",
  takeout: "CMHC takeout",
};

const CATEGORY_STYLE: Record<TimelineCategory, string> = {
  acquisition: "bg-slate-700 dark:bg-slate-300",
  design_approvals: "bg-violet-600 dark:bg-violet-400",
  financing: "bg-blue-600 dark:bg-blue-400",
  construction: "bg-amber-600 dark:bg-amber-400",
  lease_up: "bg-emerald-600 dark:bg-emerald-400",
  takeout: "bg-cyan-700 dark:bg-cyan-400",
};

const CATEGORY_TEXT: Record<TimelineCategory, string> = {
  acquisition: "text-slate-700 dark:text-slate-300",
  design_approvals: "text-violet-700 dark:text-violet-300",
  financing: "text-blue-700 dark:text-blue-300",
  construction: "text-amber-700 dark:text-amber-300",
  lease_up: "text-emerald-700 dark:text-emerald-300",
  takeout: "text-cyan-700 dark:text-cyan-300",
};

function pct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function money(value: number | null): string {
  return value == null ? "Not included" : MONEY.format(value);
}

function Metric({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className={`rounded-xl border p-3 ${tone === "good"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : tone === "warn"
        ? "border-amber-500/30 bg-amber-500/5"
        : "border-border/60 bg-muted/20"}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold font-mono tracking-tight">{value}</p>
      {note && <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}

function SitePlan({ concept }: { concept: DevelopmentConcept }) {
  const plan = concept.sitePlan;
  const lotDepth = plan.lotDepthFt;
  const lotFrontage = plan.lotFrontageFt;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Calculated concept site plan</p>
          <p className="text-xs text-muted-foreground">
            Street at left · rear of lot at right · width exaggerated for legibility
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{lotFrontage} ft frontage</Badge>
          <Badge variant="outline">{lotDepth} ft depth</Badge>
          <Badge variant="outline">{pct(plan.calculatedCoverageRatio)} shown coverage</Badge>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="min-w-[680px]">
          <div className="mb-2 grid grid-cols-[64px_1fr_56px] items-end text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="text-center">Street</span>
            <div className="relative h-5 border-b border-border/60">
              <span className="absolute left-1/2 -translate-x-1/2 bg-background px-2 normal-case tracking-normal">
                {lotDepth} ft lot depth
              </span>
            </div>
            <span className="text-center">{plan.laneDepthFt ? "Lane" : "Rear"}</span>
          </div>

          <div className="grid grid-cols-[64px_1fr_56px]">
            <div className="flex items-center justify-center rounded-l-xl border-y border-l border-border/70 bg-slate-100 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 [writing-mode:vertical-rl] dark:bg-slate-900 dark:text-slate-400">
              Public street
            </div>

            <div className="relative h-[280px] overflow-hidden border border-border/70 bg-[#eef2e5] dark:bg-[#172016]">
              <div
                className="absolute inset-y-0 border-r border-dashed border-emerald-700/35 bg-emerald-100/40 dark:bg-emerald-900/10"
                style={{ width: `${(plan.setbacks.frontFt / lotDepth) * 100}%` }}
              >
                <span className="absolute bottom-1 left-1 text-[9px] text-emerald-900/60 dark:text-emerald-200/60">
                  {plan.setbacks.frontFt}′ front
                </span>
              </div>

              {plan.buildings.map((building) => {
                const left = (building.offsetTopFt / lotDepth) * 100;
                const top = (building.offsetLeftFt / lotFrontage) * 100;
                const width = (building.depthFt / lotDepth) * 100;
                const height = (building.widthFt / lotFrontage) * 100;
                const isRear = building.id === "rear_suite";
                return (
                  <div
                    key={building.id}
                    className={`absolute flex flex-col items-center justify-center overflow-hidden rounded-md border-2 px-2 text-center shadow-sm ${
                      isRear
                        ? "border-cyan-700/70 bg-cyan-100/90 text-cyan-950 dark:border-cyan-300/70 dark:bg-cyan-950/80 dark:text-cyan-100"
                        : "border-violet-700/70 bg-violet-100/90 text-violet-950 dark:border-violet-300/70 dark:bg-violet-950/80 dark:text-violet-100"
                    }`}
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      width: `${width}%`,
                      height: `${height}%`,
                    }}
                  >
                    <Building2 className="mb-1 h-4 w-4 shrink-0" />
                    <span className="max-w-full truncate text-[10px] font-semibold">{building.label}</span>
                    <span className="text-[9px] opacity-75">
                      {building.widthFt}′ × {building.depthFt}′ · {building.storeys} storeys
                    </span>
                  </div>
                );
              })}

              <div
                className="absolute w-1.5 rounded-full bg-stone-300/90 dark:bg-stone-600/90"
                style={{
                  left: `${(plan.setbacks.frontFt / lotDepth) * 100}%`,
                  top: plan.walkwaySide === "left" ? "2%" : "92%",
                  height: "6%",
                  width: `${Math.max(1, ((lotDepth - plan.setbacks.frontFt - plan.setbacks.rearFt) / lotDepth) * 100)}%`,
                  transform: plan.walkwaySide === "right" ? "translateY(-100%)" : undefined,
                }}
                aria-label={`${plan.walkwaySide} side walkway`}
              />

              {plan.buildings.length > 1 && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-background/85 px-2 py-0.5 text-[9px] text-muted-foreground shadow-sm">
                  {plan.setbacks.buildingSeparationFt}′ concept separation
                </div>
              )}

              {plan.drivewayShown && (
                <div className="absolute bottom-2 left-0 h-8 w-1/4 border-y border-dashed border-slate-500/40 bg-slate-300/40 text-center text-[9px] leading-8 text-slate-600 dark:bg-slate-700/30 dark:text-slate-300">
                  access
                </div>
              )}
            </div>

            <div className={`flex items-center justify-center rounded-r-xl border-y border-r border-border/70 text-[10px] font-semibold uppercase tracking-[0.2em] [writing-mode:vertical-rl] ${
              plan.laneDepthFt
                ? "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
            }`}>
              {plan.laneDepthFt ? `${plan.laneDepthFt}′ rear lane` : "Rear yard"}
            </div>
          </div>

          <div className="mt-2 grid grid-cols-[64px_1fr_56px] text-[10px] text-muted-foreground">
            <span />
            <div className="flex justify-between">
              <span>Side setback assumption: {plan.setbacks.sideFt}′</span>
              <span>Allowed screening coverage: {pct(plan.allowedCoverageRatio)}</span>
            </div>
            <span />
          </div>
        </div>
      </div>
    </div>
  );
}

interface ConceptImageResponse {
  imageDataUrl?: string;
  model?: string;
  error?: string;
  code?: string;
}

function ConceptRendering({ concept }: { concept: DevelopmentConcept }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "unavailable" | "error">("idle");
  const requestedConcept = useRef<string | null>(null);

  const generate = useCallback(async (force = false) => {
    if (!force && requestedConcept.current === concept.conceptId) return;
    requestedConcept.current = concept.conceptId;
    setImageUrl(null);
    setStatus("loading");
    try {
      const response = await fetch(concept.renderingRequest.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(concept.renderingRequest),
      });
      const payload = await response.json() as ConceptImageResponse;
      if (response.ok && payload.imageDataUrl) {
        setImageUrl(payload.imageDataUrl);
        setStatus("ready");
      } else if (payload.code === "image_generation_unavailable" || payload.code === "image_generation_limit") {
        setStatus("unavailable");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }, [concept.conceptId, concept.renderingRequest]);

  useEffect(() => {
    void generate(false);
  }, [generate]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            Input-matched architectural rendering
          </p>
          <p className="text-xs text-muted-foreground">
            GPT Image 2 visualizes the calculated massing; it does not determine compliance.
          </p>
        </div>
        {status === "ready" && <Badge variant="outline">GPT Image 2 · concept</Badge>}
      </div>

      <div className="relative aspect-[3/2] overflow-hidden rounded-xl border border-border/70 bg-gradient-to-br from-slate-100 via-stone-50 to-emerald-50 dark:from-slate-950 dark:via-stone-950 dark:to-emerald-950">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`AI-generated two-view architectural concept for a ${concept.title}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            {status === "loading" ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
                <p className="mt-3 text-sm font-medium">Rendering this exact lot concept…</p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  {concept.sitePlan.lotFrontageFt} × {concept.sitePlan.lotDepthFt} ft · {concept.totalUnits} homes · {concept.asOfRightStoreys} storeys
                </p>
              </>
            ) : (
              <>
                <div className="relative mb-5 flex h-28 w-52 items-end justify-center">
                  <div className="absolute bottom-0 h-20 w-36 rounded-t-sm border-2 border-violet-500/50 bg-violet-200/60 shadow-lg dark:bg-violet-900/50">
                    <div className="grid h-full grid-cols-3 gap-2 p-3">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <span key={index} className="rounded-sm bg-sky-200/80 dark:bg-sky-950/80" />
                      ))}
                    </div>
                  </div>
                  {concept.includesRearSuite && (
                    <div className="absolute bottom-0 right-0 h-12 w-16 rounded-t-sm border-2 border-cyan-500/50 bg-cyan-200/70 dark:bg-cyan-900/50" />
                  )}
                </div>
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">
                  {status === "unavailable" ? "Live concept rendering is not configured" : "The live rendering did not complete"}
                </p>
                <p className="mt-1 max-w-md text-xs text-muted-foreground">
                  The calculated site plan, massing, pro forma, and timeline remain available and control the report.
                </p>
                {status === "error" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      requestedConcept.current = null;
                      void generate(true);
                    }}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Try rendering again
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function OutcomeMatrix({ report }: FeasibilityDevelopmentReportProps) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers3 className="h-4 w-4 text-primary" />
          Frontage and access outcome matrix
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead>
              <tr className="border-b border-border/70 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">Frontage</th>
                <th className="px-3 py-2 font-medium">Typical form</th>
                <th className="px-3 py-2 text-center font-medium">No lane</th>
                <th className="px-3 py-2 text-center font-medium">With lane</th>
                <th className="px-3 py-2 font-medium">Depth read</th>
                <th className="px-3 py-2 font-medium">MTSA / major-street upside</th>
              </tr>
            </thead>
            <tbody>
              {report.outcomeMatrix.map((row) => (
                <tr
                  key={row.frontageFt}
                  className={`border-b border-border/40 align-top ${row.isCurrentBand ? "bg-primary/5" : ""}`}
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{row.frontageFt} ft</span>
                      {row.isCurrentBand && <Badge className="h-5 px-1.5 text-[9px]">this lot</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-3 font-medium">{row.typicalForm}</td>
                  <td className="px-3 py-3 text-center font-mono font-semibold">{row.noLaneUnits} units</td>
                  <td className="px-3 py-3 text-center font-mono font-semibold">{row.laneUnits} units</td>
                  <td className="max-w-[220px] px-3 py-3 leading-relaxed text-muted-foreground">{row.depthRead}</td>
                  <td className="max-w-[220px] px-3 py-3 leading-relaxed text-muted-foreground">{row.policyUpside}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          This matrix holds the submitted depth and current municipal permission constant so the frontage and lane trade-off is visible. It is a typology screen, not a blanket entitlement table.
        </p>
      </CardContent>
    </Card>
  );
}

function ProForma({ report }: FeasibilityDevelopmentReportProps) {
  const p = report.proForma;
  const costRows = [
    ["Site acquisition", p.costs.purchasePrice],
    ["Land transfer tax", p.costs.landTransferTax],
    ["Hard construction costs", p.costs.hardCosts],
    ["Soft costs", p.costs.softCosts],
    ["Contingency", p.costs.contingency],
    ["Development charges", p.costs.developmentCharges],
    ["Construction financing carry", p.costs.financingCarry],
  ] as const;

  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="border-b border-border/50 bg-muted/15 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="h-4 w-4 text-primary" />
              Sample project pro forma
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{p.configuration.label} · rental hold</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{p.configuration.units} units</Badge>
            <Badge variant="outline">{p.configuration.grossGfaSqft.toLocaleString()} gross sqft</Badge>
            <Badge variant="outline">{p.configuration.netRentableSqft.toLocaleString()} net sqft</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        {!p.landPriceProvided && (
          <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-900 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Acquisition price was left blank. Total development cost and equity therefore exclude land; the residual-land-value outputs are the more useful first-pass acquisition ceiling.
            </span>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label={p.landPriceProvided ? "Total development cost" : "Development cost before land"}
            value={money(p.costs.totalDevelopmentCost)}
            note={`${money(p.costs.costPerUnit)} per unit`}
          />
          <Metric
            label="Stabilized NOI"
            value={`${money(p.operations.stabilizedNoi)}/yr`}
            note={`${money(p.operations.averageMonthlyRentPerUnit)} average monthly rent per unit`}
          />
          <Metric
            label="Stabilized value"
            value={money(p.operations.stabilizedValue)}
            note={`${pct(p.assumptions.exitCapRate, 2)} cap rate assumption`}
            tone={p.operations.stabilizedValue > p.costs.totalDevelopmentCost ? "good" : "warn"}
          />
          <Metric
            label="Yield on cost"
            value={pct(p.operations.yieldOnCost, 2)}
            note="Stabilized NOI ÷ total modelled cost"
            tone={p.operations.yieldOnCost >= p.assumptions.exitCapRate ? "good" : "warn"}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold">Development cost stack</h4>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {money(p.costs.totalBeforeLand)} before land
              </Badge>
            </div>
            <div className="overflow-hidden rounded-lg border border-border/60">
              {costRows.map(([label, value], index) => (
                <div key={label} className={`flex items-center justify-between gap-4 px-3 py-2 text-xs ${index ? "border-t border-border/40" : ""}`}>
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono font-medium">{money(value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 border-t border-border/70 bg-muted/30 px-3 py-2.5 text-sm font-semibold">
                <span>{p.landPriceProvided ? "Total development cost" : "Total shown (land excluded)"}</span>
                <span className="font-mono">{money(p.costs.totalDevelopmentCost)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="mb-2 text-sm font-semibold">Construction sources & uses</h4>
              <div className="grid grid-cols-2 gap-2">
                <Metric
                  label="Construction loan"
                  value={money(p.sourcesAndUses.constructionLoan)}
                  note={`${pct(p.sourcesAndUses.loanToCost)} loan-to-cost`}
                />
                <Metric
                  label="Equity required"
                  value={money(p.sourcesAndUses.equityRequired)}
                  note={p.landPriceProvided ? "Includes land equity" : "Before land"}
                />
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">Stabilized operations</h4>
              <div className="overflow-hidden rounded-lg border border-border/60">
                {[
                  ["Gross potential rent", p.operations.grossPotentialRent],
                  ["Effective gross income", p.operations.effectiveGrossIncome],
                  ["Operating expenses", -p.operations.operatingExpenses],
                  ["Net operating income", p.operations.stabilizedNoi],
                ].map(([label, value], index) => (
                  <div key={String(label)} className={`flex items-center justify-between px-3 py-2 text-xs ${index ? "border-t border-border/40" : ""}`}>
                    <span className="text-muted-foreground">{label}</span>
                    <span className={`font-mono font-medium ${Number(value) < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                      {Number(value) < 0 ? `(${money(Math.abs(Number(value)))})` : money(Number(value))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="flex items-center gap-1.5 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                CMHC MLI Select takeout
              </h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Modelled at {p.cmhcTakeout.points} points after lease-up and stabilization
              </p>
            </div>
            <Badge className={p.cmhcTakeout.eligible
              ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
              : "bg-amber-500/10 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"}>
              {p.cmhcTakeout.eligible ? "Sample eligible" : "Not eligible at this unit count"}
            </Badge>
          </div>

          {p.cmhcTakeout.eligible ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Metric label="Takeout loan" value={money(p.cmhcTakeout.maxLoan)} />
              <Metric label="CMHC premium" value={money(p.cmhcTakeout.premiumDollars)} note={`${p.cmhcTakeout.premiumPct}% of loan`} />
              <Metric label="Amortization" value={`${p.cmhcTakeout.amortYears} years`} />
              <Metric label="Modelled DSCR" value={`${p.cmhcTakeout.dscr?.toFixed(2)}×`} note={`${p.cmhcTakeout.bindingConstraint?.toUpperCase()} is binding`} />
              <Metric label="Equity left after takeout" value={money(p.sourcesAndUses.equityRemainingAfterTakeout)} />
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-900 dark:text-amber-100">
              {p.cmhcTakeout.reason}
            </div>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Metric
            label="Residual land value · rental path"
            value={money(p.residualLandValue.rentalPath)}
            note={`Targets ${pct(p.assumptions.exitCapRate + 0.005, 2)}-style development yield; verify platform assumptions`}
          />
          <Metric
            label="Residual land value · condo path"
            value={money(p.residualLandValue.condoPath)}
            note="Illustrative alternative exit based on platform condo assumptions"
          />
        </div>

        <details className="rounded-lg border border-border/60 bg-muted/15">
          <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold">
            Pro-forma assumptions and sources
          </summary>
          <div className="space-y-3 border-t border-border/50 px-3 py-3 text-xs">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Hard cost", `${money(p.assumptions.hardCostPsf)}/gross sqft`],
                ["Soft costs", pct(p.assumptions.softCostPct)],
                ["Contingency", pct(p.assumptions.contingencyPct)],
                ["Construction rate", pct(p.assumptions.constructionLoanRate, 2)],
                ["Construction term", `${p.assumptions.constructionMonths} months`],
                ["Vacancy", pct(p.assumptions.vacancyPct)],
                ["Operating expenses", `${pct(p.assumptions.operatingExpensePct)} of EGI`],
                ["MLI takeout rate", pct(p.assumptions.mliInterestRate, 2)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md bg-background p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="mt-0.5 font-mono font-medium">{value}</p>
                </div>
              ))}
            </div>
            <p className="leading-relaxed text-muted-foreground">
              Source basis: {p.assumptions.source}. Last platform verification: {p.assumptions.lastVerified}.
            </p>
            <ul className="space-y-1 leading-relaxed text-muted-foreground">
              {p.notes.map((note) => <li key={note}>• {note}</li>)}
            </ul>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function TimelineBar({
  phase,
  totalMonths,
}: {
  phase: ProjectTimelinePhase;
  totalMonths: number;
}) {
  const left = (phase.startMonth / totalMonths) * 100;
  const width = Math.max(1.5, ((phase.endMonth - phase.startMonth) / totalMonths) * 100);
  return (
    <div className="relative h-8 rounded-md bg-muted/20">
      <div
        className={`absolute inset-y-1 rounded ${CATEGORY_STYLE[phase.category]} ${phase.critical ? "shadow-sm" : "opacity-75"}`}
        style={{ left: `${left}%`, width: `${width}%` }}
        title={`${phase.label}: month ${phase.startMonth}–${phase.endMonth}`}
      />
    </div>
  );
}

function Timeline({ report }: FeasibilityDevelopmentReportProps) {
  const timeline = report.timeline;
  const tickEvery = timeline.totalMonths > 30 ? 6 : 3;
  const ticks = Array.from(
    { length: Math.floor(timeline.totalMonths / tickEvery) + 1 },
    (_, index) => index * tickEvery,
  );

  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="border-b border-border/50 bg-muted/15 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarRange className="h-4 w-4 text-primary" />
              Sample project timeline
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Site control through construction, lease-up, stabilization, and CMHC takeout
            </p>
          </div>
          <Badge variant="secondary" className="gap-1 font-mono">
            <Clock3 className="h-3 w-3" />
            ~{timeline.totalMonths} months
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {(Object.keys(CATEGORY_LABEL) as TimelineCategory[]).map((category) => (
            <span key={category} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={`h-2.5 w-2.5 rounded-sm ${CATEGORY_STYLE[category]}`} />
              {CATEGORY_LABEL[category]}
            </span>
          ))}
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[240px_1fr] gap-3">
              <div className="pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Workstream</div>
              <div className="relative h-6 border-b border-border/60">
                {ticks.map((tick) => (
                  <span
                    key={tick}
                    className="absolute bottom-1 -translate-x-1/2 text-[10px] text-muted-foreground"
                    style={{ left: `${(tick / timeline.totalMonths) * 100}%` }}
                  >
                    M{tick}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="pointer-events-none absolute bottom-0 left-[252px] right-0 top-0">
                {ticks.map((tick) => (
                  <span
                    key={tick}
                    className="absolute inset-y-0 w-px bg-border/30"
                    style={{ left: `${(tick / timeline.totalMonths) * 100}%` }}
                  />
                ))}
              </div>

              <div className="space-y-1.5 pt-2">
                {timeline.phases.map((phase) => (
                  <div key={phase.id} className="grid grid-cols-[240px_1fr] items-center gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{phase.label}</p>
                      <p className={`text-[10px] ${CATEGORY_TEXT[phase.category]}`}>
                        M{phase.startMonth}–{phase.endMonth} · {phase.durationMonths} mo
                      </p>
                    </div>
                    <TimelineBar phase={phase} totalMonths={timeline.totalMonths} />
                  </div>
                ))}
              </div>
            </div>

            <div className="relative ml-[252px] mt-3 h-12 border-t border-border/50">
              {timeline.milestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className="absolute top-0 -translate-x-1/2"
                  style={{ left: `${(milestone.month / timeline.totalMonths) * 100}%` }}
                >
                  <span className={`mx-auto block h-3 w-3 -translate-y-1.5 rotate-45 ${CATEGORY_STYLE[milestone.category]}`} />
                  <span className="mt-0.5 block max-w-24 text-center text-[9px] leading-tight text-muted-foreground">
                    {milestone.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold">What each phase includes</h4>
          <div className="grid gap-2 md:grid-cols-2">
            {timeline.phases.map((phase) => (
              <details key={phase.id} className="rounded-lg border border-border/60 bg-muted/10">
                <summary className="cursor-pointer px-3 py-2.5 text-xs font-medium">
                  <span className={`mr-2 inline-block h-2 w-2 rounded-sm ${CATEGORY_STYLE[phase.category]}`} />
                  {phase.label}
                  <span className="ml-2 font-normal text-muted-foreground">
                    M{phase.startMonth}–{phase.endMonth}
                  </span>
                </summary>
                <div className="border-t border-border/40 px-3 py-2.5">
                  <ul className="space-y-1 text-xs leading-relaxed text-muted-foreground">
                    {phase.components.map((component) => <li key={component}>• {component}</li>)}
                  </ul>
                  {phase.dependencies.length > 0 && (
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Depends on: {phase.dependencies.join(", ").replace(/_/g, " ")}
                    </p>
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-muted/15 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Schedule notes</p>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
            {timeline.notes.map((note) => <li key={note}>• {note}</li>)}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The canonical underwriter already has the stronger financial model. This
 * focused view brings the calculated site plan and input-matched rendering
 * into that journey without duplicating the older feasibility pro forma.
 */
export function MultiplexConceptPreview({ report }: FeasibilityDevelopmentReportProps) {
  const concept = report.concept;

  return (
    <section className="space-y-5" data-testid="multiplex-concept-preview">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-cyan-500/5 p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="gap-1">
                <Home className="h-3 w-3" />
                Lot-matched concept
              </Badge>
              <Badge variant="outline">{concept.totalUnits} homes</Badge>
              <Badge variant="outline">{concept.asOfRightStoreys} storeys modelled</Badge>
              <Badge variant="outline">~{report.timeline.totalMonths} months to takeout</Badge>
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">{concept.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{concept.summary}</p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 text-center">
            <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2">
              <Ruler className="mx-auto h-4 w-4 text-primary" />
              <p className="mt-1 font-mono text-sm font-semibold">{concept.sitePlan.lotFrontageFt} × {concept.sitePlan.lotDepthFt}</p>
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground">lot feet</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2">
              <Building2 className="mx-auto h-4 w-4 text-primary" />
              <p className="mt-1 font-mono text-sm font-semibold">{concept.sitePlan.buildings.length}</p>
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground">building forms</p>
            </div>
          </div>
        </div>

        {concept.policyUpsideNote && (
          <div className="mt-4 flex gap-2 rounded-lg border border-blue-500/25 bg-blue-500/10 p-3 text-xs leading-relaxed text-blue-950 dark:text-blue-100">
            <TrainFront className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{concept.policyUpsideNote}</span>
          </div>
        )}
      </div>

      <Card className="border-border/60">
        <CardContent className="grid gap-6 pt-6 lg:grid-cols-2">
          <SitePlan concept={concept} />
          <ConceptRendering concept={concept} />
        </CardContent>
      </Card>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-950 dark:text-amber-100">
        <p className="font-semibold">Concept limitations</p>
        <ul className="mt-1 space-y-1">
          {concept.caveats.map((caveat) => <li key={caveat}>• {caveat}</li>)}
        </ul>
      </div>
    </section>
  );
}

export function FeasibilityDevelopmentReport({ report }: FeasibilityDevelopmentReportProps) {
  const concept = report.concept;

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-cyan-500/5 p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="gap-1">
                <Home className="h-3 w-3" />
                Sample development concept
              </Badge>
              <Badge variant="outline">{concept.totalUnits} homes</Badge>
              <Badge variant="outline">{concept.asOfRightStoreys} storeys modelled</Badge>
              {concept.rearSuiteType && <Badge variant="outline">+ {concept.rearSuiteType} suite</Badge>}
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">{concept.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{concept.summary}</p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 text-center">
            <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2">
              <Ruler className="mx-auto h-4 w-4 text-primary" />
              <p className="mt-1 font-mono text-sm font-semibold">{concept.sitePlan.lotFrontageFt} × {concept.sitePlan.lotDepthFt}</p>
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground">lot feet</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2">
              <Building2 className="mx-auto h-4 w-4 text-primary" />
              <p className="mt-1 font-mono text-sm font-semibold">{concept.principalUnits} + {concept.includesRearSuite ? 1 : 0}</p>
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground">main + rear</p>
            </div>
          </div>
        </div>

        {concept.policyUpsideNote && (
          <div className="mt-4 flex gap-2 rounded-lg border border-blue-500/25 bg-blue-500/10 p-3 text-xs leading-relaxed text-blue-950 dark:text-blue-100">
            <TrainFront className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{concept.policyUpsideNote}</span>
          </div>
        )}
      </div>

      <Card className="border-border/60">
        <CardContent className="grid gap-6 pt-6 lg:grid-cols-2">
          <SitePlan concept={concept} />
          <ConceptRendering concept={concept} />
        </CardContent>
      </Card>

      <OutcomeMatrix report={report} />
      <ProForma report={report} />
      <Timeline report={report} />

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-950 dark:text-amber-100">
        <p className="font-semibold">Concept report limitations</p>
        <ul className="mt-1 space-y-1">
          {concept.caveats.map((caveat) => <li key={caveat}>• {caveat}</li>)}
        </ul>
      </div>
    </section>
  );
}
