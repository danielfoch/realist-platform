import { describe, expect, it } from "vitest";
import {
  MULTIPLEX_CONCEPT_LIBRARY,
  selectMultiplexConceptSample,
} from "./multiplexConceptLibrary";

describe("multiplex concept sample library", () => {
  it("contains one packaged board for every frontage/depth/access combination", () => {
    expect(MULTIPLEX_CONCEPT_LIBRARY).toHaveLength(24);
    expect(new Set(MULTIPLEX_CONCEPT_LIBRARY.map((sample) => sample.id)).size).toBe(24);
    expect(new Set(MULTIPLEX_CONCEPT_LIBRARY.map((sample) => sample.imagePath)).size).toBe(24);
  });

  it("matches the submitted configuration bands without using live generation", () => {
    const sample = selectMultiplexConceptSample({
      widthBand: "30_ft",
      depthBand: "standard",
      laneAccess: true,
    });

    expect(sample.id).toBe("30ft-standard-lane");
    expect(sample.similarLotLabel).toBe("30 × 115 ft with a rear lane");
    expect(sample.representativeRearSuite).toBe("two-storey laneway suite");
  });

  it("maps extra-deep lots to the deep sample rather than inventing a 25th asset", () => {
    const sample = selectMultiplexConceptSample({
      widthBand: "50_ft",
      depthBand: "extra_deep",
      laneAccess: false,
    });

    expect(sample.id).toBe("50ft-deep-no-lane");
  });
});
