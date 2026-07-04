import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Plain-language explainer for the leaderboard's quality-weighted scoring.
 * Mirrors the actual eligibility rules in server/marketIntelligence.ts
 * (getLiveLeaderboardEntries) — update both together.
 */
export function HowScoringWorks({ className }: { className?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={`gap-1.5 text-muted-foreground ${className || ""}`} data-testid="button-how-scoring-works">
          <HelpCircle className="h-3.5 w-3.5" />
          How scoring works
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 text-sm" align="start" data-testid="popover-how-scoring-works">
        <div className="space-y-3">
          <p className="font-semibold">How scoring works</p>
          <p className="text-muted-foreground">
            Rankings reward careful underwriting, not volume. Every analysis gets a
            confidence score based on how complete and realistic it is.
          </p>
          <ul className="list-disc space-y-1.5 pl-4 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Eligible analyses</span> need a
              confidence score of at least 0.65, results inside sanity bounds (cap rate,
              cash-on-cash, DSCR), and results in line with the market. Quick click-through
              analyses are excluded.
            </li>
            <li>
              <span className="font-medium text-foreground">Score</span> is the sum of
              confidence scores across your eligible analyses. Ten careful analyses beat
              thirty rushed ones.
            </li>
            <li>
              <span className="font-medium text-foreground">Oracle</span> tracks how close
              your sale-price predictions land to actual sold prices. It needs at least 5
              eligible predictions before it counts toward rank.
            </li>
            <li>
              <span className="font-medium text-foreground">Provisional</span> means fewer
              than 3 eligible analyses so far — the rank firms up as you add more.
            </li>
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
