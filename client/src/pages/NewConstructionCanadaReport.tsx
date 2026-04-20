import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/SEO";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Building2, ArrowLeft, DollarSign, Home, MapPin, Hammer, Loader2, AlertCircle,
} from "lucide-react";

interface NewConstructionReport {
  generatedAt: string;
  anchorYear: number;
  totalListings: number;
  totalWithPrice: number;
  totalWithSqft: number;
  national: {
    avgPrice: number;
    medianPrice: number;
    minPrice: number;
    maxPrice: number;
    avgPsf: number;
    medianPsf: number;
  };
  byProvince: Array<{
    province: string;
    count: number;
    avgPrice: number;
    medianPrice: number;
    avgPsf: number;
  }>;
  byCity: Array<{
    city: string;
    province: string;
    count: number;
    avgPrice: number;
    medianPrice: number;
    avgPsf: number;
  }>;
  byPropertyType: Array<{
    type: string;
    count: number;
    avgPrice: number;
    medianPrice: number;
    avgPsf: number;
  }>;
  priceBands: Array<{
    band: string;
    count: number;
  }>;
  preConstructionKeywordHits: {
    total: number;
    assignment: number;
    toBeBuilt: number;
    brandNew: number;
    preConstruction: number;
    builderInventory: number;
  };
  topExpensive: Array<{
    listingKey: string;
    listingId?: string;
    address: string;
    city: string;
    province: string;
    price: number;
    psf: number | null;
    yearBuilt?: number;
    type?: string;
  }>;
}

const PROV_COLORS = [
  "hsl(220, 70%, 50%)",
  "hsl(160, 50%, 45%)",
  "hsl(35, 80%, 55%)",
  "hsl(280, 50%, 55%)",
  "hsl(0, 65%, 55%)",
  "hsl(200, 60%, 55%)",
  "hsl(100, 45%, 45%)",
  "hsl(320, 55%, 55%)",
];

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatNum(n: number): string {
  return new Intl.NumberFormat("en-CA").format(n);
}

