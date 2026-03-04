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
