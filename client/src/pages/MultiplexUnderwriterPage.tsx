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
  CheckCircle2, Loader2, Share2, ArrowRight, Sparkles, Scale,
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
}

interface UnderwriteResult {
  sixplex: { eligible: boolean; status: string; certainty: string };
  maxUnitsAsOfRight: number;
  envelope: { practicalGfaSqft: { value: number; source: string; certainty: string }; theoreticalGfaSqft: { value: number }; flags: Array<{ key: string; message: string }> };
  configs: ConfigResult[];
  winner: { flip: string | null; hold: string | null };
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

function ProvenanceBadge({ kind }: { kind: string }) {
  const styles: Record<string, string> = {
    verified: "bg-green-100 text-green-800 border-green-300",
    inferred: "bg-blue-100 text-blue-800 border-blue-300",
    assumption: "bg-amber-100 text-amber-800 border-amber-300",
    estimate: "bg-purple-100 text-purple-800 border-purple-300",
  };
  return <Badge variant="outline" className={`text-[10px] uppercase tracking-wide ${styles[kind] ?? ""}`}>{kind}</Badge>;
}

function RiskChip({ level }: { level: "low" | "medium" | "high" }) {
  const styles = {
    low: "bg-green-100 text-green-800",
    medium: "bg-amber-100 text-amber-800",
    high: "bg-red-100 text-red-800",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[level]}`}>{level.toUpperCase()} variance risk</span>;
}

function ScreenChip({ icon: Icon, label, flagged, unavailable }: { icon: any; label: string; flagged: boolean; unavailable?: boolean }) {
  const cls = unavailable
    ? "bg-slate-100 text-slate-500 border-slate-200"
    : flagged
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-green-50 text-green-700 border-green-200";
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

  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [site, setSite] = useState<ResolvedSite | null>(null);

  const [frontage, setFrontage] = useState("");
  const [depth, setDepth] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [laneAccess, setLaneAccess] = useState(false);

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
        setStep("report");
      } catch { /* fall through to normal flow */ }
    })();
  }, []);

  async function resolveSite() {
    setBusy(true);
    setError(null);
    track({ event: "analyzer_started", address, strategy: "multiplex", source: "multiplex_underwriter" });
    try {
      const res = await apiRequest("POST", "/api/multiplex-underwriter", { address, postalCode: postalCode || undefined });
      const data = await res.json();
      if (data.status === "needs_lot_dimensions") {
        setSite(data.site);
        setStep("confirm");
      }
    } catch (e: any) {
      setError(e?.message?.includes("429") ? "Daily underwrite limit reached — sign in for a higher limit." : "Could not resolve that address. Check the spelling and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function runUnderwrite() {
    setBusy(true);
    setError(null);
    track({ event: "calculator.started", address, strategy: "multiplex", source: "multiplex_underwriter" });
    try {
      const res = await apiRequest("POST", "/api/multiplex-underwriter", {
        address,
        postalCode: postalCode || undefined,
        lotFrontageFt: Number(frontage),
        lotDepthFt: Number(depth),
        purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
        laneAccess,
      });
      const data = await res.json();
      if (data.status === "complete") {
        setSite(data.site);
        setResult(data.underwrite);
        setShareToken(data.shareToken);
        setStep("report");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (e: any) {
      setError("Underwrite failed — please try again.");
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
      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <Badge variant="outline" className="mb-3"><Sparkles className="h-3 w-3 mr-1" /> AI Multiplex Underwriter — Toronto</Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Spec out a multiplex build in seconds</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Zoning verdict with the by-law cited, tree and ravine screens with evidence, build configurations,
            and the sell-as-condos vs hold-on-CMHC-MLI-Select math — every number labelled by where it came from.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {/* Step 1 — address */}
        {step === "input" && (
          <Card className="max-w-xl mx-auto">
            <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Property address</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Street address (Toronto)</Label>
                <Input id="address" placeholder="123 Logan Ave" value={address} onChange={(e) => setAddress(e.target.value)} className="h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal">Postal code <span className="text-muted-foreground">(optional — improves sixplex-ward detection)</span></Label>
                <Input id="postal" placeholder="M4M 2N2" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="h-12" />
              </div>
              <Button className="w-full h-12" disabled={busy || address.trim().length < 5} onClick={resolveSite}>
                {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Resolving site…</> : <>Resolve site <ArrowRight className="h-4 w-4 ml-2" /></>}
              </Button>
              <p className="text-xs text-muted-foreground text-center">3 free underwrites per day — sign in for more.</p>
            </CardContent>
          </Card>
        )}

        {/* Step 2 — confirm site + lot dims */}
        {step === "confirm" && site && (
          <div className="max-w-2xl mx-auto space-y-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /> Site resolved</CardTitle></CardHeader>
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
                  {result.sixplex.eligible && <Badge className="bg-violet-100 text-violet-800 hover:bg-violet-100">sixplex ward likely</Badge>}
                </div>
              </div>
              <div className="flex gap-2">
                {shareToken && (
                  <Button variant="outline" size="sm" onClick={copyShareLink}>
                    <Share2 className="h-4 w-4 mr-1" /> {copied ? "Copied!" : "Share"}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => { setStep("input"); setResult(null); setSite(null); }}>New underwrite</Button>
              </div>
            </div>

            {/* Screens */}
            <div className="flex flex-wrap gap-2">
              <ScreenChip icon={TreeDeciduous} label="City trees" flagged={site.trees.cityTreeConflict} unavailable={site.trees.status === "no_data"} />
              <ScreenChip icon={Waves} label="TRCA regulated" flagged={site.trca.regulated} unavailable={site.trca.status === "unavailable"} />
              <ScreenChip icon={Landmark} label="Heritage" flagged={site.heritage.listed} unavailable={site.heritage.status === "no_data"} />
            </div>

            {/* AI narrative */}
            {result.report && (
              <Card className="border-violet-200 bg-gradient-to-b from-violet-50/60 to-transparent">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-violet-600" /> The read
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

            {/* Envelope */}
            <Card>
              <CardContent className="pt-6 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
                <span>Practical buildable GFA: <strong>{result.envelope.practicalGfaSqft.value.toLocaleString()} sqft</strong> <ProvenanceBadge kind="estimate" /></span>
                <span className="text-muted-foreground">({result.envelope.practicalGfaSqft.source})</span>
              </CardContent>
            </Card>

            {/* Config cards */}
            <div className="grid md:grid-cols-2 gap-4">
              {result.configs.map((c) => {
                const isFlipWinner = result.winner.flip === c.config.key;
                const isHoldWinner = result.winner.hold === c.config.key;
                return (
                  <Card key={c.config.key} className={isFlipWinner || isHoldWinner ? "border-violet-300 shadow-sm" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{c.config.label}</CardTitle>
                        <RiskChip level={c.varianceRisk.level} />
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {isFlipWinner && <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">best flip</Badge>}
                        {isHoldWinner && <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">best hold</Badge>}
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
                        <span className="text-muted-foreground">Condo exit</span>
                        <span className={`font-mono text-right ${c.condoExit.profit >= 0 ? "text-green-700" : "text-red-600"}`}>
                          {fmtMoney(c.condoExit.profit)} ({fmtPct(c.condoExit.marginOnCost)})
                        </span>
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
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-red-700">What kills this deal</CardTitle></CardHeader>
                  <CardContent><ul className="text-sm space-y-2">{result.report.recommendation.dealKillers.map((d, i) => <li key={i}>• {d}</li>)}</ul></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-blue-700">Verify with professionals</CardTitle></CardHeader>
                  <CardContent><ul className="text-sm space-y-2">{result.report.recommendation.verifyWithProfessionals.map((d, i) => <li key={i}>• {d}</li>)}</ul></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-emerald-700">Next steps</CardTitle></CardHeader>
                  <CardContent><ol className="text-sm space-y-2">{result.report.recommendation.nextSteps.map((d, i) => <li key={i}>{i + 1}. {d}</li>)}</ol></CardContent>
                </Card>
              </div>
            )}

            {/* Assumption notes */}
            {result.assumptionNotes.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">Assumptions in play</p>
                <ul className="text-sm text-amber-900 space-y-1">
                  {result.assumptionNotes.map((n, i) => <li key={i}>• {n}</li>)}
                </ul>
              </div>
            )}

            <p className="text-xs text-muted-foreground leading-relaxed">
              Preliminary screening only — not planning, legal, financial, or architectural advice. Zoning permissions,
              envelope figures, costs, rents, and financing terms are estimates that must be verified with the City of
              Toronto, a registered planner or architect, and your lender before acting.
            </p>

            <div className="text-center pt-2">
              <Link href="/tools/multiplex-feasibility" className="text-sm text-primary hover:underline">
                Want the zoning-rules deep dive? Try the Multiplex Feasibility screener →
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
