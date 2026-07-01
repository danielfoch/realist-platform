# ⚠️ DEPRECATED — do not build new features here

This `frontend/` directory is a **legacy secondary app**. The live realist.ca
application is `client/` (Vite + wouter + shadcn), served by `server/index.ts`.

Notably, the "6ixplex" pages in here (`SixixplexPage`, `SixixplexReportPage`,
`SixixplexListingsPage`) are a **mock funnel**: hardcoded street matching and
localStorage state, with no connection to the real zoning engine.

The real multiplex stack lives at:

- `server/multiplexFeasibility.ts` — deterministic zoning/feasibility engine
  (`POST /api/multiplex-feasibility`)
- `client/src/pages/MultiplexFeasibilityPage.tsx` — live UI at
  `/tools/multiplex-feasibility`
- `shared/multiplex*.ts` — pure underwriting engines (envelope, configs,
  pro forma, MLI Select)

See `~/portfolio-os/20-realist/MULTIPLEX-UNDERWRITER-PLAN.md` for the AI
Multiplex Underwriter build plan. All new multiplex work belongs in `client/`,
`server/`, and `shared/`.
