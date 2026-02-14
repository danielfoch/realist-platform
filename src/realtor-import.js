/**
 * Realtor.ca Import API Route
 * Add this to your Express server in Replit
 * 
 * Usage:
 *   POST /api/import-realtor
 *   Body: { "url": "https://www.realtor.ca/real-estate/29357438/..." }
 *   Returns: { success: true, data: { address, price, beds, baths, sqft, ... } }
 */

const axios = require('axios');
const { chromium } = require('playwright');

/**
 * Extract MLS number from URL
 */
function extractMlsFromUrl(url) {
  const match = url.match(/\/real-estate\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Main scraping function
 */
async function scrapeRealtorListing(url) {
  const mlsId = extractMlsFromUrl(url);
  if (!mlsId) {
    throw new Error('Invalid realtor.ca URL - could not extract MLS ID');
  }

  // Try the API endpoint first (no browser needed if it works)
  try {
    const apiData = await tryApiApproach(mlsId);
    if (apiData) return apiData;
  } catch (e) {
    console.log('API approach failed, trying browser...');
  }

  // Fallback to browser scraping
  return await scrapeWithBrowser(url);
}

/**
 * Try to get data from realtor.ca's API (faster, no browser)
 */
async function tryApiApproach(mlsId) {
  // This may or may not work depending on CREA's API restrictions
  const apiUrl = `https://api2.realtor.ca/Listing.svc/PropertyDetails_Post`;
  
  try {
    const response = await axios.post(
      apiUrl,
      {
        PropertyID: mlsId,
        HashID: mlsId,
        Language: 'en',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        timeout: 10000,
      }
    );
    
    if (response.data) {
      return parseApiResponse(response.data);
    }
  } catch (e) {
    // API call failed
    return null;
  }
}

/**
 * Parse API response into our format
 */
function parseApiResponse(apiData) {
  // The API response structure varies - this is a best-effort parse
  const result = {
    mls_number: apiData.Id || apiData.MLSNumber,
    list_price: apiData.Price || apiData.ListPrice,
    address_street: apiData.Address?.AddressText,
    address_city: apiData.Address?.City,
    address_province: apiData.Address?.Province,
    postal_code: apiData.Address?.PostalCode,
    bedrooms: apiData.Building?.Bedrooms,
    bathrooms_full: apiData.Building?.BathroomTotal,
    square_footage: apiData.Building?.SquareFootage,
    property_type: apiData.PropertyType || apiData.Type,
    description: apiData.PublicRemarks,
    photos: [],
  };

  // Clean up
  Object.keys(result).forEach(key => {
    if (result[key] === null || result[key] === undefined || result[key] === '') {
      delete result[key];
    }
  });

  return result;
}

/**
 * Scrape using Playwright browser
 */
async function scrapeWithBrowser(url) {
  const browser = await chromium.launch({ 
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ]
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-CA',
  });
  
  const page = await context.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('h1', { timeout: 10000 }).catch(() => {});
    
    // Extract data from page
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
        square_footage: null,
        property_type: null,
        description: null,
      };
      
      // Get address from h1
      const heading = document.querySelector('h1');
      if (heading) {
        const text = heading.textContent;
        
        // Extract postal code
        const postalMatch = text.match(/[A-Z]\d[A-Z]\s*\d[A-Z]\d/i);
        if (postalMatch) {
          result.postal_code = postalMatch[0].toUpperCase().replace(/\s/g, '');
        }
        
        // Extract city from parentheses
        const cityMatch = text.match(/\(([^)]+)\)/);
        if (cityMatch) {
          result.address_city = cityMatch[1].trim();
        }
      }
      
      // Get price from page text
      const bodyText = document.body.innerText;
      const priceMatch = bodyText.match(/\$(\d{1,3}(?:,\d{3})*)/);
      if (priceMatch) {
        result.list_price = parseInt(priceMatch[1].replace(/,/g, ''), 10);
      }
      
      // Get beds/baths
      const bedMatch = bodyText.match(/(\d+)\s*(?:Bedroom|Bed|Beds)/i);
      if (bedMatch) result.bedrooms = parseInt(bedMatch[1], 10);
      
      const bathMatch = bodyText.match(/(\d+)\s*(?:Bathroom|Bath|Baths)/i);
      if (bathMatch) result.bathrooms_full = parseInt(bathMatch[1], 10);
      
      // Get sqft
      const sqftMatch = bodyText.match(/(\d+)\s*-\s*(\d+)\s*(?:Square Feet|Sq\.?ft\.?|sqft)/i);
      if (sqftMatch) {
        result.square_footage = Math.round((parseInt(sqftMatch[1]) + parseInt(sqftMatch[2])) / 2);
      } else {
        const singleSqftMatch = bodyText.match(/(\d+)\s*(?:Square Feet|Sq\.?ft\.?)/i);
        if (singleSqftMatch) result.square_footage = parseInt(singleSqftMatch[1]);
      }
      
      // Get MLS number
      const mlsMatch = bodyText.match(/MLS®?\s*Number:\s*([A-Z0-9]+)/i);
      if (mlsMatch) result.mls_number = mlsMatch[1];
      
      // Get description
      const descEl = document.querySelector('h2:contains("Listing Description") + p, [class*="description"]');
      if (descEl) {
        result.description = descEl.textContent.substring(0, 500);
      }
      
      // Get property type
      const typeMatch = bodyText.match(/Property Type[:\s]+([^\n]+)/i);
      if (typeMatch) result.property_type = typeMatch[1].trim();
      
      return result;
    });
    
    return data;
    
  } finally {
    await browser.close();
  }
}

/**
 * Express router setup
 */
function createImportRouter() {
  const express = require('express');
  const router = express.Router();
  
  router.post('/import-realtor', async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing URL parameter' 
        });
      }
      
      if (!url.includes('realtor.ca')) {
        return res.status(400).json({ 
          success: false, 
          error: 'URL must be from realtor.ca' 
        });
      }
      
      console.log('Importing from:', url);
      const data = await scrapeRealtorListing(url);
      
      res.json({ 
        success: true, 
        data 
      });
      
    } catch (error) {
      console.error('Import error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
  
  return router;
}

module.exports = { 
  scrapeRealtorListing,
  createImportRouter 
};
