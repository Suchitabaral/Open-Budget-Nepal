# Budget Insights data contract

## Where filter data lives

Stable accounting metadata is versioned in `frontend/src/config/budget-insight-filters.json`. It contains canonical IDs, user-facing labels, allowed filters per government scope, and parent-child taxonomy relationships. IDs—not labels—are sent to the API, so labels can be translated or edited without changing database queries.

Dynamic dimensions remain in PostgreSQL. Fiscal years represented by imported facts, provinces, municipalities, and other entities can change and may contain hundreds of records, so the frontend requests them from `GET /api/budget-insights/metadata`. Municipality names must not be maintained manually in the frontend JSON.

Fiscal values remain in normalized PostgreSQL tables managed by Prisma. The frontend configuration never stores chart values.

## Query flow

1. A user opens Federal, Provincial, or Local insights.
2. The frontend loads dynamic metadata once for province and municipality selectors.
3. Selecting a parent classification resets invalid child selections.
4. After a short debounce, the frontend serializes filter IDs with `URLSearchParams` and requests `GET /api/budget-insights`.
5. An `AbortController` cancels an older request if another filter changes.
6. Express validates the government scope, constructs Prisma `where` clauses, aggregates matching facts, and returns chart-ready series.
7. The frontend renders loading skeletons, returned data, an empty state, or an API error state.

Example:

```text
GET /api/budget-insights?scope=provincial&fiscalYear=2081%2F82&type=actual&indicator=npr_million&province=Koshi&component=grants&subcomponent=intergovernmental_transfer
```

## Response

```json
{
  "scope": "provincial",
  "unit": "npr_million",
  "components": [{ "name": "Grants", "value": 111600 }],
  "subcomponents": [],
  "subSubcomponents": [],
  "trend": [{ "fiscalYear": "2081/82", "budget": null, "actual": 124000 }]
}
```

The current database has national budget/actual rows and aggregate subnational actuals. Unsupported classification depths return empty arrays instead of synthetic values. When granular revenue facts are imported, the endpoint can aggregate those records without changing the frontend filter schema or response shape.
