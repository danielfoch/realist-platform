import { sql } from "drizzle-orm";
import { db } from "./db";
import {
  analysisUnderwritingComparisons,
  ddfListingSnapshots,
  marketReportMetrics,
  marketSentimentRollups,
} from "@shared/schema";

export const LEADERBOARD_SNAPSHOT_VERSION = "leaderboard-v1";

export function periodWindow(periodType: "daily" | "weekly" | "monthly" | "all_time", anchor = new Date()) {
  const start = new Date(anchor);
  if (periodType === "daily") {
    start.setHours(0, 0, 0, 0);
  } else if (periodType === "weekly") {
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
  } else if (periodType === "monthly") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setTime(0);
  }

  const end = new Date(start);
  if (periodType === "daily") end.setDate(end.getDate() + 1);
  else if (periodType === "weekly") end.setDate(end.getDate() + 7);
  else if (periodType === "monthly") end.setMonth(end.getMonth() + 1);
  else end.setFullYear(9999, 11, 31);
  return { start, end };
}

export function previousPeriodWindow(periodType: "weekly" | "monthly", anchor = new Date()) {
  const current = periodWindow(periodType, anchor);
  const previousAnchor = new Date(current.start);
  if (periodType === "weekly") previousAnchor.setDate(previousAnchor.getDate() - 1);
  else previousAnchor.setMonth(previousAnchor.getMonth() - 1);
  return periodWindow(periodType, previousAnchor);
}

