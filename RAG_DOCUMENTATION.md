# Open Budget Nepal RAG: Architecture, Methodology, and Usage

## 1. Purpose

This service makes parsed Nepal budget and audit documents searchable through a
grounded conversational interface. A user can ask a question in:

- Nepali written in Devanagari;
- romanized Nepali written in Latin characters; or
- English.

The service retrieves relevant passages and tables, asks Gemini to answer only from
that evidence, and returns both inline citations and structured source metadata.

Retrieval-Augmented Generation (RAG) is used because the language model should not
be expected to memorize every report, fiscal year, table, or amount. Retrieval gives
the model the relevant evidence at request time, which improves factual grounding,
makes document updates possible without retraining the LLM, and enables page-level
source attribution.

## 2. Goals and non-goals

### Goals

- Search the parsed OCR corpus semantically and lexically.
- Support cross-language and cross-script questions.
- Preserve amounts, fiscal years, page numbers, headings, and table contents.
- Produce evidence-constrained answers with inspectable sources.
- Make ingestion, serving, and evaluation reproducible through CLI commands and
  Docker.
- Measure retrieval and generation quality with RAGAS.

### Current non-goals

- The service is not a general-purpose web search engine.
- It does not answer from Gemini's internal knowledge when evidence is absent.
- It does not currently provide multi-turn conversation memory.
- It does not OCR images at RAG ingestion time; OCR must happen in the parser.
- It does not provide authentication, quotas, or tenant isolation by itself.

## 3. Technology stack

| Layer | Technology | Role | Why it is used |
|---|---|---|---|
| API | FastAPI | Health, chat, and retrieval endpoints | Typed request validation, OpenAPI documentation, and simple async HTTP serving |
| Dense embeddings | `intfloat/multilingual-e5-base` | Cross-lingual semantic retrieval | Supports many languages and maps semantically related multilingual text into the same vector space |
| Embedding runtime | Sentence Transformers | Runs E5 locally | Avoids per-document embedding API costs and supports normalized batched embeddings |
| Sparse retrieval | Custom Unicode-aware BM25 | Exact lexical matching | Recovers exact names, section numbers, fiscal years, amounts, and domain terms that dense retrieval can miss |
| Vector database | Pinecone Serverless | Stores and searches dense and sparse vectors | Managed vector infrastructure with metadata filtering and single-index hybrid search |
| Query expansion | Gemini 3.6 Flash | Generates faithful Nepali, romanized Nepali, and English search variants | Improves retrieval when the query and source use different scripts or wording |
| Answer generation | Gemini 3.6 Flash | Produces grounded multilingual answers | Stable multilingual generation with low latency and sufficient context capacity |
| Evaluation | RAGAS | Evaluates retriever and generator quality | Separates grounding, relevance, correctness, precision, and recall measurements |
| Packaging | Docker and Docker Compose | Reproducible runtime | Keeps Python dependencies, caches, parsed artifacts, and BM25 state consistent |

## 4. System architecture

```mermaid
flowchart LR
    A[Parsed OCR artifacts] --> B[Structured document loader]
    B --> C[Page and section-aware chunks]
    C --> D[E5 dense embeddings]
    C --> E[Unicode BM25 sparse vectors]
    D --> F[(Pinecone hybrid index)]
    E --> F

    Q[User question] --> X[Gemini query expansion]
    X --> Q1[Nepali query]
    X --> Q2[Romanized Nepali query]
    X --> Q3[English query]
    Q1 --> F
    Q2 --> F
    Q3 --> F
    F --> R[Reciprocal-rank fusion]
    R --> K[Context assembly]
    K --> G[Gemini grounded generation]
    G --> O[Answer plus citations and sources]
```

The ingestion path and query path are intentionally separate. Documents are parsed
and embedded ahead of time. A chat request only expands the query, retrieves
candidates, assembles context, and generates an answer.

## 5. Parsed-document input contract

The loader recursively discovers documents through `metadata.json`. For each
document directory it:

