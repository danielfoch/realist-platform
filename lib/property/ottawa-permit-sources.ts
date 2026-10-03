import type { Row, Source } from "./model";

export const OTTAWA_PERMIT_FILES = [
  { item: "05046d836248455d92cbc0543ce4c022", title: "Construction, demolition, and pool enclosure permits monthly - 2024 to 2025", name: "Permits2024.xlsx", years: [2024, 2025], legacyMonths: Array.from({ length: 8 }, (_, i) => `2024-${String(i + 1).padStart(2, "0")}`) },
  { item: "a8992582cb764c1a9edaebfb0b30e9c7", title: "Construction, Demolition, and Pool Permits 2026", name: "BuildingPermits2026.xlsx", years: [2026], legacyMonths: [] },
] as const;
export type OttawaPermitFile = typeof OTTAWA_PERMIT_FILES[number];
export const OTTAWA_LICENCE = "https://ottawa.ca/en/city-hall/open-transparent-and-accountable-government/open-data/open-data-licence-version-20";
export const OTTAWA_LICENCE_POLICY = "https://ottawa.ca/en/city-hall/open-transparent-and-accountable-government/open-data/open-data-license-change-faq";
export const OTTAWA_PERMIT_SOURCE: Source = {
  id: "ottawa:permit-reports-2024-2026", name: "Ottawa construction, demolition and pool permit reports, 2024–2026",
  url: "https://open.ottawa.ca/search?q=Construction%20demolition%20pool%20permits",
  licence: "Open Government Licence – City of Ottawa, version 2.0", licenceUrl: OTTAWA_LICENCE,
  attribution: "Contains information licensed under the Open Government Licence – City of Ottawa. Monthly report observations, selected and normalized by Realist/Homies.",
};
// The City's licence FAQ explicitly covers datasets accessed through its open-data
// website after September 8, 2016. These two official catalogue items link that policy.
export function validOttawaPermitItem(item: Row, file: OttawaPermitFile): boolean {
  if (item.id !== file.item || item.owner !== "open.ouvert@ottawa.ca" || item.orgId !== "G6F8XLCl5KtAlZ2G" || item.access !== "public" || item.type !== "Microsoft Excel" || item.name !== file.name || item.title !== file.title || item.url !== null) return false;
  const terms = typeof item.licenseInfo === "string" ? item.licenseInfo : "";
  if (/non.commercial|without written consent|all rights reserved/i.test(terms)) return false;
  const plain = terms.replace(/<[^>]*>/g, "").trim();
  return ["https://ottawa.ca/en/city-hall/get-know-your-city/open-data#open-data-licence-version-2-0", "https://ottawa.ca/en/city-hall/open-transparent-and-accountable-government/open-data", OTTAWA_LICENCE].includes(plain);
}
