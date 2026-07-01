# Realist Distribution Architecture — Mobile, MCP, and the Shared API Layer

**Date:** 2026-07-01
**Scope:** How Realist intelligence (underwriting, multiplex feasibility, rent/value estimation, market intel, saved reports) gets distributed through iOS/Android, an MCP server for realtor/investor AI agents, and a public API — without forking the engine.
**Grounding:** Based on a full audit of this repo (server ~88 files, client 263 files, `shared/` 49 modules, `mcp-realist/`, `mobile/`).

---

## 0. What already exists (audit findings — read this first)

This project is **much further along than "greenfield mobile + MCP"**. The plan below is mostly *finish, consolidate, and harden* — not build.

| Layer | Status | Evidence |
|---|---|---|
| Core underwriting math | ✅ Single source of truth | `shared/investmentMetrics.ts` → `calculateInvestmentMetrics()` used by client, server routes, and agent API |
| Agent API | ✅ 9 bearer-token endpoints | `server/agentApi.ts` (584 loc): underwrite listing/custom, find-deals, analyses CRUD, community submit, rates, market report |
| API keys | ✅ Working | `api_keys` table, SHA-256 hashes, `realist_live_` prefix, revocation, `lastUsedAt`; minted at `/account/api-keys` |
| MCP server | ✅ Built, ❌ unpublished | `mcp-realist/` — 8 tools, stdio transport, MCP SDK ^1.0.4, Zod validation, CLI (`realist`). No `dist/`, never `npm publish`ed, no tests |
| Mobile | ✅ Store-ready Capacitor 6 shell | `mobile/` — full iOS (Xcode) + Android (Gradle) projects, wraps `https://realist.ca`, push token collection wired end-to-end (`client/src/lib/capacitorPush.ts` → `POST /api/mobile/push-token` → `push_device_tokens`). Remaining: Apple/Google enrollment, signing, APNs/FCM sender config |
| Multiplex feasibility | ✅ Real rules engine | `server/multiplexFeasibility.ts` (~1,300 loc): ON Bill 23 + Toronto 4/6-unit, BC SSMUH, ~14 ON municipalities, confidence scores, risk flags, source traceability |
| Rent estimation | ✅ Engine, ❌ not exposed | `shared/rentEstimator.ts` + `server/rentIntelligence.ts` (DDF comps → rent aggregates → CMHC baseline, with `modelPredictions` eval loop). **Admin-only endpoint** — not reachable from agent API or public API |
| Sale value estimation | ✅ Engine, ❌ not exposed | `server/salePriceOracle.ts` + pluggable `salePriceProviders.ts` |
| Stress test / 10-yr projections | ⚠️ **Client-only** | `client/src/lib/calculations.ts` (`calculateBuyHoldAnalysis`, `calculateStressTest`), `client/src/lib/mortgage/amortization.ts` — the server cannot produce these |
| CMHC MLI Select | ⚠️ Duplicated | `client/src/lib/mliConfig.ts` duplicates `shared/mliConfig.ts` |
| Report/PDF export | ⚠️ Client-only | `client/src/lib/pdfExport.ts` (html-to-image + jsPDF). Server generates markdown/HTML city & distress reports but no investor-report endpoint |
| Rate limiting | ❌ Effectively none | Global in-memory 300 req/min/IP in `server/routes.ts:175`; **zero per-key limits on `/api/agent/*`** |
| Usage metering / billing | ⚠️ Partial | Stripe checkout + `professional subscription` with manual monthly pull counter; no metered API billing, no usage events table |
| Zoning/tree/ravine/flood/heritage data | ❌ Mostly absent | Heritage/floodplain are **user-supplied boolean flags** consumed by the feasibility engine. No municipal API ingestion, no setback/angular-plane/parking calcs, no CoA precedent data |
| Dead weight | ❌ | `frontend/` (68 files, detached second Vite app) is dead code; `src/` is a parallel legacy IDX/DDF service with its own Express+Helmet+SQLite stack duplicating listing logic |
| PWA | ❌ | Responsive web app, but no manifest.json, no service worker |

---

## 1. Ruthless calls (decisions, up front)

