-- Migration: Create partner tables
-- Run this in your Replit database

-- Realtors table
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

-- Lenders table
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

-- Deal leads table (from deal analyzer)
CREATE TABLE IF NOT EXISTS deal_leads (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  property_address TEXT,
  city TEXT,
  province TEXT,
  purchase_price INTEGER,
  financing_notes TEXT,
  investor_goals TEXT,
  status TEXT DEFAULT 'new',
  matched_realtor_id INTEGER REFERENCES realtors(id),
  matched_lender_id INTEGER REFERENCES lenders(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_realtors_status ON realtors(status);
CREATE INDEX IF NOT EXISTS idx_realtors_email ON realtors(email);
CREATE INDEX IF NOT EXISTS idx_lenders_status ON lenders(status);
CREATE INDEX IF NOT EXISTS idx_lenders_email ON lenders(email);
CREATE INDEX IF NOT EXISTS idx_deal_leads_status ON deal_leads(status);
CREATE INDEX IF NOT EXISTS idx_deal_leads_city_province ON deal_leads(city, province);

-- Blog Posts table for SEO content
CREATE TABLE IF NOT EXISTS blog_posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  featured_image TEXT,
  author TEXT DEFAULT 'Realist Team',
  status TEXT DEFAULT 'draft',
  category TEXT,
  tags TEXT[],
  meta_title TEXT,
  meta_description TEXT,
  canonical_url TEXT,
  view_count INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_blog_category ON blog_posts(category);

-- Guides table for SEO content
CREATE TABLE IF NOT EXISTS guides (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  featured_image TEXT,
  author TEXT DEFAULT 'Realist Team',
  status TEXT DEFAULT 'draft',
  category TEXT NOT NULL,
  difficulty TEXT,
  estimated_read_time_minutes INTEGER,
  meta_title TEXT,
  meta_description TEXT,
  canonical_url TEXT,
  view_count INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guides_slug ON guides(slug);
CREATE INDEX IF NOT EXISTS idx_guides_status ON guides(status);
CREATE INDEX IF NOT EXISTS idx_guides_category ON guides(category);