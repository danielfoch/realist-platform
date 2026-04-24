import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { AlertTriangle, TrendingUp, TrendingDown, MapPin, ArrowRight, FileText } from "lucide-react";

const PROVINCE_NAMES: Record<string, string> = {
  ON: "Ontario", BC: "British Columbia", QC: "Quebec", AB: "Alberta",
  MB: "Manitoba", SK: "Saskatchewan", NS: "Nova Scotia", NB: "New Brunswick",
  NL: "Newfoundland and Labrador", PE: "Prince Edward Island",
};

const CHART_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#22c55e", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16"];

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "N/A";
  return Math.round(n).toLocaleString("en-CA");
}

function fmtDollar(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "N/A";
  return "$" + Math.round(n).toLocaleString("en-CA");
}

function getMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  const date = new Date(parseInt(y), parseInt(m) - 1, 1);
  return date.toLocaleDateString("en-CA", { month: "long", year: "numeric" });
}

function getDistressReportSlug(month: string): string {
  const [year, monthNum] = month.split("-");
  const monthName = new Date(parseInt(year), parseInt(monthNum) - 1, 1)
    .toLocaleDateString("en-CA", { month: "long" })
    .toLowerCase();
  return `/insights/blog/canada-distress-deals-report-${monthName}-${year}`;
}

function getDelta(curr: number, prev: number): number | null {
  if (!prev) return null;
  return ((curr - prev) / prev) * 100;
}

interface Snapshot {
  id: number;
  month: string;
  province: string;
  city: string | null;
  totalListings: number;
  foreclosurePosCount: number;
  motivatedCount: number;
  vtbCount: number;
  avgDistressScore: number | null;
  maxDistressScore: number | null;
  avgListPrice: number | null;
  medianListPrice: number | null;
  highConfidenceCount: number;
  mediumConfidenceCount: number;
  lowConfidenceCount: number;
  avgDaysOnMarket: number | null;
  propertyTypesJson: Record<string, number> | null;
  topCitiesJson: Array<{ name: string; count: number }> | null;
}

interface TrendPoint {
  month: string;
  label: string;
  totalListings: number;
  foreclosurePosCount: number;
  motivatedCount: number;
  vtbCount: number;
  avgDistressScore: number | null;
  avgListPrice: number | null;
  medianListPrice: number | null;
  highConfidenceCount: number;
  mediumConfidenceCount: number;
  lowConfidenceCount: number;
  avgDaysOnMarket: number | null;
}

interface InventoryRow {
  province: string | null;
  city?: string | null;
  totalListings: number;
}

