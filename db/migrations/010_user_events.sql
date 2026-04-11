-- 010_user_events.sql
-- Event tracking for key user actions

CREATE TABLE IF NOT EXISTS user_events (
  id            BIGSERIAL PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event         VARCHAR(100)  NOT NULL,
  properties    JSONB,
  session_id    VARCHAR(100),
  ip_address    INET,
  user_agent    TEXT,
  referrer      TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_user_events_event        ON user_events (event);
CREATE INDEX IF NOT EXISTS idx_user_events_user_id      ON user_events (user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_created_at   ON user_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_event_created ON user_events (event, created_at DESC);

-- Helper: quick event counts by type over last N days
COMMENT ON TABLE user_events IS 'Tracks key user actions (page views, signups, searches, etc.) for analytics.';