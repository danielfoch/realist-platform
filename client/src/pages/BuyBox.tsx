import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  MapPin, PenTool, Trash2, ArrowRight, Home, DollarSign,
  Calendar, FileText, AlertCircle, Loader2, X, BedDouble,
  Bath, Maximize, Calculator, Building, Search, ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { buyBoxBuildingTypes, buyBoxOccupancyTypes, type BuyBoxMandateFormData } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

declare global {
  interface Window {
    google: typeof google;
    initBuyBoxMap: () => void;
  }
}

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
  daysOnMarket?: string;
}

const OFFER_CONDITIONS = [
  { id: "financing", label: "Financing" },
  { id: "inspection", label: "Home Inspection" },
  { id: "lawyer_review", label: "Lawyer Review" },
  { id: "sale_of_buyer_property", label: "Sale of Buyer's Property" },
  { id: "status_certificate", label: "Status Certificate (Condo)" },
  { id: "zoning_due_diligence", label: "Zoning Due Diligence" },
  { id: "other", label: "Other" },
];

function formatPrice(price: number | string): string {
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(num)) return "$0";
  return "$" + num.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatAddress(addr: RepliersListing["address"]): string {
  if (!addr) return "Unknown";
  const parts = [
    addr.streetNumber,
    addr.streetName,
    addr.streetSuffix,
    addr.streetDirection,
  ].filter(Boolean);
  const street = parts.join(" ");
  const cityState = [addr.city, addr.state || addr.zip].filter(Boolean).join(", ");
  return [street, cityState].filter(Boolean).join(", ") || "Unknown";
}

function getImageUrl(images: string[] | undefined): string | null {
  if (!images || images.length === 0) return null;
  const img = images[0];
  if (img.startsWith("http")) return img;
  return `https://cdn.repliers.io/${img}`;
}

