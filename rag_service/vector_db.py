from __future__ import annotations

import logging
import math
import time
from dataclasses import dataclass
from typing import Any, Iterable, Sequence

from langchain_core.embeddings import Embeddings
from pinecone import Pinecone, ServerlessSpec

from .config import RAGSettings
from .documents import DocumentChunk
from .sparse import MultilingualBM25Encoder, SparseVector


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RetrievedChunk:
    id: str
    text: str
    score: float
    metadata: dict[str, Any]


class HybridPineconeStore:
    """Single-index dense + BM25 sparse hybrid search."""

    def __init__(
        self,
        settings: RAGSettings,
        embeddings: Embeddings,
        client: Any | None = None,
    ) -> None:
        self.settings = settings
        self.embeddings = embeddings
        self._client = client
        self._index: Any | None = None
        self._sparse_encoder: MultilingualBM25Encoder | None = None

    @property
    def client(self) -> Any:
        if self._client is None:
            self._client = Pinecone(api_key=self.settings.require_pinecone_key())
        return self._client

    @property
    def index(self) -> Any:
        if self._index is None:
            self._ensure_index()
            self._index = self.client.Index(self.settings.pinecone_index_name)
        return self._index

    @property
    def sparse_encoder(self) -> MultilingualBM25Encoder:
        if self._sparse_encoder is None:
            try:
                self._sparse_encoder = MultilingualBM25Encoder.load(
                    self.settings.bm25_params_path
                )
            except FileNotFoundError as exc:
                raise RuntimeError(str(exc)) from exc
        return self._sparse_encoder

    def fit_sparse_encoder(
        self, chunks: Sequence[DocumentChunk], *, persist: bool = True
    ) -> None:
        encoder = MultilingualBM25Encoder().fit(chunk.text for chunk in chunks)
        self._sparse_encoder = encoder
        if persist:
            encoder.dump(self.settings.bm25_params_path)

    def upsert_chunks(
        self,
        chunks: Sequence[DocumentChunk],
        *,
        reset_namespace: bool = False,
        replace_documents: bool = True,
    ) -> int:
        if not chunks:
            raise ValueError("No document chunks were supplied for ingestion.")
        self.fit_sparse_encoder(chunks, persist=False)

        namespace_exists = self._namespace_exists()
        if reset_namespace and namespace_exists:
            self.index.delete(
                delete_all=True, namespace=self.settings.pinecone_namespace
            )
        elif replace_documents and namespace_exists:
            for document_id in sorted(
                {str(chunk.metadata["document_id"]) for chunk in chunks}
            ):
                self.index.delete(
                    filter={"document_id": {"$eq": document_id}},
                    namespace=self.settings.pinecone_namespace,
                )
        elif not namespace_exists:
            logger.info(
                "Pinecone namespace '%s' does not exist; the first upsert will "
                "create it automatically.",
                self.settings.pinecone_namespace,
            )

        upserted = 0
        batches = self._batches(chunks, self.settings.pinecone_upsert_batch_size)
        total_batches = math.ceil(
            len(chunks) / self.settings.pinecone_upsert_batch_size
        )
        for batch_number, batch in enumerate(batches, start=1):
            texts = [chunk.text for chunk in batch]
            dense_vectors = self.embeddings.embed_documents(texts)
            sparse_vectors = self.sparse_encoder.encode_documents(texts)
            vectors = [
                {
                    "id": chunk.id,
                    "values": dense,
                    "sparse_values": sparse,
                    "metadata": {"text": chunk.text, **chunk.metadata},
                }
                for chunk, dense, sparse in zip(
                    batch, dense_vectors, sparse_vectors, strict=True
                )
            ]
            response = self.index.upsert(
                vectors=vectors,
                namespace=self.settings.pinecone_namespace,
            )
            upserted += int(self._value(response, "upserted_count", len(vectors)))
            if batch_number % 10 == 0 or batch_number == total_batches:
                logger.info(
                    "Indexed batch %s/%s (%s vectors).",
                    batch_number,
                    total_batches,
                    upserted,
                )
        self.sparse_encoder.dump(self.settings.bm25_params_path)
        return upserted

    def search(
        self,
        query: str,
        *,
        k: int,
        alpha: float,
        metadata_filter: dict[str, Any] | None = None,
    ) -> list[RetrievedChunk]:
        if not 0.0 <= alpha <= 1.0:
            raise ValueError("alpha must be between 0 and 1")

        dense = self.embeddings.embed_query(query)
        sparse = self.sparse_encoder.encode_query(query)
        dense, sparse = self._hybrid_scale(dense, sparse, alpha)
        query_args: dict[str, Any] = {
            "namespace": self.settings.pinecone_namespace,
            "top_k": k,
            "vector": dense,
            "include_values": False,
            "include_metadata": True,
        }
        if sparse["indices"] and any(float(value) != 0.0 for value in sparse["values"]):
            query_args["sparse_vector"] = sparse
        if metadata_filter:
            query_args["filter"] = metadata_filter

        response = self.index.query(**query_args)
        matches = self._value(response, "matches", [])
        output: list[RetrievedChunk] = []
        for match in matches:
            metadata = dict(self._value(match, "metadata", {}) or {})
            text = str(metadata.pop("text", ""))
            output.append(
                RetrievedChunk(
                    id=str(self._value(match, "id", "")),
                    text=text,
                    score=float(self._value(match, "score", 0.0)),
                    metadata=metadata,
                )
            )
        return output

    def describe_stats(self) -> dict[str, Any]:
        response = self.index.describe_index_stats()
        return response.to_dict() if hasattr(response, "to_dict") else dict(response)

    def _namespace_exists(self) -> bool:
        response = self.index.describe_index_stats()
        namespaces = self._value(response, "namespaces", {}) or {}
        if isinstance(namespaces, dict):
            return self.settings.pinecone_namespace in namespaces
        try:
            return self.settings.pinecone_namespace in namespaces
        except TypeError:
            return False

    def _ensure_index(self) -> None:
        name = self.settings.pinecone_index_name
        if not self.client.has_index(name):
            self.client.create_index(
                name=name,
                vector_type="dense",
                dimension=self.settings.embedding_dimension,
                metric="dotproduct",
                spec=ServerlessSpec(
                    cloud=self.settings.pinecone_cloud,
                    region=self.settings.pinecone_region,
                ),
            )
        self._wait_until_ready(name)

        description = self.client.describe_index(name)
        dimension = int(self._value(description, "dimension", 0))
        metric = str(self._value(description, "metric", ""))
        if dimension != self.settings.embedding_dimension or metric != "dotproduct":
            raise RuntimeError(
                f"Pinecone index '{name}' is {dimension}-dimensional with metric "
                f"'{metric}'. Hybrid E5 search requires dimension "
                f"{self.settings.embedding_dimension} and metric 'dotproduct'."
            )

    def _wait_until_ready(self, name: str) -> None:
        deadline = time.monotonic() + self.settings.pinecone_ready_timeout
        while time.monotonic() < deadline:
            description = self.client.describe_index(name)
            status = self._value(description, "status", {})
            if bool(self._value(status, "ready", False)):
                return
            time.sleep(1)
        raise TimeoutError(
            f"Pinecone index '{name}' was not ready after "
            f"{self.settings.pinecone_ready_timeout} seconds."
        )

    @staticmethod
    def _hybrid_scale(
        dense: list[float], sparse: SparseVector, alpha: float
    ) -> tuple[list[float], SparseVector]:
        return (
            [value * alpha for value in dense],
            {
                "indices": list(sparse["indices"]),
                "values": [
                    float(value) * (1.0 - alpha) for value in sparse["values"]
                ],
            },
        )

    @staticmethod
    def _batches(
        values: Sequence[DocumentChunk], batch_size: int
    ) -> Iterable[Sequence[DocumentChunk]]:
        for start in range(0, len(values), batch_size):
            yield values[start : start + batch_size]

    @staticmethod
    def _value(value: Any, key: str, default: Any) -> Any:
        if isinstance(value, dict):
            return value.get(key, default)
        return getattr(value, key, default)
