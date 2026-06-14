# Realist Platform Learning Loop

Realist should learn from how investors actually underwrite deals, not from generic product guesses.

## V1 Scope

The first loop is deliberately small:

1. Preserve structured analytics payloads from `/api/events/track`.
2. Generate a weekly report from the existing Fable-built intelligence spine.
3. Generate a Replit-ready handoff prompt only when the report has review-worthy signals.

No auto-merge. No autonomous investment advice. No product changes without review.
No parallel learning database.

## Runbook

```bash
npm run platform-learning:weekly
```

Optional anchor date:

```bash
npm run platform-learning:weekly -- 2026-06-14
```

Outputs:

- `reports/platform-learning/YYYY-MM-DD.md`
- `reports/platform-learning/YYYY-MM-DD-replit-handoff.md`

## Weekly Loop

Inputs:

- `user_activity_events`: canonical product behavior, search, listing, underwriting, save/export, partner demand
- `property_analyses`: canonical underwriting records, AI assumptions, final assumptions, user notes
- `underwriting_assumptions`: default vs user-edited underwriting inputs
- `ai_market_defaults`: trained market/strategy/metric priors
- `ai_training_runs`: learning coverage over time
- `model_predictions`: model version, prediction inputs, resolved outcomes, error metrics
- `user_events`: legacy/API telemetry still used by existing routes and intent scoring
- `deal_analyses`: legacy deal analysis records still used by Deal Desk routes
- `git log`: product changes shipped during the same window

Outputs:

- product insight report
- data-quality report
- conversion/friction signals
- Replit handoff prompt for frontend/workflow PRs

## Guardrails

- The loop proposes work; it does not auto-merge.
- If no events are captured, the report blocks product PR recommendations.
- New product instrumentation should write to `user_activity_events` unless it is supporting the existing legacy `/api/events/track` path.
- Learned defaults must come from `ai_market_defaults`; do not create a second defaults table.
- Model accuracy must come from `model_predictions`; do not create a second prediction ledger.
- Telegram and calendar delivery should run from Clyde/OpenClaw scheduler context, not from the web app runtime.
- Investment math must stay deterministic and auditable.
- PII should stay out of generated reports unless there is a specific operational need.

## Upgrade Path

1. Run the existing AI defaults trainer before report generation in the scheduler environment.
2. Add GitHub PR API ingestion with a repo-scoped token.
3. Add Telegram summary delivery to Dan when report-worthy signals exist.
4. Add calendar invite generation for review meetings.
5. Expand outcome labels through existing activity/event tables: call booked, offer submitted, closed, lost reason.
