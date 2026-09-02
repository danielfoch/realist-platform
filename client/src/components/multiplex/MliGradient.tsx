/**
 * CMHC MLI Select estimate gradient — a heat table of points tier × LTV,
 * coloured by where DSCR holds. Rendered directly under the recommended
 * takeout card. Data comes from shared/mliSelectGradient.ts via the API.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Percent } from "lucide-react";
import type { GradientCell, GradientCellStatus, MliSelectGradient } from "@shared/mliSelectGradient";
import { fmtCompact, fmtMoney } from "./verdict";

export type MliGradientData = MliSelectGradient & { configKey?: string; configLabel?: string };

const CELL_STYLES: Record<GradientCellStatus, string> = {
  strong: "bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 border-emerald-500/30",
  ok: "bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-500/30",
  fails: "bg-red-500/15 text-red-900 dark:text-red-200 border-red-500/30",
  not_allowed: "bg-muted/40 text-muted-foreground border-transparent",
};

const STATUS_LABEL: Record<GradientCellStatus, string> = {
  strong: "DSCR ≥ 1.25× — comfortable",
  ok: "DSCR 1.10–1.25× — clears CMHC's floor",
  fails: "DSCR < 1.10× — fails",
  not_allowed: "Above this tier's LTV ceiling",
};

export function gradientSummary(g: MliGradientData): string | null {
  const b = g.bestCell;
  if (!b) return null;
  return `At ${b.points} points you can borrow up to ${fmtMoney(b.loan)} at ${Math.round(b.ltv * 100)}% LTV over ${b.amortYears} years with DSCR ${b.dscr.toFixed(2)}×; premium ≈ ${b.premiumPct.toFixed(2)}% (${fmtMoney(b.premiumDollars)}).`;
}

export function MliGradient({ gradient, className }: { gradient: MliGradientData; className?: string }) {
  const g = gradient;
  const summary = gradientSummary(g);
  const isBest = (points: number, cell: GradientCell) =>
    !!g.bestCell && g.bestCell.points === points && Math.abs(g.bestCell.ltv - cell.ltv) < 1e-9;

  return (
    <Card className={className} data-testid="mli-gradient">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 flex-wrap text-lg">
          <Percent className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          MLI Select estimate — where DSCR holds
          {g.configLabel && <Badge variant="outline">{g.configLabel}</Badge>}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Rows are CMHC MLI Select points tiers; columns are loan-to-value. Each cell sizes the loan at that LTV against
          stabilized NOI of <strong className="text-foreground">{fmtMoney(g.noi)}/yr</strong> on a lending value of{" "}
          <strong className="text-foreground">{fmtCompact(g.lendingValue)}</strong> at {(g.interestRate * 100).toFixed(2)}%
          ({g.purpose === "construction" ? "construction" : "purchase/refinance"} premium schedule).
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!g.eligible ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-900 dark:text-amber-200">
            <p className="font-medium">Not MLI Select eligible at {g.units} units.</p>
            <p className="text-xs mt-1">
              CMHC MLI Select needs 5+ residential units. Model a 5-6 unit configuration where the ward allows it, or
              compare against conventional financing (typically 75-80% LTV, 25-30 year amortization, no CMHC premium).
            </p>
          </div>
        ) : g.rows.length === 0 ? (
          <p className="text-muted-foreground">{g.notes[0] ?? "The gradient could not be computed for this configuration."}</p>
        ) : (
          <>
            {summary && (
              <p className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-violet-900 dark:text-violet-200" data-testid="mli-gradient-summary">
                {summary}
              </p>
            )}

            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full border-separate border-spacing-1 text-xs">
                <thead>
                  <tr>
                    <th className="text-left font-medium text-muted-foreground p-1 whitespace-nowrap">Points tier</th>
                    {g.ltvSteps.map((ltv) => (
                      <th key={ltv} className="font-medium text-muted-foreground p-1 tabular-nums">{Math.round(ltv * 100)}% LTV</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((row) => (
                    <tr key={row.points}>
                      <th scope="row" className="text-left font-normal p-1 whitespace-nowrap align-middle">
                        <span className="font-semibold tabular-nums">{row.points} pts</span>
                        <span className="block text-[10px] text-muted-foreground">
                          {row.tier ? `to ${Math.round(row.maxLtv * 100)}% LTV · ${row.maxAmortYears}-yr amort · −${Math.round(row.tier.premiumDiscount * 100)}% premium` : "no MLI Select flexibilities"}
                        </span>
                      </th>
                      {row.cells.map((cell) => {
                        const best = isBest(row.points, cell);
                        return (
                          <td
                            key={cell.ltv}
                            title={`${STATUS_LABEL[cell.status]}${cell.allowed ? ` · loan ${fmtMoney(cell.loan)} · debt service ${fmtMoney(cell.annualDebtService)}/yr · premium ${cell.premiumPct.toFixed(2)}% (${fmtMoney(cell.premiumDollars)}) · equity ${fmtMoney(cell.cashEquity)}` : ""}`}
                            className={[
                              "rounded-md border px-1.5 py-1.5 text-center tabular-nums align-middle min-w-[72px]",
                              CELL_STYLES[cell.status],
                              best ? "ring-2 ring-violet-500 ring-offset-1 ring-offset-background font-bold" : "",
                            ].join(" ")}
                            data-status={cell.status}
                            data-best={best ? "true" : undefined}
                          >
                            {cell.allowed ? (
                              <>
                                <span className="block">{cell.dscr.toFixed(2)}×</span>
                                <span className="block text-[10px] opacity-80">{fmtCompact(cell.loan)}</span>
                              </>
                            ) : (
                              <span className="block">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {(["strong", "ok", "fails", "not_allowed"] as GradientCellStatus[]).map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span className={`inline-block h-3 w-3 rounded-sm border ${CELL_STYLES[s]}`} aria-hidden="true" />
                  {STATUS_LABEL[s]}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm ring-2 ring-violet-500" aria-hidden="true" /> Best case
              </span>
            </div>

            {g.notes.length > 0 && (
              <ul className="text-xs text-muted-foreground space-y-1">
                {g.notes.map((n, i) => <li key={i}>• {n}</li>)}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
