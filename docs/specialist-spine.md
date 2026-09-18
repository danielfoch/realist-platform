# Realist specialist spine (P0 + P1 Forms)

The Agent API is the contract layer every Realist specialist calls. One
router agent will eventually dispatch tiny specialists (forms, listing
extract, docs, CRM writes, browser). This document is the plug-in guide
for that fleet.

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
| `Property` | none (Zod only) | Address, CA country, geo, beds/baths/units, taxes |
| `Listing` | none | MLS #, status, list price, property ref, DOM, source |
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
`forms.fill` is implemented (P1). Docs and CRM remain stubs.

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

P1 implements Ontario / OREA **field maps + fill** only. P0 still does
not implement browser automation or CRM writes.

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

## OpenAPI

- Served: `GET /api/agent/openapi.json` (`read` scope)
- File: `docs/openapi/agent-api.yaml`
- Source object: `shared/agentOpenApi.ts`

## Tests

- Schema + transition rules: `shared/agentSpine.test.ts`
- Routes: `server/agentApi.test.ts` (same bearer-mock style as the
  existing estimate-rent / find-deals cases)
