"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { fmtMoney } from "@/components/multiplex/format";

interface DealListing {
  listingKey: string;
  mlsNumber?: string;
  listPrice?: number;
  address?: {
    streetNumber?: string;
    streetName?: string;
    streetSuffix?: string;
    unitNumber?: string;
    city?: string;
    state?: string;
  };
  daysOnMarket?: number;
  distress: {
    distressScore: number;
    confidence: string;
    categoriesTriggered: Record<string, boolean>;
    matchedTerms: Array<{ term: string; category: string }>;
  };
  rawRemarks: string;
}

interface ApiResponse {
  warming?: boolean;
  listings?: DealListing[];
  total?: number;
  totalScanned?: number;
  updatedAt?: string;
  stale?: boolean;
  error?: string;
}

const CATEGORIES = [
  { key: "foreclosure_pos", label: "Power of sale" },
  { key: "vtb", label: "Vendor take-back" },
  { key: "motivated", label: "Motivated seller" },
] as const;

const PROVINCES = ["ON", "BC", "AB", "SK", "MB", "QC", "NB", "NS", "PE", "NL"];

function addressLine(listing: DealListing): string {
  const a = listing.address ?? {};
  const parts = [a.streetNumber, a.streetName, a.streetSuffix].filter(Boolean).join(" ");
  const unit = a.unitNumber ? `${a.unitNumber} — ` : "";
  return `${unit}${parts}`.trim() || listing.mlsNumber || listing.listingKey;
}

function ScoreBadge({ score, confidence }: { score: number; confidence: string }) {
  const tone =
    confidence === "high"
      ? "bg-brand text-white"
      : confidence === "medium"
        ? "bg-signal-wash text-signal"
        : "bg-paper text-ink-faint border border-hairline";
  return (
    <span className={`tnum rounded-md px-2 py-1 text-xs font-bold ${tone}`}>
      {score}/100 · {confidence}
    </span>
  );
}

export function DealsExplorer() {
  const [categories, setCategories] = useState<string[]>([]);
  const [province, setProvince] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (categories.length) params.set("categories", categories.join(","));
      if (province) params.set("province", province);
      const response = await fetch(`/api/deals?${params.toString()}`);
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok) throw new Error(payload.error ?? "Feed unavailable");
      setData(payload);
      if (payload.warming) {
        pollRef.current = setTimeout(() => void load(), 15000);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [categories, province]);

  useEffect(() => {
    void load();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [load]);

  const toggleCategory = (key: string) => {
    setCategories((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map((category) => {
          const active = categories.includes(category.key);
          return (
            <button
              key={category.key}
              type="button"
              onClick={() => toggleCategory(category.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                active
                  ? "bg-brand text-white"
                  : "border border-hairline-strong bg-surface text-ink-soft hover:border-brand hover:text-brand"
              }`}
            >
              {category.label}
            </button>
          );
        })}
        <select
          value={province}
          onChange={(e) => setProvince(e.target.value)}
          className="ml-auto rounded-md border border-hairline-strong bg-surface px-3 py-1.5 text-sm"
          aria-label="Province"
        >
          <option value="">All provinces</option>
          {PROVINCES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </div>

      {data?.updatedAt && (
        <p className="tnum mt-3 text-xs text-ink-faint">
          {data.total} qualified deals from {data.totalScanned?.toLocaleString("en-CA")} scanned
          listings · updated{" "}
          {new Date(data.updatedAt).toLocaleString("en-CA", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
          {data.stale ? " · refreshing in background" : ""}
        </p>
      )}

      {loading && !data && (
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-hairline bg-surface" />
          ))}
        </div>
      )}

      {error && (
        <p className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-bad">{error}</p>
      )}

      {data?.warming && (
        <div className="mt-6 rounded-xl border border-hairline bg-surface p-6 text-center">
          <p className="font-display text-lg font-semibold">Scanning the MLS® right now…</p>
          <p className="mt-1 text-sm text-ink-soft">
            First scan takes a few minutes — we&rsquo;re reading remarks on thousands of
            listings for power-of-sale, VTB, and motivated-seller language.
          </p>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {data?.listings?.map((listing) => {
          const triggered = CATEGORIES.filter(
            (category) => listing.distress.categoriesTriggered?.[category.key],
          );
          return (
            <article
              key={listing.listingKey}
              className="rounded-xl border border-hairline bg-surface p-5 transition-shadow hover:shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold">
                    <Link href={`/listings/${listing.listingKey}`} className="hover:text-brand">
                      {addressLine(listing)}
                    </Link>
                  </h3>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {[listing.address?.city, listing.address?.state].filter(Boolean).join(", ")}
                    {listing.daysOnMarket != null && (
                      <span className="tnum"> · {listing.daysOnMarket} DOM</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tnum font-display text-lg font-semibold">
                    {fmtMoney(listing.listPrice ?? null, true)}
                  </span>
                  <ScoreBadge
                    score={listing.distress.distressScore}
                    confidence={listing.distress.confidence}
                  />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {triggered.map((category) => (
                  <span
                    key={category.key}
                    className="rounded-full bg-brand-wash px-2 py-0.5 text-[11px] font-semibold text-brand-deep"
                  >
                    {category.label}
                  </span>
                ))}
                {listing.distress.matchedTerms.slice(0, 4).map((term) => (
                  <span
                    key={term.term}
                    className="rounded-full border border-hairline px-2 py-0.5 text-[11px] text-ink-faint"
                  >
                    “{term.term}”
                  </span>
                ))}
              </div>
              {listing.rawRemarks && (
                <p className="mt-2 line-clamp-2 text-sm text-ink-faint">{listing.rawRemarks}</p>
              )}
            </article>
          );
        })}
      </div>

      {data?.listings && data.listings.length === 0 && !data.warming && (
        <p className="mt-8 text-center text-sm text-ink-soft">
          No qualified deals match those filters right now — the scan refreshes twice a day.
        </p>
      )}
    </div>
  );
}
