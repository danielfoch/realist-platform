/**
 * Comprehensive Seed Script
 * Seeds realistic Canadian listings with investment data
 */

import dotenv from 'dotenv';
import { db } from '../db';
import { logger } from '../logger';
import { calculateInvestmentMetrics } from '../investment-metrics';

dotenv.config();

interface SeedListing {
  mls: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  price: number;
  bedrooms: number;
  baths: number;
  sqft: number;
  propertyType: string;
  structureType: string;
  latitude: number;
  longitude: number;
  monthlyRent: number;
}

// Realistic Canadian rental data (estimated market rents)
const rentData: Record<string, number> = {
  'Toronto': 2800,
  'Vancouver': 3200,
  'Montreal': 2200,
  'Calgary': 2100,
  'Edmonton': 1800,
  'Ottawa': 2400,
  'Winnipeg': 1600,
  'Halifax': 2000,
  'Hamilton': 2200,
  'Kitchener': 2100,
  'London': 1900,
  'Victoria': 2700,
  'Richmond Hill': 3000,
  'Mississauga': 2600,
  'Brampton': 2400,
};

const listings: SeedListing[] = [
  // Ontario - Toronto Area
  {
    mls: 'ONW123456',
    street: '120 King St W',
    city: 'Toronto',
    province: 'ON',
    postalCode: 'M5X 1C4',
    price: 799000,
    bedrooms: 2,
    baths: 2,
    sqft: 900,
    propertyType: 'Residential',
    structureType: 'Condo',
    latitude: 43.6446,
    longitude: -79.3933,
    monthlyRent: 2800,
  },
  {
    mls: 'ONW123457',
    street: '85 Emmett Ave',
    city: 'Toronto',
    province: 'ON',
    postalCode: 'M6H 2H3',
    price: 649000,
    bedrooms: 3,
    baths: 2,
    sqft: 1100,
    propertyType: 'Residential',
    structureType: 'Condo',
    latitude: 43.6618,
    longitude: -79.4648,
    monthlyRent: 2600,
  },
  {
    mls: 'ONW123458',
    street: '425 Richmond St',
    city: 'Toronto',
    province: 'ON',
    postalCode: 'M5V 3A7',
    price: 549000,
    bedrooms: 1,
    baths: 1,
    sqft: 600,
    propertyType: 'Residential',
    structureType: 'Condo',
    latitude: 43.6491,
    longitude: -79.3838,
    monthlyRent: 2200,
  },
  // Vancouver
  {
    mls: 'BCV123456',
    street: '888 Hamilton St',
    city: 'Vancouver',
    province: 'BC',
    postalCode: 'V6B 0H7',
    price: 995000,
    bedrooms: 2,
    baths: 2,
    sqft: 1050,
    propertyType: 'Residential',
    structureType: 'Condo',
    latitude: 49.2776,
    longitude: -123.1207,
    monthlyRent: 3200,
  },
  {
    mls: 'BCV123457',
    street: '1050 Mainland St',
    city: 'Vancouver',
    province: 'BC',
    postalCode: 'V6B 2T9',
    price: 749000,
    bedrooms: 1,
    baths: 1,
    sqft: 720,
    propertyType: 'Residential',
    structureType: 'Condo',
    latitude: 49.2734,
    longitude: -123.1208,
    monthlyRent: 2600,
  },
  // Montreal
  {
    mls: 'QCM123456',
    street: '1450 Rue Peel',
    city: 'Montreal',
    province: 'QC',
    postalCode: 'H3A 1S4',
    price: 485000,
    bedrooms: 2,
    baths: 1,
    sqft: 850,
    propertyType: 'Residential',
    structureType: 'Condo',
    latitude: 45.5017,
    longitude: -73.5673,
    monthlyRent: 1800,
  },
  {
    mls: 'QCM123457',
    street: '350 Rue de la Commune',
    city: 'Montreal',
    province: 'QC',
    postalCode: 'H2Y 2E2',
    price: 425000,
    bedrooms: 1,
    baths: 1,
    sqft: 650,
    propertyType: 'Residential',
    structureType: 'Condo',
    latitude: 45.5089,
    longitude: -73.5536,
    monthlyRent: 1600,
  },
  // Calgary
  {
    mls: 'ABC123456',
    street: '510 9th Ave SW',
    city: 'Calgary',
    province: 'AB',
    postalCode: 'T2P 0L7',
    price: 389000,
    bedrooms: 2,
    baths: 2,
    sqft: 950,
    propertyType: 'Residential',
    structureType: 'Condo',
    latitude: 51.0453,
    longitude: -114.0633,
    monthlyRent: 1900,
  },
  // Edmonton
  {
    mls: 'ABE123456',
    street: '10350 100 St NW',
    city: 'Edmonton',
    province: 'AB',
    postalCode: 'T5J 0Y8',
    price: 289000,
    bedrooms: 2,
    baths: 2,
    sqft: 1050,
    propertyType: 'Residential',
    structureType: 'Condo',
    latitude: 53.5422,
    longitude: -113.4988,
    monthlyRent: 1600,
  },
  // Ottawa
  {
    mls: 'ONO123456',
    street: '150 Elgin St',
    city: 'Ottawa',
    province: 'ON',
    postalCode: 'K2P 2L4',
    price: 549000,
    bedrooms: 2,
    baths: 2,
    sqft: 950,
    propertyType: 'Residential',
    structureType: 'Condo',
    latitude: 45.4215,
    longitude: -75.6972,
    monthlyRent: 2400,
  },
  // Halifax
  {
    mls: 'NSH123456',
    street: '1888 Brunswick St',
    city: 'Halifax',
    province: 'NS',
    postalCode: 'B3J 3J8',
    price: 375000,
    bedrooms: 2,
    baths: 1,
    sqft: 900,
    propertyType: 'Residential',
    structureType: 'Condo',
    latitude: 44.6488,
    longitude: -63.5752,
    monthlyRent: 2000,
  },
  // Hamilton
  {
    mls: 'ONH123456',
    street: '175 Rebecca St',
    city: 'Hamilton',
    province: 'ON',
    postalCode: 'L8R 1B4',
    price: 449000,
    bedrooms: 2,
    baths: 2,
    sqft: 1000,
    propertyType: 'Residential',
    structureType: 'Condo',
    latitude: 43.2557,
    longitude: -79.8711,
    monthlyRent: 2100,
  },
  // Multi-family / Investment properties
  {
    mls: 'ONW123459',
    street: '45 Dundas St E',
    city: 'Toronto',
    province: 'ON',
    postalCode: 'M5B 2G8',
    price: 1250000,
    bedrooms: 4,
    baths: 3,
    sqft: 2000,
    propertyType: 'Residential',
    structureType: 'Multi-Family',
    latitude: 43.6544,
    longitude: -79.3805,
    monthlyRent: 4800,
  },
  {
    mls: 'ONW123460',
    street: '2500 Bloor St W',
    city: 'Toronto',
    province: 'ON',
    postalCode: 'M6S 1R8',
    price: 1890000,
    bedrooms: 6,
    baths: 4,
    sqft: 3200,
    propertyType: 'Residential',
    structureType: 'House',
    latitude: 43.6617,
    longitude: -79.4647,
    monthlyRent: 7200,
  },
  // Greater Toronto Area
  {
    mls: 'ONR123456',
    street: '15 Hwy 7',
    city: 'Richmond Hill',
    province: 'ON',
    postalCode: 'L4B 1H3',
    price: 685000,
    bedrooms: 2,
    baths: 2,
    sqft: 900,
    propertyType: 'Residential',
    structureType: 'Condo',
    latitude: 43.8694,
    longitude: -79.4273,
    monthlyRent: 2600,
  },
  {
    mls: 'ONM123456',
    street: '100 City Centre Dr',
    city: 'Mississauga',
    province: 'ON',
    postalCode: 'L5B 2C9',
    price: 595000,
    bedrooms: 2,
    baths: 2,
    sqft: 850,
    propertyType: 'Residential',
    structureType: 'Condo',
    latitude: 43.5936,
    longitude: -79.6471,
    monthlyRent: 2400,
  },
  // London Ontario
  {
    mls: 'ONL123456',
    street: '200 King St',
    city: 'London',
    province: 'ON',
    postalCode: 'N6A 3N7',
    price: 349000,
    bedrooms: 2,
    baths: 1,
    sqft: 850,
    propertyType: 'Residential',
    structureType: 'Condo',
    latitude: 42.9849,
    longitude: -81.2453,
    monthlyRent: 1700,
  },
  // Victoria BC
  {
    mls: 'BCVIC123456',
    street: '757 Douglas St',
    city: 'Victoria',
    province: 'BC',
    postalCode: 'V8W 2B5',
    price: 649000,
    bedrooms: 1,
    baths: 1,
    sqft: 700,
    propertyType: 'Residential',
    structureType: 'Condo',
    latitude: 48.4284,
    longitude: -123.3656,
    monthlyRent: 2400,
  },
  // Winnipeg
  {
    mls: 'MBW123456',
    street: '300 Portage Ave',
    city: 'Winnipeg',
    province: 'MB',
    postalCode: 'R3C 0H1',
    price: 249000,
    bedrooms: 2,
    baths: 1,
    sqft: 900,
    propertyType: 'Residential',
    structureType: 'Condo',
    latitude: 49.8951,
    longitude: -97.1384,
    monthlyRent: 1400,
  },
  // Kitchener
  {
    mls: 'ONK123456',
    street: '100 King St W',
    city: 'Kitchener',
    province: 'ON',
    postalCode: 'N2H 5G5',
    price: 389000,
    bedrooms: 2,
    baths: 1,
    sqft: 850,
    propertyType: 'Residential',
    structureType: 'Condo',
    latitude: 43.4516,
    longitude: -80.4925,
    monthlyRent: 1800,
  },
];

