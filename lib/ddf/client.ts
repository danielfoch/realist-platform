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
  /** CREA's key for the listing brokerage; its name lives on the Office resource (see attachOfficeNames). */
  ListOfficeKey?: string;
  /** Filled in by attachOfficeNames — Property itself has no such field. */
  ListOfficeName?: string;
  NumberOfUnitsTotal?: number;
  AssociationFee?: number;
  AssociationFeeFrequency?: string;
  FrontageLengthNumeric?: number;
  FrontageLengthNumericUnits?: string;
  LotSizeArea?: number;
  LotSizeUnits?: string;
  LotSizeDimensions?: string;
  Zoning?: string;
  ZoningDescription?: string;
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
  // Names as CREA's published Property schema has them (ddfapi-docs.realtor.ca). It has no
  // LotFrontage/LotDepth/LotSizeAreaUnits and no ListOfficeName: frontage is FrontageLengthNumeric,
  // and the brokerage is a key into the Office resource.
  "FrontageLengthNumeric", "FrontageLengthNumericUnits", "LotSizeArea", "LotSizeUnits", "LotSizeDimensions",
  "Zoning", "ZoningDescription",
  "ListOfficeKey",
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
/**
 * How a city is matched. CREA refuses startswith() (verified on the live feed, Sept 2026) and
 * accepts contains(), so that is where we start; it degrades to exact names if that ever changes.
 */
const DEFAULT_CITY_MATCH = "contains" as const;
let cityMatch: "prefix" | "contains" | "exact" = DEFAULT_CITY_MATCH;
const MAX_SCHEMA_RETRIES = 8;

/** What the feed has forced us to give up, for the people running the site. Nothing secret. */
export function ddfAdaptations(): { droppedFields: string[]; droppedFilters: string[]; cityMatch: string } {
  return { droppedFields: [...rejectedSelectFields], droppedFilters: [...rejectedFilterProperties], cityMatch };
}

/** For tests. */
export function forgetDdfSchemaRejections(): void {
  rejectedSelectFields.clear();
  rejectedFilterProperties.clear();
  cityMatch = DEFAULT_CITY_MATCH;
}

/** For tests: start from the most capable mode, as if CREA's behaviour were unknown. */
export function assumeDdfCityPrefixSupport(): void {
  cityMatch = "prefix";
}

/**
 * contains() over-matches: "London" also finds "New London". Keep the city asked for, its
 * "City (Community)" form (already folded into City), and its compass districts — the London
 * board publishes "London East", "London South" as cities.
 */
export function isSameCity(listed: string | undefined, wanted: string): boolean {
  const city = (listed ?? "").trim().toLowerCase();
  const target = wanted.trim().toLowerCase();
  return city === target || new RegExp(`^${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} (east|west|north|south|central)$`).test(city);
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
  if (/startswith/i.test(details) && cityMatch === "prefix") {
    cityMatch = "contains";
    console.warn("[ddf] CREA won't evaluate startswith(); city searches use contains()");
    return true;
  }
  if (/contains/i.test(details) && cityMatch === "contains") {
    cityMatch = "exact";
    console.warn("[ddf] CREA won't evaluate contains() on City; city searches fall back to exact names");
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
  if (rejectedSelectFields.size === 0 && rejectedFilterProperties.size === 0 && cityMatch === "prefix") return url;
  const parsed = new URL(url);
  if (cityMatch !== "prefix") {
    const current = parsed.searchParams.get("$filter");
    const replacement = cityMatch === "contains" ? "contains(City,'$1')" : "City eq '$1'";
    if (current) parsed.searchParams.set("$filter", current.replace(/\(City eq '((?:[^']|'')*)' or startswith\(City,'(?:[^']|'')*'\)\)/g, replacement));
  }
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

/**
 * CREA also changes the SHAPE of fields: `StructureType` now arrives as a list
 * (["House"]) where it used to be text, and everything downstream — eligibility
 * rules, the crawler's text columns, the page — expects text. Fix it once, at the
 * door: anything we treat as text is text after this, whatever CREA sent.
 */
const TEXT_FIELDS = [
  "PropertySubType", "StructureType", "StandardStatus", "City", "CityRegion", "StateOrProvince", "PostalCode", "Country",
  "UnparsedAddress", "StreetNumber", "StreetName", "StreetSuffix", "StreetDirPrefix", "StreetDirSuffix", "UnitNumber",
  "PublicRemarks", "ListOfficeName", "ListOfficeKey", "LotSizeDimensions", "LotSizeUnits", "FrontageLengthNumericUnits", "Zoning", "ZoningDescription",
  "LivingAreaUnits", "BuildingAreaUnits",
  "LeaseAmountFrequency", "AssociationFeeFrequency", "ListingId", "ListingKey",
] as const;

