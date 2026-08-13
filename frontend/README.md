# Open Budget Nepal frontend

React 19, TypeScript, Vite, Tailwind CSS, Leaflet and Recharts frontend for Open Budget Nepal.

## Local development

```sh
cp .env.example .env
npm ci
npm run dev
```

The development server is available at <http://localhost:5173>. The backend should be running at the URL configured by `VITE_API_BASE_URL`.

## Commands

```sh
npm test       # focused frontend tests
npm run lint   # ESLint
npm run build  # type-check and production build
npm run geo:validate
```

## Docker

The frontend imports administrative data from the repository-level `shared/` directory, so build it from the repository root:

```sh
docker build \
  -f frontend/Dockerfile.frontend \
  --build-arg VITE_API_BASE_URL=http://localhost:3001/api \
  -t open-budget-nepal-frontend .

docker run --rm -p 8080:80 open-budget-nepal-frontend
```

For the complete application, prefer the root `docker compose up --build` workflow.

## Environment

```env
VITE_API_BASE_URL=http://localhost:3001/api
```

Vite embeds this value during the build. Rebuild the image after changing it.
