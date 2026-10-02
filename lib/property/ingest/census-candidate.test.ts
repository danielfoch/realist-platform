import { describe, expect, it } from "vitest";
import { CensusCandidate, CENSUS_FIELDS } from "./census-candidate";
const row = (characteristic: string, overrides: Record<string, string> = {}) => ({ dataflow: "STC_CP:DF_DA(1.3)", characteristic, gender: "1", statistic: "1", alt_geo_code: "35200351", ref_area: "2021S051235200351", obs_value: "0", flag: "", ...overrides });
describe("Census replacement candidates", () => {
  it("requires every expected characteristic for every DA", () => { const c = new CensusCandidate(); c.add("1", row("1")); expect(() => c.finish(1)).toThrow(/Incomplete Census characteristic/); });
  it("rejects duplicate observations and unexpected definitions or geographies", () => { const c = new CensusCandidate(); c.add("1", row("1")); expect(() => c.add("1", row("1"))).toThrow(/Duplicate/); expect(() => c.add("4", row("5"))).toThrow(); expect(() => c.add("4", row("4", { ref_area: "different" }))).toThrow(); expect(() => c.add("4", row("4", { dataflow: "STC_CP:DF_DA(1.4)" }))).toThrow(); });
  it("keeps suppression flags and corrected household averages", () => { const c = new CensusCandidate(); for (const f of CENSUS_FIELDS) c.add(f, row(f, f === "56" ? { obs_value: "2.1" } : f === "229" ? { obs_value: "99999", flag: "x" } : {})); const [r] = c.finish(1); expect(r.profile.avgHouseholdSize).toBe(2.1); expect(r.profile.medianHouseholdIncome).toBeNull(); expect((r.profile.sourceFlags as Record<string, unknown>)["229"]).toBe("x"); });
  it("rejects contradictory published count groups", () => { const c = new CensusCandidate(); for (const f of CENSUS_FIELDS) c.add(f, row(f, f === "42" ? { obs_value: "200" } : {})); expect(() => c.finish(1)).toThrow(/semantic/); });
});
