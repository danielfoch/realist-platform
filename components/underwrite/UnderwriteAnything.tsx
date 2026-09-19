"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { inputClass, labelClass, primaryButtonClass } from "@/components/auth/shared";
import { houseDefaults, type LearnedDefaults } from "@/lib/underwriting/underwriter";
import { Underwriter } from "./Underwriter";

/**
 * Underwrite a deal that isn't a listing: off-market, a wholesaler's email, a
 * house you drove past. Step one is the four facts everything else is derived
 * from; step two is the same underwriter every listing page has. Deep-linkable
 * (?address=&city=&province=&price=&rent=&units=).
 */

const PROVINCES = ["ON", "BC", "AB", "QC", "MB", "SK", "NS", "NB", "NL", "PE", "YT", "NT", "NU"] as const;

interface Basics {
  address: string;
  city: string;
  province: string;
  price: number;
  rent: number;
  units: number;
}

function numberFrom(value: string | null): number {
  const parsed = Number((value ?? "").replace(/[,$\s]/g, ""));
  return isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function UnderwriteAnything({ learned: national, aiAvailable = false }: { learned: LearnedDefaults; aiAvailable?: boolean }) {
  // Starts from what the whole country has taught; a market's own values replace it once we know the market.
  const [learned, setLearned] = useState<LearnedDefaults>(national);
  const params = useSearchParams();
  const fromLink: Basics = {
    address: params.get("address")?.slice(0, 300) ?? "",
    city: params.get("city")?.slice(0, 120) ?? "",
    province: PROVINCES.includes((params.get("province") ?? "") as (typeof PROVINCES)[number]) ? (params.get("province") as string) : "",
    price: numberFrom(params.get("price")),
    rent: numberFrom(params.get("rent")),
    units: Math.max(1, Math.round(numberFrom(params.get("units")) || 1)),
  };
  const linkComplete = fromLink.address.length >= 5 && fromLink.price > 0 && fromLink.rent > 0;
  const [basics, setBasics] = useState<Basics | null>(linkComplete ? fromLink : null);
  const [error, setError] = useState<string | null>(null);

  function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next: Basics = {
      address: String(data.get("address") ?? "").trim(),
      city: String(data.get("city") ?? "").trim(),
      province: String(data.get("province") ?? ""),
      price: numberFrom(String(data.get("price") ?? "")),
      rent: numberFrom(String(data.get("rent") ?? "")),
      units: Math.max(1, Math.round(numberFrom(String(data.get("units") ?? "")) || 1)),
    };
    if (next.address.length < 5) return setError("Add the address — it's how this deal is saved to your history.");
    if (!(next.price >= 1000)) return setError("Add the price you'd pay.");
    if (!(next.rent > 0)) return setError("Add the rent you expect, all units combined. A rough number is fine — you can change it.");
    setError(null);
    if (next.province) {
      // Fetched BEFORE the underwriter opens: changing its defaults afterwards would wipe the person's edits.
      const query = new URLSearchParams({ province: next.province, ...(next.city ? { city: next.city } : {}) });
      fetch(`/api/analyses/defaults?${query}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((body: { learned?: LearnedDefaults } | null) => {
          if (body?.learned) setLearned(body.learned);
        })
        .catch(() => {})
        .finally(() => setBasics(next));
      return;
    }
    setBasics(next);
  }

  if (!basics) {
    return (
      <form onSubmit={start} className="mx-auto max-w-2xl rounded-lg border border-hairline bg-surface p-6">
        <p className="tnum text-[10px] font-medium uppercase tracking-[1.3px] text-brand">Step 1 of 2 · the basics</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-6">
          <label className={`${labelClass} sm:col-span-6`}>
            Address
            <input name="address" type="text" required maxLength={300} defaultValue={fromLink.address} placeholder="123 Example St" autoComplete="off" className={inputClass} />
          </label>
          <label className={`${labelClass} sm:col-span-4`}>
            City
            <input name="city" type="text" maxLength={120} defaultValue={fromLink.city} placeholder="Hamilton" className={inputClass} />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Province
            <select name="province" defaultValue={fromLink.province} className={inputClass}>
              <option value="">—</option>
              {PROVINCES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Price
            <input name="price" type="text" inputMode="numeric" required defaultValue={fromLink.price || ""} placeholder="750,000" className={`${inputClass} tnum`} />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Total rent / month
            <input name="rent" type="text" inputMode="numeric" required defaultValue={fromLink.rent || ""} placeholder="4,200" className={`${inputClass} tnum`} />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Units
            <input name="units" type="text" inputMode="numeric" defaultValue={fromLink.units} className={`${inputClass} tnum`} />
          </label>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-bad">
            {error}
          </p>
        )}
        <button type="submit" className={`${primaryButtonClass} mt-5 w-full sm:w-auto`}>
          Underwrite it →
        </button>
        <p className="mt-3 text-xs leading-relaxed text-ink-faint">
          Tax, insurance, closing costs and financing start from sensible values for the price you enter. You can change every one.
        </p>
      </form>
    );
  }

  const fullAddress = [basics.address, basics.city, basics.province].filter(Boolean).join(", ");
  const back = new URLSearchParams({ address: basics.address, price: String(basics.price), rent: String(basics.rent), units: String(basics.units) });
  if (basics.city) back.set("city", basics.city);
  if (basics.province) back.set("province", basics.province);
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm text-ink-soft">
          <span className="font-semibold text-ink">{fullAddress}</span>
        </p>
        <button type="button" onClick={() => setBasics(null)} className="text-xs font-medium text-brand hover:text-brand-deep">
          ← Different deal
        </button>
      </div>
      <Underwriter
        key={`${fullAddress}|${basics.price}|${basics.rent}|${basics.units}`}
        deal={{ source: "manual", address: fullAddress, city: basics.city || null, province: basics.province || null }}
        defaults={houseDefaults({ price: basics.price, monthlyRent: basics.rent, units: basics.units, province: basics.province || null, city: basics.city || null }, learned)}
        learned={learned}
        taxFromListing={false}
        aiAvailable={aiAvailable}
        returnPath={`/underwrite?${back.toString()}`}
      />
    </div>
  );
}
