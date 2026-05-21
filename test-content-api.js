#!/usr/bin/env node

// Test script for Realist.ca content API
// Tests the new SEO content infrastructure

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';
const TEST_API_KEY = process.env.RENT_API_KEY || 'hO1LlvwP4nkk1EGtkkruWBb2';

async function testContentAPI() {
  console.log('Testing Realist.ca Content API...\n');
  
  try {
    // Test 1: Get blog posts
    console.log('1. Testing GET /api/blog...');
    const blogResponse = await axios.get(`${API_BASE}/blog`);
    console.log(`   Status: ${blogResponse.status}`);
    console.log(`   Posts returned: ${blogResponse.data.data?.length || 0}`);
    
    // Test 2: Get guides
    console.log('\n2. Testing GET /api/guides...');
    const guidesResponse = await axios.get(`${API_BASE}/guides`);
    console.log(`   Status: ${guidesResponse.status}`);
    console.log(`   Guides returned: ${guidesResponse.data.data?.length || 0}`);
    
    // Test 3: Get featured content
    console.log('\n3. Testing GET /api/content/featured...');
    const featuredResponse = await axios.get(`${API_BASE}/content/featured`);
    console.log(`   Status: ${featuredResponse.status}`);
    console.log(`   Featured items: ${featuredResponse.data.data?.length || 0}`);
    
    // Test 4: Test search
    console.log('\n4. Testing GET /api/content/search?q=real...');
    const searchResponse = await axios.get(`${API_BASE}/content/search?q=real`);
    console.log(`   Status: ${searchResponse.status}`);
    console.log(`   Search results: ${searchResponse.data.data?.length || 0}`);
    
    // Test 5: Test sitemap data
    console.log('\n5. Testing GET /api/content/sitemap...');
    const sitemapResponse = await axios.get(`${API_BASE}/content/sitemap`);
    console.log(`   Status: ${sitemapResponse.status}`);
    if (sitemapResponse.data.data) {
      console.log(`   Blog URLs: ${sitemapResponse.data.data.blog?.length || 0}`);
      console.log(`   Guide URLs: ${sitemapResponse.data.data.guides?.length || 0}`);
    }
    
    console.log('\n✅ All GET tests passed!');
    
    // Note: POST/PUT/DELETE tests would require authentication
    console.log('\n📝 Note: To test admin endpoints (POST/PUT/DELETE), use:');
    console.log(`   Headers: { 'x-api-key': '${TEST_API_KEY}' }`);
    console.log('   Or query param: ?api_key=YOUR_API_KEY');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${error.response.data?.error || 'Unknown error'}`);
    }
    process.exit(1);
  }
}

// Check if server is running
async function checkServer() {
  try {
    await axios.get(`${API_BASE}/health`, { timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('Checking if server is running on http://localhost:3000...');
  
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.log('❌ Server not running. Please start the server first:');
    console.log('   cd ~/.openclaw/workspace-lite/realist-platform');
    console.log('   npm run dev');
    process.exit(1);
  }
  
  console.log('✅ Server is running!\n');
  await testContentAPI();
}

main();