/**
 * Demo/Mock data for development without a database
 * Use DEMO_MODE=true in .env to enable
 */

export interface DemoListing {
  id: number;
  mls_number: string;
  status: string;
  list_date: string;
  property_type: string;
  structure_type: string;
  address_street: string;
  address_unit: string;
  address_city: string;
  address_province: string;
  address_postal_code: string;
  latitude: number;
  longitude: number;
  list_price: number;
  bedrooms: number;
  bathrooms_full: number;
  bathrooms_half: number;
  square_footage: number;
  year_built: number;
  estimated_monthly_rent: number;
  cap_rate: number;
  gross_yield: number;
  cash_flow_monthly: number;
  rent_data_source: string;
  photos: Array<{ id: number; url: string; isPrimary: boolean }>;
}

const demoListings: DemoListing[] = [
  {
    id: 1,
    mls_number: 'DEMO1234567',
    status: 'Active',
    list_date: '2026-02-15',
    property_type: 'Residential',
    structure_type: 'House',
    address_street: '123 Investment Ave',
    address_unit: '',
    address_city: 'Toronto',
    address_province: 'ON',
    address_postal_code: 'M5V 1J2',
    latitude: 43.6532,
    longitude: -79.3832,
    list_price: 850000,
    bedrooms: 4,
    bathrooms_full: 2,
    bathrooms_half: 1,
    square_footage: 1800,
    year_built: 2015,
    estimated_monthly_rent: 3800,
    cap_rate: 5.36,
    gross_yield: 5.36,
    cash_flow_monthly: 1450,
    rent_data_source: 'demo',
    photos: [
      { id: 1, url: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800', isPrimary: true }
    ]
  },
  {
    id: 2,
    mls_number: 'DEMO2345678',
    status: 'Active',
    list_date: '2026-02-18',
    property_type: 'Residential',
    structure_type: 'House',
    address_street: '456 Cash Flow Blvd',
    address_unit: '',
    address_city: 'Hamilton',
    address_province: 'ON',
    address_postal_code: 'L8P 1A1',
    latitude: 43.2557,
    longitude: -79.8711,
    list_price: 620000,
    bedrooms: 3,
    bathrooms_full: 2,
    bathrooms_half: 0,
    square_footage: 1400,
    year_built: 2010,
    estimated_monthly_rent: 3200,
    cap_rate: 6.19,
    gross_yield: 6.19,
    cash_flow_monthly: 1720,
    rent_data_source: 'demo',
    photos: [
      { id: 2, url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800', isPrimary: true }
    ]
  },
  {
    id: 3,
    mls_number: 'DEMO3456789',
    status: 'Active',
    list_date: '2026-02-10',
    property_type: 'Residential',
    structure_type: 'Townhouse',
    address_street: '789 Rental Row',
    address_unit: 'A',
    address_city: 'Kitchener',
    address_province: 'ON',
    address_postal_code: 'N2H 1A1',
    latitude: 43.4516,
    longitude: -80.4925,
    list_price: 495000,
    bedrooms: 3,
    bathrooms_full: 1,
    bathrooms_half: 1,
    square_footage: 1100,
    year_built: 2018,
    estimated_monthly_rent: 2400,
    cap_rate: 5.82,
    gross_yield: 5.82,
    cash_flow_monthly: 1020,
    rent_data_source: 'demo',
    photos: [
      { id: 3, url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800', isPrimary: true }
    ]
  },
  {
    id: 4,
    mls_number: 'DEMO4567890',
    status: 'Active',
    list_date: '2026-02-20',
    property_type: 'Residential',
    structure_type: 'House',
    address_street: '321 Multi-Unit Lane',
    address_unit: '',
    address_city: 'Ottawa',
    address_province: 'ON',
    address_postal_code: 'K1P 1J1',
    latitude: 45.4215,
    longitude: -75.6972,
    list_price: 720000,
    bedrooms: 5,
    bathrooms_full: 3,
    bathrooms_half: 0,
    square_footage: 2200,
    year_built: 2008,
    estimated_monthly_rent: 4200,
    cap_rate: 7.00,
    gross_yield: 7.00,
    cash_flow_monthly: 2280,
    rent_data_source: 'demo',
    photos: [
      { id: 4, url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800', isPrimary: true }
    ]
  },
  {
    id: 5,
    mls_number: 'DEMO5678901',
    status: 'Active',
    list_date: '2026-02-12',
    property_type: 'Residential',
    structure_type: 'Condo',
    address_street: '555 Downtown Tower',
    address_unit: '1201',
    address_city: 'Toronto',
    address_province: 'ON',
    address_postal_code: 'M5E 1J2',
    latitude: 43.6408,
    longitude: -79.3817,
    list_price: 580000,
    bedrooms: 2,
    bathrooms_full: 2,
    bathrooms_half: 0,
    square_footage: 850,
    year_built: 2020,
    estimated_monthly_rent: 2800,
    cap_rate: 5.79,
    gross_yield: 5.79,
    cash_flow_monthly: 1200,
    rent_data_source: 'demo',
    photos: [
      { id: 5, url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800', isPrimary: true }
    ]
  },
  {
    id: 6,
    mls_number: 'DEMO6789012',
    status: 'Active',
    list_date: '2026-02-08',
    property_type: 'Residential',
    structure_type: 'House',
    address_street: '888 Suburb Street',
    address_unit: '',
    address_city: 'London',
    address_province: 'ON',
    address_postal_code: 'N6A 1J1',
    latitude: 42.9849,
    longitude: -81.2453,
    list_price: 445000,
    bedrooms: 3,
    bathrooms_full: 2,
    bathrooms_half: 0,
    square_footage: 1300,
    year_built: 2012,
    estimated_monthly_rent: 2200,
    cap_rate: 5.93,
    gross_yield: 5.93,
    cash_flow_monthly: 980,
    rent_data_source: 'demo',
    photos: [
      { id: 6, url: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800', isPrimary: true }
    ]
  },
  {
    id: 7,
    mls_number: 'DEMO7890123',
    status: 'Active',
    list_date: '2026-02-22',
    property_type: 'Residential',
    structure_type: 'Duplex',
    address_street: '222 Income Property Way',
    address_unit: '',
    address_city: 'Windsor',
    address_province: 'ON',
    address_postal_code: 'N9A 1J1',
    latitude: 42.3149,
    longitude: -83.0364,
    list_price: 385000,
    bedrooms: 4,
    bathrooms_full: 2,
    bathrooms_half: 0,
    square_footage: 1600,
    year_built: 2005,
    estimated_monthly_rent: 2600,
    cap_rate: 8.12,
    gross_yield: 8.12,
    cash_flow_monthly: 1580,
    rent_data_source: 'demo',
    photos: [
      { id: 7, url: 'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800', isPrimary: true }
    ]
  },
  {
    id: 8,
    mls_number: 'DEMO8901234',
    status: 'Active',
    list_date: '2026-02-05',
    property_type: 'Residential',
    structure_type: 'House',
    address_street: '999 Cap Rate Court',
    address_unit: '',
    address_city: 'Mississauga',
    address_province: 'ON',
    address_postal_code: 'L5M 1J1',
    latitude: 43.5890,
    longitude: -79.6441,
    list_price: 695000,
    bedrooms: 3,
    bathrooms_full: 2,
    bathrooms_half: 1,
    square_footage: 1650,
    year_built: 2016,
    estimated_monthly_rent: 3200,
    cap_rate: 5.53,
    gross_yield: 5.53,
    cash_flow_monthly: 1320,
    rent_data_source: 'demo',
    photos: [
      { id: 8, url: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800', isPrimary: true }
    ]
  }
];

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === 'true';
}

export function getDemoListings(): DemoListing[] {
  return demoListings;
}

export function getDemoListingByMls(mlsNumber: string): DemoListing | undefined {
  return demoListings.find(l => l.mls_number === mlsNumber);
}

export function filterDemoListings(filters: {
  city?: string;
  province?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  propertyType?: string;
  status?: string;
  investmentFocus?: boolean;
  minCapRate?: number;
  maxCapRate?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}): { data: DemoListing[]; total: number; page: number; limit: number; totalPages: number } {
  let filtered = [...demoListings];

  if (filters.status) {
    filtered = filtered.filter(l => l.status === filters.status);
  }
  if (filters.city) {
    filtered = filtered.filter(l => l.address_city.toLowerCase().includes(filters.city!.toLowerCase()));
  }
  if (filters.province) {
    filtered = filtered.filter(l => l.address_province === filters.province);
  }
  if (filters.minPrice) {
    filtered = filtered.filter(l => l.list_price >= filters.minPrice!);
  }
  if (filters.maxPrice) {
    filtered = filtered.filter(l => l.list_price <= filters.maxPrice!);
  }
  if (filters.minBedrooms) {
    filtered = filtered.filter(l => l.bedrooms >= filters.minBedrooms!);
  }
  if (filters.maxBedrooms) {
    filtered = filtered.filter(l => l.bedrooms <= filters.maxBedrooms!);
  }
  if (filters.propertyType) {
    filtered = filtered.filter(l => l.property_type === filters.propertyType);
  }
  if (filters.investmentFocus) {
    filtered = filtered.filter(l => l.cap_rate !== null && l.cap_rate !== undefined);
  }
  if (filters.minCapRate) {
    filtered = filtered.filter(l => l.cap_rate >= filters.minCapRate!);
  }
  if (filters.maxCapRate) {
    filtered = filtered.filter(l => l.cap_rate <= filters.maxCapRate!);
  }

  // Sort
  const sortBy = filters.sortBy || 'list_date';
  const sortOrder = filters.sortOrder || 'DESC';
  filtered.sort((a, b) => {
    const aVal = a[sortBy as keyof DemoListing];
    const bVal = b[sortBy as keyof DemoListing];
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortOrder === 'ASC' ? aVal - bVal : bVal - aVal;
    }
    return sortOrder === 'ASC' 
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  // Paginate
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const data = filtered.slice(offset, offset + limit);

  return { data, total, page, limit, totalPages };
}

// ==================== BLOG POSTS DEMO DATA ====================

export interface DemoBlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image: string | null;
  author: string;
  status: string;
  category: string;
  featured: boolean;
  tags: string[];
  meta_title: string;
  meta_description: string;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export const demoBlogPosts: DemoBlogPost[] = [
  {
    id: 1,
    title: "March 2026: Top 5 Canadian Cities by Rental Yield",
    slug: "march-2026-top-5-canadian-cities-by-rental-yield",
    excerpt: "Our monthly analysis of the best Canadian cities for rental property investments, based on current cap rates and rental data.",
    content: `# Top 5 Canadian Cities by Rental Yield - March 2026

Based on our exclusive rental data and market analysis, here are the top 5 Canadian cities for rental property investment this month.

## Methodology
We analyze rental data from Kijiji and Rentals.ca, combined with current listing prices to calculate realistic cap rates using a 40% expense ratio.

## Rankings

### 1. Windsor, ON
- Average Cap Rate: 8.2%
- Average Rent: $1,650/month
- Average Price: $290,000

### 2. Saint John, NB
- Average Cap Rate: 7.8%
- Average Rent: $1,400/month
- Average Price: $215,000

### 3. Trois-Rivières, QC
- Average Cap Rate: 7.5%
- average Rent: $1,100/month
- Average Price: $175,000

### 4. Hamilton, ON
- Average Cap Rate: 6.9%
- Average Rent: $2,100/month
- Average Price: $365,000

### 5. London, ON
- Average Cap Rate: 6.4%
- Average Rent: $2,000/month
- Average Price: $375,000

## Key Takeaways
- Ontario markets continue to offer strong yields
- Quebec properties remain affordable with solid returns
- Atlantic Canada offers the best entry prices

*Data sourced from Kijiji and Rentals.ca as of March 2026*`,
    featured_image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800",
    author: "Realist Team",
    status: "published",
    featured: true,
    category: "Market Update",
    tags: ["rental yield", "canadian real estate", "investment", "march 2026"],
    meta_title: "March 2026: Top 5 Canadian Cities by Rental Yield | Realist.ca",
    meta_description: "Discover the best Canadian cities for rental property investment. Our March 2026 analysis shows Windsor, Saint John, and Trois-Rivières leading in cap rates.",
    published_at: "2026-03-01T00:00:00Z",
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-03-01T00:00:00Z"
  },
  {
    id: 2,
    title: "Understanding Cap Rates: A Beginner's Guide",
    slug: "understanding-cap-rates-beginners-guide",
    excerpt: "Learn what cap rates are, how to calculate them, and what they mean for your real estate investment decisions.",
    content: `# Understanding Cap Rates: A Beginner's Guide

Cap rate (capitalization rate) is one of the most important metrics for real estate investors.

## What is a Cap Rate?

A cap rate is the ratio of a property's net operating income (NOI) to its purchase price. It helps investors evaluate the return on investment for a property.

## The Formula

\`\`\`
Cap Rate = (Annual NOI ÷ Property Price) × 100
\`\`\`

## Understanding NOI

Net Operating Income is your gross rental income minus operating expenses:
- Property management (8-10%)
- Maintenance (5-10%)
- Vacancy (5-8%)
- Insurance (1-2%)
- Property taxes (1-2%)

## What is a Good Cap Rate?

- **Under 5%**: Lower risk, often in major markets like Toronto/Vancouver
- **5-8%**: Moderate risk/reward, typical for secondary markets
- **8%+**: Higher risk, often in emerging markets or need of renovation

## Limitations

Cap rates don't account for:
- Financing costs (mortgage)
- Principal paydown
- Appreciation potential

*Use cap rate as one tool among many in your investment analysis.*`,
    featured_image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800",
    author: "Realist Team",
    status: "published",
    featured: false,
    category: "Tutorial",
    tags: ["cap rate", "beginner", "investment basics", "tutorial"],
    meta_title: "Understanding Cap Rates: A Beginner's Guide | Realist.ca",
    meta_description: "Learn what cap rates are, how to calculate them, and what they mean for your real estate investment decisions. Complete beginner's guide.",
    published_at: "2026-02-15T00:00:00Z",
    created_at: "2026-02-15T00:00:00Z",
    updated_at: "2026-02-15T00:00:00Z"
  },
  {
    id: 3,
    title: "The Truth About Toronto Real Estate in 2026",
    slug: "truth-about-toronto-real-estate-2026",
    excerpt: "Analyzing the Toronto market: are prices still overvalued or is there value to be found?",
    content: `# The Truth About Toronto Real Estate in 2026

Toronto's real estate market has been turbulent. Here's our analysis of the current state.

## Price Trends

After the 2022-2023 correction, Toronto prices have stabilized but remain high by historical standards.

## The Rental Story

Rents have increased significantly, making rental yields more attractive for investors who can afford the entry price.

## Our Verdict

Toronto is no longer a get-rich-quick market, but for long-term investors, it remains a solid choice due to:
- Strong population growth
- Diverse economy
- Limited supply

*Investment involves risk. Do your due diligence.*`,
    featured_image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800",
    author: "Realist Team",
    status: "published",
    featured: false,
    category: "Analysis",
    tags: ["toronto", "market analysis", "ontario", "2026"],
    meta_title: "The Truth About Toronto Real Estate in 2026 | Realist.ca",
    meta_description: "Analyzing the Toronto real estate market in 2026: are prices still overvalued or is there value to be found? Our detailed analysis.",
    published_at: "2026-02-01T00:00:00Z",
    created_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z"
  }
];

// ==================== GUIDES DEMO DATA ====================

export interface DemoGuide {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image: string | null;
  author: string;
  status: string;
  category: string;
  featured: boolean;
  difficulty: string;
  estimated_read_time_minutes: number;
  meta_title: string;
  meta_description: string;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export const demoGuides: DemoGuide[] = [
  {
    id: 1,
    title: "How to Analyze a Rental Property in 15 Minutes",
    slug: "analyze-rental-property-15-minutes",
    excerpt: "A quick framework for evaluating rental properties without spending hours on due diligence.",
    content: `# How to Analyze a Rental Property in 15 Minutes

Time is money. Here's how to quickly filter deals.

## Step 1: Check the Numbers (5 min)

1. Get the list price
2. Estimate rent from Kijiji/Rentals.ca
3. Calculate: \`(Rent × 12 × 0.6) ÷ Price\`
4. If cap rate < 5%, move on

## Step 2: Location Check (5 min)

- Neighborhood crime rates
- School ratings
- Employment nearby
- Transit access

## Step 3: Property Walkthrough (5 min)

- Age of building
- Major systems (HVAC, plumbing, electrical)
- Parking/Laundry
- Unit layout

## Red Flags

- High-rise condos (special assessments)
- Problematic neighborhoods
- Significant deferred maintenance
- Unreasonable seller timelines

*This framework isn't foolproof but will filter 90% of bad deals quickly.*`,
    featured_image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
    author: "Realist Team",
    status: "published",
    featured: false,
    category: "Analysis",
    difficulty: "beginner",
    estimated_read_time_minutes: 8,
    meta_title: "How to Analyze a Rental Property in 15 Minutes | Realist.ca",
    meta_description: "Learn a quick framework for evaluating rental properties without spending hours on due diligence. Analyze deals in 15 minutes or less.",
    published_at: "2026-01-15T00:00:00Z",
    created_at: "2026-01-15T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z"
  },
  {
    id: 2,
    title: "Financing Your First Rental Property in Canada",
    slug: "financing-first-rental-property-canada",
    excerpt: "Understanding mortgage options, down payments, and lending criteria for Canadian real estate investors.",
    content: `# Financing Your First Rental Property in Canada

Getting financing for an investment property is different than your primary residence.

## Down Payment Requirements

- **Primary residence**: 5% minimum
- **Rental property (1-2 units)**: 20% minimum
- **Rental property (3+ units)**: 25% minimum
- **Refinancing**: 20% equity minimum

## Mortgage Types

### Conventional
- Better rates
- More documentation
- 65-80% LTV

### HELOC
- Flexible access to equity
- Interest-only payments
- Variable rates

## Stress Test

Investment properties require higher stress test rates (usually +2% above contract rate).

## Tips

1. **Build relationships with mortgage brokers**
2. **Keep your personal debt low**
3. **Have 6 months reserves**
4. **Consider CMHC insurance for duplexes**

*Consult a mortgage professional for your specific situation.*`,
    featured_image: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800",
    author: "Realist Team",
    status: "published",
    featured: false,
    category: "Financing",
    difficulty: "beginner",
    estimated_read_time_minutes: 12,
    meta_title: "Financing Your First Rental Property in Canada | Realist.ca",
    meta_description: "Understanding mortgage options, down payments, and lending criteria for Canadian real estate investors. Complete guide to financing.",
    published_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z"
  },
  {
    id: 3,
    title: "Tax Strategies for Canadian Rental Property Owners",
    slug: "tax-strategies-canadian-rental-property",
    excerpt: "Maximize your after-tax returns with these proven strategies for rental property taxation.",
    content: `# Tax Strategies for Canadian Rental Property Owners

Understanding taxes can save you thousands.

## Deductible Expenses

- Property taxes
- Insurance
- Management fees
- Maintenance and repairs
- Utilities (if included)
- Interest on mortgage
- Professional fees
- Vehicle expenses

## Capital Cost Allowance (CCA)

Rental buildings are depreciated:
- Class 1: 4% per year
- You don't have to claim full CCA

## Important Tips

1. **Keep excellent records**
2. **Separate personal and rental expenses**
3. **Consult a CPA familiar with real estate**
4. **Consider incorporating**

## Common Mistakes

- Claiming personal expenses as rental
- Not tracking rental income properly
- Missing deadline to file

*This is general information, not tax advice. Consult a professional.*`,
    featured_image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800",
    author: "Realist Team",
    status: "published",
    featured: false,
    category: "Tax & Legal",
    difficulty: "intermediate",
    estimated_read_time_minutes: 15,
    meta_title: "Tax Strategies for Canadian Rental Property Owners | Realist.ca",
    meta_description: "Maximize your after-tax returns with these proven strategies for rental property taxation in Canada.",
    published_at: "2025-12-15T00:00:00Z",
    created_at: "2025-12-15T00:00:00Z",
    updated_at: "2025-12-15T00:00:00Z"
  }
];

// Helper functions to get demo content
export function getDemoBlogPosts() {
  return demoBlogPosts;
}

export function getDemoGuideBySlug(slug: string) {
  return demoGuides.find(g => g.slug === slug);
}

export function getDemoBlogPostBySlug(slug: string) {
  return demoBlogPosts.find(p => p.slug === slug);
}
