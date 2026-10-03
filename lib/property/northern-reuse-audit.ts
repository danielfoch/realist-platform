import { cityKey, layer, type Layer } from "./model";
import { provinceKey } from "./geocode";
import type { EvidenceQuestion } from "./brief";

interface WithheldScope {
  layer: string;
  url: string;
  termsUrl: string;
  reason: string;
}
interface NorthernAudit {
  city: string;
  auditedAt: string;
  terms: string;
  catalogue: string;
  recordsQueried: false;
  countsQueried: false;
  geometryQueried: false;
  rightsFinding: string;
  metadata: Record<string, unknown>;
  withheld: WithheldScope[];
  questions: EvidenceQuestion[];
}

const NB = "https://northbay.ca";
const SS = "https://saultstemarie.ca";
const nbTerms = `${NB}/legal/`;
const ssTerms = `${SS}/privacy-policy/`;
const nbZoning = `${NB}/services-payments/building-development/planning-applications/zoning-by-laws/`;
const nbPlan = `${NB}/services-payments/building-development/planning-applications/official-plan/`;
const nbPermits = `${NB}/services-payments/building-development/building-permits/`;
const nbAdu = `${NB}/services-payments/building-development/additional-dwelling-units-adus/`;
const nbRental = `${NB}/services-payments/building-development/residential-rental-housing-licensing-rrhl-by-law/`;
const nbStr = `${NB}/services-payments/building-development/short-term-rental-str-licensing/`;
const nbCommittee = `${NB}/city-government/mayor-council/committees-boards/committee-of-adjustment/`;
const nbHeritage = `${NB}/our-community/arts-heritage-culture/heritage-sites-in-north-bay/site-evaluation-program/`;
const nbConservation = "https://nbmca.ca/planning-development-permits/map-your-property/";
const ssZoning = `${SS}/work/municipal-land-use/zoning/`;
const ssPlan = `${SS}/government/planning-policies/official-plan/`;
const ssPermits = "https://apps.saultstemarie.ca/cityapps/";
const ssHeritage = `${SS}/government/historic-sites-and-heritage/heritage-properties/`;
const ssPlanning = `${SS}/work/municipal-land-use/amendments/`;
const ssAdu = `${SS}/government/planning-policies/housing-action-plan/additional-dwelling-unit-adu-initiative/`;
const sooMaps = "https://www.soomaps.com/";

const nbRestriction = "North Bay's originating City terms restrict commercial reuse, redistribution and incorporation into a commercial service without written consent. The current City-linked Hub explicitly links those terms. Inspected app/map and parcel-item metadata does not supply a compatible specific redistribution grant. No municipal property records, counts or geometry are queried.";
const ssRestriction = "The current City-linked SooMaps disclaimer explicitly restricts commercial use, including the map services it consumes. City website information also requires consent for reproduction. No compatible property-level redistribution grant was established. No municipal property records, counts or geometry are queried; the map agreement was not accepted.";
const scope = (layer: string, url: string, termsUrl: string, reason: string): WithheldScope => ({ layer, url, termsUrl, reason });

