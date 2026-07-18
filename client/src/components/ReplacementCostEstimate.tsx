import { memo } from "react";
import { Info } from "lucide-react";
import {
  REPLACEMENT_COST_AS_OF_YEAR,
  REPLACEMENT_COST_ECONOMIC_LIFE_YEARS,
  REPLACEMENT_COST_MAX_DEPRECIATION,
  estimateReplacementCost,
} from "@shared/replacementCost";

interface ReplacementCostEstimateProps {
  squareFootage?: string | number | null;
  yearBuilt?: string | number | null;
  propertyType?: string | null;
  listingKey: string;
  className?: string;
}

const compactCurrency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  notation: "compact",
  maximumFractionDigits: 0,
});

const fullCurrency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

function formatCompactCurrency(value: number | null): string {
  return value == null ? "N/A" : compactCurrency.format(value);
}

function formatRange(low: number | null, high: number | null): string {
  if (low == null || high == null) return "unavailable";
  return `${fullCurrency.format(low)}–${fullCurrency.format(high)}`;
}

export const ReplacementCostEstimate = memo(function ReplacementCostEstimate({
  squareFootage,
  yearBuilt,
  propertyType,
  listingKey,
  className = "",
}: ReplacementCostEstimateProps) {
  const estimate = estimateReplacementCost({ squareFootage, yearBuilt, propertyType });

  if (estimate.replacementCost == null) {
    return (
      <div
        className={`mt-1.5 rounded-md border border-border/60 bg-muted/25 px-2 py-1.5 ${className}`}
        data-testid={`replacement-cost-${listingKey}`}
      >
        <div className="flex items-center justify-between gap-2 text-[10px]">
          <span className="font-medium text-muted-foreground">Replacement cost</span>
          <span className="font-semibold text-muted-foreground">Needs sqft</span>
        </div>
      </div>
    );
  }

  const depreciationPercent = estimate.depreciationRate == null
    ? null
    : Math.round(estimate.depreciationRate * 100);
  const methodology = [
    `${estimate.squareFootage?.toLocaleString("en-CA")} sqft`,
    `${estimate.propertyClassLabel} cost range ${fullCurrency.format(estimate.costPerSqftLow)}–${fullCurrency.format(estimate.costPerSqftHigh)}/sqft`,
    `replacement range ${formatRange(estimate.replacementCostLow, estimate.replacementCostHigh)}`,
    estimate.yearBuilt == null
      ? "year built unavailable"
      : `built ${estimate.yearBuilt}; ${estimate.buildingAge}-year actual age; ${depreciationPercent}% straight-line age depreciation`,
    `cost basis ${REPLACEMENT_COST_AS_OF_YEAR}; ${REPLACEMENT_COST_ECONOMIC_LIFE_YEARS}-year economic life; maximum ${REPLACEMENT_COST_MAX_DEPRECIATION * 100}% depreciation`,
    "structure-only screening estimate; excludes land, demolition, site work, soft costs, taxes, condition, and renovations",
  ].join(". ");

  return (
    <div
      className={`mt-1.5 rounded-md border border-border/60 bg-muted/25 px-2 py-1.5 ${className}`}
      data-testid={`replacement-cost-${listingKey}`}
      title={methodology}
      aria-label={methodology}
    >
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
            Est. rebuild
            <Info className="h-2.5 w-2.5" aria-hidden="true" />
          </div>
          <div className="text-[11px] font-semibold" data-testid={`replacement-cost-new-${listingKey}`}>
            ~{formatCompactCurrency(estimate.replacementCost)}
          </div>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground">Age-depreciated</div>
          <div className="text-[11px] font-semibold" data-testid={`replacement-cost-depreciated-${listingKey}`}>
            {estimate.depreciatedReplacementCost == null
              ? "Needs year built"
              : `~${formatCompactCurrency(estimate.depreciatedReplacementCost)}`}
          </div>
        </div>
      </div>
      <p className="mt-0.5 truncate text-[9px] text-muted-foreground">
        {estimate.squareFootage?.toLocaleString("en-CA")} sqft × ~{fullCurrency.format(estimate.costPerSqft)}/sqft
        {estimate.yearBuilt != null ? ` · Built ${estimate.yearBuilt} · ${depreciationPercent}% age dep.` : " · Structure only"}
      </p>
    </div>
  );
});
