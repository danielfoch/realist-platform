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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { MapPin, Trash2, ArrowRight, ArrowLeft, Home, DollarSign, Calendar, FileText, AlertCircle, Mail, Phone, Voicemail, ShoppingCart, Check } from "lucide-react";
import { buyBoxBuildingTypes, buyBoxOccupancyTypes, type BuyBoxMandateFormData } from "@shared/schema";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";

const OFFER_CONDITIONS = [
  { id: "financing", label: "Financing" },
  { id: "inspection", label: "Home Inspection" },
  { id: "lawyer_review", label: "Lawyer Review" },
  { id: "sale_of_buyer_property", label: "Sale of Buyer's Property" },
  { id: "status_certificate", label: "Status Certificate (Condo)" },
  { id: "zoning_due_diligence", label: "Zoning Due Diligence" },
  { id: "other", label: "Other" },
];

const SERVICES = [
  {
    id: "direct_mail",
    title: "Direct Mail Campaign",
    description: "Professionally designed mailers sent to property owners in your target area via PostGrid. Includes design, printing, and postage.",
    icon: Mail,
    pricePerUnit: 2.50,
    unitLabel: "per mailer",
    minQty: 100,
    maxQty: 5000,
    defaultQty: 250,
    provider: "PostGrid",
  },
  {
    id: "ai_phone_calls",
    title: "AI Phone Outreach",
    description: "AI-powered phone calls to property owners using natural-sounding voice agents. Each call follows a custom script tailored to your criteria.",
    icon: Phone,
    pricePerUnit: 1.00,
    unitLabel: "per call",
    minQty: 50,
    maxQty: 2000,
    defaultQty: 100,
    provider: "ElevenLabs",
  },
  {
    id: "voicemail_drops",
    title: "Voicemail Drops",
    description: "Ringless voicemail drops delivered directly to property owners' voicemail boxes. High open rates without interrupting their day.",
    icon: Voicemail,
    pricePerUnit: 0.15,
    unitLabel: "per drop",
    minQty: 100,
    maxQty: 10000,
    defaultQty: 500,
    provider: "SlyBroadcast",
  },
];

const TORONTO_CENTER: [number, number] = [43.6532, -79.3832];

function DrawControl({ onCreated, onDeleted }: { onCreated: (e: any) => void; onDeleted: (e: any) => void }) {
  const map = useMap();
  const controlRef = useRef<any>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);

  useEffect(() => {
    if (controlRef.current) return;

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    const drawControl = new (L as any).Control.Draw({
      position: "topright",
      draw: {
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polyline: false,
        polygon: {
          allowIntersection: false,
          shapeOptions: {
            color: "#22c55e",
            fillColor: "#22c55e",
            fillOpacity: 0.3,
            weight: 2,
          },
        },
      },
      edit: {
        featureGroup: drawnItems,
      },
    });

    map.addControl(drawControl);
    controlRef.current = drawControl;

    map.on("draw:created" as any, (e: any) => {
      drawnItems.clearLayers();
      drawnItems.addLayer(e.layer);
      onCreated(e);
    });

    map.on("draw:edited" as any, (e: any) => {
      const layers = e.layers;
      layers.eachLayer((layer: any) => {
        onCreated({ layer });
      });
    });

    map.on("draw:deleted" as any, () => {
      onDeleted();
    });

    return () => {
      map.removeControl(drawControl);
      map.removeLayer(drawnItems);
      controlRef.current = null;
    };
  }, [map]);

  return null;
}

