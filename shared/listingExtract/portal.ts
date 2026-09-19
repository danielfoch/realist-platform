import { buildExtractResult } from "./buildResult";
import { mergeSignals, parseJsonLd, parseOpenGraph } from "./parse";
import { parseNextData, parsePageModel } from "./structured";
import type { ExtractContext, ExtractResult, ListingExtractor } from "./types";

/** Unambiguous listing-currency defaults when the page omits a symbol. */
export const CURRENCY_BY_COUNTRY: Record<string, string> = {
  GB: "GBP",
  AU: "AUD",
  US: "USD",
  CA: "CAD",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  PT: "EUR",
  SG: "SGD",
  MY: "MYR",
};

export function currencyForCountry(country?: string): string | undefined {
  if (!country) return undefined;
  return CURRENCY_BY_COUNTRY[country.toUpperCase()];
}

export function externalIdFromUrl(url: string | null | undefined, pattern: RegExp): string | undefined {
  if (!url) return undefined;
  const match = url.match(pattern);
  return match?.[1];
}

export function extractFromPublicMarkup(
  ctx: ExtractContext,
  extractorId: string,
  extraWarnings: string[] = [],
): ExtractResult {
  const jsonld = parseJsonLd(ctx.html);
  const og = parseOpenGraph(ctx.html);
  const nextData = parseNextData(ctx.html);
  const pageModel = parsePageModel(ctx.html);
  const signals = mergeSignals(jsonld, og, nextData, pageModel);
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

export interface PortalExtractorConfig {
  id: string;
  hosts: string[];
  countries: string[];
  /** Default ISO 4217 when the page has a price but no currency and country is unambiguous. */
  currency: string;
  urlId?: RegExp;
  countryFromHost?: (host: string | null) => string | undefined;
  extraWarnings?: string[];
}

export function createPortalExtractor(config: PortalExtractorConfig): ListingExtractor {
  return {
    id: config.id,
    hosts: config.hosts,
    countries: config.countries,
    implemented: true,
    extract(ctx) {
      const country =
        ctx.hints.country
        || config.countryFromHost?.(ctx.host)
        || config.countries[0];
      const currency =
        ctx.hints.currency
        || currencyForCountry(country)
        || config.currency;
      const result = extractFromPublicMarkup(
        {
          ...ctx,
          hints: {
            ...ctx.hints,
            country,
            currency,
          },
        },
        config.id,
        config.extraWarnings,
      );
      if (config.urlId) result.listing.externalId ??= externalIdFromUrl(ctx.url, config.urlId);
      if (!result.property.country) result.property.country = country;
      if (!result.listing.currency) result.listing.currency = currency;
      result.listing.source = config.id;
      return result;
    },
  };
}
