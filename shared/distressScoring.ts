export interface MatchedTerm {
  term: string;
  category: "foreclosure_pos" | "motivated" | "vtb" | "commercial";
  weight: "strong" | "medium";
  points: number;
}

export interface DistressResult {
  distressScore: number;
  confidence: "high" | "medium" | "low";
  categoriesTriggered: {
    foreclosure_pos: boolean;
    motivated: boolean;
    vtb: boolean;
    commercial: boolean;
  };
  matchedTerms: MatchedTerm[];
  rawScore: number;
}

type Category = "foreclosure_pos" | "motivated" | "vtb" | "commercial";

interface TermEntry {
  term: string;
  category: Category;
  weight: "strong" | "medium";
}

const STRONG_POINTS = 20;
const MEDIUM_POINTS = 8;
const PATTERN_POINTS = 12;
const MAX_RAW = 120;

const NEGATION_PATTERNS = [
  "no vtb",
  "vtb not available",
  "not a power of sale",
  "not foreclosure",
  "not a foreclosure",
  "no power of sale",
  "no seller financing",
  "no vendor take back",
  "no vendor financing",
];

const TERMS: TermEntry[] = [
  { term: "power of sale", category: "foreclosure_pos", weight: "strong" },
  { term: "under power of sale", category: "foreclosure_pos", weight: "strong" },
  { term: "mortgagee sale", category: "foreclosure_pos", weight: "strong" },
  { term: "mortgagee's sale", category: "foreclosure_pos", weight: "strong" },
  { term: "bank owned", category: "foreclosure_pos", weight: "strong" },
  { term: "bank-owned", category: "foreclosure_pos", weight: "strong" },
  { term: "court ordered sale", category: "foreclosure_pos", weight: "strong" },
  { term: "court-ordered sale", category: "foreclosure_pos", weight: "strong" },
  { term: "judicial sale", category: "foreclosure_pos", weight: "strong" },
  { term: "foreclosure", category: "foreclosure_pos", weight: "strong" },
  { term: "sheriff sale", category: "foreclosure_pos", weight: "strong" },
  { term: "sheriff's sale", category: "foreclosure_pos", weight: "strong" },
  { term: "receivership", category: "foreclosure_pos", weight: "strong" },
  { term: "receiver", category: "foreclosure_pos", weight: "strong" },
  { term: "court appointed receiver", category: "foreclosure_pos", weight: "strong" },
  { term: "repossessed", category: "foreclosure_pos", weight: "strong" },
  { term: "repossession", category: "foreclosure_pos", weight: "strong" },
  { term: "reo", category: "foreclosure_pos", weight: "strong" },
  { term: "conduct of sale", category: "foreclosure_pos", weight: "strong" },
  { term: "reprise de finance", category: "foreclosure_pos", weight: "strong" },
  { term: "vente sous controle de justice", category: "foreclosure_pos", weight: "strong" },
  { term: "vente judiciaire", category: "foreclosure_pos", weight: "strong" },
  { term: "sous controle de justice", category: "foreclosure_pos", weight: "strong" },
  { term: "estate sale", category: "foreclosure_pos", weight: "medium" },
  { term: "probate", category: "foreclosure_pos", weight: "medium" },
  { term: "bank sale", category: "foreclosure_pos", weight: "medium" },
  { term: "sold as is", category: "foreclosure_pos", weight: "medium" },
  { term: "as is where is", category: "foreclosure_pos", weight: "medium" },
  { term: "where is as is", category: "foreclosure_pos", weight: "medium" },
  { term: "schedule a", category: "foreclosure_pos", weight: "medium" },
  { term: "no representations or warranties", category: "foreclosure_pos", weight: "medium" },
  { term: "foreclosure proceedings", category: "foreclosure_pos", weight: "medium" },

  { term: "must sell", category: "motivated", weight: "strong" },
  { term: "motivated seller", category: "motivated", weight: "strong" },
  { term: "bring an offer", category: "motivated", weight: "strong" },
  { term: "bring offers", category: "motivated", weight: "strong" },
  { term: "any offer", category: "motivated", weight: "strong" },
  { term: "all offers", category: "motivated", weight: "strong" },
  { term: "priced to sell", category: "motivated", weight: "strong" },
  { term: "quick close", category: "motivated", weight: "strong" },
  { term: "quick closing", category: "motivated", weight: "strong" },
  { term: "immediate possession", category: "motivated", weight: "strong" },
  { term: "urgent sale", category: "motivated", weight: "strong" },
  { term: "needs to sell", category: "motivated", weight: "strong" },
  { term: "price reduced", category: "motivated", weight: "strong" },
  { term: "drastically reduced", category: "motivated", weight: "strong" },
  { term: "seller relocating", category: "motivated", weight: "medium" },
  { term: "relocation", category: "motivated", weight: "medium" },
  { term: "divorce", category: "motivated", weight: "medium" },
  { term: "separation", category: "motivated", weight: "medium" },
  { term: "bankruptcy", category: "motivated", weight: "medium" },
  { term: "insolvency", category: "motivated", weight: "medium" },
  { term: "faillite", category: "motivated", weight: "medium" },
  { term: "handyman special", category: "motivated", weight: "medium" },
  { term: "contractor special", category: "motivated", weight: "medium" },
  { term: "fixer upper", category: "motivated", weight: "medium" },
  { term: "fixer-upper", category: "motivated", weight: "medium" },
  { term: "tlc", category: "motivated", weight: "medium" },
  { term: "as is", category: "motivated", weight: "medium" },
  { term: "offers anytime", category: "motivated", weight: "medium" },
  { term: "below market", category: "motivated", weight: "medium" },
  { term: "under market", category: "motivated", weight: "medium" },
  { term: "reduced", category: "motivated", weight: "medium" },

  { term: "vtb", category: "vtb", weight: "strong" },
  { term: "vendor take back", category: "vtb", weight: "strong" },
  { term: "vendor take-back", category: "vtb", weight: "strong" },
  { term: "seller financing", category: "vtb", weight: "strong" },
  { term: "seller-financing", category: "vtb", weight: "strong" },
  { term: "owner financing", category: "vtb", weight: "strong" },
  { term: "owner-financing", category: "vtb", weight: "strong" },
  { term: "vendor financing", category: "vtb", weight: "strong" },
  { term: "take back mortgage", category: "vtb", weight: "strong" },
  { term: "take-back mortgage", category: "vtb", weight: "strong" },
  { term: "seller will hold", category: "vtb", weight: "strong" },
  { term: "vendor will hold", category: "vtb", weight: "strong" },
  { term: "carryback", category: "vtb", weight: "strong" },
  { term: "carry-back", category: "vtb", weight: "strong" },
  { term: "financement vendeur", category: "vtb", weight: "strong" },
  { term: "vendeur finance", category: "vtb", weight: "strong" },
  { term: "agreement for sale", category: "vtb", weight: "medium" },
  { term: "terms available", category: "vtb", weight: "medium" },

  { term: "commercial property", category: "commercial", weight: "strong" },
  { term: "commercial building", category: "commercial", weight: "strong" },
  { term: "commercial space", category: "commercial", weight: "strong" },
  { term: "commercial unit", category: "commercial", weight: "strong" },
  { term: "retail space", category: "commercial", weight: "strong" },
  { term: "office space", category: "commercial", weight: "strong" },
  { term: "office building", category: "commercial", weight: "strong" },
  { term: "warehouse", category: "commercial", weight: "strong" },
  { term: "industrial", category: "commercial", weight: "medium" },
  { term: "mixed use", category: "commercial", weight: "strong" },
  { term: "mixed-use", category: "commercial", weight: "strong" },
  { term: "strip mall", category: "commercial", weight: "strong" },
  { term: "plaza", category: "commercial", weight: "medium" },
  { term: "storefront", category: "commercial", weight: "strong" },
  { term: "store front", category: "commercial", weight: "strong" },
  { term: "multi-tenant", category: "commercial", weight: "strong" },
  { term: "multi tenant", category: "commercial", weight: "strong" },
  { term: "triple net", category: "commercial", weight: "strong" },
  { term: "nnn", category: "commercial", weight: "strong" },
  { term: "cap rate", category: "commercial", weight: "medium" },
  { term: "commercial lease", category: "commercial", weight: "strong" },
  { term: "zoned commercial", category: "commercial", weight: "strong" },
  { term: "business for sale", category: "commercial", weight: "strong" },
  { term: "investment property", category: "commercial", weight: "medium" },
  { term: "income property", category: "commercial", weight: "medium" },
  { term: "revenue property", category: "commercial", weight: "medium" },
];

