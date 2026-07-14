# Entitlement Taxonomy

## Canonical stages and evidence

| Stage | Definition / minimum evidence |
|---|---|
| `unknown` | Source exists but status cannot be mapped. |
| `pre_application` | Official pre-consultation or pre-application record. |
| `application_submitted` | Application number or official receipt/submission listing. |
| `deemed_complete` | Municipality explicitly declares complete. |
| `under_review` | Active circulation/review/public meeting evidence. |
| `recommendation_or_appeal` | Staff recommendation, tribunal/appeal, or decision pending. |
| `approved` | Council/delegated/tribunal approval record. |
| `conditions_or_agreements` | Conditions, subdivision/site-plan agreement or clearance work remains. |
| `permits_or_site_works` | Building permit/site servicing/site works evidence. |
| `under_construction` | Official construction-start/inspection evidence. |
| `completed` | Occupancy/completion/assumption evidence. |
| `withdrawn` | Official withdrawal. |
| `refused` | Official refusal. |
| `expired` | Approval/application expired or lapsed. |

## Tracks

Each site has independent tracks: `official_plan_amendment`, `zoning_bylaw_amendment`, `subdivision`, `site_plan`, `minor_variance`, `consent`, `building_permit`, or `other`. Never collapse an approved rezoning and pending site plan into one stored status.

Site roll-up is derived: exclude terminal tracks (`withdrawn`, `refused`, `expired`) if another live track exists; among live tracks return the least-advanced binding prerequisite for construction. If prerequisites are unknown, return `unknown`. Once any building-permit track reaches `under_construction` or `completed`, that stage controls. This deterministic rule is implemented in fixtures.

## Allowed transitions

```text
unknown -> any non-terminal stage
pre_application -> application_submitted | withdrawn
application_submitted -> deemed_complete | under_review | withdrawn | refused
deemed_complete -> under_review | withdrawn | refused
under_review -> recommendation_or_appeal | approved | withdrawn | refused
recommendation_or_appeal -> approved | under_review | refused | withdrawn
approved -> conditions_or_agreements | permits_or_site_works | expired
conditions_or_agreements -> permits_or_site_works | expired
permits_or_site_works -> under_construction | expired
under_construction -> completed
```

Terminal stages do not transition without an explicit reopening/new-track event. Illegal jumps are warnings, not silently accepted state.

## Provisional municipal vocabulary mappings

These mappings are design assumptions to verify against official portals in the pilot.

| Coverage | Source term example | Canonical | Status |
|---|---|---|---|
| Toronto | Application Received | `application_submitted` | inferred |
| Toronto | Under Review | `under_review` | inferred |
| Toronto | Approved / Closed | `approved` or terminal after document review | inferred |
| Mississauga | In Process | `under_review` | inferred |
| Mississauga | Approved | `approved` | inferred |
| Vaughan | Active | `under_review` | inferred |
| Vaughan | Approved | `approved` | inferred |
| Hamilton | Submitted | `application_submitted` | inferred |
| Hamilton | Decision Made | `approved`/`refused` after decision document | inferred |

No generic “closed” or “decision made” status may map automatically without the decision outcome.
