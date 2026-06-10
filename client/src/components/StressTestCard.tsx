import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatNumber, type StressTestResults } from "@/lib/calculations";

interface StressTestCardProps {
  stressTest: StressTestResults;
  equity?: number;
}

function getValueColor(val: number, base: number, invertColors = false): string {
  if (Math.abs(val - base) < 0.01) return "text-foreground";
  const isPositive = invertColors ? val < base : val > base;
  return isPositive ? "text-accent" : "text-destructive";
}

function MetricRow({ 
  label, 
  base, 
  bear, 
  bull,
  format = "currency",
  invertColors = false,
}: { 
  label: string; 
  base: number; 
  bear: number; 
  bull: number;
  format?: "currency" | "dscr";
  invertColors?: boolean;
}) {
  const formatValue = (val: number) => {
    switch (format) {
      case "currency": return formatCurrency(val);
      case "dscr": return `${formatNumber(val, 2)}x`;
    }
  };
  
  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-3 text-muted-foreground">{label}</td>
      <td className="py-3 text-right font-mono">{formatValue(base)}</td>
      <td className={`py-3 text-right font-mono ${getValueColor(bear, base, invertColors)}`}>
        {formatValue(bear)}
      </td>
      <td className={`py-3 text-right font-mono ${getValueColor(bull, base, invertColors)}`}>
        {formatValue(bull)}
      </td>
    </tr>
  );
}

export function StressTestCard({ stressTest, equity }: StressTestCardProps) {
  const { base, bear, bull } = stressTest;
  
  return (
    <Card data-testid="stress-test-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Stress Test</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full">
          <thead>
            <tr className="text-sm text-muted-foreground">
              <th className="text-left pb-3 font-normal"></th>
              <th className="text-right pb-3 font-normal">Base</th>
              <th className="text-right pb-3 font-normal">
                <span className="inline-flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-destructive" />
                  Bear
                </span>
              </th>
              <th className="text-right pb-3 font-normal">
                <span className="inline-flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-accent" />
                  Bull
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <MetricRow 
              label="NOI" 
              base={base.annualNoi} 
              bear={bear.annualNoi} 
              bull={bull.annualNoi}
              format="currency"
            />
            <MetricRow 
              label="DSCR" 
              base={base.dscr} 
              bear={bear.dscr} 
              bull={bull.dscr}
              format="dscr"
            />
            <MetricRow 
              label="Cash Flow" 
              base={base.annualCashFlow} 
              bear={bear.annualCashFlow} 
              bull={bull.annualCashFlow}
              format="currency"
            />
            {equity !== undefined && (
              <tr className="border-b border-border/50 last:border-0">
                <td className="py-3 text-muted-foreground">Equity</td>
                <td className="py-3 text-right font-mono">{formatCurrency(equity)}</td>
                <td className="py-3 text-right font-mono">{formatCurrency(equity)}</td>
                <td className="py-3 text-right font-mono">{formatCurrency(equity)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
