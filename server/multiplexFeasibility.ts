/**
 * Realist.ca — Multiplex Feasibility Engine
 *
 * A rules-based screening engine for estimating multiplex development potential
 * on Canadian residential properties. Ontario-first, Toronto-priority.
 *
 * IMPORTANT: This engine produces screening estimates only — not legal, planning,
 * architectural, or development advice. Every output carries a confidence score
 * and source traceability. All conclusions must be verified by qualified professionals.
 *
 * Rules hierarchy (lowest → highest priority):
 *   Province baseline < Municipality policy < Zone standards < Overlay/special area
 *
 * Adding a new municipality:
 *   1. Add entry to MUNICIPALITY_RULES below
 *   2. Add any zone-specific rules to ZONE_HINTS
 *   3. Add sources to POLICY_SOURCES
 *   4. Set supportLevel: "partial" until zone rules are complete
 *
 * Confidence model:
 *   Each field that is known vs. inferred adds or subtracts from a 0–100 score.
 *   HIGH (≥65): Reliable screening — enough data to make useful inferences
 *   MEDIUM (35–64): Useful but major assumptions made — verify before acting
 *   LOW (<35): Jurisdiction not yet supported or data too sparse to conclude
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface FeasibilityInput {
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  zoneCode?: string;
  lotFrontage?: number; // feet
  lotDepth?: number;    // feet
  lotArea?: number;     // sqft (if provided directly)
  cornerLot?: boolean;
  laneAccess?: boolean;
  heritageFlag?: boolean;
  floodplainFlag?: boolean;
}

export interface PolicySource {
  type: "legislation" | "bylaw" | "official_plan" | "policy_document" | "inference";
  name: string;
  url?: string;
  section?: string;
  jurisdiction: string;
  date?: string;
  confidence: "high" | "medium" | "low";
}

export interface FeasibilityScenario {
  name: string;
  units: number;
  description: string;
  approval_path: "as_of_right" | "minor_variance_likely" | "rezoning_required" | "complex";
  typical_gfa_sqft?: number;
  notes: string[];
}

export interface RiskFlag {
  flag: string;
  severity: "high" | "medium" | "low";
  details: string;
}

export interface RuleLayerTrace {
  layer: "province_baseline" | "municipality_rules" | "zone_standards" | "overlays" | "property_caveats";
  label: string;
  status: "direct" | "heuristic" | "missing";
  impact: string;
  confidence: "high" | "medium" | "low";
  source_names: string[];
}

export interface AssumptionTrace {
  label: string;
  value: string;
  certainty: "direct" | "inferred" | "unknown";
}

export interface MultiplexFeasibilityResult {
  // Identity
  address: string;
  municipality: string;
  province: string;
  support_level: "full" | "partial" | "province_only" | "unsupported";

  // Quick summary
  quick_read: {
    headline: string;
    confidence: "high" | "medium" | "low";
    confidence_score: number;
    key_facts: string[];
    key_blockers: string[];
  };

  // Zoning snapshot
  zoning: {
    code?: string;
    description?: string;
    zone_category?: "residential_low" | "residential_medium" | "residential_high" | "mixed_use" | "commercial" | "unknown";
    official_plan_note?: string;
    overlay_flags: string[];
    heritage_flagged: boolean;
    floodplain_flagged: boolean;
  };

  // Permission analysis
  permissions: {
    provincial_baseline_units: number;
    municipal_baseline_units: number;
    effective_baseline_units: number;
    likely_units_low: number;
    likely_units_high: number;
    likely_range_label: string;
    aru_possible: boolean;
    garden_suite_possible: boolean;
    laneway_suite_possible: boolean;
    six_unit_area_possible: boolean;
    six_unit_area_status: "not_applicable" | "possible_unverified" | "more_likely_area";
    approval_path: "as_of_right" | "minor_variance_likely" | "rezoning_required" | "complex" | "unknown";
    scenarios: FeasibilityScenario[];
    approval_notes: string[];
  };

  // Envelope math
  envelope: {
    lot_area_sqft: number | null;
    lot_frontage_ft: number | null;
    lot_depth_ft: number | null;
    lot_area_basis: "provided" | "calculated" | "estimated";
    estimated_lot_coverage_ratio: number;
    coverage_basis: "bylaw" | "zone_rule" | "municipality_fallback" | "province_fallback";
    estimated_max_footprint_sqft: number | null;
    estimated_storeys: number;
    estimated_theoretical_gfa_sqft: number | null;
    estimated_practical_gfa_sqft: number | null;
    practical_haircut_reason: string;
    unit_scenarios: { units: number; avg_unit_sqft: number; total_gfa: number }[];
    calculation_notes: string[];
  };

  // Risk flags
  risk_flags: RiskFlag[];

  // Rules + assumptions traceability
  rules_hierarchy: RuleLayerTrace[];
  assumptions: AssumptionTrace[];
  source_summary: {
    direct_sources: number;
    heuristic_sources: number;
    total_sources: number;
  };

  // Sources
  sources: PolicySource[];

  // Confidence breakdown
  confidence_breakdown: Record<string, { score: number; reason: string }>;
  confidence_score: number;

  // Metadata
  computed_at: string;
  disclaimer: string;
}

// ─── Policy Knowledge Base ──────────────────────────────────────────────────

const DISCLAIMER = `This is a preliminary screening estimate only. Realist does not guarantee zoning accuracy, development feasibility, unit count, lot coverage, GFA, or approval outcomes. Municipal by-laws, official plans, overlays, secondary plans, and policies can change. Site-specific conditions including servicing capacity, frontage, lot shape, heritage designation, conservation authority restrictions, easements, floodplains, tree by-laws, angular plane, parking requirements, and building code constraints may materially affect what is actually achievable here. This tool does not constitute legal, planning, architectural, engineering, or development advice. All conclusions must be independently verified by the buyer and their qualified professional advisors before relying on them in any way.`;

const SOURCES: Record<string, PolicySource> = {
  bill23: {
    type: "legislation",
    name: "Bill 23 — More Homes Built Faster Act, 2022 (Ontario)",
    url: "https://www.ontario.ca/laws/statute/22m17",
    jurisdiction: "Ontario",
    date: "2022-11-28",
    confidence: "high",
  },
  planningActARU: {
    type: "legislation",
    name: "Planning Act — Additional Residential Units (Ontario)",
    url: "https://www.ontario.ca/laws/statute/90p13",
    section: "Section 16(3), 35.2",
    jurisdiction: "Ontario",
    date: "2023-01-01",
    confidence: "high",
  },
  torontoMultiplex2023: {
    type: "bylaw",
    name: "City of Toronto — Multiplex Zoning By-law Amendment (2023)",
    url: "https://www.toronto.ca/city-government/planning-development/planning-studies-initiatives/expanding-housing-options/",
    jurisdiction: "Toronto",
    date: "2023-09-28",
    confidence: "high",
  },
  torontoTE6unit: {
    type: "policy_document",
    name: "City of Toronto — Toronto & East York 6-Unit Multiplex Permissions",
    url: "https://www.toronto.ca/city-government/planning-development/planning-studies-initiatives/expanding-housing-options/",
    jurisdiction: "Toronto — Toronto & East York",
    date: "2024-05-01",
    confidence: "medium",
  },
  torontoGardenSuite2022: {
    type: "bylaw",
    name: "City of Toronto — Garden Suite Zoning By-law (2022)",
    url: "https://www.toronto.ca/city-government/planning-development/planning-studies-initiatives/garden-suites/",
    jurisdiction: "Toronto",
    date: "2022-06-23",
    confidence: "high",
  },
  torontoLaneway2018: {
    type: "bylaw",
    name: "City of Toronto — Laneway Suite Zoning By-law (2018)",
    url: "https://www.toronto.ca/city-government/planning-development/planning-studies-initiatives/garden-and-laneway-suites/",
    jurisdiction: "Toronto",
    date: "2018-07-05",
    confidence: "high",
  },
  ontarioARUGuidance: {
    type: "policy_document",
    name: "Province of Ontario — Additional Residential Units Guidance",
    url: "https://www.ontario.ca/page/additional-residential-units",
    jurisdiction: "Ontario",
    date: "2023-06-01",
    confidence: "high",
  },
  inferred: {
    type: "inference",
    name: "Realist heuristic estimate — not from direct by-law source",
    jurisdiction: "Realist",
    confidence: "low",
  },
};

// ─── Province Rules ─────────────────────────────────────────────────────────

interface ProvinceRule {
  name: string;
  baseline_units: number;
  aru_possible: boolean;
  garden_suite_possible: boolean;
  requires_servicing: boolean;
  baseline_notes: string[];
  sources: PolicySource[];
}

const PROVINCE_RULES: Record<string, ProvinceRule> = {
  ON: {
    name: "Ontario",
    // Bill 23 / Planning Act: up to 3 units total on serviced residential lots
    // (principal building + ancillary) — baseline without rezoning
    baseline_units: 3,
    aru_possible: true,
    garden_suite_possible: true,
    requires_servicing: true,
    baseline_notes: [
      "Ontario's Bill 23 framework allows up to 3 residential units on most serviced residential lots without rezoning",
      "This includes configurations like 2 units in the principal building + 1 ancillary, or 3 in the principal building",
      "Municipal implementation and zoning standards still apply — local by-laws can be more permissive but not more restrictive below provincial minimum",
      "Servicing (municipal water and sewer) is required for most configurations",
      "Heritage properties, conservation authority land, and hazard land may be exempt from these provisions",
      "Lot-specific constraints (frontage, coverage, setbacks) still apply",
    ],
    sources: [SOURCES.bill23, SOURCES.planningActARU, SOURCES.ontarioARUGuidance],
  },
  BC: {
    name: "British Columbia",
    baseline_units: 3,
    aru_possible: true,
    garden_suite_possible: true,
    requires_servicing: true,
    baseline_notes: [
      "BC's Small-Scale Multi-Unit Housing (SSMUH) legislation (2023) requires municipalities to allow 3–6 units on most single-family lots",
      "Exact unit count depends on lot size and proximity to transit",
      "Municipality-specific implementation applies",
    ],
    sources: [
      {
        type: "legislation",
        name: "BC Small-Scale Multi-Unit Housing Legislation (Bill 44, 2023)",
        url: "https://www2.gov.bc.ca/gov/content/housing-tenancy/local-governments-and-housing/housing-initiatives/small-scale-multi-unit-housing",
        jurisdiction: "British Columbia",
        date: "2023-11-30",
        confidence: "high",
      },
    ],
  },
};

// ─── Municipality Rules ─────────────────────────────────────────────────────

interface MunicipalityRule {
  name: string;
  province: string;
  aliases: string[]; // alternative city name spellings
  supportLevel: "full" | "partial" | "province_only";
  baseline_units: number;
  aru_possible: boolean;
  garden_suite_possible: boolean;
  laneway_suite_possible: boolean;
  six_unit_area_possible: boolean;
  six_unit_area_note?: string;
  default_lot_coverage_ratio: number; // 0–1 fraction
  coverage_basis: "bylaw" | "zone_rule" | "municipality_fallback";
  typical_storeys: number; // for GFA estimation
  approval_notes: string[];
  sources: PolicySource[];
}

const MUNICIPALITY_RULES: Record<string, MunicipalityRule> = {
  Toronto: {
    name: "City of Toronto",
    province: "ON",
    aliases: ["toronto", "north york", "scarborough", "etobicoke", "york", "east york"],
    supportLevel: "partial",
    // Toronto adopted city-wide multiplex (4 units) in Sept 2023
    baseline_units: 4,
    aru_possible: true,
    garden_suite_possible: true,
    // Laneway suites possible on most lots with lane access in former City of Toronto / East York
    laneway_suite_possible: true,
    // Toronto & East York community council area + Ward 23 allow 6 units (adopted 2024)
    six_unit_area_possible: true,
    six_unit_area_note:
      "Properties in the Toronto & East York community council area or Ward 23 (Scarborough North – Don Mills) may be permitted up to 6 units. Verify using Toronto's zoning map and the applicable community council boundary.",
    // Standard Toronto residential zone: ~33–35% lot coverage for principal building
    // For multiplex scenarios, effective coverage including rear structures may reach 45%+
    default_lot_coverage_ratio: 0.35,
    coverage_basis: "municipality_fallback",
    typical_storeys: 2.5,
    approval_notes: [
      "Toronto's city-wide multiplex by-law allows up to 4 units 'as of right' in residential areas (subject to zoning standards)",
      "Zoning standards including lot coverage, height, setbacks, and parking still apply and can constrain the actual unit count",
      "Minor variances may be needed for irregular lots or non-standard configurations",
      "Laneway suites are permitted on lots with lane access (approx. 65,000 eligible lots)",
      "Garden suites are permitted on most residential lots since 2022",
      "Heritage designation, TRCA flood/conservation, and other overlays can reduce feasibility",
    ],
    sources: [
      SOURCES.torontoMultiplex2023,
      SOURCES.torontoTE6unit,
      SOURCES.torontoGardenSuite2022,
      SOURCES.torontoLaneway2018,
    ],
  },
  Ottawa: {
    name: "City of Ottawa",
    province: "ON",
    aliases: ["ottawa", "kanata", "barrhaven", "nepean", "gloucester", "orleans"],
    supportLevel: "province_only",
    baseline_units: 3, // Ontario baseline; Ottawa has its own zoning study underway
    aru_possible: true,
    garden_suite_possible: true,
    laneway_suite_possible: false,
    six_unit_area_possible: false,
    default_lot_coverage_ratio: 0.4,
    coverage_basis: "municipality_fallback",
    typical_storeys: 2,
    approval_notes: [
      "Ottawa follows Ontario's Bill 23 baseline (up to 3 units)",
      "Ottawa is undertaking a Residential Intensification in Established Neighbourhoods Study (RIENS) — additional permissions may follow",
      "Buyer should verify current zoning status with City of Ottawa",
    ],
    sources: [
      SOURCES.bill23,
      SOURCES.planningActARU,
      {
        type: "policy_document",
        name: "City of Ottawa — Official Plan (2021)",
        url: "https://ottawa.ca/en/city-hall/get-know-your-city/official-plan",
        jurisdiction: "Ottawa",
        date: "2021-11-24",
        confidence: "medium",
      },
    ],
  },
  Hamilton: {
    name: "City of Hamilton",
    province: "ON",
    aliases: ["hamilton", "stoney creek", "dundas", "ancaster", "flamborough", "glanbrook"],
    supportLevel: "province_only",
    baseline_units: 3,
    aru_possible: true,
    garden_suite_possible: true,
    laneway_suite_possible: false,
    six_unit_area_possible: false,
    default_lot_coverage_ratio: 0.4,
    coverage_basis: "municipality_fallback",
    typical_storeys: 2,
    approval_notes: [
      "Hamilton follows Ontario's Bill 23 baseline (up to 3 units)",
      "Hamilton has been studying infill/intensification policies — verify current permissions with City of Hamilton",
    ],
    sources: [SOURCES.bill23, SOURCES.planningActARU],
  },
  Mississauga: {
    name: "City of Mississauga",
    province: "ON",
    aliases: ["mississauga", "port credit", "streetsville", "clarkson", "cooksville"],
    supportLevel: "province_only",
    baseline_units: 3,
    aru_possible: true,
    garden_suite_possible: true,
    laneway_suite_possible: false,
    six_unit_area_possible: false,
    default_lot_coverage_ratio: 0.35,
    coverage_basis: "municipality_fallback",
    typical_storeys: 2,
    approval_notes: [
      "Mississauga follows Ontario's Bill 23 baseline (up to 3 units)",
      "Mississauga's zoning by-law implements ARU permissions — verify specifics with City of Mississauga",
    ],
    sources: [SOURCES.bill23, SOURCES.planningActARU],
  },
  Brampton: {
    name: "City of Brampton",
    province: "ON",
    aliases: ["brampton"],
    supportLevel: "province_only",
    baseline_units: 3,
    aru_possible: true,
    garden_suite_possible: true,
    laneway_suite_possible: false,
    six_unit_area_possible: false,
    default_lot_coverage_ratio: 0.4,
    coverage_basis: "municipality_fallback",
    typical_storeys: 2,
    approval_notes: ["Brampton follows Ontario's Bill 23 baseline. Verify with City of Brampton."],
    sources: [SOURCES.bill23],
  },
  Kitchener: {
    name: "City of Kitchener",
    province: "ON",
    aliases: ["kitchener"],
    supportLevel: "province_only",
    baseline_units: 3,
    aru_possible: true,
    garden_suite_possible: true,
    laneway_suite_possible: false,
    six_unit_area_possible: false,
    default_lot_coverage_ratio: 0.4,
    coverage_basis: "municipality_fallback",
    typical_storeys: 2,
    approval_notes: ["Kitchener follows Ontario's Bill 23 baseline. Verify with City of Kitchener."],
    sources: [SOURCES.bill23],
  },
  Waterloo: {
    name: "City of Waterloo",
    province: "ON",
    aliases: ["waterloo"],
    supportLevel: "province_only",
    baseline_units: 3,
    aru_possible: true,
    garden_suite_possible: true,
    laneway_suite_possible: false,
    six_unit_area_possible: false,
    default_lot_coverage_ratio: 0.4,
    coverage_basis: "municipality_fallback",
    typical_storeys: 2,
    approval_notes: ["Waterloo follows Ontario's Bill 23 baseline."],
    sources: [SOURCES.bill23],
  },
  London: {
    name: "City of London",
    province: "ON",
    aliases: ["london"],
    supportLevel: "province_only",
    baseline_units: 3,
    aru_possible: true,
    garden_suite_possible: true,
    laneway_suite_possible: false,
    six_unit_area_possible: false,
    default_lot_coverage_ratio: 0.4,
    coverage_basis: "municipality_fallback",
    typical_storeys: 2,
    approval_notes: ["London follows Ontario's Bill 23 baseline. Verify with City of London."],
    sources: [SOURCES.bill23],
  },
  Kingston: {
    name: "City of Kingston",
    province: "ON",
    aliases: ["kingston"],
    supportLevel: "province_only",
    baseline_units: 3,
    aru_possible: true,
    garden_suite_possible: true,
    laneway_suite_possible: false,
    six_unit_area_possible: false,
    default_lot_coverage_ratio: 0.4,
    coverage_basis: "municipality_fallback",
    typical_storeys: 2,
    approval_notes: ["Kingston follows Ontario's Bill 23 baseline."],
    sources: [SOURCES.bill23],
  },
  Barrie: {
    name: "City of Barrie",
    province: "ON",
    aliases: ["barrie"],
    supportLevel: "province_only",
    baseline_units: 3,
    aru_possible: true,
    garden_suite_possible: true,
    laneway_suite_possible: false,
    six_unit_area_possible: false,
    default_lot_coverage_ratio: 0.4,
    coverage_basis: "municipality_fallback",
    typical_storeys: 2,
    approval_notes: ["Barrie follows Ontario's Bill 23 baseline."],
    sources: [SOURCES.bill23],
  },
  Guelph: {
    name: "City of Guelph",
    province: "ON",
    aliases: ["guelph"],
    supportLevel: "province_only",
    baseline_units: 3,
    aru_possible: true,
    garden_suite_possible: true,
    laneway_suite_possible: false,
    six_unit_area_possible: false,
    default_lot_coverage_ratio: 0.4,
    coverage_basis: "municipality_fallback",
    typical_storeys: 2,
    approval_notes: ["Guelph follows Ontario's Bill 23 baseline."],
    sources: [SOURCES.bill23],
  },
  "Niagara Falls": {
    name: "City of Niagara Falls",
    province: "ON",
    aliases: ["niagara falls", "niagara"],
    supportLevel: "province_only",
    baseline_units: 3,
    aru_possible: true,
    garden_suite_possible: true,
    laneway_suite_possible: false,
    six_unit_area_possible: false,
    default_lot_coverage_ratio: 0.4,
    coverage_basis: "municipality_fallback",
    typical_storeys: 2,
    approval_notes: ["Niagara Falls follows Ontario's Bill 23 baseline."],
    sources: [SOURCES.bill23],
  },
  Windsor: {
    name: "City of Windsor",
    province: "ON",
    aliases: ["windsor"],
    supportLevel: "province_only",
    baseline_units: 3,
    aru_possible: true,
    garden_suite_possible: true,
    laneway_suite_possible: false,
    six_unit_area_possible: false,
    default_lot_coverage_ratio: 0.42,
    coverage_basis: "municipality_fallback",
    typical_storeys: 2,
    approval_notes: ["Windsor follows Ontario's Bill 23 baseline."],
    sources: [SOURCES.bill23],
  },
  Oshawa: {
    name: "City of Oshawa",
    province: "ON",
    aliases: ["oshawa"],
    supportLevel: "province_only",
    baseline_units: 3,
    aru_possible: true,
    garden_suite_possible: true,
    laneway_suite_possible: false,
    six_unit_area_possible: false,
    default_lot_coverage_ratio: 0.4,
    coverage_basis: "municipality_fallback",
    typical_storeys: 2,
    approval_notes: ["Oshawa follows Ontario's Bill 23 baseline."],
    sources: [SOURCES.bill23],
  },
  Vancouver: {
    name: "City of Vancouver",
    province: "BC",
    aliases: ["vancouver"],
    supportLevel: "province_only",
    baseline_units: 3,
    aru_possible: true,
    garden_suite_possible: true,
    laneway_suite_possible: true,
    six_unit_area_possible: false,
    default_lot_coverage_ratio: 0.45,
    coverage_basis: "municipality_fallback",
    typical_storeys: 2,
    approval_notes: [
      "Vancouver follows BC's SSMUH legislation (2023) allowing up to 3–6 units on residential lots",
      "Verify exact permissions with City of Vancouver zoning",
      "Vancouver has extensive laneway house program since 2009",
    ],
    sources: [PROVINCE_RULES.BC.sources[0]],
  },
};

// ─── Zone Classification Hints ──────────────────────────────────────────────

interface ZoneHint {
  category: "residential_low" | "residential_medium" | "residential_high" | "mixed_use" | "commercial";
  description: string;
  typical_coverage?: number;
  typical_storeys?: number;
  notes: string[];
}

function classifyZone(zoneCode: string): ZoneHint | null {
  const code = zoneCode.trim().toUpperCase();

  // Toronto-specific zone codes
  if (/^RD\b/.test(code)) return {
    category: "residential_low",
    description: "Residential Detached (Toronto)",
    typical_coverage: 0.33,
    typical_storeys: 2,
    notes: ["Standard Toronto detached zone — historically limited density, now multiplex-eligible under 2023 by-law"],
  };
  if (/^RS\b/.test(code)) return {
    category: "residential_low",
    description: "Residential Semi-Detached (Toronto)",
    typical_coverage: 0.45,
    typical_storeys: 2.5,
    notes: ["Semi-detached zone — may have more permissive coverage for multiplex conversion"],
  };
  if (/^RM\b/.test(code)) return {
    category: "residential_medium",
    description: "Residential Multiple (Toronto)",
    typical_coverage: 0.45,
    typical_storeys: 3,
    notes: ["Multiple-residential zone — more permissive density baseline"],
  };
  if (/^R\d/.test(code)) return {
    category: "residential_low",
    description: `Residential Zone ${code}`,
    typical_storeys: 2,
    notes: ["Standard low-density residential — verify multiplex permissions with municipality"],
  };

  // Generic Ontario residential codes
  if (/^R1\b/i.test(code)) return {
    category: "residential_low",
    description: "Low Density Residential",
    typical_coverage: 0.35,
    typical_storeys: 2,
    notes: ["Lowest density residential — ARU and garden suite possible under provincial rules"],
  };
  if (/^R2\b/i.test(code)) return {
    category: "residential_low",
    description: "Low-Medium Density Residential",
    typical_coverage: 0.40,
    typical_storeys: 2.5,
    notes: ["Low-medium density — usually allows semi-detached; may allow triplex/fourplex depending on municipality"],
  };
  if (/^R3\b/i.test(code)) return {
    category: "residential_medium",
    description: "Medium Density Residential",
    typical_coverage: 0.45,
    typical_storeys: 3,
    notes: ["Medium density — often allows townhouses and small apartment forms"],
  };
  if (/^R4\b/i.test(code)) return {
    category: "residential_medium",
    description: "Medium-High Density Residential",
    typical_coverage: 0.50,
    typical_storeys: 3.5,
    notes: ["Higher density residential — likely permissive for multiplex"],
  };
  if (/^[A-Z]*R[A-Z]?\b/i.test(code) || /^RES/i.test(code)) return {
    category: "residential_low",
    description: `Residential Zone (${code})`,
    notes: ["Zone appears residential — verify specific permissions with municipality"],
  };
  if (/^MU\b|^CR\b|^MC\b|^C[0-9]/i.test(code)) return {
    category: "mixed_use",
    description: `Mixed Use / Commercial Zone (${code})`,
    typical_coverage: 0.60,
    typical_storeys: 4,
    notes: ["Mixed-use zone — may allow residential above ground floor; verify use permissions"],
  };

  return null;
}

// ─── Municipality Detection ─────────────────────────────────────────────────

function detectMunicipality(input: FeasibilityInput): {
  key: string | null;
  rule: MunicipalityRule | null;
  confidence_contribution: number;
} {
  const city = (input.city || "").toLowerCase().trim();
  const address = (input.address || "").toLowerCase();
  const searchIn = `${city} ${address}`;

  for (const [key, rule] of Object.entries(MUNICIPALITY_RULES)) {
    for (const alias of rule.aliases) {
      if (searchIn.includes(alias)) {
        return { key, rule, confidence_contribution: 20 };
      }
    }
  }

  return { key: null, rule: null, confidence_contribution: 0 };
}

function detectProvince(input: FeasibilityInput): {
  key: string | null;
  rule: ProvinceRule | null;
  confidence_contribution: number;
} {
  const prov = (input.province || "").trim().toUpperCase();
  if (prov === "ON" || prov === "ONTARIO") return { key: "ON", rule: PROVINCE_RULES.ON, confidence_contribution: 10 };
  if (prov === "BC" || prov === "BRITISH COLUMBIA") return { key: "BC", rule: PROVINCE_RULES.BC, confidence_contribution: 10 };

  // Try to infer from city / municipality
  const { rule: munRule } = detectMunicipality(input);
  if (munRule) {
    const provKey = munRule.province;
    return { key: provKey, rule: PROVINCE_RULES[provKey] || null, confidence_contribution: 5 };
  }

  return { key: null, rule: null, confidence_contribution: 0 };
}

function inferTorontoSixUnitStatus(input: FeasibilityInput, munRule: MunicipalityRule | null): "not_applicable" | "possible_unverified" | "more_likely_area" {
  if (munRule?.name !== "City of Toronto" || !munRule.six_unit_area_possible) return "not_applicable";

  const city = (input.city || "").toLowerCase().trim();
  const address = (input.address || "").toLowerCase();
  const postal = (input.postalCode || "").toUpperCase().replace(/\s+/g, "");
  const search = `${city} ${address}`;

  if (
    city === "east york" ||
    city === "york" ||
    search.includes("east york") ||
    search.includes("toronto and east york")
  ) {
    return "more_likely_area";
  }

  if (city === "scarborough" || search.includes("ward 23") || /^M2N|^M3A|^M3B|^M3C/.test(postal)) {
    return "possible_unverified";
  }

  return "possible_unverified";
}

// ─── Confidence Scoring ─────────────────────────────────────────────────────

function computeConfidence(
  input: FeasibilityInput,
  munRule: MunicipalityRule | null,
  provRule: ProvinceRule | null,
  zoneHint: ZoneHint | null,
): { score: number; breakdown: Record<string, { score: number; reason: string }> } {
  const breakdown: Record<string, { score: number; reason: string }> = {};

  // Municipality known
  if (munRule) {
    const pts = munRule.supportLevel === "full" ? 20 : munRule.supportLevel === "partial" ? 15 : 8;
    breakdown.municipality = { score: pts, reason: `Municipality "${munRule.name}" recognized (support: ${munRule.supportLevel})` };
  } else {
    breakdown.municipality = { score: 0, reason: "Municipality not recognized — province baseline only" };
  }

  // Province known
  if (provRule) {
    breakdown.province = { score: 10, reason: `Province "${provRule.name}" recognized` };
  } else {
    breakdown.province = { score: 0, reason: "Province not recognized — no baseline rules applied" };
  }

  // Lot dimensions
  const hasLotArea = !!(input.lotArea || (input.lotFrontage && input.lotDepth));
  if (input.lotArea) {
    breakdown.lot_area = { score: 15, reason: "Lot area directly provided" };
  } else if (input.lotFrontage && input.lotDepth) {
    breakdown.lot_area = { score: 12, reason: "Lot area calculated from frontage × depth" };
  } else if (input.lotFrontage || input.lotDepth) {
    breakdown.lot_area = { score: 5, reason: "Only one lot dimension provided — area estimated" };
  } else {
    breakdown.lot_area = { score: 0, reason: "No lot dimensions — envelope math is speculative" };
  }

  // Zone code
  if (input.zoneCode && zoneHint) {
    breakdown.zone = { score: 20, reason: `Zone "${input.zoneCode}" classified as ${zoneHint.category}` };
  } else if (input.zoneCode) {
    breakdown.zone = { score: 8, reason: `Zone "${input.zoneCode}" provided but not classified — using municipality fallback` };
  } else {
    breakdown.zone = { score: 0, reason: "No zone code provided — using municipality/province fallback assumptions" };
  }

  // Overlay flags known
  if (input.heritageFlag !== undefined || input.floodplainFlag !== undefined) {
    breakdown.overlays = { score: 10, reason: "Heritage/floodplain flags provided" };
  } else {
    breakdown.overlays = { score: 3, reason: "No overlay data — assuming no known constraints (unverified)" };
  }

  // Lot context (corner, lane access)
  if (input.cornerLot !== undefined || input.laneAccess !== undefined) {
    breakdown.lot_context = { score: 5, reason: "Corner lot / lane access information provided" };
  } else {
    breakdown.lot_context = { score: 0, reason: "Lot context unknown" };
  }

  const total = Object.values(breakdown).reduce((sum, b) => sum + b.score, 0);
  // Cap at 100
  return { score: Math.min(100, total), breakdown };
}

// ─── Lot Area / Envelope Math ───────────────────────────────────────────────

function computeLotArea(input: FeasibilityInput): {
  area: number | null;
  frontage: number | null;
  depth: number | null;
  basis: "provided" | "calculated" | "estimated";
} {
  if (input.lotArea && input.lotArea > 0) {
    return {
      area: input.lotArea,
      frontage: input.lotFrontage || null,
      depth: input.lotDepth || null,
      basis: "provided",
    };
  }
  if (input.lotFrontage && input.lotDepth && input.lotFrontage > 0 && input.lotDepth > 0) {
    return {
      area: input.lotFrontage * input.lotDepth,
      frontage: input.lotFrontage,
      depth: input.lotDepth,
      basis: "calculated",
    };
  }
  // Estimate based on a "typical" urban lot if we at least have one dimension
  if (input.lotFrontage && input.lotFrontage > 0) {
    const assumedDepth = 100; // typical urban lot depth ft
    return {
      area: input.lotFrontage * assumedDepth,
      frontage: input.lotFrontage,
      depth: assumedDepth,
      basis: "estimated",
    };
  }
  return { area: null, frontage: null, depth: null, basis: "estimated" };
}

function computeEnvelope(
  lotArea: number | null,
  lotFrontage: number | null,
  munRule: MunicipalityRule | null,
  zoneHint: ZoneHint | null,
  input: FeasibilityInput,
): {
  coverage_ratio: number;
  coverage_basis: "bylaw" | "zone_rule" | "municipality_fallback" | "province_fallback";
  footprint: number | null;
  storeys: number;
  theoretical_gfa: number | null;
  practical_gfa: number | null;
  practical_haircut_reason: string;
  calc_notes: string[];
} {
  const notes: string[] = [];

  // Determine lot coverage ratio
  let coverageRatio: number;
  let coverageBasis: "bylaw" | "zone_rule" | "municipality_fallback" | "province_fallback";

  if (zoneHint?.typical_coverage) {
    coverageRatio = zoneHint.typical_coverage;
    coverageBasis = "zone_rule";
    notes.push(`Lot coverage ratio ${Math.round(coverageRatio * 100)}% estimated from zone category "${zoneHint.category}" — verify exact by-law value`);
  } else if (munRule) {
    coverageRatio = munRule.default_lot_coverage_ratio;
    coverageBasis = "municipality_fallback";
    notes.push(`Lot coverage ratio ${Math.round(coverageRatio * 100)}% is a municipality-level estimate for ${munRule.name} — verify actual zoning standard`);
  } else {
    // Generic fallback for Ontario residential
    coverageRatio = 0.38;
    coverageBasis = "province_fallback";
    notes.push("Lot coverage ratio 38% is a conservative province-level fallback — verify with local zoning by-law");
  }

  // Storey estimate
  const storeys = zoneHint?.typical_storeys || munRule?.typical_storeys || 2;
  notes.push(`${storeys} storey${storeys !== 1 ? "s" : ""} assumed for GFA calculation — verify height limit with local zoning`);

  if (!lotArea) {
    return {
      coverage_ratio: coverageRatio,
      coverage_basis: coverageBasis,
      footprint: null,
      storeys,
      theoretical_gfa: null,
      practical_gfa: null,
      practical_haircut_reason: "Cannot estimate without lot area",
      calc_notes: notes,
    };
  }

  const footprint = Math.round(lotArea * coverageRatio);
  const theoreticalGfa = Math.round(footprint * storeys);

  // Practical GFA haircut: setbacks, stairs/circulation, code compliance, lot inefficiency
  // Typical haircut: 15–25%
  let haircutFactor = 0.78; // 22% haircut default
  let haircutReason = "22% haircut applied for setbacks, circulation, code compliance, and lot inefficiency";

  if (input.cornerLot) {
    haircutFactor = Math.max(0.70, haircutFactor - 0.05);
    haircutReason += "; corner lot reduces usable frontage but may improve access";
  }
  if (input.heritageFlag) {
    haircutFactor = Math.max(0.55, haircutFactor - 0.15);
    haircutReason += "; heritage flag significantly constrains envelope";
    notes.push("Heritage flag detected — envelope and unit count severely constrained, verify with heritage planner");
  }
  if (input.floodplainFlag) {
    haircutFactor = Math.max(0.50, haircutFactor - 0.20);
    haircutReason += "; floodplain flag severely constrains buildable envelope";
    notes.push("Floodplain flag detected — conservation authority approval required, major feasibility risk");
  }

  // Frontage check
  if (lotFrontage && lotFrontage < 20) {
    haircutFactor = Math.max(0.60, haircutFactor - 0.12);
    haircutReason += `; very narrow frontage (${lotFrontage}ft) limits building form`;
    notes.push(`Frontage of ${lotFrontage}ft is very narrow — may constrain building form and parking access`);
  } else if (lotFrontage && lotFrontage < 25) {
    haircutFactor = Math.max(0.65, haircutFactor - 0.07);
    haircutReason += `; narrow frontage (${lotFrontage}ft) adds design constraints`;
  }

  const practicalGfa = Math.round(theoreticalGfa * haircutFactor);

  notes.push(`Theoretical GFA: ${theoreticalGfa.toLocaleString()} sqft = ${lotArea.toLocaleString()} sqft lot × ${Math.round(coverageRatio * 100)}% coverage × ${storeys} storeys`);
  notes.push(`Practical GFA estimate: ${practicalGfa.toLocaleString()} sqft after ${Math.round((1 - haircutFactor) * 100)}% haircut for setbacks, stairs, code complexity`);

  return {
    coverage_ratio: coverageRatio,
    coverage_basis: coverageBasis,
    footprint,
    storeys,
    theoretical_gfa: theoreticalGfa,
    practical_gfa: practicalGfa,
    practical_haircut_reason: haircutReason,
    calc_notes: notes,
  };
}

// ─── Scenario Builder ───────────────────────────────────────────────────────

function buildScenarios(
  munRule: MunicipalityRule | null,
  provRule: ProvinceRule | null,
  practicalGfa: number | null,
  input: FeasibilityInput,
): FeasibilityScenario[] {
  const scenarios: FeasibilityScenario[] = [];
  const baseUnits = munRule ? munRule.baseline_units : (provRule?.baseline_units || 2);
  const hasLane = input.laneAccess || (munRule?.laneway_suite_possible ?? false);
  const hasGarden = munRule?.garden_suite_possible || provRule?.aru_possible || false;

  // Scenario 1: Minimum (keep existing + convert/add 1 unit)
  scenarios.push({
    name: "Minimal Conversion",
    units: 2,
    description: "Convert existing single-family home to duplex — lower risk, lower cost, shorter approval timeline",
    approval_path: "as_of_right",
    typical_gfa_sqft: practicalGfa ? Math.round(practicalGfa * 0.5) : undefined,
    notes: [
      "Duplex conversion typically requires building permit, not rezoning",
      "Subject to Ontario Building Code (OBC) requirements for egress, fire separation, sound attenuation",
      "Confirm parking requirements with municipality",
    ],
  });

  // Scenario 2: Baseline entitlement
  if (baseUnits >= 3) {
    scenarios.push({
      name: "Baseline Multiplex",
      units: baseUnits,
      description: `${baseUnits}-unit multiplex — maximum likely as-of-right under ${munRule?.name || provRule?.name || "provincial"} rules`,
      approval_path: "as_of_right",
      typical_gfa_sqft: practicalGfa ? Math.round(practicalGfa * 0.85) : undefined,
      notes: [
        `Up to ${baseUnits} units permitted under current policy baseline`,
        "Zoning standards (setbacks, height, coverage, parking) still determine actual achievability",
        "Building permit and site plan review may be required",
        "Buyer must verify with municipality",
      ],
    });
  }

  // Scenario 3: 6-unit if in applicable Toronto area
  if (munRule?.six_unit_area_possible && baseUnits < 6) {
    scenarios.push({
      name: "6-Unit Multiplex (Toronto & East York / Ward 23)",
      units: 6,
      description: "Up to 6 units possible in Toronto & East York community council area and Ward 23. Verify property location.",
      approval_path: "minor_variance_likely",
      typical_gfa_sqft: practicalGfa ? Math.round(practicalGfa) : undefined,
      notes: [
        "6-unit permission applies in Toronto & East York and Ward 23 (Scarborough North)",
        "Property must be confirmed to be within this boundary — verify with Toronto zoning map",
        "Minor variance may be required depending on lot-specific zoning standards",
        "Buyer must independently verify",
      ],
    });
  }

  // Scenario 4: With ancillary unit (garden or laneway)
  if ((hasLane || hasGarden) && baseUnits >= 3) {
    const ancillaryType = hasLane ? "laneway suite" : "garden suite";
    scenarios.push({
      name: `Multiplex + ${ancillaryType.charAt(0).toUpperCase() + ancillaryType.slice(1)}`,
      units: baseUnits + 1,
      description: `${baseUnits}-unit principal building + ${ancillaryType} on same lot — maximum density without rezoning`,
      approval_path: "as_of_right",
      notes: [
        `${ancillaryType.charAt(0).toUpperCase() + ancillaryType.slice(1)} is subject to separate building permit`,
        hasLane
          ? "Laneway suite requires confirmed lane access at the rear of property"
          : "Garden suite requires sufficient rear yard area",
        "Verify parking requirements for combined unit count",
        "Buyer must independently verify feasibility and eligibility",
      ],
    });
  }

  return scenarios;
}

// ─── Risk Flag Detection ─────────────────────────────────────────────────────

function detectRiskFlags(
  input: FeasibilityInput,
  munRule: MunicipalityRule | null,
  lotArea: { area: number | null; frontage: number | null; depth: number | null; basis: string },
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (input.heritageFlag) {
    flags.push({
      flag: "Heritage Designation",
      severity: "high",
      details: "Heritage-designated or listed properties may face significant restrictions on demolition, alteration, and new construction. Verify heritage status with municipality and consult a heritage planner before making any assumptions about multiplex feasibility.",
    });
  }

  if (input.floodplainFlag) {
    flags.push({
      flag: "Floodplain / Conservation Authority",
      severity: "high",
      details: "Properties within TRCA, Conservation Ontario, or other conservation authority flood/erosion zones typically require authority approval for development. This can materially change or prevent multiplex scenarios. Verify with the applicable conservation authority.",
    });
  }

  if (lotArea.frontage && lotArea.frontage < 20) {
    flags.push({
      flag: "Very Narrow Frontage",
      severity: "high",
      details: `Lot frontage of ~${lotArea.frontage}ft is very narrow. Minimum frontage requirements for multiplex development vary (typically 6–9m / ~20–30ft) — verify with municipality. Very narrow lots may limit unit count, parking, and building form.`,
    });
  } else if (lotArea.frontage && lotArea.frontage < 25) {
    flags.push({
      flag: "Narrow Frontage",
      severity: "medium",
      details: `Lot frontage of ~${lotArea.frontage}ft may constrain building form and parking access for multiplex configurations. Verify frontage minimums with municipality.`,
    });
  }

  if (lotArea.area && lotArea.area < 2500) {
    flags.push({
      flag: "Small Lot Area",
      severity: "high",
      details: `Estimated lot area of ~${Math.round(lotArea.area).toLocaleString()} sqft is small for multiplex development. Many municipalities require minimum lot sizes for additional units. GFA estimates are likely to be significantly constrained.`,
    });
  } else if (lotArea.area && lotArea.area < 3500) {
    flags.push({
      flag: "Below-Average Lot Area",
      severity: "medium",
      details: `Lot area of ~${Math.round(lotArea.area).toLocaleString()} sqft is below average for multiplex development. Check municipal minimum lot size requirements.`,
    });
  }

  if (!input.laneAccess && munRule?.name?.includes("Toronto")) {
    flags.push({
      flag: "Lane Access Unknown",
      severity: "low",
      details: "Laneway suite potential depends on confirmed rear lane access. Check Toronto's lane map — approximately 65,000 Toronto lots have lane access. If no lane, garden suite may still be possible.",
    });
  }

  if (lotArea.basis === "estimated") {
    flags.push({
      flag: "Lot Dimensions Not Provided",
      severity: "medium",
      details: "Lot area is estimated from typical assumptions. Envelope math may be significantly off. Obtain actual lot dimensions from land registry, listing, or site survey before making financial decisions.",
    });
  }

  if (!input.zoneCode) {
    flags.push({
      flag: "Zone Code Not Verified",
      severity: "medium",
      details: "No zoning code was provided. All unit count and coverage estimates use municipality-level fallbacks. Verify the exact zoning code using your municipality's online zoning map before relying on any conclusions.",
    });
  }

  // Always add a standard buyer-to-verify flag
  flags.push({
    flag: "Servicing & Utilities",
    severity: "medium",
    details: "Servicing capacity (water, sewer, hydro) for additional units must be verified with the applicable utility and municipality. Servicing upgrades can add significant cost to multiplex projects.",
  });

  flags.push({
    flag: "Parking Requirements",
    severity: "low",
    details: "Many municipalities require 1+ parking spaces per unit. This can constrain the viable unit count on tight lots. Verify parking standards with municipality. Toronto has reduced parking requirements near transit.",
  });

  return flags;
}

function buildRuleHierarchy(
  input: FeasibilityInput,
  provRule: ProvinceRule | null,
  munRule: MunicipalityRule | null,
  zoneHint: ZoneHint | null,
  sixUnitStatus: "not_applicable" | "possible_unverified" | "more_likely_area",
): RuleLayerTrace[] {
  const layers: RuleLayerTrace[] = [];

  layers.push({
    layer: "province_baseline",
    label: provRule ? `${provRule.name} baseline` : "Province baseline",
    status: provRule ? "direct" : "missing",
    impact: provRule
      ? `Provincial screening baseline supports about ${provRule.baseline_units} units before municipality-specific overrides.`
      : "Province not recognized, so no reliable baseline legislation was applied.",
    confidence: provRule ? "high" : "low",
    source_names: provRule?.sources.map((source) => source.name) || [],
  });

  layers.push({
    layer: "municipality_rules",
    label: munRule ? munRule.name : "Municipality rules",
    status: munRule ? (munRule.supportLevel === "province_only" ? "heuristic" : "direct") : "missing",
    impact: munRule
      ? munRule.name === "City of Toronto"
        ? `Toronto city-wide 4-unit permissions are applied. 6-unit status is ${sixUnitStatus === "more_likely_area" ? "more likely" : "possible but unverified"} based on limited location data.`
        : `${munRule.name} currently uses ${munRule.supportLevel === "province_only" ? "province-level baseline logic with municipality fallbacks" : "municipality-specific rules"} in this screening model.`
      : "Municipality not yet normalized, so only province logic and generic heuristics were used.",
    confidence: munRule ? (munRule.supportLevel === "province_only" ? "medium" : "high") : "low",
    source_names: munRule?.sources.map((source) => source.name) || [],
  });

  layers.push({
    layer: "zone_standards",
    label: input.zoneCode ? `Zone ${input.zoneCode}` : "Zone standards",
    status: zoneHint ? "direct" : input.zoneCode ? "heuristic" : "missing",
    impact: zoneHint
      ? `${zoneHint.description} was classified and used to shape lot coverage and storey assumptions.`
      : input.zoneCode
        ? "A zone code was provided but not fully classified, so municipality-level form assumptions were used."
        : "No zone code was provided, so lot coverage and form assumptions rely on municipality defaults.",
    confidence: zoneHint ? "medium" : input.zoneCode ? "low" : "low",
    source_names: zoneHint ? [`Realist zone classifier (${zoneHint.category})`] : [SOURCES.inferred.name],
  });

  layers.push({
    layer: "overlays",
    label: "Overlay constraints",
    status: input.heritageFlag || input.floodplainFlag ? "direct" : "heuristic",
    impact: input.heritageFlag || input.floodplainFlag
      ? "Explicit heritage and/or floodplain constraints reduce confidence and practical envelope assumptions."
      : "No overlay inputs were supplied, so the model assumes no known major overlay constraints.",
    confidence: input.heritageFlag || input.floodplainFlag ? "high" : "low",
    source_names: input.heritageFlag || input.floodplainFlag ? ["User / property-level flag"] : [SOURCES.inferred.name],
  });

  layers.push({
    layer: "property_caveats",
    label: "Property-specific caveats",
    status: input.lotArea || (input.lotFrontage && input.lotDepth) ? "direct" : "heuristic",
    impact: input.lotArea || (input.lotFrontage && input.lotDepth)
      ? "Lot dimensions directly inform footprint, GFA, and unit-size screening."
      : "Without lot dimensions, footprint and GFA remain broad screening estimates only.",
    confidence: input.lotArea || (input.lotFrontage && input.lotDepth) ? "high" : "low",
    source_names: input.lotArea || (input.lotFrontage && input.lotDepth) ? ["User / listing input"] : [SOURCES.inferred.name],
  });

  return layers;
}

function buildAssumptions(
  input: FeasibilityInput,
  lotAreaResult: { area: number | null; frontage: number | null; depth: number | null; basis: "provided" | "calculated" | "estimated" },
  envelope: {
    coverage_ratio: number;
    coverage_basis: "bylaw" | "zone_rule" | "municipality_fallback" | "province_fallback";
    storeys: number;
  },
  sixUnitStatus: "not_applicable" | "possible_unverified" | "more_likely_area",
): AssumptionTrace[] {
  return [
    {
      label: "Lot area basis",
      value: lotAreaResult.area ? `${Math.round(lotAreaResult.area).toLocaleString()} sqft (${lotAreaResult.basis})` : "Unknown lot area",
      certainty: lotAreaResult.basis === "provided" ? "direct" : lotAreaResult.basis === "calculated" ? "inferred" : "unknown",
    },
    {
      label: "Lot coverage ratio",
      value: `${Math.round(envelope.coverage_ratio * 100)}% (${envelope.coverage_basis.replace(/_/g, " ")})`,
      certainty: envelope.coverage_basis === "zone_rule" ? "direct" : envelope.coverage_basis === "municipality_fallback" ? "inferred" : "unknown",
    },
    {
      label: "Storey assumption",
      value: `${envelope.storeys} storeys assumed for GFA screening`,
      certainty: "inferred",
    },
    {
      label: "Toronto 6-unit status",
      value:
        sixUnitStatus === "more_likely_area"
          ? "Address context suggests Toronto & East York linkage, but still verify."
          : sixUnitStatus === "possible_unverified"
            ? "6-unit permissions may apply in limited Toronto subareas; location not confirmed."
            : "Not applicable to this property.",
      certainty: sixUnitStatus === "not_applicable" ? "direct" : "unknown",
    },
    {
      label: "Overlay status",
      value: input.heritageFlag || input.floodplainFlag ? "Overlay flags were supplied and applied." : "No heritage/floodplain inputs supplied.",
      certainty: input.heritageFlag || input.floodplainFlag ? "direct" : "unknown",
    },
  ];
}

// ─── Main Computation Function ───────────────────────────────────────────────

export function computeMultiplexFeasibility(input: FeasibilityInput): MultiplexFeasibilityResult {
  const now = new Date().toISOString();

  // 1. Detect jurisdiction
  const { rule: munRule, key: munKey } = detectMunicipality(input);
  const { rule: provRule } = detectProvince(input);

  // 2. Classify zone
  const zoneHint = input.zoneCode ? classifyZone(input.zoneCode) : null;

  // 3. Compute confidence
  const { score: confidenceScore, breakdown } = computeConfidence(input, munRule, provRule, zoneHint);
  const confidenceLevel: "high" | "medium" | "low" =
    confidenceScore >= 65 ? "high" : confidenceScore >= 35 ? "medium" : "low";

  // 4. Compute lot area
  const lotAreaResult = computeLotArea(input);

  // 5. Compute envelope
  const envelope = computeEnvelope(
    lotAreaResult.area,
    lotAreaResult.frontage,
    munRule,
    zoneHint,
    input,
  );

  // 6. Determine effective baseline unit count
  const provBaseline = provRule?.baseline_units || 2;
  const munBaseline = munRule?.baseline_units || provBaseline;
  const effectiveBaseline = Math.max(munBaseline, provBaseline);

  // 7. Unit count range
  const unitsLow = Math.min(2, effectiveBaseline);
  const unitsHigh = munRule?.six_unit_area_possible ? effectiveBaseline + 2 : effectiveBaseline;
  const likelyRangeLabel = `${unitsLow}-${unitsHigh} units`;

  // 8. Build scenarios
  const scenarios = buildScenarios(munRule, provRule, envelope.practical_gfa, input);
  const sixUnitStatus = inferTorontoSixUnitStatus(input, munRule);

  // 9. Unit GFA scenarios
  const unitScenarios = [2, effectiveBaseline, ...(munRule?.six_unit_area_possible ? [6] : [])].map(u => ({
    units: u,
    avg_unit_sqft: envelope.practical_gfa ? Math.round(envelope.practical_gfa / u) : 0,
    total_gfa: envelope.practical_gfa || 0,
  }));

  // 10. Detect risk flags
  const riskFlags = detectRiskFlags(input, munRule ? { ...munRule, key: munKey } as any : null, lotAreaResult);
  const rulesHierarchy = buildRuleHierarchy(input, provRule, munRule, zoneHint, sixUnitStatus);
  const assumptions = buildAssumptions(input, lotAreaResult, envelope, sixUnitStatus);

  // 11. Approval path assessment
  let approvalPath: "as_of_right" | "minor_variance_likely" | "rezoning_required" | "complex" | "unknown" = "unknown";
  if (!munRule && !provRule) {
    approvalPath = "unknown";
  } else if (input.heritageFlag || input.floodplainFlag) {
    approvalPath = "complex";
  } else if (effectiveBaseline >= 4 && munRule?.supportLevel === "partial") {
    approvalPath = "as_of_right";
  } else if (effectiveBaseline >= 3) {
    approvalPath = "as_of_right";
  } else {
    approvalPath = "minor_variance_likely";
  }

  // 12. Build quick read
  let headline: string;
  const isToronto = munKey === "Toronto";

  if (!provRule && !munRule) {
    headline = "Municipality not yet in our database — Ontario baseline may apply";
  } else if (isToronto) {
    headline = `Toronto: up to ${effectiveBaseline} units likely as-of-right${munRule?.six_unit_area_possible ? ` (up to 6 in T&EY area)` : ""} — subject to zoning standards`;
  } else {
    headline = `Ontario: up to ${effectiveBaseline} units likely as baseline — subject to local zoning`;
  }

  const keyFacts: string[] = [];
  if (munRule) keyFacts.push(`Municipality: ${munRule.name}`);
  keyFacts.push(`Likely screening range: ${likelyRangeLabel}`);
  if (lotAreaResult.area) keyFacts.push(`Estimated lot area: ${Math.round(lotAreaResult.area).toLocaleString()} sqft`);
  if (envelope.practical_gfa) keyFacts.push(`Rough practical GFA: ~${envelope.practical_gfa.toLocaleString()} sqft (see envelope math)`);
  if (munRule?.laneway_suite_possible) keyFacts.push("Laneway suite possible (verify lane access)");
  if (munRule?.garden_suite_possible || provRule?.garden_suite_possible) keyFacts.push("Garden suite likely possible");
  if (sixUnitStatus === "more_likely_area") keyFacts.push("Toronto 6-unit subarea looks more plausible from address context");

  const keyBlockers: string[] = [];
  if (input.heritageFlag) keyBlockers.push("Heritage flag — major constraint");
  if (input.floodplainFlag) keyBlockers.push("Floodplain — conservation authority required");
  if (!input.zoneCode) keyBlockers.push("Zone not provided — verify with municipal zoning map");
  if (lotAreaResult.area && lotAreaResult.area < 2500) keyBlockers.push("Small lot — unit count likely constrained");

  // 13. Collect all sources
  const allSources: PolicySource[] = [
    ...(provRule?.sources || []),
    ...(munRule?.sources || []),
  ];
  if (!munRule) allSources.push(SOURCES.inferred);

  return {
    address: input.address || input.city || "Unknown address",
    municipality: munRule?.name || (provRule ? `${provRule.name} (municipality not recognized)` : "Unknown"),
    province: provRule?.name || "Unknown",
    support_level: munRule?.supportLevel || (provRule ? "province_only" : "unsupported"),

    quick_read: {
      headline,
      confidence: confidenceLevel,
      confidence_score: confidenceScore,
      key_facts: keyFacts,
      key_blockers: keyBlockers,
    },

    zoning: {
      code: input.zoneCode,
      description: zoneHint?.description,
      zone_category: zoneHint?.category || "unknown",
      official_plan_note: munRule ? `Verify in ${munRule.name} Official Plan` : undefined,
      overlay_flags: [
        ...(input.heritageFlag ? ["Heritage"] : []),
        ...(input.floodplainFlag ? ["Floodplain / Conservation"] : []),
      ],
      heritage_flagged: input.heritageFlag || false,
      floodplain_flagged: input.floodplainFlag || false,
    },

    permissions: {
      provincial_baseline_units: provBaseline,
      municipal_baseline_units: munBaseline,
      effective_baseline_units: effectiveBaseline,
      likely_units_low: unitsLow,
      likely_units_high: unitsHigh,
      likely_range_label: likelyRangeLabel,
      aru_possible: munRule?.aru_possible || provRule?.aru_possible || false,
      garden_suite_possible: munRule?.garden_suite_possible || provRule?.garden_suite_possible || false,
      laneway_suite_possible: munRule?.laneway_suite_possible || false,
      six_unit_area_possible: munRule?.six_unit_area_possible || false,
      six_unit_area_status: sixUnitStatus,
      approval_path: approvalPath,
      scenarios,
      approval_notes: munRule?.approval_notes || provRule?.baseline_notes || [],
    },

    envelope: {
      lot_area_sqft: lotAreaResult.area,
      lot_frontage_ft: lotAreaResult.frontage,
      lot_depth_ft: lotAreaResult.depth,
      lot_area_basis: lotAreaResult.basis,
      estimated_lot_coverage_ratio: envelope.coverage_ratio,
      coverage_basis: envelope.coverage_basis,
      estimated_max_footprint_sqft: envelope.footprint,
      estimated_storeys: envelope.storeys,
      estimated_theoretical_gfa_sqft: envelope.theoretical_gfa,
      estimated_practical_gfa_sqft: envelope.practical_gfa,
      practical_haircut_reason: envelope.practical_haircut_reason,
      unit_scenarios: unitScenarios,
      calculation_notes: envelope.calc_notes,
    },

    risk_flags: riskFlags,
    rules_hierarchy: rulesHierarchy,
    assumptions,
    source_summary: {
      direct_sources: allSources.filter((source) => source.confidence !== "low").length,
      heuristic_sources: allSources.filter((source) => source.confidence === "low").length,
      total_sources: allSources.length,
    },
    sources: allSources,
    confidence_breakdown: breakdown,
    confidence_score: confidenceScore,
    computed_at: now,
    disclaimer: DISCLAIMER,
  };
}
