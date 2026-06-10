-- 013_deal_desk_loop.sql
-- Realist Event + Deal Desk Loop v1
-- Adds the canonical opportunity/scoring/consent/trigger spine on top of
-- the existing user_events and deal_analyses tables.

-- Users created via Deal Desk submissions have no password yet
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- Link events to deals so underwriting actions become per-deal training signals
ALTER TABLE user_events ADD COLUMN IF NOT EXISTS deal_id INTEGER REFERENCES deal_analyses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_user_events_deal_id ON user_events (deal_id);

-- Deal score / verdict live on the analysis itself
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS deal_score INTEGER;
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS verdict VARCHAR(20);

-- ==================== OPPORTUNITIES ====================
-- The canonical record routing investor intent into the Deal Desk.
CREATE TABLE IF NOT EXISTS opportunities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deal_id INTEGER REFERENCES deal_analyses(id) ON DELETE SET NULL,
  intent_score INTEGER NOT NULL DEFAULT 0,
  deal_score INTEGER,
  status VARCHAR(30) NOT NULL DEFAULT 'new',
  -- new, hot, warm, nurture, contacted, booked_call, preapproval_started,
  -- buyer_agency_signed, showing_booked, offer_submitted, closed, lost
  assigned_to VARCHAR(100),
  suggested_next_action TEXT,
  source VARCHAR(50) DEFAULT 'deal_desk',
  financing_help BOOLEAN DEFAULT FALSE,
  buying_help BOOLEAN DEFAULT FALSE,
  lost_reason VARCHAR(100),
  notes TEXT,
  first_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities (status);
CREATE INDEX IF NOT EXISTS idx_opportunities_user ON opportunities (user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_score ON opportunities (intent_score DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_assigned ON opportunities (assigned_to);

-- ==================== ASSIGNMENTS ====================
CREATE TABLE IF NOT EXISTS assignments (
  id SERIAL PRIMARY KEY,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  assigned_to VARCHAR(100) NOT NULL,
  assigned_by VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignments_opportunity ON assignments (opportunity_id);

-- ==================== STATUS HISTORY ====================
CREATE TABLE IF NOT EXISTS status_history (
  id SERIAL PRIMARY KEY,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  old_status VARCHAR(30),
  new_status VARCHAR(30) NOT NULL,
  changed_by VARCHAR(100),
  lost_reason VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_history_opportunity ON status_history (opportunity_id);

-- ==================== EMAIL CONSENT ====================
-- CASL requires proof of when/how consent was obtained — append-only ledger,
-- latest row per (user, channel) wins.
CREATE TABLE IF NOT EXISTS email_consent (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel VARCHAR(10) NOT NULL DEFAULT 'email', -- email, sms
  status VARCHAR(10) NOT NULL,                  -- granted, revoked
  source VARCHAR(100),                          -- deal_desk_form, signup, unsubscribe_link...
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_consent_user ON email_consent (user_id, channel, created_at DESC);

-- ==================== EMAIL TRIGGERS ====================
-- Queue consumed by the email worker / Clyde. Behavioural emails only.
CREATE TABLE IF NOT EXISTS email_triggers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE SET NULL,
  trigger_type VARCHAR(60) NOT NULL,
  payload JSONB,
  status VARCHAR(10) NOT NULL DEFAULT 'pending', -- pending, sent, skipped
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_triggers_status ON email_triggers (status, created_at);
-- One pending trigger of a given type per user — sweeps are idempotent
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_triggers_dedupe
  ON email_triggers (user_id, trigger_type) WHERE status = 'pending';

-- ==================== UNDERWRITING ASSUMPTIONS ====================
-- One row per assumption per model run, with provenance. The gap between
-- defaults and user edits is the proprietary learning dataset.
CREATE TABLE IF NOT EXISTS underwriting_assumptions (
  id BIGSERIAL PRIMARY KEY,
  analysis_id INTEGER NOT NULL REFERENCES deal_analyses(id) ON DELETE CASCADE,
  key VARCHAR(60) NOT NULL,        -- monthly_rent, vacancy_rate, interest_rate...
  value TEXT NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'default', -- default, user_edited, comp_derived
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uw_assumptions_analysis ON underwriting_assumptions (analysis_id);
CREATE INDEX IF NOT EXISTS idx_uw_assumptions_key ON underwriting_assumptions (key, source);
