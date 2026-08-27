import { ListingCard } from "./ListingCard";
import type { ListingSearchResult } from "./listingDisplay";

/**
 * The results grid stands alone (rather than living inside the explorer) so a
 * future map pane can sit beside it in a two-pane layout without touching the
 * card markup or the filter logic.
 */
export function ListingResultsGrid({ listings }: { listings: ListingSearchResult[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing) => (
        <ListingCard key={listing.mlsNumber} listing={listing} />
      ))}
    </div>
  );
}

export function ListingResultsSkeleton({ cards = 9 }: { cards?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-hairline bg-surface">
          <div className="aspect-[4/3] w-full bg-paper" />
          <div className="space-y-2 p-4">
            <div className="h-5 w-28 rounded bg-paper" />
            <div className="h-4 w-3/4 rounded bg-paper" />
            <div className="h-3 w-1/2 rounded bg-paper" />
            <div className="mt-3 grid grid-cols-4 gap-3 border-t border-hairline pt-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-8 rounded bg-paper" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
