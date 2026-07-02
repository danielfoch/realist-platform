// Expert contributor reputation — pure scoring/labeling on top of the
// existing contribution_events points ledger and votes table.
//
// Architects, planners, mortgage/legal/inspection pros etc. join the network,
// add field notes to deals, get upvoted, and earn points that map to a rank
// tier shown on their profile and the expert leaderboard. This module owns the
// points constants, the tier math, and the category taxonomy. No DB, no I/O.

/**
 * Professional "lenses" an expert can contribute through. These are the
 * field-note categories and profile badges — distinct from industryPartners
 * partnerType (which also covers non-contributing roles) but aligned with it.
 */
export const EXPERT_CATEGORIES = [
  "architecture",
  "urban_planning",
  "mortgage",
  "legal",
  "accounting_tax",
  "property_management",
  "construction",
  "appraisal",
  "inspection",
  "realtor",
  // Regular signed-in members (non-partner investors) writing field notes.
  "investor",
  "other",
] as const;
export type ExpertCategory = (typeof EXPERT_CATEGORIES)[number];

export const EXPERT_CATEGORY_LABELS: Record<ExpertCategory, string> = {
  architecture: "Architect",
  urban_planning: "Urban Planner",
  mortgage: "Mortgage Professional",
  legal: "Real Estate Lawyer",
  accounting_tax: "Accountant / Tax",
  property_management: "Property Manager",
  construction: "Builder / Contractor",
  appraisal: "Appraiser",
  inspection: "Home Inspector",
  realtor: "Realtor",
  investor: "Investor",
  other: "Industry Expert",
};

export function isExpertCategory(value: unknown): value is ExpertCategory {
  return typeof value === "string" && (EXPERT_CATEGORIES as readonly string[]).includes(value);
}

/** Map an industryPartners.partnerType to the closest expert category. */
export function categoryFromPartnerType(partnerType: string | null | undefined): ExpertCategory {
  switch (partnerType) {
    case "realtor": return "realtor";
    case "mortgage_broker": return "mortgage";
    case "lawyer": return "legal";
    case "accountant": return "accounting_tax";
    case "property_manager": return "property_management";
    case "contractor": return "construction";
    case "appraiser": return "appraisal";
    case "inspector": return "inspection";
    case "architect": return "architecture";
    case "urban_planner": return "urban_planning";
    default: return "other";
  }
}

// Points awarded through the shared contribution_events ledger. Comments in the
// existing system award +1 (post) / +2 (upvote received); expert field notes
// are higher-effort professional contributions, so they weight a little more.
export const REPUTATION_POINTS = {
  fieldNoteAdded: 3,
  fieldNoteUpvoteReceived: 2,
  fieldNoteDownvoteReceived: -1,
} as const;

export interface RankTier {
  key: string;
  label: string;
  minPoints: number;
}

// Ascending thresholds. A contributor's tier is the highest whose minPoints
// they've reached.
export const RANK_TIERS: RankTier[] = [
  { key: "contributor", label: "Contributor", minPoints: 0 },
  { key: "established", label: "Established", minPoints: 25 },
  { key: "expert", label: "Expert", minPoints: 100 },
  { key: "authority", label: "Authority", minPoints: 300 },
  { key: "luminary", label: "Luminary", minPoints: 750 },
];

export interface RankResult {
  tier: RankTier;
  tierIndex: number;
  nextTier: RankTier | null;
  pointsToNext: number | null;
  /** 0–100 progress through the current tier toward the next (100 at top tier). */
  progressPct: number;
}

/** Map a total point score to a rank tier and progress toward the next tier. */
export function computeRank(totalPoints: number): RankResult {
  const points = Math.max(0, Math.floor(totalPoints || 0));
  let tierIndex = 0;
  for (let i = 0; i < RANK_TIERS.length; i++) {
    if (points >= RANK_TIERS[i].minPoints) tierIndex = i;
  }
  const tier = RANK_TIERS[tierIndex];
  const nextTier = RANK_TIERS[tierIndex + 1] ?? null;

  if (!nextTier) {
    return { tier, tierIndex, nextTier: null, pointsToNext: null, progressPct: 100 };
  }
  const span = nextTier.minPoints - tier.minPoints;
  const into = points - tier.minPoints;
  const progressPct = span > 0 ? Math.min(100, Math.round((into / span) * 100)) : 0;
  return { tier, tierIndex, nextTier, pointsToNext: nextTier.minPoints - points, progressPct };
}

export interface ContributorStatsInput {
  fieldNotesCount: number;
  netUpvotes: number;
  dealsContributed: number; // distinct listings/deals the expert has noted
}

/**
 * Derive total reputation points from raw contribution counts. Mirrors what
 * the contribution_events ledger accumulates, so it can be used for previews
 * or recomputation without querying every event row.
 */
export function reputationFromStats(stats: ContributorStatsInput): number {
  const notePoints = Math.max(0, stats.fieldNotesCount) * REPUTATION_POINTS.fieldNoteAdded;
  const votePoints = stats.netUpvotes * REPUTATION_POINTS.fieldNoteUpvoteReceived;
  return Math.max(0, notePoints + votePoints);
}
