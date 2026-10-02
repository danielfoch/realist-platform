import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { censusScalars, validateCensusLabels } from './census';
const xml = readFileSync(new URL('./fixtures/census-characteristics-1.3.xml', import.meta.url), 'utf8');
describe('Census characteristic definitions', () => {
  it('binds averages and income to the official labels rather than adjacent count codes', () => { validateCensusLabels(xml); expect(censusScalars['56']).toBe('avgHouseholdSize'); expect(censusScalars['57']).toBeUndefined(); expect(censusScalars['229']).toBe('medianHouseholdIncome'); expect(censusScalars['243']).toBeUndefined(); });
  it('rejects changed or missing characteristic definitions', () => { expect(() => validateCensusLabels(xml.replace('Average household size', 'Number of persons in private households'))).toThrow(); expect(() => validateCensusLabels('<Codelist/>')).toThrow(); });
});
