import { cityKey, layer, type Layer } from "./model";
import { provinceKey } from "./geocode";
import type { EvidenceQuestion } from "./brief";

const city = "https://www.kawarthalakes.ca";
const planning = `${city}/business-development/planning-and-development`;
const building = `${city}/property-environment/building-septic-and-renovations`;
export const KAWARTHA_TERMS = "https://kawartha.maps.arcgis.com/sharing/rest/content/items/8166769837ab488785217db71b5c39b9/data";
const map = "https://experience.arcgis.com/experience/b2d47f8a51294a6dbe82c604155a0c3f";
export const KAWARTHA_RIGHTS = "The City-offered complete data terms contain reference-only disclaimers and site-use conditions; no explicit compatible commercial merged-data redistribution grant was established for the selected municipal layers. Blank item grants do not establish permission or a categorical commercial-use ban. Separate original provincial OGL feeds are assessed independently. No City feature/count/geometry queries or registry extraction/integration were performed.";
const scope = (layer: string, url: string, reason: string, termsUrl = KAWARTHA_TERMS) => ({ layer, url, termsUrl, reason });
export const KAWARTHA_WITHHELD = [
  scope("municipalAddresses", "https://open-data-kawartha.hub.arcgis.com/", KAWARTHA_RIGHTS),
  scope("parcel", map, "The selected City parcel/ARN item explicitly prohibits sharing outside the City except a contractor under contract with a signed data-sharing agreement. No parcel/PIN/ARN/ownership records or geometry are reused; original Crown lot fabric is separate from modern parcel identity.", "https://www.arcgis.com/sharing/rest/content/items/6c54386e75424b78a4be4ec9ecae8677?f=pjson"),
  scope("zoning", `${planning}/zoning/`, `${KAWARTHA_RIGHTS} Former-township and settlement regimes, current written provisions, exceptions/holds, amendments and appeals require City confirmation.`),
  scope("currentPlanningInstruments", `${planning}/current-planning-initiatives/`, "City guidance reports rural consolidation adopted May 21, 2024, a July 16, 2026 whole-appeal decision and an outstanding review request plus a site-specific appeal. It says former-township by-laws remain in effect, with portions settled January 2026 applying. The ruling itself was not reviewed; this is dated source guidance, not a present property entitlement."),
  scope("officialPlan", `${planning}/official-plan-and-secondary-plans/`, `${KAWARTHA_RIGHTS} City offers a March 2025 office consolidation and separate schedules/urban secondary plans/Oak Ridges Moraine material. Later amendments, operative schedules and property applicability were not fully reviewed.`),
  ...["planningApplications", "variance", "consentToSever", "sitePlanDrawings"].map(name => scope(name, `${planning}/development-applications/`, `${KAWARTHA_RIGHTS} Obtain the complete decision, cleared conditions, approved plans, registered agreements, expiry and appeal outcome. Process guidance or quarterly activity publications are not complete property approval history.`)),
  ...["permits", "inspectionResults", "occupancyDocuments"].map(name => scope(name, `${building}/building-and-septic-search-of-records/`, "City building and septic records use separate applications/fees and owner authorization when requested by someone other than the owner. Retention limits and pre-amalgamation gaps can affect building records; legal surveys are not retained. The record search is separate from legal compliance/zoning confirmation. No application was submitted, paid or represented as complete public history.")),
  scope("septicRecords", `${building}/building-and-septic-search-of-records/`, "Septic records require a separate authorized search. Obtain approved design, installation/inspection and relevant servicing records; a mapped original lot or public permit application service does not establish capacity, current condition, compliance or suitability for additional units."),
  scope("additionalUnits", `${building}/additional-residential-units/`, `${KAWARTHA_RIGHTS} A public ARU register is offered but has not been extracted or integrated. Each ARU needs its own registration evidence; building/inspection/occupancy and septic/servicing review are separate. Rural servicing, natural-area, road-access, agricultural-distance and Oak Ridges Moraine provisions require current property-specific confirmation; a missing register match would not prove illegality.`),
  ...["heritage", "heritageDistrict"].map(name => scope(name, `${planning}/heritage-planning-and-permits/heritage-designation/`, `${KAWARTHA_RIGHTS} The City says its register is being updated and names Downtown Lindsay and Oak Street districts. Current Part IV/Part V/listed status and full designation/amending instruments require confirmation; the linked map items have blank grants.`)),
  scope("kawarthaConservationRegulation", map, "The City map's Regulated Area item has a separate OGL grant, but its original metadata identifies Ontario Hydro Network waterbody mapping for KRCA. That lineage does not establish today's conservation-regulation limits, floodplain, authority jurisdiction or a parcel-wide screen. No records/counts/geometry from that City item were queried. Obtain relevant authority confirmation for proposed work; no clearance or flood-safety finding."),
  scope("shorelineRoadAllowance", `${city}/business-development/property-information-and-compliance-letters/`, "Original lot/concession mapping and raw road-allowance flags do not establish shoreline ownership, closure/conveyance, legal/year-round access, municipal road assumption or maintained frontage. Obtain a survey, title instruments and the City's relevant road/shoreline and compliance files."),
  scope("kawarthasHistoricalNaturalHeritage", "https://data.ontario.ca/en/dataset/kawarthas-naturally-connected", "The separate original Ontario offer is OGL licensed, but the preferred-scenario archive reflects 2012 inputs and is not planned for maintenance. Catalogue metadata and ZIP inventory were audited; GIS conversion/integration remains pending and no property screen was performed. This is a historical natural-heritage candidate, not current wetland, flood or conservation regulation.", "https://www.ontario.ca/page/open-government-licence-ontario"),
];

