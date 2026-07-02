# Open Budget Nepal - Frontend

This directory contains the frontend application for Open Budget Nepal.

## Docker

The frontend Docker image is built using the local `Dockerfile` and serves the production build via `nginx`.

### Build the Docker image

```bash
cd frontend
docker build -t open-budget-nepal-frontend .
```


### Run the Docker container

```bash
docker run --rm -p 80:80 open-budget-nepal-frontend
```

Then open http://localhost in your browser.

### Notes

- The Docker image uses `node:20-alpine` to build the app and `nginx:alpine` to serve the static files.
- If you need to rebuild after changes, run the build command again before starting the container.
- To preview the app locally without Docker, use `npm install` and `npm run dev` in the `frontend` directory.
