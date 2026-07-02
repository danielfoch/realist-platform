import { pool } from "./db";

const BASE_URL = "https://realist.ca";

export type ListingSeoRecord = {
  id: string | number;
  mlsNumber: string;
  status: string | null;
  listDate: Date | string | null;
  lastUpdated: Date | string | null;
  propertyType: string | null;
  structureType: string | null;
  addressStreet: string | null;
  addressUnit: string | null;
  addressCity: string | null;
  addressProvince: string | null;
  addressPostalCode: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  listPrice: string | number | null;
  bedrooms: number | null;
  bedroomsPlus: number | null;
  bathroomsFull: number | null;
  bathroomsHalf: number | null;
  squareFootage: number | null;
  publicRemarks: string | null;
  estimatedMonthlyRent: string | number | null;
  capRate: string | number | null;
  grossYield: string | number | null;
  cashFlowMonthly: string | number | null;
  photoUrl: string | null;
};

export type ListingSitemapRecord = Pick<
  ListingSeoRecord,
  "mlsNumber" | "lastUpdated" | "listDate"
>;

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOnly(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3).trim()}...`;
}

export function sanitizeMlsNumber(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

export function listingCanonicalPath(listing: Pick<ListingSeoRecord, "mlsNumber">): string {
  return `/listings/${encodeURIComponent(listing.mlsNumber)}`;
}

export function formatListingAddress(listing: Pick<ListingSeoRecord, "addressStreet" | "addressUnit" | "addressCity" | "addressProvince">): string {
  const street = [listing.addressUnit, listing.addressStreet].filter(Boolean).join(" - ");
  return [street, listing.addressCity, listing.addressProvince].filter(Boolean).join(", ");
}

export function formatListingPrice(listing: Pick<ListingSeoRecord, "listPrice">): string | null {
  const price = toNumber(listing.listPrice);
  if (!price) return null;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(price);
}

export function buildListingSeoTitle(listing: ListingSeoRecord): string {
  const address = formatListingAddress(listing) || `MLS ${listing.mlsNumber}`;
  const price = formatListingPrice(listing);
  return [address, price, "Investment Analysis"].filter(Boolean).join(" - ");
}

export function buildListingSeoDescription(listing: ListingSeoRecord): string {
  const address = formatListingAddress(listing) || `MLS ${listing.mlsNumber}`;
  const price = formatListingPrice(listing);
  const facts = [
    price ? `listed at ${price}` : null,
    listing.bedrooms ? `${listing.bedrooms}${listing.bedroomsPlus ? `+${listing.bedroomsPlus}` : ""} bed` : null,
    listing.bathroomsFull ? `${listing.bathroomsFull}${listing.bathroomsHalf ? `.${listing.bathroomsHalf}` : ""} bath` : null,
    listing.structureType || listing.propertyType,
    toNumber(listing.capRate) ? `${toNumber(listing.capRate)?.toFixed(1)}% cap rate` : null,
    toNumber(listing.grossYield) ? `${toNumber(listing.grossYield)?.toFixed(1)}% gross yield` : null,
  ].filter(Boolean);

  const summary = `View Realist.ca's property analysis for ${address}${facts.length ? `: ${facts.join(", ")}.` : "."}`;
  const remarks = listing.publicRemarks ? ` ${stripTags(listing.publicRemarks)}` : "";
  return truncate(`${summary}${remarks}`, 158);
}

export function buildListingStructuredData(listing: ListingSeoRecord): object[] {
  const address = formatListingAddress(listing) || `MLS ${listing.mlsNumber}`;
  const canonicalUrl = `${BASE_URL}${listingCanonicalPath(listing)}`;
  const price = toNumber(listing.listPrice);
  const image = listing.photoUrl?.startsWith("http") ? listing.photoUrl : listing.photoUrl ? `${BASE_URL}${listing.photoUrl}` : `${BASE_URL}/og-image.png`;
  const latitude = toNumber(listing.latitude);
  const longitude = toNumber(listing.longitude);

  return [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Listings", item: `${BASE_URL}/tools/listing-intelligence` },
        { "@type": "ListItem", position: 3, name: address, item: canonicalUrl },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "RealEstateListing",
      "@id": `${canonicalUrl}#listing`,
      name: address,
      url: canonicalUrl,
      image,
      description: buildListingSeoDescription(listing),
      identifier: listing.mlsNumber,
      datePosted: listing.listDate ? new Date(listing.listDate).toISOString() : undefined,
      offers: price
        ? {
            "@type": "Offer",
            price,
            priceCurrency: "CAD",
            availability: listing.status?.toLowerCase() === "active" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          }
        : undefined,
      address: {
        "@type": "PostalAddress",
        streetAddress: [listing.addressUnit, listing.addressStreet].filter(Boolean).join(" - ") || undefined,
        addressLocality: listing.addressCity || undefined,
        addressRegion: listing.addressProvince || undefined,
        postalCode: listing.addressPostalCode || undefined,
        addressCountry: "CA",
      },
      geo: latitude && longitude
        ? {
            "@type": "GeoCoordinates",
            latitude,
            longitude,
          }
        : undefined,
      floorSize: listing.squareFootage
        ? {
            "@type": "QuantitativeValue",
            value: listing.squareFootage,
            unitCode: "FTK",
          }
        : undefined,
      numberOfBedrooms: listing.bedrooms || undefined,
      numberOfBathroomsTotal: (listing.bathroomsFull || 0) + (listing.bathroomsHalf || 0) || undefined,
    },
  ];
}