1. Prefers `structure.clean.json`.
2. Falls back to `structure.json` for older parser output.
3. Reads text from paragraphs, list items, section text, and table titles.
4. Reads table bodies from each table node's Markdown `asset_path`.
5. Skips images that do not contain extracted text.
6. Skips nodes explicitly marked `indexable: false`.
7. Skips nodes below `RAG_MIN_QUALITY_SCORE`.

The loader has been dry-run against all parser layouts currently in this repository:
134 documents produced 47,697 chunks.

### Metadata retained per chunk

- `document_id`
- `document_name`
- `organization`
- `document_type`
- `language`
- `fiscal_year`
- `parser_version`
- `page`
- `section`
- `source_path`
- source `node_ids`
- `content_types`
- average `quality_score`
- `chunk_number`

This metadata supports citations, debugging, later filtering, and quality analysis.
Pinecone metadata is flat; source text is stored in the metadata field named `text`.

## 6. Ingestion methodology

### 6.1 Structure-aware chunking

The service groups adjacent content by page and heading context before splitting it.
The default chunking configuration is:

- chunk size: 1,200 characters;
- overlap: 150 characters;
- separators: paragraph, newline, Nepali danda, sentence, word, then character.

Each embedded chunk is prefixed with document name, organization, document type,
fiscal year, section path, and page. This makes otherwise ambiguous passages easier
to retrieve and makes metadata questions answerable from the retrieved text.

Tables are loaded as Markdown so their row and column relationships remain visible
to both retrieval and Gemini. Large tables can be split into multiple overlapping
chunks.

Chunk IDs are deterministic hashes of document identity, source path, page, group,
and split number. Re-ingestion therefore overwrites the same logical positions.

### 6.2 Dense embeddings

E5 requires different prefixes for passages and queries:

```text
passage: <document chunk>
query: <user search query>
```

The service applies these automatically and L2-normalizes every embedding. The
default model produces 768-dimensional vectors, so the Pinecone index must also use
dimension `768`.

### 6.3 Sparse BM25 encoding

The sparse encoder is fitted on the complete chunk corpus. Its tokenizer:

- normalizes Unicode with NFKC;
- case-folds Latin text;
- preserves Unicode letters, combining marks, and numbers;
- supports Devanagari and Latin tokens; and
- adds both Nepali and ASCII forms of numeric tokens.

For example, a token containing `२०८१` also receives the lexical alias `2081`. This
is useful when a source uses Nepali digits and a user types the same fiscal year in
ASCII.

BM25 corpus statistics are saved to `RAG_BM25_PARAMS`. Those parameters must remain
paired with the Pinecone namespace because both document sparse weights and query
weights depend on the fitted corpus.

### 6.4 Pinecone record format

Every Pinecone record contains:

```json
{
  "id": "deterministic-chunk-id",
  "values": ["768 normalized dense values"],
  "sparse_values": {
    "indices": ["hashed token IDs"],
    "values": ["BM25 term weights"]
  },
  "metadata": {
    "text": "source chunk",
    "document_id": "...",
    "page": 12
  }
}
```

The index must use `dotproduct`. The service creates a serverless index if the
configured index does not exist. If an existing index has the wrong dimension or
metric, the service stops with an explanatory error instead of silently corrupting
retrieval.

Before replacing records, ingestion checks whether the configured namespace exists.
If it does not, deletion is skipped and Pinecone creates the namespace automatically
when the first vector batch is upserted. No namespace needs to be prepared manually.

## 7. Retrieval methodology

### 7.1 Multilingual query expansion

By default, Gemini classifies the query as Nepali, romanized Nepali, or English and
creates faithful search versions in all three forms. Names, fiscal years, amounts,
section numbers, and technical terms are explicitly preserved.

The original query is always included. If expansion fails, retrieval falls back to
the original query rather than failing the entire request. Set
`RAG_QUERY_EXPANSION=false` to disable this extra Gemini call.

### 7.2 Hybrid dense and sparse scoring

For every query variant, the dense vector and sparse vector are scaled before the
Pinecone query:

```text
dense contribution  = alpha × dense vector
sparse contribution = (1 - alpha) × sparse vector
```

