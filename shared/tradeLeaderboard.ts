/**
 * Per-trade leaderboard shaping (30-day window) — pure, no I/O.
 *
 * The all-time, single-category leaderboard already exists
 * (/api/experts/leaderboard?category=). This shapes a 30-day, ALL-trades-in-one
 * response for the "Power Team leaders" surface: top contributors per expert
 * category, ranked by notes contributed + endorsements received, badged with
 * their FN-1 verification tier.
 *
 * The server does the GROUP BY (category, user_id) over expert_field_notes and
 * hands the rows here with name + verification lookups.
 */

import type { VerificationStatus } from "./professionalProfiles";

/** notes count carries the reputation-ledger weight (fieldNoteAdded = 3). */
const NOTE_WEIGHT = 3;

export interface TradeAggRow {
  category: string;
  userId: string;
  notes: number;
  endorsements: number; // net votes = SUM(score) over the window
}

export interface TradeLeader {
  userId: string;
  name: string;
  notes: number;
  endorsements: number;
  score: number;
  verificationStatus: VerificationStatus | null;
}

export function contributionScore(notes: number, endorsements: number): number {
  return notes * NOTE_WEIGHT + Math.max(0, endorsements);
}

/**
 * Group aggregated rows by category → top-N leaders each, ranked by score
 * (ties broken by endorsements, then notes). Rows with no resolvable name are
 * dropped. Empty categories are omitted.
 */
export function rankByTrade(
  rows: TradeAggRow[],
  opts: { nameById: Map<string, string>; statusById?: Map<string, VerificationStatus>; topN?: number },
): Record<string, TradeLeader[]> {
  const topN = opts.topN ?? 5;
  const byCategory = new Map<string, TradeLeader[]>();

  for (const r of rows) {
    const name = opts.nameById.get(r.userId);
    if (!name || r.notes <= 0) continue;
    const leader: TradeLeader = {
      userId: r.userId,
      name,
      notes: r.notes,
      endorsements: r.endorsements,
      score: contributionScore(r.notes, r.endorsements),
      verificationStatus: opts.statusById?.get(r.userId) ?? null,
    };
    const list = byCategory.get(r.category) ?? [];
    list.push(leader);
    byCategory.set(r.category, list);
  }

  const out: Record<string, TradeLeader[]> = {};
  for (const [category, list] of byCategory) {
    list.sort((a, b) => b.score - a.score || b.endorsements - a.endorsements || b.notes - a.notes);
    out[category] = list.slice(0, topN);
  }
  return out;
}
