const FT_PER_M = 3.28084;
const SQFT_PER_SQM = 10.7639;
const SQFT_PER_ACRE = 43_560;

export interface ListingLotInput {
  frontage?: number | null;
  depth?: number | null;
  area?: number | null;
  areaUnit?: string | null;
  dimensions?: string | null;
}

export interface NormalizedListingLot {
  frontageFt: number | null;
  depthFt: number | null;
  areaSqft: number | null;
  basis: Array<"ddf_fields" | "dimension_text" | "area_field">;
}

function positive(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export function normalizeListingLot(input: ListingLotInput): NormalizedListingLot {
  let frontageFt = positive(input.frontage);
  let depthFt = positive(input.depth);
  const basis: NormalizedListingLot["basis"] = [];
  if (frontageFt || depthFt) basis.push("ddf_fields");

  if ((!frontageFt || !depthFt) && input.dimensions) {
    const match = input.dimensions.match(/([\d,.]+)\s*(?:x|×|by)\s*([\d,.]+)/i);
    if (match) {
      const first = Number(match[1].replace(/,/g, ""));
      const second = Number(match[2].replace(/,/g, ""));
      const metric = /\b(?:m|metres?|meters?)\b/i.test(input.dimensions)
        && !/\b(?:ft|feet|foot)\b/i.test(input.dimensions);
      if (!frontageFt && first > 0) frontageFt = first * (metric ? FT_PER_M : 1);
      if (!depthFt && second > 0) depthFt = second * (metric ? FT_PER_M : 1);
      basis.push("dimension_text");
    }
  }

  const rawArea = positive(input.area);
  let areaSqft: number | null = null;
  if (rawArea) {
    const unit = (input.areaUnit || "sqft").toLowerCase();
    areaSqft = unit.includes("acre")
      ? rawArea * SQFT_PER_ACRE
      : unit.includes("sqm") || unit.includes("m²") || unit.includes("square metre") || unit.includes("square meter")
        ? rawArea * SQFT_PER_SQM
        : rawArea;
    basis.push("area_field");
  } else if (frontageFt && depthFt) {
    areaSqft = frontageFt * depthFt;
  }

  const rounded = (value: number | null) => value === null ? null : Math.round(value * 10) / 10;
  return {
    frontageFt: rounded(frontageFt),
    depthFt: rounded(depthFt),
    areaSqft: areaSqft === null ? null : Math.round(areaSqft),
    basis,
  };
}
