/**
 * Realtor.ca Listing Scraper using Browser Automation
 * Uses Playwright to fetch and parse realtor.ca listings
 * 
 * Usage:
 *   node scraper-browser.js <realtor.ca-url>
 *   node scraper-browser.js "https://www.realtor.ca/real-estate/29357438/..."
 */

const { chromium } = require('playwright');

/**
 * Scrape a realtor.ca listing using a browser
 */
async function scrapeWithBrowser(url) {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-CA',
  });
  
  const page = await context.newPage();
  
  console.log(`Fetching: ${url}`);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for the main content to load
    await page.waitForSelector('h1', { timeout: 10000 }).catch(() => {});
    
    // Additional wait for dynamic content
    await page.waitForTimeout(2000);
    
    // Check if it's a valid listing page
    const title = await page.title();
    console.log('Page title:', title);
    
    // Look for 404 or error page
    if (title.includes('does not exist') || title.includes('Oh No')) {
      throw new Error('Listing not found (404)');
    }
    
    // Extract data from the page using evaluate
    const data = await page.evaluate(() => {
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
      
      // Try JSON-LD structured data first (most reliable)
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const text = script.textContent;
          const data = JSON.parse(text);
          
          // Find the RealEstateListing or related types
          const findListing = (obj) => {
            if (!obj) return null;
            if (obj['@type'] === 'RealEstateListing') return obj;
            if (obj['@type'] === 'SingleFamilyResidence') return obj;
            if (obj['@type'] === 'MultiFamily') return obj;
            if (obj['@type'] === 'Apartment') return obj;
            if (obj['@type'] === 'Townhouse') return obj;
            if (obj['@type'] === 'Condominium') return obj;
            if (Array.isArray(obj)) {
              for (const item of obj) {
                const found = findListing(item);
                if (found) return found;
              }
            }
            if (obj['@graph'] && Array.isArray(obj['@graph'])) {
              for (const item of obj['@graph']) {
                const found = findListing(item);
                if (found) return found;
              }
            }
            return null;
          };
          
          const listing = findListing(data);
          if (listing) {
            // Address
            if (listing.address) {
              result.address_street = listing.address.streetAddress || listing.address.addressLocality;
              result.address_city = listing.address.addressLocality;
              result.address_province = listing.address.addressRegion;
              result.postal_code = listing.address.postalCode;
            }
            
            // Price
            if (listing.price) {
              const price = listing.price;
              if (typeof price === 'string') {
                result.list_price = parseInt(price.replace(/[^0-9]/g, ''), 10);
              } else if (typeof price === 'number') {
                result.list_price = price;
              }
            }
            
            // Property details
            if (listing.numberOfRooms) result.bedrooms = listing.numberOfRooms;
            if (listing.numberOfBathroomsTotal) result.bathrooms_full = listing.numberOfBathroomsTotal;
            if (listing.floorSize) {
              const sqft = listing.floorSize.value || listing.floorSize;
              result.square_footage = typeof sqft === 'string' ? parseInt(sqft.replace(/[^0-9]/g, ''), 10) : sqft;
            }
            if (listing.propertyType) result.property_type = listing.propertyType;
            if (listing.yearBuilt) result.year_built = listing.yearBuilt;
            if (listing.description) result.description = listing.description.substring(0, 500);
            
            // Geo
            if (listing.geo?.latitude) result.latitude = listing.geo.latitude;
            if (listing.geo?.longitude) result.longitude = listing.geo.longitude;
            
            // Photos
            if (listing.image) {
              if (Array.isArray(listing.image)) {
                result.photos = listing.image.slice(0, 5).map(img => typeof img === 'string' ? img : img.url).filter(Boolean);
              } else if (typeof listing.image === 'string') {
                result.photos = [listing.image];
              }
            }
            
            return result;
          }
        } catch (e) {}
      }
      
      // Fallback: Extract from page text
      
      // Get heading with address
      const heading = document.querySelector('h1');
      if (heading) {
        const headingText = heading.textContent;
        
        // Try to extract address parts
        const addressMatch = headingText.match(/^[\d\-\s]+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Court|Ct|Way|Crescent|Cres|Lane|Ln|Place|Pl)[,\s]+/i);
        if (addressMatch) {
          result.address_street = addressMatch[0].trim().replace(/,\s*$/, '');
        }
        
        // Extract city/area
        const cityMatch = headingText.match(/\(([^)]+)\)/);
        if (cityMatch) {
          result.address_city = cityMatch[1].trim();
        }
        
        // Extract postal code
        const postalMatch = headingText.match(/[A-Z]\d[A-Z]\s*\d[A-Z]\d/i);
        if (postalMatch) {
          result.postal_code = postalMatch[0].toUpperCase().replace(/\s/g, '');
        }
      }
      
      // Get price from page
      const priceText = document.body.innerText;
      const priceMatch = priceText.match(/\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
      if (priceMatch) {
        result.list_price = parseInt(priceMatch[1].replace(/,/g, ''), 10);
      }
      
      // Get beds/baths from text
      const bedMatch = priceText.match(/(\d+)\s*(?:Bedroom|Bed|Beds|BR|Bdr)/i);
      if (bedMatch) {
        result.bedrooms = parseInt(bedMatch[1], 10);
      }
      
      const bathMatch = priceText.match(/(\d+)\s*(?:Bathroom|Bath|Baths|BA)/i);
      if (bathMatch) {
        result.bathrooms_full = parseInt(bathMatch[1], 10);
      }
      
      // Get sqft
      const sqftMatch = priceText.match(/(\d+)\s*(?:\+\s*\d+\s*)?(?:Square\s*Feet|Sq\.?\s*Ft\.?|sqft)/i);
      if (sqftMatch) {
        result.square_footage = parseInt(sqftMatch[1].replace(/,/g, ''), 10);
      }
      
      // Try to find MLS number
      const mlsMatch = priceText.match(/MLS®?\s*Number:\s*([A-Z0-9]+)/i);
      if (mlsMatch) {
        result.mls_number = mlsMatch[1];
      }
      
      return result;
    });
    
    // Clean up null values
    Object.keys(data).forEach(key => {
      if (data[key] === null || data[key] === undefined) {
        delete data[key];
      }
    });
    
    return data;
    
  } finally {
    await browser.close();
  }
}

// CLI
async function main() {
  const url = process.argv[2];
  
  if (!url) {
    console.error('Usage: node scraper-browser.js <realtor.ca-url>');
    console.error('Example: node scraper-browser.js "https://www.realtor.ca/real-estate/29357438/3106-28-linden-street-toronto-cabbagetown-south-st-james-town"');
    process.exit(1);
  }
  
  if (!url.includes('realtor.ca')) {
    console.error('Error: URL must be from realtor.ca');
    process.exit(1);
  }
  
  try {
    const data = await scrapeWithBrowser(url);
    
    console.log('\n=== EXTRACTED DATA ===\n');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\n=== SUMMARY ===\n');
    console.log(`Address: ${data.address_street || 'N/A'}, ${data.address_city || 'N/A'}, ${data.address_province || 'N/A'}`);
    console.log(`Price: ${data.list_price ? '$' + data.list_price.toLocaleString() : 'N/A'}`);
    console.log(`Beds: ${data.bedrooms || 'N/A'}`);
    console.log(`Baths: ${data.bathrooms_full || 'N/A'}`);
    console.log(`Sqft: ${data.square_footage || 'N/A'}`);
    console.log(`Type: ${data.property_type || 'N/A'}`);
    console.log(`MLS: ${data.mls_number || 'N/A'}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

module.exports = { scrapeWithBrowser };

if (require.main === module) {
  main();
}