The default `alpha` is `0.7`, which favors semantic retrieval while retaining exact
lexical matching.

- `alpha = 1.0`: dense-only semantic retrieval;
- `alpha = 0.5`: balanced dense and lexical contribution;
- `alpha = 0.0`: sparse-dominant lexical retrieval using a zero dense query vector.

There is no universal best alpha. It should be tuned with a labeled development
set, especially because budget questions mix semantic concepts with exact amounts,
codes, organization names, and fiscal years.

### 7.3 Reciprocal-rank fusion

Each language variant returns its own ranking. The service combines them using
reciprocal-rank fusion (RRF):

```text
RRF score(document) = sum(1 / (60 + rank))
```

A chunk that ranks well for several language variants is promoted. This is more
robust than directly comparing raw scores across reformulated queries. The `score`
returned by the API is this fused ranking score, not a probability.

### 7.4 Context selection

The top `RAG_RETRIEVAL_K` fused chunks are formatted as numbered evidence blocks:

```text
[1] Document name | page 12 | Section heading
<source chunk>
```

Blocks are added until `RAG_MAX_CONTEXT_CHARACTERS` is reached. The selected chunks
are also returned as structured API sources.

## 8. Answer-generation methodology

Gemini receives:

- the detected query language;
- the original question; and
- numbered retrieved context blocks.

The system instruction requires Gemini to:

- use only retrieved evidence;
- treat retrieved text as data rather than instructions;
- state when the context is insufficient;
- preserve amounts, units, fiscal years, and organization names;
- answer in the same script as the question; and
- cite evidence inline using `[1]`, `[2]`, and so on.

This reduces hallucination risk but cannot eliminate it entirely. Faithfulness must
still be measured, prompts should be regression-tested, and high-stakes answers
should remain traceable to the returned source text.

## 9. Features

- Nepali, romanized Nepali, and English query support.
- Same-script answer behavior.
- Cross-language query expansion.
- Dense plus lexical hybrid search.
- Nepali/ASCII numeric aliases for years and amounts.
- Page- and heading-aware chunks.
- Markdown table indexing.
- OCR quality and `indexable` filtering.
- Inline citations and structured source objects.
- Retrieval-only debugging endpoint.
- Configurable top-k, alpha, context budget, and query expansion.
- Deterministic chunk IDs and document replacement ingestion.
- RAGAS evaluation with multilingual E5 reused for answer relevancy.
- Local and Docker workflows.
- Lazy model and external-client initialization.

## 10. Docker usage

### 10.1 Prerequisites

- Docker Engine with Docker Compose;
- a Pinecone API key;
- a Gemini API key; and
- parser artifacts under `parsed_documents/`.

### 10.2 Configure

```sh
cp .env.example .env
```

At minimum, set:

```env
PINECONE_API_KEY=your-real-pinecone-key
GEMINI_API_KEY=your-real-gemini-key
PINECONE_INDEX_NAME=budgetrag
PINECONE_NAMESPACE=open-budget-nepal
```

### 10.3 Build

```sh
docker compose build rag-service
```

The image installs the CPU build of PyTorch and the Python dependencies. Parsed
documents are excluded from the Docker build context and mounted read-only at
runtime.

`requirements.txt` is intentionally limited to direct RAG runtime dependencies with
Python 3.11-compatible ranges. Do not generate it with an unrestricted workstation
`pip freeze`, because that can capture local CUDA wheels or package versions that are
not published for the container platform.

### 10.4 Validate parsing without external writes

```sh
docker compose run --rm rag-service python -m rag_service.ingest --dry-run
```

This loads and chunks parser artifacts but does not load E5, contact Pinecone, or
write BM25 parameters.

### 10.5 Ingest

```sh
docker compose run --rm rag-service python -m rag_service.ingest
```

The first ingestion downloads the E5 model. Hugging Face caches and BM25 parameters
are persisted in named Docker volumes.

To deliberately clear the configured namespace before rebuilding it:

```sh
docker compose run --rm rag-service python -m rag_service.ingest --reset
```

`--reset` deletes every vector in that namespace. Use it only when the namespace is
dedicated to this corpus and a full rebuild is intended.

