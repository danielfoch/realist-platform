-- Add deal_analyses table and notes column for investor underwriting reasoning
-- Supports Non-Negotiable #4: Analysis Memory

CREATE TABLE IF NOT EXISTS deal_analyses (
  id SERIAL PRIMARY KEY,
  property_address TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  metrics JSONB,
  inputs JSONB,
  verdict_check TEXT DEFAULT '✅ Strong',
  listing_id TEXT,
  city TEXT,
  province TEXT,
  property_type TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  sqft INTEGER,
  year_built INTEGER,
  matched_listing BOOLEAN,
  analyzed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_analyses_user ON deal_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_analyses_analyzed_at ON deal_analyses(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_analyses_listing ON deal_analyses(listing_id);

ALTER TABLE deal_analyses ADD COLUMN IF NOT EXISTS notes TEXT;
