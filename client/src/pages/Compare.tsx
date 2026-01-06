import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/calculations";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SavedDeal, AnalysisResults } from "@shared/schema";
import { Trash2, GitCompare, ArrowLeft, TrendingUp, BarChart3, Table2, LayoutGrid, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";

function getSessionId(): string {
  let sessionId = localStorage.getItem("realist_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("realist_session_id", sessionId);
  }
  return sessionId;
}

const strategyLabels: Record<string, string> = {
  buy_hold: "Buy & Hold",
  flip: "Flip",
  brrr: "BRRR",
  airbnb: "Airbnb",
  multiplex: "Multiplex",
};

type SortKey = "name" | "capRate" | "cashOnCash" | "dscr" | "monthlyCashFlow";
type SortDirection = "asc" | "desc";

const CHART_COLORS = [
  "#FF5A5F",
  "#00A699",
  "#3B82F6",
  "#8B5CF6",
  "#F59E0B",
  "#10B981",
];

function safeNumber(value: unknown): number {
  if (typeof value === "number" && !isNaN(value) && isFinite(value)) {
    return value;
  }
  return 0;
}

function formatMetric(value: unknown, type: "percent" | "ratio" | "currency"): string {
  const num = safeNumber(value);
  if (type === "percent") return `${num.toFixed(1)}%`;
  if (type === "ratio") return num.toFixed(2);
  if (type === "currency") return formatCurrency(num);
  return num.toFixed(2);
}

function getMetricValue(deal: SavedDeal, key: SortKey): number | string {
  if (key === "name") return deal.name;
  const results = deal.resultsJson as AnalysisResults;
  const value = results?.[key];
  return safeNumber(value);
}

function MetricComparison({ 
  label, 
  values, 
  format = "number",
  higherIsBetter = true 
}: { 
  label: string; 
  values: (number | null)[]; 
  format?: "currency" | "percent" | "number" | "ratio";
  higherIsBetter?: boolean;
}) {
  const validValues = values.filter((v): v is number => v !== null && !isNaN(v));
  const best = higherIsBetter ? Math.max(...validValues) : Math.min(...validValues);
  
  const formatValue = (v: number | null) => {
    if (v === null || isNaN(v)) return "N/A";
    switch (format) {
      case "currency": return formatCurrency(v);
      case "percent": return `${v.toFixed(1)}%`;
      case "ratio": return v.toFixed(2);
      default: return v.toFixed(2);
    }
  };

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `minmax(120px, 1fr) repeat(${values.length}, 1fr)` }}>
      <div className="text-sm text-muted-foreground py-2">{label}</div>
      {values.map((v, i) => {
        const isBest = v === best && validValues.length > 1;
        return (
          <div 
            key={i} 
            className={`py-2 px-3 rounded-md text-center font-mono ${
              isBest ? "bg-accent/20 text-accent font-bold" : ""
            }`}
          >
            <span className="flex items-center justify-center gap-1">
              {formatValue(v)}
              {isBest && validValues.length > 1 && (
                <TrendingUp className="h-3 w-3 text-accent" />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SortableHeader({ 
  label, 
  sortKey, 
  currentSort, 
  direction, 
  onSort 
}: { 
  label: string; 
  sortKey: SortKey; 
  currentSort: SortKey; 
  direction: SortDirection; 
  onSort: (key: SortKey) => void;
}) {
  const isActive = currentSort === sortKey;
  
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 text-sm font-medium hover:text-foreground transition-colors"
      data-testid={`sort-${sortKey}`}
    >
      {label}
      {isActive ? (
        direction === "asc" ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )
      ) : (
        <ArrowUpDown className="h-4 w-4 opacity-50" />
      )}
    </button>
  );
}

export default function Compare() {
  const { toast } = useToast();
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("capRate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const { data: deals = [], isLoading } = useQuery<SavedDeal[]>({
    queryKey: ["/api/saved-deals", getSessionId()],
    queryFn: async () => {
      const response = await fetch(`/api/saved-deals?sessionId=${getSessionId()}`);
      if (!response.ok) throw new Error("Failed to fetch deals");
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/saved-deals/${id}`);
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-deals", getSessionId()] });
      setSelectedDeals((prev) => {
        const next = new Set(prev);
        next.delete(deletedId);
        return next;
      });
      toast({ title: "Deal deleted" });
    },
  });

  const selectedDealData = useMemo(() => {
    return deals.filter((d) => selectedDeals.has(d.id));
  }, [deals, selectedDeals]);

  const sortedDeals = useMemo(() => {
    return [...deals].sort((a, b) => {
      const aVal = getMetricValue(a, sortKey);
      const bVal = getMetricValue(b, sortKey);
      
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      
      const aNum = typeof aVal === "number" ? aVal : 0;
      const bNum = typeof bVal === "number" ? bVal : 0;
      
      return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
    });
  }, [deals, sortKey, sortDirection]);

  const chartData = useMemo(() => {
    const dealsToChart = selectedDeals.size > 0 
      ? deals.filter(d => selectedDeals.has(d.id))
      : deals;
    
    return dealsToChart.map((deal, index) => {
      const results = deal.resultsJson as AnalysisResults;
      return {
        name: deal.name.length > 15 ? deal.name.substring(0, 15) + "..." : deal.name,
        fullName: deal.name,
        capRate: safeNumber(results?.capRate),
        cashOnCash: safeNumber(results?.cashOnCash),
        dscr: safeNumber(results?.dscr),
        monthlyCashFlow: safeNumber(results?.monthlyCashFlow),
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
    });
  }, [deals, selectedDeals]);

  const toggleDeal = (id: string) => {
    setSelectedDeals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  const handleCompare = () => {
    if (selectedDeals.size >= 2) {
      setShowComparison(true);
    }
  };

  if (showComparison && selectedDealData.length >= 2) {
    const results = selectedDealData.map((d) => d.resultsJson as AnalysisResults);
    
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 md:px-6 py-12">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="icon" onClick={() => setShowComparison(false)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Deal Comparison</h1>
              <p className="text-muted-foreground">Comparing {selectedDealData.length} properties side-by-side</p>
            </div>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Property Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4" style={{ gridTemplateColumns: `minmax(120px, 1fr) repeat(${selectedDealData.length}, 1fr)` }}>
                <div className="text-sm font-medium">Property</div>
                {selectedDealData.map((d) => (
                  <div key={d.id} className="text-center">
                    <div className="font-semibold text-sm truncate">{d.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{d.address}</div>
                    <Badge variant="secondary" className="mt-1">
                      {strategyLabels[d.strategyType] || d.strategyType}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Key Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <MetricComparison 
                label="Cap Rate" 
                values={results.map((r) => r.capRate)} 
                format="percent"
              />
              <MetricComparison 
                label="Cash on Cash" 
                values={results.map((r) => r.cashOnCash)} 
                format="percent"
              />
              <MetricComparison 
                label="DSCR" 
                values={results.map((r) => r.dscr)} 
                format="ratio"
              />
              <MetricComparison 
                label="IRR" 
                values={results.map((r) => r.irr)} 
                format="percent"
              />
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Cash Flow Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <MetricComparison 
                label="Monthly Cash Flow" 
                values={results.map((r) => r.monthlyCashFlow)} 
                format="currency"
              />
              <MetricComparison 
                label="Annual Cash Flow" 
                values={results.map((r) => r.annualCashFlow)} 
                format="currency"
              />
              <MetricComparison 
                label="Monthly NOI" 
                values={results.map((r) => r.monthlyNoi)} 
                format="currency"
              />
              <MetricComparison 
                label="Annual NOI" 
                values={results.map((r) => r.annualNoi)} 
                format="currency"
              />
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Investment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <MetricComparison 
                label="Total Cash Invested" 
                values={results.map((r) => r.totalCashInvested)} 
                format="currency"
                higherIsBetter={false}
              />
              <MetricComparison 
                label="Loan Amount" 
                values={results.map((r) => r.loanAmount)} 
                format="currency"
                higherIsBetter={false}
              />
              <MetricComparison 
                label="Monthly Mortgage" 
                values={results.map((r) => r.monthlyMortgagePayment)} 
                format="currency"
                higherIsBetter={false}
              />
              <MetricComparison 
                label="Monthly Expenses" 
                values={results.map((r) => r.monthlyExpenses)} 
                format="currency"
                higherIsBetter={false}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Income</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <MetricComparison 
                label="Gross Monthly Income" 
                values={results.map((r) => r.grossMonthlyIncome)} 
                format="currency"
              />
              <MetricComparison 
                label="Effective Monthly Income" 
                values={results.map((r) => r.effectiveMonthlyIncome)} 
                format="currency"
              />
            </CardContent>
          </Card>
        </main>

        <footer className="py-8 border-t border-border/50">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-sm text-muted-foreground">
                2025 Realist.ca. All rights reserved.
              </p>
              <div className="flex gap-4">
                <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-compare-title">Compare Deals</h1>
            <p className="text-muted-foreground">Select two or more properties to compare side-by-side</p>
          </div>
          <div className="flex gap-2">
            <Link href="/">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Analyzer
              </Button>
            </Link>
            <Button 
              onClick={handleCompare} 
              disabled={selectedDeals.size < 2}
              className="gap-2"
              data-testid="button-start-compare"
            >
              <GitCompare className="h-4 w-4" />
              Compare ({selectedDeals.size})
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading saved deals...</div>
        ) : deals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <GitCompare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Saved Deals Yet</h3>
              <p className="text-muted-foreground mb-4">
                Save deals from the analyzer to compare them here
              </p>
              <Link href="/">
                <Button>Go to Deal Analyzer</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="cards" className="space-y-6">
            <TabsList>
              <TabsTrigger value="cards" className="gap-2" data-testid="tab-cards">
                <LayoutGrid className="h-4 w-4" />
                Cards
              </TabsTrigger>
              <TabsTrigger value="table" className="gap-2" data-testid="tab-table">
                <Table2 className="h-4 w-4" />
                Table
              </TabsTrigger>
              <TabsTrigger value="charts" className="gap-2" data-testid="tab-charts">
                <BarChart3 className="h-4 w-4" />
                Charts
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cards">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {deals.map((deal) => {
                  const results = deal.resultsJson as AnalysisResults;
                  const isSelected = selectedDeals.has(deal.id);
                  
                  return (
                    <Card 
                      key={deal.id} 
                      className={`relative cursor-pointer transition-all ${
                        isSelected ? "ring-2 ring-primary" : ""
                      }`}
                      onClick={() => toggleDeal(deal.id)}
                      data-testid={`card-deal-${deal.id}`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <Checkbox 
                              checked={isSelected}
                              onCheckedChange={() => toggleDeal(deal.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="min-w-0">
                              <CardTitle className="text-base truncate">{deal.name}</CardTitle>
                              <p className="text-sm text-muted-foreground truncate">{deal.address}</p>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMutation.mutate(deal.id);
                            }}
                            data-testid={`button-delete-${deal.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                        <Badge variant="secondary" className="w-fit mt-2">
                          {strategyLabels[deal.strategyType] || deal.strategyType}
                        </Badge>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-muted-foreground">Cash Flow</div>
                            <div className={`font-mono font-bold ${safeNumber(results?.monthlyCashFlow) >= 0 ? "text-accent" : "text-destructive"}`}>
                              {formatMetric(results?.monthlyCashFlow, "currency")}/mo
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Cap Rate</div>
                            <div className="font-mono font-bold">{formatMetric(results?.capRate, "percent")}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">CoC Return</div>
                            <div className="font-mono font-bold">{formatMetric(results?.cashOnCash, "percent")}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">DSCR</div>
                            <div className="font-mono font-bold">{formatMetric(results?.dscr, "ratio")}</div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-3">
                          Saved {new Date(deal.createdAt).toLocaleDateString()}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="table">
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50 sticky top-0 z-10">
                        <tr className="border-b">
                          <th className="text-left p-4 w-10">
                            <span className="sr-only">Select</span>
                          </th>
                          <th className="text-left p-4">
                            <SortableHeader
                              label="Deal Name"
                              sortKey="name"
                              currentSort={sortKey}
                              direction={sortDirection}
                              onSort={handleSort}
                            />
                          </th>
                          <th className="text-right p-4">
                            <SortableHeader
                              label="Cap Rate"
                              sortKey="capRate"
                              currentSort={sortKey}
                              direction={sortDirection}
                              onSort={handleSort}
                            />
                          </th>
                          <th className="text-right p-4">
                            <SortableHeader
                              label="Cash on Cash"
                              sortKey="cashOnCash"
                              currentSort={sortKey}
                              direction={sortDirection}
                              onSort={handleSort}
                            />
                          </th>
                          <th className="text-right p-4">
                            <SortableHeader
                              label="DSCR"
                              sortKey="dscr"
                              currentSort={sortKey}
                              direction={sortDirection}
                              onSort={handleSort}
                            />
                          </th>
                          <th className="text-right p-4">
                            <SortableHeader
                              label="Cash Flow"
                              sortKey="monthlyCashFlow"
                              currentSort={sortKey}
                              direction={sortDirection}
                              onSort={handleSort}
                            />
                          </th>
                          <th className="p-4 w-10">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedDeals.map((deal) => {
                          const results = deal.resultsJson as AnalysisResults;
                          const isSelected = selectedDeals.has(deal.id);
                          
                          return (
                            <tr 
                              key={deal.id} 
                              className={`border-b hover-elevate cursor-pointer ${isSelected ? "bg-primary/5" : ""}`}
                              onClick={() => toggleDeal(deal.id)}
                              data-testid={`row-deal-${deal.id}`}
                            >
                              <td className="p-4">
                                <Checkbox 
                                  checked={isSelected}
                                  onCheckedChange={() => toggleDeal(deal.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              <td className="p-4">
                                <div className="font-medium">{deal.name}</div>
                                <div className="text-sm text-muted-foreground truncate max-w-[200px]">{deal.address}</div>
                              </td>
                              <td className="p-4 text-right font-mono">
                                {formatMetric(results?.capRate, "percent")}
                              </td>
                              <td className="p-4 text-right font-mono">
                                {formatMetric(results?.cashOnCash, "percent")}
                              </td>
                              <td className="p-4 text-right font-mono">
                                {formatMetric(results?.dscr, "ratio")}
                              </td>
                              <td className={`p-4 text-right font-mono font-bold ${safeNumber(results?.monthlyCashFlow) >= 0 ? "text-accent" : "text-destructive"}`}>
                                {formatMetric(results?.monthlyCashFlow, "currency")}/mo
                              </td>
                              <td className="p-4">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteMutation.mutate(deal.id);
                                  }}
                                  data-testid={`button-table-delete-${deal.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="charts">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Cap Rate Comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis 
                            type="number" 
                            tickFormatter={(v) => `${v}%`}
                            className="text-muted-foreground"
                          />
                          <YAxis 
                            type="category" 
                            dataKey="name" 
                            width={120}
                            className="text-muted-foreground"
                          />
                          <Tooltip 
                            formatter={(value: number) => [`${value.toFixed(1)}%`, "Cap Rate"]}
                            labelFormatter={(label) => chartData.find(d => d.name === label)?.fullName || label}
                            contentStyle={{ 
                              backgroundColor: "hsl(var(--card))", 
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "var(--radius)"
                            }}
                          />
                          <Bar dataKey="capRate" radius={[0, 4, 4, 0]}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Cash on Cash Return</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis 
                            type="number" 
                            tickFormatter={(v) => `${v}%`}
                            className="text-muted-foreground"
                          />
                          <YAxis 
                            type="category" 
                            dataKey="name" 
                            width={120}
                            className="text-muted-foreground"
                          />
                          <Tooltip 
                            formatter={(value: number) => [`${value.toFixed(1)}%`, "CoC Return"]}
                            labelFormatter={(label) => chartData.find(d => d.name === label)?.fullName || label}
                            contentStyle={{ 
                              backgroundColor: "hsl(var(--card))", 
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "var(--radius)"
                            }}
                          />
                          <Bar dataKey="cashOnCash" radius={[0, 4, 4, 0]}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>DSCR (Debt Service Coverage Ratio)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis 
                            type="number"
                            className="text-muted-foreground"
                          />
                          <YAxis 
                            type="category" 
                            dataKey="name" 
                            width={120}
                            className="text-muted-foreground"
                          />
                          <Tooltip 
                            formatter={(value: number) => [value.toFixed(2), "DSCR"]}
                            labelFormatter={(label) => chartData.find(d => d.name === label)?.fullName || label}
                            contentStyle={{ 
                              backgroundColor: "hsl(var(--card))", 
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "var(--radius)"
                            }}
                          />
                          <Bar dataKey="dscr" radius={[0, 4, 4, 0]}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Monthly Cash Flow</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis 
                            type="number"
                            tickFormatter={(v) => formatCurrency(v)}
                            className="text-muted-foreground"
                          />
                          <YAxis 
                            type="category" 
                            dataKey="name" 
                            width={120}
                            className="text-muted-foreground"
                          />
                          <Tooltip 
                            formatter={(value: number) => [formatCurrency(value), "Cash Flow/mo"]}
                            labelFormatter={(label) => chartData.find(d => d.name === label)?.fullName || label}
                            contentStyle={{ 
                              backgroundColor: "hsl(var(--card))", 
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "var(--radius)"
                            }}
                          />
                          <Bar dataKey="monthlyCashFlow" radius={[0, 4, 4, 0]}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </main>

      <footer className="py-8 border-t border-border/50 mt-auto">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              2025 Realist.ca. All rights reserved.
            </p>
            <div className="flex gap-4">
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