export default function BuyBox() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hasPolygon, setHasPolygon] = useState(false);
  const [step, setStep] = useState<"draw" | "details" | "agreement">("draw");

  const [listings, setListings] = useState<RepliersListing[]>([]);
  const [listingsCount, setListingsCount] = useState(0);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [selectedListing, setSelectedListing] = useState<RepliersListing | null>(null);
  const [showListingPanel, setShowListingPanel] = useState(false);
  const [listingsPage, setListingsPage] = useState(1);
  const [listingsNumPages, setListingsNumPages] = useState(0);

  useEffect(() => {
    if (step === "draw") {
      sessionStorage.removeItem("buybox_polygon");
      sessionStorage.removeItem("buybox_centroid");
      sessionStorage.removeItem("buybox_mandate");
    }
  }, [step]);

  const [mandateData, setMandateData] = useState<Partial<BuyBoxMandateFormData>>({
    lotFrontageUnit: "ft",
    lotDepthUnit: "ft",
    totalLotAreaUnit: "sqft",
    offerConditions: [],
  });
  const [polygonGeoJson, setPolygonGeoJson] = useState<any>(null);
  const [centroid, setCentroid] = useState<{ lat: number; lng: number } | null>(null);

  const fetchListings = useCallback(async (mapCoords: [number, number][], page = 1) => {
    if (mapCoords.length < 3) return;

    setListingsLoading(true);
    try {
      const closed = [...mapCoords];
      if (closed.length > 0 && (closed[0][0] !== closed[closed.length - 1][0] || closed[0][1] !== closed[closed.length - 1][1])) {
        closed.push(closed[0]);
      }

      const body: Record<string, any> = {
        map: [closed],
        resultsPerPage: 50,
        pageNum: page,
        status: "A",
      };

      if (mandateData.targetPrice) body.minPrice = mandateData.targetPrice;
      if (mandateData.maxPrice) body.maxPrice = mandateData.maxPrice;

      const response = await apiRequest("POST", "/api/repliers/listings", body);
      const data = await response.json();

      if (data.listings) {
        setListings(data.listings);
        setListingsCount(data.count || 0);
        setListingsPage(data.page || 1);
        setListingsNumPages(data.numPages || 0);
        addMarkersToMap(data.listings);
      } else {
        setListings([]);
        setListingsCount(0);
      }
    } catch (error) {
      console.error("Error fetching listings:", error);
      setListings([]);
      setListingsCount(0);
    } finally {
      setListingsLoading(false);
    }
  }, [mandateData.targetPrice, mandateData.maxPrice]);

  const addMarkersToMap = useCallback((listingsData: RepliersListing[]) => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const map = mapInstanceRef.current;
    if (!map) return;

    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }

    listingsData.forEach((listing) => {
      if (!listing.map?.latitude || !listing.map?.longitude) return;

      const marker = new google.maps.Marker({
        position: { lat: listing.map.latitude, lng: listing.map.longitude },
        map,
        title: formatAddress(listing.address),
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#3b82f6",
          fillOpacity: 0.9,
          strokeColor: "#1d4ed8",
          strokeWeight: 2,
          scale: 8,
        },
      });

      marker.addListener("click", () => {
        const imgUrl = getImageUrl(listing.images);
        const price = formatPrice(listing.listPrice);
        const addr = formatAddress(listing.address);
        const beds = listing.details?.numBedrooms || "—";
        const baths = listing.details?.numBathrooms || "—";
        const sqft = listing.details?.sqft || "—";

        const container = document.createElement("div");
        container.style.cssText = "max-width:280px;font-family:system-ui,sans-serif;";

        if (imgUrl) {
          const img = document.createElement("img");
          img.src = imgUrl;
          img.alt = "Property";
          img.style.cssText = "width:100%;height:140px;object-fit:cover;border-radius:6px 6px 0 0;margin-bottom:8px;";
          img.onerror = () => { img.style.display = "none"; };
          container.appendChild(img);
        }

        const info = document.createElement("div");
        info.style.cssText = "padding:0 4px 8px;";

        const priceEl = document.createElement("div");
        priceEl.style.cssText = "font-size:18px;font-weight:700;color:#1a1a1a;margin-bottom:4px;";
        priceEl.textContent = price;
        info.appendChild(priceEl);

        const addrEl = document.createElement("div");
        addrEl.style.cssText = "font-size:13px;color:#666;margin-bottom:8px;";
        addrEl.textContent = addr;
        info.appendChild(addrEl);

        const details = document.createElement("div");
        details.style.cssText = "display:flex;gap:12px;font-size:12px;color:#444;";
        details.textContent = `${beds} bed · ${baths} bath · ${sqft} sqft`;
        info.appendChild(details);

        const mls = document.createElement("div");
        mls.style.cssText = "font-size:11px;color:#888;margin-top:4px;";
        mls.textContent = `MLS# ${listing.mlsNumber}`;
        info.appendChild(mls);

        container.appendChild(info);

        infoWindowRef.current?.setContent(container);
        infoWindowRef.current?.open(map, marker);
        setSelectedListing(listing);
        setShowListingPanel(true);
      });

      markersRef.current.push(marker);
    });
  }, []);

  const loadGoogleMaps = useCallback(() => {
    if (window.google && window.google.maps) {
      initMap();
      return;
    }

    window.initBuyBoxMap = () => {
      initMap();
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""}&libraries=drawing,places&callback=initBuyBoxMap`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  const initMap = useCallback(() => {
    if (!mapRef.current) return;

    const map = new google.maps.Map(mapRef.current, {
      center: { lat: 43.6532, lng: -79.3832 },
      zoom: 11,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
    });
    mapInstanceRef.current = map;

    const drawingManager = new google.maps.drawing.DrawingManager({
      drawingMode: google.maps.drawing.OverlayType.POLYGON,
      drawingControl: true,
      drawingControlOptions: {
        position: google.maps.ControlPosition.TOP_CENTER,
        drawingModes: [google.maps.drawing.OverlayType.POLYGON],
      },
      polygonOptions: {
        fillColor: "#22c55e",
        fillOpacity: 0.3,
        strokeColor: "#16a34a",
        strokeWeight: 2,
        editable: true,
        draggable: true,
      },
    });
    drawingManager.setMap(map);
    drawingManagerRef.current = drawingManager;

    google.maps.event.addListener(drawingManager, "polygoncomplete", (polygon: google.maps.Polygon) => {
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
      }
      polygonRef.current = polygon;
      setHasPolygon(true);
      drawingManager.setDrawingMode(null);

      const coords = extractPolygonCoords(polygon);
      updatePolygonData(polygon);
      fetchListings(coords);

      google.maps.event.addListener(polygon.getPath(), "set_at", () => {
        updatePolygonData(polygon);
        const c = extractPolygonCoords(polygon);
        fetchListings(c);
      });
      google.maps.event.addListener(polygon.getPath(), "insert_at", () => {
        updatePolygonData(polygon);
        const c = extractPolygonCoords(polygon);
        fetchListings(c);
      });
    });

    setMapLoaded(true);
  }, [fetchListings]);

  const extractPolygonCoords = (polygon: google.maps.Polygon): [number, number][] => {
    const path = polygon.getPath();
    const coords: [number, number][] = [];
    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i);
      coords.push([point.lng(), point.lat()]);
    }
    return coords;
  };

  const updatePolygonData = (polygon: google.maps.Polygon) => {
    const path = polygon.getPath();
    const coordinates: [number, number][] = [];
    let totalLat = 0;
    let totalLng = 0;

    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i);
      coordinates.push([point.lng(), point.lat()]);
      totalLat += point.lat();
      totalLng += point.lng();
    }

    if (coordinates.length > 0) {
      coordinates.push(coordinates[0]);
    }

    const geoJson = {
      type: "Polygon",
      coordinates: [coordinates],
    };

    setPolygonGeoJson(geoJson);
    setCentroid({
      lat: totalLat / (path.getLength() || 1),
      lng: totalLng / (path.getLength() || 1),
    });
  };

  const clearPolygon = () => {
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    infoWindowRef.current?.close();
    setHasPolygon(false);
    setPolygonGeoJson(null);
    setCentroid(null);
    setListings([]);
    setListingsCount(0);
    setSelectedListing(null);
    setShowListingPanel(false);
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    }
  };

  const handleConditionChange = (conditionId: string, checked: boolean) => {
    setMandateData((prev) => ({
      ...prev,
      offerConditions: checked
        ? [...(prev.offerConditions || []), conditionId]
        : (prev.offerConditions || []).filter((c) => c !== conditionId),
    }));
  };

  const handleContinueToDetails = () => {
    if (!hasPolygon || !polygonGeoJson) {
      toast({
        title: "Draw Your Search Area",
        description: "Please draw a polygon on the map to define your target buy area.",
        variant: "destructive",
      });
      return;
    }
    setStep("details");
  };

  const handleContinueToAgreement = () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to submit your BuyBox mandate.",
        variant: "destructive",
      });
      setLocation("/login");
      return;
    }
    sessionStorage.setItem("buybox_polygon", JSON.stringify(polygonGeoJson));
    sessionStorage.setItem("buybox_centroid", JSON.stringify(centroid));
    sessionStorage.setItem("buybox_mandate", JSON.stringify(mandateData));
    setStep("agreement");
    setLocation("/buybox/agreement");
  };

  const handleAnalyzeListing = (listing: RepliersListing) => {
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
    setLocation(`/tools/analyzer?${params.toString()}`);
  };

  const handleRefreshListings = () => {
    if (polygonRef.current) {
      const coords = extractPolygonCoords(polygonRef.current);
      fetchListings(coords, 1);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (polygonRef.current) {
      const coords = extractPolygonCoords(polygonRef.current);
      fetchListings(coords, newPage);
    }
  };

  useEffect(() => {
    loadGoogleMaps();
  }, [loadGoogleMaps]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Create Your BuyBox</h1>
          <p className="text-muted-foreground">
            Define your target investment area and property criteria. Draw an area on the map to see available MLS listings.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            variant={step === "draw" ? "default" : "outline"}
            size="sm"
            onClick={() => setStep("draw")}
            data-testid="button-step-draw"
          >
            <MapPin className="h-4 w-4 mr-2" />
            1. Draw Area
          </Button>
          <Button
            variant={step === "details" ? "default" : "outline"}
            size="sm"
            onClick={() => hasPolygon && setStep("details")}
            disabled={!hasPolygon}
            data-testid="button-step-details"
          >
            <FileText className="h-4 w-4 mr-2" />
            2. Add Details
          </Button>
          <Button
            variant={step === "agreement" ? "default" : "outline"}
            size="sm"
            disabled
            data-testid="button-step-agreement"
          >
            <PenTool className="h-4 w-4 mr-2" />
            3. Sign & Submit
          </Button>
        </div>

        {step === "draw" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className={showListingPanel && selectedListing ? "lg:col-span-1" : "lg:col-span-2"}>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Draw Your Target Area
                    </CardTitle>
                    {listingsCount > 0 && (
                      <Badge variant="secondary" data-testid="badge-listings-count">
                        <Search className="h-3 w-3 mr-1" />
                        {listingsCount.toLocaleString()} listings found
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    Use the polygon tool to outline your search area. MLS listings will appear automatically.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    ref={mapRef}
                    className="w-full h-[500px] rounded-lg border"
                    data-testid="map-container"
                  />

                  <div className="flex flex-wrap gap-2 mt-4">
                    <Button
                      variant="outline"
                      onClick={clearPolygon}
                      disabled={!hasPolygon}
                      data-testid="button-clear-polygon"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear & Redraw
                    </Button>
                    {hasPolygon && (
                      <Button
                        variant="outline"
                        onClick={handleRefreshListings}
                        disabled={listingsLoading}
                        data-testid="button-refresh-listings"
                      >
                        {listingsLoading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4 mr-2" />
                        )}
                        Refresh Listings
                      </Button>
                    )}
                    <Button
                      onClick={handleContinueToDetails}
                      disabled={!hasPolygon}
                      data-testid="button-continue-details"
                    >
                      Continue to Details
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>

                  {listingsLoading && (
                    <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching for listings in this area...
                    </div>
                  )}

                  {listingsNumPages > 1 && (
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-xs text-muted-foreground">
                        Page {listingsPage} of {listingsNumPages} ({listingsCount.toLocaleString()} total)
                      </p>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(listingsPage - 1)}
                          disabled={listingsPage <= 1 || listingsLoading}
                          data-testid="button-prev-page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(listingsPage + 1)}
                          disabled={listingsPage >= listingsNumPages || listingsLoading}
                          data-testid="button-next-page"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {showListingPanel && selectedListing ? (
              <div className="lg:col-span-2" data-testid="panel-listing-detail">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-2xl">
                          {formatPrice(selectedListing.listPrice)}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {formatAddress(selectedListing.address)}
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setShowListingPanel(false);
                          setSelectedListing(null);
                          infoWindowRef.current?.close();
                        }}
                        data-testid="button-close-listing"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedListing.images && selectedListing.images.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {selectedListing.images.slice(0, 6).map((img, idx) => {
                          const url = img.startsWith("http") ? img : `https://cdn.repliers.io/${img}`;
                          return (
                            <img
                              key={idx}
                              src={url}
                              alt={`Property photo ${idx + 1}`}
                              className={`rounded-md object-cover w-full ${idx === 0 ? "col-span-2 row-span-2 h-[200px]" : "h-[96px]"}`}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              data-testid={`img-listing-${idx}`}
                            />
                          );
                        })}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center gap-1.5">
                        <BedDouble className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{selectedListing.details?.numBedrooms || "—"}</span>
                        <span className="text-xs text-muted-foreground">beds</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Bath className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{selectedListing.details?.numBathrooms || "—"}</span>
                        <span className="text-xs text-muted-foreground">baths</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Maximize className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{selectedListing.details?.sqft || "—"}</span>
                        <span className="text-xs text-muted-foreground">sqft</span>
                      </div>
                      {selectedListing.details?.yearBuilt && (
                        <div className="flex items-center gap-1.5">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{selectedListing.details.yearBuilt}</span>
                          <span className="text-xs text-muted-foreground">built</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedListing.type && (
                        <Badge variant="secondary">{selectedListing.type}</Badge>
                      )}
                      {selectedListing.class && (
                        <Badge variant="secondary">{selectedListing.class}</Badge>
                      )}
                      {selectedListing.details?.propertyType && (
                        <Badge variant="outline">{selectedListing.details.propertyType}</Badge>
                      )}
                      {selectedListing.details?.style && (
                        <Badge variant="outline">{selectedListing.details.style}</Badge>
                      )}
                    </div>

                    <Separator />

                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
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
                      {selectedListing.daysOnMarket && (
                        <div>
                          <p className="text-muted-foreground">Days on Market</p>
                          <p className="font-medium">{selectedListing.daysOnMarket}</p>
                        </div>
                      )}
                      {selectedListing.details?.numParkingSpaces && (
                        <div>
                          <p className="text-muted-foreground">Parking</p>
                          <p className="font-medium">{selectedListing.details.numParkingSpaces} spaces</p>
                        </div>
                      )}
                      {selectedListing.details?.basement1 && (
                        <div>
                          <p className="text-muted-foreground">Basement</p>
                          <p className="font-medium">{selectedListing.details.basement1}</p>
                        </div>
                      )}
                    </div>

                    {selectedListing.details?.description && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-sm font-medium mb-1">Description</p>
                          <p className="text-sm text-muted-foreground line-clamp-4">
                            {selectedListing.details.description}
                          </p>
                        </div>
                      </>
                    )}

                    {selectedListing.details?.extras && (
                      <div>
                        <p className="text-sm font-medium mb-1">Extras</p>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {selectedListing.details.extras}
                        </p>
                      </div>
                    )}

                    <Separator />

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
            ) : (
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle>Instructions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-muted-foreground">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">1</div>
                      <p>Click on the map to start drawing your target area</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">2</div>
                      <p>Continue clicking to add points and form a polygon</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">3</div>
                      <p>MLS listings in the area appear as blue markers</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">4</div>
                      <p>Click any marker to view listing details and analyze the deal</p>
                    </div>
                  </CardContent>
                </Card>

                {hasPolygon && centroid && (
                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle className="text-green-600 flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        Area Selected
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <p className="text-muted-foreground">
                        Center: {centroid.lat.toFixed(4)}, {centroid.lng.toFixed(4)}
                      </p>
                      {listingsCount > 0 && (
                        <p className="font-medium text-primary">
                          {listingsCount.toLocaleString()} active listings
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {listings.length > 0 && (
                  <Card className="mt-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        Nearby Listings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-[300px]">
                        <div className="divide-y">
                          {listings.slice(0, 20).map((listing) => (
                            <button
                              key={listing.mlsNumber}
                              className="w-full text-left px-4 py-3 hover-elevate transition-colors"
                              onClick={() => {
                                setSelectedListing(listing);
                                setShowListingPanel(true);
                                if (listing.map?.latitude && listing.map?.longitude) {
                                  mapInstanceRef.current?.panTo({
                                    lat: listing.map.latitude,
                                    lng: listing.map.longitude,
                                  });
                                }
                              }}
                              data-testid={`button-listing-${listing.mlsNumber}`}
                            >
                              <div className="flex justify-between items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-sm truncate">
                                    {formatPrice(listing.listPrice)}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {formatAddress(listing.address)}
                                  </p>
                                  <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                                    <span>{listing.details?.numBedrooms || "—"} bd</span>
                                    <span>{listing.details?.numBathrooms || "—"} ba</span>
                                    <span>{listing.details?.sqft || "—"} sqft</span>
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {step === "details" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Budget & Pricing
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="targetPrice">Target Price</Label>
                    <Input
                      id="targetPrice"
                      type="number"
                      placeholder="e.g., 500000"
                      value={mandateData.targetPrice || ""}
                      onChange={(e) => setMandateData((prev) => ({ ...prev, targetPrice: parseInt(e.target.value) || undefined }))}
                      data-testid="input-target-price"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxPrice">Maximum Price</Label>
                    <Input
                      id="maxPrice"
                      type="number"
                      placeholder="e.g., 600000"
                      value={mandateData.maxPrice || ""}
                      onChange={(e) => setMandateData((prev) => ({ ...prev, maxPrice: parseInt(e.target.value) || undefined }))}
                      data-testid="input-max-price"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5" />
                    Property Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="buildingType">Building Type</Label>
                      <Select
                        value={mandateData.buildingType || ""}
                        onValueChange={(value) => setMandateData((prev) => ({ ...prev, buildingType: value as any }))}
                      >
                        <SelectTrigger data-testid="select-building-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {buyBoxBuildingTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type.charAt(0).toUpperCase() + type.slice(1).replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="occupancy">Occupancy Status</Label>
                      <Select
                        value={mandateData.occupancy || ""}
                        onValueChange={(value) => setMandateData((prev) => ({ ...prev, occupancy: value as any }))}
                      >
                        <SelectTrigger data-testid="select-occupancy">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {buyBoxOccupancyTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type.charAt(0).toUpperCase() + type.slice(1).replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lotFrontage">Lot Frontage</Label>
                      <div className="flex gap-2">
                        <Input
                          id="lotFrontage"
                          type="number"
                          placeholder="e.g., 50"
                          value={mandateData.lotFrontage || ""}
                          onChange={(e) => setMandateData((prev) => ({ ...prev, lotFrontage: parseFloat(e.target.value) || undefined }))}
                          data-testid="input-lot-frontage"
                        />
                        <Select
                          value={mandateData.lotFrontageUnit || "ft"}
                          onValueChange={(value) => setMandateData((prev) => ({ ...prev, lotFrontageUnit: value as any }))}
                        >
                          <SelectTrigger className="w-20" data-testid="select-lot-frontage-unit">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ft">ft</SelectItem>
                            <SelectItem value="m">m</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lotDepth">Lot Depth</Label>
                      <div className="flex gap-2">
                        <Input
                          id="lotDepth"
                          type="number"
                          placeholder="e.g., 120"
                          value={mandateData.lotDepth || ""}
                          onChange={(e) => setMandateData((prev) => ({ ...prev, lotDepth: parseFloat(e.target.value) || undefined }))}
                          data-testid="input-lot-depth"
                        />
                        <Select
                          value={mandateData.lotDepthUnit || "ft"}
                          onValueChange={(value) => setMandateData((prev) => ({ ...prev, lotDepthUnit: value as any }))}
                        >
                          <SelectTrigger className="w-20" data-testid="select-lot-depth-unit">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ft">ft</SelectItem>
                            <SelectItem value="m">m</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="totalLotArea">Total Lot Area</Label>
                      <div className="flex gap-2">
                        <Input
                          id="totalLotArea"
                          type="number"
                          placeholder="e.g., 6000"
                          value={mandateData.totalLotArea || ""}
                          onChange={(e) => setMandateData((prev) => ({ ...prev, totalLotArea: parseFloat(e.target.value) || undefined }))}
                          data-testid="input-lot-area"
                        />
                        <Select
                          value={mandateData.totalLotAreaUnit || "sqft"}
                          onValueChange={(value) => setMandateData((prev) => ({ ...prev, totalLotAreaUnit: value as any }))}
                        >
                          <SelectTrigger className="w-24" data-testid="select-lot-area-unit">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sqft">sqft</SelectItem>
                            <SelectItem value="sqm">sqm</SelectItem>
                            <SelectItem value="acres">acres</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="zoningPlanningStatus">Zoning / Planning Status</Label>
                    <Input
                      id="zoningPlanningStatus"
                      placeholder="e.g., R2 Residential, Committee of Adjustment approval pending"
                      value={mandateData.zoningPlanningStatus || ""}
                      onChange={(e) => setMandateData((prev) => ({ ...prev, zoningPlanningStatus: e.target.value }))}
                      data-testid="input-zoning"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Timeline & Conditions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="targetClosingDate">Target Closing Date</Label>
                      <Input
                        id="targetClosingDate"
                        type="date"
                        value={mandateData.targetClosingDate || ""}
                        onChange={(e) => setMandateData((prev) => ({ ...prev, targetClosingDate: e.target.value }))}
                        data-testid="input-closing-date"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="possessionDate">Preferred Possession Date</Label>
                      <Input
                        id="possessionDate"
                        type="date"
                        value={mandateData.possessionDate || ""}
                        onChange={(e) => setMandateData((prev) => ({ ...prev, possessionDate: e.target.value }))}
                        data-testid="input-possession-date"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Offer Conditions (select all that apply)</Label>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {OFFER_CONDITIONS.map((condition) => (
                        <div key={condition.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`condition-${condition.id}`}
                            checked={(mandateData.offerConditions || []).includes(condition.id)}
                            onCheckedChange={(checked) => handleConditionChange(condition.id, checked as boolean)}
                            data-testid={`checkbox-condition-${condition.id}`}
                          />
                          <Label htmlFor={`condition-${condition.id}`} className="text-sm font-normal cursor-pointer">
                            {condition.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="additionalNotes">Additional Notes</Label>
                    <Textarea
                      id="additionalNotes"
                      placeholder="Any other requirements or preferences..."
                      rows={4}
                      value={mandateData.additionalNotes || ""}
                      onChange={(e) => setMandateData((prev) => ({ ...prev, additionalNotes: e.target.value }))}
                      data-testid="textarea-notes"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>Your BuyBox Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {centroid && (
                    <div>
                      <p className="text-muted-foreground">Target Area</p>
                      <p className="font-medium text-green-600">Area defined on map</p>
                    </div>
                  )}

                  {(mandateData.targetPrice || mandateData.maxPrice) && (
                    <div>
                      <p className="text-muted-foreground">Budget</p>
                      <p className="font-medium">
                        {mandateData.targetPrice ? `$${mandateData.targetPrice.toLocaleString()}` : ""}
                        {mandateData.targetPrice && mandateData.maxPrice ? " - " : ""}
                        {mandateData.maxPrice ? `$${mandateData.maxPrice.toLocaleString()}` : ""}
                      </p>
                    </div>
                  )}

                  {mandateData.buildingType && (
                    <div>
                      <p className="text-muted-foreground">Property Type</p>
                      <p className="font-medium capitalize">{mandateData.buildingType.replace("_", " ")}</p>
                    </div>
                  )}

                  {(mandateData.offerConditions?.length || 0) > 0 && (
                    <div>
                      <p className="text-muted-foreground">Conditions</p>
                      <p className="font-medium">{mandateData.offerConditions?.length} selected</p>
                    </div>
                  )}

                  {listingsCount > 0 && (
                    <div>
                      <p className="text-muted-foreground">Available Listings</p>
                      <p className="font-medium text-primary">{listingsCount.toLocaleString()} in area</p>
                    </div>
                  )}

                  <div className="pt-4 border-t space-y-3">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setStep("draw")}
                      data-testid="button-back-to-map"
                    >
                      Back to Map
                    </Button>
                    <Button
                      className="w-full"
                      onClick={handleContinueToAgreement}
                      data-testid="button-continue-agreement"
                    >
                      Continue to Agreement
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>

                  {!isAuthenticated && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-amber-800 dark:text-amber-200">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <p className="text-xs">You'll need to sign in before submitting your BuyBox.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
