/**
 * Multiplex Feasibility Page — /tools/multiplex-feasibility
 *
 * Standalone investor-facing tool for screening any Canadian residential
 * property's multiplex development potential. Ontario-first, Toronto-priority.
 *
 * Integrates with the existing deal analyzer and WillItPlex tool.
 */
import { useState, useRef } from "react";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { MultiplexFeasibilityPanel } from "@/components/MultiplexFeasibilityPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { track } from "@/lib/analytics";
import {
  Building2, Calculator, MapPin, AlertTriangle, ChevronRight,
  Info, Zap, ArrowRight, Layers,
} from "lucide-react";

interface FeasibilityFormState {
  address: string;
  city: string;
  province: string;
  postalCode: string;
  zoneCode: string;
  lotFrontage: string;
  lotDepth: string;
  lotArea: string;
  cornerLot: boolean;
  laneAccess: boolean;
  heritageFlag: boolean;
  floodplainFlag: boolean;
}

const CANADIAN_PROVINCES = [
  { value: "ON", label: "Ontario" },
  { value: "BC", label: "British Columbia" },
  { value: "AB", label: "Alberta" },
  { value: "QC", label: "Quebec" },
  { value: "MB", label: "Manitoba" },
  { value: "SK", label: "Saskatchewan" },
  { value: "NS", label: "Nova Scotia" },
  { value: "NB", label: "New Brunswick" },
  { value: "NL", label: "Newfoundland & Labrador" },
  { value: "PE", label: "Prince Edward Island" },
];

const EXAMPLE_PROPERTIES = [
  { label: "Toronto — Standard lot", city: "Toronto", province: "ON", frontage: "25", depth: "120", zone: "RD" },
  { label: "Toronto — Wide lot with lane", city: "Toronto", province: "ON", frontage: "40", depth: "110", laneAccess: true },
  { label: "Hamilton — Medium lot", city: "Hamilton", province: "ON", frontage: "33", depth: "100" },
  { label: "Toronto — Narrow lot", city: "Toronto", province: "ON", frontage: "18", depth: "135" },
];

const DEFAULT_FORM: FeasibilityFormState = {
  address: "",
  city: "",
  province: "ON",
  postalCode: "",
  zoneCode: "",
  lotFrontage: "",
  lotDepth: "",
  lotArea: "",
  cornerLot: false,
  laneAccess: false,
  heritageFlag: false,
  floodplainFlag: false,
};

