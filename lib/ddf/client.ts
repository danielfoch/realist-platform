import { isVacantLandLikeProperty } from "./propertyEligibility";

interface DdfTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface DdfMediaItem {
  MediaKey?: string;
  MediaURL?: string;
  Order?: number;
  PreferredPhotoYN?: boolean;
  MediaCategory?: string;
}

export interface DdfListing {
  ListingKey: string;
  ListingId?: string;
  ListPrice?: number;
  StandardStatus?: string;
  LeaseAmount?: number;
  LeaseAmountFrequency?: string;
  PropertySubType?: string;
  StructureType?: string;
  BedroomsTotal?: number;
  BathroomsTotalInteger?: number;
  BathroomsPartial?: number;
  LivingArea?: number;
  LivingAreaUnits?: string;
  BuildingAreaTotal?: number;
  BuildingAreaUnits?: string;
  YearBuilt?: number;
  UnparsedAddress?: string;
  StreetNumber?: string;
  StreetName?: string;
  StreetSuffix?: string;
  StreetDirPrefix?: string;
  StreetDirSuffix?: string;
  UnitNumber?: string;
  City?: string;
  CityRegion?: string;
  StateOrProvince?: string;
  PostalCode?: string;
  Country?: string;
  Latitude?: number;
  Longitude?: number;
  PublicRemarks?: string;
  TaxAnnualAmount?: number;
  TotalActualRent?: number;
  Stories?: number;
  ParkingTotal?: number;
  ArchitecturalStyle?: string[];
  Basement?: string[];
  PhotosCount?: number;
  Media?: DdfMediaItem[];
  ModificationTimestamp?: string;
  OriginalEntryTimestamp?: string;
  ListOfficeName?: string;
  NumberOfUnitsTotal?: number;
  AssociationFee?: number;
  AssociationFeeFrequency?: string;
  LotFrontage?: number;
  LotDepth?: number;
  LotSizeArea?: number;
  LotSizeAreaUnits?: string;
  LotSizeDimensions?: string;
  [key: string]: any;
}

interface DdfSearchResponse {
  value: DdfListing[];
  "@odata.count"?: number;
  "@odata.nextLink"?: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;
/** Concurrent cold callers share one in-flight mint instead of racing the auth server. */
let tokenMint: Promise<string> | null = null;

const DDF_AUTH_URL = "https://identity.crea.ca/connect/token";
const DDF_API_BASE = "https://ddfapi.realtor.ca/odata/v1";

/** Cap on how long a Retry-After header can make us sleep before the one retry. */
const RATE_LIMIT_MAX_WAIT_MS = 30_000;
const RATE_LIMIT_DEFAULT_WAIT_MS = 2_000;

export const DDF_SELECT_FIELDS = [
  "ListingKey", "ListingId", "ListPrice", "StandardStatus",
  "LeaseAmount", "LeaseAmountFrequency",
  "PropertySubType", "StructureType",
  "BedroomsTotal", "BathroomsTotalInteger", "BathroomsPartial",
  "LivingArea", "LivingAreaUnits", "BuildingAreaTotal", "BuildingAreaUnits",
  "YearBuilt", "Stories",
  "UnparsedAddress", "StreetNumber", "StreetName", "StreetSuffix",
  "StreetDirPrefix", "StreetDirSuffix", "UnitNumber",
  "City", "CityRegion", "StateOrProvince", "PostalCode", "Country",
  "Latitude", "Longitude",
  "PublicRemarks", "TaxAnnualAmount", "TotalActualRent",
  "ParkingTotal", "NumberOfUnitsTotal",
  "AssociationFee", "AssociationFeeFrequency",
  "PhotosCount", "Media",
  "ModificationTimestamp", "OriginalEntryTimestamp",
  "LotFrontage", "LotDepth", "LotSizeArea", "LotSizeAreaUnits", "LotSizeDimensions",
  "ListOfficeName",
].join(",");

function retryAfterMs(header: string | null): number {
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, RATE_LIMIT_MAX_WAIT_MS);
    }
    const at = Date.parse(header);
    if (!Number.isNaN(at)) {
      return Math.min(Math.max(0, at - Date.now()), RATE_LIMIT_MAX_WAIT_MS);
    }
  }
  return RATE_LIMIT_DEFAULT_WAIT_MS;
}

