# API Documentation

Base path: `/api`

## GET `/api/listings`
Search and paginate listings.

Query params:
- `city` string
- `province` string (2-char code)
- `minPrice` number
- `maxPrice` number
- `minBedrooms` integer
- `maxBedrooms` integer
- `propertyType` string
- `status` string (`Active`, `Pending`, `Sold`, ...)
- `sortBy` enum (`list_date`, `list_price`, `cap_rate`, `gross_yield`, `cash_flow_monthly`, `bedrooms`, `square_footage`)
- `sortOrder` enum (`ASC`, `DESC`)
- `page` integer >= 1
- `limit` integer 1-100
- `investmentFocus` boolean

Response:
```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

## GET `/api/listings/:mlsNumber`
Get one listing with photos, rooms, history, agent, brokerage.

Response codes:
- `200` success
- `404` listing not found

## GET `/api/listings/investment/top`
Get top active investment listings sorted by cap rate.

Query params:
- `limit` integer 1-100 (default 50)
- `city` string
- `province` string

## GET `/api/listings/map`
Map payload with coordinates and basic details.

Query params:
- `bounds` string `minLat,minLng,maxLat,maxLng`
- `minPrice`, `maxPrice`, `propertyType`, `status`

## GET `/api/stats`
Aggregate market stats for active listings.

Query params:
- `city` string
- `province` string

## GET `/health`
Liveness/readiness endpoint.

## GET `/metrics`
Returns:
- latest sync snapshot from `sync_runs`
- recent tracked errors
- Prometheus-formatted process/app metrics

## Error Format
```json
{
  "success": false,
  "error": "message"
}
```
