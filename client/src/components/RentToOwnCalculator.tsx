import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  computeMonthlyPayment,
  computeFixedAmortization,
} from "@/lib/mortgage/amortization";
import {
  Home,
  KeyRound,
  RotateCcw,
  Copy,
  DollarSign,
  CalendarDays,
  PiggyBank,
} from "lucide-react";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

const DEFAULTS = {
  homePrice: 600000,
  mortgageRate: 5.0,
  amortYears: 25,
  tradDownPct: 5,
  cmhcPct: 4,
  propertyTaxPct: 1.0,
  condoFeeMonthly: 600,
  insUtilMonthly: 250,
  rtoInitialPct: 2.5,
  rtoTargetFinalPct: 10,
  rtoTermYears: 5,
  rtoMonthlyOccupancy: 2800,
  appreciationPct: 0,
  targetOnProjectedValue: false,
};

interface RentToOwnCalculatorProps {
  /** Render without the outer card chrome (e.g. when embedded inside an article shell). */
  embedded?: boolean;
  className?: string;
}

export function RentToOwnCalculator({ embedded = false, className }: RentToOwnCalculatorProps) {
  const { toast } = useToast();

  const [homePrice, setHomePrice] = useState(DEFAULTS.homePrice);
  const [mortgageRate, setMortgageRate] = useState(DEFAULTS.mortgageRate);
  const [amortYears, setAmortYears] = useState(DEFAULTS.amortYears);
  const [tradDownPct, setTradDownPct] = useState(DEFAULTS.tradDownPct);
  const [cmhcPct, setCmhcPct] = useState(DEFAULTS.cmhcPct);
  const [propertyTaxPct, setPropertyTaxPct] = useState(DEFAULTS.propertyTaxPct);
  const [condoFeeMonthly, setCondoFeeMonthly] = useState(DEFAULTS.condoFeeMonthly);
  const [insUtilMonthly, setInsUtilMonthly] = useState(DEFAULTS.insUtilMonthly);

  const [rtoInitialPct, setRtoInitialPct] = useState(DEFAULTS.rtoInitialPct);
  const [rtoTargetFinalPct, setRtoTargetFinalPct] = useState(DEFAULTS.rtoTargetFinalPct);
  const [rtoTermYears, setRtoTermYears] = useState(DEFAULTS.rtoTermYears);
  const [rtoMonthlyOccupancy, setRtoMonthlyOccupancy] = useState(DEFAULTS.rtoMonthlyOccupancy);
  const [rtoEquityOverride, setRtoEquityOverride] = useState<string>("");

  const [appreciationPct, setAppreciationPct] = useState(DEFAULTS.appreciationPct);
  const [targetOnProjectedValue, setTargetOnProjectedValue] = useState(DEFAULTS.targetOnProjectedValue);

  const calc = useMemo(() => {
    const termMonths = Math.max(1, Math.round(rtoTermYears * 12));
    const projectedValue = homePrice * Math.pow(1 + appreciationPct / 100, rtoTermYears);

    // --- Traditional insured purchase ---
    const tradDownDollars = homePrice * (tradDownPct / 100);
    const baseMortgage = homePrice - tradDownDollars;
    const cmhcPremium = baseMortgage * (cmhcPct / 100);
    const totalMortgage = baseMortgage + cmhcPremium;

    const tradMonthlyPayment = computeMonthlyPayment(
      totalMortgage,
      mortgageRate,
      amortYears * 12,
    );
    const propertyTaxMonthly = (homePrice * (propertyTaxPct / 100)) / 12;
    const tradMonthlyCarrying =
      tradMonthlyPayment + condoFeeMonthly + propertyTaxMonthly + insUtilMonthly;

    const tradTermPaymentsTotal = tradMonthlyPayment * termMonths;
    const remainingBalance = computeFixedAmortization(
      { principal: totalMortgage, annualRate: mortgageRate, amortizationYears: amortYears },
      rtoTermYears,
    ).endingBalance;
    const tradOwnerEquity = projectedValue - remainingBalance;
    const tradUpfront = tradDownDollars;
    const tradTermCashOutlay = tradDownDollars + tradMonthlyCarrying * termMonths;

    // --- Rent-to-own pathway ---
    const rtoInitialDollars = homePrice * (rtoInitialPct / 100);
    const targetBaseValue = targetOnProjectedValue ? projectedValue : homePrice;
    const rtoTargetFinalDollars = targetBaseValue * (rtoTargetFinalPct / 100);
    const equityGap = Math.max(0, rtoTargetFinalDollars - rtoInitialDollars);
    const autoMonthlyEquity = equityGap / termMonths;
    const overrideNum = parseFloat(rtoEquityOverride);
    const rtoMonthlyEquity =
      rtoEquityOverride !== "" && Number.isFinite(overrideNum) && overrideNum >= 0
        ? overrideNum
        : autoMonthlyEquity;

    const rtoMonthlyPayment = rtoMonthlyOccupancy + rtoMonthlyEquity;
    const rtoOccupancyTotal = rtoMonthlyOccupancy * termMonths;
    const rtoEquityTotal = rtoMonthlyEquity * termMonths;
    const rtoTermCashOutlay = rtoInitialDollars + rtoOccupancyTotal + rtoEquityTotal;
    const rtoAccumulatedEquity = rtoInitialDollars + rtoEquityTotal;
    const rtoUpfront = rtoInitialDollars;

    return {
      termMonths,
      projectedValue,
      // traditional
      tradDownDollars,
      baseMortgage,
      cmhcPremium,
      totalMortgage,
      tradMonthlyPayment,
      propertyTaxMonthly,
      tradMonthlyCarrying,
      tradTermPaymentsTotal,
      remainingBalance,
      tradOwnerEquity,
      tradUpfront,
      tradTermCashOutlay,
      // rent-to-own
      rtoInitialDollars,
      rtoTargetFinalDollars,
      autoMonthlyEquity,
      rtoMonthlyEquity,
      rtoMonthlyPayment,
      rtoOccupancyTotal,
      rtoEquityTotal,
      rtoTermCashOutlay,
      rtoAccumulatedEquity,
      rtoUpfront,
    };
  }, [
    homePrice,
    mortgageRate,
    amortYears,
    tradDownPct,
    cmhcPct,
    propertyTaxPct,
    condoFeeMonthly,
    insUtilMonthly,
    rtoInitialPct,
    rtoTargetFinalPct,
    rtoTermYears,
    rtoMonthlyOccupancy,
    rtoEquityOverride,
    appreciationPct,
    targetOnProjectedValue,
  ]);

  const handleReset = () => {
    setHomePrice(DEFAULTS.homePrice);
    setMortgageRate(DEFAULTS.mortgageRate);
    setAmortYears(DEFAULTS.amortYears);
    setTradDownPct(DEFAULTS.tradDownPct);
    setCmhcPct(DEFAULTS.cmhcPct);
    setPropertyTaxPct(DEFAULTS.propertyTaxPct);
    setCondoFeeMonthly(DEFAULTS.condoFeeMonthly);
    setInsUtilMonthly(DEFAULTS.insUtilMonthly);
    setRtoInitialPct(DEFAULTS.rtoInitialPct);
    setRtoTargetFinalPct(DEFAULTS.rtoTargetFinalPct);
    setRtoTermYears(DEFAULTS.rtoTermYears);
    setRtoMonthlyOccupancy(DEFAULTS.rtoMonthlyOccupancy);
    setRtoEquityOverride("");
    setAppreciationPct(DEFAULTS.appreciationPct);
    setTargetOnProjectedValue(DEFAULTS.targetOnProjectedValue);
    toast({ title: "Assumptions reset", description: "All inputs restored to defaults." });
  };

  const handleCopy = async () => {
    const years = rtoTermYears;
    const lines = [
      `Buy vs Rent-to-Own — ${years}-year comparison (Realist.ca)`,
      `Home price: ${fmt(homePrice)} · Appreciation: ${appreciationPct.toFixed(1)}%/yr`,
      ``,
      `TRADITIONAL INSURED PURCHASE`,
      `  Upfront cash (down payment ${tradDownPct}%): ${fmt(calc.tradUpfront)}`,
      `  Total mortgage incl. CMHC: ${fmt(calc.totalMortgage)}`,
      `  Monthly carrying cost: ${fmt(calc.tradMonthlyCarrying)}`,
      `  ${years}-yr total cash outlay: ${fmt(calc.tradTermCashOutlay)}`,
      `  Est. equity after ${years} yrs: ${fmt(calc.tradOwnerEquity)}`,
      ``,
      `RENT-TO-OWN PATHWAY`,
      `  Upfront cash (initial ${rtoInitialPct}%): ${fmt(calc.rtoUpfront)}`,
      `  Monthly payment (occupancy + equity): ${fmt(calc.rtoMonthlyPayment)}`,
      `  ${years}-yr total cash outlay: ${fmt(calc.rtoTermCashOutlay)}`,
      `  Est. accumulated equity after ${years} yrs: ${fmt(calc.rtoAccumulatedEquity)}`,
      ``,
      `Illustrative only. Not financial, mortgage, tax, or legal advice.`,
      `Rent-to-own program terms vary materially.`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast({ title: "Scenario copied", description: "Summary copied to your clipboard." });
    } catch {
      toast({
        title: "Copy failed",
        description: "Your browser blocked clipboard access.",
        variant: "destructive",
      });
    }
  };

  const equityWinner =
    calc.tradOwnerEquity >= calc.rtoAccumulatedEquity ? "traditional" : "rent-to-own";
  const upfrontDelta = calc.tradUpfront - calc.rtoUpfront;

  const body = (
    <div className={cn("grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]", className)}>
      {/* ---------------- Inputs ---------------- */}
      <div className="space-y-4">
        <Card data-testid="card-shared-inputs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              The home & market
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CurrencyField
              id="home-price"
              label="Home price"
              value={homePrice}
              onChange={setHomePrice}
              testId="input-home-price"
            />
            <SliderField
              label="Mortgage interest rate"
              value={mortgageRate}
              min={1}
              max={9}
              step={0.05}
              suffix="%"
              decimals={2}
              onChange={setMortgageRate}
              testId="slider-rate"
            />
            <SliderField
              label="Amortization"
              value={amortYears}
              min={5}
              max={30}
              step={5}
              suffix=" yrs"
              decimals={0}
              onChange={setAmortYears}
              testId="slider-amort"
            />
            <SliderField
              label="Expected home appreciation"
              value={appreciationPct}
              min={-3}
              max={8}
              step={0.5}
              suffix="%/yr"
              decimals={1}
              onChange={setAppreciationPct}
              helper={`Projected value in ${rtoTermYears} yrs: ${fmt(calc.projectedValue)}`}
              testId="slider-appreciation"
            />
          </CardContent>
        </Card>

        <Card data-testid="card-trad-inputs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Home className="h-4 w-4" />
              Traditional insured purchase
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SliderField
              label="Down payment"
              value={tradDownPct}
              min={5}
              max={20}
              step={0.5}
              suffix="%"
              decimals={1}
              onChange={setTradDownPct}
              helper={`${fmt(calc.tradDownDollars)} down`}
              testId="slider-trad-down"
            />
            <SliderField
              label="CMHC insurance premium"
              value={cmhcPct}
              min={0}
              max={4.5}
              step={0.1}
              suffix="%"
              decimals={1}
              onChange={setCmhcPct}
              helper={`${fmt(calc.cmhcPremium)} added to mortgage · 4.00% at 5% down, 3.10% at 10%, 2.80% at 15%`}
              testId="slider-cmhc"
            />
            <SliderField
              label="Property tax (annual)"
              value={propertyTaxPct}
              min={0}
              max={2.5}
              step={0.05}
              suffix="%"
              decimals={2}
              onChange={setPropertyTaxPct}
              helper={`${fmt(calc.propertyTaxMonthly)} / month`}
              testId="slider-tax"
            />
            <CurrencyField
              id="condo-fee"
              label="Condo / maintenance fee (monthly)"
              value={condoFeeMonthly}
              onChange={setCondoFeeMonthly}
              testId="input-condo-fee"
            />
            <CurrencyField
              id="ins-util"
              label="Insurance & utilities (monthly)"
              value={insUtilMonthly}
              onChange={setInsUtilMonthly}
              testId="input-ins-util"
            />
          </CardContent>
        </Card>

        <Card data-testid="card-rto-inputs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Rent-to-own pathway
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SliderField
              label="Initial contribution"
              value={rtoInitialPct}
              min={0}
              max={10}
              step={0.5}
              suffix="%"
              decimals={1}
              onChange={setRtoInitialPct}
              helper={`${fmt(calc.rtoInitialDollars)} upfront`}
              testId="slider-rto-initial"
            />
            <SliderField
              label="Target final down payment"
              value={rtoTargetFinalPct}
              min={5}
              max={20}
              step={0.5}
              suffix="%"
              decimals={1}
              onChange={setRtoTargetFinalPct}
              helper={`Goal: ${fmt(calc.rtoTargetFinalDollars)} at buyout`}
              testId="slider-rto-target"
            />
            <SliderField
              label="Rent-to-own term"
              value={rtoTermYears}
              min={2}
              max={7}
              step={1}
              suffix=" yrs"
              decimals={0}
              onChange={setRtoTermYears}
              testId="slider-rto-term"
            />
            <CurrencyField
              id="rto-occupancy"
              label="Monthly occupancy payment"
              value={rtoMonthlyOccupancy}
              onChange={setRtoMonthlyOccupancy}
              helper="The rent portion — does not build equity"
              testId="input-rto-occupancy"
            />
            <div>
              <Label htmlFor="rto-equity" className="text-sm">
                Monthly equity contribution
              </Label>
              <Input
                id="rto-equity"
                type="number"
                inputMode="decimal"
                placeholder={`Auto: ${Math.round(calc.autoMonthlyEquity)}`}
                value={rtoEquityOverride}
                onChange={(e) => setRtoEquityOverride(e.target.value)}
                className="mt-1"
                data-testid="input-rto-equity"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {rtoEquityOverride === ""
                  ? `Auto-calculated as the gap to your target, spread over ${calc.termMonths} months (${fmt(calc.autoMonthlyEquity)}/mo). Leave blank to auto-calculate.`
                  : `Override in effect — using ${fmt(calc.rtoMonthlyEquity)}/mo.`}
              </p>
            </div>
            <div className="flex items-start justify-between gap-3 rounded-md border p-3">
              <div>
                <Label htmlFor="target-projected" className="text-sm">
                  Target based on projected value
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {targetOnProjectedValue
                    ? "Final down payment % applied to the appreciated home value."
                    : "Final down payment % applied to today's price (simplest)."}
                </p>
              </div>
              <Switch
                id="target-projected"
                checked={targetOnProjectedValue}
                onCheckedChange={setTargetOnProjectedValue}
                data-testid="switch-target-projected"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={handleReset}
            data-testid="button-reset"
          >
            <RotateCcw className="h-4 w-4" />
            Reset assumptions
          </Button>
          <Button className="flex-1 gap-2" onClick={handleCopy} data-testid="button-copy">
            <Copy className="h-4 w-4" />
            Copy scenario
          </Button>
        </div>
      </div>

      {/* ---------------- Results ---------------- */}
      <div className="space-y-4">
        <CompareCard
          icon={<DollarSign className="h-4 w-4" />}
          title="Upfront cash required"
          helper="Cash you need on day one to get the keys."
          tradLabel={`${tradDownPct}% down payment`}
          tradValue={fmt(calc.tradUpfront)}
          rtoLabel={`${rtoInitialPct}% initial contribution`}
          rtoValue={fmt(calc.rtoUpfront)}
          testId="result-upfront"
        />
        <CompareCard
          icon={<CalendarDays className="h-4 w-4" />}
          title="Monthly payment"
          helper="What leaves your account each month."
          tradLabel="Carrying cost (mortgage + tax + fees)"
          tradValue={fmt(calc.tradMonthlyCarrying)}
          rtoLabel="Occupancy + equity contribution"
          rtoValue={fmt(calc.rtoMonthlyPayment)}
          testId="result-monthly"
        />
        <CompareCard
          icon={<DollarSign className="h-4 w-4" />}
          title={`${rtoTermYears}-year total cash outlay`}
          helper="Everything you pay over the term, upfront cash included."
          tradLabel="Down payment + carrying costs"
          tradValue={fmt(calc.tradTermCashOutlay)}
          rtoLabel="Initial + occupancy + equity"
          rtoValue={fmt(calc.rtoTermCashOutlay)}
          testId="result-outlay"
        />
        <CompareCard
          icon={<PiggyBank className="h-4 w-4" />}
          title={`Estimated equity after ${rtoTermYears} years`}
          helper="What you'd have to show for it at the end of the term."
          tradLabel="Home value − remaining mortgage"
          tradValue={fmt(calc.tradOwnerEquity)}
          rtoLabel="Initial + accumulated equity credits"
          rtoValue={fmt(calc.rtoAccumulatedEquity)}
          highlight={equityWinner}
          testId="result-equity"
        />

        <Card data-testid="result-tradeoff">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">The tradeoff, in plain English</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Rent-to-own gets you into the home for{" "}
              <strong className="text-foreground">{fmt(Math.abs(upfrontDelta))}</strong>{" "}
              {upfrontDelta > 0 ? "less" : "more"} upfront cash
              {upfrontDelta > 0
                ? " — a far lower barrier to entry than the insured-purchase down payment."
                : "."}{" "}
              You skip the CMHC premium ({fmt(calc.cmhcPremium)}) and qualifying for a{" "}
              {fmt(calc.totalMortgage)} mortgage on day one.
            </p>
            <p>
              The catch shows up in equity. After {rtoTermYears} years the traditional buyer is
              projected to hold{" "}
              <strong className="text-foreground">{fmt(calc.tradOwnerEquity)}</strong> of equity
              (paying down principal{" "}
              {appreciationPct !== 0 ? "plus any appreciation" : "with flat prices"}), while the
              rent-to-own path accumulates{" "}
              <strong className="text-foreground">{fmt(calc.rtoAccumulatedEquity)}</strong> — only
              the credits you deliberately set aside. The occupancy portion (
              {fmt(calc.rtoOccupancyTotal)} over the term) builds none.
            </p>
            <p>
              Net:{" "}
              {equityWinner === "traditional"
                ? "owning outright builds more equity if you can clear the upfront and qualifying hurdles. Rent-to-own trades long-term equity for access today and time to strengthen your file."
                : "on these assumptions the rent-to-own path ends with comparable or greater set-aside equity — but confirm how the program credits and final purchase price actually work before relying on it."}
            </p>
          </CardContent>
        </Card>

        <p
          className="text-xs text-muted-foreground border-t pt-3"
          data-testid="text-disclaimer"
        >
          Illustrative only. Not financial, mortgage, tax, or legal advice. Rent-to-own program
          terms vary materially.
        </p>
      </div>
    </div>
  );

  if (embedded) return body;

  return (
    <Card className={cn("border-0 shadow-none", className)} data-testid="rent-to-own-calculator">
      <CardContent className="p-0">{body}</CardContent>
    </Card>
  );
}

