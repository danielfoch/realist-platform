/**
 * Realist.ca — Rent Regulation Engine
 *
 * A rules module (same shape as the multiplex feasibility engine) that answers
 * the revenue-side question the underwriter needs: is this unit's rent capped,
 * and by how much? The load-bearing insight for the multiplex/BRRR audience is
 * that NEW suites are rent-decontrolled in several provinces — a newly built
 * multiplex, garden/laneway/basement suite grows at MARKET, not the guideline.
 *
 * Pure logic, no data import. Every output carries a source + confidence and
 * degrades to "not modelled" (never throws) for an unrecognized province.
 *
 * Two distinct concepts, often conflated:
 *   - guideline cap: the max annual increase for a SITTING tenant.
 *   - vacancy decontrol: whether rent resets to market BETWEEN tenancies.
 *   - new-build exemption: whether a newly first-occupied unit is exempt from
 *     the guideline entirely (grows at market for its sitting tenant too).
 */

export interface RentRegulationSource {
  name: string;
  url: string;
  jurisdiction: string;
  lastVerified: string; // ISO date
  confidence: "high" | "medium";
}

export interface RentRegulationRule {
  province: string;
  name: string;
  aliases: string[];
  /** Guideline % (annual sitting-tenant cap) by calendar year. null year entry = uncapped. */
  guidelineByYear: Record<number, number | null>;
  /** Fallback guideline % when the requested year isn't in the table. */
  defaultGuidelinePct: number | null;
  /** Rent resets to market between tenancies (true in most of Canada). */
  vacancyDecontrol: boolean;
  /**
   * New-build / new-suite exemption: units first occupied for residential
   * purposes on/after this date are exempt from the guideline (grow at market).
   * null when the province has no such exemption.
   */
  newBuildExemptAfter: string | null;
  notes: string[];
  source: RentRegulationSource;
}

const ONTARIO: RentRegulationRule = {
  province: "ON",
  name: "Ontario",
  aliases: ["ontario", "on"],
  // Rent Increase Guideline, set annually by the province.
  guidelineByYear: { 2023: 2.5, 2024: 2.5, 2025: 2.5, 2026: 2.1, 2027: 1.9 },
  defaultGuidelinePct: 2.1,
  vacancyDecontrol: true,
  // RTA: new buildings, additions, and most new basement apartments first
  // occupied for residential purposes after Nov 15, 2018 are exempt.
  newBuildExemptAfter: "2018-11-15",
  notes: [
    "Units first occupied for residential purposes after Nov 15, 2018 (new buildings, additions, most new basement/secondary/garden/laneway suites) are exempt from the rent-increase guideline — they can be raised by any amount on notice.",
    "Ontario has full vacancy decontrol: rent resets to whatever the landlord and a new tenant agree on between tenancies.",
    "Above-guideline increases (AGIs) for capital work are available for guideline-covered units via the LTB.",
  ],
  source: {
    name: "Ontario — Residential rent increases (Rent Increase Guideline + RTA s.6.1 exemption)",
    url: "https://www.ontario.ca/page/residential-rent-increases",
    jurisdiction: "Ontario", lastVerified: "2026-07-08", confidence: "high",
  },
};

const BC: RentRegulationRule = {
  province: "BC",
  name: "British Columbia",
  aliases: ["british columbia", "bc"],
  guidelineByYear: { 2023: 2.0, 2024: 3.5, 2025: 3.0, 2026: 2.3 },
  defaultGuidelinePct: 2.3,
  vacancyDecontrol: true, // no vacancy control — rent resets on turnover
  newBuildExemptAfter: null, // BC's cap applies regardless of build date
  notes: [
    "BC caps annual increases for sitting tenants at the yearly maximum (2.3% for 2026), with 3 full months' notice and one increase per 12 months.",
    "No vacancy control: rent may be reset to market between tenancies — the increase cap does not carry across a new tenancy.",
    "Unlike Ontario there is no new-build exemption; the annual cap applies to newly built units too.",
  ],
  source: {
    name: "BC — Rent increases (Residential Tenancy Branch)",
    url: "https://www2.gov.bc.ca/gov/content/housing-tenancy/residential-tenancies/rent-rtb/rent-increases",
    jurisdiction: "British Columbia", lastVerified: "2026-07-08", confidence: "high",
  },
};

const ALBERTA: RentRegulationRule = {
  province: "AB",
  name: "Alberta",
  aliases: ["alberta", "ab"],
  guidelineByYear: {},
  defaultGuidelinePct: null, // no rent-increase cap
  vacancyDecontrol: true,
  newBuildExemptAfter: null,
  notes: [
    "Alberta has NO rent-increase cap — a sitting tenant's rent can rise by any amount, but only once every 365 days (and not during a fixed term).",
    "Rent is fully market-driven; there is no guideline to model.",
  ],
  source: {
    name: "Alberta — Rent increases (Residential Tenancies Act)",
    url: "https://www.alberta.ca/rent-increases",
    jurisdiction: "Alberta", lastVerified: "2026-07-08", confidence: "medium",
  },
};

