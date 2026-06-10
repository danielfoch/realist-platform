-- 014_user_integrations.sql
-- Per-user OAuth connections (Google Sheets export, future integrations).
-- Tokens belong to the USER's account — exports land in their Drive, not ours.

CREATE TABLE IF NOT EXISTS user_integrations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(30) NOT NULL,            -- 'google'
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scope TEXT,
  external_email VARCHAR(255),              -- the connected Google account
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_integrations_user ON user_integrations (user_id, provider);
