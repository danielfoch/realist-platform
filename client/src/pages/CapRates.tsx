import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useSearch } from "wouter";
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
import {
  getRecentViewedListingSignals,
  getSavedSearchSignals,
  getSavedListingSignals,
  persistRecentViewedListingSignal,
  persistSavedSearchSignal,
  persistSavedListingSignal,
  syncDiscoverySignalsWithAccount,
  track,
  type SavedSearchSignal,
  type SavedListingSignal,
} from "@/lib/analytics";
import { getCmhcRent } from "@shared/cmhcRents";
import { MiniDealAnalyzer } from "@/components/MiniDealAnalyzer";
import type { ListingAnalysisAggregate } from "@shared/schema";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { MapLayersPanel, DEFAULT_LAYERS, type MapLayer } from "@/components/MapLayersPanel";
import { NeighbourhoodOverlay } from "@/components/NeighbourhoodOverlay";
import { CommunityAnalysisBadge } from "@/components/CommunityAnalysisBadge";
import { AnalysisVisibilityToggle } from "@/components/AnalysisVisibilityToggle";
import { AnalysisConsentNotice, type AnalysisConsentState } from "@/components/AnalysisConsentNotice";
import { CommunityMetricsSummary } from "@/components/CommunityMetricsSummary";
import { CommunityAnalysisModal } from "@/components/CommunityAnalysisModal";
import { ListingCommentsSection } from "@/components/ListingCommentsSection";
import { ListingCommentCountBadge } from "@/components/ListingCommentCountBadge";

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

function buildListingSignal(listing: RepliersListing & {
  capRate?: number;
  estimatedMonthlyRent?: number;
  unitCount?: number;
}, source: string): SavedListingSignal {
  const price = typeof listing.listPrice === "string" ? parseFloat(listing.listPrice) : listing.listPrice;
  return {
    id: listing.mlsNumber || `${formatShortAddress(listing.address)}-${source}`,
    createdAt: new Date().toISOString(),
    label: formatShortAddress(listing.address),
    listingId: listing.mlsNumber || undefined,
    address: formatAddress(listing.address),
    city: listing.address?.city || undefined,
    propertyType: listing.details?.propertyType || listing.type || undefined,
    price: Number.isFinite(price) ? price : undefined,
    capRate: typeof listing.capRate === "number" ? listing.capRate : undefined,
    source,
  };
}

