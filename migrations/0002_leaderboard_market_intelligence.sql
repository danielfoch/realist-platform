CREATE TABLE IF NOT EXISTS leaderboard_periods (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type text NOT NULL,
  period_start_date timestamp NOT NULL,
  period_end_date timestamp NOT NULL,
  status text NOT NULL DEFAULT 'open',
  finalized_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_periods_type_start_idx ON leaderboard_periods(period_type, period_start_date);

CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_period_id varchar NOT NULL REFERENCES leaderboard_periods(id),
  category text NOT NULL DEFAULT 'overall',
  generated_at timestamp NOT NULL DEFAULT now(),
  snapshot_version text NOT NULL DEFAULT 'leaderboard-v1',
  metadata jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_snapshots_period_category_idx ON leaderboard_snapshots(leaderboard_period_id, category, snapshot_version);

CREATE TABLE IF NOT EXISTS leaderboard_snapshot_entries (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_snapshot_id varchar NOT NULL REFERENCES leaderboard_snapshots(id),
  user_id varchar NOT NULL REFERENCES users(id),
  rank integer NOT NULL,
  previous_rank integer,
  rank_change integer,
  score real NOT NULL,
  weighted_score real NOT NULL,
  total_deals_analyzed integer NOT NULL DEFAULT 0,
  monthly_deals_analyzed integer NOT NULL DEFAULT 0,
  eligible_analyses_count integer NOT NULL DEFAULT 0,
  excluded_analyses_count integer NOT NULL DEFAULT 0,
  average_confidence_score real,
  market_oracle_score real,
  sale_prediction_median_error real,
  eligible_sale_predictions_count integer NOT NULL DEFAULT 0,
  auto_underwritten_avg_yield real,
  user_underwritten_avg_yield real,
  user_vs_auto_yield_delta real,
  kpis jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_snapshot_entries_snapshot_user_idx ON leaderboard_snapshot_entries(leaderboard_snapshot_id, user_id);

CREATE TABLE IF NOT EXISTS user_deal_activity_rollups (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  period_type text NOT NULL,
  period_start_date timestamp NOT NULL,
  period_end_date timestamp NOT NULL,
  total_deals_analyzed integer NOT NULL DEFAULT 0,
  eligible_deals_analyzed integer NOT NULL DEFAULT 0,
  excluded_or_low_confidence_deals integer NOT NULL DEFAULT 0,
  unique_listings_analyzed integer NOT NULL DEFAULT 0,
  unique_markets_analyzed integer NOT NULL DEFAULT 0,
  average_analysis_confidence_score real,
  median_time_per_analysis_seconds real,
  total_listing_cards_opened integer NOT NULL DEFAULT 0,
  total_underwriting_sessions integer NOT NULL DEFAULT 0,
  total_saved_or_exported_analyses integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_deal_activity_rollups_user_period_idx ON user_deal_activity_rollups(user_id, period_type, period_start_date);

CREATE TABLE IF NOT EXISTS market_sentiment_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar REFERENCES users(id),
  session_id varchar,
  listing_id varchar,
  listing_key text,
  analysis_id varchar,
  event_name text NOT NULL,
  event_timestamp timestamp NOT NULL DEFAULT now(),
  province text,
  city text,
  neighborhood text,
  property_type text,
  price_band text,
  strategy_type text,
  source text NOT NULL,
  sentiment_score real,
  confidence_score real,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS market_sentiment_events_market_time_idx ON market_sentiment_events(province, city, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS market_sentiment_events_user_time_idx ON market_sentiment_events(user_id, event_timestamp DESC);

CREATE TABLE IF NOT EXISTS market_sentiment_rollups (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type text NOT NULL,
  period_start_date timestamp NOT NULL,
  period_end_date timestamp NOT NULL,
  province text,
  city text,
  neighborhood text,
  property_type text,
  strategy_type text,
  total_listing_views integer NOT NULL DEFAULT 0,
  unique_users integer NOT NULL DEFAULT 0,
  total_underwrites integer NOT NULL DEFAULT 0,
  eligible_underwrites integer NOT NULL DEFAULT 0,
  watchlist_count integer NOT NULL DEFAULT 0,
  bullish_count integer NOT NULL DEFAULT 0,
  bearish_count integer NOT NULL DEFAULT 0,
  pass_count integer NOT NULL DEFAULT 0,
  offer_candidate_count integer NOT NULL DEFAULT 0,
  average_sentiment_score real,
  median_user_estimated_sale_to_list_ratio real,
  average_user_estimated_sale_to_list_ratio real,
  median_user_vs_list_delta real,
  median_user_vs_auto_model_delta real,
  average_analysis_confidence_score real,
  sample_size integer NOT NULL DEFAULT 0,
  provisional boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS market_sentiment_rollups_period_market_idx ON market_sentiment_rollups(period_type, period_start_date, province, city, neighborhood, property_type, strategy_type);

CREATE TABLE IF NOT EXISTS market_report_metrics (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type text NOT NULL DEFAULT 'monthly',
  period_start_date timestamp NOT NULL,
  period_end_date timestamp NOT NULL,
  province text,
  city text,
  neighborhood text,
  property_type text,
  strategy_type text,
  metric_source text NOT NULL,
  listing_count integer NOT NULL DEFAULT 0,
  analysis_count integer NOT NULL DEFAULT 0,
  eligible_analysis_count integer NOT NULL DEFAULT 0,
  unique_user_count integer,
  average_yield real,
  median_yield real,
  average_cap_rate real,
  median_cap_rate real,
  average_cash_on_cash_return real,
  median_cash_on_cash_return real,
  average_dscr real,
  median_dscr real,
  average_monthly_cashflow_cents bigint,
  median_monthly_cashflow_cents bigint,
  average_price_cents bigint,
  median_price_cents bigint,
  average_rent_cents bigint,
  median_rent_cents bigint,
  average_rent_to_price_ratio real,
  median_rent_to_price_ratio real,
  average_sentiment_score real,
  bullish_share real,
  bearish_share real,
  watchlist_rate real,
  offer_candidate_rate real,
  average_sale_prediction_to_list_ratio real,
  sample_size integer NOT NULL DEFAULT 0,
  provisional boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS market_report_metrics_period_market_source_idx ON market_report_metrics(period_start_date, province, city, neighborhood, property_type, strategy_type, metric_source);

CREATE TABLE IF NOT EXISTS analysis_underwriting_comparisons (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id varchar REFERENCES analyses(id),
  property_analysis_id varchar REFERENCES property_analyses(id),
  user_id varchar NOT NULL REFERENCES users(id),
  listing_key text,
  province text,
  city text,
  property_type text,
  strategy_type text,
  auto_yield real,
  user_yield real,
  yield_delta real,
  auto_cap_rate real,
  user_cap_rate real,
  cap_rate_delta real,
  auto_cashflow_cents bigint,
  user_cashflow_cents bigint,
  cashflow_delta_cents bigint,
  auto_rent_assumption_cents bigint,
  user_rent_assumption_cents bigint,
  rent_delta_cents bigint,
  auto_expense_assumption jsonb,
  user_expense_assumption jsonb,
  expense_delta jsonb,
  auto_financing_assumption jsonb,
  user_financing_assumption jsonb,
  financing_delta jsonb,
  user_changed_major_assumptions boolean NOT NULL DEFAULT false,
  user_more_bullish_than_auto boolean NOT NULL DEFAULT false,
  user_more_bearish_than_auto boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS analysis_underwriting_comparisons_analysis_idx ON analysis_underwriting_comparisons(analysis_id) WHERE analysis_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS analysis_underwriting_comparisons_property_analysis_idx ON analysis_underwriting_comparisons(property_analysis_id) WHERE property_analysis_id IS NOT NULL;
