import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getDdfListing,
  isDdfConfigured,
  normalizeDdfListing,
  searchDdfByMlsNumber,
  type DdfListing,
} from "@/lib/ddf/client";
import {
  getListingSeoByMls,
  sanitizeMlsNumber,
  type ListingSeoRecord,
} from "@/lib/ddf/listingSeo";
import {
  underwriteDdfListing,
  underwriteFromSnapshot,
  type ListingUnderwrite,
} from "@/lib/underwriting/underwriteListing";
import { JsonLd } from "@/components/JsonLd";
import {
  breadcrumbNode,
  jsonLdDocument,
  realEstateListingNode,
} from "@/lib/seo/jsonld";
import { DdfAttribution } from "@/components/listings/DdfAttribution";
import {
  filterListingPhotos,
  fmtYield,
  listingFullAddress,
  listingStreetLine,
} from "@/components/listings/listingDisplay";
import { fmtMoney, fmtNum } from "@/components/multiplex/format";

export const revalidate = 900;

interface ListingView {
  mlsNumber: string;
  streetLine: string;
  fullAddress: string;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  propertyType: string | null;
  yearBuilt: string | null;
  taxAnnual: number | null;
  parking: number | null;
  units: number | null;
  daysOnMarket: number | null;
  listDate: string | null;
  status: string | null;
  remarks: string | null;
  photos: string[];
  lat: number | null;
  lng: number | null;
  listOfficeName: string | null;
  modificationTimestamp: string | null;
  underwrite: ListingUnderwrite | null;
  source: "live" | "snapshot";
}

function toNum(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function viewFromLive(raw: DdfListing): Promise<ListingView> {
  const normalized = normalizeDdfListing(raw);
  let underwrite: ListingUnderwrite | null = null;
  try {
    underwrite = await underwriteDdfListing(raw);
  } catch (error) {
    console.warn(`[listings/${normalized.mlsNumber}] underwrite failed:`, error);
  }

  return {
    mlsNumber: normalized.mlsNumber,
    streetLine: listingStreetLine(normalized.address) || `MLS® ${normalized.mlsNumber}`,
    fullAddress: listingFullAddress(normalized.address) || `MLS® ${normalized.mlsNumber}`,
    city: normalized.address.city || null,
    province: normalized.address.state || null,
    postalCode: normalized.address.zip || null,
    price: normalized.listPrice || null,
    beds: normalized.details.numBedrooms ?? null,
    baths: normalized.details.numBathrooms ?? null,
    sqft: toNum(normalized.details.sqft),
    propertyType: normalized.details.propertyType ?? null,
    yearBuilt: normalized.details.yearBuilt ?? null,
    taxAnnual: normalized.taxes?.annualAmount ?? null,
    parking: normalized.details.numParkingSpaces ?? null,
    units: normalized.numberOfUnitsTotal ?? null,
    daysOnMarket: normalized.daysOnMarket ?? null,
    listDate: normalized.listDate ?? null,
    status: raw.StandardStatus || null,
    remarks: normalized.details.description ?? null,
    photos: filterListingPhotos(normalized.images as string[], 6),
    lat: normalized.map?.latitude ?? null,
    lng: normalized.map?.longitude ?? null,
    listOfficeName: normalized.listOfficeName ?? null,
    modificationTimestamp: normalized.modificationTimestamp ?? null,
    underwrite,
    source: "live",
  };
}

function viewFromSnapshot(record: ListingSeoRecord): ListingView {
  const street = [record.addressUnit, record.addressStreet].filter(Boolean).join(" - ");
  const fullAddress = [street, record.addressCity, record.addressProvince]
    .filter(Boolean)
    .join(", ");
  return {
    mlsNumber: record.mlsNumber,
    streetLine: street || `MLS® ${record.mlsNumber}`,
    fullAddress: fullAddress || `MLS® ${record.mlsNumber}`,
    city: record.addressCity,
    province: record.addressProvince,
    postalCode: record.addressPostalCode,
    price: toNum(record.listPrice),
    beds: record.bedrooms,
    baths: record.bathroomsFull,
    sqft: record.squareFootage,
    propertyType: record.structureType || record.propertyType,
    yearBuilt: null,
    taxAnnual: null,
    parking: null,
    units: null,
    daysOnMarket: null,
    listDate: record.listDate ? new Date(record.listDate).toISOString() : null,
    status: record.status,
    remarks: record.publicRemarks,
    photos: record.photoUrl ? filterListingPhotos([record.photoUrl], 6) : [],
    lat: toNum(record.latitude),
    lng: toNum(record.longitude),
    listOfficeName: null,
    modificationTimestamp: record.lastUpdated
      ? new Date(record.lastUpdated).toISOString()
      : null,
    underwrite: underwriteFromSnapshot(record),
    source: "snapshot",
  };
}

/**
 * Live DDF first (by MLS number, then by ListingKey for older links), the
 * stored crawler snapshot as fallback when the live fetch fails or the feed
 * isn't configured. Wrapped in React cache so generateMetadata and the page
 * share one load.
 */
const loadListing = cache(async (rawKey: string): Promise<ListingView | null> => {
  const key = sanitizeMlsNumber(rawKey);
  if (!key) return null;

  if (isDdfConfigured()) {
    try {
      const live = (await searchDdfByMlsNumber(key)) || (await getDdfListing(key));
      if (live) return viewFromLive(live);
    } catch (error) {
      console.warn(`[listings/${key}] live DDF fetch failed, trying snapshot:`, error);
    }
  }

  try {
    const snapshot = await getListingSeoByMls(key);
    if (snapshot) return viewFromSnapshot(snapshot);
  } catch (error) {
    console.warn(`[listings/${key}] snapshot fallback failed:`, error);
  }

  return null;
});

export async function generateMetadata({
  params,
}: PageProps<"/listings/[key]">): Promise<Metadata> {
  const { key } = await params;
  const listing = await loadListing(key);
  if (!listing) return { title: "Listing not found" };

  const priceLabel = listing.price ? fmtMoney(listing.price) : null;
  const description = [
    `Pre-underwritten investment analysis for ${listing.fullAddress}`,
    priceLabel ? `listed at ${priceLabel}` : null,
    listing.underwrite
      ? `${fmtYield(listing.underwrite.grossYield)} gross yield, ${fmtYield(listing.underwrite.netYield)} net yield`
      : null,
  ]
    .filter(Boolean)
    .join(" — ");

  return {
    title: [listing.fullAddress, priceLabel, "Investment Analysis"]
      .filter(Boolean)
      .join(" - "),
    description,
    alternates: { canonical: `/listings/${encodeURIComponent(listing.mlsNumber)}` },
    openGraph: listing.photos[0]
      ? { images: [{ url: listing.photos[0] }] }
      : undefined,
  };
}

function FactRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <tr className="border-b border-hairline last:border-b-0">
      <th scope="row" className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-ink-faint">
        {label}
      </th>
      <td className="tnum py-2 text-right text-sm font-medium">{value}</td>
    </tr>
  );
}

