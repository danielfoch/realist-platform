/**
 * Public-page structured data parsers. JSON-LD and OpenGraph only —
 * no guessed beds/prices from titles.
 */
export interface ParsedListingSignals {
  address?: string;
  streetAddress?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  lat?: number;
  lng?: number;
  listPrice?: number;
  currency?: string;
  beds?: number;
  baths?: number;
  units?: number;
  propertyType?: string;
  mlsNumber?: string;
  externalId?: string;
  areaSqft?: number;
  areaSqm?: number;
  areaUnit?: "sqft" | "sqm";
  title?: string;
  provenance: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.]/g, "");
    if (!cleaned) return undefined;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function typeList(node: Record<string, unknown>): string[] {
  const raw = node["@type"];
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === "string");
  return [];
}

function flattenJsonLd(html: string): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    try {
      const parsed = JSON.parse(match[1].replace(/<!--[\s\S]*?-->/g, "").trim());
      const stack = Array.isArray(parsed) ? parsed : [parsed];
      while (stack.length) {
        const item = stack.pop();
        const rec = asRecord(item);
        if (!rec) continue;
        nodes.push(rec);
        const graph = rec["@graph"];
        if (Array.isArray(graph)) stack.push(...graph);
      }
    } catch {
      // Ignore invalid JSON-LD blocks.
    }
  }
  return nodes;
}

function readAddress(value: unknown, out: ParsedListingSignals) {
  if (typeof value === "string" && value.trim()) {
    out.address ??= value.trim();
    return;
  }
  const rec = asRecord(value);
  if (!rec) return;
  const street = asString(rec.streetAddress);
  const city = asString(rec.addressLocality);
  const region = asString(rec.addressRegion);
  const postal = asString(rec.postalCode);
  const country = asString(rec.addressCountry);
  if (street) out.streetAddress ??= street;
  if (city) out.city ??= city;
  if (region) out.region ??= region;
  if (postal) out.postalCode ??= postal;
  if (country) out.country ??= country.length === 2 ? country.toUpperCase() : country;
  const composed = [street, city, region, postal].filter(Boolean).join(", ");
  if (composed) out.address ??= composed;
}

function readOffer(value: unknown, out: ParsedListingSignals) {
  const rec = asRecord(value) ?? (Array.isArray(value) ? asRecord(value[0]) : null);
  if (!rec) return;
  const price = asNumber(rec.price);
  if (price != null) out.listPrice ??= price;
  const currency = asString(rec.priceCurrency);
  if (currency && currency.length === 3) out.currency ??= currency.toUpperCase();
}

function applyJsonLdNode(node: Record<string, unknown>, out: ParsedListingSignals) {
  const types = typeList(node).map((type) => type.toLowerCase());
  const interesting = types.some((type) =>
    /realestate|residence|house|apartment|product|offer|place|accommodation|singlefamily/.test(type)
  );
  if (!interesting && !node.address && !node.offers) return;

  const name = asString(node.name);
  if (name) out.title ??= name;
  readAddress(node.address, out);
  readOffer(node.offers, out);
  if (asNumber(node.price) != null) out.listPrice ??= asNumber(node.price);
  const currency = asString(node.priceCurrency);
  if (currency && currency.length === 3) out.currency ??= currency.toUpperCase();

  const beds = asNumber(node.numberOfBedrooms ?? node.numberOfRooms);
  if (beds != null) out.beds ??= beds;
  const baths = asNumber(node.numberOfBathroomsTotal ?? node.numberOfBathrooms);
  if (baths != null) out.baths ??= baths;

  const geo = asRecord(node.geo);
  if (geo) {
    const lat = asNumber(geo.latitude);
    const lng = asNumber(geo.longitude);
    if (lat != null) out.lat ??= lat;
    if (lng != null) out.lng ??= lng;
  }

  const ident = asString(node.identifier ?? node.sku ?? node.mpn);
  if (ident) out.mlsNumber ??= ident;

  const floor = asRecord(node.floorSize);
  if (floor) {
    const value = asNumber(floor.value);
    const unit = asString(floor.unitCode ?? floor.unitText)?.toLowerCase();
    if (value != null && unit) {
      if (unit.includes("mtk") || unit.includes("m2") || unit.includes("sqm") || unit.includes("square metre")) {
        out.areaSqm ??= value;
        out.areaUnit ??= "sqm";
      } else if (unit.includes("ftk") || unit.includes("sqft") || unit.includes("square foot")) {
        out.areaSqft ??= value;
        out.areaUnit ??= "sqft";
      }
    }
  }
}

function metaContents(html: string, attr: "property" | "name", key: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${key}["'][^>]*>`,
    "i",
  );
  const match = html.match(re);
  const value = match?.[1] || match?.[2];
  return value?.trim() || undefined;
}

export function parseJsonLd(html: string): ParsedListingSignals {
  const out: ParsedListingSignals = { provenance: [] };
  const nodes = flattenJsonLd(html);
  for (const node of nodes) applyJsonLdNode(node, out);
  if (out.address || out.listPrice) out.provenance.push("jsonld");
  return out;
}

export function parseOpenGraph(html: string): ParsedListingSignals {
  const out: ParsedListingSignals = { provenance: [] };
  const title = metaContents(html, "property", "og:title") || metaContents(html, "name", "og:title");
  if (title) out.title = title;
  const street = metaContents(html, "property", "og:street-address");
  const city = metaContents(html, "property", "og:locality");
  const region = metaContents(html, "property", "og:region");
  const postal = metaContents(html, "property", "og:postal-code");
  const country = metaContents(html, "property", "og:country-name");
  if (street) out.streetAddress = street;
  if (city) out.city = city;
  if (region) out.region = region;
  if (postal) out.postalCode = postal;
  if (country) out.country = country.length === 2 ? country.toUpperCase() : country;
  const composed = [street, city, region, postal].filter(Boolean).join(", ");
  if (composed) out.address = composed;

  const price = asNumber(
    metaContents(html, "property", "product:price:amount")
    || metaContents(html, "property", "og:price:amount"),
  );
  if (price != null) out.listPrice = price;
  const currency = metaContents(html, "property", "product:price:currency")
    || metaContents(html, "property", "og:price:currency");
  if (currency && currency.length === 3) out.currency = currency.toUpperCase();

  const lat = asNumber(metaContents(html, "property", "og:latitude") || metaContents(html, "property", "place:location:latitude"));
  const lng = asNumber(metaContents(html, "property", "og:longitude") || metaContents(html, "property", "place:location:longitude"));
  if (lat != null) out.lat = lat;
  if (lng != null) out.lng = lng;

  if (out.address || out.listPrice) out.provenance.push("opengraph");
  return out;
}

export function looksLikeLoginWall(html: string, signals: ParsedListingSignals): boolean {
  if (signals.listPrice != null || signals.address) return false;
  const lower = html.toLowerCase();
  const loginish = /sign in|log in|create an account|login required|verify you are human|captcha/.test(lower);
  const password = /type=["']password["']/.test(lower);
  return loginish && password;
}

export function mergeSignals(...parts: ParsedListingSignals[]): ParsedListingSignals {
  const out: ParsedListingSignals = { provenance: [] };
  for (const part of parts) {
    for (const [key, value] of Object.entries(part)) {
      if (key === "provenance") {
        out.provenance.push(...part.provenance);
        continue;
      }
      if (value != null && (out as any)[key] == null) (out as any)[key] = value;
    }
  }
  out.provenance = [...new Set(out.provenance)];
  return out;
}