export default function BuyBox() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<"draw" | "details" | "services">("draw");
  const [hasPolygon, setHasPolygon] = useState(false);
  const [polygonGeoJson, setPolygonGeoJson] = useState<any>(null);
  const [centroid, setCentroid] = useState<{ lat: number; lng: number } | null>(null);

  const [mandateData, setMandateData] = useState<Partial<BuyBoxMandateFormData>>({
    lotFrontageUnit: "ft",
    lotDepthUnit: "ft",
    totalLotAreaUnit: "sqft",
    offerConditions: [],
  });

  const [selectedServices, setSelectedServices] = useState<Record<string, { enabled: boolean; qty: number }>>({
    direct_mail: { enabled: false, qty: 250 },
    ai_phone_calls: { enabled: false, qty: 100 },
    voicemail_drops: { enabled: false, qty: 500 },
  });

  useEffect(() => {
    if (step === "draw") {
      sessionStorage.removeItem("buybox_polygon");
      sessionStorage.removeItem("buybox_centroid");
      sessionStorage.removeItem("buybox_mandate");
    }
  }, [step]);

  const handlePolygonCreated = useCallback((e: any) => {
    const layer = e.layer;
    const latlngs = layer.getLatLngs()[0];

    const coordinates: [number, number][] = latlngs.map((ll: L.LatLng) => [ll.lng, ll.lat]);
    if (coordinates.length > 0) {
      coordinates.push(coordinates[0]);
    }

    const geoJson = { type: "Polygon", coordinates: [coordinates] };
    setPolygonGeoJson(geoJson);

    const totalLat = latlngs.reduce((sum: number, ll: L.LatLng) => sum + ll.lat, 0);
    const totalLng = latlngs.reduce((sum: number, ll: L.LatLng) => sum + ll.lng, 0);
    setCentroid({
      lat: totalLat / latlngs.length,
      lng: totalLng / latlngs.length,
    });
    setHasPolygon(true);
  }, []);

  const handlePolygonDeleted = useCallback(() => {
    setHasPolygon(false);
    setPolygonGeoJson(null);
    setCentroid(null);
  }, []);

  const handleConditionChange = (conditionId: string, checked: boolean) => {
    setMandateData(prev => ({
      ...prev,
      offerConditions: checked
        ? [...(prev.offerConditions || []), conditionId]
        : (prev.offerConditions || []).filter(c => c !== conditionId),
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

  const handleContinueToServices = () => {
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
    setStep("services");
  };

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev => ({
      ...prev,
      [serviceId]: { ...prev[serviceId], enabled: !prev[serviceId].enabled },
    }));
  };

  const updateServiceQty = (serviceId: string, qty: number) => {
    const service = SERVICES.find(s => s.id === serviceId);
    if (!service) return;
    const clamped = Math.max(service.minQty, Math.min(service.maxQty, qty));
    setSelectedServices(prev => ({
      ...prev,
      [serviceId]: { ...prev[serviceId], qty: clamped },
    }));
  };

  const getTotal = () => {
    return SERVICES.reduce((total, service) => {
      const sel = selectedServices[service.id];
      if (sel?.enabled) {
        return total + service.pricePerUnit * sel.qty;
      }
      return total;
    }, 0);
  };

  const getSelectedCount = () => SERVICES.filter(s => selectedServices[s.id]?.enabled).length;

  const handleCheckout = async () => {
    if (getSelectedCount() === 0) {
      toast({
        title: "Select at least one service",
        description: "Choose the outreach services you'd like to run in your target area.",
        variant: "destructive",
      });
      return;
    }

    const servicesPayload = SERVICES
      .filter(s => selectedServices[s.id]?.enabled)
      .map(s => ({
        serviceId: s.id,
        qty: selectedServices[s.id].qty,
        unitPrice: s.pricePerUnit,
        total: s.pricePerUnit * selectedServices[s.id].qty,
      }));

    sessionStorage.setItem("buybox_services", JSON.stringify(servicesPayload));
    sessionStorage.setItem("buybox_polygon", JSON.stringify(polygonGeoJson));
    sessionStorage.setItem("buybox_centroid", JSON.stringify(centroid));
    sessionStorage.setItem("buybox_mandate", JSON.stringify(mandateData));

    setLocation("/buybox/checkout");
  };

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
          <h1 className="text-3xl font-bold mb-2" data-testid="text-buybox-title">Create Your BuyBox</h1>
          <p className="text-muted-foreground">
            Define your target investment area, set your criteria, and choose outreach services to connect with property owners directly.
          </p>
        </div>

        <div className="flex gap-2 mb-6">
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
            variant={step === "services" ? "default" : "outline"}
            size="sm"
            disabled={!hasPolygon}
            onClick={() => hasPolygon && isAuthenticated && setStep("services")}
            data-testid="button-step-services"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            3. Select Services
          </Button>
        </div>

        {step === "draw" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Draw Your Target Area
                  </CardTitle>
                  <CardDescription>
                    Use the polygon tool to outline the area where you want to buy property
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="w-full h-[500px] rounded-lg border overflow-hidden" data-testid="map-container">
                    <MapContainer
                      center={TORONTO_CENTER}
                      zoom={11}
                      style={{ width: "100%", height: "100%" }}
                      zoomControl={true}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                      />
                      <DrawControl
                        onCreated={handlePolygonCreated}
                        onDeleted={handlePolygonDeleted}
                      />
                    </MapContainer>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={handleContinueToDetails}
                      disabled={!hasPolygon}
                      data-testid="button-continue-details"
                    >
                      Continue to Details
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Instructions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">1</div>
                    <p>Click the polygon icon on the map toolbar (top right)</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">2</div>
                    <p>Click on the map to add points and form your target area</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">3</div>
                    <p>Click the first point again to close the polygon</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">4</div>
                    <p>Use the edit/delete tools to adjust or redraw</p>
                  </div>
                </CardContent>
              </Card>

              {hasPolygon && centroid && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-green-600 flex items-center gap-2">
                      <Check className="h-5 w-5" />
                      Area Selected
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p className="text-muted-foreground">
                      Center: {centroid.lat.toFixed(4)}, {centroid.lng.toFixed(4)}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
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
                      onChange={(e) => setMandateData(prev => ({ ...prev, targetPrice: parseInt(e.target.value) || undefined }))}
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
                      onChange={(e) => setMandateData(prev => ({ ...prev, maxPrice: parseInt(e.target.value) || undefined }))}
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
                        onValueChange={(value) => setMandateData(prev => ({ ...prev, buildingType: value as any }))}
                      >
                        <SelectTrigger data-testid="select-building-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {buyBoxBuildingTypes.map(type => (
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
                        onValueChange={(value) => setMandateData(prev => ({ ...prev, occupancy: value as any }))}
                      >
                        <SelectTrigger data-testid="select-occupancy">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {buyBoxOccupancyTypes.map(type => (
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
                          onChange={(e) => setMandateData(prev => ({ ...prev, lotFrontage: parseFloat(e.target.value) || undefined }))}
                          data-testid="input-lot-frontage"
                        />
                        <Select
                          value={mandateData.lotFrontageUnit || "ft"}
                          onValueChange={(value) => setMandateData(prev => ({ ...prev, lotFrontageUnit: value as any }))}
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
                          onChange={(e) => setMandateData(prev => ({ ...prev, lotDepth: parseFloat(e.target.value) || undefined }))}
                          data-testid="input-lot-depth"
                        />
                        <Select
                          value={mandateData.lotDepthUnit || "ft"}
                          onValueChange={(value) => setMandateData(prev => ({ ...prev, lotDepthUnit: value as any }))}
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
                          onChange={(e) => setMandateData(prev => ({ ...prev, totalLotArea: parseFloat(e.target.value) || undefined }))}
                          data-testid="input-lot-area"
                        />
                        <Select
                          value={mandateData.totalLotAreaUnit || "sqft"}
                          onValueChange={(value) => setMandateData(prev => ({ ...prev, totalLotAreaUnit: value as any }))}
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
                      onChange={(e) => setMandateData(prev => ({ ...prev, zoningPlanningStatus: e.target.value }))}
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
                        onChange={(e) => setMandateData(prev => ({ ...prev, targetClosingDate: e.target.value }))}
                        data-testid="input-closing-date"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="possessionDate">Preferred Possession Date</Label>
                      <Input
                        id="possessionDate"
                        type="date"
                        value={mandateData.possessionDate || ""}
                        onChange={(e) => setMandateData(prev => ({ ...prev, possessionDate: e.target.value }))}
                        data-testid="input-possession-date"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Offer Conditions (select all that apply)</Label>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {OFFER_CONDITIONS.map(condition => (
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
                      onChange={(e) => setMandateData(prev => ({ ...prev, additionalNotes: e.target.value }))}
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

                  <div className="pt-4 border-t space-y-3">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setStep("draw")}
                      data-testid="button-back-to-map"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Map
                    </Button>
                    <Button
                      className="w-full"
                      onClick={handleContinueToServices}
                      data-testid="button-continue-services"
                    >
                      Continue to Services
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>

                  {!isAuthenticated && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-amber-800 dark:text-amber-200">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <p className="text-xs">You'll need to sign in before selecting services.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === "services" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="mb-2">
                <h2 className="text-xl font-semibold" data-testid="text-services-heading">Choose Your Outreach Services</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Select the services you'd like to run in your target area. We'll handle everything — you just wait for responses.
                </p>
              </div>

              {SERVICES.map(service => {
                const sel = selectedServices[service.id];
                const isEnabled = sel?.enabled;
                const Icon = service.icon;

                return (
                  <Card
                    key={service.id}
                    className={`transition-all cursor-pointer ${isEnabled ? "ring-2 ring-primary border-primary" : "hover:border-primary/50"}`}
                    onClick={() => toggleService(service.id)}
                    data-testid={`card-service-${service.id}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${isEnabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{service.title}</h3>
                            <Badge variant="secondary" className="text-[10px]">
                              {service.provider}
                            </Badge>
                            {isEnabled && (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px]">
                                Selected
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">{service.description}</p>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="font-medium">${service.pricePerUnit.toFixed(2)} {service.unitLabel}</span>
                            <span className="text-muted-foreground">Min: {service.minQty} · Max: {service.maxQty.toLocaleString()}</span>
                          </div>

                          {isEnabled && (
                            <div className="mt-4 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                              <Label className="text-sm whitespace-nowrap">Quantity:</Label>
                              <Input
                                type="number"
                                value={sel.qty}
                                min={service.minQty}
                                max={service.maxQty}
                                onChange={(e) => updateServiceQty(service.id, parseInt(e.target.value) || service.minQty)}
                                className="w-28 h-9"
                                data-testid={`input-qty-${service.id}`}
                              />
                              <span className="text-sm font-semibold text-primary">
                                = ${(service.pricePerUnit * sel.qty).toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          <Checkbox
                            checked={isEnabled}
                            onCheckedChange={() => toggleService(service.id)}
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`checkbox-service-${service.id}`}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div>
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Order Summary
                  </CardTitle>
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

                  <div className="pt-3 border-t space-y-2">
                    <p className="font-medium text-muted-foreground">Selected Services</p>
                    {SERVICES.filter(s => selectedServices[s.id]?.enabled).map(s => (
                      <div key={s.id} className="flex justify-between items-center">
                        <span>{s.title}</span>
                        <span className="font-medium">${(s.pricePerUnit * selectedServices[s.id].qty).toFixed(2)}</span>
                      </div>
                    ))}
                    {getSelectedCount() === 0 && (
                      <p className="text-muted-foreground italic">No services selected</p>
                    )}
                  </div>

                  <div className="pt-3 border-t">
                    <div className="flex justify-between items-center text-base font-semibold">
                      <span>Total</span>
                      <span className="text-primary">${getTotal().toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="pt-2 space-y-3">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setStep("details")}
                      data-testid="button-back-to-details"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Details
                    </Button>
                    <Button
                      className="w-full"
                      onClick={handleCheckout}
                      disabled={getSelectedCount() === 0}
                      data-testid="button-checkout"
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Proceed to Checkout — ${getTotal().toFixed(2)}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