/** One request, with explicit rate-limit handling: honor Retry-After, retry once. */
async function ddfRateLimitedFetch(url: string, init: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  if (response.status !== 429) return response;
  const waitMs = retryAfterMs(response.headers.get("Retry-After"));
  console.warn(`DDF rate limited (429); retrying once after ${waitMs}ms`);
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  return fetch(url, init);
}

// ---------------------------------------------------------------------------
// Adapting to CREA's schema. CREA changes which Property fields exist and which
// may be filtered on, without notice, and answers a query that mentions a
// retired one with a 400 for the WHOLE search (Sept 2026: `LotFrontage` left
// $select and `StandardStatus` left $filter — listing search went dark on both
// apps at once). Its error names the offending property, so we take it at its
// word: drop that property from the query, retry, and remember for the life of
// the instance. A search degrades by one field instead of failing outright.
// ---------------------------------------------------------------------------

const rejectedSelectFields = new Set<string>();
const rejectedFilterProperties = new Set<string>();
const MAX_SCHEMA_RETRIES = 8;

/** For tests. */
export function forgetDdfSchemaRejections(): void {
  rejectedSelectFields.clear();
  rejectedFilterProperties.clear();
}

/** Record what a 400 says CREA no longer accepts. True when it taught us something new. */
export function learnFromDdfError(body: string): boolean {
  let details = body;
  try {
    const parsed = JSON.parse(body) as { error?: { details?: string; message?: string } };
    details = `${parsed.error?.details ?? ""} ${parsed.error?.message ?? ""}`;
  } catch {
    // Not JSON: match against the raw text.
  }
  const unknown = details.match(/Could not find a property named '([A-Za-z0-9_]+)'/);
  if (unknown && !rejectedSelectFields.has(unknown[1])) {
    rejectedSelectFields.add(unknown[1]);
    // The same name can't be filtered or sorted on either.
    rejectedFilterProperties.add(unknown[1]);
    console.warn(`[ddf] CREA no longer has a Property field named ${unknown[1]}; dropped from queries`);
    return true;
  }
  const unfilterable = details.match(/The property '([A-Za-z0-9_]+)' cannot be used in the \$filter/);
  if (unfilterable && !rejectedFilterProperties.has(unfilterable[1])) {
    rejectedFilterProperties.add(unfilterable[1]);
    console.warn(`[ddf] CREA no longer filters on ${unfilterable[1]}; dropped from $filter`);
    return true;
  }
  return false;
}

/** Split an OData $filter on its top-level " and "s — not the ones inside parentheses or quoted strings. */
function topLevelClauses(filter: string): string[] {
  const clauses: string[] = [];
  let depth = 0;
  let quoted = false;
  let start = 0;
  for (let i = 0; i < filter.length; i += 1) {
    const ch = filter[i];
    if (ch === "'") quoted = !quoted;
    else if (!quoted && ch === "(") depth += 1;
    else if (!quoted && ch === ")") depth -= 1;
    else if (!quoted && depth === 0 && filter.startsWith(" and ", i)) {
      clauses.push(filter.slice(start, i));
      start = i + 5;
      i += 4;
    }
  }
  clauses.push(filter.slice(start));
  return clauses.map((clause) => clause.trim()).filter(Boolean);
}