const PATTERN_COMBOS: Array<{
  words: string[];
  operator: "and";
  category: Category;
}> = [
  { words: ["lender", "sale"], operator: "and", category: "foreclosure_pos" },
  { words: ["lender", "owned"], operator: "and", category: "foreclosure_pos" },
  { words: ["banque", "reprise"], operator: "and", category: "foreclosure_pos" },
  { words: ["banque", "vente"], operator: "and", category: "foreclosure_pos" },
  { words: ["second mortgage", "vtb"], operator: "and", category: "vtb" },
  { words: ["second mortgage", "vendor"], operator: "and", category: "vtb" },
];

const PROVINCIAL_BOOSTS: Record<string, Array<{ term: string; category: Category; bonus: number }>> = {
  ontario: [
    { term: "power of sale", category: "foreclosure_pos", bonus: 5 },
    { term: "mortgagee sale", category: "foreclosure_pos", bonus: 5 },
  ],
  "british columbia": [
    { term: "court ordered sale", category: "foreclosure_pos", bonus: 5 },
    { term: "conduct of sale", category: "foreclosure_pos", bonus: 5 },
    { term: "judicial sale", category: "foreclosure_pos", bonus: 3 },
  ],
  alberta: [
    { term: "judicial sale", category: "foreclosure_pos", bonus: 5 },
    { term: "foreclosure", category: "foreclosure_pos", bonus: 3 },
  ],
  quebec: [
    { term: "reprise de finance", category: "foreclosure_pos", bonus: 5 },
    { term: "vente judiciaire", category: "foreclosure_pos", bonus: 5 },
    { term: "financement vendeur", category: "vtb", bonus: 3 },
  ],
};

