ALTER TABLE distress_snapshots
  ADD COLUMN IF NOT EXISTS queries_attempted integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS queries_succeeded integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS methodology_version text NOT NULL DEFAULT 'distress-v2',
  ADD COLUMN IF NOT EXISTS captured_at timestamp NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS distress_listing_observations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_month varchar(7) NOT NULL,
  listing_key varchar NOT NULL,
  mls_number varchar,
  province text NOT NULL,
  city text,
  postal_code varchar,
  list_price real,
  days_on_market integer,
  property_type text,
  distress_score integer NOT NULL,
  confidence text NOT NULL,
  primary_category text NOT NULL,
  foreclosure_pos boolean NOT NULL DEFAULT false,
  motivated boolean NOT NULL DEFAULT false,
  vtb boolean NOT NULL DEFAULT false,
  matched_terms_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  matched_search_terms_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  captured_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS distress_observations_month_listing_idx
  ON distress_listing_observations(snapshot_month, listing_key);

CREATE INDEX IF NOT EXISTS distress_observations_month_province_idx
  ON distress_listing_observations(snapshot_month, province);

CREATE INDEX IF NOT EXISTS distress_observations_listing_month_idx
  ON distress_listing_observations(listing_key, snapshot_month);

CREATE INDEX IF NOT EXISTS distress_observations_month_category_idx
  ON distress_listing_observations(snapshot_month, primary_category);
