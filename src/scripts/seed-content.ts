/**
 * Seed Content Script (Fixed)
 * Creates sample blog posts and guides for development
 */

import * as dotenv from 'dotenv';
import { db } from '../db';
import { logger } from '../logger';

dotenv.config();

interface BlogPost {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author: string;
  category: string;
  meta_title: string;
  meta_description: string;
  featured_image: string | null;
}

interface Guide {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author: string;
  category: string;
  difficulty: string;
  estimated_read_time_minutes: number;
  meta_title: string;
  meta_description: string;
  featured_image: string | null;
}

// Simple blog post content without complex template literals
const sampleBlogPosts: BlogPost[] = [
  {
    title: 'March 2026: Top 5 Canadian Cities by Rental Yield',
    slug: 'march-2026-top-5-canadian-cities-by-rental-yield',
    excerpt: 'Discover the best Canadian cities for rental investment in March 2026. Our analysis of current rent data reveals the top 5 cities by cap rate.',
    content: `# March 2026: Top 5 Canadian Cities by Rental Yield

Looking for the best cities to invest in Canadian rental property? Our latest analysis of current market rent data reveals the top 5 cities by capitalization rate.

## How We Calculate Yield

We analyze the latest rent pulse data from markets across Canada and calculate estimated cap rates using a 60% NOI (Net Operating Income) ratio. This provides a conservative estimate of cash-on-cash return for investors.

## Top 5 Cities for Rental Investment

### 1. Windsor, ON
- **Cap Rate:** 8.5%
- **Median Rent:** $1,800/month
- **Estimated Price:** $380,000
- **Annual Cash Flow:** $12,960
- **Sample Size:** 45 listings

At a 8.5% cap rate, a typical Windsor property could generate approximately $12,960 annually in NOI.

### 2. London, ON
- **Cap Rate:** 7.8%
- **Median Rent:** $2,100/month
- **Estimated Price:** $510,000
- **Annual Cash Flow:** $15,120
- **Sample Size:** 38 listings

### 3. Hamilton, ON
- **Cap Rate:** 7.2%
- **Median Rent:** $2,200/month
- **Estimated Price:** $620,000
- **Annual Cash Flow:** $15,840
- **Sample Size:** 52 listings

### 4. Kitchener, ON
- **Cap Rate:** 6.9%
- **Median Rent:** $2,300/month
- **Estimated Price:** $580,000
- **Annual Cash Flow:** $16,560
- **Sample Size:** 41 listings

### 5. Barrie, ON
- **Cap Rate:** 6.5%
- **Median Rent:** $2,400/month
- **Estimated Price:** $550,000
- **Annual Cash Flow:** $17,280
- **Sample Size:** 29 listings

## Key Takeaways

1. **Windsor** leads with a 8.5% cap rate - the highest in our analysis.
2. **Average cap rate** across all analyzed cities: 7.38%
3. Smaller markets often offer higher yields due to lower property prices.
4. Higher rents in major cities can still yield competitive returns despite higher prices.

## Important Notes

- These estimates use a 60% NOI ratio - actual returns will vary based on expenses.
- Property prices are estimates based on market averages.
- Sample sizes vary by market.
- Always conduct thorough due diligence before investing.

---

*Data sourced from Realist.ca rent pulse analysis. Updated monthly.*`,
    author: 'Realist Team',
    category: 'Market Update',
    meta_title: 'March 2026: Top 5 Canadian Cities by Rental Yield | Realist.ca',
    meta_description: 'Discover the best Canadian cities for rental investment in March 2026. Our analysis reveals Windsor, London, Hamilton, Kitchener, and Barrie as top markets.',
    featured_image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200',
  },
];

