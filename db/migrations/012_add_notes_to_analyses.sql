-- Add notes column to deal_analyses for investor underwriting reasoning
-- Supports Non-Negotiable #4: Analysis Memory
ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS notes TEXT;
