-- Migration: Add rent pulse and rent listings tables
-- Created: 2026-03-20

CREATE TABLE IF NOT EXISTS rent_pulse (
  id SERIAL PRIMARY KEY,
  city VARCHAR(100) NOT NULL,
  province VARCHAR(2) NOT NULL,
  bedrooms VARCHAR(10) NOT NULL,
  median_rent INTEGER,
  avg_rent INTEGER,
  min_rent INTEGER,
  max_rent INTEGER,
  sample_size INTEGER,
  source VARCHAR(20),
  scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rent_listings (
  id SERIAL PRIMARY KEY,
  city VARCHAR(100) NOT NULL,
  province VARCHAR(2) NOT NULL,
  title VARCHAR(500),
  price INTEGER NOT NULL,
  bedrooms INTEGER,
  bathrooms INTEGER,
  address TEXT,
  lat DECIMAL(10, 7),
  lng DECIMAL(10, 7),
  source VARCHAR(20) NOT NULL,
  source_url TEXT,
  source_id VARCHAR(100) UNIQUE,
  scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rent_pulse_city_province ON rent_pulse(city, province);
CREATE INDEX IF NOT EXISTS idx_rent_pulse_scraped_at ON rent_pulse(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_rent_listings_city ON rent_listings(city);
CREATE INDEX IF NOT EXISTS idx_rent_listings_source_id ON rent_listings(source_id);

COMMENT ON TABLE rent_pulse IS 'City-level rent data for cap rate and yield calculations';
COMMENT ON TABLE rent_listings IS 'Individual rental listings from scrapers';
