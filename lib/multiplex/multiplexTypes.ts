/**
 * Shared types for the AI Multiplex Underwriter engines.
 *
 * Doctrine: deterministic math computes, the LLM narrates. Every figure the
 * engines emit carries provenance so the UI can badge it and the report
 * writer can qualify it. See portfolio-os/20-realist/MULTIPLEX-UNDERWRITER-PLAN.md.
 */

/** Where a figure came from, rendered as a badge in the UI. */
export type Certainty =
  | "verified"    // from official geodata / published schedule
  | "inferred"    // derived from a verified fact (e.g. zone category from code)
  | "assumption"  // admin-seeded default the user can override
  | "estimate";   // model output (e.g. rent estimate)

export interface Provenance<T> {
  value: T;
  source: string;
  certainty: Certainty;
}

export function prov<T>(value: T, source: string, certainty: Certainty): Provenance<T> {
  return { value, source, certainty };
}

/** Unit types used for mix packing and rent mapping. */
export type UnitType = "bachelor" | "1br" | "2br" | "3br";

export interface UnitMixEntry {
  type: UnitType;
  count: number;
  /** Net saleable/rentable square feet per unit of this type. */
  netSqftEach: number;
}

export type ApprovalPath = "as_of_right" | "minor_variance" | "rezoning" | "not_permitted";

export interface RiskFlag {
  key: string;
  severity: "info" | "caution" | "high";
  message: string;
  evidence?: string;
}

/** Metric/imperial helpers — platform inputs are feet, Toronto by-laws are metric. */
export const FT_PER_M = 3.28084;
export const SQFT_PER_SQM = 10.7639;

export function feetToMetres(ft: number): number {
  return ft / FT_PER_M;
}

export function metresToFeet(m: number): number {
  return m * FT_PER_M;
}