function monthString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function getLiveLeaderboardEntries(input: {
  period?: string;
  city?: string;
  province?: string;
  strategy?: string;
  category?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  direction?: "asc" | "desc";
}) {
  const period = input.period === "weekly" || input.period === "monthly" ? input.period : "all_time";
  const { start, end } = periodWindow(period as never);
  const limit = Math.min(Math.max(input.limit || 10, 1), 100);
  const offset = Math.max(input.offset || 0, 0);
  const direction = input.direction === "asc" ? sql`ASC` : sql`DESC`;
  const sortExpressions: Record<string, ReturnType<typeof sql>> = {
    rank: sql`weighted_score`,
    score: sql`weighted_score`,
    totalDealsAnalyzed: sql`total_deals_analyzed`,
    monthlyDealsAnalyzed: sql`monthly_deals_analyzed`,
    confidence: sql`average_confidence_score`,
    // Oracle scoring is not computed in the live rollup yet (the ranked SELECT
    // emits NULL::real AS market_oracle_score). A window ORDER BY cannot
    // reference that output alias, so sort by the same constant directly.
    oracle: sql`NULL::real`,
    yield: sql`user_underwritten_avg_yield`,
    eligible: sql`eligible_analyses_count`,
    excluded: sql`excluded_analyses_count`,
    name: sql`COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.email, 'Anonymous')`,
  };
  const orderBy = sortExpressions[input.sort || "score"] || sortExpressions.score;

  const rows = await db.execute(sql`
    WITH scoped_analyses AS (
      SELECT
        a.id,
        a.user_id,
        a.city,
        a.province,
        a.created_at,
        a.results_json,
        CASE
          WHEN (a.results_json->>'capRate') ~ '^-?[0-9]+(\\.[0-9]+)?$'
            THEN (a.results_json->>'capRate')::numeric
          ELSE NULL
        END AS cap_rate_num,
        CASE
          WHEN (a.results_json->>'cashOnCash') ~ '^-?[0-9]+(\\.[0-9]+)?$'
            THEN (a.results_json->>'cashOnCash')::numeric
          ELSE NULL
        END AS coc_num,
        CASE
          WHEN (a.results_json->>'dscr') ~ '^-?[0-9]+(\\.[0-9]+)?$'
            THEN (a.results_json->>'dscr')::numeric
          ELSE NULL
        END AS dscr_num,
        COALESCE(q.leaderboard_eligible, true) AS quality_eligible,
        COALESCE(q.confidence_score::numeric, 0.65) AS quality_confidence,
        q.exclusion_reason AS quality_reason
      FROM analyses a
      JOIN users u ON u.id = a.user_id
      LEFT JOIN analysis_quality_scores q ON q.analysis_id = a.id
      WHERE a.user_id IS NOT NULL
        AND a.results_json IS NOT NULL
        AND (${period} = 'all_time' OR (a.created_at >= ${start} AND a.created_at < ${end}))
        AND (${input.city || null}::text IS NULL OR LOWER(a.city) = LOWER(${input.city || null}))
        AND (${input.province || null}::text IS NULL OR LOWER(a.province) = LOWER(${input.province || null}))
        AND (${input.strategy || null}::text IS NULL OR LOWER(a.strategy_type) = LOWER(${input.strategy || null}))
        AND LOWER(COALESCE(u.email, '')) NOT LIKE '%@example.com'
        AND NOT (
          LOWER(COALESCE(u.first_name, '')) = 'test'
          AND LOWER(COALESCE(u.last_name, '')) = 'user'
        )
    ), period_stats AS (
      SELECT
        AVG(cap_rate_num) AS cap_rate_mean,
        STDDEV_SAMP(cap_rate_num) AS cap_rate_std
      FROM scoped_analyses
      WHERE cap_rate_num IS NOT NULL
        AND cap_rate_num BETWEEN -10 AND 25
    ), classified_analyses AS (
      SELECT
        s.*,
        ps.cap_rate_mean,
        ps.cap_rate_std,
        (
          (s.cap_rate_num IS NULL OR s.cap_rate_num BETWEEN -10 AND 25)
          AND (s.coc_num IS NULL OR s.coc_num BETWEEN -50 AND 60)
          AND (s.dscr_num IS NULL OR s.dscr_num BETWEEN 0 AND 4)
        ) AS hard_bounds_ok,
        CASE
          WHEN s.cap_rate_num IS NULL THEN true
          WHEN ps.cap_rate_std IS NULL OR ps.cap_rate_std = 0 THEN true
          WHEN ABS(s.cap_rate_num - ps.cap_rate_mean) <= 3 * ps.cap_rate_std THEN true
          ELSE false
        END AS within_z_score
      FROM scoped_analyses s
      CROSS JOIN period_stats ps
    ), eligible_analyses AS (
      SELECT
        c.*,
        (
          c.quality_eligible IS NOT FALSE
          AND c.quality_confidence >= 0.65
          AND c.hard_bounds_ok
          AND c.within_z_score
        ) AS is_eligible
      FROM classified_analyses c
    ), all_time_counts AS (
      SELECT a.user_id, COUNT(*)::int AS total_deals_analyzed
      FROM analyses a
      LEFT JOIN analysis_quality_scores q ON q.analysis_id = a.id
      WHERE a.user_id IS NOT NULL
        AND a.results_json IS NOT NULL
        AND COALESCE(q.leaderboard_eligible, true) IS NOT FALSE
        AND COALESCE(q.confidence_score::numeric, 0.65) >= 0.65
        AND (
          NOT ((a.results_json->>'capRate') ~ '^-?[0-9]+(\\.[0-9]+)?$')
          OR ((a.results_json->>'capRate')::numeric BETWEEN -10 AND 25)
        )
        AND (
          NOT ((a.results_json->>'cashOnCash') ~ '^-?[0-9]+(\\.[0-9]+)?$')
          OR ((a.results_json->>'cashOnCash')::numeric BETWEEN -50 AND 60)
        )
        AND (
          NOT ((a.results_json->>'dscr') ~ '^-?[0-9]+(\\.[0-9]+)?$')
          OR ((a.results_json->>'dscr')::numeric BETWEEN 0 AND 4)
        )
      GROUP BY a.user_id
    ), current_rollup AS (
      SELECT
        e.user_id,
        COUNT(*)::int AS monthly_deals_analyzed,
        COUNT(*) FILTER (WHERE e.is_eligible)::int AS eligible_analyses_count,
        COUNT(*) FILTER (WHERE NOT e.is_eligible)::int AS excluded_analyses_count,
        AVG(e.quality_confidence) FILTER (WHERE e.is_eligible)::real AS average_confidence_score,
        SUM(CASE WHEN e.is_eligible THEN e.quality_confidence ELSE 0 END)::real AS weighted_score,
        AVG(e.cap_rate_num) FILTER (WHERE e.is_eligible) AS user_underwritten_avg_yield
      FROM eligible_analyses e
      GROUP BY e.user_id
      HAVING COUNT(*) FILTER (WHERE e.is_eligible) > 0
    ), auto_yields AS (
      SELECT province, city, AVG(avg_gross_yield) AS auto_underwritten_avg_yield
      FROM city_yield_history
      WHERE avg_gross_yield IS NOT NULL
      GROUP BY province, city
    ), user_markets AS (
      SELECT DISTINCT ON (user_id) user_id, province, city
      FROM scoped_analyses
      ORDER BY user_id, created_at DESC
    ), ranked AS (
      SELECT
        c.user_id,
        COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.email, 'Anonymous') AS name,
        u.profile_image_url,
        COALESCE(u.role, 'investor') AS role,
        COALESCE(a.total_deals_analyzed, c.monthly_deals_analyzed, 0)::int AS total_deals_analyzed,
        COALESCE(c.monthly_deals_analyzed, 0)::int AS monthly_deals_analyzed,
        COALESCE(c.eligible_analyses_count, 0)::int AS eligible_analyses_count,
        COALESCE(c.excluded_analyses_count, 0)::int AS excluded_analyses_count,
        c.average_confidence_score,
        COALESCE(c.weighted_score, 0)::real AS weighted_score,
        COALESCE(c.weighted_score, 0)::real AS score,
        NULL::real AS market_oracle_score,
        NULL::real AS sale_prediction_median_error,
        0::int AS eligible_sale_predictions_count,
        ay.auto_underwritten_avg_yield,
        c.user_underwritten_avg_yield,
        (c.user_underwritten_avg_yield - ay.auto_underwritten_avg_yield) AS user_vs_auto_yield_delta,
        CASE WHEN COALESCE(c.eligible_analyses_count, 0) < 3 THEN true ELSE false END AS provisional,
        ROW_NUMBER() OVER (ORDER BY ${orderBy} ${direction} NULLS LAST, c.user_id) AS rank
      FROM current_rollup c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN all_time_counts a ON a.user_id = c.user_id
      LEFT JOIN user_markets um ON um.user_id = c.user_id
      LEFT JOIN auto_yields ay ON ay.province = um.province AND LOWER(ay.city) = LOWER(um.city)
    )
    SELECT *, COUNT(*) OVER()::int AS total_count
    FROM ranked
    ORDER BY rank
    LIMIT ${limit} OFFSET ${offset}
  `);

  return {
    rows: rows.rows.map((row: any) => ({
      rank: Number(row.rank),
      userId: row.user_id,
      name: row.name,
      profileImageUrl: row.profile_image_url,
      role: row.role,
      dealCount: Number(row.monthly_deals_analyzed || 0),
      totalDealsAnalyzed: Number(row.total_deals_analyzed || 0),
      monthlyDealsAnalyzed: Number(row.monthly_deals_analyzed || 0),
      weightedDealCount: Number(row.weighted_score || 0),
      leaderboardScore: Number(row.score || 0),
      avgAnalysisConfidenceScore: row.average_confidence_score == null ? null : Number(row.average_confidence_score),
      eligibleAnalysisCount: Number(row.eligible_analyses_count || 0),
      excludedAnalysisCount: Number(row.excluded_analyses_count || 0),
      oracleScore: row.market_oracle_score == null ? null : Number(row.market_oracle_score),
      oracleEligibleCount: Number(row.eligible_sale_predictions_count || 0),
      oracleMedianError: row.sale_prediction_median_error == null ? null : Number(row.sale_prediction_median_error),
      avgCapRate: row.user_underwritten_avg_yield == null ? null : Number(row.user_underwritten_avg_yield),
      userUnderwrittenAvgYield: row.user_underwritten_avg_yield == null ? null : Number(row.user_underwritten_avg_yield),
      autoUnderwrittenAvgYield: row.auto_underwritten_avg_yield == null ? null : Number(row.auto_underwritten_avg_yield),
      userVsAutoYieldDelta: row.user_vs_auto_yield_delta == null ? null : Number(row.user_vs_auto_yield_delta),
      provisional: Boolean(row.provisional),
      oracleRankStatus: Number(row.eligible_sale_predictions_count || 0) >= 5 ? "ranked" : "provisional",
    })),
    totalCount: Number((rows.rows[0] as any)?.total_count || 0),
  };
}