/* ----------------------------- sub-components ----------------------------- */

function CurrencyField({
  id,
  label,
  value,
  onChange,
  helper,
  testId,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  helper?: string;
  testId?: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <div className="relative mt-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          className="pl-6"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          data-testid={testId}
        />
      </div>
      {helper && <p className="text-xs text-muted-foreground mt-1">{helper}</p>}
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  decimals,
  onChange,
  helper,
  testId,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  decimals: number;
  onChange: (n: number) => void;
  helper?: string;
  testId?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="text-sm font-semibold tabular-nums">
          {value.toFixed(decimals)}
          {suffix}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="mt-2"
        data-testid={testId}
      />
      {helper && <p className="text-xs text-muted-foreground mt-1">{helper}</p>}
    </div>
  );
}

function CompareCard({
  icon,
  title,
  helper,
  tradLabel,
  tradValue,
  rtoLabel,
  rtoValue,
  highlight,
  testId,
}: {
  icon: React.ReactNode;
  title: string;
  helper: string;
  tradLabel: string;
  tradValue: string;
  rtoLabel: string;
  rtoValue: string;
  highlight?: "traditional" | "rent-to-own";
  testId?: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{helper}</p>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <div
          className={cn(
            "rounded-lg border p-3",
            highlight === "traditional" && "border-primary/50 bg-primary/5",
          )}
        >
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Home className="h-3.5 w-3.5" />
            Traditional
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums">{tradValue}</p>
          <p className="mt-1 text-xs text-muted-foreground">{tradLabel}</p>
        </div>
        <div
          className={cn(
            "rounded-lg border p-3",
            highlight === "rent-to-own" && "border-primary/50 bg-primary/5",
          )}
        >
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5" />
            Rent-to-own
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums">{rtoValue}</p>
          <p className="mt-1 text-xs text-muted-foreground">{rtoLabel}</p>
        </div>
      </CardContent>
    </Card>
  );
}
