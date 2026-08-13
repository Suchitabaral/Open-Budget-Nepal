# Open Budget Nepal Public API

The public API provides read-only access to datasets currently stored by Open Budget Nepal. Its base path is `/api/v1`; it requires no login or API key.

## Usage contract

- **Versioning:** breaking changes require a new path such as `/api/v2`.
- **Rate limit:** 120 requests per minute per client IP. Responses include `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset`; a rejected request also includes `Retry-After`.
- **Pagination:** collection endpoints default to `page=1&limit=25`; the maximum limit is 100.
- **Filtering:** filters are endpoint-specific and applied in PostgreSQL through Prisma.
- **Sorting:** only the `sort` values documented for each endpoint are accepted.
- **Errors:** `{ "error": { "code": "INVALID_QUERY", "message": "...", "details": [] } }`.
- **Missing data:** `null` means unavailable; numeric zero means a known zero.
- **Money:** amounts are raw decimal strings with currency `NPR`, avoiding JavaScript precision loss.
- **Sources:** `sources` identifies the originating dataset when that metadata exists. An empty array means provenance is not yet recorded at row level.

## Endpoints

System and metadata: `/health`, `/meta/fiscal-years`, `/meta/provinces`, `/meta/districts`, `/meta/municipalities`, `/meta/procurement-categories`.

Data resources: `/budgets`, `/projects`, `/contractors`, `/contracts`, `/procurements`, and `/watchdog/findings`. Detail endpoints append `/:id`; contractor contract history is `/contractors/:id/contracts`.

For exact parameters and response fields while the backend is running, use the
[OpenAPI document](http://localhost:3001/api/openapi.json) or
[interactive documentation](http://localhost:3001/api/docs).

## Examples

```bash
curl "http://localhost:3001/api/v1/projects?fiscalYear=2081%2F82&page=1&limit=10&sort=name_asc"
curl "http://localhost:3001/api/v1/contractors?q=construction&limit=25"
curl "http://localhost:3001/api/v1/contracts?procurementCategory=Works&sort=amount_desc"
curl "http://localhost:3001/api/v1/watchdog/findings?severity=High&limit=25"
```

The procurement resource currently represents procurement-classified awarded contract records. The database does not yet contain a separate normalized tender/notices model. Budget listing currently exposes normalized federal summary rows; detailed provincial/local classifications remain available to the application but are not yet normalized into this public resource.