/** The same query, minus whatever CREA has told us it rejects. */
export function adaptDdfUrl(url: string): string {
  if (rejectedSelectFields.size === 0 && rejectedFilterProperties.size === 0) return url;
  const parsed = new URL(url);
  const select = parsed.searchParams.get("$select");
  if (select) {
    const kept = select.split(",").filter((field) => !rejectedSelectFields.has(field.trim()));
    if (kept.length) parsed.searchParams.set("$select", kept.join(","));
    else parsed.searchParams.delete("$select");
  }
  const filter = parsed.searchParams.get("$filter");
  if (filter) {
    // Property names outside quoted values only: a city called "StandardStatus" is not a reference.
    const mentions = (clause: string, property: string) => new RegExp(`\\b${property}\\b`).test(clause.replace(/'(?:[^']|'')*'/g, "''"));
    const kept = topLevelClauses(filter).filter((clause) => ![...rejectedFilterProperties].some((property) => mentions(clause, property)));
    if (kept.length) parsed.searchParams.set("$filter", kept.join(" and "));
    else parsed.searchParams.delete("$filter");
  }
  const orderby = parsed.searchParams.get("$orderby");
  if (orderby) {
    const kept = orderby.split(",").filter((term) => !rejectedFilterProperties.has(term.trim().split(/\s+/)[0]));
    if (kept.length) parsed.searchParams.set("$orderby", kept.join(","));
    else parsed.searchParams.delete("$orderby");
  }
  return parsed.toString();
}

/** Every Property request goes through here: rate limits honoured, schema changes absorbed. */
async function ddfApiFetch(url: string, init: RequestInit): Promise<Response> {
  let response = await ddfRateLimitedFetch(adaptDdfUrl(url), init);
  for (let attempt = 0; attempt < MAX_SCHEMA_RETRIES && response.status === 400; attempt += 1) {
    const body = await response.clone().text().catch(() => "");
    if (!learnFromDdfError(body)) break;
    response = await ddfRateLimitedFetch(adaptDdfUrl(url), init);
  }
  return response;
}

async function mintDdfToken(): Promise<string> {
  const username = process.env.CREA_DDF_USERNAME;
  const password = process.env.CREA_DDF_PASSWORD;

  if (!username || !password) {
    throw new Error("CREA DDF credentials not configured");
  }

  const response = await fetch(DDF_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: username,
      client_secret: password,
      scope: "DDFApi_Read",
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("DDF token error:", response.status, errorText);
    throw new Error(`DDF authentication failed: ${response.status} - ${errorText}`);
  }

  const data: DdfTokenResponse = await response.json();

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  console.log("DDF token acquired, expires in", data.expires_in, "seconds");
  return cachedToken.token;
}

export async function getDdfToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  if (!tokenMint) {
    tokenMint = mintDdfToken().finally(() => {
      tokenMint = null;
    });
  }
  return tokenMint;
}

