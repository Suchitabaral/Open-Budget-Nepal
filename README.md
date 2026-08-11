# Open-Budget-Nepal

Open-Budget-Nepal is a document-processing project for preparing Nepal government budget and audit PDFs for downstream analysis and search.

## Project structure

- scripts/: PDF parsing utilities, including parse_pdfs_docling.py for converting PDF files into structured document packages.
- cleaning/: boilerplate cleaning rules used to remove repeated or noisy text during parsing.
- data/: source PDFs and related datasets.
- parsed_documents/: generated output packages from the parser.

## PDF parsing workflow

The main parser script is [scripts/parse_pdfs_docling.py](scripts/parse_pdfs_docling.py). It reads PDFs from a source directory, extracts content with Docling, and writes one package per document with metadata, Markdown text, structure data, and extracted assets.

See [PARSE_WITH_OCR.md](PARSE_WITH_OCR.md) for installation, OCR and table
configuration, output schemas, quality reports, examples, and troubleshooting.

### Run the parser

From the repository root:

```bash
python -m pip install -r requirements.txt
python scripts/parse_pdfs_docling.py
```

Useful options include:

- `--input-dir`: choose the source directory for PDFs
- `--output-dir`: choose where parsed packages are written
- `--limit`: process only the first N PDFs
- `--page-range`: process an inclusive page range
- `--batch-size`: bound memory use by converting 50 pages at a time by default
- `--resume`: append only missing pages to an existing package
- `--overwrite`: replace existing outputs
- `--ocr`: choose OCR mode (`auto`, `always`, or `never`)
- `--prefer-devanagari`: remove foreign-script OCR noise
- `--grid-table-ocr`: reconstruct bordered tables from visible grids
- `--boilerplate-rules`: point to a custom cleaning rules file

## Cleaning rules

The file [cleaning/boilerplate_rules.yaml](cleaning/boilerplate_rules.yaml) defines rules for removing boilerplate and repeated headers from extracted text. These rules are used by the parser by default and help improve the quality of the cleaned output.

## Notes

- Full-page Nepali and English OCR is enabled by default.
- Devanagari cleanup and bordered-table reconstruction are enabled by default.
- The parser writes output into the parsed_documents directory unless you override it.
- The repository includes sample data and generated document packages under the data/ and parsed_documents/ folders.
