/**
 * Realtor.ca Listing Scraper
 * Fetches a public realtor.ca listing and extracts property details
 * for import into the Realist deal analyzer.
 * 
 * Usage:
 *   node scraper.js <realtor.ca-url>
 *   node scraper.js "https://www.realtor.ca/realestate/12345"
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Extract MLS number from various realtor.ca URL formats
function extractMlsFromUrl(url) {
  // Format: /realestate/12345 or /listing/12345
  const match = url.match(/\/(?:realestate|listing)\/(\d+)/);
  if (match) return match[1];
  
  // Format: ?mls=12345
  const queryMatch = url.match(/[?&]mls=(\d+)/);
  if (queryMatch) return queryMatch[1];
  
  return null;
}

// Fetch HTML from a URL
function fetchHtml(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-CA,en-US;q=0.7,en;q=0.3',
      },
      timeout: 15000,
    };

    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Parse JSON-LD structured data from HTML
function extractJsonLd(html) {
  const jsonLdMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (!jsonLdMatches) return null;

  for (const script of jsonLdMatches) {
    try {
      const jsonMatch = script.match(/>([\s\S]*?)<\/script>/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[1]);
        // Look for RealEstateListing or similar
        if (data['@type'] === 'RealEstateListing' || 
            data['@type'] === 'SingleFamilyResidence' ||
            data['@type'] === 'MultiFamily' ||
            data['@type'] === 'Apartment' ||
            data['@type'] === 'Townhouse') {
          return data;
        }
        // Check nested array
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item['@type']?.includes('Residence') || item['@type']?.includes('Listing')) {
              return item;
            }
          }
        }
      }
    } catch (e) {
      // Skip invalid JSON
    }
  }
  return null;
}

// Extract property details from JSON-LD
function parseJsonLd(jsonLd) {
  const result = {
    mls_number: null,
    address_street: null,
    address_city: null,
    address_province: null,
    postal_code: null,
    list_price: null,
    bedrooms: null,
    bathrooms_full: null,
    bathrooms_partial: null,
    square_footage: null,
    property_type: null,
    year_built: null,
    description: null,
    photos: [],
    latitude: null,
    longitude: null,
  };

  if (!jsonLd) return result;

  // Address
  if (jsonLd.address) {
    result.address_street = jsonLd.address.streetAddress || jsonLd.address.addressLocality;
    result.address_city = jsonLd.address.addressLocality;
    result.address_province = jsonLd.address.addressRegion;
    result.postal_code = jsonLd.address.postalCode;
  }

  // Price
  if (jsonLd.price) {
    const priceStr = jsonLd.price;
    if (typeof priceStr === 'string') {
      result.list_price = parseInt(priceStr.replace(/[^0-9]/g, ''), 10);
    } else if (typeof priceStr === 'number') {
      result.list_price = priceStr;
    }
  }

  // Property details
  if (jsonLd.numberOfRooms) result.bedrooms = jsonLd.numberOfRooms;
  if (jsonLd.numberOfBathroomsTotal) result.bathrooms_full = jsonLd.numberOfBathroomsTotal;
  if (jsonLd.floorSize) {
    const sqft = jsonLd.floorSize.value || jsonLd.floorSize;
    result.square_footage = typeof sqft === 'string' ? parseInt(sqft.replace(/[^0-9]/g, ''), 10) : sqft;
  }
  if (jsonLd.propertyType) result.property_type = jsonLd.propertyType;
  if (jsonLd.yearBuilt) result.year_built = jsonLd.yearBuilt;
  if (jsonLd.description) result.description = jsonLd.description;
  
  // Geo
  if (jsonLd.geo) {
    result.latitude = jsonLd.geo.latitude;
    result.longitude = jsonLd.geo.longitude;
  }

  // Photos
  if (jsonLd.image) {
    if (Array.isArray(jsonLd.image)) {
      result.photos = jsonLd.image.map(img => typeof img === 'string' ? img : img.url).filter(Boolean);
    } else if (typeof jsonLd.image === 'string') {
      result.photos = [jsonLd.image];
    }
  }

  return result;
}

// Extract data from meta tags
function extractMetaTags(html) {
  const result = {};
  
  // OG tags
  const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/i);
  const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/i);
  const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/i);
  const ogPrice = html.match(/<meta[^>]*property="og:price:amount"[^>]*content="([^"]*)"/i);
  
  if (ogTitle) result.og_title = ogTitle[1];
  if (ogDesc) result.og_description = ogDesc[1];
  if (ogImage) result.og_image = ogImage[1];
  if (ogPrice) result.og_price = parseInt(ogPrice[1].replace(/[^0-9]/g, ''), 10);
  
  return result;
}

// Extract from page text content as fallback
function extractFromText(html) {
  const result = {};
  
  // Try to find price
  const priceMatch = html.match(/[\$CA]?\s*([\d,]+)\s*(?:CAD|CAD\.?)?/);
  if (priceMatch) {
    result.price_text = priceMatch[0];
  }
  
  // Try to find bedrooms
  const bedMatch = html.match(/(\d+)\s*(?:bedroom|bed|br|bdr)/i);
  if (bedMatch) {
    result.bedrooms_text = parseInt(bedMatch[1], 10);
  }
  
  // Try to find bathrooms  
  const bathMatch = html.match(/(\d+)\s*(?:bathroom|bath|ba)/i);
  if (bathMatch) {
    result.bathrooms_text = parseInt(bathMatch[1], 10);
  }
  
  // Try to find sqft
  const sqftMatch = html.match(/([\d,]+)\s*(?:sq\.?\s*ft\.?|square\s*feet)/i);
  if (sqftMatch) {
    result.sqft_text = parseInt(sqftMatch[1].replace(/,/g, ''), 10);
  }
  
  return result;
}

// Main scraper function
async function scrapeRealtorCaListing(url) {
  console.log(`Fetching: ${url}\n`);
  
  const html = await fetchHtml(url);
  
  // Try JSON-LD first (most reliable)
  const jsonLd = extractJsonLd(html);
  let data = parseJsonLd(jsonLd);
  
  // Add meta tag info
  const metaData = extractMetaTags(html);
  data.meta = metaData;
  
  // Add text extraction as fallback
  const textData = extractFromText(html);
  data.text_fallback = textData;
  
  // If no price from JSON-LD, try meta
  if (!data.list_price && metaData.og_price) {
    data.list_price = metaData.og_price;
  }
  
  // Clean up null values
  Object.keys(data).forEach(key => {
    if (data[key] === null || data[key] === undefined) {
      delete data[key];
    }
  });
  
  return data;
}

// CLI
async function main() {
  const url = process.argv[2];
  
  if (!url) {
    console.error('Usage: node scraper.js <realtor.ca-url>');
    console.error('Example: node scraper.js "https://www.realtor.ca/realestate/28069865"');
    process.exit(1);
  }
  
  // Validate URL contains realtor.ca
  if (!url.includes('realtor.ca')) {
    console.error('Error: URL must be from realtor.ca');
    process.exit(1);
  }
  
  try {
    const data = await scrapeRealtorCaListing(url);
    console.log('\n=== EXTRACTED DATA ===\n');
    console.log(JSON.stringify(data, null, 2));
    
    // Summary
    console.log('\n=== SUMMARY ===\n');
    console.log(`Address: ${data.address_street || 'N/A'}, ${data.address_city || 'N/A'}, ${data.address_province || 'N/A'}`);
    console.log(`Price: ${data.list_price ? '$' + data.list_price.toLocaleString() : 'N/A'}`);
    console.log(`Beds: ${data.bedrooms || 'N/A'}`);
    console.log(`Baths: ${data.bathrooms_full || 'N/A'}`);
    console.log(`Sqft: ${data.square_footage || 'N/A'}`);
    console.log(`Type: ${data.property_type || 'N/A'}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

module.exports = { scrapeRealtorCaListing };

if (require.main === module) {
  main();
}