export const KAWARTHA_AUDIT = {
  city: "Kawartha Lakes", auditedAt: "2026-10-03", terms: KAWARTHA_TERMS,
  catalogue: "https://open-data-kawartha.hub.arcgis.com/", rightsFinding: KAWARTHA_RIGHTS,
  featureQueriesPerformed: false, countsQueried: false, geometryQueried: false, registryExtracted: false,
  metadata: {
    geoHub: "https://geohub-kawartha.hub.arcgis.com/", catalogueDatasets: 22,
    countMeaning: "Catalogue entries, not property records or integrated feeds.",
    planningApp: "b2d47f8a51294a6dbe82c604155a0c3f", planningMap: "b02a375c637d4fdc86317b4d7af954cd",
    termsScope: "Complete City-offered one-page PDF reviewed; ordinary publisher redirect followed without accepting a map agreement.",
    registerScope: "General public ARU guidance HTML includes an offered register; no registry extraction, record counting or reuse integration.",
    zoningPageCounts: "Zoning page names 19 by-laws; initiatives page names 18. These separate page statements do not establish a single reconciled current regime.",
    regulatedAreaItem: "fec5b12ee0064c24a83041cb8afa1559", regulatedAreaLineage: "OHNWBDY / Ontario Hydro Network waterbody, not a verified current conservation-regulation feed.",
    geographicLotItem: "14f52ed9426a4caba56a9bec4a71cdc1", geographicLotScope: "City OGL copy describes February 2023 provincial download, reprojection and clipping. Richer original provincial lot/township sources are integrated independently; no City lot records or counts queried.",
    heritageMap: "e0b52413802c46ad90b6b43929910c67", heritageItems: ["145a1a982186466ba07f7eeaf1b74a83", "8b571f0d22334edeae78396b8791cec4"],
    historicalNaturalHeritage: "Original Ontario 2012 archive; licensed conversion candidate, not current regulation. Original township-specific FAQ link returned 404; the separate lot FAQ covers both original fabrics.",
  },
};
export function kawarthaMarket(name: string | null | undefined, province: string | null | undefined): boolean {
  return provinceKey(province ?? "") === "ontario" && ["kawartha lakes", "lindsay", "fenelon falls", "bobcaygeon", "omemee"].includes(cityKey(name ?? ""));
}
export function kawarthaLayers(name: string | null | undefined, province: string | null | undefined): Record<string, Layer> {
  if (!kawarthaMarket(name, province)) return {};
  return Object.fromEntries(KAWARTHA_WITHHELD.map(g => [g.layer, layer("unavailable", { coverageComplete: false, screenPerformed: false, featureQueriesPerformed: false, countsQueried: false, geometryQueried: false, registryExtracted: false, withheld: g, audit: { city: KAWARTHA_AUDIT.city, auditedAt: KAWARTHA_AUDIT.auditedAt, terms: KAWARTHA_TERMS } }, null, g.reason)]));
}
export function kawarthaQuestions(name: string | null | undefined, province: string | null | undefined): EvidenceQuestion[] {
  return kawarthaMarket(name, province) ? [
    { topic: "kawartha_current_planning", question: "Can the City identify the currently operative former-township/settlement zoning, rural appeal/review outcome and settled portions for this property, plus written exceptions/holds and the current Official Plan, secondary/ORM schedules and later amendments? Can it supply complete planning/Committee decisions, cleared conditions, approved plans and registered agreements?", evidenceLayers: ["zoning", "currentPlanningInstruments", "officialPlan", "planningApplications", "variance", "consentToSever", "sitePlanDrawings"] },
    { topic: "kawartha_building_septic_and_units", question: "Can the seller authorize separate City building and septic record searches and provide final inspections, occupancy, approved septic design/servicing and each advertised ARU's registration letter? Confirm any retention gaps, rural road/servicing, agricultural-distance and ORM requirements separately; public register inclusion does not prove all approvals.", evidenceLayers: ["permits", "inspectionResults", "occupancyDocuments", "septicRecords", "additionalUnits"] },
    { topic: "kawartha_heritage_and_waterfront", question: "Can the Clerk confirm the updated statutory heritage register and Part IV/Part V/listed instruments? Can a survey/title review and City files confirm shoreline/road-allowance ownership, legal access and road assumption, and can the relevant authority confirm current parcel-wide regulation and proposed-work requirements? Waterbody mapping and a 2012 habitat scenario do not answer these questions.", evidenceLayers: ["heritage", "heritageDistrict", "parcel", "shorelineRoadAllowance", "kawarthaConservationRegulation", "kawarthasHistoricalNaturalHeritage"] },
  ] : [];
}
export function kawarthaCoverage() {
  return { cities: [KAWARTHA_AUDIT.city], auditDate: KAWARTHA_AUDIT.auditedAt, delivery: "metadata_only_reuse_audit", datasets: [], withheld: KAWARTHA_WITHHELD.map(g => ({ ...g, status: "withheld", records: null })), complete: false, audit: KAWARTHA_AUDIT, note: "City source-guidance audit with explicit coverage gaps. Separate original provincial OGL lot/township feeds are counted in their own coverage entry. No City property feed is integrated or counted; the historical natural-heritage archive remains pending integration." };
}