const PROVINCE_ALIASES: Record<string, string> = {
  on: "ontario",
  ont: "ontario",
  bc: "british columbia",
  ab: "alberta",
  qc: "quebec",
  québec: "quebec",
  mb: "manitoba",
  sk: "saskatchewan",
  ns: "nova scotia",
  nb: "new brunswick",
  pe: "prince edward island",
  pei: "prince edward island",
  nl: "newfoundland and labrador",
  yt: "yukon",
  nt: "northwest territories",
  nu: "nunavut",
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeProvince(province: string | null | undefined): string {
  if (!province) return "";
  const lower = province.toLowerCase().trim();
  return PROVINCE_ALIASES[lower] || lower;
}

function checkNegation(normalized: string): Set<string> {
  const negated = new Set<string>();
  for (const neg of NEGATION_PATTERNS) {
    if (normalized.includes(neg)) {
      const parts = neg.split(" ");
      for (const t of TERMS) {
        if (parts.some(p => t.term.includes(p) && p.length > 2)) {
          negated.add(t.term);
        }
      }
    }
  }
  return negated;
}

export function scoreDistress(
  remarks: string | null | undefined,
  province?: string | null
): DistressResult {
  const empty: DistressResult = {
    distressScore: 0,
    confidence: "low",
    categoriesTriggered: { foreclosure_pos: false, motivated: false, vtb: false, commercial: false },
    matchedTerms: [],
    rawScore: 0,
  };

  if (!remarks || remarks.trim().length === 0) return empty;

  const normalized = normalizeText(remarks);
  const negated = checkNegation(normalized);
  const normProvince = normalizeProvince(province);

  const matchedTerms: MatchedTerm[] = [];
  const seenTerms = new Set<string>();
  let rawScore = 0;

  for (const entry of TERMS) {
    if (seenTerms.has(entry.term)) continue;
    if (negated.has(entry.term)) continue;

    const termNorm = normalizeText(entry.term);
    const idx = normalized.indexOf(termNorm);
    if (idx === -1) continue;

    const before = idx > 0 ? normalized[idx - 1] : " ";
    const after = idx + termNorm.length < normalized.length ? normalized[idx + termNorm.length] : " ";
    if (before !== " " && before !== "-" && before !== "'") continue;
    if (after !== " " && after !== "-" && after !== "'" && after !== "s") continue;

    seenTerms.add(entry.term);
    const points = entry.weight === "strong" ? STRONG_POINTS : MEDIUM_POINTS;
    matchedTerms.push({
      term: entry.term,
      category: entry.category,
      weight: entry.weight,
      points,
    });
    rawScore += points;
  }

  for (const combo of PATTERN_COMBOS) {
    const allFound = combo.words.every(w => normalized.includes(w));
    if (allFound) {
      const comboKey = combo.words.join("+");
      if (!seenTerms.has(comboKey)) {
        seenTerms.add(comboKey);
        matchedTerms.push({
          term: combo.words.join(" + "),
          category: combo.category,
          weight: "strong",
          points: PATTERN_POINTS,
        });
        rawScore += PATTERN_POINTS;
      }
    }
  }

  if (normProvince && PROVINCIAL_BOOSTS[normProvince]) {
    for (const boost of PROVINCIAL_BOOSTS[normProvince]) {
      if (seenTerms.has(boost.term)) {
        rawScore += boost.bonus;
      }
    }
  }

  const capped = Math.min(rawScore, MAX_RAW);
  const distressScore = Math.round((capped / MAX_RAW) * 100);

  const categoriesTriggered = {
    foreclosure_pos: matchedTerms.some(m => m.category === "foreclosure_pos"),
    motivated: matchedTerms.some(m => m.category === "motivated"),
    vtb: matchedTerms.some(m => m.category === "vtb"),
    commercial: matchedTerms.some(m => m.category === "commercial"),
  };

  const strongHits = matchedTerms.filter(m => m.weight === "strong");
  const strongByCategory: Record<string, number> = {};
  const mediumByCategory: Record<string, number> = {};
  for (const m of matchedTerms) {
    if (m.weight === "strong") {
      strongByCategory[m.category] = (strongByCategory[m.category] || 0) + 1;
    } else {
      mediumByCategory[m.category] = (mediumByCategory[m.category] || 0) + 1;
    }
  }

  let confidence: "high" | "medium" | "low" = "low";
  if (strongHits.length >= 2) {
    confidence = "high";
  } else if (
    Object.entries(strongByCategory).some(
      ([cat, count]) => count >= 1 && (mediumByCategory[cat] || 0) >= 2
    )
  ) {
    confidence = "high";
  } else if (rawScore >= 25) {
    confidence = "medium";
  }

  return {
    distressScore,
    confidence,
    categoriesTriggered,
    matchedTerms,
    rawScore,
  };
}

export function getProvincialNuance(province: string | null | undefined): string {
  const norm = normalizeProvince(province);
  switch (norm) {
    case "ontario":
      return 'In Ontario, "Power of Sale" is the most common mechanism for lender-forced sales. It allows the lender to sell without going to court, resulting in faster timelines than judicial foreclosure. Look for "mortgagee sale" and "under power of sale" in listings.';
    case "british columbia":
      return 'In British Columbia, distressed sales typically occur through "court ordered sale" or "conduct of sale" proceedings under judicial supervision. "Judicial sale" and "schedule A" terms are common indicators.';
    case "alberta":
      return 'In Alberta, "judicial sale" and "foreclosure" are the standard mechanisms for distressed property sales. These go through the courts, and the redemption period can affect timelines.';
    case "quebec":
      return 'Au Québec, les ventes de propriétés en détresse utilisent des termes comme "reprise de finance", "vente sous contrôle de justice" et "vente judiciaire". Le financement vendeur est indiqué par "financement vendeur".';
    case "manitoba":
    case "saskatchewan":
      return "In the prairies, both judicial foreclosure and power of sale mechanisms exist. Terminology may include standard English terms for foreclosure and court-ordered sales.";
    case "nova scotia":
    case "new brunswick":
    case "prince edward island":
    case "newfoundland and labrador":
      return 'In the Atlantic provinces, both "power of sale" and "foreclosure" terminology appears. The process and timelines vary by province.';
    default:
      return "Distressed sale terminology varies by province. This tool flags listings based on common terms. Always verify the specific legal mechanism with a local real estate lawyer.";
  }
}

export const DISTRESS_CATEGORIES = {
  foreclosure_pos: {
    label: "Foreclosure / Power of Sale",
    shortLabel: "Foreclosure/POS",
    color: "#ef4444",
    description: "Power of sale, court-ordered, bank-owned, receivership, or foreclosure proceedings",
  },
  motivated: {
    label: "Motivated Seller",
    shortLabel: "Motivated",
    color: "#f59e0b",
    description: "Signals of urgency: must sell, price reduced, quick close, relocation, etc.",
  },
  vtb: {
    label: "VTB / Seller Financing",
    shortLabel: "VTB",
    color: "#8b5cf6",
    description: "Vendor take-back mortgage, seller financing, or owner financing offered",
  },
  commercial: {
    label: "Commercial / Mixed-Use",
    shortLabel: "Commercial",
    color: "#06b6d4",
    description: "Commercial, retail, office, warehouse, mixed-use, or investment properties",
  },
} as const;
