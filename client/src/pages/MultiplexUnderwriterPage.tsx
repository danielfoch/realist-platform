/**
 * AI Multiplex Underwriter — /multiplex
 *
 * Address-first flow: resolve the site (zoning polygon, tree/heritage/TRCA
 * screens) → confirm lot dimensions → full underwrite (build configurations,
 * condo exit vs CMHC MLI Select hold, residual land value) with an AI-written
 * narrative. Every figure carries a provenance badge: verified / inferred /
 * assumption / estimate.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { BuyWithRealistCta } from "@/components/BuyWithRealistCta";
import { NextStepBlock } from "@/components/NextStepBlock";
import { SEO } from "@/components/SEO";
import { SiteFooter } from "@/components/SiteFooter";
import { MultiplexEventCta } from "@/components/events/MultiplexEventCta";
import { MultiplexConceptPreview } from "@/components/multiplex/FeasibilityDevelopmentReport";
import { VerdictSummary } from "@/components/multiplex/VerdictSummary";
import { UnlockMoreUnderwrites } from "@/components/multiplex/UnlockMoreUnderwrites";
import { loadPropertyContext, savePropertyContext } from "@/lib/propertyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { track } from "@/lib/analytics";
import { SHARED_ROUTE_META } from "@shared/routeMeta";
import type { MultiplexDevelopmentReport } from "@shared/multiplexFeasibilityReport";
import {
  Building2, MapPin, TreeDeciduous, Landmark, Waves, AlertTriangle,
  CheckCircle2, Loader2, Share2, ArrowRight, Sparkles, Scale,
  TrainFront, Route as RouteIcon,
} from "lucide-react";

// ─── Types (mirror the API result shape) ────────────────────────────────────

interface ResolvedSite {
  address: string;
  lat: number | null;
  lng: number | null;
  zoning: { zoneCode: string; zoneCategory: string | null } | null;
  zoningDataAvailable: boolean;
  trees: { status: string; cityTreeConflict: boolean; treesWithinContextRadius: number; nearest: { distanceM: number; commonName: string | null } | null; privateTreeCaution: string };
  heritage: { status: string; listed: boolean };
  trca: { status: string; regulated: boolean; detail: string | null };
  notes: string[];
}

interface ConfigResult {
  config: {
    key: string; label: string; units: number;
    unitMix: Array<{ type: string; count: number; netSqftEach: number }>;
    grossGfaSqft: number; netSqft: number; includesSuite: boolean;
    approvalPath: string; envelopeSlackPct: number; constraints: string[];
  };
  varianceRisk: { level: "low" | "medium" | "high"; factors: Array<{ key: string; reason: string }> };
  costs: { totalDevCost: number; hardCosts: number; softCosts: number; developmentCharges: number; landTransferTax: number; financingCarry: number; costPerUnit: number };
  condoExit: { grossSellout: number; profit: number; marginOnCost: number };
  rentalHold: {
    noi: number;
    stabilizedValue: number;
    yieldOnCost: number;
    monthlyRentRoll: Array<{ type: string; count: number; rentEach: number }>;
  };
  residualLandValue: { condoPath: number; rentalPath: number };
  mli: { eligible: boolean; reason?: string; premiumPct: number; maxLoan: number; actualDscr: number; amortYears: number; bindingConstraint: string };
  smallRental?: {
    eligible: boolean;
    reason?: string;
    maxLtv: number;
    amortYears: number;
    indicativeLoan: number;
    indicativeEquity: number;
    annualDebtService: number;
    noiCoverageRatio: number | null;
    source: string;
    sourceUrl: string;
    qualificationNote: string;
  };
  comparison: { condoProfit: number; holdEquityLeft: number; holdAnnualCashFlow: number; holdCashOnCash: number | null; recommendedExit: string };
  /** Dual-takeout comparator (optional: absent on reports saved before it shipped). */
  takeout?: {
    condo: {
      form: "condo_town" | "condo_apartment";
      formReason: string;
      pricePsf: number;
      avgPricePerUnit: number;
      profit: number;
      marginOnCost: number;
      monthsToExit: number;
      flags: Array<{ key: string; message: string }>;
    };
    hold: {
      eligible: boolean;
      reason?: string;
      loanBalance: number;
      equityLeftIn: number;
      annualCashFlow: number;
      cashOnCash: number | null;
      valueCreation: number;
      horizonYears: number;
      horizonProfit: number;
      flags: Array<{ key: string; message: string }>;
    };
    decision: { recommended: "mli_hold" | "condo_termination" | "neither"; condoScore: number; holdScore: number | null; reasons: string[] };
  };
}

interface UnderwriteResult {
  sixplex: { eligible: boolean; status: string; certainty: string };
  maxUnitsAsOfRight: number;
  envelope: { practicalGfaSqft: { value: number; source: string; certainty: string }; theoreticalGfaSqft: { value: number }; flags: Array<{ key: string; message: string }> };
  configs: ConfigResult[];
  winner: { flip: string | null; hold: string | null };
  recommendedTakeout?: {
    configKey: string | null;
    takeout: "mli_hold" | "condo_termination" | "neither";
    score: number;
    formPreferenceApplied: boolean;
    reasons: string[];
  };
  planning?: {
    transit: {
      status: "unknown" | "outside" | "likely_mtsa_inferred" | "mtsa" | "pmtsa";
      certainty: "direct" | "inferred" | "unknown";
      distance_m: number | null;
      major_street: boolean;
      parking_minimums_prohibited: boolean;
      policy_height_storeys: number | null;
      summary: string;
      notes: string[];
    };
    majorStreet: boolean;
    cornerLot: boolean;
  };
  developmentReport?: MultiplexDevelopmentReport | null;
  assumptionNotes: string[];
  report?: {
    siteSummary: string; zoningSummary: string; varianceNarrative: string; riskNarrative: string;
    recommendation: { bestPath: string; dealKillers: string[]; verifyWithProfessionals: string[]; nextSteps: string[] };
  };
  reportSource?: string;
}

// ─── Small pieces ────────────────────────────────────────────────────────────

const fmtMoney = (n: number) => `$${Math.round(n).toLocaleString()}`;
const fmtPct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;

const TAKEOUT_LABEL: Record<string, string> = {
  mli_hold: "MLI Select hold",
  condo_termination: "Condo termination",
  neither: "Neither pencils",
};
const FORM_LABEL: Record<string, string> = {
  condo_town: "condo towns",
  condo_apartment: "condo apartments",
};

