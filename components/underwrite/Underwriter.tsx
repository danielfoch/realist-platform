"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmtMoney } from "@/components/multiplex/format";
import { DealMemoPanel } from "./DealMemoPanel";
import {
  LEARNABLE_FIELDS,
  RENT_RATIO_FIELD,
  editedFields,
  readTheDeal,
  solveOfferPrice,
  underwrite,
  type LearnedDefaults,
  type OfferTarget,
  type UnderwriterField,
  type UnderwriterInputs,
} from "@/lib/underwriting/underwriter";

/**
 * The underwriter. Every number on the left is editable; everything on the
 * right recomputes as you type, in the browser, through the same engine the
 * rest of the site uses. Touch anything (or make a call on the deal) and the
 * analysis is logged — to your history, to the leaderboard, and to the
 * learning set that gives the next person in this market better defaults.
 */

export interface UnderwriterDeal {
  source: "listing" | "manual";
  mlsNumber?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  propertyType?: string | null;
}

export interface SavedAnalysisState {
  inputs: UnderwriterInputs;
  verdict: Verdict | null;
}

type Verdict = "pursue" | "watch" | "pass";

interface LogState {
  status: "idle" | "saving" | "saved" | "error";
  signedIn?: boolean;
  deals?: number;
  streakWeeks?: number;
  message?: string;
  /** Set on the analysis that crosses a rung of the badge ladder. */
  badgeEarned?: string | null;
}

/** Guests read the full memo on this many deals; after that it asks for a free account. */
const GUEST_FULL_MEMOS = 2;

type FieldSpec = {
  field: UnderwriterField;
  label: string;
  unit: "$" | "%" | "yrs" | "";
  step: number;
  hint?: string;
  slider?: (defaults: UnderwriterInputs) => [number, number];
};

const GROUPS: Array<{ title: string; open: boolean; fields: FieldSpec[] }> = [
  {
    title: "The deal",
    open: true,
    fields: [
      {
        field: "price",
        label: "Purchase price",
        unit: "$",
        step: 1000,
        slider: (d) => [Math.round(d.price * 0.6), Math.round(d.price * 1.2)],
      },
      {
        field: "monthlyRent",
        label: "Total rent / month",
        unit: "$",
        step: 25,
        hint: "All units combined",
        slider: (d) => [
          Math.round(d.monthlyRent * 0.5),
          Math.round(Math.max(d.monthlyRent * 1.6, 2000)),
        ],
      },
      { field: "units", label: "Units", unit: "", step: 1 },
    ],
  },
  {
    title: "Financing",
    open: true,
    fields: [
      {
        field: "downPaymentPercent",
        label: "Down payment",
        unit: "%",
        step: 1,
        slider: () => [5, 50],
      },
      {
        field: "interestRate",
        label: "Interest rate",
        unit: "%",
        step: 0.05,
        slider: () => [2, 9],
      },
      {
        field: "amortizationYears",
        label: "Amortization",
        unit: "yrs",
        step: 1,
      },
    ],
  },
  {
    title: "Running costs",
    open: true,
    fields: [
      { field: "vacancyPercent", label: "Vacancy", unit: "%", step: 0.5 },
      {
        field: "managementPercent",
        label: "Management",
        unit: "%",
        step: 0.5,
        hint: "0 if you self-manage",
      },
      {
        field: "maintenancePercent",
        label: "Maintenance",
        unit: "%",
        step: 0.5,
      },
      {
        field: "annualPropertyTax",
        label: "Property tax / year",
        unit: "$",
        step: 100,
      },
      {
        field: "annualInsurance",
        label: "Insurance / year",
        unit: "$",
        step: 100,
      },
      {
        field: "monthlyCondoFees",
        label: "Condo fees / month",
        unit: "$",
        step: 25,
      },
      {
        field: "monthlyUtilities",
        label: "Utilities you pay / month",
        unit: "$",
        step: 25,
      },
    ],
  },
  {
    title: "Closing & exit",
    open: false,
    fields: [
      {
        field: "closingCosts",
        label: "Closing costs",
        unit: "$",
        step: 500,
        hint: "Land transfer tax, legal, inspection",
      },
      { field: "holdPeriodYears", label: "Hold period", unit: "yrs", step: 1 },
      {
        field: "annualAppreciationPercent",
        label: "Appreciation / year",
        unit: "%",
        step: 0.25,
      },
      {
        field: "annualRentGrowthPercent",
        label: "Rent growth / year",
        unit: "%",
        step: 0.25,
      },
      {
        field: "sellingCostPercent",
        label: "Selling costs",
        unit: "%",
        step: 0.25,
      },
    ],
  },
];

