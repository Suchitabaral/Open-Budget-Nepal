from __future__ import annotations

import unittest
from dataclasses import replace

from rag_service.config import RAGSettings
from rag_service.gemini import QueryExpansion
from rag_service.rag import RAGService
from rag_service.vector_db import HybridPineconeStore, RetrievedChunk


class _FakeStore:
    def __init__(self) -> None:
        self.queries: list[str] = []

    def search(self, query, *, k, alpha, metadata_filter=None):
        self.queries.append(query)
        shared = RetrievedChunk(
            id="shared",
            text="Document: नमुना\nPage: 2\n\nशिक्षा बजेट २०८१",
            score=0.8,
            metadata={
                "document_id": "doc-1",
                "document_name": "नमुना",
                "page": 2,
                "section": "शिक्षा",
            },
        )
        unique = RetrievedChunk(
            id=f"unique-{len(self.queries)}",
            text="other context",
            score=0.7,
            metadata={
                "document_id": "doc-1",
                "document_name": "नमुना",
                "page": 3,
                "section": "",
            },
        )
        return [unique, shared]


class _FakeGenerator:
    def expand_query(self, query):
        return QueryExpansion(
            "romanized_nepali",
            (query, "शिक्षा बजेट कति हो", "What is the education budget"),
        )

    def answer(self, *, query, context, detected_language):
        return "Shiksha budgetko sandarbha [1]."


class RAGServiceTests(unittest.TestCase):
    def test_multilingual_rank_fusion_and_answer(self) -> None:
        settings = replace(
            RAGSettings(),
            query_expansion=True,
            retrieval_k=2,
            query_expansion_candidates=3,
        )
        store = _FakeStore()
        service = RAGService(
            settings,
            embeddings=object(),
            vector_store=store,
            generator=_FakeGenerator(),
        )

        answer = service.answer("Shiksha budget kati ho?", k=2, alpha=0.6)

        self.assertEqual(len(store.queries), 3)
        self.assertEqual(answer.sources[0].id, "shared")
        self.assertEqual(answer.detected_language, "romanized_nepali")
        self.assertIn("[1]", answer.content)
        self.assertIn("page 2", answer.context)

    def test_hybrid_scaling(self) -> None:
        dense, sparse = HybridPineconeStore._hybrid_scale(
            [1.0, 2.0], {"indices": [4], "values": [3.0]}, 0.75
        )

        self.assertEqual(dense, [0.75, 1.5])
        self.assertEqual(sparse, {"indices": [4], "values": [0.75]})


if __name__ == "__main__":
    unittest.main()
