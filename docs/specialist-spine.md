# Realist specialist spine (P0–P5)

The Agent API is the contract layer every Realist specialist calls. One
router agent will eventually dispatch tiny specialists (forms, listing
extract, docs, CRM writes, browser). This document is the plug-in guide
for that fleet.

**Product intent (P2):** Realist is **Zillow for Earth for AI agents**.
An agent pastes a listing URL (or address / MLS when available) from
anywhere on Earth. We normalize `Property` + `Listing`, then underwrite
through the existing Realist engines. Canada is deep (CREA DDF + OREA
field maps). The rest of the world is wide (public-page extract +
currency-native underwrite).

**Homies is out of scope.** This spine is Realist-only: Realist schemas,
Realist `api_keys`, Realist jobs. Do not add Homies repos, Homies CRM,
or Homies integrations here.

## Auth (unchanged)

Existing bearer keys (`realist_live_*`) stay the only auth system.

- SHA-256 hashed in `api_keys`; plaintext returned once at mint.
- Rate limit + usage meter already wrap every `/api/agent/*` route.
- Default key scopes remain `read`, `underwrite`, `deal:submit`.
- New opt-in scopes (existing keys keep working):
  - `jobs:write` — create / approve / cancel any job type
  - `forms:write` — `forms.fill` jobs (P1 implemented)
  - `docs:write` — `docs.route` jobs (P5 implemented)
  - `crm:write` — `crm.update` jobs (P3 implemented)
  - `browser:write` — `browser.act` jobs (P4 implemented)

Creating an `underwrite.*` job still works with the existing `underwrite`
scope. Listing extract accepts `read` or `jobs:write`.

## Canonical schemas

TypeScript + Zod live in `shared/agentSpine.ts`:

| Resource | Persistence in P0 | Notes |
|---|---|---|
| `Property` | none (Zod only) | Address, ISO country, region/state/province, postal/zip, geo, beds/baths/units, taxes, area sqft/sqm |
| `Listing` | none | Optional MLS #, status, list price + ISO currency, sourceUrl/sourceHost/externalId |
| `Deal` | reuses `analyses` | Strategy + assumptions + investment-metrics shape |
| `Contact` | reuses person spine | Email identity on `users` / `leads` / `crm_contacts` |
| `TransactionFile` | in-memory attach on `docs.route` approve | Closing-packet stub (`docClass` + status + filename) |
| `AgentOrg` | none | Ownership already implied by `api_keys.user_id` |
| `Job` | `agent_jobs` table | First-class specialist work unit |

## How a specialist registers

1. Add a job type to `AGENT_JOB_TYPES` in `shared/agentSpine.ts`.
2. Fill in `SPECIALIST_REGISTRY[type]`:
   - `specialistId` — stable name, e.g. `realist.forms`
   - `requiresApproval` — **true if the work leaves Realist**
   - `implemented` — false until the handler is real
   - `scopes` — the bearer scopes that may create / approve / cancel
3. Add a Zod input schema to `JOB_INPUT_SCHEMAS`.
4. Register an executor in `server/agentApi.ts` (or `server/agentJobs.ts`):

```ts
registerSpecialistExecutor("forms.fill", async (input) => fillForm(input));
```

Unregistered types run the built-in stub (`{ stub: true, todo: "..." }`).
`forms.fill` (P1), `listing.extract` (P2), `crm.update` (P3),
`browser.act` (P4), and `docs.route` (P5) are implemented.

## Job lifecycle

```
create ─┬─ approvalRequired? ─ yes ─► needs_approval ─ approve ─► running ─► succeeded
        │                                              cancel  ─► cancelled
        └─ no ──────────────────────► queued ─ start ─► running ─► succeeded / failed
                                                     cancel  ─► cancelled
```

- `POST /api/agent/jobs` is idempotent on `(userId, idempotencyKey)`.
- Underwrite jobs may execute synchronously via the existing
  `underwriteSimple` / listing DDF adapter.
