import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Building2,
  Calculator,
  ChevronRight,
  Landmark,
  Loader2,
  Search,
  ShieldCheck,
  Target,
} from "lucide-react";

import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type TierKey = "A" | "B" | "C";

interface LenderTier {
  key: TierKey;
  name: string;
  fullName: string;
  rateLow: number;
  rateHigh: number;
  midRate: number;
  feeLow: number;
  feeHigh: number;
  maxLtv: number;
  maxAmort: number;
  termLow: number;
  termHigh: number;
  regulator: string;
  borrowerProfile: string;
  examples: string[];
  qualifies: string[];
  watchouts: string[];
  exitStrategy: string;
  longDescription: string;
  color: string;
  icon: typeof Landmark;
}

const TIERS: LenderTier[] = [
  {
    key: "A",
    name: "A Lenders",
    fullName: "Prime / Tier-1 Lenders",
    rateLow: 4.49,
    rateHigh: 5.99,
    midRate: 5.24,
    feeLow: 0,
    feeHigh: 0,
    maxLtv: 80,
    maxAmort: 30,
    termLow: 1,
    termHigh: 10,
    regulator: "OSFI (federal)",
    borrowerProfile: "Strong credit (680+), provable income, stable employment",
    examples: [
      "Big 6 banks: RBC, TD, BMO, Scotiabank, CIBC, National Bank",
      "Monoline prime lenders: First National, MCAP, Merix",
      "Credit unions: Meridian, Vancity, Desjardins",
    ],
    qualifies: [
      "Beacon / Equifax score ≥ 680",
      "Verifiable T4 or 2-yr NOA income, GDS ≤ 39%, TDS ≤ 44%",
      "Passes OSFI B-20 stress test (contract rate + 2% or 5.25% floor)",
      "Down payment from own resources (or gifted)",
    ],
    watchouts: [
      "Strict income docs — self-employed and BFS borrowers struggle",
      "Heavy prepayment penalties on closed fixed mortgages (IRD on broken fixed terms can be brutal)",
      "Mortgage held by a bank shows on Equifax and can affect future borrowing",
    ],
    exitStrategy: "Renew at maturity or refinance with another A lender",
    longDescription:
      "A lenders are the federally regulated banks, credit unions, and monoline lenders that hold the vast majority of Canadian residential mortgages. They price off bond yields plus a small spread, are regulated by OSFI, and must apply the B-20 stress test. They lend the cheapest money in Canada but only to borrowers who fit the prime box on credit, income, and property.",
    color: "hsl(142, 71%, 45%)",
    icon: Landmark,
  },
  {
    key: "B",
    name: "B Lenders",
    fullName: "Alt-A / Near-Prime Lenders",
    rateLow: 6.49,
    rateHigh: 8.99,
    midRate: 7.49,
    feeLow: 1,
    feeHigh: 2,
    maxLtv: 80,
    maxAmort: 30,
    termLow: 1,
    termHigh: 3,
    regulator: "OSFI or provincial trust",
    borrowerProfile: "Bruised credit (550-679), self-employed, new immigrants, rental portfolios",
    examples: [
      "Equitable Bank (EQB)",
      "Home Trust / Haventree",
      "MCAP Alt-A, CMLS Aventura",
      "Community Trust, RFA",
    ],
    qualifies: [
      "Beacon score 550-679 acceptable with story",
      "Stated income for self-employed (BFS) programs",
      "Heavier debt-service ratios accepted (GDS/TDS up to 50/50)",
      "Most properties accepted — rentals, second homes, smaller-town stuff",
    ],
    watchouts: [
      "Lender fee of 1-2% capitalized into the loan",
      "1- to 3-year terms only — refinance risk at maturity",
      "Stress test still applies on most insurable products",
      "Pricing has widened in 2025-26 as private credit retreated",
    ],
    exitStrategy: "Clean up credit / income docs and refinance back to an A lender within 1-3 yrs",
    longDescription:
      "B lenders fill the gap between the banks and the private space. They are still federally or provincially regulated trust and mortgage companies, but they underwrite to a more flexible box — accepting bruised credit, self-employed income, and complex situations the banks turn away. Expect a 150-300 bps premium over A rates plus a 1-2% lender fee, in exchange for a 1-3 year ‘bridge’ until you can graduate back to a bank.",
    color: "hsl(38, 92%, 50%)",
    icon: Building2,
  },
  {
    key: "C",
    name: "C / Private Lenders",
    fullName: "MICs, Syndicated & Individual Private Lenders",
    rateLow: 9.99,
    rateHigh: 14.99,
    midRate: 12.0,
    feeLow: 2,
    feeHigh: 4,
    maxLtv: 75,
    maxAmort: 0,
    termLow: 0.5,
    termHigh: 2,
    regulator: "Provincial (FSRA in Ontario)",
    borrowerProfile: "Equity-based: motivated sellers, BFS with no docs, construction, bridge, 2nd/3rd position",
    examples: [
      "MICs: Fisgard, Neighbourhood Holdings, CMI, AlphaPro, Westboro",
      "Larger funds: Romspen, Trez Capital, Atrium MIC",
      "Individual private lenders (sourced via mortgage broker)",
    ],
    qualifies: [
      "Asset-based — credit and income are secondary to property value",
      "Up to 75% LTV first position, up to 85% combined with 2nd",
      "Urban/A markets get the best pricing; rural & special-use are penalized",
      "Most are interest-only with no amortization",
    ],
    watchouts: [
      "All-in cost 12-18% after lender + broker fees",
      "6- to 24-month terms — refinance pressure is constant",
      "Power-of-sale process is fast in Canada (90-180 days in most provinces)",
      "Some lenders charge 3-month interest penalty even at maturity",
    ],
    exitStrategy: "Short-term bridge — refinance to a B or A lender, or sell the asset before term",
    longDescription:
      "C-tier private lenders are MICs, syndicated mortgages, and individual private lenders sourced through licensed mortgage brokers. They are regulated provincially (FSRA in Ontario, BCFSA in BC, etc.) and underwrite primarily on the property — credit and income are secondary. They are the lender of last resort and a critical tool for motivated sellers, BRRR/flip investors, and developers who need fast, flexible capital. Treat private money as a short-term bridge, never long-term financing.",
    color: "hsl(0, 84%, 60%)",
    icon: AlertTriangle,
  },
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);
}