export default function NewConstructionCanadaReport() {
  const { data, isLoading, error } = useQuery<NewConstructionReport>({
    queryKey: ["/api/insights/new-construction-canada"],
    staleTime: 6 * 60 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container max-w-6xl mx-auto px-4 py-20 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground text-center max-w-md">
            Pulling live new construction listings from CREA DDF across Canada. This may take 30-60 seconds on first load.
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container max-w-6xl mx-auto px-4 py-20 flex flex-col items-center justify-center gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-muted-foreground">Unable to load the report. Please try again shortly.</p>
        </div>
      </div>
    );
  }

  const generatedDate = new Date(data.generatedAt).toLocaleString("en-CA", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const provinceChartData = data.byProvince
    .filter((p) => p.count >= 10)
    .slice(0, 10)
    .map((p, i) => ({
      name: p.province,
      count: p.count,
      color: PROV_COLORS[i % PROV_COLORS.length],
    }));

  const typeChartData = data.byPropertyType.slice(0, 10);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Canada New Construction Market Report — Realist.ca"
        description={`Live snapshot of ${formatNum(data.totalListings)} new construction listings across Canada, built from CREA DDF data. Pricing, regions, property types, and pre-construction signals.`}
      />
      <Navigation />

      <div className="container max-w-6xl mx-auto px-4 py-8">
        <Link href="/market-report" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4" data-testid="link-back">
          <ArrowLeft className="h-4 w-4" />
          Back to Market Reports
        </Link>

        <div className="mb-8">
          <Badge variant="secondary" className="mb-3">
            <Hammer className="h-3 w-3 mr-1" />
            Canada — New Construction
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            New Construction Listings Across Canada
          </h1>
          <p className="text-muted-foreground text-lg max-w-3xl">
            A live snapshot of {formatNum(data.totalListings)} active new construction listings across Canada, pulled directly from CREA DDF.
            {" "}Methodology: listings with <code className="text-xs bg-muted px-1 rounded">YearBuilt ≥ {data.anchorYear}</code> and <code className="text-xs bg-muted px-1 rounded">StandardStatus = Active</code>.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Generated: {generatedDate} • Source: CREA DDF OData v1 • Cache refresh: every 6 hours
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card data-testid="stat-total-listings">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Building2 className="h-4 w-4" />
                Active Listings
              </div>
              <div className="text-2xl md:text-3xl font-bold">{formatNum(data.totalListings)}</div>
              <div className="text-xs text-muted-foreground mt-1">{formatNum(data.totalWithPrice)} with list price</div>
            </CardContent>
          </Card>
          <Card data-testid="stat-median-price">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <DollarSign className="h-4 w-4" />
                Median Price
              </div>
              <div className="text-2xl md:text-3xl font-bold">{formatCurrency(data.national.medianPrice)}</div>
              <div className="text-xs text-muted-foreground mt-1">Avg: {formatCurrency(data.national.avgPrice)}</div>
            </CardContent>
          </Card>
          <Card data-testid="stat-median-psf">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Home className="h-4 w-4" />
                Median $/sqft
              </div>
              <div className="text-2xl md:text-3xl font-bold">${formatNum(data.national.medianPsf)}</div>
              <div className="text-xs text-muted-foreground mt-1">Avg: ${formatNum(data.national.avgPsf)} ({formatNum(data.totalWithSqft)} listings)</div>
            </CardContent>
          </Card>
          <Card data-testid="stat-pre-construction">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Hammer className="h-4 w-4" />
                Pre-Con Signals
              </div>
              <div className="text-2xl md:text-3xl font-bold">{formatNum(data.preConstructionKeywordHits.total)}</div>
              <div className="text-xs text-muted-foreground mt-1">{data.totalListings > 0 ? ((data.preConstructionKeywordHits.total / data.totalListings) * 100).toFixed(1) : "0.0"}% of listings</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <Card data-testid="card-by-province">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                New Construction Inventory by Province
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={provinceChartData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tickFormatter={formatNum} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => formatNum(v) + " listings"} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {provinceChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-price-bands">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Price Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.priceBands}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="band" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={formatNum} />
                    <Tooltip formatter={(v: number) => formatNum(v) + " listings"} />
                    <Bar dataKey="count" fill="hsl(220, 70%, 50%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8" data-testid="card-province-table">
          <CardHeader>
            <CardTitle>Provincial Pricing Detail</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium">Province</th>
                    <th className="text-right py-2 px-2 font-medium">Listings</th>
                    <th className="text-right py-2 px-2 font-medium">Median Price</th>
                    <th className="text-right py-2 px-2 font-medium">Avg Price</th>
                    <th className="text-right py-2 px-2 font-medium">Avg $/sqft</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byProvince.filter((p) => p.count >= 5).map((p) => (
                    <tr key={p.province} className="border-b hover:bg-muted/30" data-testid={`row-province-${p.province.toLowerCase().replace(/\s/g, '-')}`}>
                      <td className="py-2 px-2 font-medium">{p.province}</td>
                      <td className="text-right py-2 px-2 font-mono">{formatNum(p.count)}</td>
                      <td className="text-right py-2 px-2 font-mono">{formatCurrency(p.medianPrice)}</td>
                      <td className="text-right py-2 px-2 font-mono">{formatCurrency(p.avgPrice)}</td>
                      <td className="text-right py-2 px-2 font-mono">{p.avgPsf > 0 ? `$${formatNum(p.avgPsf)}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8" data-testid="card-top-cities">
          <CardHeader>
            <CardTitle>Top Cities by New Construction Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium">City</th>
                    <th className="text-left py-2 px-2 font-medium">Province</th>
                    <th className="text-right py-2 px-2 font-medium">Listings</th>
                    <th className="text-right py-2 px-2 font-medium">Median Price</th>
                    <th className="text-right py-2 px-2 font-medium">Avg $/sqft</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCity.slice(0, 20).map((c) => (
                    <tr key={`${c.city}-${c.province}`} className="border-b hover:bg-muted/30" data-testid={`row-city-${c.city.toLowerCase().replace(/\s/g, '-')}`}>
                      <td className="py-2 px-2 font-medium">{c.city}</td>
                      <td className="py-2 px-2 text-muted-foreground">{c.province}</td>
                      <td className="text-right py-2 px-2 font-mono">{formatNum(c.count)}</td>
                      <td className="text-right py-2 px-2 font-mono">{formatCurrency(c.medianPrice)}</td>
                      <td className="text-right py-2 px-2 font-mono">{c.avgPsf > 0 ? `$${formatNum(c.avgPsf)}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <Card data-testid="card-property-types">
            <CardHeader>
              <CardTitle>Property Type Mix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeChartData}
                      dataKey="count"
                      nameKey="type"
                      cx="50%"
                      cy="45%"
                      outerRadius={90}
                      labelLine={false}
                    >
                      {typeChartData.map((_, i) => (
                        <Cell key={i} fill={PROV_COLORS[i % PROV_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatNum(v) + " listings"} />
                    <Legend
                      verticalAlign="bottom"
                      align="center"
                      layout="horizontal"
                      iconType="circle"
                      wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-keyword-signals">
            <CardHeader>
              <CardTitle>Pre-Construction Signals in Remarks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground mb-3">
                  Occurrences of specific keywords in public remarks across all {formatNum(data.totalListings)} listings.
                </p>
                {[
                  { label: "Brand new", value: data.preConstructionKeywordHits.brandNew },
                  { label: "Pre-construction", value: data.preConstructionKeywordHits.preConstruction },
                  { label: "Assignment", value: data.preConstructionKeywordHits.assignment },
                  { label: "To be built", value: data.preConstructionKeywordHits.toBeBuilt },
                  { label: "Builder inventory", value: data.preConstructionKeywordHits.builderInventory },
                ].map((kw) => {
                  const pct = (kw.value / Math.max(1, data.totalListings)) * 100;
                  return (
                    <div key={kw.label}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{kw.label}</span>
                        <span className="font-mono text-sm">{formatNum(kw.value)} <span className="text-muted-foreground">({pct.toFixed(1)}%)</span></span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${Math.min(100, pct * 4)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8 border-dashed" data-testid="card-price-reductions">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Price Reductions — Not Available from CREA DDF
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              CREA's national DDF feed only exposes the current <code className="text-xs bg-muted px-1 rounded">ListPrice</code>. It does <strong>not</strong> publish <code className="text-xs bg-muted px-1 rounded">OriginalListPrice</code> or <code className="text-xs bg-muted px-1 rounded">PreviousListPrice</code>, so we cannot detect price reductions from a single snapshot.
            </p>
            <p>
              To measure reductions properly we'd need to snapshot ListPrice per MLS# over time and diff between snapshots. Regional RESO Web API feeds (TRREB/CREB/REBGV) do expose original price, but they're licensed per-board and not nationwide.
            </p>
            <p className="text-xs">
              Roadmap: a scheduled job that persists daily ListPrice snapshots per listing, enabling 7-day / 30-day / since-listing reduction metrics going forward.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-8" data-testid="card-top-expensive">
          <CardHeader>
            <CardTitle>Most Expensive New Construction Listings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium">MLS#</th>
                    <th className="text-left py-2 px-2 font-medium">Address</th>
                    <th className="text-left py-2 px-2 font-medium">City</th>
                    <th className="text-right py-2 px-2 font-medium">Price</th>
                    <th className="text-right py-2 px-2 font-medium">$/sqft</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topExpensive.slice(0, 15).map((l) => (
                    <tr key={l.listingKey} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-2 font-mono text-xs">{l.listingId || l.listingKey}</td>
                      <td className="py-2 px-2">{l.address || "—"}</td>
                      <td className="py-2 px-2 text-muted-foreground">{l.city}, {l.province}</td>
                      <td className="text-right py-2 px-2 font-mono">{formatCurrency(l.price)}</td>
                      <td className="text-right py-2 px-2 font-mono">{l.psf ? `$${formatNum(l.psf)}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Methodology</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Source:</strong> CREA Data Distribution Facility (DDF), OData v1 Property feed at <code className="text-xs bg-muted px-1 rounded">ddfapi.realtor.ca</code>.
              Pulled via the Realist.ca DDF plugin using OAuth2 client credentials.
            </p>
            <p>
              <strong className="text-foreground">New construction definition:</strong> active listings with <code className="text-xs bg-muted px-1 rounded">YearBuilt ≥ {data.anchorYear}</code>.
              DDF does not expose a structured <code className="text-xs bg-muted px-1 rounded">NewConstructionYN</code> field, so YearBuilt is the most reliable national proxy.
              The <code className="text-xs bg-muted px-1 rounded">PropertyCondition</code> field is populated inconsistently and cannot be relied upon nationally.
            </p>
            <p>
              <strong className="text-foreground">$/sqft calculation:</strong> uses <code className="text-xs bg-muted px-1 rounded">LivingArea</code> or <code className="text-xs bg-muted px-1 rounded">BuildingAreaTotal</code>, converted to square feet where units are metric.
              Outliers removed: sqft outside [250, 20,000] or $/sqft outside [$100, $5,000].
            </p>
            <p>
              <strong className="text-foreground">Pre-construction signals:</strong> keyword scan of <code className="text-xs bg-muted px-1 rounded">PublicRemarks</code> for "brand new", "pre-construction", "assignment", "to be built", "builder inventory". A single listing may hit multiple signals; the total count de-duplicates.
            </p>
            <p>
              <strong className="text-foreground">Known limitations:</strong> Quebec (Centris) and Manitoba are not well represented on the CREA DDF national feed.
              Pre-construction listings that haven't broken ground often have no <code className="text-xs bg-muted px-1 rounded">YearBuilt</code> set and may not appear.
              This is a current-state snapshot; historical price snapshots, canonical project matching, and rebate-offset analysis are planned for a future version.
            </p>
            <p>
              <strong className="text-foreground">Refresh:</strong> data is cached server-side for 6 hours. Each report generation paginates through the CREA DDF feed at 100 listings per page.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
