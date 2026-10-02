import { loadSnapshot, type LoadedSnapshot as Snapshot, type Dataset } from "./snapshots";
import { cityKey, civicStreetKey, layer, number, publishedYear, sameStreet, text, type Layer, type Row, type Source } from "./model";
import { provinceKey } from "./geocode";

export const RICH_SOURCES: Record<string, Source> = {
  rentalBuilding: { id: "toronto:rental-buildings", name: "Toronto apartment-building registration", url: "https://open.toronto.ca/dataset/apartment-building-registration/", licence: "Open Government Licence – Toronto", attribution: "Contains information licensed under the Open Government Licence – Toronto. Source: City of Toronto." },
  buildingEvaluations: { id: "toronto:building-evaluations", name: "Toronto RentSafeTO building evaluations, 2023 onward", url: "https://open.toronto.ca/dataset/apartment-building-evaluation/", licence: "Open Government Licence – Toronto", attribution: "Contains information licensed under the Open Government Licence – Toronto. Source: City of Toronto." },
  additionalUnits: { id: "brampton:additional-units", name: "Brampton registered additional residential units", url: "https://geohub.brampton.ca/datasets/brampton::registered-additional-residential-units", licence: "CC BY 4.0", attribution: "City of Brampton, Registered Additional Residential Units, CC BY 4.0. Address normalization and field selection by Realist/Homies. https://creativecommons.org/licenses/by/4.0/" },
  heritage: { id: "brampton:heritage", name: "Brampton heritage properties", url: "https://geohub.brampton.ca/datasets/brampton::heritage-properties", licence: "CC BY 4.0", attribution: "City of Brampton, Heritage Properties, CC BY 4.0. Address normalization and field selection by Realist/Homies. https://creativecommons.org/licenses/by/4.0/" },
};
const FEEDS: Record<string, { city: string; field: string; filename: string; note: string }> = {
  rentalBuilding: { city: "toronto", field: "SITE_ADDRESS", filename: "toronto-rental-buildings.json", note: "Building-level characteristics reported by owners/managers to RentSafeTO and renewed annually. They are not unit-specific or independently measured facts." },
  buildingEvaluations: { city: "toronto", field: "SITE ADDRESS", filename: "toronto-building-evaluations.json", note: "Dated RentSafeTO evaluations from 2023 onward concern building/common areas. Keep the evaluation date and scoring regime; not a unit inspection or a guarantee of present condition. A blank item is not applicable or unpublished; 0 is preserved as published and can mean not evaluated." },
  additionalUnits: { city: "brampton", field: "FULL_ADDRESS", filename: "brampton-additional-units.json", note: "Published second-unit, third-unit and garden-suite registration dates are distinct. Registration does not establish present compliance, occupancy approval or permission for a new project. A missing match does not mean an unregistered or illegal unit." },
  heritage: { city: "brampton", field: "ADDRESS", filename: "brampton-heritage.json", note: "Published heritage status at this civic address; confirm current register, bylaws and applicable alteration requirements with the City. Listed and designated statuses remain distinct." },
};
// Keep large public datasets as traced server assets rather than JavaScript modules.
function loadSnapshots() {
  return Promise.all(Object.entries(FEEDS).map(async ([name, feed]) => [name, await loadSnapshot(feed.filename.replace(".json", "") as Dataset)] as const)).then(entries => Object.fromEntries(entries));
}
const indexes = new Map<string, { vintage: string; index: Map<string, Row[]> }>();
function matchesFor(name: string, snapshot: Snapshot, address: string): Row[] {
  const feed = FEEDS[name];
  let index = indexes.get(name)?.vintage === snapshot.retrievedAt ? indexes.get(name)!.index : undefined;
  if (!index) {
    index = new Map();
    for (const record of snapshot.records) {
      const value = text(record[feed.field]);
      if (!value) continue;
      const key = civicStreetKey(value);
      index.set(key, [...(index.get(key) ?? []), record]);
    }
    indexes.set(name, { vintage: snapshot.retrievedAt, index });
  }
  return (index.get(civicStreetKey(address)) ?? []).filter(r => sameStreet(address, String(r[feed.field])));
}
function snapshotResult(name: string, snapshot: Snapshot | null, status: Layer["status"], data: unknown = null, extra = ""): Layer {
  const feed = FEEDS[name];
  if (!snapshot) return layer(status, data, RICH_SOURCES[name], `${feed.note} Source snapshot unavailable.`);
  const age = Date.now() - new Date(snapshot.retrievedAt).getTime();
  const value = layer(status, data, RICH_SOURCES[name], `${feed.note} Snapshot retrieved ${snapshot.retrievedAt.slice(0, 10)}; ${snapshot.delivery === "automatic_database_snapshot" ? "automatic daily refresh with last-good retention" : "compiled fallback; see coverage for automatic refresh health"}.${age > 31 * 86_400_000 ? " Snapshot is over 31 days old; verify current source records." : ""}${extra ? " " + extra : ""}`, snapshot.sourceUpdatedAt);
  // A lookup time is not a source retrieval time. The compiled snapshot has its own vintage.
  value.retrievedAt = snapshot.retrievedAt;
  return value;
}
const clean = (value: unknown): string | null => {
  const v = text(value);
  return v && !/^(n\/a|na|none|not available|-+)$/i.test(v) ? v.slice(0, 500) : null;
};
export async function richAddressLayers(address: string | null, city: string | null, province: string | null): Promise<Record<string, Layer>> {
  const snapshots = await loadSnapshots();
  const output: Record<string, Layer> = {};
  for (const [name, feed] of Object.entries(FEEDS)) {
    const snapshot = snapshots[name];
    const result = (status: Layer["status"], data: unknown = null, extra = "") => snapshotResult(name, snapshot, status, data, extra);
    if (cityKey(city ?? "") !== feed.city || provinceKey(province ?? "") !== "ontario") {
      output[name] = result("not_supported"); continue;
    }
    if (!address) { output[name] = result("skipped"); continue; }
    if (!snapshot) { output[name] = result("unavailable"); continue; }
    const matches = matchesFor(name, snapshot, address);
    if (!matches.length) { output[name] = result("no_match", null, "No published exact civic-address match was found in the selected snapshot."); continue; }
    const buildingIds = new Set(matches.map(r => String(r.RSN)));
    if (["rentalBuilding", "buildingEvaluations"].includes(name) && buildingIds.size > 1) {
      output[name] = result("ambiguous", null, "Multiple building IDs match this address; no building was guessed."); continue;
    }
    let data: unknown;
    if (name === "rentalBuilding") {
      if (matches.length !== 1) { output[name] = result("ambiguous"); continue; }
      const r = matches[0];
      data = { buildingId: String(r.RSN), address: text(r.SITE_ADDRESS), matchMethod: "exact_normalized_civic_address", scope: "building", reportingBasis: "owner_manager_registration", yearBuilt: publishedYear(r.YEAR_BUILT), yearRegistered: publishedYear(r.YEAR_REGISTERED), storeys: number(r.CONFIRMED_STOREYS) ?? number(r.NO_OF_STOREYS), dwellingUnits: number(r.CONFIRMED_UNITS) ?? number(r.NO_OF_UNITS), heatingType: clean(r.HEATING_TYPE), airConditioningType: clean(r.AIR_CONDITIONING_TYPE), elevators: number(r.NO_OF_ELEVATORS), elevatorStatus: clean(r.ELEVATOR_STATUS), parkingType: clean(r.PARKING_TYPE), visitorParking: clean(r.VISITOR_PARKING), barrierFreeEntrance: clean(r.BARRIER_FREE_ACCESSIBILTY_ENTR), barrierFreeUnits: number(r.NO_BARRIER_FREE_ACCESSBLE_UNITS), balconies: clean(r.BALCONIES), laundryRoom: clean(r.LAUNDRY_ROOM), nonSmokingBuilding: clean(r.NON_SMOKING_BUILDING) ?? clean(r["NON-SMOKING_BUILDING"]), separateHydroMeters: clean(r.SEPARATE_HYDRO_METER_EACH_UNIT), separateGasMeters: clean(r.SEPARATE_GAS_METERS_EACH_UNIT), separateWaterMeters: clean(r.SEPARATE_WATER_METERS_EA_UNIT), amenities: clean(r.AMENITIES_AVAILABLE), facilities: clean(r.FACILITIES_AVAILABLE), petsAllowed: clean(r.PETS_ALLOWED), petRestrictions: clean(r.PET_RESTRICTIONS) };
    } else if (name === "buildingEvaluations") {
      const history = [...matches].sort((a, b) => String(b["EVALUATION COMPLETED ON"] ?? "").localeCompare(String(a["EVALUATION COMPLETED ON"] ?? ""))).map(r => ({ recordId: String(r._id), buildingId: String(r.RSN), address: text(r["SITE ADDRESS"]), evaluatedOn: clean(r["EVALUATION COMPLETED ON"]), evaluationYear: publishedYear(r["YEAR EVALUATED"]), reportedYearBuilt: publishedYear(r["YEAR BUILT"]), scoringRegime: "RentSafeTO 2023 onward", currentBuildingEvaluationScore: number(r["CURRENT BUILDING EVAL SCORE"]), proactiveBuildingScore: number(r["PROACTIVE BUILDING SCORE"]), currentReactiveScore: number(r["CURRENT REACTIVE SCORE"]), areasEvaluated: number(r["NO OF AREAS EVALUATED"]), categoryScores: { commonAreaPests: number(r["COMMON AREA PESTS"]), buildingCleanliness: number(r["BUILDING CLEANLINESS"]), elevatorMaintenance: number(r["ELEVATOR MAINTENANCE"]), exteriorGrounds: number(r["EXTERIOR GROUNDS"]), buildingExterior: number(r["BUILDING EXTERIOR"]), stateOfGoodRepairPlan: number(r["STATE OF GOOD REPAIR PLAN"]) } }));
      data = { buildingId: String(matches[0].RSN), scope: "building_common_areas", matchMethod: "exact_normalized_civic_address", latestEvaluation: history[0], history: history.slice(0, 25) };
    } else if (name === "additionalUnits") {
      data = { scope: "published_registration_evidence", matchMethod: "exact_normalized_civic_address", records: matches.slice(0, 25).map(r => ({ recordId: String(r.OBJECTID), address: text(r.FULL_ADDRESS), secondUnitRegisteredDate: clean(r.SECOND_REG), thirdUnitRegisteredDate: clean(r.THIRD_REG), gardenSuiteRegisteredDate: clean(r.FOURTH_REG), ward: clean(r.WARD) })) };
    } else {
      data = { scope: "published_heritage_register", matchMethod: "exact_normalized_civic_address", records: matches.slice(0, 25).map(r => ({ recordId: String(r.OBJECTID), address: text(r.ADDRESS), propertyName: clean(r.PROPERTY_NAME), publishedStatus: clean(r.HERITAGE_STATUS) })) };
    }
    output[name] = result("available", data);
    output[name].truncated = matches.length > 25;
  }
  return output;
}
export async function richCoverage() {
  const snapshots = await loadSnapshots();
  return Object.entries(FEEDS).map(([name, feed]) => ({ layer: name, geography: `${feed.city === "toronto" ? "Toronto" : "Brampton"}, ON`, delivery: snapshots[name]?.delivery ?? "unavailable", source: RICH_SOURCES[name], status: snapshots[name] ? "loaded" : "unavailable", records: snapshots[name]?.rowCount ?? null, retrievedAt: snapshots[name]?.retrievedAt ?? null, sourceUpdatedAt: snapshots[name]?.sourceUpdatedAt ?? null, refresh: "daily scheduled refresh; last good snapshot retained on failure", note: feed.note }));
}
