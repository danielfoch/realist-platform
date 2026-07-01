import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface RentEstimate {
  monthlyRent: number;
  rangeLow: number;
  rangeHigh: number;
  method: string;
  confidence: "high" | "medium" | "low";
  compCount: number;
  radiusKm: number | null;
  bedroomBand: string;
  units: number;
}

interface RentEstimateHintProps {
  city?: string;
  region?: string;
  country: string;
  units?: number;
  currentRent: number;
  onApply: (rent: number) => void;
}

const BEDROOM_OPTIONS = ["1", "2", "3", "4+"] as const;

function methodLabel(estimate: RentEstimate): string {
  switch (estimate.method) {
    case "comps_radius":
      return `${estimate.compCount} comps within ${estimate.radiusKm} km`;
    case "city_comps":
      return `${estimate.compCount} comps in this city`;
    case "city_aggregate":
      return `city median, ${estimate.compCount} rentals sampled`;
    case "cmhc_baseline":
      return "CMHC average for this market";
    default:
      return estimate.method;
  }
}

const CONFIDENCE_STYLES: Record<RentEstimate["confidence"], string> = {
  high: "text-green-600 dark:text-green-400",
  medium: "text-amber-600 dark:text-amber-400",
  low: "text-muted-foreground",
};

/**
 * Realist's data-backed rent estimate, shown under the Monthly Rent input.
 * Canada-only for now — the comp and aggregate data sources are Canadian.
 */
export function RentEstimateHint({ city, region, country, units = 1, currentRent, onApply }: RentEstimateHintProps) {
  const [bedrooms, setBedrooms] = useState<string>("3");

  const enabled = country === "canada" && !!city;
  const params = new URLSearchParams({ bedrooms, units: String(units) });
  if (city) params.set("city", city);
  if (region) params.set("province", region);

  const { data } = useQuery<{ success: boolean; estimate: RentEstimate | null }>({
    queryKey: [`/api/intelligence/rent-estimate?${params.toString()}`],
    enabled,
  });

  const estimate = data?.estimate;
  if (!enabled || !estimate) return null;

  const alreadyApplied = currentRent === estimate.monthlyRent;

  return (
    <div className="p-3 bg-muted/50 rounded-lg space-y-2" data-testid="rent-estimate-hint">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Realist rent estimate
        </span>
        <div className="flex gap-1">
          {BEDROOM_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setBedrooms(option)}
              className={`px-2 py-0.5 text-xs rounded border ${
                bedrooms === option
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover-elevate"
              }`}
              data-testid={`rent-estimate-beds-${option}`}
            >
              {option} bd
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-mono font-semibold">${estimate.monthlyRent.toLocaleString()}/mo</span>
          <span className="text-muted-foreground">
            {" "}· ${estimate.rangeLow.toLocaleString()}–${estimate.rangeHigh.toLocaleString()}
          </span>
          {units > 1 && <span className="text-muted-foreground"> · {units} units</span>}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={alreadyApplied}
          onClick={() => onApply(estimate.monthlyRent)}
          data-testid="button-apply-rent-estimate"
        >
          {alreadyApplied ? "Applied" : "Use estimate"}
        </Button>
      </div>
      <p className={`text-xs ${CONFIDENCE_STYLES[estimate.confidence]}`}>
        {estimate.confidence} confidence · {methodLabel(estimate)}
      </p>
    </div>
  );
}
