"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { MemoDeal } from "@/lib/underwriting/dealMemo";
import type { UnderwriterInputs } from "@/lib/underwriting/underwriter";

/**
 * Ask Realist: the investor's realtor, at the desk. It answers from this deal,
 * these numbers and this market — and shows what it ran to get there, so the
 * reasoning can be checked rather than trusted.
 */

interface Exchange {
  question: string;
  answer: string;
  steps: string[];
  verified: boolean;
}

const STARTERS = ["Has this one earned a showing?", "What should I offer, and why?", "What would you verify in person?", "What if I put 30% down?"];

export function AskRealist({
  deal,
  mlsNumber,
  inputs,
  signedIn,
  loginHref,
}: {
  deal: MemoDeal;
  mlsNumber?: string | null;
  inputs: UnderwriterInputs;
  signedIn: boolean;
  loginHref: string;
}) {
  const [thread, setThread] = useState<Exchange[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(question: string) {
    const asked = question.trim();
    if (!asked || busy) return;
    setBusy(true);
    setError(null);
    setDraft("");
    try {
      const response = await fetch("/api/deals/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: asked,
          mlsNumber: mlsNumber ?? null,
          deal,
          // Always the numbers on screen right now, so an answer never describes a stale scenario.
          inputs,
          history: thread.slice(-3).flatMap((turn) => [
            { role: "user" as const, content: turn.question },
            { role: "assistant" as const, content: turn.answer },
          ]),
        }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; answer?: string; steps?: string[]; verified?: boolean } | null;
      if (!response.ok || !body?.ok || !body.answer) throw new Error(body?.error ?? "Realist couldn't answer just now.");
      setThread((current) => [...current, { question: asked, answer: body.answer as string, steps: body.steps ?? [], verified: body.verified !== false }]);
    } catch (caught) {
      setError((caught as Error).message);
      setDraft(asked);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(draft);
  }

  return (
    <section aria-labelledby="ask-realist" className="mt-6 rounded-lg border border-hairline bg-surface">
      <div className="border-b border-hairline px-5 py-4">
        <p className="tnum text-[10px] font-medium uppercase tracking-[1.3px] text-ink-faint">Ask Realist · your realtor, at the desk</p>
        <h3 id="ask-realist" className="font-display mt-1 text-xl font-semibold tracking-tight">
          Ask anything about this <em>deal</em>.
        </h3>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-soft">
          It re-runs your numbers to answer — it never guesses one — and it knows how members in this market decide and what you
          tend to buy. When a deal has earned it, a licensed agent does the one showing and the paperwork.
        </p>
      </div>

      <div className="px-5 py-5">
        {!signedIn ? (
          <div>
            <p className="text-sm leading-relaxed text-ink-soft">Free for members. It takes ten seconds, and your numbers come with you.</p>
            <Link href={loginHref} className="mt-3 inline-block rounded-[3px] bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-deep">
              Join free to ask
            </Link>
          </div>
        ) : (
          <>
            {thread.length > 0 && (
              <ol className="mb-5 space-y-5" aria-live="polite">
                {thread.map((turn, index) => (
                  <li key={index}>
                    <p className="text-sm font-semibold text-ink">{turn.question}</p>
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{turn.answer}</p>
                    {turn.steps.length > 0 && (
                      <p className="tnum mt-2 text-[11px] leading-relaxed text-ink-faint">
                        {turn.verified ? "Checked against your numbers" : "Not verified"} · {turn.steps.join(" · ")}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {thread.length === 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    disabled={busy}
                    onClick={() => ask(starter)}
                    className="min-h-10 rounded-full border border-hairline-strong px-3.5 text-xs font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand disabled:opacity-60 sm:min-h-8"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="ask-realist-input" className="sr-only">
                Your question about this deal
              </label>
              <input
                id="ask-realist-input"
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={600}
                placeholder={thread.length ? "Ask a follow-up…" : "e.g. Would this still work if rents came in 10% low?"}
                disabled={busy}
                className="w-full rounded-[3px] border border-hairline-strong bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none disabled:opacity-60"
              />
              <button type="submit" disabled={busy || draft.trim().length < 3} className="shrink-0 rounded-[3px] bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand disabled:opacity-60">
                {busy ? "Working it out…" : "Ask"}
              </button>
            </form>
            {error && (
              <p role="alert" className="mt-2 text-xs font-medium text-bad">
                {error}
              </p>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">An underwriting read, not legal, tax or financial advice. It can be wrong — verify before you act.</p>
          </>
        )}
      </div>
    </section>
  );
}