const TORONTO_MTSA_MAP_URL =
  "https://www.toronto.ca/city-government/planning-development/planning-studies-initiatives/zoning-for-major-transit-station-areas/";

function JourneyProgress({ step }: { step: Step }) {
  const activeIndex = step === "input" ? 0 : step === "confirm" ? 1 : 2;
  const stages = [
    { label: "Site", detail: "Address or DDF listing" },
    { label: "Planning", detail: "Lot and overlays" },
    { label: "Decision", detail: "Concept and returns" },
  ];

  return (
    <ol className="mx-auto mb-8 grid max-w-3xl grid-cols-3 gap-2" aria-label="Multiplex underwriting progress">
      {stages.map((stage, index) => (
        <li
          key={stage.label}
          className={`rounded-lg border px-3 py-2 ${index <= activeIndex ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20"}`}
        >
          <p className="text-xs font-bold"><span className="mr-1 text-primary">{index + 1}.</span>{stage.label}</p>
          <p className="hidden text-[10px] text-muted-foreground sm:block">{stage.detail}</p>
        </li>
      ))}
    </ol>
  );
}

function PlanningContextFields({
  transitAreaStatus,
  onTransitAreaStatusChange,
  transitDistance,
  onTransitDistanceChange,
  majorStreet,
  onMajorStreetChange,
  cornerLot,
  onCornerLotChange,
}: {
  transitAreaStatus: "unknown" | "outside" | "mtsa" | "pmtsa";
  onTransitAreaStatusChange: (value: "unknown" | "outside" | "mtsa" | "pmtsa") => void;
  transitDistance: string;
  onTransitDistanceChange: (value: string) => void;
  majorStreet: boolean;
  onMajorStreetChange: (value: boolean) => void;
  cornerLot: boolean;
  onCornerLotChange: (value: boolean) => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4" data-testid="multiplex-planning-inputs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold"><TrainFront className="h-4 w-4" /> Planning context</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Only select a mapped MTSA status you have confirmed. A station radius is a clue, not a boundary.</p>
        </div>
        <a href={TORONTO_MTSA_MAP_URL} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold text-primary hover:underline">
          Check City map ↗
        </a>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="transit-status" className="text-xs">MTSA / PMTSA status</Label>
          <select
            id="transit-status"
            value={transitAreaStatus}
            onChange={(event) => onTransitAreaStatusChange(event.target.value as "unknown" | "outside" | "mtsa" | "pmtsa")}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="unknown">Not confirmed</option>
            <option value="outside">Confirmed outside</option>
            <option value="mtsa">Inside an MTSA</option>
            <option value="pmtsa">Inside a protected MTSA</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="transit-distance" className="text-xs">Nearest rapid-transit station (metres)</Label>
          <Input id="transit-distance" type="number" min="0" placeholder="e.g. 450" value={transitDistance} onChange={(event) => onTransitDistanceChange(event.target.value)} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2.5">
          <Label htmlFor="major-street" className="cursor-pointer text-sm">Fronts a major street</Label>
          <Switch id="major-street" checked={majorStreet} onCheckedChange={onMajorStreetChange} />
        </div>
        <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2.5">
          <Label htmlFor="corner-lot" className="cursor-pointer text-sm">Corner lot</Label>
          <Switch id="corner-lot" checked={cornerLot} onCheckedChange={onCornerLotChange} />
        </div>
      </div>
    </div>
  );
}

function ProvenanceBadge({ kind }: { kind: string }) {
  const styles: Record<string, string> = {
    verified: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
    inferred: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    assumption: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    estimate: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
  };
  return <Badge variant="outline" className={`text-[10px] uppercase tracking-wide ${styles[kind] ?? ""}`}>{kind}</Badge>;
}

function TuneField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 font-mono text-sm" />
    </div>
  );
}

async function geocodeAddressClient(address: string): Promise<{ lat: number; lng: number; displayName: string | null } | null> {
  try {
    const params = new URLSearchParams({
      q: `${address}, Toronto, Ontario, Canada`,
      format: "json",
      limit: "1",
      countrycodes: "ca",
    });
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": "realist.ca multiplex underwriter (contact: hello@realist.ca)" },
    });
    if (!resp.ok) return null;
    const results = (await resp.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    const hit = results[0];
    if (!hit) return null;
    return { lat: Number(hit.lat), lng: Number(hit.lon), displayName: hit.display_name };
  } catch {
    return null;
  }
}