1. **Do NOT build React Native / Expo / native apps.** The Capacitor shell in `mobile/` is finished code — the only remaining work is store paperwork. Realist's value is server-side intelligence, not native UI. A React Native rewrite would fork 263 files of product surface for zero engine benefit. Revisit native only if a killer native feature emerges (e.g., camera-based property capture) *and* mobile DAU justifies it.
2. **MCP before mobile — and MCP is already 80% done.** Finishing/hardening the agent API is the same work that gives mobile a clean API. Publish `@realist/mcp` in week one.
3. **A PWA is not the mobile strategy here.** Normally "PWA first" would be the ruthless call, but the Capacitor app already exists and app-store presence matters for a realtor/investor audience. Do the cheap PWA bits anyway (manifest + minimal service worker, ~1 day) so `GetAppBanner.tsx` has something to install before store approval, but don't build offline-first infrastructure.
4. **The real mobile gap is UX, not packaging.** `CapRates.tsx` is 4,386 lines of desktop-first map UI. Mobile v1 should be a small, mobile-first "My Realist" surface (saved analyses, alerts, snapshots) inside the existing web app — not a port of the analyzer.
5. **Move client-only math into `shared/` or the API lies.** Stress tests, 10-year projections, and MLI Select scoring exist only in the browser. Until they move to `shared/` and get API endpoints, MCP agents and API consumers get a *weaker* underwriter than the website — which violates the "one intelligence engine" goal.
6. **Do not ship `check_tree_ravine_flood_heritage_risks` as specified.** The data doesn't exist in the platform — heritage/floodplain are user-declared flags. Shipping a tool with that name would let agents present fabricated environmental/heritage clearance to clients. Ship `fetch_planning_risk_flags` that returns only what the feasibility engine actually knows, with explicit `unknown` states and `verification_required: true`. Expand as real data lands.
7. **Kill the duplicates:** delete `frontend/`, fold the `src/` IDX service into `server/` (or explicitly declare it a separate deployable and strip its duplicated route logic). Two Express stacks + two frontends is how business logic forks.
8. **Modular monolith, not microservices.** One Express app, one Postgres, a `server/services/` layer, three thin adapters (web routes, `/api/v1` public, MCP). You are one person + AI agents; a service mesh is cosplay.
9. **Rate limiting and usage metering are the blocking prerequisite for everything public.** `/api/agent/*` currently has API keys but no per-key limits and no usage log. That must land before publishing the MCP package or announcing an API.
10. **Start Apple Developer enrollment this week.** For a Sept 15 event, App Store review + D-U-N-S/enrollment lag is the long pole. TestFlight is the demo fallback.

---

## 2. Target architecture

```
                        ┌──────────────────────────────────────────┐
                        │              CORE (one Express app)       │
                        │                                          │
  Data ingestion        │  server/services/                        │
  ─ CREA DDF sync       │   ├ underwriting.ts     (wraps shared/)  │
  ─ rent ingestion      │   ├ rentEstimation.ts                    │
  ─ rate scraper        │   ├ saleValue.ts                         │
  ─ US listings         │   ├ multiplexFeasibility.ts              │
  ─ land claims   ──────▶   ├ scenarios.ts   (stress/projections)  │
  (existing crons,      │   ├ reports.ts    (investor report gen)  │
   move under           │   ├ marketIntel.ts                       │
   server/ingestion/)   │   ├ savedObjects.ts (analyses/watchlists)│
                        │   └ usage.ts      (metering + limits)    │
                        │                                          │
                        │  shared/  = pure math + zod schemas ONLY │
                        │  (investmentMetrics, rentEstimator,      │
                        │   + MOVED: buyHoldProjections, stress,   │
                        │   mliSelect — deduped from client)       │
                        └───────┬──────────┬──────────┬────────────┘
                                │          │          │
                     ┌──────────┴─┐  ┌─────┴─────┐  ┌─┴──────────────┐
                     │ Web adapter│  │ /api/v1   │  │ MCP adapter    │
                     │ (existing  │  │ public API│  │ mcp-realist/   │
                     │ session    │  │ bearer key│  │ (stdio now,    │
                     │ routes)    │  │ + metering│  │ hosted HTTP    │
                     └─────┬──────┘  └─────┬─────┘  │ later at       │
                           │               │        │ mcp.realist.ca)│
                     ┌─────┴─────┐   ┌─────┴─────┐  └───────┬────────┘
                     │ Browser + │   │ CRMs, 3rd │  ┌───────┴────────┐
                     │ Capacitor │   │ party apps│  │ Claude/Cursor/ │
                     │ iOS+Andr. │   │ partners  │  │ realtor agents │
                     └───────────┘   └───────────┘  └────────────────┘
```

