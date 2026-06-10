import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Layers, X, Info, TrendingUp, Home, DollarSign,
  Building2, Train, FileText, BarChart3, Shield,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface MapLayer {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  enabled: boolean;
  opacity: number;
  category: "financial" | "demographic" | "infrastructure" | "composite";
  badge?: string;
}

const DEFAULT_LAYERS: MapLayer[] = [
  {
    id: "investor_score",
    name: "Investor Score",
    description: "Composite score (0-100) combining vacancy, income, rent growth, and price trends. Higher = better investment potential.",
    icon: <TrendingUp className="h-4 w-4" />,
    color: "#f59e0b",
    enabled: false,
    opacity: 0.6,
    category: "composite",
    badge: "New",
  },
  {
    id: "rent_levels",
    name: "Rent Levels",
    description: "Average monthly rent by area based on CMHC Rental Market Survey data.",
    icon: <DollarSign className="h-4 w-4" />,
    color: "#10b981",
    enabled: false,
    opacity: 0.5,
    category: "financial",
  },
  {
    id: "vacancy_rate",
    name: "Vacancy Rate",
    description: "Rental vacancy rates from CMHC. Lower vacancy = stronger rental demand.",
    icon: <Building2 className="h-4 w-4" />,
    color: "#ef4444",
    enabled: false,
    opacity: 0.5,
    category: "financial",
  },
  {
    id: "income",
    name: "Household Income",
    description: "Median household income by area from StatCan Census data.",
    icon: <BarChart3 className="h-4 w-4" />,
    color: "#3b82f6",
    enabled: false,
    opacity: 0.5,
    category: "demographic",
  },
  {
    id: "homeownership",
    name: "Homeownership Rate",
    description: "Percentage of owner-occupied dwellings from StatCan Census.",
    icon: <Home className="h-4 w-4" />,
    color: "#8b5cf6",
    enabled: false,
    opacity: 0.5,
    category: "demographic",
  },
  {
    id: "crime",
    name: "Crime Index",
    description: "Crime severity index from local police open data and StatCan.",
    icon: <Shield className="h-4 w-4" />,
    color: "#dc2626",
    enabled: false,
    opacity: 0.5,
    category: "demographic",
  },
  {
    id: "transit",
    name: "Transit",
    description: "Transit routes and stops from GTFS feeds. Proximity to transit affects property values.",
    icon: <Train className="h-4 w-4" />,
    color: "#06b6d4",
    enabled: false,
    opacity: 0.6,
    category: "infrastructure",
  },
  {
    id: "permits",
    name: "Development Permits",
    description: "Active development and building permits from municipal open data.",
    icon: <FileText className="h-4 w-4" />,
    color: "#f97316",
    enabled: false,
    opacity: 0.6,
    category: "infrastructure",
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  composite: "Composite",
  financial: "Financial",
  demographic: "Demographic",
  infrastructure: "Infrastructure",
};

interface LegendItem {
  label: string;
  color: string;
  min?: string;
  max?: string;
}

function getLayerLegend(layerId: string): LegendItem[] {
  switch (layerId) {
    case "investor_score":
      return [
        { label: "Low (0-30)", color: "#ef4444" },
        { label: "Medium (30-60)", color: "#f59e0b" },
        { label: "High (60-80)", color: "#22c55e" },
        { label: "Excellent (80+)", color: "#059669" },
      ];
    case "rent_levels":
      return [
        { label: "< $1,200/mo", color: "#dcfce7" },
        { label: "$1,200 - $1,800", color: "#86efac" },
        { label: "$1,800 - $2,500", color: "#22c55e" },
        { label: "> $2,500/mo", color: "#15803d" },
      ];
    case "vacancy_rate":
      return [
        { label: "< 1% (Tight)", color: "#dc2626" },
        { label: "1-3%", color: "#f59e0b" },
        { label: "3-5%", color: "#22c55e" },
        { label: "> 5% (Loose)", color: "#86efac" },
      ];
    case "income":
      return [
        { label: "< $50K", color: "#dbeafe" },
        { label: "$50K - $80K", color: "#93c5fd" },
        { label: "$80K - $120K", color: "#3b82f6" },
        { label: "> $120K", color: "#1d4ed8" },
      ];
    case "homeownership":
      return [
        { label: "< 40%", color: "#f3e8ff" },
        { label: "40-60%", color: "#c084fc" },
        { label: "60-80%", color: "#8b5cf6" },
        { label: "> 80%", color: "#6d28d9" },
      ];
    case "crime":
      return [
        { label: "Low", color: "#dcfce7" },
        { label: "Medium", color: "#fef08a" },
        { label: "High", color: "#fca5a5" },
        { label: "Very High", color: "#dc2626" },
      ];
    default:
      return [];
  }
}

interface MapLayersPanelProps {
  layers: MapLayer[];
  onLayersChange: (layers: MapLayer[]) => void;
}

export function MapLayersPanel({ layers, onLayersChange }: MapLayersPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const activeLayers = layers.filter((l) => l.enabled);

  const toggleLayer = (layerId: string) => {
    onLayersChange(
      layers.map((l) =>
        l.id === layerId ? { ...l, enabled: !l.enabled } : l
      )
    );
  };

  const setOpacity = (layerId: string, opacity: number) => {
    onLayersChange(
      layers.map((l) =>
        l.id === layerId ? { ...l, opacity } : l
      )
    );
  };

  const groupedLayers = Object.entries(
    layers.reduce((acc, layer) => {
      if (!acc[layer.category]) acc[layer.category] = [];
      acc[layer.category].push(layer);
      return acc;
    }, {} as Record<string, MapLayer[]>)
  );

  return (
    <TooltipProvider>
      <div className="absolute top-3 right-3 z-[1000]" data-testid="map-layers-panel">
        <Button
          size="sm"
          variant={activeLayers.length > 0 ? "default" : "secondary"}
          className="shadow-lg gap-1.5 rounded-lg"
          onClick={() => setIsOpen(!isOpen)}
          data-testid="button-toggle-layers"
        >
          <Layers className="h-4 w-4" />
          Layers
          {activeLayers.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
              {activeLayers.length}
            </Badge>
          )}
        </Button>

        {isOpen && (
          <Card className="absolute top-10 right-0 w-[320px] max-h-[70vh] overflow-y-auto shadow-2xl border" data-testid="panel-layers">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Map Layers</CardTitle>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsOpen(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Toggle data overlays on the map</p>
            </CardHeader>

            <CardContent className="px-4 pb-4 space-y-4">
              {groupedLayers.map(([category, categoryLayers]) => (
                <div key={category}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    {CATEGORY_LABELS[category] || category}
                  </p>
                  <div className="space-y-2">
                    {categoryLayers.map((layer) => (
                      <div
                        key={layer.id}
                        className={`rounded-lg border p-2.5 transition-colors ${
                          layer.enabled ? "border-primary/30 bg-primary/5" : "border-border/50"
                        }`}
                        data-testid={`layer-${layer.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded flex items-center justify-center"
                              style={{ backgroundColor: layer.color + "20", color: layer.color }}
                            >
                              {layer.icon}
                            </div>
                            <span className="text-xs font-medium">{layer.name}</span>
                            {layer.badge && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                                {layer.badge}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button className="text-muted-foreground hover:text-foreground">
                                  <Info className="h-3 w-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-[200px] text-xs">
                                {layer.description}
                              </TooltipContent>
                            </Tooltip>
                            <Switch
                              checked={layer.enabled}
                              onCheckedChange={() => toggleLayer(layer.id)}
                              className="scale-75"
                              data-testid={`switch-${layer.id}`}
                            />
                          </div>
                        </div>
                        {layer.enabled && (
                          <div className="mt-2 px-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-muted-foreground">Opacity</span>
                              <span className="text-[10px] text-muted-foreground">
                                {Math.round(layer.opacity * 100)}%
                              </span>
                            </div>
                            <Slider
                              value={[layer.opacity]}
                              onValueChange={([val]) => setOpacity(layer.id, val)}
                              min={0.1}
                              max={1}
                              step={0.05}
                              className="w-full"
                              data-testid={`slider-${layer.id}`}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {activeLayers.length > 0 && !isOpen && (
          <div className="absolute top-10 right-0 mt-1" data-testid="map-legend">
            <Card className="w-[200px] shadow-lg border">
              <CardContent className="p-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Legend</p>
                {activeLayers.map((layer) => {
                  const legend = getLayerLegend(layer.id);
                  if (legend.length === 0) return (
                    <div key={layer.id} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: layer.color }} />
                      <span className="text-[10px]">{layer.name}</span>
                    </div>
                  );
                  return (
                    <div key={layer.id}>
                      <p className="text-[10px] font-medium mb-1">{layer.name}</p>
                      {legend.map((item) => (
                        <div key={item.label} className="flex items-center gap-1.5 ml-1">
                          <div
                            className="w-2.5 h-2.5 rounded-sm"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-[9px] text-muted-foreground">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export { DEFAULT_LAYERS };
