/**
 * MultiplexFeasibilityPanel
 *
 * Renders the full multiplex feasibility assessment UI for a property.
 * Can be used standalone, embedded in the deal analyzer, or in property cards.
 *
 * Usage:
 *   <MultiplexFeasibilityPanel
 *     address="123 Main St, Toronto, ON"
 *     city="Toronto"
 *     province="ON"
 *     lotFrontage={25}
 *     lotDepth={120}
 *   />
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { track } from "@/lib/analytics";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, ChevronUp,
  Building2, Calculator, ExternalLink, Info, Shield, Zap,
  Home, Layers, BarChart3, FileText, HelpCircle, Phone,
} from "lucide-react";

// ─── Types (mirrored from server) ────────────────────────────────────────────

interface PolicySource {
  type: string;
  name: string;
  url?: string;
  section?: string;
  jurisdiction: string;
  date?: string;
  confidence: string;
}

interface FeasibilityScenario {
  name: string;
  units: number;
  description: string;
  approval_path: string;
  typical_gfa_sqft?: number;
  notes: string[];
}

interface RiskFlag {
  flag: string;
  severity: "high" | "medium" | "low";
  details: string;
}

interface RuleLayerTrace {
  layer: "province_baseline" | "municipality_rules" | "zone_standards" | "overlays" | "property_caveats";
  label: string;
  status: "direct" | "heuristic" | "missing";
  impact: string;
  confidence: "high" | "medium" | "low";
  source_names: string[];
}

interface AssumptionTrace {
  label: string;
  value: string;
  certainty: "direct" | "inferred" | "unknown";
}

interface MultiplexFeasibilityResult {
  address: string;
  municipality: string;
  province: string;
  support_level: string;
  quick_read: {
    headline: string;
    confidence: "high" | "medium" | "low";
    confidence_score: number;
    key_facts: string[];
    key_blockers: string[];
  };
  zoning: {
    code?: string;
    description?: string;
    zone_category?: string;
    official_plan_note?: string;
    overlay_flags: string[];
    heritage_flagged: boolean;
    floodplain_flagged: boolean;
  };
  permissions: {
    provincial_baseline_units: number;
    municipal_baseline_units: number;
    effective_baseline_units: number;
    likely_units_low: number;
    likely_units_high: number;
    likely_range_label: string;
    aru_possible: boolean;
    garden_suite_possible: boolean;
    laneway_suite_possible: boolean;
    six_unit_area_possible: boolean;
    six_unit_area_status: "not_applicable" | "possible_unverified" | "more_likely_area";
    approval_path: string;
    scenarios: FeasibilityScenario[];
    approval_notes: string[];
  };
  envelope: {
    lot_area_sqft: number | null;
    lot_frontage_ft: number | null;
    lot_depth_ft: number | null;
    lot_area_basis: string;
    estimated_lot_coverage_ratio: number;
    coverage_basis: string;
    estimated_max_footprint_sqft: number | null;
    estimated_storeys: number;
    estimated_theoretical_gfa_sqft: number | null;
    estimated_practical_gfa_sqft: number | null;
    practical_haircut_reason: string;
    unit_scenarios: { units: number; avg_unit_sqft: number; total_gfa: number }[];
    calculation_notes: string[];
  };
  risk_flags: RiskFlag[];
  rules_hierarchy: RuleLayerTrace[];
  assumptions: AssumptionTrace[];
  source_summary: {
    direct_sources: number;
    heuristic_sources: number;
    total_sources: number;
  };
  sources: PolicySource[];
  confidence_breakdown: Record<string, { score: number; reason: string }>;
  confidence_score: number;
  computed_at: string;
  disclaimer: string;
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface MultiplexFeasibilityPanelProps {
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  zoneCode?: string;
  lotFrontage?: number;
  lotDepth?: number;
  lotArea?: number;
  cornerLot?: boolean;
  laneAccess?: boolean;
  heritageFlag?: boolean;
  floodplainFlag?: boolean;
  compact?: boolean; // show condensed version
}

// ─── Helper Components ───────────────────────────────────────────────────────

function ConfidenceBadge({ level, score }: { level: "high" | "medium" | "low"; score: number }) {
  const config = {
    high: { className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", label: "High Confidence" },
    medium: { className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", label: "Medium Confidence" },
    low: { className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", label: "Low Confidence" },
  }[level];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      <span className="font-mono">{score}</span>
      <span>/100 · {config.label}</span>
    </span>
  );
}

function ApprovalBadge({ path }: { path: string }) {
  const config: Record<string, { label: string; className: string }> = {
    as_of_right: { label: "Likely As-of-Right", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
    minor_variance_likely: { label: "Minor Variance Likely", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
    rezoning_required: { label: "Rezoning Required", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
    complex: { label: "Complex — Major Constraints", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
    unknown: { label: "Unknown — Verify Required", className: "bg-muted text-muted-foreground" },
  };
  const c = config[path] || config.unknown;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}>
      {c.label}
    </span>
  );
}

function RiskSeverityIcon({ severity }: { severity: "high" | "medium" | "low" }) {
  if (severity === "high") return <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />;
  if (severity === "medium") return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />;
  return <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />;
}

function UnitBadge({ units }: { units: number }) {
  const colors = ["", "", "bg-blue-100 text-blue-800", "bg-violet-100 text-violet-800", "bg-green-100 text-green-800", "bg-emerald-100 text-emerald-800", "bg-teal-100 text-teal-800"];
  const colorClass = colors[Math.min(units, colors.length - 1)] || "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${colorClass} dark:opacity-80`}>
      <Building2 className="h-3 w-3" />
      {units} units
    </span>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-16 bg-muted rounded-lg" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-lg" />)}
      </div>
      <div className="h-32 bg-muted rounded-lg" />
      <div className="h-48 bg-muted rounded-lg" />
    </div>
  );
}

// ─── Error State ─────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center space-y-2">
      <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
      <p className="text-sm font-medium text-destructive">Unable to compute feasibility</p>
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function MultiplexFeasibilityPanel(props: MultiplexFeasibilityPanelProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);

  const requestBody = {
    address: props.address,
    city: props.city,
    province: props.province,
    postalCode: props.postalCode,
    zoneCode: props.zoneCode,
    lotFrontage: props.lotFrontage,
    lotDepth: props.lotDepth,
    lotArea: props.lotArea,
    cornerLot: props.cornerLot,
    laneAccess: props.laneAccess,
    heritageFlag: props.heritageFlag,
    floodplainFlag: props.floodplainFlag,
  };

  const { data, isLoading, error } = useQuery<MultiplexFeasibilityResult>({
    queryKey: ["/api/multiplex-feasibility", requestBody],
    queryFn: async () => {
      const res = await fetch("/api/multiplex-feasibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to compute feasibility");
      return res.json();
    },
    enabled: !!(props.address || props.city),
    staleTime: 1000 * 60 * 60, // 1 hour cache
  });

  if (isLoading) return <LoadingSkeleton />;
  if (error || !data) return <ErrorState message={error?.message || "Unknown error"} />;

  const d = data;
  const hasHighRisk = d.risk_flags.some(f => f.severity === "high");

  return (
    <div className="space-y-4" data-testid="multiplex-feasibility-panel">

      {/* ── Quick Read Header ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Multiplex Feasibility Assessment
              </span>
              <Badge variant="outline" className="text-[10px] px-1.5">
                {d.support_level === "full" ? "Full data" : d.support_level === "partial" ? "Partial data" : "Province baseline only"}
              </Badge>
            </div>
            <p className="font-semibold text-sm leading-snug">{d.address}</p>
            <p className="text-xs text-muted-foreground">{d.municipality} · {d.province}</p>
          </div>
          <ConfidenceBadge level={d.quick_read.confidence} score={d.quick_read.confidence_score} />
        </div>

        <div className={`rounded-lg p-4 ${hasHighRisk ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30" : "bg-primary/5 border border-primary/20"}`}>
          <p className="text-sm font-semibold leading-snug">{d.quick_read.headline}</p>
        </div>

        {/* Quick facts / blockers */}
        {d.quick_read.key_facts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {d.quick_read.key_facts.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
                <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                {f}
              </span>
            ))}
          </div>
        )}
        {d.quick_read.key_blockers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {d.quick_read.key_blockers.map((b, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-amber-50 dark:bg-amber-950/20 px-2 py-1 rounded-full text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {b}
              </span>
            ))}
          </div>
        )}
      </div>

      {props.compact && (
        <>
          <Card className="border-border/60">
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-[11px] text-muted-foreground">Baseline</p>
                  <p className="text-lg font-semibold">{d.permissions.effective_baseline_units} units</p>
                  <p className="text-[10px] text-muted-foreground">likely starting point</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-[11px] text-muted-foreground">Possible range</p>
                  <p className="text-lg font-semibold">{d.permissions.likely_range_label}</p>
                  <p className="text-[10px] text-muted-foreground">screening only</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-[11px] text-muted-foreground">Accessory units</p>
                  <p className="text-lg font-semibold">
                    {[
                      d.permissions.laneway_suite_possible ? "Laneway" : null,
                      d.permissions.garden_suite_possible ? "Garden" : null,
                      d.permissions.aru_possible ? "ARU" : null,
                    ].filter(Boolean).slice(0, 2).join(" + ") || "None shown"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">verify lot conditions</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-[11px] text-muted-foreground">Practical GFA</p>
                  <p className="text-lg font-semibold">{d.envelope.estimated_practical_gfa_sqft ? `~${d.envelope.estimated_practical_gfa_sqft.toLocaleString()}` : "Unknown"}</p>
                  <p className="text-[10px] text-muted-foreground">sqft screening</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rules hierarchy</p>
                <div className="space-y-2">
                  {d.rules_hierarchy.map((rule) => (
                    <div key={rule.layer} className="rounded-lg border border-border/50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{rule.label}</p>
                        <Badge variant={rule.status === "direct" ? "default" : "outline"} className="text-[10px] capitalize">
                          {rule.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{rule.impact}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border/50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Key assumptions</p>
                  <div className="space-y-2">
                    {d.assumptions.slice(0, 4).map((assumption) => (
                      <div key={assumption.label} className="text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{assumption.label}</span>
                          <Badge variant="outline" className="text-[9px] capitalize">{assumption.certainty}</Badge>
                        </div>
                        <p className="text-muted-foreground mt-0.5">{assumption.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-950/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-2">Buyer beware</p>
                  <div className="space-y-2">
                    {d.risk_flags.slice(0, 3).map((flag) => (
                      <div key={flag.flag} className="text-xs">
                        <p className="font-medium text-amber-900 dark:text-amber-200">{flag.flag}</p>
                        <p className="text-amber-700 dark:text-amber-400 leading-relaxed">{flag.details}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border/50 bg-muted/20 p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-xs text-muted-foreground">
                  <p>
                    {d.source_summary.direct_sources} direct source{d.source_summary.direct_sources === 1 ? "" : "s"} + {d.source_summary.heuristic_sources} heuristic assumption{d.source_summary.heuristic_sources === 1 ? "" : "s"} applied.
                  </p>
                  <p className="mt-1">Realist does not guarantee zoning accuracy or development feasibility. Buyer to verify with municipality and professionals.</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      track({ event: "feature_used", feature: "multiplex_overlay_full_tool" });
                      window.location.href = `/tools/multiplex-feasibility?city=${encodeURIComponent(props.city || "")}&province=${encodeURIComponent(props.province || "")}&address=${encodeURIComponent(props.address || "")}`;
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Full Tool
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!props.compact && (
        <>
          {/* ── What May Be Possible ────────────────────────────────────────── */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                What May Be Possible Here
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Permission baseline */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Provincial Baseline</p>
                  <UnitBadge units={d.permissions.provincial_baseline_units} />
                  <p className="text-[10px] text-muted-foreground mt-1">Ontario Bill 23</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Municipal Baseline</p>
                  <UnitBadge units={d.permissions.municipal_baseline_units} />
                  <p className="text-[10px] text-muted-foreground mt-1">{d.municipality}</p>
                </div>
                <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Effective Baseline</p>
                  <UnitBadge units={d.permissions.effective_baseline_units} />
                  <p className="text-[10px] text-muted-foreground mt-1">As-of-right estimate</p>
                </div>
              </div>

              {/* Approval path */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Estimated approval path:</span>
                <ApprovalBadge path={d.permissions.approval_path} />
              </div>

              {/* Accessory units */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "ARU / Suite", possible: d.permissions.aru_possible },
                  { label: "Garden Suite", possible: d.permissions.garden_suite_possible },
                  { label: "Laneway Suite", possible: d.permissions.laneway_suite_possible },
                ].map(({ label, possible }) => (
                  <div key={label} className={`rounded-lg p-2.5 text-center text-xs border ${possible ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900/30" : "bg-muted/30 border-border/30"}`}>
                    {possible
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mx-auto mb-1" />
                      : <Info className="h-3.5 w-3.5 text-muted-foreground/50 mx-auto mb-1" />
                    }
                    <p className={possible ? "font-medium text-green-800 dark:text-green-300" : "text-muted-foreground/60"}>{label}</p>
                    <p className="text-[10px]">{possible ? "Possibly eligible" : "Not indicated"}</p>
                  </div>
                ))}
              </div>

              {/* 6-unit note */}
              {d.permissions.six_unit_area_possible && (
                <div className="rounded-lg border border-blue-200 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-950/20 p-3 text-xs text-blue-800 dark:text-blue-300 space-y-1">
                  <p className="font-semibold">
                    6-Unit Area — {d.permissions.six_unit_area_status === "more_likely_area" ? "More Likely" : "Possible"}
                  </p>
                  <p className="text-blue-700 dark:text-blue-400 leading-relaxed">
                    Properties in the Toronto &amp; East York community council area and Ward 23 (Scarborough North – Don Mills) may be eligible for up to 6 units.
                    {d.permissions.six_unit_area_status === "more_likely_area"
                      ? " The current address context looks more aligned with Toronto & East York, but buyer must still verify the exact boundary."
                      : " Buyer must verify the property falls within this boundary using Toronto's zoning map."}
                  </p>
                </div>
              )}

              {/* Scenarios */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Development Scenarios</p>
                {d.permissions.scenarios.map((s, i) => (
                  <Collapsible key={i}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors text-left">
                        <div className="flex items-center gap-3">
                          <UnitBadge units={s.units} />
                          <div>
                            <p className="text-sm font-medium">{s.name}</p>
                            <p className="text-xs text-muted-foreground">{s.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <ApprovalBadge path={s.approval_path} />
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pb-3 pt-1 space-y-1.5">
                        {s.typical_gfa_sqft && (
                          <p className="text-xs text-muted-foreground">Typical GFA estimate: ~{s.typical_gfa_sqft.toLocaleString()} sqft</p>
                        )}
                        {s.notes.map((n, j) => (
                          <div key={j} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-primary" />
                            <span>{n}</span>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Zoning Snapshot ─────────────────────────────────────────────── */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Zoning Snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Municipality</p>
                  <p className="font-medium">{d.municipality}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Province</p>
                  <p className="font-medium">{d.province}</p>
                </div>
                {d.zoning.code && (
                  <div>
                    <p className="text-xs text-muted-foreground">Zone Code</p>
                    <p className="font-mono font-medium">{d.zoning.code}</p>
                  </div>
                )}
                {d.zoning.description && (
                  <div>
                    <p className="text-xs text-muted-foreground">Zone Type</p>
                    <p className="font-medium">{d.zoning.description}</p>
                  </div>
                )}
              </div>

              {/* Overlay flags */}
              {(d.zoning.overlay_flags.length > 0 || d.zoning.heritage_flagged || d.zoning.floodplain_flagged) && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Overlay / Constraint Flags</p>
                  {d.zoning.overlay_flags.map((f, i) => (
                    <p key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {f}
                    </p>
                  ))}
                </div>
              )}

              {d.zoning.official_plan_note && (
                <p className="text-xs text-muted-foreground italic">{d.zoning.official_plan_note}</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Rules Hierarchy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {d.rules_hierarchy.map((rule) => (
                <div key={rule.layer} className="rounded-lg border border-border/50 p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{rule.label}</p>
                    <Badge variant={rule.status === "direct" ? "default" : "outline"} className="text-[10px] capitalize">
                      {rule.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{rule.impact}</p>
                  {rule.source_names.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Sources: {rule.source_names.join(" · ")}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── Rough Envelope Math ──────────────────────────────────────────── */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Rough Envelope Math
                <Badge variant="outline" className="text-[10px] font-normal ml-1">Estimates only — buyer to verify</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Lot dimensions */}
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "Lot Frontage", value: d.envelope.lot_frontage_ft ? `${d.envelope.lot_frontage_ft}ft` : "—" },
                  { label: "Lot Depth", value: d.envelope.lot_depth_ft ? `${d.envelope.lot_depth_ft}ft` : "—" },
                  { label: "Lot Area", value: d.envelope.lot_area_sqft ? `${d.envelope.lot_area_sqft.toLocaleString()} sqft` : "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <p className="font-mono font-semibold text-sm">{value}</p>
                  </div>
                ))}
              </div>

              {d.envelope.lot_area_basis !== "provided" && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  Lot area is {d.envelope.lot_area_basis} — verify actual dimensions from listing or land registry
                </p>
              )}

              {/* GFA estimates */}
              {d.envelope.estimated_practical_gfa_sqft && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 border-t border-border/40 text-sm">
                    <span className="text-muted-foreground">Est. lot coverage ratio</span>
                    <span className="font-mono font-semibold">{Math.round(d.envelope.estimated_lot_coverage_ratio * 100)}%
                      <span className="text-xs text-muted-foreground ml-1">({d.envelope.coverage_basis.replace(/_/g, " ")})</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-border/40 text-sm">
                    <span className="text-muted-foreground">Est. max footprint</span>
                    <span className="font-mono font-semibold">{d.envelope.estimated_max_footprint_sqft?.toLocaleString()} sqft</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-border/40 text-sm">
                    <span className="text-muted-foreground">Assumed storeys</span>
                    <span className="font-mono font-semibold">{d.envelope.estimated_storeys}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-border/40 text-sm">
                    <span className="text-muted-foreground">Theoretical GFA</span>
                    <span className="font-mono font-semibold">{d.envelope.estimated_theoretical_gfa_sqft?.toLocaleString()} sqft</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-primary/20 bg-primary/5 -mx-1 px-1 rounded text-sm">
                    <span className="font-medium">Est. Practical GFA</span>
                    <span className="font-mono font-bold text-primary">{d.envelope.estimated_practical_gfa_sqft?.toLocaleString()} sqft</span>
                  </div>
                </div>
              )}

              {/* Per-unit scenarios */}
              {d.envelope.unit_scenarios.length > 0 && d.envelope.estimated_practical_gfa_sqft && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg. Unit Size by Scenario</p>
                  <div className="grid grid-cols-3 gap-2">
                    {d.envelope.unit_scenarios.map(us => (
                      <div key={us.units} className="rounded-lg bg-muted/50 p-2.5 text-center">
                        <UnitBadge units={us.units} />
                        <p className="font-mono text-xs font-semibold mt-1.5">{us.avg_unit_sqft > 0 ? `~${us.avg_unit_sqft.toLocaleString()} sqft` : "—"}</p>
                        <p className="text-[10px] text-muted-foreground">avg per unit</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Calc notes expandable */}
              {d.envelope.calculation_notes.length > 0 && (
                <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full gap-1.5 h-8 text-xs">
                      {notesOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {notesOpen ? "Hide" : "Show"} calculation assumptions
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 space-y-1.5 rounded-lg bg-muted/30 p-3">
                      {d.envelope.calculation_notes.map((n, i) => (
                        <p key={i} className="text-xs text-muted-foreground leading-relaxed">→ {n}</p>
                      ))}
                      <p className="text-xs text-muted-foreground leading-relaxed">→ {d.envelope.practical_haircut_reason}</p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </CardContent>
          </Card>

          {/* ── Red Flags ───────────────────────────────────────────────────── */}
          {d.risk_flags.length > 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Buyer-to-Verify: Risk Flags
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {["high", "medium", "low"].map(sev =>
                  d.risk_flags.filter(f => f.severity === sev).map((flag, i) => (
                    <div key={`${sev}-${i}`} className="flex items-start gap-2.5">
                      <RiskSeverityIcon severity={flag.severity as "high" | "medium" | "low"} />
                      <div>
                        <p className="text-xs font-semibold">{flag.flag}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{flag.details}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Sources ─────────────────────────────────────────────────────── */}
          <Collapsible open={sourcesOpen} onOpenChange={setSourcesOpen}>
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CollapsibleTrigger asChild>
                  <button className="flex w-full items-center justify-between text-left">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Sources & Traceability
                      <Badge variant="outline" className="text-[10px] font-normal">{d.sources.length} sources</Badge>
                    </CardTitle>
                    {sourcesOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-3">
                  {/* Confidence breakdown */}
                  <div className="rounded-lg bg-muted/30 p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Confidence Score Breakdown</p>
                    {Object.entries(d.confidence_breakdown).map(([key, { score, reason }]) => (
                      <div key={key} className="flex items-start justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">{key.replace(/_/g, " ")}</span>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-semibold">+{score}</span>
                          <p className="text-[10px] text-muted-foreground">{reason}</p>
                        </div>
                      </div>
                    ))}
                    <Separator className="my-1" />
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>Total</span>
                      <span className="font-mono">{d.confidence_score}/100</span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/20 p-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">Assumptions Snapshot</p>
                    {d.assumptions.map((assumption) => (
                      <div key={assumption.label} className="flex items-start justify-between gap-3 text-xs">
                        <div>
                          <p className="font-medium">{assumption.label}</p>
                          <p className="text-muted-foreground">{assumption.value}</p>
                        </div>
                        <Badge variant="outline" className="text-[9px] capitalize shrink-0">
                          {assumption.certainty}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  {/* Policy sources */}
                  <div className="space-y-2">
                    {d.sources.map((s, i) => (
                      <div key={i} className="rounded-lg border border-border/40 p-3 text-xs space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium">{s.name}</span>
                          <Badge variant="outline" className="text-[9px] px-1 shrink-0">{s.confidence}</Badge>
                        </div>
                        <p className="text-muted-foreground">{s.jurisdiction} · {s.type}</p>
                        {s.date && <p className="text-muted-foreground">Effective: {s.date}</p>}
                        {s.section && <p className="text-muted-foreground">Section: {s.section}</p>}
                        {s.url && (
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            View source <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] text-muted-foreground">
                    Traceability: {d.source_summary.direct_sources} direct source{d.source_summary.direct_sources === 1 ? "" : "s"}, {d.source_summary.heuristic_sources} heuristic source{d.source_summary.heuristic_sources === 1 ? "" : "s"}.
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Computed: {new Date(d.computed_at).toLocaleString()}
                  </p>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* ── CTAs ────────────────────────────────────────────────────────── */}
          <Card className="border-border/60 bg-muted/20">
            <CardContent className="p-5 space-y-3">
              <p className="text-sm font-semibold">Take the next step</p>
              <div className="grid sm:grid-cols-3 gap-3">
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1.5 h-9"
                  onClick={() => {
                    track({ event: "consultation_requested", type: "realtor" });
                    window.location.href = "/partner/network";
                  }}
                >
                  <Phone className="h-3.5 w-3.5" />
                  Talk to a Realtor
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-9"
                  onClick={() => {
                    track({ event: "feature_used", feature: "analyzer_from_feasibility" });
                    window.location.href = "/tools/analyzer";
                  }}
                >
                  <Calculator className="h-3.5 w-3.5" />
                  Analyze Financials
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-9"
                  onClick={() => {
                    track({ event: "feature_used", feature: "will_it_plex_from_feasibility" });
                    window.location.href = "/tools/will-it-plex";
                  }}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Will It Plex?
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Disclaimer ──────────────────────────────────────────────────── */}
          <Collapsible open={disclaimerOpen} onOpenChange={setDisclaimerOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors px-1">
                <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="text-left">
                  <strong>This is a screening tool only — not planning, legal, or development advice.</strong> Click to read full disclaimer.
                </span>
                {disclaimerOpen ? <ChevronUp className="h-3 w-3 shrink-0 ml-auto" /> : <ChevronDown className="h-3 w-3 shrink-0 ml-auto" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 rounded-lg border border-border/40 bg-muted/20 p-4 text-[11px] text-muted-foreground leading-relaxed">
                {d.disclaimer}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  );
}