export async function searchDdfListings(params: {
  city?: string;
  stateOrProvince?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  maxBeds?: number;
  minUnits?: number;
  propertySubType?: string;
  excludeBusinessSales?: boolean;
  excludeParking?: boolean;
  excludeVacantLand?: boolean;
  /** Restrict to rental/lease listings (LeaseAmount is only set on leases). */
  forLease?: boolean;
  /** Defaults to Active; pass e.g. "Pending" or "Coming Soon" for other statuses. */
  standardStatus?: string;
  latitudeMin?: number;
  latitudeMax?: number;
  longitudeMin?: number;
  longitudeMax?: number;
  top?: number;
  skip?: number;
  /** Server-provided continuation URL; when set it takes precedence over skip. */
  nextLink?: string;
}): Promise<{ listings: DdfListing[]; count: number; numPages: number; page: number; rawPageSize: number; nextLink: string | null }> {
  const token = await getDdfToken();

  const filters: string[] = [];
  filters.push(`StandardStatus eq '${(params.standardStatus || "Active").replace(/'/g, "''")}'`);
  if (params.forLease) {
    // DDF dropped TransactionType (For sale/For rent); lease listings are now
    // the ones carrying a LeaseAmount.
    filters.push("LeaseAmount ne null");
  }

  if (params.city) {
    filters.push(`City eq '${params.city.replace(/'/g, "''")}'`);
  }
  if (params.stateOrProvince) {
    filters.push(`StateOrProvince eq '${params.stateOrProvince.replace(/'/g, "''")}'`);
  }
  if (params.minPrice) {
    filters.push(`ListPrice ge ${params.minPrice}`);
  }
  if (params.maxPrice) {
    filters.push(`ListPrice le ${params.maxPrice}`);
  }
  if (params.minBeds) {
    filters.push(`BedroomsTotal ge ${params.minBeds}`);
  }
  if (params.maxBeds) {
    filters.push(`BedroomsTotal le ${params.maxBeds}`);
  }
  if (params.minUnits && params.minUnits > 1) {
    filters.push(`NumberOfUnitsTotal ge ${params.minUnits}`);
  }
  if (params.propertySubType) {
    filters.push(`PropertySubType eq '${params.propertySubType.replace(/'/g, "''")}'`);
  }
  // PropertySubType exclusions applied post-fetch (OData enum filtering not supported)
  if (params.latitudeMin != null && params.latitudeMax != null) {
    filters.push(`Latitude ge ${params.latitudeMin} and Latitude le ${params.latitudeMax}`);
  }
  if (params.longitudeMin != null && params.longitudeMax != null) {
    filters.push(`Longitude ge ${params.longitudeMin} and Longitude le ${params.longitudeMax}`);
  }

  const top = params.top || 48;
  const skip = params.skip || 0;

  const queryParams = new URLSearchParams();
  queryParams.set("$filter", filters.join(" and "));
  queryParams.set("$count", "true");
  queryParams.set("$top", String(top));
  if (skip > 0) queryParams.set("$skip", String(skip));
  queryParams.set("$orderby", "ModificationTimestamp desc,ListingKey");
  queryParams.set("$select", DDF_SELECT_FIELDS);

  const url = params.nextLink || `${DDF_API_BASE}/Property?${queryParams.toString()}`;

  let response = await ddfApiFetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    // CREA periodically evolves the Property schema. A removed/renamed field
    // in $select makes the whole search return 400 even though authentication
    // and the filter are healthy. Retry once without projection so listing
    // search stays available while our field list catches up.
    if (response.status === 400 && !params.nextLink) {
      const fallbackParams = new URLSearchParams(queryParams);
      fallbackParams.delete("$select");
      const fallbackUrl = `${DDF_API_BASE}/Property?${fallbackParams.toString()}`;
      const fallbackResponse = await ddfApiFetch(fallbackUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (fallbackResponse.ok) {
        console.warn("DDF search projection rejected; retried without $select");
        response = fallbackResponse;
      } else {
        const fallbackErrorText = await fallbackResponse.text();
        console.error("DDF search error:", response.status, errorText, "fallback:", fallbackResponse.status, fallbackErrorText);
        throw new Error(`DDF search failed: ${fallbackResponse.status} - ${fallbackErrorText}`);
      }
    } else {
      console.error("DDF search error:", response.status, errorText);
      throw new Error(`DDF search failed: ${response.status} - ${errorText}`);
    }
  }

  const data: DdfSearchResponse = await response.json();
  let listings = data.value || [];
  // When CREA won't filter on status for us, do it here: a listing that states a different status is dropped.
  const wantedStatus = (params.standardStatus || "Active").toLowerCase();
  listings = listings.filter((listing) => !listing.StandardStatus || listing.StandardStatus.toLowerCase() === wantedStatus);

  const EXCLUDED_SUBTYPES = new Set<string>();
  if (params.excludeParking) {
    EXCLUDED_SUBTYPES.add("parking");
    EXCLUDED_SUBTYPES.add("locker");
    EXCLUDED_SUBTYPES.add("storage");
  }
  if (params.excludeBusinessSales) {
    EXCLUDED_SUBTYPES.add("business");
    EXCLUDED_SUBTYPES.add("commercial");
    EXCLUDED_SUBTYPES.add("sale of business");
  }
  if (EXCLUDED_SUBTYPES.size > 0) {
    listings = listings.filter((l) => {
      const sub = (l.PropertySubType || "").toLowerCase();
      for (const ex of Array.from(EXCLUDED_SUBTYPES)) {
        if (sub.includes(ex)) return false;
      }
      return true;
    });
  }
  if (params.excludeVacantLand) {
    listings = listings.filter((l) => !isVacantLandLikeProperty(l));
  }

  const rawCount = data["@odata.count"] || listings.length;
  const currentPage = Math.floor(skip / top) + 1;
  const totalPages = Math.ceil(rawCount / top);
  const rawPageSize = (data.value || []).length;

  return {
    listings,
    count: rawCount,
    numPages: totalPages,
    page: currentPage,
    rawPageSize,
    nextLink: data["@odata.nextLink"] || null,
  };
}

