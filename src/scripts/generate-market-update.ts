/**
 * Monthly Market Update Generator
 * 
 * Generates blog posts from rent pulse data showing top Canadian cities by yield.
 * Run this script monthly (e.g., via cron) to auto-publish market updates.
 * 
 * Usage:
 *   npx tsx src/scripts/generate-market-update.ts
 * 
 * Or import as module:
 *   import { generateMonthlyMarketUpdate } from './scripts/generate-market-update';
 */

import { db } from '../db';

interface CityRentData {
  city: string;
  province: string;
  median_rent: number;
  sample_size: number;
  scraped_at: Date;
}

// Canadian city average prices (would ideally come from listings DB)
// These are rough estimates - in production, calculate from actual listing data
const CITY_PRICES: Record<string, number> = {
  'Toronto': 850000,
  'Vancouver': 950000,
  'Montreal': 520000,
  'Calgary': 480000,
  'Ottawa': 520000,
  'Edmonton': 380000,
  'Hamilton': 620000,
  'Kitchener': 580000,
  'London': 510000,
  'Windsor': 380000,
  'Mississauga': 720000,
  'Brampton': 680000,
  ' Vaughan': 780000,
  'Markham': 850000,
  'Richmond Hill': 920000,
  'Burlington': 710000,
  'Oakville': 840000,
  'Guelph': 610000,
  'Kingston': 480000,
  'Barrie': 550000,
};

const NOI_RATIO = 0.60; // 60% NOI ratio for cap rate calculation

