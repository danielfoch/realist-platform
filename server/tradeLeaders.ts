/**
 * Per-trade leaderboard aggregation (30-day window), shared by the
 * /api/leaderboard/by-trade endpoint and the weekly digest so both read the
 * same numbers. The DB does the GROUP BY over expert_field_notes; the pure
 * shaping (rank, badge, top-N) lives in shared/tradeLeaderboard.ts.
 */

import { inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { users } from "@shared/schema";
import { anonymizeDisplayName } from "@shared/community";
import { rankByTrade, type TradeAggRow, type TradeLeader } from "@shared/tradeLeaderboard";
import type { VerificationStatus } from "@shared/professionalProfiles";

/** Top-N field-note contributors per expert category over the trailing 30 days. */
export async function getTradeLeaders(topN = 5): Promise<Record<string, TradeLeader[]>> {
  const agg = await db.execute(sql`
    SELECT category, user_id, COUNT(*)::int AS notes, COALESCE(SUM(score), 0)::int AS endorsements
    FROM expert_field_notes
    WHERE status = 'visible' AND created_at >= now() - interval '30 days'
    GROUP BY category, user_id
  `);
  const rows: TradeAggRow[] = (agg.rows as Array<{ category: string; user_id: string; notes: number; endorsements: number }>).map(
    (r) => ({ category: r.category, userId: r.user_id, notes: Number(r.notes), endorsements: Number(r.endorsements) }),
  );
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const nameById = new Map<string, string>();
  const statusById = new Map<string, VerificationStatus>();
  if (userIds.length) {
    const us = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(inArray(users.id, userIds));
    for (const u of us) nameById.set(u.id, anonymizeDisplayName(u.firstName, u.lastName));
    const profs = await db.execute(sql`
      SELECT user_id, verification_status FROM professional_profiles WHERE user_id = ANY(${userIds})
    `);
    for (const p of profs.rows as Array<{ user_id: string; verification_status: string }>) {
      statusById.set(p.user_id, p.verification_status as VerificationStatus);
    }
  }
  return rankByTrade(rows, { nameById, statusById, topN });
}
