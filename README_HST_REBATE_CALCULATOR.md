# Ontario New Home HST Rebate Calculator

Public route: `/tools/hst-rebate`

## Run locally

```bash
npm run dev
```

Open the Replit web URL for `/tools/hst-rebate`.

## Logo assets

Drop the supplied assets into the app public folder:

- `client/public/realist-logo.svg`
- `client/public/ohba-logo.png`

The page references them as `/realist-logo.svg` and `/ohba-logo.png`. The OHBA image is rendered with grayscale/black CSS filters unless a true black logo is supplied.

## Webhook

Set the server environment variable:

```bash
HST_INFO_SESSION_WEBHOOK_URL=https://your-webhook-url
```

Registration submissions POST to `/api/hst-info-session/register`, and the server forwards the JSON payload to that webhook. If the env var is missing, the app accepts the registration locally and logs a development warning.

## Updating rebate thresholds

Policy constants and calculation logic live in:

`client/src/lib/hstRebateCalculator.ts`

Update these top-level constants when legislation or implementation guidance changes:

- `HST_RATE`
- `FULL_RELIEF_MAX_PRICE`
- `MAX_REBATE_PRICE_CAP`
- `TAPER_END_PRICE`
- `MAX_REBATE`
- `FLOOR_REBATE`

The current implementation assumes full 13% HST relief up to $1,000,000, a $130,000 maximum rebate up to $1,500,000, a linear taper to $24,000 at $1,850,000, and a $24,000 floor above that level.
