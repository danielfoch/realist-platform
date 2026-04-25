-- Add referral_fee column to realtors table
-- Captures realtor's committed referral fee % for leads from the platform
-- Keep this migration self-contained for fresh CI databases where legacy partner tables are absent.

CREATE TABLE IF NOT EXISTS realtors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  brokerage TEXT NOT NULL,
  markets_served JSONB NOT NULL DEFAULT '[]',
  asset_types JSONB NOT NULL DEFAULT '[]',
  deal_types JSONB NOT NULL DEFAULT '[]',
  avg_deal_size TEXT,
  referral_agreement BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_realtors_status ON realtors(status);
CREATE INDEX IF NOT EXISTS idx_realtors_email ON realtors(email);

ALTER TABLE realtors ADD COLUMN IF NOT EXISTS referral_fee TEXT DEFAULT NULL;

COMMENT ON COLUMN realtors.referral_fee IS 'Realtor committed referral fee percentage (e.g. "25%", "30%", "Custom")';
