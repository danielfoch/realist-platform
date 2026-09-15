# Realist.ca cashback / Keypr

The existing Ontario cashback forms in CashbackDisplay and DealPromotions feed
POST /api/leads/engage. The Realist.ca brand and in-site form remain primary;
Keypr appears as the cashback partner. Other provinces and other inquiry types
retain their existing routing. No historical leads are forwarded.

## Configuration

Set KEYPR_REALIST_SECRET in the Replit app and production deployment Secrets.
Use the supplied integration document; never commit its secret or use VITE_.
Republish after updating code/secrets. The private keypr_lead_outbox table and
its due-job index are initialized at boot before route registration.

## Delivery

First/last name, email, phone and consent are validated server-side. Leads and
outbox rows are committed together; the existing lead ID is the partner's
idempotency key. Only lead_id, first_name, last_name, email and normalized phone
are sent to https://platform-prod-api.keypr.ca/public/realist-leads, with the
X-Realist-Secret header. No property details, tags or unrelated contact data.

The server starts delivery immediately and drains due jobs every minute while
running. Row locks and a 60-second lease protect concurrent workers and recover
from crashes. A 10-second timeout and stable lead ID make re-delivery safe.
HTTP 201/202 succeed. Network errors, 5xx and 429 retry at 1 minute, 5 minutes,
then every 30 minutes for up to 24 hours. Other responses (including 400/401)
stop and require operator action. Autoscale sleep postpones retries until the
next running instance. No credential means jobs remain pending.

## Support / recovery

Private SQL (do not expose this table through a public API):

```sql
SELECT status, last_code, count(*) FROM keypr_lead_outbox GROUP BY status, last_code;
SELECT lead_id, status, attempts, last_code, next_attempt_at
FROM keypr_lead_outbox WHERE status <> 'sent' ORDER BY created_at;
```

For a stopped delivery, first fix configuration or the validated payload. Then
requeue only the affected lead IDs, preserving lead_id. For an expired row, an
operator can explicitly reset created_at to now() to reopen its retry window;
consent_at remains the original consent time. Do not automatically retry 400/401.
Logs include only lead ID and response category; never log secrets or payloads.

## Validation

`npm run check`, `npm run build`, and:
`npx vitest run server/keyprWebhook.test.ts server/keyprStore.test.ts server/appRouteRegistry.test.ts`

Browser verification uses the actual components in an isolated local harness;
no test lead is sent to the live CRM or Keypr. A production authentication probe
with an empty body returned 400 (validation reached, no lead created).

Offer source: https://keypr.ca and Daniel's supplied Keypr integration/CTA.
$20,000 illustration = $1,000,000 × 2.5% buyer-agent commission × 80% rebate.