/** "Duplex" → 2, "Triplex" → 3, "Fourplex" → 4. Anything vaguer ("Multi-family") stays unknown rather than guessed. */
export function unitsFromBuildingType(text: string): number | null {
  const type = text.toLowerCase();
  if (/four-?plex|4-?plex|quadruplex|quadplex/.test(type)) return 4;
  if (/tri-?plex|3-?plex/.test(type)) return 3;
  if (/du-?plex|2-?plex/.test(type)) return 2;
  return null;
}

/** Nobody sells a unit of a rental building for less than this; below it, the count belongs to a building the listing is merely in. */
const MIN_PRICE_PER_UNIT = 40_000;

export function plausibleUnitCount(units: number, price: unknown, subType: unknown): boolean {
  if (!(units >= 1)) return false;
  if (units === 1) return true;
  // A single dwelling (house, condo apartment) can hold a suite or two — not a dozen.
  if (typeof subType === "string" && /single family/i.test(subType) && units > 4) return false;
  if (typeof price === "number" && price > 0 && price / units < MIN_PRICE_PER_UNIT) return false;
  return true;
}

/** Two or more units, by count or by class. */
export function isMultiUnit(listing: { NumberOfUnitsTotal?: number; PropertySubType?: string; StructureType?: string }): boolean {
  return (listing.NumberOfUnitsTotal ?? 0) >= 2 || /multi-?\s?family|multiplex|duplex|triplex|fourplex/i.test(`${listing.PropertySubType ?? ""} ${listing.StructureType ?? ""}`);
}

export function coerceDdfListing<T extends object>(raw: T): T {
  const listing = raw as Record<string, unknown>;
  for (const field of TEXT_FIELDS) {
    const value = listing[field];
    if (value == null || typeof value === "string") continue;
    if (Array.isArray(value)) listing[field] = value.filter((item) => typeof item === "string" || typeof item === "number").join(", ");
    else if (typeof value === "number" || typeof value === "boolean") listing[field] = String(value);
    else listing[field] = "";
  }
  // Some boards (Calgary's, for one) put the whole BUILDING's unit count on a single condo: a $340K
  // one-bedroom "with 483 units". Multiply a rent by that and the card shows an 1,884% yield. A count
  // is only believed when it could describe what is actually for sale.
  if (typeof listing.NumberOfUnitsTotal === "number" && !plausibleUnitCount(listing.NumberOfUnitsTotal, listing.ListPrice, listing.PropertySubType)) {
    delete listing.NumberOfUnitsTotal;
  }
  // The Toronto-area board never fills in NumberOfUnitsTotal; the building type says it instead.
  // Without this a triplex is underwritten as one unit and never shows up under "multi-unit".
  if (!(typeof listing.NumberOfUnitsTotal === "number" && listing.NumberOfUnitsTotal > 0)) {
    const inferred = unitsFromBuildingType(`${listing.StructureType ?? ""} ${listing.PropertySubType ?? ""}`);
    if (inferred) listing.NumberOfUnitsTotal = inferred;
  }
  // The Toronto-area board publishes the community inside the city: "Toronto (Regent Park)",
  // "Markham (Greensborough)". Rents, learned defaults, buy boxes and meetups are all keyed by
  // city — so the city is the city, and the community goes where a community belongs.
  const city = typeof listing.City === "string" ? listing.City.match(/^(.+?)\s*\((.+)\)\s*$/) : null;
  if (city) {
    listing.City = city[1].trim();
    if (!listing.CityRegion) listing.CityRegion = city[2].trim();
  }
  return raw;
}

// ---------------------------------------------------------------------------
// The listing brokerage. CREA requires its name wherever a listing is shown;
// Property carries only ListOfficeKey, and the name is on the Office resource.
// Offices change rarely: one lookup per unseen key, remembered for a day.
// ---------------------------------------------------------------------------

const officeNames = new Map<string, { name: string | null; at: number }>();
const OFFICE_TTL_MS = 24 * 60 * 60 * 1000;
const OFFICE_BATCH = 40;

/** For tests. */
export function forgetDdfOffices(): void {
  officeNames.clear();
}

