"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { DdfAttribution } from "./DdfAttribution";
import { ListingCard } from "./ListingCard";
import { ListingPeek } from "./ListingPeek";
import { ListingResultsSkeleton } from "./ListingResultsGrid";
import { ListingsMap, type MapBounds } from "./ListingsMap";
import type { ListingSearchResponse } from "./listingDisplay";

/**
 * Listings, one page: the map and the list side by side, always showing the
 * same listings. Hover a card and its pin lights up; click a pin and its card
 * comes to you; move the map and the list follows. On a phone it is one or the
 * other, with a single button to flip — never a second page.
 */

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
  /** "newest" = the live feed's order; "yield" = highest net yield first. */
  sort: "newest" | "yield";
  minYield: string;
}

const EMPTY_FILTERS: Filters = { city: "", province: "", minPrice: "", maxPrice: "", minBeds: "", multiUnit: false, sort: "newest", minYield: "" };

type Status = "loading" | "ready" | "error" | "unconfigured";

function buildRequestBody(filters: Filters, page: number, area: MapBounds | null): Record<string, unknown> {
  const body: Record<string, unknown> = { page };
  // Once someone moves the map, the map IS the place: a city typed earlier no longer applies.
  if (area) body.bounds = area;
  else {
    if (filters.city.trim()) body.city = filters.city.trim();
    if (filters.province) body.province = filters.province;
  }
  const minPrice = Number(filters.minPrice);
  if (minPrice > 0) body.minPrice = minPrice;
  const maxPrice = Number(filters.maxPrice);
  if (maxPrice > 0) body.maxPrice = maxPrice;
  const minBeds = Number(filters.minBeds);
  if (minBeds > 0) body.minBeds = minBeds;
  if (filters.multiUnit) body.minUnits = 2;
  if (filters.sort === "yield") body.sort = "yield";
  const minYield = Number(filters.minYield);
  if (minYield > 0) body.minYield = minYield;
  return body;
}

/** One page of results. Never throws: the outcome is a status the page can render. */
async function fetchPage(filters: Filters, page: number, area: MapBounds | null): Promise<{ status: Exclude<Status, "loading">; data?: ListingSearchResponse }> {
  try {
    const response = await fetch("/api/listings/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildRequestBody(filters, page, area)),
    });
    if (response.status === 503) return { status: "unconfigured" };
    if (!response.ok) return { status: "error" };
    return { status: "ready", data: (await response.json()) as ListingSearchResponse };
  } catch {
    return { status: "error" };
  }
}

const fieldClass = "w-full rounded-md border border-hairline-strong bg-surface px-2.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none";
const pagerClass = "rounded-md border border-hairline-strong px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40";

