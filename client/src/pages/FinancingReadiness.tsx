/**
 * Financing Readiness — /tools/financing-readiness
 *
 * The mortgage on-ramp: five inputs → stress-tested max purchase price,
 * readiness grade, and the gaps to close — then straight into a financing
 * consultation (BookCallCta → booked_call_leads → BLD Financial).
 *
 * All math is deterministic and client-side: OSFI stress test (contract +2%
 * or 5.25% floor), GDS 39% / TDS 44%, CMHC premium tiers, Canadian
 * semi-annual compounding. Educational estimate only — copy says so; the
 * licensed pre-approval happens on the call.
 */
import { useMemo, useState } from "react";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { BookCallCta } from "@/components/BookCallCta";
import { NextStepBlock } from "@/components/NextStepBlock";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Gauge, ShieldCheck, TrendingUp, AlertTriangle } from "lucide-react";
import { Link } from "wouter";

// ─── Deterministic mortgage math ─────────────────────────────────────────────

const GDS_CAP = 0.39;
const TDS_CAP = 0.44;
const HEAT_MONTHLY = 125;
const PROPERTY_TAX_RATE_YEARLY = 0.01; // 1% of purchase price, conservative

/** Canadian fixed mortgages compound semi-annually. */
function monthlyRate(annualPct: number): number {
  return Math.pow(1 + annualPct / 100 / 2, 1 / 6) - 1;
}

