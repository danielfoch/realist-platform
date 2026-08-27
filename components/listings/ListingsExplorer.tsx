"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { DdfAttribution } from "./DdfAttribution";
import { ListingResultsGrid, ListingResultsSkeleton } from "./ListingResultsGrid";
import type { ListingSearchResponse } from "./listingDisplay";

const PROVINCES = [
  "Alberta",
  "British Columbia",
  "Manitoba",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Northwest Territories",
  "Nova Scotia",
  "Nunavut",
  "Ontario",
  "Prince Edward Island",
  "Quebec",
  "Saskatchewan",
  "Yukon",
] as const;

interface Filters {
  city: string;
  province: string;
  minPrice: string;
  maxPrice: string;
  minBeds: string;
  multiUnit: boolean;
}

const EMPTY_FILTERS: Filters = {
  city: "",
  province: "",
  minPrice: "",
  maxPrice: "",
  minBeds: "",
  multiUnit: false,
};

type Status = "loading" | "ready" | "error" | "unconfigured";

function buildRequestBody(filters: Filters, page: number): Record<string, unknown> {
  const body: Record<string, unknown> = { page };
  if (filters.city.trim()) body.city = filters.city.trim();
  if (filters.province) body.province = filters.province;
  const minPrice = Number(filters.minPrice);
  if (minPrice > 0) body.minPrice = minPrice;
  const maxPrice = Number(filters.maxPrice);
  if (maxPrice > 0) body.maxPrice = maxPrice;
  const minBeds = Number(filters.minBeds);
  if (minBeds > 0) body.minBeds = minBeds;
  if (filters.multiUnit) body.minUnits = 2;
  return body;
}

const inputClass =
  "w-full rounded-md border border-hairline-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none";

export function ListingsExplorer() {
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<ListingSearchResponse | null>(null);
  const requestIdRef = useRef(0);

  const runSearch = useCallback(async (filters: Filters, nextPage: number) => {
    const requestId = ++requestIdRef.current;
    setStatus("loading");
    try {
      const response = await fetch("/api/listings/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestBody(filters, nextPage)),
      });
      if (requestId !== requestIdRef.current) return;
      if (response.status === 503) {
        setStatus("unconfigured");
        return;
      }
      if (!response.ok) {
        setStatus("error");
        return;
      }
      const payload = (await response.json()) as ListingSearchResponse;
      if (requestId !== requestIdRef.current) return;
      setData(payload);
      setStatus("ready");
    } catch {
      if (requestId === requestIdRef.current) setStatus("error");
    }
  }, []);

  useEffect(() => {
    runSearch(EMPTY_FILTERS, 1);
  }, [runSearch]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setApplied(draft);
    setPage(1);
    runSearch(draft, 1);
  };

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    runSearch(applied, nextPage);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.count / data.pageSize)) : 1;
  const latestUpdate = data?.listings.reduce<string | null>(
    (latest, listing) =>
      listing.modificationTimestamp && (!latest || listing.modificationTimestamp > latest)
        ? listing.modificationTimestamp
        : latest,
    null,
  );

  return (
    <div>
      {/* Filter bar */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-hairline bg-surface p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label htmlFor="listings-city" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
              City
            </label>
            <input
              id="listings-city"
              type="text"
              placeholder="e.g. Hamilton"
              value={draft.city}
              onChange={(e) => setDraft({ ...draft, city: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="listings-province" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Province
            </label>
            <select
              id="listings-province"
              value={draft.province}
              onChange={(e) => setDraft({ ...draft, province: e.target.value })}
              className={inputClass}
            >
              <option value="">All of Canada</option>
              {PROVINCES.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="listings-min-price" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Min price
            </label>
            <input
              id="listings-min-price"
              type="number"
              inputMode="numeric"
              min={0}
              step={25000}
              placeholder="$"
              value={draft.minPrice}
              onChange={(e) => setDraft({ ...draft, minPrice: e.target.value })}
              className={`${inputClass} tnum`}
            />
          </div>
          <div>
            <label htmlFor="listings-max-price" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Max price
            </label>
            <input
              id="listings-max-price"
              type="number"
              inputMode="numeric"
              min={0}
              step={25000}
              placeholder="$"
              value={draft.maxPrice}
              onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })}
              className={`${inputClass} tnum`}
            />
          </div>
          <div>
            <label htmlFor="listings-beds" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Beds
            </label>
            <select
              id="listings-beds"
              value={draft.minBeds}
              onChange={(e) => setDraft({ ...draft, minBeds: e.target.value })}
              className={inputClass}
            >
              <option value="">Any</option>
              <option value="1">1+</option>
              <option value="2">2+</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            className="rounded-md bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-deep"
          >
            Search listings
          </button>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={draft.multiUnit}
              onChange={(e) => setDraft({ ...draft, multiUnit: e.target.checked })}
              className="h-4 w-4 accent-[#0f766e]"
            />
            Multi-unit only (2+ units)
          </label>
          <Link
            href="/deals"
            className="ml-auto text-sm font-semibold text-signal hover:brightness-90"
          >
            Motivated deals →
          </Link>
        </div>
      </form>

      {/* Results */}
      <div className="mt-8">
        {status === "loading" && <ListingResultsSkeleton />}

        {status === "unconfigured" && (
          <div className="rounded-xl border border-dashed border-hairline-strong bg-surface p-10 text-center">
            <h2 className="font-display text-xl font-semibold">
              Listing search is warming up
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
              The live MLS® feed isn&rsquo;t connected in this environment yet.
              While we finish wiring it up, the other tools are fully live.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Link
                href="/multiplex"
                className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep"
              >
                Underwrite a multiplex
              </Link>
              <Link
                href="/deals"
                className="rounded-md border border-hairline-strong px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand hover:text-brand"
              >
                Find motivated deals
              </Link>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="rounded-xl border border-bad/30 bg-surface p-8 text-center">
            <p className="text-sm font-medium text-bad">
              Listing search hit a snag. Give it a second and try again.
            </p>
            <button
              type="button"
              onClick={() => runSearch(applied, page)}
              className="mt-4 rounded-md border border-hairline-strong px-4 py-2 text-sm font-semibold text-ink hover:border-brand hover:text-brand"
            >
              Retry search
            </button>
          </div>
        )}

        {status === "ready" && data && data.listings.length === 0 && (
          <div className="rounded-xl border border-dashed border-hairline-strong bg-surface p-10 text-center">
            <p className="font-display text-lg font-semibold">No listings match</p>
            <p className="mt-1 text-sm text-ink-soft">
              Widen the price range or clear a filter — the feed covers all of
              Canada.
            </p>
          </div>
        )}

        {status === "ready" && data && data.listings.length > 0 && (
          <>
            <p className="tnum mb-4 text-sm text-ink-faint">
              {data.count.toLocaleString("en-CA")} listings · page {data.page} of{" "}
              {totalPages}
            </p>
            <ListingResultsGrid listings={data.listings} />
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
                className="rounded-md border border-hairline-strong px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Previous
              </button>
              <span className="tnum text-sm text-ink-faint">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => goToPage(page + 1)}
                className="rounded-md border border-hairline-strong px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>

      <div className="mt-10">
        <DdfAttribution lastUpdated={latestUpdate ?? undefined} />
      </div>
    </div>
  );
}
