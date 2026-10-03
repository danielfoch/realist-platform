import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { ottawaPermits, ottawaPermitCoverage } from "../lib/property/ottawa-permits";
import type { Row } from "../lib/property/model";

async function main() {
  const output = resolve(process.argv[2] ?? "outputs/ottawa-permit-verification"); await mkdir(output, { recursive: true });
  const controls = [
    { name: "kanata", address: "50 Laxford Dr", city: "Kanata", permit: "CON-2024-009110", issued: "2025-01-02", unit: "square_metres" },
    { name: "cancelled", address: "99 Fourth Ave", city: "Ottawa", permit: "REV-A03-004231", issued: "2003-07-29", unit: "square_metres" },
    { name: "legacy", address: "35 Murray St", city: "Ottawa", permit: "2400005", issued: "2024-01-02", unit: "square_feet" },
  ];
  for (const c of controls) {
    const result = await ottawaPermits(c.address, c.city, null); assert.equal(result.status, "available");
    const records = (result.data as { records: Row[] }).records; const r = records.find(r => r.permitNumber === c.permit); assert(r);
    assert.equal(r.publishedIssuedDate, c.issued); assert.equal(r.publishedWorkAreaUnit, c.unit);
    if (c.name === "cancelled") { assert.match(String(r.description), /Cancelled/); assert.equal(r.reportingPeriodStart, "2026-07-01"); }
    assert.equal((result.data as Row).coverageComplete, false); assert.equal((result.data as Row).currentPermitStatusVerified, false);
    await writeFile(resolve(output, c.name + ".json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ control: c.name, permit: c.permit, issued: r.publishedIssuedDate, reportingMonth: r.reportingPeriodStart, areaUnit: r.publishedWorkAreaUnit }));
  }
  const coverage = await ottawaPermitCoverage(); assert.equal(coverage.status, "loaded"); assert(coverage.records && coverage.records >= 23_794); assert(coverage.reportingPeriods.length >= 32);
  await writeFile(resolve(output, "coverage.json"), JSON.stringify(coverage, null, 2));
  console.log(JSON.stringify({ observations: coverage.records, reportingMonths: coverage.reportingPeriods.length, delivery: coverage.delivery }));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