const TARGETS: Array<{ key: string; label: string; target: OfferTarget }> = [
  {
    key: "breakeven",
    label: "Break even",
    target: { metric: "cash_flow", value: 0 },
  },
  {
    key: "dscr",
    label: "1.20 coverage",
    target: { metric: "dscr", value: 1.2 },
  },
  {
    key: "coc",
    label: "8% cash-on-cash",
    target: { metric: "cash_on_cash", value: 8 },
  },
  {
    key: "cap",
    label: "6% cap rate",
    target: { metric: "cap_rate", value: 6 },
  },
];

const VERDICTS: Array<{ key: Verdict; label: string }> = [
  { key: "pursue", label: "Pursue" },
  { key: "watch", label: "Watch" },
  { key: "pass", label: "Pass" },
];

function display(value: number, unit: FieldSpec["unit"]): string {
  if (!isFinite(value)) return "";
  if (unit === "$") return Math.round(value).toLocaleString("en-CA");
  return String(Math.round(value * 100) / 100);
}

function NumberField({
  spec,
  value,
  edited,
  learnedNote,
  defaults,
  onChange,
  onReset,
}: {
  spec: FieldSpec;
  value: number;
  edited: boolean;
  learnedNote: string | null;
  defaults: UnderwriterInputs;
  onChange: (value: number) => void;
  onReset: () => void;
}) {
  // While focused the person's raw text is shown; otherwise the formatted number.
  const [draft, setDraft] = useState<string | null>(null);
  const id = `uw-${spec.field}`;
  const range = spec.slider?.(defaults);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-ink-soft">
          {spec.label}
          {edited && (
            <span
              className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle"
              aria-label="edited"
            />
          )}
        </label>
        {edited && (
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] text-ink-faint underline-offset-2 hover:text-brand hover:underline"
          >
            reset
          </button>
        )}
      </div>
      <div className="relative mt-1">
        {spec.unit === "$" && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
            $
          </span>
        )}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={draft ?? display(value, spec.unit)}
          onFocus={(event) => {
            setDraft(String(Math.round(value * 100) / 100));
            event.currentTarget.select();
          }}
          onChange={(event) => {
            const text = event.target.value;
            setDraft(text);
            const parsed = Number(text.replace(/[,$\s]/g, ""));
            if (text.trim() !== "" && isFinite(parsed)) onChange(parsed);
          }}
          onBlur={() => setDraft(null)}
          className={`tnum w-full rounded-[3px] border border-hairline-strong bg-surface py-2 text-sm text-ink focus:border-brand focus:outline-none ${
            spec.unit === "$" ? "pl-6 pr-3" : "pl-3 pr-10"
          }`}
        />
        {spec.unit && spec.unit !== "$" && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint">
            {spec.unit}
          </span>
        )}
      </div>
      {range && range[1] > range[0] && (
        <input
          type="range"
          aria-label={`${spec.label} slider`}
          min={range[0]}
          max={range[1]}
          step={spec.step}
          value={Math.min(Math.max(value, range[0]), range[1])}
          onChange={(event) => onChange(Number(event.target.value))}
          className="mt-2 h-1 w-full cursor-pointer accent-[var(--color-brand)]"
        />
      )}
      {(learnedNote || spec.hint) && (
        <p className="mt-1 text-[11px] leading-snug text-ink-faint">
          {learnedNote ?? spec.hint}
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface px-4 py-3">
      <p className="tnum text-[10px] font-medium uppercase tracking-[1.3px] text-ink-faint">
        {label}
      </p>
      <p
        className={`tnum mt-1 text-xl font-semibold ${tone === "bad" ? "text-bad" : "text-ink"}`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-ink-faint">{hint}</p>}
    </div>
  );
}

export function Underwriter({
  deal,
  defaults,
  learned = {},
  saved = null,
  rentSourceLabel,
  yearBuilt = null,
  taxFromListing,
  aiAvailable = false,
  returnPath,
  rentEstimate = null,
}: {
  deal: UnderwriterDeal;
  defaults: UnderwriterInputs;
  learned?: LearnedDefaults;
  saved?: SavedAnalysisState | null;
  /** Where the starting rent came from: "Actual rent", "Rent comps", "CMHC average"… */
  rentSourceLabel?: string | null;
  yearBuilt?: number | null;
  /** True when the tax figure is the listing's own, false when we inferred it. */
  taxFromListing?: boolean;
  /** Whether the AI-narrated memo can be requested on this deployment. */
  aiAvailable?: boolean;
  /** Where signing in should bring the person back to: this deal, as they left it. */
  returnPath?: string;
  /** Our raw rent estimate, before any learned adjustment (listings with an estimated rent only). */
  rentEstimate?: number | null;
}) {
  const [inputs, setInputs] = useState<UnderwriterInputs>(
    saved?.inputs ?? defaults,
  );
  const [verdict, setVerdict] = useState<Verdict | null>(
    saved?.verdict ?? null,
  );
  const [targetKey, setTargetKey] = useState("breakeven");
  const [log, setLog] = useState<LogState>({
    status: saved ? "saved" : "idle",
  });
  const [shareNote, setShareNote] = useState<string | null>(null);
  // Who is looking, learned after load (pages are cached for everyone).
  const [visitor, setVisitor] = useState<{ signedIn: boolean | null; otherDeals: number }>({ signedIn: null, otherDeals: 0 });
  // Nothing is logged until the person does something — a page view is not an analysis.
  const touched = useRef(false);

  const result = useMemo(() => underwrite(inputs), [inputs]);
  const read = useMemo(() => readTheDeal(result), [result]);
  const edited = useMemo(
    () => new Set(editedFields(defaults, inputs)),
    [defaults, inputs],
  );
  const target = TARGETS.find((entry) => entry.key === targetKey) ?? TARGETS[0];
  const offerPrice = useMemo(
    () => solveOfferPrice(inputs, target.target),
    [inputs, target],
  );

  const hasDeal = Boolean(
    deal.mlsNumber || (deal.address && deal.address.trim().length >= 5),
  );

  // Pages are cached for everyone, so a returning person's own numbers arrive after load.
  useEffect(() => {
    if (saved || !hasDeal) return;
    let alive = true;
    const which = deal.mlsNumber
      ? `mls=${encodeURIComponent(deal.mlsNumber)}`
      : `address=${encodeURIComponent(deal.address ?? "")}`;
    fetch(`/api/analyses?${which}`, { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          body: {
            analysis?: SavedAnalysisState | null;
            signedIn?: boolean;
            stats?: { deals: number; streakWeeks: number };
          } | null,
        ) => {
          if (!alive || !body) return;
          setVisitor({
            signedIn: body.signedIn ?? null,
            otherDeals: Math.max(0, (body.stats?.deals ?? 0) - (body.analysis ? 1 : 0)),
          });
          if (!body.analysis || touched.current) return;
          setInputs(body.analysis.inputs);
          setVerdict(body.analysis.verdict);
          setLog({
            status: "saved",
            signedIn: body.signedIn,
            deals: body.stats?.deals,
            streakWeeks: body.stats?.streakWeeks,
          });
        },
      )
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!touched.current || !hasDeal || !(inputs.price > 0)) return;
    const timer = setTimeout(async () => {
      setLog((current) => ({ ...current, status: "saving" }));
      try {
        const response = await fetch("/api/analyses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...deal,
            inputs,
            defaults,
            offerPrice,
            verdict,
            rentSource: rentSourceLabel ?? null,
            rentEstimate: rentEstimate ?? null,
            learnedApplied: Object.keys(learned),
          }),
        });
        const body = (await response.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          signedIn?: boolean;
          stats?: { deals: number; streakWeeks: number };
          badgeEarned?: string | null;
        } | null;
        if (!response.ok || !body?.ok) {
          setLog({
            status: "error",
            message:
              body?.error ??
              "Couldn't log this analysis — your numbers are still here.",
          });
          return;
        }
        setLog({
          status: "saved",
          signedIn: body.signedIn,
          deals: body.stats?.deals,
          streakWeeks: body.stats?.streakWeeks,
          badgeEarned: body.badgeEarned ?? null,
        });
        setVisitor((current) => ({ ...current, signedIn: body.signedIn ?? current.signedIn }));
      } catch {
        setLog({
          status: "error",
          message: "Couldn't log this analysis — your numbers are still here.",
        });
      }
    }, 1500);
    return () => clearTimeout(timer);
    // `deal` and `defaults` are stable for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs, verdict, offerPrice, hasDeal]);

  async function share() {
    setShareNote("Making a link…");
    try {
      const response = await fetch("/api/analyses/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mlsNumber: deal.mlsNumber ?? null, address: deal.address ?? null }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; path?: string; error?: string } | null;
      if (!response.ok || !body?.ok || !body.path) return setShareNote(body?.error ?? "Couldn't make a link just now.");
      const url = `${window.location.origin}${body.path}`;
      await navigator.clipboard.writeText(url).then(
        () => setShareNote("Link copied — anyone with it can see these numbers."),
        () => setShareNote(url),
      );
    } catch {
      setShareNote("Couldn't make a link just now.");
    }
  }

  function change(field: UnderwriterField, value: number) {
    touched.current = true;
    setInputs((current) => ({ ...current, [field]: value }));
  }

  function learnedNote(field: UnderwriterField): string | null {
    if (!(LEARNABLE_FIELDS as readonly string[]).includes(field)) return null;
    const entry = learned[field as keyof LearnedDefaults];
    if (!entry) return null;
    return `${entry.scopeLabel} investors use ${entry.value}${field.endsWith("Years") ? " yrs" : "%"} · median of ${entry.sampleSize} analyses`;
  }

  const rentRatio = learned[RENT_RATIO_FIELD];
  const rentMoved = rentEstimate != null && rentRatio != null && Math.abs(defaults.monthlyRent - rentEstimate) >= 5;
  const rentNote = rentMoved
    ? `Our estimate was ${fmtMoney(rentEstimate)}. ${rentRatio.scopeLabel} investors underwrite ${Math.abs(Math.round((1 - rentRatio.value) * 100))}% ${rentRatio.value < 1 ? "under" : "over"} it (median of ${rentRatio.sampleSize}), so you start there.`
    : `Starting point: ${(rentSourceLabel ?? "estimate").toLowerCase()}. Use what you know.`;
  const rentEdited = edited.has("monthlyRent");
  const memoDeal = useMemo(
    () => ({
      address: deal.address ?? null,
      city: deal.city ?? null,
      province: deal.province ?? null,
      propertyType: deal.propertyType ?? null,
      yearBuilt,
      rentSourceLabel: rentSourceLabel ?? null,
      rentEdited,
      taxFromListing,
    }),
    [
      deal.address,
      deal.city,
      deal.province,
      deal.propertyType,
      yearBuilt,
      rentSourceLabel,
      rentEdited,
      taxFromListing,
    ],
  );

  const cashFlow = result.monthlyCashFlow;
  const offerDelta =
    offerPrice != null && inputs.price > 0
      ? ((offerPrice - inputs.price) / inputs.price) * 100
      : null;
  const offerParams = new URLSearchParams();
  if (deal.mlsNumber) offerParams.set("mls", deal.mlsNumber);
  if (deal.address) offerParams.set("address", deal.address);
  if (deal.city) offerParams.set("city", deal.city);
  if (deal.province) offerParams.set("province", deal.province);
  offerParams.set(
    "price",
    String(
      Math.round(
        offerPrice && offerPrice < inputs.price ? offerPrice : inputs.price,
      ),
    ),
  );
  if (result.capRate != null) offerParams.set("cap", String(result.capRate));
  if (result.monthlyCashFlow != null) offerParams.set("cf", String(Math.round(result.monthlyCashFlow)));
  if (result.dscr != null) offerParams.set("dscr", String(result.dscr));
  if (offerPrice != null) offerParams.set("offer", String(offerPrice));
  offerParams.set("down", String(inputs.downPaymentPercent));
  const loginNext = returnPath ?? "/account";

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* Inputs */}
        <div className="space-y-3">
          {GROUPS.map((group) => (
            <details
              key={group.title}
              open={group.open}
              className="group rounded-lg border border-hairline bg-surface"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-ink">
                {group.title}
                <span
                  className="text-ink-faint transition-transform group-open:rotate-45"
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <div className="grid gap-x-4 gap-y-4 border-t border-hairline px-4 py-4 sm:grid-cols-2">
                {group.fields.map((spec) => (
                  <NumberField
                    key={spec.field}
                    spec={spec}
                    value={inputs[spec.field]}
                    edited={edited.has(spec.field)}
                    defaults={defaults}
                    learnedNote={
                      spec.field === "monthlyRent" &&
                      rentSourceLabel &&
                      !edited.has("monthlyRent")
                        ? rentNote
                        : learnedNote(spec.field)
                    }
                    onChange={(value) => change(spec.field, value)}
                    onReset={() => change(spec.field, defaults[spec.field])}
                  />
                ))}
              </div>
            </details>
          ))}
        </div>

        {/* Results */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-lg border border-hairline bg-surface p-5">
            <p className="tnum text-[10px] font-medium uppercase tracking-[1.3px] text-ink-faint">
              Cash flow after the mortgage
            </p>
            <p
              className={`tnum font-display mt-1 text-4xl font-semibold tracking-tight ${cashFlow != null && cashFlow < 0 ? "text-bad" : "text-ink"}`}
            >
              {cashFlow == null
                ? "—"
                : `${cashFlow < 0 ? "−" : "+"}${fmtMoney(Math.abs(cashFlow))}`}
              <span className="ml-1 text-base font-medium text-ink-faint">
                /mo
              </span>
            </p>
            <p className="mt-3 text-sm font-medium leading-snug text-ink">
              {read.headline}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              {read.detail}
            </p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat
              label="Cap rate"
              value={
                result.capRate == null ? "—" : `${result.capRate.toFixed(1)}%`
              }
              hint={
                result.noi == null
                  ? undefined
                  : `NOI ${fmtMoney(result.noi)}/yr`
              }
            />
            <Stat
              label="Cash-on-cash"
              value={
                result.cashOnCashReturn == null
                  ? "—"
                  : `${result.cashOnCashReturn.toFixed(1)}%`
              }
              tone={
                result.cashOnCashReturn != null && result.cashOnCashReturn < 0
                  ? "bad"
                  : undefined
              }
              hint={
                result.cashInvested == null
                  ? undefined
                  : `${fmtMoney(result.cashInvested)} in`
              }
            />
            <Stat
              label="Debt coverage"
              value={result.dscr == null ? "—" : result.dscr.toFixed(2)}
              tone={result.dscr != null && result.dscr < 1 ? "bad" : undefined}
              hint={
                result.monthlyDebtService == null
                  ? undefined
                  : `${fmtMoney(result.monthlyDebtService)}/mo mortgage`
              }
            />
            <Stat
              label={`IRR · ${inputs.holdPeriodYears} yrs`}
              value={result.irr == null ? "—" : `${result.irr.toFixed(1)}%`}
              tone={result.irr != null && result.irr < 0 ? "bad" : undefined}
              hint="With sale at the end"
            />
          </div>

          {/* Offer solver */}
          <div className="band-night mt-3 rounded-lg p-5">
            <p className="tnum text-[10px] font-medium uppercase tracking-[1.3px] text-ink-faint">
              What should you offer?
            </p>
            <div
              className="mt-2 flex flex-wrap gap-1.5"
              role="group"
              aria-label="Offer target"
            >
              {TARGETS.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  aria-pressed={entry.key === targetKey}
                  onClick={() => {
                    touched.current = true;
                    setTargetKey(entry.key);
                  }}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    entry.key === targetKey
                      ? "border-accent bg-accent text-white"
                      : "border-hairline-strong text-ink-soft hover:text-ink"
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            {offerPrice == null ? (
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                No price gets this rent to {target.label.toLowerCase()}. The
                rent has to move, not the price.
              </p>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                <span className="tnum font-display block text-3xl font-semibold tracking-tight text-ink">
                  {fmtMoney(offerPrice)}
                </span>
                {offerDelta != null && offerDelta < -0.5
                  ? `${Math.abs(offerDelta).toFixed(1)}% under the price above — the most you can pay and still ${target.key === "breakeven" ? "break even" : `hit ${target.label}`}.`
                  : `This deal already clears ${target.label.toLowerCase()} at the price above.`}
              </p>
            )}
          </div>

          {/* Your call + status */}
          <div className="mt-3 rounded-lg border border-hairline bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-medium text-ink-soft">
                Your call on this deal
              </p>
              <div
                className="flex gap-1.5"
                role="group"
                aria-label="Your call on this deal"
              >
                {VERDICTS.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    aria-pressed={verdict === entry.key}
                    disabled={!hasDeal}
                    onClick={() => {
                      touched.current = true;
                      setVerdict((current) =>
                        current === entry.key ? null : entry.key,
                      );
                    }}
                    className={`rounded-[3px] border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      verdict === entry.key
                        ? "border-ink bg-ink text-white"
                        : "border-hairline-strong text-ink-soft hover:border-ink hover:text-ink"
                    }`}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </div>
            {log.status === "saved" && (
              <p className="mt-3 text-xs text-ink-faint">
                <button type="button" onClick={share} className="font-medium text-brand underline-offset-2 hover:text-brand-deep hover:underline">
                  Share this analysis
                </button>
                {shareNote && (
                  <span role="status" className="ml-2 break-all text-ink-soft">
                    {shareNote}
                  </span>
                )}
              </p>
            )}
            {log.badgeEarned && (
              <p role="status" className="mt-3 flex items-center gap-2.5 rounded-[3px] bg-ink px-3 py-2.5 text-sm font-semibold text-white">
                <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                Badge earned: {log.badgeEarned}.
                <Link href="/community/leaderboard" className="ml-auto text-xs font-medium text-white/80 underline-offset-2 hover:text-white hover:underline">
                  See the board →
                </Link>
              </p>
            )}
            <p
              role="status"
              className="mt-3 min-h-[1.25rem] text-xs leading-relaxed text-ink-faint"
            >
              {!hasDeal && "Add an address to log this analysis."}
              {hasDeal &&
                log.status === "idle" &&
                "Change a number or make your call and this analysis is logged to your history."}
              {log.status === "saving" && "Logging…"}
              {log.status === "error" && (
                <span className="text-bad">{log.message}</span>
              )}
              {log.status === "saved" && (
                <>
                  Logged
                  {log.deals
                    ? ` · ${log.deals} ${log.deals === 1 ? "deal" : "deals"} underwritten`
                    : ""}
                  {log.streakWeeks && log.streakWeeks > 1
                    ? ` · ${log.streakWeeks}-week streak`
                    : ""}
                  .{" "}
                  {log.signedIn === false ? (
                    <Link
                      href={`/login?next=${encodeURIComponent(loginNext)}`}
                      className="font-medium text-brand hover:text-brand-deep"
                    >
                      Create a free account to keep it and join the leaderboard
                      →
                    </Link>
                  ) : (
                    <Link
                      href="/community/leaderboard"
                      className="font-medium text-brand hover:text-brand-deep"
                    >
                      See where you rank →
                    </Link>
                  )}
                </>
              )}
            </p>
          </div>

          {/* Next step */}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Link
              href={`/work-with-us?${offerParams.toString()}#lead-form`}
              className="rounded-[3px] bg-brand px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-deep"
            >
              Make an offer with cash back
            </Link>
            <Link
              href={`/work-with-us?${offerParams.toString()}&want=showing#lead-form`}
              className="rounded-[3px] border border-hairline-strong bg-surface px-4 py-3 text-center text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand"
            >
              Book one showing
            </Link>
          </div>
          <Link
            href={`/work-with-us?${offerParams.toString()}&want=financing#lead-form`}
            className="mt-2 block text-center text-xs font-medium text-ink-soft underline-offset-2 hover:text-brand hover:underline"
          >
            Or talk to a mortgage broker about financing this deal →
          </Link>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            Estimates for ranking deals, not advice. Mortgage payments use
            Canadian semi-annual compounding.
          </p>
        </div>
      </div>
      {result.assumptionsComplete && (
        <DealMemoPanel
          deal={memoDeal}
          mlsNumber={deal.mlsNumber}
          inputs={inputs}
          aiAvailable={aiAvailable}
          locked={visitor.signedIn === false && visitor.otherDeals >= GUEST_FULL_MEMOS}
          loginHref={`/login?next=${encodeURIComponent(loginNext)}`}
        />
      )}
    </>
  );
}
