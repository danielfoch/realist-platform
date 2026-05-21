import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Target } from "lucide-react";
import { Link } from "wouter";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  ArrowRight,
  Building2,
  Calculator,
  ChevronRight,
  Landmark,
  Layers,
  PiggyBank,
  Scale,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";

type LayerKey = "senior" | "mezz" | "pref" | "lp" | "gp";

interface CapitalLayer {
  key: LayerKey;
  name: string;
  shortName: string;
  paymentPriority: number;
  riskScore: number;
  defaultShare: number;
  rateLow: number;
  rateHigh: number;
  collateral: string;
  returnType: string;
  typicalProviders: string[];
  pros: string[];
  cons: string[];
  canadianContext: string;
  color: string;
  icon: typeof Landmark;
}

const LAYERS: CapitalLayer[] = [
  {
    key: "senior",
    name: "Senior Debt",
    shortName: "Senior",
    paymentPriority: 1,
    riskScore: 1,
    defaultShare: 65,
    rateLow: 4.5,
    rateHigh: 6.5,
    collateral: "First-position mortgage on title",
    returnType: "Fixed interest (monthly)",
    typicalProviders: [
      "Schedule I banks (RBC, TD, BMO, Scotiabank, CIBC, National)",
      "Credit unions (Meridian, Vancity, Desjardins)",
      "CMHC-insured lenders via MLI Select & Standard",
      "Life-co lenders (Manulife, Sun Life, Canada Life)",
    ],
    pros: [
      "Cheapest cost of capital in the stack",
      "CMHC MLI Select can push LTV to 95% and amortization to 50 yrs",
      "Long, predictable amortizations stabilize cash flow",
    ],
    cons: [
      "OSFI B-20 stress test + tightest covenants",
      "Personal guarantees almost always required under $5M",
      "Recourse + first to seize the asset on default",
    ],
    canadianContext:
      "In Canada, a senior commercial mortgage is typically 5-yr fixed (vs 10-yr norm in the US) with a 25-30 yr amortization. CMHC-insured loans through MLI Select are the cheapest senior debt available — often 75-100 bps tighter than conventional — and explicitly reward affordability, accessibility, and energy efficiency with bonus points.",
    color: "hsl(215, 35%, 28%)",
    icon: Landmark,
  },
  {
    key: "mezz",
    name: "Mezzanine Debt",
    shortName: "Mezz",
    paymentPriority: 2,
    riskScore: 2,
    defaultShare: 10,
    rateLow: 10,
    rateHigh: 15,
    collateral: "Second-position charge + share pledge",
    returnType: "Current pay + PIK / accrual",
    typicalProviders: [
      "Mortgage Investment Corporations (MICs)",
      "Private debt funds (Romspen, Trez, Atrium, Firm Capital)",
      "Family offices",
    ],
    pros: [
      "Stretches LTV from ~65% to 80-85% without giving up equity",
      "Interest is generally tax-deductible",
      "Faster to close than syndicated bank debt",
    ],
    cons: [
      "2-3x the cost of senior debt",
      "Often comes with intercreditor restrictions from the senior lender",
      "Refinance risk if rates move against you at maturity",
    ],
    canadianContext:
      "Canadian mezz is dominated by MICs and private debt funds. Expect 10-15% all-in with 1-2 pt lender fees, 1-3 yr terms, and an intercreditor agreement (ICA) the senior lender must approve. On CMHC-insured deals, postponed second mortgages are tightly restricted — mezz typically sits behind conventional senior only.",
    color: "hsl(200, 32%, 44%)",
    icon: Layers,
  },
  {
    key: "pref",
    name: "Preferred Equity",
    shortName: "Pref Equity",
    paymentPriority: 3,
    riskScore: 3,
    defaultShare: 8,
    rateLow: 12,
    rateHigh: 18,
    collateral: "Equity interest with priority distribution",
    returnType: "Preferred return + accrual",
    typicalProviders: [
      "Real estate private equity funds",
      "Family offices and HNW syndicates",
      "Specialist pref-equity shops",
    ],
    pros: [
      "Behaves like debt for the sponsor — no dilution of common upside above the pref",
      "No charge on title, so it doesn't trigger senior consent in some structures",
      "Can be structured as 'hard' (with cure rights) or 'soft' pref",
    ],
    cons: [
      "Distributions are not tax-deductible (unlike interest)",
      "Forced-sale or buy-out rights kick in if returns aren't paid",
      "Holdco-level security only — no real-property recourse",
    ],
    canadianContext:
      "Most Canadian pref-equity is structured as a separate class of LP units in a limited partnership, with a 10-14% accruing preferred return and a hard maturity. Bay Street family offices and PE shops like Slate, Equiton, and Centurion are active in this layer for multi-res and self-storage.",
    color: "hsl(255, 22%, 56%)",
    icon: ShieldCheck,
  },
  {
    key: "lp",
    name: "Common Equity (LPs)",
    shortName: "LP Equity",
    paymentPriority: 4,
    riskScore: 4,
    defaultShare: 14,
    rateLow: 15,
    rateHigh: 25,
    collateral: "Residual ownership",
    returnType: "Pref return + share of profits",
    typicalProviders: [
      "Accredited & eligible investors via OM/PPM",
      "Syndication co-investors",
      "Friends-and-family raises",
    ],
    pros: [
      "Uncapped upside above the preferred return",
      "Tax-efficient — capital gains, ROC, CCA flow-through in an LP",
      "Voting / consent rights on major decisions",
    ],
    cons: [
      "Last in line behind all debt and pref",
      "Illiquid — typically 3-7 yr hold with no public market",
      "First to absorb losses in a downturn",
    ],
    canadianContext:
      "Canadian syndicators raise LP equity under the Offering Memorandum (NI 45-106) or Accredited Investor exemptions. Typical structure: 8% pref to LPs, then a 70/30 or 80/20 split above the pref in favour of LPs. AUM-heavy sponsors like Equiton, Centurion, and Avenue Living run this playbook at scale.",
    color: "hsl(35, 48%, 56%)",
    icon: PiggyBank,
  },
  {
    key: "gp",
    name: "Sponsor / GP Promote",
    shortName: "GP Promote",
    paymentPriority: 5,
    riskScore: 5,
    defaultShare: 3,
    rateLow: 20,
    rateHigh: 40,
    collateral: "Carried interest in the waterfall",
    returnType: "Acquisition + asset-mgmt fees + promote",
    typicalProviders: [
      "Operating partner / general partner",
      "Asset manager",
    ],
    pros: [
      "Most asymmetric upside in the stack",
      "Layered fee income while the deal is held",
      "Builds franchise value & track record for future raises",
    ],
    cons: [
      "Skin-in-the-game co-invest is expected (5-10%)",
      "Carried interest is fully taxable as business income in Canada",
      "Last paid in a waterfall — wiped out first on losses",
    ],
    canadianContext:
      "A typical Canadian GP promote: 1.5-2.5% acquisition fee, 1-2% asset-mgmt fee on equity, then a 20-30% promote above an 8-10% IRR hurdle, sometimes with a second hurdle at 15% IRR that bumps the promote to 40%. CRA taxes carry as ordinary income — there is no US-style long-term capital-gains treatment for carry.",
    color: "hsl(12, 55%, 52%)",
    icon: TrendingUp,
  },
];

