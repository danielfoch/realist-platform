import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import { haltonHillsCoverage, haltonHillsLayers } from "../lib/property/halton-hills";
import type { Row } from "../lib/property/model";

async function main() {
  const coverage = await haltonHillsCoverage();
  assert.deepEqual(coverage.datasets.map(d => [d.layer, d.status, d.records]), [["heritage", "verified", 687], ["planningApplications", "verified", 118]]);
  assert.equal(coverage.withheldDatasets.length, 4);
  const controls = [
    { address: "11820 10 Side Road", city: "Esquesing", key: "heritage", status: "available", ids: ["2592"] },
    { address: "16469 10 Side Road", city: "Esquesing", key: "heritage", status: "available", ids: ["21351", "21352"] },
    { address: "12428 Kirkpatrick Lane", city: "Halton Hills", key: "heritage", status: "ambiguous", ids: ["2150"] },
    { address: "69 Bower Street", city: "Acton", key: "heritage", status: "ambiguous", ids: ["2926"] },
    { address: "125 McDonald Blvd", city: "Acton", key: "planningApplications", status: "available", ids: ["7", "32925"] },
    { address: "99 River Drive", city: "Georgetown", key: "planningApplications", status: "available", ids: ["37", "1242"] },
    { address: "11820 10 Side Road", city: "Georgetown", key: "heritage", status: "ambiguous", ids: ["2592"] },
    { address: "99999 Nonexistent Street", city: "Acton", key: "planningApplications", status: "no_match", ids: [] },
    { address: "16 Mill Street", city: "Georgetown", key: "planningApplications", status: "no_match", ids: [] },
  ];
  const results = [];
  for (const control of controls) {
    const layers = await haltonHillsLayers(control.address, control.city, "ON");
    const entry = layers[control.key], data = entry.data as Row;
    assert.equal(entry.status, control.status, JSON.stringify({ control, entry }));
    assert.deepEqual((data.records as Row[]).map(r => r.recordId), control.ids);
    assert.equal(data.coverageComplete, false); assert.equal(data.absenceEstablished, false); assert.equal(entry.sourceUpdatedAt, null);
    results.push({ control, layers });
  }
  if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify({ checkedAt: new Date().toISOString(), coverage, results }, null, 2));
  console.log(JSON.stringify({ passed: controls.length, verifiedFeeds: 2, publishedHeritageObservations: 687, publishedDevelopmentObservations: 118, withheldGISFeeds: 4, majorMarketsComplete: false }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
