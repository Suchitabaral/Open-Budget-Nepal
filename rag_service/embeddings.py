from __future__ import annotations

from threading import Lock
from typing import Sequence

from langchain_core.embeddings import Embeddings

from .config import RAGSettings


class MultilingualE5Embeddings(Embeddings):
    """Lazy SentenceTransformer adapter with E5's required query/passage prefixes."""

    def __init__(self, settings: RAGSettings) -> None:
        self.settings = settings
        self._model = None
        self._lock = Lock()

    @property
    def model(self):
        if self._model is None:
            with self._lock:
                if self._model is None:
                    from sentence_transformers import SentenceTransformer

                    kwargs = {}
                    if self.settings.embedding_device:
                        kwargs["device"] = self.settings.embedding_device
                    self._model = SentenceTransformer(
                        self.settings.embedding_model_name, **kwargs
                    )
        return self._model

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._encode([self._passage_text(text) for text in texts])

    def embed_query(self, text: str) -> list[float]:
        return self._encode([self._query_text(text)])[0]

    def _encode(self, texts: Sequence[str]) -> list[list[float]]:
        embeddings = self.model.encode(
            list(texts),
            batch_size=self.settings.embedding_batch_size,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return embeddings.tolist()

    @staticmethod
    def _passage_text(text: str) -> str:
        return text if text.startswith("passage: ") else f"passage: {text}"

    @staticmethod
    def _query_text(text: str) -> str:
        return text if text.startswith("query: ") else f"query: {text}"
