import { cityKey, layer, type Layer } from "./model";
import { provinceKey } from "./geocode";

export const BELLEVILLE_AUDIT = {
  auditedAt: "2026-10-03", officialOffer: "https://www.belleville.ca/walk-ride-and-drive/",
  catalogue: "https://opendata-bellevillegis.hub.arcgis.com/", curator: "BellevilleGIS",
  group: "48f6eadd5bcb458a949499e335a077c3", catalogueItemsInspected: 74, rootServicesInspected: 13,
  terms: "https://www.belleville.ca/council-and-administration/city-policies/terms-of-use/",
  disclaimer: "https://opendata-bellevillegis.hub.arcgis.com/pages/disclaimer",
  recordsQueried: false, countsQueried: false, geometryQueried: false,
};
export const BELLEVILLE_WITHHELD = ["municipalAddresses", "permits", "zoning", "planningApplications", "currentPlanningInstruments", "heritage", "parcel", "additionalUnits", "bellevilleConservationRegulation"].map(layer => ({
  layer, url: BELLEVILLE_AUDIT.disclaimer,
  reason: "Belleville's originating Hub disclaimer and City terms expressly restrict maps/apps/data to personal/non-commercial use. Inspected planning item terms are restrictive, blank, Unknown or n/a; no specific commercial redistribution grant was found. No City record, count or geometry queries are performed. National/provincial evidence remains separate. Current files, legal instruments and relevant authority requirements must be confirmed manually.",
}));
export const bellevilleMarket = (city: string | null, province: string | null) => cityKey(city ?? "") === "belleville" && provinceKey(province ?? "") === "ontario";
export function bellevilleLayers(city: string | null, province: string | null): Record<string, Layer> {
  if (!bellevilleMarket(city, province)) return {};
  return Object.fromEntries(BELLEVILLE_WITHHELD.map(g => [g.layer, layer("unavailable", { coverageComplete: false, screenPerformed: false, recordsQueried: false, withheld: g, audit: BELLEVILLE_AUDIT }, null, g.reason)]));
}
export function bellevilleCoverage() {
  return { cities: ["Belleville"], auditDate: BELLEVILLE_AUDIT.auditedAt, delivery: "metadata_only_reuse_audit", datasets: [], withheld: BELLEVILLE_WITHHELD.map(g => ({ ...g, status: "withheld", records: null })), audit: BELLEVILLE_AUDIT, complete: false,
    note: "Rights audit only. Thirteen root services and originating City catalogue/disclaimer were inspected; no live City property data is integrated or counted. DevReady visual access does not grant commercial redistribution or establish current legal development permission." };
}
