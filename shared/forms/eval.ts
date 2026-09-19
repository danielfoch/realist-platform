/**
 * Cua-style eval helpers for form fill. Pass/fail metrics — no claimed
 * accuracy percentage beyond what the fixture actually measured.
 */
import type { FormFillResult } from "./types";

export interface ExpectedFill {
  values: Record<string, string | number | boolean>;
  missingKeys?: string[];
  forbiddenKeys?: string[];
}

export function fieldAccuracy(
  result: FormFillResult,
  expected: Record<string, string | number | boolean>,
): { matched: number; expected: number; ratio: number; mismatches: string[] } {
  const mismatches: string[] = [];
  let matched = 0;
  for (const [key, want] of Object.entries(expected)) {
    if (result.values[key] === want) matched += 1;
    else mismatches.push(key);
  }
  const total = Object.keys(expected).length;
  return {
    matched,
    expected: total,
    ratio: total === 0 ? 1 : matched / total,
    mismatches,
  };
}

export function requiredCompletion(result: FormFillResult): number {
  return result.completenessPct;
}

/**
 * Fail if any filled value does not appear in the allowlisted provided
 * scalars. Catches hallucinated names, prices, dates, and clauses.
 */
export function rejectIfInvented(
  result: FormFillResult,
  provided: Iterable<string | number | boolean>,
): { ok: true } | { ok: false; invented: string[] } {
  const allowed = new Set<string>();
  for (const value of provided) {
    allowed.add(String(value).trim());
  }
  const invented: string[] = [];
  for (const field of result.fields) {
    if (field.value == null) continue;
    const raw = String(field.value).trim();
    if (!allowed.has(raw)) invented.push(`${field.key}=${raw}`);
  }
  return invented.length ? { ok: false, invented } : { ok: true };
}

export function assertExpectedFill(result: FormFillResult, expected: ExpectedFill): void {
  const accuracy = fieldAccuracy(result, expected.values);
  if (accuracy.mismatches.length) {
    throw new Error(`fieldAccuracy mismatches: ${accuracy.mismatches.join(", ")}`);
  }
  for (const key of expected.missingKeys ?? []) {
    if (result.values[key] != null) {
      throw new Error(`expected ${key} to stay blank`);
    }
    if (!result.missingFields.some((item) => item.key === key)) {
      throw new Error(`expected ${key} in missingFields`);
    }
  }
  for (const key of expected.forbiddenKeys ?? []) {
    if (result.values[key] != null) {
      throw new Error(`forbidden fill on ${key}`);
    }
  }
}

export function collectProvidedScalars(input: {
  property?: Record<string, unknown> | null;
  listing?: Record<string, unknown> | null;
  facts?: Record<string, unknown> | null;
  parties?: Record<string, unknown> | null;
  contacts?: Array<Record<string, unknown>> | null;
  overrides?: Record<string, unknown> | null;
}): Array<string | number | boolean> {
  const out: Array<string | number | boolean> = [];
  const walk = (value: unknown) => {
    if (value == null) return;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out.push(value);
      if (typeof value === "string") {
        const parts = value.split(/\s+/).filter(Boolean);
        if (parts.length > 1) out.push(...parts);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(input.property);
  walk(input.listing);
  walk(input.facts);
  walk(input.parties);
  walk(input.contacts);
  walk(input.overrides);
  return out;
}
