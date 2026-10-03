import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import type { Row } from "../lib/property/model";
const controls: Row[] = [
  { address: "1 Blackbird Lane, Barrie, ON", positive: "additionalUnits", also: ["municipalAddresses", "zoning", "officialPlanReference", "nearbyPermitApplications", "ward", "futureWard2026"] },
  { address: "351 Bayfield Street, Barrie, ON", positive: "permits", addressOnly: true },
  { address: "204 Alva Street, Barrie, ON", positive: "municipalAddresses", also: ["zoning", "officialPlanReference"] },
  { address: "70 Collier Street, Barrie, ON", positive: "permits", addressOnly: true, blockface: true },
  { city: "Barrie", province: "ON", lat: 44.352186571994814, lng: -79.62529049163746, positive: "planningApplications", also: ["zoning", "sitePlanControl", "officialPlanReference"], sourceControlRecordId: 1, controlMeaning: "synthetic interior of licensed non-cadastral application polygon; not a surveyed property" },
  { city: "Barrie", province: "ON", lat: 44.36960034519456, lng: -79.69619276915981, positive: "majorTransitStationArea", also: ["historicNeighbourhood"], sourceControlRecordId: 1, controlMeaning: "synthetic interior of licensed non-cadastral MTSA reference; not a surveyed property or verified CPP district" },
  { city: "Barrie", province: "ON", lat: 44.34300167941555, lng: -79.60819647479057, positive: "specialPolicyArea", sourceControlRecordId: 1, controlMeaning: "synthetic interior of licensed non-cadastral policy reference; not a surveyed property" },
  { city: "Barrie", province: "ON", lat: 44.39029558870019, lng: -79.6857004673213, positive: "culturalHeritage", also: ["urbanGrowthCentre"], sourceControlRecordId: 1, controlMeaning: "published cultural-feature source-point control; not a surveyed property" },
];
async function main() {
  const base = process.argv[2] ?? "https://realist-lean.vercel.app", results = [];
  // Coverage includes Guelph; keep this entire verifier strictly sequential.
  for (const control of controls) {
    const u = new URL("/api/property", base); Object.entries(control).filter(([k]) => ["address", "city", "province", "lat", "lng"].includes(k)).forEach(([k, v]) => u.searchParams.set(k, String(v)));
    const response = await fetch(u, { signal: AbortSignal.timeout(65000) }); assert.equal(response.status, 200); assert.equal(response.headers.get("access-control-allow-origin"), "*");
    const result = await response.json() as Row; assert.equal(result.success, true); const layers = result.layers as Record<string, { status: string; data: Row | null }>;
    assert.equal(layers[String(control.positive)].status, "available", JSON.stringify({ control, result })); for (const key of (control.also ?? []) as string[]) assert.equal(layers[key].status, "available");
    if (control.addressOnly) { assert.equal(layers.municipality.status, "skipped"); assert.equal(layers.zoning.status, "skipped"); assert.equal(layers.permits.data?.screenedPoint, null); assert.equal(layers.permits.data?.spatialScreenPerformed, false); }
    else assert.equal(layers.municipality.status, "available");
    if (!control.address) { assert.equal(layers.municipalAddresses.status, "skipped"); assert.equal(layers.permits.status, "skipped"); assert.equal(layers.additionalUnits.status, "skipped"); }
    if (control.positive === "culturalHeritage") { assert.equal(layers.culturalHeritage.data?.fullHeritageScreenPerformed, false); assert.equal(layers.culturalHeritage.data?.subjectBuildingConstructionYearEstablished, false); }
    for (const key of ["currentMunicipalBoundary", "communityPlanningPermit", "completePermitHistory", "sitePlans", "heritage", "variance", "parcel", "buildingFootprints", "barrieConservationRegulation", "currentPlanningInstruments"]) assert.equal(layers[key].status, "unavailable");
    results.push({ control, result }); console.log(JSON.stringify({ control, status: "passed" }));
  }
  const response = await fetch(new URL("/api/property/coverage", base), { signal: AbortSignal.timeout(65000) }); assert.equal(response.status, 200);
  const coverage = await response.json() as Row, b = (coverage.live as Row[]).find(x => (x.cities as string[] | undefined)?.length === 1 && (x.cities as string[])[0] === "Barrie")!;
  assert.equal((b.datasets as Row[]).length, 18); assert.equal((b.datasets as Row[]).filter(x => x.status === "verified").length, 18); assert.equal((b.withheld as Row[]).length, 12); assert.equal(b.complete, false);
  if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify({ verifiedAt: new Date().toISOString(), results, coverage }, null, 2));
  console.log(JSON.stringify({ passed: results.length, verifiedFeeds: 18, sourceRows: (b.datasets as Row[]).reduce((n, d) => n + Number(d.records ?? 0), 0), marketComplete: false }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
