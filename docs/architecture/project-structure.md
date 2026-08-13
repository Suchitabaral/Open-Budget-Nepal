# Project structure

## Frontend

```text
frontend/src/
  components/                 shared UI, charts, and application shell
  features/
    budget-insights/
      api/                    HTTP boundary and response contracts
      components/             feature-only UI
      config/                 stable filter taxonomy JSON
      data/                   mock fixtures and registry adapter
      model/                  typed taxonomy selectors
      pages/                  route components
    open-budget-map/
    public-records/
    watchdog/
    assistant/
    economic-indicators/
    platform/
    legacy-budget/            retained routes pending removal/migration
  lib/                        feature-independent helpers only
```

Features may import shared components. Shared code must not import feature code. Pages are loaded directly from their feature directories so route bundles remain isolated.

## Backend

```text
backend/src/
  app.ts                      Express composition and middleware
  server.ts                   process startup and shutdown only
  features/
    contractors/             contractor directory HTTP API
    public-api/              versioned read-only public API
    watchdog/                deterministic risk evaluation API
  infrastructure/
    database/                 Prisma client
    openapi/                  API documentation
  shared/                     cross-feature HTTP utilities
  routes/                     legacy budget/data route aggregator
```

New domains belong in `features/<domain>/`. Remaining budget/data routes should move
from the legacy aggregator as their fact-table contracts stabilize; avoid temporary
service abstractions around incomplete schemas.

## Shared data

```text
shared/
  data/administrative/        generated canonical registries
  schemas/                    JSON Schema contracts
scripts/data/                 reproducible import/generation scripts
```

Large dynamic facts belong in PostgreSQL, not JSON. JSON is appropriate for versioned taxonomies, schemas, mock fixtures, and administrative reference snapshots used during seeding or offline map preparation.
