-- Migration 016: US listings support (HomeHarvest import)
-- Adds a source column to distinguish CREA DDF listings from HomeHarvest (US) imports,
-- plus indexes for country/source filtering.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'ddf';

-- Backfill existing rows (all pre-existing listings come from CREA DDF)
UPDATE listings SET source = 'ddf' WHERE source IS NULL;

CREATE INDEX IF NOT EXISTS idx_listings_country ON listings(address_country);
CREATE INDEX IF NOT EXISTS idx_listings_source ON listings(source);

COMMENT ON COLUMN listings.source IS 'Data source: ddf (CREA DDF) or homeharvest (US Realtor.com via HomeHarvest)';
