from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ChatQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(min_length=1, max_length=4000)
    k: int | None = Field(default=None, ge=1, le=50)
    alpha: float | None = Field(default=None, ge=0.0, le=1.0)


class SourceResponse(BaseModel):
    id: str
    score: float
    text: str
    document_id: str
    document_name: str
    page: int
    section: str = ""
    source_path: str = ""
    metadata: dict[str, Any]


class ChatResponse(BaseModel):
    query: str
    content: str
    detected_language: str
    search_queries: list[str]
    alpha: float
    context: str
    sources: list[SourceResponse]


class RetrieveResponse(BaseModel):
    query: str
    detected_language: str
    search_queries: list[str]
    alpha: float
    sources: list[SourceResponse]


class HealthResponse(BaseModel):
    status: str
    pinecone_configured: bool
    gemini_configured: bool
    bm25_fitted: bool
    index_name: str
    namespace: str
