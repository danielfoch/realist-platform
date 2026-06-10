import { describe, expect, it } from "vitest";
import { detectPossiblePlex } from "./plexDetection";

describe("plex detection", () => {
  it("uses kitchen count when explicit plex tags are missing", () => {
    const result = detectPossiblePlex({
      propertyType: "Detached",
      description: "Large house with 3 kitchens, separate entrance, and flexible upper lower layout.",
    });

    expect(result.kitchen_count).toBe(3);
    expect(result.estimated_unit_count).toBe(3);
    expect(result.plex_confidence_score).toBeGreaterThanOrEqual(30);
    expect(result.needs_manual_review).toBe(true);
  });

  it("detects secondary kitchen language as a possible two-unit signal", () => {
    const result = detectPossiblePlex({
      propertyType: "Single family",
      remarks: "Finished basement with second kitchen and side entrance.",
    });

    expect(result.estimated_unit_count).toBe(2);
    expect(result.plex_detection_reason).toContain("second kitchen");
  });
});
