import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Info, AlertTriangle, CheckCircle } from "lucide-react";
import { useState } from "react";
import { formatCurrency, formatPercent, formatNumber, type StressTestResults } from "@/lib/calculations";

interface StressTestCardProps {
  stressTest: StressTestResults;
}

function getDSCRStatus(dscr: number): { color: string; icon: typeof CheckCircle; label: string } {
  if (dscr >= 1.25) return { color: "text-accent", icon: CheckCircle, label: "Strong" };
  if (dscr >= 1.1) return { color: "text-accent", icon: CheckCircle, label: "Good" };
  if (dscr >= 1.0) return { color: "text-yellow-500", icon: AlertTriangle, label: "Marginal" };
  return { color: "text-destructive", icon: AlertTriangle, label: "Risk" };
}

function getCashFlowStatus(cf: number): { color: string; icon: typeof TrendingUp } {
  if (cf > 0) return { color: "text-accent", icon: TrendingUp };
  if (cf < 0) return { color: "text-destructive", icon: TrendingDown };
  return { color: "text-muted-foreground", icon: Minus };
}

function ScenarioRow({ 
  scenario, 
  isBase = false 
}: { 
  scenario: StressTestResults["base"]; 
  isBase?: boolean;
}) {
  const dscrStatus = getDSCRStatus(scenario.dscr);
  const cfStatus = getCashFlowStatus(scenario.annualCashFlow);
  const DSCRIcon = dscrStatus.icon;
  const CFIcon = cfStatus.icon;
  
  return (
    <TableRow className={isBase ? "bg-muted/30" : ""}>
      <TableCell className="font-medium">
        <div className="flex flex-col gap-0.5">
          <span className={isBase ? "text-primary font-semibold" : ""}>
            {scenario.label}
          </span>
          <span className="text-xs text-muted-foreground hidden md:inline">
            {scenario.description}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatCurrency(scenario.annualNoi)}
      </TableCell>
      <TableCell className="text-right">
        <div className={`flex items-center justify-end gap-1 font-mono ${cfStatus.color}`}>
          <CFIcon className="h-3 w-3" />
          {formatCurrency(scenario.annualCashFlow)}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className={`flex items-center justify-end gap-1 ${dscrStatus.color}`}>
          <DSCRIcon className="h-3 w-3" />
          <span className="font-mono">{formatNumber(scenario.dscr, 2)}</span>
          <Badge 
            variant={scenario.dscr >= 1.1 ? "default" : scenario.dscr >= 1.0 ? "secondary" : "destructive"}
            className="ml-1 text-xs hidden sm:inline-flex"
          >
            {dscrStatus.label}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatPercent(scenario.cashOnCash)}
      </TableCell>
      <TableCell className="text-right font-mono hidden lg:table-cell">
        {formatPercent(scenario.capRate)}
      </TableCell>
    </TableRow>
  );
}

function SummaryMetric({ 
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
  format?: "currency" | "percent" | "number";
  invertColors?: boolean;
}) {
  const formatValue = (val: number) => {
    switch (format) {
      case "currency": return formatCurrency(val);
      case "percent": return formatPercent(val);
      case "number": return formatNumber(val, 2);
    }
  };
  
  const getColor = (val: number, base: number) => {
    if (val === base) return "text-foreground";
    const isPositive = invertColors ? val < base : val > base;
    return isPositive ? "text-accent" : "text-destructive";
  };
  
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="grid grid-cols-3 gap-2 text-sm font-mono">
        <div className={`${getColor(bear, base)}`}>
          <span className="text-xs text-muted-foreground block">Bear</span>
          {formatValue(bear)}
        </div>
        <div className="text-primary font-semibold">
          <span className="text-xs text-muted-foreground block">Base</span>
          {formatValue(base)}
        </div>
        <div className={`${getColor(bull, base)}`}>
          <span className="text-xs text-muted-foreground block">Bull</span>
          {formatValue(bull)}
        </div>
      </div>
    </div>
  );
}

export function StressTestCard({ stressTest }: StressTestCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { base, bear, bull } = stressTest;
  
  const worstDSCR = Math.min(base.dscr, bear.dscr, bull.dscr);
  const overallStatus = getDSCRStatus(worstDSCR);
  const OverallIcon = overallStatus.icon;
  
  return (
    <Card data-testid="stress-test-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Stress Test Analysis</CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Sensitivity analysis showing how your investment performs under different market conditions (Bear: pessimistic, Base: current, Bull: optimistic).</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Badge 
            variant={worstDSCR >= 1.1 ? "default" : worstDSCR >= 1.0 ? "secondary" : "destructive"}
            className="flex items-center gap-1"
          >
            <OverallIcon className="h-3 w-3" />
            {worstDSCR >= 1.1 ? "All Scenarios Pass" : worstDSCR >= 1.0 ? "Marginal Risk" : "DSCR Warning"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
          <SummaryMetric 
            label="Annual Cash Flow" 
            base={base.annualCashFlow} 
            bear={bear.annualCashFlow} 
            bull={bull.annualCashFlow}
            format="currency"
          />
          <SummaryMetric 
            label="DSCR" 
            base={base.dscr} 
            bear={bear.dscr} 
            bull={bull.dscr}
            format="number"
          />
          <SummaryMetric 
            label="Cash-on-Cash" 
            base={base.cashOnCash} 
            bear={bear.cashOnCash} 
            bull={bull.cashOnCash}
            format="percent"
          />
          <SummaryMetric 
            label="Cap Rate" 
            base={base.capRate} 
            bear={bear.capRate} 
            bull={bull.capRate}
            format="percent"
          />
        </div>
        
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full justify-between"
              data-testid="button-expand-stress-test"
            >
              <span>{isExpanded ? "Hide Full Report" : "View Full Report"}</span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Scenario</TableHead>
                    <TableHead className="text-right">Annual NOI</TableHead>
                    <TableHead className="text-right">Cash Flow</TableHead>
                    <TableHead className="text-right">DSCR</TableHead>
                    <TableHead className="text-right">CoC Return</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">Cap Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <ScenarioRow scenario={bear} />
                  <ScenarioRow scenario={base} isBase />
                  <ScenarioRow scenario={bull} />
                </TableBody>
              </Table>
            </div>
            
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Scenario Assumptions</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">Bear Case:</span>
                  <ul className="mt-1 space-y-0.5">
                    <li>Rent: -5%</li>
                    <li>Vacancy: +3%</li>
                    <li>Expenses: +5%</li>
                    <li>Interest: +100bps</li>
                  </ul>
                </div>
                <div>
                  <span className="font-medium text-foreground">Base Case:</span>
                  <ul className="mt-1 space-y-0.5">
                    <li>Current assumptions</li>
                    <li>No adjustments</li>
                  </ul>
                </div>
                <div>
                  <span className="font-medium text-foreground">Bull Case:</span>
                  <ul className="mt-1 space-y-0.5">
                    <li>Rent: +3%</li>
                    <li>Vacancy: -1%</li>
                    <li>Expenses: -2%</li>
                    <li>Interest: -50bps</li>
                  </ul>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
