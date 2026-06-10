/**
 * Intent recomputation — keeps opportunity intent scores in sync with the
 * event stream. Called fire-and-forget after scoring-relevant events.
 */

import { db } from './db';
import { logger } from './logger';
import { computeIntentScore, intentBand, suggestedNextAction, ScorableEvent } from './scoring';

const SCORING_WINDOW_DAYS = 90;

export interface IntentResult {
  score: number;
  band: ReturnType<typeof intentBand>;
  nextAction: string;
}

/**
 * Recompute a user's intent score from their recent events + profile,
 * and persist it to any open opportunities they have.
 */
export async function recomputeIntentForUser(userId: number): Promise<IntentResult | null> {
  try {
    const [eventsResult, userResult, oppResult] = await Promise.all([
      db.query<ScorableEvent & { created_at: Date }>(
        `SELECT event, created_at, deal_id FROM user_events
         WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '${SCORING_WINDOW_DAYS} days'`,
        [userId],
      ),
      db.query<{ phone: string | null }>('SELECT phone FROM users WHERE id = $1', [userId]),
      db.query<{ id: number; financing_help: boolean; buying_help: boolean }>(
        `SELECT id, financing_help, buying_help FROM opportunities
         WHERE user_id = $1 AND status NOT IN ('closed', 'lost')`,
        [userId],
      ),
    ]);

    const hasPhone = Boolean(userResult.rows[0]?.phone);
    const financingHelp = oppResult.rows.some((o) => o.financing_help);
    const buyingHelp = oppResult.rows.some((o) => o.buying_help);

    const score = computeIntentScore(eventsResult.rows, { hasPhone, financingHelp, buyingHelp });
    const band = intentBand(score);
    const nextAction = suggestedNextAction(band);

    if (oppResult.rows.length > 0) {
      await db.query(
        `UPDATE opportunities
         SET intent_score = $1, suggested_next_action = $2, updated_at = NOW()
         WHERE user_id = $3 AND status NOT IN ('closed', 'lost')`,
        [score, nextAction, userId],
      );
    }

    return { score, band, nextAction };
  } catch (err) {
    logger.error('Failed to recompute intent score', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
