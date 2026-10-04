import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import type { Row } from "../lib/property/model";

async function main() {
  const base = process.argv[2] ?? "https://realist-lean.vercel.app", results = [];
  // Coverage includes Guelph; keep this entire source session sequential.
  for (const address of ["15 Dundas St E, Trenton, ON", "15 Dundas St E, Quinte West, ON", "55 King St, Trenton, ON", "7 Creswell Dr, Trenton, ON"]) {
    const u = new URL("/api/property", base); u.searchParams.set("address", address);
    const response = await fetch(u, { signal: AbortSignal.timeout(65000) }); assert.equal(response.status, 200); assert.equal(response.headers.get("access-control-allow-origin"), "*");
    const result = await response.json() as Row; assert.equal(result.success, true);
    const layers = result.layers as Record<string, { status: string; data: Row | null }>;
    if (address.startsWith("7 ")) {
      assert.equal((layers.location.data as Row).accuracy, "blockface_representative");
      for (const k of ["municipality", "buildingFootprintReference", "parkReference", "stormwaterReference", "nearbySchools"]) assert.equal(layers[k].status, "skipped");
    } else {
      assert.equal(layers.municipality.status, "available");
      for (const k of ["parkReference", "stormwaterReference", "nearbySchools"]) { assert.equal(layers[k].status, "available"); assert.equal(layers[k].data?.scope, "nearby_reference_only"); assert.equal(layers[k].data?.subjectPropertyRecords, false); }
      assert.equal(layers.buildingFootprintReference.data?.currentFootprintVerified, false);
      assert.equal(layers.stormwaterReference.data?.floodplainScreenPerformed, false); assert.equal(layers.nearbySchools.data?.catchmentEstablished, false);
    }
    for (const k of ["permits", "zoning", "planningApplications", "heritage", "contourReference", "elevationReference"]) assert.equal(layers[k].data?.recordsQueried, false);
    results.push({ address, result }); console.log(JSON.stringify({ address, status: "passed" }));
  }
  // Synthetic interior of licensed catalogue footprint row56608, inspected Oct3,2026.
  // This coordinate is neither a geocoded address nor a surveyed real property.
  const u = new URL("/api/property", base); u.search = new URLSearchParams({ city: "Quinte West", province: "ON", lat: "44.1012862548272", lng: "-77.57845959699526" }).toString();
  const control = await (await fetch(u, { signal: AbortSignal.timeout(65000) })).json() as Row;
  const footprint = (control.layers as Record<string, { status: string; data: Row }>).buildingFootprintReference;
  assert.equal(footprint.status, "available"); assert.deepEqual(footprint.data.records, [{ recordId: 56608 }]); assert.equal(footprint.data.measuredBuildingAreaReturned, false);
  const response = await fetch(new URL("/api/property/coverage", base), { signal: AbortSignal.timeout(65000) }); assert.equal(response.status, 200);
  const coverage = await response.json() as Row;
  const q = (coverage.live as Row[]).find(x => (x.cities as string[] | undefined)?.[0] === "Quinte West")!;
  assert.equal((q.datasets as Row[]).length, 4); assert.equal((q.withheld as Row[]).length, 11); assert.equal(q.complete, false); assert.equal((q.municipalityReference as Row).countIncludedHere, false);
  const b = (coverage.live as Row[]).find(x => JSON.stringify(x.cities) === '["Belleville"]')!; assert.deepEqual(b.datasets, []); assert.equal((b.audit as Row).recordsQueried, false);
  if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify({ verifiedAt: new Date().toISOString(), results, syntheticControl: control, coverage }, null, 2));
  console.log(JSON.stringify({ passed: results.length + 1, configuredLicensedFeeds: 4, verifiedSourceRows: (q.datasets as Row[]).reduce((n, d) => n + Number(d.records ?? 0), 0), marketComplete: false }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
