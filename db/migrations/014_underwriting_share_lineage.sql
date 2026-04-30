-- Track share lineage for the viral underwriting loop.
-- Lets a recipient challenge/fork assumptions, save a version, and immediately share that version onward.

ALTER TABLE underwriting_shares
  ADD COLUMN IF NOT EXISTS parent_share_id INTEGER REFERENCES underwriting_shares(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_share_action_id INTEGER REFERENCES underwriting_share_actions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS share_depth INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_underwriting_shares_parent
  ON underwriting_shares(parent_share_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_underwriting_shares_depth
  ON underwriting_shares(share_depth, created_at DESC);

COMMENT ON COLUMN underwriting_shares.parent_share_id IS 'Previous underwriting share that caused this challenged/forked version to be shared onward.';
COMMENT ON COLUMN underwriting_shares.parent_share_action_id IS 'Qualified fork/saved_version action that produced this onward share.';
COMMENT ON COLUMN underwriting_shares.share_depth IS 'Viral loop depth: original owner share = 0, recipient onward share = 1, and so on.';
