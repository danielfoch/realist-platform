# Realist Agent Platform — bring your own AI, get a hosted result

**Built:** 2026-09-18 · **Branches:** `feat/agent-platform-hosted-views` (PR #189), `feat/mcp-oauth` · **User-facing docs:** `/developers`

People use their own harness — Claude (Code, desktop, claude.ai), Codex, Cursor, Grok, ChatGPT, or plain
HTTP — to call Realist's tools. The agent gets structured JSON. The human gets a link to a page on
realist.ca with the interactive version of the result: an editable pro forma spreadsheet with an Excel
download, the multiplex model, or a chart report. Same idea as a deploy tool handing back a preview URL.

This implements Tracks B3, C1–C3 (hosted MCP pulled forward) and part of B2 from
`docs/DISTRIBUTION_ARCHITECTURE.md`.

## Surfaces

| Surface | URL | Auth | For |
|---|---|---|---|
| Hosted MCP (Streamable HTTP) | `POST https://realist.ca/mcp` | API key **or** OAuth access token (bearer) | Claude Code, Codex, Cursor, VS Code, Grok / OpenAI / Claude APIs; claude.ai, Claude Desktop and ChatGPT connectors via OAuth sign-in |
| Hosted MCP, key in path | `POST https://realist.ca/mcp/u/<key>` | the URL is the secret | fallback for clients that can neither send headers nor do OAuth |
| REST | `POST https://realist.ca/api/v1/tools/{name}` | bearer | any function-calling harness, curl |
| Discovery | `GET /api/v1`, `/api/v1/tools`, `/api/v1/openapi.json` | none | catalogs, OpenAPI 3.1 for GPT actions / toolkits |
| Legacy REST | `/api/agent/*` | bearer | unchanged paths; now thin wrappers over the registry |
| stdio bridge | `npx @realist/mcp` | `REALIST_API_KEY` | clients that can only launch local servers |
| Hosted views | `https://realist.ca/v/<token>` | the token | humans, in a browser |

## One registry, three transports

```
server/agent/tools.ts        ← THE tool catalog: name, model-facing description, zod input,
                               scope, annotations, handler(ctx, input)
   ├── server/agentApi.ts         /api/agent/*          (LEGACY_ROUTES table → tools)
   ├── server/agent/v1Routes.ts   /api/v1/*  + /api/views/*
   ├── server/agent/openapi.ts    OpenAPI generated from the registry
   └── server/agent/mcpServer.ts  /mcp  (official MCP SDK, stateless, JSON responses)
```

- **Add or change a tool in `tools.ts` only.** JSON Schema for MCP and OpenAPI is generated from the zod
  schema (`zod-to-json-schema`); `fieldDescriptions` covers schemas owned by other modules. The stdio
  package reads `/api/v1/tools` at runtime, so it never needs a release for a new tool.
- `invokeAgentTool()` is the single entry point: scope check → validation → handler. Failures are
  `AgentToolError(status, code)`; REST maps them to HTTP, MCP returns them as `isError` results with a hint
  the model can act on.
- Handlers never see `req`/`res` (only `AgentContext`), and business logic stays in the engines they call.
- `tools/list` is filtered by the key's scopes — an agent never sees a tool it cannot run.
- Rate limits are per key and **shared across transports** (`services/usage.ts`). REST meters per request;
  MCP meters per tool call as `endpoint = "mcp:<tool>"`.
- The MCP server is **stateless**: a fresh `Server` per POST, `enableJsonResponse`, no sessions, `GET`/`DELETE`
  → 405. Nothing to keep alive behind the autoscale proxy, and any instance can serve any request.

### Tools (14)

`realist_whoami`, `realist_find_deals`, `realist_underwrite_listing`, `realist_underwrite_custom`,
`realist_underwrite_multiplex`, `realist_estimate_rent`, `realist_get_market_report`,
`realist_get_mortgage_rates`, `realist_list_my_analyses`, `realist_get_analysis`,
`realist_submit_to_deal_desk` (`deal:submit`), `realist_submit_for_review` (`community:write`),
`realist_get_referral` / `realist_update_referral` (`partner:referrals`).

Pre-registry names (`estimate_rent`, `underwrite_multiplex`, `submit_to_deal_desk`) are still accepted by
`tools/call` as aliases.

## OAuth 2.1 sign-in for connectors (`server/agent/oauth/`)

Connector UIs (claude.ai, Claude Desktop, ChatGPT) add a server by URL and cannot send a custom header.
With OAuth the user pastes `https://realist.ca/mcp`, signs in to Realist, approves, and is connected — no
key, no secret URL.

```
POST /mcp (no token) → 401 + WWW-Authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource/mcp"
  → GET /.well-known/oauth-protected-resource/mcp     (RFC 9728: who protects /mcp)
  → GET /.well-known/oauth-authorization-server       (RFC 8414: where to send the user)
  → POST /oauth/register                              (RFC 7591 dynamic client registration)
  → GET  /oauth/authorize  (PKCE S256, resource=…/mcp) → request parked → 302 /oauth/consent?request=<id>
  → React consent page: sign in if needed → approve / deny → back to the client with ?code=…&state=…
  → POST /oauth/token → access token (realist_oat_…, 1 h) + rotating refresh token (realist_ort_…, 60 d)
```

- **The protocol plumbing is the MCP SDK's own handlers** (request validation, PKCE check, exact
  redirect-URI matching with loopback-port relaxation, OAuth error formatting, rate limiting), mounted under
  `/oauth/*` so they cannot collide with site routes. `provider.ts` holds what is ours: what a grant means,
  token lifetimes, and the consent hand-off. `store.ts` follows the `viewStore.ts` pattern (tables declared
  in `shared/schema.ts` **and** created idempotently; in-memory store for tests).
