-- Migration 008: Flywheel Data Collection
-- Realist.ca - Captures every deal analysis for the data flywheel

-- Core table: captures every deal analysis
CREATE TABLE IF NOT EXISTS analyzed_deals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(100),
    
    -- Property Info
    address TEXT,
    city VARCHAR(100),
    province VARCHAR(2),
    property_type VARCHAR(50),
    
    -- Financial Inputs
    purchase_price DECIMAL(12,2),
    down_payment DECIMAL(12,2),
    down_payment_pct DECIMAL(5,2),
    mortgage_rate DECIMAL(5,3),
    mortgage_term INTEGER,
    amortization_years INTEGER DEFAULT 25,
    
    -- Income
    rent_monthly DECIMAL(10,2),
    other_income_monthly DECIMAL(10,2) DEFAULT 0,
    
    -- Expenses
    property_tax_yearly DECIMAL(10,2),
    insurance_yearly DECIMAL(10,2),
    maintenance_monthly DECIMAL(10,2),
    condo_fee_monthly DECIMAL(10,2) DEFAULT 0,
    vacancy_rate DECIMAL(5,2) DEFAULT 0.05,
    management_fee_pct DECIMAL(5,2) DEFAULT 0,
    
    -- Calculated Metrics
    cap_rate DECIMAL(6,4),
    cash_on_cash DECIMAL(6,4),
    irr DECIMAL(6,4),
    dscr DECIMAL(5,3),
    monthly_cash_flow DECIMAL(10,2),
    annual_cash_flow DECIMAL(12,2),
    
    -- User Targets (for comparison)
    target_cap_rate DECIMAL(5,2),
    target_cash_on_cash DECIMAL(5,2),
    target_dscr DECIMAL(5,2),
    
    -- Metadata
    analyzed_at TIMESTAMP DEFAULT NOW(),
    source VARCHAR(50) DEFAULT 'web',
    utm_source VARCHAR(100),
    utm_campaign VARCHAR(100)
);

-- Indexes for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_deals_city ON analyzed_deals(city);
CREATE INDEX IF NOT EXISTS idx_deals_province ON analyzed_deals(province);
CREATE INDEX IF NOT EXISTS idx_deals_user ON analyzed_deals(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_analyzed_at ON analyzed_deals(analyzed_at);

-- User Stats table for leaderboard
CREATE TABLE IF NOT EXISTS user_stats (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    total_deals INTEGER DEFAULT 0,
    avg_cap_rate DECIMAL(6,4),
    avg_cash_on_cash DECIMAL(6,4),
    most_active_city VARCHAR(100),
    province_breakdown JSONB DEFAULT '{}',
    badges JSONB DEFAULT '[]',
    weekly_deals INTEGER DEFAULT 0,
    monthly_deals INTEGER DEFAULT 0,
    last_analyzed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Email preferences table
CREATE TABLE IF NOT EXISTS email_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    weekly_digest BOOLEAN DEFAULT TRUE,
    market_alerts BOOLEAN DEFAULT FALSE,
    new_features BOOLEAN DEFAULT TRUE,
    last_sent_at TIMESTAMP,
    frequency VARCHAR(20) DEFAULT 'weekly',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Trigger function to auto-update user_stats
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_stats (user_id, total_deals, weekly_deals, monthly_deals, last_analyzed_at)
    VALUES (NEW.user_id, 1, 1, 1, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        total_deals = user_stats.total_deals + 1,
        weekly_deals = user_stats.weekly_deals + 1,
        monthly_deals = user_stats.monthly_deals + 1,
        last_analyzed_at = NOW(),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stats on new deal
DROP TRIGGER IF EXISTS trigger_update_user_stats ON analyzed_deals;
CREATE TRIGGER trigger_update_user_stats
AFTER INSERT ON analyzed_deals
FOR EACH ROW
WHEN (NEW.user_id IS NOT NULL)
EXECUTE FUNCTION update_user_stats();

-- Weekly reset trigger (runs on Monday at 3am)
CREATE OR REPLACE FUNCTION reset_weekly_stats()
RETURNS void AS $$
BEGIN
    UPDATE user_stats SET weekly_deals = 0;
END;
$$ LANGUAGE plpgsql;

-- Monthly reset trigger
CREATE OR REPLACE FUNCTION reset_monthly_stats()
RETURNS void AS $$
BEGIN
    UPDATE user_stats SET monthly_deals = 0;
END;
$$ LANGUAGE plpgsql;

-- Regional benchmarks view
CREATE OR REPLACE VIEW regional_benchmarks AS
SELECT 
    province,
    city,
    COUNT(*) as total_deals,
    ROUND(AVG(cap_rate)::numeric, 2) as avg_cap_rate,
    ROUND(AVG(cash_on_cash)::numeric, 2) as avg_cash_on_cash,
    ROUND(AVG(dscr)::numeric, 2) as avg_dscr,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cap_rate) as median_cap_rate,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cash_on_cash) as median_coc
FROM analyzed_deals
WHERE analyzed_at > NOW() - INTERVAL '90 days'
GROUP BY province, city;

-- Market trends view
CREATE OR REPLACE VIEW market_trends AS
SELECT 
    date_trunc('week', analyzed_at) as week,
    province,
    COUNT(*) as deals,
    ROUND(AVG(cap_rate)::numeric, 2) as avg_cap_rate,
    ROUND(AVG(cash_on_cash)::numeric, 2) as avg_cash_on_cash
FROM analyzed_deals
GROUP BY date_trunc('week', analyzed_at), province;

COMMENT ON TABLE analyzed_deals IS 'Captures every deal analysis for the Realist.ca data flywheel';
COMMENT ON TABLE user_stats IS 'Aggregated user statistics for leaderboard and badges';
