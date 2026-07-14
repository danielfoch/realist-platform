# GGH Land Entitlement Inventory + Toronto Multiplex Matrix

Architecture package for two Realist products. This is a design and validation artifact, not a production ingestion claim.

## Reading order

1. [Platform constraints](00-platform-constraints.md)
2. [Product specification](01-product-spec.md)
3. [Entitlement taxonomy](02-entitlement-taxonomy.md)
4. [Sources and readiness](03-sources-and-readiness.md)
5. [Canonical schema](04-schema.md)
6. [Monthly pipeline](05-pipeline.md)
7. [QA and provenance](06-qa-provenance.md)
8. [Toronto financial model](07-financial-model.md)
9. [API, UI, report and matrix outputs](08-outputs-spec.md)
10. [Phased plan and governance](09-plan-and-governance.md)
11. [Independent review checklist](10-review-checklist.md)

Supporting artifacts: [schema sketch](schema-sketch.ts), [synthetic fixtures](fixtures/fixture-data.ts), and [offline validator](fixtures/validate.ts).

## Decisions assumed for this package

- Wave 1 uses region-named coverage but implements lower-tier municipal adapters. Initial pilot: Toronto plus one lower-tier municipality.
- The Toronto matrix is internal-first. Public publishing requires current CMHC/lender, municipal fee, and market-input verification plus Dan's approval.
- Priority is this-week strategic work. It does not displace live P1 security, build, family, or event work.
