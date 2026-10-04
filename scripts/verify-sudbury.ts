import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import type { Row } from "../lib/property/model";

async function main() {
  const base = process.argv[2] ?? "https://realist-lean.vercel.app", results = [];
  // Coverage includes Guelph: keep the entire verifier/source session sequential.
  for (const address of ["47 Maki Ave, Sudbury, ON", "993 Delwood Court, Sudbury, ON", "200 Brady St, Sudbury, ON", "200 Mumford Drive, Lively, ON", "2777 Main Street, Blezard Valley, ON"]) {
    const u = new URL("/api/property", base); u.searchParams.set("address", address);
    const response = await fetch(u, { signal: AbortSignal.timeout(65000) }); assert.equal(response.status, 200); assert.equal(response.headers.get("access-control-allow-origin"), "*");
    const result = await response.json() as Row; assert.equal(result.success, true);
    const layers = result.layers as Record<string, { status: string; data: Row | null }>;
    if (address.startsWith("200 ")) {
      assert.equal(layers.location.status, "ambiguous"); assert.equal(layers.municipalAddresses.status, "ambiguous");
      for (const k of ["municipality", "permits", "zoning", "temporaryZoning", "buildingFootprintReference", "parcelReference"]) assert.equal(layers[k].status, "skipped");
    } else {
      assert.equal(layers.location.data?.accuracy, "source_civic_address_point"); assert.equal(layers.municipality.status, "available");
      for (const k of ["zoning", "buildingFootprintReference", "community", "townshipReference", "parcelReference"]) assert.equal(layers[k].status, "available");
      assert.equal(layers.permits.status, address.startsWith("2777 ") ? "no_match" : "available");
      assert.equal(layers.zoning.data?.currentOfficialMapLineageVerified, true); assert.equal(layers.zoning.data?.legalPermissionsEstablished, false);
      assert.equal(layers.permits.data?.estimatedValueCurrencyVerified, false); assert.equal(layers.permits.data?.occupancyEstablished, false);
      assert.equal(layers.parcelReference.data?.parcelIdentityVerified, false); assert.equal(layers.buildingFootprintReference.data?.measuredBuildingAreaReturned, false);
    }
    for (const k of ["currentPlanningInstruments", "planningApplications", "heritage", "floodplainOverlay", "sudburyConservationRegulation"]) assert.equal(layers[k].data?.recordsQueried, false);
    results.push({ address, result }); console.log(JSON.stringify({ address, status: "passed" }));
  }
  const u = new URL("/api/property", base); u.search = new URLSearchParams({ city: "Greater Sudbury", province: "ON", lat: "46.455158382627694", lng: "-80.99908722149631" }).toString();
  const control = await (await fetch(u, { signal: AbortSignal.timeout(65000) })).json() as Row;
  const coordinateLayers = control.layers as Record<string, { status: string; data: Row }>;
  assert.equal(coordinateLayers.permits.status, "skipped"); assert.equal(coordinateLayers.zoning.status, "available"); assert.equal(coordinateLayers.location.data.accuracy, "caller_supplied");
  const response = await fetch(new URL("/api/property/coverage", base), { signal: AbortSignal.timeout(65000) }); assert.equal(response.status, 200);
  const coverage = await response.json() as Row;
  const s = (coverage.live as Row[]).find(x => (x.cities as string[] | undefined)?.[0] === "Greater Sudbury")!;
  assert.equal((s.datasets as Row[]).length, 8); assert.equal((s.withheld as Row[]).length, 12); assert.equal(s.complete, false); assert.equal((s.municipalityReference as Row).countIncludedHere, false);
  assert.equal((s.datasets as Row[]).every(d => d.status === "verified" && typeof d.records === "number"), true);
  if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify({ verifiedAt: new Date().toISOString(), results, coordinateControl: control, coverage }, null, 2));
  console.log(JSON.stringify({ passed: results.length + 1, configuredLicensedFeeds: 8, verifiedSourceRows: (s.datasets as Row[]).reduce((n, d) => n + Number(d.records ?? 0), 0), marketComplete: false }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
