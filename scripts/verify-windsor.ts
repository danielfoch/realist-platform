import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import type { Row } from "../lib/property/model";
// Polygon controls are synthetic interiors of licensed non-cadastral features.
const controls: Row[] = [
  { address: "1899 Niagara Street, Windsor, ON", positive: "heritage", also: ["municipalAddresses", "zoningExceptions", "heritageAreas", "planningDistrict", "ward"] },
  { address: "3277 Sandwich Street, Windsor, ON", positive: "heritage", addressOnly: true },
  { address: "8310 Enfield Place, Windsor, ON", positive: "municipalAddresses", empty: ["heritage", "zoningExceptions", "heritageAreas", "businessImprovement", "archaeologicalReference"] },
  { city: "Windsor", province: "ON", lat: 42.30727415658305, lng: -83.01889219679491, positive: "businessImprovement", sourceControlRecordId: 1, controlMeaning: "synthetic interior of inspected non-cadastral polygon; not a surveyed property" },
  { city: "Windsor", province: "ON", lat: 42.256821897510974, lng: -83.10692961882144, positive: "archaeologicalReference", sourceControlRecordId: 1, controlMeaning: "synthetic interior of inspected non-cadastral polygon; not a surveyed property" },
];
async function main() {
  const base = process.argv[2] ?? "https://realist-lean.vercel.app", results = [];
  // Coverage includes Guelph; keep every request in this verifier sequential.
  for (const control of controls) {
    const u = new URL("/api/property", base);
    Object.entries(control).filter(([k]) => ["address", "city", "province", "lat", "lng"].includes(k)).forEach(([k, v]) => u.searchParams.set(k, String(v)));
    const response = await fetch(u, { signal: AbortSignal.timeout(65000) }); assert.equal(response.status, 200); assert.equal(response.headers.get("access-control-allow-origin"), "*");
    const result = await response.json() as Row; assert.equal(result.success, true);
    const layers = result.layers as Record<string, { status: string; data: Row | null }>;
    assert.equal(layers[String(control.positive)].status, "available", JSON.stringify({ control, result }));
    for (const key of (control.also ?? []) as string[]) assert.equal(layers[key].status, "available");
    for (const key of (control.empty ?? []) as string[]) assert.equal(layers[key].status, "no_match");
    if (control.addressOnly) {
      assert.equal(layers.municipality.status, "skipped"); assert.equal(layers.zoningExceptions.status, "skipped"); assert.equal(layers.heritage.data?.screenedPoint, null); assert.equal(layers.heritage.data?.spatialScreenPerformed, false);
    } else assert.equal(layers.municipality.status, "available");
    if (!control.address) { assert.equal(layers.municipalAddresses.status, "skipped"); assert.equal(layers.heritage.status, "skipped"); }
    for (const key of ["permits", "zoning", "officialPlan", "planningApplications", "variance", "conservation", "parcel", "buildingFootprints"]) assert.equal(layers[key].status, "unavailable");
    results.push({ control, result }); console.log(JSON.stringify({ control, status: "passed" }));
  }
  const response = await fetch(new URL("/api/property/coverage", base), { signal: AbortSignal.timeout(65000) }); assert.equal(response.status, 200);
  const coverage = await response.json() as Row, w = (coverage.live as Row[]).find(x => (x.cities as string[] | undefined)?.length === 1 && (x.cities as string[])[0] === "Windsor")!;
  assert.equal((w.datasets as Row[]).length, 9); assert.equal((w.datasets as Row[]).filter(x => x.status === "verified").length, 9); assert.equal((w.withheld as Row[]).length, 10); assert.equal(w.complete, false);
  if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify({ verifiedAt: new Date().toISOString(), results, coverage }, null, 2));
  console.log(JSON.stringify({ passed: results.length, verifiedFeeds: 9, publishedRows: (w.datasets as Row[]).reduce((n, d) => n + Number(d.records ?? 0), 0), marketComplete: false }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