/** Fill in ListOfficeName on each listing. Never throws: a listing without a name is handled downstream. */
export async function attachOfficeNames<T extends { ListOfficeKey?: string; ListOfficeName?: string }>(listings: T[], token: string): Promise<T[]> {
  const now = Date.now();
  const unknown = [...new Set(listings.map((listing) => listing.ListOfficeKey).filter((key): key is string => typeof key === "string" && key.length > 0))].filter((key) => {
    const known = officeNames.get(key);
    return !known || now - known.at > OFFICE_TTL_MS;
  });
  for (let i = 0; i < unknown.length; i += OFFICE_BATCH) {
    const batch = unknown.slice(i, i + OFFICE_BATCH);
    try {
      const query = new URLSearchParams({
        // CREA caps a $filter at 100 nodes; a chain of `or`s blows through it at ~20 keys. Its docs show `in (…)`.
        $filter: `OfficeKey in (${batch.map((key) => `'${key.replace(/'/g, "''")}'`).join(",")})`,
        $select: "OfficeKey,OfficeName",
        $top: String(OFFICE_BATCH),
      });
      const response = await ddfRateLimitedFetch(`${DDF_API_BASE}/Office?${query.toString()}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      if (!response.ok) {
        console.warn(`[ddf] office lookup failed: HTTP ${response.status} ${(await response.text().catch(() => "")).slice(0, 200)}`);
        continue;
      }
      const data = (await response.json()) as { value?: Array<{ OfficeKey?: unknown; OfficeName?: unknown }> };
      for (const key of batch) officeNames.set(key, { name: null, at: now });
      for (const office of data.value ?? []) {
        if (typeof office.OfficeKey === "string" || typeof office.OfficeKey === "number") {
          officeNames.set(String(office.OfficeKey), { name: typeof office.OfficeName === "string" && office.OfficeName.trim() ? office.OfficeName.trim() : null, at: now });
        }
      }
    } catch (error) {
      console.warn("[ddf] office lookup failed:", (error as Error).message);
    }
  }
  for (const listing of listings) {
    const name = listing.ListOfficeKey ? officeNames.get(listing.ListOfficeKey)?.name : null;
    if (name) listing.ListOfficeName = name;
  }
  return listings;
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

/**
 * "Toronto" has to find "Toronto (Regent Park)" too — that is how the Toronto-area board
 * publishes nearly all of its listings; an exact match alone finds a few dozen.
 */
export function cityFilter(city: string): string {
  const escaped = city.trim().replace(/'/g, "''");
  return `(City eq '${escaped}' or startswith(City,'${escaped} ('))`;
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
  } else {
    // …and for-sale listings are the ones carrying a price. Without this, rentals ($0 "price",
    // nothing to underwrite) made up ~40% of a Toronto results page.
    filters.push("ListPrice gt 0");
  }

  if (params.city) {
    filters.push(cityFilter(params.city));
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
    // "Multi-unit" by count OR by class: whole boards leave the count empty and say "Multi-family" instead.
    filters.push(params.minUnits === 2 ? "(NumberOfUnitsTotal ge 2 or PropertySubType eq 'Multi-family')" : `NumberOfUnitsTotal ge ${params.minUnits}`);
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
  let listings = await attachOfficeNames((data.value || []).map(coerceDdfListing), token);
  if (!params.forLease) listings = listings.filter((listing) => (listing.ListPrice ?? 0) > 0);
  // If CREA ever refuses part of that group the whole group is dropped, so the rule is enforced here too.
  if (params.minUnits === 2) listings = listings.filter(isMultiUnit);
  if (params.city && cityMatch === "contains") {
    const wanted = params.city;
    listings = listings.filter((listing) => isSameCity(listing.City, wanted));
  }
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
  // Motivated-seller search is about purchases: leave the rentals out.
  filters.push("ListPrice gt 0");

  if (params.stateOrProvince) {
    filters.push(`StateOrProvince eq '${params.stateOrProvince.replace(/'/g, "''")}'`);
  }
  if (params.city) {
    filters.push(cityFilter(params.city));
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
  const allListings = await attachOfficeNames((data.value || []).map(coerceDdfListing), token);
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
          if (pageData?.value) allListings.push(...(await attachOfficeNames((pageData.value as DdfListing[]).map(coerceDdfListing), token)));
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

  const [listing] = await attachOfficeNames([coerceDdfListing((await response.json()) as DdfListing)], token);
  return listing;
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
    lotFrontage: ddf.FrontageLengthNumeric || undefined,
    lotFrontageUnit: ddf.FrontageLengthNumericUnits || undefined,
    lotArea: ddf.LotSizeArea || undefined,
    lotAreaUnit: ddf.LotSizeUnits || undefined,
    zoning: ddf.ZoningDescription || ddf.Zoning || undefined,
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
  if (!data.value?.[0]) return null;
  const [listing] = await attachOfficeNames([coerceDdfListing(data.value[0])], token);
  return listing;
}

export function isDdfConfigured(): boolean {
  return !!(process.env.CREA_DDF_USERNAME && process.env.CREA_DDF_PASSWORD);
}
