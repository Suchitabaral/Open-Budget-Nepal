# Open Budget Nepal

Open Budget Nepal is a public-finance transparency platform for exploring Nepal's budgets, local projects, contractors, procurement records, administrative geography, and deterministic Watchdog findings.

## What is included

- React, TypeScript, Vite and Tailwind frontend
- Express and TypeScript API
- PostgreSQL database managed with Prisma migrations
- Canonical registry of 7 provinces, 77 districts and 753 local levels
- Leaflet administrative-boundary explorer
- Public OpenAPI/Swagger documentation
- Multilingual FastAPI, Pinecone and Gemini chatbot service

## Repository structure

```text
frontend/       React application and nginx image
backend/        Express API, Prisma schema, migrations and seeds
shared/data/    Canonical registries and shared source data
csv/            Initial development datasets
rag_service/    Optional retrieval and chat service
tools/          Isolated data-maintenance utilities
docker-compose.yml
```

## Quick start with Docker

Requirements:

- Docker Engine or Docker Desktop
- Docker Compose v2 (`docker compose`)

Create your local environment file:

```sh
cp .env.example .env
```

Choose the initialization that matches your Pinecone namespace before the first
start.

If the namespace is already populated from the exact same parsed corpus, build the
RAG image and generate the local BM25 parameters without modifying Pinecone:

```sh
docker compose --profile rag build rag-service
docker compose --profile rag run --rm rag-service python -m rag_service.ingest --fit-sparse-only
```

If the namespace is new, preview and ingest the parsed corpus instead:

```sh
docker compose --profile rag run --rm rag-service python -m rag_service.ingest --dry-run
docker compose --profile rag run --rm rag-service python -m rag_service.ingest
```

For an existing namespace that you intentionally want to replace, add `--reset` to
the full ingestion command. It deletes all vectors in that namespace first.

Start PostgreSQL, the API, frontend, and chatbot together:

```sh
docker compose --profile rag up --build -d
```

Open:

- Application: <http://localhost:8080>
- API: <http://localhost:3001>
- API health: <http://localhost:3001/api/v1/health>
- Interactive API documentation: <http://localhost:3001/api/docs>
- OpenAPI JSON: <http://localhost:3001/api/openapi.json>
- RAG health: <http://localhost:8000/api/v1/>
- RAG documentation: <http://localhost:8000/docs>

On startup, the backend applies committed Prisma migrations. It preserves the
database when all four core datasets (budgets, projects, contracts, and contractors)
are present. If any core dataset is missing, the Docker development seed rebuilds
the bundled data so Contractors and Watchdog are not left partially populated.

Inspect status and startup logs:

```sh
docker compose --profile rag ps
docker compose --profile rag logs -f backend rag-service frontend
```

Stop containers without deleting data:

```sh
docker compose down
```

Delete the development database volume only when a complete reset is intended:

```sh
docker compose down -v
```

This permanently removes the Compose-managed PostgreSQL data.

## Local development

Requirements:

- Node.js 22+
- npm
- PostgreSQL 16+ (or run only PostgreSQL with Docker)

Start PostgreSQL:

```sh
docker compose up -d postgres
```

Set up and start the backend:

```sh
cd backend
cp .env.example .env
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

In a second terminal, start the frontend:

```sh
cd frontend
cp .env.example .env
npm ci
npm run dev
```

Open <http://localhost:5173>. The default frontend configuration calls the API at `http://localhost:3001/api`.

### Database commands

Run these from `backend/`:

```sh
npx prisma migrate status
npm run prisma:migrate -- --name describe_change
npm run db:seed:registry
npx prisma studio
```

Use `prisma migrate dev` only for creating migrations during development. Use `prisma migrate deploy` for Docker, CI and deployed environments.

The full `npm run db:seed` command clears and reloads seeded domain tables. Do not run it against a database containing data that must be preserved. The registry-only seed is idempotent.

## Verification

Frontend:

```sh
cd frontend
npm test
npm run lint
npm run build
```

Backend:

```sh
cd backend
npm test
```

Validate the Compose model without starting containers:

```sh
docker compose config
```

## RAG initialization

The chatbot uses the isolated `rag` Compose profile. Set `PINECONE_API_KEY`,
`GEMINI_API_KEY`, and the related RAG values in `.env` before starting it.

If the configured Pinecone namespace is already populated, initialize only the
local BM25 parameters (this does not modify Pinecone), then restart the service:

```sh
docker compose --profile rag run --rm rag-service python -m rag_service.ingest --fit-sparse-only
docker compose --profile rag restart rag-service
```

For a new namespace, preview and run the full ingestion instead:

```sh
docker compose --profile rag run --rm rag-service python -m rag_service.ingest --dry-run
docker compose --profile rag run --rm rag-service python -m rag_service.ingest
```

Add `--reset` only to deliberately replace every vector in the configured namespace.

Endpoints:

- RAG health: <http://localhost:8000/api/v1/>
- Interactive RAG API documentation: <http://localhost:8000/docs>

See [RAG_DOCUMENTATION.md](RAG_DOCUMENTATION.md) for architecture, ingestion, retrieval, evaluation, and operational details. See [PARSE_WITH_OCR.md](PARSE_WITH_OCR.md) for the document parsing workflow.

## Configuration notes

- `VITE_API_BASE_URL` is compiled into the frontend image. Rebuild the frontend after changing it.
- `VITE_RAG_API_BASE_URL` is also compiled into the frontend image.
- `FRONTEND_URLS` controls API CORS and accepts a comma-separated list.
- `RAG_CORS_ORIGINS` controls browser origins accepted by the RAG container.
- Do not commit `.env`, database dumps, API keys or credentials. Commit only `.env.example` templates.
- Replace development database credentials and restrict published ports before deploying publicly.

## Troubleshooting

### Backend reports `DATABASE_URL is required`

Create `backend/.env` from `backend/.env.example`, or start through Docker Compose, which supplies the value automatically.

### Prisma cannot reach `localhost:5432`

Start PostgreSQL and confirm its health:

```sh
docker compose up -d postgres
docker compose ps
```

### Frontend cannot reach the API

Confirm the backend health endpoint works and that `VITE_API_BASE_URL` points to a URL reachable by the browser, not to the internal Compose hostname.

### Inspect container startup

```sh
docker compose logs postgres
docker compose logs backend
docker compose logs frontend
```

## Contributing

Keep changes scoped by feature, add migrations for schema changes, preserve canonical identifiers, and run the relevant frontend and backend checks before opening a pull request.
