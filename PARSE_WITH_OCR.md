# Docling PDF Parser Guide

This guide documents [`scripts/parse_pdfs_docling.py`](scripts/parse_pdfs_docling.py),
which converts Nepal government PDFs into document packages for inspection,
indexing, and downstream search.

The parser uses:

- Docling for document layout, reading order, headings, pictures, and table candidates.
- Tesseract OCR for Nepali and English text recognition.
- OpenCV plus Tesseract TSV for reconstructing bordered table grids.
- Configurable cleanup and quality checks for OCR output.

The current parser version is `1.3`.

## Prerequisites

Run commands from the repository root.

### Python environment

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

### Tesseract

Tesseract must be installed as a system executable. Its Nepali and English
language data must also be available.

```bash
tesseract --version
tesseract --list-langs
```

The language list should include at least:

```text
eng
nep
osd
```

The parser searches common `tessdata` locations automatically. Set an explicit
location when automatic detection does not work:

```bash
export TESSDATA_PREFIX=/usr/share/tessdata
```

Alternatively, pass it to the parser:

```bash
--tessdata-prefix /usr/share/tessdata
```

Environment variables can also be placed in a repository-root `.env` file.

## Quick Start

Parse one specific PDF:

```bash
python scripts/parse_pdfs_docling.py \
  --input-dir data/oagn/pdfs \
  --output-dir parsed_documents/v4/oagn \
  --pattern pakhara-mahanagarapalka-31672874.pdf \
  --limit 1
```

The defaults are suitable for the OAGN PDFs in this repository:

- Full-page OCR is enabled.
- OCR languages are `nep+eng`.
- The quieter Tesseract CLI backend is used.
- Devanagari-preferred cleanup is enabled.
- Sparse-page OCR fallback is enabled.
- Bordered-table grid reconstruction is enabled.
- Page images, quality reports, and progress bars are enabled.

## Testing Before a Full Parse

OCR and table reconstruction are expensive. Test a few pages first.

Parse the first five pages:

```bash
python scripts/parse_pdfs_docling.py \
  --input-dir data/oagn/pdfs \
  --output-dir parsed_documents/test \
  --pattern pakhara-mahanagarapalka-31672874.pdf \
  --max-num-pages 5 \
  --overwrite
```

Parse a specific inclusive page range:

```bash
python scripts/parse_pdfs_docling.py \
  --input-dir data/oagn/pdfs \
  --output-dir parsed_documents/test \
  --pattern pakhara-mahanagarapalka-31672874.pdf \
  --page-range 28-28 \
  --document-id pokhara-page-28 \
  --overwrite
```

`--max-num-pages 5` parses pages 1 through 5. `--page-range 28-35`
parses original PDF pages 28 through 35 and preserves those page numbers in
the package.

## Parsing Multiple PDFs

Parse every PDF recursively under an input directory:

```bash
python scripts/parse_pdfs_docling.py \
  --input-dir data/oagn/pdfs \
  --output-dir parsed_documents/v4/oagn \
  --pattern '**/*.pdf'
```

Parse only the first ten discovered PDFs:

```bash
python scripts/parse_pdfs_docling.py \
  --input-dir data/oagn/pdfs \
  --output-dir parsed_documents/v4/oagn \
  --pattern '**/*.pdf' \
  --limit 10
```

Quote recursive glob patterns so the shell does not expand them before the
parser receives them.

## Reprocessing Existing Packages

The parser refuses to replace an existing package unless `--overwrite` is
provided.

```bash
python scripts/parse_pdfs_docling.py \
  --input-dir data/oagn/pdfs \
  --output-dir parsed_documents/v4/oagn \
  --pattern pakhara-mahanagarapalka-31672874.pdf \
  --overwrite
```

`--overwrite` removes only the matching generated package before writing the
new one. Use a versioned output directory when comparing parser versions.

## Resuming or Appending Missing Pages

Use `--resume` with the same output directory and document ID to preserve an
existing package and parse only missing pages. `--append` is an alias.

For example, to continue a 1,111-page annual report after approximately page
900:

```bash
python scripts/parse_pdfs_docling.py \
  --input-dir data/oagn/annual \
  --output-dir parsed_documents/v3/oagn/annual \
  --pattern 'annual 2081 82.pdf' \
  --page-range 900-1111 \
  --batch-size 10 \
  --resume
```

The page range is inclusive. Existing page JSON files in the requested range
are skipped, so page 900 is not parsed again when `page_900.json` is already
present. The parser appends Markdown and assets, continues unique batch IDs,
and rebuilds structure, metadata, and quality reports. Do not combine
`--resume` with `--overwrite`.

When the original run used `--document-id`, pass that same value while
resuming. The output directory must also be exactly the same package root used
by the original command.

## Document Package Layout

Each PDF produces a package similar to:

