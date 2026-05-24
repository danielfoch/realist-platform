-- Redeem qualified underwriting share credits for premium actions.
-- Earnings remain in premium_credit_ledger and are only created from qualified share actions.
-- Redemptions let Replit gate Google Sheets exports without ever rewarding raw share clicks.

CREATE TABLE IF NOT EXISTS premium_credit_redemptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credit_type VARCHAR(64) NOT NULL DEFAULT 'google_sheets_export',
  credit_amount INTEGER NOT NULL CHECK (credit_amount > 0),
  reason TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_premium_credit_redemptions_user
  ON premium_credit_redemptions(user_id, credit_type, created_at DESC);

COMMENT ON TABLE premium_credit_redemptions IS 'Spend ledger for premium credits earned from qualified underwriting share actions.';
COMMENT ON COLUMN premium_credit_redemptions.credit_amount IS 'Positive amount consumed from earned premium_credit_ledger balance.';
