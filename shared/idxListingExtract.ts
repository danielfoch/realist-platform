// Extract real-estate listings from a partner's IDX website HTML.
//
// Strategy: structured data only. Most IDX vendors (iHomefinder, IDX Broker,
// Sierra, Real Geeks, etc.) emit schema.org JSON-LD for SEO; parsing it is
// vendor-agnostic and far more stable than scraping markup. Pages without
// JSON-LD listings import zero rows — the partner UI surfaces that so the
// partner can point us at a better page. Pure module: no fetch, no DB.

export interface ExtractedIdxListing {
  externalId: string;
  sourceUrl: string | null;
  mlsNumber: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  listPrice: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  propertyType: string | null;
  photoUrl: string | null;
  description: string | null;
  listingBrokerage: string | null;
}

const LISTING_TYPES = new Set([
  "RealEstateListing",
  "SingleFamilyResidence",
  "House",
  "Apartment",
  "Residence",
  "Product",
]);

export const MAX_IDX_LISTINGS_PER_SYNC = 100;

/** Pull every JSON-LD block out of an HTML document. Malformed blocks are skipped. */
export function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const scriptRe = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(match[1].trim()));
    } catch {
      // skip malformed JSON-LD
    }
  }
  return blocks;
}

function asArray(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Flatten JSON-LD blocks (including @graph and ItemList wrappers) into candidate nodes. */
function flattenNodes(blocks: unknown[]): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  const visit = (value: unknown) => {
    for (const item of asArray(value)) {
      if (!item || typeof item !== "object") continue;
      if (Array.isArray(item)) {
        visit(item);
        continue;
      }
      const node = item as Record<string, unknown>;
      nodes.push(node);
      if (node["@graph"]) visit(node["@graph"]);
      if (node.itemListElement) visit(node.itemListElement);
      // schema.org ListItem wraps the actual entity in `item`
      if (node.item && typeof node.item === "object") visit(node.item);
      if (node.mainEntity) visit(node.mainEntity);
    }
  };
  visit(blocks);
  return nodes;
}

function nodeTypes(node: Record<string, unknown>): string[] {
  return asArray(node["@type"]).filter((t): t is string => typeof t === "string");
}

function parsePrice(node: Record<string, unknown>): number | null {
  const offers = asArray(node.offers)[0] as Record<string, unknown> | undefined;
  const candidates = [
    (node as { price?: unknown }).price,
    offers?.price,
    (offers?.priceSpecification as Record<string, unknown> | undefined)?.price,
  ];
  for (const raw of candidates) {
    if (raw == null) continue;
    const num = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[$,\s]/g, ""));
    if (Number.isFinite(num) && num > 0) return num;
  }
  return null;
}

function parseAddress(node: Record<string, unknown>): {
  address: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
} {
  const addr = node.address;
  if (typeof addr === "string") {
    return { address: addr, city: null, region: null, postalCode: null };
  }
  const a = (asArray(addr)[0] || {}) as Record<string, unknown>;
  const street = typeof a.streetAddress === "string" ? a.streetAddress : null;
  const city = typeof a.addressLocality === "string" ? a.addressLocality : null;
  const region = typeof a.addressRegion === "string" ? a.addressRegion : null;
  const postalCode = typeof a.postalCode === "string" ? a.postalCode : null;
  const address = street || [city, region].filter(Boolean).join(", ") || null;
  return { address, city, region, postalCode };
}

function parseNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "object") {
    // QuantitativeValue
    return parseNumber((value as Record<string, unknown>).value);
  }
  const num = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(num) ? num : null;
}

function parsePhoto(node: Record<string, unknown>): string | null {
  const image = asArray(node.image)[0];
  if (typeof image === "string") return image;
  if (image && typeof image === "object") {
    const url = (image as Record<string, unknown>).url || (image as Record<string, unknown>).contentUrl;
    if (typeof url === "string") return url;
  }
  return null;
}

function parseBrokerage(node: Record<string, unknown>): string | null {
  for (const key of ["broker", "seller", "provider"]) {
    const entity = asArray(node[key])[0];
    if (typeof entity === "string" && entity.trim()) return entity.trim();
    if (entity && typeof entity === "object") {
      const name = (entity as Record<string, unknown>).name;
      if (typeof name === "string" && name.trim()) return name.trim();
    }
  }
  return null;
}

function resolveUrl(raw: unknown, baseUrl: string): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Extract normalized listings from a page's HTML. `baseUrl` resolves relative
 * listing URLs. Listings without a price AND without an address are dropped
 * (they're nav/branding nodes, not inventory). Deduped by externalId.
 */
export function extractIdxListings(html: string, baseUrl: string): ExtractedIdxListing[] {
  const nodes = flattenNodes(extractJsonLdBlocks(html));
  const results: ExtractedIdxListing[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    if (!nodeTypes(node).some((t) => LISTING_TYPES.has(t))) continue;

    const { address, city, region, postalCode } = parseAddress(node);
    const listPrice = parsePrice(node);
    if (!address && listPrice == null) continue;

    const sourceUrl = resolveUrl(node.url ?? node["@id"], baseUrl);
    const mlsRaw = node.mlsNumber ?? node.sku ?? node.productID ?? node.identifier;
    const mlsNumber =
      typeof mlsRaw === "string" && mlsRaw.trim() ? mlsRaw.trim().replace(/^mls[#:\s]*/i, "") : null;

    const externalId = mlsNumber || sourceUrl || (address ? `addr:${address.toLowerCase()}` : "");
    if (!externalId || seen.has(externalId)) continue;
    seen.add(externalId);

    results.push({
      externalId,
      sourceUrl,
      mlsNumber,
      address,
      city,
      region,
      postalCode,
      listPrice,
      bedrooms: parseNumber(node.numberOfRooms ?? node.numberOfBedrooms),
      bathrooms: parseNumber(node.numberOfBathroomsTotal ?? node.numberOfFullBathrooms),
      propertyType: nodeTypes(node).find((t) => LISTING_TYPES.has(t) && t !== "Product") || null,
      photoUrl: resolveUrl(parsePhoto(node), baseUrl),
      description: typeof node.description === "string" ? node.description.slice(0, 1000) : null,
      listingBrokerage: parseBrokerage(node),
    });

    if (results.length >= MAX_IDX_LISTINGS_PER_SYNC) break;
  }

  return results;
}
