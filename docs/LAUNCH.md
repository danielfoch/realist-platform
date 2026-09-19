# Taking Realist (lean) live

Everything below is configuration — the code is done and verified against a real Postgres.
Do the steps in order; each one unlocks the next. Nothing is lost if a step is late: leads
captured before the CRM is connected wait in the outbox and are delivered when it is.

## 1. A database (nothing persists without it)

Vercel → project `realist-lean` → **Storage → Create → Neon**. That adds `DATABASE_URL`.
Then, once, from a machine with that URL exported:

```bash
npm run db:push
```

## 2. Leads → GoHighLevel, and an inbox

Set in Vercel (Production + Preview):

| Variable | What |
|---|---|
| `GHL_API_KEY` | GoHighLevel → Settings → **Private Integrations** → new token with **contacts: write** |
| `GHL_LOCATION_ID` | The sub-account's location id (Settings → Business Profile) |
| `GHL_WEBHOOK_URL` | *(optional, instead of or as well as the two above)* an **Inbound Webhook** workflow trigger URL — same field names the old app sent |
| `ACQUISITION_LEAD_EMAILS` | who is emailed for offers, showings, underwriting help (comma-separated) |
| `FINANCING_LEAD_EMAILS` | who is emailed for financing (acquisition is copied) |
| `RESEND_API_KEY` | Resend, with `realist.ca` verified as a sending domain. Also powers sign-in links — most v1 members have no password, so they cannot get in without it |
| `KEYPR_REALIST_SECRET` | the cash-back handoff secret (same value the Replit app uses) |
| `ADMIN_EMAILS` | who may open `/admin/leads`. Sign in with Google or an emailed link once so the address is verified |

Then open **`/admin/leads`**: it shows what is connected, the outbox by destination, and the
latest leads. Press **Retry failed and deliver now** after adding a key to flush anything that
was waiting.

Tags follow the old app's names (`realist.ca`, `new-signup`, `signup-YYYY-MM`, `offer_request`,
`cashback_request`, `showing_request`, `financing_consultation`, `power_team_request`,
`needs-<role>`, `meetup_rsvp`, `MEETUP_<CITY>`, `deal-analyzed`, `active-underwriter`,
`city-<slug>`, `LEAD_<PROV>`, `intent-*`, `route-*`), so existing smart lists and workflows keep
matching. Tags are only ever *added* — the integration never replaces a contact's tags.

## 3. Sign-in with Google

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. In Google Cloud add the redirect URI
`https://<host>/api/auth/google/callback` for each host in use (`new.realist.ca`, later
`realist.ca` — the path is the same one the old app used).

## 4. Bring the members over

Locally, never on Vercel. `SOURCE_DATABASE_URL` = the Replit app's `DATABASE_URL` (Secrets tab).

```bash
npm run migrate:users              # dry run: counts only, writes nothing
npm run migrate:users -- --commit  # the real thing; safe to re-run until cutover
```

Carries: accounts (ids, password hashes, Google links), the CASL consent ledger, watched
listings and analyzer saves, multiplex underwrites, and v1's buy-and-hold analyses (recomputed
on today's engine — so the leaderboard, track records and learned market defaults start warm).
After it, run the learning job once: `GET /api/cron/learn` with the cron bearer token.

## 5. Listings and AI

| Variable | What |
|---|---|
| `CREA_DDF_USERNAME`, `CREA_DDF_PASSWORD` | the live MLS® feed (also add to GitHub Actions secrets for the nightly sync) |
| `ANTHROPIC_API_KEY` | AI-written deal memos and multiplex reports. Without it both fall back to the rules-based versions, which are complete on their own |

## 6. One business decision before launch

`NEXT_PUBLIC_CASHBACK_PERCENT` — the site says **50%** (the original brief). The Keypr copy
approved on Sept 15 says buyers keep **80%** of the buyer-agent commission. Whatever the partner
actually pays is what the site must say; it is one variable, read everywhere.

## 7. Go live

DNS at GoDaddy: `CNAME new → cname.vercel-dns.com`. Then, from this repo:

```bash
npx vercel --prod
```

## Crons (vercel.json)

`/api/cron/leads` every 10 min (outbox retries) · `/api/cron/learn` nightly (market defaults) ·
podcast Tue/Fri · distress scan twice daily · distress report monthly. All require
`CRON_SECRET` (already set).
