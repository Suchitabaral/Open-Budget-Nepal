# Contractor directory source audit

## Imported source

`shared/data/contractor/contract_details.csv` is the authoritative input for the directory. The idempotent importer is `backend/prisma/import-contractors.js` and tags imported rows as `PPMO contract_details.csv`.

Imported on 2026-08-12:

- 1,542 unique contracts
- 2,009 contractor-to-contract links
- 1,068 contractor identities after PAN-based consolidation
- 1,056 distinct populated PAN values
- 14 contract-party links without PAN
- 347 joint-venture contracts

The other supplied files (`main.csv`, `nepal_full.jsonl`, `parties.csv`, and `tender_criteria.csv`) describe OCDS tender releases, buyers, and tender criteria. They do not add awarded-contractor legal or registration fields, so they are not duplicated into the contractor directory tables. They remain appropriate inputs for a later procurement/tender feature.

## Available fields

The imported source supports contractor name, PAN/VAT, country, contract history, awarded value, procurement category and method, contract status, fiscal year, public entity, JV name, JV partners, ownership share, project description, delivery/performance fields, and source provenance.

## Missing or incomplete fields

- Company registration number, registration date, legal status, and authoritative registered address are not present.
- Contract address is a delivery/project location and must not be treated as the contractor's registered address.
- Beneficial-owner data appears on only 12 of 1,542 contract rows and is therefore explicitly labelled incomplete.
- PAN values are source identifiers, not independently verified tax-registration status.
- Some source country selections are invalid placeholder or implausible values; placeholders are normalized to null, while non-placeholder source values remain attributable to the source.

## Authoritative enrichment sources

- Office of Company Registrar public company register: https://company.ocr.gov.np/company-register — search by registration number or PAN for legal name, company type/status, address, registration date, and registration expiry.
- Inland Revenue Department PAN search: https://ird.gov.np/public/branch/mlto/list/pan-search — verify taxpayer/PAN information.
- Public Procurement Monitoring Office: https://ppmo.gov.np/ — procurement records, bidder information, and blacklist/public-procurement status.

Enrichment should be stored as a separately attributed source record with retrieval date. Do not overwrite the raw PPMO values or automate CAPTCHA-protected registry extraction without permission from the source owner.
