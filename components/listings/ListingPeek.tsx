import Link from "next/link";
import { fmtMoney } from "@/components/multiplex/format";
import { filterListingPhotos, fmtYield, listingStreetLine, type ListingSearchResult } from "./listingDisplay";

/**
 * The card a pin brings up over the map on a phone: one line of photo, price
 * and the three numbers, short enough to leave the map in view. The whole strip
 * is the link. Brokerage credit included — a listing is never shown without it.
 */
export function ListingPeek({ listing, onClose }: { listing: ListingSearchResult; onClose: () => void }) {
  const photo = filterListingPhotos(listing.images, 1)[0];
  const street = listingStreetLine(listing.address) || `MLS® ${listing.mlsNumber}`;
  const uw = listing.underwrite;
  const cashFlow = uw?.cashFlowMonthly ?? null;
  return (
    <div className="relative overflow-hidden rounded-xl border border-hairline bg-surface shadow-lg">
      <Link href={`/listings/${encodeURIComponent(listing.mlsNumber)}`} className="flex gap-3 p-2.5 pr-9">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-24 w-24 shrink-0 rounded-lg object-cover" loading="lazy" />
        ) : (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-paper text-[10px] text-ink-faint">No photo</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="tnum font-display text-lg font-semibold leading-tight">{fmtMoney(listing.listPrice)}</p>
          <p className="truncate text-sm text-ink">{street}</p>
          <p className="truncate text-xs text-ink-faint">{[listing.address.city, listing.address.state].filter(Boolean).join(", ")}</p>
          <p className="tnum mt-1 truncate text-xs text-ink-soft">
            {uw ? `${fmtMoney(uw.estimatedRent)}/mo rent · ${fmtYield(uw.netYield)} net` : "Not underwritten yet"}
            {cashFlow != null && (
              <>
                {" · "}
                <span className={cashFlow >= 0 ? "text-good" : "text-bad"}>{fmtMoney(cashFlow)}/mo</span>
              </>
            )}
          </p>
          {listing.listOfficeName && <p className="mt-0.5 truncate text-[10px] text-ink-faint">Courtesy of {listing.listOfficeName}</p>}
        </div>
      </Link>
      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-paper text-base leading-none text-ink-soft hover:text-ink">
        ×
      </button>
    </div>
  );
}
