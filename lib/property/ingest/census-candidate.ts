import { censusScalars, censusTypes, censusPeriods, CENSUS_MAPPING_VERSION } from "./census";
import { censusProfileConsistent } from "../census-quality";
import { number, type Row } from "../model";

export const CENSUS_FIELDS = [...Object.keys(censusScalars), ...Object.keys(censusTypes), ...Object.keys(censusPeriods), "41", "1426"];
export class CensusCandidate {
  readonly profiles = new Map<string, Row>();
  readonly seen = new Map(CENSUS_FIELDS.map(field => [field, new Set<string>()]));
  observations = 0;
  add(field: string, r: Record<string, string>) {
    if (r.dataflow !== "STC_CP:DF_DA(1.3)" || r.characteristic !== field || r.gender !== "1" || r.statistic !== "1") throw new Error("Unexpected Census series or version");
    const id = r.alt_geo_code;
    if (!/^\d{8}$/.test(id) || r.ref_area !== `2021S0512${id}`) throw new Error("Unexpected Census geography");
    const seen = this.seen.get(field);
    if (!seen || seen.has(id)) throw new Error("Duplicate or unexpected Census observation");
    seen.add(id);
    const value = /^(x|f|\.\.|\.\.\.)$/i.test(r.flag) ? null : number(r.obs_value);
    if (value !== null && value < 0) throw new Error("Negative Census housing/population/income observation");
    const profile = this.profiles.get(id) ?? { mappingVersion: CENSUS_MAPPING_VERSION, dwellingMix: {}, constructionPeriods: {}, sourceFlags: {} };
    (profile.sourceFlags as Row)[field] = r.flag || null;
    if (censusScalars[field]) profile[censusScalars[field]] = value;
    else if (censusTypes[field]) (profile.dwellingMix as Row)[censusTypes[field]] = value;
    else if (censusPeriods[field]) (profile.constructionPeriods as Row)[censusPeriods[field]] = value;
    else if (field === "41") profile.dwellingsByTypeTotal = value;
    else if (field === "1426") profile.constructionPeriodsTotal = value;
    this.profiles.set(id, profile); this.observations++;
  }
  finish(minimum = 50_000) {
    if (this.profiles.size < minimum) throw new Error("Incomplete nationwide Census candidate");
    for (const seen of this.seen.values()) if (seen.size !== this.profiles.size) throw new Error("Incomplete Census characteristic extract");
    for (const profile of this.profiles.values()) if (!censusProfileConsistent(profile)) throw new Error("Census candidate failed semantic consistency checks");
    return [...this.profiles].sort(([a], [b]) => a.localeCompare(b)).map(([dauid, profile]) => ({ dauid, census_year: 2021, profile }));
  }
}