### 10.6 Start the API

```sh
docker compose up -d rag-service
docker compose logs -f rag-service
```

Check health:

```sh
curl http://localhost:8000/api/v1/health
```

A healthy process can still report `bm25_fitted: false` before ingestion or
`gemini_configured: false` when credentials are missing. Chat requires Pinecone,
Gemini, and the BM25 parameter file.

Interactive OpenAPI documentation:

```text
http://localhost:8000/docs
```

Stop the service:

```sh
docker compose down
```

Named model and BM25 volumes survive `docker compose down`. Do not add `-v` unless
you also intend to delete those volumes.

## 11. Local Python usage

```sh
python -m venv .venv
source .venv/bin/activate
pip install -c constraints.txt -r requirements.txt
cp .env.example .env
python -m rag_service.ingest --dry-run
python -m rag_service.ingest
uvicorn rag_service.main:app --host 0.0.0.0 --port 8000 --reload
```

The default BM25 file is `.rag/bm25_params.json`. The default parsed-document root
is `parsed_documents`.

## 12. API usage

### 12.1 Health

```http
GET /api/v1/health
```

Example:

```json
{
  "status": "ok",
  "pinecone_configured": true,
  "gemini_configured": true,
  "bm25_fitted": true,
  "index_name": "budgetrag",
  "namespace": "open-budget-nepal"
}
```

`GET /api/v1/` returns the same response.

### 12.2 Chat

```http
POST /api/v1/chat
Content-Type: application/json
```

Request:

```json
{
  "query": "Madhesh Pradesh ko beruju kati cha?",
  "k": 8,
  "alpha": 0.65
}
```

Only `query` is required. `k` must be between 1 and 50, and `alpha` must be between
0 and 1.

Response shape:

```json
{
  "query": "Madhesh Pradesh ko beruju kati cha?",
  "content": "... [1]",
  "detected_language": "romanized_nepali",
  "search_queries": [
    "Madhesh Pradesh ko beruju kati cha?",
    "मधेश प्रदेशको बेरुजु कति छ?",
    "What is the arrears amount for Madhesh Province?"
  ],
  "alpha": 0.65,
  "context": "[1] ...",
  "sources": [
    {
      "id": "chunk-id",
      "score": 0.0489,
      "text": "retrieved source text",
      "document_id": "document-id",
      "document_name": "document name",
      "page": 42,
      "section": "section heading",
      "source_path": "v3/.../structure.clean.json",
      "metadata": {}
    }
  ]
}
```

The GET form remains available for simple clients:

```sh
curl --get http://localhost:8000/api/v1/chat \
  --data-urlencode 'query=शिक्षा क्षेत्रमा कति बजेट विनियोजन गरिएको छ?' \
  --data-urlencode 'k=6' \
  --data-urlencode 'alpha=0.7'
```

Nepali POST example:

```sh
curl -X POST http://localhost:8000/api/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{"query":"मधेश प्रदेशको लेखापरीक्षण प्रतिवेदनमा बेरुजुबारे के भनिएको छ?"}'
```

English POST example:

```sh
curl -X POST http://localhost:8000/api/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{"query":"What does the Madhesh Province audit report say about arrears?"}'
```

### 12.3 Retrieval-only debugging

```http
POST /api/v1/retrieve
```

It accepts the same request body as chat but does not generate an answer. Use it to
inspect query expansion, rankings, chunks, pages, and metadata while tuning retrieval.

### 12.4 Common response codes

- `200`: request completed;
- `422`: invalid request body, `k`, or `alpha`;
- `503`: runtime prerequisite missing, no context found, or a configured service is
  unavailable;
- `500`: unexpected external SDK or application failure.

## 13. Ingestion command reference

```sh
python -m rag_service.ingest [options]
```

| Option | Effect |
|---|---|
| `--documents-root PATH` | Overrides `PARSED_DOCUMENTS_DIR` |
| `--dry-run` | Parses and counts chunks without models or external services |
| `--reset` | Deletes the complete configured namespace before upsert |
| `--no-replace` | Skips document-by-document deletion before upsert |

