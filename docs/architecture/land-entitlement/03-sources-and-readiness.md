# Sources and Readiness

## Adapter contract

```ts
type SourceType = "open_data_api" | "application_portal" | "agenda_pdf" | "op_schedule" | "growth_allocation";
interface SourceAdapter {
  id: string; municipalityId: string; type: SourceType; adapterVersion: string;
  access: { method: "http" | "browser" | "file"; url: string; expectedCadence: string };
  license: { status: "clear" | "review" | "restricted"; evidenceUrl?: string };
  fetch(): Promise<{ bytes: Uint8Array; retrievedAt: string; sha256: string }>;
  parse(snapshot: Uint8Array): Promise<CanonicalCandidate[]>;
}
```

Outputs always include raw snapshot, parse result, source URL, retrieval time, SHA-256, adapter version, and field-level source pointers.

## Score rubric (0–2 each; maximum 12)

| Dimension | 0 | 1 | 2 |
|---|---|---|---|
| Machine readability | manual/image | structured HTML/PDF | stable API/download |
| Field completeness | <40% required | 40–79% | >=80% |
| Update cadence | unknown/ad hoc | quarterly | monthly or faster |
| Historical depth | none | current + limited | >=3 years |
| License clarity | restricted/unknown | reviewable | explicit reuse/open |
| Stability | volatile/auth wall | semi-stable | versioned/stable URL |

Adapter go/no-go: total >=7/12 and license clarity >=1. Below threshold remains research-only.

## Provisional source-readiness scorecard

All rows are **assumed — verify in pilot**. No source was live-validated in this architecture run.

| Coverage group | Likely source mix | Readable | Complete | Cadence | History | License | Stable | Total |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Toronto | open data + application search | 2 | 2 | 2 | 2 | 1 | 2 | 11 |
| Peel lower tiers | municipal portals/open data | 1 | 1 | 2 | 1 | 1 | 1 | 7 |
| York lower tiers | portals/open data | 1 | 1 | 2 | 1 | 1 | 1 | 7 |
| Durham lower tiers | portals/agenda records | 1 | 1 | 1 | 1 | 1 | 1 | 6 |
| Halton lower tiers | portals/open data | 1 | 1 | 1 | 1 | 1 | 1 | 6 |
| Hamilton | open data/application search | 2 | 1 | 2 | 1 | 1 | 1 | 8 |

Scores below threshold do not justify an adapter until a specific official source is verified.
