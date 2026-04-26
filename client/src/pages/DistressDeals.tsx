import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Search, MapPin, AlertTriangle, Gavel, TrendingDown, DollarSign,
  Heart, ExternalLink, Filter, X, ChevronDown, ChevronUp, Info,
  List, Map as MapIcon, Share2, Loader2, Home, Lock, UserIcon, Calculator
} from "lucide-react";
import { DISTRESS_CATEGORIES, type DistressResult, type MatchedTerm, getProvincialNuance } from "@shared/distressScoring";
import { MiniDealAnalyzer } from "@/components/MiniDealAnalyzer";
import { Separator } from "@/components/ui/separator";
import { MultiplexFeasibilityPanel } from "@/components/MultiplexFeasibilityPanel";

const CANADA_CENTER: [number, number] = [51.0, -85.0];
const DEFAULT_ZOOM = 5;


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

function getPrimarySignal(listing: DistressListing): { label: string; color: string } {
  if (listing.distress.categoriesTriggered.foreclosure_pos) return { label: "POS", color: "#dc2626" };
  if (listing.distress.categoriesTriggered.vtb) return { label: "VTB", color: "#7c3aed" };
  return { label: "MOT", color: "#d97706" };
}

function getListingIcon(listing: DistressListing) {
  const signal = getPrimarySignal(listing);
  return L.divIcon({
    html: `<div class="distress-signal-marker" style="--marker-color:${signal.color}">${signal.label}</div>`,
    className: "distress-signal-marker-wrap",
    iconSize: [44, 28],
    iconAnchor: [22, 28],
    popupAnchor: [0, -28],
  });
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

function SignalBadges({ categories }: { categories: DistressResult["categoriesTriggered"] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {categories.foreclosure_pos && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-300 text-red-700 dark:text-red-300">
          POS/foreclosure
        </Badge>
      )}
      {categories.vtb && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-300 text-purple-700 dark:text-purple-300">
          VTB
        </Badge>
      )}
      {categories.motivated && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700 dark:text-amber-300">
          Motivated
        </Badge>
      )}
    </div>
  );
}

