import { Button } from "@/components/ui/button";
import { 
  Home, 
  Hammer, 
  RefreshCw, 
  Calendar, 
  Map, 
  Building2,
  LucideIcon
} from "lucide-react";

interface Strategy {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

const canadaStrategies: Strategy[] = [
  { id: "buy_hold", label: "Buy & Hold", icon: Home, description: "Long-term rental investment" },
  { id: "flip", label: "Flip", icon: Hammer, description: "Quick renovation and sale" },
  { id: "brrr", label: "BRRR", icon: RefreshCw, description: "Buy, Rehab, Rent, Refinance, Repeat" },
  { id: "airbnb", label: "Airbnb", icon: Calendar, description: "Short-term rentals" },
  { id: "land_assembly", label: "Land Assembly", icon: Map, description: "Development plays" },
  { id: "multiplex", label: "Multiplex", icon: Building2, description: "Multi-unit residential" },
];

const usaStrategies: Strategy[] = [
  { id: "buy_hold", label: "Buy & Hold", icon: Home, description: "Long-term rental investment" },
  { id: "flip", label: "Flip", icon: Hammer, description: "Quick renovation and sale" },
  { id: "brrr", label: "BRRR", icon: RefreshCw, description: "Buy, Rehab, Rent, Refinance, Repeat" },
  { id: "airbnb", label: "Short-Term Rental", icon: Calendar, description: "Vacation rentals" },
];

interface StrategySelectorProps {
  country: "canada" | "usa";
  selectedStrategy: string;
  onStrategyChange: (strategy: string) => void;
}

export function StrategySelector({ 
  country, 
  selectedStrategy, 
  onStrategyChange 
}: StrategySelectorProps) {
  const strategies = country === "canada" ? canadaStrategies : usaStrategies;

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Investment Strategy</label>
      <div className="flex flex-wrap gap-2">
        {strategies.map((strategy) => {
          const Icon = strategy.icon;
          const isSelected = selectedStrategy === strategy.id;
          
          return (
            <Button
              key={strategy.id}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => onStrategyChange(strategy.id)}
              data-testid={`button-strategy-${strategy.id}`}
            >
              <Icon className="h-4 w-4" />
              {strategy.label}
            </Button>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">
        {strategies.find(s => s.id === selectedStrategy)?.description}
      </p>
    </div>
  );
}
