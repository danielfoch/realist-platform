import { useQuery } from "@tanstack/react-query";
import { CircleMarker, Popup } from "react-leaflet";
import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import type { MapLayer } from "./MapLayersPanel";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface GeoMapData {
  id: string;
  name: string;
  province: string;
  centroid_lat: number;
  centroid_lng: number;
  rent: string | null;
  vacancy_rate: string | null;
  income: string | null;
  homeownership_rate: string | null;
  investor_score: string | null;
}

interface TrendData {
  geography: { id: string; name: string; province: string };
  metrics: Array<{ metricType: string; value: string; date: string }>;
  scores: Array<{ investorScore: number; date: string }>;
}

const LAYER_METRIC_MAP: Record<string, string> = {
  investor_score: "investor_score",
  rent_levels: "rent",
  vacancy_rate: "vacancy_rate",
  income: "income",
  homeownership: "homeownership_rate",
};

function getColorForValue(layerId: string, value: number): string {
  switch (layerId) {
    case "investor_score":
      if (value >= 80) return "#059669";
      if (value >= 60) return "#22c55e";
      if (value >= 30) return "#f59e0b";
      return "#ef4444";
    case "rent_levels":
      if (value >= 2500) return "#15803d";
      if (value >= 1800) return "#22c55e";
      if (value >= 1200) return "#86efac";
      return "#dcfce7";
    case "vacancy_rate":
      if (value < 1) return "#dc2626";
      if (value < 3) return "#f59e0b";
      if (value < 5) return "#22c55e";
      return "#86efac";
    case "income":
      if (value >= 120000) return "#1d4ed8";
      if (value >= 80000) return "#3b82f6";
      if (value >= 50000) return "#93c5fd";
      return "#dbeafe";
    case "homeownership":
      if (value >= 80) return "#6d28d9";
      if (value >= 60) return "#8b5cf6";
      if (value >= 40) return "#c084fc";
      return "#f3e8ff";
    default:
      return "#6b7280";
  }
}

function formatMetricValue(layerId: string, value: number): string {
  switch (layerId) {
    case "rent_levels":
      return `$${Math.round(value).toLocaleString()}/mo`;
    case "vacancy_rate":
      return `${value.toFixed(1)}%`;
    case "income":
      return `$${Math.round(value).toLocaleString()}`;
    case "homeownership":
      return `${value.toFixed(1)}%`;
    case "investor_score":
      return `${Math.round(value)}/100`;
    default:
      return String(value);
  }
}

function getMetricLabel(layerId: string): string {
  switch (layerId) {
    case "rent_levels": return "Avg Rent";
    case "vacancy_rate": return "Vacancy";
    case "income": return "Income";
    case "homeownership": return "Ownership";
    case "investor_score": return "Score";
    default: return layerId;
  }
}

