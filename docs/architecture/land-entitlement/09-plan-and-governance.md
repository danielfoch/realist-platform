# Plan, Costs, Risks and Governance

## Priority and collision check

This is a **this-week compounding product**, not P1 today. It must not interfere with security/build incidents, family/calendar commitments, or Toronto event execution. Clyde handles research, adapters, QA and jobs; Dan approves budget/scope, vendor spend and public claims.

## Phases

| Phase | Entry | Exit | Effort / gate |
|---|---|---|---|
| 0 Architecture | Dan request | Package validates and Fable approves | complete in this run; docs only |
| 1 Source pilot | package approved | 2 official sources live-verified; license reviewed; 100-record sample; 1 Toronto + 1 lower-tier adapter; <1% false merges | 2–3 weeks; no public claims |
| 2 Wave 1 inventory | pilot passes | 6 coverage groups; >=90% provenance; monthly rerun idempotent; monitoring and UI live | 6–10 weeks; approve hosting/data costs |
| 3 Toronto matrices | current inputs verified | >=5×5 matrices; 100% assumption coverage; independent arithmetic review; report QA | 3–5 weeks; Dan approves branded publication |
| 4 Wave 2 | Wave 1 stable for 3 runs | each new adapter score >=7/12; error <5%; data age <=45 days | per-source; approve any paid license |

Illustrative planning ranges as of 2026-07-14: rough incremental operating-cost target for a public/open-data MVP is <$300/month excluding engineering labour; phase effort ranges are directional, not commitments. Any paid parcel/planning data triggers a separate buy-vs-build case.

## Kill/defer and revisit triggers

- Province-wide parcel coverage: revisit after wave 1 has three clean monthly runs and demand evidence.
- AI-only classification: revisit only after >=1,000 human-labelled records and precision/recall >=95% on critical stages.
- Real-time refresh: revisit if customers demonstrate decisions harmed by monthly latency.
- Paid data: revisit if two high-value coverage gaps fail readiness threshold and paying customers justify cost.

## Risk register

| Risk | L/I | Mitigation |
|---|---|---|
| Source format drift | H/H | snapshot, schema drift tests, adapter versioning |
| ToS/license limits | M/H | license score and legal review before publish |
| False site merge | M/H | deterministic keys, high threshold, quarantine, samples |
| Duplicate fragmentation | H/M | identifier graph and periodic merge review |
| PDF-only sources | H/M | OCR/manual review; do not overclaim coverage |
| MLI rule changes | M/H | effective-dated rules; verify before publish |
| Fee/DC/tax error | M/H | sourced registry and professional review |
| Cron silent failure | M/H | audit rows, freshness SLO, failure alerts |
| Municipal hierarchy confusion | H/M | lower-tier adapters with region roll-ups |
| Scope creep | H/H | phase gates and explicit non-goals |
| Public misinterpretation | M/H | claim classes, disclaimers, separate policy/economics |

No production schema, migrations, routes, cron or UI were implemented here.
