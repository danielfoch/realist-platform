import { Link } from "wouter";
import { ArrowRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

/**
 * Points the secondary multiplex tools at the flagship underwriter.
 *
 * Realist ships three tools that all answer some version of "can I plex this
 * lot": the Underwriter (live Toronto zoning, buildable envelope, pro formas,
 * MLI-vs-condo exit), the Feasibility screener (client-side rules), and Will It
 * Plex (client-side pro forma). Only the first is backed by real zoning data,
 * and until now none of them acknowledged the others — a visitor who landed on
 * the weakest one by search had no signal that a better answer existed.
 *
 * The two secondary tools stay live: they hold inbound links and rank for their
 * own queries. This just makes the upgrade path explicit.
 */
export function UnderwriterUpsell({
  from,
  className,
}: {
  /** Which tool this is shown on — used for the analytics label. */
  from: "feasibility" | "will_it_plex";
  className?: string;
}) {
  return (
    <div
      className={[
        "flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center",
        className ?? "",
      ].join(" ")}
      data-testid={`underwriter-upsell-${from}`}
    >
      <Building2 className="hidden h-8 w-8 shrink-0 text-primary sm:block" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Have a specific Toronto address?</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          The Multiplex Underwriter pulls the actual zoning for that lot — as-of-right unit count,
          sixplex eligibility, buildable envelope, construction costs, rent roll, and the
          hold-vs-condo exit — instead of asking you to supply the rules.
        </p>
      </div>
      <Button
        asChild
        className="shrink-0 gap-2"
        onClick={() =>
          track({
            event: "cta_clicked",
            cta: `underwriter_upsell_${from}`,
            location: from,
            destination: "/tools/multiplex-underwriter",
          })
        }
      >
        <Link href="/tools/multiplex-underwriter">
          Run the underwrite <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}
