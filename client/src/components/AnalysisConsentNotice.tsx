import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export interface AnalysisConsentState {
  useForProductImprovement: boolean;
  useForAiTraining: boolean;
  useForAnonymizedMarketDataset: boolean;
  allowCommercialDataLicensing: boolean;
}

interface Props {
  value: AnalysisConsentState;
  onChange: (next: AnalysisConsentState) => void;
}

export function AnalysisConsentNotice({ value, onChange }: Props) {
  const items: Array<{ key: keyof AnalysisConsentState; label: string }> = [
    { key: "useForProductImprovement", label: "Use this analysis for product improvement" },
    { key: "useForAiTraining", label: "Allow this analysis to be used for future AI training" },
    { key: "useForAnonymizedMarketDataset", label: "Allow inclusion in anonymized market datasets" },
    { key: "allowCommercialDataLicensing", label: "Allow inclusion in future commercial data products" },
  ];

  return (
    <div className="rounded-lg border border-border/60 p-3 space-y-3">
      <div>
        <p className="text-sm font-medium">Data-use permissions</p>
        <p className="text-xs text-muted-foreground mt-1">
          Public visibility is not the same as consent for training or licensing.
        </p>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <label key={item.key} className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={value[item.key]}
              onCheckedChange={(checked) => onChange({ ...value, [item.key]: checked === true })}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