**Rule: business logic lives in `server/services/` + `shared/`. Adapters translate transport + auth only.** The existing `agentApi.ts` already mostly follows this (it imports `calculateInvestmentMetrics` rather than reimplementing) — extend that discipline.

---

## 3. Mobile architecture

### 3.1 Framework decision
**Keep Capacitor.** Rationale:
- `mobile/` is a complete Capacitor 6 project: iOS + Android scaffolds, icons/splash generated, push token pipeline wired, iOS simulator build verified (`mobile/SHIP-CHECKLIST.md`).
- Content updates ship by deploying the web app — no store re-review.
- React Native/Expo would require rebuilding every screen and re-solving auth, maps (Leaflet → react-native-maps), charts, and PDF export for zero engine gain.
- Native iOS/Android: categorically premature. No feature on the roadmap needs it.

### 3.2 Mobile-first vs web-first surfaces
| Mobile-first | Web-first (usable on mobile, not optimized) |
|---|---|
| Saved properties / analyses list | Full deal analyzer (CapRates map workspace) |
| Underwriting report viewer (read) | Market Report Builder |
| Multiplex feasibility summary (read) | Admin dashboard, content CRUD |
| Rent/value snapshot lookup by address | LMS/course viewer |
| Alerts & watchlist management | BuyBox mandate builder |
| Share/export report | Co-investing tools |
| Quick underwrite (one address, default assumptions) | Detailed assumption editing |

### 3.3 Simplest useful mobile v1
A `/m`-quality (not separate route — just mobile-optimized) **"My Realist" home** inside the existing client:
1. Saved analyses list (`GET /api/agent/analyses` equivalent via session) with pull-to-refresh.
2. Analysis detail = report viewer (metrics grid + feasibility summary + share button reusing `pdfExport.ts`).
3. Address search → rent/value snapshot + one-tap "Quick Underwrite" with defaults.
4. Watchlist + push alerts (price change, new distress listing in saved city) — this is the reason the app exists vs. Safari.
5. Account: profile, API keys page (already exists), Stripe customer portal link.

That's ~4 new mobile-first pages/components in `client/`, zero new native code.

### 3.4 Auth/session model
- **Now (v1):** Capacitor webview shares the normal session cookie (`connect-pg-simple`, domain `.realist.ca`, `sameSite=lax`). Google OAuth already allowlisted in `capacitor.config.ts` (`accounts.google.com`). Extend session TTL for native platform to 90 days (detect via `window.Capacitor`) so users aren't re-logging in.
- **Watch out:** iOS ITP and OAuth-in-webview policies. Google blocks OAuth in plain webviews — use `@capacitor/browser` (already a dependency) to run OAuth in the system browser, deep-link back via a custom scheme (`ca.realist.app://auth/callback`) with a one-time login code exchanged for a session. Add the missing `App.addListener('appUrlOpen', …)` handler (audit found the plugin present but no handler).
- **Later (production):** issue refresh-token pairs for native (`POST /api/v1/auth/token`), same `users` table, so mobile stops depending on cookie behavior entirely. This is Track E, not a v1 blocker.