function MiniTrendPopup({ geoId, geoName, province }: { geoId: string; geoName: string; province: string }) {
  const { data, isLoading } = useQuery<TrendData>({
    queryKey: ["/api/geographies", geoId, "trends"],
    queryFn: async () => {
      const res = await fetch(`/api/geographies/${geoId}/trends`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const chartData = useMemo(() => {
    if (!data?.metrics) return [];
    const byDate: Record<string, Record<string, number>> = {};
    for (const m of data.metrics) {
      if (!byDate[m.date]) byDate[m.date] = {};
      byDate[m.date][m.metricType] = parseFloat(m.value);
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }));
  }, [data]);

  const rentTrend = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = (chartData[0] as any)?.rent;
    const last = (chartData[chartData.length - 1] as any)?.rent;
    if (!first || !last) return null;
    const pct = ((last - first) / first) * 100;
    return pct;
  }, [chartData]);

  if (isLoading) {
    return (
      <div className="min-w-[220px] p-2">
        <p className="text-sm font-semibold">{geoName}, {province}</p>
        <div className="h-20 flex items-center justify-center">
          <div className="animate-pulse text-xs text-muted-foreground">Loading trends...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-[260px]" data-testid={`popup-trend-${geoId}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold">{geoName}, {province}</p>
        {rentTrend !== null && (
          <Badge variant={rentTrend > 0 ? "default" : "secondary"} className="text-[10px] gap-0.5 px-1.5">
            {rentTrend > 0 ? <TrendingUp className="h-3 w-3" /> : rentTrend < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {rentTrend > 0 ? "+" : ""}{rentTrend.toFixed(1)}%
          </Badge>
        )}
      </div>

      {chartData.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2">
            {(chartData[chartData.length - 1] as any)?.rent && (
              <div>
                <p className="text-[9px] text-muted-foreground">Rent</p>
                <p className="text-xs font-semibold">${Math.round((chartData[chartData.length - 1] as any).rent).toLocaleString()}/mo</p>
              </div>
            )}
            {(chartData[chartData.length - 1] as any)?.vacancy_rate != null && (
              <div>
                <p className="text-[9px] text-muted-foreground">Vacancy</p>
                <p className="text-xs font-semibold">{(chartData[chartData.length - 1] as any).vacancy_rate.toFixed(1)}%</p>
              </div>
            )}
            {(chartData[chartData.length - 1] as any)?.income && (
              <div>
                <p className="text-[9px] text-muted-foreground">Income</p>
                <p className="text-xs font-semibold">${Math.round((chartData[chartData.length - 1] as any).income).toLocaleString()}</p>
              </div>
            )}
            {(chartData[chartData.length - 1] as any)?.homeownership_rate != null && (
              <div>
                <p className="text-[9px] text-muted-foreground">Ownership</p>
                <p className="text-xs font-semibold">{(chartData[chartData.length - 1] as any).homeownership_rate.toFixed(1)}%</p>
              </div>
            )}
          </div>

          <div className="h-[80px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`rentGrad-${geoId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} />
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <RechartsTooltip
                  contentStyle={{ fontSize: 10, padding: "4px 8px" }}
                  formatter={(v: number) => [`$${Math.round(v).toLocaleString()}`, "Rent"]}
                />
                <Area type="monotone" dataKey="rent" stroke="#10b981" fill={`url(#rentGrad-${geoId})`} strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[9px] text-center text-muted-foreground mt-1">Rent trend over time</p>
        </>
      )}
    </div>
  );
}

interface NeighbourhoodOverlayProps {
  layers: MapLayer[];
}

export function NeighbourhoodOverlay({ layers }: NeighbourhoodOverlayProps) {
  const activeLayers = layers.filter(
    (l) => l.enabled && LAYER_METRIC_MAP[l.id]
  );

  const { data: geoData } = useQuery<GeoMapData[]>({
    queryKey: ["/api/geographies/map-data"],
    enabled: activeLayers.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  if (activeLayers.length === 0 || !geoData) return null;

  const primaryLayer = activeLayers[0];
  const metricKey = LAYER_METRIC_MAP[primaryLayer.id];

  return (
    <>
      {geoData.map((geo) => {
        const rawValue = (geo as any)[metricKey];
        if (rawValue == null || geo.centroid_lat == null) return null;
        const value = parseFloat(rawValue);
        if (isNaN(value)) return null;

        const color = getColorForValue(primaryLayer.id, value);
        const label = formatMetricValue(primaryLayer.id, value);

        return (
          <CircleMarker
            key={geo.id}
            center={[geo.centroid_lat, geo.centroid_lng]}
            radius={14}
            pathOptions={{
              fillColor: color,
              fillOpacity: primaryLayer.opacity * 0.7,
              color: color,
              weight: 2,
              opacity: primaryLayer.opacity,
            }}
            data-testid={`overlay-marker-${geo.id}`}
          >
            <Popup maxWidth={300} minWidth={260}>
              <MiniTrendPopup geoId={geo.id} geoName={geo.name} province={geo.province} />
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
