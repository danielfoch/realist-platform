import "./testEnv";
import { describe, expect, it } from "vitest";
import { authoritiesForPoint, CONSERVATION_AUTHORITIES } from "./conservation";

describe("conservation extent routing", () => {
  it("routes a downtown Toronto point to TRCA", () => {
    const auths = authoritiesForPoint(43.66, -79.38).map((a) => a.code);
    expect(auths).toContain("TRCA");
  });
  it("returns none for a point far outside registered extents (e.g. Ottawa)", () => {
    expect(authoritiesForPoint(45.42, -75.7)).toHaveLength(0);
  });
  it("returns none west of TRCA's extent (Milton) until a real CVC/CH endpoint is verified", () => {
    // The CVC candidate service failed live verification (26 features, no hit
    // in the Credit floodplain) and was removed — false-clear is worse than
    // out_of_coverage for a kill-flag. See registry comment in conservation.ts.
    expect(authoritiesForPoint(43.6, -79.9)).toHaveLength(0);
  });
  it("every registry entry is live-verified — this layer must never ship guessed endpoints", () => {
    for (const auth of CONSERVATION_AUTHORITIES) {
      expect(auth.verified).toBe(true);
    }
  });
});
