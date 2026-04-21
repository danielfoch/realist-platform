import { useState, useMemo, useCallback } from "react";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { TrendingUp, Building2, DollarSign, MapPin, Calendar, BarChart3, ArrowUpRight, ArrowDownRight, Minus, X, Plus, Layers, FileText } from "lucide-react";
import { Link } from "wouter";
import { SEO } from "@/components/SEO";
import { apiRequest } from "@/lib/queryClient";

interface MarketSnapshot {
  id: string;
  city: string;
  province: string;
  month: string;
  dealCount: number;
  avgCapRate: number | null;
  avgCashOnCash: number | null;
  avgDscr: number | null;
  avgPurchasePrice: number | null;
  avgRentPerUnit: number | null;
  medianCapRate: number | null;
  medianPurchasePrice: number | null;
  avgVacancyRate: number | null;
  cmhcOneBed: number | null;
  cmhcTwoBed: number | null;
  createdAt: string;
}

interface CityYieldHistory {
  id: string;
  city: string;
  province: string;
  month: string;
  listingCount: number;
  avgGrossYield: number | null;
  medianGrossYield: number | null;
  avgNetYield: number | null;
  avgListPrice: number | null;
  medianListPrice: number | null;
  avgRentPerUnit: number | null;
  avgDaysOnMarket: number | null;
  avgPricePerSqft: number | null;
  inventoryCount: number | null;
  avgBedsPerListing: number | null;
  yieldTrend: number | null;
  computedAt: string;
}

const PROVINCE_NAMES: Record<string, string> = {
  ON: "Ontario",
  BC: "British Columbia",
  AB: "Alberta",
  QC: "Quebec",
  MB: "Manitoba",
  SK: "Saskatchewan",
  NS: "Nova Scotia",
  NB: "New Brunswick",
  NL: "Newfoundland",
  PE: "Prince Edward Island",
};

const CHART_COLORS = [
  "hsl(142, 70%, 45%)",
  "hsl(200, 80%, 60%)",
  "hsl(280, 65%, 60%)",
  "hsl(30, 90%, 55%)",
  "hsl(350, 70%, 55%)",
  "hsl(170, 60%, 45%)",
  "hsl(45, 85%, 55%)",
  "hsl(240, 60%, 55%)",
  "hsl(0, 70%, 55%)",
  "hsl(100, 60%, 45%)",
];

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return `$${Math.round(value).toLocaleString()}`;
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return `${value.toFixed(1)}%`;
}

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(parseInt(year), parseInt(m) - 1);
  return date.toLocaleDateString("en-CA", { month: "short", year: "numeric" });
}

