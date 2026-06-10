import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatPercent, formatNumber } from "@/lib/calculations";

interface MetricCardProps {
  label: string;
  value: string;
  description?: string;
  trend?: "positive" | "negative" | "neutral";
  tooltip?: string;
  testId: string;
}

function MetricCard({ label, value, description, trend, tooltip, testId }: MetricCardProps) {
  const getTrendIcon = () => {
    switch (trend) {
      case "positive":
        return <TrendingUp className="h-4 w-4 text-accent" />;
      case "negative":
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case "positive":
        return "text-accent";
      case "negative":
        return "text-destructive";
      default:
        return "text-foreground";
    }
  };

  return (
    <Card className="metric-glow" data-testid={testId}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </span>
              {tooltip && (
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <div className={`text-3xl md:text-4xl font-bold font-mono ${getTrendColor()}`}>
              {value}
            </div>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {trend && getTrendIcon()}
        </div>
      </CardContent>
    </Card>
  );
}

interface MetricCardsProps {
  capRate: number;
  cashOnCash: number;
  dscr: number;
  irr: number | null;
  monthlyCashFlow: number;
}

export function MetricCards({ capRate, cashOnCash, dscr, irr, monthlyCashFlow }: MetricCardsProps) {
  const getCoCTrend = (coc: number): "positive" | "negative" | "neutral" => {
    if (coc >= 8) return "positive";
    if (coc < 0) return "negative";
    return "neutral";
  };

  const getDSCRTrend = (dscr: number): "positive" | "negative" | "neutral" => {
    if (dscr >= 1.25) return "positive";
    if (dscr < 1) return "negative";
    return "neutral";
  };

  const getCashFlowTrend = (cf: number): "positive" | "negative" | "neutral" => {
    if (cf > 0) return "positive";
    if (cf < 0) return "negative";
    return "neutral";
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        label="Cap Rate"
        value={formatPercent(capRate)}
        description="Unlevered yield"
        trend={capRate >= 5 ? "positive" : capRate < 3 ? "negative" : "neutral"}
        tooltip="Net Operating Income divided by Purchase Price. Measures the property's yield before financing."
        testId="metric-cap-rate"
      />
      <MetricCard
        label="Cash-on-Cash"
        value={formatPercent(cashOnCash)}
        description="Return on equity"
        trend={getCoCTrend(cashOnCash)}
        tooltip="Annual pre-tax cash flow divided by total cash invested. Measures your return on the money you put in."
        testId="metric-cash-on-cash"
      />
      <MetricCard
        label="DSCR"
        value={formatNumber(dscr, 2)}
        description={dscr >= 1.25 ? "Strong coverage" : dscr < 1 ? "Negative cash flow" : "Adequate"}
        trend={getDSCRTrend(dscr)}
        tooltip="Debt Service Coverage Ratio. NOI divided by annual debt payments. Lenders typically require 1.2+."
        testId="metric-dscr"
      />
      <MetricCard
        label="IRR"
        value={irr !== null ? formatPercent(irr) : "N/A"}
        description={`Over holding period`}
        trend={irr !== null && irr >= 12 ? "positive" : irr !== null && irr < 8 ? "negative" : "neutral"}
        tooltip="Internal Rate of Return. The annualized total return including cash flow, appreciation, and principal paydown."
        testId="metric-irr"
      />
    </div>
  );
}
