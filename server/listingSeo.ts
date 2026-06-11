import { pool } from "./db";

const BASE_URL = "https://realist.ca";

export type ListingSeoRecord = {
  id: number;
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

export async function getListingSeoByMls(mlsNumberRaw: string): Promise<ListingSeoRecord | null> {
  const mlsNumber = sanitizeMlsNumber(mlsNumberRaw);
  if (!mlsNumber) return null;

  const result = await pool.query<ListingSeoRecord>(
    `
      SELECT
        l.id,
        l.mls_number AS "mlsNumber",
        l.status,
        l.list_date AS "listDate",
        l.last_updated AS "lastUpdated",
        l.property_type AS "propertyType",
        l.structure_type AS "structureType",
        l.address_street AS "addressStreet",
        l.address_unit AS "addressUnit",
        l.address_city AS "addressCity",
        l.address_province AS "addressProvince",
        l.address_postal_code AS "addressPostalCode",
        l.latitude,
        l.longitude,
        l.list_price AS "listPrice",
        l.bedrooms,
        l.bedrooms_plus AS "bedroomsPlus",
        l.bathrooms_full AS "bathroomsFull",
        l.bathrooms_half AS "bathroomsHalf",
        l.square_footage AS "squareFootage",
        l.public_remarks AS "publicRemarks",
        l.estimated_monthly_rent AS "estimatedMonthlyRent",
        l.cap_rate AS "capRate",
        l.gross_yield AS "grossYield",
        l.cash_flow_monthly AS "cashFlowMonthly",
        (
          SELECT p.photo_url
          FROM listing_photos p
          WHERE p.listing_id = l.id
          ORDER BY p.is_primary DESC, p.sequence_number ASC, p.id ASC
          LIMIT 1
        ) AS "photoUrl"
      FROM listings l
      WHERE l.mls_number = $1
      LIMIT 1
    `,
    [mlsNumber],
  );

  return result.rows[0] || null;
}

export async function getListingSitemapRecords(limit = 10000): Promise<ListingSitemapRecord[]> {
  const result = await pool.query<ListingSitemapRecord>(
    `
      SELECT
        mls_number AS "mlsNumber",
        last_updated AS "lastUpdated",
        list_date AS "listDate"
      FROM listings
      WHERE status = 'Active'
        AND mls_number IS NOT NULL
        AND address_street IS NOT NULL
        AND address_city IS NOT NULL
      ORDER BY COALESCE(last_updated, synced_at, created_at) DESC
      LIMIT $1
    `,
    [Math.max(1, Math.min(limit, 50000))],
  );

  return result.rows;
}

export function listingLastmod(listing: Pick<ListingSitemapRecord, "lastUpdated" | "listDate">): string {
  return dateOnly(listing.lastUpdated || listing.listDate);
}
