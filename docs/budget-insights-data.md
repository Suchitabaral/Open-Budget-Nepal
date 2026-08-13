# Budget Insights data pipeline

Budget Insights uses canonical `FiscalFact` rows rather than frontend fixtures. Every amount retains its source, page, original value/unit, fiscal year, fact type, coverage status, government level, and source row identity.

## Source inventory

| Input | Contents | Fiscal year and unit | Import decision |
| --- | --- | --- | --- |
| `budget_document/oagn/**/source-book_kzajtb9_*.csv` | Sources for foreign-assisted projects: GoN counterpart, grant, loan, and financing-total columns | 2025/26 (2082/83 B.S.); `Rs. in '00000` (`LAKH_NPR`), verified from page 9 | Federal and uniquely identified province rows import as `BUDGET` + `PARTIAL`. This is not a complete budget. |
| `budget_document/oagn/Local/source-book_*.csv` | Municipality-level foreign-assisted financing rows | 2082/83 B.S.; `LAKH_NPR` | Imported only when normalized exact names resolve uniquely to the 753-code registry. Typos and duplicate names stay unmatched until a verified override is added. |
| `budget_document/all-municipality.pdf` | Administrative code/name reference for Nepal local units | Not fiscal data | Geography reference only; canonical JSON/database geography remains authoritative. |
| `parsed_documents/v3/oagn/**` | One annual and seven provincial OCR-parsed OAGN audit reports | Intended FY 2081/82; extracted metadata contains contradictory years; mixed units | Inventoried only. Audit prose and unreviewed OCR tables are not automatically imported as budget facts. |
| `contract_records_*.csv`, `processing_report*.csv`, `OAGN_Processed/*` | Procurement records or extraction diagnostics | Mixed | Excluded from fiscal ingestion. |

The importer validates the Source Book's 12-column layout, converts lakh to raw NPR with integer arithmetic, records rejected rows and reasons, and writes a deterministic report under `backend/prisma/fiscal-import/reports/`.

## Model and safeguards

- `FiscalClassification`: reusable five-level hierarchy.
- `FiscalDataSource`: provenance and explicit coverage.
- `FiscalImportBatch`: input hash, version, counts, status, and report.
- `FiscalFact`: one amount per source row, classification, and fact type.

Database constraints enforce valid geography. Missing amounts remain `NULL`. Stable source row keys and an import hash make imports idempotent. Parent totals and child components remain distinct classifications; consumers must not sum both into a new total.

## Run the import

From `backend/`:

```bash
npm run db:import:fiscal:dry-run
npm run prisma:migrate -- --name add_canonical_fiscal_facts
npm run db:import:fiscal
```

Review the dry-run report first. Local rows resolve by canonical code, a normalized exact unique name, or a human-verified entry in `prisma/fiscal-import/local-level-overrides.json`. Ambiguous names remain unmatched, and the report never claims 753-level coverage unless all 753 map uniquely.

## API

The UI uses `GET /api/budget-insights`. The public endpoints share the same aggregation service:

- `GET /api/v1/budgets/overview`
- `GET /api/v1/budgets/federal`
- `GET /api/v1/budgets/provinces`
- `GET /api/v1/budgets/provinces/:provinceId`
- `GET /api/v1/budgets/local-levels/:localLevelId`
- `GET /api/v1/budgets/classifications`

Use `?fiscalYear=2082/83&factType=BUDGET`. Missing years return null or empty data and are never interpolated or replaced with zero.