const RISK_RETURN_DATA = LAYERS.map((l) => ({
  name: l.name,
  risk: l.riskScore,
  return: (l.rateLow + l.rateHigh) / 2,
  share: l.defaultShare,
  color: l.color,
}));

const COST_OF_CAPITAL_DATA = LAYERS.map((l) => ({
  name: l.shortName,
  low: l.rateLow,
  high: l.rateHigh,
  mid: (l.rateLow + l.rateHigh) / 2,
  color: l.color,
}));

const SCENARIO_DATA = [
  { scenario: "Bear (-15% NOI)", senior: 5.1, mezz: 11.0, pref: 12.0, lp: -8, gp: -25 },
  { scenario: "Base (flat NOI)", senior: 5.1, mezz: 11.0, pref: 13.5, lp: 14, gp: 22 },
  { scenario: "Bull (+15% NOI)", senior: 5.1, mezz: 11.0, pref: 13.5, lp: 24, gp: 38 },
];

const PROJECT_COST = 10_000_000;

type StrategyKey =
  | "buy-hold"
  | "mli-select"
  | "value-add"
  | "development"
  | "flip"
  | "sfr";

const STRATEGY_PRESETS: Record<
  StrategyKey,
  { label: string; shares: Record<LayerKey, number>; rationale: string }
