from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Sequence

from .config import RAGSettings
from .documents import DocumentChunk, ParsedDocumentLoader
from .embeddings import MultilingualE5Embeddings
from .gemini import GeminiGenerator, QueryExpansion
from .vector_db import HybridPineconeStore, RetrievedChunk


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RAGAnswer:
    query: str
    content: str
    context: str
    sources: tuple[RetrievedChunk, ...]
    detected_language: str
    search_queries: tuple[str, ...]
    alpha: float


class RAGService:
    def __init__(
        self,
        settings: RAGSettings | None = None,
        *,
        embeddings: Any | None = None,
        vector_store: Any | None = None,
        generator: Any | None = None,
    ) -> None:
        self.settings = settings or RAGSettings()
        self.settings.validate()
        self.embeddings = embeddings or MultilingualE5Embeddings(self.settings)
        self.vector_store = vector_store or HybridPineconeStore(
            self.settings, self.embeddings
        )
        self.generator = generator or GeminiGenerator(self.settings)

    def create_store_embeddings(
        self,
        *,
        document_ids: set[str] | None = None,
        reset_namespace: bool = False,
        replace_documents: bool = True,
    ) -> int:
        chunks = ParsedDocumentLoader(self.settings).load_chunks(document_ids)
        return self.ingest_chunks(
            chunks,
            reset_namespace=reset_namespace,
            replace_documents=replace_documents,
        )

    def ingest_chunks(
        self,
        chunks: Sequence[DocumentChunk],
        *,
        reset_namespace: bool = False,
        replace_documents: bool = True,
    ) -> int:
        return self.vector_store.upsert_chunks(
            chunks,
            reset_namespace=reset_namespace,
            replace_documents=replace_documents,
        )

    def retrieve_chunks(
        self,
        query: str,
        *,
        k: int | None = None,
        alpha: float | None = None,
        metadata_filter: dict[str, Any] | None = None,
    ) -> tuple[list[RetrievedChunk], QueryExpansion]:
        query = query.strip()
        if not query:
            raise ValueError("query cannot be empty")
        result_count = k or self.settings.retrieval_k
        hybrid_alpha = self.settings.hybrid_alpha if alpha is None else alpha
        if result_count < 1 or result_count > 50:
            raise ValueError("k must be between 1 and 50")
        if not 0.0 <= hybrid_alpha <= 1.0:
            raise ValueError("alpha must be between 0 and 1")

        expansion = self._expand_query(query)
        rankings: list[list[RetrievedChunk]] = []
        candidate_count = max(
            result_count, self.settings.query_expansion_candidates
        )
        for search_query in expansion.queries:
            rankings.append(
                self.vector_store.search(
                    search_query,
                    k=candidate_count,
                    alpha=hybrid_alpha,
                    metadata_filter=metadata_filter,
                )
            )
        return self._reciprocal_rank_fusion(rankings, result_count), expansion

    def retrieve_query(
        self, query: str, k: int | None = None, alpha: float | None = None
    ) -> str:
        chunks, _ = self.retrieve_chunks(query, k=k, alpha=alpha)
        context, _ = self.format_context(chunks, self.settings.max_context_characters)
        return context

    def answer(
        self, query: str, *, k: int | None = None, alpha: float | None = None
    ) -> RAGAnswer:
        chunks, expansion = self.retrieve_chunks(query, k=k, alpha=alpha)
        context, selected_chunks = self.format_context(
            chunks, self.settings.max_context_characters
        )
        if not selected_chunks:
            raise RuntimeError("No relevant context was retrieved from Pinecone.")
        content = self.generator.answer(
            query=query,
            context=context,
            detected_language=expansion.detected_language,
        )
        return RAGAnswer(
            query=query,
            content=content,
            context=context,
            sources=tuple(selected_chunks),
            detected_language=expansion.detected_language,
            search_queries=expansion.queries,
            alpha=self.settings.hybrid_alpha if alpha is None else alpha,
        )

    def llm_invoke(
        self, query: str, k: int | None = None, alpha: float | None = None
    ) -> tuple[str, str]:
        result = self.answer(query, k=k, alpha=alpha)
        return result.content, result.context

    def _expand_query(self, query: str) -> QueryExpansion:
        fallback = QueryExpansion(self._detect_language(query), (query,))
        if not self.settings.query_expansion:
            return fallback
        try:
            return self.generator.expand_query(query)
        except Exception as exc:
            logger.warning("Multilingual query expansion failed; using original query: %s", exc)
            return fallback

    @staticmethod
    def _detect_language(query: str) -> str:
        if any("\u0900" <= character <= "\u097f" for character in query):
            return "nepali"
        romanized_markers = {
            "cha",
            "chha",
            "kati",
            "kasari",
            "kina",
            "ko",
            "ma",
            "ra",
            "yo",
        }
        words = {word.strip(".,?!").casefold() for word in query.split()}
        return "romanized_nepali" if words & romanized_markers else "english"

    @staticmethod
    def _reciprocal_rank_fusion(
        rankings: Sequence[Sequence[RetrievedChunk]], k: int, rank_constant: int = 60
    ) -> list[RetrievedChunk]:
        scores: dict[str, float] = {}
        chunks: dict[str, RetrievedChunk] = {}
        for ranking in rankings:
            for rank, chunk in enumerate(ranking, start=1):
                scores[chunk.id] = scores.get(chunk.id, 0.0) + 1.0 / (
                    rank_constant + rank
                )
                chunks[chunk.id] = chunk
        ordered_ids = sorted(scores, key=scores.get, reverse=True)
        return [
            RetrievedChunk(
                id=chunks[chunk_id].id,
                text=chunks[chunk_id].text,
                score=scores[chunk_id],
                metadata=chunks[chunk_id].metadata,
            )
            for chunk_id in ordered_ids[:k]
        ]

    @staticmethod
    def format_context(
        chunks: Sequence[RetrievedChunk], max_characters: int
    ) -> tuple[str, list[RetrievedChunk]]:
        blocks: list[str] = []
        selected: list[RetrievedChunk] = []
        used = 0
        for source_number, chunk in enumerate(chunks, start=1):
            document_name = chunk.metadata.get("document_name") or chunk.metadata.get(
                "document_id", "Unknown document"
            )
            page = chunk.metadata.get("page", "unknown")
            section = chunk.metadata.get("section")
            label = f"[{source_number}] {document_name} | page {page}"
            if section:
                label += f" | {section}"
            block = f"{label}\n{chunk.text}".strip()
            remaining = max_characters - used
            if remaining <= 0:
                break
            if len(block) > remaining:
                if selected:
                    break
                block = block[:remaining].rstrip()
            blocks.append(block)
            selected.append(chunk)
            used += len(block) + 2
        return "\n\n".join(blocks), selected


class ChatBot:
    """Backwards-compatible facade for existing callers."""

    _service: RAGService | None = None

    @classmethod
    def service(cls) -> RAGService:
        if cls._service is None:
            cls._service = RAGService()
        return cls._service

    @classmethod
    def create_store_embeddings(cls) -> int:
        return cls.service().create_store_embeddings()

    @classmethod
    def retrieve_query(cls, query_text: str, k: int = 6) -> str:
        return cls.service().retrieve_query(query_text, k=k)

    @classmethod
    def llm_invoke(cls, query: str) -> tuple[str, str]:
        return cls.service().llm_invoke(query)


if __name__ == "__main__":
    user_query = input("Enter query: ")
    answer, source_context = ChatBot.llm_invoke(user_query)
    print(answer)
    print(source_context)