- `GET /api/agent/jobs` and `GET /api/agent/jobs/:id` list only the
  caller's jobs.

## Human approval gate

Anything that **leaves the building** (forms submitted, documents sent,
CRM writes) must set `requiresApproval: true`. The job stays in
`needs_approval` until `POST /api/agent/jobs/:id/approve`. Cancel is
allowed from `queued`, `running`, and `needs_approval`.

P1 implements Ontario / OREA **field maps + fill** only. Forms stay on
Ontario maps; extract + underwrite go global. P0 still does not
implement browser automation or CRM writes. Read-only `listing.extract`
does **not** need human approval. Partial extracts succeed with
`missingFields` + warnings. Login-walled pages fail cleanly.

## Forms specialist (P1)

`shared/forms/` is the Cua-style specialist: map structured deal /
property / contact data onto board field maps, score completeness, and
leave the job in `needs_approval` until a human approves.

**Copyright:** maps only (field key, label, type, party, required, page
hint). Official blank PDFs stay with the licensed user. We produce a
JSON `values` payload they can apply in WEBForms / TransactionDesk.
Do not commit or reproduce full form boilerplate.

**Never invent** legal names, prices, deposits, closing dates, or
clauses. `listing.listPrice` never becomes `purchase_price`. Signature
and initials stay blank unless the caller sends an override.

### Registered form ids

| Id | Title | Confidence |
|---|---|---|
| `orea-100` | Agreement of Purchase and Sale | draft |
| `orea-101` | Amendment to Agreement | draft |
| `orea-105` | Notice / waiver | draft |
| `orea-200` | Seller Representation Agreement | draft |
| `orea-300` | Buyer Representation Agreement | draft |
| `orea-320` | Confirmation of Co-operation | draft |
| `orea-400` | Schedule A (generic attachment) | draft |

All v1 maps are `mapConfidence: "draft"` because we do not ship licensed
blanks. Non-Ontario boards can hook the same registry later.

### Job behaviour

1. `POST /api/agent/jobs` with `type=forms.fill` (or `POST /api/agent/forms/fill`)
   runs the fill engine immediately and stores the draft on `job.result`.
2. Status stays `needs_approval` even at 100% completeness.
3. `POST /api/agent/jobs/:id/approve` marks `succeeded` and does **not**
   e-sign, email, or submit to a board. A `TransactionFile` stub is
   attached on the job result only.
4. `GET /api/agent/forms` and `GET /api/agent/forms/:formId` are `read`.

### Eval

`shared/forms/eval.ts` + fixtures in `shared/forms/fill.test.ts`:
`fieldAccuracy`, `requiredCompletion`, `rejectIfInvented`. Pass/fail
only — no claimed 99.7% accuracy.

## Listing extract (P2 — Zillow for Earth)

`shared/listingExtract/` is the worldwide ingest specialist. An agent
supplies a public listing URL, caller-fetched HTML, or a CREA MLS
number. We never invent prices, rents, taxes, or beds.

### ToS / scraping limits

- Public listing pages, official public APIs, or caller-supplied
  structured HTML/text only.
- No login, no paywall bypass, no portal cookies. Interaction that still
  stays on a public page is P4 (`browser.act` playbooks).
- Prefer JSON-LD / OpenGraph / public embed endpoints over brittle HTML.
- Login walls, CAPTCHAs, and HTTP 401/403 return
  `blocked_or_login_wall`. Missing pages return `listing_not_found`.
- CI uses committed fixtures. Live network fetches are not required.

### Extractor registry

```ts
registerExtractor({
  id: "rightmove-uk",
  hosts: ["rightmove.co.uk"],
  countries: ["GB"],
  implemented: true,
  extract(ctx) { /* JSON-LD / OpenGraph / __NEXT_DATA__ / PAGE_MODEL */ },
});
```

Host router: hostname (www-stripped, suffix match) → extractor, else
the generic JSON-LD / OpenGraph / `__NEXT_DATA__` / `PAGE_MODEL`
fallback. Adding a portal is a new file under
`shared/listingExtract/extractors/` + a `BUILTIN_EXTRACTORS` entry.

