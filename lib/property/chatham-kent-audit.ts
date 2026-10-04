import { cityKey, layer, type Layer } from "./model";
import { provinceKey } from "./geocode";
import type { EvidenceQuestion } from "./brief";

const CK = "https://www.chatham-kent.ca";
const HUB = "https://opendata.chatham-kent.ca";
const terms = `${CK}/Pages/Terms-of-Use.aspx`;
const hubTerms = `${HUB}/pages/terms`;
const zoning = `${CK}/business/planning/Pages/Comprehensive-Zoning-By-Law.aspx`;
const plan = `${CK}/business/planning/Pages/Chatham-Kent-Official-Plan.aspx`;
const permits = `${CK}/apply/permits/Pages/Building-Permit.aspx`;
const heritage = `${CK}/business/planning/Pages/Heritage-Conservation.aspx`;
const units = `${CK}/business/building/Pages/Additional-Dwelling-Units.aspx`;
const drains = `${CK}/services/Drainage/Pages/Municipal-Drains.aspx`;
const planning = `${CK}/business/planning/Pages/Planning-Applications-and-Fees.aspx`;
const ltvca = "https://lowerthames-conservation.on.ca/planning-regulations/regulated-areas-map/";
const scrca = "https://www.scrca.on.ca/planning-and-regulations/map-your-property/";
const zoningViewer = `${HUB}/apps/6d64f5dbdac44ba5831d310321f0beed/explore`;
const drainageViewer = `${HUB}/apps/049eb12a858744c085b882849f9fe57d/explore`;
const restriction = "Chatham-Kent's City terms allow a personal, non-commercial copy; its current City-linked zoning viewer expressly restricts scraping, copying and redistribution without authorization. The Hub terms contain disclaimers and a contract-project data-sharing route, not a specific compatible commercial redistribution grant. Inspected catalogue and linked source metadata does not establish an exception. No municipal property records, counts or geometry are queried.";

export const CHATHAM_KENT_AUDIT = {
  city: "Chatham-Kent", auditedAt: "2026-10-03", officialOffer: HUB,
  terms, hubTerms, siteId: "e3abcef27a1d4673b14fb37b88563e9a", curator: "CK_agol_admin",
  siteOrgId: "BlSm9A1poQIGIz9S", catalogueGroup: "7c964e660e2c469383b0f2d206d68ac6",
  catalogueItemsInspected: 40, catalogueNextStart: -1, featureRootsInspected: 13, typedChildrenInspected: 13,
  catalogueScope: "Forty curated items include pages, apps and document links; they are not forty property feeds. Eleven catalogue Feature Services plus separately linked zoning and pump sources were inspected without data queries.",
  zoningApp: "6d64f5dbdac44ba5831d310321f0beed", zoningMap: "7bd2187c0cb54cda8263d7ad29ca1d8e",
  zoningItem: "89ce208974094e6184daa05198a88776", zoningChild: 11,
  drainageApp: "049eb12a858744c085b882849f9fe57d", drainageMap: "96dadbc07e164eee9ca69d72204bae6a",
  drainageItem: "c2184e0291e740aca0d1a98ffb856557",
  drainageScope: "The linked 2021MunicipalDrains-secured item uses a utility proxy. Its item grant is blank; no protected endpoint was queried, replaced or bypassed. Drain lines and nearby pumps would not establish assessed liability or an actual property connection.",
  pumpItem: "12cd01fb4e5d4a65a59c3fb8752d89d7",
  pumpScope: "The item terms warn that pumphouses may not lie on the drainage network and may be unsuitable for network analysis. That warning is not a reuse grant or proof of flood protection.",
  planningScope: "Published zoning 216-2009, separate Schedule B exceptions, flood and flight-path schedules, unconsolidated secondary plans/amendments and proposals require current instrument and appeal confirmation. Catalogue edit dates do not establish legal currency.",
  heritageScope: "The City distinguishes designated Part 1 and geographically split listed Part 2 registers. The complete current register and operative instruments are not copied; public visibility is separate from reuse rights.",
  ltvcaApp: "7fcbaf0fe62f4b24b07cee640d3072bb", ltvcaMap: "80016930a2584b05a04e62904181c97c",
  ltvcaScope: "The current official-page-linked app has complete non-transferable terms prohibiting derivative products without express/written consent. Third-party rights remain separate; no viewer agreement was accepted or authority data queried.",
  recordsQueried: false, countsQueried: false, geometryQueried: false, rightsFinding: restriction,
};

