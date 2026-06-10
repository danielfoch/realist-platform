import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Crown, Lock } from "lucide-react";

interface PremiumGateOverlayProps {
  isGated: boolean;
  featureName: string;
  children: React.ReactNode;
  onUpgradeClick?: () => void;
}

export function PremiumGateOverlay({ isGated, featureName, children, onUpgradeClick }: PremiumGateOverlayProps) {
  if (!isGated) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="blur-[6px] pointer-events-none select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-lg">
        <div className="text-center space-y-3 p-6">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 mx-auto">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-medium">{featureName}</p>
          <p className="text-xs text-muted-foreground max-w-[200px]">
            Upgrade to Premium to unlock this feature
          </p>
          <Link href="/premium">
            <Button
              size="sm"
              onClick={onUpgradeClick}
              data-testid={`button-unlock-${featureName.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <Crown className="h-3 w-3 mr-1" />
              Unlock
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