async function run(): Promise<void> {
  let inserted = 0;
  let updated = 0;

  for (const listing of listings) {
    // Calculate investment metrics
    const metrics = calculateInvestmentMetrics({
      listPrice: listing.price,
      monthlyRent: listing.monthlyRent,
      maintenanceFee: listing.structureType === 'Condo' ? listing.price * 0.005 : 200,
    });

    try {
      const result = await db.query(
        `INSERT INTO listings (
          mls_number,
          status,
          list_date,
          property_type,
          structure_type,
          address_street,
          address_unit,
          address_city,
          address_province,
          address_postal_code,
          address_country,
          list_price,
          bedrooms,
          bathrooms_full,
          square_footage,
          latitude,
          longitude,
          estimated_monthly_rent,
          cap_rate,
          gross_yield,
          cash_flow_monthly,
          rent_data_source,
          rent_data_updated_at,
          synced_at
        ) VALUES (
          $1, 'Active', CURRENT_DATE, $2, $3, $4, NULL, $5, $6, $7, 'CAN', $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, 'seed', NOW(), NOW()
        )
        ON CONFLICT (mls_number) DO UPDATE
        SET list_price = EXCLUDED.list_price,
            bedrooms = EXCLUDED.bedrooms,
            bathrooms_full = EXCLUDED.bathrooms_full,
            estimated_monthly_rent = EXCLUDED.estimated_monthly_rent,
            cap_rate = EXCLUDED.cap_rate,
            gross_yield = EXCLUDED.gross_yield,
            cash_flow_monthly = EXCLUDED.cash_flow_monthly,
            rent_data_updated_at = NOW(),
            synced_at = NOW()
        RETURNING (xmax = 0) AS inserted`,
        [
          listing.mls,
          listing.propertyType,
          listing.structureType,
          listing.street,
          listing.city,
          listing.province,
          listing.postalCode,
          listing.price,
          listing.bedrooms,
          listing.baths,
          listing.sqft,
          listing.latitude,
          listing.longitude,
          metrics.estimated_monthly_rent,
          metrics.cap_rate,
          metrics.gross_yield,
          metrics.cash_flow_monthly,
        ],
      );

      const isInserted = result.rows[0]?.inserted;
      if (isInserted) {
        inserted++;
      } else {
        updated++;
      }
    } catch (error) {
      logger.error('Failed to seed listing', { mls: listing.mls, error });
    }
  }

  logger.info('Seed complete', { total: listings.length, inserted, updated });
  
  // Print summary of cap rates by city
  const summary = await db.query(`
    SELECT 
      address_city,
      address_province,
      COUNT(*) as count,
      ROUND(AVG(list_price), 0) as avg_price,
      ROUND(AVG(cap_rate), 2) as avg_cap_rate,
      ROUND(AVG(estimated_monthly_rent), 0) as avg_rent
    FROM listings
    WHERE cap_rate IS NOT NULL
    GROUP BY address_city, address_province
    ORDER BY avg_cap_rate DESC
  `);
  
  console.log('\n=== Seed Summary by City ===');
  console.table(summary.rows);
}

run()
  .then(() => db.end())
  .catch(async (error) => {
    logger.error('Seed failed', { error: error instanceof Error ? error.message : String(error) });
    await db.end();
    process.exit(1);
  });
