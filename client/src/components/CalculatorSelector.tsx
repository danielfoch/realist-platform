import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, Home, TrendingUp } from "lucide-react";

export type CalculatorType = "deal_analyzer" | "rent_vs_buy" | "real_estate_vs_stocks";

interface CalculatorSelectorProps {
  selected: CalculatorType;
  onSelect: (calculator: CalculatorType) => void;
}

const calculators = [
  { 
    id: "deal_analyzer" as CalculatorType, 
    label: "Deal Analyzer", 
    icon: Calculator, 
    description: "Analyze investment properties",
    comingSoon: false 
  },
  { 
    id: "rent_vs_buy" as CalculatorType, 
    label: "Rent vs Buy", 
    icon: Home, 
    description: "Should you rent or buy?",
    comingSoon: false 
  },
  { 
    id: "real_estate_vs_stocks" as CalculatorType, 
    label: "Real Estate vs Stocks", 
    icon: TrendingUp, 
    description: "Compare investment returns",
    comingSoon: true 
  },
];

export function CalculatorSelector({ selected, onSelect }: CalculatorSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Select a Calculator</label>
      <div className="flex flex-wrap gap-2">
        {calculators.map((calc) => {
          const Icon = calc.icon;
          const isSelected = selected === calc.id;
          
          return (
            <Button
              key={calc.id}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => !calc.comingSoon && onSelect(calc.id)}
              disabled={calc.comingSoon}
              data-testid={`button-calculator-${calc.id}`}
            >
              <Icon className="h-4 w-4" />
              {calc.label}
              {calc.comingSoon && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  Soon
                </Badge>
              )}
            </Button>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">
        {calculators.find(c => c.id === selected)?.description}
      </p>
    </div>
  );
}
