# Canonical Schema

The [schema sketch](schema-sketch.ts) is deliberately unwired and outside `shared/`; it must not generate a migration.

| Table | Purpose |
|---|---|
| `municipalities` | Coverage hierarchy, geography and timezone. |
| `entitlement_sources` | Adapter/source registry and license posture. |
| `source_snapshots` | Immutable raw hash/retrieval audit. |
| `land_sites` | Stable site identity, tier and geometry. |
| `site_identifiers` | Application, roll, address and municipal identifiers. |
| `approval_tracks` | Parallel OPA/ZBA/subdivision/site-plan/etc. streams. |
| `entitlement_events` | Append-only observed stage history. |
| `field_provenance` | Canonical field to raw source pointer. |
| `match_quarantine` | Ambiguous entity-resolution candidates. |
| `refresh_runs` | Per-adapter run status and counts. |
| `model_assumptions` | Effective-dated financial inputs and source links. |

Current entitlement state is a view: latest accepted event per track, then deterministic roll-up. Stages are never overwritten. Corrections append a superseding event with reason and reviewer.

Retention: immutable snapshot metadata indefinitely; raw payload retention subject to license, with cryptographic hash retained even if raw bytes must expire.
