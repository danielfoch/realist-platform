import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/calculations";
import type { AnalysisResults, BuyHoldInputs } from "@shared/schema";
import { ArrowDown, ArrowUp, Layers } from "lucide-react";

interface SourcesUsesWaterfallProps {
  inputs: BuyHoldInputs;
  results: AnalysisResults;
  strategy?: string;
}

interface WaterfallItem {
  label: string;
  amount: number;
  type: "source" | "use";
  color: string;
}

export function SourcesUsesWaterfall({ inputs, results, strategy = "buy_hold" }: SourcesUsesWaterfallProps) {
  const downPayment = inputs.purchasePrice * inputs.downPaymentPercent / 100;
  const loanAmount = results.loanAmount;
  
  const sources: WaterfallItem[] = [
    { label: "Cash Equity", amount: downPayment + inputs.closingCosts, type: "source", color: "bg-emerald-500" },
    { label: "Senior Debt", amount: loanAmount, type: "source", color: "bg-blue-500" },
  ];

  const uses: WaterfallItem[] = [
    { label: "Purchase Price", amount: inputs.purchasePrice, type: "use", color: "bg-orange-500" },
    { label: "Closing Costs", amount: inputs.closingCosts, type: "use", color: "bg-amber-500" },
  ];

  const totalSources = sources.reduce((sum, s) => sum + s.amount, 0);
  const totalUses = uses.reduce((sum, u) => sum + u.amount, 0);

  const maxAmount = Math.max(totalSources, totalUses);

  const getBarWidth = (amount: number) => {
    if (maxAmount === 0) return 0;
    return (amount / maxAmount) * 100;
  };

  return (
    <Card data-testid="sources-uses-waterfall">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Sources & Uses of Funds
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ArrowDown className="h-4 w-4 text-emerald-500" />
            Sources of Capital
          </div>
          <div className="space-y-3">
            {sources.map((item, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="font-mono font-medium">{formatCurrency(item.amount)}</span>
                </div>
                <div className="h-8 bg-muted rounded-md overflow-hidden">
                  <div
                    className={`h-full ${item.color} transition-all duration-500 ease-out rounded-md flex items-center justify-end pr-3`}
                    style={{ width: `${getBarWidth(item.amount)}%` }}
                  >
                    {getBarWidth(item.amount) > 15 && (
                      <span className="text-xs font-medium text-white">
                        {((item.amount / totalSources) * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="font-medium">Total Sources</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalSources)}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ArrowUp className="h-4 w-4 text-orange-500" />
            Uses of Capital
          </div>
          <div className="space-y-3">
            {uses.map((item, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="font-mono font-medium">{formatCurrency(item.amount)}</span>
                </div>
                <div className="h-8 bg-muted rounded-md overflow-hidden">
                  <div
                    className={`h-full ${item.color} transition-all duration-500 ease-out rounded-md flex items-center justify-end pr-3`}
                    style={{ width: `${getBarWidth(item.amount)}%` }}
                  >
                    {getBarWidth(item.amount) > 15 && (
                      <span className="text-xs font-medium text-white">
                        {((item.amount / totalUses) * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="font-medium">Total Uses</span>
              <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                {formatCurrency(totalUses)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="text-sm font-medium">Capital Stack Breakdown</div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Loan-to-Value (LTV)</span>
                <span className="font-mono font-medium">
                  {((loanAmount / inputs.purchasePrice) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Equity Contribution</span>
                <span className="font-mono font-medium">
                  {((downPayment / inputs.purchasePrice) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Cash Required</span>
                <span className="font-mono font-medium">{formatCurrency(results.totalCashInvested)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Leverage Ratio</span>
                <span className="font-mono font-medium">
                  {downPayment > 0 ? (loanAmount / downPayment).toFixed(2) : "N/A"}x
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
