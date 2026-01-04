import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/calculations";
import type { AnalysisResults, BuyHoldInputs } from "@shared/schema";
import { DollarSign, TrendingUp, Wallet, Building } from "lucide-react";

interface ResultsSummaryProps {
  inputs: BuyHoldInputs;
  results: AnalysisResults;
  address: string;
}

function SummaryRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${highlight ? "font-bold text-accent" : ""}`}>{value}</span>
    </div>
  );
}

export function ResultsSummary({ inputs, results, address }: ResultsSummaryProps) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card data-testid="summary-financing">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Financing Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <SummaryRow label="Purchase Price" value={formatCurrency(inputs.purchasePrice)} />
          <SummaryRow label="Down Payment" value={formatCurrency(inputs.purchasePrice * inputs.downPaymentPercent / 100)} />
          <SummaryRow label="Closing Costs" value={formatCurrency(inputs.closingCosts)} />
          <Separator className="my-2" />
          <SummaryRow 
            label="Total Cash Invested" 
            value={formatCurrency(results.totalCashInvested)} 
            highlight 
          />
          <Separator className="my-2" />
          <SummaryRow label="Loan Amount" value={formatCurrency(results.loanAmount)} />
          <SummaryRow label="Interest Rate" value={`${inputs.interestRate}%`} />
          <SummaryRow label="Amortization" value={`${inputs.amortizationYears} years`} />
          <SummaryRow label="Monthly Payment" value={formatCurrency(results.monthlyMortgagePayment)} />
        </CardContent>
      </Card>

      <Card data-testid="summary-income">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Income & Expenses
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <SummaryRow label="Gross Monthly Rent" value={formatCurrency(results.grossMonthlyIncome)} />
          <SummaryRow label="Vacancy Loss" value={`-${formatCurrency(results.grossMonthlyIncome - results.effectiveMonthlyIncome)}`} />
          <SummaryRow label="Effective Income" value={formatCurrency(results.effectiveMonthlyIncome)} />
          <Separator className="my-2" />
          <SummaryRow label="Operating Expenses" value={`-${formatCurrency(results.monthlyExpenses)}`} />
          <SummaryRow label="Monthly NOI" value={formatCurrency(results.monthlyNoi)} highlight />
          <Separator className="my-2" />
          <SummaryRow label="Mortgage Payment" value={`-${formatCurrency(results.monthlyMortgagePayment)}`} />
          <SummaryRow 
            label="Monthly Cash Flow" 
            value={formatCurrency(results.monthlyCashFlow)} 
            highlight 
          />
        </CardContent>
      </Card>

      <Card data-testid="summary-returns">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Annual Returns
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <SummaryRow label="Annual NOI" value={formatCurrency(results.annualNoi)} />
          <SummaryRow label="Annual Cash Flow" value={formatCurrency(results.annualCashFlow)} highlight />
          <Separator className="my-2" />
          <SummaryRow label="Annual Debt Service" value={formatCurrency(results.monthlyMortgagePayment * 12)} />
          <SummaryRow label="DSCR" value={results.dscr.toFixed(2)} />
        </CardContent>
      </Card>

      <Card data-testid="summary-property">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building className="h-5 w-5" />
            Property Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <SummaryRow label="Address" value={address || "Not specified"} />
          <SummaryRow label="Strategy" value="Buy & Hold" />
          <SummaryRow label="Holding Period" value={`${inputs.holdingPeriodYears} years`} />
          <Separator className="my-2" />
          {results.yearlyProjections.length > 0 && (
            <>
              <SummaryRow 
                label={`Year ${inputs.holdingPeriodYears} Property Value`} 
                value={formatCurrency(results.yearlyProjections[results.yearlyProjections.length - 1].propertyValue)} 
              />
              <SummaryRow 
                label={`Year ${inputs.holdingPeriodYears} Equity`} 
                value={formatCurrency(results.yearlyProjections[results.yearlyProjections.length - 1].equity)} 
                highlight
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
