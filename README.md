# Open Budget Nepal multilingual RAG

FastAPI RAG service for parsed Nepal budget and audit documents. It accepts Nepali
(Devanagari), romanized Nepali, and English questions and answers in the same script
as the question.

For a complete explanation of the technology choices, architecture, ingestion and
retrieval methodology, API contracts, evaluation approach, operations, limitations,
and usage, see [RAG_DOCUMENTATION.md](RAG_DOCUMENTATION.md).

## Architecture

- Parser input: `metadata.json` plus `structure.clean.json` (falling back to
  `structure.json` for v1 documents), including Markdown table assets.
- Dense retrieval: `intfloat/multilingual-e5-base` with normalized 768-dimensional
  embeddings and the model's `query:`/`passage:` prefixes.
- Lexical retrieval: a corpus-fitted, Unicode-aware BM25 encoder. Nepali and ASCII
  digit aliases improve exact fiscal-year and amount matching.
- Vector database: one Pinecone serverless index containing dense and sparse vectors.
  Queries use `alpha * dense + (1 - alpha) * sparse`; the default alpha is `0.7`.
- Multilingual retrieval: Gemini 3.6 Flash expands a query into Nepali, romanized
  Nepali, and English search variants. Results are combined with reciprocal-rank
  fusion.
- Generation: Gemini 3.6 Flash produces context-only answers with `[1]` citations.
- Evaluation: an offline RAGAS workflow measures faithfulness, answer relevancy,
  factual correctness, context precision, and context recall against a labeled
  JSON/JSONL dataset. Answer relevancy reuses the multilingual E5 embeddings.

## Parser artifact contract

The linked `PARSE_WITH_OCR.md` is not currently present in this checkout. The loader
therefore follows the artifacts in `parsed_documents/` directly:

1. Recursively discover document directories through `metadata.json`.
2. Prefer `structure.clean.json`; use `structure.json` when no clean structure exists.
3. Ignore nodes explicitly marked `indexable: false` and nodes below
   `RAG_MIN_QUALITY_SCORE`.
4. Load paragraphs, lists, titles, and sections. Load table bodies from each table
   node's `asset_path`. Images without extracted text are skipped.
5. Preserve document ID/name/type, organization, fiscal year, heading path, page,
   parser version, node IDs, and quality score as Pinecone metadata.

## Local setup

Python 3.11 is recommended.

```sh
python -m venv .venv
source .venv/bin/activate
pip install -c constraints.txt -r requirements.txt
cp .env.example .env
```

Set `PINECONE_API_KEY` and `GEMINI_API_KEY` in `.env`. If `budgetrag` already exists,
it must use dimension `768` and metric `dotproduct`; otherwise the ingestion command
creates it.

The first run downloads `intfloat/multilingual-e5-base` from Hugging Face.

## Ingest parsed documents

Preview parser compatibility without loading the embedding model or calling
Pinecone:

```sh
python -m rag_service.ingest --dry-run
```

Index the complete parsed corpus:

```sh
python -m rag_service.ingest
```

Use `--reset` when you intentionally want to clear only the configured Pinecone
namespace before rebuilding it:

```sh
python -m rag_service.ingest --reset
```

Ingestion fits BM25 on the complete corpus and writes its parameters to
`RAG_BM25_PARAMS`. Keep that file paired with the indexed namespace. Re-run full
ingestion whenever the parsed corpus or chunking settings change.

## Run the API

```sh
uvicorn rag_service.main:app --host 0.0.0.0 --port 8000 --reload
```

Health/configuration status:

```sh
curl http://localhost:8000/api/v1/health
```

Chat in Nepali:

```sh
curl -X POST http://localhost:8000/api/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{"query":"मधेश प्रदेशको लेखापरीक्षण प्रतिवेदनमा बेरुजुबारे के भनिएको छ?"}'
```

Chat in romanized Nepali:

```sh
curl -X POST http://localhost:8000/api/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{"query":"Madhesh Pradesh ko beruju kati cha?","k":8,"alpha":0.65}'
```

Retrieval-only debugging is available at `POST /api/v1/retrieve`. Interactive API
documentation is at `http://localhost:8000/docs`.

## RAGAS evaluation

Create a JSON array or JSONL file containing `query` (or `question`) and `reference`
(or `ground_truth`) for every case. Include all three supported query forms in the
test set. A small schema/smoke example is provided at
`rag_service/evaluation_dataset.example.json`.

```sh
python -m rag_service.evaluate \
  rag_service/evaluation_dataset.example.json \
  --output ragas_results.json
```

RAGAS uses Gemini as the evaluator and reports:

- faithfulness: whether answer claims are supported by retrieved chunks;
- answer relevancy: whether the response directly addresses the question;
- factual correctness: whether response claims agree with the reference answer;
- context precision: whether useful chunks are ranked ahead of irrelevant chunks;
- context recall: whether retrieval contains the claims needed by the reference.

For a real benchmark, use independently reviewed references and tune
`RAG_HYBRID_ALPHA`, `RAG_RETRIEVAL_K`, and chunk settings on a development set, then
report final metrics once on a held-out set.

## Docker

Docker Compose bind-mounts `parsed_documents/` read-only and persists Hugging Face
caches and BM25 parameters in named volumes.

```sh
cp .env.example .env
docker compose build rag-service
docker compose run --rm rag-service python -m rag_service.ingest
docker compose up -d rag-service
docker compose logs -f rag-service
```

The API is available at `http://localhost:${RAG_PORT:-8000}`.
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