function TuneSelect({ label, value, onChange, options }: { label: string; value: number; onChange: (v: number) => void; options: Array<{ value: number; label: string }> }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function RiskChip({ level }: { level: "low" | "medium" | "high" }) {
  const styles = {
    low: "bg-green-500/10 text-green-600 dark:text-green-400",
    medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    high: "bg-red-500/10 text-red-600 dark:text-red-400",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[level]}`}>{level.toUpperCase()} variance risk</span>;
}

function ScreenChip({ icon: Icon, label, flagged, unavailable }: { icon: any; label: string; flagged: boolean; unavailable?: boolean }) {
  const cls = unavailable
    ? "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30"
    : flagged
      ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
      : "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30";
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm ${cls}`}>
      <Icon className="h-4 w-4" />
      {label}{unavailable ? " — not verified" : flagged ? " — flagged" : " — clear"}
    </span>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type Step = "input" | "confirm" | "report";

export default function MultiplexUnderwriterPage() {
  const initialParams = new URLSearchParams(window.location.search);
  const [step, setStep] = useState<Step>("input");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  // Seed from cross-tool params or the shared property context so an address
  // typed in feasibility/analyzer carries straight into the AI underwrite.
  const [address, setAddress] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("share")) return "";
    return params.get("address") ?? loadPropertyContext()?.address ?? "";
  });
  const [listingId] = useState(() => initialParams.get("mls") || "");
  const [source] = useState(() => initialParams.get("source") || (initialParams.get("mls") ? "ddf_listing" : "direct"));
  const [postalCode, setPostalCode] = useState(() => initialParams.get("postalCode") || "");
  const [site, setSite] = useState<ResolvedSite | null>(null);

  const [frontage, setFrontage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("share")) return "";
    const ctx = loadPropertyContext();
    return params.get("frontage") ?? (ctx?.lotFrontageFt ?? ctx?.lotFrontageM)?.toString() ?? "";
  });
  const [depth, setDepth] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("share")) return "";
    const ctx = loadPropertyContext();
    return params.get("depth") ?? (ctx?.lotDepthFt ?? ctx?.lotDepthM)?.toString() ?? "";
  });
  const [lotArea, setLotArea] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("share")) return "";
    return params.get("lotArea") ?? loadPropertyContext()?.lotAreaSqft?.toString() ?? "";
  });
  const [purchasePrice, setPurchasePrice] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("share")) return "";
    return params.get("price") ?? (loadPropertyContext()?.price?.toString() ?? "");
  });
  const [laneAccess, setLaneAccess] = useState(false);
  const [cornerLot, setCornerLot] = useState(() => initialParams.get("cornerLot") === "1");
  const [majorStreet, setMajorStreet] = useState(() => initialParams.get("majorStreet") === "1");
  const [transitAreaStatus, setTransitAreaStatus] = useState<"unknown" | "outside" | "mtsa" | "pmtsa">(() => {
    const value = initialParams.get("transit");
    return value === "outside" || value === "mtsa" || value === "pmtsa" ? value : "unknown";
  });
  const [transitDistance, setTransitDistance] = useState(() => initialParams.get("transitDistanceM") || "");
  const hasLotInput = (Number(frontage) > 0 && Number(depth) > 0) || Number(lotArea) > 0;

  // Fine-tune workflow: every takeout parameter is overridable per run.
  // Empty string = platform default; percent fields are entered as percents.
  const [tune, setTune] = useState({
    condoTownPsf: "",
    condoAptPsf: "",
    aptDiscountPct: "",
    hardCostPsf: "",
    exitCapRatePct: "",
    mliRatePct: "",
    holdHorizonYears: "",
    regMonths: "",
    affordabilityLevel: 1,
    energyLevel: 1,
    accessibilityLevel: 0,
  });

  function buildAssumptionOverrides(): Record<string, number> {
    const o: Record<string, number> = {};
    const put = (key: string, raw: string, scale = 1) => {
      const n = Number(raw);
      if (raw.trim() !== "" && Number.isFinite(n)) o[key] = n * scale;
    };
    put("condo_town_psf", tune.condoTownPsf);
    put("condo_apt_psf", tune.condoAptPsf);
    put("condo_apt_illiquidity_discount", tune.aptDiscountPct, 0.01);
    put("hard_cost_psf", tune.hardCostPsf);
    put("exit_cap_rate", tune.exitCapRatePct, 0.01);
    put("mli_interest_rate", tune.mliRatePct, 0.01);
    put("hold_horizon_years", tune.holdHorizonYears);
    put("condo_registration_months", tune.regMonths);
    return o;
  }

  const [result, setResult] = useState<UnderwriteResult | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [underwritingId, setUnderwritingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Shared-report deep link: /multiplex?share=<token>
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("share");
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/multiplex-underwriter/shared/${token}`);
        if (!res.ok) return;
        const data = await res.json();
        setAddress(data.address);
        setSite(data.site);
        setResult(data.underwrite);
        setUnderwritingId(data.id || null);
        setStep("report");
      } catch { /* fall through to normal flow */ }
    })();
  }, []);

  async function resolveSite() {
    setBusy(true);
    setError(null);
    savePropertyContext({
      address,
      postalCode: postalCode || undefined,
      mlsNumber: listingId || undefined,
      price: purchasePrice ? Number(purchasePrice) : undefined,
      lotFrontageFt: frontage ? Number(frontage) : undefined,
      lotDepthFt: depth ? Number(depth) : undefined,
      lotAreaSqft: lotArea ? Number(lotArea) : undefined,
    });
    track({ event: "analyzer_started", address, strategy: "multiplex", source: "multiplex_underwriter" });
    try {
      // Geocode client-side first so the server isn't rate-limited or blocked by
      // Nominatim. Fall back to server-side geocoding if the client call fails.
      const geo = await geocodeAddressClient(address);
      const hasDims = hasLotInput;
      const res = await apiRequest("POST", "/api/multiplex-underwriter", {
        address: geo?.displayName || address,
        listingId: listingId || undefined,
        postalCode: postalCode || undefined,
        ...(geo ? { lat: geo.lat, lng: geo.lng } : {}),
        ...(hasDims
          ? {
              lotFrontageFt: Number(frontage) > 0 ? Number(frontage) : undefined,
              lotDepthFt: Number(depth) > 0 ? Number(depth) : undefined,
              lotAreaSqft: Number(lotArea) > 0 ? Number(lotArea) : undefined,
              purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
              laneAccess,
              cornerLot,
              majorStreet,
              transitAreaStatus: transitAreaStatus === "unknown" ? undefined : transitAreaStatus,
              transitStationDistanceM: transitDistance ? Number(transitDistance) : undefined,
            }
          : {}),
      });
      const data = await res.json();
      if (data.status === "needs_lot_dimensions") {
        setSite(data.site);
        setStep("confirm");
      } else if (data.status === "complete") {
        setSite(data.site);
        setResult(data.underwrite);
        setShareToken(data.shareToken);
        setUnderwritingId(data.id || null);
        setStep("report");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (e: any) {
      const status = e?.status as number | undefined;
      const message = String(e?.message || "Underwrite failed — please try again.");
      if (status === 429) {
        // The cap is a capture moment, not an error — hitting it means they are
        // working real sites. Show the offer instead of a red banner.
        setLimitReached(true);
        setError(null);
      } else if (status === 400 || status === 422) {
        setError(message);
      } else {
        setError("Could not resolve that address. Check the spelling and try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function runUnderwrite() {
    setBusy(true);
    setError(null);
    savePropertyContext({
      address,
      postalCode: postalCode || undefined,
      mlsNumber: listingId || undefined,
      price: purchasePrice ? Number(purchasePrice) : undefined,
      lotFrontageFt: frontage ? Number(frontage) : undefined,
      lotDepthFt: depth ? Number(depth) : undefined,
      lotAreaSqft: lotArea ? Number(lotArea) : undefined,
    });
    track({ event: "calculator.started", address, strategy: "multiplex", source: "multiplex_underwriter" });
    try {
      const overrides = buildAssumptionOverrides();
      const res = await apiRequest("POST", "/api/multiplex-underwriter", {
        address,
        listingId: listingId || undefined,
        postalCode: postalCode || undefined,
        lat: site?.lat ?? undefined,
        lng: site?.lng ?? undefined,
        lotFrontageFt: Number(frontage) > 0 ? Number(frontage) : undefined,
        lotDepthFt: Number(depth) > 0 ? Number(depth) : undefined,
        lotAreaSqft: Number(lotArea) > 0 ? Number(lotArea) : undefined,
        purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
        laneAccess,
        cornerLot,
        majorStreet,
        transitAreaStatus: transitAreaStatus === "unknown" ? undefined : transitAreaStatus,
        transitStationDistanceM: transitDistance ? Number(transitDistance) : undefined,
        mliCommitments: {
          affordabilityLevel: tune.affordabilityLevel,
          energyLevel: tune.energyLevel,
          accessibilityLevel: tune.accessibilityLevel,
        },
        ...(Object.keys(overrides).length > 0 ? { assumptionOverrides: overrides } : {}),
      });
      const data = await res.json();
      if (data.status === "complete") {
        setSite(data.site);
        setResult(data.underwrite);
        setShareToken(data.shareToken);
        setUnderwritingId(data.id || null);
        setStep("report");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (e: any) {
      const status = e?.status as number | undefined;
      const message = String(e?.message || "Underwrite failed — please try again.");
      if (status === 429) {
        // The cap is a capture moment, not an error — hitting it means they are
        // working real sites. Show the offer instead of a red banner.
        setLimitReached(true);
        setError(null);
      } else if (status === 400 || status === 422) {
        setError(message);
      } else {
        setError("Underwrite failed — please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  function copyShareLink() {
    if (!shareToken) return;
    navigator.clipboard.writeText(`${window.location.origin}/multiplex?share=${shareToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (shareToken) track({ event: "analyzer_shared", share_token: shareToken });
  }

  const pageMeta = SHARED_ROUTE_META["/multiplex"];
  const planningResult = result?.planning ?? {
    transit: {
      status: "unknown" as const,
      certainty: "unknown" as const,
      distance_m: null,
      major_street: majorStreet,
      parking_minimums_prohibited: false,
      policy_height_storeys: null,
      summary: "This shared report predates the transit-area layer. Re-run the address to add MTSA and major-street context.",
      notes: [],
    },
    majorStreet,
    cornerLot,
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={pageMeta.title}
        description={pageMeta.description}
        canonicalUrl="/multiplex"
        keywords="Toronto multiplex underwriter, Toronto fourplex, Toronto sixplex, MLI Select calculator, multiplex pro forma"
      />
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <Badge variant="outline" className="mb-3"><Sparkles className="h-3 w-3 mr-1 text-ai" /> Institutional-grade Toronto site screen</Badge>
          <h1 className="text-3xl md:text-5xl font-bold mb-3 text-balance">Can this Toronto lot become a better investment?</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Start with a DDF listing or address. Get a sourced planning screen, lot-matched concept, construction and rent pro forma,
            then compare CMHC small-rental financing below five units with MLI Select at five or more.
          </p>
          {/* No CTA above the form. The only one here used to be "Browse
              pre-screened map listings", which routed the highest-intent
              visitor on the site away to the map before they had entered an
              address. It now sits below the form as a fallback for people who
              arrived without a specific site in mind. */}
        </div>

        <JourneyProgress step={step} />

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {limitReached && (
          <div className="mb-6">
            <UnlockMoreUnderwrites
              address={address || undefined}
              onUnlocked={() => setLimitReached(false)}
            />
          </div>
        )}

        {/* Step 1 — address */}
        {step === "input" && !limitReached && (
          <Card className="max-w-xl mx-auto">
            <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Property address</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {listingId && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3" data-testid="multiplex-ddf-context">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">CREA DDF listing attached</p>
                  <p className="mt-1 text-sm">MLS {listingId}{purchasePrice ? ` · ${fmtMoney(Number(purchasePrice))}` : ""}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Address, asking price, and any published lot dimensions came across from the Deals map. Confirm them against the listing and survey.</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="address">Street address (Toronto)</Label>
                <Input id="address" placeholder="123 Logan Ave" value={address} onChange={(e) => setAddress(e.target.value)} className="h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal">Postal code <span className="text-muted-foreground">(optional — improves sixplex-ward detection)</span></Label>
                <Input id="postal" placeholder="M4M 2N2" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="h-12" />
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                <p className="text-sm font-medium">Lot dimensions</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="frontage">Frontage (ft)</Label>
                    <Input id="frontage" type="number" placeholder="25" value={frontage} onChange={(e) => setFrontage(e.target.value)} className="h-12 font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="depth">Depth (ft)</Label>
                    <Input id="depth" type="number" placeholder="120" value={depth} onChange={(e) => setDepth(e.target.value)} className="h-12 font-mono" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lot-area">Lot area (sqft) <span className="text-muted-foreground">(use if frontage or depth is missing)</span></Label>
                  <Input id="lot-area" type="number" placeholder="3000" value={lotArea} onChange={(e) => setLotArea(e.target.value)} className="h-12 font-mono" />
                </div>
                <p className="text-xs text-muted-foreground">
                  DDF lot dimensions are prefilled when available. Enter them now for an instant run, or leave them blank and confirm after the site screen.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Purchase / asking price <span className="text-muted-foreground">(optional)</span></Label>
                <Input id="price" type="number" placeholder="1200000" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="h-12 font-mono" />
              </div>

              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <Label htmlFor="lane" className="cursor-pointer">Rear lane access (laneway suite potential)</Label>
                <Switch id="lane" checked={laneAccess} onCheckedChange={setLaneAccess} />
              </div>

              <details className="rounded-lg border bg-card">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Add MTSA, major-street, or corner-lot context</summary>
                <div className="px-4 pb-4">
                  <PlanningContextFields
                    transitAreaStatus={transitAreaStatus}
                    onTransitAreaStatusChange={setTransitAreaStatus}
                    transitDistance={transitDistance}
                    onTransitDistanceChange={setTransitDistance}
                    majorStreet={majorStreet}
                    onMajorStreetChange={setMajorStreet}
                    cornerLot={cornerLot}
                    onCornerLotChange={setCornerLot}
                  />
                </div>
              </details>

              <Button className="w-full h-12" disabled={busy || address.trim().length < 5} onClick={resolveSite}>
                {busy ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {hasLotInput ? "Underwriting…" : "Resolving site…"}</>
                ) : (
                  <>{hasLotInput ? "Run the underwrite" : "Resolve site"} <ArrowRight className="h-4 w-4 ml-2" /></>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">3 free underwrites per day — sign in for more.</p>
            </CardContent>
          </Card>
        )}

        {/* Below the form, not above it: a way out for someone who arrived
            without a specific address, without pulling everyone else off the
            page before they have started. */}
        {step === "input" && !limitReached && (
          <div className="max-w-xl mx-auto mt-6 space-y-6">
            <p className="text-center text-sm text-muted-foreground">
              No address in mind?{" "}
              <Link
                href="/deals?city=Toronto&strategy=multiplex"
                className="font-medium text-primary hover:underline"
                onClick={() => track({ event: "cta_clicked", cta: "multiplex_browse_map", location: "/multiplex", destination: "/deals" })}
              >
                Browse Toronto listings already pre-screened for multiplex signals →
              </Link>
            </p>
            <MultiplexEventCta placement="inline" sourcePage="/multiplex" />
          </div>
        )}

        {/* Step 2 — confirm site + lot dims */}
        {step === "confirm" && site && (
          <div className="max-w-2xl mx-auto space-y-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" /> Site resolved</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-medium">{site.address}</span>
                  {site.zoning ? (
                    <span className="flex items-center gap-2">Zone <Badge>{site.zoning.zoneCode}</Badge> <ProvenanceBadge kind="verified" /></span>
                  ) : (
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">Zone not verified <ProvenanceBadge kind="assumption" /></span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <ScreenChip icon={TreeDeciduous} label="City trees" flagged={site.trees.cityTreeConflict} unavailable={site.trees.status === "no_data"} />
                  <ScreenChip icon={Waves} label="TRCA regulated" flagged={site.trca.regulated} unavailable={site.trca.status === "unavailable"} />
                  <ScreenChip icon={Landmark} label="Heritage" flagged={site.heritage.listed} unavailable={site.heritage.status === "no_data"} />
                </div>
                {site.notes.length > 0 && (
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {site.notes.map((n, i) => <li key={i}>• {n}</li>)}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Scale className="h-5 w-5" /> Confirm the lot</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="frontage">Frontage (ft)</Label>
                    <Input id="frontage" type="number" placeholder="25" value={frontage} onChange={(e) => setFrontage(e.target.value)} className="h-12 font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="depth">Depth (ft)</Label>
                    <Input id="depth" type="number" placeholder="120" value={depth} onChange={(e) => setDepth(e.target.value)} className="h-12 font-mono" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-lot-area">Lot area (sqft) <span className="text-muted-foreground">(accepted when a dimension is missing)</span></Label>
                  <Input id="confirm-lot-area" type="number" placeholder="3000" value={lotArea} onChange={(e) => setLotArea(e.target.value)} className="h-12 font-mono" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Purchase / asking price <span className="text-muted-foreground">(optional — residual land value guides you without it)</span></Label>
                  <Input id="price" type="number" placeholder="1200000" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="h-12 font-mono" />
                </div>
                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <Label htmlFor="lane" className="cursor-pointer">Rear lane access (laneway suite potential)</Label>
                  <Switch id="lane" checked={laneAccess} onCheckedChange={setLaneAccess} />
                </div>
                <PlanningContextFields
                  transitAreaStatus={transitAreaStatus}
                  onTransitAreaStatusChange={setTransitAreaStatus}
                  transitDistance={transitDistance}
                  onTransitDistanceChange={setTransitDistance}
                  majorStreet={majorStreet}
                  onMajorStreetChange={setMajorStreet}
                  cornerLot={cornerLot}
                  onCornerLotChange={setCornerLot}
                />
                <div className="flex gap-3">
                  <Button variant="outline" className="h-12" onClick={() => setStep("input")}>Back</Button>
                  <Button className="flex-1 h-12" disabled={busy || !hasLotInput} onClick={runUnderwrite}>
                    {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Underwriting…</> : <>Run the underwrite <Building2 className="h-4 w-4 ml-2" /></>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3 — report */}
        {step === "report" && result && site && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-2xl font-bold">{address || site.address}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {listingId && <Badge variant="outline">MLS {listingId}</Badge>}
                  {site.zoning && <><Badge>{site.zoning.zoneCode}</Badge><ProvenanceBadge kind="verified" /></>}
                  <Badge variant="outline">up to {result.maxUnitsAsOfRight} units as-of-right</Badge>
                  {result.sixplex.eligible && <Badge className="bg-ai/10 text-ai hover:bg-ai/10 border-ai/30">sixplex ward likely</Badge>}
                </div>
              </div>
              <div className="flex gap-2">
                {shareToken && (
                  <Button variant="outline" size="sm" onClick={copyShareLink}>
                    <Share2 className="h-4 w-4 mr-1" /> {copied ? "Copied!" : "Share"}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => { setStep("input"); setResult(null); setSite(null); setUnderwritingId(null); setShareToken(null); }}>New underwrite</Button>
              </div>
            </div>

            {/* The answer first. Everything below is the reasoning. */}
            {(() => {
              const rec = result.recommendedTakeout;
              const rc = rec?.configKey ? result.configs.find((c) => c.config.key === rec.configKey) : null;
              const isHold = rec?.takeout === "mli_hold";
              const isCondo = rec?.takeout === "condo_termination";
              // When the comparator lands on "neither", no residual land value
              // is honest to headline — quoting one path's max price would imply
              // a recommendation the model explicitly declined to make.
              const hasPath = rc != null && (isHold || isCondo);
              return (
                <VerdictSummary
                  maxUnitsAsOfRight={result.maxUnitsAsOfRight}
                  sixplexEligible={result.sixplex.eligible}
                  sixplexCertainty={result.sixplex.certainty}
                  takeout={rec?.takeout ?? null}
                  maxLandPrice={
                    hasPath ? (isHold ? rc!.residualLandValue.rentalPath : rc!.residualLandValue.condoPath) : null
                  }
                  returnLabel={hasPath ? (isHold ? "Yield on cost" : "Margin on cost") : null}
                  returnValue={
                    hasPath ? (isHold ? rc!.rentalHold.yieldOnCost : rc!.condoExit.marginOnCost) : null
                  }
                  askingPrice={purchasePrice ? Number(purchasePrice) : null}
                />
              );
            })()}

            {/* Screens */}
            <div className="flex flex-wrap gap-2">
              <ScreenChip icon={TreeDeciduous} label="City trees" flagged={site.trees.cityTreeConflict} unavailable={site.trees.status === "no_data"} />
              <ScreenChip icon={Waves} label="TRCA regulated" flagged={site.trca.regulated} unavailable={site.trca.status === "unavailable"} />
              <ScreenChip icon={Landmark} label="Heritage" flagged={site.heritage.listed} unavailable={site.heritage.status === "no_data"} />
            </div>

            <Card className="border-blue-500/25 bg-blue-500/5" data-testid="multiplex-planning-result">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg"><RouteIcon className="h-5 w-5 text-blue-600" /> Transit and major-street layer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {planningResult.transit.status === "pmtsa" ? "Protected MTSA"
                      : planningResult.transit.status === "mtsa" ? "MTSA"
                        : planningResult.transit.status === "likely_mtsa_inferred" ? "Possible MTSA — radius only"
                          : planningResult.transit.status === "outside" ? "Outside MTSA"
                            : "MTSA not confirmed"}
                  </Badge>
                  <Badge variant="outline">{planningResult.majorStreet ? "Major street" : "Local street / unconfirmed"}</Badge>
                  {planningResult.cornerLot && <Badge variant="outline">Corner lot</Badge>}
                  {planningResult.transit.parking_minimums_prohibited && <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10">No parking minimum</Badge>}
                  {planningResult.transit.policy_height_storeys && <Badge className="bg-blue-500/10 text-blue-700 hover:bg-blue-500/10">Policy support: {planningResult.transit.policy_height_storeys} storeys</Badge>}
                </div>
                <p className="leading-6 text-muted-foreground">{planningResult.transit.summary}</p>
                <p className="text-xs text-muted-foreground">
                  Transit-area policy upside is kept separate from the as-of-right envelope. Confirm the polygon and street designation on the{" "}
                  <a href={TORONTO_MTSA_MAP_URL} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">City of Toronto map</a> before pricing it into an offer.
                </p>
              </CardContent>
            </Card>

            {/* AI narrative */}
            {result.report && (
              <Card className="border-ai/30 bg-gradient-to-b from-ai/10 to-transparent">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-ai" /> The read
                    {result.reportSource === "ai" && <ProvenanceBadge kind="estimate" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-relaxed">
                  <p>{result.report.siteSummary}</p>
                  <p>{result.report.zoningSummary}</p>
                  <p>{result.report.varianceNarrative}</p>
                  <p>{result.report.riskNarrative}</p>
                  <Separator />
                  <p className="font-medium">{result.report.recommendation.bestPath}</p>
                </CardContent>
              </Card>
            )}

            {/* Recommended takeout — the dual-takeout comparator's site-level pick */}
            {result.recommendedTakeout && result.recommendedTakeout.configKey && (() => {
              const rec = result.recommendedTakeout;
              const rc = result.configs.find((c) => c.config.key === rec.configKey);
              const tk = rc?.takeout;
              return (
                <Card className="border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 to-transparent">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 flex-wrap text-lg">
                      <Scale className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      Recommended takeout: {TAKEOUT_LABEL[rec.takeout]}
                      {rc && <Badge variant="outline">{rc.config.label}</Badge>}
                      {rec.formPreferenceApplied && <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/30">town form preferred</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {tk && (
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className={`rounded-lg border p-3 space-y-1.5 ${rec.takeout === "condo_termination" ? "border-emerald-500/40 bg-emerald-500/10" : ""}`}>
                          <p className="font-semibold">Condo termination <span className="font-normal text-muted-foreground">— as {FORM_LABEL[tk.condo.form]}</span></p>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                            <span className="text-muted-foreground">Avg price / unit</span>
                            <span className="font-mono text-right">{fmtMoney(tk.condo.avgPricePerUnit)}</span>
                            <span className="text-muted-foreground">Profit</span>
                            <span className={`font-mono text-right ${tk.condo.profit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{fmtMoney(tk.condo.profit)} ({fmtPct(tk.condo.marginOnCost)})</span>
                            <span className="text-muted-foreground">Registration + sell-out</span>
                            <span className="font-mono text-right">{tk.condo.monthsToExit} months</span>
                          </div>
                        </div>
                        <div className={`rounded-lg border p-3 space-y-1.5 ${rec.takeout === "mli_hold" ? "border-emerald-500/40 bg-emerald-500/10" : ""}`}>
                          <p className="font-semibold">MLI Select hold</p>
                          {tk.hold.eligible ? (
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                              <span className="text-muted-foreground">Insured loan</span>
                              <span className="font-mono text-right">{fmtMoney(tk.hold.loanBalance)}</span>
                              <span className="text-muted-foreground">Equity left in</span>
                              <span className="font-mono text-right">{fmtMoney(tk.hold.equityLeftIn)}</span>
                              <span className="text-muted-foreground">Cash flow / yr</span>
                              <span className={`font-mono text-right ${tk.hold.annualCashFlow >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{fmtMoney(tk.hold.annualCashFlow)}</span>
                              <span className="text-muted-foreground">{tk.hold.horizonYears}-yr value + cash flow</span>
                              <span className={`font-mono text-right ${tk.hold.horizonProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{fmtMoney(tk.hold.horizonProfit)}</span>
                            </div>
                          ) : (
                            <p className="text-muted-foreground">{tk.hold.reason}</p>
                          )}
                        </div>
                      </div>
                    )}
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {rec.reasons.map((r, i) => <li key={i}>• {r}</li>)}
                    </ul>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Envelope */}
            <Card>
              <CardContent className="pt-6 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
                <span>Practical buildable GFA: <strong>{result.envelope.practicalGfaSqft.value.toLocaleString()} sqft</strong> <ProvenanceBadge kind="estimate" /></span>
                <span className="text-muted-foreground">({result.envelope.practicalGfaSqft.source})</span>
              </CardContent>
            </Card>

            {result.developmentReport && (
              <MultiplexConceptPreview report={result.developmentReport} />
            )}

            {/* Fine-tune the takeout — every parameter is overridable per run */}
            <details className="rounded-lg border bg-card">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                Fine-tune the takeout — pricing, financing, and MLI Select commitments
              </summary>
              <div className="px-4 pb-4 space-y-4">
                <PlanningContextFields
                  transitAreaStatus={transitAreaStatus}
                  onTransitAreaStatusChange={setTransitAreaStatus}
                  transitDistance={transitDistance}
                  onTransitDistanceChange={setTransitDistance}
                  majorStreet={majorStreet}
                  onMajorStreetChange={setMajorStreet}
                  cornerLot={cornerLot}
                  onCornerLotChange={setCornerLot}
                />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <TuneField label="Condo-town $/sqft" placeholder="1000" value={tune.condoTownPsf} onChange={(v) => setTune({ ...tune, condoTownPsf: v })} />
                  <TuneField label="Condo-apt $/sqft" placeholder="900" value={tune.condoAptPsf} onChange={(v) => setTune({ ...tune, condoAptPsf: v })} />
                  <TuneField label="Apt clearance discount %" placeholder="5" value={tune.aptDiscountPct} onChange={(v) => setTune({ ...tune, aptDiscountPct: v })} />
                  <TuneField label="Registration months" placeholder="12" value={tune.regMonths} onChange={(v) => setTune({ ...tune, regMonths: v })} />
                  <TuneField label="Hard cost $/sqft" placeholder="400" value={tune.hardCostPsf} onChange={(v) => setTune({ ...tune, hardCostPsf: v })} />
                  <TuneField label="Exit cap rate %" placeholder="4.75" value={tune.exitCapRatePct} onChange={(v) => setTune({ ...tune, exitCapRatePct: v })} />
                  <TuneField label="MLI rate %" placeholder="4.5" value={tune.mliRatePct} onChange={(v) => setTune({ ...tune, mliRatePct: v })} />
                  <TuneField label="Hold horizon (years)" placeholder="5" value={tune.holdHorizonYears} onChange={(v) => setTune({ ...tune, holdHorizonYears: v })} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <TuneSelect
                    label="MLI affordability commitment"
                    value={tune.affordabilityLevel}
                    onChange={(v) => setTune({ ...tune, affordabilityLevel: v })}
                    options={[
                      { value: 0, label: "None (0 pts)" },
                      { value: 1, label: "10% affordable units (50 pts)" },
                      { value: 2, label: "15% affordable units (70 pts)" },
                      { value: 3, label: "25% affordable units (100 pts)" },
                    ]}
                  />
                  <TuneSelect
                    label="MLI energy commitment"
                    value={tune.energyLevel}
                    onChange={(v) => setTune({ ...tune, energyLevel: v })}
                    options={[
                      { value: 0, label: "None (0 pts)" },
                      { value: 1, label: "20% better than code (20 pts)" },
                      { value: 2, label: "25% better than code (35 pts)" },
                      { value: 3, label: "40% better than code (50 pts)" },
                    ]}
                  />
                  <TuneSelect
                    label="MLI accessibility commitment"
                    value={tune.accessibilityLevel}
                    onChange={(v) => setTune({ ...tune, accessibilityLevel: v })}
                    options={[
                      { value: 0, label: "None (0 pts)" },
                      { value: 1, label: "Min. accessibility (20 pts)" },
                      { value: 2, label: "Universal design (30 pts)" },
                    ]}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm" disabled={busy || !hasLotInput} onClick={runUnderwrite}>
                    {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Re-running…</> : "Re-run with these assumptions"}
                  </Button>
                  {!hasLotInput && (
                    <span className="text-xs text-muted-foreground">Shared report — start a new underwrite to fine-tune.</span>
                  )}
                  <span className="text-xs text-muted-foreground">Blank fields keep the platform defaults.</span>
                </div>
              </div>
            </details>

            {/* Config cards */}
            <div className="grid md:grid-cols-2 gap-4">
              {result.configs.map((c) => {
                const isFlipWinner = result.winner.flip === c.config.key;
                const isHoldWinner = result.winner.hold === c.config.key;
                return (
                  <Card key={c.config.key} className={isFlipWinner || isHoldWinner ? "border-ai/40 shadow-sm" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{c.config.label}</CardTitle>
                        <RiskChip level={c.varianceRisk.level} />
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {isFlipWinner && <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 border-orange-500/30">best flip</Badge>}
                        {isHoldWinner && <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/30">best hold</Badge>}
                        {result.recommendedTakeout?.configKey === c.config.key && (
                          <Badge className="bg-ai/10 text-ai hover:bg-ai/10 border-ai/30">recommended: {TAKEOUT_LABEL[result.recommendedTakeout.takeout]}</Badge>
                        )}
                        <Badge variant="outline">{c.config.approvalPath.replace(/_/g, " ")}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <p className="text-muted-foreground">
                        {c.config.unitMix.map((m) => `${m.count}×${m.type.toUpperCase()}`).join(" + ")} · {c.config.netSqft.toLocaleString()} sqft net
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        <span className="text-muted-foreground">All-in cost</span>
                        <span className="font-mono text-right">{fmtMoney(c.costs.totalDevCost)}</span>
                        {c.takeout ? (
                          <>
                            <span className="text-muted-foreground">Condo termination <span className="text-xs">({FORM_LABEL[c.takeout.condo.form]})</span></span>
                            <span className={`font-mono text-right ${c.takeout.condo.profit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                              {fmtMoney(c.takeout.condo.profit)} ({fmtPct(c.takeout.condo.marginOnCost)})
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-muted-foreground">Condo exit</span>
                            <span className={`font-mono text-right ${c.condoExit.profit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                              {fmtMoney(c.condoExit.profit)} ({fmtPct(c.condoExit.marginOnCost)})
                            </span>
                          </>
                        )}
                        <span className="text-muted-foreground">Stabilized NOI</span>
                        <span className="font-mono text-right">{fmtMoney(c.rentalHold.noi)}/yr</span>
                        <span className="text-muted-foreground">Hold financing</span>
                        <span className="font-mono text-right">
                          {c.mli.eligible
                            ? `MLI Select · ${fmtMoney(c.mli.maxLoan)}`
                            : c.smallRental?.eligible
                              ? `CMHC small rental · ${fmtMoney(c.smallRental.indicativeLoan)}`
                              : "Lender screen required"}
                        </span>
                        {c.mli.eligible && c.comparison.holdCashOnCash != null && (
                          <>
                            <span className="text-muted-foreground">Hold cash-on-cash</span>
                            <span className="font-mono text-right">{fmtPct(c.comparison.holdCashOnCash)}</span>
                          </>
                        )}
                        {c.takeout?.hold.eligible && (
                          <>
                            <span className="text-muted-foreground">Hold {c.takeout.hold.horizonYears}-yr value + cash flow</span>
                            <span className={`font-mono text-right ${c.takeout.hold.horizonProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                              {fmtMoney(c.takeout.hold.horizonProfit)}
                            </span>
                          </>
                        )}
                        {c.takeout && (
                          <>
                            <span className="text-muted-foreground">Better takeout</span>
                            <span className="font-mono text-right">{TAKEOUT_LABEL[c.takeout.decision.recommended]}</span>
                          </>
                        )}
                        <span className="text-muted-foreground">Residual land value</span>
                        <span className="font-mono text-right">
                          {fmtMoney(Math.max(c.residualLandValue.condoPath, c.residualLandValue.rentalPath))} <ProvenanceBadge kind="estimate" />
                        </span>
                      </div>
                      {c.smallRental?.eligible && (
                        <div className="rounded-lg border border-blue-500/25 bg-blue-500/5 p-3 text-xs leading-5">
                          <p className="font-semibold">2–4 unit CMHC small-rental screen</p>
                          <p className="mt-1 text-muted-foreground">
                            {fmtPct(c.smallRental.maxLtv, 0)} LTV ceiling · {c.smallRental.amortYears}-year amortization · {fmtMoney(c.smallRental.indicativeEquity)} indicative equity
                            {c.smallRental.noiCoverageRatio ? ` · ${c.smallRental.noiCoverageRatio.toFixed(2)}× NOI coverage` : ""}.
                          </p>
                          <p className="mt-1 text-muted-foreground">{c.smallRental.qualificationNote}</p>
                          <a href={c.smallRental.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block font-semibold text-primary hover:underline">CMHC source ↗</a>
                        </div>
                      )}
                      {c.varianceRisk.factors.length > 0 && (
                        <details className="text-xs text-muted-foreground">
                          <summary className="cursor-pointer font-medium">Risk factors ({c.varianceRisk.factors.length})</summary>
                          <ul className="mt-1 space-y-1">
                            {c.varianceRisk.factors.map((f) => <li key={f.key}>• {f.reason}</li>)}
                          </ul>
                        </details>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Recommendation lists */}
            {result.report && (
              <div className="grid md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-red-700 dark:text-red-400">What kills this deal</CardTitle></CardHeader>
                  <CardContent><ul className="text-sm space-y-2">{result.report.recommendation.dealKillers.map((d, i) => <li key={i}>• {d}</li>)}</ul></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-blue-700 dark:text-blue-400">Verify with professionals</CardTitle></CardHeader>
                  <CardContent><ul className="text-sm space-y-2">{result.report.recommendation.verifyWithProfessionals.map((d, i) => <li key={i}>• {d}</li>)}</ul></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-emerald-700 dark:text-emerald-400">Next steps</CardTitle></CardHeader>
                  <CardContent><ol className="text-sm space-y-2">{result.report.recommendation.nextSteps.map((d, i) => <li key={i}>{i + 1}. {d}</li>)}</ol></CardContent>
                </Card>
              </div>
            )}

            {(() => {
              const recommendedKey = result.recommendedTakeout?.configKey || result.winner.hold || result.winner.flip;
              const recommended = result.configs.find((config) => config.config.key === recommendedKey) || result.configs[0];
              if (!recommended) return null;
              const estimatedMonthlyRent = recommended.rentalHold.monthlyRentRoll.reduce(
                (sum, row) => sum + row.count * row.rentEach,
                0,
              );
              const annualCashFlow = recommended.mli.eligible
                ? recommended.comparison.holdAnnualCashFlow
                : recommended.smallRental?.eligible
                  ? recommended.rentalHold.noi - recommended.smallRental.annualDebtService
                  : recommended.rentalHold.noi;
              const takeout = result.recommendedTakeout?.takeout || recommended.comparison.recommendedExit;
              const maxLandPrice = takeout === "condo_termination"
                ? recommended.residualLandValue.condoPath
                : recommended.residualLandValue.rentalPath;
              const financingSignal = recommended.mli.eligible
                ? "CMHC MLI Select screen"
                : recommended.smallRental?.eligible
                  ? "CMHC 2–4 unit small-rental screen"
                  : "financing verification required";

              return (
                <BuyWithRealistCta
                  context={{
                    listingId: listingId || null,
                    underwritingId,
                    address: address || site.address,
                    city: "Toronto",
                    province: "ON",
                    price: purchasePrice ? Number(purchasePrice) : null,
                    estimatedMonthlyRent,
                    capRate: recommended.rentalHold.yieldOnCost * 100,
                    monthlyCashFlow: annualCashFlow / 12,
                    recommendedUnits: recommended.config.units,
                    maxLandPrice,
                    recommendedTakeout: takeout,
                    source: source === "ddf_listing" ? "multiplex_ddf_underwrite" : "multiplex_underwrite",
                    signals: [
                      `${result.maxUnitsAsOfRight} units as-of-right screen`,
                      financingSignal,
                      planningResult.transit.status === "unknown" ? "MTSA status unconfirmed" : planningResult.transit.status,
                    ],
                  }}
                  className="mx-auto max-w-2xl"
                />
              );
            })()}

            {/* Highest-intent moment on the platform: they have just been told
                what their lot supports. Event first (cheap, dated, social),
                then the book-a-call path. */}
            <MultiplexEventCta placement="result" sourcePage="/multiplex" className="mt-8" />

            <NextStepBlock sourcePage="/multiplex" className="mt-6" />

            {/* Assumption notes */}
            {result.assumptionNotes.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">Assumptions in play</p>
                <ul className="text-sm text-amber-900 dark:text-amber-200 space-y-1">
                  {result.assumptionNotes.map((n, i) => <li key={i}>• {n}</li>)}
                </ul>
              </div>
            )}

            <p className="text-xs text-muted-foreground leading-relaxed">
              Preliminary screening only — not planning, legal, financial, or architectural advice. Zoning permissions,
              envelope figures, costs, rents, and financing terms are estimates that must be verified with the City of
              Toronto, a registered planner or architect, and your lender before acting.
            </p>

          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