const sampleGuides: Guide[] = [
  {
    title: 'Beginner\'s Guide to Real Estate Investing in Canada',
    slug: 'beginners-guide-to-real-estate-investing-in-canada',
    excerpt: 'Everything you need to know to start investing in Canadian real estate, from finding properties to financing and management.',
    content: `# Beginner's Guide to Real Estate Investing in Canada

Real estate investing can be one of the most effective ways to build wealth in Canada. This guide covers everything you need to know to get started.

## Why Invest in Canadian Real Estate?

### Advantages
1. **Leverage** - Use mortgages to control large assets with small down payments
2. **Cash Flow** - Rental income can provide monthly passive income
3. **Appreciation** - Property values tend to increase over time
4. **Tax Benefits** - Deductible expenses and capital gains treatment
5. **Inflation Hedge** - Real estate often outpaces inflation

### Risks
1. **Market Cycles** - Property values can decline
2. **Liquidity** - Real estate isn't easy to sell quickly
3. **Tenant Issues** - Bad tenants can cause headaches and expenses
4. **Maintenance Costs** - Unexpected repairs can be expensive

## Getting Started: Step-by-Step

### Step 1: Education
- Read books on real estate investing
- Follow reputable blogs and podcasts
- Attend local real estate meetups
- Consider a mentor or coach

### Step 2: Financial Preparation
- **Credit Score:** Aim for 680+ for best mortgage rates
- **Down Payment:** Save 20% minimum (5% for owner-occupied)
- **Emergency Fund:** 3-6 months of expenses
- **Closing Costs:** Budget 1.5-4% of purchase price

### Step 3: Define Your Strategy
Choose your investment approach:
- **Buy and Hold** - Long-term rental properties
- **Fix and Flip** - Short-term renovations and sales
- **REITs** - Real estate investment trusts (no direct ownership)
- **Syndications** - Pool funds with other investors

### Step 4: Market Research
Analyze potential markets:
- **Population Growth** - Look for increasing demand
- **Job Market** - Strong employment supports rents
- **Rental Vacancy Rates** - Below 3% is ideal
- **Price-to-Rent Ratio** - Lower is better for investors

### Step 5: Property Analysis
Evaluate individual properties:
- **Cap Rate** - Minimum 5% for most markets
- **Cash Flow** - Positive after all expenses
- **Location** - Proximity to amenities, transit, schools
- **Condition** - Age, maintenance needs, renovation potential

### Step 6: Financing
Mortgage options for investors:
- **Conventional Mortgage** - 20% down, best rates
- **CMHC-Insured** - 5-19.99% down (owner-occupied only)
- **Private Lending** - Higher rates, more flexible
- **HELOC** - Use existing home equity

### Step 7: Purchase Process
1. **Make an Offer** - With conditions (inspection, financing)
2. **Home Inspection** - Identify potential issues
3. **Secure Financing** - Finalize mortgage approval
4. **Legal Review** - Lawyer handles title transfer
5. **Closing** - Take possession and get keys

### Step 8: Property Management
- **Self-Manage** - Save money, more work
- **Property Manager** - Typically 8-12% of rent
- **Tenant Screening** - Credit checks, references, employment verification
- **Maintenance** - Regular upkeep and emergency repairs

## Common Beginner Mistakes

1. **Underestimating Expenses** - Budget for vacancies, repairs, management
2. **Emotional Decisions** - Invest based on numbers, not feelings
3. **Poor Location Choice** - "Location, location, location" matters
4. **Inadequate Due Diligence** - Always inspect and research thoroughly
5. **Over-Leveraging** - Don't stretch yourself too thin

## Next Steps

1. **Start Small** - Consider a duplex or triplex (live in one unit)
2. **Build a Team** - Realtor, mortgage broker, lawyer, accountant
3. **Track Everything** - Use software for income/expense tracking
4. **Continue Learning** - Real estate investing is a lifelong education

## Resources

- **Books:** "The Book on Rental Property Investing" by Brandon Turner
- **Podcasts:** "BiggerPockets Real Estate Podcast"
- **Tools:** Realist.ca investment analysis tools
- **Communities:** Local real estate investment associations

---

*Ready to analyze your first property? Try our Investment Calculator.*`,
    author: 'Realist Team',
    category: 'analysis',
    difficulty: 'beginner',
    estimated_read_time_minutes: 15,
    meta_title: 'Beginner\'s Guide to Real Estate Investing in Canada | Realist.ca',
    meta_description: 'Complete guide to starting real estate investing in Canada. Learn about strategies, financing, property analysis, and avoiding common mistakes.',
    featured_image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200',
  },
];

async function seedBlogPosts(): Promise<void> {
  logger.info('Seeding blog posts...');
  
  for (const post of sampleBlogPosts) {
    try {
      // Check if post already exists
      const existing = await db.query(
        'SELECT id FROM blog_posts WHERE slug = $1',
        [post.slug]
      );
      
      if (existing.rows.length > 0) {
        logger.info('Blog post already exists', { slug: post.slug });
        continue;
      }
      
      // Insert new post
      await db.query(
        `INSERT INTO blog_posts (
          title, slug, excerpt, content, author, status, category,
          meta_title, meta_description, featured_image, published_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, 'published', $6, $7, $8, $9, NOW(), NOW(), NOW()
        )`,
        [
          post.title,
          post.slug,
          post.excerpt,
          post.content,
          post.author,
          post.category,
          post.meta_title,
          post.meta_description,
          post.featured_image,
        ]
      );
      
      logger.info('Created blog post', { title: post.title, slug: post.slug });
    } catch (error) {
      logger.error('Failed to seed blog post', { 
        slug: post.slug, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
}

async function seedGuides(): Promise<void> {
  logger.info('Seeding guides...');
  
  for (const guide of sampleGuides) {
    try {
      // Check if guide already exists
      const existing = await db.query(
        'SELECT id FROM guides WHERE slug = $1',
        [guide.slug]
      );
      
      if (existing.rows.length > 0) {
        logger.info('Guide already exists', { slug: guide.slug });
        continue;
      }
      
      // Insert new guide
      await db.query(
        `INSERT INTO guides (
          title, slug, excerpt, content, author, status, category, difficulty,
          estimated_read_time_minutes, meta_title, meta_description, featured_image,
          published_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, 'published', $6, $7, $8, $9, $10, $11, NOW(), NOW(), NOW()
        )`,
        [
          guide.title,
          guide.slug,
          guide.excerpt,
          guide.content,
          guide.author,
          guide.category,
          guide.difficulty,
          guide.estimated_read_time_minutes,
          guide.meta_title,
          guide.meta_description,
          guide.featured_image,
        ]
      );
      
      logger.info('Created guide', { title: guide.title, slug: guide.slug });
    } catch (error) {
      logger.error('Failed to seed guide', { 
        slug: guide.slug, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
}

async function run(): Promise<void> {
  logger.info('Starting content seed...');
  
  await seedBlogPosts();
  await seedGuides();
  
  logger.info('Content seed complete');
}

run()
  .then(() => {
    logger.info('Seed script finished');
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error('Seed script failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    process.exit(1);
  });