import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { formatCurrency, calculateBuyHoldAnalysis, STRESS_TEST_CONFIG } from "@/lib/calculations";
import type { AnalysisResults, BuyHoldInputs } from "@shared/schema";

type ScenarioType = "base" | "bear" | "bull";

interface ProformaTableProps {
  results: AnalysisResults;
  inputs?: BuyHoldInputs;
}

const SCENARIO_DESCRIPTIONS: Record<ScenarioType, string> = {
  base: "",
  bear: "Conservative assumptions: -5% rent, +3% vacancy, +5% expenses, +1% interest rate",
  bull: "Optimistic assumptions: +3% rent, -1% vacancy, -2% expenses, -0.5% interest rate",
};

export function ProformaTable({ results, inputs }: ProformaTableProps) {
  const [showExpenseDetails, setShowExpenseDetails] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>("base");

  const scenarioResults = useMemo(() => {
    if (!inputs || selectedScenario === "base") {
      return results;
    }

    const config = selectedScenario === "bear" ? STRESS_TEST_CONFIG.bear : STRESS_TEST_CONFIG.bull;
    
    const adjustedInputs: BuyHoldInputs = {
      ...inputs,
      monthlyRent: inputs.monthlyRent * (1 + config.rentChange),
      vacancyPercent: Math.max(0, Math.min(50, inputs.vacancyPercent + (config.vacancyChange * 100))),
      interestRate: Math.max(0.1, inputs.interestRate + (config.rateChange * 100)),
      propertyTax: inputs.propertyTax * (1 + config.expenseChange),
      insurance: inputs.insurance * (1 + config.expenseChange),
      utilities: inputs.utilities * (1 + config.expenseChange),
      otherExpenses: inputs.otherExpenses * (1 + config.expenseChange),
      maintenancePercent: inputs.maintenancePercent * (1 + config.expenseChange),
      managementPercent: inputs.managementPercent * (1 + config.expenseChange),
      capexReservePercent: inputs.capexReservePercent * (1 + config.expenseChange),
    };

    return calculateBuyHoldAnalysis(adjustedInputs);
  }, [inputs, results, selectedScenario]);

  const projections = scenarioResults.yearlyProjections;

  return (
    <Card className="mt-6" data-testid="proforma-table">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">10-Year Cash Flow Proforma</CardTitle>
          {inputs && (
            <div className="flex gap-1">
              <Button
                variant={selectedScenario === "base" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedScenario("base")}
                className="gap-1"
                data-testid="button-scenario-base"
              >
                <Minus className="h-3 w-3" />
                Base
              </Button>
              <Button
                variant={selectedScenario === "bear" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedScenario("bear")}
                className="gap-1"
                data-testid="button-scenario-bear"
              >
                <TrendingDown className="h-3 w-3" />
                Bear
              </Button>
              <Button
                variant={selectedScenario === "bull" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedScenario("bull")}
                className="gap-1"
                data-testid="button-scenario-bull"
              >
                <TrendingUp className="h-3 w-3" />
                Bull
              </Button>
            </div>
          )}
        </div>
        {selectedScenario !== "base" && (
          <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted/50 rounded-md">
            {SCENARIO_DESCRIPTIONS[selectedScenario]}
          </p>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium sticky left-0 bg-muted/50 min-w-[160px]">Category</th>
                {projections.map((p) => (
                  <th key={p.year} className="text-right p-3 font-medium min-w-[100px]">
                    Year {p.year}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              <tr className="border-b bg-green-50 dark:bg-green-950/30">
                <td className="p-3 font-medium sticky left-0 bg-green-50 dark:bg-green-950/30">Gross Rent</td>
                {projections.map((p) => (
                  <td key={p.year} className="text-right p-3 text-green-700 dark:text-green-400">
                    {formatCurrency(p.grossRent)}
                  </td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="p-3 sticky left-0 bg-background">Less: Vacancy</td>
                {projections.map((p) => (
                  <td key={p.year} className="text-right p-3 text-muted-foreground">
                    ({formatCurrency(p.vacancyLoss)})
                  </td>
                ))}
              </tr>
              <tr className="border-b bg-muted/30">
                <td className="p-3 font-medium sticky left-0 bg-muted/30">Effective Income</td>
                {projections.map((p) => (
                  <td key={p.year} className="text-right p-3 font-medium">
                    {formatCurrency(p.effectiveIncome)}
                  </td>
                ))}
              </tr>

              <tr className="border-b">
                <td className="p-3 sticky left-0 bg-background">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-medium hover:bg-transparent"
                    onClick={() => setShowExpenseDetails(!showExpenseDetails)}
                    data-testid="toggle-expense-details"
                  >
                    {showExpenseDetails ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                    Operating Expenses
                  </Button>
                </td>
                {projections.map((p) => (
                  <td key={p.year} className="text-right p-3 text-red-600 dark:text-red-400">
                    ({formatCurrency(p.expenses.total)})
                  </td>
                ))}
              </tr>

              {showExpenseDetails && (
                <>
                  <tr className="border-b bg-muted/20">
                    <td className="p-3 pl-8 text-muted-foreground sticky left-0 bg-muted/20">Property Tax</td>
                    {projections.map((p) => (
                      <td key={p.year} className="text-right p-3 text-muted-foreground">
                        {formatCurrency(p.expenses.propertyTax)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b bg-muted/20">
                    <td className="p-3 pl-8 text-muted-foreground sticky left-0 bg-muted/20">Insurance</td>
                    {projections.map((p) => (
                      <td key={p.year} className="text-right p-3 text-muted-foreground">
                        {formatCurrency(p.expenses.insurance)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b bg-muted/20">
                    <td className="p-3 pl-8 text-muted-foreground sticky left-0 bg-muted/20">Utilities</td>
                    {projections.map((p) => (
                      <td key={p.year} className="text-right p-3 text-muted-foreground">
                        {formatCurrency(p.expenses.utilities)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b bg-muted/20">
                    <td className="p-3 pl-8 text-muted-foreground sticky left-0 bg-muted/20">Maintenance</td>
                    {projections.map((p) => (
                      <td key={p.year} className="text-right p-3 text-muted-foreground">
                        {formatCurrency(p.expenses.maintenance)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b bg-muted/20">
                    <td className="p-3 pl-8 text-muted-foreground sticky left-0 bg-muted/20">Management</td>
                    {projections.map((p) => (
                      <td key={p.year} className="text-right p-3 text-muted-foreground">
                        {formatCurrency(p.expenses.management)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b bg-muted/20">
                    <td className="p-3 pl-8 text-muted-foreground sticky left-0 bg-muted/20">CapEx Reserve</td>
                    {projections.map((p) => (
                      <td key={p.year} className="text-right p-3 text-muted-foreground">
                        {formatCurrency(p.expenses.capexReserve)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b bg-muted/20">
                    <td className="p-3 pl-8 text-muted-foreground sticky left-0 bg-muted/20">Other</td>
                    {projections.map((p) => (
                      <td key={p.year} className="text-right p-3 text-muted-foreground">
                        {formatCurrency(p.expenses.other)}
                      </td>
                    ))}
                  </tr>
                </>
              )}

              <tr className="border-b bg-blue-50 dark:bg-blue-950/30">
                <td className="p-3 font-medium sticky left-0 bg-blue-50 dark:bg-blue-950/30">Net Operating Income</td>
                {projections.map((p) => (
                  <td key={p.year} className="text-right p-3 font-medium text-blue-700 dark:text-blue-400">
                    {formatCurrency(p.noi)}
                  </td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="p-3 sticky left-0 bg-background">Less: Debt Service</td>
                {projections.map((p) => (
                  <td key={p.year} className="text-right p-3 text-muted-foreground">
                    ({formatCurrency(p.debtService)})
                  </td>
                ))}
              </tr>
              <tr className="border-b bg-primary/10">
                <td className="p-3 font-semibold sticky left-0 bg-primary/10">Cash Flow</td>
                {projections.map((p) => (
                  <td key={p.year} className={`text-right p-3 font-semibold ${p.cashFlow >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(p.cashFlow)}
                  </td>
                ))}
              </tr>

              <tr className="border-t-2">
                <td colSpan={projections.length + 1} className="p-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Equity & Value
                </td>
              </tr>
              <tr className="border-b">
                <td className="p-3 sticky left-0 bg-background">Property Value</td>
                {projections.map((p) => (
                  <td key={p.year} className="text-right p-3">
                    {formatCurrency(p.propertyValue)}
                  </td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="p-3 sticky left-0 bg-background">Loan Balance</td>
                {projections.map((p) => (
                  <td key={p.year} className="text-right p-3 text-muted-foreground">
                    ({formatCurrency(p.loanBalance)})
                  </td>
                ))}
              </tr>
              <tr className="border-b bg-purple-50 dark:bg-purple-950/30">
                <td className="p-3 font-medium sticky left-0 bg-purple-50 dark:bg-purple-950/30">Equity</td>
                {projections.map((p) => (
                  <td key={p.year} className="text-right p-3 font-medium text-purple-700 dark:text-purple-400">
                    {formatCurrency(p.equity)}
                  </td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="p-3 sticky left-0 bg-background">Cumulative Cash Flow</td>
                {projections.map((p) => (
                  <td key={p.year} className={`text-right p-3 ${p.cumulativeCashFlow >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(p.cumulativeCashFlow)}
                  </td>
                ))}
              </tr>
              <tr className="bg-muted/50">
                <td className="p-3 font-semibold sticky left-0 bg-muted/50">Total Return</td>
                {projections.map((p) => (
                  <td key={p.year} className="text-right p-3 font-semibold text-primary">
                    {formatCurrency(p.totalReturn)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