export const NORTHERN_REUSE_AUDITS: NorthernAudit[] = [
  {
    city: "North Bay", auditedAt: "2026-10-03", terms: nbTerms,
    catalogue: "https://explore.northbay.ca/", recordsQueried: false, countsQueried: false, geometryQueried: false,
    rightsFinding: nbRestriction,
    metadata: {
      officialOffer: `${NB}/our-community/explore-north-bay-gis-portal/`,
      hubSite: "659061e0ca5a4b5abf304eea1b929996", curator: "NorthBay",
      catalogueGroup: "c2757ea52a7e4bc2842ce28b8b3a0605", catalogueItemsInspected: 3,
      catalogueScope: "Three public Hub pages; not three property feeds. Linked map/application items were inspected separately.",
      zoningApp: "dacca0ffcaea4af2bf69bfc06727f6b6", zoningMap: "9eae3a53063d43e48b4948567a284c9b",
      parcelItem: "c2a26654c76249448df6b012716f1be1",
      zoningItem: "e4a5ec1d759f4686b90202fa3f29ebf4",
      zoningItemResult: "Item metadata did not resolve publicly; no authentication or alternate endpoint bypass was attempted.",
      publishedConsolidationLabel: "Zoning 2015-30 office consolidation July 15, 2026; a page label, not verified parcel permission.",
      heritageScope: "City recognition/priority/plaque program and 2018 illustrative guide are separate from current statutory designation/register evidence.",
      rentalScope: "City guidance says RRHL is under review and on hold; this is not a property clearance or exemption from other requirements.",
      aduScope: "Current City page has a four-total-unit urban section and a retained three-total-unit 2023 section. Applicable current instruments and advertised-unit registration must be confirmed; do not choose one as property permission.",
    },
    withheld: [
      ...["municipalAddresses", "parcel"].map(name => scope(name, "https://explore.northbay.ca/", nbTerms, nbRestriction)),
      scope("zoning", nbZoning, nbTerms, `${nbRestriction} The zoning page also requires written permission before marketing or disclosing mapping data to third parties; official printed instruments take precedence.`),
      scope("currentPlanningInstruments", nbPlan, nbTerms, `${nbRestriction} Confirm current adopted plan, schedules, written zoning exceptions/holds, amendments and appeal outcomes with the City; recent consolidation labels are not a complete legal review.`),
      scope("permits", nbPermits, nbTerms, `${nbRestriction} Application and inspection services are not a verified reusable complete permit, final-inspection or occupancy history.`),
      scope("planningApplications", `${NB}/services-payments/building-development/planning-applications/`, nbTerms, `${nbRestriction} Complete current application decisions, conditions and appeal outcomes remain unverified.`),
      ...["variance", "consentToSever"].map(name => scope(name, nbCommittee, nbTerms, `${nbRestriction} Committee guidance and meeting access are separate from complete current property decisions and cleared conditions.`)),
      scope("heritage", nbHeritage, nbTerms, `${nbRestriction} Recognition priorities and glass plaques do not establish current Part IV/Part V designation, listed status or alteration requirements; obtain the current statutory register and instruments.`),
      scope("additionalUnits", nbAdu, nbTerms, `${nbRestriction} The City page has conflicting urban unit-count sections. Confirm current rules, settlement/rural scope, registration, inspections and occupancy separately; no legal unit count is inferred.`),
      scope("rentalLicences", nbRental, nbTerms, `${nbRestriction} The City says RRHL is under review and on hold. Do not infer no licensing requirement, current licence validity, compliant units or exemption from other laws.`),
      scope("shortTermRentalLicences", nbStr, nbTerms, `${nbRestriction} Public STR guidance/licensed-location maps do not establish current subject-property licence, operating conditions or transferable approval.`),
      ...["northbayConservationRegulation", "floodplainOverlay", "intakeProtection", "wellheadProtection"].map(name => scope(name, nbConservation, nbConservation, "NBMCA's complete mapping terms prohibit data scraping and third-party disclosure/transfer except permitted generated maps. No compatible API data grant or typed source lineage was established, and no authority records/counts/geometry are queried. Its Ontario Regulation 41/24 mapping is approximate and can omit regulated areas; jurisdiction, source-protection and septic-service boundaries differ. Obtain parcel-wide proposed-work confirmation; no safety, flood absence or clearance is inferred.")),
    ],
    questions: [
      { topic: "northbay_current_files", question: "Can the City provide current written zoning 2015-30 provisions, exceptions/holds, amendments and appeals, adopted Official Plan schedules, complete permit/inspection/occupancy history and planning/Committee decisions with cleared conditions?", evidenceLayers: ["zoning", "currentPlanningInstruments", "permits", "planningApplications", "variance", "consentToSever"] },
      { topic: "northbay_units_and_heritage", question: "Can the City reconcile the inconsistent ADU guidance for this parcel and verify registration/occupancy, current RRHL review status and any STR licence separately? Can the Clerk confirm current statutory heritage protection, distinct from recognition plaques and the 2018 guide?", evidenceLayers: ["additionalUnits", "rentalLicences", "shortTermRentalLicences", "heritage"] },
      { topic: "northbay_constraints", question: "Can NBMCA confirm the property's exact jurisdiction, current parcel-wide regulation, source-protection policies and servicing/septic requirements for the proposed work? Approximate mapping may omit regulated areas.", evidenceLayers: ["parcel", "northbayConservationRegulation", "floodplainOverlay", "intakeProtection", "wellheadProtection"] },
    ],
  },
  {
    city: "Sault Ste. Marie", auditedAt: "2026-10-03", terms: ssTerms,
    catalogue: sooMaps, recordsQueried: false, countsQueried: false, geometryQueried: false,
    rightsFinding: ssRestriction,
    metadata: {
      officialOffer: ssZoning, mappingTerms: sooMaps, mapAgreementAccepted: false,
      mapBrowserVerified: true, mapTermsIncludeConsumedServices: true,
      transportFailures: "Web fetch 502 and terminal certificate validation failure retained; normal browser displayed the disclaimer. No insecure TLS or protection bypass.",
      zoningScope: "City identifies zoning 2005-150 and separate consolidated special exceptions; complete current instrument/appeal review remains outstanding.",
      officialPlanScope: "City's published plan and Shape the Sault proposed draft are separate; do not infer draft adoption from map availability.",
      permitScope: "Permit management/inspection results require applicant access. Inspection booking without an account requires a permit number and booking key; it is not anonymous inspection-result access.",
      permitStatistics: `${SS}/work/building-permits/statistics/`,
      statisticsScope: "Monthly/annual activity publications are not a verified complete property/inspection history or redistribution grant; no reports or property records were queried.",
      conservationScope: "SooMaps splash still names Floodline 2019 and Regulation 176_06. Current authority instrument and typed map currency remain unresolved. Authority homepage returned HTTP403; no retry/bypass or record query.",
    },
    withheld: [
      ...["municipalAddresses", "parcel", "zoning"].map(name => scope(name, name === "zoning" ? ssZoning : sooMaps, sooMaps, ssRestriction)),
      scope("currentPlanningInstruments", ssPlan, ssTerms, `${ssRestriction} Published Official Plan, subsequent amendments and the separate proposed draft must be distinguished; applicable current legal instruments are not established.`),
      scope("permits", ssPermits, ssTerms, `${ssRestriction} Applicant-only management/inspection results and key-based inspection booking are separate from anonymous public evidence. Monthly statistics do not establish complete permit history, current status, final inspection or occupancy.`),
      ...["planningApplications", "variance", "consentToSever"].map(name => scope(name, ssPlanning, ssTerms, `${ssRestriction} Obtain complete current applications/decisions, cleared conditions and appeals; public process guidance does not establish approval.`)),
      scope("heritage", ssHeritage, ssTerms, `${ssRestriction} Current complete designated/listed/district status and operative instruments must be confirmed with the Clerk; no City heritage property records are copied or queried.`),
      scope("additionalUnits", ssAdu, ssTerms, `${ssRestriction} ADU program guidance and incentives do not verify this property's registration, legal unit count, inspection, occupancy, current eligibility or available funding.`),
      ...["saultConservationRegulation", "floodplainOverlay", "intakeProtection", "wellheadProtection"].map(name => scope(name, "https://ssmrca.ca/", sooMaps, "SooMaps prohibits commercial use of consumed map services and still displays legacy 2019/176_06 references. Current SSMRCA rights, typed lineage, current instruments and source-protection policies remain unverified; its homepage returned HTTP403 without bypass. No authority records/counts/geometry were queried. Obtain current parcel-wide confirmation; no regulatory clearance, flood absence, contamination or safety inference.")),
    ],
    questions: [
      { topic: "sault_current_files", question: "Can the City provide current zoning 2005-150 text and special exceptions/holds/amendments/appeals, the applicable adopted Official Plan separately from the proposed draft, full planning/Committee decisions, and the current statutory heritage register/instruments?", evidenceLayers: ["zoning", "currentPlanningInstruments", "planningApplications", "variance", "consentToSever", "heritage"] },
      { topic: "sault_permits_and_units", question: "Can the seller and City supply complete permit, inspection-result and occupancy files for the advertised unit, and confirm ADU registration and any program eligibility separately? Applicant login and inspection-booking keys are not public inspection evidence.", evidenceLayers: ["permits", "additionalUnits"] },
      { topic: "sault_constraints", question: "Can SSMRCA confirm the current applicable regulation, precise parcel-wide limits and proposed-work requirements, plus source-protection policies? The public map disclaimer's legacy 2019/176_06 labels do not establish current clearance or safety.", evidenceLayers: ["parcel", "saultConservationRegulation", "floodplainOverlay", "intakeProtection", "wellheadProtection"] },
    ],
  },
];