function generateCommentary(snapshots: MarketSnapshot[], month: string, yieldData?: CityYieldHistory[]): string[] {
  const commentary: string[] = [];
  const withData = snapshots.filter(s => s.cmhcOneBed != null);

  if (withData.length === 0) {
    return ["No market data available for this period. Run deals through the analyzer to populate market statistics."];
  }

  const sortedByRent = [...withData].sort((a, b) => (b.cmhcTwoBed || 0) - (a.cmhcTwoBed || 0));
  const mostExpensive = sortedByRent[0];
  const leastExpensive = sortedByRent[sortedByRent.length - 1];

  commentary.push(
    `The ${formatMonth(month)} Market Report covers ${withData.length} major Canadian markets. ` +
    `${mostExpensive.city}, ${mostExpensive.province} leads with the highest average 2-bedroom rent at ${formatCurrency(mostExpensive.cmhcTwoBed)}/mo, ` +
    `while ${leastExpensive.city}, ${leastExpensive.province} offers the most affordable at ${formatCurrency(leastExpensive.cmhcTwoBed)}/mo.`
  );

  if (yieldData && yieldData.length > 0) {
    const sortedByYield = [...yieldData]
      .filter(y => y.avgGrossYield != null && y.avgGrossYield > 0)
      .sort((a, b) => (b.avgGrossYield || 0) - (a.avgGrossYield || 0));

    if (sortedByYield.length > 0) {
      const topYield = sortedByYield[0];
      const bottomYield = sortedByYield[sortedByYield.length - 1];
      const totalListings = yieldData.reduce((s, y) => s + y.listingCount, 0);

      commentary.push(
        `DDF yield analysis covers ${totalListings.toLocaleString()} active listings across ${yieldData.length} markets. ` +
        `${topYield.city} leads with an average gross yield of ${formatPercent(topYield.avgGrossYield)}, ` +
        `while ${bottomYield.city} sits at ${formatPercent(bottomYield.avgGrossYield)}. ` +
        `Average days on market range from ${yieldData.filter(y => y.avgDaysOnMarket != null).sort((a, b) => (a.avgDaysOnMarket || 0) - (b.avgDaysOnMarket || 0))[0]?.avgDaysOnMarket?.toFixed(0) || "N/A"} to ${yieldData.filter(y => y.avgDaysOnMarket != null).sort((a, b) => (b.avgDaysOnMarket || 0) - (a.avgDaysOnMarket || 0))[0]?.avgDaysOnMarket?.toFixed(0) || "N/A"} days.`
      );
    }
  }

  const provinces = [...new Set(withData.map(s => s.province))];
  const provinceAvgs = provinces.map(p => {
    const cities = withData.filter(s => s.province === p);
    const avgRent = cities.reduce((sum, c) => sum + (c.cmhcTwoBed || 0), 0) / cities.length;
    return { province: p, avgRent, cityCount: cities.length };
  }).sort((a, b) => b.avgRent - a.avgRent);

  const topProvince = provinceAvgs[0];
  commentary.push(
    `${PROVINCE_NAMES[topProvince.province] || topProvince.province} remains the most expensive province in our coverage with ` +
    `${topProvince.cityCount} tracked ${topProvince.cityCount === 1 ? "market" : "markets"} averaging ${formatCurrency(topProvince.avgRent)}/mo for a 2-bedroom unit.`
  );

  const affordableMarkets = [...withData]
    .filter(s => s.cmhcTwoBed != null)
    .sort((a, b) => (a.cmhcTwoBed || 0) - (b.cmhcTwoBed || 0))
    .slice(0, 5);

  if (affordableMarkets.length >= 3) {
    const names = affordableMarkets.map(s => `${s.city} (${formatCurrency(s.cmhcTwoBed)})`).join(", ");
    commentary.push(
      `Most affordable markets for investors: ${names}. ` +
      "Lower rents often correlate with lower purchase prices and potentially higher yields for multi-unit properties."
    );
  }

  return commentary;
}