Normal ingestion replaces every discovered document by deleting records with its
`document_id` and then upserting the rebuilt chunks. `--no-replace` can reduce delete
operations, but stale trailing chunks may remain if a document now produces fewer
chunks.

BM25 is globally corpus-fitted. Re-run ingestion for the complete corpus whenever
documents, cleanup rules, chunk size, chunk overlap, tokenizer behavior, or embedding
model changes. Partial re-indexing is not a reliable way to update global BM25
statistics.

For a production rebuild with live traffic, prefer building a new namespace and
switching configuration after validation. Pinecone is eventually consistent, so a
namespace being rebuilt can temporarily return mixed or incomplete results.

## 14. RAGAS evaluation

Evaluation is intentionally offline rather than part of every chat request. RAGAS
judge calls add latency and cost, and context recall/precision need reviewed reference
answers.

### 14.1 Dataset format

Use a JSON array or JSONL records. Every item needs:

- `query` or `question`; and
- `reference` or `ground_truth`.

Example:

```json
[
  {
    "query": "Madhesh 2081 82 ko report kun fiscal year ko ho?",
    "reference": "Yo report ko fiscal year २०८२/८३ ho."
  }
]
```

A smoke-test dataset is provided at
`rag_service/evaluation_dataset.example.json`. Replace or expand it with independently
reviewed cases before treating the scores as a benchmark.

### 14.2 Run locally

```sh
python -m rag_service.evaluate \
  rag_service/evaluation_dataset.example.json \
  --output ragas_results.json
```

Optional controls:

```sh
python -m rag_service.evaluate dataset.json \
  --limit 20 \
  --k 8 \
  --alpha 0.65 \
  --output ragas_results.json
```

### 14.3 Run with Docker

```sh
docker compose run --rm \
  --volume "$PWD:/results" \
  rag-service \
  python -m rag_service.evaluate \
  /app/rag_service/evaluation_dataset.example.json \
  --output /results/ragas_results.json
```

### 14.4 Metrics

| Metric | What it measures | Primary subsystem |
|---|---|---|
| Faithfulness | Whether generated claims are supported by retrieved context | Generator grounding |
| Answer relevancy | Whether the response directly addresses the question | Generator usefulness |
| Factual correctness | Whether response claims agree with the reference | End-to-end answer quality |
| Context precision | Whether useful chunks appear ahead of irrelevant chunks | Retriever ranking |
| Context recall | Whether retrieved chunks contain the claims needed by the reference | Retriever coverage |

Answer relevancy reuses `intfloat/multilingual-e5-base`. Gemini is the evaluator LLM
by default and can be changed with `RAGAS_EVALUATOR_MODEL`.

### 14.5 Recommended evaluation methodology

1. Build cases from real user questions and important report tasks.
2. Include Nepali, romanized Nepali, and English subsets.
3. Include narrative, table, exact-amount, organization, fiscal-year, and
   unanswerable questions.
4. Have a reviewer create references directly from source documents.
5. Split cases into development and held-out test sets.
6. Tune alpha, top-k, and chunking only on the development set.
7. Report overall and per-language metrics on the held-out set.
8. Review low-scoring examples manually; averages alone do not explain the failure.

For retrieval tuning, evaluate a grid such as:

```text
alpha: 0.25, 0.50, 0.65, 0.75, 1.00
k:     4, 6, 8, 12
```

Select settings using context precision/recall and answer metrics together. Increasing
`k` often improves recall but may reduce precision and add distracting context.

## 15. Configuration reference

### Required external services

| Variable | Default | Description |
|---|---:|---|
| `PINECONE_API_KEY` | none | Pinecone credential |
| `GEMINI_API_KEY` | none | Gemini credential; `GOOGLE_API_KEY` is also accepted |

### Pinecone

