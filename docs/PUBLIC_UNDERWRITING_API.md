# Realist public underwriting

The existing rental and Toronto multiplex engines are available to LLMs without an account, API key, cookies or local installation.

Give a user this starter:

> Underwrite a deal for me using https://realist-lean.vercel.app/api/underwriting/skill.

Give a tester this prompt:

> Test Realist's underwriting and show me the charts using https://realist-lean.vercel.app/api/underwriting/skill.

The instruction document uses saved/conversation context and asks for missing facts one question at a time. A test request runs a labelled sample with no user setup. The LLM still needs an HTTP/web tool capable of fetching parameterized URLs; a text link alone cannot grant tools to a client.

## Public interfaces

| Interface | URL/path |
|---|---|
| Instruction document | `/api/underwriting/skill` |
| GET and POST rental calculator | `/api/underwriting` |
| GET and POST Toronto multiplex screen | `/api/underwriting/multiplex` |
| PNG chart | `/api/underwriting/chart.png` |
| SVG chart | `/api/underwriting/chart.svg` |
| Editable, printable report | `/api/underwriting/report` |
| OpenAPI 3.1 | `/api/underwriting/openapi.json` |
| Stateless Streamable HTTP MCP | `/api/underwriting/mcp` |
| Discovery | `/llms.txt` |

Use the stable origin `https://realist-lean.vercel.app`, which already hosts the public property-evidence API. The legacy `realist.ca` DNS/application is not changed by this work. The origin is defined once in `lib/public-underwriting/service.ts`.

Rental calls require `price` in CAD and `monthlyRent` in CAD/month across all units. The schema lists the optional financing, expenses, hold/exit assumptions and property labels. Percentages use points: `interestRate: 5.5` means 5.5%. Price/rent are never guessed. Optional values come from `houseDefaults`, with each field labelled `caller_supplied` or `model_default`. The engine uses Canadian semi-annual mortgage compounding and measures returns on down payment plus closing costs.

Rental results include the metrics, deterministic memo, six stress scenarios, break-even rent, break-even/1.20-DSCR offer-price thresholds, chart data, and visual links. The offer solver's 5–300% price range and its treatment of price-linked insurance/closing costs are disclosed. A zero-debt DSCR is null. Engine confidence labels describe the model's assumptions; caller input is never independent verification.

Visual links embed normalized inputs and the original default-field markers. They save no member analysis and require no database report ID. Anyone with a link can read its contents. A report can recalculate through a GET form and print from the browser. SVG/HTML interpolate caller strings only after escaping; PNG values are React text and bounded numbers.

## MCP

Connect the URL with authentication set to none. Tools:

- `realist_underwrite_rental`
- `realist_solve_offer`
- `realist_compare_scenarios` (up to five)
- `realist_underwrite_multiplex`

The official MCP SDK provides stateless Streamable HTTP and JSON responses. Each POST gets its own server/transport, so there is no session/cookie affinity. Instructions are also an MCP resource. Standalone SSE GET returns 405; document-oriented GET returns discovery. Origins are validated and public HTTPS clients receive CORS.

## Multiplex and side effects

The public wrapper calls `executeMultiplexUnderwriter` with `persist: false` and `useAiNarrative: false`. It returns the original zoning, development, CMHC/condo takeout and feasibility outputs, plus the existing concept's site-plan SVG and its pre-generated illustration link. The concept is a schematic/similar-lot sample, not a survey or architectural drawing. The engine can refresh shared source caches and ensure its existing geodata tables. It does not create member/community/lead rows or call a paid model.

Toronto only. Supply survey frontage/depth in feet, or lot area in square feet; area-based dimension inference is disclosed by the engine. Existing rule/assumption source dates are preserved and are not made current by the API. No arbitrary assumption object is accepted publicly. Nested MLI commitments use POST/MCP. When dimensions are missing the response asks for them.

## Limits and operations

Existing Postgres `takeToken` counters are atomic and shared across serverless instances. Rental/image/report clients are limited together to 60 calls/minute; site-wide 600/minute. MCP has a separate 60/600 lane; multiplex is shared across HTTP/MCP at 6/60 calls/minute. Documentation/discovery calls do not consume an allowance. Counters fail closed. On HTTP 429, `Retry-After: 60`; no authentication challenge is emitted. JSON bodies are bounded to 32 KB while streaming and query URLs to 8 KB. Unsupported/unknown fields and duplicate query parameters return 400.

No new schema, imports, refresh schedules or paid-model budget are required. Keep the property-enrichment parent branch in the next lean deployment: this branch is stacked on `codex/homies-property-enrichment` (PR 196).

## Security patch and remaining baseline advisories

Next.js and eslint-config-next were patched together from 16.3.3 to 16.3.8 because [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) affects the Node ImageResponse implementation. The new public renderer uses text/fixed styles and no caller SVG, but the dependency is patched as well.

The audit also reports the existing MapLibre 5.x DOM sanitizer advisory ([GHSA-jrc7-96c5-q579](https://github.com/advisories/GHSA-jrc7-96c5-q579)) and existing development-tool advisories. MapLibre is not imported by the new API/report/image code. Its major-version migration and existing map popups remain a separate frontend task; this release does not claim the entire site's dependency audit is clean.

## Verification

Unit coverage checks API/engine equivalence, percentage and cash-invested semantics, all-cash/zero overrides, snapshot/provenance replay, offer targets, GET/POST without credentials, error CORS, malformed inputs, body limits, escaped HTML/SVG, PNG dimensions, fail-closed throttling, no paid narrative, and interoperability with the official MCP client. Hosted verification must additionally exercise rental GET/POST, MCP tools, PNG/SVG/report, the report form and an actual Toronto multiplex site. Keep test and deployment receipts with the release handoff.
