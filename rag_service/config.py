from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv


load_dotenv()


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_path(name: str, default: str) -> Path:
    return Path(os.getenv(name, default)).expanduser()


def _env_origins() -> tuple[str, ...]:
    value = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173")
    return tuple(origin.strip() for origin in value.split(",") if origin.strip())


@dataclass(frozen=True)
class RAGSettings:
    """Runtime configuration loaded from environment variables."""

    parsed_documents_dir: Path = field(
        default_factory=lambda: _env_path("PARSED_DOCUMENTS_DIR", "parsed_documents")
    )
    bm25_params_path: Path = field(
        default_factory=lambda: _env_path(
            "RAG_BM25_PARAMS", ".rag/bm25_params.json"
        )
    )

    pinecone_api_key: str | None = field(
        default_factory=lambda: os.getenv("PINECONE_API_KEY"), repr=False
    )
    pinecone_index_name: str = field(
        default_factory=lambda: os.getenv("PINECONE_INDEX_NAME", "budgetrag")
    )
    pinecone_namespace: str = field(
        default_factory=lambda: os.getenv("PINECONE_NAMESPACE", "open-budget-nepal")
    )
    pinecone_cloud: str = field(
        default_factory=lambda: os.getenv("PINECONE_CLOUD", "aws")
    )
    pinecone_region: str = field(
        default_factory=lambda: os.getenv("PINECONE_REGION", "us-east-1")
    )
    pinecone_upsert_batch_size: int = field(
        default_factory=lambda: int(os.getenv("PINECONE_UPSERT_BATCH_SIZE", "64"))
    )
    pinecone_ready_timeout: int = field(
        default_factory=lambda: int(os.getenv("PINECONE_READY_TIMEOUT", "120"))
    )

    embedding_model_name: str = field(
        default_factory=lambda: os.getenv(
            "EMBEDDING_MODEL_NAME", "intfloat/multilingual-e5-base"
        )
    )
    embedding_dimension: int = field(
        default_factory=lambda: int(os.getenv("EMBEDDING_DIMENSION", "768"))
    )
    embedding_batch_size: int = field(
        default_factory=lambda: int(os.getenv("EMBEDDING_BATCH_SIZE", "32"))
    )
    embedding_device: str | None = field(
        default_factory=lambda: os.getenv("EMBEDDING_DEVICE") or None
    )

    gemini_api_key: str | None = field(
        default_factory=lambda: os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY"),
        repr=False,
    )
    gemini_model: str = field(
        default_factory=lambda: os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
    )
    gemini_temperature: float = field(
        default_factory=lambda: float(os.getenv("GEMINI_TEMPERATURE", "0.1"))
    )
    gemini_max_output_tokens: int = field(
        default_factory=lambda: int(os.getenv("GEMINI_MAX_OUTPUT_TOKENS", "2048"))
    )

    chunk_size: int = field(
        default_factory=lambda: int(os.getenv("RAG_CHUNK_SIZE", "1200"))
    )
    chunk_overlap: int = field(
        default_factory=lambda: int(os.getenv("RAG_CHUNK_OVERLAP", "150"))
    )
    minimum_quality_score: float = field(
        default_factory=lambda: float(os.getenv("RAG_MIN_QUALITY_SCORE", "0.25"))
    )
    retrieval_k: int = field(
        default_factory=lambda: int(os.getenv("RAG_RETRIEVAL_K", "6"))
    )
    hybrid_alpha: float = field(
        default_factory=lambda: float(os.getenv("RAG_HYBRID_ALPHA", "0.7"))
    )
    query_expansion: bool = field(
        default_factory=lambda: _env_bool("RAG_QUERY_EXPANSION", True)
    )
    query_expansion_candidates: int = field(
        default_factory=lambda: int(os.getenv("RAG_QUERY_EXPANSION_CANDIDATES", "12"))
    )
    max_context_characters: int = field(
        default_factory=lambda: int(os.getenv("RAG_MAX_CONTEXT_CHARACTERS", "14000"))
    )

    ragas_evaluator_model: str = field(
        default_factory=lambda: os.getenv(
            "RAGAS_EVALUATOR_MODEL", os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
        )
    )
    cors_origins: tuple[str, ...] = field(default_factory=_env_origins)

    def validate(self) -> None:
        if not 0.0 <= self.hybrid_alpha <= 1.0:
            raise ValueError("RAG_HYBRID_ALPHA must be between 0 and 1.")
        if self.chunk_overlap < 0 or self.chunk_overlap >= self.chunk_size:
            raise ValueError(
                "RAG_CHUNK_OVERLAP must be >= 0 and smaller than RAG_CHUNK_SIZE."
            )
        if self.embedding_dimension <= 0:
            raise ValueError("EMBEDDING_DIMENSION must be positive.")
        if self.embedding_batch_size <= 0:
            raise ValueError("EMBEDDING_BATCH_SIZE must be positive.")
        if self.pinecone_upsert_batch_size <= 0:
            raise ValueError("PINECONE_UPSERT_BATCH_SIZE must be positive.")
        if self.pinecone_ready_timeout <= 0:
            raise ValueError("PINECONE_READY_TIMEOUT must be positive.")
        if self.retrieval_k <= 0:
            raise ValueError("RAG_RETRIEVAL_K must be positive.")
        if not 0.0 <= self.minimum_quality_score <= 1.0:
            raise ValueError("RAG_MIN_QUALITY_SCORE must be between 0 and 1.")
        if self.max_context_characters <= 0:
            raise ValueError("RAG_MAX_CONTEXT_CHARACTERS must be positive.")

    def require_pinecone_key(self) -> str:
        if not self.pinecone_api_key:
            raise RuntimeError("PINECONE_API_KEY is required for indexing and retrieval.")
        return self.pinecone_api_key

    def require_gemini_key(self) -> str:
        if not self.gemini_api_key:
            raise RuntimeError(
                "GEMINI_API_KEY (or GOOGLE_API_KEY) is required for query expansion and answers."
            )
        return self.gemini_api_key
