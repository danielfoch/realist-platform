import Link from "next/link";
import { fmtMoney } from "@/components/multiplex/format";
import {
  filterListingPhotos,
  fmtYield,
  listingStreetLine,
  type ListingSearchResult,
} from "./listingDisplay";

function UnderwriteStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
        {label}
      </p>
      <p
        className={`tnum text-sm font-semibold ${
          tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function ListingCard({ listing }: { listing: ListingSearchResult }) {
  const photo = filterListingPhotos(listing.images, 1)[0];
  const street = listingStreetLine(listing.address) || `MLS® ${listing.mlsNumber}`;
  const uw = listing.underwrite;
  const cashFlow = uw?.cashFlowMonthly ?? null;

  const facts = [
    listing.details.numBedrooms ? `${listing.details.numBedrooms} bed` : null,
    listing.details.numBathrooms ? `${listing.details.numBathrooms} bath` : null,
    listing.numberOfUnitsTotal && listing.numberOfUnitsTotal > 1
      ? `${listing.numberOfUnitsTotal} units`
      : null,
    listing.details.propertyType || null,
  ].filter(Boolean);

  return (
    <Link
      href={`/listings/${encodeURIComponent(listing.mlsNumber)}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
    >
      {photo ? (
        // DDF media URLs are external; next/image is not configured for them.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={street}
          loading="lazy"
          className="aspect-[4/3] w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center border-b border-dashed border-hairline-strong bg-paper text-xs font-medium text-ink-faint">
          No photo provided
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="tnum font-display text-xl font-semibold">
            {fmtMoney(listing.listPrice)}
          </p>
          {uw?.rentSourceLabel && (
            <span className="shrink-0 rounded-full bg-brand-wash px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-deep">
              {uw.rentSourceLabel}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm font-medium text-ink group-hover:text-brand">
          {street}
        </p>
        <p className="truncate text-xs text-ink-faint">
          {[listing.address.city, listing.address.state].filter(Boolean).join(", ")}
        </p>
        {facts.length > 0 && (
          <p className="mt-1.5 text-xs text-ink-soft">{facts.join(" · ")}</p>
        )}

        {/* Pre-underwrite strip */}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-hairline pt-3 sm:grid-cols-4">
          <UnderwriteStat
            label="Est. rent"
            value={uw ? `${fmtMoney(uw.estimatedRent)}/mo` : "—"}
          />
          <UnderwriteStat label="Gross yield" value={fmtYield(uw?.grossYield)} />
          <UnderwriteStat label="Net yield" value={fmtYield(uw?.netYield)} />
          <UnderwriteStat
            label="Cash flow"
            value={cashFlow != null ? `${fmtMoney(cashFlow)}/mo` : "—"}
            tone={cashFlow == null ? undefined : cashFlow >= 0 ? "good" : "bad"}
          />
        </div>

        {listing.listOfficeName && (
          <p className="mt-3 truncate text-[11px] text-ink-faint">
            Courtesy of {listing.listOfficeName}
          </p>
        )}
      </div>
    </Link>
  );
}
