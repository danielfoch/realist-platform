-- Extensions required for location indexes.
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- Sync run tracking for observability and /metrics endpoint.
CREATE TABLE IF NOT EXISTS sync_runs (
  id BIGSERIAL PRIMARY KEY,
  status VARCHAR(20) NOT NULL,
  incremental_sync BOOLEAN NOT NULL DEFAULT true,
  batch_size INTEGER NOT NULL,
  processed_count INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_created_at ON sync_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON sync_runs(status);

-- Additional listing indexes for common API filters.
CREATE INDEX IF NOT EXISTS idx_listings_synced_at ON listings(synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_province_price ON listings(address_province, list_price);
CREATE INDEX IF NOT EXISTS idx_listings_city_status ON listings(address_city, status);
CREATE INDEX IF NOT EXISTS idx_listings_ddf_modified ON listings(ddf_last_modified DESC);
CREATE INDEX IF NOT EXISTS idx_listings_active_price ON listings(list_price) WHERE status = 'Active';
CREATE INDEX IF NOT EXISTS idx_listing_history_changed_at ON listing_history(changed_at DESC);

-- Optional partitioned table strategy for high-volume growth.
-- This does not replace the current listings table automatically.
CREATE TABLE IF NOT EXISTS listings_partitioned (
  LIKE listings INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING STORAGE
) PARTITION BY LIST (address_province);

DO $$
DECLARE
  prov TEXT;
BEGIN
  FOREACH prov IN ARRAY ARRAY['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT']
  LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS listings_partitioned_%I PARTITION OF listings_partitioned FOR VALUES IN (%L);',
      lower(prov),
      prov
    );
  END LOOP;

  EXECUTE 'CREATE TABLE IF NOT EXISTS listings_partitioned_other PARTITION OF listings_partitioned DEFAULT';
END
$$;

CREATE INDEX IF NOT EXISTS idx_listings_partitioned_mls ON listings_partitioned(mls_number);
CREATE INDEX IF NOT EXISTS idx_listings_partitioned_status_price ON listings_partitioned(status, list_price);

-- Optional helper function for future migration of live data.
CREATE OR REPLACE FUNCTION migrate_listings_to_partitioned(limit_count INTEGER DEFAULT 10000)
RETURNS INTEGER AS $$
DECLARE
  moved_count INTEGER;
BEGIN
  WITH moved AS (
    DELETE FROM listings
    WHERE id IN (SELECT id FROM listings ORDER BY id LIMIT limit_count)
    RETURNING *
  )
  INSERT INTO listings_partitioned
  SELECT * FROM moved;

  GET DIAGNOSTICS moved_count = ROW_COUNT;
  RETURN moved_count;
END;
$$ LANGUAGE plpgsql;
