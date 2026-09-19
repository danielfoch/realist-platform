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
| `GHL_PIPELINE_ID`, `GHL_PIPELINE_STAGE_ID` | *(optional)* every showing, offer and financing request also opens an **opportunity** on this pipeline, named for the deal and the person, valued at the price — so deals are worked in stages, not fished out of a contact list. The token then also needs **opportunities: write** |
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

## 6. Decisions only you can make before launch

- **Who is the brokerage of record?** The site currently names three parties for the same
  thing: "Valery Real Estate" (/team), "partner brokerages, including Konfidis"
  (/work-with-us) and "Keypr, its cashback partner" (the consent box). A buyer should read one
  name. Tell us which, and it becomes one constant.
- **Legal review** of `/privacy` and `/terms`. They were rewritten to describe what the product
  actually does (public profiles, the leaderboard, learning from aggregates, the CRM, Keypr,
  referral fees, AI processing). Accurate to the code; not yet seen by a lawyer.
- **The homepage** (your PR #191/#193) promises things the app doesn't do yet — "AI-assisted
  tenant support, maintenance, leasing", "compare cash flow and cap rates" — and its PropCare
  link points at a realist.ca URL that will 404 once this app takes over the domain.
- The cash-back figure:

## 6b. The cash-back figure

`NEXT_PUBLIC_CASHBACK_PERCENT` — the site says **50%** (the original brief). The Keypr copy
approved on Sept 15 says buyers keep **80%** of the buyer-agent commission. Whatever the partner
actually pays is what the site must say; it is one variable, read everywhere.

## 7. Go live

DNS at GoDaddy: `CNAME new → cname.vercel-dns.com`. Then, from this repo:

```bash
npx vercel --prod
```

## 8. The Monday note (optional, off by default)

`/api/cron/digest` emails each consenting member who has underwritten a deal: where they
finished last week, the one thing that keeps their streak or earns their next badge, up to
three new listings inside their learned buy box (each credited to its listing brokerage, with
CREA's DDF® line in the footer), last week's top five, and the next meetup in their city. It sends **nothing** until all of these
are set: `WEEKLY_DIGEST_ENABLED=1`, `RESEND_API_KEY`, and `EMAIL_POSTAL_ADDRESS` (CASL needs a
mailing address in every commercial email). Unsubscribe is one press, works without signing
in, and is honoured by mail providers' own unsubscribe button.

## Crons (vercel.json)

`/api/cron/leads` every 10 min (outbox retries) · `/api/cron/learn` nightly (market defaults) ·
`/api/cron/digest` Mondays 8:30 ET ·
podcast Tue/Fri · distress scan twice daily · distress report monthly. All require
`CRON_SECRET` (already set).
