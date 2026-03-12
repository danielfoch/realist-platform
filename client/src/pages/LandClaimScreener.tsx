import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Label } from "@/components/ui/label";
import {
  Search, MapPin, Shield, AlertTriangle, CheckCircle, Info,
  ChevronDown, ChevronUp, Download, Copy, FileText, History,
  Layers, Eye, EyeOff, X, Lock, Mail, User as UserIcon
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

const CANADA_CENTER: [number, number] = [56.1304, -106.3468];
const DEFAULT_ZOOM = 4;

const BUFFER_OPTIONS = [
  { value: 0, label: "Point only" },
  { value: 250, label: "250m" },
  { value: 500, label: "500m" },
  { value: 1000, label: "1 km" },
  { value: 5000, label: "5 km" },
];

const LAYER_COLORS: Record<string, string> = {
  historic_treaty: "#3b82f6",
  modern_treaty: "#22c55e",
  high_sensitivity: "#ef4444",
};

const LAYER_LABELS: Record<string, string> = {
  historic_treaty: "Historic Treaties",
  modern_treaty: "Modern Treaties & Agreements",
  high_sensitivity: "High-Sensitivity / Active Contestation",
};

const HS_OVERLAY_COLORS: Record<string, { fill: string; stroke: string }> = {
  "cowichan-title-lands-richmond": { fill: "#dc2626", stroke: "#991b1b" },
  "musqueam-territory-agreement-watch": { fill: "#f59e0b", stroke: "#b45309" },
  "musqueam-soi-approximate": { fill: "#f59e0b", stroke: "#92400e" },
  "haldimand-tract-historic-watch": { fill: "#7c3aed", stroke: "#5b21b6" },
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence — approximate",
};

const CONTEXT_LABELS: Record<string, string> = {
  court_decision: "Court Decision",
  rights_recognition_agreement: "Rights Recognition Agreement",
  historic_tract_litigation: "Historic Tract / Litigation",
  statement_of_intent_boundary: "Statement of Intent / Declaration",
  declaration_boundary: "Declaration Boundary",
};

interface ScreeningHit {
  featureId: string;
  featureName: string;
  nationName: string | null;
  treatyName: string | null;
  agreementName: string | null;
  province: string | null;
  category: string | null;
  layerName: string;
  layerGroup: string;
  sourceName: string;
  sourceUrl: string | null;
  hitType: "inside" | "intersects" | "within_buffer";
  distanceMeters: number | null;
  isHighSensitivity?: boolean;
  legalContextType?: string | null;
  geometryConfidence?: string | null;
  authorityLevel?: string | null;
  disclaimerText?: string | null;
  statusLabel?: string | null;
  sourceSummary?: string | null;
  sourceDate?: string | null;
  geometryMethod?: string | null;
}

interface ScreeningResult {
  status: "overlap_found" | "near_overlap" | "no_overlap_found" | "limited_data";
  screeningMethod: string;
  bufferMeters: number;
  hitsCount: number;
  completeness: string;
  summary: string;
  hits: ScreeningHit[];
  disclaimer: string;
  screeningId: string;
  hasHighSensitivityHits: boolean;
  highSensitivityBanner: string | null;
}

function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.5 });
  }, [center, zoom, map]);
  return null;
}

function escHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function LandClaimScreener() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [address, setAddress] = useState("");
  const [bufferMeters, setBufferMeters] = useState(500);
  const [mapCenter, setMapCenter] = useState<[number, number]>(CANADA_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [searchMarker, setSearchMarker] = useState<[number, number] | null>(null);
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [researchMode, setResearchMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({
    historic_treaty: true,
    modern_treaty: true,
    high_sensitivity: true,
  });

  const [gateFirstName, setGateFirstName] = useState("");
  const [gateLastName, setGateLastName] = useState("");
  const [gateEmail, setGateEmail] = useState("");
  const [gatePhone, setGatePhone] = useState("");
  const [gateAddress, setGateAddress] = useState("");
  const [gateSubmitting, setGateSubmitting] = useState(false);

  const isUnlocked = !!user || unlocked;

  const handleGateSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gateFirstName.trim() || !gateEmail.trim() || !gatePhone.trim() || !gateAddress.trim()) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setGateSubmitting(true);
    try {
      await apiRequest("POST", "/api/land-claim-screener/register", {
        firstName: gateFirstName.trim(),
        lastName: gateLastName.trim(),
        email: gateEmail.trim(),
        phone: gatePhone.trim(),
        address: gateAddress.trim(),
      });
      setAddress(gateAddress.trim());
      setUnlocked(true);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Welcome!", description: "The screener is now unlocked." });
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setGateSubmitting(false);
    }
  }, [gateFirstName, gateLastName, gateEmail, gatePhone, gateAddress, toast]);

  const [showSignUpGate, setShowSignUpGate] = useState(false);

  const { data: featuresGeoJSON, isLoading: featuresLoading } = useQuery({
    queryKey: ["/api/land-claim-screener/features"],
    staleTime: 1000 * 60 * 60,
  });

  const { data: layers } = useQuery({
    queryKey: ["/api/land-claim-screener/layers"],
    staleTime: 1000 * 60 * 60,
  });

  const { data: history, refetch: refetchHistory } = useQuery({
    queryKey: ["/api/land-claim-screener/history"],
    enabled: !!user,
  });

  const screenMutation = useMutation({
    mutationFn: async (data: { lat: number; lng: number; bufferMeters: number; address: string }) => {
      const res = await apiRequest("POST", "/api/land-claim-screener/screen", data);
      return res.json();
    },
    onSuccess: (data: ScreeningResult) => {
      setResult(data);
      setDrawerOpen(true);
      if (user) refetchHistory();
    },
    onError: () => {
      toast({ title: "Screening failed", description: "Please try again.", variant: "destructive" });
    },
  });

  const handleSearch = useCallback(async () => {
    if (!isUnlocked) {
      setShowSignUpGate(true);
      return;
    }
    if (!address.trim()) {
      toast({ title: "Please enter an address", variant: "destructive" });
      return;
    }

    const coordMatch = address.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      setSearchMarker([lat, lng]);
      setMapCenter([lat, lng]);
      setMapZoom(12);
      screenMutation.mutate({ lat, lng, bufferMeters, address });
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ", Canada")}&format=json&limit=1&countrycodes=ca`
      );
      const results = await response.json();
      if (results.length === 0) {
        toast({ title: "Address not found", description: "Please try a different address or enter coordinates (lat, lng).", variant: "destructive" });
        return;
      }
      const { lat, lon } = results[0];
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lon);
      setSearchMarker([latNum, lngNum]);
      setMapCenter([latNum, lngNum]);
      setMapZoom(12);
      screenMutation.mutate({ lat: latNum, lng: lngNum, bufferMeters, address: results[0].display_name || address });
    } catch {
      toast({ title: "Geocoding failed", description: "Please try again or enter coordinates.", variant: "destructive" });
    }
  }, [address, bufferMeters, screenMutation, toast, isUnlocked]);

  const statusConfig = useMemo(() => {
    if (!result) return null;
    switch (result.status) {
      case "overlap_found":
        return { color: "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300", icon: AlertTriangle, label: "Potential Overlap Detected", iconColor: "text-red-500" };
      case "near_overlap":
        return { color: "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-300", icon: Info, label: "Near Overlap Found", iconColor: "text-yellow-500" };
      case "no_overlap_found":
        return { color: "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300", icon: CheckCircle, label: "No Overlap Found in Current Datasets", iconColor: "text-green-500" };
      default:
        return { color: "bg-gray-500/10 border-gray-500/30 text-gray-700 dark:text-gray-300", icon: Info, label: "Data Unavailable / Incomplete", iconColor: "text-gray-500" };
    }
  }, [result]);

  const handleCopySummary = useCallback(() => {
    if (!result) return;
    const text = `Land Claim Screening Summary\n\nStatus: ${result.status}\nMethod: ${result.screeningMethod}\nBuffer: ${result.bufferMeters}m\nHits: ${result.hitsCount}\n\n${result.summary}\n\n${result.disclaimer}`;
    navigator.clipboard.writeText(text);
    toast({ title: "Summary copied to clipboard" });
  }, [result, toast]);

  const handleExportCSV = useCallback(() => {
    if (!result?.hits?.length) return;
    const headers = "Layer,Feature,Treaty/Agreement,Province,Hit Type,Distance (m),Source\n";
    const rows = result.hits.map(h =>
      `"${h.layerName}","${h.featureName}","${h.treatyName || h.agreementName || ""}","${h.province || ""}","${h.hitType}","${h.distanceMeters || 0}","${h.sourceName}"`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "land-claim-screening.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const geoJsonStyle = useCallback((feature: any) => {
    const group = feature?.properties?.layerGroup || "historic_treaty";
    const isHS = feature?.properties?.isHighSensitivity;
    const slug = feature?.properties?.layerSlug;

    if (isHS && slug && HS_OVERLAY_COLORS[slug]) {
      const colors = HS_OVERLAY_COLORS[slug];
      return {
        color: colors.stroke,
        weight: 3,
        fillOpacity: 0.25,
        fillColor: colors.fill,
        dashArray: "8 4",
      };
    }

    if (isHS) {
      return {
        color: "#991b1b",
        weight: 3,
        fillOpacity: 0.25,
        fillColor: "#ef4444",
        dashArray: "8 4",
      };
    }

    return {
      color: LAYER_COLORS[group] || "#6b7280",
      weight: 2,
      fillOpacity: 0.15,
      fillColor: LAYER_COLORS[group] || "#6b7280",
    };
  }, []);

  const loginUrl = `/login?returnUrl=${encodeURIComponent("/tools/land-claim-screener")}`;

  const onEachFeature = useCallback((feature: any, layer: any) => {
    const p = feature.properties;
    const isHS = p.isHighSensitivity;
    const confidenceLabel = p.geometryConfidence ? (CONFIDENCE_LABELS[p.geometryConfidence] || p.geometryConfidence) : null;
    const contextLabel = p.legalContextType ? (CONTEXT_LABELS[p.legalContextType] || p.legalContextType) : null;

    if (!isUnlocked) {
      layer.bindPopup(`
        <div style="min-width:220px;text-align:center;padding:8px 4px">
          <div style="font-size:1.4em;margin-bottom:6px">🔒</div>
          <strong style="font-size:0.95em">Sign in to view details</strong>
          <p style="font-size:0.82em;color:#666;margin:8px 0">Log in or create a free account to see treaty names, status, legal context, and sensitivity details for this area.</p>
          <a href="${loginUrl}" style="display:inline-block;padding:8px 20px;background:#2563eb;color:#fff;border-radius:6px;font-size:0.85em;font-weight:600;text-decoration:none;margin-top:4px" data-testid="popup-login-btn">Sign In</a>
          <p style="font-size:0.75em;color:#888;margin-top:8px">Don't have an account? <a href="${loginUrl}" style="color:#2563eb;text-decoration:underline">Create one free</a></p>
        </div>
      `);
      return;
    }

    if (isHS) {
      layer.bindPopup(`
        <div style="min-width:220px;border-left:4px solid #ef4444;padding-left:8px">
          <div style="background:#fef2f2;padding:4px 6px;margin:-4px -4px 8px -12px;border-radius:2px">
            <strong style="color:#991b1b;font-size:0.8em">⚠ HEIGHTENED REVIEW</strong>
          </div>
          <strong>${escHtml(p.featureName) || "Unknown"}</strong><br/>
          ${contextLabel ? `<span style="font-size:0.85em;color:#b45309">${escHtml(contextLabel)}</span><br/>` : ""}
          ${p.statusLabel ? `<span style="font-size:0.85em;color:#666">Status: ${escHtml(p.statusLabel)}</span><br/>` : ""}
          ${confidenceLabel ? `<span style="font-size:0.8em;color:#888">Geometry: ${escHtml(confidenceLabel)}</span><br/>` : ""}
          ${p.disclaimerText ? `<div style="font-size:0.75em;color:#666;margin-top:6px;padding:4px;background:#f9fafb;border-radius:2px">${escHtml(p.disclaimerText)}</div>` : ""}
        </div>
      `);
    } else {
      layer.bindPopup(`
        <div style="min-width:200px">
          <strong>${escHtml(p.featureName) || "Unknown"}</strong><br/>
          <span style="color:#666">${escHtml(p.layerName)}</span><br/>
          ${p.province ? `<span>Province: ${escHtml(p.province)}</span><br/>` : ""}
          ${p.category ? `<span style="font-size:0.85em;color:#888">${escHtml(p.category)}</span>` : ""}
        </div>
      `);
    }
  }, [isUnlocked, loginUrl]);

  const filteredFeatures = useMemo(() => {
    if (!featuresGeoJSON) return null;
    const gj = featuresGeoJSON as any;
    return {
      ...gj,
      features: (gj.features || []).filter((f: any) =>
        visibleLayers[f.properties?.layerGroup] !== false
      ),
    };
  }, [featuresGeoJSON, visibleLayers]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="Indigenous Land Claim & Treaty Area Screener"
        description="Screen Canadian properties for potential overlap with historic treaties, modern treaties, and Indigenous agreement areas. Informational screening tool powered by official federal open data."
        keywords="indigenous land claim, treaty area, canada treaty map, land screening, indigenous rights, treaty boundary, first nations, property screening"
        canonicalUrl="/tools/land-claim-screener"
      />
      <Navigation />

      <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)]">
        <div className="flex-1 flex flex-col">
          <div className="bg-card border-b p-3 md:p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Enter address, postal code, or lat,lng..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="pl-10"
                    data-testid="input-address"
                  />
                </div>
              </div>
              <Button
                onClick={handleSearch}
                disabled={screenMutation.isPending}
                data-testid="button-screen"
              >
                {screenMutation.isPending ? "Screening..." : "Screen Location"}
              </Button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground font-medium">Buffer:</span>
              {BUFFER_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={bufferMeters === opt.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBufferMeters(opt.value)}
                  data-testid={`button-buffer-${opt.value}`}
                >
                  {opt.label}
                </Button>
              ))}

              <div className="ml-auto flex items-center gap-2">
                {Object.entries(LAYER_LABELS).map(([key, label]) => (
                  <Button
                    key={key}
                    variant="ghost"
                    size="sm"
                    onClick={() => setVisibleLayers(prev => ({ ...prev, [key]: !prev[key] }))}
                    className="gap-1.5 text-xs"
                    data-testid={`toggle-layer-${key}`}
                  >
                    {visibleLayers[key] ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    <span
                      className="w-3 h-3 rounded-sm inline-block"
                      style={{ backgroundColor: LAYER_COLORS[key] }}
                    />
                    <span className="hidden md:inline">{label}</span>
                  </Button>
                ))}

                {user && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHistory(!showHistory)}
                    data-testid="button-toggle-history"
                  >
                    <History className="h-4 w-4" />
                    <span className="hidden md:inline ml-1">History</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 relative" data-testid="map-container">
            {featuresLoading ? (
              <div className="flex items-center justify-center h-full">
                <Skeleton className="w-full h-full" />
              </div>
            ) : (
              <MapContainer
                center={CANADA_CENTER}
                zoom={DEFAULT_ZOOM}
                className="h-full w-full z-0"
                scrollWheelZoom={true}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Data: <a href="https://open.canada.ca">Open Government Canada</a>'
                />
                <MapUpdater center={mapCenter} zoom={mapZoom} />

                {filteredFeatures && filteredFeatures.features?.length > 0 && (
                  <GeoJSON
                    key={JSON.stringify(visibleLayers) + (isUnlocked ? "-unlocked" : "-locked")}
                    data={filteredFeatures}
                    style={geoJsonStyle}
                    onEachFeature={onEachFeature}
                  />
                )}

                {searchMarker && (
                  <Marker position={searchMarker} icon={redIcon}>
                    <Popup>
                      <strong>Search Location</strong><br />
                      {address}
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            )}

            {!drawerOpen && result && (
              <button
                onClick={() => setDrawerOpen(true)}
                className="absolute top-4 right-4 z-[1000] bg-card border rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 hover:bg-accent transition-colors"
                data-testid="button-open-drawer"
              >
                <Shield className="h-4 w-4" />
                <span className="text-sm font-medium">View Results ({result.hitsCount})</span>
              </button>
            )}
          </div>
        </div>

        {(drawerOpen || showHistory) && (
          <div className="w-full lg:w-[420px] border-l bg-card overflow-y-auto flex-shrink-0" data-testid="results-drawer">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-lg" data-testid="text-drawer-title">
                {showHistory ? "Search History" : "Screening Results"}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setDrawerOpen(false); setShowHistory(false); }}
                data-testid="button-close-drawer"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {showHistory && (
              <div className="p-4 space-y-3">
                {!history || (history as any[]).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-history">No screening history yet.</p>
                ) : (
                  (history as any[]).map((s: any) => (
                    <Card
                      key={s.id}
                      className="cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => {
                        setAddress(s.searchedAddress || `${s.lat}, ${s.lng}`);
                        setSearchMarker([s.lat, s.lng]);
                        setMapCenter([s.lat, s.lng]);
                        setMapZoom(12);
                        setBufferMeters(s.bufferMeters || 0);
                        setShowHistory(false);
                        screenMutation.mutate({ lat: s.lat, lng: s.lng, bufferMeters: s.bufferMeters || 0, address: s.searchedAddress || "" });
                      }}
                      data-testid={`card-history-${s.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium truncate">{s.searchedAddress || `${s.lat}, ${s.lng}`}</div>
                          <Badge variant={s.resultStatus === "overlap_found" ? "destructive" : s.resultStatus === "near_overlap" ? "secondary" : "outline"} className="text-xs shrink-0">
                            {s.resultStatus?.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(s.createdAt).toLocaleDateString()} &middot; {s.bufferMeters}m buffer
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}

            {!showHistory && result && (
              <div className="p-4 space-y-4">
                {statusConfig && (
                  <div className={`rounded-lg border p-4 ${statusConfig.color}`} data-testid="status-banner">
                    <div className="flex items-center gap-2 mb-2">
                      <statusConfig.icon className={`h-5 w-5 ${statusConfig.iconColor}`} />
                      <span className="font-semibold">{statusConfig.label}</span>
                    </div>
                    <p className="text-sm">{result.summary}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" data-testid="badge-method">
                    <MapPin className="h-3 w-3 mr-1" />
                    Point-based screening
                  </Badge>
                  <Badge variant="outline" data-testid="badge-completeness">
                    <Layers className="h-3 w-3 mr-1" />
                    {result.completeness.charAt(0).toUpperCase() + result.completeness.slice(1)} coverage
                  </Badge>
                  <Badge variant="outline" data-testid="badge-buffer">
                    {result.bufferMeters > 0 ? `${result.bufferMeters}m buffer` : "No buffer"}
                  </Badge>
                </div>

                {result.hasHighSensitivityHits && result.highSensitivityBanner && (
                  <div className="rounded-lg border-2 border-red-500/50 bg-red-50 dark:bg-red-950/30 p-4" data-testid="hs-banner">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      <span className="font-bold text-red-700 dark:text-red-300 text-sm">Heightened Review Area</span>
                    </div>
                    <p className="text-sm text-red-800 dark:text-red-200">{result.highSensitivityBanner}</p>
                  </div>
                )}

                {result.hits.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2 text-sm" data-testid="text-hits-heading">
                      Matched Layers ({result.hits.length})
                    </h3>
                    <div className="space-y-2">
                      {result.hits.map((hit, idx) => (
                        <Card
                          key={idx}
                          className={hit.isHighSensitivity ? "border-red-400/60 dark:border-red-600/60 shadow-sm" : ""}
                          data-testid={`card-hit-${idx}`}
                        >
                          <CardContent className="p-3 space-y-1.5">
                            {hit.isHighSensitivity && (
                              <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 mb-1">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                <span className="text-xs font-semibold uppercase tracking-wide">
                                  {hit.statusLabel || "Heightened Review"}
                                </span>
                              </div>
                            )}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-medium text-sm" data-testid={`text-hit-name-${idx}`}>{hit.featureName}</div>
                                {!hit.isHighSensitivity && <div className="text-xs text-muted-foreground">{hit.layerName}</div>}
                                {hit.isHighSensitivity && hit.nationName && (
                                  <div className="text-xs text-muted-foreground">{hit.nationName}</div>
                                )}
                              </div>
                              <Badge
                                variant={hit.hitType === "inside" ? "destructive" : "secondary"}
                                className="text-xs shrink-0"
                                data-testid={`badge-hit-type-${idx}`}
                              >
                                {hit.hitType === "inside" ? "Inside" : hit.hitType === "within_buffer" ? `Within ${hit.distanceMeters}m` : hit.hitType}
                              </Badge>
                            </div>
                            {hit.isHighSensitivity && hit.legalContextType && (
                              <div className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                                {CONTEXT_LABELS[hit.legalContextType] || hit.legalContextType}
                              </div>
                            )}
                            {hit.isHighSensitivity && hit.geometryConfidence && (
                              <div className="text-xs text-muted-foreground">
                                Geometry: {CONFIDENCE_LABELS[hit.geometryConfidence] || hit.geometryConfidence}
                              </div>
                            )}
                            {!hit.isHighSensitivity && hit.province && <div className="text-xs text-muted-foreground">Province: {hit.province}</div>}
                            {!hit.isHighSensitivity && hit.category && <div className="text-xs text-muted-foreground">{hit.category}</div>}
                            <div className="text-xs text-muted-foreground">
                              Source: {hit.isHighSensitivity ? (hit.sourceSummary ? hit.sourceSummary.substring(0, 100) + "..." : hit.sourceName) : hit.sourceName}
                              {hit.sourceUrl && (
                                <> &middot; <a href={hit.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline text-primary">View source</a></>
                              )}
                            </div>
                            {hit.isHighSensitivity && hit.disclaimerText && (
                              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded mt-1 border border-muted">
                                {hit.disclaimerText}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopySummary} className="gap-1.5" data-testid="button-copy-summary">
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!result.hits.length} className="gap-1.5" data-testid="button-export-csv">
                    <Download className="h-3.5 w-3.5" />
                    CSV
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setResearchMode(!researchMode)}
                  className="w-full justify-between"
                  data-testid="button-research-mode"
                >
                  <span className="text-sm">Research Mode</span>
                  {researchMode ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>

                {researchMode && (
                  <div className="space-y-3 text-xs" data-testid="research-mode-content">
                    <div>
                      <h4 className="font-semibold mb-1">Screening Details</h4>
                      <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
{JSON.stringify({
  screeningId: result.screeningId,
  method: result.screeningMethod,
  bufferMeters: result.bufferMeters,
  status: result.status,
  completeness: result.completeness,
  hitsCount: result.hitsCount,
}, null, 2)}
                      </pre>
                    </div>
                    {result.hits.map((hit, idx) => (
                      <div key={idx}>
                        <h4 className="font-semibold mb-1">{hit.featureName}</h4>
                        <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
{JSON.stringify({
  featureId: hit.featureId,
  layerGroup: hit.layerGroup,
  hitType: hit.hitType,
  distanceMeters: hit.distanceMeters,
  province: hit.province,
  category: hit.category,
  sourceName: hit.sourceName,
  sourceUrl: hit.sourceUrl,
}, null, 2)}
                        </pre>
                      </div>
                    ))}
                    {layers && (
                      <div>
                        <h4 className="font-semibold mb-1">Active Data Layers</h4>
                        <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
{JSON.stringify((layers as any[]).map(l => ({
  name: l.layerName,
  group: l.layerGroup,
  source: l.sourceName,
  features: l.featureCount,
  lastImported: l.lastImportedAt,
})), null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                <Card className="bg-muted/50">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground leading-relaxed" data-testid="text-disclaimer">
                      {result.disclaimer}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>

      {showSignUpGate && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowSignUpGate(false)}>
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
                Create a free account to screen properties for treaty area overlap and view detailed land claim information.
              </p>
              <div className="space-y-2 pt-2">
                <Button asChild className="w-full gap-2" data-testid="button-gate-signup">
                  <a href={`/login?returnUrl=${encodeURIComponent("/tools/land-claim-screener")}`}>
                    <UserIcon className="h-4 w-4" />
                    Sign Up — It's Free
                  </a>
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setShowSignUpGate(false)} data-testid="button-gate-dismiss">
                  Maybe Later
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Already have an account? <a href={`/login?returnUrl=${encodeURIComponent("/tools/land-claim-screener")}`} className="text-primary underline font-medium" data-testid="link-gate-login">Sign in</a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
