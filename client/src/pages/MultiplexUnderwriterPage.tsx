/**
 * AI Multiplex Underwriter — /tools/multiplex-underwriter
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
import { NextStepBlock } from "@/components/NextStepBlock";
import { MultiplexEventCta } from "@/components/events/MultiplexEventCta";
import { VerdictSummary } from "@/components/multiplex/VerdictSummary";
import { UnlockMoreUnderwrites } from "@/components/multiplex/UnlockMoreUnderwrites";
import { ZoningTierBanner } from "@/components/multiplex/ZoningTierBanner";
import { MliGradient, type MliGradientData } from "@/components/multiplex/MliGradient";
import { MultiplexActionRail } from "@/components/multiplex/MultiplexActionRail";
import { ListingPreview, type ListingSummary } from "@/components/multiplex/ListingPreview";
import type { ZoningTier } from "@shared/multiplexZoningTier";
import { loadPropertyContext, propertyContextToParams, savePropertyContext } from "@/lib/propertyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { track } from "@/lib/analytics";
import {
  Building2, MapPin, TreeDeciduous, Landmark, Waves, AlertTriangle,
  CheckCircle2, Loader2, Share2, ArrowRight, Sparkles, Scale, Search, Database,
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
  rentalHold: { noi: number; stabilizedValue: number; yieldOnCost: number };
  residualLandValue: { condoPath: number; rentalPath: number };
  mli: { eligible: boolean; reason?: string; premiumPct: number; maxLoan: number; actualDscr: number; amortYears: number; bindingConstraint: string };
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
  /** Present on reports run after the tier/gradient shipped; absent on older shared links. */
  ward?: { number: number; name: string | null } | null;
  zoningTier?: ZoningTier;
  mliGradient?: MliGradientData | null;
  listing?: ListingSummary | null;
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
  assumptionNotes: string[];
  report?: {
    siteSummary: string; zoningSummary: string; varianceNarrative: string; riskNarrative: string;
    recommendation: { bestPath: string; dealKillers: string[]; verifyWithProfessionals: string[]; nextSteps: string[] };
  };
  reportSource?: string;
}

interface DataHealth {
  zoningPolygons: number;
  wards: number;
  streetTrees: number;
  heritageProperties: number;
  wardDetection: "verified" | "inferred_fsa_fallback";
  sixplexWards: number[];
  ddfIngestion: boolean;
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
  const [postalCode, setPostalCode] = useState("");
  const [site, setSite] = useState<ResolvedSite | null>(null);