// The remaining provinces are encoded at medium confidence from July-2026
// research; guideline %s change annually — treat as overridable defaults.
const OTHER_PROVINCES: RentRegulationRule[] = [
  {
    province: "MB", name: "Manitoba", aliases: ["manitoba", "mb"],
    guidelineByYear: { 2025: 1.7, 2026: 1.8 }, defaultGuidelinePct: 1.8,
    vacancyDecontrol: true, newBuildExemptAfter: null,
    notes: ["Manitoba caps annual increases at the guideline (~1.8% for 2026); buildings first occupied within the last ~20 years and units renting above a threshold can be exempt — verify the current exemption rules."],
    source: { name: "Manitoba — Residential Tenancies Branch rent guideline", url: "https://www.gov.mb.ca/cca/rtb/", jurisdiction: "Manitoba", lastVerified: "2026-07-08", confidence: "medium" },
  },
  {
    province: "NS", name: "Nova Scotia", aliases: ["nova scotia", "ns"],
    guidelineByYear: { 2024: 5.0, 2025: 5.0, 2026: 5.0, 2027: 5.0 }, defaultGuidelinePct: 5.0,
    vacancyDecontrol: true, newBuildExemptAfter: null,
    notes: ["Nova Scotia caps rent increases at 5% per year through the end of 2027 (temporary cap); rent may reset between tenancies."],
    source: { name: "Nova Scotia — Residential Tenancies rent cap", url: "https://beta.novascotia.ca/programs-and-services/residential-tenancies-program", jurisdiction: "Nova Scotia", lastVerified: "2026-07-08", confidence: "medium" },
  },
  {
    province: "PE", name: "Prince Edward Island", aliases: ["prince edward island", "pei", "pe"],
    guidelineByYear: { 2025: 3.0, 2026: 3.0 }, defaultGuidelinePct: 3.0,
    vacancyDecontrol: false, newBuildExemptAfter: null,
    notes: ["PEI sets an annual allowable increase (IRAC); PEI limits between-tenancy resets more than most provinces — verify current turnover rules."],
    source: { name: "PEI — IRAC allowable rent increase", url: "https://www.irac.pe.ca/rental/", jurisdiction: "Prince Edward Island", lastVerified: "2026-07-08", confidence: "medium" },
  },
  {
    province: "QC", name: "Québec", aliases: ["quebec", "québec", "qc"],
    guidelineByYear: {}, defaultGuidelinePct: null,
    vacancyDecontrol: false,
    newBuildExemptAfter: null,
    notes: [
      "Québec has no flat guideline: the Tribunal administratif du logement (TAL) publishes an annual estimation grid by building/heating type; increases are negotiated and can be contested at the TAL.",
      "New buildings carry a 5-year rent-fixing exemption (the 'clause F' / section-1955 notice) during which TAL rent-fixing does not apply.",
      "Québec limits between-tenancy increases (a new tenant can contest using the previous rent) — effectively weak vacancy decontrol.",
    ],
    source: { name: "Québec — Tribunal administratif du logement (rent fixing)", url: "https://www.tal.gouv.qc.ca/en/rent-fixing", jurisdiction: "Québec", lastVerified: "2026-07-08", confidence: "medium" },
  },
  {
    province: "NB", name: "New Brunswick", aliases: ["new brunswick", "nb"],
    guidelineByYear: {}, defaultGuidelinePct: null,
    vacancyDecontrol: true, newBuildExemptAfter: null,
    notes: ["New Brunswick has no fixed percentage cap; unusually large increases can be reviewed/phased by the Residential Tenancies Tribunal."],
    source: { name: "New Brunswick — Residential Tenancies Tribunal", url: "https://www.snb.ca/irent/", jurisdiction: "New Brunswick", lastVerified: "2026-07-08", confidence: "medium" },
  },
  {
    province: "SK", name: "Saskatchewan", aliases: ["saskatchewan", "sk"],
    guidelineByYear: {}, defaultGuidelinePct: null,
    vacancyDecontrol: true, newBuildExemptAfter: null,
    notes: ["Saskatchewan has no rent-increase cap; increases require notice (12 months for fixed leases / periodic) but no percentage limit."],
    source: { name: "Saskatchewan — Office of Residential Tenancies", url: "https://www.saskatchewan.ca/residential-tenancies", jurisdiction: "Saskatchewan", lastVerified: "2026-07-08", confidence: "medium" },
  },
  {
    province: "NL", name: "Newfoundland and Labrador", aliases: ["newfoundland and labrador", "newfoundland", "nl"],
    guidelineByYear: {}, defaultGuidelinePct: null,
    vacancyDecontrol: true, newBuildExemptAfter: null,
    notes: ["Newfoundland and Labrador has no rent-increase cap; one increase per 12 months with notice."],
    source: { name: "NL — Residential Tenancies", url: "https://www.gov.nl.ca/dgsnl/residential-tenancies/", jurisdiction: "Newfoundland and Labrador", lastVerified: "2026-07-08", confidence: "medium" },
  },
];

