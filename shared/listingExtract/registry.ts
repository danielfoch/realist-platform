import { BUILTIN_EXTRACTORS, genericExtractor } from "./extractors";
import type { ListingExtractor } from "./types";

const extra: ListingExtractor[] = [];

export function registerExtractor(extractor: ListingExtractor) {
  extra.unshift(extractor);
}

export type ExtractorSummary = {
  id: string;
  hosts: string[];
  countries?: string[];
  implemented: boolean;
};

export function listExtractors(): ExtractorSummary[] {
  const summaries: ExtractorSummary[] = [...extra, ...BUILTIN_EXTRACTORS]
    .filter((extractor) => extractor.id !== "generic-jsonld-og")
    .map((extractor) => ({
      id: extractor.id,
      hosts: extractor.hosts.length ? extractor.hosts : ["*"],
      countries: extractor.countries,
      implemented: extractor.implemented,
    }));
  summaries.push({
    id: genericExtractor.id,
    hosts: ["*"],
    implemented: true,
  });
  return summaries;
}

export function normalizeHost(host: string): string {
  return host.replace(/^www\./i, "").toLowerCase();
}

export function hostMatches(host: string, pattern: string): boolean {
  const h = normalizeHost(host);
  const p = normalizeHost(pattern);
  return h === p || h.endsWith(`.${p}`);
}

export function matchExtractor(host: string | null): ListingExtractor {
  if (!host) return genericExtractor;
  for (const extractor of extra) {
    if (extractor.hosts.some((pattern) => hostMatches(host, pattern))) return extractor;
  }
  for (const extractor of BUILTIN_EXTRACTORS) {
    if (extractor.id === "generic-jsonld-og") continue;
    if (extractor.hosts.some((pattern) => hostMatches(host, pattern))) return extractor;
  }
  return genericExtractor;
}

export function resetRegisteredExtractors() {
  extra.length = 0;
}