export async function buildUserDealActivityRollups(periodType: "daily" | "weekly" | "monthly" | "all_time" = "monthly", anchor = new Date()) {
  const { start, end } = periodWindow(periodType, anchor);
  await db.execute(sql`
    INSERT INTO user_deal_activity_rollups (
      user_id, period_type, period_start_date, period_end_date, total_deals_analyzed,
      eligible_deals_analyzed, excluded_or_low_confidence_deals, unique_listings_analyzed,
      unique_markets_analyzed, average_analysis_confidence_score, median_time_per_analysis_seconds,
      total_listing_cards_opened, total_underwriting_sessions, total_saved_or_exported_analyses, updated_at
    )
    SELECT
      u.id,
      ${periodType},
      ${start},
      ${end},
      COUNT(DISTINCT a.id)::int,
      COUNT(DISTINCT a.id) FILTER (WHERE COALESCE(q.leaderboard_eligible, true) IS NOT FALSE AND COALESCE(q.confidence_score::numeric, 0.65) >= 0.65)::int,
      COUNT(DISTINCT a.id) FILTER (WHERE COALESCE(q.leaderboard_eligible, true) IS FALSE OR COALESCE(q.confidence_score::numeric, 0.65) < 0.65)::int,
      COUNT(DISTINCT COALESCE(a.inputs_json->>'mlsNumber', a.inputs_json->>'listingMlsNumber', a.address, a.id))::int,
      COUNT(DISTINCT COALESCE(a.city, '') || ':' || COALESCE(a.province, ''))::int,
      AVG(COALESCE(q.confidence_score::numeric, 0.65)),
      percentile_cont(0.5) WITHIN GROUP (ORDER BY NULLIF(a.inputs_json->>'timeSpentSeconds', '')::numeric),
      COALESCE(ev.listing_cards_opened, 0),
      COALESCE(ev.underwriting_sessions, 0),
      COALESCE(ev.saved_or_exported, 0),
      now()
    FROM users u
    LEFT JOIN analyses a ON a.user_id = u.id AND a.results_json IS NOT NULL AND (${periodType} = 'all_time' OR (a.created_at >= ${start} AND a.created_at < ${end}))
    LEFT JOIN analysis_quality_scores q ON q.analysis_id = a.id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE event_name IN ('listing_card_opened', 'listing_card_reopened'))::int AS listing_cards_opened,
        COUNT(*) FILTER (WHERE event_name IN ('underwriting_opened', 'underwriting_started', 'analysis_started'))::int AS underwriting_sessions,
        COUNT(*) FILTER (WHERE event_name IN ('underwriting_exported_or_saved', 'deal_saved', 'deal_exported', 'deal_shared'))::int AS saved_or_exported
      FROM user_activity_events e
      WHERE e.user_id = u.id AND (${periodType} = 'all_time' OR (e.event_timestamp >= ${start} AND e.event_timestamp < ${end}))
    ) ev ON true
    WHERE EXISTS (
      SELECT 1 FROM analyses ax WHERE ax.user_id = u.id AND ax.results_json IS NOT NULL AND (${periodType} = 'all_time' OR (ax.created_at >= ${start} AND ax.created_at < ${end}))
    )
    GROUP BY u.id, ev.listing_cards_opened, ev.underwriting_sessions, ev.saved_or_exported
    ON CONFLICT (user_id, period_type, period_start_date) DO UPDATE SET
      period_end_date = EXCLUDED.period_end_date,
      total_deals_analyzed = EXCLUDED.total_deals_analyzed,
      eligible_deals_analyzed = EXCLUDED.eligible_deals_analyzed,
      excluded_or_low_confidence_deals = EXCLUDED.excluded_or_low_confidence_deals,
      unique_listings_analyzed = EXCLUDED.unique_listings_analyzed,
      unique_markets_analyzed = EXCLUDED.unique_markets_analyzed,
      average_analysis_confidence_score = EXCLUDED.average_analysis_confidence_score,
      median_time_per_analysis_seconds = EXCLUDED.median_time_per_analysis_seconds,
      total_listing_cards_opened = EXCLUDED.total_listing_cards_opened,
      total_underwriting_sessions = EXCLUDED.total_underwriting_sessions,
      total_saved_or_exported_analyses = EXCLUDED.total_saved_or_exported_analyses,
      updated_at = now()
  `);
  return { periodType, start, end };
}

