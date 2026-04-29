CREATE TABLE IF NOT EXISTS property_sale_estimates (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  listing_id varchar,
  listing_key text NOT NULL,
  mls_number text,
  board_listing_id text,
  board text,
  source_board text,
  province text,
  estimate_price_cents bigint NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'CAD',
  estimate_context jsonb,
  status text NOT NULL DEFAULT 'active',
  locked_at timestamp,
  resolved_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS property_sale_estimates_user_listing_idx
  ON property_sale_estimates(user_id, listing_key);

CREATE TABLE IF NOT EXISTS property_sale_estimate_revisions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id varchar NOT NULL REFERENCES property_sale_estimates(id),
  user_id varchar NOT NULL REFERENCES users(id),
  listing_key text NOT NULL,
  previous_estimate_price_cents bigint,
  estimate_price_cents bigint NOT NULL,
  revision_reason text NOT NULL,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listing_sale_resolutions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id varchar,
  listing_key text NOT NULL UNIQUE,
  mls_number text,
  board_listing_id text,
  board text,
  province text,
  ddf_last_seen_at timestamp,
  ddf_absent_since timestamp,
  absence_detection_count integer NOT NULL DEFAULT 0,
  absence_reason text NOT NULL DEFAULT 'still_active',
  resolution_status text NOT NULL DEFAULT 'not_started',
  actual_sale_price_cents bigint,
  sold_date timestamp,
  source_type text NOT NULL DEFAULT 'unavailable',
  source_name text,
  source_url text,
  source_confidence numeric(5,4),
  lookup_attempt_count integer NOT NULL DEFAULT 0,
  last_lookup_attempt_at timestamp,
  next_lookup_attempt_at timestamp,
  error_message text,
  exclude_from_metrics boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT listing_sale_resolved_price_positive CHECK (
    actual_sale_price_cents IS NULL OR actual_sale_price_cents > 0
  ),
  CONSTRAINT listing_sale_metrics_only_resolved CHECK (
    exclude_from_metrics = true
    OR (resolution_status = 'resolved' AND actual_sale_price_cents > 0)
  )
);

CREATE INDEX IF NOT EXISTS listing_sale_resolutions_lookup_idx
  ON listing_sale_resolutions(resolution_status, next_lookup_attempt_at);

CREATE TABLE IF NOT EXISTS user_sale_estimator_metrics (
  user_id varchar PRIMARY KEY REFERENCES users(id),
  eligible_estimate_count integer NOT NULL DEFAULT 0,
  resolved_estimate_count integer NOT NULL DEFAULT 0,
  unavailable_estimate_count integer NOT NULL DEFAULT 0,
  median_absolute_percentage_error real,
  mean_absolute_percentage_error real,
  trimmed_mean_absolute_percentage_error real,
  root_mean_squared_error_cents bigint,
  bias_percentage real,
  reliability_multiplier real NOT NULL DEFAULT 0,
  oracle_score real NOT NULL DEFAULT 0,
  last_recalculated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_activity_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar REFERENCES users(id),
  session_id varchar,
  event_name text NOT NULL,
  listing_id varchar,
  listing_key text,
  analysis_id varchar,
  event_timestamp timestamp NOT NULL DEFAULT now(),
  source_page text,
  component text,
  metadata jsonb,
  hashed_ip text,
  user_agent_hash text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_activity_events_user_time_idx
  ON user_activity_events(user_id, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS user_activity_events_listing_idx
  ON user_activity_events(listing_key);

CREATE TABLE IF NOT EXISTS user_inference_profiles (
  user_id varchar PRIMARY KEY REFERENCES users(id),
  preferred_markets jsonb,
  preferred_property_types jsonb,
  median_time_on_listing_card real,
  estimate_submission_rate real,
  estimator_accuracy_features jsonb,
  underwriting_assumption_patterns jsonb,
  analysis_quality_features jsonb,
  anti_spam_features jsonb,
  last_feature_build_at timestamp
);

CREATE TABLE IF NOT EXISTS analysis_quality_scores (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id varchar REFERENCES analyses(id),
  property_analysis_id varchar REFERENCES property_analyses(id),
  user_id varchar NOT NULL REFERENCES users(id),
  listing_id varchar,
  listing_key text,
  quality_score real NOT NULL,
  confidence_score real NOT NULL,
  plausibility_score real NOT NULL,
  interaction_depth_score real NOT NULL,
  data_completeness_score real NOT NULL,
  uniqueness_score real NOT NULL,
  deal_viability_score real NOT NULL,
  spam_risk_score real NOT NULL,
  leaderboard_eligible boolean NOT NULL DEFAULT false,
  exclusion_reason text,
  computed_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS analysis_quality_scores_analysis_idx
  ON analysis_quality_scores(analysis_id)
  WHERE analysis_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS analysis_quality_scores_property_analysis_idx
  ON analysis_quality_scores(property_analysis_id)
  WHERE property_analysis_id IS NOT NULL;