const RULES: RentRegulationRule[] = [ONTARIO, BC, ALBERTA, ...OTHER_PROVINCES];

function findRule(province: string | undefined): RentRegulationRule | null {
  if (!province) return null;
  const p = province.trim().toLowerCase();
  return RULES.find((r) => r.province.toLowerCase() === p || r.aliases.includes(p)) ?? null;
}

export interface RentRegulationInput {
  province?: string;
  /** Calendar year to price the guideline for (defaults to the latest encoded). */
  year?: number;
  /**
   * Is this a newly-built / newly-created suite (multiplex conversion, added
   * ARU, garden/laneway/basement suite)? Drives the new-build exemption.
   */
  isNewSuite?: boolean;
  /** Year the unit was first occupied, if known (alternative to isNewSuite). */
  firstOccupiedYear?: number;
}

export interface RentRegulationResult {
  province: string | null;
  supported: boolean;
  /** Annual sitting-tenant cap (%) that applies, or null when uncapped/exempt. */
  guidelinePct: number | null;
  guidelineYear: number | null;
  /** True when this specific unit is exempt from the guideline (grows at market). */
  exemptFromGuideline: boolean;
  exemptionReason: string | null;
  /** Rent resets to market between tenancies. */
  vacancyDecontrol: boolean;
  /**
   * The multiplex/BRRR headline: a newly created suite here is NOT rent-capped.
   * True when the province has a new-build exemption and this is a new suite.
   */
  newSuiteUncapped: boolean;
  summary: string;
  notes: string[];
  source: RentRegulationSource | null;
  disclaimer: string;
}

const DISCLAIMER =
  "Rent-regulation summary is for screening only and reflects the rules as last verified; guideline percentages change annually and exemptions turn on unit-specific facts. Confirm with the applicable provincial tenancy authority before relying on it.";

/** Does the new-build exemption apply given the input? */
function exemptionApplies(rule: RentRegulationRule, input: RentRegulationInput): boolean {
  if (!rule.newBuildExemptAfter) return false;
  if (input.isNewSuite) return true;
  if (input.firstOccupiedYear != null) {
    // Exempt when first occupied strictly after the cutoff year.
    const cutoffYear = new Date(rule.newBuildExemptAfter).getUTCFullYear();
    return input.firstOccupiedYear > cutoffYear;
  }
  return false;
}

export function assessRentRegulation(input: RentRegulationInput): RentRegulationResult {
  const rule = findRule(input.province);
  if (!rule) {
    return {
      province: input.province ?? null, supported: false,
      guidelinePct: null, guidelineYear: null,
      exemptFromGuideline: false, exemptionReason: null,
      vacancyDecontrol: false, newSuiteUncapped: false,
      summary: "Rent regulation is not modelled for this province yet — confirm locally.",
      notes: [], source: null, disclaimer: DISCLAIMER,
    };
  }

  const years = Object.keys(rule.guidelineByYear).map(Number);
  const year = input.year ?? (years.length ? Math.max(...years) : new Date().getUTCFullYear());
  const guidelineForYear = rule.guidelineByYear[year] ?? rule.defaultGuidelinePct;

  const exempt = exemptionApplies(rule, input);
  const newSuiteUncapped = !!rule.newBuildExemptAfter && (input.isNewSuite ?? false);

  let summary: string;
  if (exempt) {
    summary = `${rule.name}: this unit is exempt from the rent-increase guideline (first occupied after ${rule.newBuildExemptAfter}) — rent can rise at market between and during tenancies.`;
  } else if (guidelineForYear == null) {
    summary = `${rule.name}: no rent-increase cap — sitting-tenant rent is market-driven (notice rules still apply).`;
  } else {
    summary = `${rule.name}: sitting-tenant increases capped at ${guidelineForYear}% for ${year}${rule.vacancyDecontrol ? "; rent resets to market between tenancies" : "; between-tenancy resets are limited"}.`;
  }

  return {
    province: rule.province, supported: true,
    guidelinePct: exempt ? null : guidelineForYear,
    guidelineYear: exempt ? null : year,
    exemptFromGuideline: exempt,
    exemptionReason: exempt ? `First occupied for residential purposes after ${rule.newBuildExemptAfter} (new-build/new-suite exemption).` : null,
    vacancyDecontrol: rule.vacancyDecontrol,
    newSuiteUncapped,
    summary,
    notes: rule.notes,
    source: rule.source,
    disclaimer: DISCLAIMER,
  };
}

/**
 * Effective annual rent-growth cap (%) for underwriting a HOLD. A new suite (or
 * a fully vacancy-decontrolled market) is not guideline-limited, so callers may
 * use a market growth assumption; a guideline-covered sitting tenancy is capped.
 * Returns null when uncapped/exempt (caller should use its market assumption).
 */
export function guidelineGrowthCapPct(input: RentRegulationInput): number | null {
  const r = assessRentRegulation(input);
  if (!r.supported || r.exemptFromGuideline) return null;
  return r.guidelinePct;
}
