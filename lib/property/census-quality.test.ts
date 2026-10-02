import { describe, expect, it } from "vitest";
import { CENSUS_MAPPING_VERSION } from "./ingest/census";
import { censusProfileConsistent } from "./census-quality";
describe('census semantic quality checks', () => {
  it('withholds legacy profiles without verified mapping provenance', () => { expect(censusProfileConsistent({ avgHouseholdSize: 2.1 })).toBe(false); });
  it('withholds an imported count mislabeled as household average', () => { expect(censusProfileConsistent({ mappingVersion: CENSUS_MAPPING_VERSION, avgHouseholdSize: 370 })).toBe(false); });
  it('keeps real averages, suppressed fields and ordinary census rounding', () => { expect(censusProfileConsistent({ mappingVersion: CENSUS_MAPPING_VERSION, avgHouseholdSize: 2.1, constructionPeriodsTotal: 175, constructionPeriods: { a: 80, b: 100 }, dwellingMix: { a: null } })).toBe(true); });
  it('withholds a construction breakdown inconsistent with its total', () => { expect(censusProfileConsistent({ mappingVersion: CENSUS_MAPPING_VERSION, constructionPeriodsTotal: 40, constructionPeriods: { a: 170, b: 35, c: 20 } })).toBe(false); });
});
