# Open-Budget-Nepal

RAG API for Open Budget Nepal. The Docker setup runs the FastAPI RAG service and an Ollama server in the same Compose network.

## Docker Quick Start

1. Create a local environment file:

```sh
cp .env.example .env
```

2. Edit `.env` and set at least:

```env
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=budgetrag
PINECONE_NAMESPACE=codefest2025
```

3. Start the RAG API and Ollama:

```sh
docker compose up --build -d rag-service
```

4. Pull the configured Ollama model the first time:

```sh
docker compose exec ollama ollama pull qwen2.5:7b-instruct
```

5. Check the containers:

```sh
docker compose ps
docker compose exec ollama ollama list
```

## Service URLs

Use `localhost` from your browser or API client. Do not use `0.0.0.0` as a client URL; that address is only for server binding.

Health check:

```sh
curl http://localhost:8000/api/v1/
```

Chat request:

```sh
curl "http://localhost:8000/api/v1/chat?query=how%20is%20the%20national%20budget%20allocated%3F"
```

Ollama on the host:

```sh
curl http://localhost:11434/api/tags
```

Ollama inside Docker is reached by the RAG service with:

```env
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=qwen2.5:7b-instruct
```

## Useful Commands

```sh
docker compose logs -f rag-service
docker compose logs -f ollama
docker compose restart rag-service
docker compose down
```

Model storage is persisted in the `ollama_data` Docker volume, so the model does not need to be pulled again after normal restarts.

## Troubleshooting

If chat returns `Connection timed out`, confirm Ollama is running and the model is installed:

```sh
docker compose ps
docker compose exec ollama ollama list
```

If `ollama list` is empty, pull the model:

```sh
docker compose exec ollama ollama pull qwen2.5:7b-instruct
```

If a browser request gets `405 Method Not Allowed`, make sure the app is running the latest code and restart the RAG service:

```sh
docker compose restart rag-service
```
