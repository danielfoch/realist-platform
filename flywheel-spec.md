# Realist.ca Flywheel - Implementation Specification

**Priority:** HIGH - Core growth strategy  
**Date:** March 20, 2026

---

## OVERVIEW

The flywheel strategy: More users analyzing deals → more data → better AI → more users.

---

## 1. ANALYZED_DEALS TABLE (Priority)

### SQL Schema (PostgreSQL)

```sql
-- Core table: captures every deal analysis
CREATE TABLE analyzed_deals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  session_id VARCHAR(100),  -- anonymous session tracking
  
  -- Property Info
  address TEXT,
  city VARCHAR(100),
  province VARCHAR(2),
  property_type VARCHAR(50),  -- house, condo, multiplex, commercial
  
  -- Financial Inputs
  purchase_price DECIMAL(12,2),
  down_payment DECIMAL(12,2),
  down_payment_pct DECIMAL(5,2),
  mortgage_rate DECIMAL(5,3),
  mortgage_term INTEGER,  -- years
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
  dscr DECIMAL(5,3),  -- debt service coverage ratio
  monthly_cash_flow DECIMAL(10,2),
  annual_cash_flow DECIMAL(12,2),
  
  -- User Targets (for comparison)
  target_cap_rate DECIMAL(5,2),
  target_cash_on_cash DECIMAL(5,2),
  target_dscr DECIMAL(5,2),
  
  -- Metadata
  analyzed_at TIMESTAMP DEFAULT NOW(),
  source VARCHAR(50),  -- web, mobile, api
  utm_source VARCHAR(100),
  utm_campaign VARCHAR(100)
);

-- Indexes for leaderboard queries
CREATE INDEX idx_deals_city ON analyzed_deals(city);
CREATE INDEX idx_deals_province ON analyzed_deals(province);
CREATE INDEX idx_deals_user ON analyzed_deals(user_id);
CREATE INDEX idx_deals_analyzed_at ON analyzed_deals(analyzed_at);
```

### Capture Points

Every time `/api/analyze` or similar endpoint is called, log the:
- Input parameters
- Calculated outputs
- User/session ID

---

## 2. LEADERBOARD SYSTEM

### User Stats Table

```sql
CREATE TABLE user_stats (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  total_deals INTEGER DEFAULT 0,
  avg_cap_rate DECIMAL(6,4),
  avg_cash_on_cash DECIMAL(6,4),
  most_active_city VARCHAR(100),
  province_breakdown JSONB,  -- {"ON": 15, "BC": 8, "AB": 5}
  badges JSONB,  -- ["100 Deals", "Cap Rate King", "Top Toronto"]
  weekly_deals INTEGER DEFAULT 0,
  monthly_deals INTEGER DEFAULT 0,
  last_analyzed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Badge Definitions

| Badge | Criteria |
|-------|----------|
| 🌱 First Deal | 1 deal analyzed |
| 📊 Analyst | 10 deals analyzed |
| 🏆 Pro Analyst | 50 deals analyzed |
| 👑 Deal Machine | 100 deals analyzed |
| 🎯 Cap Rate King | Highest avg cap rate (min 10 deals) |
| 💰 Cash Flow Master | Highest avg CoC (min 10 deals) |
| 🇨🇦 Top City [City] | Most deals in a city |
| 🌟 Rising Star | Most improved week-over-week |

### Leaderboard Endpoints

```javascript
// GET /api/leaderboard?period=weekly|monthly|alltime
{
  "period": "weekly",
  "updatedAt": "2026-03-20T12:00:00Z",
  "rankings": [
    {"rank": 1, "user": "user_123", "deals": 47, "avgCapRate": 8.2, "badges": ["Deal Machine"]},
    {"rank": 2, "user": "user_456", "deals": 31, "avgCapRate": 7.5, "badges": ["Pro Analyst"]}
  ],
  "stats": {
    "totalDealsThisWeek": 1247,
    "avgCapRate": 6.8,
    "avgCashOnCash": 12.3,
    "hottestCity": "Toronto"
  }
}
```

---

## 3. WEEKLY CRM EMAIL BLAST

### Email Preferences Table

```sql
CREATE TABLE email_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  weekly_digest BOOLEAN DEFAULT TRUE,
  market_alerts BOOLEAN DEFAULT FALSE,
  new_features BOOLEAN DEFAULT TRUE,
  last_sent_at TIMESTAMP,
  frequency VARCHAR(20) DEFAULT 'weekly'
);
```

### Email Content API

```javascript
// GET /api/email/weekly-digest
{
  "subject": "📊 Weekly Realist.ca Market Digest - Mar 20",
  "preheader": "Your weekly dose of Canadian deal intelligence",
  "body": {
    "thisWeek": {
      "dealsAnalyzed": 1247,
      "changeVsLastWeek": "+12%",
      "avgCapRate": 6.8,
      "avgCashOnCash": 12.3,
      "hottestCity": "Toronto"
    },
    "topAnalysts": [
      {"name": "Alex", "deals": 47},
      {"name": "Sarah", "deals": 31},
      {"name": "Mike", "deals": 28}
    ],
    "cta": {
      "text": "Analyze Your Next Deal",
      "url": "https://realist.ca/analyze"
    }
  }
}
```

### Send via (integrate with):

- **GoHighLevel** (if already in use)
- **ConvertKit** 
- **Mailchimp**
- **AWS SES** (custom)

---

## 4. AI / INFERENCE ENGINE

### Data Aggregation Views

```sql
-- Regional benchmarks
CREATE VIEW regional_benchmarks AS
SELECT 
  province,
  city,
  COUNT(*) as total_deals,
  AVG(cap_rate) as avg_cap_rate,
  AVG(cash_on_cash) as avg_cash_on_cash,
  AVG(dscr) as avg_dscr,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cap_rate) as median_cap_rate,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cash_on_cash) as median_coc
