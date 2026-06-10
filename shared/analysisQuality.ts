export interface AnalysisQualityInput {
  timeSpentSeconds?: number | null;
  meaningfulInputChanges?: number | null;
  openedComparableSections?: number | null;
  savedNotes?: boolean | null;
  exportedOrSaved?: boolean | null;
  hasFinancingAssumptions?: boolean | null;
  hasRentAssumptions?: boolean | null;
  hasExpenseAssumptions?: boolean | null;
  hasRenovationOrCapexAssumptions?: boolean | null;
  comparableReferenceCount?: number | null;
  metrics?: Record<string, unknown> | null;
  duplicateSimilarity?: number | null;
  analysesLastHour?: number | null;
  userMedianTimeSeconds?: number | null;
}

export interface AnalysisQualityResult {
  qualityScore: number;
  confidenceScore: number;
  plausibilityScore: number;
  interactionDepthScore: number;
  dataCompletenessScore: number;
  uniquenessScore: number;
  dealViabilityScore: number;
  spamRiskScore: number;
  leaderboardEligible: boolean;
  exclusionReason: string | null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function computeAnalysisQualityScore(input: AnalysisQualityInput): AnalysisQualityResult {
  const timeSpent = Math.max(0, input.timeSpentSeconds || 0);
  const changes = Math.max(0, input.meaningfulInputChanges || 0);
  const openedSections = Math.max(0, input.openedComparableSections || 0);
  const notesBoost = input.savedNotes ? 0.15 : 0;
  const savedBoost = input.exportedOrSaved ? 0.1 : 0;

  const interactionDepthScore = clamp01(
    Math.min(timeSpent / 180, 0.45) +
    Math.min(changes / 8, 0.25) +
    Math.min(openedSections / 3, 0.15) +
    notesBoost +
    savedBoost,
  );

  const completenessSignals = [
    input.hasFinancingAssumptions,
    input.hasRentAssumptions,
    input.hasExpenseAssumptions,
    input.hasRenovationOrCapexAssumptions,
    (input.comparableReferenceCount || 0) > 0,
  ];
  const dataCompletenessScore = completenessSignals.filter(Boolean).length / completenessSignals.length;

  const metrics = input.metrics || {};
  const capRate = num(metrics.capRate ?? metrics.cap_rate);
  const cashOnCash = num(metrics.cashOnCash ?? metrics.cash_on_cash);
  const irr = num(metrics.irr);
  const dscr = num(metrics.dscr);
  const monthlyCashFlow = num(metrics.monthlyCashFlow ?? metrics.monthly_cash_flow);
  const rentToPrice = num(metrics.rentToPrice ?? metrics.rent_to_price);

  let plausibilityScore = 1;
  const impossibleFlags: string[] = [];
  if (capRate != null && (capRate < -10 || capRate > 25)) impossibleFlags.push("implausible_cap_rate");
  if (cashOnCash != null && (cashOnCash < -50 || cashOnCash > 60)) impossibleFlags.push("implausible_cash_on_cash");
  if (irr != null && (irr < -50 || irr > 75)) impossibleFlags.push("implausible_irr");
  if (dscr != null && (dscr < 0 || dscr > 4)) impossibleFlags.push("implausible_dscr");
  if (rentToPrice != null && (rentToPrice <= 0 || rentToPrice > 0.05)) impossibleFlags.push("implausible_rent_to_price");
  plausibilityScore = clamp01(plausibilityScore - impossibleFlags.length * 0.5);

  let dealViabilityScore = 0.5;
  if (dscr != null) dealViabilityScore += dscr >= 1.2 ? 0.2 : dscr < 0.8 ? -0.2 : 0;
  if (monthlyCashFlow != null) dealViabilityScore += monthlyCashFlow >= 0 ? 0.15 : -0.15;
  if (capRate != null) dealViabilityScore += capRate >= 4 && capRate <= 12 ? 0.15 : capRate > 20 ? -0.2 : 0;
  dealViabilityScore = clamp01(dealViabilityScore);

  const duplicateSimilarity = clamp01(input.duplicateSimilarity || 0);
  const uniquenessScore = clamp01(1 - duplicateSimilarity);

  let spamRiskScore = 0;
  if (timeSpent > 0 && timeSpent < 25) spamRiskScore += 0.35;
  if (changes === 0) spamRiskScore += 0.2;
  if ((input.analysesLastHour || 0) >= 15) spamRiskScore += 0.25;
  if ((input.userMedianTimeSeconds || 999) < 30) spamRiskScore += 0.2;
  if (duplicateSimilarity > 0.85) spamRiskScore += 0.25;
  spamRiskScore = clamp01(spamRiskScore);

  const weighted =
    interactionDepthScore * 0.25 +
    dataCompletenessScore * 0.2 +
    plausibilityScore * 0.2 +
    dealViabilityScore * 0.15 +
    uniquenessScore * 0.15 +
    (1 - spamRiskScore) * 0.05;
  const confidenceScore = clamp01(weighted - Math.max(0, spamRiskScore - 0.5) * 0.35);

  let exclusionReason: string | null = null;
  if (impossibleFlags.length > 0) exclusionReason = impossibleFlags[0];
  else if (spamRiskScore >= 0.75) exclusionReason = "high_spam_risk";
  else if (plausibilityScore < 0.4) exclusionReason = "low_plausibility";
  else if (confidenceScore < 0.65) exclusionReason = "low_confidence";

  return {
    qualityScore: confidenceScore,
    confidenceScore,
    plausibilityScore,
    interactionDepthScore,
    dataCompletenessScore,
    uniquenessScore,
    dealViabilityScore,
    spamRiskScore,
    leaderboardEligible: !exclusionReason,
    exclusionReason,
  };
}