const scope = (layer: string, url: string, reason: string, termsUrl = terms) => ({ layer, url, termsUrl, reason });
export const CHATHAM_KENT_WITHHELD = [
  ...["municipalAddresses", "parcel", "ward", "settlementReference"].map(name => scope(name, HUB, restriction, hubTerms)),
  scope("zoning", zoningViewer, `${restriction} Obtain current 216-2009 provisions, Schedule B exceptions, holds/removals, amendments and appeal outcomes. A zone label does not verify permission.`, zoningViewer),
  scope("currentPlanningInstruments", plan, `${restriction} Confirm current adopted Official Plan, unconsolidated secondary plans/amendments and legal schedules separately from draft growth-management proposals.`),
  scope("permits", permits, `${restriction} Application guidance and mandatory inspection procedures do not establish complete subject-property permit, final-inspection or occupancy history.`),
  ...["planningApplications", "variance", "consentToSever"].map(name => scope(name, planning, `${restriction} Process guidance is separate from current full files, final decisions, satisfied conditions and appeal outcomes.`)),
  scope("heritage", heritage, `${restriction} Confirm complete current designated/listed/district status, registered instruments and alteration requirements; no protection status or absence is inferred.`),
  scope("additionalUnits", units, `${restriction} Pre-approved designs and advertised grants do not establish this parcel's permitted or legal units, completed inspection/occupancy, eligibility or available funding.`),
  scope("municipalDrainObligations", drains, `${restriction} Request the property's drain assessment schedule, engineer's report/bylaw, outstanding construction/maintenance charges, easements and pending works. Private owners can bear drain costs; no assessed amount is inferred from a drain line or nearby pump.`),
  scope("municipalDrainReference", drainageViewer, `${restriction} The linked secured utility-proxy source has no compatible item grant; no protected source was queried or bypassed. A mapped drain does not establish connection, liability, capacity or flood safety.`, hubTerms),
  scope("pumpingStationReference", drainageViewer, `${restriction} Published item terms are a suitability warning, not a reuse grant; pumphouses may not lie on the drain network. No network or flood-protection conclusion is made.`, hubTerms),
  scope("chathamConservationRegulation", ltvca, "Current LTVCA app terms are non-transferable and require express/written consent for derivative products. SCRCA mapping remains a separate rights/jurisdiction scope. No authority records/counts/geometry are queried or agreements accepted. Confirm the relevant authority and current parcel-wide proposed-work requirements; no clearance or flood-absence finding.", ltvca),
  scope("floodplainOverlay", zoning, `${restriction} City flood schedules, LTVCA and SCRCA jurisdiction/regulation are separate. Obtain current parcel-wide confirmation; no flood safety or insurance eligibility is inferred.`),
  scope("shorelineManagementReference", plan, `${restriction} Sustainable Shorelines schedules and proposed-work requirements need current City and relevant conservation-authority confirmation; no parcel-wide clearance is established.`),
  scope("airportConstraints", zoning, `${restriction} Flight-path height schedules require current original authority instruments and exact applicability; no development clearance or noise finding is inferred.`),
  ...["wellheadProtection", "intakeProtection"].map(name => scope(name, plan, `${restriction} Obtain current original source-protection policies and actual water/servicing information. City reference schedules do not establish water safety, contamination, a connection or parcel-wide activity permissions.`)),
];

// These named City communities select manual research scope, never municipal containment or parcel identity.
const communities = new Set(["chatham-kent", "chatham kent", "chatham", "wallaceburg", "dresden", "tilbury", "wheatley", "blenheim", "ridgetown", "thamesville", "bothwell"]);
export const chathamKentMarket = (city: string | null | undefined, province: string | null | undefined) => provinceKey(province ?? "") === "ontario" && communities.has(cityKey(city ?? "").replace(/^municipality of\s+/, ""));
export function chathamKentLayers(city: string | null | undefined, province: string | null | undefined): Record<string, Layer> {
  if (!chathamKentMarket(city, province)) return {};
  return Object.fromEntries(CHATHAM_KENT_WITHHELD.map(g => [g.layer, layer("unavailable", {
    coverageComplete: false, screenPerformed: false, recordsQueried: false, countsQueried: false, geometryQueried: false,
    withheld: g, audit: { city: CHATHAM_KENT_AUDIT.city, auditedAt: CHATHAM_KENT_AUDIT.auditedAt, terms, hubTerms, rightsFinding: restriction },
  }, null, g.reason)]));
}
export function chathamKentQuestions(city: string | null | undefined, province: string | null | undefined): EvidenceQuestion[] {
  if (!chathamKentMarket(city, province)) return [];
  return [
    { topic: "chatham_current_files", question: "Can the City provide current 216-2009 zoning, Schedule B exceptions/holds/amendments/appeals, adopted Official Plan and unconsolidated secondary plans, and complete permit/inspection/occupancy and planning/Committee decisions with cleared conditions?", evidenceLayers: ["zoning", "currentPlanningInstruments", "permits", "planningApplications", "variance", "consentToSever"] },
    { topic: "chatham_units_and_heritage", question: "Can the City verify legal unit identity, inspection/occupancy and current statutory heritage instruments separately from pre-approved ADU designs, grants and publicly listed register sections?", evidenceLayers: ["additionalUnits", "heritage"] },
    { topic: "chatham_drain_liability", question: "Can the seller and municipal Drainage Services provide this property's drain assessment schedule, engineer's report/bylaw, easements, outstanding maintenance/construction charges and pending works? A nearby drain or pump does not establish connection, liability or flood protection.", evidenceLayers: ["municipalDrainObligations", "municipalDrainReference", "pumpingStationReference", "parcel"] },
    { topic: "chatham_parcel_constraints", question: "Can a survey and the relevant LTVCA/SCRCA, airport and source-protection authorities confirm current parcel-wide jurisdiction, shoreline/flood/height constraints, servicing and proposed-work requirements?", evidenceLayers: ["parcel", "chathamConservationRegulation", "floodplainOverlay", "shorelineManagementReference", "airportConstraints", "wellheadProtection", "intakeProtection"] },
  ];
}
export function chathamKentCoverage() {
  return { cities: ["Chatham-Kent"], communities: [...communities], auditDate: CHATHAM_KENT_AUDIT.auditedAt,
    delivery: "metadata_only_reuse_audit", datasets: [], complete: false,
    audit: CHATHAM_KENT_AUDIT, authorityLinks: [ltvca, scrca],
    withheld: CHATHAM_KENT_WITHHELD.map(g => ({ ...g, status: "withheld", records: null })),
    note: "Source-rights and current-guidance audit only. No City/authority property feeds are integrated, imported or counted. Named communities select research scope, not municipal containment. Independent national/provincial evidence remains separate. Chatham-Kent remains incomplete.",
  };
}
