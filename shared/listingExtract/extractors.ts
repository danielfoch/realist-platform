import { buildExtractResult } from "./buildResult";
import { mergeSignals, parseJsonLd, parseOpenGraph } from "./parse";
import type { ExtractContext, ExtractResult, ListingExtractor } from "./types";

function externalIdFromUrl(url: string | null, pattern: RegExp): string | undefined {
  if (!url) return undefined;
  const match = url.match(pattern);
  return match?.[1];
}

function genericExtract(ctx: ExtractContext, extractorId: string, extraWarnings: string[] = []): ExtractResult {
  const jsonld = parseJsonLd(ctx.html);
  const og = parseOpenGraph(ctx.html);
  const signals = mergeSignals(jsonld, og);
  if (ctx.hints.mlsNumber) signals.mlsNumber ??= ctx.hints.mlsNumber;
  return buildExtractResult({
    signals,
    extractorId,
    host: ctx.host,
    url: ctx.url,
    hints: ctx.hints,
    extraWarnings,
  });
}

export const genericExtractor: ListingExtractor = {
  id: "generic-jsonld-og",
  hosts: [],
  implemented: true,
  extract(ctx) {
    return genericExtract(ctx, "generic-jsonld-og");
  },
};

export const realtorCaExtractor: ListingExtractor = {
  id: "realtor-ca",
  hosts: ["realtor.ca"],
  countries: ["CA"],
  implemented: true,
  extract(ctx) {
    const result = genericExtract(ctx, "realtor-ca");
    if (!result.property.country) result.property.country = "CA";
    if (!result.listing.currency) result.listing.currency = "CAD";
    result.listing.source = "realtor-ca";
    return result;
  },
};

export const zillowExtractor: ListingExtractor = {
  id: "zillow",
  hosts: ["zillow.com"],
  countries: ["US"],
  implemented: true,
  extract(ctx) {
    const result = genericExtract(ctx, "zillow", [
      "Zillow public markup is fragile and often login-gated. Missing facts stay null.",
    ]);
    result.listing.externalId ??= externalIdFromUrl(ctx.url, /(\d+)_zpid/i);
    if (!result.property.country) result.property.country = ctx.hints.country || "US";
    if (!result.listing.currency) result.listing.currency = ctx.hints.currency || "USD";
    result.listing.source = "zillow";
    return result;
  },
};

export const redfinExtractor: ListingExtractor = {
  id: "redfin",
  hosts: ["redfin.com"],
  countries: ["US"],
  implemented: true,
  extract(ctx) {
    const result = genericExtract(ctx, "redfin");
    result.listing.externalId ??= externalIdFromUrl(ctx.url, /\/home\/(\d+)/i);
    if (!result.property.country) result.property.country = ctx.hints.country || "US";
    if (!result.listing.currency) result.listing.currency = ctx.hints.currency || "USD";
    result.listing.source = "redfin";
    return result;
  },
};

/** Registry hook example — falls back to generic JSON-LD/OG until implemented. */
export const rightmoveStubExtractor: ListingExtractor = {
  id: "rightmove-uk",
  hosts: ["rightmove.co.uk"],
  countries: ["GB"],
  implemented: false,
  extract(ctx) {
    const result = genericExtract(ctx, "rightmove-uk", [
      "TODO: dedicated Rightmove extractor. Using generic JSON-LD/OpenGraph for now.",
    ]);
    if (!result.property.country) result.property.country = ctx.hints.country || "GB";
    if (!result.listing.currency) result.listing.currency = ctx.hints.currency || "GBP";
    return result;
  },
};

export const domainAuStubExtractor: ListingExtractor = {
  id: "domain-au",
  hosts: ["domain.com.au"],
  countries: ["AU"],
  implemented: false,
  extract(ctx) {
    const result = genericExtract(ctx, "domain-au", [
      "TODO: dedicated Domain.com.au extractor. Using generic JSON-LD/OpenGraph for now.",
    ]);
    if (!result.property.country) result.property.country = ctx.hints.country || "AU";
    if (!result.listing.currency) result.listing.currency = ctx.hints.currency || "AUD";
    return result;
  },
};

export const BUILTIN_EXTRACTORS: ListingExtractor[] = [
  realtorCaExtractor,
  zillowExtractor,
  redfinExtractor,
  rightmoveStubExtractor,
  domainAuStubExtractor,
  genericExtractor,
];
