import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, Search, Building, BedDouble, Bath, Maximize,
  DollarSign, MapPin, ChevronRight, ChevronLeft, ArrowUpDown,
  Calculator, X, Loader2, ArrowRight, Filter, Map, LayoutGrid,
  RefreshCw, ChevronDown, ChevronUp, List,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getCmhcRent } from "@shared/cmhcRents";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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
  rentSource: "market" | "estimated" | "actual" | "cmhc_city" | "cmhc_province";
  totalActualRent?: number;
  dataSource?: "crea_ddf" | "repliers";
}

interface RentPulseData {
  city: string;
  province: string;
  bedrooms: string;
  medianRent: number;
  averageRent?: number;
  sampleSize: number;
}

interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

const EXPENSE_ASSUMPTIONS = {
  vacancyPercent: 5,
  maintenancePercent: 5,
  managementPercent: 8,
  insurancePerUnit: 100,
  propertyTaxPercent: 1.0,
};

const TORONTO_CENTER: [number, number] = [43.65, -79.38];
const DEFAULT_ZOOM = 11;

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
  const img = images.find(i => i.startsWith("http") && !i.includes("youriguide") && !i.includes("virtualtour"));
  if (!img) {
    const first = images[0];
    if (first.startsWith("http")) return first;
    return `https://cdn.repliers.io/${first}`;
  }
  return img;
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

function getCapRateMarkerColor(rate: number): string {
  if (rate >= 8) return "#16a34a";
  if (rate >= 6) return "#059669";
  if (rate >= 4) return "#ca8a04";
  if (rate >= 2) return "#ea580c";
  return "#dc2626";
}

