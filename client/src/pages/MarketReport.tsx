import { useState, useMemo } from "react";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { TrendingUp, Building2, DollarSign, MapPin, Calendar, BarChart3, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { SEO } from "@/components/SEO";

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

const PROVINCE_NAMES: Record<string, string> = {
  ON: "Ontario",
  BC: "British Columbia",
  AB: "Alberta",
  QC: "Quebec",
  MB: "Manitoba",
  SK: "Saskatchewan",
  NS: "Nova Scotia",
  NB: "New Brunswick",
};

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
  return date.toLocaleDateString("en-CA", { month: "long", year: "numeric" });
}

function TrendIndicator({ current, previous }: { current: number | null; previous: number | null }) {
  if (current == null || previous == null) return <Minus className="h-4 w-4 text-muted-foreground" />;
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (diff > 0) return <ArrowUpRight className="h-4 w-4 text-green-500" />;
  return <ArrowDownRight className="h-4 w-4 text-red-500" />;
}

function generateCommentary(snapshots: MarketSnapshot[], month: string): string[] {
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

  const withDeals = withData.filter(s => s.dealCount > 0);
  if (withDeals.length > 0) {
    const totalDeals = withDeals.reduce((sum, s) => sum + s.dealCount, 0);
    const avgYield = withDeals.filter(s => s.avgCapRate != null);
    commentary.push(
      `${totalDeals} deals were analyzed across ${withDeals.length} markets this period. ` +
      (avgYield.length > 0
        ? `The average gross yield across analyzed markets is ${formatPercent(avgYield.reduce((sum, s) => sum + (s.avgCapRate || 0), 0) / avgYield.length)}.`
        : "")
    );
  } else {
    commentary.push(
      "No deals have been analyzed yet for this report period. As investors use the Deal Analyzer, " +
      "yield data, DSCR, and cash-on-cash metrics will appear here for each market."
    );
  }

  const affordableMarkets = [...withData]
    .filter(s => s.cmhcTwoBed != null)
    .sort((a, b) => (a.cmhcTwoBed || 0) - (b.cmhcTwoBed || 0))
    .slice(0, 5);

  if (affordableMarkets.length >= 3) {
    const names = affordableMarkets.map(s => `${s.city} (${formatCurrency(s.cmhcTwoBed)})`).join(", ");
    commentary.push(
      `Most affordable markets for investors: ${names}. ` +
      "Lower rents often correlate with lower purchase prices and potentially higher cap rates for multi-unit properties."
    );
  }

  return commentary;
}

export default function MarketReport() {
  const [selectedProvince, setSelectedProvince] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const { data: latestData, isLoading: loadingLatest } = useQuery<{
    snapshots: MarketSnapshot[];
    months: string[];
    reportMonth: string | null;
  }>({
    queryKey: ["/api/market-report/latest"],
  });

  const { data: historyData, isLoading: loadingHistory } = useQuery<MarketSnapshot[]>({
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

  const { data: allData } = useQuery<{
    snapshots: MarketSnapshot[];
    months: string[];
  }>({
    queryKey: ["/api/market-report/all"],
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

  const yieldChartData = useMemo(() => {
    return filteredSnapshots
      .filter(s => s.avgCapRate != null)
      .sort((a, b) => (b.avgCapRate || 0) - (a.avgCapRate || 0))
      .map(s => ({
        name: s.city,
        yield: s.avgCapRate,
        cashOnCash: s.avgCashOnCash,
      }));
  }, [filteredSnapshots]);

  const trendChartData = useMemo(() => {
    if (!historyData) return [];
    return historyData.map(s => ({
      month: formatMonth(s.month),
      "Avg Yield": s.avgCapRate,
      "CMHC 1-Bed": s.cmhcOneBed,
      "CMHC 2-Bed": s.cmhcTwoBed,
      "Avg Price": s.avgPurchasePrice ? s.avgPurchasePrice / 1000 : null,
    }));
  }, [historyData]);

  const commentary = useMemo(() => {
    if (!latestData?.snapshots || !latestData.reportMonth) return [];
    return generateCommentary(latestData.snapshots, latestData.reportMonth);
  }, [latestData]);

  const nationalAvgs = useMemo(() => {
    if (!latestData?.snapshots) return null;
    const snaps = latestData.snapshots;
    const withRent = snaps.filter(s => s.cmhcTwoBed != null);
    const withYield = snaps.filter(s => s.avgCapRate != null);
    const withDeals = snaps.filter(s => s.dealCount > 0);
    return {
      totalCities: snaps.length,
      avgOneBed: withRent.length > 0 ? Math.round(withRent.reduce((s, c) => s + (c.cmhcOneBed || 0), 0) / withRent.length) : null,
      avgTwoBed: withRent.length > 0 ? Math.round(withRent.reduce((s, c) => s + (c.cmhcTwoBed || 0), 0) / withRent.length) : null,
      avgYield: withYield.length > 0 ? (withYield.reduce((s, c) => s + (c.avgCapRate || 0), 0) / withYield.length) : null,
      totalDeals: snaps.reduce((s, c) => s + c.dealCount, 0),
      citiesWithDeals: withDeals.length,
    };
  }, [latestData]);

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
                    {nationalAvgs?.avgYield != null ? formatPercent(nationalAvgs.avgYield) : "Pending"}
                  </span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Deals Analyzed</span>
                  </div>
                  <span className="text-2xl font-bold font-mono" data-testid="text-total-deals">
                    {nationalAvgs?.totalDeals || 0}
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

            {rentChartData.length > 0 && (
              <Card className="mb-8">
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
                        <Bar dataKey="2-Bed" fill="hsl(var(--chart-2, 200 80% 60%))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {yieldChartData.length > 0 && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Gross Yield by City
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]" data-testid="chart-yields">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={yieldChartData} layout="vertical" margin={{ left: 100, right: 20, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tickFormatter={(v) => `${v}%`} className="text-xs" />
                        <YAxis type="category" dataKey="name" width={95} className="text-xs" />
                        <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                        <Legend />
                        <Bar dataKey="yield" name="Gross Yield" fill="hsl(var(--chart-1, 142 70% 45%))" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="cashOnCash" name="Cash-on-Cash" fill="hsl(var(--chart-3, 280 65% 60%))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedCity && trendChartData.length > 1 && (
              <Card className="mb-8">
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
                        <Line type="monotone" dataKey="CMHC 2-Bed" stroke="hsl(var(--chart-2, 200 80% 60%))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

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

            <div className="mt-8 text-center text-sm text-muted-foreground" data-testid="text-methodology">
              <p className="mb-2">
                <strong>Methodology:</strong> Rent data sourced from CMHC (Canada Mortgage and Housing Corporation) average market rents.
                Yield, DSCR, and Cash-on-Cash metrics are calculated from community deal analyses submitted through the Realist.ca Deal Analyzer.
              </p>
              <p>
                Report data is snapshotted monthly and preserved for historical trend analysis.
                As more deals are analyzed, yield data will become increasingly robust for each market.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