// Listing data lives in ddf_listing_snapshots (fed daily by the DDF yield
// crawler), keyed by (listing_key, snapshot_month) — the latest snapshot is
// the current truth for a listing. Street address, remarks, status, and the
// primary photo ride along in raw_json.
const SNAPSHOT_SEO_SELECT = `
  SELECT
    s.id,
    s.mls_number AS "mlsNumber",
    COALESCE(NULLIF(s.raw_json->>'standardStatus', ''), 'Active') AS "status",
    CASE
      WHEN s.days_on_market IS NOT NULL
      THEN (s.captured_at - make_interval(days => s.days_on_market))::date
    END AS "listDate",
    s.captured_at AS "lastUpdated",
    s.property_sub_type AS "propertyType",
    s.structure_type AS "structureType",
    NULLIF(TRIM(split_part(s.raw_json->>'streetAddress', ',', 1)), '') AS "addressStreet",
    NULL AS "addressUnit",
    s.city AS "addressCity",
    s.province AS "addressProvince",
    s.postal_code AS "addressPostalCode",
    s.latitude,
    s.longitude,
    s.list_price AS "listPrice",
    s.bedrooms_total AS "bedrooms",
    NULL::int AS "bedroomsPlus",
    s.bathrooms_total AS "bathroomsFull",
    NULL::int AS "bathroomsHalf",
    NULLIF(ROUND(s.living_area), 0)::int AS "squareFootage",
    s.raw_json->>'publicRemarks' AS "publicRemarks",
    s.estimated_monthly_rent AS "estimatedMonthlyRent",
    s.net_yield AS "capRate",
    s.gross_yield AS "grossYield",
    NULL::real AS "cashFlowMonthly",
    s.raw_json->>'photoUrl' AS "photoUrl"
  FROM ddf_listing_snapshots s
`;

export async function getListingSeoByMls(mlsNumberRaw: string): Promise<ListingSeoRecord | null> {
  const mlsNumber = sanitizeMlsNumber(mlsNumberRaw);
  if (!mlsNumber) return null;

  const result = await pool.query<ListingSeoRecord>(
    `
      ${SNAPSHOT_SEO_SELECT}
      WHERE s.mls_number = $1
      ORDER BY s.snapshot_month DESC, s.captured_at DESC
      LIMIT 1
    `,
    [mlsNumber],
  );

  return result.rows[0] || null;
}

export async function getListingSitemapRecords(limit = 10000): Promise<ListingSitemapRecord[]> {
  // "Active" = re-seen by the daily crawl within the last week. Listings that
  // drop out of the DDF feed stop having captured_at refreshed and age out of
  // the sitemap on their own.
  const result = await pool.query<ListingSitemapRecord>(
    `
      SELECT "mlsNumber", "lastUpdated", "listDate" FROM (
        SELECT DISTINCT ON (s.mls_number)
          s.mls_number AS "mlsNumber",
          s.captured_at AS "lastUpdated",
          NULL::date AS "listDate"
        FROM ddf_listing_snapshots s
        WHERE s.mls_number IS NOT NULL
          AND s.captured_at >= NOW() - INTERVAL '7 days'
          AND COALESCE(NULLIF(s.raw_json->>'standardStatus', ''), 'Active') ILIKE 'active%'
          AND NULLIF(TRIM(split_part(s.raw_json->>'streetAddress', ',', 1)), '') IS NOT NULL
          AND s.city IS NOT NULL
        ORDER BY s.mls_number, s.snapshot_month DESC, s.captured_at DESC
      ) latest
      ORDER BY "lastUpdated" DESC
      LIMIT $1
    `,
    [Math.max(1, Math.min(limit, 50000))],
  );

  return result.rows;
}

export function listingLastmod(listing: Pick<ListingSitemapRecord, "lastUpdated" | "listDate">): string {
  return dateOnly(listing.lastUpdated || listing.listDate);
}
