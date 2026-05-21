/**
 * Test DDF Connection
 * Verify credentials and test basic API functionality
 */

import { DDFClient } from './ddf-client';
import * as dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  console.log('🧪 Testing CREA DDF Connection\n');
  console.log('='.repeat(50));

  const credentials = {
    username: process.env.DDF_USERNAME || '',
    password: process.env.DDF_PASSWORD || '',
    userAgent: 'Realist.ca/1.0 (Test)',
  };

  if (!credentials.username || !credentials.password) {
    console.error('❌ Missing DDF_USERNAME or DDF_PASSWORD environment variables');
    process.exit(1);
  }

  console.log(`\n📋 Credentials:`);
  console.log(`   Username: ${credentials.username}`);
  console.log(`   Password: ${'*'.repeat(credentials.password.length)}`);
  console.log(`   User Agent: ${credentials.userAgent}\n`);

  const client = new DDFClient(credentials);

  try {
    // Test 1: Authentication
    console.log('Test 1: Authentication');
    console.log('-'.repeat(50));
    
    const authenticated = await client.login();
    
    if (!authenticated) {
      console.error('❌ Authentication failed!');
      console.error('   Please verify your credentials are correct.');
      process.exit(1);
    }

    console.log('✅ Authentication successful!\n');

    // Test 2: Fetch metadata
    console.log('Test 2: Fetch Metadata');
    console.log('-'.repeat(50));
    
    try {
      const metadata = await client.getMetadata();
      console.log('✅ Metadata fetched successfully');
      console.log(`   Available resources: ${JSON.stringify(metadata, null, 2).substring(0, 200)}...\n`);
    } catch (error: any) {
      console.warn('⚠️  Metadata fetch failed:', error.message);
      console.warn('   This may be normal - continuing tests...\n');
    }

    // Test 3: Search for listings
    console.log('Test 3: Search Listings');
    console.log('-'.repeat(50));
    
    try {
      const listings = await client.searchListings({
        status: ['Active'],
        limit: 5,
      });

      console.log(`✅ Found ${listings.length} listings`);
      
      if (listings.length > 0) {
        console.log('\n   Sample listing:');
        const sample = listings[0];
        if (!sample) {
          throw new Error('Search returned empty sample unexpectedly');
        }
        console.log(`   MLS: ${sample.MlsNumber}`);
        console.log(`   Address: ${sample.StreetAddress}, ${sample.City}`);
        console.log(`   Price: $${parseFloat(sample.ListPrice).toLocaleString()}`);
        console.log(`   Beds/Baths: ${sample.BedroomsTotal}/${sample.BathroomsTotalInteger}`);
        console.log(`   Type: ${sample.PropertySubType || sample.PropertyType}`);
        
        // Test 4: Fetch photos for first listing
        console.log('\n\nTest 4: Fetch Photos');
        console.log('-'.repeat(50));
        
        try {
          const photos = await client.getPhotos(sample.ListingKey);
          console.log(`✅ Found ${photos.length} photos for listing ${sample.MlsNumber}`);
        } catch (error: any) {
          console.warn('⚠️  Photo fetch failed:', error.message);
        }
      } else {
        console.warn('⚠️  No listings found in search results');
      }
    } catch (error: any) {
      console.error('❌ Search failed:', error.message);
      if (error.response) {
        console.error(`   Response status: ${error.response.status}`);
        console.error(`   Response data: ${JSON.stringify(error.response.data).substring(0, 200)}`);
      }
    }

    // Logout
    console.log('\n\nTest 5: Logout');
    console.log('-'.repeat(50));
    await client.logout();
    console.log('✅ Logout successful\n');

    console.log('='.repeat(50));
    console.log('✅ All tests completed!');
    console.log('\nNext steps:');
    console.log('1. Run database migrations: npm run migrate');
    console.log('2. Test sync script: npm run sync');
    console.log('3. Start the server: npm run dev');

  } catch (error: any) {
    console.error('\n❌ Connection test failed:', error.message);
    
    if (error.response) {
      console.error(`\nResponse status: ${error.response.status}`);
      console.error(`Response headers:`, error.response.headers);
      console.error(`Response data:`, error.response.data);
    }

    console.error('\n📚 Troubleshooting:');
    console.error('1. Verify your credentials are correct');
    console.error('2. Check if your IP is whitelisted with CREA');
    console.error('3. Ensure your account has active DDF access');
    console.error('4. Try contacting CREA support for endpoint URLs');
    
    process.exit(1);
  }
}

// Run the test
testConnection();
