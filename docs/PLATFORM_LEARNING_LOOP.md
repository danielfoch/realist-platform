# Realist Platform Learning Loop

Realist should learn from how investors actually underwrite deals, not from generic product guesses.

## V1 Scope

The first loop is deliberately small:

1. Preserve structured analytics payloads from `/api/events/track`.
2. Generate a weekly report from user events, deal analyses, underwriting assumptions, and recent commits.
3. Generate a Replit-ready handoff prompt only when the report has review-worthy signals.

No auto-merge. No autonomous investment advice. No product changes without review.

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

- `user_events`: product behavior, search, listing, underwriting, save/export, partner demand
- `deal_analyses`: city, province, property type, score, verdict
- `underwriting_assumptions`: default vs user-edited underwriting inputs
- `git log`: product changes shipped during the same window

Outputs:

- product insight report
- data-quality report
- conversion/friction signals
- Replit handoff prompt for frontend/workflow PRs

## Guardrails

- The loop proposes work; it does not auto-merge.
- If no events are captured, the report blocks product PR recommendations.
- Telegram and calendar delivery should run from Clyde/OpenClaw scheduler context, not from the web app runtime.
- Investment math must stay deterministic and auditable.
- PII should stay out of generated reports unless there is a specific operational need.

## Upgrade Path

1. Add GitHub PR API ingestion with a repo-scoped token.
2. Add Telegram summary delivery to Dan when report-worthy signals exist.
3. Add calendar invite generation for review meetings.
4. Add outcome labels: call booked, offer submitted, closed, lost reason.
5. Add investor preference profiles from repeated underwriting edits.
