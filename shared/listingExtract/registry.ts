import { BUILTIN_EXTRACTORS, genericExtractor } from "./extractors";
import type { ListingExtractor } from "./types";

const extra: ListingExtractor[] = [];

export function registerExtractor(extractor: ListingExtractor) {
  extra.unshift(extractor);
}

export function listExtractors(): Array<{
  id: string;
  hosts: string[];
  countries?: string[];
  implemented: boolean;
}> {
  return [...extra, ...BUILTIN_EXTRACTORS]
    .filter((extractor) => extractor.id !== "generic-jsonld-og")
    .concat([{ id: genericExtractor.id, hosts: ["*"], implemented: true }])
    .map((extractor) => ({
      id: extractor.id,
      hosts: extractor.hosts.length ? extractor.hosts : ["*"],
      countries: extractor.countries,
      implemented: extractor.implemented,
    }));
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
