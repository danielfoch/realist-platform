export type DistressPrimaryCategory = "foreclosure_pos" | "motivated" | "vtb";

export interface DistressObservationForCohort {
  listingKey: string;
  listPrice: number | null;
  primaryCategory: DistressPrimaryCategory;
  foreclosurePos: boolean;
  motivated: boolean;
  vtb: boolean;
}

export interface DistressCohortSummary {
  currentListings: number;
  previousListings: number;
  newlyFlagged: number;
  persistent: number;
  noLongerFlagged: number;
  persistenceRatePct: number | null;
  priceReduced: number;
  priceIncreased: number;
  priceUnchanged: number;
  medianPriceChangePct: number | null;
  triggeredCategoryCounts: Record<DistressPrimaryCategory, number>;
  primaryCategoryCounts: Record<DistressPrimaryCategory, number>;
}

export interface DistressMarketIntelligenceResponse {
  month: string;
  previousMonth: string;
  scope: { province: string | null; city: string | null };
  cohort: DistressCohortSummary;
  confidenceCounts: { high: number; medium: number; low: number };
  coverage: {
    provincesCaptured: number;
    citiesCaptured: number;
    queriesAttempted: number;
    queriesSucceeded: number;
    capturedAt: string | null;
    methodologyVersion: string;
  };
  methodology: {
    source: string;
    cadence: string;
    unit: string;
    categoriesOverlap: true;
    primaryCategoryPriority: DistressPrimaryCategory[];
    caveats: string[];
  };
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[midpoint]
    : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

export function previousCalendarMonth(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("month must use YYYY-MM");
  const [year, monthNumber] = month.split("-").map(Number);
  const previous = new Date(Date.UTC(year, monthNumber - 2, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function summarizeDistressCohort(
  currentRows: DistressObservationForCohort[],
  previousRows: DistressObservationForCohort[],
): DistressCohortSummary {
  const current = new Map(currentRows.map((row) => [row.listingKey, row]));
  const previous = new Map(previousRows.map((row) => [row.listingKey, row]));
  const persistentRows = [...current.values()].filter((row) => previous.has(row.listingKey));
  const priceChanges: number[] = [];
  let priceReduced = 0;
  let priceIncreased = 0;
  let priceUnchanged = 0;

  for (const row of persistentRows) {
    const prior = previous.get(row.listingKey)!;
    if (!row.listPrice || !prior.listPrice || row.listPrice <= 0 || prior.listPrice <= 0) continue;
    const changePct = ((row.listPrice - prior.listPrice) / prior.listPrice) * 100;
    priceChanges.push(changePct);
    if (changePct < -0.01) priceReduced++;
    else if (changePct > 0.01) priceIncreased++;
    else priceUnchanged++;
  }

  const emptyCounts = (): Record<DistressPrimaryCategory, number> => ({
    foreclosure_pos: 0,
    motivated: 0,
    vtb: 0,
  });
  const triggeredCategoryCounts = emptyCounts();
  const primaryCategoryCounts = emptyCounts();
  for (const row of current.values()) {
    if (row.foreclosurePos) triggeredCategoryCounts.foreclosure_pos++;
    if (row.motivated) triggeredCategoryCounts.motivated++;
    if (row.vtb) triggeredCategoryCounts.vtb++;
    primaryCategoryCounts[row.primaryCategory]++;
  }

  const persistent = persistentRows.length;
  return {
    currentListings: current.size,
    previousListings: previous.size,
    newlyFlagged: [...current.keys()].filter((key) => !previous.has(key)).length,
    persistent,
    noLongerFlagged: [...previous.keys()].filter((key) => !current.has(key)).length,
    persistenceRatePct: previous.size ? (persistent / previous.size) * 100 : null,
    priceReduced,
    priceIncreased,
    priceUnchanged,
    medianPriceChangePct: median(priceChanges),
    triggeredCategoryCounts,
    primaryCategoryCounts,
  };
}