function createCapRateIcon(capRate: number, isSelected: boolean, aggregate?: ListingAnalysisAggregate | null): L.DivIcon {
  const color = getCapRateMarkerColor(capRate);
  const size = isSelected ? 44 : 36;
  const fontSize = isSelected ? 13 : 11;
  const border = isSelected ? "3px solid #2563eb" : "2px solid white";
  const shadow = isSelected ? "0 0 0 2px #2563eb, 0 2px 8px rgba(0,0,0,0.3)" : "0 2px 6px rgba(0,0,0,0.3)";
  const zIndex = isSelected ? 1000 : 1;
  const communityCount = (aggregate?.publicAnalysisCount || 0) + (aggregate?.publicCommentCount || 0);
  const badgeHtml = communityCount > 0
    ? `<div style="
        position:absolute;
        right:-8px;
        bottom:-6px;
        min-width:18px;
        height:18px;
        padding:0 4px;
        border-radius:999px;
        background:#111827;
        color:white;
        font-size:10px;
        font-weight:800;
        display:flex;
        align-items:center;
        justify-content:center;
        border:2px solid white;
      ">${communityCount}</div>`
    : "";

  return L.divIcon({
    className: "cap-rate-marker",
    html: `<div style="position:relative"><div style="
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
    ">${capRate.toFixed(1)}%</div>${badgeHtml}</div>`,
    iconSize: [size + 10, size + 10],
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

function createClusterIcon(avgCapRate: number, count: number): L.DivIcon {
  const color = getCapRateMarkerColor(avgCapRate);
  const size = count > 75 ? 56 : count > 24 ? 48 : 40;
  const label = `${avgCapRate.toFixed(1)}%`;

  return L.divIcon({
    className: "yield-cluster-marker",
    html: `<div style="
      width:${size}px;
      height:${size}px;
      border-radius:50%;
      background:${color};
      border:3px solid rgba(255,255,255,0.95);
      box-shadow:0 6px 18px rgba(15,23,42,0.24);
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      color:white;
      font-family:system-ui,-apple-system,sans-serif;
      line-height:1.05;
    ">
      <span style="font-size:${count > 75 ? 13 : 12}px;font-weight:800;">${label}</span>
      <span style="font-size:10px;font-weight:700;opacity:0.92;">${count}</span>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function ClusteredListingsLayer({
  listings,
  selectedListingId,
  onSelectListing,
  aggregatesMap,
}: {
  listings: ListingWithCapRate[];
  selectedListingId?: string;
  onSelectListing: (listing: ListingWithCapRate) => void;
  aggregatesMap: Record<string, ListingAnalysisAggregate>;
}) {
  const map = useMap();
  const clusterRef = useRef<any>(null);

  useEffect(() => {
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
    }

    const cluster = (L as any).markerClusterGroup({
      maxClusterRadius: 70,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      chunkedLoading: true,
      disableClusteringAtZoom: 14,
      iconCreateFunction: (clusterGroup: any) => {
        const children = clusterGroup.getAllChildMarkers() as Array<L.Marker & { options: { capRate?: number } }>;
        const capRates = children
          .map((child) => child.options.capRate)
          .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
        const avgCapRate = capRates.length
          ? capRates.reduce((sum, value) => sum + value, 0) / capRates.length
          : 0;
        return createClusterIcon(avgCapRate, clusterGroup.getChildCount());
      },
    });

    for (const listing of listings) {
      if (!listing.map?.latitude || !listing.map?.longitude) continue;
      const marker = L.marker(
        [listing.map.latitude, listing.map.longitude],
        {
          icon: createCapRateIcon(listing.capRate, selectedListingId === listing.mlsNumber, aggregatesMap[listing.mlsNumber]),
          capRate: listing.capRate,
        } as L.MarkerOptions & { capRate: number },
      );
      const aggregate = aggregatesMap[listing.mlsNumber];

      marker.bindPopup(`
        <div style="min-width:200px">
          <p style="margin:0;font-weight:700;font-size:14px">${formatPrice(listing.listPrice)}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#4b5563">${formatShortAddress(listing.address)}, ${listing.address?.city || ""}</p>
          <p style="margin:6px 0 0;font-size:12px;font-weight:700;color:${getCapRateMarkerColor(listing.capRate)}">${listing.capRate.toFixed(1)}% Yield</p>
          ${aggregate ? `<p style="margin:6px 0 0;font-size:12px;color:#111827">${aggregate.publicAnalysisCount || 0} analyses · ${aggregate.publicCommentCount || 0} comments</p>` : ""}
          ${aggregate?.medianMonthlyCashFlow != null ? `<p style="margin:4px 0 0;font-size:12px;color:#4b5563">Median CF: $${Math.round(aggregate.medianMonthlyCashFlow).toLocaleString()}/mo</p>` : ""}
          ${aggregate?.consensusLabel ? `<p style="margin:4px 0 0;font-size:12px;color:#4b5563;text-transform:capitalize">Consensus: ${aggregate.consensusLabel}</p>` : ""}
        </div>
      `);
      marker.on("click", () => onSelectListing(listing));
      cluster.addLayer(marker);
    }

    map.addLayer(cluster);
    clusterRef.current = cluster;

    return () => {
      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
      }
      clusterRef.current = null;
    };
  }, [aggregatesMap, listings, map, onSelectListing, selectedListingId]);

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
  const search = useSearch();
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
  const initialQueryHandledRef = useRef(false);

  const [findDealsQuery, setFindDealsQuery] = useState("");
  const [findDealsResults, setFindDealsResults] = useState<FindDealsResult[]>([]);
  const [findDealsActive, setFindDealsActive] = useState(false);
  const [findDealsLoading, setFindDealsLoading] = useState(false);
  const [findDealsFilters, setFindDealsFilters] = useState<Record<string, any>>({});
  const [showTopDealsOnly, setShowTopDealsOnly] = useState(false);
  const [selectedDealResult, setSelectedDealResult] = useState<FindDealsResult | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearchSignal[]>(() => getSavedSearchSignals().slice(0, 4));
  const [savedShortlist, setSavedShortlist] = useState<SavedListingSignal[]>(() => getSavedListingSignals().slice(0, 4));
  const [recentViewedListings, setRecentViewedListings] = useState<SavedListingSignal[]>(() => getRecentViewedListingSignals().slice(0, 4));

  const [uwUnitCount, setUwUnitCount] = useState("1");
  const [uwRentPerUnit, setUwRentPerUnit] = useState("");
  const [uwVacancy, setUwVacancy] = useState("5");
  const [uwExpenseRatio, setUwExpenseRatio] = useState("35");
  const [uwDownPaymentPercent, setUwDownPaymentPercent] = useState("20");
  const [uwInterestRate, setUwInterestRate] = useState("5.5");
  const [uwAmortizationYears, setUwAmortizationYears] = useState("25");
  const [uwNoteText, setUwNoteText] = useState("");
  const [analysisVisibility, setAnalysisVisibility] = useState<"public" | "private">("public");
  const [analysisConsent, setAnalysisConsent] = useState<AnalysisConsentState>({
    useForProductImprovement: false,
    useForAiTraining: false,
    useForAnonymizedMarketDataset: false,
    allowCommercialDataLicensing: false,
  });
  const [communityCommentSort, setCommunityCommentSort] = useState<"newest" | "oldest" | "most_helpful" | "pinned">("pinned");
  const [analysisSort, setAnalysisSort] = useState<"newest" | "most_useful" | "highest_cap_rate" | "most_conservative" | "most_bullish" | "most_bearish">("newest");
  const [showCommunityModal, setShowCommunityModal] = useState(false);

  const { data: rentData = [] } = useQuery<RentPulseData[]>({
    queryKey: ["/api/rents/pulse"],
  });

  const { data: ddfStatus } = useQuery<{ configured: boolean; authenticated: boolean }>({
    queryKey: ["/api/ddf/status"],
  });

  const selectedMls = selectedListing?.mlsNumber;

  const { data: publicAnalyses = [], refetch: refetchPublicAnalyses } = useQuery<any[]>({
    queryKey: ["/api/community/analyses", selectedMls, analysisSort],
    queryFn: async () => {
      if (!selectedMls) return [];
      const res = await fetch(`/api/community/analyses/${selectedMls}?sort=${analysisSort}`);
      return res.json();
    },
    enabled: !!selectedMls,
  });

  const { data: myAnalyses = [], refetch: refetchMyAnalyses } = useQuery<any[]>({
    queryKey: ["/api/community/my-analyses", selectedMls],
    queryFn: async () => {
      if (!selectedMls || !isAuthenticated) return [];
      const res = await fetch(`/api/community/my-analyses/${selectedMls}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedMls && isAuthenticated,
  });

  const { data: communityComments = [], refetch: refetchComments } = useQuery<any[]>({
    queryKey: ["/api/community/comments", selectedMls, communityCommentSort],
    queryFn: async () => {
      if (!selectedMls) return [];
      const res = await fetch(`/api/community/comments/${selectedMls}?sort=${communityCommentSort}`);
      return res.json();
    },
    enabled: !!selectedMls,
  });

  const { data: privateNotes = [], refetch: refetchPrivateNotes } = useQuery<any[]>({
    queryKey: ["/api/community/private-notes", selectedMls],
    queryFn: async () => {
      if (!selectedMls || !isAuthenticated) return [];
      const res = await fetch(`/api/community/private-notes/${selectedMls}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedMls && isAuthenticated,
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

  const submitAnalysisMutation = useMutation({
    mutationFn: async (data: {
      listingMlsNumber: string;
      title: string;
      summary: string;
      userNotes: string;
      city?: string;
      province?: string;
      market?: string;
      propertyType?: string;
      listingPrice?: number;
      visibility: "public" | "private";
      assumptions: Record<string, unknown>;
      calculatedMetrics: Record<string, unknown>;
      listingSnapshot: Record<string, unknown>;
      sourceContext: Record<string, unknown>;
      dataUseConsent: AnalysisConsentState;
    }) => {
      const res = await apiRequest("POST", "/api/community/analyses", data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({ title: "Analysis saved", description: variables.visibility === "public" ? "Visible to the community" : "Saved privately" });
      refetchPublicAnalyses();
      refetchMyAnalyses();
      setUwNoteText("");
      fetchAggregatesBatch([variables.listingMlsNumber]);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to save analysis", variant: "destructive" });
    },
  });

  const submitCommentMutation = useMutation({
    mutationFn: async (data: { listingMlsNumber: string; body: string; visibility: "public" | "private"; parentCommentId?: string }) => {
      const res = await apiRequest("POST", "/api/community/comments", data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({ title: variables.visibility === "private" ? "Private note saved" : "Comment posted" });
      refetchComments();
      refetchPrivateNotes();
      fetchAggregatesBatch([variables.listingMlsNumber]);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to post comment", variant: "destructive" });
    },
  });

  const commentHelpfulMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await apiRequest("POST", `/api/community/comments/${commentId}/helpful`, {});
      return res.json();
    },
    onSuccess: () => {
      refetchComments();
      if (selectedMls) fetchAggregatesBatch([selectedMls]);
    },
  });

  const commentReportMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await apiRequest("POST", `/api/community/comments/${commentId}/report`, {});
      return res.json();
    },
    onSuccess: () => {
      refetchComments();
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await apiRequest("DELETE", `/api/community/comments/${commentId}`, {});
      return res.json();
    },
    onSuccess: () => {
      refetchComments();
      refetchPrivateNotes();
      if (selectedMls) fetchAggregatesBatch([selectedMls]);
    },
  });

  const analysisFeedbackMutation = useMutation({
    mutationFn: async ({ analysisId, feedbackType }: { analysisId: string; feedbackType: "useful" | "not_useful" | "disagree" }) => {
      const res = await apiRequest("POST", `/api/community/analyses/${analysisId}/feedback`, { feedbackType });
      return res.json();
    },
    onSuccess: () => {
      refetchPublicAnalyses();
    },
  });

  const duplicateAnalysisMutation = useMutation({
    mutationFn: async (analysisId: string) => {
      const res = await apiRequest("POST", `/api/community/analyses/${analysisId}/duplicate`, {});
      return res.json();
    },
    onSuccess: () => {
      refetchMyAnalyses();
      refetchPublicAnalyses();
      if (selectedMls) fetchAggregatesBatch([selectedMls]);
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

  useEffect(() => {
    if (initialQueryHandledRef.current || !search) return;
    const params = new URLSearchParams(search);
    const q = params.get("q");
    if (!q) {
      initialQueryHandledRef.current = true;
      return;
    }
    setFindDealsQuery(q);
  }, [search]);

  useEffect(() => {
    if (initialQueryHandledRef.current || !mapBounds || !findDealsQuery.trim()) return;
    initialQueryHandledRef.current = true;
    handleFindDeals();
  }, [findDealsQuery, mapBounds, handleFindDeals]);

  useEffect(() => {
    if (!isAuthenticated) return;
    syncDiscoverySignalsWithAccount().then(() => {
      setSavedSearches(getSavedSearchSignals().slice(0, 4));
      setSavedShortlist(getSavedListingSignals().slice(0, 4));
      setRecentViewedListings(getRecentViewedListingSignals().slice(0, 4));
    });
  }, [isAuthenticated]);

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

  const activeFilterCount = useMemo(() => {
    return [
      Boolean(minPrice),
      Boolean(maxPrice),
      minBeds !== "any",
      minUnits !== "any",
      propertyType !== "all",
      minCapRate !== "any",
      sortBy !== "capRate",
    ].filter(Boolean).length;
  }, [minPrice, maxPrice, minBeds, minUnits, propertyType, minCapRate, sortBy]);

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

  const handleSaveCurrentSearch = () => {
    const normalizedQuery = findDealsQuery.trim();
    const inferredGeography = selectedListing?.address?.city || recentViewedListings[0]?.city || undefined;
    const savedSearch: SavedSearchSignal = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      label: normalizedQuery
        ? `Map search · ${normalizedQuery}`
        : [
            propertyType !== "all" ? propertyType : null,
            minCapRate !== "any" ? `${minCapRate}%+ cap` : null,
            minPrice ? `from $${Number(minPrice).toLocaleString()}` : null,
            maxPrice ? `to $${Number(maxPrice).toLocaleString()}` : null,
          ].filter(Boolean).join(" · ") || "Saved map search",
      query: normalizedQuery || undefined,
      geography: inferredGeography,
      strategy: normalizedQuery.toLowerCase().includes("multiplex")
        ? "multiplex"
        : normalizedQuery.toLowerCase().includes("brrr")
          ? "brrr"
          : undefined,
      propertyType: propertyType !== "all" ? propertyType : undefined,
      budgetMax: maxPrice ? Number(maxPrice) : undefined,
      targetGrossYield: minCapRate !== "any" ? Number(minCapRate) : undefined,
      financingIntent: true,
      renovationIntent: normalizedQuery.toLowerCase().includes("flip") || normalizedQuery.toLowerCase().includes("brrr"),
    };

    persistSavedSearchSignal(savedSearch);
    setSavedSearches(getSavedSearchSignals().slice(0, 4));
    if (isAuthenticated) {
      void syncDiscoverySignalsWithAccount();
    }
    track({
      event: "saved_search",
      geography: savedSearch.geography,
      filters: {
        query: savedSearch.query,
        strategy: savedSearch.strategy,
        propertyType: savedSearch.propertyType,
        budgetMax: savedSearch.budgetMax,
        targetGrossYield: savedSearch.targetGrossYield,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
        minBeds,
        minUnits,
        sortBy,
      },
    });
    toast({
      title: "Search saved",
      description: "This search now appears in your investor workspace.",
    });
  };

  const handleSaveShortlist = (listing: ListingWithCapRate) => {
    const signal = buildListingSignal(listing, "map_shortlist");
    persistSavedListingSignal(signal);
    setSavedShortlist(getSavedListingSignals().slice(0, 4));
    if (isAuthenticated) {
      void syncDiscoverySignalsWithAccount();
    }
    track({
      event: "saved_listing",
      listing_id: listing.mlsNumber || signal.address,
      city: listing.address?.city || undefined,
      price: signal.price,
      property_type: signal.propertyType,
      source: "map_shortlist",
    });
    toast({
      title: "Saved to shortlist",
      description: "This property is saved as a discovery shortcut.",
    });
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
    persistRecentViewedListingSignal(buildListingSignal(listing, "map_recent_view"));
    setRecentViewedListings(getRecentViewedListingSignals().slice(0, 4));
    if (isAuthenticated) {
      void syncDiscoverySignalsWithAccount();
    }
    track({
      event: "listing_viewed",
      listing_id: listing.mlsNumber,
      city: listing.address?.city || undefined,
      property_type: listing.details?.propertyType || listing.type || undefined,
      price: typeof listing.listPrice === "string" ? parseFloat(listing.listPrice) : listing.listPrice,
      gross_yield: listing.capRate,
    });
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

            <div className="flex items-center justify-between mt-1">
              {(() => {
                const agg = aggregatesMap[listing.mlsNumber];
                if (agg && ((agg.publicAnalysisCount ?? 0) > 0 || (agg.publicCommentCount ?? 0) > 0)) {
                  return (
                    <div className="flex flex-col items-start gap-1">
                      <CommunityAnalysisBadge aggregate={agg} />
                      <div className="flex flex-wrap gap-2 text-[9px] text-muted-foreground" data-testid={`text-community-stats-${listing.mlsNumber}`}>
                        <span>By {agg.uniquePublicUserCount || 0} users</span>
                        {agg.medianCapRate != null && <span>{agg.medianCapRate.toFixed(1)}% median cap</span>}
                        {agg.medianMonthlyCashFlow != null && <span>${Math.round(agg.medianMonthlyCashFlow).toLocaleString()}/mo median CF</span>}
                      </div>
                    </div>
                  );
                }
                return (
                  <span className="text-[9px] text-primary cursor-pointer" data-testid={`link-first-analyze-${listing.mlsNumber}`}>
                    Be first to analyze
                  </span>
                );
              })()}
              <Badge
                variant="outline"
                className="text-[9px] px-1.5 py-0 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors flex-shrink-0"
                data-testid={`badge-analyze-deal-${listing.mlsNumber}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAnalyzeListing(listing);
                }}
              >
                <Calculator className="h-2.5 w-2.5 mr-0.5" />
                Analyze Deal
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <ListingCommentCountBadge
                count={aggregatesMap[listing.mlsNumber]?.publicCommentCount}
                hasRecent={Boolean(aggregatesMap[listing.mlsNumber]?.latestPublicCommentAt)}
              />
              {(aggregatesMap[listing.mlsNumber]?.publicAnalysisCount || 0) > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectListing(listing);
                    setDetailTab("community");
                  }}
                >
                  View community analyses
                </Badge>
              )}
              {aggregatesMap[listing.mlsNumber]?.latestPublicAnalysisAt && (
                <Badge variant="outline" className="text-[10px]">
                  Last analyzed {new Date(aggregatesMap[listing.mlsNumber].latestPublicAnalysisAt as Date | string).toLocaleDateString()}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleSubmitUnderwriting = () => {
    if (!selectedListing || !isAuthenticated) return;
    const unitCount = parseInt(uwUnitCount) || 1;
    const rentPerUnit = parseFloat(uwRentPerUnit) || selectedListing.estimatedMonthlyRent;
    const price = typeof selectedListing.listPrice === "string" ? parseFloat(selectedListing.listPrice) : selectedListing.listPrice;
    const metrics = computeUwCapRate();
    submitAnalysisMutation.mutate({
      listingMlsNumber: selectedListing.mlsNumber,
      title: `${formatShortAddress(selectedListing.address)} underwriting`,
      summary: metrics.monthlyCashFlow > 0
        ? "Positive monthly cash flow under current underwriting."
        : "Negative monthly cash flow under current underwriting.",
      userNotes: uwNoteText,
      city: selectedListing.address?.city,
      province: selectedListing.address?.state,
      market: selectedListing.address?.city,
      propertyType: selectedListing.details?.propertyType || selectedListing.type,
      listingPrice: price,
      visibility: analysisVisibility,
      assumptions: {
        rent: {
          unitCount,
          rentPerUnit,
          projectedMonthlyRent: unitCount * rentPerUnit,
        },
        vacancy: { percent: parseFloat(uwVacancy) || 5 },
        expenses: { expenseRatio: parseFloat(uwExpenseRatio) || 35 },
        financing: {
          downPaymentPercent: parseFloat(uwDownPaymentPercent) || 20,
          interestRate: parseFloat(uwInterestRate) || 5.5,
          amortizationYears: parseFloat(uwAmortizationYears) || 25,
        },
      },
      calculatedMetrics: {
        capRate: metrics.capRate,
        annualNoi: metrics.noi,
        monthlyCashFlow: metrics.monthlyCashFlow,
        cashOnCash: metrics.cashOnCash,
        dscr: metrics.dscr,
        projectedRent: unitCount * rentPerUnit,
      },
      listingSnapshot: {
        address: selectedListing.address,
        listPrice: price,
        details: selectedListing.details,
        taxes: selectedListing.taxes,
        mlsNumber: selectedListing.mlsNumber,
      },
      sourceContext: {
        source: "cap_rates_map",
        selectedCapRate: selectedListing.capRate,
        selectedEstimatedRent: selectedListing.estimatedMonthlyRent,
      },
      dataUseConsent: analysisConsent,
    });
  };

  const handleSubmitComment = (body: string, visibility: "public" | "private", parentCommentId?: string) => {
    if (!selectedListing || !isAuthenticated || !body.trim()) return;
    submitCommentMutation.mutate({
      listingMlsNumber: selectedListing.mlsNumber,
      body,
      visibility,
      parentCommentId,
    });
  };

  const computeUwCapRate = () => {
    if (!selectedListing) return { capRate: 0, noi: 0, grossRent: 0, monthlyCashFlow: 0, cashOnCash: 0, dscr: 0, monthlyDebtService: 0 };
    const unitCount = parseInt(uwUnitCount) || 1;
    const rentPerUnit = parseFloat(uwRentPerUnit) || selectedListing.estimatedMonthlyRent;
    const vacancy = parseFloat(uwVacancy) || 5;
    const expenseRatio = parseFloat(uwExpenseRatio) || 35;
    const downPaymentPercent = parseFloat(uwDownPaymentPercent) || 20;
    const interestRate = parseFloat(uwInterestRate) || 5.5;
    const amortizationYears = parseFloat(uwAmortizationYears) || 25;
    const price = typeof selectedListing.listPrice === "string" ? parseFloat(selectedListing.listPrice) : selectedListing.listPrice;
    const grossRent = unitCount * rentPerUnit * 12;
    const effectiveRent = grossRent * (1 - vacancy / 100);
    const expenses = grossRent * (expenseRatio / 100);
    const noi = effectiveRent - expenses;
    const capRate = price > 0 ? (noi / price) * 100 : 0;
    const loanAmount = price * (1 - downPaymentPercent / 100);
    const monthlyRate = interestRate / 100 / 12;
    const amortizationMonths = amortizationYears * 12;
    const monthlyDebtService = monthlyRate > 0
      ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, amortizationMonths)) / (Math.pow(1 + monthlyRate, amortizationMonths) - 1)
      : loanAmount / Math.max(amortizationMonths, 1);
    const monthlyCashFlow = noi / 12 - monthlyDebtService;
    const cashInvested = price * (downPaymentPercent / 100);
    const cashOnCash = cashInvested > 0 ? ((monthlyCashFlow * 12) / cashInvested) * 100 : 0;
    const dscr = monthlyDebtService > 0 ? (noi / 12) / monthlyDebtService : 0;
    return { capRate: Math.max(0, capRate), noi, grossRent, monthlyCashFlow, cashOnCash, dscr, monthlyDebtService };
  };

  const renderDetailPanel = () => {
    if (!selectedListing) return null;
    const agg = aggregatesMap[selectedListing.mlsNumber];
    const uwCalc = computeUwCapRate();

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
                  {agg?.medianCapRate != null && (
                    <Badge variant="secondary" className="text-[10px]" data-testid="badge-detail-community-cap">
                      <Users className="h-3 w-3 mr-0.5" />
                      {agg.medianCapRate.toFixed(1)}%
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
                  {agg && ((agg.publicAnalysisCount ?? 0) > 0 || (agg.publicCommentCount ?? 0) > 0) && (
                    <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0">
                      {(agg.publicAnalysisCount ?? 0) + (agg.publicCommentCount ?? 0)}
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

                <Button
                  className="w-full"
                  onClick={() => handleAnalyzeListing(selectedListing)}
                  data-testid="button-analyze-listing"
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  Open in Deal Analyzer
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleSaveShortlist(selectedListing)}
                  data-testid="button-save-shortlist"
                >
                  <Star className="h-4 w-4 mr-2" />
                  Save to shortlist
                </Button>
                <CommunityMetricsSummary aggregate={agg} />
                {(agg?.publicAnalysisCount || 0) > 0 && (
                  <Button variant="outline" className="w-full" onClick={() => setShowCommunityModal(true)}>
                    View community analyses
                  </Button>
                )}

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
              </TabsContent>

              <TabsContent value="underwrite" className="p-4 space-y-4 mt-0">
                <div>
                  <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
                    <PenLine className="h-4 w-4" />
                    Save Your Analysis
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Save structured underwriting to this listing. Public analyses appear in community history by default.
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
                  <div>
                    <Label className="text-xs">Down Payment (%)</Label>
                    <Input type="number" min="0" max="100" value={uwDownPaymentPercent} onChange={(e) => setUwDownPaymentPercent(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Interest Rate (%)</Label>
                    <Input type="number" min="0" max="25" value={uwInterestRate} onChange={(e) => setUwInterestRate(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Amortization (yrs)</Label>
                    <Input type="number" min="1" max="40" value={uwAmortizationYears} onChange={(e) => setUwAmortizationYears(e.target.value)} className="mt-1" />
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
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Debt Service / mo</span>
                    <span>{formatPriceFull(uwCalc.monthlyDebtService * 12)}/yr</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly Cash Flow</span>
                    <span className={uwCalc.monthlyCashFlow >= 0 ? "text-green-600" : "text-red-600"}>
                      {formatPriceFull(uwCalc.monthlyCashFlow * 12)}/yr
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Your Yield</span>
                    <span className={getCapRateColor(uwCalc.capRate)}>
                      {uwCalc.capRate.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cash-on-Cash</span>
                    <span>{uwCalc.cashOnCash.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">DSCR</span>
                    <span>{uwCalc.dscr.toFixed(2)}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Analysis notes</Label>
                  <Textarea
                    value={uwNoteText}
                    onChange={(e) => setUwNoteText(e.target.value)}
                    placeholder="Any context about your analysis..."
                    className="mt-1 text-xs resize-none"
                    rows={3}
                    data-testid="input-uw-note"
                  />
                </div>
                <AnalysisVisibilityToggle visibility={analysisVisibility} onChange={setAnalysisVisibility} />
                <AnalysisConsentNotice value={analysisConsent} onChange={setAnalysisConsent} />

                {isAuthenticated ? (
                  <Button
                    className="w-full"
                    onClick={handleSubmitUnderwriting}
                    disabled={submitAnalysisMutation.isPending}
                    data-testid="button-submit-underwriting"
                  >
                    {submitAnalysisMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Save analysis
                  </Button>
                ) : (
                  <div className="text-center text-xs text-muted-foreground p-3 border rounded-md">
                    <a href="/login" className="text-primary underline" data-testid="link-login-underwrite">Sign in</a> to save your underwriting analysis
                  </div>
                )}
              </TabsContent>

              <TabsContent value="community" className="p-4 space-y-4 mt-0">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Community
                  </h4>
                  <div className="flex gap-2">
                    <Select value={analysisSort} onValueChange={(v) => setAnalysisSort(v as any)}>
                      <SelectTrigger className="h-8 w-[150px] text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest analyses</SelectItem>
                        <SelectItem value="most_useful">Most useful</SelectItem>
                        <SelectItem value="highest_cap_rate">Highest cap rate</SelectItem>
                        <SelectItem value="most_conservative">Most conservative</SelectItem>
                        <SelectItem value="most_bullish">Most bullish</SelectItem>
                        <SelectItem value="most_bearish">Most bearish</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => setShowCommunityModal(true)}>
                      View community analyses
                    </Button>
                  </div>
                </div>

                <CommunityMetricsSummary aggregate={agg} />

                {myAnalyses.length > 0 && (
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Your saved analyses</p>
                    <div className="mt-2 space-y-2">
                      {myAnalyses.slice(0, 2).map((analysis) => (
                        <div key={analysis.id} className="rounded-md border border-border/60 p-2">
                          <p className="text-sm font-medium">{analysis.title || "Saved analysis"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(analysis.updatedAt || analysis.createdAt).toLocaleString()} · {analysis.visibility}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {privateNotes.length > 0 && (
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Your private notes</p>
                    <div className="mt-2 space-y-2">
                      {privateNotes.slice(0, 3).map((note) => (
                        <div key={note.id} className="rounded-md border border-border/60 p-2">
                          <p className="text-sm">{note.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <ListingCommentsSection
                  comments={communityComments}
                  currentUserId={(user as any)?.id || null}
                  sort={communityCommentSort}
                  onSortChange={setCommunityCommentSort}
                  onSubmitComment={handleSubmitComment}
                  onHelpful={(commentId) => commentHelpfulMutation.mutate(commentId)}
                  onReport={(commentId) => commentReportMutation.mutate(commentId)}
                  onReply={(commentId, body) => handleSubmitComment(body, "public", commentId)}
                  onDelete={(commentId) => deleteCommentMutation.mutate(commentId)}
                  isAuthenticated={isAuthenticated}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  };

  const resultSummaryLabel = hasSearched
    ? totalCount > 0
      ? `${listingsWithCapRates.length} of ${totalCount.toLocaleString()} properties`
      : "No properties found"
    : "Move the map or run a search to start";

  const sidebarContent = (
    <>
      {selectedListing ? (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3">
          {renderDetailPanel()}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3">
          <div className="flex min-h-full flex-col rounded-2xl border border-border/60 bg-muted/10 p-2 shadow-sm">
            <div className="mb-2 flex items-center justify-between rounded-xl border border-border/60 bg-background px-3 py-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Search results</p>
                <p className="text-sm font-medium" data-testid="text-results-panel-count">{resultSummaryLabel}</p>
              </div>
              {isSearching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
          {(savedSearches.length > 0 || savedShortlist.length > 0 || recentViewedListings.length > 0) && (
            <Card className="border-border/60">
              <CardContent className="p-3 space-y-3">
                {savedSearches.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Saved searches</p>
                    {savedSearches.slice(0, 2).map((search) => (
                      <button
                        key={`saved-search-${search.id}`}
                        className="w-full rounded-md border border-border/60 px-2.5 py-2 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
                        onClick={() => {
                          setFindDealsQuery(search.query || "");
                          if (search.propertyType) setPropertyType(search.propertyType);
                          if (search.budgetMax) setMaxPrice(String(search.budgetMax));
                          if (search.targetGrossYield) setMinCapRate(String(search.targetGrossYield));
                        }}
                        data-testid={`button-resume-saved-search-${search.id}`}
                      >
                        <p className="text-xs font-medium">{search.label}</p>
                        <p className="text-[11px] text-muted-foreground">{search.query || search.geography || "Saved search"}</p>
                      </button>
                    ))}
                  </div>
                )}
                {savedShortlist.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Shortlist</p>
                    {savedShortlist.slice(0, 2).map((listing) => (
                      <div key={`shortlist-${listing.id}`} className="rounded-md border border-border/60 px-2.5 py-2">
                        <p className="text-xs font-medium">{listing.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {[listing.city, listing.capRate != null ? `${listing.capRate.toFixed(1)}% cap` : null, listing.price ? formatPrice(listing.price) : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {recentViewedListings.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Recently viewed</p>
                    {recentViewedListings.slice(0, 2).map((listing) => (
                      <div key={`recent-${listing.id}`} className="rounded-md border border-border/60 px-2.5 py-2">
                        <p className="text-xs font-medium">{listing.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {[listing.city, listing.capRate != null ? `${listing.capRate.toFixed(1)}% cap` : null, listing.price ? formatPrice(listing.price) : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
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
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-[1000] relative shrink-0">
        <div className="px-3 py-3 space-y-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Deal sourcing</p>
              <p className="text-sm text-muted-foreground">Search broadly, shortlist quickly, then hand the winner into underwriting.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px]" data-testid="badge-results-summary">
                {resultSummaryLabel}
              </Badge>
              {dataSource && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0" data-testid="badge-data-source">
                  {dataSource === "crea_ddf" ? "CREA DDF" : "Repliers"}
                </Badge>
              )}
              {isSearching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>

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
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={handleSaveCurrentSearch}
              data-testid="button-save-current-search"
            >
              <Star className="h-3.5 w-3.5" />
              Save Search
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
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => setShowAdvancedFilters((value) => !value)}
              data-testid="button-toggle-advanced-filters"
            >
              Filters
              {activeFilterCount > 0 && <Badge variant="secondary" className="px-1 py-0 text-[9px]">{activeFilterCount}</Badge>}
              {showAdvancedFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
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

          {showAdvancedFilters && (
          <div className="flex flex-wrap gap-2 items-end rounded-xl border border-border/60 bg-muted/20 p-3">
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
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => {
                setMinPrice("");
                setMaxPrice("");
                setMinBeds("any");
                setMinUnits("any");
                setPropertyType("all");
                setMinCapRate("any");
                setSortBy("capRate");
              }}
              disabled={activeFilterCount === 0}
              data-testid="button-reset-filters"
            >
              Reset
            </Button>
          </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        <div className="relative flex-1 min-h-0" data-testid="map-container">
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
              <ClusteredListingsLayer
                listings={mappableListings}
                selectedListingId={selectedListing?.mlsNumber}
                onSelectListing={handleSelectListing}
                aggregatesMap={aggregatesMap}
              />
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

        <div className="hidden lg:flex lg:w-[380px] xl:w-[420px] flex-shrink-0 flex-col min-h-0 border-l bg-background overflow-hidden">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            {selectedListing ? (
              <div className="flex items-center justify-between gap-2 w-full">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Selected property</p>
                  <p className="text-sm font-medium truncate">{formatShortAddress(selectedListing.address)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setSelectedListing(null)}
                  data-testid="button-back-to-results"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Results
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 w-full">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Map workspace</p>
                  <p className="text-sm font-medium" data-testid="text-sidebar-count">Browse and analyze without losing map position</p>
                </div>
              </div>
            )}
          </div>
          {sidebarContent}
        </div>

        {showMobileList && (
          <div className="lg:hidden fixed inset-x-0 bottom-0 z-[1000] bg-background border-t rounded-t-2xl shadow-2xl max-h-[60vh] flex flex-col overflow-hidden">
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
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {sidebarContent}
            </div>
          </div>
        )}
      </div>
      <CommunityAnalysisModal
        open={showCommunityModal}
        onOpenChange={setShowCommunityModal}
        analyses={publicAnalyses}
        onDuplicate={(analysisId) => duplicateAnalysisMutation.mutate(analysisId)}
        onFeedback={(analysisId, feedbackType) => analysisFeedbackMutation.mutate({ analysisId, feedbackType })}
      />
    </div>
  );
}
