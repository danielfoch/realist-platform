-- GENERATED FILE: do not edit schema.sql directly.
-- Source of truth: db/migrations/*.sql
-- Regenerate with: npm run sync:schema

-- ============================================
-- 001_initial_schema.sql
-- ============================================

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

-- ============================================
-- 002_optimization_and_partitioning.sql
-- ============================================

-- Extensions required for location indexes.
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- Sync run tracking for observability and /metrics endpoint.
CREATE TABLE IF NOT EXISTS sync_runs (
  id BIGSERIAL PRIMARY KEY,
  status VARCHAR(20) NOT NULL,
  incremental_sync BOOLEAN NOT NULL DEFAULT true,
  batch_size INTEGER NOT NULL,
  processed_count INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_created_at ON sync_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON sync_runs(status);

-- Additional listing indexes for common API filters.
CREATE INDEX IF NOT EXISTS idx_listings_synced_at ON listings(synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_province_price ON listings(address_province, list_price);
CREATE INDEX IF NOT EXISTS idx_listings_city_status ON listings(address_city, status);
CREATE INDEX IF NOT EXISTS idx_listings_ddf_modified ON listings(ddf_last_modified DESC);
CREATE INDEX IF NOT EXISTS idx_listings_active_price ON listings(list_price) WHERE status = 'Active';
CREATE INDEX IF NOT EXISTS idx_listing_history_changed_at ON listing_history(changed_at DESC);

-- Optional partitioned table strategy for high-volume growth.
-- This does not replace the current listings table automatically.
CREATE TABLE IF NOT EXISTS listings_partitioned (
  LIKE listings INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING STORAGE
) PARTITION BY LIST (address_province);

DO $$
DECLARE
  prov TEXT;
BEGIN
  FOREACH prov IN ARRAY ARRAY['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT']
  LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS listings_partitioned_%I PARTITION OF listings_partitioned FOR VALUES IN (%L);',
      lower(prov),
      prov
    );
  END LOOP;

  EXECUTE 'CREATE TABLE IF NOT EXISTS listings_partitioned_other PARTITION OF listings_partitioned DEFAULT';
END
$$;

CREATE INDEX IF NOT EXISTS idx_listings_partitioned_mls ON listings_partitioned(mls_number);
CREATE INDEX IF NOT EXISTS idx_listings_partitioned_status_price ON listings_partitioned(status, list_price);

-- Optional helper function for future migration of live data.
CREATE OR REPLACE FUNCTION migrate_listings_to_partitioned(limit_count INTEGER DEFAULT 10000)
RETURNS INTEGER AS $$
DECLARE
  moved_count INTEGER;
BEGIN
  WITH moved AS (
    DELETE FROM listings
    WHERE id IN (SELECT id FROM listings ORDER BY id LIMIT limit_count)
    RETURNING *
  )
  INSERT INTO listings_partitioned
  SELECT * FROM moved;

  GET DIAGNOSTICS moved_count = ROW_COUNT;
  RETURN moved_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 003_monetization.sql
-- ============================================

-- Monetization tables for Realist.ca
-- Adds user management, subscriptions, and lead capture

-- ==================== USERS TABLE ====================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  avatar_url TEXT,
  
  -- Subscription tier: free, premium, enterprise
  tier VARCHAR(20) NOT NULL DEFAULT 'free',
  
  -- Stripe customer and subscription IDs
  stripe_customer_id VARCHAR(255) UNIQUE,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  
  -- Subscription status (maps to Stripe status)
  subscription_status VARCHAR(20) NOT NULL DEFAULT 'inactive', -- active, canceled, past_due, unpaid, incomplete, incomplete_expired, trialing
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMP,
  
  -- Lead generation opt-in
  receive_marketing_emails BOOLEAN DEFAULT TRUE,
  agree_to_terms BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  
  -- Indexes
  CONSTRAINT valid_tier CHECK (tier IN ('free', 'premium', 'enterprise')),
  CONSTRAINT valid_subscription_status CHECK (subscription_status IN (
    'active', 'canceled', 'past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'trialing', 'inactive'
  ))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tier ON users(tier);
CREATE INDEX idx_users_subscription_status ON users(subscription_status);
CREATE INDEX idx_users_stripe_customer_id ON users(stripe_customer_id);

-- ==================== SUBSCRIPTION HISTORY ====================
-- Tracks changes to subscriptions for auditing and analytics
CREATE TABLE IF NOT EXISTS subscription_history (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- subscription_created, subscription_updated, subscription_canceled, payment_succeeded, payment_failed, tier_changed
  old_tier VARCHAR(20),
  new_tier VARCHAR(20),
  old_status VARCHAR(20),
  new_status VARCHAR(20),
  stripe_event_id VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscription_history_user_id ON subscription_history(user_id);
CREATE INDEX idx_subscription_history_created_at ON subscription_history(created_at DESC);
CREATE INDEX idx_subscription_history_stripe_event_id ON subscription_history(stripe_event_id);

-- ==================== LEAD SUBMISSIONS ====================
-- For realtor partnership inquiries
CREATE TABLE IF NOT EXISTS lead_submissions (
  id SERIAL PRIMARY KEY,
  -- Contact info
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  company VARCHAR(255),
  role VARCHAR(100),
  
  -- Inquiry details
  inquiry_type VARCHAR(50) NOT NULL, -- partnership, advertising, sponsorship, other
  message TEXT,
  source VARCHAR(100) DEFAULT 'website', -- website, landing_page, referral, etc.
  
  -- CRM integration
  ghl_contact_id VARCHAR(255), -- GoHighLevel contact ID
  ghl_opportunity_id VARCHAR(255), -- GoHighLevel opportunity ID
  crm_synced_at TIMESTAMP,
  
  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'new', -- new, contacted, qualified, closed, lost
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL, -- internal user assigned to lead
  follow_up_date DATE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lead_submissions_email ON lead_submissions(email);
CREATE INDEX idx_lead_submissions_status ON lead_submissions(status);
CREATE INDEX idx_lead_submissions_created_at ON lead_submissions(created_at DESC);
CREATE INDEX idx_lead_submissions_ghl_contact_id ON lead_submissions(ghl_contact_id);

-- ==================== FEATURE FLAGS ====================
-- Defines which features are available for each tier
CREATE TABLE IF NOT EXISTS tier_features (
  tier VARCHAR(20) PRIMARY KEY,
  features JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tier_features (tier, features, description) VALUES
('free', '[
  "search_listings",
  "view_listing_details",
  "basic_filters",
  "map_view",
  "save_up_to_5_favorites",
  "save_up_to_2_searches"
]', 'Free tier with basic access'),
('premium', '[
  "search_listings",
  "view_listing_details",
  "advanced_filters",
  "map_view",
  "unlimited_favorites",
  "unlimited_saved_searches",
  "investment_metrics",
  "cap_rate_calculator",
  "rent_estimate_access",
  "export_to_csv",
  "priority_support"
]', 'Premium tier with advanced tools'),
('enterprise', '[
  "search_listings",
  "view_listing_details",
  "advanced_filters",
  "map_view",
  "unlimited_favorites",
  "unlimited_saved_searches",
  "investment_metrics",
  "cap_rate_calculator",
  "rent_estimate_access",
  "export_to_csv",
  "priority_support",
  "api_access",
  "custom_reports",
  "team_accounts",
  "white_labeling"
]', 'Enterprise tier with full platform access')
ON CONFLICT (tier) DO UPDATE SET
  features = EXCLUDED.features,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;

-- ==================== UPDATE EXISTING TABLES ====================
-- Add foreign key constraints to saved_searches and favorites (they currently have user_id integer)
ALTER TABLE saved_searches 
ADD CONSTRAINT fk_saved_searches_user 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE favorites 
ADD CONSTRAINT fk_favorites_user 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add ON DELETE CASCADE to existing foreign keys for consistency
ALTER TABLE listing_photos 
DROP CONSTRAINT IF EXISTS listing_photos_listing_id_fkey,
ADD CONSTRAINT listing_photos_listing_id_fkey 
FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;

ALTER TABLE listing_rooms 
DROP CONSTRAINT IF EXISTS listing_rooms_listing_id_fkey,
ADD CONSTRAINT listing_rooms_listing_id_fkey 
FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;

ALTER TABLE listing_history 
DROP CONSTRAINT IF EXISTS listing_history_listing_id_fkey,
ADD CONSTRAINT listing_history_listing_id_fkey 
FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;

-- ==================== TRIGGERS ====================
-- Auto-update updated_at for new tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_submissions_updated_at BEFORE UPDATE ON lead_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== FUNCTIONS ====================
-- Function to check if a user has access to a feature
CREATE OR REPLACE FUNCTION has_feature_access(
  p_user_id INTEGER,
  p_feature VARCHAR(100)
) RETURNS BOOLEAN AS $$
DECLARE
  v_tier VARCHAR(20);
  v_features JSONB;
BEGIN
  -- Get user's tier
  SELECT tier INTO v_tier FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Get features for tier
  SELECT features INTO v_features FROM tier_features WHERE tier = v_tier;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if feature exists in array
  RETURN v_features ? p_feature;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get user's subscription status summary
CREATE OR REPLACE FUNCTION get_user_subscription_summary(
  p_user_id INTEGER
) RETURNS TABLE(
  tier VARCHAR(20),
  subscription_status VARCHAR(20),
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN,
  features JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.tier,
    u.subscription_status,
    u.current_period_end,
    u.cancel_at_period_end,
    tf.features
  FROM users u
  LEFT JOIN tier_features tf ON u.tier = tf.tier
  WHERE u.id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ==================== COMMENTS ====================
COMMENT ON TABLE users IS 'User accounts with subscription information';
COMMENT ON COLUMN users.tier IS 'Current subscription tier: free, premium, enterprise';
COMMENT ON COLUMN users.subscription_status IS 'Stripe subscription status';
COMMENT ON COLUMN users.current_period_end IS 'When the current subscription period ends';

COMMENT ON TABLE subscription_history IS 'Audit log of subscription changes and Stripe webhook events';
COMMENT ON TABLE lead_submissions IS 'Realtor partnership inquiries for CRM integration';
COMMENT ON TABLE tier_features IS 'Feature definitions for each subscription tier';

-- ============================================
-- 004_realtor_portal.sql
-- ============================================

-- Realtor Portal & Lead Distribution System Migration
-- Adds tables for realtor users, market claims, investor leads, and lead distribution

-- ==================== REALTOR USERS ====================
-- Specialized users who are licensed realtors
CREATE TABLE IF NOT EXISTS realtor_users (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  
  -- Realtor details
  license_number VARCHAR(50) UNIQUE,
  license_province VARCHAR(2),
  brokerage_name VARCHAR(255),
  brokerage_phone VARCHAR(50),
  
  -- Agreement
  agreed_to_referral_fee BOOLEAN DEFAULT false,
  referral_fee_percentage DECIMAL(5, 2) DEFAULT 25.00,
  agreement_signed_at TIMESTAMP,
  agreement_ip VARCHAR(45),
  
  -- Verification status
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP,
  
  -- Stats
  leads_received INTEGER DEFAULT 0,
  leads_claimed INTEGER DEFAULT 0,
  referral_earnings DECIMAL(12, 2) DEFAULT 0.00,
  
  -- Notifications
  email_notifications BOOLEAN DEFAULT true,
  phone_notifications BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== MARKET CLAIMS ====================
-- Postal codes or cities that realtors claim for lead distribution
CREATE TABLE IF NOT EXISTS market_claims (
  id SERIAL PRIMARY KEY,
  realtor_id INTEGER REFERENCES realtor_users(id) ON DELETE CASCADE,
  
  -- Market definition (postal code prefix or city name)
  market_type VARCHAR(20) NOT NULL, -- 'postal_code', 'city', 'province'
  market_value VARCHAR(100) NOT NULL, -- e.g., 'M5V', 'Toronto', 'ON'
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'paused', 'removed'
  
  -- Stats for this market
  total_leads INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(realtor_id, market_type, market_value)
);

-- ==================== INVESTOR LEADS ====================
-- Leads from investors looking to be matched with a realtor
CREATE TABLE IF NOT EXISTS investor_leads (
  id SERIAL PRIMARY KEY,
  
  -- Contact info
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  
  -- Investment criteria
  investment_type VARCHAR(50), -- 'rental', 'flip', 'hold', 'multi-family'
  budget_min DECIMAL(12, 2),
  budget_max DECIMAL(12, 2),
  target_cities TEXT[], -- Array of cities
  target_provinces VARCHAR(2)[], -- Array of provinces
  timeline VARCHAR(50), -- 'immediate', '3-months', '6-months', 'exploring'
  
  -- Additional info
  investment_experience VARCHAR(50), -- 'first-time', '1-5-deals', '5+-deals'
  notes TEXT,
  
  -- Source tracking
  source VARCHAR(50) DEFAULT 'website',
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  
  -- Status
  status VARCHAR(20) DEFAULT 'new', -- 'new', 'distributed', 'claimed', 'contacted', 'closed', 'lost'
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== LEAD DISTRIBUTION ====================
-- Tracks which leads were sent to which realtors
CREATE TABLE IF NOT EXISTS lead_notifications (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES investor_leads(id) ON DELETE CASCADE,
  realtor_id INTEGER REFERENCES realtor_users(id) ON DELETE CASCADE,
  
  -- Notification status
  notified_at TIMESTAMP,
  notification_method VARCHAR(20), -- 'email', 'sms', 'in-app'
  
  -- Claim status
  claimed BOOLEAN DEFAULT false,
  claimed_at TIMESTAMP,
  
  -- Introduction email
  introduction_email_sent BOOLEAN DEFAULT false,
  introduction_email_sent_at TIMESTAMP,
  introduction_email_tracking_id VARCHAR(100),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(lead_id, realtor_id)
);

-- ==================== REFERRAL EARNINGS ====================
-- Tracks referral fee earnings
CREATE TABLE IF NOT EXISTS referral_earnings (
  id SERIAL PRIMARY KEY,
  realtor_id INTEGER REFERENCES realtor_users(id) ON DELETE CASCADE,
  lead_id INTEGER REFERENCES investor_leads(id) ON DELETE SET NULL,
  
  -- Transaction details
  transaction_type VARCHAR(20), -- 'referral_fee', 'bonus'
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'CAD',
  
  -- Reference
  deal_address VARCHAR(255),
  deal_price DECIMAL(12, 2),
  commission_percentage DECIMAL(5, 2),
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'cancelled'
  paid_at TIMESTAMP,
  
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_realtor_users_user ON realtor_users(user_id);
CREATE INDEX IF NOT EXISTS idx_realtor_users_license ON realtor_users(license_number);

CREATE INDEX IF NOT EXISTS idx_market_claims_realtor ON market_claims(realtor_id);
CREATE INDEX IF NOT EXISTS idx_market_claims_market ON market_claims(market_type, market_value);

CREATE INDEX IF NOT EXISTS idx_investor_leads_status ON investor_leads(status);
CREATE INDEX IF NOT EXISTS idx_investor_leads_email ON investor_leads(email);
CREATE INDEX IF NOT EXISTS idx_investor_leads_created ON investor_leads(created_at);

CREATE INDEX IF NOT EXISTS idx_lead_notifications_lead ON lead_notifications(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_notifications_realtor ON lead_notifications(realtor_id);
CREATE INDEX IF NOT EXISTS idx_lead_notifications_claimed ON lead_notifications(claimed);

CREATE INDEX IF NOT EXISTS idx_referral_earnings_realtor ON referral_earnings(realtor_id);
CREATE INDEX IF NOT EXISTS idx_referral_earnings_status ON referral_earnings(status);

-- ==================== TRIGGERS ====================
-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_realtor_users_updated_at BEFORE UPDATE ON realtor_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_market_claims_updated_at BEFORE UPDATE ON market_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_investor_leads_updated_at BEFORE UPDATE ON investor_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE realtor_users IS 'Licensed realtors who receive investor leads';
COMMENT ON TABLE market_claims IS 'Postal codes/cities realtors claim for lead distribution';
COMMENT ON TABLE investor_leads IS 'Leads from investors looking to be matched with a realtor';
COMMENT ON TABLE lead_notifications IS 'Tracks which leads were sent to which realtors';
COMMENT ON TABLE referral_earnings IS 'Tracks referral fee earnings for realtors';

-- ============================================
-- 005_seo_content.sql
-- ============================================

-- Migration 005: SEO Content Infrastructure
-- Creates blog_posts and guides tables for content marketing

-- Blog Posts Table
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

-- Guides Table
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);

CREATE INDEX IF NOT EXISTS idx_guides_slug ON guides(slug);
CREATE INDEX IF NOT EXISTS idx_guides_status ON guides(status);
CREATE INDEX IF NOT EXISTS idx_guides_published_at ON guides(published_at);
CREATE INDEX IF NOT EXISTS idx_guides_category ON guides(category);

-- Insert sample blog post (for testing)
INSERT INTO blog_posts (title, slug, excerpt, content, author, published_at, status, category, meta_title, meta_description)
VALUES (
    'March 2026: Top 5 Canadian Cities by Rental Yield',
    'march-2026-top-5-canadian-cities-by-rental-yield',
    'Our analysis of the latest rent data reveals the best cities for rental yield in Canada for March 2026.',
    '# March 2026: Top 5 Canadian Cities by Rental Yield

Based on our latest rent scraper data from Kijiji and Rentals.ca, here are the top 5 Canadian cities by gross rental yield...

## 1. Edmonton, Alberta
- Average Rent: $1,450/month
- Median Home Price: $340,000
- Gross Yield: 5.1%

## 2. Calgary, Alberta  
- Average Rent: $1,650/month
- Median Home Price: $480,000
- Gross Yield: 4.1%

## 3. Winnipeg, Manitoba
- Average Rent: $1,250/month
- Median Home Price: $290,000
- Gross Yield: 5.2%

## 4. Halifax, Nova Scotia
- Average Rent: $1,800/month
- Median Home Price: $450,000
- Gross Yield: 4.8%

## 5. London, Ontario
- Average Rent: $1,900/month
- Median Home Price: $520,000
- Gross Yield: 4.4%

*Data sourced from our weekly rent scraper. Yields are gross and do not account for expenses.*',
    'Realist Team',
    '2026-03-01',
    'published',
    'market-update',
    'March 2026: Top 5 Canadian Cities by Rental Yield | Realist.ca',
    'Discover the best Canadian cities for rental yield in March 2026. Our data-driven analysis covers Edmonton, Calgary, Winnipeg, Halifax, and London.'
) ON CONFLICT (slug) DO NOTHING;

-- Insert sample guides (for testing)
INSERT INTO guides (title, slug, excerpt, content, author, published_at, status, category, difficulty, estimated_read_time_minutes, meta_title, meta_description)
VALUES (
    'How to Analyze a Multi-Unit Property in Ontario',
    'how-to-analyze-multi-unit-property-ontario',
    'A comprehensive guide to evaluating duplex, triplex, and quadruplex investments in Ontario.',
    '# How to Analyze a Multi-Unit Property in Ontario

This guide walks you through the complete process of analyzing multi-unit residential properties in Ontario...

## Understanding Cap Rates

The capitalization rate (cap rate) is the most important metric for rental properties:

**Cap Rate = Net Operating Income / Property Value**

## Key Metrics to Analyze

1. Gross Rental Yield
2. Net Operating Income (NOI)
3. Cash-on-Cash Return
4. Debt Service Coverage Ratio (DSCR)

## Using the Realist Deal Analyzer

Our free deal analyzer at realist.ca/deal-analyzer can help you calculate these metrics automatically.',
    'Realist Team',
    '2026-02-15',
    'published',
    'analysis',
    'intermediate',
    15,
    'How to Analyze Multi-Unit Property in Ontario | Realist.ca',
    'Learn how to analyze multi-unit properties in Ontario. Calculate cap rates, cash-on-cash returns, and use our free deal analyzer.'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO guides (title, slug, excerpt, content, author, published_at, status, category, difficulty, estimated_read_time_minutes, meta_title, meta_description)
VALUES (
    'Understanding CMHC Rent Benchmarks',
    'understanding-cmhc-rent-benchmarks',
    'Learn how CMHC rent data can help you make better investment decisions.',
    '# Understanding CMHC Rent Benchmarks

CMHC (Canada Mortgage and Housing Corporation) publishes annual rent data for primary rental markets across Canada...

## Why CMHC Data Matters

- Benchmark rents for 150+ markets
- Vacancy rates by bedroom type
- Historical trends going back 10+ years

## How to Use This Data

Compare your expected rents against CMHC benchmarks to:
- Validate your investment assumptions
- Identify over/under-valued markets
- Set realistic vacancy expectations',
    'Realist Team',
    '2026-02-10',
    'published',
    'markets',
    'beginner',
    10,
    'CMHC Rent Benchmarks Explained | Realist.ca',
    'Understand CMHC rent benchmarks and how to use them for real estate investment analysis in Canada.'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO guides (title, slug, excerpt, content, author, published_at, status, category, difficulty, estimated_read_time_minutes, meta_title, meta_description)
VALUES (
    'Tax Strategies for Canadian Real Estate Investors',
    'tax-strategies-canadian-real-estate-investors',
    'Essential tax strategies every Canadian real estate investor should know.',
    '# Tax Strategies for Canadian Real Estate Investors

Understanding the tax implications of your real estate investments is crucial for maximizing returns...

## Principal Residence Exemption

The principal residence exemption can shield your primary home from capital gains tax...

## Rental Property Deductions

You can deduct:
- Interest on your mortgage
- Property taxes
- Insurance
- Maintenance and repairs
- Property management fees
- Depreciation (Capital Cost Allowance)

## Holding Properties in a Corporation

Consider incorporating to:
- Split income with family members
- Defer capital gains
- Access small business deductions',
    'Realist Team',
    '2026-01-20',
    'published',
    'tax-legal',
    'intermediate',
    20,
    'Tax Strategies for Canadian Real Estate Investors | Realist.ca',
    'Learn essential tax strategies for Canadian real estate investors. Principal residence exemption, rental deductions, and corporate holding strategies.'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO guides (title, slug, excerpt, content, author, published_at, status, category, difficulty, estimated_read_time_minutes, meta_title, meta_description)
VALUES (
    'Financing Multi-Unit Properties in Canada',
    'financing-multi-unit-properties-canada',
    'Learn about CMHC insurance, conventional mortgages, and alternative financing for multi-unit properties.',
    '# Financing Multi-Unit Properties in Canada

Financing multi-unit properties requires understanding different loan products and lender requirements...

## CMHC MLI Select

For properties with 5+ units, CMHC offers MLI Select insurance:
- Preferred rates
- Flexible underwriting
- Fast turnaround

## Conventional Financing

For properties under $1M:
- 20% down payment minimum
- Stress test applies
- Multiple lender options

## Alternative Financing

Private mortgages, syndicated deals, and seller financing options for unique situations.',
    'Realist Team',
    '2026-01-15',
    'published',
    'financing',
    'intermediate',
    15,
    'Financing Multi-Unit Properties in Canada | Realist.ca',
    'Learn about financing options for multi-unit properties in Canada including CMHC MLI Select, conventional mortgages, and alternative financing.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 006_partner_signup.sql
-- ============================================

-- Migration: Add realtors and lenders tables for partner signup
-- Created: 2026-03-20

-- Realtors table for partner signup
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

-- Lenders table for partner signup
CREATE TABLE IF NOT EXISTS lenders (
  id SERIAL PRIMARY KEY,
  contact_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  lending_types JSONB NOT NULL DEFAULT '[]',
  target_markets JSONB NOT NULL DEFAULT '[]',
  loan_size_min INTEGER NOT NULL,
  loan_size_max INTEGER NOT NULL,
  preferred_dscr_min FLOAT,
  preferred_ltv_max FLOAT,
  turnaround_time TEXT NOT NULL,
  referral_agreement BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for realtors
CREATE INDEX IF NOT EXISTS idx_realtors_email ON realtors(email);
CREATE INDEX IF NOT EXISTS idx_realtors_status ON realtors(status);
CREATE INDEX IF NOT EXISTS idx_realtors_created ON realtors(created_at);

-- Indexes for lenders
CREATE INDEX IF NOT EXISTS idx_lenders_email ON lenders(email);
CREATE INDEX IF NOT EXISTS idx_lenders_status ON lenders(status);
CREATE INDEX IF NOT EXISTS idx_lenders_loan_size ON lenders(loan_size_min, loan_size_max);
CREATE INDEX IF NOT EXISTS idx_lenders_created ON lenders(created_at);

-- Trigger for updated_at
CREATE TRIGGER update_realtors_updated_at BEFORE UPDATE ON realtors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lenders_updated_at BEFORE UPDATE ON lenders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 007_rent_pulse.sql
-- ============================================

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
