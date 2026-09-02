/**
 * Lot-dimension parsing for listing feeds (pure, unit-tested).
 *
 * CREA DDF hands lot size three different ways, often on the same listing:
 * numeric LotFrontage / LotDepth (unit unstated), a free-text
 * LotSizeDimensions string ("25 x 120 FT", "7.62 x 36.58 M", "25.00 x 120.00
 * Feet"), and LotSizeArea + LotSizeAreaUnits. The underwriter needs feet.
 *
 * Unit inference: a Toronto lot is typically 15-50 ft wide and 90-150 ft deep;
 * a frontage of 7.6 and a depth of 36.6 can only be metres. The heuristic
 * (frontage <= 20 and depth <= 60 -> metres) is only applied when no unit is
 * stated anywhere.
 */

export interface LotDimensionInput {
  lotFrontage?: number | string | null;
  lotDepth?: number | string | null;
  lotSizeDimensions?: string | null;
  lotSizeArea?: number | string | null;
  lotSizeAreaUnits?: string | null;
}

export type LotDimensionSource = "fields" | "dimensions_string" | "area_only" | "none";

export interface ParsedLotDimensions {
  frontageFt: number | null;
  depthFt: number | null;
  areaSqft: number | null;
  source: LotDimensionSource;
  /** Human-readable provenance, e.g. "Converted from metres (7.62 x 36.58 m)". */
  note?: string;
}

const M_TO_FT = 3.28084;
const SQM_TO_SQFT = 10.7639;
const ACRE_TO_SQFT = 43_560;
const HECTARE_TO_SQFT = 107_639;

type LengthUnit = "ft" | "m";

function toNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v === "string") {
    const n = Number.parseFloat(v.replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Detect an explicit length unit anywhere in a free-text string. */
export function detectLengthUnit(text: string | null | undefined): LengthUnit | null {
  if (!text) return null;
  const s = text.toLowerCase();
  if (/\b(ft|feet|foot)\b|'/.test(s) || /\bft\./.test(s)) return "ft";
  if (/\b(m|metres|meters|metre|meter)\b/.test(s) || /\bm\./.test(s)) return "m";
  return null;
}

/** Ambiguous-unit heuristic: small numbers on both axes can only be metres. */
export function inferLengthUnit(frontage: number, depth: number): LengthUnit {
  return frontage <= 20 && depth <= 60 ? "m" : "ft";
}

function areaUnitFactor(units: string | null | undefined): { factor: number; label: string } {
  const s = (units ?? "").toLowerCase().replace(/\./g, "");
  if (/hect|\bha\b/.test(s)) return { factor: HECTARE_TO_SQFT, label: "hectares" };
  if (/acre|\bac\b/.test(s)) return { factor: ACRE_TO_SQFT, label: "acres" };
  if (/sq\s*m|m2|m²|square\s*met/.test(s)) return { factor: SQM_TO_SQFT, label: "square metres" };
  return { factor: 1, label: "square feet" };
}

/** Length unit hinted by an AREA unit — a metric area almost always pairs with metric dims. */
function lengthUnitFromAreaUnits(units: string | null | undefined): LengthUnit | null {
  const s = (units ?? "").toLowerCase();
  if (!s) return null;
  if (/sq\s*m|m2|m²|square\s*met|hect/.test(s)) return "m";
  if (/sq\s*f|ft2|ft²|square\s*f|acre/.test(s)) return "ft";
  return null;
}

/**
 * Parse "A x B [unit]" (also "A X B", "A × B", "A by B", "A ft x B ft").
 * Returns raw numbers plus any unit stated in the string.
 */
export function parseDimensionString(text: string | null | undefined): { a: number; b: number; unit: LengthUnit | null } | null {
  if (!text) return null;
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*(?:ft|feet|foot|m|metres|meters|metre|meter|')?\.?\s*(?:x|×|by)\s*(\d+(?:[.,]\d+)?)/i);
  if (!m) return null;
  const a = toNum(m[1]);
  const b = toNum(m[2]);
  if (a == null || b == null) return null;
  return { a, b, unit: detectLengthUnit(text) };
}

export function parseLotDimensions(input: LotDimensionInput): ParsedLotDimensions {
  const fieldFrontage = toNum(input.lotFrontage);
  const fieldDepth = toNum(input.lotDepth);
  const fromString = parseDimensionString(input.lotSizeDimensions);
  const areaRaw = toNum(input.lotSizeArea);
  const { factor: areaFactor, label: areaLabel } = areaUnitFactor(input.lotSizeAreaUnits);
  const explicitAreaSqft = areaRaw != null ? Math.round(areaRaw * areaFactor) : null;

  // Unit evidence, strongest first: the dimension string's own unit, then the
  // area unit, then the small-number heuristic.
  const stringUnit = fromString?.unit ?? detectLengthUnit(input.lotSizeDimensions);
  const areaUnitHint = lengthUnitFromAreaUnits(input.lotSizeAreaUnits);

  const finish = (
    frontage: number,
    depth: number,
    source: LotDimensionSource,
    unit: LengthUnit,
    unitWasInferred: boolean,
  ): ParsedLotDimensions => {
    const frontageFt = unit === "m" ? round1(frontage * M_TO_FT) : round1(frontage);
    const depthFt = unit === "m" ? round1(depth * M_TO_FT) : round1(depth);
    const origin = source === "fields" ? "listing lot fields" : `listing lot text "${(input.lotSizeDimensions ?? "").trim()}"`;
    let note: string;
    if (unit === "m") {
      note = `${unitWasInferred ? "Metres inferred" : "Converted from metres"} (${frontage} x ${depth} m → ${frontageFt} x ${depthFt} ft) from ${origin}.`;
    } else {
      note = `${unitWasInferred ? "Feet assumed" : "Feet"} (${frontageFt} x ${depthFt} ft) from ${origin}.`;
    }
    return { frontageFt, depthFt, areaSqft: explicitAreaSqft, source, note };
  };

  if (fieldFrontage != null && fieldDepth != null) {
    const unit = stringUnit ?? areaUnitHint;
    return finish(fieldFrontage, fieldDepth, "fields", unit ?? inferLengthUnit(fieldFrontage, fieldDepth), unit == null);
  }

  if (fromString) {
    const unit = fromString.unit ?? areaUnitHint;
    return finish(fromString.a, fromString.b, "dimensions_string", unit ?? inferLengthUnit(fromString.a, fromString.b), unit == null);
  }

  if (explicitAreaSqft != null) {
    return {
      frontageFt: null,
      depthFt: null,
      areaSqft: explicitAreaSqft,
      source: "area_only",
      note: `Lot area only (${areaRaw} ${areaLabel} → ${explicitAreaSqft.toLocaleString()} sqft) — frontage and depth not stated on the listing.`,
    };
  }

  return { frontageFt: null, depthFt: null, areaSqft: null, source: "none", note: "No lot dimensions on the listing — enter them manually." };
}
