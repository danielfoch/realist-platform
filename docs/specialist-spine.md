# Realist specialist spine (P0 + P1 Forms + P2 Listing extract)

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
  - `docs:write` — `docs.route` jobs (declared, unused)
  - `crm:write` — `crm.update` jobs (declared, unused)

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
| `TransactionFile` | none | Closing-packet placeholder (`docClass` + status) |
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
`forms.fill` (P1) and `listing.extract` (P2) are implemented. Docs and
CRM remain stubs.

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
- No login, no paywall bypass, no portal cookies, no browser automation
  (that is P4).
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
  implemented: false,
  extract(ctx) { /* JSON-LD/OG today; dedicated parser later */ },
});
```

Host router: hostname (www-stripped, suffix match) → extractor, else
the generic JSON-LD / OpenGraph fallback. Adding `rightmove.co.uk` or
`domain.com.au` is a new extractor file + host map entry. UK/AU stubs
already sit in the registry and fall back to generic markup.

Built-in v1 extractors:

| Id | Hosts | Notes |
|---|---|---|
| `generic-jsonld-og` | `*` | Worldwide fallback |
| `realtor-ca` | realtor.ca | CA public markup |
| `zillow` | zillow.com | US public pages; fragile; degrades |
| `redfin` | redfin.com | US public pages |
| `rightmove-uk` | rightmove.co.uk | Stub + generic fallback |
| `domain-au` | domain.com.au | Stub + generic fallback |
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

## OpenAPI

- Served: `GET /api/agent/openapi.json` (`read` scope)
- File: `docs/openapi/agent-api.yaml`
- Source object: `shared/agentOpenApi.ts`

## Tests

- Schema + transition rules: `shared/agentSpine.test.ts`
- Forms fill + eval: `shared/forms/fill.test.ts`
- Listing extract (fixture HTML/JSON-LD, offline): `shared/listingExtract/extract.test.ts`
- Routes: `server/agentApi.test.ts` (same bearer-mock style as the
  existing estimate-rent / find-deals cases)