function monthlyPayment(principal: number, ratePct: number, amortYears: number) {
  if (amortYears <= 0) return (principal * (ratePct / 100)) / 12; // interest-only
  const r = ratePct / 100 / 12;
  const n = amortYears * 12;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is the difference between A, B, and C lenders in Canada?",
    a: "A lenders are federally regulated prime banks and credit unions (Big 6, monolines like First National, MCAP) that offer the cheapest mortgages to borrowers with strong credit and provable income. B lenders (Equitable Bank, Home Trust, Haventree, MCAP Alt-A) are alt-A / near-prime lenders that accept bruised credit, self-employed income, and complex situations at a 150-300 bps premium plus a 1-2% lender fee. C lenders are private mortgage providers — MICs, syndicated mortgages, and individual private lenders — that lend primarily on property equity at 10-15% with 2-4% in fees, regulated provincially.",
  },
  {
    q: "How much more does a B-lender mortgage cost than an A-lender mortgage?",
    a: "On a $600,000 mortgage, the spread is roughly $750-$1,500 per month in payment plus a one-time 1-2% lender fee ($6,000-$12,000). Over a 2-year term that's an extra $25,000-$40,000 in carrying cost. The math only works if (a) you can't get A-lender financing right now, or (b) you have a clear plan to refinance back to an A lender within the term.",
  },
  {
    q: "Are private lenders (C lenders) regulated in Canada?",
    a: "Yes. Private mortgage lenders are regulated provincially — FSRA in Ontario, BCFSA in British Columbia, and equivalent bodies in each other province. All private mortgages must be brokered by a licensed mortgage agent or broker. MICs (Mortgage Investment Corporations) are additionally governed by federal Income Tax Act provisions that require them to hold at least 50% of their assets in residential mortgages and cash.",
  },
  {
    q: "Can I get an investment-property mortgage from an A lender?",
    a: "Yes, but the rules tightened materially since 2018. Most A lenders cap rental property LTV at 80% on small residential (1-4 units), require 20% down from non-gifted funds, qualify rental income at 50% offset, and apply the OSFI B-20 stress test. Borrowers with more than 4-5 rentals are usually pushed to B lenders or specialized rental programs at First National or MCAP.",
  },
  {
    q: "What credit score do I need for a B or C lender in Canada?",
    a: "B lenders typically want a Beacon/Equifax score of 550 or higher, though some will go down to 500 with strong compensating factors (low LTV, big down payment, etc.). C / private lenders have no minimum credit score — they underwrite on the property. Borrowers with a 450 score can still get a private mortgage if the LTV is conservative and the property is in a strong market.",
  },
  {
    q: "What is the OSFI B-20 stress test and who does it apply to?",
    a: "B-20 is OSFI's residential mortgage underwriting guideline. It requires federally regulated lenders (A lenders and most B lenders) to qualify uninsured borrowers at the greater of the contract rate + 2% or 5.25%. It applies to new mortgages, refinances, and switches between federally regulated lenders. Provincially regulated credit unions and most C / private lenders are not bound by it, which is one reason borrowers tier down when they fail the stress test.",
  },
];

const SAMPLE_TERMS = [1, 2, 3, 5];

