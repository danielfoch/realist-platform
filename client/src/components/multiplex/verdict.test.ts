/**
 * Tests for the underwrite verdict logic (./verdict).
 *
 * The asking-price comparison tells someone whether a site works at the listed
 * price. A wrong sign, or a confident answer built on a missing input, is worse
 * than showing nothing — so most of these pin down when it must stay silent.
 */
import { describe, expect, it } from "vitest";
import {
  compareToAsking,
  fmtCompact,
  fmtMoney,
  fmtPct,
  sixplexSubLabel,
  takeoutLabel,
  unitsLabel,
} from "./verdict";

describe("takeoutLabel", () => {
  it("names each real path", () => {
    expect(takeoutLabel("mli_hold")).toBe("Hold as rental");
    expect(takeoutLabel("condo_termination")).toBe("Build and sell");
  });

  it("labels 'neither' rather than hiding it", () => {
    // A declined recommendation is a result. Hiding the tile would let the
    // reader assume the model simply had no opinion.
    expect(takeoutLabel("neither")).toBe("Neither clears");
  });

  it("returns null for absent or unrecognised values", () => {
    expect(takeoutLabel(null)).toBeNull();
    expect(takeoutLabel("something_new")).toBeNull();
  });
});

describe("unitsLabel", () => {
  it("singularises one", () => {
    expect(unitsLabel(1)).toBe("1 unit");
  });

  it("pluralises everything else", () => {
    expect(unitsLabel(0)).toBe("0 units");
    expect(unitsLabel(6)).toBe("6 units");
  });
});

describe("sixplexSubLabel", () => {
  it("separates a confirmed ward from an inferred one", () => {
    expect(sixplexSubLabel(true, "verified")).toBe("Sixplex ward — confirmed");
    expect(sixplexSubLabel(true, "inferred")).toBe("Sixplex ward — likely");
  });

  it("falls back to the variance caveat when not eligible", () => {
    expect(sixplexSubLabel(false, "verified")).toBe("Before any variance");
  });
});

describe("fmtCompact", () => {
  it("uses two decimals under ten million", () => {
    expect(fmtCompact(1_450_000)).toBe("$1.45M");
  });

  it("drops to one decimal at ten million and above", () => {
    expect(fmtCompact(12_300_000)).toBe("$12.3M");
  });

  it("uses thousands below a million", () => {
    expect(fmtCompact(850_000)).toBe("$850k");
  });

  it("falls back to full money for small amounts", () => {
    expect(fmtCompact(750)).toBe("$750");
  });
});

describe("fmtMoney / fmtPct", () => {
  it("rounds money to whole dollars", () => {
    expect(fmtMoney(1_234_567.89)).toBe("$1,234,568");
  });

  it("renders a rate as a percentage", () => {
    expect(fmtPct(0.052)).toBe("5.2%");
  });
});

describe("compareToAsking", () => {
  it("reports headroom when the ask is below the land value", () => {
    expect(compareToAsking(1_200_000, 950_000)).toEqual({ spread: 250_000, worksAtAsking: true });
  });

  it("reports a negative spread when the ask is above", () => {
    expect(compareToAsking(900_000, 1_150_000)).toEqual({ spread: -250_000, worksAtAsking: false });
  });

  it("treats an exact match as working", () => {
    // Paying precisely the residual land value hits the target by definition.
    expect(compareToAsking(1_000_000, 1_000_000)).toEqual({ spread: 0, worksAtAsking: true });
  });

  it("stays silent with no asking price", () => {
    expect(compareToAsking(1_000_000, null)).toBeNull();
  });

  it("stays silent with no residual land value", () => {
    // Happens when the comparator returned "neither" — there is no path whose
    // land value we could honestly quote.
    expect(compareToAsking(null, 1_000_000)).toBeNull();
  });

  it("rejects a zero or negative ask instead of claiming infinite headroom", () => {
    expect(compareToAsking(1_000_000, 0)).toBeNull();
    expect(compareToAsking(1_000_000, -5)).toBeNull();
  });

  it("rejects non-finite inputs", () => {
    expect(compareToAsking(Number.NaN, 1_000_000)).toBeNull();
    expect(compareToAsking(1_000_000, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("offerPrice", () => {
  it("rounds the residual land value to the nearest $1k", async () => {
    const { offerPrice } = await import("./verdict");
    expect(offerPrice(1_234_567, 1_500_000)).toBe(1_235_000);
    expect(offerPrice(1_234_499, null)).toBe(1_234_000);
  });
  it("falls back to the asking price and then to null", async () => {
    const { offerPrice } = await import("./verdict");
    expect(offerPrice(null, 1_450_250)).toBe(1_450_000);
    expect(offerPrice(0, 999_999)).toBe(1_000_000);
    expect(offerPrice(null, null)).toBeNull();
    expect(offerPrice(Number.NaN, 0)).toBeNull();
  });
});
