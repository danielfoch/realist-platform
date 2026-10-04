import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import type { Row } from "../lib/property/model";
const controls: Row[] = [
  { address: "2 Leinster Rd, Brampton, ON", positive: "permitActivities", also: ["permits", "variance", "municipalAddresses", "officialPlanReference", "ward"] },
  { address: "1358 Queen St W, Brampton, ON", positive: "planningApplications", also: ["sitePlanApplications", "preConsultation", "variance"] },
  { address: "41 Elliott St, Brampton, ON", positive: "heritageDetails" },
  { address: "176 Sussexvale Dr, Brampton, ON", positive: "consentToSever", also: ["draftCondominiumApplications", "variance", "planningApplications"] },
  { city: "Brampton", province: "ON", lat: 43.69134881485834, lng: -79.76709041637625, positive: "developmentPermitApplications", controlMeaning: "synthetic interior of licensed non-cadastral City application polygons; not a surveyed property or permission" },
  { city: "Brampton", province: "ON", lat: 43.684441635082656, lng: -79.76974030782138, positive: "majorTransitStationArea", controlMeaning: "synthetic interior of licensed non-cadastral City MTSA reference; not a surveyed property or permission" },
];
async function main() {
  const base = process.argv[2] ?? "https://realist-lean.vercel.app", results = [];
  // Coverage contains Guelph: keep the whole verifier strictly sequential.
  for (const control of controls) {
    const u = new URL("/api/property", base); Object.entries(control).filter(([k]) => ["address", "city", "province", "lat", "lng"].includes(k)).forEach(([k, v]) => u.searchParams.set(k, String(v)));
    const response = await fetch(u, { signal: AbortSignal.timeout(65000) }); assert.equal(response.status, 200); assert.equal(response.headers.get("access-control-allow-origin"), "*");
    const result = await response.json() as Row; assert.equal(result.success, true); const layers = result.layers as Record<string, { status: string; data: Row | null }>;
    assert.equal(layers[String(control.positive)].status, "available", JSON.stringify({ control, result })); for (const key of (control.also ?? []) as string[]) assert.equal(layers[key].status, "available");
    assert.equal(layers.municipality.status, "available");
    if (!control.address) for (const key of ["municipalAddresses", "permits", "permitActivities"]) assert.equal(layers[key].status, "skipped");
    if (control.positive === "permitActivities") { assert.equal(layers.permitActivities.data?.finalInspectionVerified, false); assert.equal(layers.permitActivities.data?.occupancyVerified, false); assert.equal(layers.permitActivities.data?.latestActivitySelectedAsCurrentStatus, false); }
    for (const key of ["zoning", "currentPlanningInstruments", "rentalLicences", "parcel", "buildingFootprints", "bramptonConservationRegulation", "airportConstraints", "completePermitHistory"]) assert.equal(layers[key].status, "unavailable");
    results.push({ control, result }); console.log(JSON.stringify({ control, status: "passed" }));
  }
  const response = await fetch(new URL("/api/property/coverage", base), { signal: AbortSignal.timeout(65000) }); assert.equal(response.status, 200);
  const coverage = await response.json() as Row, b = (coverage.live as Row[]).find(x => (x.cities as string[] | undefined)?.length === 1 && (x.cities as string[])[0] === "Brampton")!;
  assert.equal((b.datasets as Row[]).length, 15); assert.equal((b.withheld as Row[]).length, 8); assert.equal(b.complete, false);
  const p = (coverage.live as Row[]).find(x => (x.cities as string[] | undefined)?.[0] === "Peterborough")!; assert.equal((p.datasets as Row[]).length, 0); assert.equal((p.withheld as Row[]).length, 16);
  if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify({ verifiedAt: new Date().toISOString(), results, coverage }, null, 2));
  console.log(JSON.stringify({ passed: results.length, configuredLicensedFeeds: 15, verifiedFeedCounts: (b.datasets as Row[]).filter(x => x.status === "verified").length, verifiedSourceRows: (b.datasets as Row[]).reduce((n, d) => n + Number(d.records ?? 0), 0), marketComplete: false }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
