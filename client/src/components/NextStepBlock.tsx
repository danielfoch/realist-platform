/**
 * NextStepBlock — the one funnel component every tool result ends in.
 *
 * Three actions, one priority order:
 *   1. Book a call (financing or strategy — the revenue moment)
 *   2. Check financing readiness (the mortgage on-ramp)
 *   3. Bring the deal to Monday's Live Deal Room (one-to-many)
 *
 * Keep this the ONLY "what's next" pattern on tool surfaces so users build
 * muscle memory. Placement: directly under the primary result, full width.
 */
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { track } from "@/lib/analytics";
import { PhoneCall, Gauge, Radio } from "lucide-react";

export interface NextStepBlockProps {
  /** Page the block sits on — defaults to current pathname. */
  sourcePage?: string;
  /** Optional heading override. */
  title?: string;
  /** Hide the readiness link when the block sits ON the readiness page. */
  hideReadiness?: boolean;
  className?: string;
}

export function NextStepBlock({ sourcePage, title, hideReadiness, className }: NextStepBlockProps) {
  const emit = (cta: string, destination: string) =>
    track({ event: "cta_clicked", cta, location: sourcePage ?? "next_step_block", destination });

  return (
    <Card className={`border-primary/30 bg-primary/5 ${className ?? ""}`} data-testid="next-step-block">
      <CardContent className="py-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="md:flex-1">
            <p className="font-semibold">{title ?? "Want help taking this further?"}</p>
            <p className="text-sm text-muted-foreground">
              Talk it through with Dan, Nick, or a financing specialist — free, no obligation.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <Button asChild onClick={() => emit("book_call", "/book-a-call")} data-testid="button-next-step-call">
              <Link href="/book-a-call">
                <PhoneCall className="h-4 w-4 mr-2" /> Book a call
              </Link>
            </Button>
            {!hideReadiness && (
              <Button
                asChild
                variant="outline"
                onClick={() => emit("financing_readiness", "/tools/financing-readiness")}
                data-testid="button-next-step-readiness"
              >
                <Link href="/tools/financing-readiness">
                  <Gauge className="h-4 w-4 mr-2" /> What can I finance?
                </Link>
              </Button>
            )}
            <Button
              asChild
              variant="outline"
              onClick={() => emit("deal_room", "/deal-room")}
              data-testid="button-next-step-deal-room"
            >
              <Link href="/deal-room">
                <Radio className="h-4 w-4 mr-2" /> Live Deal Room
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
