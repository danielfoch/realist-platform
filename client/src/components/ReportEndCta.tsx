/**
 * ReportEndCta — the shared end-of-report funnel block.
 *
 * Every report ends the same way: bridge the reader into the free deal
 * analyzer, then hand off to NextStepBlock (book a call / financing
 * readiness / Live Deal Room). Keep this the ONLY end-of-report pattern so
 * readers build muscle memory. Placement: directly after the report body.
 */
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { NextStepBlock } from "@/components/NextStepBlock";
import { track } from "@/lib/analytics";
import { Calculator } from "lucide-react";

export function ReportEndCta({ sourcePage }: { sourcePage: string }) {
  return (
    <section className="mt-12 space-y-4" data-testid="report-end-cta">
      <div className="rounded-xl border border-border/60 bg-muted/30 p-6 md:p-8 text-center space-y-3">
        <h2 className="text-xl font-bold">Run these numbers on your own deal</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Take this report's assumptions into the free analyzer and see what they do to your returns.
        </p>
        <Button
          asChild
          size="lg"
          className="gap-2"
          onClick={() =>
            track({ event: "cta_clicked", cta: "analyze_deal", location: sourcePage, destination: "/tools/analyzer" })
          }
          data-testid="button-report-cta-analyzer"
        >
          <Link href="/tools/analyzer">
            <Calculator className="h-4 w-4" />
            Analyze a Deal — Free
          </Link>
        </Button>
      </div>
      <NextStepBlock sourcePage={sourcePage} title="Want to talk through what this means for your market?" />
    </section>
  );
}