function UnderwriteStat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
        {label}
      </p>
      <p
        className={`tnum font-display mt-1 text-xl font-semibold ${
          tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : ""
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-ink-faint">{hint}</p>}
    </div>
  );
}

export default async function ListingDetailPage({
  params,
}: PageProps<"/listings/[key]">) {
  const { key } = await params;
  const listing = await loadListing(key);
  if (!listing) notFound();

  const uw = listing.underwrite;
  const cashFlow = uw?.cashFlowMonthly ?? null;
  const isOntario = listing.province === "ON" || listing.province === "Ontario";
  const workWithUsHref = `/work-with-us?property=${encodeURIComponent(
    `${listing.fullAddress} (MLS® ${listing.mlsNumber})`,
  )}`;
  const multiplexHref = `/multiplex?address=${encodeURIComponent(
    [listing.streetLine, listing.city].filter(Boolean).join(", "),
  )}`;

  return (
    <>
      <JsonLd
        json={jsonLdDocument(
          realEstateListingNode({
            path: `/listings/${encodeURIComponent(listing.mlsNumber)}`,
            name: listing.fullAddress,
            description: listing.remarks
              ? listing.remarks.slice(0, 300)
              : undefined,
            image: listing.photos[0],
            mlsNumber: listing.mlsNumber,
            price: listing.price,
            status: listing.status,
            datePosted: listing.listDate,
            street: listing.streetLine,
            city: listing.city,
            region: listing.province,
            postalCode: listing.postalCode,
            latitude: listing.lat,
            longitude: listing.lng,
            bedrooms: listing.beds,
            bathrooms: listing.baths,
            floorSizeSqft: listing.sqft,
          }),
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "Listings", path: "/listings" },
            {
              name: listing.fullAddress,
              path: `/listings/${encodeURIComponent(listing.mlsNumber)}`,
            },
          ]),
        )}
      />

      {/* Header */}
      <section className="border-b border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <Link href="/listings" className="text-sm font-semibold text-brand hover:text-brand-deep">
            ← All listings
          </Link>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                {listing.streetLine}
              </h1>
              <p className="mt-1 text-ink-soft">
                {[listing.city, listing.province, listing.postalCode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
            <div className="text-right">
              <p className="tnum font-display text-3xl font-semibold">
                {listing.price ? fmtMoney(listing.price) : "Price on request"}
              </p>
              <p className="tnum mt-1 text-xs text-ink-faint">
                MLS® {listing.mlsNumber}
                {listing.daysOnMarket != null ? ` · ${listing.daysOnMarket} days on market` : ""}
              </p>
            </div>
          </div>
          {listing.listOfficeName && (
            <p className="mt-2 text-xs text-ink-faint">
              Courtesy of {listing.listOfficeName}
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Photos */}
        {listing.photos.length > 0 && (
          <section className="grid gap-3 sm:grid-cols-3">
            {listing.photos.map((photo, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={photo}
                src={photo}
                alt={`${listing.streetLine} — photo ${index + 1}`}
                loading={index === 0 ? "eager" : "lazy"}
                className={`w-full rounded-lg border border-hairline object-cover ${
                  index === 0 ? "sm:col-span-2 sm:row-span-2 aspect-[4/3]" : "aspect-[4/3]"
                }`}
              />
            ))}
          </section>
        )}

        {/* Underwrite + facts */}
        <section className="mt-10 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-xl font-semibold tracking-tight">
                Pre-underwrite
              </h2>
              {uw && (
                <span className="rounded-full bg-brand-wash px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-deep">
                  Rent: {uw.rentSourceLabel}
                </span>
              )}
            </div>
            {uw ? (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <UnderwriteStat
                    label="Est. rent"
                    value={`${fmtMoney(uw.estimatedRent)}/mo`}
                    hint={uw.rentSourceLabel}
                  />
                  <UnderwriteStat label="Gross yield" value={fmtYield(uw.grossYield)} />
                  <UnderwriteStat label="Net yield" value={fmtYield(uw.netYield)} />
                  <UnderwriteStat
                    label="Est. NOI"
                    value={uw.noi ? `${fmtMoney(uw.noi)}/yr` : "—"}
                  />
                  <UnderwriteStat
                    label="Cash flow"
                    value={cashFlow != null ? `${fmtMoney(cashFlow)}/mo` : "—"}
                    tone={cashFlow == null ? undefined : cashFlow >= 0 ? "good" : "bad"}
                    hint="At 20% down"
                  />
                  {listing.taxAnnual != null && (
                    <UnderwriteStat
                      label="Property tax"
                      value={`${fmtMoney(listing.taxAnnual)}/yr`}
                    />
                  )}
                </div>
                <p className="mt-3 rounded-md bg-brand-wash/60 px-3 py-2 text-xs leading-relaxed text-brand-deep">
                  Assumes 20% down, 5.5% rate, 25-year amortization, with
                  vacancy, maintenance, management, and insurance estimated
                  where the listing doesn&rsquo;t report them. An estimate to
                  rank deals — not a substitute for your own underwriting.
                </p>
              </>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-hairline-strong bg-surface p-5 text-sm text-ink-soft">
                We couldn&rsquo;t pre-underwrite this one — usually a land or
                price-on-request listing where a rent estimate doesn&rsquo;t
                apply.
              </p>
            )}

            {/* Remarks */}
            {listing.remarks && (
              <div className="mt-8">
                <h2 className="font-display text-xl font-semibold tracking-tight">
                  About this listing
                </h2>
                <p className="prose-notes mt-3 whitespace-pre-line text-sm">
                  {listing.remarks}
                </p>
              </div>
            )}
          </div>

          <aside>
            <div className="rounded-xl border border-hairline bg-surface p-5">
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Key facts
              </h2>
              <table className="mt-3 w-full">
                <tbody>
                  <FactRow label="Price" value={listing.price ? fmtMoney(listing.price) : null} />
                  <FactRow label="Type" value={listing.propertyType} />
                  <FactRow label="Bedrooms" value={listing.beds != null ? fmtNum(listing.beds) : null} />
                  <FactRow label="Bathrooms" value={listing.baths != null ? fmtNum(listing.baths) : null} />
                  <FactRow label="Units" value={listing.units != null ? fmtNum(listing.units) : null} />
                  <FactRow label="Size" value={listing.sqft ? `${fmtNum(listing.sqft)} sf` : null} />
                  <FactRow label="Year built" value={listing.yearBuilt} />
                  <FactRow label="Parking" value={listing.parking != null ? fmtNum(listing.parking) : null} />
                  <FactRow label="Taxes" value={listing.taxAnnual != null ? `${fmtMoney(listing.taxAnnual)}/yr` : null} />
                  <FactRow label="Status" value={listing.status} />
                  <FactRow label="MLS® number" value={listing.mlsNumber} />
                </tbody>
              </table>
            </div>

            {isOntario && (
              <Link
                href={multiplexHref}
                className="group mt-4 block rounded-xl border border-brand/40 bg-brand-wash/40 p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-brand">
                  Toronto multiplex underwriter
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  Sitting on a lot with more potential than the listing shows?
                  Run the zoning, massing, and CMHC proforma.
                </p>
                <span className="mt-2 inline-block text-sm font-semibold text-brand group-hover:text-brand-deep">
                  Underwrite as a multiplex →
                </span>
              </Link>
            )}
          </aside>
        </section>

        {/* Work-with-us CTA */}
        <section className="mt-12 rounded-xl bg-ink p-6 text-paper sm:p-8">
          <div className="flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                Want this property?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-paper/70">
                Buy it with our team and get 50% of our commission back at
                closing. That&rsquo;s how the tools stay free.
              </p>
            </div>
            <Link
              href={workWithUsHref}
              className="shrink-0 rounded-md bg-signal px-5 py-3 text-sm font-semibold text-white transition-colors hover:brightness-110"
            >
              Work with us on this one
            </Link>
          </div>
        </section>

        <div className="mt-10">
          <DdfAttribution lastUpdated={listing.modificationTimestamp} />
        </div>
      </div>
    </>
  );
}