export async function finalizeLeaderboardSnapshot(input: { periodType?: "monthly" | "weekly"; anchor?: Date; category?: string; force?: boolean } = {}) {
  const periodType = input.periodType || "monthly";
  const { start, end } = input.anchor ? periodWindow(periodType, input.anchor) : previousPeriodWindow(periodType);
  await buildUserDealActivityRollups(periodType, start);

  const [period] = (await db.execute(sql`
    INSERT INTO leaderboard_periods (period_type, period_start_date, period_end_date, status, finalized_at, updated_at)
    VALUES (${periodType}, ${start}, ${end}, 'finalized', now(), now())
    ON CONFLICT (period_type, period_start_date) DO UPDATE SET
      period_end_date = EXCLUDED.period_end_date,
      status = CASE WHEN ${input.force || false} THEN 'finalized' ELSE leaderboard_periods.status END,
      finalized_at = COALESCE(leaderboard_periods.finalized_at, now()),
      updated_at = now()
    RETURNING *
  `)).rows as any[];

  const category = input.category || "overall";
  const [snapshot] = (await db.execute(sql`
    INSERT INTO leaderboard_snapshots (leaderboard_period_id, category, snapshot_version, metadata)
    VALUES (${period.id}, ${category}, ${LEADERBOARD_SNAPSHOT_VERSION}, ${JSON.stringify({ generatedBy: "marketIntelligence.finalizeLeaderboardSnapshot" })}::jsonb)
    ON CONFLICT (leaderboard_period_id, category, snapshot_version) DO UPDATE SET
      generated_at = CASE WHEN ${input.force || false} THEN now() ELSE leaderboard_snapshots.generated_at END,
      metadata = EXCLUDED.metadata
    RETURNING *
  `)).rows as any[];

  if (input.force) {
    await db.execute(sql`DELETE FROM leaderboard_snapshot_entries WHERE leaderboard_snapshot_id = ${snapshot.id}`);
  }

  const previousRows = await db.execute(sql`
    SELECT e.user_id, e.rank
    FROM leaderboard_snapshot_entries e
    JOIN leaderboard_snapshots s ON s.id = e.leaderboard_snapshot_id
    JOIN leaderboard_periods p ON p.id = s.leaderboard_period_id
    WHERE p.period_type = ${periodType}
      AND p.period_start_date < ${start}
      AND s.category = ${category}
    ORDER BY p.period_start_date DESC
  `);
  const previousRank = new Map<string, number>();
  for (const row of previousRows.rows as any[]) {
    if (!previousRank.has(row.user_id)) previousRank.set(row.user_id, Number(row.rank));
  }

  const live = await getLiveLeaderboardEntries({ period: periodType, limit: 100, offset: 0 });
  for (const entry of live.rows) {
    const prev = previousRank.get(entry.userId) || null;
    await db.execute(sql`
      INSERT INTO leaderboard_snapshot_entries (
        leaderboard_snapshot_id, user_id, rank, previous_rank, rank_change, score, weighted_score,
        total_deals_analyzed, monthly_deals_analyzed, eligible_analyses_count, excluded_analyses_count,
        average_confidence_score, market_oracle_score, sale_prediction_median_error,
        eligible_sale_predictions_count, auto_underwritten_avg_yield, user_underwritten_avg_yield,
        user_vs_auto_yield_delta, kpis
      ) VALUES (
        ${snapshot.id}, ${entry.userId}, ${entry.rank}, ${prev}, ${prev == null ? null : prev - entry.rank},
        ${entry.leaderboardScore}, ${entry.weightedDealCount}, ${entry.totalDealsAnalyzed}, ${entry.monthlyDealsAnalyzed},
        ${entry.eligibleAnalysisCount}, ${entry.excludedAnalysisCount}, ${entry.avgAnalysisConfidenceScore},
        ${entry.oracleScore}, ${entry.oracleMedianError}, ${entry.oracleEligibleCount}, ${entry.autoUnderwrittenAvgYield},
        ${entry.userUnderwrittenAvgYield}, ${entry.userVsAutoYieldDelta}, ${JSON.stringify(entry)}::jsonb
      ) ON CONFLICT (leaderboard_snapshot_id, user_id) DO NOTHING
    `);
  }
  return { period, snapshot, entryCount: live.rows.length };
}