### 3.5 Offline & push
- **Push (matters):** finish APNs key + Firebase sender config (tokens already collected). v1 notification types: watchlist price/status change, new distress deal in followed market, weekly digest deep link. Server side: extend `server/mobilePush.ts` to actually send via APNs/FCM.
- **Offline (mostly doesn't matter):** cache last-viewed saved analyses via a small service worker so the app opens on the subway. Do **not** build offline underwriting or sync conflict resolution.

### 3.6 Reuse & required backend changes
- Reused as-is: entire `client/` app, `shared/` schemas, session auth, `capacitorPush.ts`, Stripe checkout allowlist.
- Backend changes needed: (a) push **sending** (APNs/FCM) in `mobilePush.ts`; (b) watchlist/alert tables + evaluation cron; (c) OAuth deep-link code exchange; (d) longer native session TTL; (e) the same `/api/v1` cleanup MCP needs — mobile gets it for free.

---

## 4. MCP architecture

### 4.1 Shape
- **Keep** `mcp-realist/` (stdio, npm `@realist/mcp`) for Claude Desktop / Cursor / Codex CLI. Build `dist/`, add tests, publish.
- **Add (post-event)** a hosted remote MCP endpoint at `https://mcp.realist.ca/mcp` using **Streamable HTTP** transport mounted on the same Express app, so claude.ai, ChatGPT connectors, and server-side realtor agents can connect without installing anything. Auth: same bearer keys initially; OAuth 2.1 dynamic client registration later for consumer-grade connect flows.
- MCP tools must be **thin wrappers over `/api/v1` (or the same service functions)** — no logic in the MCP layer. Today's `src/client.ts` → `/api/agent/*` pattern is correct; keep it.

### 4.2 Cross-cutting contract (applies to every tool)
- **Auth:** `Authorization: Bearer realist_live_…` (existing `api_keys`), key → user → plan tier.
- **Rate limits (per key, enforced server-side, tier-multiplied):** default free tier below; Pro ×10; Enterprise custom. Return `429` with `retry_after_seconds`.
- **Provenance block on every response:**
```json
"provenance": {
  "sources": [{"name": "CREA DDF", "as_of": "2026-06-30"}, {"name": "Ontario Bill 23", "type": "statute"}],
  "engine_version": "underwriter-2026.06",
  "jurisdiction_support": "full | partial | unsupported",
  "confidence": 0.82,
  "disclaimer": "Estimate for research purposes; not an appraisal, legal, or planning opinion. Verify with the municipality / a licensed professional.",
  "verification_required": true
}
```
- **Failure states (uniform):** `INVALID_INPUT` (Zod), `NOT_FOUND` (address/MLS/analysis), `JURISDICTION_UNSUPPORTED` (feasibility outside coverage — returned honestly, never guessed), `DATA_STALE` (source older than threshold), `RATE_LIMITED`, `PLAN_REQUIRED` (tool above caller's tier), `UPSTREAM_UNAVAILABLE` (DDF/geocoder down).
- **Audit:** every call logged to `api_usage_events` (see §5).

### 4.3 Tool catalog

Existing = already implemented in `mcp-realist/src/index.ts` + `server/agentApi.ts`. New = to build.

| # | Tool | Status | Backend service |
|---|---|---|---|
| 1 | `analyze_property` | **Existing** (`realist_underwrite_listing` / `realist_underwrite_custom` — keep names, alias) | `underwriting.ts` + `creaDdf.ts` |
| 2 | `underwrite_multiplex` | **New** (compose feasibility + underwriting) | `multiplexFeasibility.ts` + `underwriting.ts` + `rentEstimation.ts` |
| 3 | `estimate_rent` | **New endpoint** (engine exists; currently admin-only at `/api/intelligence/estimate-rent`) | `rentIntelligence.ts` |
| 4 | `estimate_sale_value` | **New endpoint** (engine exists) | `salePriceOracle.ts` |
| 5 | `fetch_zoning_summary` | **New** (subset of feasibility output) | `multiplexFeasibility.ts` zone classifier |
| 6 | `fetch_planning_risk_flags` | **New — replaces** `check_tree_ravine_flood_heritage_risks`; returns known flags + explicit unknowns only | feasibility overlays + `landClaimScreener.ts` |
| 7 | `compare_exit_scenarios` | **New** (requires moving `calculateBuyHoldAnalysis`/`calculateStressTest` from `client/src/lib/calculations.ts` into `shared/`) | new `scenarios.ts` |
| 8 | `generate_investor_report` | **New** (server-side HTML/JSON report; PDF via headless Chromium later — puppeteer-core already a dependency) | new `reports.ts` |
| 9 | `search_market_comps` | **Existing-ish** (`realist_find_deals` for sale comps; add rent comps from `rentIngestion` data) | DDF search + rent comps |
| 10 | `save_report` / `get_analysis` / `list_analyses` | **Existing** (`realist_list_my_analyses`, `realist_get_analysis`, community submit) | `savedObjects.ts` |
| 11 | `get_user_saved_properties` | **Existing** (analyses) + **New** (watchlist, shared with mobile Track D) | `savedObjects.ts` |
| 12 | `get_market_report`, `get_mortgage_rates` | **Existing** | as today |

**Note on user_id:** no tool takes `user_id` as input — identity comes from the bearer key. The requested `save_report(user_id, report)` / `get_user_saved_properties(user_id)` signatures would let any key read any user's data. Keys are user-scoped; drop the parameter.

#### Tool specs (new/changed tools)

**`underwrite_multiplex`**
- Input: `{ address: string, assumptions?: { units?: int(1-10), lot_area_sqm?: number, zone_code?: string, heritage_designated?: bool, floodplain?: bool, build_cost_per_unit?: number, rent_overrides?: {unit_type: string, monthly_rent: number}[], down_payment_percent?, interest_rate?, amortization_years? } }`
- Output: `{ feasibility: { max_units_range: [lo, hi], confidence: 0-100, scenarios: [...], risk_flags: [...], sources: [...] }, underwriting: { per_scenario: { capRate, noi, dscr, cashOnCash, monthlyCashFlow, irr } }, rent_basis: { per_unit_estimates, method }, provenance }`
- Services: feasibility engine, rent estimator (per unit type), `calculateInvestmentMetrics` per scenario.
- Auth/limits: Bearer; Pro tier; 30/day free trial quota. Failures: `JURISDICTION_UNSUPPORTED` (outside ON/BC coverage — say so, never extrapolate), `INVALID_INPUT`, `DATA_STALE` (rent comps > 60d → confidence downgrade).
- Example: `underwrite_multiplex({address: "124 Woodycrest Ave, Toronto, ON", assumptions: {lot_area_sqm: 372, zone_code: "RD (f13.5; d0.6)"}})` → 4-unit baseline scenario, cap rate 5.4%, confidence 78, flag: narrow frontage.

**`estimate_rent`**
- Input: `{ address: string, unit_mix: [{bedrooms: 0|1|2|"3+", bathrooms?: number, sqft?: number}] }`
- Output: `{ per_unit: [{unit, monthly_rent_estimate, range: [p25,p75], method: "ddf_comps"|"city_aggregate"|"cmhc_baseline", comp_count, comps_as_of}], total_monthly, provenance }`
- Services: `rentIntelligence.ts` (already logs to `modelPredictions` — keep, it's the eval loop). Limits: 100/day free, 1000/day Pro. Failures: `NOT_FOUND` (geocode fail), method degrades gracefully comps→aggregate→CMHC with confidence stated.

**`estimate_sale_value`**
- Input: `{ address: string, property_type?: string, unit_mix?: [...], condition?: "as_is"|"renovated" }`
- Output: `{ estimate: number, range: [low, high], method, comp_listings: [{mls, price, distance_km, status}], provenance }`
- Services: `salePriceOracle.ts` + providers. Limits: 50/day free. Failures: `NOT_FOUND`, `DATA_STALE`; **never returns a point estimate without a range**.

**`fetch_zoning_summary`**
- Input: `{ address: string }` — Output: `{ zone_code?, zone_category, municipality, province, permitted_residential_units_baseline, aru_rights: {garden_suite, laneway, basement}, source_rules: [{name, citation}], jurisdiction_support, provenance }`
- Honest failure: if zone code can't be resolved from data on hand, return `zone_code: null, jurisdiction_support: "partial"` and require the caller to supply it — do not infer.

**`fetch_planning_risk_flags`** *(renamed from check_tree_ravine_flood_heritage_risks)*
- Input: `{ address: string }` — Output: `{ flags: { heritage: "yes"|"no"|"unknown", floodplain: "...", conservation_authority: "unknown", tree_bylaw: "unknown", indigenous_land_claim: "yes"|"no"|"unknown" }, known_data_sources: [...], unknown_reasons: {...}, provenance }`
- Today only `indigenous_land_claim` (via `landClaimScreener.ts`) and user-declared flags are real; everything else returns `"unknown"` until municipal open-data ingestion lands (post-event roadmap: Toronto heritage register, TRCA regulation limits, city tree bylaws — all have open datasets).

**`compare_exit_scenarios`**
- Input: `{ analysis_id?: string, address?: string, assumptions?: BuyHoldInputs, scenarios?: ["hold_5","hold_10","refi_brrr","flip","sell_year_n"] }`
- Output: `{ scenarios: [{name, irr, equity_at_exit, total_profit, annual_cashflow_curve}], stress: {bear, base, bull}, provenance }`
- Prereq: move `calculateBuyHoldAnalysis`, `calculateStressTest`, amortization paths into `shared/scenarios.ts`; client imports from shared (dedup).

**`generate_investor_report`**
- Input: `{ analysis_id?: string, address?: string, format: "json"|"html"|"pdf", branding?: {...} }`
- Output: `{ report_id, url (signed, expiring), summary, format }`
- v1 = JSON/HTML from a server template (mirror `pdfExport.ts` sections: summary, 10-yr proforma, charts); PDF via puppeteer-core post-event. Writes to a `reports` table so `save_report` semantics come free. Limits: 20/day free, watermarked; Pro unbranded.

### 4.4 MCP hardening backlog (from audit)
1. Build + publish (`npm run build && npm publish --access public`).
2. Server-side per-key rate limiting (blocking prerequisite).
3. Tests for tool schemas + CLI parsing.
4. Key expiry option + scopes column on `api_keys` (`read`, `write`, `underwrite`).
5. Structured content in tool results (already returns JSON — also set MCP `structuredContent` field so agents get typed output).

---

## 5. API layer (`/api/v1`)

### 5.1 Structure
Keep one Express app. Reorganize:

```
server/
  services/            ← NEW: all business logic, no req/res
    underwriting.ts, rentEstimation.ts, saleValue.ts,
    multiplexFeasibility.ts (moved), scenarios.ts (from client),
    reports.ts, marketIntel.ts, savedObjects.ts, usage.ts
  api/v1/              ← NEW: public/partner adapter (bearer auth + metering)
    underwriting.routes.ts, rent.routes.ts, value.routes.ts,
    feasibility.routes.ts, scenarios.routes.ts, reports.routes.ts,
    comps.routes.ts, saved.routes.ts, auth.routes.ts (token exchange)
  agentApi.ts          ← becomes a thin alias of api/v1 (deprecate /api/agent/* slowly; MCP points at /api/v1)
  routes.ts            ← web adapter only (session auth); shrink the 2,734-line monolith by extracting into services over time — do NOT big-bang rewrite
  ingestion/           ← move crons/scrapers here (ddfYieldCrawler, rentIngestion, rateScraper, importUsListings, indigenousDataImporter)
shared/                ← pure math + zod only; RECEIVES scenarios/stress/MLI from client/src/lib
mcp-realist/           ← MCP adapter (stdio) + later streamable-http mount
mobile/                ← Capacitor adapter (unchanged)
```

### 5.2 Separation of the ten concerns
| Concern | Home |
|---|---|
| Core underwriting engine | `shared/` (pure) + `server/services/underwriting.ts`, `scenarios.ts` |
| Data ingestion | `server/ingestion/` (existing crons, relocated) |
| External source connectors | `server/ingestion/connectors/` (`creaDdf.ts`, wowa scraper, BoC Valet, StatCan, SAC-ISC) |
| Report generation | `server/services/reports.ts` (+ existing cityReport/distressReport generators) |
| Auth/permissions | `server/auth.ts` (session) + unified middleware `requireAuth({session\|bearer, scope, tier})` |
| User-saved objects | `server/services/savedObjects.ts` (analyses, watchlists, reports) |
| Billing/usage metering | `server/services/usage.ts` + Stripe metered billing |
| MCP adapter | `mcp-realist/` |
| Mobile adapter | `mobile/` + native-token endpoints in `api/v1/auth.routes.ts` |
| Web UI adapter | `server/routes.ts` + `client/` |

### 5.3 Metering & limits (new, blocking)
- Table `api_usage_events(id, api_key_id, user_id, tool, endpoint, status, latency_ms, input_hash, tokens_or_units, created_at)` — one row per `/api/v1` + MCP call.
- Middleware chain on `/api/v1`: `bearerAuth → planResolver → rateLimiter(per-key, per-tool) → meter → handler`.
- Swap the in-memory IP limiter for `express-rate-limit` (already a dependency) with a Postgres/Redis store; add `helmet()` + explicit CORS to the main server (currently absent — audit finding).
- Billing: map plans → Stripe products (`seedStripeProducts.ts` exists); report monthly usage via Stripe metered subscription items. Free tier hard-stops at quota with `PLAN_REQUIRED`.

### 5.4 Consolidation chores
- Delete `frontend/` (dead second app, 68 files).
- Merge `src/` IDX service into `server/ingestion/` + retire `tsconfig.idx.json`, or formally split it out — but stop maintaining two overlapping Express stacks.
- De-dup `mliConfig.ts` (client copy → import from shared).

---

## 6. Agent-accessible Realist (governance)

**Exposed via MCP/API:** underwriting, scenarios, rent/value estimates, feasibility, zoning summary, risk flags (honest subset), comps/deal search, market reports, mortgage rates, the caller's own saved objects, report generation.

**Internal/admin-only, never exposed:** ingestion triggers & scrapers, admin CRUD (content, leads, deal desk), GHL/webhook/email/SMS infrastructure, other users' data, `modelPredictions` eval internals, seeding scripts, raw DDF passthrough (CREA licensing — expose only derived/aggregated data and cite it; check DDF terms before exposing per-listing fields through the public API).

**Authentication:** user-scoped API keys (existing) now; add scopes + expiry; hosted MCP gets OAuth 2.1 later. Keys inherit the owner's subscription tier.

**Paid access:** free tier (low quotas, watermarked reports, `provenance` always on) → Pro ($/mo, existing professional subscription rails, ×10 quotas, unbranded reports) → Partner/Enterprise (custom, metered Stripe billing). The pull-counter pattern in `storage.upsertProfessionalSubscription()` generalizes into per-tool quotas.

**Create vs read:** agents **can create** analyses, scenarios, reports, watchlist entries (scoped `write`). Community-feed submission stays behind an explicit `community:write` scope (it publishes to other humans — default off). Agents can never mutate account/billing/keys.

**Audit trail:** `api_usage_events` (every call) + `reports` rows (every generated artifact, retained with input snapshot + engine version) + existing `modelPredictions` (estimate accuracy). This gives you per-key forensics and a defensible record of exactly what Realist asserted, when, from which data.

**Preventing unsupported legal/planning claims:**
1. Every response carries the provenance block with `disclaimer` + `verification_required` (agents quote it; you can point to it).
2. Feasibility already returns `confidence`, `jurisdiction_support`, and source citations — make those mandatory response fields, and return `JURISDICTION_UNSUPPORTED` rather than degrading silently.
3. Unknown = `"unknown"`, never a guess (risk-flags tool design above).
4. Tool descriptions in MCP explicitly instruct agents: "advisory estimate; do not present as legal/planning/appraisal advice" — descriptions are the one prompt surface you control in someone else's agent.
5. ToS for API keys: prohibition on removing disclaimers, resale of raw data.

---

## 7. Execution plan (Tracks A–E)

**Dependency spine:** E1 (limits/metering) and B (services + `/api/v1`) unblock everything. C (MCP) is nearly free after B. D (mobile) is store-paperwork-bound — start enrollment immediately, ship features late. A (underwriter) plugs into B's service interfaces.

```
July:   B1–B3 + E1  ──▶  C1 (publish MCP)      D0 (store enrollment, signing) — start NOW
Aug:    A (underwriter v1 behind services) + C2 (new tools) + D1 (My Realist mobile surface, push send)
Sept 1–12: freeze, demo hardening, TestFlight build, seed data for demo markets
Sept 15: EVENT
Q4:     production hardening (OAuth MCP host, PDF reports, metered billing GA, store launches if not already live)
```

### Track A — AI Multiplex Underwriter
- **Order:** consume, don't duplicate — the underwriter orchestrates `services/multiplexFeasibility.ts` + `rentEstimation.ts` + `scenarios.ts` + `saleValue.ts` and adds the AI reasoning/narrative layer (`server/aiDefaults.ts` is the current prompt-defaults home).
- **Inspect:** `server/multiplexFeasibility.ts`, `server/rentIntelligence.ts`, `server/salePriceOracle.ts`, `shared/investmentMetrics.ts`, `server/aiDefaults.ts`, `client/src/pages/WillItPlex.tsx` + `MultiplexFeasibilityPage.tsx` (existing UX).
- **Create:** `server/services/multiplexUnderwriter.ts` (orchestrator), prompt/eval fixtures under `test/underwriter/`.
- **v1:** address in → feasibility + per-scenario underwriting + narrative out, Toronto/GTA only, confidence-gated.
- **Event demo:** live address → full multiplex underwrite in web UI **and via MCP in Claude** (same call — that's the demo money-shot).
- **Post-event:** more municipalities, comp-grounded rent per unit type, accuracy dashboards off `modelPredictions`.
- **Dependencies:** B1–B2.

### Track B — Shared API/service layer *(first, weeks 1–4)*
- **B1:** create `server/services/` and extract: underwriting, rentEstimation (de-admin the endpoint), saleValue, feasibility, savedObjects. Mechanical moves — logic already exists.
- **B2:** move `client/src/lib/calculations.ts` (buy-hold projections, stress test), `mortgage/amortization.ts`, `mliConfig.ts` math into `shared/`; re-point client imports. This is the single highest-leverage refactor in the plan.
- **B3:** mount `/api/v1` with `bearerAuth → planResolver → rateLimiter → meter`; alias `/api/agent/*` onto it.
- **B4 (post-event):** shrink `routes.ts` incrementally; merge `src/` IDX service; delete `frontend/`.
- **Inspect:** `server/agentApi.ts`, `server/routes.ts` (lines 175–240 limiter, 3549+ analyses, 5716+ subscription), `shared/investmentMetrics.ts`, `client/src/lib/*`.
- **v1 = B1–B3.** Event demo needs nothing more. 

### Track C — MCP server
- **C1 (week 2):** rate limits land (E1) → `npm run build`, add smoke tests, publish `@realist/mcp@0.2.0`. Point `client.ts` at `/api/v1`.
- **C2 (Aug):** add tools: `underwrite_multiplex`, `estimate_rent`, `estimate_sale_value`, `fetch_zoning_summary`, `fetch_planning_risk_flags`, `compare_exit_scenarios`, `generate_investor_report` (JSON/HTML). Add `structuredContent`, scopes.
- **C3 (post-event):** hosted Streamable HTTP endpoint `mcp.realist.ca` + OAuth 2.1; directory listings (Anthropic/Cursor MCP registries); usage-based billing.
- **Inspect/create:** `mcp-realist/src/index.ts`, `src/client.ts`, `server/agentApi.ts`; create `mcp-realist/src/tools/*.ts` (split the 8-tool monolith as it grows), `test/`.
- **Event demo:** realtor asks Claude "underwrite 123 Main St as a fourplex" → full report via published MCP package (or hosted endpoint if C3 pulled forward).

### Track D — iOS/Android
- **D0 (this week, calendar-bound):** Apple Developer enrollment ($99), Google Play ($25), generate + vault Android keystore, APNs key, Firebase project. All human steps from `mobile/SHIP-CHECKLIST.md`.
- **D1 (Aug):** "My Realist" mobile surface in `client/` (§3.3), push **sending** in `server/mobilePush.ts`, watchlist + alert cron, OAuth system-browser + deep-link handler, PWA manifest + minimal SW.
- **D2 (by Sept 1):** TestFlight + Play internal track builds; store listings submitted (approval buffer).
- **Event demo:** app on your phone via TestFlight: get a push about a new distress listing → open → quick underwrite → share PDF. Store approval is a bonus, not the plan.
- **Post-event:** public store launch, refresh-token auth, deep links into listings/reports, offline cache of saved analyses.
- **Inspect:** `mobile/capacitor.config.ts`, `mobile/SHIP-CHECKLIST.md`, `client/src/lib/capacitorPush.ts`, `server/mobilePush.ts`, `client/src/components/GetAppBanner.tsx`.

### Track E — Auth, billing, usage limits, saved reports
- **E1 (week 1–2, blocks C1):** `api_usage_events` table + per-key `express-rate-limit`; `helmet()`/CORS on main server; key scopes + optional expiry.
- **E2 (Aug):** plan tiers wired to quotas (`planResolver`), Stripe products for API/Pro tier (`seedStripeProducts.ts`), usage dashboard on `/account/api-keys`.
- **E3 (Aug):** `reports` + `watchlists` tables in `shared/schema.ts` (+ drizzle migration), shared by Tracks A/C/D.
- **Event demo:** signup → mint key → agent calls → usage visibly metered on account page (proves "platform", not "demo").
- **Post-event:** Stripe metered billing, refresh tokens for mobile, OAuth for hosted MCP, anomaly alerts on usage.
- **Inspect:** `server/agentApi.ts:200` (key mgmt), `server/stripeService.ts`, `server/webhookHandlers.ts`, `storage.ts` (professional subscription), `MONETIZATION.md`.

---

## 8. What NOT to do
- No React Native/Expo/native rewrite.
- No microservices, no GraphQL, no API gateway product.
- No offline-first sync engine.
- No `check_tree_ravine_flood_heritage_risks` that answers from data you don't have.
- No second frontend, second Express stack, or second calculation engine — delete/merge the ones you already have.
- No raw DDF data resale through the public API (licensing).
- No big-bang rewrite of `routes.ts` — strangle it service-by-service.
