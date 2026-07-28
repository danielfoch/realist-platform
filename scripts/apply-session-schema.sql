-- Targeted schema changes for the lead-capture / multiplex-flywheel work.
--
-- USE THIS INSTEAD OF `npm run db:push` for now.
--
-- Why: drizzle-kit push compares shared/schema.ts against the live database and
-- reconciles the whole thing. This database has at least 13 tables that were
-- created by raw `CREATE TABLE IF NOT EXISTS` at boot and never declared in
-- drizzle — toronto_parcels, building_permits, coa_applications,
-- census_da_profiles, census_da_boundaries, assessment_units, municipal_wards,
-- development_applications, professional_profiles, data_layers,
-- power_team_waitlist, field_note_endorsements, field_note_leads.
--
-- push does not know those are real, so it offers to "rename" them into
-- whichever new table it is trying to create. Accepting one renames live data
-- out of existence. It is also liable to propose dropping the rest.
--
-- Everything below is additive and idempotent: no DROP, no ALTER of an existing
-- column, no rename. Safe to run more than once.
--
--   psql "$DATABASE_URL" -f scripts/apply-session-schema.sql
--
-- The wider drift (schema.ts vs database) is worth fixing properly later, by
-- declaring those 13 tables in drizzle so push stops treating them as strays.

BEGIN;

-- ── Durable per-day usage caps (server/usageLimits.ts) ──────────────────────
-- Replaces the in-process Map that reset on every Replit restart, which made
-- the free-tier underwrite cap leak.
CREATE TABLE IF NOT EXISTS usage_counters (
  scope      varchar(64)  NOT NULL,
  key        varchar(128) NOT NULL,
  day        varchar(10)  NOT NULL,
  count      integer      NOT NULL DEFAULT 0,
  updated_at timestamp    NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key, day)
);

CREATE INDEX IF NOT EXISTS idx_usage_counters_day
  ON usage_counters (day);

-- ── FSA-level multiplex demand rollups (server/multiplexMarketRollups.ts) ───
CREATE TABLE IF NOT EXISTS multiplex_market_rollups (
  id                    varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  postal_fsa            varchar(3) NOT NULL,
  period_month          timestamp  NOT NULL,
  underwrite_count      integer    NOT NULL DEFAULT 0,
  distinct_user_count   integer    NOT NULL DEFAULT 0,
  median_purchase_price real,
  median_max_units      real,
  sixplex_eligible_rate real,
  hold_preference_rate  real,
  median_yield_on_cost  real,
  rebuilt_at            timestamp  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_multiplex_rollup_fsa_month
  ON multiplex_market_rollups (postal_fsa, period_month);

CREATE INDEX IF NOT EXISTS idx_multiplex_rollup_month
  ON multiplex_market_rollups (period_month);

-- ── multiplex_underwritings: indexes + the FK it never had ──────────────────
-- The table already exists (raw DDL at boot). Only adding what is missing.
CREATE INDEX IF NOT EXISTS idx_multiplex_uw_fsa_created
  ON multiplex_underwritings (postal_fsa, created_at);

CREATE INDEX IF NOT EXISTS idx_multiplex_uw_session
  ON multiplex_underwritings (session_id);

-- prepare-multiplex-migration.ts reported 0 orphans, so this is safe. Guarded
-- so a re-run does not error on the existing constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'multiplex_underwritings_user_id_users_id_fk'
  ) THEN
    ALTER TABLE multiplex_underwritings
      ADD CONSTRAINT multiplex_underwritings_user_id_users_id_fk
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── opportunities: serve the 5-minute SLA sweep and the alert throttle ──────
-- Partial index: the sweep only ever looks at uncontacted rows.
CREATE INDEX IF NOT EXISTS idx_opportunities_sla_open
  ON opportunities (intent_score, status, created_at)
  WHERE first_contacted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_lead_created
  ON opportunities (lead_id, created_at);

COMMIT;

-- Sanity check — expect both new tables and all five indexes present:
--   \d usage_counters
--   \d multiplex_market_rollups
--   SELECT indexname FROM pg_indexes
--    WHERE indexname LIKE 'idx_multiplex%' OR indexname LIKE 'idx_opportunities%'
--       OR indexname LIKE 'idx_usage_counters%';