export async function getLeaderboardHistory() {
  const rows = await db.execute(sql`
    SELECT p.period_start_date, s.category, e.user_id, e.rank, e.previous_rank, e.rank_change,
      e.score, e.weighted_score, e.total_deals_analyzed, e.monthly_deals_analyzed,
      e.eligible_analyses_count, e.average_confidence_score, e.market_oracle_score,
      COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.email, 'Anonymous') AS name
    FROM leaderboard_snapshot_entries e
    JOIN leaderboard_snapshots s ON s.id = e.leaderboard_snapshot_id
    JOIN leaderboard_periods p ON p.id = s.leaderboard_period_id
    JOIN users u ON u.id = e.user_id
    WHERE p.period_type = 'monthly' AND p.status = 'finalized'
    ORDER BY p.period_start_date ASC, e.rank ASC
  `);
  return rows.rows;
}

export async function buildMarketSentimentRollups(periodType: "daily" | "weekly" | "monthly" = "monthly", anchor = new Date()) {
  const { start, end } = periodWindow(periodType, anchor);
  await db.execute(sql`
    INSERT INTO market_sentiment_rollups (
      period_type, period_start_date, period_end_date, province, city, neighborhood, property_type, strategy_type,
      total_listing_views, unique_users, total_underwrites, eligible_underwrites, watchlist_count,
      bullish_count, bearish_count, pass_count, offer_candidate_count, average_sentiment_score,
      median_user_estimated_sale_to_list_ratio, average_user_estimated_sale_to_list_ratio,
      median_user_vs_list_delta, median_user_vs_auto_model_delta, average_analysis_confidence_score,
      sample_size, provisional, updated_at
    )
    SELECT
      ${periodType}, ${start}, ${end}, province, city, neighborhood, property_type, strategy_type,
      COUNT(*) FILTER (WHERE event_name IN ('listing_card_opened', 'listing_card_reopened', 'listing_viewed'))::int,
      COUNT(DISTINCT user_id)::int,
      COUNT(*) FILTER (WHERE event_name IN ('underwriting_started', 'underwriting_completed', 'analysis_completed'))::int,
      COUNT(*) FILTER (WHERE event_name IN ('underwriting_completed', 'analysis_completed') AND COALESCE(confidence_score::numeric, 0) >= 0.65)::int,
      COUNT(*) FILTER (WHERE event_name IN ('listing_watchlisted', 'deal_marked_watchlist', 'listing_saved'))::int,
      COUNT(*) FILTER (WHERE sentiment_score > 0.25)::int,
      COUNT(*) FILTER (WHERE sentiment_score < -0.25)::int,
      COUNT(*) FILTER (WHERE event_name IN ('listing_dismissed', 'deal_marked_bad') OR sentiment_score <= -0.75)::int,
      COUNT(*) FILTER (WHERE event_name IN ('deal_marked_offer_candidate', 'listing_sentiment_selected') AND sentiment_score >= 0.75)::int,
      AVG(sentiment_score),
      percentile_cont(0.5) WITHIN GROUP (ORDER BY NULLIF(metadata->>'estimated_sale_to_list_ratio', '')::numeric),
      AVG(NULLIF(metadata->>'estimated_sale_to_list_ratio', '')::numeric),
      percentile_cont(0.5) WITHIN GROUP (ORDER BY NULLIF(metadata->>'user_vs_list_delta', '')::numeric),
      percentile_cont(0.5) WITHIN GROUP (ORDER BY NULLIF(metadata->>'user_estimate_vs_auto_model_delta', '')::numeric),
      AVG(confidence_score),
      COUNT(*)::int,
      COUNT(*) < 10,
      now()
    FROM market_sentiment_events
    WHERE event_timestamp >= ${start} AND event_timestamp < ${end}
    GROUP BY province, city, neighborhood, property_type, strategy_type
    ON CONFLICT (period_type, period_start_date, province, city, neighborhood, property_type, strategy_type) DO UPDATE SET
      total_listing_views = EXCLUDED.total_listing_views,
      unique_users = EXCLUDED.unique_users,
      total_underwrites = EXCLUDED.total_underwrites,
      eligible_underwrites = EXCLUDED.eligible_underwrites,
      watchlist_count = EXCLUDED.watchlist_count,
      bullish_count = EXCLUDED.bullish_count,
      bearish_count = EXCLUDED.bearish_count,
      pass_count = EXCLUDED.pass_count,
      offer_candidate_count = EXCLUDED.offer_candidate_count,
      average_sentiment_score = EXCLUDED.average_sentiment_score,
      median_user_estimated_sale_to_list_ratio = EXCLUDED.median_user_estimated_sale_to_list_ratio,
      average_user_estimated_sale_to_list_ratio = EXCLUDED.average_user_estimated_sale_to_list_ratio,
      median_user_vs_list_delta = EXCLUDED.median_user_vs_list_delta,
      median_user_vs_auto_model_delta = EXCLUDED.median_user_vs_auto_model_delta,
      average_analysis_confidence_score = EXCLUDED.average_analysis_confidence_score,
      sample_size = EXCLUDED.sample_size,
      provisional = EXCLUDED.provisional,
      updated_at = now()
  `);
  return { periodType, start, end };
}

