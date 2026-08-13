# Open Budget Nepal backend

Express and TypeScript API backed by PostgreSQL and Prisma.

## Local setup

```sh
cp .env.example .env
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Default URLs:

- API root: <http://localhost:3001>
- Health: <http://localhost:3001/api/v1/health>
- Swagger UI: <http://localhost:3001/api/docs>
- OpenAPI JSON: <http://localhost:3001/api/openapi.json>

## Environment variables

- `DATABASE_URL`: PostgreSQL connection string; required at runtime
- `PORT`: API port, default `3001`
- `FRONTEND_URLS`: comma-separated CORS origins
- `SEED_CSV_DIR`: directory containing initial CSV datasets
- `ADMINISTRATIVE_REGISTRY_PATH`: canonical local-level registry JSON

## Database workflow

Create a migration during development:

```sh
npm run prisma:migrate -- --name describe_change
```

Apply committed migrations:

```sh
npx prisma migrate deploy
```

Seed only the administrative registry:

```sh
npm run db:seed:registry
```

The full seed clears and reloads seeded domain tables. Use it only when that behavior is intended:

```sh
npm run db:seed
```

Open the database browser:

```sh
npx prisma studio
```

## Verification

```sh
npm test
npm run build
```

## Docker behavior

The production container runs `prisma migrate deploy`, seeds bundled data only when the application domain tables are empty, and then starts the compiled API. Normal container restarts do not erase populated application tables.
