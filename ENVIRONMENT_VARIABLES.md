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

## Meetup.com network feed (all optional)
`GET /api/meetups/network` and `GET /api/meetups/next` (`server/meetupNetwork.ts`) list every upcoming meetup across the "The Canadian Real Estate Investor" Meetup Pro network. With nothing set, the public iCal feeds of the groups registered in `shared/meetupNetwork.ts` are served (no auth). Credentials unlock the GraphQL branch: automatic discovery of every group in the network, RSVP counts, and event photos. Any GraphQL failure falls back to iCal.

| Variable | Default | Used for |
| --- | --- | --- |
| `MEETUP_PRO_URLNAME` | `the-canadian-real-estate-investor` | Pro network urlname (`https://www.meetup.com/pro/<urlname>/`). |
| `MEETUP_GROUP_URLNAMES` | unset | Comma-separated extra group urlnames merged with the registry — for groups not yet listed in `shared/meetupNetwork.ts`. |
| `MEETUP_ACCESS_TOKEN` | unset | Static OAuth bearer token for `https://api.meetup.com/gql-ext`. When set, the JWT flow is skipped. |
| `MEETUP_CLIENT_ID` | unset | OAuth consumer key; the JWT `iss`. |
| `MEETUP_CLIENT_SECRET` | unset | OAuth consumer secret. Not used by the JWT grant itself; accepted so the consumer's settings can be pasted together. |
| `MEETUP_JWT_PRIVATE_KEY` | unset | PEM RSA private key whose public half is registered on the OAuth consumer. Literal `\n` escapes are accepted (single-line env var). |
| `MEETUP_AUTHORIZED_MEMBER_ID` | unset | Meetup member id the consumer acts as (the JWT `sub`); must be an admin of the network. |

The JWT flow needs `MEETUP_CLIENT_ID`, `MEETUP_JWT_PRIVATE_KEY`, and `MEETUP_AUTHORIZED_MEMBER_ID` together. Tokens are minted at `https://secure.meetup.com/oauth2/access` (`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`) and cached until 60s before expiry. Responses are cached in memory for 20 minutes; a failed refresh serves the previous snapshot with `stale: true`.

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

## Meetup.com member OAuth (server/meetupOAuth.ts, server/meetupRsvp.ts)

| Variable | Required | Purpose |
|----------|----------|---------|
| `MEETUP_CLIENT_ID` / `MEETUP_CLIENT_SECRET` | No | Enables "Continue with Meetup" (OAuth2 server flow). Shared with the network feed's JWT flow. |
| `MEETUP_OAUTH_REDIRECT_URI` | No | Overrides the callback URL; default is `<site>/api/meetup/oauth/callback`, which must match the consumer's registered URI exactly. |
| `MEETUP_OAUTH_SCOPE` | No | Scope string appended to the authorize URL when Meetup requires one. |
| `MEETUP_RSVP_MUTATION_DOCUMENT` | No | Full GraphQL mutation (one `$eventId: ID!` variable). Until set, RSVP captures the lead and deep-links to the event page instead of placing the RSVP via API. |
