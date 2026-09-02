/**
 * The zoning verdict in one glance: "6+1" or "4+1", which ward, and why.
 *
 * Sits above the VerdictSummary. The code is the big thing because it is the
 * first question every multiplex buyer asks about a Toronto lot; the ward and
 * the certainty badge tell them whether to trust it; the basis is collapsed
 * because it is the reasoning, not the answer.
 */
import { Badge } from "@/components/ui/badge";
import { Landmark, ShieldCheck, HelpCircle } from "lucide-react";
import type { ZoningTier } from "@shared/multiplexZoningTier";

export function ZoningTierBanner({
  tier,
  envelopeMaxUnits,
  className,
}: {
  tier: ZoningTier;
  /** Largest principal unit count an as-of-right configuration actually packed into the envelope. */
  envelopeMaxUnits?: number | null;
  className?: string;
}) {
  const verified = tier.certainty === "verified";
  const six = tier.principalUnits === 6;
  const envelopeShort = envelopeMaxUnits != null && envelopeMaxUnits > 0 && envelopeMaxUnits < tier.principalUnits;
  return (
    <section
      aria-label="Zoning tier"
      data-testid="zoning-tier-banner"
      className={[
        "rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center gap-4",
        six
          ? "border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent"
          : "border-sky-500/40 bg-gradient-to-r from-sky-500/15 via-sky-500/5 to-transparent",
        className ?? "",
      ].join(" ")}
    >
      <div className="shrink-0 text-center sm:text-left">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">This lot is a</p>
        <p
          className={[
            "text-5xl sm:text-6xl font-black tabular-nums leading-none tracking-tight",
            six ? "text-emerald-700 dark:text-emerald-300" : "text-sky-700 dark:text-sky-300",
          ].join(" ")}
          data-testid="zoning-tier-code"
        >
          {tier.code}
        </p>
        <p className="text-xs text-muted-foreground mt-1">site</p>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-base sm:text-lg font-semibold leading-snug" data-testid="zoning-tier-headline">{tier.headline}</p>
        <div className="flex flex-wrap items-center gap-2">
          {tier.wardLabel && (
            <Badge variant="outline" className="gap-1"><Landmark className="h-3 w-3" /> {tier.wardLabel}</Badge>
          )}
          <Badge
            variant="outline"
            className={
              verified
                ? "gap-1 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30"
                : "gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
            }
            data-testid="zoning-tier-certainty"
          >
            {verified ? <ShieldCheck className="h-3 w-3" /> : <HelpCircle className="h-3 w-3" />}
            {verified ? "Ward verified from boundary polygons" : "Ward inferred — confirm before relying on it"}
          </Badge>
          <Badge variant="outline">{tier.principalUnits} principal units{tier.suite ? ` + ${tier.suite} suite` : ""}</Badge>
        </div>
        {envelopeShort && (
          <p className="text-xs text-amber-700 dark:text-amber-400" data-testid="zoning-tier-envelope-note">
            Zoning permits {tier.principalUnits} units, but the buildable envelope on this lot only packs {envelopeMaxUnits} as-of-right at the modelled unit sizes — the configurations below are envelope-limited, not permission-limited.
          </p>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Why this tier</summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {tier.basis.map((b, i) => <li key={i}>• {b}</li>)}
          </ul>
        </details>
      </div>
    </section>
  );
}
