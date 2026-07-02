/**
 * Rent observation mapping — turns raw source listings into rent_listings
 * rows. Pure module so each source adapter's mapping is unit-testable.
 *
 * First source: CREA DDF lease listings (TransactionType For rent/For lease),
 * where ListPrice is the monthly asking rent. Licensed data we already pull
 * for sales — no scraping, no ToS issues.
 */

import { MIN_SANE_RENT, MAX_SANE_RENT } from "./rentEstimator";

const SQFT_PER_SQM = 10.7639;

/** PropertySubTypes that aren't residential rentals — their lease prices are
 * per-sqft annual or otherwise not comparable to residential monthly rent. */
const NON_RESIDENTIAL_SUBTYPES = [
  "commercial",
  "business",
  "retail",
  "office",
  "industrial",
  "warehouse",
  "parking",
  "locker",
  "storage",
  "vacant land",
  "agriculture",
];

/** The DDF fields the lease mapper reads (subset of the full DdfListing). */
export interface DdfLeaseListing {
  ListingKey: string;
  ListPrice?: number;
  TransactionType?: string;
  PropertySubType?: string;
  BedroomsTotal?: number;
  BathroomsTotalInteger?: number;
  LivingArea?: number;
  LivingAreaUnits?: string;
  UnparsedAddress?: string;
  City?: string;
  StateOrProvince?: string;
  Latitude?: number;
  Longitude?: number;
  OriginalEntryTimestamp?: string;
}

/** Shape matching the rent_listings insert columns the adapters fill. */
export interface RentObservationRow {
  externalId: string;
  city: string;
  province: string;
  address: string | null;
  bedrooms: string;
  bathrooms: string | null;
  rent: number;
  squareFootage: number | null;
  lat: number | null;
  lng: number | null;
  sourcePlatform: string;
  listingDate: Date | null;
}

export function ddfLeaseExternalId(listingKey: string): string {
  return `ddf-lease:${listingKey}`;
}

/**
 * Map a DDF lease listing to a rent observation. Returns null when the
 * listing can't serve as a residential rent comp: missing location or
 * bedrooms, non-residential subtype, or a price outside the monthly-rent
 * sanity band (which also drops per-sqft commercial leases and most
 * daily-rate vacation listings).
 */
export function ddfLeaseToRentObservation(listing: DdfLeaseListing): RentObservationRow | null {
  const rent = listing.ListPrice;
  if (!listing.ListingKey || !listing.City || !listing.StateOrProvince) return null;
  if (rent == null || rent < MIN_SANE_RENT || rent > MAX_SANE_RENT) return null;
  if (listing.BedroomsTotal == null || listing.BedroomsTotal < 0) return null;

  const subType = (listing.PropertySubType || "").toLowerCase();
  if (NON_RESIDENTIAL_SUBTYPES.some((t) => subType.includes(t))) return null;

  let squareFootage: number | null = null;
  if (listing.LivingArea && listing.LivingArea > 0) {
    const units = (listing.LivingAreaUnits || "").toLowerCase();
    const isMetric = units.includes("met") || units.includes("m2") || units === "sqm";
    squareFootage = Math.round(listing.LivingArea * (isMetric ? SQFT_PER_SQM : 1));
  }

  let listingDate: Date | null = null;
  if (listing.OriginalEntryTimestamp) {
    const parsed = new Date(listing.OriginalEntryTimestamp);
    if (!Number.isNaN(parsed.getTime())) listingDate = parsed;
  }

  return {
    externalId: ddfLeaseExternalId(listing.ListingKey),
    city: listing.City,
    province: listing.StateOrProvince,
    address: listing.UnparsedAddress ?? null,
    bedrooms: String(listing.BedroomsTotal),
    bathrooms: listing.BathroomsTotalInteger != null ? String(listing.BathroomsTotalInteger) : null,
    rent: Math.round(rent),
    squareFootage,
    lat: listing.Latitude ?? null,
    lng: listing.Longitude ?? null,
    sourcePlatform: "crea_ddf",
    listingDate,
  };
}
