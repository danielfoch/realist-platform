# Realist Partner Integration - Implementation Guide

## Quick Start

This implementation adds:
1. **Database tables** for realtors, lenders, and deal leads
2. **API endpoints** for registration and admin
3. **Join pages** at `/join/realtors` and `/join/lenders`
4. **Deal analyzer integration** with "Get Matched" CTA

## Step 1: Database Setup

### Option A: Run SQL Migration
In your Replit database console, run the SQL from:
```
db/migration.sql
```

### Option B: Drizzle Schema
Add the schema to your existing Drizzle setup:
```ts
// Import from db/schema.ts
export { realtors, lenders, dealLeeds } from './db/schema';
```

## Step 2: Add API Routes

Add to your Express server (likely `server/index.ts` or similar):

```ts
import partnersRouter from './routes/partners';

// Add to your app
app.use('/api', partnersRouter);
```

Make sure you have the db import:
```ts
import { db } from './db';
```

## Step 3: Add React Pages

In your React router setup (likely `App.tsx` or `main.tsx`):

```tsx
import { JoinRealtorsPage } from './pages/JoinRealtors';
import { JoinLendersPage } from './pages/JoinLenders';

// Add routes
<Route path="/join/realtors" element={<JoinRealtorsPage />} />
<Route path="/join/lenders" element={<JoinLendersPage />} />
```

## Step 4: Deal Analyzer Integration

To add the "Get Matched" CTA after deal analysis:

```tsx
import { DealAnalyzerMatch } from './components/DealAnalyzerMatch';

// Add after your analysis results
<DealAnalyzerMatch 
  propertyAddress={address}
  city={city}
  province={province}
  purchasePrice={purchasePrice}
/>
```

## File Structure

```
/workspace/realist/
├── db/
│   ├── schema.ts         # Drizzle schema definitions
│   └── migration.sql     # Raw SQL for direct DB setup
├── server/
│   └── routes/
│       └── partners.ts   # Express API endpoints
├── client/
│   ├── pages/
│   │   ├── JoinRealtors.tsx
│   │   ├── JoinLenders.tsx
│   │   └── JoinForm.css
│   └── components/
│       ├── DealAnalyzerMatch.tsx
│       └── DealAnalyzerMatch.css
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/realtors/join` | Register new realtor |
| POST | `/api/lenders/join` | Register new lender |
| GET | `/api/realtors` | List all realtors (admin) |
| GET | `/api/lenders` | List all lenders (admin) |
| POST | `/api/deal-leads` | Create lead from deal analyzer |

## Validation

Both join endpoints include server-side validation:
- Email format validation
- Phone number validation (10+ digits)
- Required field checks
- JSON array non-empty checks
- Duplicate email prevention

## Notes

- All dates are stored in UTC
- Status defaults to 'active' for new records
- Emails are stored lowercase and trimmed
- The deal-leads endpoint attempts to auto-match based on city/province and loan size

## Security Recommendations

1. Add admin authentication for GET endpoints
2. Implement rate limiting on join endpoints
3. Add CAPTCHA to prevent spam
4. Consider email verification flow