export default function DistressReport() {
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [trendProvince, setTrendProvince] = useState<string>("national");
  const [trendCity, setTrendCity] = useState<string>("all");

  const { data: months = [], isLoading: monthsLoading } = useQuery<string[]>({
    queryKey: ["/api/distress-snapshots/months"],
  });

  const activeMonth = selectedMonth || (months.length > 0 ? months[0] : "");

  const { data: snapshots = [], isLoading: snapshotsLoading, isError: snapshotsError } = useQuery<Snapshot[]>({
    queryKey: ["/api/distress-snapshots", activeMonth],
    queryFn: async () => {
      if (!activeMonth) return [];
      const res = await fetch(`/api/distress-snapshots?month=${activeMonth}`);
      if (!res.ok) throw new Error("Failed to fetch snapshots");
      return res.json();
    },
    enabled: !!activeMonth,
  });

  const { data: allSnapshots = [] } = useQuery<Snapshot[]>({
    queryKey: ["/api/distress-snapshots", "history"],
    queryFn: async () => {
      const res = await fetch("/api/distress-snapshots");
      if (!res.ok) throw new Error("Failed to fetch historical snapshots");
      return res.json();
    },
  });

  const { data: provinceInventory = [] } = useQuery<InventoryRow[]>({
    queryKey: ["/api/distress-inventory", activeMonth, "province"],
    queryFn: async () => {
      if (!activeMonth) return [];
      const res = await fetch(`/api/distress-inventory?month=${activeMonth}&groupBy=province`);
      if (!res.ok) throw new Error("Failed to fetch province inventory");
      return res.json();
    },
    enabled: !!activeMonth,
  });

  const { data: cityInventory = [] } = useQuery<InventoryRow[]>({
    queryKey: ["/api/distress-inventory", activeMonth, "city"],
    queryFn: async () => {
      if (!activeMonth) return [];
      const res = await fetch(`/api/distress-inventory?month=${activeMonth}&groupBy=city`);
      if (!res.ok) throw new Error("Failed to fetch city inventory");
      return res.json();
    },
    enabled: !!activeMonth,
  });

  const provinceSnapshots = snapshots.filter(s => !s.city);
  const citySnapshots = snapshots.filter(s => !!s.city);
  const historicalProvinceSnapshots = allSnapshots.filter(s => !s.city);
  const historicalCitySnapshots = allSnapshots.filter(s => !!s.city);

  const buildTrendPoint = (month: string, rows: Snapshot[]): TrendPoint => {
    const totalListings = rows.reduce((sum, row) => sum + row.totalListings, 0);
    const weightedAverage = (pick: (row: Snapshot) => number | null | undefined, weightPick?: (row: Snapshot) => number) => {
      const weightedRows = rows.filter((row) => pick(row) != null && (weightPick ? weightPick(row) > 0 : row.totalListings > 0));
      if (!weightedRows.length) return null;
      const totalWeight = weightedRows.reduce((sum, row) => sum + (weightPick ? weightPick(row) : row.totalListings), 0);
      if (!totalWeight) return null;
      return weightedRows.reduce((sum, row) => {
        const weight = weightPick ? weightPick(row) : row.totalListings;
        return sum + (pick(row) || 0) * weight;
      }, 0) / totalWeight;
    };

    return {
      month,
      label: getMonthLabel(month),
      totalListings,
      foreclosurePosCount: rows.reduce((sum, row) => sum + row.foreclosurePosCount, 0),
      motivatedCount: rows.reduce((sum, row) => sum + row.motivatedCount, 0),
      vtbCount: rows.reduce((sum, row) => sum + row.vtbCount, 0),
      avgDistressScore: weightedAverage((row) => row.avgDistressScore),
      avgListPrice: weightedAverage((row) => row.avgListPrice),
      medianListPrice: weightedAverage((row) => row.medianListPrice),
      highConfidenceCount: rows.reduce((sum, row) => sum + row.highConfidenceCount, 0),
      mediumConfidenceCount: rows.reduce((sum, row) => sum + row.mediumConfidenceCount, 0),
      lowConfidenceCount: rows.reduce((sum, row) => sum + row.lowConfidenceCount, 0),
      avgDaysOnMarket: weightedAverage((row) => row.avgDaysOnMarket),
    };
  };

  const nationalHistory = useMemo(() => {
    const rowsByMonth = historicalProvinceSnapshots.reduce<Record<string, Snapshot[]>>((acc, row) => {
      if (!acc[row.month]) acc[row.month] = [];
      acc[row.month].push(row);
      return acc;
    }, {});

    return Object.entries(rowsByMonth)
      .map(([month, rows]) => buildTrendPoint(month, rows))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [historicalProvinceSnapshots]);

  const provinceHistory = useMemo(() => {
    if (trendProvince === "national") return nationalHistory;
    return historicalProvinceSnapshots
      .filter((row) => row.province === trendProvince)
      .map((row) => ({
        month: row.month,
        label: getMonthLabel(row.month),
        totalListings: row.totalListings,
        foreclosurePosCount: row.foreclosurePosCount,
        motivatedCount: row.motivatedCount,
        vtbCount: row.vtbCount,
        avgDistressScore: row.avgDistressScore,
        avgListPrice: row.avgListPrice,
        medianListPrice: row.medianListPrice,
        highConfidenceCount: row.highConfidenceCount,
        mediumConfidenceCount: row.mediumConfidenceCount,
        lowConfidenceCount: row.lowConfidenceCount,
        avgDaysOnMarket: row.avgDaysOnMarket,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [historicalProvinceSnapshots, nationalHistory, trendProvince]);

  const cityOptions = useMemo(() => {
    if (trendProvince === "national") return [];
    return Array.from(new Set(
      historicalCitySnapshots
        .filter((row) => row.province === trendProvince && row.city)
        .map((row) => row.city as string)
    )).sort((a, b) => a.localeCompare(b));
  }, [historicalCitySnapshots, trendProvince]);

  useEffect(() => {
    if (trendProvince === "national" || trendCity === "all" || cityOptions.includes(trendCity)) return;
    setTrendCity("all");
  }, [trendProvince, trendCity, cityOptions]);

  const selectedTrendHistory = useMemo(() => {
    if (trendProvince === "national") return nationalHistory;
    if (trendCity !== "all") {
      return historicalCitySnapshots
        .filter((row) => row.province === trendProvince && row.city === trendCity)
        .map((row) => ({
          month: row.month,
          label: getMonthLabel(row.month),
          totalListings: row.totalListings,
          foreclosurePosCount: row.foreclosurePosCount,
          motivatedCount: row.motivatedCount,
          vtbCount: row.vtbCount,
          avgDistressScore: row.avgDistressScore,
          avgListPrice: row.avgListPrice,
          medianListPrice: row.medianListPrice,
          highConfidenceCount: row.highConfidenceCount,
          mediumConfidenceCount: row.mediumConfidenceCount,
          lowConfidenceCount: row.lowConfidenceCount,
          avgDaysOnMarket: row.avgDaysOnMarket,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));
    }
    return provinceHistory;
  }, [historicalCitySnapshots, nationalHistory, provinceHistory, trendCity, trendProvince]);

  const trendProvinceOptions = useMemo(() => {
    const provinces = Array.from(new Set(historicalProvinceSnapshots.map((row) => row.province))).sort();
    return provinces;
  }, [historicalProvinceSnapshots]);

  const totalListings = provinceSnapshots.reduce((s, p) => s + p.totalListings, 0);
  const totalForeclosure = provinceSnapshots.reduce((s, p) => s + p.foreclosurePosCount, 0);
  const totalMotivated = provinceSnapshots.reduce((s, p) => s + p.motivatedCount, 0);
  const totalVtb = provinceSnapshots.reduce((s, p) => s + p.vtbCount, 0);
  const totalHigh = provinceSnapshots.reduce((s, p) => s + p.highConfidenceCount, 0);

  const provinceInventoryMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of provinceInventory) {
      if (row.province) map.set(row.province, row.totalListings);
    }
    return map;
  }, [provinceInventory]);

  const cityInventoryMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of cityInventory) {
      if (row.province && row.city) map.set(`${row.province}::${row.city}`, row.totalListings);
    }
    return map;
  }, [cityInventory]);

  const provinceChartData = provinceSnapshots
    .map(p => ({
      province: p.province,
      name: PROVINCE_NAMES[p.province] || p.province,
      foreclosure: p.foreclosurePosCount,
      motivated: p.motivatedCount,
      vtb: p.vtbCount,
      total: p.totalListings,
      activeInventory: provinceInventoryMap.get(p.province) || 0,
      distressRate: provinceInventoryMap.get(p.province)
        ? (p.totalListings / (provinceInventoryMap.get(p.province) || 1)) * 100
        : 0,
      distressRateBps: provinceInventoryMap.get(p.province)
        ? (p.totalListings / (provinceInventoryMap.get(p.province) || 1)) * 10000
        : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const categoryPieData = [
    { name: "Foreclosure/POS", value: totalForeclosure, color: "#ef4444" },
    { name: "Motivated Seller", value: totalMotivated, color: "#f59e0b" },
    { name: "VTB", value: totalVtb, color: "#3b82f6" },
  ].filter(d => d.value > 0);

  const confidencePieData = [
    { name: "High", value: totalHigh, color: "#ef4444" },
    { name: "Medium", value: provinceSnapshots.reduce((s, p) => s + p.mediumConfidenceCount, 0), color: "#f59e0b" },
    { name: "Low", value: provinceSnapshots.reduce((s, p) => s + p.lowConfidenceCount, 0), color: "#6b7280" },
  ].filter(d => d.value > 0);

  const topCitiesCanada = citySnapshots
    .map((row) => {
      const inventory = cityInventoryMap.get(`${row.province}::${row.city}`) || 0;
      return {
        province: row.province,
        city: row.city || "Unknown",
        distressListings: row.totalListings,
        activeInventory: inventory,
        distressRate: inventory ? (row.totalListings / inventory) * 100 : 0,
      };
    })
    .sort((a, b) => b.distressListings - a.distressListings)
    .slice(0, 20);
  const currentHistoryPoint = nationalHistory.find((point) => point.month === activeMonth);
  const previousHistoryPoint = currentHistoryPoint
    ? nationalHistory[nationalHistory.findIndex((point) => point.month === currentHistoryPoint.month) - 1]
    : undefined;

  const listingDelta = getDelta(currentHistoryPoint?.totalListings || 0, previousHistoryPoint?.totalListings || 0);
  const foreclosureDelta = getDelta(currentHistoryPoint?.foreclosurePosCount || 0, previousHistoryPoint?.foreclosurePosCount || 0);
  const motivatedDelta = getDelta(currentHistoryPoint?.motivatedCount || 0, previousHistoryPoint?.motivatedCount || 0);
  const vtbDelta = getDelta(currentHistoryPoint?.vtbCount || 0, previousHistoryPoint?.vtbCount || 0);

  const categoryTrendData = selectedTrendHistory.map((point) => ({
    label: point.label,
    totalListings: point.totalListings,
    foreclosurePosCount: point.foreclosurePosCount,
    motivatedCount: point.motivatedCount,
    vtbCount: point.vtbCount,
    highConfidenceShare: point.totalListings ? Number(((point.highConfidenceCount / point.totalListings) * 100).toFixed(1)) : 0,
    avgDistressScore: point.avgDistressScore != null ? Number(point.avgDistressScore.toFixed(1)) : null,
  }));

  const activeTrendLabel = trendProvince === "national"
    ? "Canada"
    : trendCity !== "all"
      ? `${trendCity}, ${PROVINCE_NAMES[trendProvince] || trendProvince}`
      : PROVINCE_NAMES[trendProvince] || trendProvince;

  const isLoading = monthsLoading || snapshotsLoading;
  const hasData = provinceSnapshots.length > 0;

  return (
    <div className="min-h-screen bg-background" data-testid="distress-report-page">
      <SEO
        title={activeMonth ? `Distress Deals Report — ${getMonthLabel(activeMonth)} | Realist.ca` : "Distress Deals Report | Realist.ca"}
        description="Monthly Canadian distress deals report: foreclosures, power of sale, motivated sellers, and VTB opportunities across all provinces."
      />
      <Navigation />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="report-title">
              <AlertTriangle className="inline-block w-8 h-8 mr-2 text-red-500" />
              Canadian Motivated Sellers Report
            </h1>
            <p className="text-muted-foreground mt-1">
              Monthly snapshot of foreclosures, power of sale, motivated sellers, and VTB opportunities across Canada
            </p>
          </div>
          <div className="flex gap-3 items-center">
            {months.length > 0 && (
              <Select value={activeMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[200px]" data-testid="month-selector">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m} value={m}>{getMonthLabel(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Link href="/tools/distress-deals">
              <Button variant="outline" data-testid="browse-deals-btn">
                Browse Deals <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {isLoading && (
          <div className="grid gap-4 md:grid-cols-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20" /></CardContent></Card>
            ))}
          </div>
        )}

        {snapshotsError && (
          <Card className="text-center py-16 border-destructive">
            <CardContent>
              <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
              <h2 className="text-xl font-semibold mb-2">Failed to Load Report Data</h2>
              <p className="text-muted-foreground mb-6">
                There was an error fetching the distress report data. Please try again later.
              </p>
              <Link href="/tools/distress-deals">
                <Button variant="outline" data-testid="browse-deals-error">Browse Live Distress Deals</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {!isLoading && !snapshotsError && !hasData && (
          <Card className="text-center py-16">
            <CardContent>
              <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Report Data Available</h2>
              <p className="text-muted-foreground mb-6">
                Distress report snapshots haven't been generated yet. Reports are auto-generated on the 2nd of each month.
              </p>
              <Link href="/tools/distress-deals">
                <Button data-testid="browse-deals-empty">Browse Live Distress Deals</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {!isLoading && hasData && (
          <>
            <div className="grid gap-4 md:grid-cols-4 mb-8" data-testid="summary-cards">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Flagged Listings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold" data-testid="stat-total">{fmt(totalListings)}</div>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                    Across {provinceSnapshots.length} provinces
                    {listingDelta != null && (
                      <span className={listingDelta >= 0 ? "text-red-500" : "text-green-600"}>
                        {listingDelta >= 0 ? <TrendingUp className="inline-block h-3.5 w-3.5 mr-0.5" /> : <TrendingDown className="inline-block h-3.5 w-3.5 mr-0.5" />}
                        {Math.abs(listingDelta).toFixed(1)}% m/m
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Foreclosure / POS</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-500" data-testid="stat-foreclosure">{fmt(totalForeclosure)}</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {totalListings ? (totalForeclosure / totalListings * 100).toFixed(1) : 0}% of total
                    {foreclosureDelta != null && (
                      <span className={`ml-2 ${foreclosureDelta >= 0 ? "text-red-500" : "text-green-600"}`}>
                        {foreclosureDelta >= 0 ? "↑" : "↓"} {Math.abs(foreclosureDelta).toFixed(1)}%
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Motivated Seller</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-amber-500" data-testid="stat-motivated">{fmt(totalMotivated)}</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {totalListings ? (totalMotivated / totalListings * 100).toFixed(1) : 0}% of total
                    {motivatedDelta != null && (
                      <span className={`ml-2 ${motivatedDelta >= 0 ? "text-red-500" : "text-green-600"}`}>
                        {motivatedDelta >= 0 ? "↑" : "↓"} {Math.abs(motivatedDelta).toFixed(1)}%
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">VTB Opportunities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-500" data-testid="stat-vtb">{fmt(totalVtb)}</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {totalListings ? (totalVtb / totalListings * 100).toFixed(1) : 0}% of total
                    {vtbDelta != null && (
                      <span className={`ml-2 ${vtbDelta >= 0 ? "text-red-500" : "text-green-600"}`}>
                        {vtbDelta >= 0 ? "↑" : "↓"} {Math.abs(vtbDelta).toFixed(1)}%
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 mb-8">
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle className="text-lg">Distress Deals by Province</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Total flagged distress listings by province.
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px]" data-testid="province-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={provinceChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="province" width={30} />
                        <Tooltip
                          formatter={(value: number, name: string) => {
                            return [fmt(value), name];
                          }}
                          labelFormatter={(label: string) => PROVINCE_NAMES[label] || label}
                        />
                        <Legend />
                        <>
                          <Bar dataKey="foreclosure" name="Foreclosure/POS" fill="#ef4444" stackId="a" />
                          <Bar dataKey="motivated" name="Motivated" fill="#f59e0b" stackId="a" />
                          <Bar dataKey="vtb" name="VTB" fill="#3b82f6" stackId="a" />
                        </>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Category Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-[300px]" data-testid="category-pie">
                      <p className="text-sm text-muted-foreground text-center mb-2">By Type</p>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={categoryPieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                            {categoryPieData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => fmt(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="h-[300px]" data-testid="confidence-pie">
                      <p className="text-sm text-muted-foreground text-center mb-2">By Confidence</p>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={confidencePieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                            {confidencePieData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => fmt(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mb-8">
              <CardHeader>
                <div>
                  <CardTitle className="text-lg">
                    <MapPin className="inline-block w-5 h-5 mr-2" />
                    Top Cities in Canada
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ranked by total distress listing volume.
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[380px]" data-testid="cities-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topCitiesCanada.slice(0, 15)} margin={{ left: 20, right: 20, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="city"
                        angle={-45}
                        textAnchor="end"
                        interval={0}
                        height={90}
                      />
                      <YAxis />
                      <Tooltip
                        formatter={(value: number, _name: string, item: any) => {
                          return [
                            fmt(value),
                            `${item?.payload?.province ? `${item.payload.city}, ${item.payload.province}` : "Distress listings"}`,
                          ];
                        }}
                        labelFormatter={(label: string, payload: any[]) => {
                          const row = payload?.[0]?.payload;
                          return row ? `${label}, ${row.province}` : label;
                        }}
                      />
                      <Bar
                        dataKey="distressListings"
                        name="Distress Listings"
                        fill="#ef4444"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {selectedTrendHistory.length > 0 && (
              <div className="grid gap-6 md:grid-cols-2 mb-8">
                <Card>
                  <CardHeader className="space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <CardTitle className="text-lg">Historical Distress Trend</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Saved monthly distress trends for Canada, provinces, and captured cities.
                        </p>
                      </div>
                      <Badge variant="secondary">{selectedTrendHistory.length} months tracked</Badge>
                    </div>
                    <div className="flex flex-col gap-3 md:flex-row">
                      <Select value={trendProvince} onValueChange={setTrendProvince}>
                        <SelectTrigger className="w-full md:w-[220px]" data-testid="trend-province-selector">
                          <SelectValue placeholder="Scope" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="national">Canada</SelectItem>
                          {trendProvinceOptions.map((province) => (
                            <SelectItem key={province} value={province}>
                              {PROVINCE_NAMES[province] || province}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {trendProvince !== "national" && cityOptions.length > 0 && (
                        <Select value={trendCity} onValueChange={setTrendCity}>
                          <SelectTrigger className="w-full md:w-[240px]" data-testid="trend-city-selector">
                            <SelectValue placeholder="All cities in province" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Province total</SelectItem>
                            {cityOptions.map((city) => (
                              <SelectItem key={city} value={city}>{city}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">{activeTrendLabel}</p>
                    <div className="h-[320px]" data-testid="history-total-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={selectedTrendHistory} margin={{ left: 12, right: 12 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" minTickGap={24} />
                          <YAxis />
                          <Tooltip
                            formatter={(value: number, name: string) => [fmt(value), name]}
                            labelFormatter={(label: string) => label}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="totalListings" name="Total flagged" stroke="#111827" strokeWidth={2.5} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="highConfidenceCount" name="High confidence" stroke="#ef4444" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="vtbCount" name="VTB" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Historical Signal Mix</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Category counts, average distress score, and high-confidence share over time.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[320px]" data-testid="history-signal-mix-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={categoryTrendData} margin={{ left: 12, right: 12 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" minTickGap={24} />
                          <YAxis yAxisId="left" />
                          <YAxis yAxisId="right" orientation="right" />
                          <Tooltip
                            formatter={(value: number, name: string) => {
                              if (name === "Avg distress score") return [Number(value).toFixed(1), name];
                              if (name === "High-confidence share") return [`${Number(value).toFixed(1)}%`, name];
                              return [fmt(value), name];
                            }}
                            labelFormatter={(label: string) => label}
                          />
                          <Legend />
                          <Line yAxisId="left" type="monotone" dataKey="foreclosurePosCount" name="Foreclosure/POS" stroke="#ef4444" strokeWidth={2} dot={false} />
                          <Line yAxisId="left" type="monotone" dataKey="motivatedCount" name="Motivated" stroke="#f59e0b" strokeWidth={2} dot={false} />
                          <Line yAxisId="left" type="monotone" dataKey="vtbCount" name="VTB" stroke="#3b82f6" strokeWidth={2} dot={false} />
                          <Line yAxisId="right" type="monotone" dataKey="avgDistressScore" name="Avg distress score" stroke="#111827" strokeWidth={2.5} dot={{ r: 2.5 }} />
                          <Line yAxisId="right" type="monotone" dataKey="highConfidenceShare" name="High-confidence share" stroke="#22c55e" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-lg">Province Details — {getMonthLabel(activeMonth)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="province-table">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-3 px-3 font-medium">Province</th>
                        <th className="py-3 px-3 font-medium text-right">Total</th>
                        <th className="py-3 px-3 font-medium text-right">Foreclosure/POS</th>
                        <th className="py-3 px-3 font-medium text-right">Motivated</th>
                        <th className="py-3 px-3 font-medium text-right">VTB</th>
                        <th className="py-3 px-3 font-medium text-right">Avg Price</th>
                        <th className="py-3 px-3 font-medium text-right">Median Price</th>
                        <th className="py-3 px-3 font-medium text-right">High Conf.</th>
                        <th className="py-3 px-3 font-medium text-right">Avg DOM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provinceSnapshots.sort((a, b) => b.totalListings - a.totalListings).map(p => (
                        <tr key={p.id} className="border-b hover:bg-muted/50" data-testid={`province-row-${p.province}`}>
                          <td className="py-3 px-3 font-medium">{PROVINCE_NAMES[p.province] || p.province}</td>
                          <td className="py-3 px-3 text-right font-semibold">{fmt(p.totalListings)}</td>
                          <td className="py-3 px-3 text-right text-red-500">{fmt(p.foreclosurePosCount)}</td>
                          <td className="py-3 px-3 text-right text-amber-500">{fmt(p.motivatedCount)}</td>
                          <td className="py-3 px-3 text-right text-blue-500">{fmt(p.vtbCount)}</td>
                          <td className="py-3 px-3 text-right">{fmtDollar(p.avgListPrice)}</td>
                          <td className="py-3 px-3 text-right">{fmtDollar(p.medianListPrice)}</td>
                          <td className="py-3 px-3 text-right">
                            <Badge variant={p.highConfidenceCount > 10 ? "destructive" : "secondary"}>
                              {fmt(p.highConfidenceCount)}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-right">{p.avgDaysOnMarket != null ? fmt(p.avgDaysOnMarket) : "N/A"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    <FileText className="inline-block w-5 h-5 mr-2" />
                    Full Report
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Read the complete {getMonthLabel(activeMonth)} distress deals report with full analysis, methodology, and investment insights.
                  </p>
                  <Link href={getDistressReportSlug(activeMonth)}>
                    <Button variant="outline" data-testid="read-report-btn">
                      Read Full Report <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Browse Live Deals</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Search and filter distress listings in real time across all Canadian provinces. Updated continuously from CREA DDF.
                  </p>
                  <Link href="/tools/distress-deals">
                    <Button data-testid="browse-live-btn">
                      Open Distress Deals Browser <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
