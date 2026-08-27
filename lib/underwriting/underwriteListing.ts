/**
 * Per-listing pre-underwrite shared by the listings search API and the
 * listing detail page, so a card and its detail view always show the same
 * numbers — and the same numbers the DDF yield crawler stores in snapshots.
 *
 * Rent ladder mirrors lib/ddf/crawler.ts, best data wins:
 *   1. the listing's own TotalActualRent
 *   2. the comp-based estimator (rent_listings comps / rent_pulse aggregates),
 *      queried at city level and memoized per province×city×beds×units so a
 *      results page costs a handful of queries, not one per listing
 *   3. the CMHC baseline
 *   4. hard defaults
 *
 * All yield/cash-flow math goes through the one engine in
 * investmentMetrics.ts — never re-derived here.
 */

import type { DdfListing } from "@/lib/ddf/client";
import { isVacantLandLikeProperty } from "@/lib/ddf/propertyEligibility";
import { getRentEstimate } from "@/lib/rents/estimator";
import { getCmhcRent } from "@/lib/rents/cmhcRents";
import {
  calculateInvestmentMetrics,
  calculateListingYield,
} from "./investmentMetrics";

export interface ListingUnderwrite {
  /** Estimated total monthly rent for the property (all units). */
  estimatedRent: number;
  /** Ladder rung the rent came from, e.g. "ddf_actual", "comps_radius", "cmhc_city". */
  rentSource: string;
  /** Human label for the rent source, safe to render on cards. */
  rentSourceLabel: string;
  /** Percent, e.g. 5.2 means 5.2%. */
  grossYield: number;
  /** Engine cap rate over estimated NOI — stored/displayed as net yield. */
  netYield: number;
  /** Estimated annual NOI, dollars. */
  noi: number;
  /** Estimated monthly cash flow at 20% down / default financing. */
  cashFlowMonthly: number | null;
}

type RentLadderResult = { rent: number; source: string };
export type RentMemo = Map<string, Promise<RentLadderResult>>;

export function rentSourceLabel(source: string): string {
  switch (source) {
    case "ddf_actual":
      return "Actual rent";
    case "comps_radius":
    case "city_comps":
      return "Rent comps";
    case "city_aggregate":
      return "City median";
    case "cmhc_city":
    case "cmhc_province":
    case "cmhc_baseline":
      return "CMHC average";
    case "snapshot":
      return "Recent snapshot";
    default:
      return "Estimate";
  }
}

async function estimateListingRent(
  listing: DdfListing,
  city: string,
  province: string,
  memo: RentMemo,
): Promise<RentLadderResult> {
  if (listing.TotalActualRent && listing.TotalActualRent > 0) {
    return { rent: listing.TotalActualRent, source: "ddf_actual" };
  }

  const beds = listing.BedroomsTotal || 1;
  const units = listing.NumberOfUnitsTotal || 1;
  const key = `${province}|${city.toLowerCase()}|${beds}|${units}`;

  let pending = memo.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const estimate = await getRentEstimate({ bedrooms: beds, city, province, units });
        if (estimate) return { rent: estimate.monthlyRent, source: estimate.method };
      } catch (error) {
        console.warn(`[underwrite-listing] rent estimate failed for ${city}, ${province} (${beds}bd):`, error);
      }
      const cmhc = getCmhcRent(beds, city, province);
      if (cmhc.source !== "default") {
        return { rent: cmhc.rent * units, source: cmhc.source };
      }
      const defaultRent = beds >= 3 ? 1800 : beds >= 2 ? 1500 : 1200;
      return { rent: defaultRent * units, source: "default" };
    })();
    memo.set(key, pending);
  }
  return pending;
}

/**
 * Underwrite one raw DDF listing. Returns null when the listing is not
 * underwritable (no price, vacant-land-like, or no rent could be estimated).
 * Pass a shared memo when underwriting a whole results page.
 */
export async function underwriteDdfListing(
  listing: DdfListing,
  memo: RentMemo = new Map(),
): Promise<ListingUnderwrite | null> {
  const price = listing.ListPrice;
  if (!price || price <= 0) return null;
  if (isVacantLandLikeProperty(listing)) return null;

  const city = listing.City || "Unknown";
  const province = listing.StateOrProvince || "";
  const { rent, source } = await estimateListingRent(listing, city, province, memo);
  if (!(rent > 0)) return null;

  const taxAnnual = listing.TaxAnnualAmount || 0;
  const associationFee = listing.AssociationFee || 0;

  const { grossYield, netYield, estimatedNoi } = calculateListingYield(
    price,
    rent,
    taxAnnual,
    associationFee,
  );

  // Same observable facts as calculateListingYield maps, read back through the
  // engine for the levered view (20% down / 5.5% / 25yr defaults).
  const metrics = calculateInvestmentMetrics(price, {
    monthlyRent: rent,
    annualPropertyTax: taxAnnual,
    annualInsurance: price * 0.003,
    annualCondoFees: associationFee * 12,
    rentSource: source,
  });

  return {
    estimatedRent: rent,
    rentSource: source,
    rentSourceLabel: rentSourceLabel(source),
    grossYield,
    netYield,
    noi: estimatedNoi,
    cashFlowMonthly: metrics.monthlyCashFlow,
  };
}

/**
 * Rebuild an underwrite view from a stored ddf_listing_snapshots row when the
 * live DDF fetch is unavailable. Stored gross/net yields are kept (they were
 * computed tax-aware at crawl time); NOI and cash flow are re-read from the
 * engine with the tax inferred, since the snapshot doesn't carry the tax bill.
 */
export function underwriteFromSnapshot(record: {
  listPrice: number | string | null;
  estimatedMonthlyRent: number | string | null;
  grossYield: number | string | null;
  netYield: number | string | null;
}): ListingUnderwrite | null {
  const price = Number(record.listPrice);
  const rent = Number(record.estimatedMonthlyRent);
  if (!(price > 0) || !(rent > 0)) return null;

  const metrics = calculateInvestmentMetrics(price, {
    monthlyRent: rent,
    annualPropertyTax: null,
    annualInsurance: price * 0.003,
    rentSource: "snapshot",
  });

  const grossYield = Number(record.grossYield);
  const netYield = Number(record.netYield);

  return {
    estimatedRent: rent,
    rentSource: "snapshot",
    rentSourceLabel: rentSourceLabel("snapshot"),
    grossYield: Number.isFinite(grossYield) && grossYield !== 0 ? grossYield : (metrics.grossYield ?? 0),
    netYield: Number.isFinite(netYield) && netYield !== 0 ? netYield : (metrics.capRate ?? 0),
    noi: metrics.noi ?? 0,
    cashFlowMonthly: metrics.monthlyCashFlow,
  };
}