- **Nothing secret is stored in the clear**: client secrets, authorization codes and tokens are SHA-256
  hashes. The SDK compares client secrets in plaintext, so `verifyClientSecret` checks the hash ahead of the
  SDK's token/revoke handlers.
- **Consent is a client route** (`/oauth/consent`) because the sign-in flow returns with a client-side
  navigation. It is served with `X-Frame-Options: DENY` + `frame-ancestors 'none'`; approve/deny/disconnect
  are session-authenticated, same-origin-checked POSTs (the session cookie is already `SameSite=Lax`).
- **Registration is open to anyone, so client metadata is hostile input.** The consent page shows where the
  user will be sent back to — the one thing an impostor cannot fake — recognises the well-known connector
  hosts, and warns on anything else. `client_uri` is only ever rendered as an http(s) link.
- **Scopes** grantable by consent: `read`, `underwrite`, `deal:submit`, `community:write` (never
  `partner:referrals`). The two "acts for you" scopes are checkboxes; public posting starts unticked. A client
  that asks for nothing gets `read underwrite`.
- **Hardening**: single-use codes (5 min) — a replayed code revokes the grant; refresh tokens rotate, and
  reuse of a spent one revokes the grant unless it arrives within 60 s (a client retrying a dropped
  response); tokens are audience-bound to `…/mcp` (RFC 8707) and only accepted there — REST stays on API
  keys; one grant per (user, client), so reconnecting updates scopes instead of stacking rows.
- **Account page**: "Connected apps" lists grants with scopes, last use and 30-day call counts, and
  disconnects them (revoking every token). OAuth calls are rate-limited and metered per connection as
  `api_key_id = "oauth:<grantId>"`, so they show up in the existing usage summary.
- SDK per-IP rate limits are raised: a connector backend fronts all of its users from a few addresses.
- Verified with the **official MCP client SDK's OAuth flow** given only the server URL, against both
  `npm run dev` and `dist/index.cjs`.

## Hosted views

A tool that produces something worth *seeing* calls `attachView()` with a view document
(`shared/agentViews.ts`) and returns a `view` block: `{ url, kind, title, instructions }`. The MCP result
leads with the headline and the link; the server `instructions` tell the model to always show it.

| Kind | Produced by | Page |
|---|---|---|
| `underwriting` | underwrite listing / custom, get analysis | editable assumptions → live pro forma (base/bear/bull), charts, stress test, notes on every estimated assumption, Excel + CSV download, links into the analyzer and Deal Desk |
| `report` | find deals, estimate rent, market report | declarative sections: stat grid, chart, **sortable table**, callout, narrative (reuses `shared/reportContent.ts` blocks + `ReportSectionBlock`) |
| `multiplex_model` | underwrite multiplex | no new page — links to the existing `/tools/multiplex-underwriter?share=<token>` |

- **Storage:** `agent_result_views` (declared in `shared/schema.ts`, also created idempotently by
  `viewStore.ts` so a deploy never depends on `db:push`). Creating a view is best-effort — if it fails the
  tool still returns its result, with `view: null`.
- **Access:** the 128-bit token is the only credential (no sign-in wall — the visitor arrives
  mid-conversation from another app). Pages are `noindex` server-side and client-side, the public payload
  omits user / key / analysis ids, and owners can list and delete views (`GET`/`DELETE /api/v1/views`).
  `/account/api-keys` lists recent views.
- **Any new tool can ship a visual** by composing `report` sections — no client work required.

### The Excel model

`server/agent/xlsx.ts` is a dependency-free .xlsx writer (the npm `xlsx` build is unmaintained; exceljs is
~20 MB). `proFormaWorkbook.ts` builds Summary / Assumptions / Pro Forma sheets wired with **live formulas
that mirror `shared/buyHoldAnalysis.ts` line for line** — blue-on-yellow cells are inputs. Cached values
come from the JS engine. If the visitor edited assumptions in the browser, the page POSTs them and the
workbook is rebuilt for their scenario.

