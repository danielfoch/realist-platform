-- Add referral_fee column to realtors table
-- Captures realtor's committed referral fee % for leads from the platform

ALTER TABLE realtors ADD COLUMN IF NOT EXISTS referral_fee TEXT DEFAULT NULL;

COMMENT ON COLUMN realtors.referral_fee IS 'Realtor committed referral fee percentage (e.g. "25%", "30%", "Custom")';
