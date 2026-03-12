import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Search, MapPin, AlertTriangle, Gavel, TrendingDown, DollarSign,
  Heart, ExternalLink, Filter, X, ChevronDown, ChevronUp, Info,
  List, Map as MapIcon, Share2, Loader2, Building2, Home
} from "lucide-react";
import { DISTRESS_CATEGORIES, type DistressResult, type MatchedTerm, getProvincialNuance } from "@shared/distressScoring";

const CANADA_CENTER: [number, number] = [51.0, -85.0];
const DEFAULT_ZOOM = 5;

const PROVINCES = [
  { value: "Ontario", label: "Ontario" },
  { value: "British Columbia", label: "British Columbia" },
  { value: "Alberta", label: "Alberta" },
  { value: "Quebec", label: "Quebec" },
  { value: "Manitoba", label: "Manitoba" },
  { value: "Saskatchewan", label: "Saskatchewan" },
  { value: "Nova Scotia", label: "Nova Scotia" },
  { value: "New Brunswick", label: "New Brunswick" },
  { value: "Newfoundland and Labrador", label: "Newfoundland" },
  { value: "Prince Edward Island", label: "PEI" },
];

const CATEGORY_ICONS: Record<string, any> = {
  foreclosure_pos: Gavel,
  motivated: TrendingDown,
  vtb: DollarSign,
};

interface DistressListing {
  mlsNumber: string;
  listPrice: number;
  address: {
    streetNumber: string;
    streetName: string;
    streetSuffix: string;
    unitNumber: string;
    city: string;
    state: string;
    zip: string;
    neighborhood: string;
  };
  map?: { latitude: number; longitude: number };
  details: {
    numBedrooms?: number;
    numBathrooms?: number;
    sqft?: string;
    propertyType?: string;
    description?: string;
  };
  images: string[];
  daysOnMarket?: number;
  listDate?: string;
  distress: DistressResult;
  rawRemarks: string;
}

const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const orangeIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const purpleIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function getListingIcon(listing: DistressListing) {
  if (listing.distress.categoriesTriggered.foreclosure_pos) return redIcon;
  if (listing.distress.categoriesTriggered.vtb) return purpleIcon;
  return orangeIcon;
}

function formatPrice(price: number): string {
  if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
  if (price >= 1000) return `$${Math.round(price / 1000)}K`;
  return `$${price}`;
}

function formatAddress(addr: DistressListing["address"]): string {
  const parts = [addr.unitNumber, addr.streetNumber, addr.streetName, addr.streetSuffix].filter(Boolean);
  return parts.join(" ") || "Address unavailable";
}

function highlightTerms(text: string, matchedTerms: MatchedTerm[]): string {
  if (!text || matchedTerms.length === 0) return escHtml(text || "");
  let result = escHtml(text);
  const sortedTerms = [...matchedTerms].sort((a, b) => b.term.length - a.term.length);
  for (const mt of sortedTerms) {
    const term = mt.term;
    if (term.includes("+")) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const color = DISTRESS_CATEGORIES[mt.category]?.color || "#ef4444";
    const regex = new RegExp(`(${escaped})`, "gi");
    result = result.replace(regex, `<mark style="background:${color}22;color:${color};font-weight:600;padding:1px 3px;border-radius:2px">$1</mark>`);
  }
  return result;
}