export async function buildMarketReportMetrics(anchor = new Date()) {
  const { start, end } = periodWindow("monthly", anchor);
  const month = monthString(start);
  await db.execute(sql`
    INSERT INTO market_report_metrics (
      period_type, period_start_date, period_end_date, province, city, property_type, metric_source,
      listing_count, average_yield, median_yield, average_cap_rate, median_cap_rate,
      average_price_cents, median_price_cents, average_rent_cents, median_rent_cents,
      average_rent_to_price_ratio, median_rent_to_price_ratio, sample_size, provisional, updated_at
    )
    SELECT 'monthly', ${start}, ${end}, province, city, property_sub_type, 'ddf_auto_underwriting',
      COUNT(*)::int,
      AVG(gross_yield), percentile_cont(0.5) WITHIN GROUP (ORDER BY gross_yield),
      AVG(net_yield), percentile_cont(0.5) WITHIN GROUP (ORDER BY net_yield),
      AVG(list_price * 100)::bigint, percentile_cont(0.5) WITHIN GROUP (ORDER BY list_price * 100)::bigint,
      AVG(estimated_monthly_rent * 100)::bigint, percentile_cont(0.5) WITHIN GROUP (ORDER BY estimated_monthly_rent * 100)::bigint,
      AVG((estimated_monthly_rent * 12) / NULLIF(list_price, 0)),
      percentile_cont(0.5) WITHIN GROUP (ORDER BY (estimated_monthly_rent * 12) / NULLIF(list_price, 0)),
      COUNT(*)::int, COUNT(*) < 5, now()
    FROM ddf_listing_snapshots
    WHERE snapshot_month = ${month}
      AND list_price IS NOT NULL AND list_price > 0
    GROUP BY province, city, property_sub_type
    ON CONFLICT (period_start_date, province, city, neighborhood, property_type, strategy_type, metric_source) DO UPDATE SET
      listing_count = EXCLUDED.listing_count,
      average_yield = EXCLUDED.average_yield,
      median_yield = EXCLUDED.median_yield,
      average_cap_rate = EXCLUDED.average_cap_rate,
      median_cap_rate = EXCLUDED.median_cap_rate,
      average_price_cents = EXCLUDED.average_price_cents,
      median_price_cents = EXCLUDED.median_price_cents,
      average_rent_cents = EXCLUDED.average_rent_cents,
      median_rent_cents = EXCLUDED.median_rent_cents,
      average_rent_to_price_ratio = EXCLUDED.average_rent_to_price_ratio,
      median_rent_to_price_ratio = EXCLUDED.median_rent_to_price_ratio,
      sample_size = EXCLUDED.sample_size,
      provisional = EXCLUDED.provisional,
      updated_at = now()
  `);

  await db.execute(sql`
    INSERT INTO market_report_metrics (
      period_type, period_start_date, period_end_date, province, city, property_type, strategy_type, metric_source,
      analysis_count, eligible_analysis_count, unique_user_count, average_yield, median_yield,
      average_cap_rate, median_cap_rate, average_cash_on_cash_return, median_cash_on_cash_return,
      average_dscr, median_dscr, average_monthly_cashflow_cents, median_monthly_cashflow_cents,
      average_sentiment_score, bullish_share, bearish_share, watchlist_rate, offer_candidate_rate,
      sample_size, provisional, updated_at
    )
    SELECT 'monthly', ${start}, ${end}, a.province, a.city, a.property_type, a.strategy_type, 'user_underwriting',
      COUNT(*)::int,
      COUNT(*) FILTER (WHERE COALESCE(q.leaderboard_eligible, true) IS NOT FALSE AND COALESCE(q.confidence_score::numeric, 0.65) >= 0.65)::int,
      COUNT(DISTINCT a.user_id)::int,
      AVG(NULLIF(a.calculated_metrics->>'capRate', '')::numeric),
      percentile_cont(0.5) WITHIN GROUP (ORDER BY NULLIF(a.calculated_metrics->>'capRate', '')::numeric),
      AVG(NULLIF(a.calculated_metrics->>'capRate', '')::numeric),
      percentile_cont(0.5) WITHIN GROUP (ORDER BY NULLIF(a.calculated_metrics->>'capRate', '')::numeric),
      AVG(NULLIF(a.calculated_metrics->>'cashOnCash', '')::numeric),
      percentile_cont(0.5) WITHIN GROUP (ORDER BY NULLIF(a.calculated_metrics->>'cashOnCash', '')::numeric),
      AVG(NULLIF(a.calculated_metrics->>'dscr', '')::numeric),
      percentile_cont(0.5) WITHIN GROUP (ORDER BY NULLIF(a.calculated_metrics->>'dscr', '')::numeric),
      AVG(NULLIF(a.calculated_metrics->>'monthlyCashFlow', '')::numeric * 100)::bigint,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY NULLIF(a.calculated_metrics->>'monthlyCashFlow', '')::numeric * 100)::bigint,
      AVG(ms.average_sentiment_score), AVG(ms.bullish_count::real / NULLIF(ms.sample_size, 0)), AVG(ms.bearish_count::real / NULLIF(ms.sample_size, 0)),
      AVG(ms.watchlist_count::real / NULLIF(ms.sample_size, 0)), AVG(ms.offer_candidate_count::real / NULLIF(ms.sample_size, 0)),
      COUNT(*)::int, COUNT(*) < 5, now()
    FROM property_analyses a
    LEFT JOIN analysis_quality_scores q ON q.property_analysis_id = a.id
    LEFT JOIN market_sentiment_rollups ms ON ms.period_start_date = ${start} AND ms.province = a.province AND LOWER(ms.city) = LOWER(a.city)
    WHERE a.created_at >= ${start} AND a.created_at < ${end} AND a.is_deleted = false
    GROUP BY a.province, a.city, a.property_type, a.strategy_type
    ON CONFLICT (period_start_date, province, city, neighborhood, property_type, strategy_type, metric_source) DO UPDATE SET
      analysis_count = EXCLUDED.analysis_count,
      eligible_analysis_count = EXCLUDED.eligible_analysis_count,
      unique_user_count = EXCLUDED.unique_user_count,
      average_yield = EXCLUDED.average_yield,
      median_yield = EXCLUDED.median_yield,
      average_cap_rate = EXCLUDED.average_cap_rate,
      median_cap_rate = EXCLUDED.median_cap_rate,
      average_cash_on_cash_return = EXCLUDED.average_cash_on_cash_return,
      median_cash_on_cash_return = EXCLUDED.median_cash_on_cash_return,
      average_dscr = EXCLUDED.average_dscr,
      median_dscr = EXCLUDED.median_dscr,
      average_monthly_cashflow_cents = EXCLUDED.average_monthly_cashflow_cents,
      median_monthly_cashflow_cents = EXCLUDED.median_monthly_cashflow_cents,
      average_sentiment_score = EXCLUDED.average_sentiment_score,
      bullish_share = EXCLUDED.bullish_share,
      bearish_share = EXCLUDED.bearish_share,
      watchlist_rate = EXCLUDED.watchlist_rate,
      offer_candidate_rate = EXCLUDED.offer_candidate_rate,
      sample_size = EXCLUDED.sample_size,
      provisional = EXCLUDED.provisional,
      updated_at = now()
  `);
  return { start, end };
}

