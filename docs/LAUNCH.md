# Taking Realist (lean) live

> **Where it stands (Sept 19 2026).** Done: the production database exists (Neon via Vercel, free
> plan, schema pushed) and `lean` is deployed to production at **https://realist-lean.vercel.app**
> — public, reading and writing that database. Underwriting, accounts (password), saved deals,
> the leaderboard and lead capture work today; leads wait in the outbox until the CRM keys arrive.
> **Still yours:** the keys in steps 2, 3 and 5 (GHL, inboxes, Resend, Google, CREA, Anthropic,
> Keypr), the member migration (step 4), legal review (step 6), and the DNS record (step 7) —
> `new.realist.ca` is already attached to the project and starts working the moment the CNAME
> exists. After adding keys, redeploy (`npx vercel --prod`) so the build picks them up.

Everything below is configuration — the code is done and verified against a real Postgres.
Do the steps in order; each one unlocks the next. Nothing is lost if a step is late: leads
captured before the CRM is connected wait in the outbox and are delivered when it is.

## 1. A database (nothing persists without it)

**Done** — resource `realist-lean-db`, connected to Production and Preview. For the record, it
was: Vercel → project `realist-lean` → **Storage → Create → Neon** (adds `DATABASE_URL`), then,
once, from a machine with that URL exported (and again after any schema change):

```bash
npm run db:push
```

## 2. Leads → GoHighLevel, and an inbox

Set in Vercel (Production + Preview):

| Variable | What |
|---|---|
| `GHL_API_KEY` | GoHighLevel → Settings → **Private Integrations** → new token with **contacts: write** |
| `GHL_LOCATION_ID` | The sub-account's location id (Settings → Business Profile) |
| `GHL_PIPELINE_ID`, `GHL_PIPELINE_STAGE_ID` | *(optional)* every showing, offer and financing request also opens an **opportunity** on this pipeline, named for the deal and the person, valued at OUR list price — so deals are worked in stages, not fished out of a contact list. The token then also needs **opportunities: write** (and read, to avoid duplicates on a retry). If the pipeline refuses a second opportunity for the same contact, the lead is still delivered and `/admin/leads` shows why — turn on *Allow duplicate opportunities* in the pipeline's settings if you want one per request |
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
| `AI_DAILY_BUDGET` | *(optional, default 2000)* the most model calls the whole site makes in a day, so a bad night costs a known amount. Members get 60 a day (15 per 15 min); an account that hasn't confirmed its email gets 3. `0` turns the paid AI off |

## 6. Before launch

- **Legal review** of `/privacy` and `/terms`. They were rewritten to describe what the product
  actually does (public profiles, the leaderboard, learning from aggregates, the CRM, Keypr,
  referral fees, AI processing). Accurate to the code; not yet seen by a lawyer. This is the one
  item nobody but you can close.
- **The cash-back offer is settled, not open.** It now says exactly what the live realist.ca has
  said since your Sept 14 Keypr merge (`shared/keypr.ts` in the v1 app): an **Ontario** offer,
  **80%** of the buyer's agent commission paid at closing, delivered by **Keypr**'s RECO-licensed
  REALTORS®, "nothing owed unless you buy", with the same estimate note. Outside Ontario the site
  promises an introduction and no figure. One file states all of it: `lib/offer.ts`
  (`NEXT_PUBLIC_CASHBACK_PERCENT` overrides the number). The stale "50% / Konfidis" wording from
  the August brief is gone.
- **Who is named where.** Two names, two roles, as on the live site: **Keypr** = the cash-back
  brokerage for Ontario purchases (only ever sent a lead the person ticked the box for);
  **Valery Real Estate Inc.** = the brokerage that works realtor requests near Toronto and receives
  referral fees on introductions. Both are disclosed on `/work-with-us`, `/team`, `/privacy`.
- **The homepage** no longer promises what the product doesn't do: AI tenant support,
  maintenance and leasing are attributed to PropCare (your partner, whose product it is) and link
  to propcare.ca; listing pages now show the lot, so "screen lot dimensions" is true.

## 7. Go live

First, ask the site what it's still missing. This is read-only, never prints a key, and checks
the real thing each time — the database schema, a GHL contact lookup with your token, the
pipeline and stage ids, that `realist.ca` is *verified* in Resend, the Anthropic key:

```bash
npx vercel env pull .env.prod --environment=production
```

```bash
npm run preflight -- --env .env.prod
```

It ends in one line: **Ready to deploy**, or the list of what launch still depends on, each with
the fix. (`.env.prod` holds your production secrets — it is gitignored; delete it afterwards.)

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
