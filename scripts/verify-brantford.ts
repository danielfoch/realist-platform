import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import type { Row } from "../lib/property/model";

const withheld = ["permits", "planningApplications", "zoning", "currentPlanningInstruments", "heritage", "parcel", "additionalUnits", "brantfordConservationRegulation"];
async function main() {
  const base = process.argv[2] ?? "https://realist-lean.vercel.app", results = [];
  // Coverage includes Guelph: keep this entire source session sequential.
  for (const address of ["58 Dalhousie St, Brantford, ON", "1 Wellington St, Brantford, ON", "32 Brant Ave, Brantford, ON"]) {
    const u = new URL("/api/property", base); u.searchParams.set("address", address);
    const response = await fetch(u, { signal: AbortSignal.timeout(65000) });
    assert.equal(response.status, 200); assert.equal(response.headers.get("access-control-allow-origin"), "*");
    const result = await response.json() as Row; assert.equal(result.success, true);
    const layers = result.layers as Record<string, { status: string; data: Row | null; sourceUpdatedAt: string | null }>;
    if (address.startsWith("32")) {
      assert.equal(layers.municipalAddresses.status, "no_match");
      for (const key of ["municipality", "catalogueZoningReference", "ward", "buildingFootprintReference", "waterBodyReference"]) assert.equal(layers[key].status, "skipped");
    } else {
      for (const key of ["municipality", "municipalAddresses", "catalogueZoningReference", "ward"]) assert.equal(layers[key].status, "available");
      assert.equal(layers.catalogueZoningReference.sourceUpdatedAt?.slice(0, 4), "2023");
      assert.equal(layers.catalogueZoningReference.data?.legalPermissionsEstablished, false);
      assert.equal(layers.buildingFootprintReference.status, address.startsWith("58") ? "available" : "no_match");
      if (address.startsWith("58")) assert.deepEqual(Object.keys((layers.buildingFootprintReference.data?.records as Row[])[0]), ["recordId"]);
      assert.equal(layers.waterBodyReference.status, "no_match");
    }
    for (const key of withheld) { assert.equal(layers[key].status, "unavailable"); assert.equal(layers[key].data?.recordsQueried, false); }
    results.push({ address, result }); console.log(JSON.stringify({ address, status: "passed" }));
  }
  const response = await fetch(new URL("/api/property/coverage", base), { signal: AbortSignal.timeout(65000) }); assert.equal(response.status, 200);
  const coverage = await response.json() as Row;
  const b = (coverage.live as Row[]).find(x => JSON.stringify(x.cities) === '["Brantford"]')!;
  assert.equal((b.datasets as Row[]).length, 6); assert.equal((b.withheld as Row[]).length, 8); assert.equal(b.complete, false);
  if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify({ verifiedAt: new Date().toISOString(), results, coverage }, null, 2));
  console.log(JSON.stringify({ passed: results.length, configuredLicensedFeeds: 6, verifiedFeedCounts: (b.datasets as Row[]).filter(x => x.status === "verified").length, verifiedSourceRows: (b.datasets as Row[]).reduce((n, d) => n + Number(d.records ?? 0), 0), marketComplete: false }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
