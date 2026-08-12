# Fiscal-year project registry

`fy2081-82-projects.json` contains 20 contract-package records representing 16 named projects for fiscal year 2081/82. The dataset is imported into `public.contracts` with `source_dataset = 'FY2081/82 curated project registry'`.

## Interpretation

- A row represents a project package or contractor association, not necessarily an entire project.
- Repeated project names with different packages or contractors are intentionally preserved.
- `verification_status` describes the supplied contractor/project association and is retained on both the contract source metadata and contractor link.
- Missing financial, schedule, completion, and municipality values remain `NULL`. They must not be converted to zero or inferred.
- The nested `watchdog` object is not imported as an assessment. Watchdog findings are recalculated from normalized database fields when all required inputs exist.

## Coverage limitation

This file is a curated list, not evidence of a complete census of all Nepal government projects in FY 2081/82. Completeness can only be claimed after reconciling the registry against an authoritative source with a known total and stable project/package identifiers.