function numberFrom(obj: any, keys: string[]) {
  for (const key of keys) {
    const value = obj?.[key];
    const numeric = typeof value === "string" ? Number(value) : value;
    if (typeof numeric === "number" && Number.isFinite(numeric)) return numeric;
  }
  return null;
}

export async function recordUnderwritingComparison(input: {
  analysisId?: string | null;
  propertyAnalysisId?: string | null;
  userId: string;
  listingKey?: string | null;
  province?: string | null;
  city?: string | null;
  propertyType?: string | null;
  strategyType?: string | null;
  userMetrics?: Record<string, unknown> | null;
  assumptions?: Record<string, unknown> | null;
}) {
  if (!input.listingKey) return null;
  const [auto] = await db.select().from(ddfListingSnapshots)
    .where(sql`${ddfListingSnapshots.listingKey} = ${input.listingKey} OR ${ddfListingSnapshots.mlsNumber} = ${input.listingKey}`)
    .orderBy(sql`${ddfListingSnapshots.capturedAt} DESC`)
    .limit(1);
  if (!auto) return null;

  const userYield = numberFrom(input.userMetrics, ["capRate", "grossYield", "gross_yield"]);
  const userCapRate = numberFrom(input.userMetrics, ["capRate", "cap_rate"]);
  const userCashflow = numberFrom(input.userMetrics, ["monthlyCashFlow", "monthly_cash_flow"]);
  const userRent = numberFrom(input.assumptions, ["monthlyRent", "rentPerUnit", "rent"]);
  const autoYield = auto.grossYield ?? null;
  const autoCapRate = auto.netYield ?? null;
  const autoCashflow = auto.estimatedNoi != null ? Math.round(auto.estimatedNoi / 12) : null;
  const autoRent = auto.estimatedMonthlyRent ?? null;

  const [row] = await db.insert(analysisUnderwritingComparisons).values({
    analysisId: input.analysisId || null,
    propertyAnalysisId: input.propertyAnalysisId || null,
    userId: input.userId,
    listingKey: input.listingKey,
    province: input.province || auto.province || null,
    city: input.city || auto.city || null,
    propertyType: input.propertyType || auto.propertySubType || null,
    strategyType: input.strategyType || null,
    autoYield,
    userYield,
    yieldDelta: userYield != null && autoYield != null ? userYield - autoYield : null,
    autoCapRate,
    userCapRate,
    capRateDelta: userCapRate != null && autoCapRate != null ? userCapRate - autoCapRate : null,
    autoCashflowCents: autoCashflow != null ? autoCashflow * 100 : null,
    userCashflowCents: userCashflow != null ? Math.round(userCashflow * 100) : null,
    cashflowDeltaCents: userCashflow != null && autoCashflow != null ? Math.round((userCashflow - autoCashflow) * 100) : null,
    autoRentAssumptionCents: autoRent != null ? Math.round(autoRent * 100) : null,
    userRentAssumptionCents: userRent != null ? Math.round(userRent * 100) : null,
    rentDeltaCents: userRent != null && autoRent != null ? Math.round((userRent - autoRent) * 100) : null,
    autoExpenseAssumption: { estimatedExpenses: auto.estimatedExpenses, estimatedNoi: auto.estimatedNoi },
    userExpenseAssumption: input.assumptions || null,
    expenseDelta: null,
    autoFinancingAssumption: null,
    userFinancingAssumption: input.assumptions || null,
    financingDelta: null,
    userChangedMajorAssumptions: Boolean(userRent != null && autoRent != null && Math.abs(userRent - autoRent) / Math.max(autoRent, 1) > 0.1),
    userMoreBullishThanAuto: userYield != null && autoYield != null ? userYield > autoYield + 0.5 : false,
    userMoreBearishThanAuto: userYield != null && autoYield != null ? userYield < autoYield - 0.5 : false,
  }).onConflictDoUpdate({
    target: analysisUnderwritingComparisons.analysisId,
    set: { updatedAt: new Date() },
  }).returning();
  return row;
}

export async function rebuildMarketIntelligence(anchor = new Date()) {
  await buildUserDealActivityRollups("monthly", anchor);
  await buildUserDealActivityRollups("all_time", anchor);
  await buildMarketSentimentRollups("monthly", anchor);
  await buildMarketReportMetrics(anchor);
  return { ok: true };
}
