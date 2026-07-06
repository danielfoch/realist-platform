# Opus Task Pack — executable specs for the foundation work

Written by Fable 5 (2026-07-06) as the architecture handoff. Each task below
is designed to be executed by Opus 4.8 **as specified** — the design
decisions are made; the executor implements, verifies, and ships a PR.

## Operating rules (every task, non-negotiable)

1. Work in a fresh git worktree off `origin/main` under `/tmp` — NEVER in
   `~/Realist-Platform` directly (other sessions may hold that checkout).
2. One task = one branch = one PR. Base `main`. Never push main.
3. Gates before every PR: `npm run check` (0 type errors), `npm run build`
   (passes), `npx vitest run --root . shared` (all pass, no regressions),
   and — once the E2E harness lands — `npm run test:e2e` green in CI.
4. **Do not design schema migrations.** If a task requires a schema change
   not explicitly written in its spec: STOP, open an issue instead.
   Additive columns listed in a spec are fine; drops/renames/type changes
   are never fine without a spec that says exactly that.
5. Reuse over rebuild: grep for existing helpers before writing new ones.
   The codebase has one canonical helper for most things (normalizeEmail,
   governMarketingSend, getPersonByEmail, reportContent, etc.).
6. Email rule: any new user-facing email goes through
   `governMarketingSend` (server/emailGovernor.ts). No exceptions. No new
   email streams without an explicit spec.
7. If a gate fails twice on the same cause: stop, report, don't thrash.

---

## Task 1 — Weekly digest roundup (podcast + videos + reports) [M]

**Goal:** the Thursday podcast digest becomes "everything Realist published
this week": new podcast episodes, new YouTube videos, new reports.

- Extend `server/podcastDigest.ts` (rename internals to `weeklyRoundup`
  only if cheap; keep the cron + dedupe key semantics identical).
- Sources: `getPodcastEpisodes()` (exists), `getYouTubeVideos()`
  (server/youtubeFeed.ts, exists), `configReports` + `reportsRegistry`
  filtered to entries whose `date` falls in the send window (exists).
- Layout: episodes first (existing format), then "New on Realist" section:
  videos (title + link to /insights/videos/:slug) and reports (title + dek
  + link). Site links canonical; Apple/Spotify secondary (unchanged).
- Empty-week rule: if there are no episodes AND no videos AND no reports,
  send nothing (log skipped) — never an empty email.
- Same stream key `podcast_digest`, same prefs column, same governor path.
  Tests: extend `shared/podcastDigest.test.ts` selection logic for the two
  new content types (~6 new tests).

**Done:** one email, three content types, all links canonical, gates green.

## Task 2 — In-app notification inbox [M]

**Goal:** a bell in Navigation with unread count + a notifications feed —
the audit's "rendering problem, not a schema problem."

- Read model: `notification_queue` rows for the user (all channels) plus
  `retention_email_log` is NOT included (email-only ledger). Add columns:
  NONE. Add a `read_at` timestamp column to notification_queue (additive,
  nullable) — this is the one sanctioned schema change.
- API: `GET /api/notifications` (session auth, latest 50, unread count),
  `POST /api/notifications/read` (mark all / by id).
- UI: bell icon + badge in Navigation (desktop + mobile), dropdown or
  /notifications page listing title/body/link/time; clicking marks read
  and navigates. Match shadcn patterns.
- Producers need no changes — the queue rows already carry template/payload;
  render a human line per templateKey with a default fallback.

**Done:** bell shows real notifications, unread clears, gates green.

## Task 3 — Transport consolidation (email_triggers → notification_queue) [L]

**Goal:** ONE delivery pipeline. Today `server/emailQueue.ts` (email_triggers
worker, 30s) and `server/notifications.ts` (notification_queue drain, 60s)
are parallel transports.

