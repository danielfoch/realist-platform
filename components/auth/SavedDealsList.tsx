"use client";

import Link from "next/link";
import { useState } from "react";
import { fmtYield } from "@/components/listings/listingDisplay";
import { fmtMoney } from "@/components/multiplex/format";
import { eyebrowClass, formatDay, requestJson } from "./shared";

/**
 * The member's saved deals, grouped by kind. Rows read from the snapshot
 * frozen at save time, so the list still makes sense after a listing leaves
 * the feed. Entries carried over from the old Realist are a read-only archive.
 */

export interface SavedDealItem {
  id: string;
  kind: "listing" | "multiplex" | "analysis";
  refKey: string;
  title: string;
  snapshot: Record<string, unknown> | null;
  note: string | null;
  /** ISO timestamp. */
  createdAt: string;
}

const SECTIONS: Array<{ kind: SavedDealItem["kind"]; label: string }> = [
  { kind: "listing", label: "Listings" },
  { kind: "multiplex", label: "Multiplex underwrites" },
  { kind: "analysis", label: "From the old Realist" },
];

const TAKEOUT_LABEL: Record<string, string> = {
  condo: "Condo exit",
  hold: "MLI Select hold",
  neither: "Needs work",
};

function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The old analyzer stored cap rates both ways; nothing real is under 1%, so a
 * value that small is a ratio (0.052) rather than a percent (5.2). */
function asPercent(value: number): number {
  return Math.abs(value) <= 1 ? value * 100 : value;
}

/** One compact line from whichever headline numbers the snapshot carries. */
function snapshotFacts(item: SavedDealItem): string[] {
  const snap = item.snapshot ?? {};
  const facts: Array<string | null> = [];

  if (item.kind === "analysis") {
    const capRate = num(snap.capRate);
    const cashFlow = num(snap.cashFlowMonthly);
    facts.push(
      text(snap.city),
      capRate ? `${fmtYield(asPercent(capRate))} cap rate` : null,
      cashFlow != null ? `${fmtMoney(cashFlow)}/mo cash flow` : null,
    );
    return facts.filter((fact): fact is string => Boolean(fact));
  }

  const price = num(snap.price);
  const netYield = num(snap.netYield);
  const grossYield = num(snap.grossYield);
  const units = num(snap.units);
  const score = num(snap.score);
  const recommended = text(snap.recommended);
  facts.push(
    price ? fmtMoney(price) : null,
    [text(snap.city), text(snap.province)].filter(Boolean).join(", ") || null,
    netYield ? `${fmtYield(netYield)} net` : grossYield ? `${fmtYield(grossYield)} gross` : null,
    units && units > 0 ? `${units} ${units === 1 ? "unit" : "units"}` : null,
    recommended ? (TAKEOUT_LABEL[recommended] ?? recommended) : null,
    item.kind === "multiplex" && score != null ? `${fmtMoney(score, true)} projected` : null,
  );
  return facts.filter((fact): fact is string => Boolean(fact));
}

function hrefFor(item: SavedDealItem): string | null {
  if (item.kind === "listing") return `/listings/${encodeURIComponent(item.refKey)}`;
  if (item.kind === "multiplex") return `/multiplex/r/${encodeURIComponent(item.refKey)}`;
  return null;
}

export function SavedDealsList({ initial }: { initial: SavedDealItem[] }) {
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function remove(item: SavedDealItem) {
    // Listings and underwrites can be saved again; an archived analysis cannot.
    if (
      item.kind === "analysis" &&
      !window.confirm(`Remove “${item.title}” from your archive? It can't be added back.`)
    ) {
      return;
    }
    setError(null);
    // Optimistic: the row goes now and comes back in place if the server says no.
    setItems((current) => current.filter((row) => row.id !== item.id));
    const result = await requestJson("/api/saved", "DELETE", { kind: item.kind, refKey: item.refKey });
    if (result.ok) return;
    setItems((current) => {
      if (current.some((row) => row.id === item.id)) return current;
      return [...current, item].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
    setError(`“${item.title}” wasn't removed. ${result.error}`);
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-hairline bg-surface p-8">
        <h3 className="font-display text-lg font-semibold">Nothing saved yet</h3>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
          Tap the bookmark on any listing or multiplex report and it lands here, with the numbers as they
          stood the day you saved it.
        </p>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
          <Link href="/listings" className="text-brand hover:text-brand-deep">
            Browse listings →
          </Link>
          <Link href="/multiplex" className="text-brand hover:text-brand-deep">
            Underwrite a multiplex →
          </Link>
        </div>
        {error && (
          <p role="alert" className="mt-4 text-sm font-medium text-bad">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-9">
      {error && (
        <p role="alert" className="text-sm font-medium text-bad">
          {error}
        </p>
      )}
      {SECTIONS.map((section) => {
        const rows = items.filter((item) => item.kind === section.kind);
        if (rows.length === 0) return null;
        const archive = section.kind === "analysis";
        return (
          <section key={section.kind} aria-labelledby={`saved-${section.kind}`}>
            <div className="flex items-baseline justify-between gap-4">
              <h3 id={`saved-${section.kind}`} className={`${eyebrowClass} text-ink-faint`}>
                {section.label}
              </h3>
              <span className="tnum text-[11px] text-ink-faint">{rows.length}</span>
            </div>
            {archive && (
              <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
                Analyses you ran on the previous site, kept for reference.
              </p>
            )}
            <ul className="mt-3 divide-y divide-hairline border-y border-hairline">
              {rows.map((item) => {
                const href = hrefFor(item);
                const facts = snapshotFacts(item);
                return (
                  <li key={item.id} className="flex items-start justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {href ? (
                          <Link href={href} className="hover:text-brand">
                            {item.title}
                          </Link>
                        ) : (
                          item.title
                        )}
                      </p>
                      {facts.length > 0 && (
                        <p className="tnum mt-1 text-xs leading-relaxed text-ink-soft">{facts.join(" · ")}</p>
                      )}
                      {item.note && <p className="mt-1 text-xs leading-relaxed text-ink-soft">{item.note}</p>}
                      <p className="mt-1 text-[11px] text-ink-faint">Saved {formatDay(item.createdAt)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void remove(item)}
                      aria-label={`Remove ${item.title}`}
                      className="shrink-0 rounded-[3px] px-2 py-1 text-xs font-medium text-ink-faint transition-colors hover:bg-raised hover:text-brand"
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
