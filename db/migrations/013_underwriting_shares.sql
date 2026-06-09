-- Viral underwriting loop: share, challenge/fork, and qualified reward tracking.
-- Credits are only awarded for qualified actions, never raw share clicks.
CREATE TABLE IF NOT EXISTS underwriting_shares (
  id SERIAL PRIMARY KEY,
  analysis_id INTEGER NOT NULL REFERENCES deal_analyses(id) ON DELETE CASCADE,
  owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  share_token TEXT NOT NULL UNIQUE,
  recipient_email_hash TEXT,
  cta TEXT NOT NULL DEFAULT 'Challenge my underwriting.',
  reward_status TEXT NOT NULL DEFAULT 'pending',
  qualified_action_count INTEGER NOT NULL DEFAULT 0,
  export_credit_balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS underwriting_share_actions (
  id SERIAL PRIMARY KEY,
  share_id INTEGER NOT NULL REFERENCES underwriting_shares(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  visitor_key TEXT,
  recipient_email_hash TEXT,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  qualified BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'tracked',
  credit_delta INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT underwriting_share_actions_action_type_check CHECK (
    action_type IN ('share_click', 'unique_open', 'fork_challenge', 'signup', 'saved_version')
  ),
  CONSTRAINT underwriting_share_actions_status_check CHECK (
    status IN ('tracked', 'qualified', 'duplicate', 'capped', 'unqualified')
  )
);

CREATE INDEX IF NOT EXISTS idx_underwriting_shares_token ON underwriting_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_underwriting_shares_analysis ON underwriting_shares(analysis_id);
CREATE INDEX IF NOT EXISTS idx_underwriting_share_actions_share ON underwriting_share_actions(share_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_underwriting_share_actions_identity
  ON underwriting_share_actions(share_id, action_type, visitor_key, recipient_email_hash, actor_user_id);
