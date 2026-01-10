import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency } from "@/lib/calculations";
import type { AnalysisResults } from "@shared/schema";

interface ProformaTableProps {
  results: AnalysisResults;
}

export function ProformaTable({ results }: ProformaTableProps) {
  const [showExpenseDetails, setShowExpenseDetails] = useState(false);
  const projections = results.yearlyProjections;

  return (
    <Card className="mt-6" data-testid="proforma-table">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">10-Year Cash Flow Proforma</CardTitle>
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
