# Open Budget Nepal

Open Budget Nepal is a public-finance transparency platform for exploring Nepal's budgets, local projects, contractors, procurement records, administrative geography, and deterministic Watchdog findings.

## What is included

- React, TypeScript, Vite and Tailwind frontend
- Express and TypeScript API
- PostgreSQL database managed with Prisma migrations
- Canonical registry of 7 provinces, 77 districts and 753 local levels
- Leaflet administrative-boundary explorer
- Public OpenAPI/Swagger documentation
- Optional multilingual FastAPI, Pinecone and Gemini RAG service

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

Start PostgreSQL, the API and frontend:

```sh
docker compose up --build
```

Open:

- Application: <http://localhost:8080>
- API: <http://localhost:3001>
- API health: <http://localhost:3001/api/v1/health>
- Interactive API documentation: <http://localhost:3001/api/docs>
- OpenAPI JSON: <http://localhost:3001/api/openapi.json>

On first startup, the backend applies committed Prisma migrations and seeds the bundled datasets when the application tables are empty. Later restarts preserve existing database data.

Run in the background and inspect status:

```sh
docker compose up --build -d
docker compose ps
docker compose logs -f backend
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

## Optional RAG services

The RAG stack is isolated behind the `rag` Compose profile and is not required by the current core website.

Set `PINECONE_API_KEY`, `GEMINI_API_KEY`, and the related RAG values in `.env`. Preview the parsed-document contract, ingest the corpus, then start the service:

```sh
docker compose --profile rag build rag-service
docker compose --profile rag run --rm rag-service python -m rag_service.ingest --dry-run
docker compose --profile rag run --rm rag-service python -m rag_service.ingest
docker compose --profile rag up -d rag-service
```

Endpoints:

- RAG health: <http://localhost:8000/api/v1/health>
- Interactive RAG API documentation: <http://localhost:8000/docs>

See [RAG_DOCUMENTATION.md](RAG_DOCUMENTATION.md) for architecture, ingestion, retrieval, evaluation, and operational details. See [PARSE_WITH_OCR.md](PARSE_WITH_OCR.md) for the document parsing workflow.

## Configuration notes

- `VITE_API_BASE_URL` is compiled into the frontend image. Rebuild the frontend after changing it.
- `FRONTEND_URLS` controls API CORS and accepts a comma-separated list.
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