export default function MultiplexFeasibilityPage() {
  const [form, setForm] = useState<FeasibilityFormState>(DEFAULT_FORM);
  const [submitted, setSubmitted] = useState<FeasibilityFormState | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const update = (field: keyof FeasibilityFormState, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.city && !form.address) return;

    track({
      event: "feature_used",
      feature: "multiplex_feasibility",
      details: {
        city: form.city,
        province: form.province,
        has_zone: !!form.zoneCode,
        has_dimensions: !!(form.lotFrontage || form.lotDepth || form.lotArea),
        has_flags: !!(form.heritageFlag || form.floodplainFlag),
      },
    });

    setSubmitted({ ...form });

    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleExample = (ex: typeof EXAMPLE_PROPERTIES[0]) => {
    setForm(prev => ({
      ...prev,
      city: ex.city,
      province: ex.province,
      lotFrontage: ex.frontage || "",
      lotDepth: ex.depth || "",
      zoneCode: ex.zone || "",
      laneAccess: (ex as any).laneAccess || false,
    }));
    setSubmitted(null);
  };

  const panelProps = submitted ? {
    address: submitted.address || undefined,
    city: submitted.city || undefined,
    province: submitted.province || undefined,
    postalCode: submitted.postalCode || undefined,
    zoneCode: submitted.zoneCode || undefined,
    lotFrontage: submitted.lotFrontage ? parseFloat(submitted.lotFrontage) : undefined,
    lotDepth: submitted.lotDepth ? parseFloat(submitted.lotDepth) : undefined,
    lotArea: submitted.lotArea ? parseFloat(submitted.lotArea) : undefined,
    cornerLot: submitted.cornerLot,
    laneAccess: submitted.laneAccess,
    heritageFlag: submitted.heritageFlag,
    floodplainFlag: submitted.floodplainFlag,
  } : null;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-10">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/tools" className="hover:text-foreground transition-colors">Tools</Link>
            <ChevronRight className="h-3 w-3" />
            <span>Multiplex Feasibility</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs gap-1">
                  <Zap className="h-3 w-3" />
                  Ontario-First
                </Badge>
                <Badge variant="outline" className="text-xs">Toronto Multiplex By-law ✓</Badge>
                <Badge variant="outline" className="text-xs">Bill 23 / ARU ✓</Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Multiplex Feasibility
              </h1>
              <p className="text-muted-foreground max-w-xl leading-relaxed">
                Screen any Canadian residential property for multiplex development potential.
                See what unit count may be achievable, rough envelope estimates, and key buyer-to-verify risks.
              </p>
            </div>
            <div className="shrink-0">
              <Link href="/tools/will-it-plex">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  Full Pro Forma → Will It Plex?
                </Button>
              </Link>
            </div>
          </div>

          {/* Trust / credibility bar */}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
            {[
              "Ontario Bill 23 / ARU framework",
              "Toronto city-wide multiplex by-law",
              "Toronto & East York 6-unit permissions",
              "Garden suite & laneway suite logic",
              "Confidence-scored output",
            ].map(item => (
              <span key={item} className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* ── Disclaimer Banner ───────────────────────────────────────────── */}
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-950/20 p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
            <p className="font-semibold">Screening tool only — not planning, legal, or development advice.</p>
            <p className="text-amber-700 dark:text-amber-300 leading-relaxed text-xs">
              All outputs are preliminary estimates. Zoning, overlays, site conditions, servicing, building code, heritage, conservation, easements, and
              many other factors can materially change what is actually achievable. Always verify with your municipality, planner, architect, and lawyer
              before making any development decisions.
            </p>
          </div>
        </div>

        {/* ── Two-Column Layout ────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-[400px_1fr] gap-8 items-start">

          {/* Left: Form ───────────────────────────────────────────────────── */}
          <div className="space-y-4 lg:sticky lg:top-20">
            {/* Example properties */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Try an Example</p>
              <div className="grid grid-cols-2 gap-1.5">
                {EXAMPLE_PROPERTIES.map((ex) => (
                  <button
                    key={ex.label}
                    type="button"
                    onClick={() => handleExample(ex)}
                    className="text-left text-xs px-2.5 py-2 rounded-lg border border-border/50 hover:border-primary/40 hover:bg-muted/40 transition-colors"
                  >
                    <p className="font-medium truncate">{ex.label}</p>
                    <p className="text-muted-foreground">{ex.frontage}ft × {ex.depth}ft {ex.zone ? `· ${ex.zone}` : ""}</p>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Card className="border-border/60">
                <CardContent className="p-5 space-y-4">
                  <p className="text-sm font-semibold">Property Details</p>

                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="address" className="text-xs">Street Address (optional)</Label>
                      <Input
                        id="address"
                        placeholder="123 Main St"
                        value={form.address}
                        onChange={e => update("address", e.target.value)}
                        className="mt-1 h-9 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="city" className="text-xs">City *</Label>
                        <Input
                          id="city"
                          placeholder="Toronto"
                          value={form.city}
                          onChange={e => update("city", e.target.value)}
                          className="mt-1 h-9 text-sm"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="province" className="text-xs">Province *</Label>
                        <select
                          id="province"
                          value={form.province}
                          onChange={e => update("province", e.target.value)}
                          className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {CANADIAN_PROVINCES.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="zone" className="text-xs">
                        Zone Code
                        <span className="text-muted-foreground ml-1">(optional — look up at municipality)</span>
                      </Label>
                      <Input
                        id="zone"
                        placeholder="e.g. RD, R2, RM"
                        value={form.zoneCode}
                        onChange={e => update("zoneCode", e.target.value)}
                        className="mt-1 h-9 text-sm font-mono"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lot Dimensions (optional — improves estimates)</p>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="frontage" className="text-xs">Frontage (ft)</Label>
                        <Input
                          id="frontage"
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="e.g. 25"
                          value={form.lotFrontage}
                          onChange={e => update("lotFrontage", e.target.value)}
                          className="mt-1 h-9 text-sm font-mono"
                        />
                      </div>
                      <div>
                        <Label htmlFor="depth" className="text-xs">Depth (ft)</Label>
                        <Input
                          id="depth"
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="e.g. 120"
                          value={form.lotDepth}
                          onChange={e => update("lotDepth", e.target.value)}
                          className="mt-1 h-9 text-sm font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="lotArea" className="text-xs">Lot Area (sqft) — overrides frontage × depth</Label>
                      <Input
                        id="lotArea"
                        type="number"
                        min="0"
                        placeholder="e.g. 3000"
                        value={form.lotArea}
                        onChange={e => update("lotArea", e.target.value)}
                        className="mt-1 h-9 text-sm font-mono"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Site Flags (check if known)</p>

                    {[
                      { id: "cornerLot", label: "Corner lot" },
                      { id: "laneAccess", label: "Rear lane access" },
                      { id: "heritageFlag", label: "Heritage designation / listing" },
                      { id: "floodplainFlag", label: "Floodplain / conservation area" },
                    ].map(({ id, label }) => (
                      <div key={id} className="flex items-center justify-between">
                        <Label htmlFor={id} className="text-xs cursor-pointer">{label}</Label>
                        <Switch
                          id={id}
                          checked={form[id as keyof FeasibilityFormState] as boolean}
                          onCheckedChange={val => update(id as keyof FeasibilityFormState, val)}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Button type="submit" className="w-full gap-2 h-11">
                <Building2 className="h-4 w-4" />
                Assess Multiplex Potential
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                No signup required · Screening estimates only · Always verify with municipality
              </p>
            </form>

            {/* Navigation to related tools */}
            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Related Tools</p>
              {[
                { href: "/tools/will-it-plex", label: "Will It Plex?", desc: "Full financial pro forma for multiplex" },
                { href: "/tools/analyzer", label: "Deal Analyzer", desc: "Complete underwriting — cash flow, IRR, BRRR" },
                { href: "/tools/true-cost", label: "True Cost", desc: "Ontario buyer cost breakdown" },
              ].map(({ href, label, desc }) => (
                <Link key={href} href={href}>
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border/50 hover:border-primary/40 hover:bg-muted/30 transition-colors group cursor-pointer">
                    <div>
                      <p className="text-xs font-medium">{label}</p>
                      <p className="text-[10px] text-muted-foreground">{desc}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Right: Results ───────────────────────────────────────────────── */}
          <div ref={resultsRef}>
            {submitted && panelProps ? (
              <MultiplexFeasibilityPanel {...panelProps} />
            ) : (
              <Card className="border-border/40 border-dashed bg-muted/10">
                <CardContent className="p-10 text-center space-y-4">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground/30" />
                  <div className="space-y-2">
                    <p className="font-semibold text-muted-foreground">Enter a property to see multiplex potential</p>
                    <p className="text-sm text-muted-foreground/70 max-w-xs mx-auto leading-relaxed">
                      Add a city, province, and optionally lot dimensions and zone code to get a confidence-scored feasibility assessment.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-left max-w-sm mx-auto pt-2">
                    {[
                      { icon: Building2, text: "As-of-right unit count estimate" },
                      { icon: Calculator, text: "Rough GFA and envelope math" },
                      { icon: MapPin, text: "Zone classification and policy source" },
                      { icon: AlertTriangle, text: "Buyer-to-verify risk flags" },
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/60" />
                        <span>{text}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground/60 italic">
                      Screening tool only — not planning, legal, or development advice.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* ── How It Works ───────────────────────────────────────────────── */}
        <div className="border-t border-border/40 pt-10">
          <h2 className="text-xl font-bold mb-6">How the Feasibility Engine Works</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                step: "01",
                title: "Rules Hierarchy",
                body: "Ontario province baseline (Bill 23) → Municipality-specific override (e.g. Toronto's 4-unit multiplex by-law) → Zone-specific standards → Overlay constraints (heritage, conservation, flood).",
              },
              {
                step: "02",
                title: "Confidence Scoring",
                body: "Each output gets a 0–100 confidence score based on: municipality recognized, zone provided, lot dimensions available, overlay flags known. LOW (<35) means too much is assumed. HIGH (≥65) means enough data to make useful inferences.",
              },
              {
                step: "03",
                title: "Transparent Assumptions",
                body: "Every calculation shows its assumptions. Lot coverage ratios, storey counts, and GFA haircuts are labelled as 'municipality fallback' or 'zone estimate' so you always know what's real data vs. inference.",
              },
            ].map(({ step, title, body }) => (
              <Card key={step} className="border-border/60">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Info className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-3xl font-bold font-mono text-muted-foreground/15">{step}</span>
                  </div>
                  <h3 className="font-semibold text-sm">{title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* ── Coverage ────────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-6 space-y-4">
          <h3 className="font-semibold text-sm">Municipality Coverage</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {[
              { name: "Toronto", level: "Partial", note: "4-unit + T&EY 6-unit, garden + laneway suite logic" },
              { name: "Ottawa", level: "Province Baseline", note: "Ontario Bill 23 baseline" },
              { name: "Hamilton", level: "Province Baseline", note: "Ontario Bill 23 baseline" },
              { name: "Mississauga", level: "Province Baseline", note: "Ontario Bill 23 baseline" },
              { name: "Brampton", level: "Province Baseline", note: "Ontario Bill 23 baseline" },
              { name: "Kitchener / Waterloo", level: "Province Baseline", note: "Ontario Bill 23 baseline" },
              { name: "London ON", level: "Province Baseline", note: "Ontario Bill 23 baseline" },
              { name: "Guelph", level: "Province Baseline", note: "Ontario Bill 23 baseline" },
              { name: "Barrie", level: "Province Baseline", note: "Ontario Bill 23 baseline" },
              { name: "Vancouver", level: "Province Baseline", note: "BC SSMUH 2023 baseline" },
              { name: "Other ON cities", level: "Province Baseline", note: "Ontario Bill 23 baseline" },
            ].map(({ name, level, note }) => (
              <div key={name} className="rounded-lg border border-border/40 p-2.5 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${level === "Partial" ? "bg-amber-400" : level === "Province Baseline" ? "bg-blue-400" : "bg-green-400"}`} />
                  <span className="font-medium">{name}</span>
                </div>
                <p className="text-muted-foreground">{note}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            More municipalities added regularly. Municipality coverage improves as zone-specific rules are ingested from public by-law sources.
          </p>
        </div>

        {/* ── Bottom CTA ──────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border/60 bg-card p-6 flex flex-col sm:flex-row items-center gap-4 justify-between">
          <div>
            <p className="font-semibold">Ready to underwrite the deal?</p>
            <p className="text-sm text-muted-foreground mt-0.5">Run the full multiplex financial pro forma in Will It Plex?, or analyze cash flow in the deal analyzer.</p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link href="/tools/will-it-plex">
              <Button size="sm" className="gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                Will It Plex?
              </Button>
            </Link>
            <Link href="/tools/analyzer">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Calculator className="h-3.5 w-3.5" />
                Deal Analyzer
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
