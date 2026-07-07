ALTER TABLE referral_outcomes
  ADD COLUMN IF NOT EXISTS financing_intent BOOLEAN,
  ADD COLUMN IF NOT EXISTS buying_intent BOOLEAN,
  ADD COLUMN IF NOT EXISTS partner_writeback_at TIMESTAMP;
