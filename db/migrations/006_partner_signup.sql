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