| Variable | Default | Description |
|---|---:|---|
| `PINECONE_INDEX_NAME` | `budgetrag` | Hybrid index name |
| `PINECONE_NAMESPACE` | `open-budget-nepal` | Corpus namespace |
| `PINECONE_CLOUD` | `aws` | Serverless index cloud |
| `PINECONE_REGION` | `us-east-1` | Serverless index region |
| `PINECONE_UPSERT_BATCH_SIZE` | `64` | Records per upsert batch |
| `PINECONE_READY_TIMEOUT` | `120` | Seconds to wait for a new index |

### Documents and embeddings

| Variable | Default | Description |
|---|---:|---|
| `PARSED_DOCUMENTS_DIR` | `parsed_documents` | Parser artifact root |
| `RAG_BM25_PARAMS` | `.rag/bm25_params.json` | Persisted sparse-model statistics |
| `EMBEDDING_MODEL_NAME` | `intfloat/multilingual-e5-base` | Sentence Transformer model |
| `EMBEDDING_DIMENSION` | `768` | Pinecone dense dimension |
| `EMBEDDING_BATCH_SIZE` | `32` | Local embedding batch size |
| `EMBEDDING_DEVICE` | auto | Optional `cpu`, `cuda`, or supported device |

### Generation and retrieval

| Variable | Default | Description |
|---|---:|---|
| `GEMINI_MODEL` | `gemini-3.6-flash` | Stable expansion and answer model |
| `GEMINI_TEMPERATURE` | `0.1` | Answer-generation temperature |
| `GEMINI_MAX_OUTPUT_TOKENS` | `2048` | Maximum answer tokens |
| `RAG_QUERY_EXPANSION` | `true` | Enable multilingual query variants |
| `RAG_CHUNK_SIZE` | `1200` | Chunk body size in characters |
| `RAG_CHUNK_OVERLAP` | `150` | Overlap in characters |
| `RAG_MIN_QUALITY_SCORE` | `0.25` | Minimum parser node quality |
| `RAG_RETRIEVAL_K` | `6` | Final fused chunks |
| `RAG_HYBRID_ALPHA` | `0.7` | Dense contribution from 0 to 1 |
| `RAG_QUERY_EXPANSION_CANDIDATES` | `12` | Candidates retrieved per query variant |
| `RAG_MAX_CONTEXT_CHARACTERS` | `14000` | Maximum context sent to Gemini |

### API and evaluation

| Variable | Default | Description |
|---|---:|---|
| `RAG_PORT` | `8000` | Docker host port |
| `CORS_ORIGINS` | localhost ports 3000 and 5173 | Comma-separated allowed origins |
| `RAGAS_EVALUATOR_MODEL` | value of `GEMINI_MODEL` | Gemini model used by RAGAS |

## 16. Performance, cost, and scaling

### Request-time work

With query expansion enabled, a typical chat request performs:

1. one Gemini expansion call;
2. one Pinecone search per unique query variant, usually three or four;
3. local reciprocal-rank fusion; and
4. one Gemini answer call.

Disable query expansion when latency or cost is more important than cross-script
recall. Reduce `RAG_QUERY_EXPANSION_CANDIDATES` to retrieve fewer candidates. Tune
`RAG_RETRIEVAL_K` and the context budget to control answer input size.

### Ingestion work

E5 embeddings are generated locally. CPU ingestion is portable but can be slow for a
large corpus; a supported accelerator can be selected with `EMBEDDING_DEVICE`. The
Docker image installs CPU PyTorch by default.

### Evaluation work

RAGAS invokes the evaluator several times per sample and metric. Start with
`--limit`, estimate latency and quota usage, and then run the complete benchmark.

## 17. Security and deployment considerations

- Keep `.env` out of version control. It is already ignored.
- Retrieved chunks and user questions are sent to Gemini. Review data-governance
  requirements before using private documents.
- Source chunks are stored in Pinecone metadata. Treat the Pinecone project as a copy
  of the indexed document data.
- Add authentication, authorization, request limits, and abuse controls before
  exposing the API publicly.
- Restrict `CORS_ORIGINS` to the real frontend origins.
- Use separate Pinecone namespaces or indexes for development, staging, and
  production.
- Do not accept arbitrary user-provided Pinecone metadata filters without an
  authorization model.
- Context is explicitly treated as data in the prompt, but retrieved-document prompt
  injection remains a risk and should be tested.

