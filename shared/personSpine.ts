/**
 * PERSON SPINE — phase 1 linkage decision logic (pure, vitest-covered).
 *
 * One human currently exists as unlinked rows across `users`, `leads`
 * (append-only, multiple rows per email) and `crm_contacts`. Phase 1 links
 * those rows by normalized email — strictly additively — via two nullable FK
 * columns: `leads.user_id` and `crm_contacts.linked_user_id`.
 *
 * This module is the single source of truth for HOW a link decision is made
 * (normalization + match + never-overwrite semantics). It is pure so it can
 * be unit tested; server/personSpine.ts owns the DB wiring and the backfill
 * script reuses these functions row-by-row.
 *
 * Hard rules (phase 1):
 * - An existing link is never overwritten ("already-linked" wins).
 * - Matching is by normalizeEmail (trim + lowercase) equality only.
 * - No merging, no deleting — a decision is either "link" or "skip".
 */

import { normalizeEmail } from "./authTokens";

export type LinkSkipReason = "no-email" | "already-linked" | "no-match";

export type LinkDecision =
  | { action: "link"; userId: string }
  | { action: "skip"; reason: LinkSkipReason };

/**
 * Build a normalized-email → user-id lookup from users rows.
 * The FIRST occurrence of a normalized email wins, so callers that pass rows
 * ordered by created_at get deterministic oldest-account-wins resolution.
 * Rows without a usable email are skipped.
 */
export function buildEmailIndex(
  rows: Iterable<{ id: string; email: string | null | undefined }>,
): Map<string, string> {
  const index = new Map<string, string>();
  for (const row of rows) {
    const normalized = normalizeEmail(row.email);
    if (!normalized) continue;
    if (!index.has(normalized)) index.set(normalized, row.id);
  }
  return index;
}

/**
 * Decide whether a leads/crm_contacts row should be linked to a user.
 *
 * - `linkedUserId` already set → skip ("already-linked"): phase 1 NEVER
 *   overwrites an existing link, even if the email now resolves elsewhere.
 * - no usable email → skip ("no-email").
 * - normalized email not in the index → skip ("no-match").
 * - otherwise → link to the indexed user id.
 *
 * Idempotent by construction: applying a "link" decision makes the next
 * decision for the same row "already-linked".
 */
export function decideLink(
  row: { email: string | null | undefined; linkedUserId: string | null | undefined },
  emailIndex: Map<string, string>,
): LinkDecision {
  if (row.linkedUserId) return { action: "skip", reason: "already-linked" };
  const normalized = normalizeEmail(row.email);
  if (!normalized) return { action: "skip", reason: "no-email" };
  const userId = emailIndex.get(normalized);
  if (!userId) return { action: "skip", reason: "no-match" };
  return { action: "link", userId };
}

/**
 * True when two raw emails identify the same person under phase-1 rules
 * (normalized equality; empty/missing emails never match anything).
 */
export function emailsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const normalizedA = normalizeEmail(a);
  return normalizedA !== "" && normalizedA === normalizeEmail(b);
}
