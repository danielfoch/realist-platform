import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, TrendingDown, DollarSign, Percent, Calculator, ChevronDown, ChevronUp, Info } from "lucide-react";
import {
  computeAllScenarios,
  computeBreakevenSpread,
  type AmortizationResult,
  type ScenarioResults,
} from "@/lib/mortgage/amortization";
import { SEO } from "@/components/SEO";

const fmt = (n: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);
const fmtRate = (n: number) => `${n.toFixed(2)}%`;

interface RateResponse {
  bestRate: number | null;
  source: string | null;
  timestamp: string | null;
  count: number;
}

export default function FixedVsVariable() {
  const [purchasePrice, setPurchasePrice] = useState(500000);
  const [downPaymentPct, setDownPaymentPct] = useState(20);
  const [loanAmountOverride, setLoanAmountOverride] = useState<string>("");
  const [amortizationYears, setAmortizationYears] = useState(25);
  const [fixedTerm, setFixedTerm] = useState("5");
  const [fixedRateOverride, setFixedRateOverride] = useState<string>("");
  const [variableRateOverride, setVariableRateOverride] = useState<string>("");
  const [severityBps, setSeverityBps] = useState(100);
  const [direction, setDirection] = useState<"rising" | "falling">("rising");
  const [speed, setSpeed] = useState<"front-loaded" | "even" | "back-loaded">("even");
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});

  const { data: fixedRateData } = useQuery<RateResponse>({
    queryKey: ["/api/rates/mortgage", { termYears: fixedTerm, type: "fixed" }],
    queryFn: () => fetch(`/api/rates/mortgage?termYears=${fixedTerm}&type=fixed`).then(r => r.json()),
  });

  const { data: variableRateData } = useQuery<RateResponse>({
    queryKey: ["/api/rates/mortgage", { type: "variable" }],
    queryFn: () => fetch(`/api/rates/mortgage?type=variable`).then(r => r.json()),
  });

  const { data: forecastData } = useQuery({
    queryKey: ["/api/rate-forecast/latest"],
    queryFn: () => fetch("/api/rate-forecast/latest").then(r => r.json()),
  });

  const fixedRate = fixedRateOverride ? parseFloat(fixedRateOverride) : (fixedRateData?.bestRate ?? 3.64);
  const variableRate = variableRateOverride ? parseFloat(variableRateOverride) : (variableRateData?.bestRate ?? 3.34);
  const principal = loanAmountOverride ? parseFloat(loanAmountOverride) : purchasePrice * (1 - downPaymentPct / 100);

  const results: ScenarioResults = useMemo(() => {
    if (principal <= 0 || fixedRate <= 0 || variableRate <= 0) {
      const empty: AmortizationResult = { monthlyPayment: 0, totalPaid: 0, totalInterestPaid: 0, totalPrincipalPaid: 0, endingBalance: 0, yearlyRows: [] };
      return { fixed: { y5: empty, y10: empty, y25: empty }, variableBase: { y5: empty, y10: empty, y25: empty }, variableBest: { y5: empty, y10: empty, y25: empty }, variableWorst: { y5: empty, y10: empty, y25: empty } };
    }
    const basePath = forecastData?.path || undefined;
    return computeAllScenarios(principal, amortizationYears, fixedRate, variableRate, severityBps, speed, basePath, direction);
  }, [principal, amortizationYears, fixedRate, variableRate, severityBps, speed, forecastData, direction]);

  const breakeven5 = useMemo(() => {
    if (principal <= 0 || fixedRate <= 0) return 0;
    return computeBreakevenSpread(principal, fixedRate, amortizationYears, 5);
  }, [principal, fixedRate, amortizationYears]);

  const toggleTable = (key: string) => {
    setExpandedTables(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const ratesAvailable = fixedRateData?.bestRate != null || variableRateData?.bestRate != null;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Fixed vs Variable Rate Calculator | Realist.ca"
        description="Compare total interest costs for fixed vs variable mortgages over 5, 10, and 25 years with scenario analysis."
      />
      <Navigation />

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-3" data-testid="page-title">
            Fixed vs Variable Rate Calculator
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto" data-testid="page-description">
            Compare total interest costs across scenarios. See how rate paths affect your mortgage over the first term, two terms, and full amortization.
          </p>
          {!ratesAvailable && (
            <Badge variant="outline" className="mt-2 text-amber-600 border-amber-300" data-testid="badge-rates-unavailable">
              Live rates unavailable — enter rates manually below
            </Badge>
          )}
        </div>

        <div className="grid lg:grid-cols-[360px_1fr] gap-6">
          <div className="space-y-4">
            <Card data-testid="card-inputs">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Mortgage Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="purchase-price">Purchase Price</Label>
                  <Input
                    id="purchase-price"
                    type="number"
                    value={purchasePrice}
                    onChange={e => setPurchasePrice(Number(e.target.value))}
                    data-testid="input-purchase-price"
                  />
                </div>
                <div>
                  <Label htmlFor="down-payment">Down Payment (%)</Label>
                  <Input
                    id="down-payment"
                    type="number"
                    min={5}
                    max={95}
                    value={downPaymentPct}
                    onChange={e => setDownPaymentPct(Number(e.target.value))}
                    disabled={!!loanAmountOverride}
                    data-testid="input-down-payment"
                  />
                </div>
                <div>
                  <Label htmlFor="loan-amount">Loan Amount (override)</Label>
                  <Input
                    id="loan-amount"
                    type="number"
                    placeholder={fmt(purchasePrice * (1 - downPaymentPct / 100))}
                    value={loanAmountOverride}
                    onChange={e => setLoanAmountOverride(e.target.value)}
                    data-testid="input-loan-amount"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {loanAmountOverride ? `Using: ${fmt(principal)}` : `Calculated: ${fmt(principal)}`}
                  </p>
                </div>
                <div>
                  <Label htmlFor="amortization">Amortization (years)</Label>
                  <Select value={String(amortizationYears)} onValueChange={v => setAmortizationYears(Number(v))}>
                    <SelectTrigger data-testid="select-amortization">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[5, 10, 15, 20, 25, 30].map(y => (
                        <SelectItem key={y} value={String(y)}>{y} years</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="fixed-term">Fixed Term to Compare</Label>
                  <Select value={fixedTerm} onValueChange={setFixedTerm}>
                    <SelectTrigger data-testid="select-fixed-term">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 5].map(y => (
                        <SelectItem key={y} value={String(y)}>{y}-year fixed</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-rates">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Interest Rates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="fixed-rate">
                    Fixed Rate (%)
                    {fixedRateData?.bestRate && !fixedRateOverride && (
                      <Badge variant="secondary" className="ml-2 text-xs">Auto: {fmtRate(fixedRateData.bestRate)}</Badge>
                    )}
                  </Label>
                  <Input
                    id="fixed-rate"
                    type="number"
                    step="0.01"
                    placeholder={fixedRateData?.bestRate ? String(fixedRateData.bestRate) : "3.64"}
                    value={fixedRateOverride}
                    onChange={e => setFixedRateOverride(e.target.value)}
                    data-testid="input-fixed-rate"
                  />
                </div>
                <div>
                  <Label htmlFor="variable-rate">
                    Variable Rate (%)
                    {variableRateData?.bestRate && !variableRateOverride && (
                      <Badge variant="secondary" className="ml-2 text-xs">Auto: {fmtRate(variableRateData.bestRate)}</Badge>
                    )}
                  </Label>
                  <Input
                    id="variable-rate"
                    type="number"
                    step="0.01"
                    placeholder={variableRateData?.bestRate ? String(variableRateData.bestRate) : "3.34"}
                    value={variableRateOverride}
                    onChange={e => setVariableRateOverride(e.target.value)}
                    data-testid="input-variable-rate"
                  />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-scenarios">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Scenario Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Fixed stays constant for the selected term. Variable moves with the benchmark. Use the sliders to stress-test rate paths.
                </p>
                <div>
                  <Label className="text-sm">Rate Direction</Label>
                  <div className="flex gap-2 mt-1">
                    <Button
                      variant={direction === "rising" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDirection("rising")}
                      className="flex-1 gap-1"
                      data-testid="button-direction-rising"
                    >
                      <TrendingUp className="h-3 w-3" />
                      Rising
                    </Button>
                    <Button
                      variant={direction === "falling" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDirection("falling")}
                      className="flex-1 gap-1"
                      data-testid="button-direction-falling"
                    >
                      <TrendingDown className="h-3 w-3" />
                      Falling
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm">Rate Stress ({severityBps} bps over 5 years)</Label>
                  <Slider
                    min={0}
                    max={300}
                    step={25}
                    value={[severityBps]}
                    onValueChange={([v]) => setSeverityBps(v)}
                    className="mt-2"
                    data-testid="slider-severity"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0 bps</span>
                    <span>300 bps</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm">Rate Change Speed</Label>
                  <Select value={speed} onValueChange={v => setSpeed(v as typeof speed)}>
                    <SelectTrigger data-testid="select-speed">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="front-loaded">Front-loaded</SelectItem>
                      <SelectItem value="even">Evenly distributed</SelectItem>
                      <SelectItem value="back-loaded">Back-loaded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {forecastData?.path && (
                  <div className="p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                    <Info className="h-3 w-3 inline mr-1" />
                    Market base case loaded from 10Y bond yield model
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <SummaryCard
                label="Fixed Monthly Payment"
                value={fmt(results.fixed.y5.monthlyPayment)}
                sub={`at ${fmtRate(fixedRate)}`}
                testId="stat-fixed-payment"
              />
              <SummaryCard
                label="Variable Monthly Payment"
                value={fmt(results.variableBase.y5.monthlyPayment)}
                sub={`at ${fmtRate(variableRate)} (initial)`}
                testId="stat-variable-payment"
              />
              <SummaryCard
                label="5-Year Interest Savings"
                value={fmt(results.fixed.y5.totalInterestPaid - results.variableBase.y5.totalInterestPaid)}
                sub={results.variableBase.y5.totalInterestPaid < results.fixed.y5.totalInterestPaid ? "Variable saves" : "Fixed saves"}
                positive={results.variableBase.y5.totalInterestPaid < results.fixed.y5.totalInterestPaid}
                testId="stat-5y-savings"
              />
              <SummaryCard
                label="Breakeven Variable Rate"
                value={fmtRate(breakeven5)}
                sub="Avg rate to match fixed over 5 yrs"
                testId="stat-breakeven"
              />
            </div>

            <HorizonSection
              title="First 5 Years"
              description="Most Canadians renew within ~5 years. This shows your interest vs principal during the first term."
              horizon="y5"
              results={results}
              expanded={expandedTables["y5"]}
              onToggle={() => toggleTable("y5")}
            />
            <HorizonSection
              title="First 10 Years"
              description="A longer look that captures one renewal cycle. Assumes the fixed rate renews at the same rate."
              horizon="y10"
              results={results}
              expanded={expandedTables["y10"]}
              onToggle={() => toggleTable("y10")}
            />
            {amortizationYears >= 25 && (
              <HorizonSection
                title="Full 25 Years"
                description="Full amortization cost. Variable results depend heavily on the rate path you choose."
                horizon="y25"
                results={results}
                expanded={expandedTables["y25"]}
                onToggle={() => toggleTable("y25")}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function SummaryCard({ label, value, sub, positive, testId }: {
  label: string;
  value: string;
  sub: string;
  positive?: boolean;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={`text-xl font-bold ${positive === true ? "text-green-600" : positive === false ? "text-red-600" : ""}`}>
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function HorizonSection({ title, description, horizon, results, expanded, onToggle }: {
  title: string;
  description: string;
  horizon: "y5" | "y10" | "y25";
  results: ScenarioResults;
  expanded: boolean;
  onToggle: () => void;
}) {
  const fixed = results.fixed[horizon];
  const base = results.variableBase[horizon];
  const best = results.variableBest[horizon];
  const worst = results.variableWorst[horizon];

  const scenarios = [
    { label: "Fixed", data: fixed, color: "text-blue-600 dark:text-blue-400" },
    { label: "Variable (Base)", data: base, color: "text-emerald-600 dark:text-emerald-400" },
    { label: "Variable (Best)", data: best, color: "text-green-600 dark:text-green-400" },
    { label: "Variable (Worst)", data: worst, color: "text-red-600 dark:text-red-400" },
  ];

  const testPrefix = `section-${horizon}`;

  return (
    <Card data-testid={testPrefix}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {scenarios.map(s => (
            <div key={s.label} className="space-y-1 p-3 bg-muted/30 rounded-lg" data-testid={`${testPrefix}-summary-${s.label.toLowerCase().replace(/[^a-z]/g, "-")}`}>
              <p className={`text-xs font-medium ${s.color}`}>{s.label}</p>
              <div className="space-y-0.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Interest</span>
                  <span className="font-medium">{fmt(s.data.totalInterestPaid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Principal</span>
                  <span className="font-medium">{fmt(s.data.totalPrincipalPaid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Balance</span>
                  <span className="font-medium">{fmt(s.data.endingBalance)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center text-sm">
          <div className="flex gap-4">
            <span className="text-muted-foreground">
              Base saves: <strong className={base.totalInterestPaid < fixed.totalInterestPaid ? "text-green-600" : "text-red-600"}>
                {fmt(Math.abs(fixed.totalInterestPaid - base.totalInterestPaid))}
              </strong>
              {base.totalInterestPaid < fixed.totalInterestPaid ? " (variable cheaper)" : " (fixed cheaper)"}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={onToggle} data-testid={`${testPrefix}-toggle-table`}>
            {expanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
            {expanded ? "Hide" : "Show"} yearly breakdown
          </Button>
        </div>

        {expanded && (
          <Tabs defaultValue="fixed" className="mt-2">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="fixed" data-testid={`${testPrefix}-tab-fixed`}>Fixed</TabsTrigger>
              <TabsTrigger value="base" data-testid={`${testPrefix}-tab-base`}>Base</TabsTrigger>
              <TabsTrigger value="best" data-testid={`${testPrefix}-tab-best`}>Best</TabsTrigger>
              <TabsTrigger value="worst" data-testid={`${testPrefix}-tab-worst`}>Worst</TabsTrigger>
            </TabsList>
            {scenarios.map((s, i) => (
              <TabsContent key={s.label} value={["fixed", "base", "best", "worst"][i]} className="mt-2">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Year</TableHead>
                        <TableHead className="text-right">Start Bal.</TableHead>
                        <TableHead className="text-right">Payment</TableHead>
                        <TableHead className="text-right">Interest</TableHead>
                        <TableHead className="text-right">Principal</TableHead>
                        <TableHead className="text-right">End Bal.</TableHead>
                        <TableHead className="text-right w-16">Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {s.data.yearlyRows.map(row => (
                        <TableRow key={row.year}>
                          <TableCell>{row.year}</TableCell>
                          <TableCell className="text-right">{fmt(row.startingBalance)}</TableCell>
                          <TableCell className="text-right">{fmt(row.payment)}</TableCell>
                          <TableCell className="text-right">{fmt(row.interestPaid)}</TableCell>
                          <TableCell className="text-right">{fmt(row.principalPaid)}</TableCell>
                          <TableCell className="text-right">{fmt(row.endingBalance)}</TableCell>
                          <TableCell className="text-right">{fmtRate(row.avgRate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
