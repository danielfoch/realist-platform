-- Investor Registration & Profile Migration
-- Supports self-service investor signup with structured profile capture

-- Investor profiles table (links to shared users table)
CREATE TABLE IF NOT EXISTS investor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id),
  strategy TEXT[],
  preferred_cities TEXT,
  budget_range TEXT,
  property_types TEXT[],
  experience_level TEXT,
  lead_source TEXT DEFAULT 'organic',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agreement acceptance tracking (used by both investors and realtors)
CREATE TABLE IF NOT EXISTS agreement_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id),
  agreement_type TEXT NOT NULL, -- 'platform_terms', 'referral_agreement', etc.
  accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT
);

-- Update analyzed_deals to reference users if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analyzed_deals') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'analyzed_deals' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE analyzed_deals ADD COLUMN user_id INTEGER;
    END IF;
  END IF;
END $$;
