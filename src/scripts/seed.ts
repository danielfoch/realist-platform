import dotenv from 'dotenv';
import { db } from '../db';
import { logger } from '../logger';

dotenv.config();

interface SeedListing {
  mls: string;
  street: string;
  city: string;
  province: string;
  price: number;
  bedrooms: number;
  baths: number;
  sqft: number;
  capRate: number;
}

const listings: SeedListing[] = [
  {
    mls: 'RLT10001',
    street: '120 King St W',
    city: 'Toronto',
    province: 'ON',
    price: 799000,
    bedrooms: 2,
    baths: 2,
    sqft: 900,
    capRate: 4.5,
  },
  {
    mls: 'RLT10002',
    street: '415 Main St',
    city: 'Vancouver',
    province: 'BC',
    price: 995000,
    bedrooms: 2,
    baths: 2,
    sqft: 860,
    capRate: 3.9,
  },
  {
    mls: 'RLT10003',
    street: '88 Jasper Ave',
    city: 'Edmonton',
    province: 'AB',
    price: 455000,
    bedrooms: 3,
    baths: 2,
    sqft: 1280,
    capRate: 6.2,
  },
];

async function run(): Promise<void> {
  for (const listing of listings) {
    await db.query(
      `INSERT INTO listings (
        mls_number,
        status,
        list_date,
        property_type,
        structure_type,
        address_street,
        address_city,
        address_province,
        list_price,
        bedrooms,
        bathrooms_full,
        square_footage,
        estimated_monthly_rent,
        cap_rate,
        gross_yield,
        cash_flow_monthly,
        synced_at
      ) VALUES (
        $1, 'Active', CURRENT_DATE, 'Residential', 'Condo',
        $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, NOW()
      )
      ON CONFLICT (mls_number) DO UPDATE
      SET list_price = EXCLUDED.list_price,
          cap_rate = EXCLUDED.cap_rate,
          gross_yield = EXCLUDED.gross_yield,
          cash_flow_monthly = EXCLUDED.cash_flow_monthly,
          synced_at = NOW()`,
      [
        listing.mls,
        listing.street,
        listing.city,
        listing.province,
        listing.price,
        listing.bedrooms,
        listing.baths,
        listing.sqft,
        listing.price * 0.005,
        listing.capRate,
        listing.capRate + 1.2,
        450,
      ],
    );
  }

  logger.info('Seed complete', { count: listings.length });
}

run()
  .then(() => db.end())
  .catch(async (error) => {
    logger.error('Seed failed', { error: error instanceof Error ? error.message : String(error) });
    await db.end();
    process.exit(1);
  });
