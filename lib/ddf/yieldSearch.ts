import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { underwriteFromSnapshot } from "@/lib/underwriting/underwriteListing";
import type { ListingSearchResult } from "@/components/listings/listingDisplay";

/**
 * Browse by yield. The live feed can only be paged in its own order, so
 * "highest yield first" comes from the crawler's snapshots instead: every
 * active listing already has its yield computed and stored. Only listings the
 * crawl has seen in the last week count as active, and only ones that carry
 * their listing brokerage — CREA attribution is not optional.
 */

export interface YieldSearchParams {
  city?: string;
  province?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  minUnits?: number;
  minYield?: number;
  page: number;
  pageSize: number;
}

const PROVINCE_NAMES: Record<string, string> = {
  ON: "Ontario", QC: "Quebec", BC: "British Columbia", AB: "Alberta", MB: "Manitoba", SK: "Saskatchewan", NS: "Nova Scotia",
  NB: "New Brunswick", NL: "Newfoundland and Labrador", PE: "Prince Edward Island", YT: "Yukon", NT: "Northwest Territories", NU: "Nunavut",
};

export async function searchByYield(params: YieldSearchParams): Promise<{ listings: ListingSearchResult[]; count: number }> {
  const province = params.province?.trim();
  const provinceName = province ? (PROVINCE_NAMES[province.toUpperCase()] ?? province) : null;
  const filters = sql.join(
    [
      sql`s.captured_at >= now() - interval '7 days'`,
      sql`coalesce(nullif(s.standard_status, ''), 'Active') ILIKE 'active%'`,
      sql`s.mls_number IS NOT NULL AND s.list_price > 0 AND s.net_yield IS NOT NULL`,
      sql`s.raw_json ->> 'listOfficeName' IS NOT NULL`,
      // Yields above this are data errors (a lease listed as a sale), not deals.
      sql`s.net_yield BETWEEN ${params.minYield ?? 0} AND 25`,
      params.city ? sql`lower(s.city) = ${params.city.trim().toLowerCase()}` : null,
      provinceName ? sql`(s.province ILIKE ${provinceName} OR s.province ILIKE ${province ?? ""})` : null,
      params.minPrice ? sql`s.list_price >= ${params.minPrice}` : null,
      params.maxPrice ? sql`s.list_price <= ${params.maxPrice}` : null,
      params.minBeds ? sql`s.bedrooms_total >= ${params.minBeds}` : null,
      params.minUnits ? sql`s.number_of_units >= ${params.minUnits}` : null,
    ].filter((part): part is NonNullable<typeof part> => part !== null),
    sql` AND `,
  );

  const result = await getDb().execute(sql`
    WITH latest AS (
      SELECT DISTINCT ON (s.mls_number) s.*
      FROM ddf_listing_snapshots s
      WHERE ${filters}
      ORDER BY s.mls_number, s.snapshot_month DESC, s.captured_at DESC
    )
    SELECT *, count(*) OVER ()::int AS total
    FROM latest
    ORDER BY net_yield DESC, list_price ASC
    LIMIT ${params.pageSize} OFFSET ${(params.page - 1) * params.pageSize}
  `);

  const rows = result.rows as Array<Record<string, unknown>>;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const listings = rows.map((row): ListingSearchResult => {
    const raw = (row.raw_json ?? {}) as Record<string, unknown>;
    return {
      mlsNumber: text(row.mls_number),
      listPrice: Number(row.list_price),
      // The snapshot keeps the street as one line; the card joins the parts, so it goes in one of them.
      address: {
        streetNumber: "", streetName: text(row.street_address).split(",")[0].trim(), streetSuffix: "", streetDirectionPrefix: "", streetDirection: "",
        unitNumber: "", city: text(row.city), neighborhood: "", state: text(row.province), zip: text(row.postal_code),
      },
      map: row.latitude != null && row.longitude != null ? { latitude: Number(row.latitude), longitude: Number(row.longitude) } : undefined,
      details: {
        numBedrooms: row.bedrooms_total == null ? undefined : Number(row.bedrooms_total),
        numBathrooms: row.bathrooms_total == null ? undefined : Number(row.bathrooms_total),
        propertyType: text(row.property_sub_type) || text(row.structure_type) || undefined,
      },
      images: row.photo_url ? [text(row.photo_url)] : [],
      numberOfUnitsTotal: row.number_of_units == null ? undefined : Number(row.number_of_units),
      listOfficeName: text(raw.listOfficeName) || undefined,
      modificationTimestamp: text(raw.modificationTimestamp) || undefined,
      underwrite: underwriteFromSnapshot({
        listPrice: row.list_price as number,
        estimatedMonthlyRent: row.estimated_monthly_rent as number,
        grossYield: row.gross_yield as number,
        netYield: row.net_yield as number,
        taxAnnual: row.tax_annual_amount as number | null,
        associationFee: row.association_fee as number | null,
      }),
    };
  });
  return { listings, count: rows.length ? Number(rows[0].total) : 0 };
}
