/**
 * Pure logic behind the underwrite verdict.
 *
 * Split out of VerdictSummary.tsx so it can be unit-tested the way the rest of
 * this codebase tests client logic — plain .ts modules, no DOM. The judgement
 * that matters is the asking-price comparison: it tells someone whether a site
 * works at the listed price, so a wrong sign is worse than showing nothing.
 */

/** TakeoutChoice from shared/multiplexTakeout. */
export type TakeoutChoice = "mli_hold" | "condo_termination" | "neither";

export function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

export function fmtPct(n: number, d = 1): string {
  return `${(n * 100).toFixed(d)}%`;
}

/** Compact money for headline tiles — "$1.45M" reads faster than "$1,450,000". */
export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return fmtMoney(n);
}

/**
 * Plain-English name for a takeout path.
 *
 * "neither" is a real answer — the site clears neither target — and gets a label
 * rather than being hidden, so the reader cannot mistake a declined
 * recommendation for the model having no opinion.
 */
export function takeoutLabel(takeout: string | null): string | null {
  switch (takeout) {
    case "mli_hold":
      return "Hold as rental";
    case "condo_termination":
      return "Build and sell";
    case "neither":
      return "Neither clears";
    default:
      return null;
  }
}

export function unitsLabel(units: number): string {
  return `${units} ${units === 1 ? "unit" : "units"}`;
}

export function sixplexSubLabel(eligible: boolean, certainty: string): string {
  if (!eligible) return "Before any variance";
  return certainty === "verified" ? "Sixplex ward — confirmed" : "Sixplex ward — likely";
}

/**
 * Price to seed an offer with: the residual land value on the recommended path
 * rounded to the nearest $1k, falling back to the asking price. Null when there
 * is nothing defensible to put in front of a seller.
 */
export function offerPrice(maxLandPrice: number | null, askingPrice: number | null): number | null {
  const candidate =
    maxLandPrice != null && Number.isFinite(maxLandPrice) && maxLandPrice > 0
      ? maxLandPrice
      : askingPrice != null && Number.isFinite(askingPrice) && askingPrice > 0
        ? askingPrice
        : null;
  if (candidate == null) return null;
  return Math.round(candidate / 1000) * 1000;
}

export interface AskingComparison {
  /** Positive when the land is worth more than the ask. */
  spread: number;
  worksAtAsking: boolean;
}

/**
 * Compare asking price against residual land value.
 *
 * Returns null when there is nothing solid to compare — no ask, a nonsense ask,
 * or no residual land value (which happens when the comparator returned
 * "neither"). Quoting a spread in those cases would imply a recommendation that
 * was never made.
 *
 * An exact match counts as working: paying precisely the residual land value
 * hits the target return by definition.
 */
export function compareToAsking(
  maxLandPrice: number | null,
  askingPrice: number | null,
): AskingComparison | null {
  if (maxLandPrice == null || askingPrice == null) return null;
  if (!Number.isFinite(maxLandPrice) || !Number.isFinite(askingPrice)) return null;
  if (askingPrice <= 0) return null;

  const spread = maxLandPrice - askingPrice;
  return { spread, worksAtAsking: spread >= 0 };
}
