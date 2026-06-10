-- 015_analysis_shares.sql
-- Share a deal analysis with someone. Viewing the full analysis requires an
-- account — shares are an acquisition surface, and share acceptance is a
-- high-intent training signal.

CREATE TABLE IF NOT EXISTS analysis_shares (
  id SERIAL PRIMARY KEY,
  analysis_id INTEGER NOT NULL REFERENCES deal_analyses(id) ON DELETE CASCADE,
  owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255),
  token VARCHAR(64) UNIQUE NOT NULL,
  status VARCHAR(15) NOT NULL DEFAULT 'pending',  -- pending, accepted, revoked
  accepted_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_analysis_shares_token ON analysis_shares (token);
CREATE INDEX IF NOT EXISTS idx_analysis_shares_owner ON analysis_shares (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_shares_analysis ON analysis_shares (analysis_id);
