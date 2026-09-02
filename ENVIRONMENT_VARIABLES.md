# Environment Variables

## Required
- `DATABASE_URL`: PostgreSQL connection string.
- `CREA_DDF_USERNAME`: CREA DDF username (the server reads this name, not `DDF_USERNAME`).
- `CREA_DDF_PASSWORD`: CREA DDF password (not `DDF_PASSWORD`).

## Required for AI features
- `ANTHROPIC_API_KEY`: powers the Multiplex Underwriter's AI narratives and the on-site "Ask Realist" agent (`/api/ask`). When unset, the underwriter silently falls back to deterministic templates and Ask Realist is disabled (the panel hides itself). The server logs a startup warning if missing. **Post-deploy check:** `curl https://realist.ca/api/ask/status` should return `{"available":true}`.

## Lead routing (all optional — defaults are in code)
Every inquiry on the site reaches a human without any of these set. See `server/leadRouter.ts`.

| Variable | Default | Used for |
| --- | --- | --- |
| `ACQUISITION_LEAD_EMAILS` | `danielfoch@gmail.com` | Acquisition / realtor / representation inquiries, offers, inspection requests, deal-desk submissions. Comma-separated. |
| `FINANCING_LEAD_EMAILS` | `nick@bldfinancial.ca` | Mortgage / financing inquiries (financing consultations, MLI Select quotes, financing-readiness calls, "financing help wanted" flags). The acquisition list is cc'd automatically. |
| `LEAD_NOTIFY_EMAILS` | union of the two above | "General" inquiries (contact page, analyzer leads, masterclass, fit assessment, waitlists, lender/partner applications) and new-account notifications. Setting it replaces the union outright. |
| `ADMIN_INSTANT_LEAD_ALERTS` | `true` | Instant hot/warm/financing follow-up emails from the email-trigger queue (`server/emailTriggerSender.ts`). Set to `false` to keep only the Monday summary. |
| `DEAL_DESK_NOTIFY_EMAIL` | falls back to `LEAD_NOTIFY_EMAILS` | Deal Desk trigger copies, SLA-breach nags, and the Monday admin summary. The admin app setting `deal_desk_notify_email` overrides it when present. |
| `PODCAST_NOTIFY_EMAIL` / `NOTIFY_CC_EMAIL` | fall back to `LEAD_NOTIFY_EMAILS` | General form notifications: podcast questions, reno quotes, event host enquiries, expert applications, coaching waitlist. |
| `BLD_LEAD_WEBHOOK_URL` / `BLD_LEAD_EMAIL` | unset | Optional forwarding of booked-call leads to BLD Financial (details below). Independent of the routing above — Nick is emailed directly regardless. |
| `CRM_OWNER_USER_ID` | oldest admin user | Owner of `crm_contacts` rows created by lead capture (`server/crmIngest.ts`). |

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
CREA_DDF_USERNAME=your_ddf_user
CREA_DDF_PASSWORD=your_ddf_password
ACQUISITION_LEAD_EMAILS=danielfoch@gmail.com
FINANCING_LEAD_EMAILS=nick@bldfinancial.ca
PORT=3000
LOG_LEVEL=info
RENT_API_URL=https://realist.ca/api/rents
VITE_MAPBOX_TOKEN=pk.your_mapbox_key
```
