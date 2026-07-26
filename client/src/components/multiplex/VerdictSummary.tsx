import { Building2, TrendingUp, Landmark, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  compareToAsking,
  fmtCompact,
  fmtMoney,
  fmtPct,
  sixplexSubLabel,
  takeoutLabel,
  unitsLabel,
} from "./verdict";

/**
 * The answer, above everything else.
 *
 * The report already contained all of this, but the headline number — how many
 * units the lot supports — was a small outline badge next to the address, and
 * the most decision-useful figure in the whole model (residual land value: the
 * most you can pay for the dirt and still hit target returns) was buried several
 * cards down. Someone underwriting a site wants the verdict in one glance and
 * the reasoning underneath, not the other way round.
 *
 * The land-price comparison is the point of the whole exercise: an asking price
 * above residual land value means the deal does not work at that price, and
 * saying so plainly is more useful than a page of correct numbers that leaves
 * the reader to do the subtraction.
 */


export interface VerdictSummaryProps {
  maxUnitsAsOfRight: number;
  sixplexEligible: boolean;
  /** "verified" when the ward list confirmed it, "inferred" otherwise. */
  sixplexCertainty: string;
  /** TakeoutChoice from shared/multiplexTakeout — mli_hold | condo_termination | neither. */
  takeout: string | null;
  /** Residual land value for the recommended path. */
  maxLandPrice: number | null;
  /** Return the recommended path is targeting. */
  returnLabel: string | null;
  returnValue: number | null;
  /** Asking price, when the user supplied one. */
  askingPrice: number | null;
}

export function VerdictSummary({
  maxUnitsAsOfRight,
  sixplexEligible,
  sixplexCertainty,
  takeout,
  maxLandPrice,
  returnLabel,
  returnValue,
  askingPrice,
}: VerdictSummaryProps) {
  const pathLabel = takeoutLabel(takeout);
  const comparison = compareToAsking(maxLandPrice, askingPrice);

  return (
    <section
      aria-label="Underwrite verdict"
      className="rounded-xl border bg-gradient-to-b from-muted/60 to-transparent p-5"
      data-testid="verdict-summary"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          icon={Building2}
          label="As-of-right"
          value={unitsLabel(maxUnitsAsOfRight)}
          sub={sixplexSubLabel(sixplexEligible, sixplexCertainty)}
        />

        {pathLabel && (
          <Tile icon={TrendingUp} label="Best path" value={pathLabel} sub="Site-level recommendation" />
        )}

        {maxLandPrice != null && (
          <Tile
            icon={Landmark}
            label="Max land price"
            value={fmtCompact(maxLandPrice)}
            sub="To hit target return"
          />
        )}

        {returnLabel && returnValue != null && (
          <Tile icon={TrendingUp} label={returnLabel} value={fmtPct(returnValue)} sub="On the recommended path" />
        )}
      </div>

      {comparison && (
        <div
          className={[
            "mt-4 flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm",
            comparison.worksAtAsking
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
              : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
          ].join(" ")}
          data-testid="verdict-asking-comparison"
        >
          {comparison.worksAtAsking ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <p>
            {comparison.worksAtAsking ? (
              <>
                At the <strong>{fmtMoney(askingPrice!)}</strong> asking price this pencils with{" "}
                <strong>{fmtMoney(comparison.spread)}</strong> of room against the max land price.
              </>
            ) : (
              <>
                At <strong>{fmtMoney(askingPrice!)}</strong> the asking price is{" "}
                <strong>{fmtMoney(Math.abs(comparison.spread))}</strong> above what the land is worth on this path —
                the target return needs a price closer to <strong>{fmtMoney(maxLandPrice!)}</strong>.
              </>
            )}
          </p>
        </div>
      )}
    </section>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-1 truncate text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