> = {
  "buy-hold": {
    label: "Stabilized Buy & Hold (conventional)",
    shares: { senior: 70, mezz: 5, pref: 5, lp: 17, gp: 3 },
    rationale:
      "Conventional commercial senior at 65-70% LTV, a thin mezz tranche if the lender allows it, and the balance from LP equity. Pref is optional and used to backstop the equity raise.",
  },
  "mli-select": {
    label: "Multiplex 5+ units (CMHC MLI Select)",
    shares: { senior: 85, mezz: 0, pref: 5, lp: 7, gp: 3 },
    rationale:
      "CMHC MLI Select can push insured senior to 85-95% LTC at 75-150 bps inside conventional. That collapses the equity requirement so much that mezz is usually unnecessary — pref equity bridges any remaining gap.",
  },
  "value-add": {
    label: "Value-Add / BRRR",
    shares: { senior: 60, mezz: 12, pref: 8, lp: 17, gp: 3 },
    rationale:
      "Lower senior at acquisition (60% on as-is value), a private mezz tranche to fund the reno, plus pref equity. Refinanced into long-term CMHC or conventional senior after stabilization.",
  },
  development: {
    label: "Ground-up Development",
    shares: { senior: 55, mezz: 15, pref: 10, lp: 17, gp: 3 },
    rationale:
      "Construction senior caps at 50-65% LTC. Mezz / pref are the only practical ways to reduce common-equity dilution. Larger GP co-invest is usually required by the senior.",
  },
  flip: {
    label: "Short-term Flip",
    shares: { senior: 70, mezz: 15, pref: 0, lp: 12, gp: 3 },
    rationale:
      "Private (C-tier) senior + mezz dominates because of the 6-12 month hold. No pref — the deal exits before any meaningful accrual. Sponsor takes more risk-adjusted promote.",
  },
  sfr: {
    label: "Single-Family Rental (1-4 units)",
    shares: { senior: 75, mezz: 0, pref: 0, lp: 22, gp: 3 },
    rationale:
      "Standard residential mortgage at 75-80% LTV from an A or B lender, balance from sponsor + LP equity. No mezz or pref — the deal is too small to support the structuring cost.",
  },
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);
}

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is the capital stack in Canadian real estate?",
    a: "The capital stack is the layered hierarchy of debt and equity used to finance a real-estate deal in Canada. It defines who gets paid first (senior lenders) and who gets paid last (the sponsor/GP), and therefore who bears the most risk and earns the highest return. A typical Canadian multi-residential capital stack is roughly 65-75% senior debt (often CMHC-insured), 5-10% mezzanine, 5-10% preferred equity, and 10-20% common equity.",
  },
  {
    q: "How does CMHC MLI Select change the capital stack?",
    a: "CMHC MLI Select is an insured-financing program for new and existing multi-residential buildings in Canada. It can push senior-debt LTV to 95% (purpose-built rentals scoring 100+ points), stretch amortization to 50 years, and lower the interest rate by 75-150 bps versus conventional. In practice, MLI Select shrinks the equity requirement dramatically — sometimes eliminating the need for mezz or pref-equity entirely on otherwise marginal deals.",
  },
  {
    q: "Is mezzanine debt legal and common in Canada?",
    a: "Yes. Mezzanine debt is common in Canadian commercial and multi-residential deals, typically provided by mortgage investment corporations (MICs) and private debt funds. It's secured by a second mortgage and/or a pledge of shares in the borrowing entity. The senior lender must consent via an intercreditor agreement (ICA), and on CMHC-insured deals there are strict rules around postponed second mortgages.",
  },
  {
    q: "How is carried interest (GP promote) taxed in Canada?",
    a: "Carried interest paid to a sponsor or general partner in Canada is generally taxed as ordinary business income at full marginal rates — there is no special long-term capital-gains treatment like the US. This is a meaningful difference from US private-equity structures and is one reason Canadian sponsors often co-invest meaningful equity to access the capital-gains-taxed portion of returns.",
  },
  {
    q: "What's the difference between preferred equity and mezzanine debt?",
    a: "Mezzanine debt sits in second-mortgage position on title and earns a fixed interest rate; if it isn't paid, the mezz lender can foreclose subject to the intercreditor agreement. Preferred equity sits at the entity level (not on title), earns a preferred return that can accrue, and typically has buy-out or forced-sale rights instead of foreclosure. Pref is junior to mezz in priority but more flexible structurally.",
  },
  {
    q: "What return should LPs expect on a Canadian multi-res deal?",
    a: "LP equity in a stabilized Canadian multi-residential deal typically targets a 12-16% IRR and a 1.6-2.0x equity multiple over a 5-7 year hold. Value-add and development deals target 18-25%+ IRR with a 2.0-2.5x multiple to compensate for higher execution risk. These ranges have compressed materially since 2022 as cap rates expanded.",
  },
];