```text
parsed_documents/v4/oagn/<document-id>/
├── metadata.json
├── document.md
├── document.clean.md
├── document.raw.md
├── structure.json
├── structure.clean.json
├── structure.raw.json
├── pages/
│   ├── page_001.json
│   ├── page_001.clean.json
│   └── page_001.raw.json
├── assets/
│   ├── images/
│   ├── page_images/
│   └── tables/
│       ├── tbl_1.md
│       ├── tbl_1.csv
│       ├── tbl_1.raw.json
│       ├── tbl_1.extraction.json
│       └── tbl_1.grid.png
└── quality/
    ├── quality_report.json
    ├── quality_report.md
    ├── page_quality.json
    ├── table_quality.json
    ├── manual_review_queue.json
    └── pages/
```

Some table files are created only when a bordered grid is detected.

### `metadata.json`

Contains document-level metadata, source checksum, parser and Docling versions,
OCR configuration, cleanup configuration, and table-extraction counts.

### `document.md`

The cleaned, page-aware Markdown document. Page boundaries are represented as:

```html
<!-- page: 28 -->
```

`document.clean.md` contains the same cleaned output. `document.raw.md`
preserves Docling's uncleaned export for debugging.

### `structure.json`

Contains logical nodes with IDs, parent IDs, page numbers, element types,
positions, source provenance, quality flags, and indexing weights.

### `pages/page_NNN.json`

Contains page-level selected text, Docling text, optional standalone OCR text,
table Markdown, quality information, and individual elements.

Important fields include:

- `selected_source`: the extraction selected for the page.
- `text_docling_raw`: Docling text plus table text.
- `text_ocr_raw`: standalone fallback OCR when it was attempted.
- `text_clean`: selected cleaned text used downstream.
- `quality`: page-level diagnostics and recommended action.
- `elements`: headings, paragraphs, lists, tables, and images.

### Table assets

For a reconstructed bordered table:

- `tbl_N.md`: Markdown table built from the detected grid.
- `tbl_N.csv`: the same matrix as CSV.
- `tbl_N.grid.png`: table crop with grid lines removed before OCR.
- `tbl_N.extraction.json`: detected rows, columns, boundaries, OCR confidence,
  and extraction method.
- `tbl_N.raw.json`: original Docling table data for comparison.

Borderless or undetected tables use the Docling/TableFormer result as a
fallback and may not have `grid.png`.

## OCR and Language Options

### OCR policy

```text
--ocr always   Force OCR on every page. Default and recommended here.
--ocr auto     Let Docling decide when OCR is needed.
--ocr never    Use embedded PDF text without OCR.
```

Use `--ocr never` only when the PDF has reliable Unicode text.

### OCR backend

```text
--ocr-engine TesseractCliOcrOptions   Default; quieter native logs.
--ocr-engine TesseractOcrOptions      In-process Tesseract backend.
```

### OCR languages

```bash
--ocr-lang nep+eng
```

Multiple language codes can be joined with `+` or commas. Every selected
language must have a corresponding Tesseract trained-data file.

### Devanagari cleanup

The default `--prefer-devanagari` mode:

- Removes Latin OCR fragments and foreign-script noise.
- Preserves approved technical acronyms such as `SUTRA`, `NAMS`, `PAN`, and
  `VAT`.
- Converts ASCII digits to Nepali digits.
- Removes common stray OCR symbols.
- Applies a small conservative glossary of recurring Nepali OCR corrections.

Preserve mixed English/Nepali text with:

```bash
--no-prefer-devanagari
```

## Table Extraction

Bordered tables are reconstructed with OpenCV grid detection and Tesseract TSV
coordinates. Detected words are assigned to cells based on their page position.

```text
--grid-table-ocr       Enable grid reconstruction. Default.
--no-grid-table-ocr    Use only Docling/TableFormer tables.
--table-ocr-psm 6      Tesseract segmentation mode for table crops.
```

Grid reconstruction requires page images. Do not combine
`--grid-table-ocr` with `--no-generate-page-images`.

Table structure and table text quality are separate concerns. A table can have
a correctly reconstructed grid while individual OCR characters or financial
digits remain wrong. Validate important amounts against `tbl_N.grid.png` or the
corresponding `assets/page_images/page_NNN.png`.

## Quality Reports

Quality reports are enabled by default. Useful files are:

- `quality/quality_report.md`: short human-readable summary.
- `quality/page_quality.json`: page-level character, script, source, and table metrics.
- `quality/table_quality.json`: table dimensions, extraction method, OCR confidence,
  and flags.
- `quality/manual_review_queue.json`: pages and tables requiring review.
- `quality/pages/page_NNN_qa.md`: rendered-page link, extracted text, and flags.

Common recommended actions include:

- `accept`: no major parser warning.
- `accept_visual_only`: visual page with no expected indexable text.
- `validate_tables`: inspect reconstructed cells or numeric values.
- `manual_review`: OCR ran but the result remains suspicious.
- `full_page_ocr`: OCR is disabled and the page appears to need it.

The quality score is a diagnostic heuristic, not proof that financial values
are correct.

## Metadata Overrides

The following options override inferred metadata:

```text
--document-id ID
--document-name NAME
--organization NAME
--document-type TYPE
--language LANGUAGE
--fiscal-year YEAR
```

`--document-id` can be used only when exactly one PDF is selected.

