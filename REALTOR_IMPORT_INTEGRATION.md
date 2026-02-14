# Realtor.ca Import Integration

## Quick Setup for Replit

### Step 1: Install Dependencies

In your Replit shell:
```bash
npm install playwright axios
npx playwright install chromium
```

### Step 2: Add the Backend Route

Create or edit your Express routes file and add:

```javascript
const { createImportRouter } = require('./src/realtor-import');

// Add to your Express app
app.use('/api', createImportRouter());
```

Or copy the contents of `src/realtor-import.js` directly into your existing routes file.

### Step 3: Add the Frontend Component

Copy `frontend/components/RealtorImport.tsx` to your frontend components folder.

In your deal analyzer page, use it like:

```tsx
import { RealtorImport } from './components/RealtorImport';

function DealAnalyzer() {
  const handleImport = (data) => {
    // Fill your form fields with the imported data
    setAddress(data.address);
    setCity(data.city);
    setPrice(data.price);
    setBedrooms(data.bedrooms);
    // etc.
  };

  return (
    <div>
      <RealtorImport onImport={handleImport} />
      {/* rest of your form */}
    </div>
  );
}
```

### Step 4: Environment Variables (Optional)

If you want to add rate limiting or caching:

```env
# .env
REALTOR_IMPORT_ENABLED=true
REALTOR_CACHE_TTL=3600
```

## Files Included

- `src/realtor-import.js` - Backend scraper + Express router
- `frontend/components/RealtorImport.tsx` - React component

## How It Works

1. User pastes a realtor.ca URL into the input
2. Backend receives the URL and:
   - First tries the realtor.ca API (faster)
   - Falls back to Playwright browser scraping if API fails
3. Extracts: address, price, beds, baths, sqft, property type
4. Returns JSON to frontend
5. Frontend fills in the deal analyzer form

## Troubleshooting

### Playwright not installing
```bash
# If you get errors with npx playwright install
npm install -D playwright
npx playwright install --with-deps chromium
```

### Browser getting blocked
The scraper uses headless Chrome. If realtor.ca blocks it:
- Try running with `headless: false` temporarily
- The browser needs to appear as a real user
- Some listings may still be blocked by Incapsula

### API not working
The API approach may be rate-limited or require authentication. The browser fallback should work for most cases.

## Testing

```bash
# Test the scraper directly
node src/realtor-import.js
# (You'll need to add a CLI like the other scraper files)
```

Or use curl:
```bash
curl -X POST http://localhost:3000/api/import-realtor \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.realtor.ca/real-estate/29357438/3106-28-linden-street-toronto"}'
```

## Expected Response

```json
{
  "success": true,
  "data": {
    "address_street": "3106 - 28 LINDEN STREET",
    "address_city": "Cabbagetown-South St. James Town",
    "address_province": "Ontario",
    "postal_code": "M4Y0A4",
    "list_price": 897000,
    "bedrooms": 2,
    "bathrooms_full": 2,
    "square_footage": 950,
    "property_type": "Single Family"
  }
}
```
