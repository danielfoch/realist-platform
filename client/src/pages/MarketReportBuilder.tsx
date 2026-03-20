import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3, TrendingUp, TrendingDown, Download, Share2, Save,
  MapPin, Calendar, Search, ArrowUpRight, ArrowDownRight, Minus,
  Loader2, Building2, DollarSign, Home, Shield, FileText, X,
  ChevronRight,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar,
} from "recharts";
import type { Geography, Metric, AreaScore } from "@shared/schema";

const METRIC_OPTIONS = [
  { value: "rent", label: "Average Rent", color: "#10b981", icon: DollarSign },
  { value: "vacancy_rate", label: "Vacancy Rate", color: "#ef4444", icon: Building2 },
  { value: "income", label: "Household Income", color: "#3b82f6", icon: BarChart3 },
  { value: "homeownership_rate", label: "Homeownership Rate", color: "#8b5cf6", icon: Home },
  { value: "crime_rate", label: "Crime Index", color: "#dc2626", icon: Shield },
  { value: "price", label: "Avg. List Price", color: "#f59e0b", icon: DollarSign },
  { value: "investor_score", label: "Investor Score", color: "#059669", icon: TrendingUp },
];

function computeStats(values: number[], dates?: string[]) {
  if (values.length === 0) return null;
  const first = values[0];
  const last = values[values.length - 1];
  const high = Math.max(...values);
  const low = Math.min(...values);
  const pctChange = first !== 0 ? ((last - first) / first) * 100 : 0;
  let years = 1;
  if (dates && dates.length >= 2) {
    const start = new Date(dates[0] + "-01");
    const end = new Date(dates[dates.length - 1] + "-01");
    years = Math.max(0.1, (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  }
  const cagr = first !== 0 && years > 0
    ? (Math.pow(last / first, 1 / years) - 1) * 100
    : 0;
  return { first, last, high, low, pctChange, cagr };
}

function formatMetricValue(value: number, metricType: string): string {
  if (metricType === "vacancy_rate" || metricType === "homeownership_rate") {
    return `${value.toFixed(1)}%`;
  }
  if (metricType === "rent" || metricType === "price" || metricType === "income") {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  if (metricType === "investor_score" || metricType === "crime_rate") {
    return value.toFixed(1);
  }
  return value.toLocaleString();
}

function TrendArrow({ value }: { value: number }) {
  if (value > 1) return <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />;
  if (value < -1) return <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export default function MarketReportBuilder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGeo, setSelectedGeo] = useState<Geography | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["rent", "vacancy_rate"]);
  const [startDate, setStartDate] = useState("2020-01");
  const [endDate, setEndDate] = useState("2026-03");
  const [chartType, setChartType] = useState<"line" | "indexed" | "bar">("line");

  const searchUrl = `/api/geographies?q=${encodeURIComponent(searchQuery)}`;
  const { data: searchResults, isLoading: isSearching } = useQuery<Geography[]>({
    queryKey: [searchUrl],
    enabled: searchQuery.length > 1,
  });

  const metricsUrl = `/api/metrics?geography_id=${selectedGeo?.id || ""}&start=${startDate}&end=${endDate}`;
  const { data: metricsData, isLoading: isLoadingMetrics } = useQuery<Metric[]>({
    queryKey: [metricsUrl],
    enabled: !!selectedGeo,
  });

  const scoresUrl = `/api/area-scores?geography_id=${selectedGeo?.id || ""}&start=${startDate}&end=${endDate}`;
  const { data: areaScoresData } = useQuery<AreaScore[]>({
    queryKey: [scoresUrl],
    enabled: !!selectedGeo,
  });

  const saveReport = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/saved-reports", {
        userId: user?.id,
        title: `${selectedGeo?.name || "Market"} Report`,
        geographyIds: selectedGeo ? [selectedGeo.id] : [],
        metricTypes: selectedMetrics,
        startDate,
        endDate,
        configJson: { chartType },
      });
    },
    onSuccess: () => {
      toast({ title: "Report saved", description: "You can access it from your dashboard." });
    },
  });

  const toggleMetric = (metric: string) => {
    setSelectedMetrics((prev) =>
      prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric]
    );
  };

  const chartData = useMemo(() => {
    if (!metricsData || metricsData.length === 0) return [];
    const dateMap: Record<string, Record<string, number>> = {};
    for (const m of metricsData) {
      if (!selectedMetrics.includes(m.metricType)) continue;
      if (!dateMap[m.date]) dateMap[m.date] = {};
      dateMap[m.date][m.metricType] = m.value;
    }
    return Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date, ...values }));
  }, [metricsData, selectedMetrics]);

  const indexedChartData = useMemo(() => {
    if (chartData.length === 0) return [];
    const baseValues: Record<string, number> = {};
    for (const metric of selectedMetrics) {
      const first = chartData.find((d) => (d as any)[metric] != null);
      if (first) baseValues[metric] = (first as any)[metric];
    }
    return chartData.map((point) => {
      const indexed: any = { date: point.date };
      for (const metric of selectedMetrics) {
        const val = (point as any)[metric];
        if (val != null && baseValues[metric]) {
          indexed[metric] = (val / baseValues[metric]) * 100;
        }
      }
      return indexed;
    });
  }, [chartData, selectedMetrics]);

  const statsPerMetric = useMemo(() => {
    const result: Record<string, ReturnType<typeof computeStats>> = {};
    for (const metric of selectedMetrics) {
      const entries = chartData
        .filter((d) => (d as any)[metric] != null)
        .map((d) => ({ value: (d as any)[metric] as number, date: d.date as string }));
      result[metric] = computeStats(
        entries.map((e) => e.value),
        entries.map((e) => e.date),
      );
    }
    return result;
  }, [chartData, selectedMetrics]);

  const latestScore = areaScoresData?.[areaScoresData.length - 1];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SEO
        title="Market Report Builder"
        description="Generate custom market reports for any Canadian neighbourhood. Compare metrics over time with interactive charts."
        canonicalUrl="/insights/market-report-builder"
      />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="text-report-title">Market Report Builder</h1>
          <p className="text-muted-foreground">
            Select a neighbourhood and metrics to generate a custom market report with time-series analysis.
          </p>
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Geography</CardTitle>
                <CardDescription className="text-xs">Search for a neighbourhood, city, or area</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search areas..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-geography"
                  />
                </div>
                {isSearching && <Skeleton className="h-8 w-full" />}
                {searchResults && searchResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {searchResults.map((geo) => (
                      <button
                        key={geo.id}
                        className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-accent transition-colors ${
                          selectedGeo?.id === geo.id ? "bg-primary/10 font-medium" : ""
                        }`}
                        onClick={() => {
                          setSelectedGeo(geo);
                          setSearchQuery("");
                        }}
                        data-testid={`button-select-geo-${geo.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span>{geo.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground ml-5">
                          {geo.city}{geo.province ? `, ${geo.province}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedGeo && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                    <MapPin className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{selectedGeo.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedGeo.city}, {selectedGeo.province}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelectedGeo(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Date Range</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Start</Label>
                    <Input
                      type="month"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      data-testid="input-start-date"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">End</Label>
                    <Input
                      type="month"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      data-testid="input-end-date"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Metrics</CardTitle>
                <CardDescription className="text-xs">Select metrics to include in your report</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {METRIC_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = selectedMetrics.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isSelected ? "bg-primary/10 border border-primary/20 font-medium" : "hover:bg-accent border border-transparent"
                      }`}
                      onClick={() => toggleMetric(opt.value)}
                      data-testid={`button-metric-${opt.value}`}
                    >
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center"
                        style={{ backgroundColor: opt.color + "20", color: opt.color }}
                      >
                        <Icon className="h-3 w-3" />
                      </div>
                      <span>{opt.label}</span>
                      {isSelected && (
                        <div className="ml-auto w-2 h-2 rounded-full" style={{ backgroundColor: opt.color }} />
                      )}
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {latestScore && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Area Scores</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {latestScore.investorScore != null && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Investor Score</span>
                      <Badge variant={latestScore.investorScore >= 70 ? "default" : "secondary"}>
                        {latestScore.investorScore.toFixed(0)}/100
                      </Badge>
                    </div>
                  )}
                  {latestScore.livabilityScore != null && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Livability</span>
                      <Badge variant="secondary">{latestScore.livabilityScore.toFixed(0)}/100</Badge>
                    </div>
                  )}
                  {latestScore.growthScore != null && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Growth</span>
                      <Badge variant="secondary">{latestScore.growthScore.toFixed(0)}/100</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            {!selectedGeo ? (
              <Card className="p-12">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select a Geography</h3>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    Search for a neighbourhood, city, or census area to start building your market report.
                    You'll be able to compare metrics over time with interactive charts.
                  </p>
                </div>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold" data-testid="text-selected-geo">
                      {selectedGeo.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedGeo.city}, {selectedGeo.province} · {startDate} to {endDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => saveReport.mutate()}
                      disabled={saveReport.isPending}
                      data-testid="button-save-report"
                    >
                      {saveReport.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      <span className="ml-1.5">Save</span>
                    </Button>
                    <Button variant="outline" size="sm" data-testid="button-export-pdf">
                      <Download className="h-4 w-4" />
                      <span className="ml-1.5">Export PDF</span>
                    </Button>
                  </div>
                </div>

                {selectedMetrics.length > 0 && Object.keys(statsPerMetric).length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {selectedMetrics.map((metricKey) => {
                      const stats = statsPerMetric[metricKey];
                      const opt = METRIC_OPTIONS.find((o) => o.value === metricKey);
                      if (!stats || !opt) return null;
                      return (
                        <Card key={metricKey} className="p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div
                              className="w-4 h-4 rounded flex items-center justify-center"
                              style={{ backgroundColor: opt.color + "20", color: opt.color }}
                            >
                              <opt.icon className="h-2.5 w-2.5" />
                            </div>
                            <span className="text-[11px] text-muted-foreground">{opt.label}</span>
                          </div>
                          <p className="text-lg font-bold" data-testid={`stat-latest-${metricKey}`}>
                            {formatMetricValue(stats.last, metricKey)}
                          </p>
                          <div className="flex items-center gap-1 text-xs">
                            <TrendArrow value={stats.pctChange} />
                            <span className={stats.pctChange > 0 ? "text-emerald-500" : stats.pctChange < 0 ? "text-red-500" : "text-muted-foreground"}>
                              {stats.pctChange > 0 ? "+" : ""}{stats.pctChange.toFixed(1)}%
                            </span>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Trend Analysis</CardTitle>
                      <Tabs value={chartType} onValueChange={(v) => setChartType(v as any)}>
                        <TabsList className="h-7">
                          <TabsTrigger value="line" className="text-xs px-2 h-5">Line</TabsTrigger>
                          <TabsTrigger value="indexed" className="text-xs px-2 h-5">Indexed</TabsTrigger>
                          <TabsTrigger value="bar" className="text-xs px-2 h-5">Bar</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoadingMetrics ? (
                      <Skeleton className="h-[300px] w-full" />
                    ) : chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        {chartType === "bar" ? (
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            {selectedMetrics.map((m) => {
                              const opt = METRIC_OPTIONS.find((o) => o.value === m);
                              return (
                                <Bar
                                  key={m}
                                  dataKey={m}
                                  name={opt?.label || m}
                                  fill={opt?.color || "#888"}
                                  opacity={0.8}
                                />
                              );
                            })}
                          </BarChart>
                        ) : (
                          <AreaChart data={chartType === "indexed" ? indexedChartData : chartData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            {selectedMetrics.map((m) => {
                              const opt = METRIC_OPTIONS.find((o) => o.value === m);
                              return (
                                <Area
                                  key={m}
                                  type="monotone"
                                  dataKey={m}
                                  name={opt?.label || m}
                                  stroke={opt?.color || "#888"}
                                  fill={opt?.color || "#888"}
                                  fillOpacity={0.1}
                                  strokeWidth={2}
                                />
                              );
                            })}
                          </AreaChart>
                        )}
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                        No data available for the selected geography and date range.
                        Data will appear here as metrics are ingested.
                      </div>
                    )}
                  </CardContent>
                </Card>

                {Object.keys(statsPerMetric).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Summary Statistics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 text-xs text-muted-foreground font-medium">Metric</th>
                              <th className="text-right py-2 text-xs text-muted-foreground font-medium">Latest</th>
                              <th className="text-right py-2 text-xs text-muted-foreground font-medium">High</th>
                              <th className="text-right py-2 text-xs text-muted-foreground font-medium">Low</th>
                              <th className="text-right py-2 text-xs text-muted-foreground font-medium">% Change</th>
                              <th className="text-right py-2 text-xs text-muted-foreground font-medium">CAGR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedMetrics.map((metricKey) => {
                              const stats = statsPerMetric[metricKey];
                              const opt = METRIC_OPTIONS.find((o) => o.value === metricKey);
                              if (!stats || !opt) return null;
                              return (
                                <tr key={metricKey} className="border-b last:border-0">
                                  <td className="py-2 font-medium flex items-center gap-2">
                                    <div
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: opt.color }}
                                    />
                                    {opt.label}
                                  </td>
                                  <td className="text-right py-2">{formatMetricValue(stats.last, metricKey)}</td>
                                  <td className="text-right py-2">{formatMetricValue(stats.high, metricKey)}</td>
                                  <td className="text-right py-2">{formatMetricValue(stats.low, metricKey)}</td>
                                  <td className={`text-right py-2 ${stats.pctChange > 0 ? "text-emerald-500" : stats.pctChange < 0 ? "text-red-500" : ""}`}>
                                    {stats.pctChange > 0 ? "+" : ""}{stats.pctChange.toFixed(1)}%
                                  </td>
                                  <td className={`text-right py-2 ${stats.cagr > 0 ? "text-emerald-500" : stats.cagr < 0 ? "text-red-500" : ""}`}>
                                    {stats.cagr > 0 ? "+" : ""}{stats.cagr.toFixed(1)}%
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
