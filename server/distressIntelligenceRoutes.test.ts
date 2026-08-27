import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./distressIntelligence.ts", import.meta.url), "utf8");
const generator = readFileSync(new URL("./distressReportGenerator.ts", import.meta.url), "utf8");

describe("distress intelligence persistence contract", () => {
  it("publishes aggregate cohort intelligence without exposing remarks", () => {
    expect(source).toContain('app.get("/api/distress-market-intelligence"');
    expect(source).toContain("summarizeDistressCohort");
    expect(source).toContain("categoriesOverlap: true");
    expect(source).not.toContain("rawRemarks");
  });

  it("replaces only the current province capture while retaining prior months", () => {
    expect(generator).toContain("tx.delete(distressListingObservations)");
    expect(generator).toContain("eq(distressListingObservations.snapshotMonth, month)");
    expect(generator).toContain("older monthly");
  });

  it("fails a province capture when every upstream query failed", () => {
    expect(generator).toContain("queriesSucceeded === 0");
    expect(generator).toContain("All ${uniqueTerms.length} DDF search queries failed");
  });
});
