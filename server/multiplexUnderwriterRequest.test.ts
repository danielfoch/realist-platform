import { describe, expect, it } from "vitest";
import { underwriteRequestSchema } from "./multiplexUnderwriter";

describe("multiplex underwriter request contract", () => {
  it("accepts DDF lot context and explicit Toronto planning inputs", () => {
    const parsed = underwriteRequestSchema.safeParse({
      address: "123 Logan Ave, Toronto, ON",
      listingId: "C123456",
      lotAreaSqft: 3_000,
      purchasePrice: 1_399_000,
      transitAreaStatus: "pmtsa",
      transitStationDistanceM: 425,
      majorStreet: true,
      cornerLot: false,
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invented transit classifications", () => {
    const parsed = underwriteRequestSchema.safeParse({
      address: "123 Logan Ave, Toronto, ON",
      lotFrontageFt: 30,
      lotDepthFt: 120,
      transitAreaStatus: "probably-close-enough",
    });

    expect(parsed.success).toBe(false);
  });
});
