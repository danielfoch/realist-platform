# E2E smoke pack

A minimal Playwright smoke suite for the money paths: homepage, deal
analyzer, config reports, podcast, auth, the crawler/SEO drift guard, and
real-404 behaviour. It is the only layer that runs the app in a real browser;
everything else in CI is types + units + build.

**Design contract: small, fast, deterministic.** Keep the pack under ~15
tests and under 5 minutes. Deep suites (per-feature coverage, visual
regression, cross-browser) belong elsewhere — this pack is a guardrail that
must stay green on a fresh database so that every PR can be executed against
it.

## Running locally

The app needs a Postgres with PostGIS (`shared/schema.ts` declares
`geometry` columns). Use a disposable database — **never a shared/prod one**,
because setup pushes the drizzle schema at it:

```bash
# Disposable postgis in docker:
docker run --rm -d --name realist-e2e-pg -p 5433:5432 \
  -e POSTGRES_DB=realist_e2e -e POSTGRES_USER=realist -e POSTGRES_PASSWORD=realist \
  postgis/postgis:16-3.4

export DATABASE_URL=postgres://realist:realist@localhost:5433/realist_e2e

npx playwright install chromium   # once
npm run build                     # produces dist/index.cjs + dist/public
npm run test:e2e                  # setup pushes schema, boots dist/index.cjs, runs the pack
npm run test:e2e:ui               # same, with the Playwright UI
```

**Safety gate:** setup refuses any non-loopback `DATABASE_URL` host (and any
non-loopback `E2E_BASE_URL` target), because the fresh-boot path runs
`drizzle-kit push --force` — pointed at a real database that would DROP
everything not in `shared/schema.ts` (sessions, the `ensureAppTables` set,
stripe-sync). Having the live `DATABASE_URL` exported in your shell — this
repo's normal deploy workflow — is therefore harmless here. A disposable
[Neon](https://neon.tech) branch with PostGIS enabled works too: point
`DATABASE_URL` at it and set `E2E_DANGEROUSLY_ALLOW_REMOTE_DB=1` to
acknowledge the target is disposable.

### Reuse mode (fast iteration)

If something is already answering on `http://localhost:5000` (e.g. your
`npm run dev` server), global setup **skips database preparation and boot
entirely** and tests the running server. Dev mode mirrors production's SEO
fallback and 404 behaviour, so the whole pack is valid against it.

`E2E_BASE_URL` overrides the target; `E2E_SERVER_COMMAND` overrides the boot
command (default `node dist/index.cjs`).

**macOS note:** the server listens with `reusePort: true`, which Node >= 22
rejects on Darwin (`listen ENOTSUP`). For the boot-it-yourself path on a Mac,
use the shim that strips the option (app code untouched, CI unaffected):

```bash
E2E_SERVER_COMMAND="node e2e/local-boot-shim.cjs" \
E2E_BASE_URL=http://localhost:5099 \
DATABASE_URL=postgres://realist:realist@localhost:5433/realist_e2e \
npm run test:e2e
```

(`E2E_BASE_URL` on a non-5000 port also dodges macOS AirPlay, which squats
on port 5000.)

## What setup does on a fresh database (and why)

1. `CREATE EXTENSION IF NOT EXISTS postgis` — required by the schema's
   geometry columns; the CI service image is `postgis/postgis:16-3.4`.
2. `npx drizzle-kit push --force` — prod was pushed from `shared/schema.ts`,
   and on an empty database the diff is pure CREATEs, so push is naturally
   non-interactive; `--force` pins that (auto-accepts) so an ambiguous future
   diff can't hang CI waiting for a prompt.
3. Creates the `sessions` table manually — connect-pg-simple runs with
   `createTableIfMissing: false` and the table exists only in
   `migrations/0000`, not in `shared/schema.ts`, so push alone misses it.
4. Boots `node dist/index.cjs` with only `DATABASE_URL` + a dummy
   `SESSION_SECRET`. No other secrets are needed at boot: Stripe, Resend,
   GHL, Twilio and Google credentials are resolved lazily and their failures
   are caught/logged by the app. Server output goes to
   `test-results/e2e-server.log`.

## Soft-skip policy (external feeds)

`podcast.spec.ts` depends on an external RSS feed fetched server-side. A
third-party outage must not fail the build, so the spec probes
`GET /api/podcast/episodes` first and **skips (with a logged warning)** if
the feed is unreachable or empty. Tradeoff, explicitly accepted: a real
podcast-pipeline regression can hide behind a feed outage for a run — the
probe result is printed every run, so persistent skips are visible in CI
logs and should be investigated.

`videos.spec.ts` is feature-detected the same way: `/insights/videos` is not
merged on every branch, so an HTTP 404 skips the test; once the rail ships
(route answers 200) the test arms itself automatically.

## The drift guard

`seo-render.spec.ts` is the test that pins `server/seoRender.ts` to reality:
it reads the H1 a real browser renders on `/tools/analyzer`, then re-fetches
the page as a bot (plain GET, no JS) and asserts the raw server HTML contains
that exact H1. Editing the client H1 without updating the crawler fallback
(or vice versa) fails this test. Keep it — it is the only two-document
consistency check in CI.

## Adding a smoke test

- Only money paths: something a customer or crawler hits that, if broken,
  costs revenue or indexing.
- Resilient selectors only: `getByRole`, headings text, `data-testid`.
  Never brittle CSS chains.
- Must pass on a **fresh, empty database** — no seeded fixtures, no ordering
  dependencies between tests.
- If it depends on an external service, follow the soft-skip policy above
  and document the tradeoff in the spec header.
- If the pack approaches 15 tests or 5 minutes, remove or consolidate before
  adding.
