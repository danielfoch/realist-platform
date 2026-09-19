import type { DealAnalysis } from "@/lib/db/schema";

/**
 * A member's own analysis history: where each row leads when they want to pick
 * the deal back up.
 */

type Reopenable = Pick<DealAnalysis, "mlsNumber" | "address" | "city" | "province" | "price" | "monthlyRent" | "units">;

/**
 * A listing reopens on its listing page. Anything else reopens in the
 * underwriter through its deep link. That page rebuilds the deal's address as
 * "street, city, province" — which is also how it was stored — so the street is
 * split back out here; handing it the whole string would append the city twice
 * and log a second deal instead of reopening this one.
 */
export function reopenHref(row: Reopenable): string | null {
  const mls = row.mlsNumber?.trim();
  if (mls) return `/listings/${encodeURIComponent(mls)}`;

  const address = row.address?.trim();
  if (!address || address.length < 5) return null;
  const tail = [row.city, row.province].filter(Boolean).join(", ");
  const street = tail && address.toLowerCase().endsWith(`, ${tail.toLowerCase()}`) ? address.slice(0, -(tail.length + 2)).trim() : null;

  const params = new URLSearchParams();
  params.set("address", street && street.length >= 5 ? street : address);
  if (street && street.length >= 5) {
    if (row.city) params.set("city", row.city);
    if (row.province) params.set("province", row.province);
  }
  if (row.price > 0) params.set("price", String(Math.round(row.price)));
  if (row.monthlyRent && row.monthlyRent > 0) params.set("rent", String(Math.round(row.monthlyRent)));
  if (row.units && row.units > 0) params.set("units", String(Math.round(row.units)));
  return `/underwrite?${params.toString()}`;
}
