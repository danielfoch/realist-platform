-- Migration 005: SEO Content Infrastructure
-- Creates blog_posts and guides tables for content marketing

-- Blog Posts Table
CREATE TABLE IF NOT EXISTS blog_posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT, -- markdown content
    featured_image TEXT,
    author VARCHAR(255),
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- SEO Fields
    meta_title VARCHAR(200),
    meta_description VARCHAR(500),
    canonical_url TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft', -- draft, published, archived
    featured BOOLEAN DEFAULT FALSE,
    
    -- Categorization
    category VARCHAR(100), -- market-update, news, analysis, tutorial
    tags TEXT[] -- array of tags for filtering
);

-- Guides Table
CREATE TABLE IF NOT EXISTS guides (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT, -- markdown content
    featured_image TEXT,
    author VARCHAR(255),
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- SEO Fields
    meta_title VARCHAR(200),
    meta_description VARCHAR(500),
    canonical_url TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft', -- draft, published, archived
    featured BOOLEAN DEFAULT FALSE,
    
    -- Category - from spec: "Analysis", "Markets", "Tax & Legal", "Financing"
    category VARCHAR(100), -- analysis, markets, tax-legal, financing
    difficulty VARCHAR(20), -- beginner, intermediate, advanced
    estimated_read_time_minutes INTEGER
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