function MarkerClusterLayer({ listings, onListingClick }: { listings: DistressListing[]; onListingClick: (listing: DistressListing) => void }) {
  const map = useMap();
  const clusterRef = useRef<any>(null);

  useEffect(() => {
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
    }

    const cluster = (L as any).markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      chunkedLoading: true,
      disableClusteringAtZoom: 16,
      iconCreateFunction: (c: any) => {
        const count = c.getChildCount();
        let size = "small";
        let dim = 36;
        if (count > 100) { size = "large"; dim = 50; }
        else if (count > 30) { size = "medium"; dim = 44; }
        return L.divIcon({
          html: `<div style="background:rgba(220,38,38,0.85);color:#fff;border-radius:50%;width:${dim}px;height:${dim}px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${dim < 40 ? 12 : 14}px;border:2px solid rgba(255,255,255,0.8);box-shadow:0 2px 6px rgba(0,0,0,0.3)">${count}</div>`,
          className: "marker-cluster-custom",
          iconSize: L.point(dim, dim),
        });
      },
    });

    const markers = listings
      .filter(l => l.map?.latitude && l.map?.longitude)
      .map(listing => {
        const marker = L.marker(
          [listing.map!.latitude, listing.map!.longitude],
          { icon: getListingIcon(listing) }
        );
        marker.bindPopup(
          `<div style="min-width:180px"><strong>${escHtml(formatPrice(listing.listPrice))}</strong><br/>` +
          `<span style="font-size:0.85em">${escHtml(formatAddress(listing.address))}</span><br/>` +
          `<span style="font-size:0.8em;color:#666">${escHtml(getPrimarySignal(listing).label)} · ${escHtml(listing.distress.confidence)} confidence</span></div>`
        );
        marker.on("click", () => onListingClick(listing));
        return marker;
      });

    cluster.addLayers(markers);
    map.addLayer(cluster);
    clusterRef.current = cluster;

    return () => {
      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
      }
    };
  }, [listings, map, onListingClick]);

  return null;
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
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
      const b = map.getBounds();
      onBoundsChange({
        latMin: b.getSouth(),
        latMax: b.getNorth(),
        lngMin: b.getWest(),
        lngMax: b.getEast(),
      });
    }, 100);
  }, [map, onBoundsChange]);
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

          <Button className="w-full" asChild data-testid="button-full-analysis">
            <a
              href={`/tools/analyzer?${new URLSearchParams({
                ...(listing.address ? { address: formatAddress(listing.address) } : {}),
                ...(listing.listPrice ? { price: String(listing.listPrice) } : {}),
                ...(listing.mlsNumber ? { mls: listing.mlsNumber } : {}),
                ...(listing.address?.city ? { city: listing.address.city } : {}),
                ...(listing.address?.state ? { state: listing.address.state } : {}),
                ...(listing.details.numBedrooms ? { beds: String(listing.details.numBedrooms) } : {}),
                ...(listing.details.numBathrooms ? { baths: String(listing.details.numBathrooms) } : {}),
                ...(listing.details.sqft ? { sqft: listing.details.sqft } : {}),
                rent: String(Math.round(listing.listPrice * 0.004)),
                propertyTax: String(Math.round(listing.listPrice * 0.01)),
              }).toString()}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Calculator className="h-4 w-4 mr-2" />
              Full Analysis in Deal Analyzer
            </a>
          </Button>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Multiplex Potential Overlay</h3>
                <p className="text-xs text-muted-foreground">
                  Ontario-first screening for gentle-density upside, envelope math, confidence, and buyer-beware caveats.
                </p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                Screening only
              </Badge>
            </div>
            <MultiplexFeasibilityPanel
              compact
              address={formatAddress(listing.address)}
              city={listing.address.city}
              province={listing.address.state}
            />
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

          <Separator />

          <MiniDealAnalyzer
            price={listing.listPrice}
            monthlyRent={listing.listPrice * 0.004}
            annualPropertyTax={listing.listPrice * 0.01}
            unitCount={1}
            isEstimated
          />

          <div className="flex gap-2">
            <Button className="flex-1" data-testid="button-request-package">
              Request Deal Package
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

function SignUpGateModal({ onClose, toolName, pendingMls }: { onClose: () => void; toolName: string; pendingMls?: string | null }) {
  const returnUrl = pendingMls
    ? `/tools/distress-deals?listing=${encodeURIComponent(pendingMls)}`
    : "/tools/distress-deals";
  const loginHref = `/login?returnUrl=${encodeURIComponent(returnUrl)}`;

  const handleAuthClick = () => {
    if (pendingMls) {
      sessionStorage.setItem("pendingDistressListing", pendingMls);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="signup-gate-modal"
      >
        <div className="p-6 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold" data-testid="text-gate-title">Sign up to view details</h2>
          <p className="text-sm text-muted-foreground">
            Create a free account to view full listing details, distress analysis, and property photos in the {toolName}.
          </p>
          <div className="space-y-2 pt-2">
            <Button asChild className="w-full gap-2" data-testid="button-gate-signup">
              <a href={loginHref} onClick={handleAuthClick}>
                <UserIcon className="h-4 w-4" />
                Sign Up — It's Free
              </a>
            </Button>
            <Button variant="ghost" className="w-full" onClick={onClose} data-testid="button-gate-dismiss">
              Maybe Later
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Already have an account? <a href={loginHref} onClick={handleAuthClick} className="text-primary underline font-medium" data-testid="link-gate-login">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DistressDeals() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const [showSignUpGate, setShowSignUpGate] = useState(false);
  const [toggleForeclosure, setToggleForeclosure] = useState(true);
  const [toggleMotivated, setToggleMotivated] = useState(true);
  const [toggleVtb, setToggleVtb] = useState(true);
  const [pendingListingMls, setPendingListingMls] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"split" | "list" | "map">(isMobile ? "list" : "split");
  const [filtersOpen, setFiltersOpen] = useState(!isMobile);
  const [selectedListing, setSelectedListing] = useState<DistressListing | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([44.0, -79.0]);
  const [mapZoom, setMapZoom] = useState(7);
  const [mapBounds, setMapBounds] = useState<any>(null);
  const [city, setCity] = useState("");
  const mapRef = useRef<any>(null);

  const categories = useMemo(() => {
    const cats: string[] = [];
    if (toggleForeclosure) cats.push("foreclosure_pos");
    if (toggleMotivated) cats.push("motivated");
    if (toggleVtb) cats.push("vtb");
    return cats;
  }, [toggleForeclosure, toggleMotivated, toggleVtb]);

  const { data, isLoading, isFetching } = useQuery<{
    listings: DistressListing[];
    totalCount: number;
    totalDdfScanned: number;
    warming?: boolean;
    message?: string;
  }>({
    queryKey: ["/api/distress-deals"],
    queryFn: async () => {
      const res = await fetch("/api/distress-deals");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 30 * 60 * 1000,
    refetchInterval: (query) => {
      const d = query.state.data as any;
      return d?.warming ? 15000 : false;
    },
  });

  const allListings = data?.listings || [];

  const categoryFiltered = useMemo(() => {
    if (categories.length === 0) return [];
    if (categories.length >= 3) return allListings;
    return allListings.filter(l =>
      categories.some(cat => l.distress?.categoriesTriggered?.[cat as keyof typeof l.distress.categoriesTriggered])
    );
  }, [allListings, categories]);

  const listings = useMemo(() => {
    if (!mapBounds) return categoryFiltered;
    return categoryFiltered.filter(l => {
      const lat = l.map?.latitude;
      const lng = l.map?.longitude;
      if (!lat || !lng) return false;
      return lat >= mapBounds.latMin && lat <= mapBounds.latMax &&
             lng >= mapBounds.lngMin && lng <= mapBounds.lngMax;
    });
  }, [categoryFiltered, mapBounds]);

  const handleListingClick = useCallback((listing: DistressListing) => {
    if (!user) {
      setPendingListingMls(listing.mlsNumber);
      setShowSignUpGate(true);
      return;
    }
    setSelectedListing(listing);
  }, [user]);

  useEffect(() => {
    if (user && allListings.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const mlsFromUrl = urlParams.get("listing");
      const mlsFromStorage = sessionStorage.getItem("pendingDistressListing");
      const targetMls = mlsFromUrl || mlsFromStorage;
      if (targetMls) {
        const found = allListings.find(l => l.mlsNumber === targetMls);
        if (found) setSelectedListing(found);
        sessionStorage.removeItem("pendingDistressListing");
        if (mlsFromUrl) {
          const newUrl = window.location.pathname;
          window.history.replaceState({}, "", newUrl);
        }
      }
    }
  }, [user, allListings]);

  const handleCitySearch = useCallback(() => {
    if (!city.trim()) return;
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
      victoria: [48.43, -123.37],
      kelowna: [49.89, -119.50],
      saskatoon: [52.13, -106.67],
      regina: [50.45, -104.62],
      kitchener: [43.45, -80.48],
      barrie: [44.39, -79.69],
      oshawa: [43.90, -78.85],
      brampton: [43.68, -79.77],
      mississauga: [43.59, -79.64],
    };
    const lowerCity = city.toLowerCase().trim();
    if (cityCoords[lowerCity]) {
      setMapCenter(cityCoords[lowerCity]);
      setMapZoom(11);
    }
  }, [city]);

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(`${window.location.origin}/tools/distress-deals`).then(() => {
      toast({ title: "Link copied", description: "Share link has been copied to clipboard" });
    });
  }, [toast]);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden" data-testid="distress-deals-page">
      <SEO
        title="Distress Deals Browser - Foreclosure, Power of Sale, VTB | Realist.ca"
        description="Find power-of-sale, court-ordered, bank-owned, motivated-seller, and seller-financing opportunities across Canada using MLS data."
        keywords="foreclosure canada, power of sale, court ordered sale, motivated seller, vtb, vendor take back, distressed property, bank owned"
        canonicalUrl="/tools/distress-deals"
      />
      <Navigation />

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="border-b bg-card relative z-20 flex-shrink-0">
          <div className="max-w-[1800px] mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-lg md:text-xl font-bold flex items-center gap-2" data-testid="text-page-title">
                  <Gavel className="h-5 w-5 text-red-500" />
                  Distress Deals
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
                  Foreclosure, Power of Sale, motivated sellers, and VTB opportunities
                </p>
              </div>
              <div className="flex items-center gap-1 md:gap-2">
                <Button
                  variant={viewMode === "split" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("split")}
                  className="gap-1 hidden md:inline-flex"
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
                  <List className="h-3.5 w-3.5" /> <span className="hidden sm:inline">List</span>
                </Button>
                <Button
                  variant={viewMode === "map" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("map")}
                  className="gap-1"
                  data-testid="button-view-map"
                >
                  <MapIcon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Map</span>
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3 md:gap-6 flex-wrap">
              <div className="flex items-center gap-1.5 md:gap-2" data-testid="toggle-foreclosure">
                <Switch checked={toggleForeclosure} onCheckedChange={setToggleForeclosure} id="t-foreclosure" />
                <Label htmlFor="t-foreclosure" className="text-xs md:text-sm flex items-center gap-1 md:gap-1.5 cursor-pointer">
                  <Gavel className="h-3 w-3 md:h-3.5 md:w-3.5 text-red-500" />
                  <span className="hidden sm:inline">Foreclosure / POS</span>
                  <span className="sm:hidden">POS</span>
                </Label>
              </div>
              <div className="flex items-center gap-1.5 md:gap-2" data-testid="toggle-motivated">
                <Switch checked={toggleMotivated} onCheckedChange={setToggleMotivated} id="t-motivated" />
                <Label htmlFor="t-motivated" className="text-xs md:text-sm flex items-center gap-1 md:gap-1.5 cursor-pointer">
                  <TrendingDown className="h-3 w-3 md:h-3.5 md:w-3.5 text-amber-500" />
                  <span className="hidden sm:inline">Motivated Seller</span>
                  <span className="sm:hidden">Motivated</span>
                </Label>
              </div>
              <div className="flex items-center gap-1.5 md:gap-2" data-testid="toggle-vtb">
                <Switch checked={toggleVtb} onCheckedChange={setToggleVtb} id="t-vtb" />
                <Label htmlFor="t-vtb" className="text-xs md:text-sm flex items-center gap-1 md:gap-1.5 cursor-pointer">
                  <DollarSign className="h-3 w-3 md:h-3.5 md:w-3.5 text-purple-500" />
                  VTB
                </Label>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {(viewMode === "split" || viewMode === "list") && (
            <div className={`border-r bg-card flex flex-col ${viewMode === "split" ? "w-[420px] flex-shrink-0" : "flex-1"}`}>
              <div className="p-3 border-b space-y-3">
                <p className="text-[10px] text-muted-foreground px-1">
                  Drag the map to explore listings. The list updates as you move.
                </p>

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
                  <div className="text-xs text-muted-foreground px-1 py-1">
                    All {data?.totalCount || 0} distress listings loaded across Canada.
                    {mapBounds && ` Showing ${listings.length} in current view.`}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto">
                {(isLoading || data?.warming) && (
                  <div className="p-6 space-y-4">
                    <div className="flex flex-col items-center text-center space-y-2 py-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm font-medium">{data?.warming ? "Building distress database..." : "Loading distress listings..."}</p>
                      <p className="text-xs text-muted-foreground">{data?.warming ? "First-time scan takes 2-3 minutes. This page will auto-refresh." : "Data should appear momentarily"}</p>
                    </div>
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-28 rounded-lg" />
                    ))}
                  </div>
                )}

                {!isLoading && listings.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-64 text-center p-8">
                    <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <h3 className="font-medium mb-1">No distress listings in this area</h3>
                    <p className="text-sm text-muted-foreground">
                      Try zooming out or panning the map to a different region. You can also toggle more categories above.
                    </p>
                  </div>
                )}

                {!isLoading && listings.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center justify-between px-2 py-1.5 mb-2">
                      <span className="text-xs text-muted-foreground" data-testid="text-result-count">
                        {listings.length} {mapBounds ? "in view" : "listings"}
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
                          onClick={() => handleListingClick(listing)}
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
                                  <SignalBadges categories={listing.distress.categoriesTriggered} />
                                </div>
                                <div className="flex items-center justify-between mt-1.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {["ON", "Ontario"].includes(listing.address.state) && (
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                        Multiplex Overlay
                                      </Badge>
                                    )}
                                  </div>
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
            <div className="flex-1 relative" style={{ zIndex: 0, isolation: "isolate" }}>
              <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                className="h-full w-full"
                scrollWheelZoom={true}
                ref={mapRef}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <MapBoundsTracker onBoundsChange={setMapBounds} />
                <MapCenterUpdater center={mapCenter} zoom={mapZoom} />
                <MarkerClusterLayer listings={categoryFiltered} onListingClick={handleListingClick} />
              </MapContainer>
            </div>
          )}
        </div>

        <div className="border-t bg-muted/30 px-4 py-2 flex-shrink-0">
          <p className="text-[10px] text-muted-foreground text-center max-w-4xl mx-auto" data-testid="text-disclaimer">
            This is not legal advice. "Power of Sale"/foreclosure processes vary by province. Listings are flagged from MLS remarks for POS/foreclosure, motivated-seller, or VTB language; verify details with professionals.
          </p>
        </div>
      </div>

      {selectedListing && (
        <ListingDetailModal
          listing={selectedListing}
          onClose={() => setSelectedListing(null)}
        />
      )}

      {showSignUpGate && (
        <SignUpGateModal
          onClose={() => setShowSignUpGate(false)}
          toolName="Distress Deals Browser"
          pendingMls={pendingListingMls}
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
