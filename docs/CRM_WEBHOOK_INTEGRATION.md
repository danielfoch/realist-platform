# CRM Webhook Integration

Realist now has a vendor-neutral, CRM-ready webhook adapter for email automation and future lead routing. It does not replace the existing Resend notifications, Stripe webhooks, HST webhook, or legacy GoHighLevel paths.

## Environment

Set these in the deployment environment when a CRM endpoint is ready:

```bash
CRM_WEBHOOK_ENABLED=false
CRM_WEBHOOK_URL=
CRM_WEBHOOK_SECRET=
CRM_WEBHOOK_TIMEOUT_MS=5000
CRM_WEBHOOK_RETRY_COUNT=2
CRM_WEBHOOK_SOURCE=realist.ca
```

Do not store real secrets in source control. When `CRM_WEBHOOK_ENABLED` is not `true`, product actions still succeed and return a disabled webhook status.

## Security

Outbound payloads include:

- `X-Realist-Signature`: HMAC SHA256 over `timestamp.body` when `CRM_WEBHOOK_SECRET` is configured.
- `X-Realist-Event-Id`: idempotency key.
- `X-Realist-Event-Type`: event type.
- `X-Realist-Timestamp`: event timestamp.
- `Idempotency-Key`: same value as event id.

Webhook failures are non-blocking for user-facing forms.

## Test Route

In development only:

```bash
POST /api/dev/test-crm-webhook
```

The route sends a sample `admin.webhook_failed` style test payload through the adapter. It returns a disabled state if CRM delivery is not enabled.

## Event Layer

Product flows should call `trackRealistEvent(...)`. That creates structured engagement events, logs AI-ready contribution data, and forwards the CRM payload when enabled.
