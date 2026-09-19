import type { DealConsensus } from "@/lib/analyses/community";
import { fmtMoney } from "@/components/multiplex/format";

/**
 * What other investors made of this deal. Medians appear only once enough
 * different people have underwritten it; before that, just the head-count.
 */
export function ConsensusStrip({ consensus }: { consensus: DealConsensus | null }) {
  if (!consensus || consensus.analysts === 0) {
    return <p className="text-xs text-ink-faint">No one has underwritten this one yet — be the first.</p>;
  }
  const { analysts, medians, verdicts } = consensus;
  const calls = verdicts.pursue + verdicts.watch + verdicts.pass;
  return (
    <div className="rounded-lg border border-hairline bg-surface px-4 py-2.5">
      <p className="tnum text-[10px] font-medium uppercase tracking-[1.3px] text-ink-faint">
        {analysts} {analysts === 1 ? "investor has" : "investors have"} underwritten this
      </p>
      {medians && (
        <p className="tnum mt-1 text-xs text-ink-soft">
          Median rent <span className="font-semibold text-ink">{fmtMoney(medians.monthlyRent)}</span>
          {medians.capRate != null && (
            <>
              {" · "}cap <span className="font-semibold text-ink">{medians.capRate.toFixed(1)}%</span>
            </>
          )}
          {medians.offerPrice != null && (
            <>
              {" · "}would offer <span className="font-semibold text-ink">{fmtMoney(medians.offerPrice)}</span>
            </>
          )}
        </p>
      )}
      {calls > 0 && (
        <p className="tnum mt-1 text-xs text-ink-faint">
          {verdicts.pursue} pursue · {verdicts.watch} watch · {verdicts.pass} pass
        </p>
      )}
    </div>
  );
}
