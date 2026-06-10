export type SaleEstimateStatus = "active" | "updated" | "locked" | "resolved" | "excluded";
export type ResolutionStatus = "not_started" | "pending" | "resolved" | "unavailable" | "not_allowed" | "error";

export interface SaleEstimateInput {
  estimatePriceCents: number;
  listPriceCents?: number | null;
  confirmedOutOfRange?: boolean;
  locked?: boolean;
}

export interface ResolvedEstimateForScoring {
  estimatePriceCents: number;
  actualSalePriceCents: number | null;
  resolutionStatus: ResolutionStatus;
  excludeFromMetrics?: boolean;
  estimateSubmittedAt: Date | string;
  lockedAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  sourceConfidence?: number | string | null;
  flagged?: boolean;
}

export interface UserEstimatorMetricsResult {
  eligibleEstimateCount: number;
  resolvedEstimateCount: number;
  unavailableEstimateCount: number;
  medianAbsolutePercentageError: number | null;
  meanAbsolutePercentageError: number | null;
  trimmedMeanAbsolutePercentageError: number | null;
  rootMeanSquaredErrorCents: number | null;
  biasPercentage: number | null;
  reliabilityMultiplier: number;
  oracleScore: number;
}

export function listingKeyFromParts(input: {
  listingKey?: string | null;
  mlsNumber?: string | null;
  boardListingId?: string | null;
  source?: string | null;
}): string {
  return (input.listingKey || input.mlsNumber || input.boardListingId || `${input.source || "listing"}:unknown`).trim();
}

export function dollarsToCents(value: number): number {
  return Math.round(value * 100);
}

export function validateSaleEstimate(input: SaleEstimateInput): { ok: true } | { ok: false; error: string; requiresConfirmation?: boolean } {
  if (input.locked) return { ok: false, error: "Listing is locked for predictions" };
  if (!Number.isSafeInteger(input.estimatePriceCents) || input.estimatePriceCents <= 0) {
    return { ok: false, error: "Estimate must be a positive whole-cent amount" };
  }
  if (input.estimatePriceCents < 10_000_00 || input.estimatePriceCents > 200_000_000_00) {
    return { ok: false, error: "Estimate is outside the supported price range" };
  }
  if (input.listPriceCents && input.listPriceCents > 0) {
    const ratio = input.estimatePriceCents / input.listPriceCents;
    if ((ratio < 0.1 || ratio > 3) && !input.confirmedOutOfRange) {
      return { ok: false, error: "Estimate is far from list price", requiresConfirmation: true };
    }
  }
  return { ok: true };
}

export function isResolvedEstimateEligible(row: ResolvedEstimateForScoring, minSourceConfidence = 0.5): boolean {
  if (row.flagged) return false;
  if (row.resolutionStatus !== "resolved") return false;
  if (row.excludeFromMetrics) return false;
  if (!row.actualSalePriceCents || row.actualSalePriceCents <= 0) return false;
  if (!Number.isFinite(row.estimatePriceCents) || row.estimatePriceCents <= 0) return false;
  if (row.sourceConfidence != null && Number(row.sourceConfidence) < minSourceConfidence) return false;

  const submittedAt = new Date(row.estimateSubmittedAt).getTime();
  const lockedAt = row.lockedAt ? new Date(row.lockedAt).getTime() : null;
  const resolvedAt = row.resolvedAt ? new Date(row.resolvedAt).getTime() : null;
  if (Number.isFinite(lockedAt) && lockedAt != null && submittedAt > lockedAt) return false;
  if (Number.isFinite(resolvedAt) && resolvedAt != null && submittedAt > resolvedAt) return false;
  return true;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function trim(values: number[], trimRatio = 0.1): number[] {
  if (values.length < 5) return [...values];
  const sorted = [...values].sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * trimRatio);
  return sorted.slice(trimCount, sorted.length - trimCount);
}

export function calculateUserSaleEstimatorMetrics(rows: ResolvedEstimateForScoring[]): UserEstimatorMetricsResult {
  const resolvedRows = rows.filter((row) => row.resolutionStatus === "resolved");
  const unavailableEstimateCount = rows.filter((row) => row.resolutionStatus === "unavailable" || row.actualSalePriceCents == null).length;
  const eligible = rows.filter((row) => isResolvedEstimateEligible(row));

  const absolutePctErrors = eligible.map((row) => Math.abs(row.estimatePriceCents - row.actualSalePriceCents!) / row.actualSalePriceCents!);
  const signedPctErrors = eligible.map((row) => (row.estimatePriceCents - row.actualSalePriceCents!) / row.actualSalePriceCents!);
  const squaredErrors = eligible.map((row) => (row.estimatePriceCents - row.actualSalePriceCents!) ** 2);
  const trimmedMean = mean(trim(absolutePctErrors));
  const reliabilityMultiplier = Math.min(1, Math.sqrt(eligible.length / 20));
  const baseAccuracyScore = Math.max(0, 100 * (1 - (trimmedMean ?? 1)));

  return {
    eligibleEstimateCount: eligible.length,
    resolvedEstimateCount: resolvedRows.length,
    unavailableEstimateCount,
    medianAbsolutePercentageError: median(absolutePctErrors),
    meanAbsolutePercentageError: mean(absolutePctErrors),
    trimmedMeanAbsolutePercentageError: trimmedMean,
    rootMeanSquaredErrorCents: squaredErrors.length ? Math.round(Math.sqrt(mean(squaredErrors)!)) : null,
    biasPercentage: median(signedPctErrors),
    reliabilityMultiplier,
    oracleScore: baseAccuracyScore * reliabilityMultiplier,
  };
}

export function shouldExcludeResolutionFromMetrics(input: {
  resolutionStatus: ResolutionStatus;
  actualSalePriceCents?: number | null;
}): boolean {
  return input.resolutionStatus !== "resolved" || !input.actualSalePriceCents || input.actualSalePriceCents <= 0;
}

export function shouldConfirmListingAbsence(input: {
  force?: boolean;
  absenceDetectionCount: number;
  ddfAbsentSince?: Date | string | null;
  ddfLastSeenAt?: Date | string | null;
  now?: Date;
  minConsecutiveAbsences?: number;
  confirmationHours?: number;
}): boolean {
  if (input.force) return true;
  if (input.ddfAbsentSince) return true;
  const minConsecutiveAbsences = input.minConsecutiveAbsences ?? 2;
  if (input.absenceDetectionCount >= minConsecutiveAbsences) return true;
  if (!input.ddfLastSeenAt) return false;
  const now = input.now || new Date();
  const confirmationHours = input.confirmationHours ?? 24;
  return now.getTime() - new Date(input.ddfLastSeenAt).getTime() >= confirmationHours * 60 * 60 * 1000;
}
