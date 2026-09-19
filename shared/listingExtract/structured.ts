/**
 * Public embedded JSON: __NEXT_DATA__, PAGE_MODEL, and similar
 * assignment blobs. Walks for listing-shaped objects only —
 * never guesses price/beds from titles or copy.
 */
import {
  asNumber,
  asRecord,
  asString,
  normalizeCountry,
  type ParsedListingSignals,
} from "./parse";

const MAX_WALK_NODES = 2500;
const MAX_WALK_DEPTH = 14;

function extractBalancedObject(source: string, fromIndex: number): string | null {
  const start = source.indexOf("{", fromIndex);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let quote: string | null = null;
  let escape = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === quote) {
        inString = false;
        quote = null;
      }
      continue;
    }
    if (ch === "\"" || ch === "'") {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

function parseJsonObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return asRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function parseScriptJsonById(html: string, id: string): unknown | null {
  const re = new RegExp(
    `<script[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)</script>`,
    "i",
  );
  const match = html.match(re);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return null;
  }
}

export function parseAssignedObject(html: string, name: string): Record<string, unknown> | null {
  const marker = html.search(new RegExp(`(?:window\\.)?${name}\\s*=\\s*\\{`, "i"));
  if (marker < 0) return null;
  return parseJsonObject(extractBalancedObject(html, marker));
}

function readNestedPrice(value: unknown, out: ParsedListingSignals) {
  const rec = asRecord(value);
  if (!rec) {
    const price = asNumber(value);
    if (price != null) out.listPrice ??= price;
    return;
  }
  const price = asNumber(
    rec.primaryPrice
    ?? rec.displayPrice
    ?? rec.salePrice
    ?? rec.listPrice
    ?? rec.amount
    ?? rec.price
    ?? rec.value,
  );
  if (price != null) out.listPrice ??= price;
  const currency = asString(rec.currency ?? rec.priceCurrency);
  if (currency && currency.length === 3) out.currency ??= currency.toUpperCase();
}