Built-in extractors (`GET /api/agent/listings/extractors`):

| Id | Hosts | Notes |
|---|---|---|
| `generic-jsonld-og` | `*` | Worldwide JSON-LD / OG / Next / PAGE_MODEL fallback |
| `realtor-ca` | realtor.ca | CA public markup |
| `zillow` | zillow.com | US public pages; fragile; degrades |
| `redfin` | redfin.com | US public pages |
| `realtor-com` | realtor.com | US public pages |
| `homes-com` | homes.com | US public JSON-LD. Apartments.com skipped (rental / often gated) |
| `rightmove-uk` | rightmove.co.uk | UK — PAGE_MODEL + structured data |
| `zoopla-uk` | zoopla.co.uk | UK |
| `domain-au` | domain.com.au | AU — `__NEXT_DATA__` |
| `realestate-au` | realestate.com.au | AU / REA |
| `immoscout-de` | immobilienscout24.de | DE |
| `seloger-fr` | seloger.com | FR (Leboncoin skipped — often login-walled) |
| `idealista` | idealista.com / .it / .pt | ES / IT / PT |
| `propertyguru` | propertyguru.com.sg / .my | SG / MY (MYR on `.my`) |
| `crea-ddf` | (MLS #) | CA fast path when DDF is configured |

### Job + convenience routes

1. `POST /api/agent/jobs` with `type=listing.extract`, or
   `POST /api/agent/listings/extract` (`read` or `jobs:write`).
2. Status is `succeeded` when extract runs (including partial). Missing
   facts stay null and appear in `missingFields` / `warnings`.
3. `POST /api/agent/listings/underwrite-url` (`underwrite`) creates a
   parent extract job, then an `underwrite.custom` child when address +
   list price exist. No invented FX: pass `fxToCad` for a CAD companion
   price. Metrics stay in listing currency otherwise.
4. `GET /api/agent/listings/extractors` lists the registry (`read`).

Currency: the underwrite engine is CAD-oriented historically. Non-CAD
prices pass through with explicit `currency` on inputs/results.
`priceCad` is set only when currency is CAD or the caller supplied
`fxToCad`.

## CRM specialist (P3 — Realist contacts only)

`crm.update` writes the native Realist CRM (`crm_contacts` /
`crm_activities`) owned by the API key’s user. **Homies is out of
scope.** No Follow Up Boss, GHL, or other external CRM writebacks.

Never invent emails, phones, or names. If a create is missing a name
or email, the job fails with `name_required` / `email_required`.

### Job behaviour

1. Create `crm.update` (or `POST /api/agent/crm/contacts/upsert`)
   resolves the target **inside this user’s book**, builds
   `proposedDiff: { before, after, changes[] }`, and stays
   `needs_approval`. Nothing is written (`dryRun: true`).
2. Update-only actions (`update_stage`, `add_note`, `set_next_action`)
   fail if the contact is missing or owned by someone else.
3. Approve re-loads the live row. If material fields drifted from
   `proposedDiff.before`, the job fails with `conflict`. Otherwise the
   write is applied and the result is `{ before, after, applied: true }`.
4. Cancel leaves the database unchanged.

Actions: `upsert_contact` | `update_stage` | `add_note` | `set_next_action`.
Stages are the existing Realist set (`new` … `lost`). Next-action
hints are stored on `crm_contacts.data` (the computed next-step engine
is unchanged). Email identity still goes through person-spine
`linkPersonByEmail`.

### Routes

- `GET /api/agent/crm/contacts?query=` (`read`)
- `GET /api/agent/crm/contacts/:id` (`read`)
- `POST /api/agent/crm/contacts/upsert` (`crm:write` or `jobs:write`)

Mutations stay on the job spine. `crm:write` remains opt-in.

## Browser specialist (P4 — public playbooks only)

`browser.act` is a **playbook registry**, not an open-ended computer-use
agent. An agent calls it when static HTML extract fails or a public
control must be clicked (cookie banner, “show more”, gallery, bounded
scroll). Then `extract_after_render` runs the existing listing extract
on the rendered DOM.

**Hard denylist:** login / password fields, payment, captcha solve,
file upload to boards, email send, WEBForms / MFA / board auth.
Login, checkout, and `/webform` URLs return `blocked_or_login_wall`.

**Approval:** any click action stays `needs_approval` (`previewOnCreate`
+ `applyOnApprove`). `extract_after_render` alone may run immediately
(read-only rendered DOM). Default key scopes are unchanged; mint
`browser:write` or `jobs:write`.

**Sandbox:** Playwright Chromium, headless, timeout-bounded, no
persistent user profile. Screenshots land in `os.tmpdir()` job
artifacts only — never committed. Unit tests inject a mock driver.
The optional e2e file is skipped in CI unless `BROWSER_ACT_E2E=1`.

Allowed v1 actions: `dismiss_cookie_banner`, `expand_description`,
`open_listing_gallery`, `scroll_to_load`, `extract_after_render`.
Unknown hosts may only extract.

### Routes

- `GET /api/agent/browser/playbooks` (`read`)
- `POST /api/agent/browser/act` (`browser:write` or `jobs:write`)

## Docs specialist (P5 — route user-supplied deal files)

`docs.route` classifies inbound deal documents (email attachments,
uploads, extracted text) and proposes a `TransactionFile` stub for the
right Realist deal / analysis / MLS number.

**Not stored:** official blank OREA/board forms. Classify
user-supplied packets only.

**Never invent** party names, purchase prices, or closing dates from
weak OCR. Those facts stay out of the result. Low confidence stays
`needs_approval` with a proposed class.

**v1 text only.** There is no PDF library in this repo. High confidence
needs `textContent`. `base64` is size-capped and recorded as “OCR is a
follow-up.”

### Job behaviour

1. Create (`POST /api/agent/jobs` or `POST /api/agent/docs/route`)
   classifies immediately and stays `needs_approval` (`dryRun: true`).
2. Result: `{ docClass, confidence, suggestedFilename, missingForClosing[], warnings[], transactionFile }`.
3. Approve persists stub metadata **only** when `dealId`, `analysisId`,
   or `mlsNumber` resolved the target. Cancel writes nothing.
4. `missingForClosing` = checklist for `hints.stage` (default `closing`)
   minus already-routed classes for that target (plus this proposal).

P5 classes: `offer`, `amendment`, `waiver_notice`, `inspection_report`,
`appraisal`, `mortgage_commitment`, `id_document`, `insurance`,
`title_search`, `survey`, `hoa_condo_status`, `disclosure`,
`commission_trust`, `other`. P0 aliases (`waiver`, `mortgage`,
`identification`, `status_certificate`) still parse.

### Routes

- `GET /api/agent/docs/classes` (`read`)
- `POST /api/agent/docs/route` (`docs:write` or `jobs:write`)

## OpenAPI

- Served: `GET /api/agent/openapi.json` (`read` scope)
- File: `docs/openapi/agent-api.yaml`
- Source object: `shared/agentOpenApi.ts`

## Tests

- Schema + transition rules: `shared/agentSpine.test.ts`
- Forms fill + eval: `shared/forms/fill.test.ts`
- Listing extract (fixture HTML/JSON-LD, offline): `shared/listingExtract/extract.test.ts`
- CRM diffs + apply: `shared/crmJob.test.ts`, `server/agentCrm.test.ts`
- Browser playbooks + denylist: `shared/browserAct.test.ts`
- Browser worker (mocked driver): `server/browserAct.test.ts`
- Docs classify + checklist: `shared/docsRoute.test.ts`, `server/agentDocs.test.ts`
- Routes: `server/agentApi.test.ts` (same bearer-mock style as the
  existing estimate-rent / find-deals cases)