function calculateCapRate(monthlyRent: number, price: number): number {
  const annualRent = monthlyRent * 12;
  const noi = annualRent * NOI_RATIO;
  return (noi / price) * 100;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function getMonthYear(): string {
  const now = new Date();
  return now.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
}

function getPreviousMonth(): string {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  return now.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export async function generateMonthlyMarketUpdate(): Promise<{
  success: boolean;
  postId?: number;
  error?: string;
  stats?: {
    citiesAnalyzed: number;
    topCity: string;
    avgCapRate: number;
  };
}> {
  try {
    console.log('Generating monthly market update...\n');

    // Get latest rent pulse data for each city (last 7 days)
    const rentData = await db.query<CityRentData>(`
      WITH latest_pulse AS (
        SELECT city, province, median_rent, sample_size, scraped_at,
               ROW_NUMBER() OVER (PARTITION BY city ORDER BY scraped_at DESC) as rn
        FROM rent_pulse
        WHERE scraped_at > NOW() - INTERVAL '7 days'
          AND bedrooms = 'all'
      )
      SELECT city, province, median_rent / 100 as median_rent, sample_size, scraped_at
      FROM latest_pulse
      WHERE rn = 1
      ORDER BY median_rent DESC
    `);

    if (rentData.rows.length === 0) {
      return {
        success: false,
        error: 'No rent pulse data available. Run rent scraper first.',
      };
    }

    // Calculate cap rates for each city
    const cityYields = rentData.rows
      .map((row) => {
        const price = CITY_PRICES[row.city] || 500000; // Default to 500k if unknown
        const capRate = calculateCapRate(row.median_rent, price);
        const annualCashFlow = row.median_rent * 12 * NOI_RATIO;

        return {
          city: row.city,
          province: row.province,
          medianRent: row.median_rent,
          estimatedCapRate: capRate,
          estimatedPrice: price,
          annualCashFlow,
          sampleSize: row.sample_size,
        };
      })
      .filter((c) => c.estimatedCapRate > 0)
      .sort((a, b) => b.estimatedCapRate - a.estimatedCapRate);

    const top5 = cityYields.slice(0, 5);
    const avgCapRate = cityYields.reduce((sum, c) => sum + c.estimatedCapRate, 0) / cityYields.length;

    console.log('Top 5 Cities by Cap Rate:');
    top5.forEach((city, i) => {
      console.log(`  ${i + 1}. ${city.city}, ${city.province}: ${formatPercent(city.estimatedCapRate)} (rent: ${formatCurrency(city.medianRent)})`);
    });
    console.log(`\nAverage Cap Rate: ${formatPercent(avgCapRate)}\n`);

    // Generate blog post content
    const monthYear = getMonthYear();
    const title = `${monthYear}: Top 5 Canadian Cities by Rental Yield`;
    const slug = slugify(title);

    const content = generateBlogPostContent(top5, monthYear, avgCapRate);
    const excerpt = `Discover the best Canadian cities for rental investment in ${monthYear}. Our analysis of current rent data reveals the top 5 cities by cap rate.`;

    // Check if post already exists for this month
    const existingPost = await db.query(`
      SELECT id FROM blog_posts 
      WHERE slug = $1 AND status = 'published'
    `, [slug]);

    if (existingPost.rows.length > 0) {
      console.log(`Post already exists: ${slug}`);
      return {
        success: false,
        error: `Post for ${monthYear} already exists`,
      };
    }

    // Insert the blog post
    const result = await db.query(`
      INSERT INTO blog_posts (
        title, slug, excerpt, content, author, status, category,
        meta_title, meta_description, published_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING id
    `, [
      title,
      slug,
      excerpt,
      content,
      'Realist Team',
      'published',
      'Market Update',
      title,
      excerpt,
    ]);

    const postId = result.rows[0]?.id;

    console.log(`✅ Published: "${title}" (ID: ${postId})`);
    console.log(`   URL: /insights/blog/${slug}`);

    return {
      success: true,
      postId,
      stats: {
        citiesAnalyzed: cityYields.length,
        topCity: top5[0]?.city || 'N/A',
        avgCapRate,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error generating market update:', message);
    return {
      success: false,
      error: message,
    };
  }
}

function generateBlogPostContent(topCities: any[], monthYear: string, avgCapRate: number): string {
  const lines = [
    `# ${monthYear}: Top 5 Canadian Cities by Rental Yield`,
    '',
    'Looking for the best cities to invest in Canadian rental property? Our latest analysis of current market rent data reveals the top 5 cities by capitalization rate.',
    '',
    '## How We Calculate Yield',
    '',
    'We analyze the latest rent pulse data from markets across Canada and calculate estimated cap rates using a 60% NOI (Net Operating Income) ratio. This provides a conservative estimate of cash-on-cash return for investors.',
    '',
    '## Top 5 Cities for Rental Investment',
    '',
  ];

  topCities.forEach((city, i) => {
    lines.push(`### ${i + 1}. ${city.city}, ${city.province}`);
    lines.push('');
    lines.push(`- **Cap Rate:** ${formatPercent(city.estimatedCapRate)}`);
    lines.push(`- **Median Rent:** ${formatCurrency(city.medianRent)}/month`);
    lines.push(`- **Estimated Price:** ${formatCurrency(city.estimatedPrice)}`);
    lines.push(`- **Annual Cash Flow:** ${formatCurrency(city.annualCashFlow)}`);
    lines.push(`- **Sample Size:** ${city.sampleSize} listings`);
    lines.push('');
    lines.push(`At a ${formatPercent(city.estimatedCapRate)} cap rate, a typical ${city.city} property could generate approximately ${formatCurrency(city.annualCashFlow)} annually in NOI.`);
    lines.push('');
  });

  lines.push('## Key Takeaways');
  lines.push('');
  lines.push(`1. **${topCities[0].city}** leads with a ${formatPercent(topCities[0].estimatedCapRate)} cap rate - the highest in our analysis.`);
  lines.push(`2. **Average cap rate** across all analyzed cities: ${formatPercent(avgCapRate)}`);
  lines.push('3. Smaller markets often offer higher yields due to lower property prices.');
  lines.push('4. Higher rents in major cities can still yield competitive returns despite higher prices.');
  lines.push('');
  lines.push('## Important Notes');
  lines.push('');
  lines.push('- These estimates use a 60% NOI ratio - actual returns will vary based on expenses.');
  lines.push('- Property prices are estimates based on market averages.');
  lines.push('- Sample sizes vary by market.');
  lines.push('- Always conduct thorough due diligence before investing.');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('*Data sourced from Realist.ca rent pulse analysis. Updated monthly.*');

  return lines.join('\n');
}

// Run if called directly
if (require.main === module) {
  generateMonthlyMarketUpdate()
    .then((result) => {
      if (!result.success) {
        console.error('Failed:', result.error);
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

export default generateMonthlyMarketUpdate;
