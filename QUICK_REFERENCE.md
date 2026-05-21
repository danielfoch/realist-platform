# Quick Reference Card - CREA DDF IDX Integration

## 🚀 Essential Commands

### Setup & Testing
```bash
# 1. Install everything
npm install

# 2. Test DDF connection
npm run test:ddf

# 3. Run database migrations
psql $DATABASE_URL -f schema.sql

# 4. Test sync (10 listings)
DDF_LIMIT=10 npm run sync

# 5. Full sync
npm run sync:full

# 6. Start dev server
npm run dev
```

### Daily Operations
```bash
# Incremental sync (only changes)
npm run sync

# Full refresh
npm run sync:full

# Check sync status
psql $DATABASE_URL -c "SELECT COUNT(*), MAX(synced_at) FROM listings;"

# Refresh materialized view
psql $DATABASE_URL -c "SELECT refresh_investment_listings();"
```

## 📡 API Endpoints

```bash
# Search listings
GET /api/listings?city=Toronto&minBedrooms=2&investmentFocus=true

# Get single listing
GET /api/listings/C12345678

# Top investments
GET /api/listings/investment/top?limit=50&province=ON

# Map view
GET /api/listings/map?bounds=43.6,-79.5,43.7,-79.3

# Market stats
GET /api/stats?city=Toronto
```

## 🔧 Environment Variables

```bash
DDF_USERNAME=KynvfatKgkwa2y0UhnpajWpZ
DDF_PASSWORD=01XR2Z6Yz0dbLNp5gmzzbK4e
DATABASE_URL=postgresql://user:pass@host:5432/realist
RENT_API_URL=https://realist.ca/api/rents
NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx
```

## 📊 Database Quick Queries

```sql
-- Active listings count
SELECT COUNT(*) FROM listings WHERE status = 'Active';

-- Top cap rates
SELECT mls_number, address_city, list_price, cap_rate 
FROM listings 
WHERE cap_rate IS NOT NULL 
ORDER BY cap_rate DESC LIMIT 10;

-- Recent price changes
SELECT l.mls_number, l.address_city, h.old_value, h.new_value, h.changed_at
FROM listing_history h
JOIN listings l ON h.listing_id = l.id
WHERE h.change_type = 'price_change'
ORDER BY h.changed_at DESC LIMIT 20;

-- Stats by city
SELECT address_city, COUNT(*) as listings, AVG(list_price) as avg_price, AVG(cap_rate) as avg_cap_rate
FROM listings
WHERE status = 'Active'
GROUP BY address_city
ORDER BY listings DESC;
```

## 🐛 Troubleshooting

### Authentication Fails
```bash
# Test credentials
npm run test:ddf

# Check if endpoints are accessible
curl https://replication.crea.ca/Login.ashx
```

### Sync Errors
```bash
# Check logs
tail -f logs/sync.log

# Test with small batch
DDF_LIMIT=5 npm run sync

# Verify database connection
psql $DATABASE_URL -c "SELECT 1;"
```

### Missing Cap Rates
```bash
# Check rent API
curl "https://realist.ca/api/rents/average?city=Toronto&province=ON&bedrooms=2"

# Update cap rates for existing listings
# (Add script to calculate-metrics.ts)
```

## 📁 File Locations

| Component | File Path |
|-----------|-----------|
| DDF Client | `src/ddf-client.ts` |
| Sync Script | `src/sync-listings.ts` |
| API Routes | `src/api-routes.ts` |
| Database Schema | `schema.sql` |
| Listing Card | `frontend/components/ListingCard.tsx` |
| Search Filters | `frontend/components/SearchFilters.tsx` |
| Map Component | `frontend/components/ListingsMap.tsx` |
| Main Page | `frontend/pages/ListingsPage.tsx` |

## 🔄 Cron Setup

### Replit
1. Go to "Scheduled Actions"
2. Add: `npm run sync`
3. Schedule: Daily 2:00 AM

### Linux/Mac
```bash
crontab -e
# Add line:
0 2 * * * cd /path/to/idx-integration && npm run sync >> logs/sync.log 2>&1
```

## 📞 Support Contacts

- **CREA DDF Support**: https://www.crea.ca/ddf-support
- **Replit Docs**: https://docs.replit.com
- **Mapbox Support**: https://docs.mapbox.com

## 🎯 Key Metrics

- **Sync Frequency**: Daily at 2 AM
- **Expected Sync Time**: 10-30 min for 1,000 listings
- **API Response Time**: <200ms
- **Map Markers Limit**: 500 per query
- **Pagination**: Max 100 results per page

## ⚡ Quick Checks

```bash
# Is DDF auth working?
npm run test:ddf

# How many listings do I have?
psql $DATABASE_URL -c "SELECT COUNT(*) FROM listings;"

# When was last sync?
psql $DATABASE_URL -c "SELECT MAX(synced_at) FROM listings;"

# How many investment properties?
psql $DATABASE_URL -c "SELECT COUNT(*) FROM listings WHERE cap_rate IS NOT NULL;"

# Top 5 cap rates
psql $DATABASE_URL -c "SELECT mls_number, address_city, list_price, cap_rate FROM listings ORDER BY cap_rate DESC LIMIT 5;"
```

## 📚 Documentation

- `README.md` - Overview
- `DEPLOYMENT.md` - Step-by-step deployment
- `INTEGRATION_SUMMARY.md` - Feature list
- `COMPLETION_REPORT.md` - Project summary
- `QUICK_REFERENCE.md` - This file

---

**Need More Help?** See DEPLOYMENT.md for detailed guides!