FROM analyzed_deals
WHERE analyzed_at > NOW() - INTERVAL '90 days'
GROUP BY province, city;

-- Market trends (week-over-week)
CREATE VIEW market_trends AS
SELECT 
  date_trunc('week', analyzed_at) as week,
  province,
  COUNT(*) as deals,
  AVG(cap_rate) as avg_cap_rate
FROM analyzed_deals
GROUP BY date_trunc('week', analyzed_at), province;
```

### Recommendation Engine

```javascript
// GET /api/recommendations?user_id=123
{
  "recommendations": [
    {
      "type": "market_alert",
      "title": "Toronto Cap Rates Rising",
      "body": "Average cap rate in Toronto increased 0.4% this week",
      "city": "Toronto",
      "severity": "info"
    },
    {
      "type": "deal_match",
      "title": "Similar Deals in Your Target Range",
      "body": "12 deals with 7%+ cap rate analyzed in Montreal this week",
      "city": "Montreal",
      "cta": "View Deals"
    }
  ],
  "benchmarks": {
    "yourAvgCapRate": 7.2,
    "cityAvgCapRate": 6.1,
    "benchmark": "Above average"
  }
}
```

### Polsia Integration (Replit)

- Endpoint to send data to Polsia: `POST /api/inference/send-data`
- Polsia analyzes and returns insights
- OpenClaw receives via webhook

---

## 5. IMPLEMENTATION CHECKLIST

### Phase 1: Data Collection
- [ ] Add analyzed_deals table to PostgreSQL
- [ ] Update deal analyzer to log every analysis
- [ ] Add session tracking for anonymous users
- [ ] Test data capture

### Phase 2: Leaderboard
- [ ] Add user_stats table
- [ ] Create badge logic
- [ ] Build /api/leaderboard endpoint
- [ ] Create /leaderboard page

### Phase 3: Email
- [ ] Add email_preferences table
- [ ] Build weekly digest API
- [ ] Integrate with email provider
- [ ] Set up weekly cron job

### Phase 4: AI
- [ ] Create aggregation views
- [ ] Build recommendations endpoint
- [ ] Integrate Polsia
- [ ] Add webhook handler

---

## NOTES

- Start with Phase 1 (data collection) - foundation for everything else
- Can use anonymous session_id for users not logged in
- Leaderboard can show top N without revealing identities (opt-in display)
- Weekly email can be sent via GHL if already configured
- Polsia needs API key and webhook URL

---

**Next Step:** Add tables to Replit PostgreSQL and update deal analyzer to log analyses.