import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Home, Search } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type UsListing = {
  id: string;
  source: string;
  sourceId: string;
  sourceUrl?: string | null;
  formattedAddress: string;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  propertyType?: string | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  lotSqft?: number | null;
  yearBuilt?: number | null;
  listPrice?: number | null;
  daysOnMarket?: number | null;
  status?: string | null;
  isActive: boolean;
  statusConfidence?: string | null;
  scrapedAt: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastCheckedAt?: string | null;
  soldDetectedAt?: string | null;
  offMarketDetectedAt?: string | null;
};

type ApiResponse = {
  listings: UsListing[];
  total: number;
  limit: number;
  offset: number;
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-US");

export default function UsListings() {
  const [filters, setFilters] = useState({
    city: "",
    state: "",
    minPrice: "",
    maxPrice: "",
    beds: "",
    baths: "",
    propertyType: "",
    status: "",
    isActive: "true",
    source: "homeharvest",
  });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value.trim()) params.set(key, value.trim());
    });
    params.set("limit", "60");
    return `/api/us-listings?${params.toString()}`;
  }, [filters]);

  const { data, isLoading, error } = useQuery<ApiResponse>({ queryKey: [query] });
  const listings = data?.listings ?? [];

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="US Listings Beta"
        description="Internal beta browser for HomeHarvest-sourced US listings in Realist.ca."
        canonicalUrl="/listings/us"
        noIndex
      />
      <Navigation />

      <main className="container mx-auto max-w-7xl px-4 py-10">
        <header className="mb-8">
          <Badge variant="secondary" className="mb-3">Beta/Internal</Badge>
          <h1 className="text-4xl font-bold tracking-tight mb-3">US Listings</h1>
          <p className="text-muted-foreground max-w-3xl">
            HomeHarvest-sourced US listings are isolated from Canadian CREA listings while the schema and underwriting workflows mature.
          </p>
        </header>

        <section className="mb-8 rounded-md border bg-card p-4">
          <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-8">
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">City</span>
              <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={filters.city} onChange={(e) => updateFilter("city", e.target.value)} placeholder="Detroit" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">State</span>
              <input className="h-10 w-full rounded-md border bg-background px-3 text-sm uppercase" value={filters.state} onChange={(e) => updateFilter("state", e.target.value.toUpperCase())} placeholder="MI" maxLength={2} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Min Price</span>
              <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={filters.minPrice} onChange={(e) => updateFilter("minPrice", e.target.value)} placeholder="100000" inputMode="numeric" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Max Price</span>
              <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={filters.maxPrice} onChange={(e) => updateFilter("maxPrice", e.target.value)} placeholder="350000" inputMode="numeric" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Beds</span>
              <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={filters.beds} onChange={(e) => updateFilter("beds", e.target.value)} placeholder="3" inputMode="numeric" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Baths</span>
              <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={filters.baths} onChange={(e) => updateFilter("baths", e.target.value)} placeholder="2" inputMode="decimal" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Status</span>
              <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={filters.status} onChange={(e) => updateFilter("status", e.target.value)} placeholder="for_sale" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Source</span>
              <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={filters.source} onChange={(e) => updateFilter("source", e.target.value)} placeholder="homeharvest" />
            </label>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <label className="flex-1 space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Property Type</span>
              <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={filters.propertyType} onChange={(e) => updateFilter("propertyType", e.target.value)} placeholder="single family, multi family, condo" />
            </label>
            <Button type="button" variant="outline" className="mt-5" onClick={() => setFilters({ city: "", state: "", minPrice: "", maxPrice: "", beds: "", baths: "", propertyType: "", status: "", isActive: "true", source: "homeharvest" })}>
              Clear
            </Button>
          </div>
        </section>

        <div className="mb-5 flex flex-wrap gap-2">
          {[
            { label: "For Sale", status: "for_sale", isActive: "true" },
            { label: "Active", status: "", isActive: "true" },
            { label: "Sold", status: "sold", isActive: "false" },
            { label: "Off Market", status: "off_market_unknown", isActive: "false" },
            { label: "All", status: "", isActive: "" },
          ].map((tab) => (
            <Button
              key={tab.label}
              type="button"
              size="sm"
              variant={filters.status === tab.status && filters.isActive === tab.isActive ? "default" : "outline"}
              onClick={() => setFilters((current) => ({ ...current, status: tab.status, isActive: tab.isActive }))}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Loading listings..." : `${data?.total ?? 0} matching listings`}
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Failed to load US listings.
          </div>
        )}

        {!isLoading && !error && listings.length === 0 && (
          <div className="rounded-md border border-dashed p-10 text-center">
            <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No US listings found.</p>
            <p className="text-sm text-muted-foreground">Sync HomeHarvest data, or loosen the filters.</p>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing) => (
            <Card key={listing.id} className="h-full">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="secondary">{listing.source}</Badge>
                  <div className="flex gap-2">
                    <Badge variant={listing.isActive ? "default" : "outline"}>
                      {listing.isActive ? "active" : "inactive"}
                    </Badge>
                    {listing.status && <Badge variant="outline">{listing.status}</Badge>}
                  </div>
                </div>
                <CardTitle className="text-lg leading-snug">{listing.formattedAddress}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-baseline justify-between gap-4">
                  <div className="text-2xl font-semibold">
                    {listing.listPrice ? currency.format(listing.listPrice) : "Price unavailable"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {[listing.city, listing.state].filter(Boolean).join(", ")}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div><span className="font-medium">{listing.beds ?? "-"}</span><br /><span className="text-muted-foreground">beds</span></div>
                  <div><span className="font-medium">{listing.baths ?? "-"}</span><br /><span className="text-muted-foreground">baths</span></div>
                  <div><span className="font-medium">{listing.sqft ? number.format(listing.sqft) : "-"}</span><br /><span className="text-muted-foreground">sqft</span></div>
                  <div><span className="font-medium">{listing.daysOnMarket ?? "-"}</span><br /><span className="text-muted-foreground">DOM</span></div>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Home className="h-4 w-4" />
                    {listing.propertyType || "Unknown type"}
                  </span>
                  {listing.sourceUrl && (
                    <a href={listing.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      Source <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                <div className="border-t pt-3 text-xs text-muted-foreground">
                  <div>Last seen: {listing.lastSeenAt ? new Date(listing.lastSeenAt).toLocaleString() : "-"}</div>
                  {listing.soldDetectedAt && <div>Sold detected: {new Date(listing.soldDetectedAt).toLocaleString()}</div>}
                  {listing.offMarketDetectedAt && <div>Off market detected: {new Date(listing.offMarketDetectedAt).toLocaleString()}</div>}
                  {listing.statusConfidence && <div>Confidence: {listing.statusConfidence}</div>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