export default function ABCLendersCanadaGuide() {
  const [selectedTier, setSelectedTier] = useState<TierKey>("A");
  const [loanAmount, setLoanAmount] = useState(600_000);

  // Quiz inputs
  const [credit, setCredit] = useState<"high" | "mid" | "low">("high");
  const [income, setIncome] = useState<"t4" | "bfs" | "stated">("t4");
  const [ltv, setLtv] = useState<"low" | "mid" | "high">("mid");
  const [urgency, setUrgency] = useState<"flexible" | "fast" | "asap">("flexible");

  // Deal Matcher inputs
  const { toast } = useToast();
  const [mlsInput, setMlsInput] = useState("");
  const [purchasePrice, setPurchasePrice] = useState<number>(750_000);
  const [downPaymentPct, setDownPaymentPct] = useState<number>(20);
  const [units, setUnits] = useState<number>(1);
  const [annualRent, setAnnualRent] = useState<number>(0);
  const [dealCredit, setDealCredit] = useState<"high" | "mid" | "low">("high");
  const [dealIncome, setDealIncome] = useState<"t4" | "bfs" | "stated">("t4");
  const [strategy, setStrategy] = useState<
    "buy-hold" | "brrr" | "flip" | "multiplex-mli" | "construction" | "bridge"
  >("buy-hold");
  const [dealAddress, setDealAddress] = useState<string>("");
  const [mlsSource, setMlsSource] = useState<string | null>(null);

  const mlsLookup = useMutation({
    mutationFn: async (mls: string) => {
      const cleaned = mls.replace(/[^a-zA-Z0-9]/g, "");
      if (!cleaned) throw new Error("Enter a valid MLS number");
      const res = await fetch(`/api/ddf/mls/${encodeURIComponent(cleaned)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Lookup failed (${res.status})`);
      }
      return (await res.json()) as { listing: any; source: string };
    },
    onSuccess: ({ listing, source }) => {
      if (listing.price) setPurchasePrice(listing.price);
      if (listing.numberOfUnits) setUnits(listing.numberOfUnits);
      if (listing.totalActualRent) setAnnualRent(listing.totalActualRent * 12);
      const addr = [listing.address, listing.city, listing.province].filter(Boolean).join(", ");
      setDealAddress(addr);
      setMlsSource(source);
      toast({
        title: "Listing loaded",
        description: addr || `Loaded MLS ${listing.listingId}`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Couldn't load that MLS#",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const dealMatch = useMemo(() => {
    const reasons: { tier: TierKey; weight: number; note: string }[] = [];
    const loan = Math.max(0, purchasePrice * (1 - downPaymentPct / 100));
    const dscr =
      annualRent > 0 && loan > 0
        ? (annualRent * 0.5) / (monthlyPayment(loan, 5.5, 25) * 12) // banks offset rent at 50%
        : null;

    // Strategy
    if (strategy === "flip") {
      reasons.push({ tier: "C", weight: 4, note: "Flips need fast, interest-only capital — private/MIC is standard." });
    } else if (strategy === "construction") {
      reasons.push({ tier: "C", weight: 4, note: "Ground-up construction is almost exclusively private / specialty until completion." });
    } else if (strategy === "bridge") {
      reasons.push({ tier: "C", weight: 3, note: "Bridge financing is a private-lender product (6-24 month term)." });
    } else if (strategy === "brrr") {
      reasons.push({ tier: "B", weight: 2, note: "BRRR typically uses a B-lender or private mortgage during reno, then refinances to an A lender after stabilization." });
    } else if (strategy === "multiplex-mli") {
      if (units >= 5) {
        reasons.push({ tier: "A", weight: 4, note: `${units} units qualifies for CMHC MLI Select — insured A-lender financing at the lowest rates in Canada.` });
      } else {
        reasons.push({ tier: "A", weight: 1, note: "MLI Select requires 5+ units — under 5 units defaults to standard residential underwriting." });
      }
    } else {
      reasons.push({ tier: "A", weight: 2, note: "Standard buy-and-hold is an A-lender product by default." });
    }

    // Credit
    if (dealCredit === "high") {
      reasons.push({ tier: "A", weight: 2, note: "Beacon 680+ qualifies for prime A-lender pricing." });
    } else if (dealCredit === "mid") {
      reasons.push({ tier: "B", weight: 2, note: "Beacon 550-679 typically pushes the file to a B / alt-A lender." });
    } else {
      reasons.push({ tier: "C", weight: 3, note: "Credit under 550 essentially eliminates A and most B lenders — private is the realistic path." });
    }

    // Income
    if (dealIncome === "t4") {
      reasons.push({ tier: "A", weight: 1, note: "T4 employment income is the cleanest underwriting story for A lenders." });
    } else if (dealIncome === "bfs") {
      reasons.push({ tier: "B", weight: 2, note: "Self-employed (BFS) typically lands at a B lender unless 2+ yrs of strong NOAs are available." });
    } else {
      reasons.push({ tier: "C", weight: 3, note: "Stated or no provable income forces an equity-based / private mortgage." });
    }

    // LTV
    const effLtv = 100 - downPaymentPct;
    if (effLtv <= 65) {
      reasons.push({ tier: "A", weight: 1, note: `LTV of ${effLtv}% is conservative — every tier will lend.` });
    } else if (effLtv <= 80) {
      reasons.push({ tier: "B", weight: 1, note: `LTV of ${effLtv}% is at the residential ceiling — most A & B lenders OK on insurable product.` });
    } else {
      reasons.push({ tier: "C", weight: 3, note: `LTV of ${effLtv}% is above the 80% conventional cap — only private or insured high-ratio (owner-occupied) works.` });
    }

    // DSCR rental check
    if (dscr !== null) {
      if (dscr >= 1.2) {
        reasons.push({ tier: "A", weight: 1, note: `Rental DSCR ${dscr.toFixed(2)}x clears the 1.2 hurdle most A lenders use on rentals.` });
      } else if (dscr >= 0.9) {
        reasons.push({ tier: "B", weight: 1, note: `Rental DSCR ${dscr.toFixed(2)}x is borderline — expect a B-lender rental program.` });
      } else {
        reasons.push({ tier: "C", weight: 2, note: `Rental DSCR ${dscr.toFixed(2)}x is below 0.9 — only equity-based private lenders will look at this.` });
      }
    }

    const score: Record<TierKey, number> = { A: 0, B: 0, C: 0 };
    reasons.forEach((r) => {
      score[r.tier] += r.weight;
    });
    const winner = (Object.entries(score) as [TierKey, number][])
      .sort((a, b) => b[1] - a[1])[0][0];

    const tier = TIERS.find((t) => t.key === winner)!;
    const fee = (loan * ((tier.feeLow + tier.feeHigh) / 2)) / 100;
    const monthly = monthlyPayment(loan + fee, tier.midRate, tier.maxAmort || 25);

    return { winner, score, reasons, loan, fee, monthly, tier, dscr, effLtv };
  }, [purchasePrice, downPaymentPct, units, annualRent, dealCredit, dealIncome, strategy]);

  const tierRecommendation: TierKey = useMemo(() => {
    let score = 0; // higher = more risk, pushes toward C
    score += credit === "high" ? 0 : credit === "mid" ? 2 : 4;
    score += income === "t4" ? 0 : income === "bfs" ? 1 : 3;
    score += ltv === "low" ? 0 : ltv === "mid" ? 1 : 3;
    score += urgency === "flexible" ? 0 : urgency === "fast" ? 1 : 3;
    if (score <= 2) return "A";
    if (score <= 6) return "B";
    return "C";
  }, [credit, income, ltv, urgency]);

  const comparisonChart = useMemo(
    () =>
      TIERS.map((t) => {
        const fee = (loanAmount * ((t.feeLow + t.feeHigh) / 2)) / 100;
        const payment = monthlyPayment(loanAmount + fee, t.midRate, t.maxAmort || 25);
        return {
          name: t.name,
          monthly: Math.round(payment),
          fee: Math.round(fee),
          rate: t.midRate,
          color: t.color,
        };
      }),
    [loanAmount],
  );

  const termCostChart = useMemo(
    () =>
      SAMPLE_TERMS.map((years) => {
        const row: Record<string, number | string> = { term: `${years}y` };
        TIERS.forEach((t) => {
          const fee = (loanAmount * ((t.feeLow + t.feeHigh) / 2)) / 100;
          const monthly = monthlyPayment(loanAmount + fee, t.midRate, t.maxAmort || 25);
          // total interest over the term (rough): monthly*12*years - principal paid down
          const r = t.midRate / 100 / 12;
          const n = (t.maxAmort || 25) * 12;
          const remaining =
            t.maxAmort === 0
              ? loanAmount + fee
              : (loanAmount + fee) * (Math.pow(1 + r, n) - Math.pow(1 + r, years * 12)) /
                (Math.pow(1 + r, n) - 1);
          const principalPaid = loanAmount + fee - remaining;
          const interestPaid = monthly * 12 * years - principalPaid;
          row[t.key] = Math.round(interestPaid + fee);
        });
        return row;
      }),
    [loanAmount],
  );

  const radarData = useMemo(
    () =>
      TIERS.map((t) => ({
        name: t.name,
        rate: t.midRate,
        lvtMax: t.maxLtv,
        amortMax: t.maxAmort || 1,
        feeMid: (t.feeLow + t.feeHigh) / 2,
        termMid: (t.termLow + t.termHigh) / 2,
        color: t.color,
      })),
    [],
  );

  const selected = TIERS.find((t) => t.key === selectedTier)!;
  const recommended = TIERS.find((t) => t.key === tierRecommendation)!;

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": "https://realist.ca/insights/guides/a-vs-b-vs-c-lenders-canada#article",
        headline: "A Lenders vs B Lenders vs C Lenders in Canada: The Complete Guide (2026)",
        description:
          "Everything Canadian real estate borrowers need to know about A lenders (banks, monolines), B lenders (Equitable, Home Trust, MCAP Alt-A), and C / private lenders (MICs like Romspen, Fisgard, CMI). Includes a live cost-comparison calculator and lender-tier finder quiz.",
        author: { "@type": "Person", name: "Daniel Foch", url: "https://realist.ca" },
        publisher: {
          "@type": "Organization",
          name: "Realist.ca",
          logo: { "@type": "ImageObject", url: "https://realist.ca/logo.png" },
        },
        datePublished: "2026-05-21",
        dateModified: "2026-05-21",
        image: "https://realist.ca/og-image.png",
        mainEntityOfPage: "https://realist.ca/insights/guides/a-vs-b-vs-c-lenders-canada",
        about: [
          { "@type": "Thing", name: "Canadian mortgage lenders" },
          { "@type": "Thing", name: "Alternative mortgage lending" },
          { "@type": "Thing", name: "Private mortgage lending" },
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
          { "@type": "ListItem", position: 2, name: "Guides", item: "https://realist.ca/insights/guides" },
          {
            "@type": "ListItem",
            position: 3,
            name: "A vs B vs C Lenders in Canada",
            item: "https://realist.ca/insights/guides/a-vs-b-vs-c-lenders-canada",
          },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="A Lenders vs B Lenders vs C Lenders in Canada (2026 Guide)"
        description="Compare Canadian A lenders (Big 6 banks, First National, MCAP), B lenders (Equitable Bank, Home Trust, Haventree), and C / private lenders (MICs like Romspen, Fisgard, CMI). Includes a live cost calculator, lender-tier finder, and FAQs on rates, fees, LTV, and the B-20 stress test."
        keywords="A lenders Canada, B lenders Canada, C lenders Canada, private mortgage Canada, MIC mortgage investment corporation, Equitable Bank, Home Trust, Romspen, alternative mortgage, B-20 stress test, OSFI mortgage rules, near-prime lender, alt-A mortgage Canada"
        canonicalUrl="/insights/guides/a-vs-b-vs-c-lenders-canada"
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
          <span className="text-foreground">A vs B vs C Lenders</span>
        </nav>

        {/* Hero */}
        <header className="mb-12">
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge variant="secondary" data-testid="badge-category">Intermediate Guide</Badge>
            <Badge variant="outline">Canadian Mortgages</Badge>
            <Badge variant="outline">15 min read</Badge>
          </div>
          <h1
            className="mb-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl"
            data-testid="text-page-title"
          >
            A Lenders vs B Lenders vs C Lenders in Canada
          </h1>
          <p className="max-w-3xl text-xl text-muted-foreground">
            Every Canadian mortgage gets placed in one of three buckets: prime banks (A), alt-A
            trusts (B), or private capital (C). Each one has a different price, a different
            underwriting box, and a different regulator. Here's how to know which tier you're in
            — and what it actually costs.
          </p>
        </header>

        {/* Tier picker */}
        <Card className="mb-12 border-2" data-testid="card-tier-overview">
          <CardHeader>
            <CardTitle>Pick a tier to explore</CardTitle>
            <CardDescription>
              Click any tier to see who lends, who qualifies, and what to watch for.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 grid gap-3 md:grid-cols-3">
              {TIERS.map((t) => {
                const isSelected = selectedTier === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setSelectedTier(t.key)}
                    aria-pressed={isSelected}
                    className={`rounded-lg border-2 p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isSelected ? "bg-muted/50" : "hover:bg-muted/30"
                    }`}
                    style={{ borderColor: isSelected ? t.color : undefined }}
                    data-testid={`button-tier-${t.key}`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <t.icon className="h-5 w-5" style={{ color: t.color }} />
                      <span className="text-lg font-semibold">{t.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{t.fullName}</div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Rate</div>
                        <div className="font-semibold tabular-nums">
                          {t.rateLow}-{t.rateHigh}%
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Lender fee</div>
                        <div className="font-semibold tabular-nums">
                          {t.feeLow === 0 && t.feeHigh === 0 ? "None" : `${t.feeLow}-${t.feeHigh}%`}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Max LTV</div>
                        <div className="font-semibold tabular-nums">{t.maxLtv}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Term</div>
                        <div className="font-semibold tabular-nums">
                          {t.termLow}-{t.termHigh}y
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <Card className="bg-muted/30" data-testid={`card-tier-detail-${selected.key}`}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <selected.icon className="h-6 w-6 shrink-0" style={{ color: selected.color }} />
                  <div>
                    <CardTitle>{selected.name} — {selected.fullName}</CardTitle>
                    <CardDescription>
                      Regulator: {selected.regulator} • Typical borrower: {selected.borrowerProfile}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed">{selected.longDescription}</p>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Active Lenders
                    </h3>
                    <ul className="space-y-1 text-sm">
                      {selected.examples.map((p) => (
                        <li key={p} className="flex gap-2">
                          <span className="text-muted-foreground">•</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-400">
                      Who Qualifies
                    </h3>
                    <ul className="space-y-1 text-sm">
                      {selected.qualifies.map((p) => (
                        <li key={p} className="flex gap-2">
                          <span className="text-green-600">✓</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-400">
                      Watch Out For
                    </h3>
                    <ul className="space-y-1 text-sm">
                      {selected.watchouts.map((p) => (
                        <li key={p} className="flex gap-2">
                          <span className="text-red-600">!</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="rounded-md border bg-background p-3 text-sm">
                  <span className="font-semibold">Exit strategy:</span> {selected.exitStrategy}
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        {/* Live cost calculator */}
        <Card className="mb-12" data-testid="card-cost-calculator">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" /> Live Cost Calculator
            </CardTitle>
            <CardDescription>
              Compare what the same mortgage costs across A, B, and C lenders at today's typical
              Canadian pricing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 max-w-md">
              <div className="mb-2 flex items-baseline justify-between">
                <Label htmlFor="loan-amount">Mortgage amount</Label>
                <span className="text-lg font-semibold tabular-nums">{formatCurrency(loanAmount)}</span>
              </div>
              <Slider
                id="loan-amount"
                value={[loanAmount]}
                min={100_000}
                max={2_000_000}
                step={25_000}
                onValueChange={(v) => setLoanAmount(v[0])}
                aria-label={`Mortgage amount, currently ${formatCurrency(loanAmount)}`}
                data-testid="slider-loan-amount"
              />
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>$100K</span>
                <span>$2M</span>
              </div>
            </div>

            <Tabs defaultValue="monthly">
              <TabsList>
                <TabsTrigger value="monthly" data-testid="tab-monthly">Monthly Payment</TabsTrigger>
                <TabsTrigger value="term-cost" data-testid="tab-term-cost">Cost by Term</TabsTrigger>
                <TabsTrigger value="table" data-testid="tab-table">Side-by-Side</TabsTrigger>
              </TabsList>

              <TabsContent value="monthly" className="mt-4">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonChart}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === "monthly") return [formatCurrency(value), "Monthly payment"];
                          if (name === "fee") return [formatCurrency(value), "Lender fee (one-time)"];
                          return [value, name];
                        }}
                      />
                      <Legend />
                      <Bar dataKey="monthly" name="Monthly payment">
                        {comparisonChart.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="term-cost" className="mt-4">
                <p className="mb-3 text-sm text-muted-foreground">
                  Total cost of borrowing (interest + lender fee) at the end of each term length.
                </p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={termCostChart}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="term" />
                      <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                      {TIERS.map((t) => (
                        <Line
                          key={t.key}
                          type="monotone"
                          dataKey={t.key}
                          name={t.name}
                          stroke={t.color}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="table" className="mt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 text-left">Tier</th>
                        <th className="py-2 text-right">Rate (mid)</th>
                        <th className="py-2 text-right">Lender fee</th>
                        <th className="py-2 text-right">Monthly payment</th>
                        <th className="py-2 text-right">Annual cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {TIERS.map((t) => {
                        const fee = (loanAmount * ((t.feeLow + t.feeHigh) / 2)) / 100;
                        const monthly = monthlyPayment(loanAmount + fee, t.midRate, t.maxAmort || 25);
                        return (
                          <tr key={t.key} className="border-b">
                            <td className="py-2 font-medium" style={{ color: t.color }}>
                              {t.name}
                            </td>
                            <td className="py-2 text-right tabular-nums">{t.midRate.toFixed(2)}%</td>
                            <td className="py-2 text-right tabular-nums">{formatCurrency(fee)}</td>
                            <td className="py-2 text-right tabular-nums">{formatCurrency(monthly)}</td>
                            <td className="py-2 text-right tabular-nums">{formatCurrency(monthly * 12)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Comparison metrics chart */}
        <Card className="mb-12" data-testid="card-metrics-chart">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" /> Tier-by-Tier Comparison
            </CardTitle>
            <CardDescription>
              How A, B, and C lenders stack up on rate, max LTV, max amortization, and lender fees.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Mid Rate (%)</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={radarData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(v: number) => `${v}%`} />
                      <Bar dataKey="rate">
                        {radarData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Lender Fee (%)</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={radarData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(v: number) => `${v}%`} />
                      <Bar dataKey="feeMid">
                        {radarData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Max LTV (%)</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={radarData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(v: number) => `${v}%`} />
                      <Bar dataKey="lvtMax">
                        {radarData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Avg Term Length (years)</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={radarData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="termMid">
                        {radarData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quiz: Which tier are you? */}
        {/* Deal Matcher: MLS# or manual underwriting → tier recommendation */}
        <Card className="mb-12 border-2 border-primary/50" data-testid="card-deal-matcher">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" /> Match a Real Deal to a Lender Tier
            </CardTitle>
            <CardDescription>
              Drop in an MLS# (Canadian CREA DDF), or type your own underwriting numbers, pick a
              strategy, and we'll point you at the lender tier the deal actually fits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* MLS lookup */}
            <div className="rounded-lg border bg-muted/20 p-4">
              <Label htmlFor="mls-input" className="text-sm font-semibold">
                Option 1 — Pull a live Canadian listing by MLS#
              </Label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Input
                  id="mls-input"
                  placeholder="e.g. W7384562"
                  value={mlsInput}
                  onChange={(e) => setMlsInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && mlsInput.trim()) {
                      mlsLookup.mutate(mlsInput.trim());
                    }
                  }}
                  data-testid="input-mls"
                />
                <Button
                  type="button"
                  onClick={() => mlsLookup.mutate(mlsInput.trim())}
                  disabled={!mlsInput.trim() || mlsLookup.isPending}
                  data-testid="button-mls-lookup"
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
                <p className="mt-2 text-xs text-muted-foreground" data-testid="text-loaded-address">
                  Loaded: <span className="font-medium text-foreground">{dealAddress}</span>
                  {mlsSource && <span> · source: {mlsSource}</span>}
                </p>
              )}
            </div>

            {/* Manual underwriting */}
            <div>
              <p className="mb-3 text-sm font-semibold">
                Option 2 — Or enter / adjust your own underwriting
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="dm-price">Purchase price (CAD)</Label>
                  <Input
                    id="dm-price"
                    type="number"
                    min={0}
                    step={1000}
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(Number(e.target.value) || 0)}
                    data-testid="input-purchase-price"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatCurrency(purchasePrice)}
                  </p>
                </div>

                <div>
                  <Label htmlFor="dm-units"># of units</Label>
                  <Input
                    id="dm-units"
                    type="number"
                    min={1}
                    max={200}
                    value={units}
                    onChange={(e) => setUnits(Math.max(1, Number(e.target.value) || 1))}
                    data-testid="input-units"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <Label htmlFor="dm-down">Down payment</Label>
                    <span className="text-sm font-semibold tabular-nums">{downPaymentPct}%</span>
                  </div>
                  <Slider
                    id="dm-down"
                    value={[downPaymentPct]}
                    min={5}
                    max={50}
                    step={1}
                    onValueChange={(v) => setDownPaymentPct(v[0])}
                    aria-label={`Down payment, ${downPaymentPct}%`}
                    data-testid="slider-down-payment"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Loan: {formatCurrency(dealMatch.loan)} · LTV {dealMatch.effLtv}%
                  </p>
                </div>

                <div>
                  <Label htmlFor="dm-rent">Annual gross rent (CAD)</Label>
                  <Input
                    id="dm-rent"
                    type="number"
                    min={0}
                    step={1000}
                    value={annualRent}
                    onChange={(e) => setAnnualRent(Number(e.target.value) || 0)}
                    placeholder="Optional — enables DSCR check"
                    data-testid="input-annual-rent"
                  />
                  {dealMatch.dscr !== null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Bank-stress DSCR: <span className="font-semibold">{dealMatch.dscr.toFixed(2)}x</span> (rent offset 50%)
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="dm-credit">Borrower credit</Label>
                  <Select value={dealCredit} onValueChange={(v) => setDealCredit(v as typeof dealCredit)}>
                    <SelectTrigger id="dm-credit" data-testid="select-deal-credit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">Beacon 680+</SelectItem>
                      <SelectItem value="mid">Beacon 550-679</SelectItem>
                      <SelectItem value="low">Under 550 / no score</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="dm-income">Income type</Label>
                  <Select value={dealIncome} onValueChange={(v) => setDealIncome(v as typeof dealIncome)}>
                    <SelectTrigger id="dm-income" data-testid="select-deal-income">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="t4">T4 employed (2+ yrs)</SelectItem>
                      <SelectItem value="bfs">Self-employed (BFS)</SelectItem>
                      <SelectItem value="stated">Stated / no provable income</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="dm-strategy">Investment strategy</Label>
                  <Select value={strategy} onValueChange={(v) => setStrategy(v as typeof strategy)}>
                    <SelectTrigger id="dm-strategy" data-testid="select-strategy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buy-hold">Buy &amp; Hold (conventional)</SelectItem>
                      <SelectItem value="brrr">BRRR (Buy / Reno / Rent / Refi)</SelectItem>
                      <SelectItem value="flip">Flip (6-12 month resale)</SelectItem>
                      <SelectItem value="multiplex-mli">Multiplex / CMHC MLI Select (5+ units)</SelectItem>
                      <SelectItem value="construction">Ground-up construction</SelectItem>
                      <SelectItem value="bridge">Bridge / short-term hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Result */}
            <div
              className="rounded-lg border-2 p-5"
              style={{ borderColor: dealMatch.tier.color, background: `${dealMatch.tier.color}10` }}
              data-testid={`result-deal-tier-${dealMatch.winner}`}
              aria-live="polite"
            >
              <div className="flex flex-wrap items-start gap-4">
                <dealMatch.tier.icon
                  className="h-8 w-8 shrink-0"
                  style={{ color: dealMatch.tier.color }}
                />
                <div className="flex-1 min-w-[200px]">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Most likely mortgage tier
                  </div>
                  <div className="text-2xl font-bold">
                    {dealMatch.tier.name} — {dealMatch.tier.fullName}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Score: A {dealMatch.score.A} · B {dealMatch.score.B} · C {dealMatch.score.C}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Est. rate</div>
                    <div className="font-semibold tabular-nums">{dealMatch.tier.midRate}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Lender fee</div>
                    <div className="font-semibold tabular-nums">{formatCurrency(dealMatch.fee)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Est. monthly</div>
                    <div className="font-semibold tabular-nums">{formatCurrency(dealMatch.monthly)}</div>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Why this tier
                </div>
                <ul className="space-y-1.5 text-sm">
                  {dealMatch.reasons.map((r, i) => {
                    const t = TIERS.find((x) => x.key === r.tier)!;
                    return (
                      <li key={i} className="flex gap-2" data-testid={`reason-${i}`}>
                        <span
                          className="mt-0.5 inline-flex h-5 w-6 shrink-0 items-center justify-center rounded text-xs font-semibold"
                          style={{ background: `${t.color}25`, color: t.color }}
                        >
                          {r.tier}
                        </span>
                        <span>{r.note}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/tools/analyzer">
                  <Button size="sm" data-testid="button-deal-analyzer">
                    Open in Deal Analyzer <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/insights/mortgage-rates">
                  <Button size="sm" variant="outline">
                    See live {dealMatch.tier.name.split(" ")[0]}-lender rates
                  </Button>
                </Link>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                Heuristic only — actual lender decisions also depend on property type, location,
                appraisal, and your full broker package. This isn't a mortgage commitment.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-12 border-2 border-primary/30" data-testid="card-tier-finder">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Which Tier Are You?
            </CardTitle>
            <CardDescription>
              Answer four questions and we'll point you at the lender tier most Canadian brokers
              would shop first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold">Credit score (Beacon)</Label>
                  <RadioGroup
                    value={credit}
                    onValueChange={(v) => setCredit(v as typeof credit)}
                    className="mt-2"
                    data-testid="radio-credit"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="high" id="c-high" />
                      <Label htmlFor="c-high" className="font-normal">680+</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="mid" id="c-mid" />
                      <Label htmlFor="c-mid" className="font-normal">550-679</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="low" id="c-low" />
                      <Label htmlFor="c-low" className="font-normal">Under 550 or no score</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label className="text-sm font-semibold">Income type</Label>
                  <RadioGroup
                    value={income}
                    onValueChange={(v) => setIncome(v as typeof income)}
                    className="mt-2"
                    data-testid="radio-income"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="t4" id="i-t4" />
                      <Label htmlFor="i-t4" className="font-normal">T4 employee with 2+ yrs history</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="bfs" id="i-bfs" />
                      <Label htmlFor="i-bfs" className="font-normal">Self-employed (2+ yrs NOAs)</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="stated" id="i-stated" />
                      <Label htmlFor="i-stated" className="font-normal">Stated / no provable income</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold">Loan-to-value</Label>
                  <RadioGroup
                    value={ltv}
                    onValueChange={(v) => setLtv(v as typeof ltv)}
                    className="mt-2"
                    data-testid="radio-ltv"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="low" id="l-low" />
                      <Label htmlFor="l-low" className="font-normal">Under 65%</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="mid" id="l-mid" />
                      <Label htmlFor="l-mid" className="font-normal">65-80%</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="high" id="l-high" />
                      <Label htmlFor="l-high" className="font-normal">80%+</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label className="text-sm font-semibold">How fast do you need to close?</Label>
                  <RadioGroup
                    value={urgency}
                    onValueChange={(v) => setUrgency(v as typeof urgency)}
                    className="mt-2"
                    data-testid="radio-urgency"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="flexible" id="u-flex" />
                      <Label htmlFor="u-flex" className="font-normal">30-60 days, flexible</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="fast" id="u-fast" />
                      <Label htmlFor="u-fast" className="font-normal">2-4 weeks</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="asap" id="u-asap" />
                      <Label htmlFor="u-asap" className="font-normal">Under 14 days</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>

            <div
              className="mt-6 rounded-lg border-2 p-4"
              style={{ borderColor: recommended.color, background: `${recommended.color}10` }}
              data-testid={`result-recommended-${recommended.key}`}
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                <recommended.icon className="h-6 w-6 shrink-0" style={{ color: recommended.color }} />
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Most likely tier
                  </div>
                  <div className="text-xl font-bold">{recommended.name} — {recommended.fullName}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{recommended.exitStrategy}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Long-form narrative */}
        <section className="mb-12 space-y-6" aria-labelledby="long-heading">
          <h2 id="long-heading" className="text-3xl font-bold tracking-tight">
            How Canadian Lender Tiers Actually Work
          </h2>
          {TIERS.map((t) => (
            <Card key={t.key} id={`tier-${t.key}`} data-testid={`card-long-${t.key}`}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${t.color}20` }}
                  >
                    <t.icon className="h-5 w-5" style={{ color: t.color }} />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">{t.name} — {t.fullName}</CardTitle>
                    <CardDescription>
                      Rate {t.rateLow}-{t.rateHigh}% • Lender fee{" "}
                      {t.feeLow === 0 && t.feeHigh === 0 ? "none" : `${t.feeLow}-${t.feeHigh}%`} •
                      Max LTV {t.maxLtv}% • Regulator: {t.regulator}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-base leading-relaxed">{t.longDescription}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Cross-link to capital stack guide */}
        <Card className="mb-12 bg-muted/30">
          <CardContent className="flex flex-col gap-3 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Where do A/B/C lenders fit in the bigger picture?</h3>
              <p className="text-sm text-muted-foreground">
                A, B, and C lenders all live in the senior-debt and mezzanine layers of a real
                estate capital stack. See the full picture in our companion guide.
              </p>
            </div>
            <Link href="/insights/guides/capital-stack-canada">
              <Button variant="outline" data-testid="button-link-capital-stack">
                Read: The Capital Stack <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
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
              <h3 className="text-2xl font-bold">Underwrite a deal at every lender tier</h3>
              <p className="mt-1 text-muted-foreground">
                Run the same property through A, B, and C-lender financing and see which tier
                actually makes the deal work.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/tools/analyzer">
                <Button size="lg" data-testid="button-cta-analyzer">
                  Open Deal Analyzer <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/insights/mortgage-rates">
                <Button size="lg" variant="outline" data-testid="button-cta-rates">
                  Live Canadian Rates
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
