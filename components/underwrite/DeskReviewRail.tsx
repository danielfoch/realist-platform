import Link from "next/link";

/**
 * Buying an investment property is a numbers decision, so the numbers come
 * first and the showing comes once. This rail is that process, in the order it
 * happens, with where this deal stands — and the single next thing to do.
 */
export interface RailState {
  underwritten: boolean;
  called: "pursue" | "watch" | "pass" | null;
  showingRequested: boolean;
  offerRequested: boolean;
}

export function DeskReviewRail({ state, showingHref, offerHref }: { state: RailState; showingHref: string; offerHref: string }) {
  const passed = state.called === "pass";
  const steps: Array<{ label: string; detail: string; done: boolean }> = [
    { label: "Underwrite", detail: "Make the numbers yours", done: state.underwritten },
    { label: "Your call", detail: state.called ? `You said ${state.called}` : "Pursue, watch or pass", done: Boolean(state.called) },
    { label: "One showing", detail: state.showingRequested ? "Requested" : "Verify what a listing can't tell you", done: state.showingRequested },
    { label: "Offer", detail: state.offerRequested ? "In motion" : "With cash back at closing", done: state.offerRequested },
  ];
  const current = steps.findIndex((step) => !step.done);
  const next =
    passed || current < 2
      ? null
      : current === 2
        ? { href: showingHref, label: "Book the showing →" }
        : current === 3
          ? { href: offerHref, label: "Make the offer →" }
          : null;

  return (
    <div className="rounded-lg border border-hairline bg-surface px-4 py-3">
      <ol className="grid grid-cols-4 gap-2">
        {steps.map((step, index) => {
          const active = index === current && !passed;
          return (
            <li key={step.label} aria-current={active ? "step" : undefined} className="min-w-0">
              <div className={`h-0.5 w-full ${step.done ? "bg-ink" : active ? "bg-accent" : "bg-hairline-strong"}`} aria-hidden="true" />
              <p className={`tnum mt-2 truncate text-[10px] font-medium uppercase tracking-[1.2px] ${step.done || active ? "text-ink" : "text-ink-faint"}`}>
                <span aria-hidden="true">{step.done ? "✓ " : `${index + 1} `}</span>
                {step.label}
                {step.done && <span className="sr-only"> (done)</span>}
              </p>
              <p className="mt-0.5 hidden truncate text-[11px] text-ink-faint sm:block">{step.detail}</p>
            </li>
          );
        })}
      </ol>
      {passed ? (
        <p className="mt-3 text-xs text-ink-soft">You passed on this one. That call counts too — it&rsquo;s how your buy box learns what you don&rsquo;t buy.</p>
      ) : next ? (
        <p className="mt-3 text-xs text-ink-soft">
          Next:{" "}
          <Link href={next.href} className="font-semibold text-brand hover:text-brand-deep">
            {next.label}
          </Link>{" "}
          The agent gets your numbers and what you want verified before they walk in.
        </p>
      ) : null}
    </div>
  );
}
