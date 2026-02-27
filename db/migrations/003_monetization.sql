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