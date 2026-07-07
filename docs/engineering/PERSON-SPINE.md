# Person Spine — Phase 1: additive identity linkage

One human used to exist as unlinked rows across three tables: `users` (the
account), `leads` (append-only capture rows, often several per email), and
`crm_contacts` (relationship rows per CRM owner). Nothing tied them together,
which fractured the AI flywheel and personalization: no consumer could ask
"what do we know about this person?"

Phase 1 links those rows **without any destructive change**. No column drops,
no renames, no type changes, no merges, no deletes — additive columns, write
time hooks, and a backfill only.

## The spine

- `leads.user_id` — nullable varchar FK → `users.id`, indexed
  (`idx_leads_user_id`). **Added in this phase.**
- `crm_contacts.linked_user_id` — nullable varchar FK → `users.id`, indexed
  (`idx_crm_contacts_linked_user`). **Pre-existing** (the CRM already had it);
  phase 1 makes every write path actually populate it. The column is
  server-authoritative: `insertCrmContactSchema` omits it, so no client
  payload can set, change, or clear a link, and the CRM contact page's
  linked-analyses view stays gated to `source === "deal_desk"` (a Deal Desk
  submission is the consent event; spine auto-links are identity-only and
  never expose another user's analyses).
- Expression indexes `idx_leads_email_norm` / `idx_crm_contacts_email_norm`
  on `lower(trim(email))` — **added in this phase** so the backlink and
  person-view email matches are index scans, not seq scans in the signup
  path.

Match rule (single source of truth in `shared/personSpine.ts`, unit tested):
`normalizeEmail` (trim + lowercase, from `shared/authTokens.ts`) equality.
An existing link is **never overwritten**; rows without a usable email are
skipped. Oldest user account wins if legacy rows share a normalized email.

## The pieces

| Piece | Where |
|---|---|
| Pure link-decision logic (`buildEmailIndex`, `decideLink`, `emailsMatch`) | `shared/personSpine.ts` (+ `shared/personSpine.test.ts`) |
| DB helpers: `linkPersonByEmail`, `backlinkUserRecords`, `getPersonByEmail` | `server/personSpine.ts` |
| Backfill for pre-existing rows | `scripts/backfill-person-spine.ts` |

All server helpers are best-effort and never throw: identity linkage must
never fail a signup, lead capture, RSVP, or checkout.

### Forward hooks (row created → try to link to a user)

Every path that inserts a `leads` or `crm_contacts` row calls
`linkPersonByEmail(email)` and stamps the FK when a user exists:

- `storage.createLead` (all `/api` lead-capture call sites funnel here)
- `storage.upsertLeadByEmail` (Deal Desk loop; also links old unlinked rows on re-touch)
- `POST /api/crm/contacts` (`server/crm.ts`; `linkedUserId` is
  server-authoritative — `insertCrmContactSchema` omits it, so clients can
  never set, change, or clear a link via POST or PATCH)
- `upsertPlatformCrmContact` (`server/crmIngest.ts` — deal room, booked calls, replays; also links on re-touch)
- `handoffClaimedLeadToCrm` (`server/partnerNetwork.ts`; carries `lead.userId` through)
- `scripts/import-meetup-members.ts`
- (`server/crm.ts` Deal Desk import already set `linkedUserId` explicitly;
  `scripts/import-sponsor-targets.ts` inserts companies with no email — nothing to link.)

### Reverse hooks (user created → backlink existing rows)

Every path that creates a `users` row calls
`backlinkUserRecords(userId, email)` — one `UPDATE ... WHERE fk IS NULL AND
lower(trim(email)) = $normalized` per table:

- signup (`POST /api/auth/signup`, `server/auth.ts`)
- lead enroll (`POST /api/auth/lead-enroll`, `server/auth.ts`)
- Google OAuth new user (`server/auth.ts`)
- `autoEnrollLeadAsUser` (`server/routes.ts` — deal analyzer & co.)
- admin CSV user import (`POST /api/admin/import-csv-users`, `server/routes.ts`)
- event RSVP silent signup (`ensureUserByEmail`, `server/eventsGrowth.ts`)
- event checkout silent signup (`createOrUpdateEventUser`, `server/eventsModule.ts`)
- podcast subscribe (`ensurePodcastSubscriber`, `server/podcastDigest.ts`)
- Replit auth upsert (`server/replit_integrations/auth/storage.ts` — on
  genuine creation only; the upsert also runs on every login, where the
  backlink would add nothing)

### The person view

`getPersonByEmail(email)` in `server/personSpine.ts` is the single read-only
accessor future personalization consumes:

```ts
{ user, leadRows, crmContact, counts: { leads, crmContacts } }
```

`leadRows` is the full append-only history (newest first); `crmContact` is
the most recently touched contact row. Consumers should read through this
instead of querying the three tables ad hoc.

## Running the backfill

Dry-run first — it reports what would link without writing anything:

```sh
npx tsx scripts/backfill-person-spine.ts --dry-run
npx tsx scripts/backfill-person-spine.ts
```

Idempotent (re-running reports already-linked), batched 500 rows with keyset
pagination, links only. Reports per table: already-linked / scanned / linked /
no-match / no-email.

## Deploy note

`npm run db:push` adds **one nullable FK column (+ its FK constraint) and
three indexes** (`leads.user_id` + `idx_leads_user_id`,
`idx_leads_email_norm`, `idx_crm_contacts_email_norm`) — non-destructive; the
FK validate is a scan of all-NULL values, and the expression indexes build
with the usual `CREATE INDEX` lock (brief at current table sizes).
(`crm_contacts.linked_user_id` and its index already exist.) As always,
abort if push proposes ANY drop — that means unrelated schema drift, not
this change. Then run the backfill (dry-run first).

## Phase 2 — convergence (OUT of scope here)

Phase 2 is the destructive half deliberately excluded from this PR: designing
a canonical person record (dedup/merge of multi-row leads, cross-owner
crm_contacts, conflicting names/phones), survivorship rules, and rewriting
consumers onto the converged view. It builds on the phase-1 links — nothing
in phase 1 constrains how phase 2 merges, because phase 1 only ever adds
nullable pointers.
