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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { MapPin, PenTool, Trash2, ArrowRight, Home, DollarSign, Calendar, FileText, AlertCircle } from "lucide-react";
import { buyBoxBuildingTypes, buyBoxOccupancyTypes, type BuyBoxMandateFormData } from "@shared/schema";

declare global {
  interface Window {
    google: typeof google;
    initBuyBoxMap: () => void;
  }
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

export default function BuyBox() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hasPolygon, setHasPolygon] = useState(false);
  const [step, setStep] = useState<"draw" | "details" | "agreement">("draw");

  // Clear any stale sessionStorage data when starting fresh (draw step)
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
      
      updatePolygonData(polygon);

      google.maps.event.addListener(polygon.getPath(), "set_at", () => updatePolygonData(polygon));
      google.maps.event.addListener(polygon.getPath(), "insert_at", () => updatePolygonData(polygon));
    });

    setMapLoaded(true);
  }, []);

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
    setHasPolygon(false);
    setPolygonGeoJson(null);
    setCentroid(null);
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    }
  };

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
    // Store data in sessionStorage to avoid URL length limits
    sessionStorage.setItem("buybox_polygon", JSON.stringify(polygonGeoJson));
    sessionStorage.setItem("buybox_centroid", JSON.stringify(centroid));
    sessionStorage.setItem("buybox_mandate", JSON.stringify(mandateData));
    setStep("agreement");
    setLocation("/buybox/agreement");
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
            Define your target investment area and property criteria. Our network of realtors will help you find matching opportunities.
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
                  <div
                    ref={mapRef}
                    className="w-full h-[500px] rounded-lg border"
                    data-testid="map-container"
                  />
                  
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      onClick={clearPolygon}
                      disabled={!hasPolygon}
                      data-testid="button-clear-polygon"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear & Redraw
                    </Button>
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
                    <p>Click on the map to start drawing your target area</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">2</div>
                    <p>Continue clicking to add points and form a polygon</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">3</div>
                    <p>Click on the first point to close the polygon</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">4</div>
                    <p>Drag points to adjust, or clear and redraw</p>
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