  const [frontage, setFrontage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("share")) return "";
    return params.get("frontage") ?? (loadPropertyContext()?.lotFrontageM?.toString() ?? "");
  });
  const [depth, setDepth] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("share")) return "";
    return params.get("depth") ?? (loadPropertyContext()?.lotDepthM?.toString() ?? "");
  });
  const [purchasePrice, setPurchasePrice] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("share")) return "";
    return params.get("price") ?? (loadPropertyContext()?.price?.toString() ?? "");
  });
  const [laneAccess, setLaneAccess] = useState(false);

  // Listing-first entry: an MLS number or realtor.ca URL pulled through the
  // CREA DDF feed fills address, coordinates, price and lot before any
  // underwrite is spent. ?mls= / ?listing= auto-pull on load.
  const [listingRef, setListingRef] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("share")) return "";
    return params.get("listing") ?? params.get("mls") ?? "";
  });
  const [listingPreview, setListingPreview] = useState<ListingSummary | null>(null);
  const [listingInCoverage, setListingInCoverage] = useState(true);
  const [listingBusy, setListingBusy] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);
  const [feedUnavailable, setFeedUnavailable] = useState(false);
  const [mlsNumber, setMlsNumber] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("share") ? null : params.get("mls");
  });
  const [health, setHealth] = useState<DataHealth | null>(null);
  const [underwritingId, setUnderwritingId] = useState<string | null>(null);

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
  const [copied, setCopied] = useState(false);

  // Shared-report deep link: /tools/multiplex-underwriter?share=<token>
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
        if (data.underwrite?.listing?.mlsNumber) setMlsNumber(data.underwrite.listing.mlsNumber);
        if (data.underwrite?.listing?.listPrice && !purchasePrice) setPurchasePrice(String(data.underwrite.listing.listPrice));
        setStep("report");
      } catch { /* fall through to normal flow */ }
    })();
  }, []);

  // Data coverage footnote — public, cached server-side.
  useEffect(() => {
    fetch("/api/multiplex-underwriter/health")
      .then((r) => (r.ok ? r.json() : null))
      .then((h) => h && setHealth(h))
      .catch(() => {});
  }, []);

  // Auto-pull when arriving with ?mls= or ?listing= (e.g. from the cap-rates map).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("listing") ?? params.get("mls");
    if (ref && !params.get("share")) void pullListing(ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function feasibilityHref(listing: ListingSummary): string {
    // The feasibility page seeds from the shared property context, so write it
    // there too; the params make the link self-describing.
    savePropertyContext({
      address: listing.address,
      city: listing.city || undefined,
      province: listing.province || undefined,
      postalCode: listing.postalCode || undefined,
      price: listing.listPrice ?? undefined,
      mlsNumber: listing.mlsNumber ?? undefined,
      lotFrontageM: listing.lot.frontageFt ?? undefined,
      lotDepthM: listing.lot.depthFt ?? undefined,
    });
    return `/tools/multiplex-feasibility${propertyContextToParams({
      address: listing.address,
      city: listing.city || undefined,
      province: listing.province || undefined,
      price: listing.listPrice ?? undefined,
      mlsNumber: listing.mlsNumber ?? undefined,
      lotFrontageM: listing.lot.frontageFt ?? undefined,
      lotDepthM: listing.lot.depthFt ?? undefined,
    })}`;
  }

  function applyListingToForm(listing: ListingSummary) {
    setAddress(listing.address);
    if (listing.postalCode) setPostalCode(listing.postalCode);
    if (listing.lot.frontageFt && listing.lot.depthFt) {
      setFrontage(String(listing.lot.frontageFt));
      setDepth(String(listing.lot.depthFt));
    }
    if (listing.listPrice) setPurchasePrice(String(listing.listPrice));
    setMlsNumber(listing.mlsNumber);
    savePropertyContext({
      address: listing.address,
      city: listing.city || undefined,
      province: listing.province || undefined,
      postalCode: listing.postalCode || undefined,
      price: listing.listPrice ?? undefined,
      mlsNumber: listing.mlsNumber ?? undefined,
    });
  }

  async function pullListing(rawRef?: string) {
    const ref = (rawRef ?? listingRef).trim();
    if (!ref) return;
    setListingBusy(true);
    setListingError(null);
    setFeedUnavailable(false);
    setListingPreview(null);
    track({ event: "feature_used", feature: "multiplex_listing_pull", details: { ref: ref.slice(0, 40) } });
    try {
      const res = await fetch(`/api/multiplex-underwriter/listing/${encodeURIComponent(ref)}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 503 || data?.code === "ListingSourceUnavailable") {
          setFeedUnavailable(true);
        } else {
          setListingError(String(data?.error || "Could not pull that listing."));
        }
        return;
      }
      const listing = data.listing as ListingSummary;
      setListingPreview(listing);
      setListingInCoverage(!!data.inCoverage);
      setListingRef(ref);
      if (data.inCoverage) applyListingToForm(listing);
    } catch {
      setListingError("The listing feed did not respond — try again or enter the address manually.");
    } finally {
      setListingBusy(false);
    }
  }

  /** Runs the underwrite straight from the previewed listing (server re-resolves the feed). */
  async function underwriteListing() {
    if (!listingPreview) return;
    setBusy(true);
    setError(null);
    track({ event: "analyzer_started", address: listingPreview.address, strategy: "multiplex", source: "multiplex_underwriter_listing" });
    try {
      const isUrl = /realtor\.ca|^https?:\/\//i.test(listingRef);
      const res = await apiRequest("POST", "/api/multiplex-underwriter", {
        ...(isUrl ? { listingUrl: listingRef.trim() } : { mlsNumber: (listingPreview.mlsNumber ?? listingRef).trim() }),
        // Previewed fields double as fallbacks if the feed hiccups between calls.
        address: listingPreview.address,
        postalCode: listingPreview.postalCode ?? undefined,
        lat: listingPreview.lat ?? undefined,
        lng: listingPreview.lng ?? undefined,
        ...(Number(frontage) > 0 && Number(depth) > 0 ? { lotFrontageFt: Number(frontage), lotDepthFt: Number(depth) } : {}),
        purchasePrice: purchasePrice ? Number(purchasePrice) : listingPreview.listPrice ?? undefined,
        laneAccess,
      });
      handleUnderwriteResponse(await res.json());
    } catch (e: any) {
      handleUnderwriteError(e);
    } finally {
      setBusy(false);
    }
  }

  function handleUnderwriteResponse(data: any) {
    if (data.status === "outside_coverage") {
      setListingPreview(data.listing);
      setListingInCoverage(false);
      setListingError(String(data.message));
      return;
    }
    if (data.listing?.mlsNumber) setMlsNumber(data.listing.mlsNumber);
    if (data.status === "needs_lot_dimensions") {
      setSite(data.site);
      if (data.listing) applyListingToForm(data.listing);
      setStep("confirm");
    } else if (data.status === "complete") {
      setSite(data.site);
      setResult(data.underwrite);
      setShareToken(data.shareToken ?? null);
      setUnderwritingId(data.id ?? null);
      if (data.listing?.listPrice && !purchasePrice) setPurchasePrice(String(data.listing.listPrice));
      setStep("report");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleUnderwriteError(e: any) {
    const status = e?.status as number | undefined;
    const message = String(e?.message || "Underwrite failed — please try again.");
    if (status === 429) {
      // The cap is a capture moment, not an error — hitting it means they are
      // working real sites. Show the offer instead of a red banner.
      setLimitReached(true);
      setError(null);
    } else if (status === 503 && e?.code === "ListingSourceUnavailable") {
      setFeedUnavailable(true);
    } else if (status === 400 || status === 404 || status === 422) {
      setError(message);
    } else {
      setError("The site lookup service is temporarily unavailable. Your address was not the problem — please try again shortly.");
    }
  }

  async function resolveSite() {
    setBusy(true);
    setError(null);
    savePropertyContext({ address, postalCode: postalCode || undefined });
    track({ event: "analyzer_started", address, strategy: "multiplex", source: "multiplex_underwriter" });
    try {
      // Geocode client-side first so the server isn't rate-limited or blocked by
      // Nominatim. Fall back to server-side geocoding if the client call fails.
      const geo = await geocodeAddressClient(address);
      const hasDims = Number(frontage) > 0 && Number(depth) > 0;
      const res = await apiRequest("POST", "/api/multiplex-underwriter", {
        address: geo?.displayName || address,
        postalCode: postalCode || undefined,
        ...(geo ? { lat: geo.lat, lng: geo.lng } : {}),
        ...(hasDims
          ? {
              lotFrontageFt: Number(frontage),
              lotDepthFt: Number(depth),
              purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
              laneAccess,
            }
          : {}),
      });
      handleUnderwriteResponse(await res.json());
    } catch (e: any) {
      handleUnderwriteError(e);
    } finally {
      setBusy(false);
    }
  }

  async function runUnderwrite() {
    setBusy(true);
    setError(null);
    track({ event: "calculator.started", address, strategy: "multiplex", source: "multiplex_underwriter" });
    try {
      const overrides = buildAssumptionOverrides();
      const res = await apiRequest("POST", "/api/multiplex-underwriter", {
        address,
        postalCode: postalCode || undefined,
        lat: site?.lat ?? undefined,
        lng: site?.lng ?? undefined,
        lotFrontageFt: Number(frontage),
        lotDepthFt: Number(depth),
        purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
        laneAccess,
        // Keep the listing attached to re-runs so the report stays linked to the MLS record.
        ...(mlsNumber ? { mlsNumber } : {}),
        mliCommitments: {
          affordabilityLevel: tune.affordabilityLevel,
          energyLevel: tune.energyLevel,
          accessibilityLevel: tune.accessibilityLevel,
        },
        ...(Object.keys(overrides).length > 0 ? { assumptionOverrides: overrides } : {}),
      });
      handleUnderwriteResponse(await res.json());
    } catch (e: any) {
      handleUnderwriteError(e);
    } finally {
      setBusy(false);
    }
  }

  function copyShareLink() {
    if (!shareToken) return;
    navigator.clipboard.writeText(`${window.location.origin}/tools/multiplex-underwriter?share=${shareToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (shareToken) track({ event: "analyzer_shared", share_token: shareToken });
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <Badge variant="outline" className="mb-3"><Sparkles className="h-3 w-3 mr-1 text-ai" /> AI Multiplex Underwriter — Toronto</Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Spec out a multiplex build in seconds</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Zoning verdict with the by-law cited, tree and ravine screens with evidence, build configurations,
            and the sell-as-condos vs hold-on-CMHC-MLI-Select math — every number labelled by where it came from.
          </p>
          {/* No CTA above the form. The only one here used to be "Browse
              pre-screened map listings", which routed the highest-intent
              visitor on the site away to the map before they had entered an
              address. It now sits below the form as a fallback for people who
              arrived without a specific site in mind. */}
        </div>

        {error && (
          <div className="mb-6 flex flex-col gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </span>
            <Link
              href="/tools/multiplex-feasibility"
              className="shrink-0 font-semibold underline underline-offset-2"
            >
              Use the manual feasibility screener
            </Link>
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

        {/* Step 1 — listing or address */}
        {step === "input" && !limitReached && (
          <Card className="max-w-xl mx-auto">
            <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Property</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Start from a listing — the feed fills address, lot and price. */}
              <div className="rounded-lg border border-ai/30 bg-ai/5 p-4 space-y-3" data-testid="listing-start">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium flex items-center gap-2"><Search className="h-4 w-4 text-ai" /> Start from a listing</p>
                  <span className="text-xs text-muted-foreground">MLS® number or realtor.ca link</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="listing-ref"
                    placeholder="C1234567 or https://www.realtor.ca/real-estate/…"
                    value={listingRef}
                    onChange={(e) => setListingRef(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void pullListing(); } }}
                    className="h-11"
                    disabled={feedUnavailable}
                    data-testid="input-listing-ref"
                  />
                  <Button variant="secondary" className="h-11 shrink-0" disabled={listingBusy || feedUnavailable || listingRef.trim().length < 5} onClick={() => pullListing()} data-testid="button-pull-listing">
                    {listingBusy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Pulling…</> : "Pull listing"}
                  </Button>
                </div>
                {feedUnavailable && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    The listing feed is not connected on this server — enter the address and lot dimensions below instead.
                  </p>
                )}
                {listingError && !feedUnavailable && (
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {listingError}</p>
                )}
                {listingPreview && (
                  <>
                    <ListingPreview
                      listing={listingPreview}
                      inCoverage={listingInCoverage}
                      busy={busy}
                      onUnderwrite={underwriteListing}
                      onOutsideCoverage={() => {
                        const href = feasibilityHref(listingPreview);
                        track({ event: "cta_clicked", cta: "multiplex_outside_coverage_feasibility", location: "/tools/multiplex-underwriter", destination: href });
                        window.location.assign(href);
                      }}
                    />
                    {listingInCoverage && (
                      <p className="text-xs text-muted-foreground">
                        The fields below are filled from the listing — adjust anything the feed got wrong, then run.
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="relative text-center">
                <Separator />
                <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-card px-2 text-xs uppercase tracking-wide text-muted-foreground">or enter it yourself</span>
              </div>

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
                <p className="text-xs text-muted-foreground">
                  Enter dimensions now to skip the confirm step, or leave them blank and we'll ask after resolving the site.
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

              <Button className="w-full h-12" disabled={busy || address.trim().length < 5} onClick={resolveSite}>
                {busy ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {Number(frontage) && Number(depth) ? "Underwriting…" : "Resolving site…"}</>
                ) : (
                  <>{Number(frontage) && Number(depth) ? "Run the underwrite" : "Resolve site"} <ArrowRight className="h-4 w-4 ml-2" /></>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">3 free underwrites per day — sign in for more.</p>
              {health && (
                <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1.5 flex-wrap" data-testid="data-coverage">
                  <Database className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>Data coverage — Ward boundaries: {health.wardDetection === "verified" ? `verified (${health.wards} wards)` : "inferred from postal area"}</span>
                  <span>· Zoning polygons: {health.zoningPolygons.toLocaleString()}</span>
                  <span>· Street trees: {health.streetTrees.toLocaleString()}</span>
                  <span>· Heritage: {health.heritageProperties.toLocaleString()}</span>
                  <span>· Sixplex wards: {health.sixplexWards.join(", ")}</span>
                  <span>· Listing feed: {health.ddfIngestion ? "connected" : "not connected"}</span>
                </p>
              )}
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
                href="/tools/cap-rates?strategy=multiplex"
                className="font-medium text-primary hover:underline"
                onClick={() => track({ event: "cta_clicked", cta: "multiplex_browse_map", location: "/tools/multiplex-underwriter", destination: "/tools/cap-rates" })}
              >
                Browse pre-screened listings on the map →
              </Link>
            </p>
            <MultiplexEventCta placement="inline" sourcePage="/tools/multiplex-underwriter" />
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
                  <Label htmlFor="price">Purchase / asking price <span className="text-muted-foreground">(optional — residual land value guides you without it)</span></Label>
                  <Input id="price" type="number" placeholder="1200000" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="h-12 font-mono" />
                </div>
                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <Label htmlFor="lane" className="cursor-pointer">Rear lane access (laneway suite potential)</Label>
                  <Switch id="lane" checked={laneAccess} onCheckedChange={setLaneAccess} />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="h-12" onClick={() => setStep("input")}>Back</Button>
                  <Button className="flex-1 h-12" disabled={busy || !Number(frontage) || !Number(depth)} onClick={runUnderwrite}>
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
                <Button variant="outline" size="sm" onClick={() => { setStep("input"); setResult(null); setSite(null); setListingPreview(null); setUnderwritingId(null); setMlsNumber(null); }}>New underwrite</Button>
              </div>
            </div>

            {/* The zoning answer first — "6+1" or "4+1", ward named — then the
                money verdict, then the two things to do about it. Everything
                below that is the reasoning. */}
            {result.zoningTier && (
              <ZoningTierBanner
                tier={result.zoningTier}
                envelopeMaxUnits={Math.max(
                  0,
                  ...result.configs
                    .filter((c) => c.config.approvalPath === "as_of_right")
                    .map((c) => c.config.units - (c.config.includesSuite ? 1 : 0)),
                )}
              />
            )}

            {(() => {
              const rec = result.recommendedTakeout;
              const rc = rec?.configKey ? result.configs.find((c) => c.config.key === rec.configKey) : null;
              const isHold = rec?.takeout === "mli_hold";
              const isCondo = rec?.takeout === "condo_termination";
              // When the comparator lands on "neither", no residual land value
              // is honest to headline — quoting one path's max price would imply
              // a recommendation the model explicitly declined to make.
              const hasPath = rc != null && (isHold || isCondo);
              const maxLandPrice = hasPath ? (isHold ? rc!.residualLandValue.rentalPath : rc!.residualLandValue.condoPath) : null;
              const askingPrice = purchasePrice ? Number(purchasePrice) : result.listing?.listPrice ?? null;
              const best = result.mliGradient?.bestCell ?? null;
              const railUnits = rc?.config.units ?? result.maxUnitsAsOfRight;
              return (
                <>
                  <VerdictSummary
                    maxUnitsAsOfRight={result.maxUnitsAsOfRight}
                    sixplexEligible={result.sixplex.eligible}
                    sixplexCertainty={result.sixplex.certainty}
                    takeout={rec?.takeout ?? null}
                    maxLandPrice={maxLandPrice}
                    returnLabel={hasPath ? (isHold ? "Yield on cost" : "Margin on cost") : null}
                    returnValue={hasPath ? (isHold ? rc!.rentalHold.yieldOnCost : rc!.condoExit.marginOnCost) : null}
                    askingPrice={askingPrice}
                    tierHeadline={result.zoningTier?.headline ?? null}
                  />
                  <MultiplexActionRail
                    placement="top"
                    address={address || site.address}
                    mlsNumber={mlsNumber ?? result.listing?.mlsNumber ?? null}
                    underwritingId={underwritingId}
                    maxLandPrice={maxLandPrice}
                    askingPrice={askingPrice}
                    units={railUnits}
                    verdict={result.zoningTier?.headline ?? `${result.maxUnitsAsOfRight} units as-of-right`}
                    mli={best ? { points: best.points, maxLtv: best.ltv, loan: best.loan, dscr: best.dscr, premiumPct: best.premiumPct } : null}
                  />
                </>
              );
            })()}

            {/* Screens */}
            <div className="flex flex-wrap gap-2">
              <ScreenChip icon={TreeDeciduous} label="City trees" flagged={site.trees.cityTreeConflict} unavailable={site.trees.status === "no_data"} />
              <ScreenChip icon={Waves} label="TRCA regulated" flagged={site.trca.regulated} unavailable={site.trca.status === "unavailable"} />
              <ScreenChip icon={Landmark} label="Heritage" flagged={site.heritage.listed} unavailable={site.heritage.status === "no_data"} />
            </div>

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

            {/* MLI Select gradient — points tier × LTV, coloured by where DSCR holds */}
            {result.mliGradient && <MliGradient gradient={result.mliGradient} />}

            {/* Envelope */}
            <Card>
              <CardContent className="pt-6 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
                <span>Practical buildable GFA: <strong>{result.envelope.practicalGfaSqft.value.toLocaleString()} sqft</strong> <ProvenanceBadge kind="estimate" /></span>
                <span className="text-muted-foreground">({result.envelope.practicalGfaSqft.source})</span>
              </CardContent>
            </Card>

            {/* Fine-tune the takeout — every parameter is overridable per run */}
            <details className="rounded-lg border bg-card">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                Fine-tune the takeout — pricing, financing, and MLI Select commitments
              </summary>
              <div className="px-4 pb-4 space-y-4">
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
                  <Button size="sm" disabled={busy || !Number(frontage) || !Number(depth)} onClick={runUnderwrite}>
                    {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Re-running…</> : "Re-run with these assumptions"}
                  </Button>
                  {(!Number(frontage) || !Number(depth)) && (
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
                        <span className="text-muted-foreground">MLI Select</span>
                        <span className="font-mono text-right">
                          {c.mli.eligible
                            ? `${fmtMoney(c.mli.maxLoan)} @ ${c.mli.premiumPct}% prem`
                            : "ineligible (<5 units)"}
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

            {/* Highest-intent moment on the platform: they have just been told
                what their lot supports and read the reasoning. The offer /
                financing rail again, then the event, then the generic next step. */}
            {(() => {
              const rec = result.recommendedTakeout;
              const rc = rec?.configKey ? result.configs.find((c) => c.config.key === rec.configKey) : null;
              const isHold = rec?.takeout === "mli_hold";
              const isCondo = rec?.takeout === "condo_termination";
              const hasPath = rc != null && (isHold || isCondo);
              const maxLandPrice = hasPath ? (isHold ? rc!.residualLandValue.rentalPath : rc!.residualLandValue.condoPath) : null;
              const askingPrice = purchasePrice ? Number(purchasePrice) : result.listing?.listPrice ?? null;
              const best = result.mliGradient?.bestCell ?? null;
              return (
                <MultiplexActionRail
                  placement="bottom"
                  className="mt-8"
                  address={address || site.address}
                  mlsNumber={mlsNumber ?? result.listing?.mlsNumber ?? null}
                  underwritingId={underwritingId}
                  maxLandPrice={maxLandPrice}
                  askingPrice={askingPrice}
                  units={rc?.config.units ?? result.maxUnitsAsOfRight}
                  verdict={result.zoningTier?.headline ?? `${result.maxUnitsAsOfRight} units as-of-right`}
                  mli={best ? { points: best.points, maxLtv: best.ltv, loan: best.loan, dscr: best.dscr, premiumPct: best.premiumPct } : null}
                />
              );
            })()}

            <MultiplexEventCta placement="result" sourcePage="/tools/multiplex-underwriter" className="mt-8" />

            <NextStepBlock sourcePage="/tools/multiplex-underwriter" className="mt-6" />

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
    </div>
  );
}
