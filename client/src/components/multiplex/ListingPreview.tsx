/**
 * Compact preview of a listing pulled from the CREA DDF feed, shown on the
 * underwriter's input step before an underwrite is spent on it. Mirrors
 * ListingSummary from server/multiplexUnderwriter.ts — only the fields the
 * feed licence lets us show.
 */
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Building2, ExternalLink, ImageOff, Loader2, MapPin, Ruler } from "lucide-react";
import type { ParsedLotDimensions } from "@shared/lotDimensions";

export interface ListingSummary {
  mlsNumber: string | null;
  listingKey: string;
  address: string;
  city: string;
  province: string;
  postalCode: string | null;
  lat: number | null;
  lng: number | null;
  listPrice: number | null;
  numberOfUnits: number | null;
  totalActualRent: number | null;
  taxAnnualAmount: number | null;
  lot: ParsedLotDimensions;
  photoUrl: string | null;
  sourceUrl: string;
  publicRemarksExcerpt: string | null;
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export function lotLabel(lot: ParsedLotDimensions): string {
  if (lot.frontageFt && lot.depthFt) return `${lot.frontageFt} × ${lot.depthFt} ft`;
  if (lot.areaSqft) return `${lot.areaSqft.toLocaleString()} sqft (area only)`;
  return "not stated";
}

export function ListingPreview({
  listing,
  inCoverage,
  busy,
  onUnderwrite,
  onOutsideCoverage,
}: {
  listing: ListingSummary;
  inCoverage: boolean;
  busy?: boolean;
  onUnderwrite: () => void;
  /** Where to send a non-Toronto listing (manual feasibility screener). */
  onOutsideCoverage: () => void;
}) {
  const hasLot = !!(listing.lot.frontageFt && listing.lot.depthFt) || !!listing.lot.areaSqft;
  return (
    <div className="rounded-lg border bg-muted/30 overflow-hidden" data-testid="listing-preview">
      <div className="grid sm:grid-cols-[160px_1fr]">
        <div className="bg-muted flex items-center justify-center min-h-[120px]">
          {listing.photoUrl ? (
            <img src={listing.photoUrl} alt={listing.address} className="h-full w-full object-cover max-h-44" loading="lazy" />
          ) : (
            <ImageOff className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="p-4 space-y-2 text-sm">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="font-semibold flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {listing.address}
                {listing.city ? <span className="font-normal text-muted-foreground">, {listing.city}</span> : null}
              </p>
              {listing.mlsNumber && <p className="text-xs text-muted-foreground">MLS® {listing.mlsNumber}</p>}
            </div>
            {listing.listPrice != null && <p className="text-lg font-bold tabular-nums">{money(listing.listPrice)}</p>}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="gap-1"><Ruler className="h-3 w-3" /> Lot {lotLabel(listing.lot)}</Badge>
            {listing.numberOfUnits != null && <Badge variant="outline" className="gap-1"><Building2 className="h-3 w-3" /> {listing.numberOfUnits} unit{listing.numberOfUnits === 1 ? "" : "s"} today</Badge>}
            {listing.totalActualRent != null && <Badge variant="outline">{money(listing.totalActualRent)}/mo rent</Badge>}
            {listing.taxAnnualAmount != null && <Badge variant="outline">{money(listing.taxAnnualAmount)} taxes</Badge>}
          </div>

          {listing.lot.note && <p className="text-xs text-muted-foreground">{listing.lot.note}</p>}

          {listing.publicRemarksExcerpt && (
            <p className="text-xs text-muted-foreground line-clamp-3">{listing.publicRemarksExcerpt}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {inCoverage ? (
              <Button size="sm" disabled={busy} onClick={onUnderwrite} data-testid="button-underwrite-listing">
                {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Underwriting…</> : <>Underwrite this listing <ArrowRight className="h-4 w-4 ml-1" /></>}
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={onOutsideCoverage}>
                Outside Toronto — open the manual screener <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            <a
              href={listing.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:underline"
            >
              View on realtor.ca <ExternalLink className="h-3 w-3" />
            </a>
            {inCoverage && !hasLot && (
              <span className="text-xs text-amber-600 dark:text-amber-400">No lot dimensions on the listing — you will be asked for them.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