export function northernReuseAudit(city: string | null | undefined, province: string | null | undefined): NorthernAudit | null {
  if (provinceKey(province ?? "") !== "ontario") return null;
  const key = cityKey(city ?? "").replace(/\./g, "");
  return NORTHERN_REUSE_AUDITS.find(a => cityKey(a.city).replace(/\./g, "") === key) ?? null;
}
export const northernAuditMarket = (city: string | null | undefined, province: string | null | undefined) => Boolean(northernReuseAudit(city, province));
export function northernAuditLayers(city: string | null | undefined, province: string | null | undefined): Record<string, Layer> {
  const audit = northernReuseAudit(city, province);
  if (!audit) return {};
  return Object.fromEntries(audit.withheld.map(g => [g.layer, layer("unavailable", {
    coverageComplete: false, screenPerformed: false, recordsQueried: false, countsQueried: false, geometryQueried: false,
    withheld: g, audit: { city: audit.city, auditedAt: audit.auditedAt, terms: audit.terms, rightsFinding: audit.rightsFinding },
  }, null, g.reason)]));
}
export function northernAuditQuestions(city: string | null | undefined, province: string | null | undefined): EvidenceQuestion[] {
  return northernReuseAudit(city, province)?.questions ?? [];
}
export function northernAuditCoverage() {
  return NORTHERN_REUSE_AUDITS.map(a => ({
    cities: [a.city], auditDate: a.auditedAt, delivery: "metadata_only_reuse_audit", datasets: [],
    withheld: a.withheld.map(g => ({ ...g, status: "withheld", records: null })), complete: false,
    audit: { ...a, questions: undefined, withheld: undefined },
    note: "Originating rights and source-guidance audit only; no City/authority property feeds are integrated or counted. Separate national/provincial evidence remains available where independently supported. Public visual access does not establish reuse rights, complete history, permission or regulatory clearance.",
  }));
}
