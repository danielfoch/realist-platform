import type { ListingAnalysisAggregate } from "@shared/schema";

interface Props {
  aggregate?: ListingAnalysisAggregate | null;
}

function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "N/A";
  return `$${Math.round(value).toLocaleString()}`;
}

export function CommunityMetricsSummary({ aggregate }: Props) {
  if (!aggregate || !(aggregate.publicAnalysisCount || 0)) return null;

  const items = [
    { label: "Analyzed", value: `${aggregate.publicAnalysisCount || 0} times` },
    { label: "By users", value: `${aggregate.uniquePublicUserCount || 0}` },
    { label: "Consensus", value: aggregate.consensusLabel ? `${aggregate.consensusLabel[0].toUpperCase()}${aggregate.consensusLabel.slice(1)}` : "N/A" },
    { label: "Median cap rate", value: aggregate.medianCapRate != null ? `${aggregate.medianCapRate.toFixed(1)}%` : "N/A" },
    { label: "Median cash flow", value: formatMoney(aggregate.medianMonthlyCashFlow) },
    { label: "Median rent", value: formatMoney(aggregate.medianProjectedRent) },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-md border border-border/60 bg-muted/20 p-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
          <p className="text-sm font-semibold mt-1">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
