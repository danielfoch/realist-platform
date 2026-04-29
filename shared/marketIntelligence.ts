export interface RankPoint {
  userId: string;
  rank: number;
}

export function calculateRankChanges(current: RankPoint[], previous: RankPoint[]) {
  const previousByUser = new Map(previous.map((entry) => [entry.userId, entry.rank]));
  return current.map((entry) => {
    const previousRank = previousByUser.get(entry.userId) ?? null;
    return {
      ...entry,
      previousRank,
      rankChange: previousRank == null ? null : previousRank - entry.rank,
    };
  });
}

export function hasEnoughLeaderboardHistory(months: string[], minimumMonths = 2): boolean {
  return Array.from(new Set(months.filter(Boolean))).length >= minimumMonths;
}

export function isLowSampleProvisional(sampleSize: number | null | undefined, minimumSampleSize = 5): boolean {
  return !sampleSize || sampleSize < minimumSampleSize;
}

export function safeNullableDelta(userValue: number | null | undefined, autoValue: number | null | undefined): number | null {
  if (userValue == null || autoValue == null) return null;
  if (!Number.isFinite(userValue) || !Number.isFinite(autoValue)) return null;
  return userValue - autoValue;
}

export function confidenceWeightedDealCount(rows: Array<{ confidenceScore?: number | null; leaderboardEligible?: boolean | null }>): number {
  return rows.reduce((sum, row) => {
    if (row.leaderboardEligible === false) return sum;
    return sum + Math.max(0, Math.min(1, row.confidenceScore ?? 0.65));
  }, 0);
}
