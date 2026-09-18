# Realist specialist spine (P0)

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
  - `forms:write` — `forms.fill` jobs (declared, unused)
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
registerSpecialistExecutor("forms.fill", async (input, ctx) => {
  // TODO: OREA fill. Must not run until the job is approved.
  return { filledPdfUrl: "..." };
});
```

Unregistered types run the built-in stub (`{ stub: true, todo: "..." }`).
That is intentional for P0: the job object and approval gate exist before
the specialist does.

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

P0 does **not** implement OREA form filling, browser automation, or CRM
writes. Those job types exist so later PRs can attach a handler without
changing the contract.

## OpenAPI

- Served: `GET /api/agent/openapi.json` (`read` scope)
- File: `docs/openapi/agent-api.yaml`
- Source object: `shared/agentOpenApi.ts`

## Tests

- Schema + transition rules: `shared/agentSpine.test.ts`
- Routes: `server/agentApi.test.ts` (same bearer-mock style as the
  existing estimate-rent / find-deals cases)
