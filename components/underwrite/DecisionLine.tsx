import type { MarketDecisionLine } from "@/lib/analyses/learn";

/**
 * Where this market's members draw the line: the cap rate they say yes at and
 * the one they walk away from. Learned from their calls, never from one person.
 */
export function DecisionLine({ line }: { line: MarketDecisionLine | null }) {
  if (!line) return null;
  return (
    <div className="rounded-lg border border-hairline bg-surface px-4 py-2.5">
      <p className="tnum text-[10px] font-medium uppercase tracking-[1.3px] text-ink-faint">
        Where {line.scopeLabel} members draw the line · {line.calls} calls
      </p>
      <p className="tnum mt-1 text-xs text-ink-soft">
        They pursue at a <span className="font-semibold text-ink">{line.pursueAt.toFixed(1)}%</span> cap
        {line.passAt != null && (
          <>
            {" "}
            and pass at <span className="font-semibold text-ink">{line.passAt.toFixed(1)}%</span>
          </>
        )}
        . See where yours lands below.
      </p>
    </div>
  );
}