export default function MarketReport() {
  const [selectedProvince, setSelectedProvince] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [compareCities, setCompareCities] = useState<{ city: string; province: string }[]>([]);
  const [activeTab, setActiveTab] = useState<string>("overview");

  const { data: latestData, isLoading: loadingLatest } = useQuery<{
    snapshots: MarketSnapshot[];
    months: string[];
    reportMonth: string | null;
  }>({
    queryKey: ["/api/market-report/latest"],
  });

  const { data: historyData } = useQuery<MarketSnapshot[]>({
    queryKey: ["/api/market-report/history", selectedCity],
    enabled: !!selectedCity,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCity) {
        const snap = latestData?.snapshots.find(s => s.city === selectedCity);
        if (snap) {
          params.set("city", snap.city);
          params.set("province", snap.province);
        }
      }
      const res = await fetch(`/api/market-report/history?${params}`);
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
  });

  const { data: yieldHistoryData } = useQuery<{ data: CityYieldHistory[]; months: string[] }>({
    queryKey: ["/api/yield-history"],
  });

  const { data: compareData } = useQuery<CityYieldHistory[]>({
    queryKey: ["/api/yield-history/compare", compareCities],
    enabled: compareCities.length > 0,
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/yield-history/compare", { cities: compareCities });
      return res.json();
    },
  });

  const { data: archivePosts = [] } = useQuery<{ id: number; title: string; slug: string; excerpt: string; publishedAt: string; tags: string[] }[]>({
    queryKey: ["/api/blog/posts/db", "market-analysis"],
    queryFn: async () => {
      const res = await fetch("/api/blog/posts/db?category=market-analysis");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const filteredSnapshots = useMemo(() => {
    if (!latestData?.snapshots) return [];
    if (selectedProvince === "all") return latestData.snapshots;
    return latestData.snapshots.filter(s => s.province === selectedProvince);
  }, [latestData, selectedProvince]);

  const provinces = useMemo(() => {
    if (!latestData?.snapshots) return [];
    return [...new Set(latestData.snapshots.map(s => s.province))].sort();
  }, [latestData]);

  const rentChartData = useMemo(() => {
    return filteredSnapshots
      .filter(s => s.cmhcOneBed != null || s.cmhcTwoBed != null)
      .sort((a, b) => (b.cmhcTwoBed || 0) - (a.cmhcTwoBed || 0))
      .map(s => ({
        name: s.city,
        "1-Bed": s.cmhcOneBed,
        "2-Bed": s.cmhcTwoBed,
      }));
  }, [filteredSnapshots]);

  const latestYieldForCities = useMemo(() => {
    if (!yieldHistoryData?.data) return [];
    const latestMonth = yieldHistoryData.months?.[0];
    if (!latestMonth) return [];
    return yieldHistoryData.data
      .filter(y => y.month === latestMonth)
      .filter(y => selectedProvince === "all" || y.province === selectedProvince);
  }, [yieldHistoryData, selectedProvince]);

  const ddfYieldChartData = useMemo(() => {
    return latestYieldForCities
      .filter(y => y.avgGrossYield != null && y.avgGrossYield > 0)
      .sort((a, b) => (b.avgGrossYield || 0) - (a.avgGrossYield || 0))
      .map(y => ({
        name: y.city,
        "Gross Yield": y.avgGrossYield,
        "Net Yield": y.avgNetYield,
      }));
  }, [latestYieldForCities]);

  const ddfPriceChartData = useMemo(() => {
    return latestYieldForCities
      .filter(y => y.avgListPrice != null && y.avgListPrice > 0)
      .sort((a, b) => (b.avgListPrice || 0) - (a.avgListPrice || 0))
      .map(y => ({
        name: y.city,
        "Avg Price": Math.round((y.avgListPrice || 0) / 1000),
        "Median Price": y.medianListPrice ? Math.round(y.medianListPrice / 1000) : null,
      }));
  }, [latestYieldForCities]);

  const compareChartData = useMemo(() => {
    if (!compareData || compareData.length === 0) return [];
    const months = [...new Set(compareData.map(d => d.month))].sort();
    return months.map(month => {
      const point: any = { month: formatMonth(month) };
      compareCities.forEach(({ city }) => {
        const entry = compareData.find(d => d.city === city && d.month === month);
        point[city] = entry?.avgGrossYield || null;
      });
      return point;
    });
  }, [compareData, compareCities]);

  const trendChartData = useMemo(() => {
    if (!historyData) return [];
    return historyData.map(s => ({
      month: formatMonth(s.month),
      "Avg Yield": s.avgCapRate,
      "CMHC 1-Bed": s.cmhcOneBed,
      "CMHC 2-Bed": s.cmhcTwoBed,
      "Avg Price (k)": s.avgPurchasePrice ? Math.round(s.avgPurchasePrice / 1000) : null,
    }));
  }, [historyData]);

  const commentary = useMemo(() => {
    if (!latestData?.snapshots || !latestData.reportMonth) return [];
    return generateCommentary(latestData.snapshots, latestData.reportMonth, latestYieldForCities);
  }, [latestData, latestYieldForCities]);

  const nationalAvgs = useMemo(() => {
    if (!latestData?.snapshots) return null;
    const snaps = latestData.snapshots;
    const withRent = snaps.filter(s => s.cmhcTwoBed != null);
    const withYield = snaps.filter(s => s.avgCapRate != null);
    return {
      totalCities: snaps.length,
      avgOneBed: withRent.length > 0 ? Math.round(withRent.reduce((s, c) => s + (c.cmhcOneBed || 0), 0) / withRent.length) : null,
      avgTwoBed: withRent.length > 0 ? Math.round(withRent.reduce((s, c) => s + (c.cmhcTwoBed || 0), 0) / withRent.length) : null,
      avgYield: withYield.length > 0 ? (withYield.reduce((s, c) => s + (c.avgCapRate || 0), 0) / withYield.length) : null,
      totalDeals: snaps.reduce((s, c) => s + c.dealCount, 0),
    };
  }, [latestData]);

  const ddfNationalAvgs = useMemo(() => {
    if (latestYieldForCities.length === 0) return null;
    const withYield = latestYieldForCities.filter(y => y.avgGrossYield != null && y.avgGrossYield > 0);
    const totalListings = latestYieldForCities.reduce((s, y) => s + y.listingCount, 0);
    return {
      totalListings,
      citiesCovered: latestYieldForCities.length,
      avgGrossYield: withYield.length > 0 ? withYield.reduce((s, y) => s + (y.avgGrossYield || 0), 0) / withYield.length : null,
      avgNetYield: withYield.length > 0 ? withYield.reduce((s, y) => s + (y.avgNetYield || 0), 0) / withYield.length : null,
    };
  }, [latestYieldForCities]);

  const toggleCompareCity = useCallback((city: string, province: string) => {
    setCompareCities(prev => {
      const exists = prev.some(c => c.city === city && c.province === province);
      if (exists) return prev.filter(c => !(c.city === city && c.province === province));
      if (prev.length >= 10) return prev;
      return [...prev, { city, province }];
    });
  }, []);

  const availableCities = useMemo(() => {
    if (!yieldHistoryData?.data) return [];
    const latestMonth = yieldHistoryData.months?.[0];
    if (!latestMonth) return [];
    return yieldHistoryData.data
      .filter(y => y.month === latestMonth)
      .sort((a, b) => a.city.localeCompare(b.city));
  }, [yieldHistoryData]);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Monthly Market Report - Canadian Real Estate Yields | Realist.ca"
        description="Monthly market report covering yields, rents, and investment metrics across 30+ major Canadian cities. Track how real estate yields change over time."
        keywords="canadian real estate market report, yield report, cap rate report, rent prices canada, real estate investing canada"
      />
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold" data-testid="text-market-report-title">Monthly Market Report</h1>
          </div>
          <p className="text-muted-foreground text-lg" data-testid="text-report-subtitle">
            {latestData?.reportMonth
              ? `${formatMonth(latestData.reportMonth)} Edition`
              : "Loading..."}
            {" "}— Yields, rents, and investment metrics across {nationalAvgs?.totalCities || 30} Canadian markets
          </p>
        </div>

        {loadingLatest ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
            <Skeleton className="h-64" />
            <Skeleton className="h-96" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" data-testid="section-national-stats">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Markets Tracked</span>
                  </div>
                  <span className="text-2xl font-bold font-mono" data-testid="text-total-cities">
                    {nationalAvgs?.totalCities || 0}
                  </span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Avg 2-Bed Rent</span>
                  </div>
                  <span className="text-2xl font-bold font-mono" data-testid="text-avg-rent">
                    {formatCurrency(nationalAvgs?.avgTwoBed)}
                  </span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Avg Gross Yield</span>
                  </div>
                  <span className="text-2xl font-bold font-mono" data-testid="text-avg-yield">
                    {ddfNationalAvgs?.avgGrossYield != null
                      ? formatPercent(ddfNationalAvgs.avgGrossYield)
                      : nationalAvgs?.avgYield != null
                        ? formatPercent(nationalAvgs.avgYield)
                        : "Pending"}
                  </span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">DDF Listings</span>
                  </div>
                  <span className="text-2xl font-bold font-mono" data-testid="text-total-listings">
                    {ddfNationalAvgs?.totalListings?.toLocaleString() || "Pending"}
                  </span>
                </CardContent>
              </Card>
            </div>

            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Market Commentary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose dark:prose-invert max-w-none" data-testid="section-commentary">
                  {commentary.map((paragraph, i) => (
                    <p key={i} className="text-muted-foreground leading-relaxed mb-4 last:mb-0">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-4 mb-6">
              <Select value={selectedProvince} onValueChange={setSelectedProvince}>
                <SelectTrigger className="w-[200px]" data-testid="select-province-filter">
                  <SelectValue placeholder="All Provinces" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Provinces</SelectItem>
                  {provinces.map(p => (
                    <SelectItem key={p} value={p}>
                      {PROVINCE_NAMES[p] || p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
              <TabsList data-testid="tabs-report-section">
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="yields" data-testid="tab-yields">DDF Yields</TabsTrigger>
                <TabsTrigger value="compare" data-testid="tab-compare">Compare Cities</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-8 mt-6">
                {rentChartData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        CMHC Average Rents by City
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[400px]" data-testid="chart-rents">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={rentChartData} layout="vertical" margin={{ left: 100, right: 20, top: 5, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis type="number" tickFormatter={(v) => `$${v.toLocaleString()}`} className="text-xs" />
                            <YAxis type="category" dataKey="name" width={95} className="text-xs" />
                            <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                            <Legend />
                            <Bar dataKey="1-Bed" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                            <Bar dataKey="2-Bed" fill="hsl(200, 80%, 60%)" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {selectedCity && trendChartData.length > 1 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        {selectedCity} — Historical Trends
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]" data-testid="chart-trends">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trendChartData} margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="month" className="text-xs" />
                            <YAxis className="text-xs" />
                            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                            <Legend />
                            <Line type="monotone" dataKey="CMHC 1-Bed" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="CMHC 2-Bed" stroke="hsl(200, 80%, 60%)" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="yields" className="space-y-8 mt-6">
                {ddfYieldChartData.length > 0 ? (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5" />
                          Gross & Net Yield by City (DDF Data)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[500px]" data-testid="chart-ddf-yields">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={ddfYieldChartData} layout="vertical" margin={{ left: 110, right: 20, top: 5, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis type="number" tickFormatter={(v) => `${v}%`} className="text-xs" />
                              <YAxis type="category" dataKey="name" width={105} className="text-xs" />
                              <Tooltip formatter={(v: number) => `${v?.toFixed(2)}%`} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                              <Legend />
                              <Bar dataKey="Gross Yield" fill="hsl(142, 70%, 45%)" radius={[0, 4, 4, 0]} />
                              <Bar dataKey="Net Yield" fill="hsl(280, 65%, 60%)" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <DollarSign className="h-5 w-5" />
                          Average List Price by City (DDF Data)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[500px]" data-testid="chart-ddf-prices">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={ddfPriceChartData} layout="vertical" margin={{ left: 110, right: 20, top: 5, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis type="number" tickFormatter={(v) => `$${v}k`} className="text-xs" />
                              <YAxis type="category" dataKey="name" width={105} className="text-xs" />
                              <Tooltip formatter={(v: number) => `$${(v * 1000).toLocaleString()}`} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                              <Legend />
                              <Bar dataKey="Avg Price" name="Avg Price (k)" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                              <Bar dataKey="Median Price" name="Median Price (k)" fill="hsl(30, 90%, 55%)" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          DDF Market Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm" data-testid="table-ddf-summary">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left py-3 px-2 font-medium text-muted-foreground">City</th>
                                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Listings</th>
                                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Gross Yield</th>
                                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Net Yield</th>
                                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Avg Price</th>
                                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Avg Rent</th>
                                <th className="text-right py-3 px-2 font-medium text-muted-foreground">$/sqft</th>
                                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Avg DOM</th>
                              </tr>
                            </thead>
                            <tbody>
                              {latestYieldForCities
                                .sort((a, b) => (b.avgGrossYield || 0) - (a.avgGrossYield || 0))
                                .map(y => (
                                  <tr key={`${y.city}-${y.province}`} className="border-b border-border/50 hover:bg-muted/50 transition-colors" data-testid={`row-ddf-${y.city.toLowerCase().replace(/\s+/g, "-")}`}>
                                    <td className="py-3 px-2 font-medium">
                                      {y.city}
                                      <Badge variant="outline" className="text-[10px] ml-2">{y.province}</Badge>
                                    </td>
                                    <td className="py-3 px-2 text-right font-mono">{y.listingCount}</td>
                                    <td className="py-3 px-2 text-right font-mono">
                                      <span className={
                                        (y.avgGrossYield || 0) >= 5 ? "text-green-500" :
                                        (y.avgGrossYield || 0) >= 3 ? "text-yellow-500" : "text-red-500"
                                      }>
                                        {formatPercent(y.avgGrossYield)}
                                      </span>
                                    </td>
                                    <td className="py-3 px-2 text-right font-mono">{formatPercent(y.avgNetYield)}</td>
                                    <td className="py-3 px-2 text-right font-mono">{formatCurrency(y.avgListPrice)}</td>
                                    <td className="py-3 px-2 text-right font-mono">{formatCurrency(y.avgRentPerUnit)}</td>
                                    <td className="py-3 px-2 text-right font-mono">
                                      {y.avgPricePerSqft != null ? `$${y.avgPricePerSqft.toFixed(0)}` : "—"}
                                    </td>
                                    <td className="py-3 px-2 text-right font-mono">
                                      {y.avgDaysOnMarket != null ? `${y.avgDaysOnMarket.toFixed(0)}d` : "—"}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">DDF Yield Data Pending</h3>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        Yield data from the CREA DDF is calculated monthly across all tracked cities.
                        Once the first crawl completes, you'll see gross and net yields, pricing data,
                        and market depth metrics for each city.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="compare" className="space-y-8 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Yield Over Time — City Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground mb-3">
                        Select cities to compare their gross yield trends over time. Up to 10 cities.
                      </p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {compareCities.map(({ city, province }, i) => (
                          <Badge
                            key={`${city}-${province}`}
                            variant="default"
                            className="flex items-center gap-1 cursor-pointer"
                            style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                            onClick={() => toggleCompareCity(city, province)}
                            data-testid={`badge-compare-${city.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            {city}
                            <X className="h-3 w-3" />
                          </Badge>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {availableCities
                          .filter(c => !compareCities.some(cc => cc.city === c.city && cc.province === c.province))
                          .map(c => (
                            <Button
                              key={`${c.city}-${c.province}`}
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => toggleCompareCity(c.city, c.province)}
                              data-testid={`button-add-${c.city.toLowerCase().replace(/\s+/g, "-")}`}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              {c.city}
                            </Button>
                          ))}
                      </div>
                    </div>

                    {compareChartData.length > 0 ? (
                      <div className="h-[400px]" data-testid="chart-compare-yields">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={compareChartData} margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="month" className="text-xs" />
                            <YAxis tickFormatter={(v) => `${v}%`} className="text-xs" />
                            <Tooltip
                              formatter={(v: number) => v != null ? `${v.toFixed(2)}%` : "N/A"}
                              contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                            />
                            <Legend />
                            {compareCities.map(({ city }, i) => (
                              <Line
                                key={city}
                                type="monotone"
                                dataKey={city}
                                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                                strokeWidth={2}
                                dot={true}
                                connectNulls
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : compareCities.length > 0 ? (
                      <div className="h-[300px] flex items-center justify-center">
                        <p className="text-muted-foreground">Loading comparison data...</p>
                      </div>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center">
                        <p className="text-muted-foreground">Select cities above to compare yield trends</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  City-by-City Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-city-breakdown">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">City</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Province</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">1-Bed Rent</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">2-Bed Rent</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Avg Yield</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Cash-on-Cash</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">DSCR</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Deals</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSnapshots.map((snap) => (
                        <tr
                          key={snap.id}
                          className={`border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors ${selectedCity === snap.city ? "bg-primary/5" : ""}`}
                          onClick={() => setSelectedCity(selectedCity === snap.city ? null : snap.city)}
                          data-testid={`row-city-${snap.city.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          <td className="py-3 px-2 font-medium">{snap.city}</td>
                          <td className="py-3 px-2">
                            <Badge variant="outline" className="text-xs">
                              {snap.province}
                            </Badge>
                          </td>
                          <td className="py-3 px-2 text-right font-mono">{formatCurrency(snap.cmhcOneBed)}</td>
                          <td className="py-3 px-2 text-right font-mono">{formatCurrency(snap.cmhcTwoBed)}</td>
                          <td className="py-3 px-2 text-right font-mono">
                            {snap.avgCapRate != null ? (
                              <span className={snap.avgCapRate >= 5 ? "text-green-500" : snap.avgCapRate >= 3 ? "text-yellow-500" : "text-red-500"}>
                                {formatPercent(snap.avgCapRate)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-right font-mono">
                            {snap.avgCashOnCash != null ? formatPercent(snap.avgCashOnCash) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-3 px-2 text-right font-mono">
                            {snap.avgDscr != null ? snap.avgDscr.toFixed(2) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-3 px-2 text-right">
                            <Badge variant={snap.dealCount > 0 ? "default" : "secondary"} className="text-xs">
                              {snap.dealCount}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {archivePosts.length > 0 && (
              <Card className="mt-8" data-testid="report-archive">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Monthly Report Archive
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Every month, Realist.ca publishes detailed investment reports for 30 Canadian cities — covering yields, rents, pricing, and strategy insights. Browse past editions below.
                  </p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {archivePosts.map(post => (
                      <Link key={post.id} href={`/insights/blog/${post.slug}`}>
                        <div className="p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer" data-testid={`archive-post-${post.slug}`}>
                          <p className="text-sm font-medium leading-snug">{post.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : ""}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="mt-4 text-center">
                    <Link href="/insights/blog">
                      <Button variant="outline" size="sm" data-testid="view-all-reports-btn">
                        View All Reports & Research
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="mt-8 text-center text-sm text-muted-foreground" data-testid="text-methodology">
              <p className="mb-2">
                <strong>Methodology:</strong> Rent data sourced from CMHC (Canada Mortgage and Housing Corporation) average market rents.
                DDF yields are calculated from active MLS listings using CMHC rent benchmarks and standardized expense assumptions
                (5% vacancy, 8% management, 5% maintenance, 0.3% insurance, actual property taxes).
              </p>
              <p>
                Report data is snapshotted monthly and preserved for historical trend analysis.
                DDF listing data is crawled automatically each month across {latestYieldForCities.length || 34} Canadian markets.
              </p>
            </div>

            <div className="mt-16 border-t pt-12" data-testid="section-macro-reports">
              <h2 className="text-2xl font-bold mb-2">Canadian Macro Reports</h2>
              <p className="text-muted-foreground mb-6">National economic indicators relevant to real estate investors.</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Link href="/insights/building-permits">
                  <Card className="h-full hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all" data-testid="card-macro-building-permits">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <Building2 className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <Badge variant="outline" className="text-[10px]">Feb 2026</Badge>
                      </div>
                      <h3 className="font-bold text-sm mb-1">Building Permits</h3>
                      <p className="text-xs text-muted-foreground mb-2">
                        Total permits fell 8.4% to $12.1B. Non-residential down 24%, residential up 1.7%.
                      </p>
                      <span className="text-xs text-primary font-medium">View Report →</span>
                    </CardContent>
                  </Card>
                </Link>
                <Link href="/insights/gta-precon-pricing">
                  <Card className="h-full hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all" data-testid="card-macro-precon-pricing">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                          <BarChart3 className="h-4.5 w-4.5 text-rose-600 dark:text-rose-400" />
                        </div>
                        <Badge variant="outline" className="text-[10px]">Apr 2026</Badge>
                      </div>
                      <h3 className="font-bold text-sm mb-1">GTA Pre-Construction Pricing Movement</h3>
                      <p className="text-xs text-muted-foreground mb-2">
                        Floorplan-level cuts vs raises across 1,000+ active GTA pre-con units. Builder pricing power, rebate benchmark, resale implications.
                      </p>
                      <span className="text-xs text-primary font-medium">View Report →</span>
                    </CardContent>
                  </Card>
                </Link>
                <Link href="/insights/new-construction-canada">
                  <Card className="h-full hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all" data-testid="card-macro-new-construction">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                          <Building2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <Badge variant="outline" className="text-[10px]">Live CREA DDF</Badge>
                      </div>
                      <h3 className="font-bold text-sm mb-1">Canada New Construction Market</h3>
                      <p className="text-xs text-muted-foreground mb-2">
                        Live snapshot of active new construction listings across Canada. Pricing, regions, property types, pre-con signals.
                      </p>
                      <span className="text-xs text-primary font-medium">View Report →</span>
                    </CardContent>
                  </Card>
                </Link>
                <Link href="/insights/productivity-gap">
                  <Card className="h-full hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all" data-testid="card-macro-productivity-gap">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                          <BarChart3 className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <Badge variant="outline" className="text-[10px]">Dec 2024</Badge>
                      </div>
                      <h3 className="font-bold text-sm mb-1">Canada-US Productivity Gap</h3>
                      <p className="text-xs text-muted-foreground mb-2">
                        Top 10% of earners account for 75% of the GDP gap. Implications for RE investors.
                      </p>
                      <span className="text-xs text-primary font-medium">View Report →</span>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