export default function CapitalStackCanadaGuide() {
  const [selectedLayer, setSelectedLayer] = useState<LayerKey>("senior");
  const [shares, setShares] = useState<Record<LayerKey, number>>(
    LAYERS.reduce((acc, l) => ({ ...acc, [l.key]: l.defaultShare }), {} as Record<LayerKey, number>),
  );
  const [dealCost, setDealCost] = useState<number>(PROJECT_COST);

  // Deal plugin state
  const { toast } = useToast();
  const [mlsInput, setMlsInput] = useState("");
  const [dealAddress, setDealAddress] = useState<string>("");
  const [dealUnits, setDealUnits] = useState<number>(1);
  const [strategy, setStrategy] = useState<StrategyKey>("buy-hold");
  const [appliedStrategy, setAppliedStrategy] = useState<StrategyKey | null>(null);

  const mlsLookup = useMutation({
    mutationFn: async (mls: string) => {
      const cleaned = mls.replace(/[^a-zA-Z0-9]/g, "");
      if (!cleaned) throw new Error("Enter a valid MLS number");
      const res = await fetch(`/api/ddf/mls/${encodeURIComponent(cleaned)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Lookup failed (${res.status})`);
      }
      return (await res.json()) as {
        listing: {
          price?: number | string | null;
          numberOfUnits?: number | string | null;
          totalActualRent?: number | string | null;
          address?: string | null;
          city?: string | null;
          province?: string | null;
          listingId?: string | null;
        };
        source: string;
      };
    },
    onSuccess: ({ listing }) => {
      const toFiniteNumber = (v: unknown): number | null => {
        if (v === null || v === undefined || v === "") return null;
        const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.\-]/g, ""));
        return Number.isFinite(n) ? n : null;
      };
      const price = toFiniteNumber(listing.price);
      if (price !== null && price > 0) setDealCost(price);
      const units = toFiniteNumber(listing.numberOfUnits);
      if (units !== null && units > 0) {
        const u = Math.max(1, Math.round(units));
        setDealUnits(u);
        if (u >= 5) setStrategy("mli-select");
        else setStrategy("sfr");
      }
      const addr = [listing.address, listing.city, listing.province].filter(Boolean).join(", ");
      setDealAddress(addr);
      if (price === null && units === null) {
        toast({
          title: "Listing loaded but missing key fields",
          description: "We couldn't read price or unit count — enter them manually below.",
        });
      } else {
        toast({
          title: "Listing loaded",
          description: addr || `Loaded MLS ${listing.listingId ?? ""}`.trim(),
        });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't load that MLS#", description: err.message, variant: "destructive" });
    },
  });

  function applyStrategy(s: StrategyKey) {
    const preset = STRATEGY_PRESETS[s];
    setShares({ ...preset.shares });
    setAppliedStrategy(s);
    toast({
      title: `Stack set: ${preset.label}`,
      description: "Scroll down — the builder now reflects your deal.",
    });
  }

  const totalShare = useMemo(
    () => LAYERS.reduce((sum, l) => sum + shares[l.key], 0),
    [shares],
  );

  const normalized = useMemo(() => {
    const out = {} as Record<LayerKey, number>;
    LAYERS.forEach((l) => {
      out[l.key] = totalShare > 0 ? (shares[l.key] / totalShare) * 100 : 0;
    });
    return out;
  }, [shares, totalShare]);

  const blendedCost = useMemo(() => {
    return (
      LAYERS.reduce((sum, l) => {
        const mid = (l.rateLow + l.rateHigh) / 2;
        return sum + (normalized[l.key] / 100) * mid;
      }, 0)
    );
  }, [normalized]);

  const stackedBarData = useMemo(
    () => [
      LAYERS.reduce(
        (row, l) => ({ ...row, [l.key]: normalized[l.key] }),
        { name: "Your Stack" } as Record<string, string | number>,
      ),
    ],
    [normalized],
  );

  const selected = LAYERS.find((l) => l.key === selectedLayer)!;

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": "https://realist.ca/insights/guides/capital-stack-canada#article",
        headline: "The Capital Stack in Canadian Real Estate: A Complete Investor's Guide",
        description:
          "Senior debt, mezzanine, preferred equity, LP equity and GP promote — explained for Canadian real estate investors with CMHC MLI Select, OSFI B-20, MICs, and CRA-aware structuring. Interactive capital stack visualizer included.",
        author: { "@type": "Person", name: "Daniel Foch", url: "https://realist.ca" },
        publisher: {
          "@type": "Organization",
          name: "Realist.ca",
          logo: { "@type": "ImageObject", url: "https://realist.ca/logo.png" },
        },
        datePublished: "2026-05-21",
        dateModified: "2026-05-21",
        image: "https://realist.ca/og-image.png",
        mainEntityOfPage: "https://realist.ca/insights/guides/capital-stack-canada",
        about: [
          { "@type": "Thing", name: "Capital Stack" },
          { "@type": "Thing", name: "Canadian Real Estate Investing" },
          { "@type": "Thing", name: "CMHC MLI Select" },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Insights", item: "https://realist.ca/insights" },
          {
            "@type": "ListItem",
            position: 2,
            name: "Guides",
            item: "https://realist.ca/insights/guides",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: "The Capital Stack in Canadian Real Estate",
            item: "https://realist.ca/insights/guides/capital-stack-canada",
          },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="The Capital Stack in Canadian Real Estate (2026 Guide)"
        description="A complete, interactive guide to the capital stack for Canadian real estate investors — senior debt, CMHC MLI Select, mezzanine, preferred equity, LP equity, and GP promote. Includes a live capital stack builder and worked $10M example."
        keywords="capital stack, real estate capital stack Canada, CMHC MLI Select, mezzanine debt Canada, preferred equity real estate, LP equity, GP promote, real estate syndication Canada, OSFI B-20, MIC mortgage investment corporation"
        canonicalUrl="/insights/guides/capital-stack-canada"
        ogType="article"
        structuredData={structuredData}
      />
      <Navigation />

      <main className="container mx-auto max-w-6xl px-4 py-12">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
          <Link href="/insights" className="hover:text-foreground" data-testid="link-breadcrumb-insights">
            Insights
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/insights/guides" className="hover:text-foreground" data-testid="link-breadcrumb-guides">
            Guides
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">The Capital Stack</span>
        </nav>

        {/* Hero */}
        <header className="mb-12">
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge variant="secondary" data-testid="badge-category">Advanced Guide</Badge>
            <Badge variant="outline">Canadian Focus</Badge>
            <Badge variant="outline">18 min read</Badge>
          </div>
          <h1
            className="mb-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl"
            data-testid="text-page-title"
          >
            The Capital Stack in Canadian Real Estate
          </h1>
          <p className="max-w-3xl text-xl text-muted-foreground">
            Every Canadian real estate deal is financed with a mix of debt and equity stacked in
            order of risk and repayment priority. Understand each layer — from CMHC-insured senior
            debt through GP promote — and build your own stack with our interactive visualizer.
          </p>
        </header>

        {/* Deal Plugin: load a real deal and auto-fill the stack */}
        <Card className="mb-8 border-2 border-primary/50" data-testid="card-deal-plugin">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" /> Plug in a Real Deal
            </CardTitle>
            <CardDescription>
              Load a Canadian listing by MLS# (CREA DDF) or enter your own deal cost, pick the
              strategy, and we'll auto-set a realistic capital stack you can then tweak below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* MLS lookup */}
            <div className="rounded-lg border bg-muted/20 p-4">
              <Label htmlFor="cs-mls-input" className="text-sm font-semibold">
                Option 1 — Pull a live Canadian listing by MLS#
              </Label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Input
                  id="cs-mls-input"
                  placeholder="e.g. W7384562"
                  value={mlsInput}
                  onChange={(e) => setMlsInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && mlsInput.trim()) mlsLookup.mutate(mlsInput.trim());
                  }}
                  data-testid="input-cs-mls"
                />
                <Button
                  type="button"
                  onClick={() => mlsLookup.mutate(mlsInput.trim())}
                  disabled={!mlsInput.trim() || mlsLookup.isPending}
                  data-testid="button-cs-mls-lookup"
                >
                  {mlsLookup.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" /> Load listing
                    </>
                  )}
                </Button>
              </div>
              {dealAddress && (
                <p className="mt-2 text-xs text-muted-foreground" data-testid="text-cs-loaded-address">
                  Loaded: <span className="font-medium text-foreground">{dealAddress}</span>
                  {dealUnits > 1 && <span> · {dealUnits} units</span>}
                </p>
              )}
            </div>

            {/* Manual */}
            <div>
              <p className="mb-3 text-sm font-semibold">
                Option 2 — Or enter / adjust your own deal
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="cs-cost">Total project cost (CAD)</Label>
                  <Input
                    id="cs-cost"
                    type="number"
                    min={0}
                    step={10_000}
                    value={dealCost}
                    onChange={(e) => setDealCost(Math.max(0, Number(e.target.value) || 0))}
                    data-testid="input-deal-cost"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(dealCost)}</p>
                </div>
                <div>
                  <Label htmlFor="cs-units"># of units</Label>
                  <Input
                    id="cs-units"
                    type="number"
                    min={1}
                    max={500}
                    value={dealUnits}
                    onChange={(e) => setDealUnits(Math.max(1, Number(e.target.value) || 1))}
                    data-testid="input-deal-units"
                  />
                </div>
                <div>
                  <Label htmlFor="cs-strategy">Strategy</Label>
                  <Select value={strategy} onValueChange={(v) => setStrategy(v as StrategyKey)}>
                    <SelectTrigger id="cs-strategy" data-testid="select-cs-strategy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STRATEGY_PRESETS) as StrategyKey[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {STRATEGY_PRESETS[k].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={() => applyStrategy(strategy)}
                data-testid="button-apply-strategy"
              >
                <Layers className="mr-2 h-4 w-4" /> Apply strategy to the stack
              </Button>
              {appliedStrategy && (
                <span className="text-xs text-muted-foreground" aria-live="polite">
                  Applied: <span className="font-medium text-foreground">{STRATEGY_PRESETS[appliedStrategy].label}</span>
                </span>
              )}
            </div>

            {appliedStrategy && (
              <div
                className="rounded-md border bg-muted/30 p-4 text-sm"
                data-testid="text-strategy-rationale"
              >
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Why this stack
                </div>
                <p className="leading-relaxed">{STRATEGY_PRESETS[appliedStrategy].rationale}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                  {LAYERS.map((l) => {
                    const pct = STRATEGY_PRESETS[appliedStrategy].shares[l.key];
                    return (
                      <div
                        key={l.key}
                        className="rounded border bg-background p-2"
                        style={{ borderColor: l.color }}
                      >
                        <div className="text-muted-foreground">{l.shortName}</div>
                        <div className="font-semibold tabular-nums">{pct}%</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {formatCurrency((pct / 100) * dealCost)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Heuristic only — real capital stacks depend on lender appetite, sponsor experience,
              and the specific property. Use the builder below to fine-tune.
            </p>
          </CardContent>
        </Card>

        {/* Interactive Stack Builder */}
        <Card className="mb-12 border-2" data-testid="card-stack-builder">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" /> Interactive Capital Stack Builder
            </CardTitle>
            <CardDescription>
              Drag the sliders to change each layer's share of a {formatCurrency(dealCost)} Canadian deal.
              Click any layer name to see how it's structured in Canada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-8 md:grid-cols-2">
              {/* Stacked bar */}
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Your stack (% of cost)</span>
                  <span className="text-sm font-medium" data-testid="text-blended-cost">
                    Blended cost: {blendedCost.toFixed(2)}%
                  </span>
                </div>
                <div
                  className="relative mx-auto flex h-[420px] w-full max-w-[280px] flex-col-reverse overflow-hidden rounded-xl border border-border bg-gradient-to-b from-muted/40 to-background shadow-sm"
                  role="group"
                  aria-label="Interactive capital stack — click a layer to inspect it"
                  data-testid="visual-capital-stack"
                >
                  {LAYERS.map((l, idx) => {
                    const pct = normalized[l.key];
                    if (pct <= 0) return null;
                    const isSelected = selectedLayer === l.key;
                    const isBottom = idx === 0;
                    const isTop =
                      LAYERS.slice(idx + 1).every((next) => normalized[next.key] <= 0);
                    return (
                      <button
                        key={l.key}
                        type="button"
                        onClick={() => setSelectedLayer(l.key)}
                        aria-pressed={isSelected}
                        aria-label={`${l.name}: ${pct.toFixed(1)} percent, ${formatCurrency((pct / 100) * dealCost)}`}
                        className={`group relative flex w-full items-center justify-between px-4 text-left transition-all focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring ${
                          isSelected ? "ring-2 ring-foreground ring-inset z-10" : ""
                        }`}
                        style={{
                          flexBasis: `${pct}%`,
                          minHeight: pct < 4 ? "18px" : undefined,
                          background: `linear-gradient(180deg, ${l.color} 0%, ${l.color}dd 100%)`,
                          color: "white",
                          borderTopLeftRadius: isTop ? "11px" : 0,
                          borderTopRightRadius: isTop ? "11px" : 0,
                          borderBottomLeftRadius: isBottom ? "11px" : 0,
                          borderBottomRightRadius: isBottom ? "11px" : 0,
                          boxShadow: isSelected
                            ? "inset 0 0 0 1px rgba(255,255,255,0.4)"
                            : "inset 0 -1px 0 0 rgba(0,0,0,0.15), inset 0 1px 0 0 rgba(255,255,255,0.08)",
                        }}
                        data-testid={`stack-segment-${l.key}`}
                      >
                        <span className="flex items-center gap-2 truncate text-xs font-semibold tracking-wide drop-shadow-sm sm:text-sm">
                          <l.icon className="h-3.5 w-3.5 shrink-0 opacity-90 sm:h-4 sm:w-4" />
                          <span className="truncate">{l.name}</span>
                        </span>
                        <span className="ml-2 shrink-0 text-xs font-semibold tabular-nums drop-shadow-sm sm:text-sm">
                          {pct.toFixed(0)}%
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span>↑ Higher risk / return</span>
                  </span>
                  <span className="font-medium text-foreground">
                    Total: {formatCurrency(dealCost)}
                  </span>
                </div>
              </div>

              {/* Sliders */}
              <div className="space-y-4">
                {LAYERS.map((l) => {
                  const isSelected = selectedLayer === l.key;
                  const sliderId = `slider-${l.key}`;
                  return (
                    <div
                      key={l.key}
                      className={`rounded-lg border p-3 transition ${
                        isSelected ? "border-foreground bg-muted/50" : "border-border hover:bg-muted/30"
                      }`}
                      data-testid={`row-layer-${l.key}`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedLayer(l.key)}
                          aria-pressed={isSelected}
                          className="flex items-center gap-2 rounded text-left font-medium hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          data-testid={`button-layer-${l.key}`}
                        >
                          <span
                            className="inline-block h-3 w-3 rounded-sm"
                            style={{ background: l.color }}
                            aria-hidden="true"
                          />
                          <span>{l.name}</span>
                        </button>
                        <span
                          className="text-sm tabular-nums text-muted-foreground"
                          aria-live="polite"
                        >
                          {normalized[l.key].toFixed(1)}% • {formatCurrency((normalized[l.key] / 100) * dealCost)}
                        </span>
                      </div>
                      <label htmlFor={sliderId} className="sr-only">
                        {l.name} share of total capital
                      </label>
                      <Slider
                        id={sliderId}
                        value={[shares[l.key]]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={(v) => setShares((s) => ({ ...s, [l.key]: v[0] }))}
                        aria-label={`${l.name} share of total capital, currently ${normalized[l.key].toFixed(0)} percent`}
                        data-testid={sliderId}
                      />
                      <div className="mt-1 text-xs text-muted-foreground">
                        Target rate {l.rateLow}-{l.rateHigh}% • {l.returnType}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected layer detail */}
            <Card className="mt-8 bg-muted/30" data-testid={`card-selected-${selected.key}`}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <selected.icon className="h-6 w-6" style={{ color: selected.color }} />
                  <div>
                    <CardTitle>{selected.name}</CardTitle>
                    <CardDescription>
                      Priority #{selected.paymentPriority} • {selected.returnType} • {selected.collateral}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed">{selected.canadianContext}</p>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Typical Providers
                    </h4>
                    <ul className="space-y-1 text-sm">
                      {selected.typicalProviders.map((p) => (
                        <li key={p} className="flex gap-2">
                          <span className="text-muted-foreground">•</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-400">
                      Pros
                    </h4>
                    <ul className="space-y-1 text-sm">
                      {selected.pros.map((p) => (
                        <li key={p} className="flex gap-2">
                          <span className="text-green-600">+</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-400">
                      Cons
                    </h4>
                    <ul className="space-y-1 text-sm">
                      {selected.cons.map((p) => (
                        <li key={p} className="flex gap-2">
                          <span className="text-red-600">−</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        {/* Risk vs Return + Cost of Capital */}
        <section className="mb-12 grid gap-6 md:grid-cols-2" aria-labelledby="charts-heading">
          <h2 id="charts-heading" className="sr-only">
            Risk, return, and cost of capital by layer
          </h2>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" /> Risk vs Return by Layer
              </CardTitle>
              <CardDescription>
                Bubble size = typical share of the stack. Higher position in the stack means higher
                risk and higher required return.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis
                      dataKey="risk"
                      type="number"
                      domain={[0, 6]}
                      tickFormatter={(v) => ["", "Low", "Low-Mid", "Mid", "Mid-High", "High", ""][v]}
                      label={{ value: "Risk →", position: "insideBottom", offset: -10 }}
                    />
                    <YAxis
                      dataKey="return"
                      type="number"
                      label={{ value: "Target return (%)", angle: -90, position: "insideLeft" }}
                    />
                    <ZAxis dataKey="share" range={[100, 900]} />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === "return") return [`${value.toFixed(1)}%`, "Target return"];
                        if (name === "risk") return [value, "Risk score"];
                        if (name === "share") return [`${value}%`, "Typical share"];
                        return [value, name];
                      }}
                      labelFormatter={(_, payload) =>
                        (payload?.[0]?.payload as { name?: string })?.name ?? ""
                      }
                    />
                    <Scatter data={RISK_RETURN_DATA}>
                      {RISK_RETURN_DATA.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" /> Cost of Capital Range (Canada, 2026)
              </CardTitle>
              <CardDescription>
                All-in pricing observed across active Canadian providers in early 2026. Bars show
                the low–high range.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={COST_OF_CAPITAL_DATA}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      formatter={(value: number, name: string) => [`${value}%`, name === "mid" ? "Midpoint" : name]}
                    />
                    <Bar dataKey="low" stackId="r" fill="transparent" />
                    <Bar dataKey="high" stackId="r">
                      {COST_OF_CAPITAL_DATA.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Scenario analysis */}
        <Card className="mb-12" data-testid="card-scenarios">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" /> What Each Layer Earns in Bear / Base / Bull
            </CardTitle>
            <CardDescription>
              Modelled returns by layer on a stabilized Canadian multi-residential deal at three NOI
              outcomes. Senior and mezz returns are contractual; pref, LP, and GP returns flex with
              NOI.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={SCENARIO_DATA}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="scenario" />
                  <YAxis tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Legend />
                  {LAYERS.map((l) => (
                    <Line
                      key={l.key}
                      type="monotone"
                      dataKey={l.key}
                      name={l.shortName}
                      stroke={l.color}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Layer-by-layer narrative */}
        <section className="mb-12 space-y-6" aria-labelledby="layers-heading">
          <h2
            id="layers-heading"
            className="text-3xl font-bold tracking-tight"
            data-testid="heading-layers"
          >
            The Five Layers, Explained
          </h2>
          {LAYERS.map((l) => (
            <Card key={l.key} id={`layer-${l.key}`} data-testid={`card-narrative-${l.key}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: `${l.color}20` }}
                    >
                      <l.icon className="h-5 w-5" style={{ color: l.color }} />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">
                        {l.paymentPriority}. {l.name}
                      </CardTitle>
                      <CardDescription>
                        {l.rateLow}-{l.rateHigh}% target • {l.returnType} • {l.collateral}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-base leading-relaxed">{l.canadianContext}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Worked Canadian example */}
        <Card className="mb-12" data-testid="card-worked-example">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Worked Example: A $10M Hamilton Multiplex
            </CardTitle>
            <CardDescription>
              A 24-unit purpose-built rental purchased for $10M with CMHC MLI Select financing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="stack">
              <TabsList>
                <TabsTrigger value="stack" data-testid="tab-stack">Capital Stack</TabsTrigger>
                <TabsTrigger value="returns" data-testid="tab-returns">Layer Returns</TabsTrigger>
                <TabsTrigger value="waterfall" data-testid="tab-waterfall">Waterfall</TabsTrigger>
              </TabsList>
              <TabsContent value="stack" className="mt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 text-left">Layer</th>
                        <th className="py-2 text-right">Amount</th>
                        <th className="py-2 text-right">% of cost</th>
                        <th className="py-2 text-right">Rate / target</th>
                        <th className="py-2 text-left">Provider</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2">CMHC MLI Select senior</td>
                        <td className="py-2 text-right">{formatCurrency(8_500_000)}</td>
                        <td className="py-2 text-right">85%</td>
                        <td className="py-2 text-right">4.95% (5yr fixed, 50yr amort)</td>
                        <td className="py-2">Schedule I bank</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">Mezzanine (postponed 2nd)</td>
                        <td className="py-2 text-right">{formatCurrency(500_000)}</td>
                        <td className="py-2 text-right">5%</td>
                        <td className="py-2 text-right">12% (1yr term)</td>
                        <td className="py-2">Ontario-based MIC</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">Preferred equity</td>
                        <td className="py-2 text-right">{formatCurrency(400_000)}</td>
                        <td className="py-2 text-right">4%</td>
                        <td className="py-2 text-right">13% pref, accruing</td>
                        <td className="py-2">Family office (LP class B)</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">LP common equity</td>
                        <td className="py-2 text-right">{formatCurrency(500_000)}</td>
                        <td className="py-2 text-right">5%</td>
                        <td className="py-2 text-right">14-18% IRR target</td>
                        <td className="py-2">5 accredited investors</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">GP / sponsor co-invest</td>
                        <td className="py-2 text-right">{formatCurrency(100_000)}</td>
                        <td className="py-2 text-right">1%</td>
                        <td className="py-2 text-right">14-18% IRR + 25% promote &gt;8%</td>
                        <td className="py-2">Sponsor</td>
                      </tr>
                      <tr className="font-semibold">
                        <td className="py-2">Total</td>
                        <td className="py-2 text-right">{formatCurrency(10_000_000)}</td>
                        <td className="py-2 text-right">100%</td>
                        <td className="py-2 text-right">~5.9% blended</td>
                        <td className="py-2">—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </TabsContent>
              <TabsContent value="returns" className="mt-4 text-sm">
                <p className="mb-3">
                  Year-1 distributable cash flow after debt service: ~{formatCurrency(135_000)}. The
                  pref-equity 13% accrual eats first, then LP/GP split the residual.
                </p>
                <ul className="ml-5 list-disc space-y-1">
                  <li>Senior interest: ~{formatCurrency(420_000)} per year</li>
                  <li>Mezz interest: ~{formatCurrency(60_000)} per year (bridged out in yr 2)</li>
                  <li>Pref equity accrual: {formatCurrency(52_000)} per year (paid at refi or sale)</li>
                  <li>LP cash-on-cash yr 3-5: ~6-9% (after stabilization)</li>
                  <li>LP target IRR over 5 yrs: 14-18%, equity multiple 1.8-2.1x</li>
                </ul>
              </TabsContent>
              <TabsContent value="waterfall" className="mt-4 text-sm">
                <p className="mb-3">Sale-day proceeds flow in this order (top → bottom):</p>
                <ol className="ml-5 list-decimal space-y-1">
                  <li>Repay CMHC-insured senior debt + any prepayment penalty</li>
                  <li>Repay mezz principal + accrued interest (if not already refinanced out)</li>
                  <li>Return preferred-equity capital + all accrued 13% pref</li>
                  <li>Return of capital to LPs and GP co-invest pro-rata</li>
                  <li>
                    Pay LPs an 8% IRR preferred return, then split residual 75/25 LP/GP up to a 15%
                    IRR, then 65/35 LP/GP above 15% (the "catch-up")
                  </li>
                </ol>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Key Canadian rules */}
        <Card className="mb-12 border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle>Canadian Rules That Shape the Stack</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <h3 className="mb-1 font-semibold">OSFI B-20</h3>
              <p className="text-muted-foreground">
                The B-20 mortgage underwriting guideline forces federally-regulated lenders (banks,
                trust cos) to qualify borrowers at the greater of the contract rate + 2% or the
                benchmark rate. It directly caps how much senior debt a deal can carry.
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-semibold">CMHC MLI Select</h3>
              <p className="text-muted-foreground">
                Replaces conventional senior debt with insured financing at higher LTV (up to 95%),
                longer amortization (up to 50 yrs), and a lower rate. The catch: you must commit to
                affordability, accessibility, or energy-efficiency targets for 10 years.
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-semibold">NI 45-106 Prospectus Exemptions</h3>
              <p className="text-muted-foreground">
                LP equity is raised under the Accredited Investor or Offering Memorandum exemptions.
                Both come with prescribed disclosure, marketing restrictions, and ongoing reporting
                requirements that limit who you can take money from.
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-semibold">CRA Carry Tax Treatment</h3>
              <p className="text-muted-foreground">
                Unlike the US, carried interest paid to a GP in Canada is taxed as ordinary income.
                Sponsors typically co-invest meaningful equity so part of their return is taxed as
                capital gains.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* FAQ */}
        <section className="mb-12" aria-labelledby="faq-heading">
          <h2
            id="faq-heading"
            className="mb-6 text-3xl font-bold tracking-tight"
            data-testid="heading-faq"
          >
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {FAQS.map((f, i) => (
              <Card key={i} data-testid={`card-faq-${i}`}>
                <CardHeader>
                  <CardTitle className="text-lg">{f.q}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA */}
        <Card className="mb-12 border-2 border-primary bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center md:flex-row md:text-left">
            <div className="flex-1">
              <h3 className="text-2xl font-bold">Model your own Canadian capital stack</h3>
              <p className="mt-1 text-muted-foreground">
                Plug a real property into our Deal Analyzer and see exactly how senior, mezz, and
                equity layers shape your returns.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/tools/analyzer">
                <Button size="lg" data-testid="button-cta-analyzer">
                  Open Deal Analyzer <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/insights/guides">
                <Button size="lg" variant="outline" data-testid="button-cta-more-guides">
                  More Guides
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