Example:

```bash
python scripts/parse_pdfs_docling.py \
  --input-dir data/oagn/pdfs \
  --output-dir parsed_documents/v4/oagn \
  --pattern pakhara-mahanagarapalka-31672874.pdf \
  --document-id OAGN-PKR-2081-82 \
  --document-name 'Pokhara Metropolitan Audit Report' \
  --organization 'Office of the Auditor General, Nepal' \
  --document-type 'Audit Report' \
  --fiscal-year '2081/82'
```

## Performance Controls

Full-page OCR and table reconstruction can take several minutes for a large
PDF. A 173-page table-heavy report may take substantially longer.

The parser converts PDFs in batches of 50 pages by default. Each batch writes
its page JSON, Markdown, images, tables, and structure nodes before Docling's
in-memory result is released. This prevents very large PDFs from keeping every
rendered page and OCR result in memory at once.

For a 1,111-page PDF, start with:

```bash
python scripts/parse_pdfs_docling.py \
  --input-dir data \
  --output-dir parsed_documents/v4 \
  --pattern 'large-document.pdf' \
  --batch-size 25
```

Use a smaller batch when memory is still tight:

```bash
--batch-size 10
```

Smaller batches reduce peak memory but add conversion overhead. Larger batches
are faster when sufficient RAM is available. `--batch-size 0` restores the
single-conversion behavior and is not recommended for very large PDFs.

Progress output includes:

- Overall PDFs completed.
- Elapsed Docling conversion time.
- Reconstructed tables completed.
- Sparse-page OCR fallback progress.

For faster exploratory runs:

```bash
--max-num-pages 5
```

To skip the additional bordered-table pass:

```bash
--no-grid-table-ocr
```

To disable progress rendering in logs or CI:

```bash
--no-progress
```

## Other Useful Options

```text
--input-dir DIR                 Input directory. Default: data
--output-dir DIR                Package root. Default: parsed_documents
--pattern GLOB                  PDF glob. Default: **/*.pdf
--limit N                       Parse the first N discovered PDFs
--max-num-pages N               Parse pages 1 through N
--page-range START-END          Parse an inclusive original page range
--batch-size N                  Convert N pages at a time. Default: 50; 0 disables
--resume, --append              Append only pages missing from an existing package
--overwrite                     Replace matching generated packages
--ocr-fallback                  Enable sparse-page standalone OCR. Default
--no-ocr-fallback               Disable sparse-page standalone OCR
--generate-page-images          Save rendered page images. Default
--generate-picture-images       Save detected pictures. Default
--quality-report                Write quality artifacts. Default
--table-validation              Validate table extraction. Default
--clean-text                    Write cleaned output. Default
--review-low-quality            Add suspicious pages/tables to review queue
--min-page-quality SCORE        Review threshold. Default: 0.70
--boilerplate-rules PATH        Cleaning rules YAML-like file
```

Display the authoritative option list for the installed version:

```bash
python scripts/parse_pdfs_docling.py --help
```

## Troubleshooting

### `No PDFs found`

Check that `--input-dir` exists and that `--pattern` matches paths relative to
that directory. Quote recursive patterns.

### Package already exists

Use a new output directory or add `--overwrite`.

### Process exits with an out-of-memory error

Reduce the conversion batch size, for example `--batch-size 10`. Also close
other memory-heavy processes. Disabling page images lowers memory further, but
also disables standalone OCR fallback and bordered-table reconstruction that
depend on those images:

```bash
--no-generate-page-images --no-ocr-fallback --no-grid-table-ocr
```

### `Exceeds the limit ... for integer string conversion`

Malformed OCR can occasionally produce a cell containing thousands of
consecutive digits. Python 3.11 rejects conversion of extremely long digit
strings by default. Parser 1.4.2 raises that limit to a bounded 20,000 digits
for Docling and rejects oversized table serial-number cells instead of
normalizing them. Failures also print a full traceback for diagnosis.

### Missing `nep.traineddata`

Install the Nepali Tesseract language pack, verify it with
`tesseract --list-langs`, then set `TESSDATA_PREFIX` if necessary.

### `OSD failed` or `boxClipToRectangle`

These can be non-fatal Tesseract warnings on sparse pages or unusual crop
rectangles. If the run ends with `wrote ...` and `Done.`, the package was
created. The default CLI backend reduces repeated native warnings.

### Tables still have incorrect characters

Inspect:

```text
assets/tables/tbl_N.grid.png
assets/tables/tbl_N.extraction.json
quality/table_quality.json
```

Grid reconstruction repairs rows and columns; it cannot guarantee every OCR
digit. Important financial values must be checked against the rendered image.

### Keep original English text

Run with `--no-prefer-devanagari`.

### Reproduce one problematic page

Use a page range and a temporary document ID:

```bash
python scripts/parse_pdfs_docling.py \
  --input-dir data/oagn/pdfs \
  --output-dir parsed_documents/debug \
  --pattern problem.pdf \
  --page-range 28-28 \
  --document-id debug-page-28 \
  --overwrite
```
