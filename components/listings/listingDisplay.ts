/**
 * Client-safe display helpers and the wire shape of /api/listings/search
 * results. Pure — no server imports — so cards, the explorer, and the
 * server-rendered detail page can all share them.
 */

import type { ListingUnderwrite } from "@/lib/underwriting/underwriteListing";

export interface ListingSearchResult {
  mlsNumber: string;
  listPrice: number;
  address: {
    streetNumber: string;
    streetName: string;
    streetSuffix: string;
    streetDirectionPrefix: string;
    streetDirection: string;
    unitNumber: string;
    city: string;
    neighborhood: string;
    state: string;
    zip: string;
  };
  map?: { latitude: number; longitude: number };
  details: {
    numBedrooms?: number;
    numBathrooms?: number;
    numBathroomsPlus?: number;
    sqft?: string;
    propertyType?: string;
    yearBuilt?: string;
    description?: string;
    numParkingSpaces?: number;
  };
  images: string[];
  taxes?: { annualAmount: number };
  daysOnMarket?: number;
  listDate?: string;
  totalActualRent?: number;
  numberOfUnitsTotal?: number;
  listOfficeName?: string;
  modificationTimestamp?: string;
  underwrite: ListingUnderwrite | null;
}

export interface ListingSearchResponse {
  listings: ListingSearchResult[];
  count: number;
  page: number;
  pageSize: number;
}

/** Tour/floor-plan generators that show up in Media but aren't photos. */
const JUNK_PHOTO_FRAGMENTS = ["youriguide", "virtualtour"];

export function filterListingPhotos(images: string[], max = 6): string[] {
  return images
    .filter((url) => {
      const lower = url.toLowerCase();
      return !JUNK_PHOTO_FRAGMENTS.some((fragment) => lower.includes(fragment));
    })
    .slice(0, max);
}

/** Street line, e.g. "12 - 34 King St W". */
export function listingStreetLine(address: ListingSearchResult["address"]): string {
  const street = [
    address.streetNumber,
    address.streetDirectionPrefix,
    address.streetName,
    address.streetSuffix,
    address.streetDirection,
  ]
    .filter(Boolean)
    .join(" ");
  return [address.unitNumber, street].filter(Boolean).join(" - ");
}

/** Full display address, e.g. "34 King St W, Toronto, ON". */
export function listingFullAddress(address: ListingSearchResult["address"]): string {
  return [listingStreetLine(address), address.city, address.state]
    .filter(Boolean)
    .join(", ");
}

/** Yields arrive as percent values (5.2 means 5.2%), unlike fmtPct's ratios. */
export function fmtYield(value: number | null | undefined, digits = 1): string {
  if (value == null || !isFinite(value) || value === 0) return "—";
  return `${value.toFixed(digits)}%`;
}