- Direction: email_triggers becomes a *producer* into notification_queue;
  the notification drain becomes the only sender. Steps:
  1. Add a `email_resend` sender branch in the drain for each email_triggers
     templateKey (move the template builders from emailQueue.ts).
  2. Change `queueEmailTrigger` to write notification_queue rows (keep the
     email_triggers table + worker running in parallel for one release as
     a fallback; add env kill-switch `LEGACY_EMAIL_TRIGGERS=off`).
  3. After soak, a follow-up PR removes the legacy worker (separate task).
- The governor call stays exactly where it is today (send time).
- Tests: template parity snapshots for each migrated trigger type.

**Done:** all trigger emails flow through one drain, legacy path behind a
kill-switch, gates green. DO NOT drop the email_triggers table.

## Task 4 — Analyses convergence, phase 2 [L — execute only after person-spine phase 1 merges]

**Goal:** one analyses store with typed metric columns; trainers stop
regex-parsing jsonb.

Design (decided — implement as written):
- Canonical table: `analyses` (it has the volume + FK to users). ADD typed
  nullable columns: `cap_rate_num real`, `cash_flow_monthly_num real`,
  `dscr_num real`, `purchase_price_num real`, `monthly_rent_num real`.
- Write path: everywhere results_json is written, also populate the typed
  columns (one helper `extractTypedMetrics(resultsJson)` in shared/, with
  tests for the known jsonb shapes — grep weeklyDigest.ts:66-92 and
  aiDefaults.ts for the shapes they parse today).
- Backfill script (batched, idempotent, dry-run) populating typed columns
  from existing jsonb.
- Readers migrate to typed columns: aiDefaults trainer, weeklyDigest,
  leaderboards, marketIntelligence (grep `resultsJson->>` / regex parsing).
  `property_analyses` remains untouched this phase (it serves the deal desk);
  a view or accessor unification is phase 3 — out of scope.

**Done:** trainers/digests read typed columns, backfill run documented,
zero jsonb regex parsing left in the migrated readers, gates green.

## Task 5 — Push sender (FCM) for user-requested alerts [M]

**Goal:** `server/mobilePush.ts` collects tokens but never sends. Wire FCM
(HTTP v1, service-account JSON via `FCM_SERVICE_ACCOUNT` secret) for exactly
two notification kinds: `watchlist_price_change`, `saved_search_matches`.
- Send happens beside the email in the watchlist sweep; respect
  notification_preferences.listing_watch_alerts_enabled; delete invalid
  tokens on UNREGISTERED errors. No push for anything else yet.

**Done:** a watched price change reaches a device (test via FCM dry-run
validate_only), gates green.

## Task 6 — Real "similar deals" [M]

**Goal:** replace the seam left in Home.tsx (fabricated ones were deleted).
- Source: `ddf_listing_snapshots` (+ `us_listings` where relevant): same
  city, same property type, price within ±25%, most recent snapshot,
  exclude the subject address; rank by |price delta|; top 3.
- Server: `GET /api/listings/similar?city&type&price&exclude` (cached 10m).
- Render where the fabricated block used to be (Home.tsx seam comment),
  each linking to the listing page / prefilled analyzer. Honest empty state.

**Done:** real comparables with real links, no fabricated data, gates green.

## Task 7 — Person-spine phase 2 (convergence) [L — LAST; only after phase 1 has soaked in prod ≥1 week]

- `createLead` call sites → `upsertLeadByEmail` (one row per person per
  source, update-not-append), duplicate-lead report script,
  crm_contacts.linked_user_id enforcement on write, and a
  `person_id`-first accessor adoption in dealDesk + retention readers.
- NO table drops. Design questions during execution → stop and ask Dan.

---

## Standing guidance for the executor

- The audits behind these specs: retention audit (2026-07-02) and SEO audit
  (2026-06-11) — summarized in docs/ and the PR descriptions of #77–#95.
- When a spec conflicts with observed code (things move fast here), the
  code wins; note the delta in the PR body rather than improvising design.
- Anything not in this pack that feels "needed": open an issue titled
  `proposal:` — do not build it.