function readListingShapedObject(obj: Record<string, unknown>, out: ParsedListingSignals) {
  const display = asString(obj.displayAddress ?? obj.formattedAddress ?? obj.fullAddress);
  if (display) out.address ??= display;

  const street = asString(obj.streetAddress ?? obj.street);
  if (street) out.streetAddress ??= street;
  const city = asString(obj.city ?? obj.suburb ?? obj.locality ?? obj.town ?? obj.addressLocality);
  if (city) out.city ??= city;
  const region = asString(obj.region ?? obj.state ?? obj.province ?? obj.addressRegion ?? obj.ukCountry);
  if (region) out.region ??= region;
  const postal = asString(obj.postalCode ?? obj.postcode ?? obj.zipcode ?? obj.zip);
  if (postal) out.postalCode ??= postal;
  const country = normalizeCountry(asString(obj.country ?? obj.addressCountry ?? obj.countryCode));
  if (country) out.country ??= country;

  if (obj.address != null) {
    const addr = obj.address;
    if (typeof addr === "string" && addr.trim()) out.address ??= addr.trim();
    else if (asRecord(addr)) readListingShapedObject(asRecord(addr)!, out);
  }

  const price = asNumber(
    obj.listPrice ?? obj.salePrice ?? obj.primaryPrice ?? obj.displayPrice ?? obj.askingPrice ?? obj.price,
  );
  if (price != null) out.listPrice ??= price;
  if (obj.prices != null) readNestedPrice(obj.prices, out);
  if (obj.priceDetails != null) readNestedPrice(obj.priceDetails, out);
  if (obj.priceInfo != null) readNestedPrice(obj.priceInfo, out);
  const currency = asString(obj.priceCurrency ?? obj.currency);
  if (currency && currency.length === 3) out.currency ??= currency.toUpperCase();

  const beds = asNumber(obj.bedrooms ?? obj.beds ?? obj.numberOfBedrooms ?? obj.bedroomCount ?? obj.bedroom);
  if (beds != null) out.beds ??= beds;
  const baths = asNumber(obj.bathrooms ?? obj.baths ?? obj.numberOfBathrooms ?? obj.bathroomCount ?? obj.bathroom);
  if (baths != null) out.baths ??= baths;
  const units = asNumber(obj.units ?? obj.numberOfUnits ?? obj.unitCount);
  if (units != null) out.units ??= units;

  const lat = asNumber(obj.latitude ?? obj.lat);
  const lng = asNumber(obj.longitude ?? obj.lng ?? obj.lon);
  if (lat != null) out.lat ??= lat;
  if (lng != null) out.lng ??= lng;
  const geo = asRecord(obj.geo);
  if (geo) {
    const gLat = asNumber(geo.latitude ?? geo.lat);
    const gLng = asNumber(geo.longitude ?? geo.lng);
    if (gLat != null) out.lat ??= gLat;
    if (gLng != null) out.lng ??= gLng;
  }

  const ident = asString(obj.mlsId ?? obj.mlsNumber ?? obj.listingId ?? obj.propertyId ?? obj.id);
  if (ident) {
    out.externalId ??= ident;
    if (/[A-Za-z]/.test(ident) && /\d/.test(ident)) out.mlsNumber ??= ident;
  }

  const propertyType = asString(obj.propertyType ?? obj.listingType ?? obj.category);
  if (propertyType) out.propertyType ??= propertyType;

  const areaSqm = asNumber(obj.livingAreaSqm ?? obj.areaSqm ?? obj.squareMeters ?? obj.surface);
  const areaSqft = asNumber(obj.livingAreaSqft ?? obj.areaSqft ?? obj.squareFeet ?? obj.buildingSize);
  if (areaSqm != null) {
    out.areaSqm ??= areaSqm;
    out.areaUnit ??= "sqm";
  }
  if (areaSqft != null) {
    out.areaSqft ??= areaSqft;
    out.areaUnit ??= "sqft";
  }

  const title = asString(obj.title ?? obj.headline ?? obj.name);
  if (title) out.title ??= title;
}

function listingScore(obj: Record<string, unknown>): number {
  let score = 0;
  if (obj.displayAddress || obj.formattedAddress || obj.streetAddress || obj.address) score += 2;
  if (obj.listPrice != null || obj.primaryPrice != null || obj.displayPrice != null || obj.price != null || obj.prices || obj.priceDetails) score += 2;
  if (obj.bedrooms != null || obj.beds != null || obj.numberOfBedrooms != null) score += 1;
  if (obj.city || obj.suburb || obj.locality) score += 1;
  return score;
}

export function signalsFromJsonTree(root: unknown, provenance: string): ParsedListingSignals {
  const out: ParsedListingSignals = { provenance: [] };
  const candidates: Record<string, unknown>[] = [];
  const budget = { n: 0 };

  const walk = (node: unknown, depth: number) => {
    if (budget.n > MAX_WALK_NODES || depth > MAX_WALK_DEPTH) return;
    budget.n += 1;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    const rec = asRecord(node);
    if (!rec) return;
    if (listingScore(rec) >= 3) candidates.push(rec);
    for (const value of Object.values(rec)) walk(value, depth + 1);
  };
  walk(root, 0);

  candidates.sort((a, b) => listingScore(b) - listingScore(a));
  for (const candidate of candidates) readListingShapedObject(candidate, out);
  if (out.address || out.listPrice) out.provenance.push(provenance);
  return out;
}

export function parseNextData(html: string): ParsedListingSignals {
  const parsed = parseScriptJsonById(html, "__NEXT_DATA__");
  if (parsed == null) return { provenance: [] };
  return signalsFromJsonTree(parsed, "next_data");
}

export function parsePageModel(html: string): ParsedListingSignals {
  const parsed = parseAssignedObject(html, "PAGE_MODEL");
  if (!parsed) return { provenance: [] };
  return signalsFromJsonTree(parsed, "page_model");
}
