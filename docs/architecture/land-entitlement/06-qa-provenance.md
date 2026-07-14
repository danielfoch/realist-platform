# QA, Confidence and Provenance

## Claim classes

- `verified`: official source snapshot directly supports the field/stage; confidence 0.90–1.00.
- `inferred`: deterministic mapping or roll-up from verified source fields; confidence 0.65–0.89 and the rule is named.
- `unknown`: insufficient/ambiguous evidence; no positive claim and confidence below 0.65.

Record confidence is the minimum of source reliability, parse certainty, entity-match confidence and stage-map confidence. A strong source cannot hide a weak match.

## Publish gates

- Latest adapter run error rate <5%.
- Quarantine rate <10%, unless reviewed sample proves a source-wide benign change.
- Zero unreviewed illegal-transition or mass-change warnings.
- >=90% of verified applications have stage, source URL, retrieved time and snapshot hash.
- Source data age <=45 days.
- Model outputs have assumption-set hash and no missing required assumptions.

If a gate fails, keep the last good public snapshot and show its “as of” date. Do not partially overwrite.

## Review ownership

Clyde reviews quarantined matches, source drift, and run failures using side-by-side raw/canonical evidence. Dan is not needed for routine QA. Dan approves only scope/budget, data-license spend, branded claims and publishing.

Every stage shown in UI/report links to source URL, retrieval date, claim class and track history. Every financial matrix shows model version, effective date, scenario and assumption hash.
