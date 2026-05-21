-- Viral underwriting sharing loop
-- Analyze deal -> Share underwriting -> Recipient challenges/forks assumptions -> Account/save version -> Share onward
-- Credits are granted only for qualified actions, never for raw share clicks alone.

CREATE TABLE IF NOT EXISTS underwriting_shares (
  id SERIAL PRIMARY KEY,
  analysis_id INTEGER NOT NULL REFERENCES deal_analyses(id) ON DELETE CASCADE,
  inviter_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  token VARCHAR(48) UNIQUE NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  source VARCHAR(64) NOT NULL DEFAULT 'analysis',
  qualified_action_count INTEGER NOT NULL DEFAULT 0,
  credit_awarded INTEGER NOT NULL DEFAULT 0,
  last_qualified_action_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS underwriting_share_actions (
  id SERIAL PRIMARY KEY,
  share_id INTEGER NOT NULL REFERENCES underwriting_shares(id) ON DELETE CASCADE,
  action VARCHAR(32) NOT NULL CHECK (action IN ('unique_open', 'challenge', 'fork', 'signup', 'saved_version')),
  recipient_hash CHAR(64) NOT NULL,
  qualified BOOLEAN NOT NULL DEFAULT false,
  credit_type VARCHAR(64) NOT NULL DEFAULT 'google_sheets_export',
  credit_amount INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS premium_credit_ledger (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_id INTEGER REFERENCES underwriting_shares(id) ON DELETE SET NULL,
  share_action_id INTEGER REFERENCES underwriting_share_actions(id) ON DELETE SET NULL,
  credit_type VARCHAR(64) NOT NULL DEFAULT 'google_sheets_export',
  credit_amount INTEGER NOT NULL CHECK (credit_amount > 0),
  reason TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_underwriting_shares_token ON underwriting_shares(token);
CREATE INDEX IF NOT EXISTS idx_underwriting_shares_analysis ON underwriting_shares(analysis_id);
CREATE INDEX IF NOT EXISTS idx_underwriting_shares_inviter ON underwriting_shares(inviter_user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_underwriting_share_actions_once
  ON underwriting_share_actions(share_id, recipient_hash, action);
CREATE INDEX IF NOT EXISTS idx_underwriting_share_actions_daily_share
  ON underwriting_share_actions(share_id, action, created_at)
  WHERE qualified = true;
CREATE INDEX IF NOT EXISTS idx_underwriting_share_actions_daily_recipient
  ON underwriting_share_actions(recipient_hash, action, created_at)
  WHERE qualified = true;
CREATE INDEX IF NOT EXISTS idx_premium_credit_ledger_user
  ON premium_credit_ledger(user_id, credit_type, created_at DESC);
