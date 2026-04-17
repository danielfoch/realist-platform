-- CREA DDF IDX Database Schema for Realist.ca
-- PostgreSQL Migration

CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- Brokerages table
CREATE TABLE IF NOT EXISTS brokerages (
  id SERIAL PRIMARY KEY,
  brokerage_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  province VARCHAR(2),
  postal_code VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR(100) UNIQUE NOT NULL,
  brokerage_id INTEGER REFERENCES brokerages(id) ON DELETE SET NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  full_name VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  photo_url TEXT,
  designation VARCHAR(100), -- REALTOR®, Broker, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Main listings table
CREATE TABLE IF NOT EXISTS listings (
  id SERIAL PRIMARY KEY,
  mls_number VARCHAR(50) UNIQUE NOT NULL,
  
  -- Status and dates
  status VARCHAR(20) NOT NULL, -- Active, Sold, Pending, Expired, Cancelled
  list_date DATE,
  sold_date DATE,
  expiry_date DATE,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Property details
  property_type VARCHAR(50), -- Residential, Commercial, Land, etc.
  structure_type VARCHAR(50), -- House, Condo, Townhouse, etc.
  address_street VARCHAR(255),
  address_unit VARCHAR(50),
  address_city VARCHAR(100),
  address_province VARCHAR(2),
  address_postal_code VARCHAR(10),
  address_country VARCHAR(3) DEFAULT 'CAN',
  
  -- Location
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  
  -- Pricing
  list_price DECIMAL(12, 2),
  sold_price DECIMAL(12, 2),
  original_price DECIMAL(12, 2),
  tax_amount DECIMAL(10, 2),
  tax_year INTEGER,
  
  -- Property features
  bedrooms INTEGER,
  bedrooms_plus INTEGER, -- Additional rooms (dens, flex spaces)
  bathrooms_full INTEGER,
  bathrooms_half INTEGER,
  square_footage INTEGER,
  lot_size_sqft INTEGER,
  lot_size_acres DECIMAL(10, 4),
  year_built INTEGER,
  parking_spaces INTEGER,
  parking_type VARCHAR(100),
  garage_spaces INTEGER,
  
  -- Building details (for condos/apartments)
  building_name VARCHAR(255),
  unit_number VARCHAR(50),
  total_units INTEGER,
  stories INTEGER,
  
  -- Additional features
  basement VARCHAR(100),
  heating VARCHAR(100),
  cooling VARCHAR(100),
  exterior VARCHAR(100),
  pool VARCHAR(50),
  fireplace_count INTEGER,
  locker VARCHAR(50),
  
  -- Descriptions
  public_remarks TEXT,
  private_remarks TEXT,
  
  -- Zoning and restrictions
  zoning VARCHAR(100),
  restriction VARCHAR(255),
  
  -- Ownership and fees
  ownership_type VARCHAR(50), -- Freehold, Condo, Co-op, Leasehold
  maintenance_fee DECIMAL(10, 2),
  maintenance_fee_frequency VARCHAR(20), -- Monthly, Quarterly, Annual
  
  -- Utilities included
  utilities_included TEXT[],
  
  -- Agent and brokerage references
  listing_agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
  listing_brokerage_id INTEGER REFERENCES brokerages(id) ON DELETE SET NULL,
  co_listing_agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
  
  -- Investment metrics (calculated fields)
  estimated_monthly_rent DECIMAL(10, 2),
  cap_rate DECIMAL(5, 2), -- Percentage
  gross_yield DECIMAL(5, 2), -- Percentage
  cash_flow_monthly DECIMAL(10, 2),
  rent_data_source VARCHAR(50),
  rent_data_updated_at TIMESTAMP,
  
  -- Virtual tour and media
  virtual_tour_url TEXT,
  video_url TEXT,
  
  -- Raw DDF data (store original XML/JSON for reference)
  raw_data JSONB,
  
  -- Sync metadata
  ddf_last_modified TIMESTAMP,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Listing photos table
CREATE TABLE IF NOT EXISTS listing_photos (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  photo_key VARCHAR(255), -- S3/storage key if we host locally
  sequence_number INTEGER DEFAULT 0, -- Order of photos
  is_primary BOOLEAN DEFAULT false,
  caption TEXT,
  last_modified TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Listing rooms table (detailed room information)
CREATE TABLE IF NOT EXISTS listing_rooms (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  room_type VARCHAR(50), -- Bedroom, Kitchen, Living Room, etc.
  room_level VARCHAR(50), -- Main, Upper, Lower, Basement
  dimensions VARCHAR(50), -- e.g., "12x15"
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Listing history table (track price changes and status updates)
CREATE TABLE IF NOT EXISTS listing_history (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  change_type VARCHAR(20), -- price_change, status_change
  old_value VARCHAR(255),
  new_value VARCHAR(255),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

-- Saved searches for users (future feature)
CREATE TABLE IF NOT EXISTS saved_searches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER, -- Reference to users table (if you have one)
  search_name VARCHAR(255),
  filters JSONB, -- Store search criteria
  notify_frequency VARCHAR(20), -- immediate, daily, weekly
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User favorites (future feature)
CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER, -- Reference to users table
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_listings_mls ON listings(mls_number);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_location ON listings(address_city, address_province);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(list_price);
CREATE INDEX IF NOT EXISTS idx_listings_type ON listings(property_type, structure_type);
CREATE INDEX IF NOT EXISTS idx_listings_dates ON listings(list_date, sold_date);
CREATE INDEX IF NOT EXISTS idx_listings_cap_rate ON listings(cap_rate) WHERE cap_rate IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_geom ON listings USING GIST (
  ll_to_earth(latitude, longitude)
) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_photos_listing ON listing_photos(listing_id);
CREATE INDEX IF NOT EXISTS idx_photos_primary ON listing_photos(listing_id, is_primary);

CREATE INDEX IF NOT EXISTS idx_agents_brokerage ON agents(brokerage_id);
CREATE INDEX IF NOT EXISTS idx_history_listing ON listing_history(listing_id);

-- Create materialized view for investment properties
CREATE MATERIALIZED VIEW IF NOT EXISTS investment_listings AS
SELECT 
  l.*,
  a.full_name as agent_name,
  a.phone as agent_phone,
  a.email as agent_email,
  b.name as brokerage_name,
  (
    SELECT photo_url 
    FROM listing_photos 
    WHERE listing_id = l.id AND is_primary = true 
    LIMIT 1
  ) as primary_photo,
  (
    SELECT COUNT(*) 
    FROM listing_photos 
    WHERE listing_id = l.id
  ) as photo_count
FROM listings l
LEFT JOIN agents a ON l.listing_agent_id = a.id
LEFT JOIN brokerages b ON l.listing_brokerage_id = b.id
WHERE l.status = 'Active' 
  AND l.cap_rate IS NOT NULL
ORDER BY l.cap_rate DESC;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_investment_listings_id ON investment_listings(id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
CREATE TRIGGER update_listings_updated_at BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brokerages_updated_at BEFORE UPDATE ON brokerages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to refresh investment_listings view
CREATE OR REPLACE FUNCTION refresh_investment_listings()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY investment_listings;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE listings IS 'Main MLS listings table with property details and investment metrics';
COMMENT ON COLUMN listings.cap_rate IS 'Capitalization rate calculated from rent data: (Annual Rent - Operating Expenses) / List Price';
COMMENT ON COLUMN listings.gross_yield IS 'Gross rental yield: (Annual Rent / List Price) * 100';
COMMENT ON TABLE listing_photos IS 'Property photos and media files';
COMMENT ON TABLE agents IS 'Real estate agents and brokers';
COMMENT ON TABLE brokerages IS 'Real estate brokerage firms';

-- ==================== SEO CONTENT TABLES ====================

-- Blog Posts table for SEO content
CREATE TABLE IF NOT EXISTS blog_posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL, -- Markdown content
  featured_image VARCHAR(500),
  author VARCHAR(100) DEFAULT 'Realist Team',
  status VARCHAR(20) DEFAULT 'draft', -- draft, published, archived
  category VARCHAR(50), -- Market Update, Analysis, News, Tutorial
  tags TEXT[], -- Array of tags for SEO
  meta_title VARCHAR(70),
  meta_description VARCHAR(160),
  canonical_url VARCHAR(500),
  view_count INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Guides table for evergreen how-to content
CREATE TABLE IF NOT EXISTS guides (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL, -- Markdown content
  featured_image VARCHAR(500),
  author VARCHAR(100) DEFAULT 'Realist Team',
  status VARCHAR(20) DEFAULT 'draft', -- draft, published, archived
  category VARCHAR(50), -- Analysis, Markets, Tax & Legal, Financing
  difficulty VARCHAR(20), -- beginner, intermediate, advanced
  estimated_read_time_minutes INTEGER,
  meta_title VARCHAR(70),
  meta_description VARCHAR(160),
  canonical_url VARCHAR(500),
  view_count INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for SEO content
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published ON blog_posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);

CREATE INDEX IF NOT EXISTS idx_guides_slug ON guides(slug);
CREATE INDEX IF NOT EXISTS idx_guides_status_published ON guides(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_guides_category ON guides(category);

-- Triggers to auto-update updated_at for content tables
CREATE TRIGGER update_blog_posts_updated_at BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guides_updated_at BEFORE UPDATE ON guides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== RENT PULSE TABLES ====================

-- Rent pulse data for city-level yield calculations
CREATE TABLE IF NOT EXISTS rent_pulse (
  id SERIAL PRIMARY KEY,
  city VARCHAR(100) NOT NULL,
  province VARCHAR(2) NOT NULL,
  bedrooms VARCHAR(10) NOT NULL, -- "1BR", "2BR", "3BR", "all"
  median_rent INTEGER, -- monthly, CAD cents
  avg_rent INTEGER,
  min_rent INTEGER,
  max_rent INTEGER,
  sample_size INTEGER,
  source VARCHAR(20), -- "kijiji", "rentals_ca", "mixed"
  scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Individual rent listings from scrapers
CREATE TABLE IF NOT EXISTS rent_listings (
  id SERIAL PRIMARY KEY,
  city VARCHAR(100) NOT NULL,
  province VARCHAR(2) NOT NULL,
  title VARCHAR(500),
  price INTEGER NOT NULL, -- monthly, CAD cents
  bedrooms INTEGER,
  bathrooms INTEGER,
  address TEXT,
  lat DECIMAL(10, 7),
  lng DECIMAL(10, 7),
  source VARCHAR(20) NOT NULL, -- "kijiji", "rentals_ca"
  source_url TEXT,
  source_id VARCHAR(100) UNIQUE, -- dedup key
  scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for rent pulse queries
CREATE INDEX IF NOT EXISTS idx_rent_pulse_city_province ON rent_pulse(city, province);
CREATE INDEX IF NOT EXISTS idx_rent_pulse_scraped_at ON rent_pulse(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_rent_listings_city ON rent_listings(city);
CREATE INDEX IF NOT EXISTS idx_rent_listings_source_id ON rent_listings(source_id);

-- Comments for documentation
COMMENT ON TABLE blog_posts IS 'SEO blog posts for content marketing';
COMMENT ON TABLE guides IS 'Evergreen how-to guides for real estate investing';
COMMENT ON TABLE rent_pulse IS 'City-level rent data for cap rate and yield calculations';
COMMENT ON TABLE rent_listings IS 'Individual rental listings from scrapers';

-- User sessions table: links localStorage session tokens to authenticated user accounts
-- Enables backfilling pre-enrollment deal analyses to the correct user
CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);

-- ==================== DEAL ANALYSIS MEMORY ====================
-- Non-Negotiable #4: Persist user underwriting activity
CREATE TABLE IF NOT EXISTS deal_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES member_profiles(id) ON DELETE CASCADE,
  session_token VARCHAR(255),  -- for pre-auth analyses
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,

  -- Property identity
  address TEXT NOT NULL,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  property_type TEXT,
  bedrooms INTEGER,
  bathrooms NUMERIC(3,1),
  sqft INTEGER,

  -- Underwriting inputs
  list_price NUMERIC(12,2) NOT NULL,
  down_payment NUMERIC(12,2),
  down_payment_pct NUMERIC(5,2),
  mortgage_rate NUMERIC(5,3),
  amortization_years INTEGER,
  monthly_rent NUMERIC(10,2),
  annual_vacancy NUMERIC(5,2),
  annual_appreciation NUMERIC(5,2),
  closing_costs NUMERIC(10,2),
  renovation_costs NUMERIC(10,2),
  property_taxes NUMERIC(10,2),
  property_insurance NUMERIC(10,2),
  maintenance_pct NUMERIC(5,2),
  management_pct NUMERIC(5,2),

  -- Computed outputs (persisted for fast queries)
  cap_rate NUMERIC(5,2),
  cash_flow NUMERIC(10,2),
  cash_on_cash NUMERIC(5,2),
  monthly_mortgage NUMERIC(10,2),
  gross_income NUMERIC(12,2),
  net_income NUMERIC(12,2),
  total_operating_expenses NUMERIC(12,2),
  debt_service NUMERIC(10,2),
  annual_cash_flow NUMERIC(10,2),
  appreciation NUMERIC(10,2),
  equity_buildup NUMERIC(10,2),
  total_return NUMERIC(10,2),
  total_roi NUMERIC(5,2),
  is_investment_property BOOLEAN DEFAULT false,

  -- Verdict & notes
  verdict_check TEXT,  -- '✅ Strong', '⚠️ Moderate', '❌ Weak'
  notes TEXT,
  tags JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_da_user ON deal_analyses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_da_session ON deal_analyses(session_token) WHERE session_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_da_listing ON deal_analyses(listing_id);
CREATE INDEX IF NOT EXISTS idx_da_city_price ON deal_analyses(city, list_price);
CREATE INDEX IF NOT EXISTS idx_da_cap ON deal_analyses(cap_rate DESC NULLS LAST);

COMMENT ON TABLE deal_analyses IS 'Persistent deal analysis history — core of the analysis memory layer';

-- ==================== SAVED LISTINGS ====================
-- Persistent bookmarking of listings by authenticated users
CREATE TABLE IF NOT EXISTS saved_listings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL DEFAULT '',
  province VARCHAR(2) NOT NULL DEFAULT '',
  price BIGINT,
  property_type VARCHAR(50),
  bedrooms INTEGER,
  bathrooms INTEGER,
  sqft INTEGER,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  UNIQUE(user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_listings_user ON saved_listings(user_id, saved_at DESC);

COMMENT ON TABLE saved_listings IS 'Saved/bookmarked listings by authenticated investors';
