# Environment Variables

## Required
- `DATABASE_URL`: PostgreSQL connection string.
- `DDF_USERNAME`: CREA DDF username.
- `DDF_PASSWORD`: CREA DDF password.

## Required for AI features
- `ANTHROPIC_API_KEY`: powers the Multiplex Underwriter's AI narratives and the on-site "Ask Realist" agent (`/api/ask`). When unset, the underwriter silently falls back to deterministic templates and Ask Realist is disabled (the panel hides itself). The server logs a startup warning if missing. **Post-deploy check:** `curl https://realist.ca/api/ask/status` should return `{"available":true}`.

## Optional
- `BLD_LEAD_WEBHOOK_URL`: destination for booked-call financing leads (BLD Financial intake / GHL / Zapier endpoint). Receives the JSON payload built by `buildBldLeadPayload` in `shared/bookedCallLeads.ts`. **Currently UNSET everywhere — leads are stored in `booked_call_leads` and reviewed at /admin (Call Leads tab) only; nothing is sent externally until this is configured.** See `server/bldLeadDestination.ts`.
- `BLD_LEAD_EMAIL`: alternative destination — inbox for BLD's financing contact, sent via the existing Resend integration. Same stub behavior: **currently UNSET; no email is sent.** Set only one of `BLD_LEAD_WEBHOOK_URL` / `BLD_LEAD_EMAIL` (webhook wins when both are set).
- `PORT`: API port (default `3000`).
- `LOG_LEVEL`: `debug|info|warn|error` (default `info`).
- `RENT_API_URL`: override rent API base URL for sync script.
- `VITE_MAPBOX_TOKEN`: map token for frontend map component.

## Example
```env
DATABASE_URL=postgres://user:password@localhost:5432/realist_idx
DDF_USERNAME=your_ddf_user
DDF_PASSWORD=your_ddf_password
PORT=3000
LOG_LEVEL=info
RENT_API_URL=https://realist.ca/api/rents
VITE_MAPBOX_TOKEN=pk.your_mapbox_key
```