## 18. Known limitations

- Romanized Nepali has no single spelling standard; Gemini expansion is best-effort.
- OCR mistakes can still be indexed when parser quality scores do not identify them.
- Images without extracted text are not searchable.
- Tables are represented as Markdown rather than a numerical database schema.
- Citations refer to parsed page metadata, which depends on parser correctness.
- The current service is stateless and handles one question at a time.
- There is no cross-encoder reranker after hybrid retrieval.
- Responses are not streamed.
- Retrieval filters are supported internally by the vector store but are not yet
  exposed in the public API.
- Updating BM25 statistics requires complete-corpus re-ingestion.
- RAGAS scores depend on evaluator behavior and must be supplemented by human review.

## 19. Troubleshooting

### `bm25_fitted` is false

Run ingestion before chat:

```sh
docker compose run --rm rag-service python -m rag_service.ingest
```

### Pinecone index dimension or metric error

Use an index with dimension `768` and metric `dotproduct`, or choose a new
`PINECONE_INDEX_NAME`. The service intentionally does not delete an incompatible
index automatically.

### Gemini is not configured

Set `GEMINI_API_KEY` or `GOOGLE_API_KEY`, then recreate the container:

```sh
docker compose up -d --force-recreate rag-service
```

### Gemini returns `404 NOT_FOUND`

The configured model is unavailable for the API key. The default is the stable
`gemini-3.6-flash` endpoint. Set both generation and evaluation to it, then recreate
the container so Compose reloads `.env`:

```env
GEMINI_MODEL=gemini-3.6-flash
RAGAS_EVALUATOR_MODEL=gemini-3.6-flash
```

```sh
docker compose up -d --build --force-recreate rag-service
```

Gemini provider failures are returned as HTTP `503` with an actionable message;
they are not reported as an unhandled HTTP `500`.

### The E5 model downloads on every run

Use the provided Compose volumes. Avoid `docker compose down -v`, which deletes the
model caches.

### Chat returns no relevant context

- Confirm ingestion completed in the same index and namespace used by the API.
- Confirm the BM25 file belongs to that namespace.
- Inspect `POST /api/v1/retrieve`.
- Try a higher `k` or a different alpha.
- Confirm the source node was indexable and above the quality threshold.

### Browser requests fail while curl works

Add the exact frontend origin to `CORS_ORIGINS` and recreate the container.

### RAGAS dependencies are missing locally

Install the updated dependency set:

```sh
pip install -c constraints.txt -r requirements.txt
```

## 20. Code map

| File | Responsibility |
|---|---|
| `rag_service/config.py` | Environment configuration and validation |
| `rag_service/documents.py` | Parser discovery, filtering, tables, grouping, chunking, metadata |
| `rag_service/embeddings.py` | Lazy multilingual E5 adapter |
| `rag_service/sparse.py` | Unicode BM25 fitting, encoding, and persistence |
| `rag_service/vector_db.py` | Pinecone lifecycle, hybrid upsert, scaling, and search |
| `rag_service/gemini.py` | Query expansion and answer generation |
| `rag_service/rag.py` | End-to-end retrieval, rank fusion, context, and answer orchestration |
| `rag_service/main.py` | FastAPI application and endpoints |
| `rag_service/ingest.py` | Ingestion CLI |
| `rag_service/evaluate.py` | RAGAS evaluation CLI |
| `rag_service/schema/schema.py` | API request and response models |
| `tests/` | Offline loader, sparse encoder, hybrid store, and RAG tests |

## 21. Suggested next improvements

1. Build a reviewed multilingual benchmark from real stakeholder questions.
2. Tune alpha, top-k, chunk size, and overlap with per-language RAGAS results.
3. Add an optional multilingual reranker for the fused candidate set.
4. Expose safe document, fiscal-year, and organization filters in the API.
5. Add streaming responses and optional conversation history.
6. Add authentication, rate limiting, telemetry, and request tracing.
7. Use blue/green namespaces for zero-downtime corpus rebuilds.
8. Add citation-verification tests that check every cited source number exists.
