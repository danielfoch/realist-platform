import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  TrendingUp, Search, Building, BedDouble, Bath, Maximize,
  DollarSign, MapPin, ChevronRight, ChevronLeft, ArrowUpDown,
  Calculator, X, Loader2, ArrowRight, Map, LayoutGrid,
  RefreshCw, ChevronDown, ChevronUp, List, Users, MessageSquare,
  ThumbsUp, ThumbsDown, Send, PenLine, Sparkles, Eye, EyeOff,
  Star, Target, Zap,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getCmhcRent } from "@shared/cmhcRents";
import { MiniDealAnalyzer } from "@/components/MiniDealAnalyzer";
import type { ListingAnalysisAggregate, UnderwritingNote, ListingComment } from "@shared/schema";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapLayersPanel, DEFAULT_LAYERS, type MapLayer } from "@/components/MapLayersPanel";
import { NeighbourhoodOverlay } from "@/components/NeighbourhoodOverlay";

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
  numberOfUnitsTotal?: number;
  unitCount: number;
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

interface FindDealsResult {
  id: string;
  mlsNumber: string;
  lat: number;
  lng: number;
  price: number;
  cap_rate: number;
  cash_on_cash: number;
  deal_score: number;
  final_score: number;
  explanation: string;
  address: RepliersListing["address"];
  details: RepliersListing["details"];
  images?: string[];
  daysOnMarket: number;
  monthlyRent: number;
  rentSource: string;
  listPrice: number | string;
  taxes?: RepliersListing["taxes"];
  numberOfUnitsTotal: number;
}

interface FindDealsResponse {
  listings: FindDealsResult[];
  bounds: { north: number; south: number; east: number; west: number; center: { lat: number; lng: number } } | null;
  filters_applied: Record<string, any>;
  total: number;
  query: string;
}

function getDealScoreColor(score: number): string {
  if (score >= 80) return "#f59e0b";
  if (score >= 65) return "#3b82f6";
  return "#6b7280";
}

function getDealScoreLabel(score: number): string {
  if (score >= 80) return "Top Deal";
  if (score >= 65) return "Good Deal";
  return "Fair";
}

function createDealScoreIcon(score: number, isSelected: boolean): L.DivIcon {
  const color = getDealScoreColor(score);
  const size = isSelected ? 48 : 40;
  const fontSize = isSelected ? 12 : 10;
  const border = isSelected ? "3px solid #2563eb" : "2px solid white";
  const shadow = isSelected ? "0 0 0 2px #2563eb, 0 2px 12px rgba(0,0,0,0.4)" : "0 2px 8px rgba(0,0,0,0.3)";

  return L.divIcon({
    className: "deal-score-marker",
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
      cursor: pointer;
      transition: transform 0.15s ease;
      line-height: 1;
      font-family: system-ui, -apple-system, sans-serif;
    ">${score}</div>`,
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

function GeolocateOnMount() {
  const map = useMap();
  const attempted = useRef(false);
  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.flyTo([pos.coords.latitude, pos.coords.longitude], DEFAULT_ZOOM, { duration: 1.5 });
      },
      () => {},
      { timeout: 5000, maximumAge: 300000 }
    );
  }, [map]);
  return null;
}