function createCapRateIcon(capRate: number, isSelected: boolean): L.DivIcon {
  const color = getCapRateMarkerColor(capRate);
  const size = isSelected ? 44 : 36;
  const fontSize = isSelected ? 13 : 11;
  const border = isSelected ? "3px solid #2563eb" : "2px solid white";
  const shadow = isSelected ? "0 0 0 2px #2563eb, 0 2px 8px rgba(0,0,0,0.3)" : "0 2px 6px rgba(0,0,0,0.3)";
  const zIndex = isSelected ? 1000 : 1;

  return L.divIcon({
    className: "cap-rate-marker",
    html: `<div style="
      background: ${color};
      color: white;
      font-weight: 700;
      font-size: ${fontSize}px;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: ${border};
      box-shadow: ${shadow};
      z-index: ${zIndex};
      cursor: pointer;
      transition: transform 0.15s ease;
      line-height: 1;
      font-family: system-ui, -apple-system, sans-serif;
    ">${capRate.toFixed(1)}%</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function estimateMonthlyRent(
  bedrooms: number,
  city: string | undefined,
  country: string | undefined,
  rentData: RentPulseData[],
  province?: string
): { rent: number; source: "market" | "estimated" | "cmhc_city" | "cmhc_province" } {
  const bedroomStr = String(Math.max(1, bedrooms || 2));

  if (rentData.length > 0 && city) {
    const match = rentData.find(
      (r) => r.city.toLowerCase() === city.toLowerCase() && r.bedrooms === bedroomStr
    );
    if (match) {
      return { rent: match.medianRent, source: "market" };
    }
  }

  const cmhc = getCmhcRent(bedrooms, city, province, country);
  if (cmhc.source === "cmhc_city") return { rent: cmhc.rent, source: "cmhc_city" };
  if (cmhc.source === "cmhc_province") return { rent: cmhc.rent, source: "cmhc_province" };

  return { rent: cmhc.rent, source: "estimated" };
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

function MapEventHandler({
  onBoundsChange,
}: {
  onBoundsChange: (bounds: MapBounds) => void;
}) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useMapEvents({
    moveend: (e) => {
      const map = e.target;
      const b = map.getBounds();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onBoundsChange({
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest(),
        });
      }, 600);
    },
    zoomend: (e) => {
      const map = e.target;
      const b = map.getBounds();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onBoundsChange({
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest(),
        });
      }, 600);
    },
  });

  return null;
}

function FlyToLocation({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], zoom || map.getZoom(), { duration: 1.2 });
  }, [lat, lng, zoom, map]);
  return null;
}

export default function CapRates() {
  const [, setLocation] = useLocation();
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
  const [dataSource, setDataSource] = useState<"crea_ddf" | "repliers" | null>(null);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [showMobileList, setShowMobileList] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const listingRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const searchInProgress = useRef(false);

  const { data: rentData = [] } = useQuery<RentPulseData[]>({
    queryKey: ["/api/rents/pulse"],
  });

  const { data: ddfStatus } = useQuery<{ configured: boolean; authenticated: boolean }>({
    queryKey: ["/api/ddf/status"],
  });

  const fetchListingsForBounds = useCallback(async (bounds: MapBounds, pageNum = 1) => {
    if (searchInProgress.current) return;
    searchInProgress.current = true;
    setIsSearching(true);
    try {
      const useDdf = ddfStatus?.configured && ddfStatus?.authenticated;

      if (useDdf) {
        const ddfBody: Record<string, any> = {
          resultsPerPage: 50,
          pageNum,
          latitudeMin: bounds.south,
          latitudeMax: bounds.north,
          longitudeMin: bounds.west,
          longitudeMax: bounds.east,
        };

        if (minPrice) ddfBody.minPrice = parseInt(minPrice);
        if (maxPrice) ddfBody.maxPrice = parseInt(maxPrice);
        if (minBeds && minBeds !== "any") ddfBody.minBeds = parseInt(minBeds);
        if (propertyType && propertyType !== "all") ddfBody.propertySubType = propertyType;

        try {
          const response = await apiRequest("POST", "/api/ddf/listings", ddfBody);
          const data = await response.json();

          if (data.listings) {
            setListings(data.listings);
            setTotalCount(data.count || 0);
            setNumPages(data.numPages || 0);
            setPage(data.page || 1);
            setDataSource("crea_ddf");
            setHasSearched(true);
            return;
          }
        } catch (ddfError) {
          console.warn("DDF search failed, falling back to Repliers:", ddfError);
        }
      }

      const body: Record<string, any> = {
        resultsPerPage: 50,
        pageNum,
        status: "A",
        class: "ResidentialProperty",
        map: `${bounds.south},${bounds.west}|${bounds.north},${bounds.east}`,
      };

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
        setDataSource("repliers");
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
      searchInProgress.current = false;
    }
  }, [minPrice, maxPrice, minBeds, propertyType, ddfStatus]);

  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    setMapBounds(bounds);
    setSelectedListing(null);
    fetchListingsForBounds(bounds, 1);
  }, [fetchListingsForBounds]);

  const listingsWithCapRates = useMemo((): ListingWithCapRate[] => {
    return listings
      .map((listing: any) => {
        const price = typeof listing.listPrice === "string" ? parseFloat(listing.listPrice) : listing.listPrice;
        const bedrooms = listing.details?.numBedrooms || 2;

        let rent: number;
        let source: "market" | "estimated" | "actual" | "cmhc_city" | "cmhc_province";
        if (listing.totalActualRent && listing.totalActualRent > 0) {
          rent = listing.totalActualRent / 12;
          source = "actual";
        } else {
          const estimated = estimateMonthlyRent(
            bedrooms,
            listing.address?.city,
            listing.address?.country,
            rentData,
            listing.address?.state
          );
          rent = estimated.rent;
          source = estimated.source;
        }

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

  const mappableListings = useMemo(
    () => listingsWithCapRates.filter((l) => l.map?.latitude && l.map?.longitude),
    [listingsWithCapRates]
  );

  const handleRefresh = () => {
    if (mapBounds) {
      fetchListingsForBounds(mapBounds, 1);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (mapBounds) {
      fetchListingsForBounds(mapBounds, newPage);
    }
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

  const handleSelectListing = (listing: ListingWithCapRate) => {
    setSelectedListing(listing);
    if (listing.map?.latitude && listing.map?.longitude) {
      setFlyTo({ lat: listing.map.latitude, lng: listing.map.longitude });
    }
    const ref = listingRefs.current[listing.mlsNumber];
    if (ref) {
      ref.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const renderListingCard = (listing: ListingWithCapRate) => {
    const imgUrl = getImageUrl(listing.images);
    const price = typeof listing.listPrice === "string" ? parseFloat(listing.listPrice) : listing.listPrice;
    const isSelected = selectedListing?.mlsNumber === listing.mlsNumber;

    return (
      <div
        key={listing.mlsNumber}
        ref={(el) => { listingRefs.current[listing.mlsNumber] = el; }}
        className={`rounded-lg border cursor-pointer transition-all ${
          isSelected
            ? "border-primary bg-primary/5 ring-1 ring-primary"
            : "border-border hover:border-primary/50 hover:shadow-sm"
        }`}
        onClick={() => handleSelectListing(listing)}
        data-testid={`card-listing-${listing.mlsNumber}`}
      >
        <div className="flex gap-3 p-2.5">
          <div className="relative flex-shrink-0">
            {imgUrl ? (
              <img
                src={imgUrl}
                alt={formatShortAddress(listing.address)}
                className="w-24 h-20 object-cover rounded-md"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="w-24 h-20 bg-muted rounded-md flex items-center justify-center">
                <Building className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1 mb-0.5">
              <span className="text-sm font-bold" data-testid={`text-price-${listing.mlsNumber}`}>
                {formatPrice(price)}
              </span>
              <Badge
                variant={getCapRateBadgeVariant(listing.capRate)}
                className="text-[10px] flex-shrink-0"
                data-testid={`badge-cap-rate-${listing.mlsNumber}`}
              >
                {listing.capRate.toFixed(1)}%
              </Badge>
            </div>

            <p className="text-[11px] text-muted-foreground truncate mb-1" data-testid={`text-address-${listing.mlsNumber}`}>
              {formatShortAddress(listing.address)}, {listing.address?.city}
            </p>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {listing.details?.numBedrooms != null && (
                <span className="flex items-center gap-0.5">
                  <BedDouble className="h-3 w-3" />
                  {listing.details.numBedrooms}
                </span>
              )}
              {listing.details?.numBathrooms != null && (
                <span className="flex items-center gap-0.5">
                  <Bath className="h-3 w-3" />
                  {listing.details.numBathrooms}
                </span>
              )}
              {listing.details?.sqft && (
                <span className="flex items-center gap-0.5">
                  <Maximize className="h-3 w-3" />
                  {listing.details.sqft}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
              <span>Rent: {formatPrice(listing.estimatedMonthlyRent)}/mo</span>
              <span>NOI: {formatPrice(listing.annualNOI)}/yr</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDetailPanel = () => {
    if (!selectedListing) return null;

    return (
      <div data-testid="panel-listing-detail">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                className="h-7 w-7"
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
                {selectedListing.images.filter(img => img.startsWith("http") && !img.includes("youriguide") && !img.includes("virtualtour")).slice(0, 4).map((img, idx) => {
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
                    {selectedListing.rentSource === "actual" && (
                      <span className="text-[10px] text-green-600 ml-1">(actual)</span>
                    )}
                    {selectedListing.rentSource === "market" && (
                      <span className="text-[10px] text-blue-600 ml-1">(scraped)</span>
                    )}
                    {selectedListing.rentSource === "cmhc_city" && (
                      <span className="text-[10px] text-cyan-600 ml-1">(CMHC city)</span>
                    )}
                    {selectedListing.rentSource === "cmhc_province" && (
                      <span className="text-[10px] text-amber-600 ml-1">(CMHC prov.)</span>
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
    );
  };

  const sidebarContent = (
    <>
      {selectedListing ? (
        <div className="overflow-y-auto flex-1 p-3">
          {renderDetailPanel()}
        </div>
      ) : (
        <div className="overflow-y-auto flex-1 space-y-2 p-3">
          {isSearching ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-2">
                <div className="flex gap-3">
                  <Skeleton className="w-24 h-20 rounded-md flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              </div>
            ))
          ) : listingsWithCapRates.length > 0 ? (
            <>
              {listingsWithCapRates.map((listing) => renderListingCard(listing))}

              {numPages > 1 && (
                <div className="flex items-center justify-between pt-2 pb-1">
                  <span className="text-xs text-muted-foreground">Page {page}/{numPages}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1 || isSearching}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= numPages || isSearching}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : hasSearched ? (
            <div className="rounded-lg border p-6 text-center">
              <Search className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-sm font-semibold mb-2">No Properties Found</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Try zooming out or adjusting your filters.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border p-6 text-center">
              <Map className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-sm font-semibold mb-2">Pan & Zoom to Search</h3>
              <p className="text-xs text-muted-foreground">
                Move the map to any area to see listings and cap rates.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
        <div className="px-3 py-2">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight" data-testid="text-page-title">Cap Rates Explorer</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasSearched && (
                <div className="hidden sm:flex items-center gap-1.5">
                  <p className="text-xs text-muted-foreground" data-testid="text-results-count">
                    {totalCount > 0
                      ? `${listingsWithCapRates.length} of ${totalCount.toLocaleString()}`
                      : "No results"}
                  </p>
                  {dataSource && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0" data-testid="badge-data-source">
                      {dataSource === "crea_ddf" ? "CREA DDF" : "Repliers"}
                    </Badge>
                  )}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="h-8"
                data-testid="button-toggle-filters"
              >
                <Filter className="h-3.5 w-3.5 mr-1" />
                Filters
                {showFilters ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
              </Button>
              {isSearching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-2 items-end pb-1">
              <div className="min-w-[100px]">
                <Label className="text-[10px] text-muted-foreground mb-0.5 block">Min Price</Label>
                <Input
                  type="number"
                  placeholder="$0"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="h-8 text-xs"
                  data-testid="input-min-price"
                />
              </div>
              <div className="min-w-[100px]">
                <Label className="text-[10px] text-muted-foreground mb-0.5 block">Max Price</Label>
                <Input
                  type="number"
                  placeholder="Any"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="h-8 text-xs"
                  data-testid="input-max-price"
                />
              </div>
              <div className="min-w-[75px]">
                <Label className="text-[10px] text-muted-foreground mb-0.5 block">Beds</Label>
                <Select value={minBeds} onValueChange={setMinBeds}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-beds">
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
              <div className="min-w-[100px]">
                <Label className="text-[10px] text-muted-foreground mb-0.5 block">Type</Label>
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-property-type">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Detached">Detached</SelectItem>
                    <SelectItem value="Semi-Detached">Semi</SelectItem>
                    <SelectItem value="Townhouse">Townhouse</SelectItem>
                    <SelectItem value="Condo">Condo</SelectItem>
                    <SelectItem value="Duplex">Duplex</SelectItem>
                    <SelectItem value="Triplex">Triplex</SelectItem>
                    <SelectItem value="Multiplex">Multiplex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[90px]">
                <Label className="text-[10px] text-muted-foreground mb-0.5 block">Min Cap</Label>
                <Select value={minCapRate} onValueChange={setMinCapRate}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-min-cap-rate">
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
              <div className="min-w-[110px]">
                <Label className="text-[10px] text-muted-foreground mb-0.5 block">Sort</Label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-sort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="capRate">Cap Rate</SelectItem>
                    <SelectItem value="priceAsc">Price ↑</SelectItem>
                    <SelectItem value="priceDesc">Price ↓</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                className="h-8"
                onClick={handleRefresh}
                disabled={isSearching || !mapBounds}
                data-testid="button-apply-filters"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Apply
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 relative" data-testid="map-container">
          <MapContainer
            center={TORONTO_CENTER}
            zoom={DEFAULT_ZOOM}
            style={{ width: "100%", height: "100%" }}
            className="h-[50vh] lg:h-full"
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {mappableListings.map((listing) => (
              <Marker
                key={listing.mlsNumber}
                position={[listing.map!.latitude, listing.map!.longitude]}
                icon={createCapRateIcon(
                  listing.capRate,
                  selectedListing?.mlsNumber === listing.mlsNumber
                )}
                eventHandlers={{
                  click: () => handleSelectListing(listing),
                }}
              >
                <Popup>
                  <div className="min-w-[200px]">
                    <p className="font-bold text-sm">{formatPrice(listing.listPrice)}</p>
                    <p className="text-xs text-gray-600">{formatShortAddress(listing.address)}, {listing.address?.city}</p>
                    <p className="text-xs font-semibold mt-1" style={{ color: getCapRateMarkerColor(listing.capRate) }}>
                      {listing.capRate.toFixed(1)}% Cap Rate
                    </p>
                    <p className="text-xs text-gray-500">
                      {listing.details?.numBedrooms || "?"} bed / {listing.details?.numBathrooms || "?"} bath
                      {listing.details?.sqft ? ` / ${listing.details.sqft} sqft` : ""}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
            <MapEventHandler onBoundsChange={handleBoundsChange} />
            {flyTo && <FlyToLocation lat={flyTo.lat} lng={flyTo.lng} />}
          </MapContainer>

          <div className="lg:hidden absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000]">
            <Button
              size="sm"
              className="shadow-lg rounded-full px-4"
              onClick={() => setShowMobileList(!showMobileList)}
              data-testid="button-toggle-mobile-list"
            >
              <List className="h-4 w-4 mr-1.5" />
              {listingsWithCapRates.length > 0 ? `${listingsWithCapRates.length} listings` : "Listings"}
              {showMobileList ? <ChevronDown className="h-3 w-3 ml-1" /> : <ChevronUp className="h-3 w-3 ml-1" />}
            </Button>
          </div>
        </div>

        <div className="hidden lg:flex lg:w-[380px] xl:w-[420px] flex-shrink-0 flex-col border-l bg-background overflow-hidden">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium" data-testid="text-sidebar-count">
                {hasSearched
                  ? totalCount > 0
                    ? `${listingsWithCapRates.length} of ${totalCount.toLocaleString()} properties`
                    : "No properties"
                  : "Move map to search"}
              </p>
              {dataSource && (
                <Badge variant="outline" className="text-[9px] px-1 py-0">
                  {dataSource === "crea_ddf" ? "DDF" : "Repliers"}
                </Badge>
              )}
            </div>
            {isSearching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          {sidebarContent}
        </div>

        {showMobileList && (
          <div className="lg:hidden fixed inset-x-0 bottom-0 z-[1000] bg-background border-t rounded-t-2xl shadow-2xl max-h-[60vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium">
                  {totalCount > 0
                    ? `${listingsWithCapRates.length} of ${totalCount.toLocaleString()}`
                    : "No properties"}
                </p>
                {dataSource && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                    {dataSource === "crea_ddf" ? "DDF" : "Repliers"}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMobileList(false)}
                data-testid="button-close-mobile-list"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sidebarContent}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
