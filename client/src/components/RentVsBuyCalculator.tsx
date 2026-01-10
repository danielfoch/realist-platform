import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { 
  Home, 
  DollarSign, 
  TrendingUp, 
  Wallet, 
  Info, 
  Building, 
  Percent,
  Calendar,
  RotateCcw,
  Copy,
  Check
} from "lucide-react";
import { 
  calculateRentVsBuy, 
  formatCurrency, 
  formatPercent,
  defaultRentVsBuyInputs,
  type RentVsBuyInputs,
  type RentVsBuyResults 
} from "@/lib/rentBuyCalculations";
import { useToast } from "@/hooks/use-toast";

function CurrencyInput({
  id,
  label,
  value,
  onChange,
  testId,
  tooltip,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  testId: string;
  tooltip?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="relative">
        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id={id}
          type="number"
          value={value || ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="h-12 pl-9 font-mono"
          data-testid={testId}
        />
      </div>
    </div>
  );
}

function PercentSlider({
  id,
  label,
  value,
  onChange,
  testId,
  min = 0,
  max = 100,
  step = 0.1,
  tooltip,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  testId: string;
  min?: number;
  max?: number;
  step?: number;
  tooltip?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor={id}>{label}</Label>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <span className="text-sm font-mono text-muted-foreground">{value.toFixed(1)}%</span>
      </div>
      <Slider
        id={id}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        min={min}
        max={max}
        step={step}
        className="py-2"
        data-testid={testId}
      />
    </div>
  );
}

function NumberInput({
  id,
  label,
  value,
  onChange,
  testId,
  suffix,
  tooltip,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  testId: string;
  suffix?: string;
  tooltip?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="relative">
        <Input
          id={id}
          type="number"
          value={value || ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="h-12 font-mono"
          data-testid={testId}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function ResultCard({ 
  title, 
  value, 
  subtitle, 
  variant = "default",
  icon: Icon 
}: { 
  title: string; 
  value: string; 
  subtitle?: string;
  variant?: "default" | "success" | "warning" | "info";
  icon?: typeof DollarSign;
}) {
  const variantStyles = {
    default: "bg-card",
    success: "bg-green-500/10 border-green-500/20",
    warning: "bg-yellow-500/10 border-yellow-500/20",
    info: "bg-blue-500/10 border-blue-500/20",
  };

  return (
    <Card className={variantStyles[variant]}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold font-mono">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {Icon && (
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface RentVsBuyCalculatorProps {
  country: "canada" | "usa";
}

export function RentVsBuyCalculator({ country }: RentVsBuyCalculatorProps) {
  const { toast } = useToast();
  const [inputs, setInputs] = useState<RentVsBuyInputs>({
    ...defaultRentVsBuyInputs,
    country,
  });
  const [copied, setCopied] = useState(false);

  const updateInput = <K extends keyof RentVsBuyInputs>(key: K, value: RentVsBuyInputs[K]) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  const results = useMemo<RentVsBuyResults>(() => {
    return calculateRentVsBuy(inputs);
  }, [inputs]);

  const handleReset = () => {
    setInputs({ ...defaultRentVsBuyInputs, country });
    toast({ title: "Reset to defaults" });
  };

  const handleCopyResults = () => {
    const summary = `
Rent vs Buy Analysis Summary
============================
Time Horizon: ${inputs.timeHorizonYears} years

RESULTS
-------
Net Worth if Renting: ${formatCurrency(results.rentNetWorthFinal)}
Net Worth if Buying: ${formatCurrency(results.buyNetWorthFinal)}
Difference: ${formatCurrency(results.netWorthDifference)}
Break-even: ${results.breakEvenMonth ? `Year ${Math.ceil(results.breakEvenMonth / 12)}` : 'No break-even within time horizon'}
Recommendation: ${results.recommendation.toUpperCase()}

RENT SCENARIO
-------------
Total Rent Paid: ${formatCurrency(results.totalRentPaid)}
Starting Investment: ${formatCurrency(inputs.downPayment + inputs.homePurchasePrice * (inputs.closingCostsPercent / 100))}

BUY SCENARIO
------------
Purchase Price: ${formatCurrency(inputs.homePurchasePrice)}
Down Payment: ${formatCurrency(inputs.downPayment)}
Ending Home Value: ${formatCurrency(results.endingHomeValue)}
Ending Mortgage Balance: ${formatCurrency(results.endingMortgageBalance)}
Total Interest Paid: ${formatCurrency(results.totalInterestPaid)}
Total Unrecoverable Costs: ${formatCurrency(results.totalUnrecoverableCosts)}

ASSUMPTIONS
-----------
Mortgage Rate: ${inputs.mortgageInterestRate}%
Investment Return: ${inputs.investmentReturnPercent}%
Home Price Growth: ${inputs.homePriceGrowthPercent}%
Rent Increase: ${inputs.annualRentIncrease}%
    `.trim();

    navigator.clipboard.writeText(summary);
    setCopied(true);
    toast({ title: "Results copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const chartData = results.monthlyData
    .filter((_, i) => i % 12 === 11 || i === 0)
    .map(d => ({
      year: Math.ceil(d.month / 12),
      "Rent Net Worth": Math.round(d.rentNetWorth),
      "Buy Net Worth": Math.round(d.buyNetWorth),
      "Rent Outflow": Math.round(d.rentMonthlyOutflow),
      "Buy Outflow": Math.round(d.buyMonthlyOutflow),
    }));

  return (
    <div className="space-y-8 overflow-x-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                General Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <NumberInput
                id="timeHorizon"
                label="Time Horizon"
                value={inputs.timeHorizonYears}
                onChange={(v) => updateInput("timeHorizonYears", Math.min(30, Math.max(1, v)))}
                testId="input-time-horizon"
                suffix="years"
                tooltip="How long do you plan to live in the home? This affects the comparison."
              />
              <PercentSlider
                id="investmentReturn"
                label="Expected Investment Return"
                value={inputs.investmentReturnPercent}
                onChange={(v) => updateInput("investmentReturnPercent", v)}
                testId="slider-investment-return"
                min={0}
                max={15}
                step={0.5}
                tooltip="The annual return you expect to earn on investments like index funds. We use this to estimate what your money could grow to if you rent instead of buying."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="h-5 w-5" />
                Rent Scenario
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CurrencyInput
                id="monthlyRent"
                label="Current Monthly Rent"
                value={inputs.currentMonthlyRent}
                onChange={(v) => updateInput("currentMonthlyRent", v)}
                testId="input-monthly-rent"
              />
              <PercentSlider
                id="rentIncrease"
                label="Annual Rent Increase"
                value={inputs.annualRentIncrease}
                onChange={(v) => updateInput("annualRentIncrease", v)}
                testId="slider-rent-increase"
                min={0}
                max={10}
                step={0.5}
              />
              <CurrencyInput
                id="rentersInsurance"
                label="Renter's Insurance (Monthly)"
                value={inputs.rentersInsuranceMonthly}
                onChange={(v) => updateInput("rentersInsuranceMonthly", v)}
                testId="input-renters-insurance"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Home className="h-5 w-5" />
                Buy Scenario - Purchase
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CurrencyInput
                id="purchasePrice"
                label="Home Purchase Price"
                value={inputs.homePurchasePrice}
                onChange={(v) => updateInput("homePurchasePrice", v)}
                testId="input-purchase-price"
              />
              <CurrencyInput
                id="downPayment"
                label="Down Payment"
                value={inputs.downPayment}
                onChange={(v) => updateInput("downPayment", Math.min(v, inputs.homePurchasePrice))}
                testId="input-down-payment"
              />
              <div className="p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">
                  Down payment: {((inputs.downPayment / inputs.homePurchasePrice) * 100).toFixed(1)}%
                </span>
              </div>
              <PercentSlider
                id="closingCosts"
                label="Closing Costs"
                value={inputs.closingCostsPercent}
                onChange={(v) => updateInput("closingCostsPercent", v)}
                testId="slider-closing-costs"
                min={0}
                max={5}
                step={0.25}
                tooltip="One-time costs when purchasing (legal fees, land transfer tax, etc.)"
              />
              <PercentSlider
                id="sellingCosts"
                label="Selling Costs (at end)"
                value={inputs.sellingCostsPercent}
                onChange={(v) => updateInput("sellingCostsPercent", v)}
                testId="slider-selling-costs"
                min={0}
                max={10}
                step={0.5}
                tooltip="Costs when selling the home (agent commission, legal fees, etc.)"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Buy Scenario - Financing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PercentSlider
                id="mortgageRate"
                label="Mortgage Interest Rate"
                value={inputs.mortgageInterestRate}
                onChange={(v) => updateInput("mortgageInterestRate", v)}
                testId="slider-mortgage-rate"
                min={0}
                max={15}
                step={0.25}
              />
              <NumberInput
                id="amortization"
                label="Amortization"
                value={inputs.amortizationYears}
                onChange={(v) => updateInput("amortizationYears", Math.min(35, Math.max(5, v)))}
                testId="input-amortization"
                suffix="years"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Percent className="h-5 w-5" />
                Buy Scenario - Ongoing Costs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PercentSlider
                id="propertyTax"
                label="Property Tax (% of home value/year)"
                value={inputs.propertyTaxPercent}
                onChange={(v) => updateInput("propertyTaxPercent", v)}
                testId="slider-property-tax"
                min={0}
                max={3}
                step={0.1}
              />
              <CurrencyInput
                id="homeInsurance"
                label="Home Insurance (Monthly)"
                value={inputs.homeInsuranceMonthly}
                onChange={(v) => updateInput("homeInsuranceMonthly", v)}
                testId="input-home-insurance"
              />
              <PercentSlider
                id="maintenance"
                label="Maintenance (% of home value/year)"
                value={inputs.maintenancePercent}
                onChange={(v) => updateInput("maintenancePercent", v)}
                testId="slider-maintenance"
                min={0}
                max={3}
                step={0.1}
                tooltip="Ongoing upkeep costs: small fixes, servicing, wear and tear."
              />
              <PercentSlider
                id="capex"
                label="CapEx Reserve (% of home value/year)"
                value={inputs.capexReservePercent}
                onChange={(v) => updateInput("capexReservePercent", v)}
                testId="slider-capex"
                min={0}
                max={2}
                step={0.1}
                tooltip="Money you should set aside for big future repairs like roof, windows, HVAC."
              />
              <CurrencyInput
                id="condoFees"
                label="Condo Fees (Monthly)"
                value={inputs.condoFeesMonthly}
                onChange={(v) => updateInput("condoFeesMonthly", v)}
                testId="input-condo-fees"
              />
              <PercentSlider
                id="homeGrowth"
                label="Expected Home Price Growth"
                value={inputs.homePriceGrowthPercent}
                onChange={(v) => updateInput("homePriceGrowthPercent", v)}
                testId="slider-home-growth"
                min={-5}
                max={10}
                step={0.5}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Advanced Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start sm:items-center justify-between gap-4">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <Label htmlFor="investDifference">Invest Monthly Savings</Label>
                  <p className="text-sm text-muted-foreground">
                    If renting is cheaper, invest the difference monthly
                  </p>
                </div>
                <Switch
                  id="investDifference"
                  checked={inputs.investMonthlyDifference}
                  onCheckedChange={(v) => updateInput("investMonthlyDifference", v)}
                  data-testid="switch-invest-difference"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} className="gap-2" data-testid="button-reset">
              <RotateCcw className="h-4 w-4" />
              Reset to Defaults
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <Card className={
            results.recommendation === "buy" ? "border-green-500/50" :
            results.recommendation === "rent" ? "border-blue-500/50" :
            ""
          }>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
                <span>Results After {inputs.timeHorizonYears} Years</span>
                <Badge 
                  variant={results.recommendation === "buy" ? "default" : "secondary"}
                  className="text-sm"
                >
                  {results.recommendation === "buy" ? "Buying is better" :
                   results.recommendation === "rent" ? "Renting is better" :
                   "Too close to call"}
                </Badge>
              </CardTitle>
              <CardDescription>
                {results.breakEvenMonth 
                  ? `Break-even in year ${Math.ceil(results.breakEvenMonth / 12)}`
                  : "No break-even within time horizon"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ResultCard
                  title="Net Worth if Renting"
                  value={formatCurrency(results.rentNetWorthFinal)}
                  icon={Building}
                  variant="info"
                />
                <ResultCard
                  title="Net Worth if Buying"
                  value={formatCurrency(results.buyNetWorthFinal)}
                  icon={Home}
                  variant={results.recommendation === "buy" ? "success" : "default"}
                />
              </div>
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Difference</span>
                  <span className={`text-xl font-bold font-mono ${
                    results.netWorthDifference > 0 ? "text-green-600" : 
                    results.netWorthDifference < 0 ? "text-blue-600" : ""
                  }`}>
                    {results.netWorthDifference > 0 ? "+" : ""}{formatCurrency(results.netWorthDifference)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {results.netWorthDifference > 0 
                    ? "Buying leaves you with more wealth"
                    : results.netWorthDifference < 0
                    ? "Renting leaves you with more wealth"
                    : "Both options are roughly equal"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Net Worth Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="year" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `Yr ${v}`}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <RechartsTooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => `Year ${label}`}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="Rent Net Worth" 
                      stroke="hsl(var(--chart-1))" 
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="Buy Net Worth" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monthly Outflow Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="year" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `Yr ${v}`}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                    />
                    <RechartsTooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => `Year ${label}`}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="Rent Outflow" 
                      stroke="hsl(var(--chart-1))" 
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="Buy Outflow" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="costs">
            <TabsList className="w-full">
              <TabsTrigger value="costs" className="flex-1" data-testid="tab-costs">Cost Breakdown</TabsTrigger>
              <TabsTrigger value="assumptions" className="flex-1" data-testid="tab-assumptions">Assumptions</TabsTrigger>
            </TabsList>
            
            <TabsContent value="costs">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-muted-foreground">Rent Scenario</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Total Rent Paid</span>
                          <span className="font-mono text-sm">{formatCurrency(results.totalRentPaid)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Initial Investment</span>
                          <span className="font-mono text-sm">{formatCurrency(inputs.downPayment + inputs.homePurchasePrice * (inputs.closingCostsPercent / 100))}</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-muted-foreground">Buy Scenario</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Total Interest Paid</span>
                          <span className="font-mono text-sm">{formatCurrency(results.totalInterestPaid)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Total Principal Paid</span>
                          <span className="font-mono text-sm">{formatCurrency(results.totalPrincipalPaid)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Unrecoverable Costs</span>
                          <span className="font-mono text-sm">{formatCurrency(results.totalUnrecoverableCosts)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-sm">Ending Home Value</span>
                          <span className="font-mono text-sm">{formatCurrency(results.endingHomeValue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Ending Mortgage</span>
                          <span className="font-mono text-sm">{formatCurrency(results.endingMortgageBalance)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assumptions">
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Time Horizon</span>
                      <span>{inputs.timeHorizonYears} years</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly Rent</span>
                      <span>{formatCurrency(inputs.currentMonthlyRent)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rent Increase</span>
                      <span>{formatPercent(inputs.annualRentIncrease)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Purchase Price</span>
                      <span>{formatCurrency(inputs.homePurchasePrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Down Payment</span>
                      <span>{formatCurrency(inputs.downPayment)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mortgage Rate</span>
                      <span>{formatPercent(inputs.mortgageInterestRate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Investment Return</span>
                      <span>{formatPercent(inputs.investmentReturnPercent)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Home Growth</span>
                      <span>{formatPercent(inputs.homePriceGrowthPercent)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Button onClick={handleCopyResults} className="w-full gap-2" variant="outline" data-testid="button-copy-results">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy Results Summary"}
          </Button>
        </div>
      </div>
    </div>
  );
}
