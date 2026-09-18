/**
 * Listing extract — fetch public pages (or use caller HTML) and normalize
 * into Property/Listing. No login, no paywall bypass.
 */
import {
  ListingExtractError,
  extractFromHtml,
  type ExtractResult,
  type ListingExtractInput,
} from "@shared/listingExtract";

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 1_500_000;

export type ListingPageFetcher = (url: string) => Promise<{ status: number; html: string }>;

let pageFetcher: ListingPageFetcher | null = null;

export function setListingPageFetcher(fetcher: ListingPageFetcher | null) {
  pageFetcher = fetcher;
}

function defaultFetcher(url: string): Promise<{ status: number; html: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, {
    method: "GET",
    redirect: "follow",
    signal: controller.signal,
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "RealistAgentExtract/1.0 (+https://realist.ca/api/agent; public listing ingest)",
    },
  }).then(async (response) => {
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.length > MAX_HTML_BYTES) {
      throw new ListingExtractError("extract_failed", "Listing page exceeded size limit.");
    }
    return { status: response.status, html: buf.toString("utf8") };
  }).finally(() => clearTimeout(timer));
}

async function loadHtml(url: string): Promise<string> {
  try {
    const fetched = await (pageFetcher ?? defaultFetcher)(url);
    if (fetched.status === 401 || fetched.status === 403) {
      throw new ListingExtractError("blocked_or_login_wall", `Listing page returned HTTP ${fetched.status}.`);
    }
    if (fetched.status === 404) {
      throw new ListingExtractError("listing_not_found", "Listing page returned 404.");
    }
    if (fetched.status >= 400) {
      throw new ListingExtractError("extract_failed", `Listing page returned HTTP ${fetched.status}.`);
    }
    return fetched.html;
  } catch (error) {
    if (error instanceof ListingExtractError) throw error;
    throw new ListingExtractError("extract_failed", (error as Error)?.message || "Failed to fetch listing URL.");
  }
}

async function tryCreaDdf(mlsNumber: string): Promise<ExtractResult | null> {
  const { isDdfConfigured, searchDdfByMlsNumber, normalizeDdfListing } = await import("./creaDdf");
  if (!isDdfConfigured()) return null;
  const raw = await searchDdfByMlsNumber(mlsNumber.replace(/[^a-zA-Z0-9]/g, ""));
  if (!raw) return null;
  const listing: any = normalizeDdfListing(raw);
  const price = typeof listing.listPrice === "string" ? parseFloat(listing.listPrice) : listing.listPrice;
  const address = listing.address?.streetAddress || listing.address?.address || listing.address;
  return {
    property: {
      address: typeof address === "string" ? address : undefined,
      city: listing.address?.city,
      province: listing.address?.state,
      region: listing.address?.state,
      country: "CA",
      beds: listing.details?.numBedrooms ?? null,
      baths: listing.details?.numBathrooms ?? null,
      units: listing.numberOfUnitsTotal ?? null,
      propertyType: listing.details?.propertyType,
    },
    listing: {
      mlsNumber,
      listPrice: Number.isFinite(price) ? price : null,
      currency: "CAD",
      daysOnMarket: listing.daysOnMarket ?? null,
      source: "crea_ddf",
      propertyType: listing.details?.propertyType,
    },
    confidence: Number.isFinite(price) && address ? "high" : "medium",
    missingFields: [
      ...(!address ? ["property.address"] : []),
      ...(!Number.isFinite(price) ? ["listing.listPrice"] : []),
    ],
    warnings: ["CREA DDF fast path (Canada)."],
    sourceHost: "crea-ddf",
    extractorId: "crea-ddf",
    raw: { provenance: ["crea_ddf"] },
  };
}

export async function extractListing(input: ListingExtractInput): Promise<ExtractResult> {
  if (input.mlsNumber) {
    const ddf = await tryCreaDdf(input.mlsNumber);
    if (ddf) return ddf;
  }

  const supplied = input.html || input.rawText;
  if (supplied) {
    return extractFromHtml({
      html: supplied,
      url: input.url,
      country: input.country,
      currency: input.currency,
      mlsNumber: input.mlsNumber,
    });
  }

  if (input.url) {
    const html = await loadHtml(input.url);
    return extractFromHtml({
      html,
      url: input.url,
      country: input.country,
      currency: input.currency,
      mlsNumber: input.mlsNumber,
    });
  }

  throw new ListingExtractError(
    "extract_failed",
    input.mlsNumber
      ? "CREA DDF did not find that MLS number and no URL/HTML was provided."
      : "Provide a public listing URL, HTML, or MLS number.",
  );
}
