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

## Agent API spine / Jobs

Bearer-authenticated specialist contract at `/api/agent/*`. Existing
underwrite / find-deals / analyses / community / referral routes are
unchanged. Auth is still `Authorization: Bearer realist_live_*`
(SHA-256 hashed in `api_keys`).

New P0 pieces:

- Canonical Zod schemas: `shared/agentSpine.ts` (`Property`, `Listing`,
  `Deal`, `Contact`, `TransactionFile`, `AgentOrg`, `Job`)
- Job store + routes:
  - `POST /api/agent/jobs` — create (idempotent on `idempotencyKey`)
  - `GET /api/agent/jobs` — list the caller's jobs
  - `GET /api/agent/jobs/:id`
  - `POST /api/agent/jobs/:id/approve` — only from `needs_approval`
  - `POST /api/agent/jobs/:id/cancel` — queued / running / needs_approval
- OpenAPI 3: `docs/openapi/agent-api.yaml` (served as
  `GET /api/agent/openapi.json` behind `read`)
- Specialist plug-in guide: `docs/specialist-spine.md`

New opt-in scopes (`jobs:write`, `forms:write`, `docs:write`,
`crm:write`) do not change default key scopes. Underwrite jobs still
accept the existing `underwrite` scope.

P1 Forms specialist (Ontario / OREA field maps only — no PDF bodies):

- `GET /api/agent/forms` — list registered maps (`read`)
- `GET /api/agent/forms/:formId` — field map metadata (`read`)
- `POST /api/agent/forms/fill` — create a `forms.fill` job (`forms:write`)
- `forms.fill` jobs preview the JSON fill on create and stay
  `needs_approval`. Approve marks succeeded; nothing is e-signed or
  submitted. Missing legal facts stay blank.

