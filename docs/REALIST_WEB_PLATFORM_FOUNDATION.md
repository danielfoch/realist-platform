# Realist Web Platform Foundation

Planning source: `danielfoch/realist-suitecrm-crm`, branch `realist-openclaw-agent-scaffold`, commit `2a1817eef`.

## Current Stack

- Frontend: React + TypeScript, Vite, Wouter routes in `client/src/App.tsx`.
- Backend: Express API in `server/routes.ts`, session auth, Drizzle/Postgres models in `shared/schema.ts`.
- Auth/account model: `users` table in `shared/models/auth.ts`; authenticated saved deals use `users.id`.
- Existing state: saved deals are backend-backed via `/api/saved-deals` and `/api/user/saved-deals`; saved searches/listings currently use local discovery signals with `/api/user/discovery-signals/sync` to attach to accounts.
- Build commands: `npm run check` for TypeScript, `npm run build` for production build, `npm run dev` for Replit dev server.

## Slice Added

- Homepage AI Deal Radar uses mock market signals and emits normalized web events.
- Deal analyzer now shows a small flywheel: apply current assumptions to similar mock deals, preserving financing/vacancy/expense assumptions while changing target price and rent.
- `shared/plexDetection.ts` provides the possible-plex heuristic with estimated unit count, confidence, reason, legal-status flag, and manual-review flag.
- Inspection request placeholder captures a default CAD $500 request in `inspection_requests`; no checkout, payment capture, or inspector dispatch is automated.
- `trackRealistEvent(eventType, payload)` wraps web events with `event_id`, `event_type`, `occurred_at`, `platform=web`, `session_id`, and optional `idempotency_key`.

## Shared-State Notes

The product direction is backend/account-backed state across web, iOS, and Android. In this slice:

- Saved deals remain backend-backed for authenticated users.
- Saved searches still use discovery-signal sync as the bridge; next step is a first-class `saved_searches` table/API.
- Inspection requests are backend-backed immediately and tie to `users.id` when authenticated, otherwise `session_id`.
- Calculator scenario versioning is UI-stubbed only; next step is a `calculator_scenarios` table that references a source scenario when assumptions are cloned.

## TODOs

- Replace mock radar/similar-deal data with live listings, rent estimates, market metrics, and user preference profiles.
- Add first-class saved-search and calculator-scenario tables with version history.
- Add Stripe checkout/payment authorization for inspection requests before fulfillment.
- Add contractor/certified inspector account type, onboarding schema, verification status, and assignment workflow.
- Send normalized events to the Realist Agent API / SuiteCRM action layer once that endpoint is ready.
