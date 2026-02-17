import { useState, useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, Search, Building, BedDouble, Bath, Maximize,
  DollarSign, MapPin, ChevronRight, ChevronLeft, ArrowUpDown,
  Calculator, X, Loader2, ArrowRight, Filter,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface RepliersListing {
  mlsNumber: string;
  listPrice: number | string;
  address: {
    area?: string;
    city?: string;
    country?: string;
    neighborhood?: string;
    streetDirection?: string;
    streetName?: string;
    streetNumber?: string;
    streetSuffix?: string;
    unitNumber?: string;
    zip?: string;
    state?: string;
    streetDirectionPrefix?: string;
  };
  map?: {
    latitude: number;
    longitude: number;
  };
  details?: {
    numBedrooms?: number;
    numBathroomsPlus?: number;
    numBathrooms?: number;
    sqft?: string;
    propertyType?: string;
    style?: string;
    yearBuilt?: string;
    description?: string;
    numGarageSpaces?: number;
    numParkingSpaces?: number;
    basement1?: string;
    extras?: string;
  };
  type?: string;
  class?: string;
  status?: string;
  images?: string[];
  lastStatus?: string;
  listDate?: string;
  daysOnMarket?: string | number;
  taxes?: {
    annualAmount?: number;
  };
}

interface ListingWithCapRate extends RepliersListing {
  capRate: number;
  estimatedMonthlyRent: number;
  annualNOI: number;
  rentSource: "market" | "estimated";
}

interface RentPulseData {
  city: string;
  province: string;
  bedrooms: string;
  medianRent: number;
  averageRent?: number;
  sampleSize: number;
}

const DEFAULT_RENTS: Record<string, Record<string, number>> = {
  "1": { default: 1400, CA: 1500, US: 1200 },
  "2": { default: 1800, CA: 2000, US: 1500 },
  "3": { default: 2200, CA: 2500, US: 1800 },
  "4": { default: 2600, CA: 3000, US: 2200 },
  "5": { default: 3000, CA: 3500, US: 2600 },
};

const EXPENSE_ASSUMPTIONS = {
  vacancyPercent: 5,
  maintenancePercent: 5,
  managementPercent: 8,
  insurancePerUnit: 100,
  propertyTaxPercent: 1.0,
};

const POPULAR_MARKETS = [
  { label: "All Markets", value: "all" },
  { label: "Toronto, ON", value: "Toronto" },
  { label: "Vancouver, BC", value: "Vancouver" },
  { label: "Calgary, AB", value: "Calgary" },
  { label: "Ottawa, ON", value: "Ottawa" },
  { label: "Montreal, QC", value: "Montreal" },
  { label: "Edmonton, AB", value: "Edmonton" },
  { label: "Winnipeg, MB", value: "Winnipeg" },
  { label: "Hamilton, ON", value: "Hamilton" },
  { label: "Kitchener, ON", value: "Kitchener" },
  { label: "London, ON", value: "London" },
  { label: "Halifax, NS", value: "Halifax" },
  { label: "Gig Harbor, WA", value: "Gig Harbor" },
  { label: "Fox Island, WA", value: "Fox Island" },
];

function formatPrice(price: number | string): string {
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(num)) return "$0";
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
  return "$" + num.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatPriceFull(price: number | string): string {
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(num)) return "$0";
  return "$" + num.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatAddress(addr: RepliersListing["address"]): string {
  if (!addr) return "Unknown";
  const parts = [
    addr.streetNumber,
    addr.streetDirectionPrefix,
    addr.streetName,
    addr.streetSuffix,
    addr.streetDirection,
  ].filter(Boolean);
  const street = parts.join(" ");
  const unit = addr.unitNumber ? `#${addr.unitNumber}` : "";
  const cityState = [addr.city, addr.state || addr.zip].filter(Boolean).join(", ");
  return [street, unit, cityState].filter(Boolean).join(", ") || "Unknown";
}

function formatShortAddress(addr: RepliersListing["address"]): string {
  if (!addr) return "Unknown";
  const parts = [
    addr.streetNumber,
    addr.streetName,
    addr.streetSuffix,
  ].filter(Boolean);
  return parts.join(" ") || "Unknown";
}

function getImageUrl(images: string[] | undefined): string | null {
  if (!images || images.length === 0) return null;
  const img = images[0];
  if (img.startsWith("http")) return img;
  return `https://cdn.repliers.io/${img}`;
}

function getCapRateColor(rate: number): string {
  if (rate >= 8) return "text-green-600 dark:text-green-400";
  if (rate >= 6) return "text-emerald-600 dark:text-emerald-400";
  if (rate >= 4) return "text-yellow-600 dark:text-yellow-400";
  if (rate >= 2) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function getCapRateBadgeVariant(rate: number): "default" | "secondary" | "outline" {
  if (rate >= 6) return "default";
  if (rate >= 4) return "secondary";
  return "outline";
}

function estimateMonthlyRent(
  bedrooms: number,
  city: string | undefined,
  country: string | undefined,
  rentData: RentPulseData[]
): { rent: number; source: "market" | "estimated" } {
  const bedroomStr = String(Math.max(1, bedrooms || 2));

  if (rentData.length > 0 && city) {
    const match = rentData.find(
      (r) => r.city.toLowerCase() === city.toLowerCase() && r.bedrooms === bedroomStr
    );
    if (match) {
      return { rent: match.medianRent, source: "market" };
    }
  }

  const countryKey = country === "CA" ? "CA" : country === "US" ? "US" : "default";
  const defaults = DEFAULT_RENTS[bedroomStr] || DEFAULT_RENTS["2"];
  return { rent: defaults[countryKey] || defaults.default, source: "estimated" };
}

function calculateCapRate(
  price: number,
  monthlyRent: number,
  annualTax?: number
): { capRate: number; annualNOI: number } {
  if (price <= 0) return { capRate: 0, annualNOI: 0 };

  const grossAnnualRent = monthlyRent * 12;
  const effectiveRent = grossAnnualRent * (1 - EXPENSE_ASSUMPTIONS.vacancyPercent / 100);
  const maintenance = grossAnnualRent * (EXPENSE_ASSUMPTIONS.maintenancePercent / 100);
  const management = grossAnnualRent * (EXPENSE_ASSUMPTIONS.managementPercent / 100);
  const insurance = EXPENSE_ASSUMPTIONS.insurancePerUnit * 12;
  const propertyTax = annualTax || price * (EXPENSE_ASSUMPTIONS.propertyTaxPercent / 100);

  const annualNOI = effectiveRent - maintenance - management - insurance - propertyTax;
  const capRate = (annualNOI / price) * 100;

  return { capRate: Math.max(0, capRate), annualNOI };
}

export default function CapRates() {
  const [, setLocation] = useLocation();
  const [searchCity, setSearchCity] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minBeds, setMinBeds] = useState("any");
  const [propertyType, setPropertyType] = useState("all");
  const [minCapRate, setMinCapRate] = useState("any");
  const [sortBy, setSortBy] = useState<"capRate" | "priceAsc" | "priceDesc">("capRate");
  const [page, setPage] = useState(1);
  const [listings, setListings] = useState<RepliersListing[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedListing, setSelectedListing] = useState<ListingWithCapRate | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const { data: rentData = [] } = useQuery<RentPulseData[]>({
    queryKey: ["/api/rents/pulse"],
  });

  const fetchListings = useCallback(async (pageNum = 1) => {
    setIsSearching(true);
    try {
      const body: Record<string, any> = {
        resultsPerPage: 24,
        pageNum: pageNum,
        status: "A",
        class: "ResidentialProperty",
      };

      if (searchCity && searchCity !== "all") body.city = searchCity;
      if (minPrice) body.minPrice = parseInt(minPrice);
      if (maxPrice) body.maxPrice = parseInt(maxPrice);
      if (minBeds && minBeds !== "any") body.minBeds = parseInt(minBeds);
      if (propertyType && propertyType !== "all") body.propertyType = propertyType;

      const response = await apiRequest("POST", "/api/repliers/listings", body);
      const data = await response.json();

      if (data.listings) {
        setListings(data.listings);
        setTotalCount(data.count || 0);
        setNumPages(data.numPages || 0);
        setPage(data.page || 1);
      } else {
        setListings([]);
        setTotalCount(0);
        setNumPages(0);
      }
      setHasSearched(true);
    } catch (error) {
      console.error("Error fetching listings:", error);
      setListings([]);
      setTotalCount(0);
    } finally {
      setIsSearching(false);
    }
  }, [searchCity, minPrice, maxPrice, minBeds, propertyType]);

  const listingsWithCapRates = useMemo((): ListingWithCapRate[] => {
    return listings
      .map((listing) => {
        const price = typeof listing.listPrice === "string" ? parseFloat(listing.listPrice) : listing.listPrice;
        const bedrooms = listing.details?.numBedrooms || 2;
        const { rent, source } = estimateMonthlyRent(
          bedrooms,
          listing.address?.city,
          listing.address?.country,
          rentData
        );
        const { capRate, annualNOI } = calculateCapRate(
          price,
          rent,
          listing.taxes?.annualAmount || undefined
        );
        return {
          ...listing,
          capRate,
          estimatedMonthlyRent: rent,
          annualNOI,
          rentSource: source,
        };
      })
      .filter((l) => {
        if (minCapRate && minCapRate !== "any" && l.capRate < parseFloat(minCapRate)) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "capRate") return b.capRate - a.capRate;
        const priceA = typeof a.listPrice === "string" ? parseFloat(a.listPrice) : a.listPrice;
        const priceB = typeof b.listPrice === "string" ? parseFloat(b.listPrice) : b.listPrice;
        if (sortBy === "priceAsc") return priceA - priceB;
        return priceB - priceA;
      });
  }, [listings, rentData, minCapRate, sortBy]);

  const handleSearch = () => {
    setPage(1);
    fetchListings(1);
  };

  const handlePageChange = (newPage: number) => {
    fetchListings(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAnalyzeListing = (listing: ListingWithCapRate) => {
    const addr = formatAddress(listing.address);
    const price = typeof listing.listPrice === "string" ? parseFloat(listing.listPrice) : listing.listPrice;
    const params = new URLSearchParams();
    params.set("address", addr);
    if (price) params.set("price", String(price));
    if (listing.details?.numBedrooms) params.set("beds", String(listing.details.numBedrooms));
    if (listing.details?.numBathrooms) params.set("baths", String(listing.details.numBathrooms));
    if (listing.details?.sqft) params.set("sqft", listing.details.sqft);
    if (listing.details?.yearBuilt) params.set("yearBuilt", listing.details.yearBuilt);
    if (listing.mlsNumber) params.set("mls", listing.mlsNumber);
    if (listing.address?.city) params.set("city", listing.address.city);
    if (listing.address?.state) params.set("state", listing.address.state);
    if (listing.estimatedMonthlyRent) params.set("rent", String(listing.estimatedMonthlyRent));
    setLocation(`/tools/analyzer?${params.toString()}`);
  };

  useEffect(() => {
    fetchListings(1);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-page-title">Cap Rates Explorer</h1>
              <p className="text-muted-foreground" data-testid="text-page-subtitle">
                Browse properties by cap rate. Find the best returns across markets.
              </p>
            </div>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="search-city" className="text-xs text-muted-foreground mb-1 block">Market</Label>
                <Select
                  value={searchCity}
                  onValueChange={(v) => setSearchCity(v)}
                >
                  <SelectTrigger data-testid="select-market">
                    <SelectValue placeholder="Select market" />
                  </SelectTrigger>
                  <SelectContent>
                    {POPULAR_MARKETS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[120px]">
                <Label className="text-xs text-muted-foreground mb-1 block">Min Price</Label>
                <Input
                  type="number"
                  placeholder="$0"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  data-testid="input-min-price"
                />
              </div>

              <div className="min-w-[120px]">
                <Label className="text-xs text-muted-foreground mb-1 block">Max Price</Label>
                <Input
                  type="number"
                  placeholder="Any"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  data-testid="input-max-price"
                />
              </div>

              <div className="min-w-[90px]">
                <Label className="text-xs text-muted-foreground mb-1 block">Beds</Label>
                <Select value={minBeds} onValueChange={setMinBeds}>
                  <SelectTrigger data-testid="select-beds">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="1">1+</SelectItem>
                    <SelectItem value="2">2+</SelectItem>
                    <SelectItem value="3">3+</SelectItem>
                    <SelectItem value="4">4+</SelectItem>
                    <SelectItem value="5">5+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                data-testid="button-more-filters"
              >
                <Filter className="h-4 w-4 mr-1" />
                More
              </Button>

              <Button
                onClick={handleSearch}
                disabled={isSearching}
                data-testid="button-search"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Search
              </Button>
            </div>

            {showFilters && (
              <div className="flex flex-wrap gap-3 items-end mt-4 pt-4 border-t">
                <div className="min-w-[140px]">
                  <Label className="text-xs text-muted-foreground mb-1 block">Property Type</Label>
                  <Select value={propertyType} onValueChange={setPropertyType}>
                    <SelectTrigger data-testid="select-property-type">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="Detached">Detached</SelectItem>
                      <SelectItem value="Semi-Detached">Semi-Detached</SelectItem>
                      <SelectItem value="Townhouse">Townhouse</SelectItem>
                      <SelectItem value="Condo">Condo</SelectItem>
                      <SelectItem value="Duplex">Duplex</SelectItem>
                      <SelectItem value="Triplex">Triplex</SelectItem>
                      <SelectItem value="Multiplex">Multiplex</SelectItem>
                      <SelectItem value="Residential">Residential</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-[120px]">
                  <Label className="text-xs text-muted-foreground mb-1 block">Min Cap Rate</Label>
                  <Select value={minCapRate} onValueChange={setMinCapRate}>
                    <SelectTrigger data-testid="select-min-cap-rate">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="2">2%+</SelectItem>
                      <SelectItem value="4">4%+</SelectItem>
                      <SelectItem value="6">6%+</SelectItem>
                      <SelectItem value="8">8%+</SelectItem>
                      <SelectItem value="10">10%+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-[160px]">
                  <Label className="text-xs text-muted-foreground mb-1 block">Sort By</Label>
                  <Select
                    value={sortBy}
                    onValueChange={(v) => setSortBy(v as any)}
                  >
                    <SelectTrigger data-testid="select-sort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="capRate">Highest Cap Rate</SelectItem>
                      <SelectItem value="priceAsc">Price: Low to High</SelectItem>
                      <SelectItem value="priceDesc">Price: High to Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {hasSearched && !isSearching && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground" data-testid="text-results-count">
              {listingsWithCapRates.length > 0
                ? `Showing ${listingsWithCapRates.length} of ${totalCount.toLocaleString()} properties`
                : `No properties found`}
              {searchCity && searchCity !== "all" ? ` in ${searchCity}` : ""}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowUpDown className="h-3 w-3" />
              {sortBy === "capRate" ? "Sorted by cap rate" : sortBy === "priceAsc" ? "Price: low to high" : "Price: high to low"}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className={selectedListing ? "lg:col-span-2" : "lg:col-span-3"}>
            {isSearching && !hasSearched ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-0">
                      <Skeleton className="h-40 w-full rounded-t-lg" />
                      <div className="p-4 space-y-2">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : listingsWithCapRates.length > 0 ? (
              <>
                <div className={`grid gap-4 ${selectedListing ? "sm:grid-cols-1 md:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}>
                  {listingsWithCapRates.map((listing) => {
                    const imgUrl = getImageUrl(listing.images);
                    const price = typeof listing.listPrice === "string" ? parseFloat(listing.listPrice) : listing.listPrice;
                    return (
                      <Card
                        key={listing.mlsNumber}
                        className="overflow-visible hover-elevate cursor-pointer group"
                        onClick={() => setSelectedListing(listing)}
                        data-testid={`card-listing-${listing.mlsNumber}`}
                      >
                        <CardContent className="p-0">
                          <div className="relative">
                            {imgUrl ? (
                              <img
                                src={imgUrl}
                                alt={formatShortAddress(listing.address)}
                                className="w-full h-40 object-cover rounded-t-lg"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "";
                                  (e.target as HTMLImageElement).className = "w-full h-40 bg-muted rounded-t-lg flex items-center justify-center";
                                }}
                              />
                            ) : (
                              <div className="w-full h-40 bg-muted rounded-t-lg flex items-center justify-center">
                                <Building className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}

                            <div className="absolute top-2 right-2">
                              <Badge
                                variant={getCapRateBadgeVariant(listing.capRate)}
                                data-testid={`badge-cap-rate-${listing.mlsNumber}`}
                              >
                                {listing.capRate.toFixed(1)}% cap
                              </Badge>
                            </div>

                            {listing.rentSource === "estimated" && (
                              <div className="absolute top-2 left-2">
                                <Badge variant="outline" className="text-[10px] bg-background/80 backdrop-blur-sm">
                                  Est. rent
                                </Badge>
                              </div>
                            )}
                          </div>

                          <div className="p-3">
                            <div className="flex items-baseline justify-between gap-2 mb-1">
                              <span className="text-lg font-bold" data-testid={`text-price-${listing.mlsNumber}`}>
                                {formatPrice(price)}
                              </span>
                              <span className={`text-sm font-semibold ${getCapRateColor(listing.capRate)}`}>
                                {listing.capRate.toFixed(1)}%
                              </span>
                            </div>

                            <p className="text-xs text-muted-foreground truncate mb-2" data-testid={`text-address-${listing.mlsNumber}`}>
                              {formatShortAddress(listing.address)}, {listing.address?.city}
                            </p>

                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {listing.details?.numBedrooms != null && (
                                <span className="flex items-center gap-1">
                                  <BedDouble className="h-3 w-3" />
                                  {listing.details.numBedrooms}
                                </span>
                              )}
                              {listing.details?.numBathrooms != null && (
                                <span className="flex items-center gap-1">
                                  <Bath className="h-3 w-3" />
                                  {listing.details.numBathrooms}
                                </span>
                              )}
                              {listing.details?.sqft && (
                                <span className="flex items-center gap-1">
                                  <Maximize className="h-3 w-3" />
                                  {listing.details.sqft}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs">
                              <span className="text-muted-foreground">
                                Rent: {formatPrice(listing.estimatedMonthlyRent)}/mo
                              </span>
                              <span className="text-muted-foreground">
                                NOI: {formatPrice(listing.annualNOI)}/yr
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {numPages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <p className="text-sm text-muted-foreground">
                      Page {page} of {numPages}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page <= 1 || isSearching}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page >= numPages || isSearching}
                        data-testid="button-next-page"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <Card className="mt-8">
                  <CardContent className="py-8 text-center">
                    <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                    <h3 className="text-lg font-semibold mb-2">Can't find what you're looking for?</h3>
                    <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                      Create a BuyBox with your specific investment criteria and let our network of realtors find matching properties for you.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setLocation("/tools/buybox")}
                      data-testid="button-goto-buybox"
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      Create Your BuyBox
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              </>
            ) : hasSearched ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Search className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Properties Found</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                    Try adjusting your filters or searching in a different market. You can also create a BuyBox to get notified when matching properties become available.
                  </p>
                  <div className="flex flex-wrap gap-3 justify-center">
                    <Button variant="outline" onClick={() => {
                      setSearchCity("");
                      setMinPrice("");
                      setMaxPrice("");
                      setMinBeds("");
                      setPropertyType("");
                      setMinCapRate("");
                      fetchListings(1);
                    }} data-testid="button-clear-filters">
                      Clear Filters
                    </Button>
                    <Button
                      onClick={() => setLocation("/tools/buybox")}
                      data-testid="button-goto-buybox-empty"
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      Create BuyBox
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>

          {selectedListing && (
            <div className="lg:col-span-1" data-testid="panel-listing-detail">
              <div className="sticky top-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-xl">
                            {formatPriceFull(selectedListing.listPrice)}
                          </CardTitle>
                          <Badge variant={getCapRateBadgeVariant(selectedListing.capRate)} data-testid="badge-detail-cap-rate">
                            {selectedListing.capRate.toFixed(1)}% cap
                          </Badge>
                        </div>
                        <CardDescription className="text-xs">
                          {formatAddress(selectedListing.address)}
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setSelectedListing(null)}
                        data-testid="button-close-detail"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedListing.images && selectedListing.images.length > 0 && (
                      <div className="grid grid-cols-2 gap-1.5">
                        {selectedListing.images.slice(0, 4).map((img, idx) => {
                          const url = img.startsWith("http") ? img : `https://cdn.repliers.io/${img}`;
                          return (
                            <img
                              key={idx}
                              src={url}
                              alt={`Photo ${idx + 1}`}
                              className={`rounded-md object-cover w-full ${idx === 0 ? "col-span-2 h-[160px]" : "h-[80px]"}`}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              data-testid={`img-detail-${idx}`}
                            />
                          );
                        })}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                      {selectedListing.details?.numBedrooms != null && (
                        <div className="flex items-center gap-1">
                          <BedDouble className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{selectedListing.details.numBedrooms}</span>
                          <span className="text-xs text-muted-foreground">beds</span>
                        </div>
                      )}
                      {selectedListing.details?.numBathrooms != null && (
                        <div className="flex items-center gap-1">
                          <Bath className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{selectedListing.details.numBathrooms}</span>
                          <span className="text-xs text-muted-foreground">baths</span>
                        </div>
                      )}
                      {selectedListing.details?.sqft && (
                        <div className="flex items-center gap-1">
                          <Maximize className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{selectedListing.details.sqft}</span>
                          <span className="text-xs text-muted-foreground">sqft</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {selectedListing.details?.propertyType && (
                        <Badge variant="outline" className="text-xs">{selectedListing.details.propertyType}</Badge>
                      )}
                      {selectedListing.details?.style && (
                        <Badge variant="outline" className="text-xs">{selectedListing.details.style}</Badge>
                      )}
                      {selectedListing.details?.yearBuilt && (
                        <Badge variant="outline" className="text-xs">Built {selectedListing.details.yearBuilt}</Badge>
                      )}
                    </div>

                    <Separator />

                    <div>
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Cap Rate Breakdown
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Monthly Rent</span>
                          <span className="font-medium">
                            {formatPriceFull(selectedListing.estimatedMonthlyRent)}
                            {selectedListing.rentSource === "estimated" && (
                              <span className="text-[10px] text-muted-foreground ml-1">(est.)</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Gross Annual Rent</span>
                          <span className="font-medium">{formatPriceFull(selectedListing.estimatedMonthlyRent * 12)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Vacancy ({EXPENSE_ASSUMPTIONS.vacancyPercent}%)</span>
                          <span className="text-red-500">-{formatPriceFull(selectedListing.estimatedMonthlyRent * 12 * EXPENSE_ASSUMPTIONS.vacancyPercent / 100)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Maintenance ({EXPENSE_ASSUMPTIONS.maintenancePercent}%)</span>
                          <span className="text-red-500">-{formatPriceFull(selectedListing.estimatedMonthlyRent * 12 * EXPENSE_ASSUMPTIONS.maintenancePercent / 100)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Management ({EXPENSE_ASSUMPTIONS.managementPercent}%)</span>
                          <span className="text-red-500">-{formatPriceFull(selectedListing.estimatedMonthlyRent * 12 * EXPENSE_ASSUMPTIONS.managementPercent / 100)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Insurance</span>
                          <span className="text-red-500">-{formatPriceFull(EXPENSE_ASSUMPTIONS.insurancePerUnit * 12)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Property Tax</span>
                          <span className="text-red-500">
                            -{formatPriceFull(
                              selectedListing.taxes?.annualAmount ||
                              (typeof selectedListing.listPrice === "string" ? parseFloat(selectedListing.listPrice) : selectedListing.listPrice) * EXPENSE_ASSUMPTIONS.propertyTaxPercent / 100
                            )}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-semibold">
                          <span>Annual NOI</span>
                          <span className={selectedListing.annualNOI >= 0 ? "text-green-600" : "text-red-600"}>
                            {formatPriceFull(selectedListing.annualNOI)}
                          </span>
                        </div>
                        <div className="flex justify-between font-bold text-lg">
                          <span>Cap Rate</span>
                          <span className={getCapRateColor(selectedListing.capRate)}>
                            {selectedListing.capRate.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">MLS#</p>
                        <p className="font-medium">{selectedListing.mlsNumber}</p>
                      </div>
                      {selectedListing.address?.neighborhood && (
                        <div>
                          <p className="text-muted-foreground">Neighborhood</p>
                          <p className="font-medium">{selectedListing.address.neighborhood}</p>
                        </div>
                      )}
                      {selectedListing.daysOnMarket != null && (
                        <div>
                          <p className="text-muted-foreground">Days on Market</p>
                          <p className="font-medium">{selectedListing.daysOnMarket}</p>
                        </div>
                      )}
                      {selectedListing.details?.numParkingSpaces != null && (
                        <div>
                          <p className="text-muted-foreground">Parking</p>
                          <p className="font-medium">{selectedListing.details.numParkingSpaces} spaces</p>
                        </div>
                      )}
                    </div>

                    {selectedListing.details?.description && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-xs font-medium mb-1">Description</p>
                          <p className="text-xs text-muted-foreground line-clamp-4">
                            {selectedListing.details.description}
                          </p>
                        </div>
                      </>
                    )}

                    <Button
                      className="w-full"
                      onClick={() => handleAnalyzeListing(selectedListing)}
                      data-testid="button-analyze-listing"
                    >
                      <Calculator className="h-4 w-4 mr-2" />
                      Analyze in Deal Analyzer
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          <p>
            Cap rates are estimated using {rentData.length > 0 ? "market rent data" : "estimated market rents"} and standard expense assumptions
            (vacancy {EXPENSE_ASSUMPTIONS.vacancyPercent}%, maintenance {EXPENSE_ASSUMPTIONS.maintenancePercent}%, management {EXPENSE_ASSUMPTIONS.managementPercent}%, property tax {EXPENSE_ASSUMPTIONS.propertyTaxPercent}%).
            Actual returns may vary. Always perform your own due diligence.
          </p>
        </div>
      </main>
    </div>
  );
}