function escHtml(str: string): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function DistressScoreBadge({ score, confidence }: { score: number; confidence: string }) {
  let bgColor = "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  if (score >= 70) bgColor = "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  else if (score >= 40) bgColor = "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
  else if (score >= 20) bgColor = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";

  return (
    <div className="flex items-center gap-1.5" data-testid="distress-score-badge">
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${bgColor}`}>
        {score}
      </span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
        {confidence}
      </span>
    </div>
  );
}

function CategoryBadges({ categories }: { categories: DistressResult["categoriesTriggered"] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(categories).map(([key, triggered]) => {
        if (!triggered) return null;
        const cat = DISTRESS_CATEGORIES[key as keyof typeof DISTRESS_CATEGORIES];
        if (!cat) return null;
        const Icon = CATEGORY_ICONS[key];
        return (
          <Badge
            key={key}
            variant="outline"
            className="text-[10px] gap-1 py-0"
            style={{ borderColor: cat.color, color: cat.color }}
            data-testid={`badge-category-${key}`}
          >
            {Icon && <Icon className="h-2.5 w-2.5" />}
            {cat.shortLabel}
          </Badge>
        );
      })}
    </div>
  );
}

function MapBoundsTracker({ onBoundsChange }: { onBoundsChange: (bounds: any) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const b = map.getBounds();
      onBoundsChange({
        latMin: b.getSouth(),
        latMax: b.getNorth(),
        lngMin: b.getWest(),
        lngMax: b.getEast(),
      });
    },
  });
  return null;
}

function ListingDetailModal({
  listing,
  onClose,
}: {
  listing: DistressListing;
  onClose: () => void;
}) {
  const nuance = getProvincialNuance(listing.address.state);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="detail-modal"
      >
        <div className="sticky top-0 bg-card border-b p-4 flex items-center justify-between z-10">
          <div>
            <h2 className="font-bold text-lg" data-testid="modal-address">{formatAddress(listing.address)}</h2>
            <p className="text-sm text-muted-foreground">{listing.address.city}, {listing.address.state}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-modal">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {listing.images.length > 0 && (
            <div className="relative rounded-lg overflow-hidden h-48">
              <img
                src={listing.images[0]}
                alt={formatAddress(listing.address)}
                className="w-full h-full object-cover"
                data-testid="modal-image"
              />
              <div className="absolute top-3 left-3">
                <span className="bg-black/70 text-white px-3 py-1 rounded-full text-sm font-bold">
                  {formatPrice(listing.listPrice)}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DistressScoreBadge score={listing.distress.distressScore} confidence={listing.distress.confidence} />
              <CategoryBadges categories={listing.distress.categoriesTriggered} />
            </div>
            <div className="text-sm text-muted-foreground">
              {listing.details.numBedrooms && `${listing.details.numBedrooms} bed`}
              {listing.details.numBathrooms && ` · ${listing.details.numBathrooms} bath`}
              {listing.details.sqft && ` · ${listing.details.sqft} sqft`}
            </div>
          </div>

          {listing.distress.matchedTerms.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-2">Matched Signals</h3>
              <div className="flex flex-wrap gap-1.5">
                {listing.distress.matchedTerms.map((mt, idx) => {
                  const cat = DISTRESS_CATEGORIES[mt.category];
                  return (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="text-xs"
                      style={{ backgroundColor: `${cat?.color}15`, color: cat?.color, borderColor: `${cat?.color}40` }}
                    >
                      "{mt.term}" ({mt.weight}, +{mt.points}pts)
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <h3 className="font-semibold text-sm mb-2">Full Remarks</h3>
            <div
              className="text-sm leading-relaxed bg-muted/30 p-3 rounded-lg border"
              dangerouslySetInnerHTML={{ __html: highlightTerms(listing.rawRemarks, listing.distress.matchedTerms) }}
              data-testid="modal-remarks"
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">Provincial Context</h4>
                <p className="text-xs text-blue-600 dark:text-blue-400">{nuance}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" data-testid="button-request-package">
              Request Deal Package
            </Button>
            <Button variant="outline" asChild>
              <a
                href={`/tools/analyzer?mls=${listing.mlsNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-analyze"
              >
                Analyze Deal
              </a>
            </Button>
          </div>

          <div className="text-[10px] text-muted-foreground bg-muted/50 p-2 rounded border">
            This is not legal advice. "Power of Sale"/foreclosure processes vary by province. Listings are flagged based on MLS remarks and signals; verify details with professionals.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DistressDeals() {
  const { toast } = useToast();
  const [province, setProvince] = useState<string>("Ontario");
  const [city, setCity] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minBeds, setMinBeds] = useState("");
  const [maxBeds, setMaxBeds] = useState("");
  const [toggleForeclosure, setToggleForeclosure] = useState(true);
  const [toggleMotivated, setToggleMotivated] = useState(false);
  const [toggleVtb, setToggleVtb] = useState(false);
  const [viewMode, setViewMode] = useState<"split" | "list" | "map">("split");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [selectedListing, setSelectedListing] = useState<DistressListing | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(CANADA_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [mapBounds, setMapBounds] = useState<any>(null);
  const [searchCity, setSearchCity] = useState("");
  const [searchProvince, setSearchProvince] = useState("Ontario");
  const [hasSearched, setHasSearched] = useState(true);
  const mapRef = useRef<any>(null);

  const categories = useMemo(() => {
    const cats: string[] = [];
    if (toggleForeclosure) cats.push("foreclosure_pos");
    if (toggleMotivated) cats.push("motivated");
    if (toggleVtb) cats.push("vtb");
    return cats;
  }, [toggleForeclosure, toggleMotivated, toggleVtb]);

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (searchProvince) params.province = searchProvince;
    if (searchCity) params.city = searchCity;
    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;
    if (minBeds) params.minBeds = minBeds;
    if (maxBeds) params.maxBeds = maxBeds;
    if (categories.length > 0 && categories.length < 3) params.categories = categories.join(",");
    return params;
  }, [searchProvince, searchCity, minPrice, maxPrice, minBeds, maxBeds, categories]);

  const queryString = useMemo(() => {
    return new URLSearchParams(queryParams).toString();
  }, [queryParams]);

  const { data, isLoading, isFetching } = useQuery<{
    listings: DistressListing[];
    totalCount: number;
    totalDdfCount: number;
  }>({
    queryKey: ["/api/distress-deals", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/distress-deals?${queryString}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: hasSearched,
    staleTime: 5 * 60 * 1000,
  });

  const listings = data?.listings || [];
  const listingsWithLocation = listings.filter(l => l.map?.latitude && l.map?.longitude);

  const handleSearch = useCallback(() => {
    setSearchCity(city);
    setSearchProvince(province);
    setHasSearched(true);

    const cityCoords: Record<string, [number, number]> = {
      toronto: [43.65, -79.38],
      vancouver: [49.28, -123.12],
      montreal: [45.50, -73.57],
      calgary: [51.05, -114.07],
      edmonton: [53.54, -113.49],
      ottawa: [45.42, -75.69],
      winnipeg: [49.90, -97.14],
      hamilton: [43.25, -79.87],
      halifax: [44.65, -63.57],
      london: [42.98, -81.25],
    };

    const lowerCity = city.toLowerCase();
    if (cityCoords[lowerCity]) {
      setMapCenter(cityCoords[lowerCity]);
      setMapZoom(11);
    } else if (province) {
      const provCoords: Record<string, [number, number]> = {
        Ontario: [44.0, -79.0],
        "British Columbia": [49.0, -123.0],
        Alberta: [51.5, -114.0],
        Quebec: [46.5, -72.0],
        Manitoba: [49.9, -97.1],
        Saskatchewan: [50.4, -104.6],
        "Nova Scotia": [44.6, -63.5],
        "New Brunswick": [46.5, -66.5],
        "Newfoundland and Labrador": [47.6, -52.7],
        "Prince Edward Island": [46.2, -63.0],
      };
      if (provCoords[province]) {
        setMapCenter(provCoords[province]);
        setMapZoom(7);
      }
    }
  }, [city, province]);

  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/tools/distress-deals?${queryString}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: "Link copied", description: "Share link has been copied to clipboard" });
    });
  }, [queryString, toast]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("province");
    const c = params.get("city");
    if (p) { setProvince(p); setSearchProvince(p); }
    if (c) { setCity(c); setSearchCity(c); }
    if (p || c) setHasSearched(true);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="distress-deals-page">
      <SEO
        title="Distress Deals Browser - Foreclosure, Power of Sale, VTB | Realist.ca"
        description="Find power-of-sale, court-ordered, bank-owned, motivated sellers, and seller-financing opportunities across Canada using MLS data."
        keywords="foreclosure canada, power of sale, court ordered sale, motivated seller, vtb, vendor take back, distressed property, bank owned"
        canonicalUrl="/tools/distress-deals"
      />
      <Navigation />

      <div className="flex-1 flex flex-col">
        <div className="border-b bg-card">
          <div className="max-w-[1800px] mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2" data-testid="text-page-title">
                  <Gavel className="h-5 w-5 text-red-500" />
                  Distress Deals
                </h1>
                <p className="text-sm text-muted-foreground">
                  Foreclosure, Power of Sale, Motivated Sellers & VTB opportunities
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === "split" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("split")}
                  className="gap-1"
                  data-testid="button-view-split"
                >
                  <Filter className="h-3.5 w-3.5" /> Split
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="gap-1"
                  data-testid="button-view-list"
                >
                  <List className="h-3.5 w-3.5" /> List
                </Button>
                <Button
                  variant={viewMode === "map" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("map")}
                  className="gap-1"
                  data-testid="button-view-map"
                >
                  <MapIcon className="h-3.5 w-3.5" /> Map
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2" data-testid="toggle-foreclosure">
                <Switch checked={toggleForeclosure} onCheckedChange={setToggleForeclosure} id="t-foreclosure" />
                <Label htmlFor="t-foreclosure" className="text-sm flex items-center gap-1.5 cursor-pointer">
                  <Gavel className="h-3.5 w-3.5 text-red-500" />
                  Foreclosure / POS
                </Label>
              </div>
              <div className="flex items-center gap-2" data-testid="toggle-motivated">
                <Switch checked={toggleMotivated} onCheckedChange={setToggleMotivated} id="t-motivated" />
                <Label htmlFor="t-motivated" className="text-sm flex items-center gap-1.5 cursor-pointer">
                  <TrendingDown className="h-3.5 w-3.5 text-amber-500" />
                  Motivated Seller
                </Label>
              </div>
              <div className="flex items-center gap-2" data-testid="toggle-vtb">
                <Switch checked={toggleVtb} onCheckedChange={setToggleVtb} id="t-vtb" />
                <Label htmlFor="t-vtb" className="text-sm flex items-center gap-1.5 cursor-pointer">
                  <DollarSign className="h-3.5 w-3.5 text-purple-500" />
                  VTB / Seller Financing
                </Label>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex">
          {(viewMode === "split" || viewMode === "list") && (
            <div className={`border-r bg-card flex flex-col ${viewMode === "split" ? "w-[420px] flex-shrink-0" : "flex-1"}`}>
              <div className="p-3 border-b space-y-3">
                <div className="flex gap-2">
                  <Select value={province} onValueChange={setProvince}>
                    <SelectTrigger className="w-[160px]" data-testid="select-province">
                      <SelectValue placeholder="Province" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_provinces">All Provinces</SelectItem>
                      {PROVINCES.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="City"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="flex-1"
                    data-testid="input-city"
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <Button onClick={handleSearch} size="sm" className="gap-1" data-testid="button-search">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  className="w-full justify-between text-xs"
                  data-testid="button-toggle-filters"
                >
                  <span>More Filters</span>
                  {filtersOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>

                {filtersOpen && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Min Price</Label>
                      <Input
                        placeholder="$0"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        type="number"
                        data-testid="input-min-price"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Max Price</Label>
                      <Input
                        placeholder="No max"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        type="number"
                        data-testid="input-max-price"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Min Beds</Label>
                      <Input
                        placeholder="Any"
                        value={minBeds}
                        onChange={(e) => setMinBeds(e.target.value)}
                        type="number"
                        data-testid="input-min-beds"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Max Beds</Label>
                      <Input
                        placeholder="Any"
                        value={maxBeds}
                        onChange={(e) => setMaxBeds(e.target.value)}
                        type="number"
                        data-testid="input-max-beds"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto">
                {!hasSearched && (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <Gavel className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <h3 className="font-semibold text-lg mb-2">Find Distressed Deals</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Select a province and/or city, then search to find power-of-sale, foreclosure, motivated seller, and VTB listings.
                    </p>
                  </div>
                )}

                {isLoading && (
                  <div className="p-3 space-y-3">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={i} className="h-32 rounded-lg" />
                    ))}
                  </div>
                )}

                {hasSearched && !isLoading && listings.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-64 text-center p-8">
                    <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <h3 className="font-medium mb-1">No distress signals found</h3>
                    <p className="text-sm text-muted-foreground">
                      Try expanding your search area or adjusting filters. Not all listings contain distress-related language.
                    </p>
                  </div>
                )}

                {hasSearched && !isLoading && listings.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center justify-between px-2 py-1.5 mb-2">
                      <span className="text-xs text-muted-foreground" data-testid="text-result-count">
                        {data?.totalCount || 0} flagged / {data?.totalDdfCount || 0} scanned
                      </span>
                      <div className="flex gap-1">
                        {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                        <Button variant="ghost" size="sm" onClick={handleShare} className="h-7 gap-1 text-xs" data-testid="button-share">
                          <Share2 className="h-3 w-3" /> Share
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {listings.map((listing) => (
                        <Card
                          key={listing.mlsNumber}
                          className="cursor-pointer hover:bg-accent/50 transition-colors overflow-hidden"
                          onClick={() => setSelectedListing(listing)}
                          data-testid={`card-listing-${listing.mlsNumber}`}
                        >
                          <CardContent className="p-0">
                            <div className="flex">
                              {listing.images[0] && (
                                <div className="w-24 h-24 flex-shrink-0">
                                  <img
                                    src={listing.images[0]}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                </div>
                              )}
                              <div className="flex-1 p-2.5 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <div className="min-w-0">
                                    <div className="font-semibold text-sm truncate" data-testid={`text-listing-price-${listing.mlsNumber}`}>
                                      {formatPrice(listing.listPrice)}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate">
                                      {formatAddress(listing.address)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {listing.address.city}, {listing.address.state}
                                    </div>
                                  </div>
                                  <DistressScoreBadge score={listing.distress.distressScore} confidence={listing.distress.confidence} />
                                </div>
                                <div className="flex items-center justify-between mt-1.5">
                                  <CategoryBadges categories={listing.distress.categoriesTriggered} />
                                  <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                                    {listing.details.numBedrooms && `${listing.details.numBedrooms}bd`}
                                    {listing.details.numBathrooms && ` ${listing.details.numBathrooms}ba`}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {(viewMode === "split" || viewMode === "map") && (
            <div className="flex-1 relative">
              <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                className="h-full w-full z-0"
                scrollWheelZoom={true}
                ref={mapRef}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <MapBoundsTracker onBoundsChange={setMapBounds} />
                <MapCenterUpdater center={mapCenter} zoom={mapZoom} />

                {listingsWithLocation.map((listing) => (
                  <Marker
                    key={listing.mlsNumber}
                    position={[listing.map!.latitude, listing.map!.longitude]}
                    icon={getListingIcon(listing)}
                    eventHandlers={{ click: () => setSelectedListing(listing) }}
                  >
                    <Popup>
                      <div style={{ minWidth: 180 }}>
                        <strong>{formatPrice(listing.listPrice)}</strong><br />
                        <span style={{ fontSize: "0.85em" }}>{formatAddress(listing.address)}</span><br />
                        <span style={{ fontSize: "0.8em", color: "#666" }}>
                          Score: {listing.distress.distressScore} ({listing.distress.confidence})
                        </span>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          )}
        </div>

        <div className="border-t bg-muted/30 px-4 py-2">
          <p className="text-[10px] text-muted-foreground text-center max-w-4xl mx-auto" data-testid="text-disclaimer">
            This is not legal advice. "Power of Sale"/foreclosure processes vary by province. Listings are flagged based on MLS remarks and signals; verify details with professionals.
            Distress Score is derived from listing remarks, provincial sale terminology, and available listing signals. It is not a guarantee of distressed status.
          </p>
        </div>
      </div>

      {selectedListing && (
        <ListingDetailModal
          listing={selectedListing}
          onClose={() => setSelectedListing(null)}
        />
      )}
    </div>
  );
}

function MapCenterUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.5 });
  }, [center, zoom, map]);
  return null;
}
