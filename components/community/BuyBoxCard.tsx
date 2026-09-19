import Link from "next/link";
import { ListingCard } from "@/components/listings/ListingCard";
import { DdfAttribution } from "@/components/listings/DdfAttribution";
import type { ListingSearchResult } from "@/components/listings/listingDisplay";
import { MIN_PURSUED, describeBuyBox, type BuyBox } from "@/lib/analyses/thesis";

/**
 * What the member buys, learned from the calls they've made — and the active
 * listings that fit it. Nobody filled in a form to get this.
 */
export function BuyBoxCard({ box, pursued, deals }: { box: BuyBox | null; pursued: number; deals: ListingSearchResult[] }) {
  if (!box) {
    const left = Math.max(1, MIN_PURSUED - pursued);
    return (
      <div className="rounded-lg border border-dashed border-hairline-strong bg-surface p-5">
        <p className="text-sm font-semibold text-ink">Your buy box builds itself.</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
          Make your call — pursue, watch or pass — on the deals you underwrite. {left === MIN_PURSUED ? `After ${MIN_PURSUED} you'd pursue` : `${left} more you'd pursue and`}{" "}
          we&rsquo;ll know where you look, what you pay and the return you need, and start bringing you listings that fit.
        </p>
        <Link href="/listings" className="mt-3 inline-block text-sm font-semibold text-brand hover:text-brand-deep">
          Find a deal to call →
        </Link>
      </div>
    );
  }
  return (
    <div>
      <div className="rounded-lg border border-hairline bg-surface p-5">
        <p className="tnum text-[10px] font-medium uppercase tracking-[1.3px] text-ink-faint">Learned from your {box.calls} calls</p>
        <p className="font-display mt-2 text-lg font-semibold leading-snug tracking-tight">{describeBuyBox(box)}</p>
        <p className="mt-2 text-xs leading-relaxed text-ink-faint">
          It sharpens with every call you make. Not you? Pass on what you wouldn&rsquo;t buy and it corrects itself.
        </p>
      </div>
      {deals.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-semibold text-ink">
            {deals.length} {deals.length === 1 ? "listing fits" : "listings fit"} your box that you haven&rsquo;t looked at
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {deals.map((listing) => (
              <ListingCard key={listing.mlsNumber} listing={listing} />
            ))}
          </div>
          <div className="mt-4">
            <DdfAttribution />
          </div>
        </div>
      )}
    </div>
  );
}