export function ListingsExplorer() {
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [area, setArea] = useState<MapBounds | null>(null);
  const [searchOnMove, setSearchOnMove] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<ListingSearchResponse | null>(null);
  const [activeMls, setActiveMls] = useState<string | null>(null);
  const [selectedMls, setSelectedMls] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Bumped for a NEW search (filters, page): the map frames those results. A map-area refresh leaves the frame alone.
  const [fitKey, setFitKey] = useState("");
  const requestIdRef = useRef(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  const runSearch = useCallback((filters: Filters, nextPage: number, nextArea: MapBounds | null, frame: boolean) => {
    const requestId = ++requestIdRef.current;
    setStatus("loading");
    fetchPage(filters, nextPage, nextArea).then((result) => {
      if (requestId !== requestIdRef.current) return;
      if (result.data) setData(result.data);
      setStatus(result.status);
      if (frame && result.data?.listings.length) setFitKey(`${requestId}`);
    });
  }, []);

  // The page opens in its loading state, so the first search only has to fetch — then the map frames what came back.
  useEffect(() => {
    const requestId = ++requestIdRef.current;
    fetchPage(EMPTY_FILTERS, 1, null).then((result) => {
      if (requestId !== requestIdRef.current) return;
      if (result.data) setData(result.data);
      setStatus(result.status);
      if (result.data?.listings.length) setFitKey("first");
    });
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const placeChanged = draft.city.trim() !== applied.city.trim() || draft.province !== applied.province;
    // Naming a place takes the search back from the map; changing only price or beds keeps the area being looked at.
    const nextArea = placeChanged ? null : area;
    setApplied(draft);
    setArea(nextArea);
    setPage(1);
    setFiltersOpen(false);
    runSearch(draft, 1, nextArea, !nextArea);
  };

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    runSearch(applied, nextPage, area, !area);
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleMoved = (bounds: MapBounds) => {
    if (!searchOnMove) return;
    setArea(bounds);
    setPage(1);
    runSearch(applied, 1, bounds, false);
  };

  const handleSelect = (mlsNumber: string) => {
    setSelectedMls(mlsNumber);
    setActiveMls(mlsNumber);
    cardRefs.current.get(mlsNumber)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const clearArea = () => {
    setArea(null);
    setPage(1);
    runSearch(applied, 1, null, true);
  };

  const listings = data?.listings ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.count / data.pageSize)) : 1;
  const latestUpdate = listings.reduce<string | null>(
    (latest, listing) => (listing.modificationTimestamp && (!latest || listing.modificationTimestamp > latest) ? listing.modificationTimestamp : latest),
    null,
  );
  const selected = selectedMls ? listings.find((listing) => listing.mlsNumber === selectedMls) : null;
  // CREA has been known to stop filtering on a field without notice; if it drops coordinates, say so rather than show the whole country.
  const areaUnsupported = Boolean(area && data?.feed?.droppedFilters.some((name) => name === "Latitude" || name === "Longitude"));

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col md:h-[calc(100dvh-5rem)]">
      {/* Filters: one row on a desktop, one line plus a drawer on a phone. */}
      <form onSubmit={handleSubmit} className="border-b border-hairline bg-surface px-3 py-2.5 sm:px-4">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1 lg:max-w-56">
            <label htmlFor="listings-city" className="sr-only">
              City
            </label>
            <input id="listings-city" type="text" placeholder="City — e.g. Hamilton" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} className={fieldClass} />
          </div>
          <div className={`${filtersOpen ? "absolute inset-x-0 top-full z-30 grid grid-cols-2 gap-2 border-b border-hairline bg-surface p-3 shadow-lg" : "hidden"} lg:static lg:flex lg:flex-1 lg:items-end lg:gap-2 lg:border-0 lg:p-0 lg:shadow-none`}>
            <div className="lg:w-40">
              <label htmlFor="listings-province" className="sr-only">
                Province
              </label>
              <select id="listings-province" value={draft.province} onChange={(e) => setDraft({ ...draft, province: e.target.value })} className={fieldClass}>
                <option value="">All of Canada</option>
                {PROVINCES.map((province) => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:w-28">
              <label htmlFor="listings-min-price" className="sr-only">
                Minimum price
              </label>
              <input id="listings-min-price" type="number" inputMode="numeric" min={0} step={25000} placeholder="Min $" value={draft.minPrice} onChange={(e) => setDraft({ ...draft, minPrice: e.target.value })} className={`${fieldClass} tnum`} />
            </div>
            <div className="lg:w-28">
              <label htmlFor="listings-max-price" className="sr-only">
                Maximum price
              </label>
              <input id="listings-max-price" type="number" inputMode="numeric" min={0} step={25000} placeholder="Max $" value={draft.maxPrice} onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })} className={`${fieldClass} tnum`} />
            </div>
            <div className="lg:w-24">
              <label htmlFor="listings-beds" className="sr-only">
                Bedrooms
              </label>
              <select id="listings-beds" value={draft.minBeds} onChange={(e) => setDraft({ ...draft, minBeds: e.target.value })} className={fieldClass}>
                <option value="">Beds</option>
                <option value="1">1+ beds</option>
                <option value="2">2+ beds</option>
                <option value="3">3+ beds</option>
                <option value="4">4+ beds</option>
              </select>
            </div>
            <div className="lg:w-32">
              <label htmlFor="listings-yield" className="sr-only">
                Minimum net yield
              </label>
              <select id="listings-yield" value={draft.minYield} onChange={(e) => setDraft({ ...draft, minYield: e.target.value, sort: e.target.value ? "yield" : draft.sort })} className={fieldClass}>
                <option value="">Any yield</option>
                <option value="4">4%+ net yield</option>
                <option value="5">5%+ net yield</option>
                <option value="6">6%+ net yield</option>
                <option value="7">7%+ net yield</option>
              </select>
            </div>
            <div className="lg:w-36">
              <label htmlFor="listings-sort" className="sr-only">
                Sort
              </label>
              <select id="listings-sort" value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: e.target.value === "yield" ? "yield" : "newest" })} className={fieldClass}>
                <option value="newest">Newest first</option>
                <option value="yield">Highest yield first</option>
              </select>
            </div>
            <label className="col-span-2 flex cursor-pointer items-center gap-2 whitespace-nowrap py-2 text-sm text-ink-soft lg:col-span-1">
              <input type="checkbox" checked={draft.multiUnit} onChange={(e) => setDraft({ ...draft, multiUnit: e.target.checked })} className="h-4 w-4 accent-[var(--color-brand)]" />
              Multi-unit
            </label>
          </div>
          <button type="button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} className="rounded-md border border-hairline-strong px-3 py-2 text-sm font-semibold text-ink lg:hidden">
            Filters
          </button>
          <button type="submit" className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-deep">
            Search
          </button>
        </div>
      </form>

      <div className="relative flex min-h-0 flex-1">
        {/* Map */}
        <div className={`relative min-w-0 flex-1 ${view === "list" ? "hidden lg:block" : "block"}`}>
          <ListingsMap listings={listings} activeMls={activeMls} fitKey={fitKey} onActive={setActiveMls} onSelect={handleSelect} onMoved={handleMoved} />
          <label className="absolute left-3 top-3 z-10 flex cursor-pointer items-center gap-2 rounded-md border border-hairline bg-surface/95 px-3 py-2 text-xs font-medium text-ink shadow-sm backdrop-blur">
            <input type="checkbox" checked={searchOnMove} onChange={(e) => setSearchOnMove(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--color-brand)]" />
            Search as I move the map
          </label>
          {status === "loading" && (
            <p role="status" className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white shadow">
              Searching…
            </p>
          )}
          {/* On a phone the map has no list beside it: the pin you tap brings its card up. */}
          {selected && (
            <div className="absolute inset-x-3 bottom-20 z-10 mx-auto max-w-md lg:hidden">
              <ListingPeek listing={selected} onClose={() => setSelectedMls(null)} />
            </div>
          )}
        </div>

        {/* List */}
        <div ref={listRef} className={`w-full overflow-y-auto bg-paper lg:w-[46%] lg:max-w-[780px] lg:border-l lg:border-hairline ${view === "map" ? "hidden lg:block" : "block"}`}>
          <div className="px-3 py-4 sm:px-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h1 className="font-display text-xl font-semibold tracking-tight">{area ? "Listings in this map area" : applied.city.trim() ? `${applied.city.trim()} listings` : "Listings, pre-underwritten"}</h1>
              <Link href="/deals" className="text-sm font-semibold text-brand hover:text-brand-deep">
                Motivated sellers →
              </Link>
            </div>
            <p className="tnum mt-1 text-sm text-ink-faint">
              {status === "ready" && data ? (
                <>
                  {data.count.toLocaleString("en-CA")} listings · page {data.page} of {totalPages}
                  {data.source === "snapshots" && applied.sort !== "yield" && !applied.minYield ? " · highest yield first while the live feed catches up" : ""}
                  {data.source === "live-ranked" ? ` · the best of the ${data.pool ?? 100} newest — the full ranking is still being indexed` : ""}
                </>
              ) : (
                "Rent, yield and cash flow at 20% down — already run on every one."
              )}
              {area && (
                <>
                  {" · "}
                  <button type="button" onClick={clearArea} className="font-medium text-brand underline-offset-2 hover:underline">
                    clear map area
                  </button>
                </>
              )}
            </p>
            {areaUnsupported && <p className="mt-2 rounded-md bg-brand-wash px-3 py-2 text-xs text-brand-deep">The feed isn&rsquo;t accepting map-area searches right now — search by city instead.</p>}

            <div className="mt-4">
              {status === "loading" && <ListingResultsSkeleton cards={6} />}

              {status === "unconfigured" && (
                <div className="rounded-xl border border-dashed border-hairline-strong bg-surface p-8 text-center">
                  <h2 className="font-display text-xl font-semibold">Listing search is warming up</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">The live MLS® feed isn&rsquo;t connected in this environment yet. The other tools are fully live.</p>
                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <Link href="/underwrite" className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep">
                      Underwrite a deal you already have
                    </Link>
                    <Link href="/deals" className="rounded-md border border-hairline-strong px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand hover:text-brand">
                      Find motivated deals
                    </Link>
                  </div>
                </div>
              )}

              {status === "error" && (
                <div className="rounded-xl border border-bad/30 bg-surface p-8 text-center">
                  <p className="text-sm font-medium text-bad">Listing search hit a snag. Give it a second and try again.</p>
                  <button type="button" onClick={() => runSearch(applied, page, area, false)} className={`mt-4 ${pagerClass}`}>
                    Retry search
                  </button>
                </div>
              )}

              {status === "ready" && listings.length === 0 && (
                <div className="rounded-xl border border-dashed border-hairline-strong bg-surface p-8 text-center">
                  <p className="font-display text-lg font-semibold">No listings match</p>
                  <p className="mt-1 text-sm text-ink-soft">{area ? "Zoom out or move the map — or clear the map area." : "Widen the price range or clear a filter — the feed covers all of Canada."}</p>
                </div>
              )}

              {status === "ready" && listings.length > 0 && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {listings.map((listing) => (
                      <div
                        key={listing.mlsNumber}
                        ref={(node) => {
                          if (node) cardRefs.current.set(listing.mlsNumber, node);
                          else cardRefs.current.delete(listing.mlsNumber);
                        }}
                        onMouseEnter={() => setActiveMls(listing.mlsNumber)}
                        onMouseLeave={() => setActiveMls(null)}
                        className={`rounded-xl transition-shadow ${activeMls === listing.mlsNumber || selectedMls === listing.mlsNumber ? "ring-2 ring-brand" : ""}`}
                      >
                        <ListingCard listing={listing} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex items-center justify-center gap-3">
                    <button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)} className={pagerClass}>
                      ← Previous
                    </button>
                    <span className="tnum text-sm text-ink-faint">
                      {page} / {totalPages}
                    </span>
                    <button type="button" disabled={page >= totalPages} onClick={() => goToPage(page + 1)} className={pagerClass}>
                      Next →
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="mt-8 pb-16 lg:pb-4">
              <DdfAttribution lastUpdated={latestUpdate ?? undefined} />
            </div>
          </div>
        </div>

        {/* One button, on a phone: the same page, the other half of it. */}
        <button
          type="button"
          onClick={() => setView((current) => (current === "list" ? "map" : "list"))}
          className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-lg lg:hidden"
        >
          {view === "list" ? "Map" : "List"}
        </button>
      </div>
    </div>
  );
}