export async function searchDdfByRemarks(params: {
  searchTerms: string[];
  stateOrProvince?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  maxBeds?: number;
  top?: number;
  skip?: number;
  signal?: AbortSignal;
}): Promise<{ listings: DdfListing[]; count: number }> {
  const token = await getDdfToken();

  const filters: string[] = [];
  filters.push("StandardStatus eq 'Active'");

  if (params.stateOrProvince) {
    filters.push(`StateOrProvince eq '${params.stateOrProvince.replace(/'/g, "''")}'`);
  }
  if (params.city) {
    filters.push(`City eq '${params.city.replace(/'/g, "''")}'`);
  }
  if (params.minPrice) {
    filters.push(`ListPrice ge ${params.minPrice}`);
  }
  if (params.maxPrice) {
    filters.push(`ListPrice le ${params.maxPrice}`);
  }
  if (params.minBeds) {
    filters.push(`BedroomsTotal ge ${params.minBeds}`);
  }
  if (params.maxBeds) {
    filters.push(`BedroomsTotal le ${params.maxBeds}`);
  }

  const remarksClauses: string[] = [];
  for (const term of params.searchTerms) {
    const escaped = term.replace(/'/g, "''");
    remarksClauses.push(`contains(PublicRemarks,'${escaped}')`);
  }
  if (remarksClauses.length > 0) {
    filters.push(`(${remarksClauses.join(" or ")})`);
  }

  const maxPerPage = 100;
  const requestedTop = Math.min(params.top || 100, 100);
  const skip = params.skip || 0;

  const queryParams = new URLSearchParams();
  queryParams.set("$filter", filters.join(" and "));
  queryParams.set("$count", "true");
  queryParams.set("$top", String(requestedTop));
  if (skip > 0) queryParams.set("$skip", String(skip));
  queryParams.set("$orderby", "ModificationTimestamp desc,ListingKey");
  queryParams.set("$select", DDF_SELECT_FIELDS);

  const url = `${DDF_API_BASE}/Property?${queryParams.toString()}`;

  const fetchOpts: RequestInit = {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  };
  if (params.signal) fetchOpts.signal = params.signal;

  const response = await ddfApiFetch(url, fetchOpts);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("DDF remarks search error:", response.status, errorText);
    throw new Error(`DDF remarks search failed: ${response.status} - ${errorText}`);
  }

  const data: DdfSearchResponse = await response.json();
  const allListings = data.value || [];
  const totalCount = data["@odata.count"] || allListings.length;

  if (totalCount > requestedTop && !params.skip) {
    const remainingPages = Math.min(Math.ceil(totalCount / maxPerPage) - 1, 2);
    for (let p = 1; p <= remainingPages; p++) {
      try {
        if (params.signal?.aborted) break;
        const pageParams = new URLSearchParams(queryParams);
        pageParams.set("$skip", String(p * maxPerPage));
        const pageResponse = await ddfApiFetch(`${DDF_API_BASE}/Property?${pageParams.toString()}`, fetchOpts);
        if (pageResponse.ok) {
          const pageData = await pageResponse.json();
          if (pageData?.value) allListings.push(...pageData.value);
        }
      } catch {
      }
    }
  }

  return {
    listings: allListings,
    count: totalCount,
  };
}

export async function getDdfListing(listingKey: string): Promise<DdfListing | null> {
  const token = await getDdfToken();

  const url = `${DDF_API_BASE}/Property('${listingKey}')`;

  const response = await ddfApiFetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`DDF listing fetch failed: ${response.status}`);
  }

  return response.json();
}

