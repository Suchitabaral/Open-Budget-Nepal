from __future__ import annotations

import logging

from fastapi import FastAPI, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.genai.errors import ClientError

from .config import RAGSettings
from .rag import RAGAnswer, RAGService
from .schema import (
    ChatQuery,
    ChatResponse,
    HealthResponse,
    RetrieveResponse,
    SourceResponse,
)
from .vector_db import RetrievedChunk


logger = logging.getLogger(__name__)
settings = RAGSettings()
app = FastAPI(
    title="Open Budget Nepal RAG API",
    version="1.0.0",
    description="Multilingual Nepali, romanized Nepali, and English hybrid RAG.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

_service: RAGService | None = None


def get_service() -> RAGService:
    global _service
    if _service is None:
        _service = RAGService(settings)
    return _service


@app.exception_handler(RuntimeError)
async def runtime_exception_handler(request: Request, exc: RuntimeError) -> JSONResponse:
    logger.exception("RAG runtime error on %s", request.url.path)
    return JSONResponse(status_code=503, content={"detail": str(exc)})


@app.exception_handler(ClientError)
async def model_client_exception_handler(request: Request, exc: ClientError) -> JSONResponse:
    status_code = int(getattr(exc, "status_code", 0) or getattr(exc, "code", 0) or 500)
    if status_code == 500 and "429 RESOURCE_EXHAUSTED" in str(exc):
        status_code = 429
    logger.warning("Model provider error on %s: status=%s", request.url.path, status_code)
    if status_code == 429:
        return JSONResponse(
            status_code=429,
            headers={"Retry-After": "60"},
            content={"detail": "The assistant has reached its model usage limit. Please try again later."},
        )
    return JSONResponse(
        status_code=503,
        content={"detail": "The answer-generation service is temporarily unavailable."},
    )


@app.get("/api/v1/", response_model=HealthResponse)
@app.get("/api/v1/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        pinecone_configured=bool(settings.pinecone_api_key),
        gemini_configured=bool(settings.gemini_api_key),
        bm25_fitted=settings.bm25_params_path.is_file(),
        index_name=settings.pinecone_index_name,
        namespace=settings.pinecone_namespace,
    )


@app.get("/api/v1/chat", response_model=ChatResponse)
async def chat_get(
    query: str = Query(min_length=1, max_length=4000),
    k: int | None = Query(default=None, ge=1, le=50),
    alpha: float | None = Query(default=None, ge=0.0, le=1.0),
) -> ChatResponse:
    result = await run_in_threadpool(get_service().answer, query, k=k, alpha=alpha)
    return _chat_response(result)


@app.post("/api/v1/chat", response_model=ChatResponse)
async def chat_post(request: ChatQuery) -> ChatResponse:
    result = await run_in_threadpool(
        get_service().answer, request.query, k=request.k, alpha=request.alpha
    )
    return _chat_response(result)


@app.post("/api/v1/retrieve", response_model=RetrieveResponse)
async def retrieve(request: ChatQuery) -> RetrieveResponse:
    service = get_service()
    chunks, expansion = await run_in_threadpool(
        service.retrieve_chunks,
        request.query,
        k=request.k,
        alpha=request.alpha,
    )
    return RetrieveResponse(
        query=request.query,
        detected_language=expansion.detected_language,
        search_queries=list(expansion.queries),
        alpha=settings.hybrid_alpha if request.alpha is None else request.alpha,
        sources=[_source_response(chunk) for chunk in chunks],
    )


def _chat_response(result: RAGAnswer) -> ChatResponse:
    return ChatResponse(
        query=result.query,
        content=result.content,
        detected_language=result.detected_language,
        search_queries=list(result.search_queries),
        alpha=result.alpha,
        context=result.context,
        sources=[_source_response(chunk) for chunk in result.sources],
    )


def _source_response(chunk: RetrievedChunk) -> SourceResponse:
    metadata = dict(chunk.metadata)
    return SourceResponse(
        id=chunk.id,
        score=chunk.score,
        text=chunk.text,
        document_id=str(metadata.get("document_id") or ""),
        document_name=str(metadata.get("document_name") or ""),
        page=int(metadata.get("page", -1)),
        section=str(metadata.get("section") or ""),
        source_path=str(metadata.get("source_path") or ""),
        metadata=metadata,
    )