export default function CapRates() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minBeds, setMinBeds] = useState("any");
  const [minUnits, setMinUnits] = useState("any");
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
  const [dataSource, setDataSource] = useState<"crea_ddf" | "repliers" | null>(null);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [showMobileList, setShowMobileList] = useState(false);
  const [mapLayers, setMapLayers] = useState<MapLayer[]>(DEFAULT_LAYERS);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [detailTab, setDetailTab] = useState<string>("overview");
  const [aggregatesMap, setAggregatesMap] = useState<Record<string, ListingAnalysisAggregate>>({});
  const listingRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const searchInProgress = useRef(false);

  const [findDealsQuery, setFindDealsQuery] = useState("");
  const [findDealsResults, setFindDealsResults] = useState<FindDealsResult[]>([]);
  const [findDealsActive, setFindDealsActive] = useState(false);
  const [findDealsLoading, setFindDealsLoading] = useState(false);
  const [findDealsFilters, setFindDealsFilters] = useState<Record<string, any>>({});
  const [showTopDealsOnly, setShowTopDealsOnly] = useState(false);
  const [selectedDealResult, setSelectedDealResult] = useState<FindDealsResult | null>(null);

  const [uwUnitCount, setUwUnitCount] = useState("1");
  const [uwRentPerUnit, setUwRentPerUnit] = useState("");
  const [uwVacancy, setUwVacancy] = useState("5");
  const [uwExpenseRatio, setUwExpenseRatio] = useState("35");
  const [uwNoteText, setUwNoteText] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [communitySortBy, setCommunitySortBy] = useState<"top" | "new">("top");

  const { data: rentData = [] } = useQuery<RentPulseData[]>({
    queryKey: ["/api/rents/pulse"],
  });

  const { data: ddfStatus } = useQuery<{ configured: boolean; authenticated: boolean }>({
    queryKey: ["/api/ddf/status"],
  });

  const selectedMls = selectedListing?.mlsNumber;

  const { data: communityNotes = [], refetch: refetchNotes } = useQuery<(UnderwritingNote & { userName?: string })[]>({
    queryKey: ["/api/community/notes", selectedMls],
    queryFn: async () => {
      if (!selectedMls) return [];
      const res = await fetch(`/api/community/notes/${selectedMls}`);
      return res.json();
    },
    enabled: !!selectedMls,
  });

  const { data: communityComments = [], refetch: refetchComments } = useQuery<(ListingComment & { userName?: string })[]>({
    queryKey: ["/api/community/comments", selectedMls],
    queryFn: async () => {
      if (!selectedMls) return [];
      const res = await fetch(`/api/community/comments/${selectedMls}`);
      return res.json();
    },
    enabled: !!selectedMls,
  });

  const fetchAggregatesBatch = useCallback(async (mlsNumbers: string[]) => {
    if (mlsNumbers.length === 0) return;
    try {
      const res = await apiRequest("POST", "/api/community/aggregates", { mlsNumbers });
      const data: ListingAnalysisAggregate[] = await res.json();
      const map: Record<string, ListingAnalysisAggregate> = {};
      data.forEach((agg) => { map[agg.listingMlsNumber] = agg; });
      setAggregatesMap((prev) => ({ ...prev, ...map }));
    } catch {
    }
  }, []);

  useEffect(() => {
    const mlsNumbers = listings.map((l) => l.mlsNumber).filter(Boolean);
    if (mlsNumbers.length > 0) {
      fetchAggregatesBatch(mlsNumbers);
    }
  }, [listings, fetchAggregatesBatch]);

  const submitNoteMutation = useMutation({
    mutationFn: async (data: {
      listingMlsNumber: string;
      unitCount: number;
      rentsJson: number[];
      vacancy: number;
      expenseRatio: number;
      noteText: string;
    }) => {
      const res = await apiRequest("POST", "/api/community/notes", data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({ title: "Underwriting note submitted", description: "+5 contribution points" });
      refetchNotes();
      setUwNoteText("");
      fetchAggregatesBatch([variables.listingMlsNumber]);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to submit note", variant: "destructive" });
    },
  });

  const submitCommentMutation = useMutation({
    mutationFn: async (data: { listingMlsNumber: string; body: string }) => {
      const res = await apiRequest("POST", "/api/community/comments", data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({ title: "Comment posted", description: "+1 contribution point" });
      refetchComments();
      setCommentBody("");
      fetchAggregatesBatch([variables.listingMlsNumber]);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to post comment", variant: "destructive" });
    },
  });

  const voteMutation = useMutation({
    mutationFn: async (data: { targetType: string; targetId: string; value: number }) => {
      const res = await apiRequest("POST", "/api/community/vote", data);
      return res.json();
    },
    onSuccess: () => {
      refetchNotes();
      refetchComments();
    },
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
          excludeBusinessSales: true,
          excludeParking: true,
        };

        if (minPrice) ddfBody.minPrice = parseInt(minPrice);
        if (maxPrice) ddfBody.maxPrice = parseInt(maxPrice);
        if (minBeds && minBeds !== "any") ddfBody.minBeds = parseInt(minBeds);
        if (minUnits && minUnits !== "any") ddfBody.minUnits = parseInt(minUnits);
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
  }, [minPrice, maxPrice, minBeds, minUnits, propertyType, ddfStatus]);

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
        const units = listing.numberOfUnitsTotal || 1;

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
          rent = estimated.rent * units;
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
          unitCount: units,
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

  const handleFindDeals = useCallback(async () => {
    if (!findDealsQuery.trim()) return;
    setFindDealsLoading(true);
    setFindDealsActive(true);
    setSelectedListing(null);
    setSelectedDealResult(null);
    try {
      const response = await apiRequest("POST", "/api/find-deals", {
        query: findDealsQuery.trim(),
        bounds: mapBounds,
      });
      const data: FindDealsResponse = await response.json();

      setFindDealsResults(data.listings);
      setFindDealsFilters(data.filters_applied || {});

      if (data.filters_applied) {
        const f = data.filters_applied;
        if (f.minPrice) setMinPrice(String(f.minPrice));
        if (f.maxPrice) setMaxPrice(String(f.maxPrice));
        if (f.minBeds) setMinBeds(String(f.minBeds));
        if (f.propertyType) setPropertyType(f.propertyType);
      }

      if (data.bounds?.center) {
        setFlyTo({ lat: data.bounds.center.lat, lng: data.bounds.center.lng, zoom: 12 });
      }

      toast({
        title: `Found ${data.listings.length} deals`,
        description: data.listings.filter(l => l.deal_score >= 65).length + " scored as good or better",
      });
    } catch (error: any) {
      console.error("Find deals error:", error);
      toast({
        title: "Search failed",
        description: error.message || "Could not search for deals",
        variant: "destructive",
      });
    } finally {
      setFindDealsLoading(false);
    }
  }, [findDealsQuery, mapBounds, toast]);

  const handleClearFindDeals = () => {
    setFindDealsActive(false);
    setFindDealsResults([]);
    setFindDealsFilters({});
    setFindDealsQuery("");
    setSelectedDealResult(null);
    setShowTopDealsOnly(false);
  };

  const handleSelectDealResult = (result: FindDealsResult) => {
    setSelectedDealResult(result);
    setSelectedListing(null);
    setFlyTo({ lat: result.lat, lng: result.lng, zoom: 15 });
  };

  const displayedDealResults = useMemo(() => {
    if (!findDealsActive) return [];
    const results = showTopDealsOnly
      ? findDealsResults.filter(r => r.deal_score >= 65)
      : findDealsResults;
    return results.slice(0, 20);
  }, [findDealsActive, findDealsResults, showTopDealsOnly]);

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
    params.set("vacancy", String(EXPENSE_ASSUMPTIONS.vacancyPercent));
    params.set("maintenance", String(EXPENSE_ASSUMPTIONS.maintenancePercent));
    params.set("management", String(EXPENSE_ASSUMPTIONS.managementPercent));
    params.set("insurance", String(EXPENSE_ASSUMPTIONS.insurancePerUnit * 12));
    const tax = listing.taxes?.annualAmount || (price ? price * EXPENSE_ASSUMPTIONS.propertyTaxPercent / 100 : 0);
    if (tax) params.set("propertyTax", String(Math.round(tax)));
    setLocation(`/tools/analyzer?${params.toString()}`);
  };

  const handleSelectListing = (listing: ListingWithCapRate) => {
    setSelectedListing(listing);
    setDetailTab("overview");
    setUwUnitCount(String(listing.unitCount || 1));
    const perUnitRent = listing.unitCount > 1
      ? Math.round(listing.estimatedMonthlyRent / listing.unitCount)
      : Math.round(listing.estimatedMonthlyRent);
    setUwRentPerUnit(String(perUnitRent));
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
              {listing.unitCount > 1 && (
                <span className="flex items-center gap-0.5 font-medium text-primary">
                  <Building className="h-3 w-3" />
                  {listing.unitCount}u
                </span>
              )}
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
              <span>Rent: {formatPrice(listing.estimatedMonthlyRent)}/mo{listing.unitCount > 1 ? ` (${listing.unitCount}×${formatPrice(Math.round(listing.estimatedMonthlyRent / listing.unitCount))})` : ""}</span>
              <span>NOI: {formatPrice(listing.annualNOI)}/yr</span>
            </div>

            {(() => {
              const agg = aggregatesMap[listing.mlsNumber];
              if (agg && ((agg.analysisCount ?? 0) > 0 || (agg.commentCount ?? 0) > 0)) {
                const ac = agg.analysisCount ?? 0;
                const cc = agg.commentCount ?? 0;
                return (
                  <div className="flex items-center gap-2 mt-1">
                    {agg.communityCapRate != null && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0" data-testid={`badge-community-cap-${listing.mlsNumber}`}>
                        <Users className="h-2.5 w-2.5 mr-0.5" />
                        {agg.communityCapRate.toFixed(1)}%
                      </Badge>
                    )}
                    <span className="text-[9px] text-muted-foreground" data-testid={`text-community-stats-${listing.mlsNumber}`}>
                      {ac} {ac === 1 ? "analysis" : "analyses"} · {cc} {cc === 1 ? "note" : "notes"}
                    </span>
                  </div>
                );
              }
              return (
                <div className="mt-1">
                  <span className="text-[9px] text-primary cursor-pointer" data-testid={`link-first-analyze-${listing.mlsNumber}`}>
                    Be first to analyze
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  const handleSubmitUnderwriting = () => {
    if (!selectedListing || !isAuthenticated) return;
    const unitCount = parseInt(uwUnitCount) || 1;
    const rentPerUnit = parseFloat(uwRentPerUnit) || selectedListing.estimatedMonthlyRent;
    const rents = Array(unitCount).fill(rentPerUnit);
    submitNoteMutation.mutate({
      listingMlsNumber: selectedListing.mlsNumber,
      unitCount,
      rentsJson: rents,
      vacancy: parseFloat(uwVacancy) || 5,
      expenseRatio: parseFloat(uwExpenseRatio) || 35,
      noteText: uwNoteText,
    });
  };

  const handleSubmitComment = () => {
    if (!selectedListing || !isAuthenticated || !commentBody.trim()) return;
    submitCommentMutation.mutate({
      listingMlsNumber: selectedListing.mlsNumber,
      body: commentBody.trim(),
    });
  };

  const computeUwCapRate = () => {
    if (!selectedListing) return { capRate: 0, noi: 0, grossRent: 0 };
    const unitCount = parseInt(uwUnitCount) || 1;
    const rentPerUnit = parseFloat(uwRentPerUnit) || selectedListing.estimatedMonthlyRent;
    const vacancy = parseFloat(uwVacancy) || 5;
    const expenseRatio = parseFloat(uwExpenseRatio) || 35;
    const price = typeof selectedListing.listPrice === "string" ? parseFloat(selectedListing.listPrice) : selectedListing.listPrice;
    const grossRent = unitCount * rentPerUnit * 12;
    const effectiveRent = grossRent * (1 - vacancy / 100);
    const expenses = grossRent * (expenseRatio / 100);
    const noi = effectiveRent - expenses;
    const capRate = price > 0 ? (noi / price) * 100 : 0;
    return { capRate: Math.max(0, capRate), noi, grossRent };
  };

  const renderDetailPanel = () => {
    if (!selectedListing) return null;
    const agg = aggregatesMap[selectedListing.mlsNumber];
    const uwCalc = computeUwCapRate();

    const sortedNotes = [...communityNotes].sort((a, b) => {
      if (communitySortBy === "top") return (b.score || 0) - (a.score || 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const sortedComments = [...communityComments].sort((a, b) => {
      if (communitySortBy === "top") return (b.score || 0) - (a.score || 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return (
      <div data-testid="panel-listing-detail">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <CardTitle className="text-xl">
                    {formatPriceFull(selectedListing.listPrice)}
                  </CardTitle>
                  <Badge variant={getCapRateBadgeVariant(selectedListing.capRate)} data-testid="badge-detail-cap-rate">
                    {selectedListing.capRate.toFixed(1)}% yield
                  </Badge>
                  {agg?.communityCapRate != null && (
                    <Badge variant="secondary" className="text-[10px]" data-testid="badge-detail-community-cap">
                      <Users className="h-3 w-3 mr-0.5" />
                      {agg.communityCapRate.toFixed(1)}%
                    </Badge>
                  )}
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
          <CardContent className="p-0">
            <Tabs value={detailTab} onValueChange={setDetailTab} className="w-full">
              <TabsList className="w-full rounded-none border-b bg-transparent h-auto p-0">
                <TabsTrigger value="overview" className="flex-1 rounded-none text-xs py-2" data-testid="tab-overview">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="underwrite" className="flex-1 rounded-none text-xs py-2" data-testid="tab-underwrite">
                  <PenLine className="h-3 w-3 mr-1" />
                  Underwrite
                </TabsTrigger>
                <TabsTrigger value="community" className="flex-1 rounded-none text-xs py-2" data-testid="tab-community">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Community
                  {agg && ((agg.analysisCount ?? 0) > 0 || (agg.commentCount ?? 0) > 0) && (
                    <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0">
                      {(agg.analysisCount ?? 0) + (agg.commentCount ?? 0)}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="p-4 space-y-4 mt-0">
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
                    Yield Breakdown
                  </h4>
                  <div className="space-y-2 text-sm">
                    {selectedListing.unitCount > 1 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Units</span>
                        <span className="font-medium">{selectedListing.unitCount}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly Rent{selectedListing.unitCount > 1 ? " (total)" : ""}</span>
                      <span className="font-medium">
                        {formatPriceFull(selectedListing.estimatedMonthlyRent)}
                        {selectedListing.unitCount > 1 && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ({selectedListing.unitCount}×{formatPriceFull(Math.round(selectedListing.estimatedMonthlyRent / selectedListing.unitCount))})
                          </span>
                        )}
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
                      <span>Gross Yield</span>
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

                <Separator />

                <MiniDealAnalyzer
                  price={typeof selectedListing.listPrice === "string" ? parseFloat(selectedListing.listPrice) : selectedListing.listPrice}
                  monthlyRent={selectedListing.estimatedMonthlyRent}
                  annualPropertyTax={selectedListing.taxes?.annualAmount}
                  unitCount={selectedListing.unitCount}
                />

                <Button
                  className="w-full"
                  onClick={() => handleAnalyzeListing(selectedListing)}
                  data-testid="button-analyze-listing"
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  Full Analysis in Deal Analyzer
                </Button>
              </TabsContent>

              <TabsContent value="underwrite" className="p-4 space-y-4 mt-0">
                <div>
                  <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
                    <PenLine className="h-4 w-4" />
                    Community Underwriting
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Submit your analysis to help the community value this listing.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Unit Count</Label>
                    <Input
                      type="number"
                      min="1"
                      value={uwUnitCount}
                      onChange={(e) => setUwUnitCount(e.target.value)}
                      className="mt-1"
                      data-testid="input-uw-unit-count"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Rent / Unit ($/mo)</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder={String(Math.round(selectedListing.estimatedMonthlyRent))}
                      value={uwRentPerUnit}
                      onChange={(e) => setUwRentPerUnit(e.target.value)}
                      className="mt-1"
                      data-testid="input-uw-rent"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Vacancy (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={uwVacancy}
                      onChange={(e) => setUwVacancy(e.target.value)}
                      className="mt-1"
                      data-testid="input-uw-vacancy"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Expense Ratio (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={uwExpenseRatio}
                      onChange={(e) => setUwExpenseRatio(e.target.value)}
                      className="mt-1"
                      data-testid="input-uw-expense-ratio"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gross Annual Rent</span>
                    <span className="font-medium">{formatPriceFull(uwCalc.grossRent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vacancy ({uwVacancy || "5"}%)</span>
                    <span className="text-red-500">-{formatPriceFull(uwCalc.grossRent * (parseFloat(uwVacancy) || 5) / 100)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expenses ({uwExpenseRatio || "35"}%)</span>
                    <span className="text-red-500">-{formatPriceFull(uwCalc.grossRent * (parseFloat(uwExpenseRatio) || 35) / 100)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>NOI</span>
                    <span className={uwCalc.noi >= 0 ? "text-green-600" : "text-red-600"}>
                      {formatPriceFull(uwCalc.noi)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Your Yield</span>
                    <span className={getCapRateColor(uwCalc.capRate)}>
                      {uwCalc.capRate.toFixed(2)}%
                    </span>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Notes (optional)</Label>
                  <Textarea
                    value={uwNoteText}
                    onChange={(e) => setUwNoteText(e.target.value)}
                    placeholder="Any context about your analysis..."
                    className="mt-1 text-xs resize-none"
                    rows={3}
                    data-testid="input-uw-note"
                  />
                </div>

                {isAuthenticated ? (
                  <Button
                    className="w-full"
                    onClick={handleSubmitUnderwriting}
                    disabled={submitNoteMutation.isPending}
                    data-testid="button-submit-underwriting"
                  >
                    {submitNoteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Submit Correction
                  </Button>
                ) : (
                  <div className="text-center text-xs text-muted-foreground p-3 border rounded-md">
                    <a href="/login" className="text-primary underline" data-testid="link-login-underwrite">Sign in</a> to submit your underwriting analysis
                  </div>
                )}
              </TabsContent>

              <TabsContent value="community" className="p-4 space-y-4 mt-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Community ({(communityNotes.length || 0) + (communityComments.length || 0)})
                  </h4>
                  <Select value={communitySortBy} onValueChange={(v) => setCommunitySortBy(v as "top" | "new")}>
                    <SelectTrigger className="h-7 w-[80px] text-[10px]" data-testid="select-community-sort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top">Top</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {sortedNotes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Underwriting Notes</p>
                    {sortedNotes.map((note) => {
                      const rents = Array.isArray(note.rentsJson) ? (note.rentsJson as number[]) : [];
                      const totalRent = rents.reduce((a, b) => a + b, 0);
                      return (
                        <div key={note.id} className="border rounded-md p-2.5 space-y-1.5" data-testid={`card-note-${note.id}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium" data-testid={`text-note-user-${note.id}`}>
                              {(note as any).userName || "Investor"}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => isAuthenticated && voteMutation.mutate({ targetType: "underwriting_note", targetId: note.id, value: 1 })}
                                data-testid={`button-upvote-note-${note.id}`}
                              >
                                <ThumbsUp className="h-3 w-3" />
                              </Button>
                              <span className="text-xs font-medium min-w-[16px] text-center" data-testid={`text-note-score-${note.id}`}>
                                {note.score || 0}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => isAuthenticated && voteMutation.mutate({ targetType: "underwriting_note", targetId: note.id, value: -1 })}
                                data-testid={`button-downvote-note-${note.id}`}
                              >
                                <ThumbsDown className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                            {note.unitCount && <span>{note.unitCount} units</span>}
                            {totalRent > 0 && <span>${totalRent.toLocaleString()}/mo total rent</span>}
                            {note.vacancy != null && <span>{note.vacancy}% vacancy</span>}
                            {note.expenseRatio != null && <span>{note.expenseRatio}% expenses</span>}
                          </div>
                          {note.noteText && (
                            <p className="text-xs text-muted-foreground">{note.noteText}</p>
                          )}
                          <p className="text-[9px] text-muted-foreground">
                            {new Date(note.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {sortedComments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Comments</p>
                    {sortedComments.map((comment) => (
                      <div key={comment.id} className="border rounded-md p-2.5 space-y-1" data-testid={`card-comment-${comment.id}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium" data-testid={`text-comment-user-${comment.id}`}>
                            {(comment as any).userName || "Investor"}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => isAuthenticated && voteMutation.mutate({ targetType: "listing_comment", targetId: comment.id, value: 1 })}
                              data-testid={`button-upvote-comment-${comment.id}`}
                            >
                              <ThumbsUp className="h-3 w-3" />
                            </Button>
                            <span className="text-xs font-medium min-w-[16px] text-center" data-testid={`text-comment-score-${comment.id}`}>
                              {comment.score || 0}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => isAuthenticated && voteMutation.mutate({ targetType: "listing_comment", targetId: comment.id, value: -1 })}
                              data-testid={`button-downvote-comment-${comment.id}`}
                            >
                              <ThumbsDown className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs">{comment.body}</p>
                        <p className="text-[9px] text-muted-foreground">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {sortedNotes.length === 0 && sortedComments.length === 0 && (
                  <div className="text-center py-6">
                    <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm font-medium mb-1">No community data yet</p>
                    <p className="text-xs text-muted-foreground">Be the first to underwrite or comment on this listing.</p>
                  </div>
                )}

                <Separator />

                {isAuthenticated ? (
                  <div className="space-y-2">
                    <Label className="text-xs">Add a comment</Label>
                    <div className="flex gap-2">
                      <Textarea
                        value={commentBody}
                        onChange={(e) => setCommentBody(e.target.value)}
                        placeholder="Share your thoughts on this listing..."
                        className="text-xs resize-none flex-1"
                        rows={2}
                        data-testid="input-comment"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={handleSubmitComment}
                      disabled={!commentBody.trim() || submitCommentMutation.isPending}
                      data-testid="button-submit-comment"
                    >
                      {submitCommentMutation.isPending ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3 mr-1" />
                      )}
                      Post Comment
                    </Button>
                  </div>
                ) : (
                  <div className="text-center text-xs text-muted-foreground p-3 border rounded-md">
                    <a href="/login" className="text-primary underline" data-testid="link-login-comment">Sign in</a> to join the discussion
                  </div>
                )}
              </TabsContent>
            </Tabs>
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
                Move the map to any area to see listings and yields.
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

      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-[1000] relative">
        <div className="px-3 py-2 space-y-2">
          <div className="flex gap-2 items-center">
            <div className="flex-1 relative">
              <Sparkles className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
              <Input
                placeholder='Try: "duplexes in Hamilton under 600k" or "3 bed houses in Calgary"'
                value={findDealsQuery}
                onChange={(e) => setFindDealsQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFindDeals()}
                className="pl-9 h-9 text-sm"
                data-testid="input-find-deals"
              />
            </div>
            <Button
              size="sm"
              className="h-9 px-4"
              onClick={handleFindDeals}
              disabled={findDealsLoading || !findDealsQuery.trim()}
              data-testid="button-find-deals"
            >
              {findDealsLoading ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Target className="h-4 w-4 mr-1.5" />
              )}
              Find Deals
            </Button>
            {findDealsActive && (
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={handleClearFindDeals}
                data-testid="button-clear-find-deals"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {findDealsActive && Object.keys(findDealsFilters).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-[10px] gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" data-testid="badge-ai-filters">
                <Sparkles className="h-3 w-3" />
                AI Filters Applied
              </Badge>
              {findDealsFilters.city && (
                <Badge variant="outline" className="text-[10px]">{findDealsFilters.city}</Badge>
              )}
              {findDealsFilters.propertyType && (
                <Badge variant="outline" className="text-[10px]">{findDealsFilters.propertyType}</Badge>
              )}
              {findDealsFilters.maxPrice && (
                <Badge variant="outline" className="text-[10px]">Under {formatPrice(findDealsFilters.maxPrice)}</Badge>
              )}
              {findDealsFilters.minPrice && (
                <Badge variant="outline" className="text-[10px]">Over {formatPrice(findDealsFilters.minPrice)}</Badge>
              )}
              {findDealsFilters.minBeds && (
                <Badge variant="outline" className="text-[10px]">{findDealsFilters.minBeds}+ beds</Badge>
              )}
              <div className="ml-auto flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-[9px] text-muted-foreground">80+</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-[9px] text-muted-foreground">65–79</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-500" />
                  <span className="text-[9px] text-muted-foreground">&lt;65</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 items-end">
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
            <div className="min-w-[75px]">
              <Label className="text-[10px] text-muted-foreground mb-0.5 block">Units</Label>
              <Select value={minUnits} onValueChange={setMinUnits}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-units">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="1">1+</SelectItem>
                  <SelectItem value="2">2+</SelectItem>
                  <SelectItem value="3">3+</SelectItem>
                  <SelectItem value="4">4+</SelectItem>
                  <SelectItem value="6">6+</SelectItem>
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
              <Label className="text-[10px] text-muted-foreground mb-0.5 block">Min Yield</Label>
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
                  <SelectItem value="capRate">Yield</SelectItem>
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
            {hasSearched && (
              <div className="flex items-center gap-1.5 ml-auto">
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
                {isSearching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            )}
          </div>
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
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Real estate listings powered by <a href="https://valery.ca" target="_blank" rel="noopener noreferrer">valery.ca</a> / Valery Real Estate Inc.'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            {findDealsActive ? (
              displayedDealResults.map((result) => (
                <Marker
                  key={`deal-${result.id}`}
                  position={[result.lat, result.lng]}
                  icon={createDealScoreIcon(
                    result.deal_score,
                    selectedDealResult?.id === result.id
                  )}
                  eventHandlers={{
                    click: () => handleSelectDealResult(result),
                  }}
                >
                  <Popup>
                    <div className="min-w-[220px]">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-bold text-sm">{formatPrice(result.price)}</p>
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{
                          background: getDealScoreColor(result.deal_score),
                          color: "white"
                        }}>
                          Score: {result.deal_score}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{formatShortAddress(result.address)}, {result.address?.city}</p>
                      <div className="flex gap-3 mt-1 text-xs">
                        <span className="font-medium">{result.cap_rate}% cap</span>
                        <span className="font-medium">{result.cash_on_cash}% CoC</span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">{getDealScoreLabel(result.deal_score)}</p>
                    </div>
                  </Popup>
                </Marker>
              ))
            ) : (
              mappableListings.map((listing) => (
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
                        {listing.capRate.toFixed(1)}% Yield
                      </p>
                      <p className="text-xs text-gray-500">
                        {listing.details?.numBedrooms || "?"} bed / {listing.details?.numBathrooms || "?"} bath
                        {listing.details?.sqft ? ` / ${listing.details.sqft} sqft` : ""}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))
            )}
            <NeighbourhoodOverlay layers={mapLayers} />
            <MapEventHandler onBoundsChange={handleBoundsChange} />
            <GeolocateOnMount />
            {flyTo && <FlyToLocation lat={flyTo.lat} lng={flyTo.lng} />}
          </MapContainer>

          <MapLayersPanel layers={mapLayers} onLayersChange={setMapLayers} />

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
