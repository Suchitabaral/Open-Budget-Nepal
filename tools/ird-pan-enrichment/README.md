# IRD PAN enrichment — manual-response workflow

This isolated tool normalizes IRD PAN Search results that a person retrieves through IRD's normal web interface. It makes **no network requests** and does not automate, solve, replay, or bypass reCAPTCHA.

Raw procurement files remain unchanged. Database SQL is generated only for rows a reviewer explicitly approves, and the tool never executes that SQL.

## Requirements

- Node.js 20 or newer
- A supplied CSV containing only known procurement-contractor PANs
- Manual access to https://ird.gov.np/pan-search/

PANs are always treated as strings and must contain exactly nine digits.

## Directory layout

```text
input/contractors.csv          private working input (gitignored)
input/responses/<PAN>.json     manually saved IRD responses (gitignored)
cache/progress.json            parsed checkpoint/cache (gitignored)
output/query_queue.csv         validated manual work queue
output/contractors_ird_enriched.csv
output/contractors_ird_enriched.json
output/contractors_ird_review.csv
output/approved_contractor_updates.sql
logs/collector.jsonl           structured local audit log
```

## Step 1: create the input

For the malformed contractor names already present in the supplied PPMO data, generate the private worklist automatically:

```bash
cd tools/ird-pan-enrichment
npm run extract:ppmo
```

The extractor reads `shared/data/contractor/contract_details.csv`, keeps only already-supplied valid nine-digit PANs whose names are clearly unusable, deduplicates them by PAN, and writes `input/contractors.csv`. It never generates or guesses a PAN.

Alternatively, create a custom list:

Copy the example and replace it with known contractor records:

```bash
cd tools/ird-pan-enrichment
cp input/contractors.example.csv input/contractors.csv
```

Required headers:

```csv
contractor_name,pan
ABC Construction,123456789
```

Do not generate PAN ranges or add unknown identifiers.

## Step 2: validate and prepare the queue

```bash
npm run prepare
```

Open `output/query_queue.csv`. Search only rows marked `READY`. `INVALID_INPUT` and repeated `DUPLICATE` rows must not be submitted.

## Step 3: manually retrieve a result

For each `READY` row:

1. Open its `manual_search_url` in a normal browser.
2. Use IRD's page normally and allow its reCAPTCHA interaction to complete.
3. Open browser Developer Tools → **Network**.
4. Select the request named `getPanSearch`.
5. Open the **Response** tab.
6. Copy only the JSON response body. Do not copy request headers, cookies, CSRF values, CAPTCHA tokens, or a HAR file.
7. Save it as `input/responses/<PAN>.json`, for example `input/responses/123456789.json`.

An optional local timestamp can be added without changing the IRD payload:

```json
{
  "_meta": { "queried_at": "2026-08-12T12:00:00+05:45" },
  "data": {
    "panDetails": [],
    "panRegistrationDetail": [],
    "businessDetail": []
  }
}
```

If `_meta.queried_at` is absent, the response file's modification time is used.

Stop manual work if IRD blocks requests, presents an unusual challenge, reports throttling, or asks you to pause. The site's robots file specifies a 10-second crawl delay; even for manual work, do not submit searches rapidly.

## Step 4: parse and checkpoint

```bash
npm run ingest
```

This command is deterministic for the same input and saved response files. It:

- validates PANs again;
- checks that the response PAN matches the expected PAN;
- extracts only fields visibly used by IRD's public result page;
- flags personal PANs and name mismatches;
- caches progress for interruption/resume;
- writes CSV, JSON, review output, and structured logs.

Possible statuses are `FOUND`, `NOT_FOUND`, `INVALID_INPUT`, `REQUEST_FAILED`, and `SKIPPED`.

## Step 5: review

Open `output/contractors_ird_review.csv` and inspect every row. In `review_action`, enter exactly:

```text
APPROVE_BUSINESS
```

only when all of these are true:

- the PAN matches the known procurement contractor;
- the result represents a business, not an unrelated personal taxpayer;
- the IRD taxpayer/trade name is appropriate for the contractor profile;
- the address and status are credible as IRD-attributed fields.

Leave all questionable rows blank. Never approve `PERSONAL_TAXPAYER_REVIEW`, `NAME_MISMATCH_REVIEW`, or PAN-mismatch rows without independent verification.

## Step 6: generate reviewed SQL

```bash
npm run sql
```

This creates `output/approved_contractor_updates.sql`. It updates only contractors whose PAN matches and whose `source_dataset` is `PPMO contract_details.csv`. The SQL is not executed.

Review the SQL and back up the database before applying it manually. Keep the enriched CSV/JSON as the IRD-attributed data source; do not modify the original PPMO CSV files.

## Tests

```bash
npm test
```

Tests use synthetic fixtures and never contact IRD.

## Public fields retained

- PAN
- English and Nepali taxpayer/trade names
- English and Nepali business names
- account/taxpayer types
- registration/account statuses
- tax office
- public business address components
- effective/account registration date
- VAT account status
- query timestamp, source URL, status, and review decision

Tax-clearance details are intentionally not retained because they are not required to repair contractor identity records.
