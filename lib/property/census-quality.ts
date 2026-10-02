import { number, type Row } from "./model";
import { CENSUS_MAPPING_VERSION } from "./ingest/census";
/** Fail closed on semantic contradictions; rounded census counts need tolerance. */
export function censusProfileConsistent(p: Row): boolean {
  if (p.mappingVersion !== CENSUS_MAPPING_VERSION) return false;
  const average = number(p.avgHouseholdSize);
  if (average !== null && (average < 0 || average > 20)) return false;
  for (const [group, totalKey] of [["dwellingMix", "dwellingsByTypeTotal"], ["constructionPeriods", "constructionPeriodsTotal"]]) {
    const values = p[group]; const total = number(p[totalKey]);
    if (total !== null && values && typeof values === "object" && !Array.isArray(values)) {
      const entries = Object.values(values).map(number);
      if (entries.some(v => v !== null && v < 0)) return false;
      if (entries.every(v => v !== null) && Math.abs(entries.reduce<number>((sum, v) => sum + (v ?? 0), 0) - total) > 5 * (entries.length + 1)) return false;
    }
  }
  return true;
}
