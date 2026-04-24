export type AnalysisVisibility = "public" | "private";
export type CommentVisibility = "public" | "private" | "admin_hidden";
export type CommentStatus = "active" | "deleted" | "flagged" | "removed";
export type AnalysisSentiment = "bullish" | "neutral" | "bearish";

export interface CommunityFeatureFlags {
  ENABLE_COMMUNITY_ANALYSIS: boolean;
  ENABLE_PUBLIC_ANALYSIS_DEFAULT: boolean;
  ENABLE_COMMUNITY_MAP_MARKERS: boolean;
  ENABLE_COMMUNITY_CONTEXT_FOR_AI_ANALYSIS: boolean;
  ENABLE_ANALYSIS_DATA_EXPORTS: boolean;
  ENABLE_LISTING_COMMENTS: boolean;
  ENABLE_COMMENT_REPLIES: boolean;
  ENABLE_PRIVATE_LISTING_NOTES: boolean;
  ENABLE_COMMENT_REPORTING: boolean;
}

function readFlag(name: string, fallback: boolean): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })?.process?.env;
  const raw = env?.[name];
  if (raw == null) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

function readNumber(name: string, fallback: number): number {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })?.process?.env;
  const raw = env?.[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const COMMUNITY_FLAGS: CommunityFeatureFlags = {
  ENABLE_COMMUNITY_ANALYSIS: readFlag("ENABLE_COMMUNITY_ANALYSIS", true),
  ENABLE_PUBLIC_ANALYSIS_DEFAULT: readFlag("ENABLE_PUBLIC_ANALYSIS_DEFAULT", true),
  ENABLE_COMMUNITY_MAP_MARKERS: readFlag("ENABLE_COMMUNITY_MAP_MARKERS", true),
  ENABLE_COMMUNITY_CONTEXT_FOR_AI_ANALYSIS: readFlag("ENABLE_COMMUNITY_CONTEXT_FOR_AI_ANALYSIS", false),
  ENABLE_ANALYSIS_DATA_EXPORTS: readFlag("ENABLE_ANALYSIS_DATA_EXPORTS", false),
  ENABLE_LISTING_COMMENTS: readFlag("ENABLE_LISTING_COMMENTS", true),
  ENABLE_COMMENT_REPLIES: readFlag("ENABLE_COMMENT_REPLIES", true),
  ENABLE_PRIVATE_LISTING_NOTES: readFlag("ENABLE_PRIVATE_LISTING_NOTES", true),
  ENABLE_COMMENT_REPORTING: readFlag("ENABLE_COMMENT_REPORTING", true),
};

export const COMMUNITY_DEFAULTS = {
  CONSENT_TEXT_VERSION: "community-analysis-v1",
  BULLISH_CASH_ON_CASH_THRESHOLD: readNumber("COMMUNITY_BULLISH_CASH_ON_CASH_THRESHOLD", 8),
  BEARISH_DSCR_THRESHOLD: readNumber("COMMUNITY_BEARISH_DSCR_THRESHOLD", 1),
  COMMENT_MAX_LENGTH: 2000,
  ANALYSIS_TEXT_MAX_LENGTH: 12000,
};

export interface CommunityMetricInput {
  capRate?: number | null;
  cashOnCash?: number | null;
  projectedRent?: number | null;
  noi?: number | null;
  monthlyCashFlow?: number | null;
  expenseRatio?: number | null;
  dscr?: number | null;
  sentiment?: AnalysisSentiment | null;
}

export interface CommunityAggregateSummary {
  totalAnalysisCount: number;
  publicAnalysisCount: number;
  uniquePublicUserCount: number;
  medianCapRate: number | null;
  medianCashOnCash: number | null;
  medianProjectedRent: number | null;
  medianNoi: number | null;
  medianMonthlyCashFlow: number | null;
  medianExpenseRatio: number | null;
  bullishCount: number;
  neutralCount: number;
  bearishCount: number;
  consensusLabel: AnalysisSentiment | null;
  confidenceScore: number;
}

export function sanitizeUserText(input: string, maxLength = COMMUNITY_DEFAULTS.COMMENT_MAX_LENGTH): string {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function truncateText(input: string | null | undefined, maxLength = 160): string | null {
  if (!input) return null;
  if (input.length <= maxLength) return input;
  return `${input.slice(0, maxLength - 1).trim()}…`;
}

export function anonymizeDisplayName(firstName?: string | null, lastName?: string | null, fallback = "Community investor"): string {
  const safeFirst = sanitizeUserText(firstName || "", 60);
  const safeLast = sanitizeUserText(lastName || "", 60);
  if (safeFirst && safeLast) return `${safeFirst} ${safeLast[0]}.`;
  if (safeFirst) return safeFirst;
  return fallback;
}

export function median(values: Array<number | null | undefined>): number | null {
  const normalized = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
  if (!normalized.length) return null;
  const middle = Math.floor(normalized.length / 2);
  if (normalized.length % 2 === 1) return normalized[middle];
  return (normalized[middle - 1] + normalized[middle]) / 2;
}

export function computeConsensusLabel(input: {
  medianMonthlyCashFlow?: number | null;
  medianCashOnCash?: number | null;
  medianDscr?: number | null;
}): AnalysisSentiment {
  if ((input.medianMonthlyCashFlow ?? 0) < 0 || (input.medianDscr != null && input.medianDscr < COMMUNITY_DEFAULTS.BEARISH_DSCR_THRESHOLD)) {
    return "bearish";
  }
  if ((input.medianMonthlyCashFlow ?? 0) > 0 && (input.medianCashOnCash ?? 0) >= COMMUNITY_DEFAULTS.BULLISH_CASH_ON_CASH_THRESHOLD) {
    return "bullish";
  }
  return "neutral";
}

export function computeConfidenceScore(input: {
  publicAnalysisCount: number;
  uniquePublicUserCount: number;
  bullishCount: number;
  neutralCount: number;
  bearishCount: number;
}): number {
  const total = Math.max(0, input.bullishCount + input.neutralCount + input.bearishCount);
  if (total === 0) return 0;
  const dominant = Math.max(input.bullishCount, input.neutralCount, input.bearishCount);
  const consensusRatio = dominant / total;
  const breadthScore = Math.min(1, input.publicAnalysisCount / 8);
  const userBreadthScore = Math.min(1, input.uniquePublicUserCount / 5);
  return Number((((consensusRatio * 0.5) + (breadthScore * 0.3) + (userBreadthScore * 0.2)) * 100).toFixed(1));
}

export function summarizeCommunityMetrics(
  allAnalysesCount: number,
  publicUserIds: string[],
  metrics: CommunityMetricInput[],
): CommunityAggregateSummary {
  const publicAnalysisCount = metrics.length;
  const uniquePublicUserCount = new Set(publicUserIds.filter(Boolean)).size;
  const medianCapRate = median(metrics.map((item) => item.capRate));
  const medianCashOnCash = median(metrics.map((item) => item.cashOnCash));
  const medianProjectedRent = median(metrics.map((item) => item.projectedRent));
  const medianNoi = median(metrics.map((item) => item.noi));
  const medianMonthlyCashFlow = median(metrics.map((item) => item.monthlyCashFlow));
  const medianExpenseRatio = median(metrics.map((item) => item.expenseRatio));
  const medianDscr = median(metrics.map((item) => item.dscr));

  const bullishCount = metrics.filter((item) => (item.sentiment || computeConsensusLabel({
    medianMonthlyCashFlow: item.monthlyCashFlow,
    medianCashOnCash: item.cashOnCash,
    medianDscr: item.dscr,
  })) === "bullish").length;
  const bearishCount = metrics.filter((item) => (item.sentiment || computeConsensusLabel({
    medianMonthlyCashFlow: item.monthlyCashFlow,
    medianCashOnCash: item.cashOnCash,
    medianDscr: item.dscr,
  })) === "bearish").length;
  const neutralCount = Math.max(0, publicAnalysisCount - bullishCount - bearishCount);
  const consensusLabel = publicAnalysisCount
    ? computeConsensusLabel({ medianMonthlyCashFlow, medianCashOnCash, medianDscr })
    : null;
  const confidenceScore = computeConfidenceScore({
    publicAnalysisCount,
    uniquePublicUserCount,
    bullishCount,
    neutralCount,
    bearishCount,
  });

  return {
    totalAnalysisCount: allAnalysesCount,
    publicAnalysisCount,
    uniquePublicUserCount,
    medianCapRate,
    medianCashOnCash,
    medianProjectedRent,
    medianNoi,
    medianMonthlyCashFlow,
    medianExpenseRatio,
    bullishCount,
    neutralCount,
    bearishCount,
    consensusLabel,
    confidenceScore,
  };
}
