import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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

export default function DistressReport() {
  const [selectedMonth, setSelectedMonth] = useState<string>("");

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

  const provinceSnapshots = snapshots.filter(s => !s.city);
  const citySnapshots = snapshots.filter(s => !!s.city);

  const totalListings = provinceSnapshots.reduce((s, p) => s + p.totalListings, 0);
  const totalForeclosure = provinceSnapshots.reduce((s, p) => s + p.foreclosurePosCount, 0);
  const totalMotivated = provinceSnapshots.reduce((s, p) => s + p.motivatedCount, 0);
  const totalVtb = provinceSnapshots.reduce((s, p) => s + p.vtbCount, 0);
  const totalHigh = provinceSnapshots.reduce((s, p) => s + p.highConfidenceCount, 0);

  const provinceChartData = provinceSnapshots
    .sort((a, b) => b.totalListings - a.totalListings)
    .map(p => ({
      province: p.province,
      name: PROVINCE_NAMES[p.province] || p.province,
      foreclosure: p.foreclosurePosCount,
      motivated: p.motivatedCount,
      vtb: p.vtbCount,
      total: p.totalListings,
    }));

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

  const topProvince = provinceSnapshots.sort((a, b) => b.totalListings - a.totalListings)[0];
  const topCities = topProvince?.topCitiesJson || [];

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
              Canadian Distress Deals Report
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
                  <p className="text-sm text-muted-foreground mt-1">Across {provinceSnapshots.length} provinces</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Foreclosure / POS</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-500" data-testid="stat-foreclosure">{fmt(totalForeclosure)}</div>
                  <p className="text-sm text-muted-foreground mt-1">{totalListings ? (totalForeclosure / totalListings * 100).toFixed(1) : 0}% of total</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Motivated Seller</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-amber-500" data-testid="stat-motivated">{fmt(totalMotivated)}</div>
                  <p className="text-sm text-muted-foreground mt-1">{totalListings ? (totalMotivated / totalListings * 100).toFixed(1) : 0}% of total</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">VTB Opportunities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-500" data-testid="stat-vtb">{fmt(totalVtb)}</div>
                  <p className="text-sm text-muted-foreground mt-1">{totalListings ? (totalVtb / totalListings * 100).toFixed(1) : 0}% of total</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Distress Deals by Province</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px]" data-testid="province-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={provinceChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="province" width={30} />
                        <Tooltip
                          formatter={(value: number, name: string) => [fmt(value), name]}
                          labelFormatter={(label: string) => PROVINCE_NAMES[label] || label}
                        />
                        <Legend />
                        <Bar dataKey="foreclosure" name="Foreclosure/POS" fill="#ef4444" stackId="a" />
                        <Bar dataKey="motivated" name="Motivated" fill="#f59e0b" stackId="a" />
                        <Bar dataKey="vtb" name="VTB" fill="#3b82f6" stackId="a" />
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

            {topCities.length > 0 && topProvince && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="text-lg">
                    <MapPin className="inline-block w-5 h-5 mr-2" />
                    Top Cities in {PROVINCE_NAMES[topProvince.province] || topProvince.province}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px]" data-testid="cities-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topCities.slice(0, 15)} margin={{ left: 20, right: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={80} />
                        <YAxis />
                        <Tooltip formatter={(value: number) => [fmt(value), "Listings"]} />
                        <Bar dataKey="count" name="Distress Listings" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

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
                  <Link href={`/insights/blog/canada-distress-deals-report-${activeMonth.split("-")[1] === "01" ? "january" : activeMonth.split("-")[1] === "02" ? "february" : activeMonth.split("-")[1] === "03" ? "march" : activeMonth.split("-")[1] === "04" ? "april" : activeMonth.split("-")[1] === "05" ? "may" : activeMonth.split("-")[1] === "06" ? "june" : activeMonth.split("-")[1] === "07" ? "july" : activeMonth.split("-")[1] === "08" ? "august" : activeMonth.split("-")[1] === "09" ? "september" : activeMonth.split("-")[1] === "10" ? "october" : activeMonth.split("-")[1] === "11" ? "november" : "december"}-${activeMonth.split("-")[0]}`}>
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
