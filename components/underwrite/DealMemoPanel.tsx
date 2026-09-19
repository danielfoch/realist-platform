"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtMoney } from "@/components/multiplex/format";
import { LeadForm } from "@/components/leads/LeadForm";
import { templateMemo, type DealMemo, type MemoDeal } from "@/lib/underwriting/dealMemo";
import { underwrite, type UnderwriterInputs } from "@/lib/underwriting/underwriter";

/**
 * The read on the deal. The rules-based memo is computed right here and tracks
 * every keystroke; when AI narration is switched on, one button asks for the
 * written-up version of the numbers currently on screen.
 */
export function DealMemoPanel({
  deal,
  mlsNumber,
  inputs,
  aiAvailable,
  locked = false,
  loginHref = "/login",
}: {
  deal: MemoDeal;
  mlsNumber?: string | null;
  inputs: UnderwriterInputs;
  aiAvailable: boolean;
  /** A guest past their free memos: the verdict stays, the detail asks for an account. */
  locked?: boolean;
  loginHref?: string;
}) {
  const rules = useMemo(() => templateMemo(deal, inputs), [deal, inputs]);
  const [narrated, setNarrated] = useState<{ memo: DealMemo; forInputs: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wantsHelp, setWantsHelp] = useState(false);

  const signature = JSON.stringify(inputs);
  // A narrated memo describes the numbers it was written for, and nothing else.
  const memo = narrated && narrated.forInputs === signature ? narrated.memo : rules;
  const isNarrated = memo !== rules;
  const result = useMemo(() => underwrite(inputs), [inputs]);
  const what = memo.sensitivities;

  async function narrate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/analyses/memo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mlsNumber, deal, inputs }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; memo?: DealMemo; error?: string } | null;
      if (!response.ok || !body?.ok || !body.memo) throw new Error(body?.error ?? "The memo couldn't be written just now.");
      setNarrated({ memo: body.memo, forInputs: signature });
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const rows: Array<[string, string]> = [
    ["Rate one point higher at renewal", what.cashFlowRatePlus1 == null ? "—" : `${fmtMoney(what.cashFlowRatePlus1)}/mo`],
    ["Rents come in 10% under", what.cashFlowRentMinus10 == null ? "—" : `${fmtMoney(what.cashFlowRentMinus10)}/mo`],
    ["Rent needed to break even", what.breakEvenRent == null ? "—" : `${fmtMoney(what.breakEvenRent)}/mo`],
    ["IRR with zero appreciation", what.irrNoAppreciation == null ? "—" : `${what.irrNoAppreciation.toFixed(1)}%`],
    ["Price per unit", what.pricePerUnit == null ? "—" : fmtMoney(what.pricePerUnit)],
    ["Monthly rent ÷ price", what.rentToPricePercent == null ? "—" : `${what.rentToPricePercent.toFixed(2)}%`],
  ];

  return (
    <section aria-labelledby="deal-memo" className="mt-8 rounded-lg border border-hairline bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <div>
          <p className="tnum text-[10px] font-medium uppercase tracking-[1.3px] text-ink-faint">
            Deal memo · {isNarrated ? "written by Realist AI from your numbers" : "from your numbers, updates as you type"}
          </p>
          <h3 id="deal-memo" className="font-display mt-1 text-xl font-semibold tracking-tight">
            {memo.headline}
          </h3>
        </div>
        {aiAvailable && !isNarrated && !locked && (
          <button
            type="button"
            onClick={narrate}
            disabled={busy || !(result.assumptionsComplete)}
            className="rounded-[3px] border border-hairline-strong px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
          >
            {busy ? "Writing…" : "Have Realist AI write it up"}
          </button>
        )}
      </div>

      <div className="grid gap-8 px-5 py-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-ink">{memo.summary}</p>
          {error && (
            <p role="alert" className="text-xs font-medium text-bad">
              {error}
            </p>
          )}
          <MemoList title="What's working" items={memo.working} />
          {locked ? (
            <div className="rounded-[3px] border border-hairline-strong bg-paper p-5">
              <p className="text-sm font-semibold text-ink">
                {memo.watch.length} things to watch, {memo.beforeYouOffer.length} steps before you offer, and the stress test.
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                You&rsquo;ve underwritten a couple of deals as a guest. A free account unlocks the full memo on every
                deal, keeps your analyses, and puts you on the leaderboard. It takes ten seconds.
              </p>
              <Link href={loginHref} className="mt-4 inline-block rounded-[3px] bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-deep">
                Create a free account
              </Link>
            </div>
          ) : (
            <>
              <MemoList title="What to watch" items={memo.watch} marked />
              <MemoList title="Before you offer" items={memo.beforeYouOffer} ordered />
              <div>
                <h4 className="tnum text-[10px] font-medium uppercase tracking-[1.3px] text-ink-faint">The offer</h4>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{memo.offer.line}</p>
              </div>
            </>
          )}
        </div>

        <div>
          <h4 className="tnum text-[10px] font-medium uppercase tracking-[1.3px] text-ink-faint">Stress test</h4>
          <table className={`mt-2 w-full text-sm ${locked ? "pointer-events-none select-none blur-[5px]" : ""}`} aria-hidden={locked || undefined}>
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label} className="border-b border-hairline last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-normal text-ink-soft">
                    {label}
                  </th>
                  <td className={`tnum py-2 text-right font-semibold ${value.startsWith("-") || value.startsWith("−") ? "text-bad" : "text-ink"}`}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-5 rounded-[3px] border border-hairline bg-paper p-4">
            {wantsHelp ? (
              <LeadForm
                kind="underwriting_help"
                ask={["name", "phone"]}
                property={{ address: deal.address ?? null, mlsNumber: mlsNumber ?? null, price: inputs.price, url: mlsNumber ? `/listings/${encodeURIComponent(mlsNumber)}` : null }}
                defaultCity={deal.city}
                defaultProvince={deal.province}
                context={{
                  numbers: {
                    capRate: result.capRate,
                    monthlyCashFlow: result.monthlyCashFlow,
                    dscr: result.dscr,
                    offerPrice: memo.offer.breakEven,
                  },
                }}
                submitLabel="Get a second opinion"
                successMessage="Got it. Someone who buys these for a living will look at your numbers and get back to you."
              />
            ) : (
              <>
                <p className="text-sm font-semibold text-ink">Want a second opinion?</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  Someone who buys these for a living will pressure-test your numbers — free, no obligation.
                </p>
                <button type="button" onClick={() => setWantsHelp(true)} className="mt-3 text-sm font-semibold text-brand hover:text-brand-deep">
                  Send them my numbers →
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function MemoList({ title, items, marked, ordered }: { title: string; items: string[]; marked?: boolean; ordered?: boolean }) {
  const List = ordered ? "ol" : "ul";
  return (
    <div>
      <h4 className="tnum text-[10px] font-medium uppercase tracking-[1.3px] text-ink-faint">{title}</h4>
      <List className="mt-1.5 space-y-1.5">
        {items.map((item, index) => (
          <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
            <span className={`tnum mt-[0.45rem] shrink-0 ${ordered ? "mt-0 w-4 text-xs text-ink-faint" : `h-1.5 w-1.5 rounded-full ${marked ? "bg-accent" : "bg-ink"}`}`} aria-hidden="true">
              {ordered ? index + 1 : ""}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </List>
    </div>
  );
}