function monthlyPayment(principal: number, annualPct: number, years: number): number {
  const r = monthlyRate(annualPct);
  const n = years * 12;
  if (principal <= 0) return 0;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

function minDownFor(price: number): number {
  if (price >= 1_500_000) return price * 0.2;
  if (price <= 500_000) return price * 0.05;
  return 500_000 * 0.05 + (price - 500_000) * 0.1;
}

function cmhcPremiumRate(ltv: number): number {
  if (ltv <= 0.8) return 0;
  if (ltv <= 0.85) return 0.028;
  if (ltv <= 0.9) return 0.031;
  return 0.04;
}

interface ReadinessInput {
  incomeYearly: number;
  debtsMonthly: number;
  downPayment: number;
  contractRatePct: number;
  amortYears: number;
}

interface ReadinessResult {
  maxPrice: number;
  loan: number;
  cmhcPremium: number;
  paymentContract: number;
  paymentStress: number;
  gds: number;
  tds: number;
  qualifyingRatePct: number;
  insured: boolean;
  limitedBy: "income" | "down_payment";
  grade: "A" | "B" | "C";
  verdict: string;
}

/**
 * Largest affordable price: carrying costs at the qualifying rate must fit
 * GDS/TDS, and the down payment must meet the federal minimum. Binary search
 * over price — the constraint set is monotone.
 */
function computeReadiness(input: ReadinessInput): ReadinessResult | null {
  const { incomeYearly, debtsMonthly, downPayment, contractRatePct, amortYears } = input;
  if (incomeYearly <= 0 || downPayment <= 0) return null;

  const qualifyingRatePct = Math.max(contractRatePct + 2, 5.25);
  const monthlyIncome = incomeYearly / 12;

  const fits = (price: number): boolean => {
    if (downPayment < minDownFor(price)) return false;
    if (downPayment >= price) return true;
    const ltv = (price - downPayment) / price;
    if (ltv > 0.95) return false;
    if (price >= 1_500_000 && ltv > 0.8) return false; // uninsurable above $1.5M
    const baseLoan = price - downPayment;
    const loan = baseLoan * (1 + cmhcPremiumRate(ltv));
    const years = ltv > 0.8 ? Math.min(amortYears, 25) : amortYears;
    const pi = monthlyPayment(loan, qualifyingRatePct, years);
    const carrying = pi + (price * PROPERTY_TAX_RATE_YEARLY) / 12 + HEAT_MONTHLY;
    return carrying <= monthlyIncome * GDS_CAP && carrying + debtsMonthly <= monthlyIncome * TDS_CAP;
  };

  let lo = 0;
  let hi = 5_000_000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  const maxPrice = Math.floor(lo / 1000) * 1000;
  if (maxPrice < 50_000) return null;

  const ltv = Math.max(0, (maxPrice - downPayment) / maxPrice);
  const insured = ltv > 0.8;
  const baseLoan = Math.max(0, maxPrice - downPayment);
  const cmhcPremium = baseLoan * cmhcPremiumRate(ltv);
  const loan = baseLoan + cmhcPremium;
  const years = insured ? Math.min(amortYears, 25) : amortYears;
  const paymentContract = monthlyPayment(loan, contractRatePct, years);
  const paymentStress = monthlyPayment(loan, qualifyingRatePct, years);
  const carryingStress = paymentStress + (maxPrice * PROPERTY_TAX_RATE_YEARLY) / 12 + HEAT_MONTHLY;
  const gds = carryingStress / monthlyIncome;
  const tds = (carryingStress + debtsMonthly) / monthlyIncome;

  // What binds at the ceiling: income (GDS/TDS) or the down-payment minimum.
  const limitedBy: ReadinessResult["limitedBy"] =
    downPayment <= minDownFor(maxPrice) * 1.02 ? "down_payment" : "income";

  let grade: ReadinessResult["grade"];
  let verdict: string;
  if (downPayment >= maxPrice * 0.1 && tds <= TDS_CAP * 0.9) {
    grade = "A";
    verdict = "Strong position — you'd walk into a pre-approval conversation with room to spare.";
  } else if (tds <= TDS_CAP) {
    grade = "B";
    verdict = "Workable — a specialist can structure this, and small changes would raise your ceiling.";
  } else {
    grade = "C";
    verdict = "Tight at this level — worth a call to map the path before you shop.";
  }

  return {
    maxPrice, loan, cmhcPremium, paymentContract, paymentStress,
    gds, tds, qualifyingRatePct, insured, limitedBy, grade, verdict,
  };
}

const fmtMoney = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

// ─── Page ────────────────────────────────────────────────────────────────────

export default function FinancingReadiness() {
  const [incomeYearly, setIncomeYearly] = useState(120_000);
  const [debtsMonthly, setDebtsMonthly] = useState(500);
  const [downPayment, setDownPayment] = useState(80_000);
  const [contractRatePct, setContractRatePct] = useState(4.5);
  const [amortYears, setAmortYears] = useState(25);

  const result = useMemo(
    () => computeReadiness({ incomeYearly, debtsMonthly, downPayment, contractRatePct, amortYears }),
    [incomeYearly, debtsMonthly, downPayment, contractRatePct, amortYears],
  );

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Financing Readiness — What Can You Actually Buy? | Realist.ca"
        description="Five inputs, thirty seconds: your stress-tested maximum purchase price, monthly payment, and readiness grade — then talk to a licensed specialist to make it real."
      />
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-3">
            <Gauge className="h-3 w-3 mr-1" /> Financing readiness
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">What can you actually buy?</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Five inputs. Your stress-tested ceiling, your monthly payment, and what would raise it —
            using the same rules a lender applies. Then make it real with a licensed specialist.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6 mb-8">
          {/* Inputs */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Your numbers</CardTitle>
              <CardDescription>Estimates are fine — the call confirms the details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="fr-income">Household income (yearly, before tax)</Label>
                <Input
                  id="fr-income" type="number" inputMode="numeric" min={0} step={5000}
                  value={incomeYearly || ""}
                  onChange={(e) => setIncomeYearly(Number(e.target.value))}
                  data-testid="input-fr-income"
                />
              </div>
              <div>
                <Label htmlFor="fr-debts">Monthly debt payments (car, loans, card minimums)</Label>
                <Input
                  id="fr-debts" type="number" inputMode="numeric" min={0} step={50}
                  value={debtsMonthly || ""}
                  onChange={(e) => setDebtsMonthly(Number(e.target.value))}
                  data-testid="input-fr-debts"
                />
              </div>
              <div>
                <Label htmlFor="fr-down">Down payment saved</Label>
                <Input
                  id="fr-down" type="number" inputMode="numeric" min={0} step={5000}
                  value={downPayment || ""}
                  onChange={(e) => setDownPayment(Number(e.target.value))}
                  data-testid="input-fr-down"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="fr-rate">Mortgage rate (%)</Label>
                  <Input
                    id="fr-rate" type="number" inputMode="decimal" min={1} max={12} step={0.05}
                    value={contractRatePct || ""}
                    onChange={(e) => setContractRatePct(Number(e.target.value))}
                    data-testid="input-fr-rate"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    <Link href="/insights/mortgage-rates" className="underline">Check current rates</Link>
                  </p>
                </div>
                <div>
                  <Label>Amortization</Label>
                  <Select value={String(amortYears)} onValueChange={(v) => setAmortYears(Number(v))}>
                    <SelectTrigger data-testid="select-fr-amort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25 years</SelectItem>
                      <SelectItem value="30">30 years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Your readiness</span>
                {result && (
                  <Badge
                    className={
                      result.grade === "A"
                        ? "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30"
                        : result.grade === "B"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                          : "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30"
                    }
                    data-testid="badge-fr-grade"
                  >
                    Grade {result.grade}
                  </Badge>
                )}
              </CardTitle>
              {result && <CardDescription>{result.verdict}</CardDescription>}
            </CardHeader>
            <CardContent>
              {!result ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Enter your income and down payment to see your stress-tested ceiling.
                </p>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className="text-sm text-muted-foreground uppercase tracking-wide">
                      Estimated maximum purchase price
                    </p>
                    <p className="text-4xl font-bold font-mono" data-testid="text-fr-max-price">
                      {fmtMoney(result.maxPrice)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Stress-tested at {result.qualifyingRatePct.toFixed(2)}% (contract rate + 2%, 5.25% floor)
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Monthly payment</p>
                      <p className="text-lg font-semibold font-mono">{fmtMoney(result.paymentContract)}</p>
                      <p className="text-xs text-muted-foreground">at your {contractRatePct}% rate</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Mortgage</p>
                      <p className="text-lg font-semibold font-mono">{fmtMoney(result.loan)}</p>
                      {result.insured && (
                        <p className="text-xs text-muted-foreground">
                          incl. {fmtMoney(result.cmhcPremium)} CMHC premium
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">GDS / TDS</p>
                      <p className="text-lg font-semibold font-mono">
                        {(result.gds * 100).toFixed(0)}% / {(result.tds * 100).toFixed(0)}%
                      </p>
                      <p className="text-xs text-muted-foreground">caps 39% / 44%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Financing type</p>
                      <p className="text-lg font-semibold">{result.insured ? "Insured" : "Conventional"}</p>
                      <p className="text-xs text-muted-foreground">
                        {result.insured ? "under 20% down" : "20%+ down"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/40 p-4 flex gap-3">
                    {result.limitedBy === "down_payment" ? (
                      <TrendingUp className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    ) : (
                      <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    )}
                    <div className="text-sm">
                      <p className="font-medium mb-1">What's setting your ceiling</p>
                      <p className="text-muted-foreground">
                        {result.limitedBy === "down_payment"
                          ? "Your down payment is the binding constraint — every extra $10,000 saved raises your ceiling faster than income growth would. A specialist can also walk through gifted down payments and RRSP Home Buyers' Plan room."
                          : "Your income and debts set the ceiling under the stress test. Paying down monthly obligations, adding a co-borrower, or rental offset income on an investment property can all raise it — exactly the levers a specialist structures."}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground flex gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    Educational estimate, not a pre-approval, rate offer, or advice. Assumes {fmtMoney(HEAT_MONTHLY)}/mo
                    heat and {(PROPERTY_TAX_RATE_YEARLY * 100).toFixed(0)}%/yr property tax. Your actual numbers are
                    confirmed by a licensed mortgage professional.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* The conversion moment: readiness → consultation */}
        {result && (
          <div className="mb-8">
            <BookCallCta
              intent="financing"
              sourcePage="/tools/financing-readiness"
              title="Turn this into a real pre-approval"
              description={`Based on your inputs you're around ${fmtMoney(result.maxPrice)} of buying power (Grade ${result.grade}). A licensed specialist from our financing partners confirms the real number, locks a rate hold, and maps the path — free, no obligation.`}
              dealSnapshot={{
                toolName: "Financing Readiness",
                purchasePrice: result.maxPrice,
                verdict: `Readiness ${result.grade} — est. max purchase ${fmtMoney(result.maxPrice)}`,
                keyMetrics: {
                  "Est. max purchase": fmtMoney(result.maxPrice),
                  "Mortgage (incl. premium)": fmtMoney(result.loan),
                  "Monthly payment @ contract": fmtMoney(result.paymentContract),
                  "Stress-test qualifying rate": `${result.qualifyingRatePct.toFixed(2)}%`,
                  "GDS / TDS": `${(result.gds * 100).toFixed(0)}% / ${(result.tds * 100).toFixed(0)}%`,
                  "Down payment": fmtMoney(downPayment),
                  "Financing type": result.insured ? "Insured" : "Conventional",
                  "Limited by": result.limitedBy === "down_payment" ? "Down payment" : "Income (stress test)",
                },
              }}
            />
          </div>
        )}

        <NextStepBlock hideReadiness sourcePage="/tools/financing-readiness" />
      </main>
    </div>
  );
}