export function normalizeDdfListing(ddf: DdfListing): any {
  const images = (ddf.Media || [])
    .sort((a, b) => (a.Order || 0) - (b.Order || 0))
    .map(m => m.MediaURL || "")
    .filter(Boolean);

  const sqft = ddf.LivingArea
    ? String(ddf.LivingArea)
    : ddf.BuildingAreaTotal
      ? String(ddf.BuildingAreaTotal)
      : undefined;

  return {
    mlsNumber: ddf.ListingId || ddf.ListingKey,
    listPrice: ddf.ListPrice || 0,
    address: {
      streetNumber: ddf.StreetNumber || "",
      streetName: ddf.StreetName || "",
      streetSuffix: ddf.StreetSuffix || "",
      streetDirectionPrefix: ddf.StreetDirPrefix || "",
      streetDirection: ddf.StreetDirSuffix || "",
      unitNumber: ddf.UnitNumber || "",
      city: ddf.City || "",
      neighborhood: ddf.CityRegion || "",
      state: ddf.StateOrProvince || "",
      zip: ddf.PostalCode || "",
      country: (ddf.Country === "Canada" || ddf.Country === "CAN") ? "CA" : ddf.Country || "CA",
      area: ddf.CityRegion || ddf.City || "",
    },
    map: ddf.Latitude && ddf.Longitude
      ? { latitude: ddf.Latitude, longitude: ddf.Longitude }
      : undefined,
    details: {
      numBedrooms: ddf.BedroomsTotal || undefined,
      numBathrooms: ddf.BathroomsTotalInteger || undefined,
      numBathroomsPlus: ddf.BathroomsPartial || undefined,
      sqft,
      propertyType: ddf.PropertySubType || ddf.StructureType || undefined,
      yearBuilt: ddf.YearBuilt ? String(ddf.YearBuilt) : undefined,
      description: ddf.PublicRemarks || undefined,
      numParkingSpaces: ddf.ParkingTotal || undefined,
      basement1: ddf.Basement?.join(", ") || undefined,
    },
    type: ddf.PropertySubType || "Residential",
    class: "ResidentialProperty",
    status: ddf.StandardStatus === "Active" ? "A" : ddf.StandardStatus,
    images,
    taxes: ddf.TaxAnnualAmount ? { annualAmount: ddf.TaxAnnualAmount } : undefined,
    daysOnMarket: ddf.OriginalEntryTimestamp
      ? Math.floor((Date.now() - new Date(ddf.OriginalEntryTimestamp).getTime()) / 86400000)
      : undefined,
    listDate: ddf.OriginalEntryTimestamp || undefined,
    totalActualRent: ddf.TotalActualRent || undefined,
    numberOfUnitsTotal: ddf.NumberOfUnitsTotal || undefined,
    lotFrontage: ddf.LotFrontage || undefined,
    lotDepth: ddf.LotDepth || undefined,
    lotArea: ddf.LotSizeArea || undefined,
    lotAreaUnit: ddf.LotSizeAreaUnits || undefined,
    lotDimensions: ddf.LotSizeDimensions || undefined,
    listOfficeName: ddf.ListOfficeName || undefined,
    modificationTimestamp: ddf.ModificationTimestamp || undefined,
    dataSource: "crea_ddf" as const,
  };
}

export async function searchDdfByMlsNumber(mlsNumber: string): Promise<DdfListing | null> {
  const token = await getDdfToken();

  const queryParams = new URLSearchParams();
  queryParams.set("$filter", `ListingId eq '${mlsNumber.replace(/'/g, "''")}'`);
  queryParams.set("$top", "1");
  queryParams.set("$select", DDF_SELECT_FIELDS);

  const url = `${DDF_API_BASE}/Property?${queryParams.toString()}`;

  const response = await ddfApiFetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("DDF MLS search error:", response.status, errorText);
    throw new Error(`DDF MLS search failed: ${response.status} - ${errorText}`);
  }

  const data: DdfSearchResponse = await response.json();
  return data.value?.[0] || null;
}

export function isDdfConfigured(): boolean {
  return !!(process.env.CREA_DDF_USERNAME && process.env.CREA_DDF_PASSWORD);
}