Verified by recalculating every formula cell with an independent engine (Python `formulas`) and comparing
with the cached values: 0 mismatches across base, 0 % rate, all-cash, 15-year hold and short-amortization
cases (worst absolute difference ≈ 5e-11).

## One underwriting engine

`client/src/lib/calculations.ts` moved to **`shared/buyHoldAnalysis.ts`** (the client file re-exports it).
The agent tools, the hosted views, the Excel model and the web analyzer now run the same math, so agents
get the website's IRR, 10-year projection and stress test instead of a weaker subset.

`server/agent/underwriting.ts` resolves a sparse agent request into full `BuyHoldInputs`:

- **Defaults mirror the web analyzer** (20 % down, 5.5 %, 25 yr, 5 % vacancy, 5/5/5 maintenance /
  management / capex, 3 % closing costs, 10-year hold). Tax comes from the listing feed when known, else
  1 % of price; insurance $1,200/unit.
- **Rent**: caller → listing's actual rent → Realist rent engine (bedrooms **per unit**) → placeholder
  table. The source is reported (`rentSource`) and flagged in `warnings`.
- **`expenseRatio` is now ALL-IN.** The old `underwriteSimple()` passed the ratio to the map-metrics engine
  as "maintenance", which then added property tax and insurance on top — a caller asking for 35 % was
  charged ~57 %, understating NOI and cap rate. Expenses are now explicit line items, and a supplied ratio
  is distributed across them so the total matches. **Numbers from `/api/agent/underwrite/*` and Ask
  Realist's `underwrite_property` change accordingly** (higher, correct NOI); response keys are unchanged
  and new ones were added (`irr`, `totalCashInvested`, `expenseBreakdownAnnual`, `exit`, `stressTest`).
- Saved analyses now carry a web-analyzer-shaped `inputsJson` / `resultsJson` (so `extractTypedMetrics`
  and My Analyses treat agent rows like web rows), and the address is saved (it was always `null` for
  listing underwrites — the old code read fields the DDF normalizer does not produce).

## Also fixed along the way

- `GET /api/agent/market-report?city=` **404'd for every city** (it looked for `reports`/`cities` in a
  payload shaped `{snapshots, months}`). It now reads snapshots directly and returns `latest` + `history`.
  Months with no underwritten deals are never the headline and are never plotted as zeros.
- The links the agent API returned (`/deal-analyzer?analysisId=…`) were dead — the analyzer ignores that
  parameter. `analysisUrl` is now the hosted view.
- `bearerAuth` accepts a bare key, lowercase `bearer`, or a doubled scheme (harnesses differ).
- `reusePort` is Linux-only in Node; the server could not boot on macOS.
- Code-block copy buttons: `hover-elevate` sets `position: relative`, which silently beat `absolute`.

## Operating notes

- `PUBLIC_BASE_URL` (default `https://realist.ca`) controls the origin used in view URLs, OpenAPI
  `servers[]` and docs. Do **not** use `appBaseUrl()` here — it prefers the Replit dev domain.
- Tune limits with `AGENT_RATE_LIMIT_PER_MINUTE` (60) / `AGENT_RATE_LIMIT_PER_DAY` (2000).
- The request logger only logs paths under `/api`, so `/mcp/u/<key>` URLs are not written to app logs.
  They may still appear in infrastructure access logs — treat connector URLs as secrets, revoke to rotate.
- Adding the MCP SDK did not change the build: it stays an esbuild *external* and resolves to its CJS build
  at runtime (verified by booting `dist/index.cjs` and driving `/mcp` with the official MCP client).

## Tests

`server/agent/*.test.ts` — underwriting resolver, .xlsx writer + workbook, and `platform.test.ts`, which
drives the registry over real HTTP: `/api/v1`, OpenAPI, hosted views (incl. downloads and privacy of the
public payload), and the MCP endpoint (initialize, scope-filtered `tools/list`, `tools/call`, error
results, metering, the key-in-path variant). `server/agentApi.test.ts` still passes unchanged against the
registry-backed legacy routes.

## Not done yet (in priority order)

1. **Test the OAuth flow from the real claude.ai and ChatGPT connector UIs** once deployed (it is verified
   against the MCP SDK's client, which those products build on), then apply for their connector directories.
   Optional next: Client ID Metadata Documents (the newer alternative to dynamic registration), and pruning
   of registered-but-never-used clients.
2. **Publish `@realist/mcp@0.2.0`** to npm (the bridge is built and verified locally; publishing is a
   human step).
3. **MCP Apps / inline UI**: the view pages are already self-contained; an `?embed=1` variant could be
   returned as a UI resource so harnesses that support it render the spreadsheet inline.
4. Plan tiers → quotas (Track E2), view expiry / retention policy, Google Sheets export from a view.
5. Persist rate-limit counters (they are per-instance and in-memory today).
