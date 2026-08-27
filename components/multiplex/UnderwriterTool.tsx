"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { UnderwriteReport, type UnderwritePayload } from "./UnderwriteReport";

interface NeedsDimsPayload {
  status: "needs_lot_dimensions";
  site: {
    address?: string;
    lat: number | null;
    lng: number | null;
    zoning: { zoneCode?: string } | null;
    notes?: string[];
  };
  message: string;
}

type ApiPayload = UnderwritePayload | NeedsDimsPayload;

const MLI_LEVELS = {
  affordability: ["None", "10% affordable", "15% affordable", "20%+ affordable"],
  energy: ["None", "20% better", "25% better", "40% better"],
  accessibility: ["None", "Visitable", "Full universal design"],
};

export function UnderwriterTool() {
  const searchParams = useSearchParams();
  const [address, setAddress] = useState(searchParams.get("address") ?? "");
  const [frontage, setFrontage] = useState(searchParams.get("frontage") ?? "");
  const [depth, setDepth] = useState(searchParams.get("depth") ?? "");
  const [price, setPrice] = useState(searchParams.get("price") ?? "");
  const [laneAccess, setLaneAccess] = useState(false);
  const [affordability, setAffordability] = useState(1);
  const [energy, setEnergy] = useState(1);
  const [accessibility, setAccessibility] = useState(0);
  const [showMli, setShowMli] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UnderwritePayload | null>(null);
  const [siteConfirm, setSiteConfirm] = useState<NeedsDimsPayload | null>(null);

  async function run() {
    if (address.trim().length < 5) {
      setError("Enter a Toronto street address (e.g. 82 Oakcrest Ave).");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const body: Record<string, unknown> = { address: address.trim() };
      if (frontage) body.lotFrontageFt = Number(frontage);
      if (depth) body.lotDepthFt = Number(depth);
      if (price) body.purchasePrice = Number(price);
      if (laneAccess) body.laneAccess = true;
      body.mliCommitments = {
        affordabilityLevel: affordability,
        energyLevel: energy,
        accessibilityLevel: accessibility,
      };

      const response = await fetch("/api/multiplex/underwrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as ApiPayload & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Underwrite failed — please try again.");
      }
      if (payload.status === "needs_lot_dimensions") {
        setSiteConfirm(payload);
      } else {
        setSiteConfirm(null);
        setResult(payload);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="rounded-xl border border-hairline bg-surface p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Toronto address
            </span>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="82 Oakcrest Ave, Toronto"
              className="mt-1 w-full rounded-md border border-hairline-strong bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Frontage (ft)
            </span>
            <input
              type="number"
              value={frontage}
              onChange={(e) => setFrontage(e.target.value)}
              placeholder="25"
              className="tnum mt-1 w-full rounded-md border border-hairline-strong bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Depth (ft)
            </span>
            <input
              type="number"
              value={depth}
              onChange={(e) => setDepth(e.target.value)}
              placeholder="100"
              className="tnum mt-1 w-full rounded-md border border-hairline-strong bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
          </label>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Purchase price (optional)
            </span>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="1,250,000"
              className="tnum mt-1 w-full rounded-md border border-hairline-strong bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="flex items-end gap-2 pb-2.5">
            <input
              type="checkbox"
              checked={laneAccess}
              onChange={(e) => setLaneAccess(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-brand)]"
            />
            <span className="text-sm text-ink-soft">Rear lane access</span>
          </label>
          <button
            type="button"
            onClick={() => setShowMli((v) => !v)}
            className="pb-2.5 text-left text-sm font-semibold text-brand hover:text-brand-deep"
          >
            {showMli ? "Hide" : "Tune"} MLI Select commitments
          </button>
        </div>

        {showMli && (
          <div className="mt-3 grid gap-3 rounded-lg border border-hairline bg-paper p-4 sm:grid-cols-3">
            {(
              [
                ["Affordability", MLI_LEVELS.affordability, affordability, setAffordability],
                ["Energy efficiency", MLI_LEVELS.energy, energy, setEnergy],
                ["Accessibility", MLI_LEVELS.accessibility, accessibility, setAccessibility],
              ] as const
            ).map(([label, options, value, setter]) => (
              <label key={label} className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                  {label}
                </span>
                <select
                  value={value}
                  onChange={(e) => (setter as (n: number) => void)(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-hairline-strong bg-surface px-2 py-2 text-sm"
                >
                  {options.map((option, index) => (
                    <option key={option} value={index}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <p className="text-xs text-ink-faint sm:col-span-3">
              CMHC MLI Select scores affordability, energy, and accessibility commitments —
              100 points unlocks 95% LTV and 50-year amortization on 5+ unit buildings.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="mt-4 w-full rounded-md bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60 sm:w-auto"
        >
          {loading ? "Underwriting…" : "Underwrite this site"}
        </button>

        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-bad">{error}</p>
        )}

        {siteConfirm && (
          <div className="mt-4 rounded-lg border border-brand/40 bg-brand-wash/40 p-4">
            <p className="text-sm font-semibold">
              Site resolved{siteConfirm.site.zoning?.zoneCode ? ` — zone ${siteConfirm.site.zoning.zoneCode}` : ""}.
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Add the lot frontage and depth above (from the listing, GeoWarehouse, or the
              survey) and run again for the full underwrite.
            </p>
          </div>
        )}
      </div>

      {loading && (
        <div className="mt-8 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-hairline bg-surface" />
          ))}
          <p className="text-center text-sm text-ink-faint">
            Resolving zoning, ward, heritage, and running {""}
            the proforma — usually 10–30 seconds…
          </p>
        </div>
      )}

      {result && (
        <div className="mt-10">
          <UnderwriteReport payload={result} />
        </div>
      )}
    </div>
  );
}
