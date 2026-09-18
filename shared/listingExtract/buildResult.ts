import type { ExtractResult } from "./types";
import type { ParsedListingSignals } from "./parse";

const TRACKED_FIELDS = [
  "property.address",
  "listing.listPrice",
  "listing.currency",
  "property.city",
  "property.country",
  "property.beds",
] as const;

function regionOf(signals: ParsedListingSignals): string | undefined {
  return signals.region;
}

export function buildExtractResult(input: {
  signals: ParsedListingSignals;
  extractorId: string;
  host: string | null;
  url: string | null;
  hints?: { country?: string; currency?: string; mlsNumber?: string };
  extraWarnings?: string[];
}): ExtractResult {
  const { signals, extractorId, host, url, hints = {}, extraWarnings = [] } = input;
  const country = (signals.country?.length === 2 ? signals.country : hints.country)?.toUpperCase();
  const currency = (signals.currency || hints.currency)?.toUpperCase();
  const address = signals.address || signals.streetAddress;
  const region = regionOf(signals);
  const missingFields: string[] = [];
  if (!address) missingFields.push("property.address");
  if (signals.listPrice == null) missingFields.push("listing.listPrice");
  if (!currency) missingFields.push("listing.currency");
  if (!signals.city) missingFields.push("property.city");
  if (!country) missingFields.push("property.country");
  if (signals.beds == null) missingFields.push("property.beds");

  const warnings = [...extraWarnings];
  if (!signals.provenance.length) {
    warnings.push("No JSON-LD or OpenGraph listing signals found.");
  }
  warnings.push("Public markup only. Login-walled or paywalled pages are not extracted.");

  let confidence: ExtractResult["confidence"] = "none";
  if (signals.provenance.includes("jsonld") && address && signals.listPrice != null) confidence = "high";
  else if ((address && signals.listPrice != null) || signals.provenance.includes("jsonld")) confidence = "medium";
  else if (address || signals.listPrice != null) confidence = "low";

  return {
    property: {
      address,
      streetAddress: signals.streetAddress,
      city: signals.city,
      province: region,
      state: region,
      region,
      postalCode: signals.postalCode,
      zip: signals.postalCode,
      country,
      geo: signals.lat != null && signals.lng != null ? { lat: signals.lat, lng: signals.lng } : null,
      beds: signals.beds,
      baths: signals.baths,
      units: signals.units,
      propertyType: signals.propertyType,
      areaSqft: signals.areaSqft,
      areaSqm: signals.areaSqm,
      areaUnit: signals.areaUnit,
    },
    listing: {
      mlsNumber: signals.mlsNumber || hints.mlsNumber,
      listPrice: signals.listPrice,
      currency,
      status: "Active",
      source: extractorId,
      sourceUrl: url,
      sourceHost: host,
      externalId: signals.externalId,
      propertyType: signals.propertyType,
    },
    confidence,
    missingFields: TRACKED_FIELDS.filter((field) => missingFields.includes(field)),
    warnings,
    sourceHost: host,
    extractorId,
    raw: {
      provenance: signals.provenance,
      title: signals.title ?? null,
    },
  };
}
